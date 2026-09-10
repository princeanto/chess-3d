/**
 * The shapes the whole app agrees on.
 *
 * A `Message` is what the bridge hands back — raw mail, parsed by nobody. A
 * `Record` is one email understood. A `Txn` is one movement of money, which may
 * have been reported by three different emails and is the only thing the rest of
 * the app is allowed to count.
 */

/** What the Apps Script bridge returns. Deliberately close to Gmail's own shape. */
export interface Message {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  /** Epoch milliseconds, as Gmail reports it. */
  date: number;
  /** Body, already flattened to text by the bridge. */
  body: string;
}

export type Direction = 'debit' | 'credit';

export type Method = 'upi' | 'card' | 'netbanking' | 'ach' | 'atm' | 'cash' | 'unknown';

/**
 * What a piece of mail was doing.
 *
 * The distinction matters for deduplication: a bank alert and a UPI receipt
 * describing the same payment must collapse into one transaction, whereas two
 * bank alerts from the same bank are two payments.
 */
export type MessageKind =
  | 'bank-alert'
  | 'upi-receipt'
  | 'merchant-receipt'
  | 'statement'
  | 'mandate'
  | 'bill'
  | 'refund-promise'
  | 'reversal-promise'
  | 'failure'
  | 'unknown';

export interface Account {
  /** 'HDFC', 'ICICI', … — the registry's short name. */
  issuer: string;
  /** Last four digits, the only part of an account number any of these mails carry. */
  tail: string | null;
  type: 'bank' | 'card' | 'wallet';
}

export interface Source {
  messageId: string;
  from: string;
  subject: string;
  date: number;
  kind: MessageKind;
}

export interface Txn {
  id: string;
  /** Epoch ms. Normalised so that the calendar day is the Indian one. */
  at: number;
  amountPaise: number;
  direction: Direction;
  account: Account | null;
  merchant: string | null;
  method: Method;
  category: string;
  /**
   * The bank's own reference for the movement — a UPI RRN, a card auth code, a
   * cheque number. Where two emails carry the same one they are certainly the
   * same event, and where they carry different ones they are certainly not.
   * Everything hard about deduplication is downstream of this being absent.
   */
  reference: string | null;
  /** 0–1. Below `REVIEW_BELOW` it goes to the review queue rather than the totals. */
  confidence: number;
  sources: Source[];
  /** Set when the user corrects a parse; never overwritten by a later scan. */
  edited?: Partial<Pick<Txn, 'amountPaise' | 'direction' | 'merchant' | 'category'>>;
}

/** A parse of one email, before anything has been merged. */
export interface Record_ {
  source: Source;
  at: number;
  amountPaise: number;
  direction: Direction;
  account: Account | null;
  merchant: string | null;
  method: Method;
  reference: string | null;
  confidence: number;
  /** Why the parser thinks what it thinks — shown in review, and in tests. */
  notes: string[];
}

export const REVIEW_BELOW = 0.55;

/** Something you have agreed to pay that has not been matched to a payment yet. */
export interface Obligation {
  id: string;
  kind: 'bill' | 'mandate' | 'emi';
  label: string;
  /** Null where the notice says "as per usage" rather than a figure. */
  amountPaise: number | null;
  dueAt: number;
  account: Account | null;
  source: Source;
  status: 'pending' | 'cleared' | 'missed';
  clearedByTxnId?: string;
}

export interface Recurring {
  key: string;
  merchant: string;
  /** The median of the run, so one price rise does not redefine the series. */
  amountPaise: number;
  cadence: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  /** Every occurrence found, oldest first. */
  occurrences: number[];
  txnIds: string[];
  nextExpectedAt: number;
  /** Dates the cadence predicted where nothing was charged. */
  missing: number[];
  /** False once it has been silent for more than two intervals. */
  active: boolean;
}

export type LeakKind =
  | 'duplicate'
  | 'unreversed'
  | 'unrefunded'
  | 'fee'
  | 'zombie'
  | 'fx-markup';

export interface Leak {
  id: string;
  kind: LeakKind;
  amountPaise: number;
  at: number;
  title: string;
  detail: string;
  txnIds: string[];
}

/**
 * How complete a month looks.
 *
 * The app can only see accounts that email you. Rather than quietly report a
 * total that is missing a card, every month carries a note of which accounts
 * were heard from and whether the run of days has holes in it.
 */
export interface Coverage {
  /** 'YYYY-MM' in Indian local time. */
  month: string;
  accounts: string[];
  txnCount: number;
  /** Days in the month with no transaction at all, which is normal but worth showing. */
  silentDays: number;
  /** 0–1, a blunt heuristic, always shown with its reasoning rather than alone. */
  score: number;
}
