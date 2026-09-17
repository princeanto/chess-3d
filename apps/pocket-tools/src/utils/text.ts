/**
 * Text tools, as plain functions. Nothing here touches the page, so each one is
 * tested directly and every edge — empty input, Windows line endings, emoji —
 * is handled once for every tool that uses it.
 */

const lines = (text: string): string[] => text.replace(/\r\n?/g, '\n').split('\n');

/* ------------------------------- cleaner ------------------------------- */

export interface CleanOptions {
  extraSpaces: boolean;
  emptyLines: boolean;
  trimLines: boolean;
  duplicateLines: boolean;
  punctuation: boolean;
}

export const CLEAN_DEFAULTS: CleanOptions = { extraSpaces: true, emptyLines: true, trimLines: true, duplicateLines: false, punctuation: true };

export function normalizePunctuation(text: string): string {
  return text
    .replace(/[​-‍﻿]/g, '')
    .replace(/[   ]/g, ' ')
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/…/g, '...')
    .replace(/ +([,.;:!?%)\]}])/g, '$1')
    .replace(/([([{]) +/g, '$1')
    .replace(/([,;:])(?=[A-Za-z])/g, '$1 ');
}

export function cleanText(text: string, o: CleanOptions): string {
  let out = lines(text);
  if (o.punctuation) out = out.map(normalizePunctuation);
  if (o.extraSpaces) out = out.map((line) => line.replace(/[ \t]{2,}/g, ' ').replace(/\t/g, ' '));
  if (o.trimLines) out = out.map((line) => line.trim());
  if (o.emptyLines) out = out.filter((line) => line.trim() !== '');
  if (o.duplicateLines) {
    const seen = new Set<string>();
    out = out.filter((line) => {
      if (line.trim() === '') return true;
      if (seen.has(line)) return false;
      seen.add(line);
      return true;
    });
  }
  return out.join('\n').replace(/^\n+|\n+$/g, '');
}

/* --------------------------------- case -------------------------------- */

export type CaseMode = 'upper' | 'lower' | 'title' | 'sentence' | 'alternating';

const SMALL = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'nor', 'for', 'so', 'yet', 'as', 'at', 'by', 'in', 'of', 'off', 'on', 'per', 'to', 'up', 'via', 'vs']);

export function convertCase(text: string, mode: CaseMode): string {
  switch (mode) {
    case 'upper': return text.toUpperCase();
    case 'lower': return text.toLowerCase();
    case 'title':
      return lines(text).map((line) => {
        const words = line.split(/(\s+)/);
        const real = words.map((w, i) => (w.trim() ? i : -1)).filter((i) => i >= 0);
        return words.map((word, i) => {
          if (!word.trim()) return word;
          const lower = word.toLowerCase();
          const edge = i === real[0] || i === real[real.length - 1];
          if (!edge && SMALL.has(lower.replace(/[^a-z]/g, ''))) return lower;
          return lower.replace(/(^|[-/])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
        }).join('');
      }).join('\n');
    case 'sentence': {
      const lowered = text.toLowerCase();
      return lowered
        .replace(/(^\s*|[.!?]\s+|\n\s*)(\p{L})/gu, (_, gap: string, ch: string) => gap + ch.toUpperCase())
        .replace(/\bi\b/g, 'I');
    }
    case 'alternating':
    default: {
      let upper = false;
      return Array.from(text).map((ch) => {
        if (!/\p{L}/u.test(ch)) return ch;
        const out = upper ? ch.toUpperCase() : ch.toLowerCase();
        upper = !upper;
        return out;
      }).join('');
    }
  }
}

/* -------------------------------- counts ------------------------------- */

export interface TextCounts {
  words: number;
  characters: number;
  charactersNoSpaces: number;
  lines: number;
  paragraphs: number;
  sentences: number;
  readingMinutes: number;
}

export function countText(text: string): TextCounts {
  const chars = Array.from(text);
  const words = text.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu) ?? [];
  return {
    words: words.length,
    characters: chars.length,
    charactersNoSpaces: chars.filter((c) => !/\s/.test(c)).length,
    lines: text === '' ? 0 : lines(text).length,
    paragraphs: text.trim() === '' ? 0 : text.replace(/\r\n?/g, '\n').split(/\n\s*\n/).filter((p) => p.trim()).length,
    sentences: (text.match(/[^.!?\s][^.!?]*(?:[.!?]+|$)/g) ?? []).filter((s) => /[\p{L}\p{N}]/u.test(s)).length,
    readingMinutes: words.length / 238,
  };
}

