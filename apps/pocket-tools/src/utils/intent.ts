/**
 * Understanding "I need to split ₹4,500 between 5 people".
 *
 * No AI, and none needed: two passes over the words.
 *
 * Keywords score every tool — a whole phrase matched counts for more than a
 * lone word, a word that starts a keyword counts a little. Then pattern readers
 * look for the shapes of specific requests: an amount and a head count, a
 * percentage of something, a quantity and a unit to convert to, a date. A
 * reader that recognises its shape lifts its tool to the top, fills the tool's
 * fields through the link, and where the answer is simple enough, gives it
 * right there in the search results.
 */

import { TOOLS, type ToolInfo } from '../data/tools';
import { money, parseAmount, parseSize, bytes, round, significant, number, type Currency } from './format';
import { parseConversion, findUnit, convert } from './units';
import { percentOf, whatPercent, percentChange, splitBill, gst as gstCalc, discount as discountCalc } from './money';
import { aspectRatio } from './design';
import { parseDate, todayYmd, toIso, type Ymd } from './dates';

export interface Match {
  tool: ToolInfo;
  score: number;
  /** Fields to fill in, passed as the tool page's query string. */
  params?: Record<string, string>;
  /** A worked answer, when the question has one. */
  answer?: string;
}

const AMOUNT = String.raw`(?:[₹$€£]\s?|rs\.?\s?)?\d[\d,]*(?:\.\d+)?(?:\s?(?:k|lakh|lakhs|lac|cr|crore|m|million))?\b`;

function currencyIn(text: string): Currency {
  if (text.includes('$')) return 'USD';
  if (text.includes('€')) return 'EUR';
  if (text.includes('£')) return 'GBP';
  return 'INR';
}

const words = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}%₹$€£.:/]+/gu, ' ').split(' ').filter(Boolean);

function keywordScore(tool: ToolInfo, query: string, tokens: string[]): number {
  let score = 0;
  const q = ` ${query.toLowerCase().replace(/\s+/g, ' ')} `;
  for (const keyword of tool.keywords) {
    const k = keyword.toLowerCase();
    if (k.includes(' ')) {
      if (q.includes(` ${k} `) || q.includes(` ${k}`)) score += 2 + k.split(' ').length * 2;
    } else if (tokens.includes(k)) {
      score += 3;
    } else if (k.length >= 4 && tokens.some((w) => w.length >= 3 && (k.startsWith(w) || w.startsWith(k)))) {
      score += 1.5;
    }
  }
  const name = tool.name.toLowerCase();
  if (q.includes(` ${name} `) || q.trim() === name) score += 8;
  else if (tokens.length && tokens.every((w) => name.includes(w))) score += 5;
  else if (tokens.some((w) => w.length >= 3 && name.split(/\s+/).some((n) => n.startsWith(w)))) score += 2;
  return score;
}

type Params = Record<string, string | undefined>;
type Reader = (q: string, today: Ymd) => { tool: string; boost: number; params?: Params; answer?: string } | null;

const clean = (p?: Params): Record<string, string> | undefined => (p ? Object.fromEntries(Object.entries(p).filter((e): e is [string, string] => e[1] !== undefined)) : undefined);

