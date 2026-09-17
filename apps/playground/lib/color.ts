/**
 * Colour, done in OKLCH.
 *
 * The usual way to make "harmonious" palettes is to rotate hue in HSL, and it
 * is why so many generated palettes look wrong: HSL lightness is arithmetic,
 * not perception. A yellow and a blue at the same HSL lightness look nothing
 * alike — the yellow glares and the blue goes to mud. OKLCH is built so that
 * equal steps look equal, which means a palette can be designed around a value
 * structure (something dark, something light, something in between) and the
 * hues can then be rotated without wrecking it.
 *
 * Conversion matrices are Björn Ottosson's, from the OKLab paper.
 */

import type { Rng } from './random';

export interface Oklch {
  /** Perceived lightness, 0 to 1. */
  l: number;
  /** Chroma. 0 is grey; screen colours rarely exceed about 0.37. */
  c: number;
  /** Hue in degrees. */
  h: number;
}

type Rgb = [number, number, number];

const clamp = (value: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, value));
const wrap = (degrees: number): number => ((degrees % 360) + 360) % 360;

/* ------------------------------- hex and sRGB ----------------------------- */

export function isHex(value: string): boolean {
  return /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}

export function hexToRgb(hex: string): Rgb {
  let digits = hex.trim().replace(/^#/, '');
  if (digits.length === 3) digits = digits.split('').map((d) => d + d).join('');
  const n = parseInt(digits, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Upper case, because a HEX code is something people read and compare. */
export function rgbToHex([r, g, b]: Rgb): string {
  const part = (v: number) => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`.toUpperCase();
}

const toLinear = (v: number): number => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const toGamma = (v: number): number => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.cbrt(v) ** (3 / 2.4) - 0.055);

/* ---------------------------------- OKLab --------------------------------- */

function linearToOklab([r, g, b]: Rgb): Rgb {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToLinear([L, a, b]: Rgb): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

export function hexToOklch(hex: string): Oklch {
  const [L, a, b] = linearToOklab(hexToRgb(hex).map(toLinear) as Rgb);
  const c = Math.hypot(a, b);
  return { l: L, c, h: c < 1e-4 ? 0 : wrap((Math.atan2(b, a) * 180) / Math.PI) };
}

function oklchToLinear({ l, c, h }: Oklch): Rgb {
  const rad = (h * Math.PI) / 180;
  return oklabToLinear([l, c * Math.cos(rad), c * Math.sin(rad)]);
}

const inGamut = ([r, g, b]: Rgb): boolean =>
  r >= -1e-4 && r <= 1.0001 && g >= -1e-4 && g <= 1.0001 && b >= -1e-4 && b <= 1.0001;

/**
 * An OKLCH colour a screen can actually show.
 *
 * Out-of-gamut colours are brought in by reducing chroma while keeping lightness
 * and hue, found by bisection. Clipping each channel instead would shift the
 * hue — an intended orange would come out a slightly different orange — and
 * the whole point of working in OKLCH is that hue relationships hold.
 */
export function oklchToHex(color: Oklch): string {
  const target = { l: clamp(color.l, 0, 1), c: Math.max(0, color.c), h: wrap(color.h) };
  let linear = oklchToLinear(target);
  if (!inGamut(linear)) {
    let lo = 0;
    let hi = target.c;
    for (let i = 0; i < 24; i += 1) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklchToLinear({ ...target, c: mid }))) lo = mid;
      else hi = mid;
    }
    linear = oklchToLinear({ ...target, c: lo });
  }
  return rgbToHex(linear.map((v) => toGamma(clamp(v, 0, 1))) as Rgb);
}

/* --------------------------------- contrast ------------------------------- */

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2 contrast ratio, 1 to 21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Of the candidates, the one that reads best on `background`. */
export function readableOn(background: string, candidates: readonly string[] = ['#111111', '#FFFFFF']): string {
  return candidates.reduce((best, candidate) =>
    contrast(background, candidate) > contrast(background, best) ? candidate : best,
  );
}

/** The most colourful entry, for the brand dot — never a near-white. */
export function mostChromatic(hexes: readonly string[]): string {
  return hexes.reduce((best, hex) => (hexToOklch(hex).c > hexToOklch(best).c ? hex : best), hexes[0] ?? '#111111');
}

export const hueDistance = (a: number, b: number): number => {
  const d = Math.abs(wrap(a) - wrap(b));
  return Math.min(d, 360 - d);
};

/* --------------------------------- palettes ------------------------------- */

export type Scheme = 'harmony' | 'analogous' | 'complementary' | 'triadic' | 'monochrome' | 'random';

export const SCHEMES: { id: Scheme; label: string }[] = [
  { id: 'harmony', label: 'Harmony' },
  { id: 'analogous', label: 'Analogous' },
  { id: 'complementary', label: 'Complementary' },
  { id: 'triadic', label: 'Triadic' },
  { id: 'monochrome', label: 'Monochrome' },
  { id: 'random', label: 'Random' },
];

export interface Swatch {
  hex: string;
  locked: boolean;
}

/*
 * Value plans: where the darks and lights sit across five swatches.
 *
 * This is most of what separates a palette that looks designed from one that
 * looks generated. Five mid-tones, however well their hues relate, read as a
 * swatch of paint chips; a palette needs something dark to anchor it, something
 * light to breathe, and steps in between.
 */
const VALUE_PLANS: number[][] = [
  [0.24, 0.44, 0.63, 0.8, 0.95],
  [0.96, 0.82, 0.64, 0.43, 0.22],
  [0.28, 0.93, 0.66, 0.5, 0.84],
  [0.9, 0.34, 0.72, 0.21, 0.96],
  [0.58, 0.25, 0.91, 0.7, 0.42],
  [0.94, 0.6, 0.2, 0.78, 0.46],
];

/** Chroma a lightness can carry: very dark and very light colours hold little. */
const chromaShape = (l: number): number => clamp(1 - ((l - 0.66) / 0.5) ** 2, 0.22, 1);

type Concrete = Exclude<Scheme, 'harmony'> | 'split';

/**
 * Hues for a scheme, most distinctive first.
 *
 * The order matters: the caller puts the first hues on the swatches that can
 * carry the most colour. An opposite hue that lands on a near-black or
 * near-white swatch comes out almost grey, and a "complementary" palette with
 * no visible opposite is not one.
 */
function huesFor(scheme: Concrete, anchor: number, size: number, rng: Rng): number[] {
  const jitter = (spread: number) => rng.range(-spread, spread);
  switch (scheme) {
    case 'analogous': {
      const offsets = rng.shuffle([-36, -18, 0, 18, 36]);
      return Array.from({ length: size }, (_, i) => anchor + offsets[i % offsets.length] + jitter(4));
    }
    case 'complementary':
      return Array.from({ length: size }, (_, i) => anchor + [180, 0, 180, 0, 0][i % 5] + jitter(9));
    case 'split':
      return Array.from({ length: size }, (_, i) => anchor + [150, 0, 210, 0, 0][i % 5] + jitter(7));
    case 'triadic':
      return Array.from({ length: size }, (_, i) => anchor + [0, 120, 240, 0, 120][i % 5] + jitter(7));
    case 'monochrome':
      return Array.from({ length: size }, () => anchor + jitter(5));
    case 'random':
    default:
      return Array.from({ length: size }, () => rng.range(0, 360));
  }
}

/**
 * A new palette, keeping whatever is locked.
 *
 * When something is locked, its hue becomes the anchor the rest are built
 * around — so a locked terracotta gets a palette that belongs with terracotta,
 * rather than four unrelated colours that happen to sit next to it.
 */
export function generatePalette(rng: Rng, scheme: Scheme, previous: readonly Swatch[] = [], size = 5): Swatch[] {
  const locked = previous.filter((swatch) => swatch.locked);
  const lockedChromatic = locked
    .map((swatch) => hexToOklch(swatch.hex))
    .sort((a, b) => b.c - a.c)
    .find((color) => color.c > 0.03);
  const anchor = lockedChromatic ? lockedChromatic.h : rng.range(0, 360);

  const concrete: Concrete =
    scheme === 'harmony' ? rng.pick(['analogous', 'complementary', 'split', 'triadic'] as const) : scheme;

  const plan = rng.pick(VALUE_PLANS);
  const baseChroma =
    concrete === 'monochrome' ? rng.range(0.05, 0.13) : concrete === 'random' ? rng.range(0.07, 0.19) : rng.range(0.07, 0.17);
  // Lightness first, because it decides which swatches can carry colour at all.
  const lightness = Array.from({ length: size }, (_, i) =>
    clamp((plan[i % plan.length] ?? 0.6) + rng.range(-0.03, 0.03), 0.12, 0.98),
  );
  // Swatches ranked by how much chroma their lightness can hold, most first.
  const byCapacity = Array.from({ length: size }, (_, i) => i).sort(
    (a, b) => chromaShape(lightness[b]) - chromaShape(lightness[a]),
  );
  const ordered = huesFor(concrete, anchor, size, rng);
  const hues: number[] = [];
  byCapacity.forEach((slot, rank) => {
    hues[slot] = ordered[rank];
  });

  // One near-neutral in the multi-hue schemes gives the eye somewhere to rest,
  // placed on the swatch least able to hold colour — which is where a grey
  // belongs anyway, as a background or an ink.
  const multiHue = concrete !== 'monochrome' && concrete !== 'random';
  const neutralSlot = multiHue ? byCapacity[size - 1] : -1;

  return Array.from({ length: size }, (_, i) => {
    const existing = previous[i];
    if (existing?.locked) return existing;
    const l = lightness[i];
    const c = i === neutralSlot ? rng.range(0.008, 0.028) : baseChroma * chromaShape(l);
    return { hex: oklchToHex({ l, c, h: hues[i] }), locked: false };
  });
}

/**
 * Replace a single swatch, in keeping with the rest.
 *
 * Its lightness stays close to what it was, so the palette's value structure
 * survives; the hue is chosen against the most colourful of the others.
 */
export function regenerateSwatch(rng: Rng, scheme: Scheme, palette: readonly Swatch[], index: number): Swatch[] {
  const others = palette.filter((_, i) => i !== index).map((swatch) => hexToOklch(swatch.hex));
  const lead = others.slice().sort((a, b) => b.c - a.c)[0] ?? { l: 0.6, c: 0.12, h: rng.range(0, 360) };
  const current = hexToOklch(palette[index].hex);
  const typicalChroma = others.reduce((sum, color) => sum + color.c, 0) / Math.max(1, others.length);

  const concrete: Concrete = scheme === 'harmony' ? rng.pick(['analogous', 'complementary'] as const) : scheme;
  const hue = (() => {
    switch (concrete) {
      case 'analogous': return lead.h + rng.range(-36, 36);
      case 'complementary': return lead.h + (rng.chance(0.5) ? 180 : 0) + rng.range(-10, 10);
      case 'triadic': return lead.h + rng.pick([0, 120, 240]) + rng.range(-8, 8);
      case 'monochrome': return lead.h + rng.range(-6, 6);
      default: return rng.range(0, 360);
    }
  })();

  let hex = palette[index].hex;
  for (let attempt = 0; attempt < 6 && hex === palette[index].hex; attempt += 1) {
    const l = clamp(current.l + rng.range(-0.05, 0.05), 0.12, 0.98);
    hex = oklchToHex({ l, c: Math.max(0.02, typicalChroma * rng.range(0.7, 1.3)) * chromaShape(l), h: hue + attempt * 11 });
  }
  return palette.map((swatch, i) => (i === index ? { hex, locked: swatch.locked } : swatch));
}