/* ------------------------------ duplicates ----------------------------- */

export interface DedupeOptions { keep: 'first' | 'last'; sort: boolean; ignoreCase: boolean; ignoreEmpty: boolean }

export function dedupeLines(text: string, o: DedupeOptions): { text: string; removed: number } {
  const all = lines(text);
  const key = (line: string) => (o.ignoreCase ? line.trim().toLowerCase() : line.trim());
  const order = o.keep === 'first' ? all : all.slice().reverse();
  const seen = new Set<string>();
  let kept: string[] = [];
  for (const line of order) {
    if (!line.trim()) { if (!o.ignoreEmpty) kept.push(line); continue; }
    if (seen.has(key(line))) continue;
    seen.add(key(line));
    kept.push(line);
  }
  if (o.keep === 'last') kept.reverse();
  if (o.sort) kept = kept.slice().sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  const removed = all.filter((l) => l.trim()).length - kept.filter((l) => l.trim()).length;
  return { text: kept.join('\n'), removed };
}

/* ---------------------------- find & replace --------------------------- */

export interface FindOptions { caseSensitive: boolean; wholeWord: boolean; all: boolean }

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function findPattern(find: string, o: Pick<FindOptions, 'caseSensitive' | 'wholeWord'>, global = true): RegExp | null {
  if (!find) return null;
  const body = o.wholeWord ? `(?<![\\p{L}\\p{N}_])${escapeRegExp(find)}(?![\\p{L}\\p{N}_])` : escapeRegExp(find);
  return new RegExp(body, `${global ? 'g' : ''}${o.caseSensitive ? '' : 'i'}u`);
}

/** The replacement is taken literally: "$1" stays "$1". */
export function findReplace(text: string, find: string, replace: string, o: FindOptions): { text: string; count: number } {
  const pattern = findPattern(find, o, true);
  if (!pattern) return { text, count: 0 };
  const count = (text.match(pattern) ?? []).length;
  if (!count) return { text, count: 0 };
  const once = findPattern(find, o, o.all)!;
  return { text: text.replace(once, () => replace), count: o.all ? count : 1 };
}

/* ------------------------------- extractor ----------------------------- */

const unique = <T,>(list: T[]) => [...new Set(list)];

export function extract(text: string): { urls: string[]; emails: string[]; phones: string[] } {
  const emails = unique((text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g) ?? []).map((e) => e.replace(/\.$/, '')));
  const urls = unique((text.match(/\b(?:https?:\/\/|www\.)[^\s<>"'`]+/gi) ?? [])
    .map((u) => u.replace(/[.,;:!?)\]}>'"]+$/, ''))
    .filter((u) => !emails.some((e) => u.includes(e))));
  const withoutOthers = [...urls, ...emails].reduce((t, found) => t.split(found).join(' '), text);
  const phones = unique((withoutOthers.match(/(?:\+\d{1,3}[\s.-]?)?(?:\(\d{1,5}\)[\s.-]?)?\d[\d\s.-]{5,}\d/g) ?? [])
    .map((p) => p.trim())
    .filter((p) => {
      const digits = p.replace(/\D/g, '');
      // Dates and plain numbers are not phone numbers.
      return digits.length >= 7 && digits.length <= 15 && !/^\d{1,4}[./-]\d{1,2}[./-]\d{1,4}$/.test(p);
    }));
  return { urls, emails, phones };
}

/* --------------------------------- sort -------------------------------- */

export type SortMode = 'az' | 'za' | 'length' | 'numeric' | 'random';

export function sortLines(text: string, mode: SortMode, o: { dedupe: boolean; random?: () => number }): string {
  let list = lines(text).filter((l) => l.trim() !== '');
  if (o.dedupe) list = unique(list);
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  switch (mode) {
    case 'az': list.sort(collator.compare); break;
    case 'za': list.sort((a, b) => collator.compare(b, a)); break;
    case 'length': list.sort((a, b) => Array.from(a).length - Array.from(b).length || collator.compare(a, b)); break;
    case 'numeric': {
      const num = (s: string) => { const m = /-?\d+(?:[.,]\d+)?/.exec(s.replace(/,(?=\d{3}\b)/g, '')); return m ? Number(m[0].replace(',', '.')) : Number.POSITIVE_INFINITY; };
      list.sort((a, b) => num(a) - num(b) || collator.compare(a, b));
      break;
    }
    case 'random': {
      const random = o.random ?? Math.random;
      for (let i = list.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
    }
  }
  return list.join('\n');
}
