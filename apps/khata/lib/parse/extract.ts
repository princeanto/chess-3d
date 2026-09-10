/**
 * Pulling the facts out of one bank email.
 *
 * These emails are not structured data. They are marketing templates with a
 * sentence of truth in the middle, and every bank writes that sentence
 * differently. What they do share is a grammar: a verb that says which way the
 * money went, an amount, an account it moved on, and usually a counterparty.
 *
 * So nothing here matches whole templates. It finds the pieces of that grammar
 * independently and scores how well they agree, which is why a bank changing
 * its HTML on a Tuesday does not break the app.
 */

import type { Direction, Method } from '../ledger/types';
import { findAmounts, type Amount } from './money';

/* ------------------------------ plain text ------------------------------ */

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rupee: '₹',
  '#8377': '₹', '#x20b9': '₹', '#39': "'", '#160': ' ',
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, name: string) => {
    const key = name.toLowerCase();
    if (key in ENTITIES) return ENTITIES[key];
    if (key.startsWith('#x')) return String.fromCodePoint(parseInt(key.slice(2), 16));
    if (key.startsWith('#')) return String.fromCodePoint(Number(key.slice(1)));
    return whole;
  });
}

/**
 * HTML to something the matchers can read.
 *
 * Block tags become newlines so that a table cell does not run into the next
 * one — "Rs 500Available balance" would otherwise defeat the digit boundaries
 * the amount scanner relies on.
 */
export function flatten(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<\/?(br|p|div|tr|td|th|li|h[1-6]|table)[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t ]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .replace(/^\s+|\s+$/g, '');
}

/* ------------------------------- direction ------------------------------ */

interface Verb {
  re: RegExp;
  dir: Direction;
  weight: number;
}

/*
 * Ordered by how much each phrase is trusted. "Debited" is unambiguous;
 * "payment" appears in half of all mail and is worth very little on its own.
 */
const VERBS: Verb[] = [
  { re: /\bdebited\b/gi, dir: 'debit', weight: 5 },
  { re: /\bcredited\b/gi, dir: 'credit', weight: 5 },
  { re: /\bwithdrawn\b|\bwithdrawal\b/gi, dir: 'debit', weight: 4.5 },
  { re: /\bdeposited\b/gi, dir: 'credit', weight: 4.5 },
  { re: /\bspent\b/gi, dir: 'debit', weight: 4 },
  { re: /\brefunded\b|\brefund of\b/gi, dir: 'credit', weight: 4 },
  { re: /\breversed\b|\breversal of\b/gi, dir: 'credit', weight: 4 },
  { re: /\bcashback\b/gi, dir: 'credit', weight: 3.5 },
  { re: /\bsalary\b/gi, dir: 'credit', weight: 3.5 },
  { re: /\bpurchase of\b|\bhas been used for\b/gi, dir: 'debit', weight: 3.5 },
  { re: /\bpaid to\b|\bsent to\b|\btransferred to\b/gi, dir: 'debit', weight: 3.5 },
  { re: /\breceived from\b|\bcredit from\b/gi, dir: 'credit', weight: 3.5 },
  { re: /\bdeducted\b|\bcharged\b/gi, dir: 'debit', weight: 3 },
  { re: /\bpayment of\b|\bpayment made\b/gi, dir: 'debit', weight: 2 },
  { re: /\breceived\b/gi, dir: 'credit', weight: 2 },
  { re: /\bpaid\b/gi, dir: 'debit', weight: 1.5 },
];

/*
 * Amounts that are true but are not the transaction.
 *
 * Nearly every alert quotes your balance in the same sentence as the spend, and
 * a balance is a much larger number — pick it by accident once and the month is
 * wrong by lakhs.
 */
const DISTRACTORS = [
  /\bavailable balance\b|\bavl\.? ?bal\b|\ba\/c balance\b|\bclosing balance\b/gi,
  /\bcredit limit\b|\bavailable limit\b|\blimit of\b/gi,
  /\btotal outstanding\b|\boutstanding balance\b/gi,
  /\breward points?\b|\bpoints? worth\b/gi,
  /\bminimum amount due\b|\bmin\.? amt\.? due\b/gi,
];

interface Hit {
  index: number;
  dir?: Direction;
  weight: number;
}

function scan(text: string, patterns: Array<{ re: RegExp; dir?: Direction; weight: number }>): Hit[] {
  const hits: Hit[] = [];
  for (const { re, dir, weight } of patterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      hits.push({ index: m.index, dir, weight });
      if (m.index === re.lastIndex) re.lastIndex += 1;
    }
  }
  return hits;
}

/**
 * Card nouns, removed before direction is read.
 *
 * "Your credit card has been used for Rs 900" is a debit, but the word "credit"
 * sits four characters from the verb and outweighs it. Blanking the noun — and
 * keeping the length identical so every other index still lines up — is the
 * whole fix.
 */
function blankCardNouns(text: string): string {
  return text.replace(/\b(credit|debit) card\b/gi, (m) => ' '.repeat(m.length));
}

export interface Chosen {
  amountPaise: number;
  direction: Direction;
  /** How strongly the text supported this reading, before other signals. */
  strength: number;
  notes: string[];
}

