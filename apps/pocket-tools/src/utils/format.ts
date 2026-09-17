/**
 * Reading numbers the way people type them, and writing them the way people
 * read them.
 *
 * People type "₹4,500", "2.5k", "1.2 lakh" and "1,00,000". A calculator that
 * only accepts 4500 is a calculator that fails the first time someone pastes a
 * price. Output follows the currency's own conventions, so rupees group in
 * lakhs (1,00,000) and dollars in thousands (100,000).
 */

export type Currency = 'INR' | 'USD' | 'EUR' | 'GBP';

export const CURRENCIES: { id: Currency; symbol: string; locale: string }[] = [
  { id: 'INR', symbol: '₹', locale: 'en-IN' },
  { id: 'USD', symbol: '$', locale: 'en-US' },
  { id: 'EUR', symbol: '€', locale: 'en-IE' },
  { id: 'GBP', symbol: '£', locale: 'en-GB' },
];

export const currencyInfo = (id: Currency) => CURRENCIES.find((c) => c.id === id) ?? CURRENCIES[0];

const MULTIPLIERS: [RegExp, number][] = [
  [/^(?:k|thousand)$/i, 1e3],
  [/^(?:l|lac|lacs|lakh|lakhs)$/i, 1e5],
  [/^(?:cr|crore|crores)$/i, 1e7],
  [/^(?:m|mn|million)$/i, 1e6],
  [/^(?:b|bn|billion)$/i, 1e9],
];

/**
 * A number from what someone typed, or null. Currency symbols, grouping commas
 * and spaces are ignored; k, lakh, crore, million and billion multiply.
 */
export function parseAmount(input: string | number | null | undefined): number | null {
  if (typeof input === 'number') return Number.isFinite(input) ? input : null;
  if (!input) return null;
  const text = input.trim().replace(/[₹$€£]|rs\.?|inr|usd|eur|gbp/gi, '').replace(/,/g, '').replace(/\s+/g, ' ').trim();
  const match = /^(-?\d*\.?\d+)\s*([a-z]+)?$/i.exec(text);
  if (!match) return null;
  let value = Number(match[1]);
  if (match[2]) {
    const multiplier = MULTIPLIERS.find(([pattern]) => pattern.test(match[2]!));
    if (!multiplier) return null;
    value *= multiplier[1];
  }
  return Number.isFinite(value) ? value : null;
}

/** Rounds away binary noise: 0.1 + 0.2 is 0.3 here. */
export const round = (n: number, digits = 2): number => {
  const k = 10 ** digits;
  return Math.round((n + Number.EPSILON * Math.sign(n)) * k) / k;
};

/** ₹2,500 · ₹450.50 — decimals only when there are any. */
export function money(n: number, currency: Currency = 'INR'): string {
  const { id, locale } = currencyInfo(currency);
  const value = round(n, 2);
  const whole = Number.isInteger(value);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: id,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function number(n: number, digits = 2, locale = 'en-IN'): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(round(n, digits));
}

/** Six significant figures, no scientific notation for everyday sizes, no trailing zeros. */
export function significant(n: number, figures = 6): string {
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs >= 1e15 || abs < 1e-6) return n.toExponential(figures - 1).replace(/\.?0+e/, 'e');
  const digits = Math.max(0, figures - Math.floor(Math.log10(abs)) - 1);
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: Math.min(digits, 10) }).format(Number(n.toPrecision(figures)));
}

export type ByteMode = 'decimal' | 'binary';

/** 824 KB, 3.8 MB — decimal like file managers on phones and Macs, binary on request. */
export function bytes(n: number, mode: ByteMode = 'decimal'): string {
  const base = mode === 'binary' ? 1024 : 1000;
  const units = mode === 'binary' ? ['B', 'KiB', 'MiB', 'GiB', 'TiB'] : ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = n;
  while (Math.abs(v) >= base && i < units.length - 1) { v /= base; i += 1; }
  const digits = i === 0 ? 0 : v >= 100 ? 0 : v >= 10 ? 1 : 2;
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(v)} ${units[i]}`;
}

/** "1mb", "500 KB", "< 2 MB" → bytes (decimal, as the presets are written). */
export function parseSize(input: string): number | null {
  const match = /(\d*\.?\d+)\s*(b|kb|mb|gb|kib|mib|gib)\b/i.exec(input.replace(/,/g, ''));
  if (!match) return null;
  const unit = match[2].toLowerCase();
  const factor: Record<string, number> = { b: 1, kb: 1e3, mb: 1e6, gb: 1e9, kib: 1024, mib: 1024 ** 2, gib: 1024 ** 3 };
  return Number(match[1]) * factor[unit];
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${number(n, 2, 'en-US')} ${Math.abs(n) === 1 ? one : many}`;
}

/** A tidy file name: lower case, hyphens, no surprises. */
export function fileSlug(text: string, fallback = 'file'): string {
  return text.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || fallback;
}

export const today = (): string => new Date().toISOString().slice(0, 10);
