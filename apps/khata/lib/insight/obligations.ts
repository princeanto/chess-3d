/**
 * Did you actually pay it.
 *
 * A bill email is a promise you made; a debit is the promise kept. Matching one
 * to the other is what turns a pile of mail into the answer to "have I missed
 * anything", and the answer has to be conservative in one specific direction:
 * calling a paid bill "missed" sends you to your banking app in a panic, which
 * costs more trust than staying quiet.
 */

import type { Obligation, Recurring, Txn } from '../ledger/types';
import { DAY_MS, dayGap } from '../ledger/time';
import { merchantKey } from '../parse/extract';

/** Bills get paid early and late; this is the window a payment may land in. */
const EARLY_DAYS = 25;
const LATE_DAYS = 12;

/** Below this, a difference between billed and paid is rounding, not a shortfall. */
const TOLERANCE_PAISE = 200;

export interface Settled {
  obligations: Obligation[];
  /** Set on the transactions that cleared something, for the ledger view. */
  clearedTxnIds: Set<string>;
}

export function settle(
  drafts: Array<Omit<Obligation, 'status' | 'clearedByTxnId'>>,
  txns: Txn[],
  now = Date.now(),
): Settled {
  const debits = txns
    .filter((t) => t.direction === 'debit')
    .sort((a, b) => a.at - b.at);
  const clearedTxnIds = new Set<string>();

  /*
   * Newest first.
   *
   * A card bill arrives monthly and the same payment could plausibly clear
   * either this month's or last month's. Settling recent obligations first
   * means each payment is claimed by the bill it most likely belongs to,
   * instead of being consumed by the oldest unpaid thing in the list.
   */
  const ordered = [...drafts].sort((a, b) => b.dueAt - a.dueAt);
  const obligations: Obligation[] = [];

  for (const draft of ordered) {
    const from = draft.dueAt - EARLY_DAYS * DAY_MS;
    const to = draft.dueAt + LATE_DAYS * DAY_MS;
    const label = merchantKey(draft.label);

    const match = debits.find((txn) => {
      if (clearedTxnIds.has(txn.id)) return false;
      if (txn.at < from || txn.at > to) return false;

      if (draft.amountPaise !== null) {
        if (Math.abs(txn.amountPaise - draft.amountPaise) > TOLERANCE_PAISE) return false;
      }

      const tailAgrees =
        draft.account?.tail && txn.account?.tail
          ? draft.account.tail === txn.account.tail
          : null;

      /*
       * A card bill names the card; the payment naming a different account is
       * the normal case, not a mismatch — nobody pays an Amex bill from Amex.
       * So for bills the tail is only ever positive evidence. A mandate is the
       * opposite: it debits the account it names, and a different account means
       * a different payment.
       */
      if (draft.kind !== 'bill' && tailAgrees === false) return false;

      const txnKey = merchantKey(txn.merchant);
      const merchantAgrees =
        label && txnKey ? txnKey.includes(label) || label.includes(txnKey) : null;

      // With no amount to go on, something else has to agree.
      if (draft.amountPaise === null && !merchantAgrees && !tailAgrees) return false;
      return true;
    });

    if (match) {
      clearedTxnIds.add(match.id);
      obligations.push({ ...draft, status: 'cleared', clearedByTxnId: match.id });
    } else {
      obligations.push({
        ...draft,
        // Not yet due is pending; past due with nothing against it is missed.
        status: draft.dueAt > now ? 'pending' : 'missed',
      });
    }
  }

  return { obligations: obligations.sort((a, b) => a.dueAt - b.dueAt), clearedTxnIds };
}

/**
 * Auto-debits that were announced and then didn't happen.
 *
 * A mandate notice says "₹X will be debited on the 5th". Nothing tells you when
 * it silently fails — the bank has no reason to write to you about a debit that
 * did not occur — so the absence has to be noticed here.
 */
export function failedMandates(obligations: Obligation[], now = Date.now()): Obligation[] {
  return obligations.filter(
    (o) =>
      o.kind !== 'bill' &&
      o.status === 'missed' &&
      // Give the bank a couple of days to actually run it before crying wolf.
      dayGap(o.dueAt, now) >= 2,
  );
}

/**
 * A series that skipped its turn.
 *
 * Complements the mandate check: this one needs no announcement, only a history
 * long enough to have an expectation. Only the most recent miss of each series
 * is worth surfacing — a subscription cancelled in March should not report a
 * missed payment every month since.
 */
export interface SkippedCharge {
  merchant: string;
  amountPaise: number;
  expectedAt: number;
  cadence: Recurring['cadence'];
}

export function skippedCharges(recurring: Recurring[], now = Date.now()): SkippedCharge[] {
  const out: SkippedCharge[] = [];
  for (const series of recurring) {
    if (!series.active) continue;
    const latest = series.missing[series.missing.length - 1];
    if (latest === undefined) continue;
    if (dayGap(latest, now) < 1) continue;
    out.push({
      merchant: series.merchant,
      amountPaise: series.amountPaise,
      expectedAt: latest,
      cadence: series.cadence,
    });
  }
  return out.sort((a, b) => b.expectedAt - a.expectedAt);
}
