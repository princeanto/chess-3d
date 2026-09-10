/**
 * Mail in, books out.
 *
 * One pass, in a fixed order, because each stage depends on the last being
 * finished: nothing can be categorised before it is deduplicated, no series can
 * be found before things are categorised, and no leak can be reported before
 * the series are known. Keeping it a single pure function is what lets the
 * whole pipeline be tested from a folder of fixtures with no browser involved.
 */

import type { Leak, Message, Obligation, Recurring, Txn } from './types';
import { parseMessage, type Parsed } from '../parse/parse';
import { reconcile } from './dedupe';
import { applyCategories, type Overrides } from '../insight/categories';
import { findRecurring } from '../insight/recurring';
import { failedMandates, settle, skippedCharges, type SkippedCharge } from '../insight/obligations';
import { findLeaks, recoverable } from '../insight/leaks';

export interface Books {
  txns: Txn[];
  obligations: Obligation[];
  recurring: Recurring[];
  leaks: Leak[];
  skipped: SkippedCharge[];
  failedMandates: Obligation[];
  recoverablePaise: number;
  /** Transactions cleared against a bill, so the ledger can say so. */
  clearedTxnIds: Set<string>;
  /** Mail that was fetched but understood as nothing. Shown as a count only. */
  ignored: number;
}

export interface BuildOptions {
  overrides?: Overrides;
  /** Corrections the user has made, keyed by transaction id. */
  edits?: Record<string, Txn['edited']>;
  now?: number;
}

export function build(messages: Message[], options: BuildOptions = {}): Books {
  const { overrides = {}, edits = {}, now = Date.now() } = options;

  const parsed: Parsed[] = [];
  for (const message of messages) {
    try {
      parsed.push(parseMessage(message));
    } catch {
      // One malformed email must never cost the other nine hundred.
      parsed.push({});
    }
  }

  const records = parsed.flatMap((p) => (p.record ? [p.record] : []));
  const drafts = parsed.flatMap((p) => (p.obligation ? [p.obligation] : []));
  const promises = parsed.flatMap((p) => (p.promise ? [p.promise] : []));
  const ignored = parsed.filter((p) => !p.record && !p.obligation && !p.promise).length;

  let txns = reconcile(records);

  // User corrections are applied before anything reads the numbers, so a fixed
  // amount flows into the totals, the series and the leaks alike.
  txns = txns.map((txn) => {
    const edit = edits[txn.id];
    return edit ? { ...txn, ...edit, edited: edit } : txn;
  });

  txns = applyCategories(txns, overrides).sort((a, b) => b.at - a.at);

  const { obligations, clearedTxnIds } = settle(drafts, txns, now);
  const recurring = findRecurring(txns, now);
  const leaks = findLeaks(txns, recurring, promises, now);

  return {
    txns,
    obligations,
    recurring,
    leaks,
    skipped: skippedCharges(recurring, now),
    failedMandates: failedMandates(obligations, now),
    recoverablePaise: recoverable(leaks),
    clearedTxnIds,
    ignored,
  };
}

/**
 * The Gmail query.
 *
 * Built here rather than in the bridge so that improving it ships with the app
 * — the script is meant to be pasted once and never touched again. Broad on
 * purpose: it is far cheaper to fetch a marketing email and discard it than to
 * miss a month of one account because a bank changed its subject line.
 */
export function gmailQuery(sinceDays: number): string {
  const phrases = [
    'debited', 'credited', 'debit', 'credit',
    '"transaction alert"', '"txn alert"',
    '"has been spent"', '"you have spent"',
    '"payment due"', '"amount due"', '"due date"',
    '"e-mandate"', '"auto debit"', '"autopay"', '"standing instruction"',
    '"refund"', '"reversed"', '"reversal"',
    '"payment failed"', '"transaction declined"',
    '"statement"', '"UPI"',
  ];
  return [
    `newer_than:${sinceDays}d`,
    `(${phrases.join(' OR ')})`,
    // Promotions and social are where the offers live; the alerts are not there.
    '-category:promotions',
    '-category:social',
    '-in:spam',
    '-in:trash',
  ].join(' ');
}
