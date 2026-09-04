/**
 * sRGB primitives and WCAG contrast.
 *
 * Everything here follows the sRGB spec and WCAG 2.x §relative luminance
 * literally, including the 0.04045 / 12.92 piecewise transfer function. It is
 * tempting to approximate that with a plain 2.2 gamma; doing so shifts contrast
 * ratios by enough to flip a borderline pair's verdict, which is the one thing
 * this tool must not get wrong.
 */

export interface RGB {
  /** 0..1 */
  r: number;
  g: number;
  b: number;
}

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export function isHex(value: string): boolean {
  return HEX_RE.test(value.trim());
}

/** Parses #rgb, #rgba, #rrggbb, #rrggbbaa. Alpha is parsed but not used. */
export function parseHex(value: string): RGB | null {
  const m = HEX_RE.exec(value.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3 || h.length === 4) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
  };
}

const byte = (v: number) =>
  Math.round(Math.min(1, Math.max(0, v)) * 255)
    .toString(16)
    .padStart(2, '0');

export function toHex({ r, g, b }: RGB): string {
  return `#${byte(r)}${byte(g)}${byte(b)}`;
}

/** sRGB transfer function, gamma-encoded 0..1 to linear-light 0..1. */
export function toLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function fromLinear(c: number): number {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

export const toLinearRGB = ({ r, g, b }: RGB): RGB => ({
  r: toLinear(r),
  g: toLinear(g),
  b: toLinear(b),
});

export const fromLinearRGB = ({ r, g, b }: RGB): RGB => ({
  r: fromLinear(r),
  g: fromLinear(g),
  b: fromLinear(b),
});

/** WCAG relative luminance. */
export function luminance(rgb: RGB): number {
  const l = toLinearRGB(rgb);
  return 0.2126 * l.r + 0.7152 * l.g + 0.0722 * l.b;
}

/**
 * WCAG contrast ratio, always >= 1. Order-independent: the lighter colour is
 * placed on top regardless of which argument it arrived in.
 */
export function contrastRatio(a: RGB, b: RGB): number {
  const la = luminance(a);
  const lb = luminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

export const contrastHex = (a: string, b: string): number => {
  const ra = parseHex(a);
  const rb = parseHex(b);
  if (!ra || !rb) return 1;
  return contrastRatio(ra, rb);
};

/** Rounds the way reporting tools do — two decimals, truncated not rounded up. */
export const formatRatio = (ratio: number): string =>
  (Math.floor(ratio * 100) / 100).toFixed(2);