/**
 * Which number is the transaction, and which way did it go.
 *
 * Every amount is scored against every direction verb and every distractor
 * phrase, weighted by how far apart they sit. Proximity is the signal: banks put
 * the verb and its amount in the same clause, and the balance in a different one.
 */
export function chooseAmount(subject: string, body: string): Chosen | null {
  const text = blankCardNouns(`${subject}\n${body}`);
  const amounts: Amount[] = findAmounts(text);
  if (amounts.length === 0) return null;

  const verbs = scan(text, VERBS);
  const distractors = scan(
    text,
    DISTRACTORS.map((re) => ({ re, weight: 6 })),
  );
  const subjectEnd = subject.length;

  let best: { amount: Amount; dir: Direction; score: number; via: string } | null = null;

  for (const amount of amounts) {
    let debit = 0;
    let credit = 0;
    let via = '';
    let viaScore = 0;

    for (const hit of verbs) {
      const distance = Math.abs(hit.index - amount.index);
      if (distance > 160) continue;
      // Falls off with distance rather than cutting off, so a verb in the same
      // clause beats one two sentences away without either being ignored.
      const contribution = hit.weight / (1 + distance / 40);
      if (hit.dir === 'debit') debit += contribution;
      else credit += contribution;
      if (contribution > viaScore) {
        viaScore = contribution;
        via = text.slice(hit.index, hit.index + 24).trim();
      }
    }

    let penalty = 0;
    for (const hit of distractors) {
      const distance = Math.abs(hit.index - amount.index);
      if (distance > 90) continue;
      penalty += hit.weight / (1 + distance / 25);
    }

    const support = Math.max(debit, credit);
    // The subject line is where banks put the number that matters.
    const bonus = amount.index < subjectEnd ? 1.2 : 0;
    const score = support - penalty + bonus;
    if (support === 0) continue;
    if (!best || score > best.score) {
      best = { amount, dir: debit >= credit ? 'debit' : 'credit', score, via };
    }
  }

  if (!best || best.score <= 0) return null;
  return {
    amountPaise: best.amount.value,
    direction: best.dir,
    strength: best.score,
    notes: [`amount ₹${best.amount.raw} read as ${best.dir}${best.via ? ` from “${best.via}”` : ''}`],
  };
}

/* -------------------------------- account ------------------------------- */

/**
 * The last four digits, which is all any of these mails will tell you.
 *
 * Written as XX1234, xxxx1234, **1234, "ending 1234", "ending in 1234" and a
 * dozen other ways. The masking characters are optional because some banks send
 * "A/c no. 1234" and mean the last four.
 */
const TAIL_PATTERNS = [
  /\b(?:a\/c|ac|acct|account|card)\s*(?:no\.?|number|num)?\s*(?:ending(?:\s+(?:in|with))?)?\s*[xX*•·]{2,}\s*(\d{4})\b/i,
  /\b(?:a\/c|ac|acct|account|card)\s*(?:no\.?|number|num)?\s*(?:ending(?:\s+(?:in|with))?)\s*(\d{4})\b/i,
  /\b[xX*]{4,}\s*(\d{4})\b/i,
  /\b(?:a\/c|ac|acct|account|card)\s*(?:no\.?|number|num)\s*[:.]?\s*(\d{4})\b(?!\d)/i,
];

export function extractTail(text: string): string | null {
  for (const re of TAIL_PATTERNS) {
    const m = re.exec(text);
    if (m) return m[1];
  }
  return null;
}

/* ------------------------------- reference ------------------------------ */

/**
 * The bank's own identifier for the movement.
 *
 * This is the single most valuable field in the email, because it is what makes
 * deduplication safe. Two mails carrying the same reference are certainly the
 * same payment; two carrying different ones are certainly not, however alike
 * they otherwise look. Without it, telling one double-swipe from two honest
 * emails about one charge is guesswork.
 */
