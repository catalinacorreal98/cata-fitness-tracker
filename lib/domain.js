import { DateTime } from 'luxon';

export const ZONE = 'America/Toronto';
export const EARLIEST_DATE = '2026-09-01';
export const EARLIEST_INSTANT = '2026-09-01T04:00:00.000Z';
export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events.readonly';
export const TYPES = ['HIIT', 'Yoga', 'Cycling', 'Pilates', 'Strength', 'Run', 'Other'];
export const DEFAULT_RULES = [
  { type: 'HIIT', words: ['hiit', 'bootcamp', 'boot camp'] },
  { type: 'Pilates', words: ['pilates', 'reformer'] },
  { type: 'Yoga', words: ['yoga', 'vinyasa', 'yin', 'sound bath'] },
  { type: 'Cycling', words: ['beat ride', 'cycling', 'spin class'] },
  { type: 'Strength', words: ['strength', 'bodypump', 'weight training', 'barre'] },
  { type: 'Run', words: ['run', 'running', 'jog', '5k', '10k'] }
];
export function clock(now = new Date()) { return DateTime.fromJSDate(now, { zone: ZONE }); }
export function periods(now = new Date()) {
  const local = clock(now);
  return {
    today: local.toISODate(),
    week: local.startOf('week').toISODate(),
    weekEnd: local.startOf('week').plus({ weeks: 1 }).toISODate(),
    month: local.startOf('month').toISODate(),
    monthEnd: local.startOf('month').plus({ months: 1 }).toISODate(),
    horizon: local.startOf('month').plus({ months: 2 }).toUTC().toISO(),
    days: Array.from({ length: 7 }, (_, i) => local.startOf('week').plus({ days: i }).toISODate())
  };
}
export function validateRules(rules) {
  if (!Array.isArray(rules) || rules.length > 7) throw new Error('Invalid matching rules.');
  const seen = new Set();
  for (const r of rules) {
    if (!r || !TYPES.includes(r.type) || seen.has(r.type) || !Array.isArray(r.words) || r.words.length > 30 || r.words.some(w => typeof w !== 'string' || !w.trim() || w.length > 60)) throw new Error('Invalid matching rules.');
    seen.add(r.type);
  }
  return rules.map(r => ({ type: r.type, words: r.words.map(w => w.trim().toLowerCase()) }));
}
export function classify(title, rules = DEFAULT_RULES) {
  const normalized = String(title || '').normalize('NFKC').toLowerCase();
  for (const rule of rules) for (const word of rule.words) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, 'u').test(normalized)) return rule.type;
  }
  return null;
}
export function parseEvent(event, rules = DEFAULT_RULES) {
  if (event.status === 'cancelled') return null;
  const rawStart = event.start?.dateTime || event.start?.date;
  const rawEnd = event.end?.dateTime || event.end?.date;
  if (!rawStart || !rawEnd) return null;
  const start = DateTime.fromISO(rawStart, { zone: ZONE });
  const end = DateTime.fromISO(rawEnd, { zone: ZONE });
  if (!start.isValid || !end.isValid || end <= start || start.toMillis() < Date.parse(EARLIEST_INSTANT)) return null;
  const type = classify(event.summary, rules);
  if (!type || !event.id) return null;
  return { id: String(event.id), source: 'calendar', name: String(event.summary).slice(0,300), type,
    start: start.toUTC().toISO(), end: end.toUTC().toISO(), date: start.setZone(ZONE).toISODate(),
    location: String(event.location || '').slice(0,500), allDay: !event.start.dateTime };
}
export function validateManual(input) {
  if (!input || typeof input.name !== 'string' || !input.name.trim() || input.name.length > 100 || !TYPES.includes(input.type) || typeof input.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.date) || input.date < EARLIEST_DATE || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.endTime) || typeof input.location !== 'string' || input.location.length > 200) throw new Error('Enter a name, activity, date, and valid times. Dates must be September 2026 or later.');
  const start = DateTime.fromISO(`${input.date}T${input.startTime}`, { zone: ZONE });
  const end = DateTime.fromISO(`${input.date}T${input.endTime}`, { zone: ZONE });
  if (!start.isValid || !end.isValid || end <= start || start.toFormat('HH:mm') !== input.startTime || end.toFormat('HH:mm') !== input.endTime) throw new Error('End time must follow start time on the same day. Check daylight-saving time.');
  return { name: input.name.trim(), type: input.type, date: input.date, start: start.toUTC().toISO(), end: end.toUTC().toISO(), location: input.location.trim(), source:'manual', allDay:false };
}
export function stats(events, start, end, target, now = new Date()) {
  const relevant = events.filter(e => e.date >= EARLIEST_DATE && e.date >= start && e.date < end);
  const completed = relevant.filter(e => Date.parse(e.end) <= now.getTime()).length;
  return { completed, upcoming: relevant.length-completed, target,
    percentage: target ? Math.min(100,Math.round(completed/target*100)) : null,
    remaining: target ? Math.max(0,target-completed) : null };
}
export function validTarget(n) { return n === null || (Number.isInteger(n) && n >= 1 && n <= 999); }
