/**
 * Everything the single-file page needs, in one import.
 *
 * `scripts/build-artifact.ts` bundles this into a browser global, so the page
 * that runs inside claude.ai is built from exactly the code the test suite
 * checks. Nothing in the engine is rewritten for the page, which is the whole
 * point: two copies of a parser drift, and the drift shows up as a wrong total.
 */

export { build, buildFromParsed, safeParse, gmailQuery } from './ledger/build';
export { parseMessage, PARSER_VERSION } from './parse/parse';
export { summariseMonth, pace, coverage, months } from './insight/summary';
export { ask, EXAMPLES } from './query/ask';
export { formatPaise } from './parse/money';
export { merchantKey } from './parse/extract';
export { CATEGORIES } from './insight/categories';
export { REVIEW_BELOW } from './ledger/types';
export {
  dayGap,
  daysInMonth,
  formatDay,
  formatDayLong,
  formatMonth,
  formatTime,
  istDayKey,
  istMonthKey,
  istParts,
} from './ledger/time';
