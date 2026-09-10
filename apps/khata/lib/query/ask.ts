/**
 * Plain-language questions, answered arithmetically.
 *
 * No model, no network. Partly because sending a year of someone's spending to
 * an API to be told the sum would undo every other decision in this app, and
 * partly because the questions people actually ask about money are a small,
 * closed set: how much, on what, when, and where did it go.
 *
 * When it does not understand, it says so and lists what it can do, rather than
 * guessing an answer that looks authoritative and is wrong.
 */

import type { Txn } from '../ledger/types';
import { REVIEW_BELOW } from '../ledger/types';
import { CATEGORIES } from '../insight/categories';
import { formatPaise } from '../parse/money';
import {
  DAY_MS,
  formatDay,
  formatMonth,
  istMonthKey,
  istParts,
  istStartOfDay,
  istStartOfMonth,
} from '../ledger/time';
import { merchantKey } from '../parse/extract';

export interface Answer {
  headline: string;
  detail?: string;
  txns: Txn[];
  understood: boolean;
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

interface Window_ {
  from: number;
  to: number;
  label: string;
}

/** The period the question is about; this month unless it says otherwise. */
function readPeriod(q: string, now: number): Window_ {
  const monthStart = istStartOfMonth(now);

  if (/\blast month\b|\bprevious month\b/.test(q)) {
    const end = monthStart - 1;
    return { from: istStartOfMonth(end), to: end, label: formatMonth(istMonthKey(end)) };
  }
  if (/\bthis month\b/.test(q)) {
    return { from: monthStart, to: now, label: 'this month' };
  }
  if (/\btoday\b/.test(q)) {
    return { from: istStartOfDay(now), to: now, label: 'today' };
  }
  if (/\byesterday\b/.test(q)) {
    const start = istStartOfDay(now) - DAY_MS;
    return { from: start, to: start + DAY_MS - 1, label: 'yesterday' };
  }
  if (/\bthis (?:year|yr)\b/.test(q)) {
    const year = istParts(now).year;
    return { from: Date.UTC(year, 0, 1) - 19800000, to: now, label: String(year) };
  }
  if (/\blast (?:year|yr)\b/.test(q)) {
    const year = istParts(now).year - 1;
    return {
      from: Date.UTC(year, 0, 1) - 19800000,
      to: Date.UTC(year + 1, 0, 1) - 19800001,
      label: String(year),
    };
  }

  const weeks = /\blast (\d+)\s*(day|week|month)s?\b/.exec(q);
  if (weeks) {
    const n = Number(weeks[1]);
    const unit = weeks[2];
    const span = unit === 'day' ? n : unit === 'week' ? n * 7 : n * 30;
    return { from: now - span * DAY_MS, to: now, label: `the last ${n} ${unit}${n > 1 ? 's' : ''}` };
  }

  for (let i = 0; i < MONTHS.length; i += 1) {
    if (new RegExp(`\\b${MONTHS[i].slice(0, 3)}[a-z]*\\b`).test(q)) {
      const here = istParts(now);
      // A month later than the current one must mean last year.
      const year = i + 1 > here.month ? here.year - 1 : here.year;
      const from = Date.UTC(year, i, 1) - 19800000;
      const to = Date.UTC(year, i + 1, 1) - 19800001;
      return { from, to, label: `${MONTHS[i][0].toUpperCase()}${MONTHS[i].slice(1)} ${year}` };
    }
  }

  return { from: monthStart, to: now, label: 'this month' };
}

export function ask(question: string, all: Txn[], now = Date.now()): Answer {
  const q = question.toLowerCase().trim();
  if (!q) return { headline: '', txns: [], understood: false };

  const period = readPeriod(q, now);
  const solid = all.filter((t) => t.confidence >= REVIEW_BELOW);
  let scope = solid.filter((t) => t.at >= period.from && t.at <= period.to);

  const wantsCredit = /\b(?:earn|income|receive|received|credit|credited|salary|refund)\b/.test(q);
  const direction = wantsCredit ? 'credit' : 'debit';
  scope = scope.filter((t) => t.direction === direction);

  let subject = '';

  const category = CATEGORIES.find((c) => q.includes(c.toLowerCase()));
  if (category) {
    scope = scope.filter((t) => t.category === category);
    subject = category.toLowerCase();
  }

  /*
   * A merchant is whatever word in the question matches a merchant on file.
   * Checking against the ledger rather than a dictionary means "how much on
   * kirana" works if that is what the alerts say, without anyone maintaining a
   * list of Indian shop names.
   */
  if (!category) {
    const words = q.split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
    const known = new Map<string, string>();
    for (const t of solid) {
      const key = merchantKey(t.merchant);
      if (key && t.merchant) known.set(key, t.merchant);
    }
    for (const word of words) {
      for (const [key, label] of known) {
        if (key.includes(word) && word.length >= 4) {
          scope = scope.filter((t) => merchantKey(t.merchant).includes(word));
          subject = label;
          break;
        }
      }
      if (subject) break;
    }
  }

  const total = scope.reduce((sum, t) => sum + t.amountPaise, 0);
  const noun = direction === 'credit' ? 'came in' : 'went out';

  // "Biggest", "largest", "most expensive" — one row, not a sum.
  if (/\b(biggest|largest|highest|most expensive|top)\b/.test(q)) {
    const ranked = [...scope].sort((a, b) => b.amountPaise - a.amountPaise).slice(0, 5);
    if (ranked.length === 0) {
      return { headline: `Nothing ${noun}${subject ? ` on ${subject}` : ''} in ${period.label}.`, txns: [], understood: true };
    }
    return {
      headline: `${formatPaise(ranked[0].amountPaise, { round: true })} — ${ranked[0].merchant ?? 'unnamed'}`,
      detail: `The largest of ${scope.length} ${subject ? `${subject} ` : ''}payments in ${period.label}, on ${formatDay(ranked[0].at)}.`,
      txns: ranked,
      understood: true,
    };
  }

  // "How many" — a count.
  if (/\bhow many\b|\bcount\b|\btimes\b/.test(q)) {
    return {
      headline: `${scope.length} ${scope.length === 1 ? 'time' : 'times'}`,
      detail: `${subject ? `${subject}, ` : ''}${period.label}, totalling ${formatPaise(total, { round: true })}.`,
      txns: scope.slice(0, 50),
      understood: true,
    };
  }

  // "Where did it go" — a breakdown.
  if (/\bwhere\b|\bbreakdown\b|\bwhat (?:did i|have i) (?:spend|buy)\b|\bon what\b/.test(q)) {
    const byCategory = new Map<string, number>();
    for (const t of scope) byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + t.amountPaise);
    const ranked = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (ranked.length === 0) {
      return { headline: `Nothing ${noun} in ${period.label}.`, txns: [], understood: true };
    }
    return {
      headline: formatPaise(total, { round: true }),
      detail: `${period.label} — ${ranked.map(([c, v]) => `${c} ${formatPaise(v, { round: true })}`).join(', ')}.`,
      txns: [...scope].sort((a, b) => b.amountPaise - a.amountPaise).slice(0, 50),
      understood: true,
    };
  }

  const asksTotal = /\bhow much\b|\btotal\b|\bsum\b|\bspent?\b|\bspending\b|\bpaid\b|\bearn/.test(q) || Boolean(subject);
  if (!asksTotal) {
    return {
      headline: 'Not sure what you are asking.',
      detail:
        'Try “how much on food last month”, “biggest expense this year”, “how many times swiggy”, or “where did my money go in July”.',
      txns: [],
      understood: false,
    };
  }

  if (scope.length === 0) {
    return {
      headline: `Nothing ${noun}${subject ? ` on ${subject}` : ''} in ${period.label}.`,
      detail: 'Either there was none, or no email arrived about it.',
      txns: [],
      understood: true,
    };
  }

  return {
    headline: formatPaise(total, { round: true }),
    detail: `${subject ? `${subject}, ` : ''}${period.label} — across ${scope.length} ${scope.length === 1 ? 'payment' : 'payments'}.`,
    txns: [...scope].sort((a, b) => b.amountPaise - a.amountPaise).slice(0, 50),
    understood: true,
  };
}

export const EXAMPLES = [
  'how much on food last month',
  'biggest expense this year',
  'where did my money go in July',
  'how many times swiggy',
  'how much did I earn this month',
];
