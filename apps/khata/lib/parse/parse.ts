/**
 * One email in, one understanding out.
 *
 * A message can be several things at once — a card statement is both a bill
 * with a due date and a summary of spending — so this returns parts rather than
 * a single verdict, and the caller keeps whichever it needs.
 *
 * Nothing here throws. Mail is arbitrary text from third parties; a parser that
 * can be crashed by an odd template is a parser that loses a month of history.
 */

import type {
  Account,
  Message,
  MessageKind,
  Obligation,
  Record_,
  Source,
} from '../ledger/types';
import { hashId } from '../ledger/id';
import { parseIndianDate } from '../ledger/time';
import { findAmounts } from './money';
import {
  chooseAmount,
  detectMethod,
  extractMerchant,
  extractReference,
  extractTail,
  flatten,
} from './extract';
import { identifySender, looksPromotional } from './senders';

/**
 * Bumped whenever a change to the parser would read the same email differently.
 *
 * Caches store readings rather than bodies, so they cannot be re-parsed in
 * place; a reading from an older parser is thrown away and the mail read again.
 */
export const PARSER_VERSION = 1;

export interface Parsed {
  /** A movement of money that has already happened. */
  record?: Record_;
  /** Something owed, with a date, that has not been matched to a payment yet. */
  obligation?: Omit<Obligation, 'status' | 'clearedByTxnId'>;
  /** A refund or reversal the sender said would arrive. Chased later. */
  promise?: {
    id: string;
    kind: 'refund' | 'reversal';
    amountPaise: number | null;
    promisedAt: number;
    /** Banks say "5-7 working days"; this is the outside edge of that. */
    expectBy: number;
    merchant: string | null;
    source: Source;
  };
}

const DAY = 24 * 60 * 60 * 1000;

/* ------------------------------ what is it ------------------------------ */

const KIND_MARKERS: Array<[RegExp, MessageKind]> = [
  [/\b(?:payment|transaction)\s+(?:has\s+)?(?:failed|declined|was unsuccessful)|could not be processed|\bdeclined\b/i, 'failure'],
  [/e-?mandate|standing instruction|\bNACH\b|auto\s?pay (?:is |will )|will be (?:auto[- ]?)?debited on/i, 'mandate'],
  [/total amount due|minimum amount due|payment due date|statement (?:is|has been) generated|your bill (?:is|for)/i, 'bill'],
  /*
   * Both of these are strictly future tense, and that is the whole distinction.
   *
   * "Your refund will be credited in 5-7 days" is a promise; "your refund has
   * been credited" is money that actually arrived. Reading the first as income
   * is doubly wrong — it invents a credit that never landed, and then hides the
   * fact that it never landed, because the chaser finds its own phantom and
   * concludes the refund came through.
   */
  [/\b(?:will|shall) be (?:reversed|credited back)\b|\breversal (?:will be|has been|is being) (?:initiated|processed)\b|\bcredited back within\b/i, 'reversal-promise'],
  [/\b(?:will|shall) be (?:credited|refunded|returned)\b|\brefund (?:has been |is being |will be )?(?:initiated|processed|issued)\b/i, 'refund-promise'],
];

function detectKind(text: string, fallback: MessageKind): MessageKind {
  for (const [re, kind] of KIND_MARKERS) if (re.test(text)) return kind;
  return fallback;
}

/* --------------------------- nearby extraction -------------------------- */

/** The amount closest to a phrase, which is how labelled figures are laid out. */
function amountNear(text: string, phrase: RegExp, window = 120): number | null {
  const m = phrase.exec(text);
  if (!m) return null;
  const anchor = m.index + m[0].length;
  let best: { value: number; distance: number } | null = null;
  for (const a of findAmounts(text)) {
    const distance = a.index >= anchor ? a.index - anchor : anchor - a.index + 40;
    if (distance > window) continue;
    if (!best || distance < best.distance) best = { value: a.value, distance };
  }
  return best ? best.value : null;
}

function dateNear(text: string, phrase: RegExp, fallback: number, window = 90): number | null {
  const m = phrase.exec(text);
  if (!m) return null;
  const from = m.index + m[0].length;
  return parseIndianDate(text.slice(from, from + window), fallback);
}

/* --------------------------------- main --------------------------------- */

