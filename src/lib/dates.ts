export function isoToDate(iso: string): Date {
  return new Date(iso + 'T00:00:00Z');
}
export function dateToIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
export function addDays(iso: string, n: number): string {
  const d = isoToDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return dateToIso(d);
}
/** 0 = Pazartesi ... 6 = Pazar */
export function weekdayMon0(iso: string): number {
  return (isoToDate(iso).getUTCDay() + 6) % 7;
}
export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
export const WEEKDAYS_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
export const WEEKDAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

export function formatDay(iso: string, withWeekday = false): string {
  const d = isoToDate(iso);
  const base = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  return withWeekday ? `${base} ${WEEKDAYS[weekdayMon0(iso)]}` : base;
}

export function formatRange(start: string, end: string): string {
  const a = isoToDate(start);
  const b = isoToDate(end);
  if (start === end) return formatDay(start);
  if (a.getUTCMonth() === b.getUTCMonth() && a.getUTCFullYear() === b.getUTCFullYear())
    return `${a.getUTCDate()}–${b.getUTCDate()} ${MONTHS[b.getUTCMonth()]}`;
  const yearSuffix = a.getUTCFullYear() !== b.getUTCFullYear() ? ` ${a.getUTCFullYear()}` : '';
  return `${formatDay(start)}${yearSuffix} – ${formatDay(end)}${yearSuffix ? ' ' + b.getUTCFullYear() : ''}`;
}
