/**
 * Finding the charges that repeat.
 *
 * A subscription is not a label a bank gives you — it is a pattern you can only
 * see by looking at a year at once: the same merchant, about the same amount,
 * about the same distance apart. Once the pattern is known, the interesting
 * thing is not the charges that happened but the one that didn't, which is how
 * a failed auto-debit is caught before the late fee arrives.
 */

import type { Recurring, Txn } from '../ledger/types';
import { DAY_MS, dayGap } from '../ledger/time';
import { merchantKey } from '../parse/extract';

interface Shape {
  cadence: Recurring['cadence'];
  days: number;
  /** How far a charge may slip and still count as on time. */
  slack: number;
}

const SHAPES: Shape[] = [
  { cadence: 'weekly', days: 7, slack: 2 },
  { cadence: 'monthly', days: 30, slack: 6 },
  { cadence: 'quarterly', days: 91, slack: 10 },
  { cadence: 'yearly', days: 365, slack: 20 },
];

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
};

/**
 * Charges from one merchant, split by price.
 *
 * Netflix at ₹199 and Netflix at ₹649 are two different subscriptions, or one
 * that changed plan — either way they are separate series, because merging them
 * produces a median nobody was ever charged.
 */
function splitByAmount(txns: Txn[]): Txn[][] {
  const sorted = [...txns].sort((a, b) => a.amountPaise - b.amountPaise);
  const clusters: Txn[][] = [];
  for (const txn of sorted) {
    const last = clusters[clusters.length - 1];
    if (last) {
      const reference = median(last.map((t) => t.amountPaise));
      // Proportional, with a floor, so small charges are not all one cluster.
      const tolerance = Math.max(5000, reference * 0.08);
      if (Math.abs(txn.amountPaise - reference) <= tolerance) {
        last.push(txn);
        continue;
      }
    }
    clusters.push([txn]);
  }
  return clusters;
}

export function findRecurring(txns: Txn[], now = Date.now()): Recurring[] {
  const byMerchant = new Map<string, Txn[]>();
  for (const txn of txns) {
    if (txn.direction !== 'debit') continue;
    const key = merchantKey(txn.merchant);
    if (!key) continue;
    const list = byMerchant.get(key);
    if (list) list.push(txn);
    else byMerchant.set(key, [txn]);
  }

  const found: Recurring[] = [];

  for (const [key, all] of byMerchant) {
    for (const cluster of splitByAmount(all)) {
      // Two points make a line through anything. Three make a pattern.
      if (cluster.length < 3) continue;
      const series = [...cluster].sort((a, b) => a.at - b.at);

      const gaps: number[] = [];
      for (let i = 1; i < series.length; i += 1) {
        gaps.push(dayGap(series[i - 1].at, series[i].at));
      }
      const typical = median(gaps);
      const shape = SHAPES.find((s) => Math.abs(typical - s.days) <= s.slack);
      if (!shape) continue;

      // Most of the intervals have to fit the shape, not just the middle one —
      // otherwise three unrelated purchases a month apart look like a plan.
      const fitting = gaps.filter((g) => Math.abs(g - shape.days) <= shape.slack).length;
      if (fitting / gaps.length < 0.6) continue;

      const amountPaise = median(series.map((t) => t.amountPaise));
      const occurrences = series.map((t) => t.at);
      const last = occurrences[occurrences.length - 1];

      found.push({
        key: `${key}:${Math.round(amountPaise / 100)}`,
        merchant: series[series.length - 1].merchant ?? key,
        amountPaise,
        cadence: shape.cadence,
        occurrences,
        txnIds: series.map((t) => t.id),
        nextExpectedAt: last + shape.days * DAY_MS,
        missing: findGaps(occurrences, shape, now),
        // Two intervals of silence is a cancellation, not a late payment.
        active: dayGap(last, now) <= shape.days * 2 + shape.slack,
      });
    }
  }

  return found.sort((a, b) => b.amountPaise - a.amountPaise);
}

/**
 * Dates the pattern predicted where nothing was charged.
 *
 * Walks forward from the first occurrence rather than backward from the last,
 * so a series that stopped six months ago reports the stop rather than nothing.
 */
function findGaps(occurrences: number[], shape: Shape, now: number): number[] {
  const missing: number[] = [];
  const first = occurrences[0];
  const last = occurrences[occurrences.length - 1];
  // Only look as far as the series itself ran; a cancelled subscription is not
  // a missed payment every month until the end of time.
  const horizon = Math.min(now, last + shape.days * DAY_MS);

  for (let step = 1; ; step += 1) {
    const expected = first + step * shape.days * DAY_MS;
    if (expected > horizon) break;
    const nearby = occurrences.some(
      (at) => Math.abs(dayGap(expected, at)) <= shape.slack,
    );
    if (!nearby) missing.push(expected);
  }
  return missing;
}
