/**
 * Money that left and shouldn't have.
 *
 * "Did I lose money" deserves a list of specific rupees with dates against them,
 * not a feeling. Every finding here names an amount, the transactions it came
 * from, and what to do about it — and each detector is written to stay quiet
 * unless it is fairly sure, because a screen of false alarms gets ignored and
 * then the true one is ignored with it.
 */

import type { Leak, Recurring, Txn } from '../ledger/types';
import type { Parsed } from '../parse/parse';
import { DAY_MS, dayGap, formatDay, formatTime, istDayKey } from '../ledger/time';
import { formatPaise } from '../parse/money';
import { merchantKey } from '../parse/extract';
import { hashId } from '../ledger/id';

type Promise_ = NonNullable<Parsed['promise']>;

/**
 * The same charge twice.
 *
 * Deduplication has already merged the several *emails* about one payment, so
 * anything still standing as two transactions is two charges. That makes this
 * detector cheap and, more importantly, trustworthy: it fires on the machine's
 * own reckoning of distinct events rather than on a guess about mail.
 */
function duplicates(txns: Txn[]): Leak[] {
  const debits = txns
    .filter((t) => t.direction === 'debit')
    .sort((a, b) => a.at - b.at);
  const out: Leak[] = [];

  for (let i = 0; i < debits.length; i += 1) {
    for (let j = i + 1; j < debits.length; j += 1) {
      const a = debits[i];
      const b = debits[j];
      if (b.at - a.at > 2 * DAY_MS) break;
      if (a.amountPaise !== b.amountPaise) continue;

      const keyA = merchantKey(a.merchant);
      const keyB = merchantKey(b.merchant);
      if (!keyA || keyA !== keyB) continue;

      /*
       * Some things are honestly bought twice in two days — a coffee, a metro
       * top-up. The signal for an accident is a *large* identical amount at the
       * same merchant, so small ones are left alone.
       */
      if (a.amountPaise < 20000) continue;

      // Two charges on one day need the clock to tell them apart; "on 4 Feb and
      // again on 4 Feb" reads like a bug in the app rather than one at the till.
      const sameDay = istDayKey(a.at) === istDayKey(b.at);
      const when = sameDay
        ? `${formatDay(a.at)} at ${formatTime(a.at)} and again at ${formatTime(b.at)}`
        : `${formatDay(a.at)} and again on ${formatDay(b.at)}`;

      out.push({
        id: hashId('dup', a.id, b.id),
        kind: 'duplicate',
        amountPaise: b.amountPaise,
        at: b.at,
        title: `${a.merchant} charged twice`,
        detail: `${formatPaise(a.amountPaise, { round: true })} on ${when}. If you only meant to pay once, this is refundable.`,
        txnIds: [a.id, b.id],
      });
    }
  }
  return out;
}

/**
 * Refunds and reversals that were promised and never arrived.
 *
 * This is the one people lose the most to, because the promise arrives when you
 * are annoyed and the silence afterwards is easy to miss.
 */
function brokenPromises(promises: Promise_[], txns: Txn[], now: number): Leak[] {
  const credits = txns.filter((t) => t.direction === 'credit');
  const out: Leak[] = [];

  for (const promise of promises) {
    if (now < promise.expectBy) continue;

    const key = merchantKey(promise.merchant);
    const arrived = credits.some((txn) => {
      if (txn.at < promise.promisedAt) return false;
      // Refunds regularly land a fortnight past the promised date; only give up
      // on finding one well after that.
      if (txn.at > promise.expectBy + 30 * DAY_MS) return false;
      if (promise.amountPaise !== null) {
        return Math.abs(txn.amountPaise - promise.amountPaise) <= 200;
      }
      const txnKey = merchantKey(txn.merchant);
      return Boolean(key && txnKey && (txnKey.includes(key) || key.includes(txnKey)));
    });
    if (arrived) continue;

    out.push({
      id: hashId('promise', promise.id),
      kind: promise.kind === 'refund' ? 'unrefunded' : 'unreversed',
      amountPaise: promise.amountPaise ?? 0,
      at: promise.promisedAt,
      title:
        promise.kind === 'refund'
          ? `Refund from ${promise.merchant ?? 'a merchant'} never arrived`
          : `Reversal from ${promise.merchant ?? 'your bank'} never arrived`,
      detail: `Promised on ${formatDay(promise.promisedAt)}, expected by ${formatDay(promise.expectBy)}. Nothing matching has been credited since. Worth chasing — quote the original mail.`,
      txnIds: [],
    });
  }
  return out;
}

