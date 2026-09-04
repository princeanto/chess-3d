/**
 * The nudge: move a colour to the nearest passing value in OKLCH, holding hue.
 *
 * The naive implementation binary-searches lightness and assumes contrast rises
 * monotonically as you move. It does not. Contrast against a fixed background
 * falls as the foreground approaches that background's luminance and rises
 * again past it, so there are two passing regions with a dead zone between
 * them, and a binary search that straddles the dead zone converges on nonsense.
 *
 * So we work with *passing intervals* instead: scan lightness coarsely, refine
 * each crossing, and get back the exact set of lightnesses that satisfy the
 * target. Everything else falls out of that — the nearest fix is the closest
 * point in the set, and fixing a whole palette is the intersection of the sets.
 */

import { gamutMap } from './gamut';
import {
  deltaEOK,
  hueDistance,
  oklchToOklab,
  rgbToOklab,
  rgbToOklch,
  type Oklch,
} from './oklab';
import { contrastRatio, parseHex, toHex, type RGB } from './srgb';

export type Interval = [number, number];

const SCAN_STEPS = 160;
const REFINE_STEPS = 22;

/** Contrast of this colour, at lightness L, against a fixed background. */
function ratioAt(base: Oklch, L: number, bg: RGB): number {
  return contrastRatio(gamutMap({ L, C: base.C, h: base.h }).rgb, bg);
}

/**
 * Every lightness in [0,1] where `base` (at its own hue and chroma) reaches the
 * target ratio against `bg`. Usually one or two intervals; empty when even black
 * and white both fail, which happens against mid-greys.
 */
export function passingIntervals(base: Oklch, bg: RGB, target: number): Interval[] {
  const hits: boolean[] = [];
  for (let i = 0; i <= SCAN_STEPS; i += 1) {
    hits.push(ratioAt(base, i / SCAN_STEPS, bg) >= target);
  }

  /** Binary-search the exact crossing between a failing and a passing sample. */
  const boundary = (failIdx: number, passIdx: number): number => {
    let fail = failIdx / SCAN_STEPS;
    let pass = passIdx / SCAN_STEPS;
    for (let i = 0; i < REFINE_STEPS; i += 1) {
      const mid = (fail + pass) / 2;
      if (ratioAt(base, mid, bg) >= target) pass = mid;
      else fail = mid;
    }
    return pass;
  };

  const intervals: Interval[] = [];
  let start: number | null = null;

  for (let i = 0; i <= SCAN_STEPS; i += 1) {
    if (hits[i] && start === null) {
      start = i === 0 ? 0 : boundary(i - 1, i);
    } else if (!hits[i] && start !== null) {
      intervals.push([start, boundary(i, i - 1)]);
      start = null;
    }
  }
  if (start !== null) intervals.push([start, 1]);

  return intervals;
}

