'use client';

/**
 * What repeats, and what is owed.
 *
 * Subscriptions are shown at their annual cost rather than their monthly one,
 * because ₹649 a month is a decision nobody revisits and ₹7,788 a year is a
 * decision anybody would.
 */

import type { Books } from '@/lib/ledger/build';
import { formatPaise } from '@/lib/parse/money';
import { formatDay, dayGap } from '@/lib/ledger/time';
import { Card, Empty, Label, Money, Row } from './ui/bits';

const PER_YEAR = { weekly: 52, monthly: 12, quarterly: 4, yearly: 1 } as const;

export default function Watch({ books, now }: { books: Books; now: number }) {
  const live = books.recurring.filter((r) => r.active);
  const lapsed = books.recurring.filter((r) => !r.active);
  const upcoming = books.obligations
    .filter((o) => o.status === 'pending')
    .sort((a, b) => a.dueAt - b.dueAt);

  const annual = live.reduce((sum, r) => sum + r.amountPaise * PER_YEAR[r.cadence], 0);

  if (books.recurring.length === 0 && upcoming.length === 0) {
    return (
      <Empty
        title="Nothing repeating yet"
        detail="A charge has to appear at least three times before Khata will call it a pattern. Scan a longer period to find more."
      />
    );
  }

  return (
    <div className="space-y-3 px-4 pb-6 pt-4">
      {live.length > 0 && (
        <Card className="p-5">
          <Label>Committed every year</Label>
          <div className="mt-2">
            <Money paise={annual} size="xl" />
          </div>
          <div className="mt-1 text-[13px] text-muted">
            Across {live.length} recurring {live.length === 1 ? 'charge' : 'charges'} — roughly{' '}
            {formatPaise(Math.round(annual / 12), { round: true })} a month before you spend
            anything.
          </div>
        </Card>
      )}

      {upcoming.length > 0 && (
        <Card>
          <div className="px-4 pt-4">
            <Label>Due soon</Label>
          </div>
          <div className="mt-1 divide-y divide-line">
            {upcoming.map((o) => {
              const days = dayGap(now, o.dueAt);
              return (
                <Row
                  key={o.id}
                  tone={days <= 3 ? 'warn' : undefined}
                  title={o.label}
                  subtitle={`${o.kind === 'bill' ? 'Bill' : o.kind === 'emi' ? 'EMI' : 'Auto-debit'} · ${formatDay(o.dueAt)}`}
                  right={o.amountPaise ? <Money paise={o.amountPaise} /> : undefined}
                  belowRight={days <= 0 ? 'today' : `in ${days}d`}
                />
              );
            })}
          </div>
        </Card>
      )}

      {live.length > 0 && (
        <Card>
          <div className="px-4 pt-4">
            <Label>Recurring</Label>
          </div>
          <div className="mt-1 divide-y divide-line">
            {live.map((r) => (
              <Row
                key={r.key}
                tone={r.missing.length > 0 ? 'warn' : undefined}
                title={r.merchant}
                subtitle={`${r.cadence} · ${r.occurrences.length} times · next around ${formatDay(r.nextExpectedAt)}${r.missing.length ? ` · skipped ${r.missing.length}` : ''}`}
                right={<Money paise={r.amountPaise} />}
                belowRight={`${formatPaise(r.amountPaise * PER_YEAR[r.cadence], { round: true })}/yr`}
              />
            ))}
          </div>
        </Card>
      )}

      {lapsed.length > 0 && (
        <Card>
          <div className="px-4 pt-4">
            <Label>Stopped</Label>
          </div>
          <div className="mt-1 divide-y divide-line">
            {lapsed.map((r) => (
              <Row
                key={r.key}
                title={r.merchant}
                subtitle={`Last charged ${formatDay(r.occurrences[r.occurrences.length - 1])} · was ${r.cadence}`}
                right={<Money paise={r.amountPaise} />}
              />
            ))}
          </div>
          <p className="px-4 pb-4 pt-2 text-[12px] text-faint">
            These have gone quiet for more than two of their own intervals. Usually that means
            cancelled — occasionally it means a card expired and the merchant gave up.
          </p>
        </Card>
      )}
    </div>
  );
}
