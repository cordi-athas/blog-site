import { addDays } from './dates';

export function buildIcs(stretches: { start: string; end: string; length: number; leave: number }[]): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//izin-takvimi//TR', 'CALSCALE:GREGORIAN'];
  for (const s of stretches) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${s.start}-${s.end}@izin-takvimi`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${s.start.replace(/-/g, '')}`,
      `DTEND;VALUE=DATE:${addDays(s.end, 1).replace(/-/g, '')}`,
      `SUMMARY:Tatil (${s.length} gün\\, ${String(s.leave).replace('.', ',')} gün izin)`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function download(filename: string, content: string, type = 'text/calendar') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
