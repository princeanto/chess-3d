/**
 * APCA — Accessible Perceptual Contrast Algorithm (APCA-W3, the 0.1.9
 * constants), included as an advisory second opinion.
 *
 * Why bother when WCAG 2.2 is the thing being audited: WCAG's ratio is a simple
 * function of two luminances and is blind to polarity, so it treats dark-on-
 * light and light-on-dark as equivalent. They are not — the eye reads them
 * differently, and the practical result is that WCAG passes some genuinely
 * unreadable dark-theme pairs and fails some perfectly readable ones. APCA
 * models polarity and font weight, so it disagrees with WCAG exactly where
 * WCAG is weakest.
 *
 * It is advisory here and never overrides the WCAG verdict: WCAG 2.2 is what
 * audits, contracts and procurement actually reference.
 *
 * Note the transfer function below is a plain 2.4 power curve, NOT the
 * piecewise sRGB curve used in `srgb.ts`. That is deliberate and per spec —
 * APCA defines its own estimate of screen luminance.
 */

import type { RGB } from './srgb';

const MAIN_TRC = 2.4;

const R_CO = 0.2126729;
const G_CO = 0.7151522;
const B_CO = 0.072175;

const NORM_BG = 0.56;
const NORM_TXT = 0.57;
const REV_TXT = 0.62;
const REV_BG = 0.65;

const BLK_THRS = 0.022;
const BLK_CLMP = 1.414;
const SCALE_BOW = 1.14;
const SCALE_WOB = 1.14;
const LO_BOW_OFFSET = 0.027;
const LO_WOB_OFFSET = 0.027;
const DELTA_Y_MIN = 0.0005;
const LO_CLIP = 0.1;

/** APCA's own luminance estimate. Input channels are 0..1. */
function screenLuminance({ r, g, b }: RGB): number {
  return (
    R_CO * Math.pow(r, MAIN_TRC) +
    G_CO * Math.pow(g, MAIN_TRC) +
    B_CO * Math.pow(b, MAIN_TRC)
  );
}

/** Lifts very dark values so near-blacks do not all collapse together. */
const softClampBlack = (y: number): number =>
  y > BLK_THRS ? y : y + Math.pow(BLK_THRS - y, BLK_CLMP);

/**
 * Lightness contrast, roughly -108..106.
 *
 * The sign carries the polarity: positive is dark text on a light background,
 * negative is light text on dark. Magnitude is what you compare against the
 * thresholds — hence `Math.abs` in every consumer.
 */
export function apcaLc(text: RGB, background: RGB): number {
  const yTxt = softClampBlack(screenLuminance(text));
  const yBg = softClampBlack(screenLuminance(background));

  if (Math.abs(yBg - yTxt) < DELTA_Y_MIN) return 0;

  let output: number;
  if (yBg > yTxt) {
    // Dark text on a light background.
    const sapc = (Math.pow(yBg, NORM_BG) - Math.pow(yTxt, NORM_TXT)) * SCALE_BOW;
    output = sapc < LO_CLIP ? 0 : sapc - LO_BOW_OFFSET;
  } else {
    // Light text on a dark background.
    const sapc = (Math.pow(yBg, REV_BG) - Math.pow(yTxt, REV_TXT)) * SCALE_WOB;
    output = sapc > -LO_CLIP ? 0 : sapc + LO_WOB_OFFSET;
  }

  return output * 100;
}

export interface ApcaVerdict {
  lc: number;
  /** Plain-language read of the magnitude. */
  label: string;
  tone: 'pass' | 'warn' | 'fail';
  guidance: string;
}

/**
 * The published "bronze simple mode" guidance, compressed. APCA deliberately
 * has no single pass/fail line — the level you need depends on font size and
 * weight — so these are described as uses, not as grades.
 */
export function apcaVerdict(lc: number): ApcaVerdict {
  const v = Math.abs(lc);
  if (v >= 90) {
    return { lc, label: 'Lc 90+', tone: 'pass', guidance: 'Any text, including thin weights at small sizes.' };
  }
  if (v >= 75) {
    return { lc, label: 'Lc 75+', tone: 'pass', guidance: 'Body text at 16px regular and above.' };
  }
  if (v >= 60) {
    return { lc, label: 'Lc 60+', tone: 'pass', guidance: 'Larger or heavier text — 24px, or 16px bold.' };
  }
  if (v >= 45) {
    return { lc, label: 'Lc 45+', tone: 'warn', guidance: 'Large headings only. Not for reading text.' };
  }
  if (v >= 30) {
    return { lc, label: 'Lc 30+', tone: 'warn', guidance: 'Non-text: borders, dividers, disabled states.' };
  }
  return { lc, label: `Lc ${Math.round(v)}`, tone: 'fail', guidance: 'Below the floor for any content use.' };
}

/** True when APCA and WCAG reach materially different conclusions for body text. */
export function disagreesWithWcag(lc: number, ratio: number): boolean {
  const apcaOkForBody = Math.abs(lc) >= 75;
  const wcagOkForBody = ratio >= 4.5;
  return apcaOkForBody !== wcagOkForBody;
}
