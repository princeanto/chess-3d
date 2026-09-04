/**
 * sRGB gamut mapping for OKLCH colours.
 *
 * Plenty of OKLCH triples have no sRGB equivalent — a vivid blue at L=0.9 simply
 * does not exist on a screen. The naive fix is to clamp each channel into 0..1,
 * but clamping moves the channels unequally and therefore shifts hue, which is
 * precisely the thing this tool promises not to do. Instead we hold L and h and
 * reduce chroma until the colour fits, which is the CSS Color 4 approach.
 */

import { oklchToRgb, rgbToOklch, type Oklch } from './oklab';
import { toHex, type RGB } from './srgb';

/**
 * Tolerance for "close enough to inside the gamut".
 *
 * This is deliberately tight. A looser epsilon lets a channel sit slightly
 * negative, and the subsequent clamp to zero then perturbs the channels
 * unequally — which shows up as hue drift. That is invisible for ordinary
 * colours but severe near black, where every channel is already tiny and a
 * 1e-5 nudge is a large relative change.
 */
const EPS = 1e-9;

export function inGamut({ r, g, b }: RGB): boolean {
  return (
    r >= -EPS && r <= 1 + EPS && g >= -EPS && g <= 1 + EPS && b >= -EPS && b <= 1 + EPS
  );
}

const clampChannels = ({ r, g, b }: RGB): RGB => ({
  r: Math.min(1, Math.max(0, r)),
  g: Math.min(1, Math.max(0, g)),
  b: Math.min(1, Math.max(0, b)),
});

export interface GamutResult {
  rgb: RGB;
  hex: string;
  /** Chroma actually used, after any reduction. */
  chroma: number;
  /** How much chroma the gamut cost us. */
  chromaLost: number;
}

/**
 * Maps an OKLCH colour into sRGB, holding lightness and hue exactly and giving
 * up only chroma. Binary search converges in ~20 steps to well below a
 * perceptible step.
 */
export function gamutMap(lch: Oklch): GamutResult {
  const L = Math.min(1, Math.max(0, lch.L));
  const target: Oklch = { L, C: lch.C, h: lch.h };

  const direct = oklchToRgb(target);
  if (inGamut(direct)) {
    const rgb = clampChannels(direct);
    return { rgb, hex: toHex(rgb), chroma: lch.C, chromaLost: 0 };
  }

  // L at 0 or 1 is black or white; no chroma survives there anyway.
  let lo = 0;
  let hi = lch.C;
  for (let i = 0; i < 24; i += 1) {
    const mid = (lo + hi) / 2;
    if (inGamut(oklchToRgb({ L, C: mid, h: lch.h }))) lo = mid;
    else hi = mid;
  }

  const rgb = clampChannels(oklchToRgb({ L, C: lo, h: lch.h }));
  return { rgb, hex: toHex(rgb), chroma: lo, chromaLost: lch.C - lo };
}

export const oklchToHex = (lch: Oklch): string => gamutMap(lch).hex;

/**
 * Largest chroma that still fits in sRGB at this lightness and hue — used by the
 * UI to show how much headroom a colour has before the gamut starts eating it.
 */
export function maxChroma(L: number, h: number): number {
  let lo = 0;
  let hi = 0.5;
  for (let i = 0; i < 24; i += 1) {
    const mid = (lo + hi) / 2;
    if (inGamut(oklchToRgb({ L, C: mid, h }))) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** Round-trips a hex through OKLCH; used to sanity-check the pipeline. */
export const normaliseHex = (hex: string, rgb: RGB): string =>
  oklchToHex(rgbToOklch(rgb)) || hex;
