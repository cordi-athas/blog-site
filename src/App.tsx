import { useEffect, useMemo, useState } from 'react';
import Calendar from './components/Calendar';
import { SUPPORTED_YEARS, holidaysForYear } from './data/holidays';
import { formatDay, formatRange, todayIso, weekdayMon0, WEEKDAYS } from './lib/dates';
import { buildIcs, download } from './lib/ics';
import {
  baseName,
  buildDays,
  findOpportunities,
  groupOpportunities,
  optimizePlan,
  stretchesFromLeave,
  type Opportunity,
} from './lib/planner';

const fmt = (n: number) => String(n).replace('.', ',');

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* depolama yoksa sessizce geç */
  }
}

function defaultYear(): number {
  const now = new Date();
  const y = now.getFullYear();
  const pick = now.getMonth() >= 9 && SUPPORTED_YEARS.includes(y + 1) ? y + 1 : y;
  return SUPPORTED_YEARS.includes(pick) ? pick : SUPPORTED_YEARS[SUPPORTED_YEARS.length - 1];
}

export default function App() {
  const [year, setYear] = useState<number>(() => load('izin:year', defaultYear()));
  const [budget, setBudget] = useState<number>(() => load('izin:budget', 14));
  const [saturdayWork, setSaturdayWork] = useState<boolean>(() => load('izin:saturday', false));
  const [leave, setLeave] = useState<Set<string>>(() => new Set(load<string[]>(`izin:leave:${year}`, [])));
  const [preview, setPreview] = useState<Set<string>>(new Set());
  const today = todayIso();

  useEffect(() => save('izin:year', year), [year]);
  useEffect(() => save('izin:budget', budget), [budget]);
  useEffect(() => save('izin:saturday', saturdayWork), [saturdayWork]);
  useEffect(() => save(`izin:leave:${year}`, [...leave]), [leave, year]);

  const changeYear = (y: number) => {
    setYear(y);
    setLeave(new Set(load<string[]>(`izin:leave:${y}`, [])));
    setPreview(new Set());
  };

  const settings = useMemo(() => ({ saturdayWork }), [saturdayWork]);
  const days = useMemo(() => buildDays(year, settings), [year, settings]);
  const dayCost = useMemo(() => new Map(days.map((d) => [d.iso, d.cost])), [days]);

  // Ayar değişince artık iş günü olmayan izinleri temizle
  useEffect(() => {
    setLeave((prev) => {
      const next = new Set([...prev].filter((d) => (dayCost.get(d) ?? 0) > 0));
      return next.size === prev.size ? prev : next;
    });
  }, [dayCost]);

  const groups = useMemo(() => {
    const opps = findOpportunities(days, year, { maxLeave: 9, maxLength: 16 });
    return groupOpportunities(days, year, opps);
  }, [days, year]);

  const plan = useMemo(() => {
    const opps = findOpportunities(days, year, { maxLeave: budget, maxLength: 30 });
    return optimizePlan(opps, budget, year);
  }, [days, year, budget]);

  const used = useMemo(
    () => [...leave].filter((d) => d.startsWith(String(year))).reduce((s, d) => s + (dayCost.get(d) ?? 0), 0),
    [leave, dayCost, year],
  );
  const stretches = useMemo(() => stretchesFromLeave(days, leave, year), [days, leave, year]);
  const totalOff = stretches.reduce((s, x) => s + x.length, 0);

  const holidays = useMemo(() => holidaysForYear(year), [year]);
  const fullDates = [...new Set(holidays.filter((h) => h.kind === 'full').map((h) => h.date))];
  const workdayHolidays = fullDates.filter((d) => weekdayMon0(d) < (saturdayWork ? 6 : 5)).length;
  const estimated = holidays.some((h) => h.estimated);

  const toggle = (iso: string) =>
    setLeave((prev) => {
      const next = new Set(prev);
      if (next.has(iso)) next.delete(iso);
      else next.add(iso);
      return next;
    });

  const addOpportunity = (o: Opportunity) =>
    setLeave((prev) => {
      const next = new Set(prev);
      const allIn = o.leaveDays.every((d) => next.has(d));
      for (const d of o.leaveDays) allIn ? next.delete(d) : next.add(d);
      return next;
    });

  const applyPlan = () => setLeave(new Set(plan.items.flatMap((o) => o.leaveDays)));

  const show = (o?: { leaveDays: string[] }) => setPreview(new Set(o?.leaveDays ?? []));

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <span className="logo" aria-hidden>
            📅
          </span>
          <div>
            <h1>İzin Takvimi</h1>
            <p>Türkiye resmi tatilleri · köprü günleri · akıllı izin planı</p>
          </div>
        </div>
        <nav className="years" aria-label="Yıl seçimi">
          {SUPPORTED_YEARS.map((y) => (
            <button key={y} className={y === year ? 'active' : ''} onClick={() => changeYear(y)}>
              {y}
            </button>
          ))}
        </nav>
      </header>

      <section className="stats">
        <div className="stat">
          <b>{fullDates.length}</b>
          <span>gün resmi tatil (tam gün)</span>
        </div>
        <div className="stat">
          <b>{workdayHolidays}</b>
          <span>tanesi iş gününe denk geliyor</span>
        </div>
        <div className="stat accent">
          <b>
            {fmt(plan.leave)} → {plan.totalDays}
          </b>
          <span>
            {budget} günlük izinle ulaşılabilecek tatil
          </span>
        </div>
        <div className="stat">
          <b>
            {fmt(used)}/{budget}
          </b>
          <span>seçtiğin izin · {totalOff} gün tatil</span>
        </div>
      </section>

      {estimated && (
        <p className="notice">
          ⚠️ {year} dini bayram tarihleri tahminidir; Diyanet takvimi yayımlandığında güncellenecektir.
        </p>
      )}

      <div className="layout">
        <main>
          <div className="legend">
            <span><i className="sw holiday" /> Resmi tatil</span>
            <span><i className="sw half" /> Arife (yarım gün)</span>
            <span><i className="sw weekend" /> Hafta sonu</span>
            <span><i className="sw leave" /> İzin günün</span>
            <span><i className="sw preview" /> Önizleme</span>
            <span className="hint">İş günlerine tıklayarak izin ekle / çıkar</span>
          </div>
          <Calendar year={year} days={days} leave={leave} preview={preview} today={today} onToggle={toggle} />

          <h2 className="section-title">Köprü fırsatları</h2>
          <p className="section-sub">
            Her tatil için “kaç gün izinle kaç gün kesintisiz tatil” seçenekleri. Üzerine gel, takvimde gör; tıkla, planına ekle.
          </p>
          <div className="cards">
            {groups.map((g) => {
              const best = g.options.reduce<Opportunity | undefined>((b, o) => (!b || o.ratio > b.ratio ? o : b), undefined);
              return (
                <article className="card" key={g.key}>
                  <header>
                    <h3>{g.name}</h3>
                    <span className="date">{formatDay(g.firstHoliday)} {WEEKDAYS[weekdayMon0(g.firstHoliday)]}</span>
                  </header>
                  <p className="base">
                    İzinsiz: <b>{g.base.length} gün</b> <span className="muted">({formatRange(g.base.start, g.base.end)})</span>
                  </p>
                  <ul className="options">
                    {g.options.slice(0, 5).map((o) => {
                      const active = o.leaveDays.every((d) => leave.has(d));
                      const outside = o.leaveDays.some((d) => !d.startsWith(String(year)));
                      return (
                        <li key={o.start + o.end}>
                          <button
                            className={`opt${active ? ' active' : ''}${o === best ? ' best' : ''}`}
                            onMouseEnter={() => show(o)}
                            onMouseLeave={() => show()}
                            onFocus={() => show(o)}
                            onBlur={() => show()}
                            onClick={() => addOpportunity(o)}
                          >
                            <span className="ratio">
                              <b>{fmt(o.leave)}</b> gün izin → <b>{o.length}</b> gün tatil
                            </span>
                            <span className="range">
                              {formatRange(o.start, o.end)}
                              {outside && <em> · izin {Number(year) - 1} yılından</em>}
                            </span>
                            {o === best && <span className="badge">En verimli</span>}
                          </button>
                        </li>
                      );
                    })}
                    {g.options.length === 0 && <li className="muted small">Zaten uzun bir blok; kısa izinle uzatılamıyor.</li>}
                  </ul>
                </article>
              );
            })}
          </div>

          <h2 className="section-title">{year} resmi tatilleri</h2>
          <table className="holidays">
            <tbody>
              {holidays.map((h) => (
                <tr key={h.date + h.name} className={weekdayMon0(h.date) >= (saturdayWork ? 6 : 5) ? 'on-weekend' : ''}>
                  <td>{formatDay(h.date)}</td>
                  <td>{WEEKDAYS[weekdayMon0(h.date)]}</td>
                  <td>
                    {h.name}
                    {h.kind === 'half' && <span className="tag">yarım gün</span>}
                    {h.estimated && <span className="tag">tahmini</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </main>

        <aside>
          <div className="panel">
            <h2>Ayarlar</h2>
            <label className="field">
              <span>Yıllık izin hakkın</span>
              <div className="stepper">
                <button onClick={() => setBudget((b) => Math.max(1, b - 1))} aria-label="Azalt">−</button>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={budget}
                  onChange={(e) => setBudget(Math.min(60, Math.max(1, Number(e.target.value) || 1)))}
                />
                <button onClick={() => setBudget((b) => Math.min(60, b + 1))} aria-label="Artır">+</button>
              </div>
            </label>
            <label className="switch">
              <input type="checkbox" checked={saturdayWork} onChange={(e) => setSaturdayWork(e.target.checked)} />
              <span>Cumartesi çalışıyorum</span>
            </label>
          </div>

          <div className="panel">
            <h2>Akıllı plan</h2>
            <p className="muted small">
              {budget} gün izinle resmi tatilleri birleştirerek en çok kesintisiz tatili veren plan.
            </p>
            <ol className="plan">
              {plan.items.map((o) => (
                <li key={o.start} onMouseEnter={() => show(o)} onMouseLeave={() => show()}>
                  <div>
                    <b>{formatRange(o.start, o.end)}</b>
                    <span className="muted small">{baseName(o.holidays.find((h) => h.kind === 'full') ?? o.holidays[0])}</span>
                  </div>
                  <span className="pill">
                    {fmt(o.leave)} → {o.length}
                  </span>
                </li>
              ))}
            </ol>
            <div className="plan-total">
              Toplam <b>{fmt(plan.leave)}</b> gün izinle <b>{plan.totalDays}</b> gün tatil
            </div>
            <button className="primary" onClick={applyPlan} disabled={plan.items.length === 0}>
              Planı takvime uygula
            </button>
          </div>

          <div className="panel">
            <h2>Planım</h2>
            {stretches.length === 0 ? (
              <p className="muted small">Henüz izin seçmedin. Takvimde bir iş gününe tıkla veya bir fırsat seç.</p>
            ) : (
              <ul className="mine">
                {stretches.map((s) => (
                  <li key={s.start}>
                    <span>{formatRange(s.start, s.end)}</span>
                    <span className="pill">
                      {fmt(s.leave)} → {s.length}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className={`meter${used > budget ? ' over' : ''}`}>
              <div style={{ width: `${Math.min(100, (used / budget) * 100)}%` }} />
            </div>
            <p className="small">
              {fmt(used)} / {budget} gün kullanıldı
              {used > budget ? ' — izin hakkını aşıyorsun!' : ` · ${fmt(budget - used)} gün kaldı`}
            </p>
            <div className="row">
              <button
                onClick={() => download(`izin-plani-${year}.ics`, buildIcs(stretches))}
                disabled={stretches.length === 0}
              >
                Takvime aktar (.ics)
              </button>
              <button className="ghost" onClick={() => setLeave(new Set())} disabled={leave.size === 0}>
                Temizle
              </button>
            </div>
          </div>
        </aside>
      </div>

      <footer>
        Arife günleri 13:00’ten sonra tatildir; izin hesabında yarım gün sayılır. Dini bayram tarihleri Diyanet İşleri Başkanlığı
        takvimine göredir. Seçimlerin yalnızca bu tarayıcıda saklanır.
      </footer>
    </div>
  );
}
