// Small date helpers for the booking calendar. Everything works in local time
// and on 'YYYY-MM-DD' strings (the shape the bookings table stores), so a day
// never slips across a timezone the way toISOString() would.

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO() {
  return toISO(new Date());
}

export function addDays(iso, n) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function addMonths(iso, n) {
  const d = parseISO(iso);
  d.setMonth(d.getMonth() + n);
  return toISO(d);
}

// Monday-based week (matches the live console's calendar).
export function startOfWeek(iso) {
  const d = parseISO(iso);
  const dow = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  d.setDate(d.getDate() - dow);
  return toISO(d);
}

export function weekDays(iso) {
  const start = startOfWeek(iso);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

// A 6-row month grid (always 42 cells) starting on the Monday on/before the 1st.
export function monthMatrix(iso) {
  const d = parseISO(iso);
  const first = toISO(new Date(d.getFullYear(), d.getMonth(), 1));
  const gridStart = startOfWeek(first);
  return Array.from({ length: 6 }, (_, w) =>
    Array.from({ length: 7 }, (_, day) => addDays(gridStart, w * 7 + day))
  );
}

export function isSameMonth(iso, refIso) {
  return iso.slice(0, 7) === refIso.slice(0, 7);
}

// ---- formatting ----------------------------------------------------------

export function formatTime12(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function minutesOf(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function dayNumber(iso) {
  return parseISO(iso).getDate();
}

export function dowShort(iso) {
  return DOW[parseISO(iso).getDay()];
}

// "Fri, 25 Jul 2026"
export function formatFullDay(iso) {
  const d = parseISO(iso);
  return `${DOW[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
}

// "25 Jul 2026" — no weekday. Handy for date ranges.
export function formatShortDate(iso) {
  if (!iso) return '—';
  const d = parseISO(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
}

// Whole days from today to `iso` (negative = past). null for empty input.
export function daysUntil(iso) {
  if (!iso) return null;
  const ms = parseISO(iso).getTime() - parseISO(todayISO()).getTime();
  return Math.round(ms / 86400000);
}

// "21 – 27 Jul 2026" for a week range.
export function formatWeekRange(iso) {
  const days = weekDays(iso);
  const a = parseISO(days[0]);
  const b = parseISO(days[6]);
  const sameMonth = a.getMonth() === b.getMonth();
  const left = sameMonth ? `${a.getDate()}` : `${a.getDate()} ${MONTHS[a.getMonth()].slice(0, 3)}`;
  const right = `${b.getDate()} ${MONTHS[b.getMonth()].slice(0, 3)} ${b.getFullYear()}`;
  return `${left} – ${right}`;
}

// "July 2026"
export function formatMonth(iso) {
  const d = parseISO(iso);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
