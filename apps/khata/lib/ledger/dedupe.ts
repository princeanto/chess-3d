/**
 * Collapsing several emails about one payment into one transaction.
 *
 * This is the load-bearing wall of the whole app. Buy a coffee with UPI and
 * three systems tell you about it: your bank's debit alert, the payment app's
 * receipt, and the merchant's own confirmation. Count all three and your
 * spending is triple what it was; count none and it never happened.
 *
 * The temptation is to merge anything with a matching amount inside a time
 * window, and that is exactly wrong — it silently swallows the double-swipe,
 * which is one of the things the user asked to be told about. So the rules are
 * deliberately conservative, and the tie-breaker is always the bank's own
 * reference rather than a guess about timing.
 */

import type { Record_, Source, Txn } from './types';
import { hashId } from './id';
import { merchantKey } from '../parse/extract';

/** Two systems reporting one event are minutes apart, not hours. */
const WINDOW_MS = 90 * 60 * 1000;

/**
 * How different two reports of a payment are allowed to be.
 *
 * A merchant receipt is often for the order total while the bank alert is for
 * the amount actually captured, so exact equality is too strict — but the gap
 * between a ₹499 and a ₹500 subscription is real, so it cannot be loose either.
 */
const TOLERANCE_PAISE = 100;

function sameAmount(a: number, b: number): boolean {
  return Math.abs(a - b) <= TOLERANCE_PAISE;
}

/**
 * Do these two records describe the same movement of money?
 *
 * Read the negative cases first — they are the ones that protect the totals.
 */
export function isSameEvent(a: Record_, b: Record_): boolean {
  if (a.direction !== b.direction) return false;
  if (!sameAmount(a.amountPaise, b.amountPaise)) return false;

  /*
   * References settle it in both directions, and they outrank everything else.
   * Matching references are the same payment even if the mails arrived a day
   * apart; differing references are two payments even if they arrived in the
   * same minute, which is precisely what a double-swipe looks like.
   */
  if (a.reference && b.reference) return a.reference === b.reference;

  if (Math.abs(a.at - b.at) > WINDOW_MS) return false;

  /*
   * Without references, only reports from *different* systems may merge. Two
   * alerts from the same bank for the same amount are two charges — that is the
   * bank telling you it happened twice.
   */
  const sameSystem = a.source.from === b.source.from;
  if (sameSystem) return false;

  const tailA = a.account?.tail;
  const tailB = b.account?.tail;
  if (tailA && tailB && tailA !== tailB) return false;

  const merchantA = merchantKey(a.merchant);
  const merchantB = merchantKey(b.merchant);
  if (merchantA && merchantB && merchantA !== merchantB) {
    // One may be the payment app and the other the shop; allow a containment
    // match ("swiggy" inside "swiggyinstamart") but nothing looser.
    if (!merchantA.includes(merchantB) && !merchantB.includes(merchantA)) return false;
  }

  // Same amount, same direction, minutes apart, from two different systems,
  // with nothing contradicting. That is one payment seen twice.
  return true;
}

/** The record that should supply the transaction's facts. */
function preferred(a: Record_, b: Record_): Record_ {
  // A bank is the system of record; a merchant receipt is hearsay about it.
  const rank = (r: Record_): number =>
    r.source.kind === 'bank-alert' ? 3 : r.source.kind === 'upi-receipt' ? 2 : 1;
  const ra = rank(a);
  const rb = rank(b);
  if (ra !== rb) return ra > rb ? a : b;
  return a.confidence >= b.confidence ? a : b;
}

/**
 * Records to transactions.
 *
 * Buckets by amount first so that the pairwise comparison stays near-linear on
 * a year of mail rather than quadratic over the whole set.
 */
export function reconcile(records: Record_[]): Txn[] {
  const sorted = [...records].sort((x, y) => x.at - y.at);

  const buckets = new Map<number, Record_[][]>();
  const groups: Record_[][] = [];

  for (const record of sorted) {
    // A tolerance of one rupee means a record can belong to three adjacent
    // buckets; check all of them rather than rounding and hoping.
    const centre = Math.round(record.amountPaise / 100);
    let placed = false;

    for (const offset of [-1, 0, 1]) {
      const candidates = buckets.get(centre + offset);
      if (!candidates) continue;
      for (const group of candidates) {
        if (group.some((existing) => isSameEvent(existing, record))) {
          group.push(record);
          placed = true;
          break;
        }
      }
      if (placed) break;
    }

    if (!placed) {
      const group = [record];
      groups.push(group);
      const list = buckets.get(centre);
      if (list) list.push(group);
      else buckets.set(centre, [group]);
    }
  }

  return groups.map(toTxn);
}

function toTxn(group: Record_[]): Txn {
  const lead = group.reduce(preferred);
  const sources: Source[] = group.map((r) => r.source);

  /*
   * Corroboration is evidence. Two independent systems reporting the same
   * payment is a stronger signal than either alone, so the merged confidence
   * rises above the best single reading — but never to certainty, because the
   * parse underneath could still be wrong in the same way twice.
   */
  const best = Math.max(...group.map((r) => r.confidence));
  const confidence =
    group.length > 1 ? Math.min(0.98, best + 0.12 * (group.length - 1)) : best;

  return {
    // Built from the earliest message id so the id survives re-scans in which a
    // later corroborating mail has not been fetched yet.
    id: hashId('txn', sources[0].messageId),
    at: Math.min(...group.map((r) => r.at)),
    amountPaise: lead.amountPaise,
    direction: lead.direction,
    account: lead.account ?? group.find((r) => r.account)?.account ?? null,
    merchant: lead.merchant ?? group.find((r) => r.merchant)?.merchant ?? null,
    method: lead.method !== 'unknown' ? lead.method : (group.find((r) => r.method !== 'unknown')?.method ?? 'unknown'),
    category: '',
    reference: lead.reference ?? group.find((r) => r.reference)?.reference ?? null,
    confidence,
    sources,
  };
}
