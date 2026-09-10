'use client';

/**
 * Settings, and the honesty page.
 *
 * Most of this sheet is not configuration — it is a plain statement of what the
 * app can see, where the data sits, and how to get rid of it. An app that reads
 * a year of someone's bank mail owes them that in writing, in the app, not
 * buried in a policy nobody opens.
 */

import type { Books } from '@/lib/ledger/build';
import type { Settings } from '@/lib/store/db';
import { formatPaise } from '@/lib/parse/money';
import { months } from '@/lib/insight/summary';
import { formatMonth } from '@/lib/ledger/time';
import { Button, Label } from './ui/bits';

const WINDOWS = [
  { days: 90, label: '3 months' },
  { days: 365, label: '1 year' },
  { days: 730, label: '2 years' },
];

export default function Settings_({
  settings,
  books,
  onClose,
  onScanDays,
  onForget,
}: {
  settings: Settings;
  books: Books;
  onClose: () => void;
  onScanDays: (days: number) => void;
  onForget: () => void;
}) {
  const known = months(books.txns);

  return (
    <div className="fixed inset-0 z-40 flex items-end" role="dialog" aria-modal="true">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div className="rise relative max-h-[88vh] w-full overflow-y-auto rounded-t-3xl border-t border-line bg-paper pb-[max(28px,env(safe-area-inset-bottom))]">
        <div className="sticky top-0 flex justify-center bg-paper pb-2 pt-3">
          <div className="h-1 w-10 rounded-full bg-line" />
        </div>

        <div className="space-y-6 px-5">
          <div>
            <h2 className="text-[24px] tight">Settings</h2>
            {settings.address && (
              <p className="mt-1 text-[13px] text-muted">Reading {settings.address}</p>
            )}
          </div>

          <section>
            <Label>How far back to read</Label>
            <div className="mt-2 flex gap-2">
              {WINDOWS.map((w) => (
                <button
                  key={w.days}
                  onClick={() => onScanDays(w.days)}
                  className={`flex-1 rounded-xl px-3 py-2.5 text-[14px] active:opacity-70 ${
                    settings.scanDays === w.days
                      ? 'bg-ink text-paper'
                      : 'border border-line bg-surface text-muted'
                  }`}
                >
                  {w.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-faint">
              A longer window finds more repeating charges but takes longer on the first read.
              Widening it later tops up what you have rather than starting again.
            </p>
          </section>

          <section>
            <Label>What is on this device</Label>
            <dl className="mt-2 space-y-1 text-[13px]">
              <Line term="Emails cached" value={String(books.txns.length + books.ignored)} />
              <Line term="Transactions" value={String(books.txns.length)} />
              <Line
                term="Months covered"
                value={
                  known.length
                    ? `${formatMonth(known[known.length - 1])} – ${formatMonth(known[0])}`
                    : 'none'
                }
              />
              <Line term="Recurring charges" value={String(books.recurring.length)} />
              <Line
                term="Flagged as lost"
                value={formatPaise(books.recoverablePaise, { round: true })}
              />
            </dl>
          </section>

          <section>
            <Label>Where your data is</Label>
            <ul className="mt-2 space-y-2 text-[13px] text-muted">
              <li>
                · The ledger sits in this browser, encrypted with your passphrase. It is not
                uploaded and there is no account.
              </li>
              <li>
                · The script runs inside your own Google account with read-only access. It
                cannot send or delete mail.
              </li>
              <li>
                · Questions in Ask are answered here, on the device. Nothing is sent to any
                model or server.
              </li>
              <li>
                · Revoke everything at any time by deleting the deployment in Apps Script, or
                from your Google account’s third-party access page.
              </li>
            </ul>
          </section>

          <section>
            <Label>What it cannot see</Label>
            <p className="mt-2 text-[13px] text-muted">
              Only accounts that email you. Cash is invisible. Banks that send SMS but not
              email are invisible. If a card is missing from your figures, that is almost
              always why — turning on email alerts with that bank fixes it from the next
              transaction onward, though not retrospectively.
            </p>
          </section>

          <section className="border-t border-line pt-5">
            <Label>Start over</Label>
            <p className="mt-2 text-[13px] text-muted">
              Deletes the cached ledger, your corrections, and the stored connection to your
              inbox. Your mail is untouched.
            </p>
            <Button variant="danger" onClick={onForget} className="mt-3 w-full">
              Erase everything on this device
            </Button>
          </section>

          <Button variant="quiet" onClick={onClose} className="w-full">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}

function Line({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-line pb-1">
      <dt className="text-muted">{term}</dt>
      <dd className="mono">{value}</dd>
    </div>
  );
}
