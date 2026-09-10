'use client';

/**
 * The front page: where you stand, and what needs attention.
 *
 * Ordered by what would cost you money if you didn't see it. Missed payments
 * first, because they accrue interest; then money already lost, because it can
 * still be clawed back; then the month's position, which is information rather
 * than an action.
 */

import type { Books } from '@/lib/ledger/build';
import { coverage, months, pace, summariseMonth } from '@/lib/insight/summary';
import { formatPaise } from '@/lib/parse/money';
import { daysInMonth, formatDay, formatMonth, istMonthKey } from '@/lib/ledger/time';
import { Bar, Card, Empty, Label, Money, Row } from './ui/bits';

export default function Now({
  books,
  now,
  onOpenLedger,
}: {
  books: Books;
  now: number;
  onOpenLedger: (filter: { ids: string[]; title: string }) => void;
}) {
  /*
   * Usually this month — but not when this month is empty.
   *
   * On the first of the month, or when mail has simply stopped arriving, the
   * honest figure for "this month" is zero, and a screen led by a giant ₹0 reads
   * as a broken app rather than a quiet one. Falling back to the most recent
   * month that has anything in it keeps the page useful, and the label says
   * which month it is showing so nobody is misled about the period.
   */
  const current = istMonthKey(now);
  const available = months(books.txns);
  const isCurrent = summariseMonth(books.txns, current).count > 0 || available.length === 0;
  const month = isCurrent ? current : available[0];

  const summary = summariseMonth(books.txns, month);
  const rate = pace(books.txns, now);
  const cover = coverage(books.txns, month);

  const missed = books.obligations.filter((o) => o.status === 'missed');
  const pending = books.obligations.filter((o) => o.status === 'pending');
  const topLeaks = books.leaks.filter((l) => l.kind !== 'zombie').slice(0, 4);

  if (books.txns.length === 0) {
    return (
      <Empty
        title="Nothing found yet"
        detail="No bank alerts matched in the period scanned. Try a longer window in Settings, or check that email alerts are switched on with your bank."
      />
    );
  }

  const change =
    rate.lastMonthPaise > 0
      ? Math.round(((rate.projectedPaise - rate.lastMonthPaise) / rate.lastMonthPaise) * 100)
      : null;

  return (
    <div className="space-y-3 px-4 pb-6 pt-4">
      {/* -------- the position -------- */}
      <Card className="p-5">
        <Label>
          {isCurrent ? 'Out this month' : 'Out'} · {formatMonth(month)}
        </Label>
        <div className="mt-2 flex items-baseline gap-3">
          <Money paise={summary.outPaise} size="xl" />
        </div>
        <div className="mt-1 text-[13px] text-muted">
          {isCurrent ? (
            <>
              {formatPaise(rate.perDayPaise, { round: true })} a day over {rate.daysElapsed}{' '}
              {rate.daysElapsed === 1 ? 'day' : 'days'} · on track for{' '}
              {formatPaise(rate.projectedPaise, { round: true })}
              {change !== null && (
                <span className={change > 0 ? 'text-out' : 'text-in'}>
                  {' '}
                  ({change > 0 ? '+' : ''}
                  {change}% vs {formatPaise(rate.lastMonthPaise, { round: true })} last month)
                </span>
              )}
            </>
          ) : (
            <>
              Nothing has arrived for {formatMonth(current)} yet — either no money has moved,
              or the alerts have stopped. Pull to sync, or check Settings.
            </>
          )}
        </div>

        {summary.byCategory.length > 0 && (
          <div className="mt-4">
            <Bar parts={summary.byCategory.map((c) => ({ label: c.category, value: c.amountPaise }))} />
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
              {summary.byCategory.slice(0, 4).map((c) => (
                <span key={c.category}>
                  {c.category} {formatPaise(c.amountPaise, { round: true })}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 flex gap-6 border-t border-line pt-3">
          <div>
            <Label>In</Label>
            <Money paise={summary.inPaise} direction="credit" size="lg" />
          </div>
          <div>
            <Label>Net</Label>
            <span
              className={`mono text-[22px] ${summary.netPaise >= 0 ? 'text-in' : 'text-out'}`}
            >
              {formatPaise(summary.netPaise, { round: true })}
            </span>
          </div>
        </div>
      </Card>

      {/* -------- what needs doing -------- */}
      {(missed.length > 0 || books.skipped.length > 0) && (
        <Card>
          <div className="px-4 pt-4">
            <Label>Needs attention</Label>
          </div>
          <div className="mt-1 divide-y divide-line">
            {missed.map((o) => (
              <Row
                key={o.id}
                tone="out"
                wrap
                title={`${o.label} — no payment found`}
                subtitle={`Due ${formatDay(o.dueAt)}${o.kind === 'mandate' ? ' · auto-debit did not go through' : ''}`}
                right={o.amountPaise ? <Money paise={o.amountPaise} /> : undefined}
              />
            ))}
            {books.skipped.map((s) => (
              <Row
                key={`${s.merchant}${s.expectedAt}`}
                tone="warn"
                wrap
                title={`${s.merchant} did not charge`}
                subtitle={`Expected around ${formatDay(s.expectedAt)} · ${s.cadence}`}
                right={<Money paise={s.amountPaise} />}
              />
            ))}
          </div>
        </Card>
      )}

      {pending.length > 0 && (
        <Card>
          <div className="px-4 pt-4">
            <Label>Coming up</Label>
          </div>
          <div className="mt-1 divide-y divide-line">
            {pending.slice(0, 5).map((o) => (
              <Row
                key={o.id}
                title={o.label}
                subtitle={`Due ${formatDay(o.dueAt)}`}
                right={o.amountPaise ? <Money paise={o.amountPaise} /> : <span className="text-[13px] text-faint">amount t.b.c.</span>}
              />
            ))}
          </div>
        </Card>
      )}

      {/* -------- money lost -------- */}
      {topLeaks.length > 0 && (
        <Card>
          <div className="flex items-baseline justify-between px-4 pt-4">
            <Label>Money you may have lost</Label>
            <Money paise={books.recoverablePaise} size="sm" />
          </div>
          <div className="mt-1 divide-y divide-line">
            {topLeaks.map((l) => (
              <Row
                key={l.id}
                wrap
                title={l.title}
                subtitle={l.detail}
                onClick={l.txnIds.length ? () => onOpenLedger({ ids: l.txnIds, title: l.title }) : undefined}
              />
            ))}
          </div>
        </Card>
      )}

      {/* -------- how much of the picture this is -------- */}
      <Card className="p-4">
        <Label>How complete this is</Label>
        <p className="mt-2 text-[13px] text-muted">
          {cover.accounts.length === 0
            ? `No account could be identified in ${formatMonth(month)}.`
            : `In ${formatMonth(month)}, heard from ${cover.accounts.join(', ')} — ${cover.txnCount} ${cover.txnCount === 1 ? 'transaction' : 'transactions'} across ${daysInMonth(month) - cover.silentDays} ${daysInMonth(month) - cover.silentDays === 1 ? 'day' : 'days'}.`}
          {summary.unsure > 0 && (
            <>
              {' '}
              <span className="text-warn">
                {summary.unsure} more {summary.unsure === 1 ? 'email was' : 'emails were'} too
                unclear to count
              </span>{' '}
              and {summary.unsure === 1 ? 'is' : 'are'} held out of every figure above.
            </>
          )}
        </p>
        <p className="mt-2 text-[12px] text-faint">
          Khata only sees accounts that email you. If a card is missing here, its alerts are
          probably going to SMS instead.
        </p>
      </Card>

      {months(books.txns).length > 1 && (
        <div className="px-1 pt-2 text-[12px] text-faint">
          {books.txns.length} transactions · {books.ignored} messages not understood ·{' '}
          {available.length} months on file
        </div>
      )}
    </div>
  );
}
