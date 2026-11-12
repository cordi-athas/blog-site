import { holidayMap, type Holiday } from '../data/holidays';
import { addDays, weekdayMon0 } from './dates';

export interface Settings {
  /** Cumartesi iş günü mü? */
  saturdayWork: boolean;
}

export interface Day {
  iso: string;
  weekend: boolean;
  holiday?: Holiday;
  /** Bu gün izin almak kaç gün izne mal olur (0, 0.5 veya 1). */
  cost: number;
}

export interface Opportunity {
  start: string;
  end: string;
  length: number;
  leave: number;
  /** İzin alınması gereken günler */
  leaveDays: string[];
  holidays: Holiday[];
  group: string;
  ratio: number;
}

export interface HolidayGroup {
  key: string;
  name: string;
  firstHoliday: string;
  /** İzinsiz, sadece resmi tatil + hafta sonu ile oluşan blok */
  base: { start: string; end: string; length: number };
  options: Opportunity[];
}

export function baseName(h: Holiday): string {
  const parts = h.name.split(' + ').map((p) => p.replace(/ \d+\. Gün$/, '').replace(/ Arifesi$/, ''));
  return [...new Set(parts)].join(' + ');
}

/** Seçili yılın bir ay öncesinden bir ay sonrasına kadar günleri üretir (yıl geçişlerindeki köprüler için). */
export function buildDays(year: number, settings: Settings): Day[] {
  const map = holidayMap([year - 1, year, year + 1]);
  const days: Day[] = [];
  let iso = `${year - 1}-12-01`;
  const last = `${year + 1}-01-31`;
  while (iso <= last) {
    const wd = weekdayMon0(iso);
    const weekend = wd === 6 || (wd === 5 && !settings.saturdayWork);
    const holiday = map.get(iso);
    let cost = 1;
    if (weekend) cost = 0;
    else if (holiday?.kind === 'full') cost = 0;
    else if (holiday?.kind === 'half') cost = 0.5;
    days.push({ iso, weekend, holiday, cost });
    iso = addDays(iso, 1);
  }
  return days;
}

/**
 * Resmi tatil içeren tüm "maksimal" tatil bloklarını bulur:
 * blok öncesi ve sonrası iş günüdür, içindeki iş günleri izinle kapatılır.
 */
export function findOpportunities(
  days: Day[],
  year: number,
  opts: { maxLeave: number; maxLength: number },
): Opportunity[] {
  const out: Opportunity[] = [];
  const n = days.length;
  for (let s = 1; s < n - 1; s++) {
    if (days[s - 1].cost === 0) continue; // bir önceki gün zaten tatil → blok daha erken başlar
    let leave = 0;
    let hasHolidayInYear = false;
    for (let e = s; e < n - 1 && e - s + 1 <= opts.maxLength; e++) {
      leave += days[e].cost;
      if (leave > opts.maxLeave) break;
      const h = days[e].holiday;
      if (h && h.date.startsWith(String(year))) hasHolidayInYear = true;
      if (days[e + 1].cost === 0) continue; // ertesi gün tatil → blok uzar, maksimal değil
      if (!hasHolidayInYear || leave === 0) continue;
      const slice = days.slice(s, e + 1);
      const holidays = slice.filter((d) => d.holiday).map((d) => d.holiday!);
      const length = e - s + 1;
      out.push({
        start: days[s].iso,
        end: days[e].iso,
        length,
        leave,
        leaveDays: slice.filter((d) => d.cost > 0).map((d) => d.iso),
        holidays,
        group: groupKey(holidays, year),
        ratio: length / leave,
      });
    }
  }
  return out;
}

function groupKey(holidays: Holiday[], year: number): string {
  const inYear = holidays.filter((h) => h.date.startsWith(String(year)));
  const first = inYear.find((h) => h.kind === 'full') ?? inYear[0];
  return `${first.date.slice(0, 4)}|${baseName(first)}`;
}