const REFERENCE_PATTERNS = [
  /\b(?:rrn|utr)\s*(?:no\.?|number)?\s*[:#-]?\s*([A-Za-z0-9]{6,22})\b/i,
  /\b(?:upi)?\s*(?:txn|transaction)\s*(?:id|no\.?|number|ref(?:erence)?)\s*[:#-]?\s*([A-Za-z0-9]{6,22})\b/i,
  /\bref(?:erence)?\s*(?:no\.?|number|id)?\s*[:#-]\s*([A-Za-z0-9]{6,22})\b/i,
  /\bauth(?:orisation|orization)?\s*(?:code|no\.?)?\s*[:#-]?\s*([A-Za-z0-9]{6,22})\b/i,
];

export function extractReference(text: string): string | null {
  for (const re of REFERENCE_PATTERNS) {
    const m = re.exec(text);
    /*
     * A reference always contains a digit. Without that check the label runs
     * into the value — "transaction reference number is 4053…" captures the
     * word "number", and two unrelated payments then share a reference, which
     * is the one mistake deduplication cannot survive.
     */
    if (m && /\d/.test(m[1])) return m[1].toUpperCase();
  }
  // A bare 12-digit run is a UPI RRN often enough to be worth taking, but only
  // when the mail is about UPI at all.
  if (/\bUPI\b/i.test(text)) {
    const m = /(?<!\d)(\d{12})(?!\d)/.exec(text);
    if (m) return m[1];
  }
  return null;
}

/* -------------------------------- method -------------------------------- */

export function detectMethod(text: string): Method {
  if (/\bATM\b|cash withdrawal|cash w\/?d\b/i.test(text)) return 'atm';
  if (/\bUPI\b|\bVPA\b|[a-z0-9._-]{3,}@(?:okhdfcbank|oksbi|okicici|okaxis|ybl|paytm|apl|ibl|axl)\b/i.test(text))
    return 'upi';
  if (/\bNACH\b|\bACH\b|e-?mandate|auto ?debit|auto ?pay|standing instruction\b|\bSI\b/i.test(text))
    return 'ach';
  if (/\bNEFT\b|\bIMPS\b|\bRTGS\b|net ?banking|fund transfer/i.test(text)) return 'netbanking';
  if (/\bcard\b|\bPOS\b|swipe|contactless|auth(?:orisation|orization)/i.test(text)) return 'card';
  return 'unknown';
}

/* ------------------------------- merchant ------------------------------- */

/**
 * Corporate furniture, not part of the name.
 *
 * Kept to legal forms and filler. Words like "store" and "retail" look like
 * noise but are often the trading name people recognise — stripping them turns
 * "Croma Store" into "Croma" and "Metro Cash And Carry" into something worse.
 */
const NOISE_SUFFIX =
  /\b(pvt|private|ltd|limited|llp|inc|incorporated|india|technologies|solutions|enterprises)\b/gi;

const MERCHANT_PATTERNS: RegExp[] = [
  // HDFC and friends put a whole UPI string after "Info:".
  /\bInfo\s*[:-]\s*([^\n]{3,70})/i,
  /\btowards\s+([^\n.,]{3,45})/i,
  /\bat\s+([A-Za-z0-9][A-Za-z0-9 &.'@_*-]{2,45}?)\s+on\b/i,
  /\b(?:paid|sent|transferred)\s+to\s+([A-Za-z0-9][A-Za-z0-9 &.'@_-]{2,45}?)(?=\s+on\b|[.,\n]|$)/i,
  /\bto\s+VPA\s+([A-Za-z0-9._-]+@[A-Za-z]{2,})/i,
  /\bfrom\s+([A-Za-z0-9][A-Za-z0-9 &.'@_-]{2,45}?)(?=\s+on\b|[.,\n]|$)/i,
  /\bmerchant\s*[:-]\s*([^\n.,]{3,45})/i,
];

/**
 * Tidy a raw merchant string into something you would recognise on a statement.
 *
 * UPI strings are the awkward case: `UPI-SWIGGY LIMITED-SWIGGY@YBL-HDFC-5271…`
 * carries the name, the handle, the bank and the reference in one field. The
 * name is the second segment, and everything after it is machinery.
 */
export function cleanMerchant(raw: string): string | null {
  let value = raw.trim();

  if (/^UPI[/-]/i.test(value)) {
    const segments = value.split(/[/-]/).filter(Boolean);
    // segments[0] is 'UPI'; the name is next, unless it is a bare handle.
    value = segments[1] ?? value;
  }

  // A VPA is a fine identifier but the handle is not part of the name.
  const vpa = /^([A-Za-z0-9._-]+)@[A-Za-z]{2,}$/.exec(value);
  if (vpa) value = vpa[1].replace(/[._-]+/g, ' ');

  value = value
    .replace(/\b(?:ref|rrn|utr|txn|id)\s*[:#-]?\s*[A-Za-z0-9]{6,}\b/gi, ' ')
    .replace(/(?<![\d.])\d{6,}(?![\d.])/g, ' ')
    .replace(/[*_]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s.,:;-]+|[\s.,:;-]+$/g, '');

  if (value.length < 2) return null;
  if (/^\d+$/.test(value)) return null;

  const stripped = value.replace(NOISE_SUFFIX, '').replace(/\s{2,}/g, ' ').trim();
  if (stripped.length >= 3) value = stripped;

  // Card networks shout and VPAs whisper; both read better in title case.
  if (value === value.toUpperCase() || value === value.toLowerCase()) {
    value = value
      .toLowerCase()
      .replace(/\b[a-z]/g, (c) => c.toUpperCase());
  }
  return value.slice(0, 40);
}

export function extractMerchant(text: string): string | null {
  for (const re of MERCHANT_PATTERNS) {
    const m = re.exec(text);
    if (!m) continue;
    const cleaned = cleanMerchant(m[1]);
    if (cleaned) return cleaned;
  }
  return null;
}

/**
 * A key for grouping the same merchant written different ways.
 *
 * "SWIGGY", "Swiggy Ltd", "swiggy@ybl" and "Swiggy  India" all have to land in
 * one bucket or the recurring-charge detector never sees a series.
 */
export function merchantKey(merchant: string | null): string {
  if (!merchant) return '';
  return merchant
    .toLowerCase()
    .replace(NOISE_SUFFIX, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 24);
}
