/**
 * Calendar maths on calendar dates.
 *
 * Dates are handled as year-month-day with no time of day, so a daylight-saving
 * change can never make "days until" come out a day short. Month arithmetic
 * clamps to the end of the month: 31 January plus one month is 28 or 29
 * February, not 3 March.
 */

export interface Ymd { y: number; m: number; d: number }

export const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

export const isLeap = (y: number): boolean => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
export const daysInMonth = (y: number, m: number): number => [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];

export const dayNumber = ({ y, m, d }: Ymd): number => Date.UTC(y, m - 1, d) / 86_400_000;
export const fromDayNumber = (n: number): Ymd => {
  const date = new Date(n * 86_400_000);
  return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate() };
};

export const toIso = ({ y, m, d }: Ymd): string => `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
export function fromIso(text: string): Ymd | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
  if (!match) return null;
  const date = { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
  return valid(date) ? date : null;
}
export const valid = ({ y, m, d }: Ymd): boolean => m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m) && y > 0 && y < 10000;

export const todayYmd = (now = new Date()): Ymd => ({ y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() });

export function addMonths(date: Ymd, months: number): Ymd {
  const total = date.y * 12 + (date.m - 1) + months;
  const y = Math.floor(total / 12);
  const m = total - y * 12 + 1;
  return { y, m, d: Math.min(date.d, daysInMonth(y, m)) };
}

export function addToDate(date: Ymd, amount: number, unit: 'days' | 'weeks' | 'months' | 'years'): Ymd {
  if (unit === 'days') return fromDayNumber(dayNumber(date) + amount);
  if (unit === 'weeks') return fromDayNumber(dayNumber(date) + amount * 7);
  return addMonths(date, unit === 'years' ? amount * 12 : amount);
}

/** Whole years, months and days from a to b (a ≤ b), counted the way a calendar does. */
export function calendarDiff(a: Ymd, b: Ymd): { years: number; months: number; days: number } {
  let months = (b.y - a.y) * 12 + (b.m - a.m);
  if (b.d < a.d) months -= 1;
  const anchor = addMonths(a, months);
  const days = dayNumber(b) - dayNumber(anchor);
  return { years: Math.floor(months / 12), months: months % 12, days };
}

export interface DateDiff {
  days: number;
  weeks: number;
  weekDays: number;
  months: number;
  years: number;
  calendar: { years: number; months: number; days: number };
  /** True when b is before a. */
  past: boolean;
}

export function dateDiff(a: Ymd, b: Ymd): DateDiff {
  const past = dayNumber(b) < dayNumber(a);
  const [from, to] = past ? [b, a] : [a, b];
  const days = dayNumber(to) - dayNumber(from);
  const calendar = calendarDiff(from, to);
  return {
    days,
    weeks: Math.floor(days / 7),
    weekDays: days % 7,
    months: calendar.years * 12 + calendar.months,
    years: calendar.years,
    calendar,
    past,
  };
}

export interface AgeResult { years: number; months: number; days: number; totalDays: number; nextBirthday: Ymd; daysUntilBirthday: number; turning: number }

/** A 29 February birthday falls on 28 February in years without one. */
function birthdayIn(born: Ymd, year: number): Ymd {
  return { y: year, m: born.m, d: Math.min(born.d, daysInMonth(year, born.m)) };
}

export function age(born: Ymd, today: Ymd): AgeResult | null {
  if (dayNumber(born) > dayNumber(today)) return null;
  const { years, months, days } = calendarDiff(born, today);
  let next = birthdayIn(born, today.y);
  if (dayNumber(next) < dayNumber(today)) next = birthdayIn(born, today.y + 1);
  return {
    years, months, days,
    totalDays: dayNumber(today) - dayNumber(born),
    nextBirthday: next,
    daysUntilBirthday: dayNumber(next) - dayNumber(today),
    turning: next.y - born.y,
  };
}

export function formatDate(date: Ymd, style: 'long' | 'short' = 'long'): string {
  const js = new Date(Date.UTC(date.y, date.m - 1, date.d));
  return new Intl.DateTimeFormat('en-GB', style === 'long'
    ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }
    : { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(js);
}

/**
 * A date from how people write one: "25 December", "Dec 25 2026", "2026-12-25",
 * "25/12/2026" (day first), "tomorrow", "Christmas". A day and month with no
 * year means the next time it comes round.
 */
export function parseDate(text: string, today: Ymd): Ymd | null {
  const t = text.trim().toLowerCase().replace(/(\d)(st|nd|rd|th)\b/g, '$1').replace(/[,.]/g, ' ').replace(/\s+/g, ' ');
  if (!t) return null;
  if (t === 'today') return today;
  if (t === 'tomorrow') return addToDate(today, 1, 'days');
  if (t === 'yesterday') return addToDate(today, -1, 'days');
  const upcoming = (m: number, d: number): Ymd => {
    const thisYear = { y: today.y, m, d: Math.min(d, daysInMonth(today.y, m)) };
    return dayNumber(thisYear) < dayNumber(today) ? { y: today.y + 1, m, d: Math.min(d, daysInMonth(today.y + 1, m)) } : thisYear;
  };
  if (/\b(christmas|xmas)\b/.test(t)) return upcoming(12, 25);
  if (/\bnew year'?s?( day)?\b/.test(t)) return upcoming(1, 1);
  if (/\b(valentine'?s?( day)?)\b/.test(t)) return upcoming(2, 14);
  if (/\bhalloween\b/.test(t)) return upcoming(10, 31);

  let match = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/.exec(t);
  if (match) { const date = { y: +match[1], m: +match[2], d: +match[3] }; return valid(date) ? date : null; }
  match = /\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/.exec(t);
  if (match) {
    const y = match[3].length === 2 ? 2000 + +match[3] : +match[3];
    const date = { y, m: +match[2], d: +match[1] };
    return valid(date) ? date : null;
  }
  const monthIndex = (word: string) => MONTHS.findIndex((name) => word.length >= 3 && name.startsWith(word)) + 1;
  match = /\b(\d{1,2}) ([a-z]{3,9})(?: (\d{4}))?\b/.exec(t);
  if (match && monthIndex(match[2])) {
    const m = monthIndex(match[2]);
    if (match[3]) { const date = { y: +match[3], m, d: +match[1] }; return valid(date) ? date : null; }
    return +match[1] <= daysInMonth(isLeap(today.y) ? today.y : 2024, m) ? upcoming(m, +match[1]) : null;
  }
  match = /\b([a-z]{3,9}) (\d{1,2})(?: (\d{4}))?\b/.exec(t);
  if (match && monthIndex(match[1])) {
    const m = monthIndex(match[1]);
    if (match[3]) { const date = { y: +match[3], m, d: +match[2] }; return valid(date) ? date : null; }
    return +match[2] <= daysInMonth(2024, m) ? upcoming(m, +match[2]) : null;
  }
  return null;
}

/* --------------------------------- times -------------------------------- */

/** "9", "9:30", "9.30pm", "21:15", "noon" → minutes after midnight. */
export function parseTime(text: string): number | null {
  const t = text.trim().toLowerCase().replace(/\s+/g, '');
  if (t === 'noon' || t === 'midday') return 12 * 60;
  if (t === 'midnight') return 0;
  const match = /^(\d{1,2})(?:[:.](\d{2}))?(am|pm|a|p)?$/.exec(t);
  if (!match) return null;
  let h = Number(match[1]);
  const min = Number(match[2] ?? 0);
  const suffix = match[3];
  if (min > 59) return null;
  if (suffix) {
    if (h < 1 || h > 12) return null;
    if (suffix.startsWith('a')) h = h === 12 ? 0 : h;
    else h = h === 12 ? 12 : h + 12;
  } else if (h > 23) return null;
  return h * 60 + min;
}

/** From one clock time to the next; past midnight when the end is earlier. */
export function timeDiff(start: number, end: number): { minutes: number; overnight: boolean } {
  const overnight = end < start;
  return { minutes: overnight ? end + 1440 - start : end - start, overnight };
}

export function formatClock(ms: number, withHundredths = false): string {
  const total = Math.max(0, ms);
  const h = Math.floor(total / 3_600_000);
  const m = Math.floor((total % 3_600_000) / 60_000);
  const s = Math.floor((total % 60_000) / 1000);
  const cs = Math.floor((total % 1000) / 10);
  const base = `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 2, '0')}:${String(s).padStart(2, '0')}`;
  return withHundredths ? `${base}.${String(cs).padStart(2, '0')}` : base;
}

export function minutesToText(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}
