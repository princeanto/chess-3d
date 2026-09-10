/**
 * Reading rupee amounts out of prose.
 *
 * Money is held everywhere in this app as an integer number of paise. A ledger
 * that adds up floating-point rupees drifts — 0.1 + 0.2 is not 0.3 in binary —
 * and the drift lands in a total someone is going to act on.
 *
 * The hard part is not the arithmetic, it's not matching things that merely
 * look like money. A bank alert is full of long digit runs: reference numbers,
 * card numbers, phone numbers, dates. Every amount here has to be introduced or
 * followed by a currency marker, and its comma grouping has to be one a human
 * would actually write.
 */

/** Rupees to paise, rounded rather than truncated. */
export const paise = (rupees: number): number => Math.round(rupees * 100);

/** For display. Indian grouping: the last three digits, then twos. */
export function formatPaise(value: number, opts: { sign?: boolean; round?: boolean } = {}): string {
  const negative = value < 0;
  const abs = Math.abs(value);
  const rupees = Math.floor(abs / 100);
  const rest = abs % 100;

  const digits = String(rupees);
  let grouped: string;
  if (digits.length <= 3) {
    grouped = digits;
  } else {
    const tail = digits.slice(-3);
    const head = digits.slice(0, -3);
    // Twos from the right, which is what makes 1,23,456 rather than 123,456.
    grouped = head.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + tail;
  }

  const body = opts.round && rest === 0 ? grouped : `${grouped}.${String(rest).padStart(2, '0')}`;
  const mark = opts.sign ? (negative ? '−' : '+') : negative ? '−' : '';
  return `${mark}₹${body}`;
}

/**
 * Is this comma grouping one a person would write?
 *
 * Indian statements use both conventions and often mix them inside one email —
 * the bank's template in lakhs, the merchant's line in thousands — so both are
 * accepted, but a grouping that is neither is a reference number with commas in
 * it, or a parse that has gone wrong.
 */
export function groupingIsPlausible(digits: string): boolean {
  // Grouping is a property of the whole-rupee part; paise are never grouped.
  const [whole, ...fraction] = digits.split('.');
  if (fraction.length > 1) return false;
  if (fraction.length === 1 && !/^\d{1,2}$/.test(fraction[0])) return false;

  if (!whole.includes(',')) return /^\d+$/.test(whole);
  const parts = whole.split(',');
  if (parts.some((p) => !/^\d+$/.test(p))) return false;
  if (parts[0].length < 1 || parts[0].length > 3) return false;
  if (parts[parts.length - 1].length !== 3) return false;
  const middle = parts.slice(1, -1);
  if (middle.length === 0) return true;
  return middle.every((p) => p.length === 2) || middle.every((p) => p.length === 3);
}

export interface Amount {
  /** Integer paise. */
  value: number;
  /** Where it sat in the source text, so direction words can be read around it. */
  index: number;
  length: number;
  raw: string;
}

/*
 * Either a marker then a number, or a number then a marker. `/-` counts as a
 * trailing marker because Indian statements use it constantly ("2,499/-").
 *
 * The lookarounds are what keep the last four digits of a card out of the
 * results: a number touching another digit on either side is part of something
 * longer and is not an amount.
 */
const NUMBER = String.raw`\d[\d,]*(?:\.\d{1,2})?`;
const LEAD = String.raw`(?:₹|\bINR\b|\bRs\.?|\bRUPEES\b)\s*`;
const TRAIL = String.raw`\s*(?:₹|\bINR\b|\bRs\b|/-)`;
const SCANNER = new RegExp(
  `(?<!\\d)(?:${LEAD}(${NUMBER})|(${NUMBER})${TRAIL})(?!\\d)`,
  'gi',
);

/** Every amount in a piece of text, in the order it appears. */
export function findAmounts(text: string): Amount[] {
  const found: Amount[] = [];
  SCANNER.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SCANNER.exec(text)) !== null) {
    const raw = m[1] ?? m[2];
    if (!raw) continue;
    if (!groupingIsPlausible(raw)) continue;
    const value = Number(raw.replace(/,/g, ''));
    if (!Number.isFinite(value)) continue;
    /*
     * Zero is a real alert ("Rs 0.00 balance") but never a transaction, and
     * anything past a crore in a retail alert is a parse that has run two
     * numbers together.
     */
    if (value <= 0 || value > 1e9) continue;
    found.push({ value: paise(value), index: m.index, length: m[0].length, raw });
  }
  return found;
}

/** The first amount in a string, or null. Convenient for subject lines. */
export function firstAmount(text: string): number | null {
  const all = findAmounts(text);
  return all.length > 0 ? all[0].value : null;
}
