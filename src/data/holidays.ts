export type HolidayKind = 'full' | 'half';

export interface Holiday {
  date: string; // YYYY-MM-DD
  name: string;
  kind: HolidayKind;
  /** Tarihi henüz Diyanet tarafından kesinleşmemiş (tahmini) */
  estimated?: boolean;
}

const FIXED: { md: string; name: string; kind: HolidayKind }[] = [
  { md: '01-01', name: 'Yılbaşı', kind: 'full' },
  { md: '04-23', name: 'Ulusal Egemenlik ve Çocuk Bayramı', kind: 'full' },
  { md: '05-01', name: 'Emek ve Dayanışma Günü', kind: 'full' },
  { md: '05-19', name: "Atatürk'ü Anma, Gençlik ve Spor Bayramı", kind: 'full' },
  { md: '07-15', name: 'Demokrasi ve Milli Birlik Günü', kind: 'full' },
  { md: '08-30', name: 'Zafer Bayramı', kind: 'full' },
  { md: '10-28', name: 'Cumhuriyet Bayramı Arifesi', kind: 'half' },
  { md: '10-29', name: 'Cumhuriyet Bayramı', kind: 'full' },
];

interface Religious {
  ramazan: string; // 1. gün
  kurban: string; // 1. gün
  estimated?: boolean;
}

/** Diyanet dini günler takvimine göre bayramların ilk günleri. */
const RELIGIOUS: Record<number, Religious> = {
  2025: { ramazan: '2025-03-30', kurban: '2025-06-06' },
  2026: { ramazan: '2026-03-20', kurban: '2026-05-27' },
  2027: { ramazan: '2027-03-09', kurban: '2027-05-16' },
  2028: { ramazan: '2028-02-26', kurban: '2028-05-05', estimated: true },
};

export const SUPPORTED_YEARS = Object.keys(RELIGIOUS).map(Number);

function addDaysIso(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function holidaysForYear(year: number): Holiday[] {
  const list: Holiday[] = FIXED.map((f) => ({ date: `${year}-${f.md}`, name: f.name, kind: f.kind }));
  const r = RELIGIOUS[year];
  if (r) {
    const est = r.estimated ? { estimated: true } : {};
    list.push({ date: addDaysIso(r.ramazan, -1), name: 'Ramazan Bayramı Arifesi', kind: 'half', ...est });
    for (let i = 0; i < 3; i++)
      list.push({ date: addDaysIso(r.ramazan, i), name: `Ramazan Bayramı ${i + 1}. Gün`, kind: 'full', ...est });
    list.push({ date: addDaysIso(r.kurban, -1), name: 'Kurban Bayramı Arifesi', kind: 'half', ...est });
    for (let i = 0; i < 4; i++)
      list.push({ date: addDaysIso(r.kurban, i), name: `Kurban Bayramı ${i + 1}. Gün`, kind: 'full', ...est });
  }
  return list.sort((a, b) => a.date.localeCompare(b.date));
}

/** Aynı tarihe iki kayıt düşerse tam gün tatil önceliklidir. */
export function holidayMap(years: number[]): Map<string, Holiday> {
  const m = new Map<string, Holiday>();
  for (const y of years) {
    for (const h of holidaysForYear(y)) {
      const prev = m.get(h.date);
      if (!prev || (prev.kind === 'half' && h.kind === 'full')) m.set(h.date, h);
      else if (prev.kind === h.kind) m.set(h.date, { ...prev, name: `${prev.name} + ${h.name}` });
    }
  }
  return m;
}