export function parseMessage(message: Message): Parsed {
  const body = flatten(message.body);
  const subject = decodeSubject(message.subject);
  const text = `${subject}\n${body}`;
  const sender = identifySender(message.from);

  const kind = detectKind(text, sender?.kind ?? 'unknown');
  const source: Source = {
    messageId: message.id,
    from: message.from,
    subject,
    date: message.date,
    kind,
  };

  const out: Parsed = {};

  /*
   * Advertising is dropped outright rather than scored down.
   *
   * "Get ₹500 cashback" parses as cleanly as a real credit, and a year of
   * promotional mail can invent tens of thousands of rupees that never moved.
   * A false negative loses one row; a false positive corrupts every total that
   * row is in.
   */
  const promotional = looksPromotional(message.from, subject, body);

  if (kind === 'bill' || kind === 'mandate') {
    const obligation = readObligation(text, message, source, sender, kind);
    if (obligation) out.obligation = obligation;
  }

  if (kind === 'refund-promise' || kind === 'reversal-promise') {
    const amount = chooseAmount(subject, body);
    const days = /(\d{1,2})\s*[-–to]{1,3}\s*(\d{1,2})\s*(?:working|business)?\s*days/i.exec(text);
    const outside = days ? Number(days[2]) : 10;
    out.promise = {
      id: hashId('promise', message.id),
      kind: kind === 'refund-promise' ? 'refund' : 'reversal',
      amountPaise: amount?.amountPaise ?? null,
      promisedAt: message.date,
      // Working days, so allow for weekends rather than counting calendar days.
      expectBy: message.date + Math.ceil(outside * 1.5) * DAY,
      merchant: extractMerchant(text) ?? sender?.issuer ?? null,
      source,
    };
  }

  /*
   * Only mail about money that has already moved becomes a transaction.
   *
   * A bill is a demand, a mandate is an intention, a failure is a non-event and
   * a promise is a future tense. All four contain a perfectly parseable amount,
   * which is exactly why each has to be excluded by name.
   */
  const reportsMovement =
    !promotional &&
    kind !== 'bill' &&
    kind !== 'mandate' &&
    kind !== 'failure' &&
    kind !== 'refund-promise' &&
    kind !== 'reversal-promise';

  if (reportsMovement) {
    const chosen = chooseAmount(subject, body);
    if (chosen) {
      const tail = extractTail(text);
      const reference = extractReference(text);
      const merchant = extractMerchant(text);
      const notes = [...chosen.notes];

      let confidence = 0.25 + Math.min(chosen.strength, 8) * 0.05;
      if (sender) {
        confidence += sender.type === 'wallet' ? 0.06 : 0.14;
        notes.push(`sender recognised as ${sender.issuer}`);
      } else {
        notes.push('sender not in the registry');
      }
      if (tail) {
        confidence += 0.1;
        notes.push(`account ending ${tail}`);
      }
      if (reference) {
        confidence += 0.1;
        notes.push(`reference ${reference}`);
      }
      if (merchant) confidence += 0.05;
      // A bank alert with no account and no reference is usually a summary or a
      // notification about someone else's payment.
      if (!tail && !reference) confidence -= 0.12;

      const account: Account | null = sender
        ? { issuer: sender.issuer, tail, type: sender.type }
        : tail
          ? { issuer: 'Unknown', tail, type: 'bank' }
          : null;

      out.record = {
        source,
        at: message.date,
        amountPaise: chosen.amountPaise,
        direction: chosen.direction,
        account,
        merchant: merchant ?? (sender?.kind === 'merchant-receipt' ? sender.issuer : null),
        method: detectMethod(text),
        reference,
        confidence: Math.max(0, Math.min(1, confidence)),
        notes,
      };
    }
  }

  return out;
}

function readObligation(
  text: string,
  message: Message,
  source: Source,
  sender: ReturnType<typeof identifySender>,
  kind: 'bill' | 'mandate',
): Parsed['obligation'] | null {
  const amountPaise =
    amountNear(text, /total amount due|total due|amount payable/i) ??
    amountNear(text, /will be (?:auto[- ]?)?debited|mandate (?:amount|for)|instruction (?:amount|of)/i) ??
    null;

  const dueAt =
    dateNear(text, /payment due date|due date|due on|pay by/i, message.date) ??
    dateNear(text, /will be (?:auto[- ]?)?debited on|debit date|on or (?:before|after)/i, message.date);

  if (dueAt === null) return null;

  const tail = extractTail(text);
  const label =
    extractMerchant(text) ??
    sender?.issuer ??
    (kind === 'bill' ? 'Bill' : 'Auto-debit');

  return {
    id: hashId('obligation', message.id),
    kind: /\bEMI\b|instal?ment/i.test(text) ? 'emi' : kind,
    label,
    amountPaise,
    dueAt,
    account: sender ? { issuer: sender.issuer, tail, type: sender.type } : null,
    source,
  };
}

/** RFC 2047 encoded-words turn up in subjects often enough to be worth undoing. */
function decodeSubject(subject: string): string {
  return subject.replace(
    /=\?[^?]+\?([QqBb])\?([^?]*)\?=/g,
    (whole, encoding: string, payload: string) => {
      try {
        if (encoding.toLowerCase() === 'b') {
          const binary =
            typeof atob === 'function'
              ? atob(payload)
              : Buffer.from(payload, 'base64').toString('binary');
          return decodeURIComponent(
            binary
              .split('')
              .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
              .join(''),
          );
        }
        return decodeURIComponent(
          payload.replace(/_/g, ' ').replace(/=([0-9A-Fa-f]{2})/g, '%$1'),
        );
      } catch {
        return whole;
      }
    },
  );
}
