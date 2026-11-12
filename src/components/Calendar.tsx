import { memo } from 'react';
import type { Day } from '../lib/planner';
import { MONTHS, WEEKDAYS_SHORT, formatDay, weekdayMon0 } from '../lib/dates';

interface Props {
  year: number;
  days: Day[];
  leave: Set<string>;
  preview: Set<string>;
  today: string;
  onToggle: (iso: string) => void;
}

function Calendar({ year, days, leave, preview, today, onToggle }: Props) {
  const byIso = new Map(days.map((d) => [d.iso, d]));
  return (
    <div className="months">
      {MONTHS.map((m, mi) => {
        const first = `${year}-${String(mi + 1).padStart(2, '0')}-01`;
        const offset = weekdayMon0(first);
        const count = new Date(Date.UTC(year, mi + 1, 0)).getUTCDate();
        const cells: (Day | null)[] = Array(offset).fill(null);
        for (let d = 1; d <= count; d++) cells.push(byIso.get(`${year}-${String(mi + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`)!);
        return (
          <section className="month" key={m} aria-label={`${m} ${year}`}>
            <h3>{m}</h3>
            <div className="grid">
              {WEEKDAYS_SHORT.map((w) => (
                <div className="wd" key={w}>
                  {w}
                </div>
              ))}
              {cells.map((d, i) => {
                if (!d) return <div key={`e${i}`} />;
                const isLeave = leave.has(d.iso);
                const cls = ['day'];
                if (d.weekend) cls.push('weekend');
                if (d.holiday) cls.push(d.holiday.kind === 'full' ? 'holiday' : 'half');
                if (isLeave) cls.push('leave');
                if (preview.has(d.iso)) cls.push('preview');
                if (d.iso === today) cls.push('today');
                const clickable = d.cost > 0;
                if (clickable) cls.push('clickable');
                const label = [
                  formatDay(d.iso, true),
                  d.holiday ? `${d.holiday.name}${d.holiday.kind === 'half' ? ' (13:00’ten sonra tatil)' : ''}${d.holiday.estimated ? ' — tahmini' : ''}` : '',
                  isLeave ? 'İzinli' : clickable ? 'Tıkla: izin ekle' : '',
                ]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <button
                    key={d.iso}
                    type="button"
                    className={cls.join(' ')}
                    title={label}
                    aria-label={label}
                    aria-pressed={clickable ? isLeave : undefined}
                    disabled={!clickable}
                    onClick={() => onToggle(d.iso)}
                  >
                    {Number(d.iso.slice(8))}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export default memo(Calendar);
