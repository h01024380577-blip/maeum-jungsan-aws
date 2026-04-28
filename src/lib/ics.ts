/**
 * RFC 5545 (iCalendar) 직렬화 — 마음정산 경조사 → all-day VEVENT.
 *
 * 의존성 없음. VCALENDAR/VEVENT, all-day events, TEXT escape, 75-octet folding.
 */

export type EventTypeLike = 'WEDDING' | 'FUNERAL' | 'BIRTHDAY' | 'OTHER';

export interface EventLike {
  id: string;
  eventType: EventTypeLike;
  targetName: string;
  date: Date;
  location?: string | null;
  relation?: string | null;
  memo?: string | null;
  sourceUrl?: string | null;
}

export const EVENT_TYPE_KO: Record<EventTypeLike, string> = {
  WEDDING: '결혼식',
  FUNERAL: '장례식',
  BIRTHDAY: '생일',
  OTHER: '기타',
};

export function escapeIcsText(input: string): string {
  return input
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

export function foldIcsLine(line: string): string {
  const buf = Buffer.from(line, 'utf-8');
  if (buf.length <= 75) return line;

  const parts: string[] = [];
  let start = 0;
  let limit = 75;
  while (start < buf.length) {
    let end = Math.min(start + limit, buf.length);
    while (end < buf.length && (buf[end] & 0xc0) === 0x80) {
      end -= 1;
    }
    parts.push(buf.subarray(start, end).toString('utf-8'));
    start = end;
    limit = 74;
  }
  return parts.join('\r\n ');
}

function formatDate(d: Date): string {
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const day = String(kst.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function formatDateTimeUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const h = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  const s = String(d.getUTCSeconds()).padStart(2, '0');
  return `${y}${m}${day}T${h}${min}${s}Z`;
}

function nextDay(d: Date): Date {
  const next = new Date(d.getTime());
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

export function eventToVevent(event: EventLike, now: Date): string {
  const label = EVENT_TYPE_KO[event.eventType];
  const lines: string[] = ['BEGIN:VEVENT'];

  lines.push(foldIcsLine(`UID:${event.id}@maeum-jungsan`));
  lines.push(`DTSTAMP:${formatDateTimeUtc(now)}`);
  lines.push(`DTSTART;VALUE=DATE:${formatDate(event.date)}`);
  lines.push(`DTEND;VALUE=DATE:${formatDate(nextDay(event.date))}`);
  lines.push(foldIcsLine(`SUMMARY:${escapeIcsText(`${label} - ${event.targetName}`)}`));

  const loc = event.location?.trim();
  if (loc) lines.push(foldIcsLine(`LOCATION:${escapeIcsText(loc)}`));

  const descParts: string[] = [];
  const rel = event.relation?.trim();
  if (rel) descParts.push(`관계: ${rel}`);
  const memo = event.memo?.trim();
  if (memo) descParts.push(`메모: ${memo}`);
  if (event.sourceUrl) descParts.push(`초대장: ${event.sourceUrl}`);
  if (descParts.length > 0) {
    const desc = descParts.map(escapeIcsText).join('\\n');
    lines.push(foldIcsLine(`DESCRIPTION:${desc}`));
  }

  lines.push(foldIcsLine(`CATEGORIES:경조사,${label}`));
  lines.push('END:VEVENT');

  return lines.join('\r\n');
}

export function renderIcs(events: EventLike[], now: Date = new Date()): string {
  const header = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//maeum-jungsan//KO',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];
  const body = events.map((e) => eventToVevent(e, now));
  const footer = ['END:VCALENDAR'];
  return [...header, ...body, ...footer].join('\r\n') + '\r\n';
}