const READERS: Reader[] = [
  // "split ₹4,500 between 5 people", "divide 1200 among 3"
  (q) => {
    const m = new RegExp(String.raw`(?:split|divide|share)\b.*?(${AMOUNT}).*?(?:between|among|by|into|with|for)\s+(\d+)\b`, 'i').exec(q)
      ?? new RegExp(String.raw`(${AMOUNT}).*?(?:between|among)\s+(\d+)\s*(?:people|persons|friends|of us)`, 'i').exec(q);
    if (!m) return null;
    const bill = parseAmount(m[1]);
    const people = Number(m[2]);
    if (bill === null || !(people > 0)) return null;
    const tipMatch = /(\d+(?:\.\d+)?)\s*%\s*tip/i.exec(q);
    const tipPct = tipMatch ? Number(tipMatch[1]) : 0;
    const cur = currencyIn(q);
    const each = splitBill(bill, people, tipPct).each;
    return { tool: 'split-bill', boost: 30, params: { bill: String(bill), people: String(people), ...(tipPct ? { tip: String(tipPct) } : {}), currency: cur }, answer: `${money(each, cur)} each` };
  },
  // "18% of ₹2,500"
  (q) => {
    const m = new RegExp(String.raw`(\d+(?:\.\d+)?)\s*%\s*(?:of)\s*(${AMOUNT})`, 'i').exec(q);
    if (!m || /\b(off|discount|gst|tip)\b/i.test(q)) return null;
    const pct = Number(m[1]);
    const of = parseAmount(m[2]);
    if (of === null) return null;
    const result = percentOf(pct, of);
    const hasMoney = /[₹$€£]|rs\.?/i.test(m[2]);
    const cur = currencyIn(q);
    return { tool: 'percentage', boost: 30, params: { mode: 'of', x: String(pct), y: String(of), ...(hasMoney ? { currency: cur } : {}) }, answer: hasMoney ? money(result, cur) : number(result, 4, 'en-US') };
  },
  // "30 is what percent of 120", "what percentage is 30 of 120"
  (q) => {
    const m = new RegExp(String.raw`(${AMOUNT})\s+is\s+what\s+(?:percent|percentage|%)\s+of\s+(${AMOUNT})`, 'i').exec(q)
      ?? new RegExp(String.raw`what\s+(?:percent|percentage|%)\s+(?:is|of)\s+(${AMOUNT})\s+(?:of|out of|from)\s+(${AMOUNT})`, 'i').exec(q);
    if (!m) return null;
    const x = parseAmount(m[1]);
    const y = parseAmount(m[2]);
    if (x === null || y === null) return null;
    const r = whatPercent(x, y);
    return { tool: 'percentage', boost: 30, params: { mode: 'what', x: String(x), y: String(y) }, answer: r === null ? undefined : `${number(r, 2, 'en-US')}%` };
  },
  // "percentage change from 80 to 100", "increase from 80 to 100"
  (q) => {
    const m = new RegExp(String.raw`(?:increase|decrease|change|growth|drop)\b.*?from\s+(${AMOUNT})\s+to\s+(${AMOUNT})`, 'i').exec(q);
    if (!m) return null;
    const a = parseAmount(m[1]);
    const b = parseAmount(m[2]);
    if (a === null || b === null) return null;
    const r = percentChange(a, b);
    return { tool: 'percentage', boost: 26, params: { mode: 'change', x: String(a), y: String(b) }, answer: r === null ? undefined : `${r >= 0 ? '+' : ''}${number(r, 2, 'en-US')}%` };
  },
  // "20% off 2500", "2500 with 15% discount"
  (q) => {
    const m = new RegExp(String.raw`(\d+(?:\.\d+)?)\s*%\s*(?:off|discount)\s*(?:on|of|from)?\s*(${AMOUNT})?`, 'i').exec(q);
    const n = new RegExp(String.raw`(${AMOUNT})\s*(?:with|at|after)\s*(\d+(?:\.\d+)?)\s*%\s*(?:off|discount)`, 'i').exec(q);
    const pct = m ? Number(m[1]) : n ? Number(n[2]) : null;
    const price = m?.[2] ? parseAmount(m[2]) : n ? parseAmount(n[1]) : null;
    if (pct === null) return null;
    const cur = currencyIn(q);
    return { tool: 'discount', boost: 24, params: { ...(price !== null ? { price: String(price) } : {}), off: String(pct), currency: cur }, answer: price !== null ? `${money(discountCalc(price, pct).final, cur)} after discount` : undefined };
  },
  // "18% gst on 1000", "remove gst from 1180"
  (q) => {
    if (!/\bgst\b/i.test(q)) return null;
    const rate = /(\d+(?:\.\d+)?)\s*%/.exec(q);
    const amount = new RegExp(String.raw`(?:on|from|of|for|price|amount)\s+(${AMOUNT})|(${AMOUNT})\s*(?:\+|with|plus|including|inclusive|excluding|incl)`, 'i').exec(q);
    const value = amount ? parseAmount(amount[1] ?? amount[2]) : null;
    const mode = /\b(remove|inclusive|including|incl|reverse|without|exclude|extract)\b/i.test(q) ? 'remove' : 'add';
    const params: Record<string, string> = { mode };
    if (rate) params.rate = rate[1];
    if (value !== null) params.amount = String(value);
    const r = value !== null && rate ? gstCalc(value, Number(rate[1]), mode) : null;
    return { tool: 'gst', boost: 20, params, answer: r ? (mode === 'add' ? `${money(r.total, 'INR')} with GST` : `${money(r.base, 'INR')} before GST`) : undefined };
  },
  // "15% tip on 1200"
  (q) => {
    if (!/\btip\b/i.test(q) || /split/i.test(q)) return null;
    const pct = /(\d+(?:\.\d+)?)\s*%/.exec(q);
    const bill = new RegExp(String.raw`(?:on|for|of)\s+(${AMOUNT})`, 'i').exec(q);
    const params: Record<string, string> = {};
    if (pct) params.percent = pct[1];
    if (bill) { const v = parseAmount(bill[1]); if (v !== null) params.bill = String(v); }
    return { tool: 'tip', boost: 16, params };
  },
  // "emi for 20 lakh at 8.5% for 20 years"
  (q) => {
    if (!/\b(emi|loan|mortgage)\b/i.test(q)) return null;
    const principal = new RegExp(String.raw`(?:for|of|loan)\s+(${AMOUNT})`, 'i').exec(q);
    const rate = /(\d+(?:\.\d+)?)\s*%/.exec(q);
    const tenure = /(\d+)\s*(years?|yrs?|months?|mos?)\b/i.exec(q);
    const params: Record<string, string> = {};
    if (principal) { const v = parseAmount(principal[1]); if (v !== null) params.amount = String(v); }
    if (rate) params.rate = rate[1];
    if (tenure) params.months = String(/^y/i.test(tenure[2]) ? Number(tenure[1]) * 12 : Number(tenure[1]));
    return { tool: 'emi', boost: 16, params };
  },
  // "5 feet 10 inches in cm", "100 f to c", "2 gb in mb"
  (q) => {
    const text = q.replace(/^(?:convert|what is|what's|how much is|how many)\s+/i, '').replace(/\?$/, '');
    const c = parseConversion(text);
    if (!c) return null;
    const answer = `${significant(c.result, 6)} ${c.to.symbol}`;
    if (c.quantity.category === 'data') {
      return { tool: 'data-size', boost: 28, params: { value: String(round(c.quantity.value, 6)), from: c.quantity.unit.id, to: c.to.id }, answer };
    }
    return { tool: 'unit-converter', boost: 28, params: { q: text, to: c.to.id, category: c.quantity.category }, answer };
  },
  // PDFs: the verb decides which tool.
  (q) => {
    if (!/\bpdfs?\b/i.test(q)) return null;
    const rules: [RegExp, string][] = [
      [/\b(?:jpe?g|png|image|images|photo|photos|picture|scan)s?\s+(?:to|into|as)\s+(?:a\s+)?pdf\b|\bscan\b/i, 'jpg-to-pdf'],
      [/\bpdf\s+(?:to|into|as)\s+(?:a\s+)?(?:jpe?g|png|images?|pictures?|photos?)\b/i, 'pdf-to-jpg'],
      [/\b(?:to|into|as)\s+(?:plain\s+)?te?xt\b|\bextract\s+(?:the\s+)?text\b|\bcopy\s+(?:the\s+)?text\b/i, 'pdf-to-text'],
      [/\b(?:unlock|decrypt|unprotect|remove\s+(?:the\s+)?password|without\s+(?:a\s+)?password)\b/i, 'unlock-pdf'],
      [/\b(?:protect|encrypt|lock|password)\b/i, 'protect-pdf'],
      [/\b(?:compress|reduce|smaller|shrink|optimi[sz]e|too\s+big|under|below|less\s+than)\b/i, 'compress-pdf'],
      [/\b(?:merge|combine|join|append)\b/i, 'merge-pdf'],
      [/\b(?:extract|pull\s+out|save)\s+(?:some\s+|the\s+)?pages?\b/i, 'extract-pages'],
      [/\b(?:remove|delete|drop)\s+(?:some\s+|the\s+)?(?:blank\s+)?pages?\b/i, 'remove-pages'],
      [/\b(?:split|separate|break)\b/i, 'split-pdf'],
      [/\b(?:reorder|rearrange|organi[sz]e|move\s+pages|page\s+order)\b/i, 'organize-pdf'],
      [/\b(?:rotate|turn|sideways|upside)\b/i, 'rotate-pdf'],
      [/\bpage\s+numbers?\b|\bnumber\s+(?:the\s+)?pages\b/i, 'page-numbers'],
      [/\bwatermark|\bstamp\b/i, 'watermark-pdf'],
      [/\bsign|\bsignature\b/i, 'sign-pdf'],
      [/\bcrop|\btrim\b|\bmargins?\b/i, 'crop-pdf'],
      [/\b(?:repair|fix|broken|corrupt|damaged|won'?t\s+open)\b/i, 'repair-pdf'],
    ];
    const hit = rules.find(([pattern]) => pattern.test(q));
    return hit ? { tool: hit[1], boost: 32 } : null;
  },
  // "compress this photo below 1mb", "image under 500kb"
  (q) => {
    if (/\bpdfs?\b/i.test(q)) return null;
    const target = parseSize(q);
    const imagey = /\b(image|photo|picture|pic|jpg|jpeg|png|webp|selfie|scan)s?\b/i.test(q);
    const shrinky = /\b(compress|reduce|smaller|shrink|less than|under|below|within|lower|max|maximum|limit)\b/i.test(q);
    if (!(imagey && (shrinky || target)) && !(target && shrinky)) return null;
    return { tool: 'image-compressor', boost: target ? 26 : 16, params: target ? { target: String(target) } : {} };
  },
  // "1920 x 1080 aspect ratio"
  (q) => {
    const m = /\b(\d{2,5})\s*[x×*]\s*(\d{2,5})\b/i.exec(q);
    if (!m) return null;
    const r = aspectRatio(Number(m[1]), Number(m[2]));
    const resize = /\b(resize|image|photo)\b/i.test(q) && !/ratio/i.test(q);
    if (resize) return { tool: 'image-resizer', boost: 14, params: { w: m[1], h: m[2] } };
    return { tool: 'aspect-ratio', boost: /ratio|aspect/i.test(q) ? 28 : 10, params: { w: m[1], h: m[2] }, answer: r ? `${r.w}:${r.h}` : undefined };
  },
  // "random number between 1 and 100"
  (q) => {
    const m = /\brandom\b.*?\b(?:between|from)\s+(-?\d+)\s+(?:and|to|-)\s+(-?\d+)/i.exec(q);
    if (!m) return null;
    return { tool: 'random-number', boost: 28, params: { min: m[1], max: m[2] } };
  },
  // "qr code for https://…"
  (q) => {
    if (!/\bqr\b/i.test(q)) return null;
    const url = /\b(?:https?:\/\/|www\.)\S+/i.exec(q);
    return { tool: 'qr-code', boost: 20, params: url ? { text: url[0] } : {} };
  },
  // "16 character password"
  (q) => {
    if (!/\bpass(?:word|phrase|code)\b/i.test(q) || /\bpdfs?\b/i.test(q)) return null;
    const m = /\b(\d{1,3})\s*(?:-\s*)?(?:char(?:acter)?s?|letters?|digits?|long)\b/i.exec(q);
    return { tool: 'password', boost: 18, params: m ? { length: m[1] } : {} };
  },
  // "how old am i if born 12 march 1994"
  (q, today) => {
    if (!/\b(how old|age|born|birthday|dob)\b/i.test(q)) return null;
    const m = /\b(?:born(?: on)?|dob|birthday|from)\s*:?\s*(.+?)\??$/i.exec(q);
    const date = m ? parseDate(m[1], today) : null;
    return { tool: 'age', boost: date ? 26 : 12, params: date ? { dob: toIso(date) } : {} };
  },
];

/** The tools that fit, best first. Empty query, empty list. */
export function understand(query: string, today: Ymd = todayYmd(), limit = 8): Match[] {
  const q = query.trim();
  if (!q) return [];
  const tokens = words(q);
  const scored = new Map<string, Match>();
  for (const tool of TOOLS) {
    const score = keywordScore(tool, q, tokens);
    if (score > 0) scored.set(tool.id, { tool, score });
  }
  for (const read of READERS) {
    let hit: ReturnType<Reader> = null;
    try { hit = read(q, today); } catch { hit = null; }
    if (!hit) continue;
    const tool = TOOLS.find((t) => t.id === hit!.tool);
    if (!tool) continue;
    const existing = scored.get(tool.id);
    const better = !existing || !existing.params || hit.boost >= 20;
    scored.set(tool.id, {
      tool,
      score: (existing?.score ?? 0) + hit.boost,
      params: better ? clean(hit.params) ?? existing?.params : existing?.params,
      answer: better ? hit.answer ?? existing?.answer : existing?.answer,
    });
  }
  return [...scored.values()]
    .filter((m) => m.score >= 1.5)
    .sort((a, b) => b.score - a.score || a.tool.name.localeCompare(b.tool.name))
    .slice(0, limit);
}

/** Terms from the query worth highlighting in a result. */
export function highlightTerms(query: string): string[] {
  return words(query).filter((w) => w.length >= 2 && !/^\d+$/.test(w) && !STOP.has(w));
}
const STOP = new Set(['i', 'a', 'an', 'the', 'to', 'of', 'and', 'or', 'my', 'me', 'for', 'is', 'in', 'on', 'this', 'that', 'it', 'need', 'want', 'how', 'do', 'can', 'what', 'make']);

export { findUnit, convert, bytes };
