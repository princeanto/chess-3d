/**
 * The numbers on the front page.
 *
 * Every figure here is deliberately paired with what it excludes. A total that
 * quietly drops the transactions it wasn't sure about is worse than one that
 * says "and eleven more I couldn't read" — the first is wrong, the second is
 * merely incomplete, and only one of them can be acted on.
 */

import type { Coverage, Txn } from '../ledger/types';
import { REVIEW_BELOW } from '../ledger/types';
import {
  DAY_MS,
  daysInMonth,
  istMonthKey,
  istParts,
  istStartOfMonth,
} from '../ledger/time';

export interface MonthSummary {
  month: string;
  inPaise: number;
  outPaise: number;
  netPaise: number;
  count: number;
  byCategory: Array<{ category: string; amountPaise: number; count: number }>;
  byAccount: Array<{ account: string; inPaise: number; outPaise: number }>;
  /** Transactions too uncertain to count, held out of every figure above. */
  unsure: number;
}

const counted = (t: Txn): boolean => t.confidence >= REVIEW_BELOW;

export function summariseMonth(txns: Txn[], month: string): MonthSummary {
  const mine = txns.filter((t) => istMonthKey(t.at) === month);
  const solid = mine.filter(counted);

  const categories = new Map<string, { amountPaise: number; count: number }>();
  const accounts = new Map<string, { inPaise: number; outPaise: number }>();
  let inPaise = 0;
  let outPaise = 0;

  for (const txn of solid) {
    if (txn.direction === 'credit') inPaise += txn.amountPaise;
    else outPaise += txn.amountPaise;

    if (txn.direction === 'debit') {
      const key = txn.category || 'Other';
      const entry = categories.get(key) ?? { amountPaise: 0, count: 0 };
      entry.amountPaise += txn.amountPaise;
      entry.count += 1;
      categories.set(key, entry);
    }

    const name = txn.account
      ? `${txn.account.issuer}${txn.account.tail ? ` ••${txn.account.tail}` : ''}`
      : 'Unattributed';
    const acc = accounts.get(name) ?? { inPaise: 0, outPaise: 0 };
    if (txn.direction === 'credit') acc.inPaise += txn.amountPaise;
    else acc.outPaise += txn.amountPaise;
    accounts.set(name, acc);
  }

  return {
    month,
    inPaise,
    outPaise,
    netPaise: inPaise - outPaise,
    count: solid.length,
    byCategory: [...categories.entries()]
      .map(([category, v]) => ({ category, ...v }))
      .sort((a, b) => b.amountPaise - a.amountPaise),
    byAccount: [...accounts.entries()]
      .map(([account, v]) => ({ account, ...v }))
      .sort((a, b) => b.outPaise - a.outPaise),
    unsure: mine.length - solid.length,
  };
}

export interface Pace {
  /** Spent so far this month. */
  spentPaise: number;
  /** Average per day across the days elapsed. */
  perDayPaise: number;
  /** Where the month lands at this rate. */
  projectedPaise: number;
  /** The same month's finished total last month, for comparison. */
  lastMonthPaise: number;
  daysElapsed: number;
  daysInMonth: number;
}

/**
 * How fast money is going out this month.
 *
 * The projection uses days elapsed rather than a rolling average, because rent
 * and salary land on fixed days: a rolling window says you are ruined on the
 * 2nd and rich on the 20th, whichever is true.
 */
export function pace(txns: Txn[], now = Date.now()): Pace {
  const month = istMonthKey(now);
  const previous = istMonthKey(istStartOfMonth(now) - DAY_MS);
  const thisMonth = summariseMonth(txns, month);
  const lastMonth = summariseMonth(txns, previous);

  const days = daysInMonth(month);
  const elapsed = Math.max(1, istParts(now).day);
  const perDay = Math.round(thisMonth.outPaise / elapsed);

  return {
    spentPaise: thisMonth.outPaise,
    perDayPaise: perDay,
    projectedPaise: perDay * days,
    lastMonthPaise: lastMonth.outPaise,
    daysElapsed: elapsed,
    daysInMonth: days,
  };
}

/** Every month that has any mail in it, newest first. */
export function months(txns: Txn[]): string[] {
  return [...new Set(txns.map((t) => istMonthKey(t.at)))].sort().reverse();
}

/**
 * How much of a month the app can actually see.
 *
 * Blunt on purpose, and never shown as a bare number. The app has no way of
 * knowing what it wasn't sent, so this measures the shape of what arrived — how
 * many accounts spoke up, and whether the days run continuously — and leaves
 * the conclusion to a sentence next to it.
 */
export function coverage(txns: Txn[], month: string): Coverage {
  const mine = txns.filter((t) => istMonthKey(t.at) === month && counted(t));
  const accounts = [
    ...new Set(
      mine
        .filter((t) => t.account)
        .map((t) => `${t.account!.issuer}${t.account!.tail ? ` ••${t.account!.tail}` : ''}`),
    ),
  ].sort();

  const total = daysInMonth(month);
  const active = new Set(mine.map((t) => istParts(t.at).day)).size;
  const silentDays = total - active;

  // Two thirds on how many accounts reported, one third on how continuous the
  // days are. A single quiet week is normal; a whole quiet month is not.
  const accountScore = Math.min(1, accounts.length / 2);
  const dayScore = Math.min(1, active / (total * 0.4));
  return {
    month,
    accounts,
    txnCount: mine.length,
    silentDays,
    score: Number((accountScore * 0.66 + dayScore * 0.34).toFixed(2)),
  };
}
