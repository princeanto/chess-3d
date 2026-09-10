/**
 * Everything happens in Indian Standard Time.
 *
 * The app is used from one timezone, but it may well be *opened* from another,
 * and a spend at 23:50 on the 30th must not appear in the following month
 * because the browser was set to UTC at the time. So dates are never taken from
 * the host's locale: instants are shifted by a fixed offset and read in UTC.
 *
 * IST has never observed daylight saving, which is what makes a constant offset
 * correct here rather than merely convenient.
 */

export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const pad = (n: number, width = 2): string => String(n).padStart(width, '0');

interface Parts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
}

export function istParts(ms: number): Parts {
  const d = new Date(ms + IST_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
  };
}

/** 'YYYY-MM-DD' for the Indian calendar day the instant falls in. */
export function istDayKey(ms: number): string {
  const p = istParts(ms);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** 'YYYY-MM'. */
export function istMonthKey(ms: number): string {
  const p = istParts(ms);
  return `${p.year}-${pad(p.month)}`;
}

/** Midnight IST at the start of the day this instant falls in, as an instant. */
export function istStartOfDay(ms: number): number {
  const p = istParts(ms);
  return Date.UTC(p.year, p.month - 1, p.day) - IST_OFFSET_MS;
}

export function istStartOfMonth(ms: number): number {
  const p = istParts(ms);
  return Date.UTC(p.year, p.month - 1, 1) - IST_OFFSET_MS;
}

/** An instant from Indian wall-clock components. */
export function fromIst(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
): number {
  return Date.UTC(year, month - 1, day, hour, minute) - IST_OFFSET_MS;
}

export function daysInMonth(monthKey: string): number {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days between two instants, by Indian calendar day rather than by hours. */
export function dayGap(a: number, b: number): number {
  return Math.round((istStartOfDay(b) - istStartOfDay(a)) / DAY_MS);
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function formatDay(ms: number): string {
  const p = istParts(ms);
  return `${p.day} ${MONTH_NAMES[p.month - 1]}`;
}

export function formatDayLong(ms: number): string {
  const p = istParts(ms);
  return `${p.day} ${MONTH_NAMES[p.month - 1]} ${p.year}`;
}

export function formatTime(ms: number): string {
  const p = istParts(ms);
  const h12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
  return `${h12}:${pad(p.minute)} ${p.hour < 12 ? 'am' : 'pm'}`;
}

export function formatMonth(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

/**
 * Dates as banks write them, which is every way at once.
 *
 * Indian statements are overwhelmingly day-first, so an ambiguous 03/04/2026 is
 * read as 3 April. The only times a month-first reading wins are when the first
 * number cannot be a day, or when the month is spelled out.
 */
export function parseIndianDate(text: string, fallback: number): number | null {
  const named =
    /\b(\d{1,2})[\s-]*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s,-]*(\d{2,4})?/i.exec(
      text,
    );
  if (named) {
    const day = Number(named[1]);
    const month = MONTH_NAMES.findIndex((n) => n.toLowerCase() === named[2].toLowerCase()) + 1;
    const year = named[3] ? normaliseYear(Number(named[3])) : istParts(fallback).year;
    if (day >= 1 && day <= 31) return fromIst(year, month, day);
  }

  const numeric = /\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})\b/.exec(text);
  if (numeric) {
    let day = Number(numeric[1]);
    let month = Number(numeric[2]);
    // Only swap when day-first is impossible.
    if (day > 12 && month > 12) return null;
    if (day <= 12 && month > 12) {
      const t = day;
      day = month;
      month = t;
    }
    const year = normaliseYear(Number(numeric[3]));
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) return fromIst(year, month, day);
  }
  return null;
}

function normaliseYear(y: number): number {
  if (y >= 1000) return y;
  return y < 70 ? 2000 + y : 1900 + y;
}
