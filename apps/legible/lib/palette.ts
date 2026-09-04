/**
 * Palette state and the pair matrix.
 *
 * Roles matter more than they look. A twelve-colour system is 144 ordered pairs,
 * and most of them are meaningless — nobody sets body text in the critical red
 * on the warning amber. Letting a swatch declare itself text-only or
 * surface-only cuts the grid to the pairs a team would actually ship, which is
 * the difference between a report someone reads and one they close.
 */

import { apcaLc, apcaVerdict, disagreesWithWcag, type ApcaVerdict } from './color/apca';
import { contrastRatio, parseHex, type RGB } from './color/srgb';
import { grade, TIERS, type Grade, type TierId } from './color/wcag';
import { inferRole } from './parse';

export type Role = 'both' | 'text' | 'surface';

export interface Swatch {
  id: string;
  name: string;
  hex: string;
  role: Role;
}

export interface Pair {
  fg: Swatch;
  bg: Swatch;
  ratio: number;
  grade: Grade;
  lc: number;
  apca: ApcaVerdict;
  /** WCAG and APCA reach different conclusions about body text. */
  contested: boolean;
}

export const MAX_SWATCHES = 16;

let counter = 0;
export const makeSwatch = (name: string, hex: string, role?: Role): Swatch => ({
  id: `s${(counter += 1)}`,
  name,
  hex,
  role: role ?? inferRole(name),
});

export const canBeText = (s: Swatch) => s.role !== 'surface';
export const canBeSurface = (s: Swatch) => s.role !== 'text';

export function buildPair(fg: Swatch, bg: Swatch): Pair {
  const a = parseHex(fg.hex) as RGB;
  const b = parseHex(bg.hex) as RGB;
  const ratio = contrastRatio(a, b);
  const lc = apcaLc(a, b);
  return {
    fg,
    bg,
    ratio,
    grade: grade(ratio),
    lc,
    apca: apcaVerdict(lc),
    contested: disagreesWithWcag(lc, ratio),
  };
}

/** Every ordered pair worth grading. The diagonal is skipped — it is always 1:1. */
export function buildMatrix(swatches: Swatch[]): Pair[][] {
  const rows = swatches.filter(canBeText);
  const cols = swatches.filter(canBeSurface);
  return rows.map((fg) => cols.map((bg) => buildPair(fg, bg)));
}

export interface Summary {
  total: number;
  passing: number;
  failing: number;
  contested: number;
}

export function summarise(matrix: Pair[][], tier: TierId): Summary {
  let total = 0;
  let passing = 0;
  let contested = 0;
  for (const row of matrix) {
    for (const pair of row) {
      if (pair.fg.id === pair.bg.id) continue;
      total += 1;
      if (pair.grade.results[tier]) passing += 1;
      if (pair.contested) contested += 1;
    }
  }
  return { total, passing, failing: total - passing, contested };
}

/**
 * The backgrounds a swatch is actually *required* to work on.
 *
 * The matrix grades every combination, but a fix cannot be constrained by every
 * combination — requiring `text-muted` to stay legible on the critical red as
 * well as on white leaves no lightness that satisfies both, and the result is a
 * tool that reports conflicts everywhere and fixes nothing.
 *
 * So only a colour explicitly declared a *surface* creates an obligation.
 * Anything left as "both" is still graded in the grid, and still tells you what
 * the pairing costs, but it does not veto a fix. Where a palette declares no
 * surfaces at all we fall back to every surface-capable colour, since otherwise
 * there would be nothing to solve against.
 */
export function requirementsFor(
  swatch: Swatch,
  swatches: Swatch[],
  tier: TierId,
): Array<{ againstHex: string; againstName: string; target: number }> {
  if (!canBeText(swatch)) return [];
  const declared = swatches.filter((s) => s.role === 'surface');
  const grounds = declared.length > 0 ? declared : swatches.filter(canBeSurface);
  return grounds
    .filter((s) => s.id !== swatch.id)
    .map((s) => ({
      againstHex: s.hex,
      againstName: s.name,
      target: TIERS[tier].ratio,
    }));
}

/* ------------------------------- exports ------------------------------- */

export function toCssVariables(swatches: Swatch[]): string {
  const body = swatches
    .map((s) => `  --${slug(s.name)}: ${s.hex};`)
    .join('\n');
  return `:root {\n${body}\n}`;
}

export function toJson(swatches: Swatch[]): string {
  const obj: Record<string, string> = {};
  for (const s of swatches) obj[slug(s.name)] = s.hex;
  return JSON.stringify(obj, null, 2);
}

export function toTailwind(swatches: Swatch[]): string {
  const body = swatches.map((s) => `      '${slug(s.name)}': '${s.hex}',`).join('\n');
  return `// tailwind.config\ntheme: {\n  extend: {\n    colors: {\n${body}\n    },\n  },\n}`;
}

const slug = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/^#/, 'color-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'color';
