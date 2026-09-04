/**
 * OKLab / OKLCH — Björn Ottosson's perceptual space.
 *
 * This is the whole reason the fixes in this tool preserve a brand. Nudging
 * lightness in HSL drags hue and saturation with it (HSL's "lightness" is a
 * crude average, not a perceptual one), so a "slightly darker blue" comes back
 * purple. OKLab is built so that moving L alone is perceptually a lightness
 * move and nothing else.
 *
 * Matrices are Ottosson's published values, applied to *linear* sRGB.
 */

import { fromLinearRGB, toLinearRGB, type RGB } from './srgb';

export interface Oklab {
  L: number; // 0..1
  a: number;
  b: number;
}

export interface Oklch {
  L: number; // 0..1
  C: number; // 0..~0.4 for sRGB
  h: number; // degrees, 0..360
}

export function linearToOklab({ r, g, b }: RGB): Oklab {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  // Cube roots must keep the sign: linear values can go negative for colours
  // outside the sRGB gamut, and Math.cbrt handles that where ** (1/3) returns NaN.
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  };
}

export function oklabToLinear({ L, a, b }: Oklab): RGB {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  return {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  };
}

export const rgbToOklab = (rgb: RGB): Oklab => linearToOklab(toLinearRGB(rgb));

/** May return channels outside 0..1 — callers must gamut-map before display. */
export const oklabToRgb = (lab: Oklab): RGB => fromLinearRGB(oklabToLinear(lab));

export function oklabToOklch({ L, a, b }: Oklab): Oklch {
  const C = Math.sqrt(a * a + b * b);
  // Hue is meaningless for a neutral; report 0 rather than atan2's noise so
  // "hue preserved" checks on greys do not fail spuriously.
  const h = C < 1e-7 ? 0 : ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  return { L, C, h };
}

export function oklchToOklab({ L, C, h }: Oklch): Oklab {
  const rad = (h * Math.PI) / 180;
  return { L, a: C * Math.cos(rad), b: C * Math.sin(rad) };
}

export const rgbToOklch = (rgb: RGB): Oklch => oklabToOklch(rgbToOklab(rgb));
export const oklchToRgb = (lch: Oklch): RGB => oklabToRgb(oklchToOklab(lch));

/** Euclidean distance in OKLab — the space is built for exactly this. */
export function deltaEOK(a: Oklab, b: Oklab): number {
  const dL = a.L - b.L;
  const da = a.a - b.a;
  const db = a.b - b.b;
  return Math.sqrt(dL * dL + da * da + db * db);
}

/**
 * Smallest angle between two hues, in degrees (0..180).
 *
 * The +540 shifts the difference into a positive range before the modulo, so
 * this works for negative differences without a branch; subtracting 180 and
 * taking the magnitude then folds the far side of the wheel back.
 */
export function hueDistance(h1: number, h2: number): number {
  return Math.abs((((h1 - h2 + 540) % 360) + 360) % 360 - 180);
}
