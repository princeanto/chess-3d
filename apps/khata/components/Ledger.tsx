'use client';

/**
 * Every transaction, and the evidence behind each one.
 *
 * The detail sheet exists because a number you cannot check is a number you
 * cannot trust: tapping a row shows which emails produced it, what the parser
 * concluded, and how sure it was. It is also where a wrong reading gets
 * corrected, and corrections are permanent — a later scan never overwrites one.
 */

import { useMemo, useState } from 'react';
import type { Txn } from '@/lib/ledger/types';
import { REVIEW_BELOW } from '@/lib/ledger/types';
import { CATEGORIES, type Category } from '@/lib/insight/categories';
import { formatPaise } from '@/lib/parse/money';
import { formatDayLong, formatTime, istDayKey } from '@/lib/ledger/time';
import { Button, Empty, Label, Money, Row } from './ui/bits';

export interface Filter {
  ids: string[];
  title: string;
}

export default function Ledger({
  txns,
  clearedTxnIds,
  filter,
  onClearFilter,
  onEdit,
}: {
  txns: Txn[];
  clearedTxnIds: Set<string>;
  filter?: Filter;
  onClearFilter: () => void;
  onEdit: (id: string, patch: Partial<Txn>) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Txn | null>(null);
  const [onlyUnsure, setOnlyUnsure] = useState(false);

  const shown = useMemo(() => {
    let list = txns;
    if (filter) {
      const wanted = new Set(filter.ids);
      list = list.filter((t) => wanted.has(t.id));
    }
    if (onlyUnsure) list = list.filter((t) => t.confidence < REVIEW_BELOW);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (t) =>
          (t.merchant ?? '').toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          (t.account?.issuer ?? '').toLowerCase().includes(q) ||
          formatPaise(t.amountPaise).includes(q),
      );
    }
    return list;
  }, [txns, filter, query, onlyUnsure]);

  const days = useMemo(() => {
    const grouped = new Map<string, Txn[]>();
    for (const txn of shown) {
      const key = istDayKey(txn.at);
      const list = grouped.get(key);
      if (list) list.push(txn);
      else grouped.set(key, [txn]);
    }
    return [...grouped.entries()];
  }, [shown]);

  const unsureCount = txns.filter((t) => t.confidence < REVIEW_BELOW).length;

  return (
    <div className="pb-6">
      <div className="sticky top-0 z-10 space-y-2 border-b border-line bg-paper/95 px-4 pb-3 pt-3 backdrop-blur">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search merchant, category, amount"
          className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-[15px] outline-none focus:border-ink"
        />
        <div className="flex items-center gap-2">
          {filter && (
            <button
              onClick={onClearFilter}
              className="rounded-full border border-line bg-surface px-3 py-1 text-[12px] active:opacity-70"
            >
              {filter.title} ✕
            </button>
          )}
          {unsureCount > 0 && (
            <button
              onClick={() => setOnlyUnsure((v) => !v)}
              className={`rounded-full px-3 py-1 text-[12px] active:opacity-70 ${onlyUnsure ? 'bg-ink text-paper' : 'border border-line bg-surface text-warn'}`}
            >
              {unsureCount} to review
            </button>
          )}
        </div>
      </div>

      {days.length === 0 ? (
        <Empty title="Nothing matches" detail="Try a different search, or clear the filter." />
      ) : (
        days.map(([day, list]) => (
          <div key={day}>
            <div className="flex items-baseline justify-between px-4 pb-1 pt-4">
              <Label>{formatDayLong(list[0].at)}</Label>
              <span className="mono text-[12px] text-faint">
                {formatPaise(
                  list.reduce((s, t) => s + (t.direction === 'debit' ? t.amountPaise : 0), 0),
                  { round: true },
                )}
              </span>
            </div>
            <div className="divide-y divide-line border-y border-line bg-surface">
              {list.map((txn) => (
                <Row
                  key={txn.id}
                  onClick={() => setOpen(txn)}
                  tone={txn.confidence < REVIEW_BELOW ? 'warn' : undefined}
                  title={txn.merchant ?? 'Unnamed'}
                  subtitle={[
                    txn.category,
                    txn.account?.tail ? `••${txn.account.tail}` : txn.account?.issuer,
                    clearedTxnIds.has(txn.id) ? 'cleared a bill' : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  right={<Money paise={txn.amountPaise} direction={txn.direction} />}
                  belowRight={formatTime(txn.at)}
                />
              ))}
            </div>
          </div>
        ))
      )}

      {open && <Detail txn={open} onClose={() => setOpen(null)} onEdit={onEdit} />}
    </div>
  );
}

/** The sheet behind a row: the sources, the reasoning, and the correction. */
function Detail({
  txn,
  onClose,
  onEdit,
}: {
  txn: Txn;
  onClose: () => void;
  onEdit: (id: string, patch: Partial<Txn>) => void;
}) {
  return (
    <div className="fixed inset-0 z-30 flex items-end" role="dialog" aria-modal="true">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div className="rise relative max-h-[85vh] w-full overflow-y-auto rounded-t-3xl border-t border-line bg-paper pb-[max(24px,env(safe-area-inset-bottom))]">
        <div className="sticky top-0 flex justify-center bg-paper pb-2 pt-3">
          <div className="h-1 w-10 rounded-full bg-line" />
        </div>

        <div className="px-5">
          <Money paise={txn.amountPaise} direction={txn.direction} size="xl" round={false} />
          <div className="mt-1 text-[15px] tight">{txn.merchant ?? 'Unnamed'}</div>
          <div className="text-[13px] text-muted">
            {formatDayLong(txn.at)} at {formatTime(txn.at)} ·{' '}
            {txn.account
              ? `${txn.account.issuer}${txn.account.tail ? ` ••${txn.account.tail}` : ''}`
              : 'account unknown'}{' '}
            · {txn.method}
          </div>

          <div className="mt-5">
            <Label>Category</Label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => onEdit(txn.id, { category: c })}
                  className={`rounded-full px-3 py-1.5 text-[13px] active:opacity-70 ${
                    txn.category === c
                      ? 'bg-ink text-paper'
                      : 'border border-line bg-surface text-muted'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-faint">
              Changing this also files every future payment to {txn.merchant ?? 'this merchant'}{' '}
              the same way.
            </p>
          </div>

          <div className="mt-5">
            <Label>Direction</Label>
            <div className="mt-2 flex gap-2">
              {(['debit', 'credit'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => onEdit(txn.id, { direction: d })}
                  className={`rounded-xl px-4 py-2 text-[14px] active:opacity-70 ${
                    txn.direction === d
                      ? 'bg-ink text-paper'
                      : 'border border-line bg-surface text-muted'
                  }`}
                >
                  {d === 'debit' ? 'Money out' : 'Money in'}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <Label>Where this came from</Label>
            <div className="mt-2 space-y-2">
              {txn.sources.map((s) => (
                <div key={s.messageId} className="rounded-xl border border-line bg-surface p-3">
                  <div className="text-[13px] tight">{s.subject || '(no subject)'}</div>
                  <div className="mt-0.5 text-[12px] text-muted">{s.from}</div>
                  <div className="mt-1 text-[11px] uppercase tracking-wider text-faint">
                    {s.kind.replace('-', ' ')}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-faint">
              {txn.sources.length > 1
                ? `${txn.sources.length} emails described this one payment, so it is counted once.`
                : 'One email reported this.'}
              {txn.reference && ` Reference ${txn.reference}.`}{' '}
              Confidence {Math.round(txn.confidence * 100)}%.
            </p>
          </div>

          <div className="mt-6">
            <Button variant="quiet" onClick={onClose} className="w-full">
              Done
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