/** Closest point to `x` inside a set of intervals, or null if the set is empty. */
export function nearestInIntervals(intervals: Interval[], x: number): number | null {
  let best: number | null = null;
  let bestDist = Infinity;
  for (const [lo, hi] of intervals) {
    const p = x < lo ? lo : x > hi ? hi : x;
    const d = Math.abs(p - x);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  return best;
}

export function intersectIntervals(a: Interval[], b: Interval[]): Interval[] {
  const out: Interval[] = [];
  for (const [aLo, aHi] of a) {
    for (const [bLo, bHi] of b) {
      const lo = Math.max(aLo, bLo);
      const hi = Math.min(aHi, bHi);
      if (hi - lo > 1e-4) out.push([lo, hi]);
    }
  }
  return out;
}

export interface Fix {
  hex: string;
  ratio: number;
  /** Signed: positive means the colour was lightened. */
  deltaL: number;
  /** Chroma surrendered to the sRGB gamut, if any. */
  deltaC: number;
  /** Perceptual distance travelled, in OKLab units. */
  deltaE: number;
  /** Should be ~0; reported so the promise can be checked rather than trusted. */
  hueShift: number;
}

/**
 * Nearest passing value for one pair. Returns null when no lightness works —
 * against a mid-grey background, a hue can be genuinely unable to reach 4.5:1
 * at any lightness, and saying so is more useful than returning a near-miss.
 */
export function nudge(fgHex: string, bgHex: string, target: number): Fix | null {
  const fg = parseHex(fgHex);
  const bg = parseHex(bgHex);
  if (!fg || !bg) return null;

  const base = rgbToOklch(fg);
  const intervals = passingIntervals(base, bg, target);
  const L = nearestInIntervals(intervals, base.L);
  if (L === null) return null;

  return describeFix(base, L, bg, fg);
}

function describeFix(base: Oklch, L: number, bg: RGB, originalRgb: RGB): Fix {
  const mapped = gamutMap({ L, C: base.C, h: base.h });
  const after = rgbToOklch(mapped.rgb);
  return {
    hex: mapped.hex,
    ratio: contrastRatio(mapped.rgb, bg),
    deltaL: L - base.L,
    deltaC: mapped.chromaLost,
    deltaE: deltaEOK(rgbToOklab(originalRgb), oklchToOklab({ L, C: mapped.chroma, h: base.h })),
    hueShift: hueDistance(base.h, after.h),
  };
}

/* ------------------------------------------------------------------ *
 * Palette-wide resolution
 * ------------------------------------------------------------------ */

export interface PairRequirement {
  /** Hex of the counterpart this swatch is used against. */
  againstHex: string;
  againstName: string;
  target: number;
}

export type Resolution =
  | { status: 'ok'; fix: Fix }
  | { status: 'unchanged' }
  | { status: 'conflict'; blockedBy: string[]; suggestion: string };

/**
 * One swatch, all of its pairings at once.
 *
 * A token used on several backgrounds has to satisfy all of them simultaneously,
 * and that is an intersection, not an average. When the intersection is empty the
 * honest answer is that the token is being asked to do two incompatible jobs —
 * so we name the pairings that clash and suggest splitting it, which is what a
 * design-systems owner would actually do.
 */
export function resolveSwatch(
  hex: string,
  requirements: PairRequirement[],
): Resolution {
  const rgb = parseHex(hex);
  if (!rgb || requirements.length === 0) return { status: 'unchanged' };

  const base = rgbToOklch(rgb);

  const failing: PairRequirement[] = [];
  const alreadyPassing: PairRequirement[] = [];
  for (const req of requirements) {
    const against = parseHex(req.againstHex);
    if (!against) continue;
    (contrastRatio(rgb, against) < req.target ? failing : alreadyPassing).push(req);
  }
  if (failing.length === 0) return { status: 'unchanged' };

  // Constrain on the pairings that are actually broken, not on every pairing in
  // the palette. Demanding that one colour work against all of the others at
  // once is unsatisfiable for any real system — a text colour is not expected to
  // be legible on every surface, only on the ones it is used with — and an
  // unsatisfiable constraint set yields no fixes at all rather than useful ones.
  let allowed: Interval[] = [[0, 1]];
  const blocked: string[] = [];
  for (const req of failing) {
    const against = parseHex(req.againstHex);
    if (!against) continue;
    const next = intersectIntervals(allowed, passingIntervals(base, against, req.target));
    blocked.push(req.againstName);
    if (next.length === 0) {
      return {
        status: 'conflict',
        blockedBy: blocked,
        suggestion:
          blocked.length > 1
            ? `No single lightness works against ${blocked.join(' and ')} at once. Split this into two tokens.`
            : `No lightness of this hue reaches the target against ${blocked[0]}. That background has to move instead.`,
      };
    }
    allowed = next;
  }

  const L = nearestInIntervals(allowed, base.L);
  if (L === null) return { status: 'unchanged' };
  if (Math.abs(L - base.L) < 1e-4) return { status: 'unchanged' };

  // A fix that repairs one pairing while quietly breaking another is worse than
  // no fix, so regressions are reported rather than shipped.
  const candidate = gamutMap({ L, C: base.C, h: base.h });
  const regressed = alreadyPassing
    .filter((req) => {
      const against = parseHex(req.againstHex);
      return against ? contrastRatio(candidate.rgb, against) < req.target : false;
    })
    .map((req) => req.againstName);

  if (regressed.length > 0) {
    return {
      status: 'conflict',
      blockedBy: [...blocked, ...regressed],
      suggestion: `Fixing this against ${blocked.join(' and ')} would break it against ${regressed.join(' and ')}. Split this into two tokens.`,
    };
  }

  // Report the fix against the pairing that was hardest to satisfy.
  const worst = failing.reduce((a, b) => (a.target >= b.target ? a : b));
  const against = parseHex(worst.againstHex) ?? rgb;
  return { status: 'ok', fix: describeFix(base, L, against, rgb) };
}

/** Convenience for the UI: the resulting hex, whatever the outcome. */
export const resolvedHex = (hex: string, resolution: Resolution): string =>
  resolution.status === 'ok' ? resolution.fix.hex : hex;

export { toHex };