/** Every fee, named. Individually small, and that is the point of totalling them. */
function fees(txns: Txn[]): Leak[] {
  return txns
    .filter((t) => t.direction === 'debit' && t.category === 'Fees')
    .map((txn) => ({
      id: hashId('fee', txn.id),
      kind: 'fee' as const,
      amountPaise: txn.amountPaise,
      at: txn.at,
      title: `${txn.merchant ?? txn.account?.issuer ?? 'Bank'} charged a fee`,
      detail: `${formatPaise(txn.amountPaise, { round: true })} on ${formatDay(txn.at)}. Most of these are waivable if you ask once.`,
      txnIds: [txn.id],
    }));
}

/**
 * Subscriptions that have quietly run for a year.
 *
 * There is no way to know from mail whether you still use something, so this
 * does not claim it is waste — it states the annual cost, which is the number
 * that makes the decision obvious and is never the number on the statement.
 */
function zombies(recurring: Recurring[], now: number): Leak[] {
  const perYear: Record<Recurring['cadence'], number> = {
    weekly: 52,
    monthly: 12,
    quarterly: 4,
    yearly: 1,
  };

  return recurring
    .filter((series) => series.active && series.occurrences.length >= 6)
    .map((series) => {
      const annual = series.amountPaise * perYear[series.cadence];
      const months = Math.max(1, Math.round(dayGap(series.occurrences[0], now) / 30));
      return {
        id: hashId('zombie', series.key),
        kind: 'zombie' as const,
        amountPaise: annual,
        at: series.occurrences[series.occurrences.length - 1],
        title: `${series.merchant} — ${formatPaise(annual, { round: true })} a year`,
        detail: `${formatPaise(series.amountPaise, { round: true })} ${series.cadence}, ${series.occurrences.length} times over ${months} months. Still using it?`,
        txnIds: series.txnIds,
      };
    })
    .sort((a, b) => b.amountPaise - a.amountPaise);
}

/** The quiet 3.5% on every foreign charge. */
function fxMarkup(txns: Txn[]): Leak[] {
  return txns
    .filter(
      (t) =>
        t.direction === 'debit' &&
        t.sources.some((s) => /markup|foreign (?:currency|transaction)|cross ?currency|\bFX\b/i.test(s.subject)),
    )
    .map((txn) => ({
      id: hashId('fx', txn.id),
      kind: 'fx-markup' as const,
      amountPaise: txn.amountPaise,
      at: txn.at,
      title: `Foreign currency markup on ${txn.merchant ?? 'a charge'}`,
      detail: `${formatPaise(txn.amountPaise, { round: true })} on ${formatDay(txn.at)}. A zero-markup card would have avoided this.`,
      txnIds: [txn.id],
    }));
}

export function findLeaks(
  txns: Txn[],
  recurring: Recurring[],
  promises: Promise_[],
  now = Date.now(),
): Leak[] {
  return [
    ...duplicates(txns),
    ...brokenPromises(promises, txns, now),
    ...fees(txns),
    ...fxMarkup(txns),
    ...zombies(recurring, now),
  ].sort((a, b) => b.at - a.at);
}

/**
 * What the leaks add up to.
 *
 * Zombie subscriptions are excluded: their figure is an annual projection of
 * money you may well be happy to spend, and adding a forward-looking estimate
 * to a list of past mistakes would overstate the loss.
 */
export function recoverable(leaks: Leak[]): number {
  return leaks
    .filter((l) => l.kind !== 'zombie')
    .reduce((sum, l) => sum + l.amountPaise, 0);
}