/** Her resmi tatil için izin gününe göre en uzun blokları (Pareto-optimal seçenekleri) çıkarır. */
export function groupOpportunities(days: Day[], year: number, opps: Opportunity[]): HolidayGroup[] {
  const groups = new Map<string, HolidayGroup>();

  // izinsiz baz bloklar; aynı bloğa düşen tatiller (ör. Kurban Bayramı + 19 Mayıs) tek grupta birleşir
  const yearStr = String(year);
  const alias = new Map<string, string>();
  const byBlock = new Map<string, string>();
  for (let i = 0; i < days.length; i++) {
    const h = days[i].holiday;
    if (!h || !h.date.startsWith(yearStr) || h.kind !== 'full') continue;
    const key = `${yearStr}|${baseName(h)}`;
    if (alias.has(key)) continue;
    let s = i;
    while (s > 0 && days[s - 1].cost === 0) s--;
    let e = i;
    while (e < days.length - 1 && days[e + 1].cost === 0) e++;
    const blockKey = `${days[s].iso}|${days[e].iso}`;
    const existing = byBlock.get(blockKey);
    if (existing) {
      alias.set(key, existing);
      const g = groups.get(existing)!;
      const names = new Set(g.name.split(' + '));
      for (const part of baseName(h).split(' + ')) names.add(part);
      g.name = [...names].join(' + ');
      continue;
    }
    alias.set(key, key);
    byBlock.set(blockKey, key);
    groups.set(key, {
      key,
      name: baseName(h),
      firstHoliday: h.date,
      base: { start: days[s].iso, end: days[e].iso, length: e - s + 1 },
      options: [],
    });
  }

  const byGroup = new Map<string, Opportunity[]>();
  for (const o of opps) {
    const key = alias.get(o.group);
    if (!key) continue;
    const arr = byGroup.get(key) ?? [];
    arr.push(o);
    byGroup.set(key, arr);
  }

  for (const [key, list] of byGroup) {
    const g = groups.get(key)!;
    // her izin miktarı için en uzun bloğu tut; erken tarihli olanı tercih et
    const bestByLeave = new Map<number, Opportunity>();
    for (const o of list) {
      const cur = bestByLeave.get(o.leave);
      if (!cur || o.length > cur.length || (o.length === cur.length && o.start < cur.start)) bestByLeave.set(o.leave, o);
    }
    // Pareto: daha fazla izin ancak daha uzun tatil sağlıyorsa listede kalsın
    const sorted = [...bestByLeave.values()].sort((a, b) => a.leave - b.leave);
    let bestLen = g.base.length;
    for (const o of sorted) {
      if (o.length > bestLen) {
        g.options.push(o);
        bestLen = o.length;
      }
    }
  }

  return [...groups.values()].sort((a, b) => a.firstHoliday.localeCompare(b.firstHoliday));
}

export interface Plan {
  items: Opportunity[];
  leave: number;
  totalDays: number;
}

/**
 * Verilen izin bütçesiyle, birbiriyle çakışmayan blokları seçerek
 * toplam kesintisiz tatil gününü en çoklayan planı bulur (ağırlıklı aralık seçimi + bütçe DP).
 */
export function optimizePlan(opps: Opportunity[], budget: number, year?: number): Plan {
  const units = Math.round(budget * 2);
  const items = opps
    .filter((o) => o.leave <= budget)
    .filter((o) => year === undefined || o.leaveDays.every((d) => d.startsWith(String(year))))
    .sort((a, b) => a.end.localeCompare(b.end) || a.start.localeCompare(b.start));
  const n = items.length;
  if (n === 0 || units <= 0) return { items: [], leave: 0, totalDays: 0 };

  // p[i]: i'den önce biten ve arada en az bir iş günü bırakan son aralık (1-indeksli, 0 = yok)
  const p = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    const limit = addDays(items[i].start, -2);
    let lo = 0;
    let hi = i - 1;
    let ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (items[mid].end <= limit) {
        ans = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    p[i] = ans + 1;
  }

  // dp[i][b] = ilk i aralıkla, en fazla b yarım-gün izinle elde edilen skor
  // skor: toplam tatil günü * 1000 - kullanılan yarım gün (eşitlikte daha az izin tercih edilir)
  const W = units + 1;
  const dp = new Float64Array((n + 1) * W);
  for (let i = 1; i <= n; i++) {
    const it = items[i - 1];
    const c = Math.round(it.leave * 2);
    const val = it.length * 1000 - c;
    const pi = p[i - 1];
    for (let b = 0; b <= units; b++) {
      let best = dp[(i - 1) * W + b];
      if (c <= b) {
        const take = dp[pi * W + (b - c)] + val;
        if (take > best) best = take;
      }
      dp[i * W + b] = best;
    }
  }

  const chosen: Opportunity[] = [];
  let i = n;
  let b = units;
  while (i > 0) {
    if (dp[i * W + b] === dp[(i - 1) * W + b]) {
      i--;
      continue;
    }
    const it = items[i - 1];
    chosen.push(it);
    b -= Math.round(it.leave * 2);
    i = p[i - 1];
  }
  chosen.reverse();
  return {
    items: chosen,
    leave: chosen.reduce((s, o) => s + o.leave, 0),
    totalDays: chosen.reduce((s, o) => s + o.length, 0),
  };
}

/** Seçili izin günleriyle oluşan kesintisiz tatil bloklarını hesaplar (izin içeren bloklar). */
export function stretchesFromLeave(days: Day[], leave: Set<string>, year: number) {
  const res: { start: string; end: string; length: number; leave: number }[] = [];
  let i = 0;
  while (i < days.length) {
    const off = (d: Day) => d.cost === 0 || leave.has(d.iso);
    if (!off(days[i])) {
      i++;
      continue;
    }
    let j = i;
    let used = 0;
    while (j < days.length && off(days[j])) {
      if (leave.has(days[j].iso)) used += days[j].cost;
      j++;
    }
    if (used > 0 && (days[i].iso.startsWith(String(year)) || days[j - 1].iso.startsWith(String(year))))
      res.push({ start: days[i].iso, end: days[j - 1].iso, length: j - i, leave: used });
    i = j;
  }
  return res;
}
