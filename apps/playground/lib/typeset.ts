/**
 * TYPE's engine: a line of words set like a poster.
 *
 * Pure functions, so the layout that appears on screen is exactly the one that
 * exports — the preview, the SVG and the PNG are all drawn from `typeSvg`.
 * The one thing that needs a browser is measuring text to fit it to the width,
 * and that happens in the tool, which hands the result back in as `fontSize`.
 */

import type { Rng } from './random';
import { contrast, readableOn } from './color';
import { escapeXml } from './export';
import { ASPECTS, type Aspect } from './pattern';
import { cssFamily, fontById, nearestWeight, type FontId } from './fonts';

export type Case = 'normal' | 'upper' | 'lower' | 'title';
export type Align = 'left' | 'center' | 'right';
export type VAlign = 'top' | 'middle' | 'bottom';
export type Break = 'typed' | 'words';
export type Background = 'light' | 'dark' | 'color' | 'transparent';

export interface TypeState {
  text: string;
  font: FontId;
  weight: number;
  /** Archivo's width axis, as a percentage. Ignored by other fonts. */
  width: number;
  italic: boolean;
  /** In canvas units, used when `fit` is off. */
  size: number;
  /** Size the longest line to the width, instead of using `size`. */
  fit: boolean;
  /** Letter spacing, in em. */
  tracking: number;
  leading: number;
  align: Align;
  valign: VAlign;
  textCase: Case;
  breakMode: Break;
  background: Background;
  backgroundColor: string;
  color: string;
  aspect: Aspect;
}

export const LIGHT = '#F5F5F2';
export const DARK = '#111111';

export const DEFAULT_TYPE: TypeState = {
  text: 'MAKE\nSOMETHING',
  font: 'inter',
  weight: 900,
  width: 100,
  italic: false,
  size: 180,
  fit: true,
  tracking: -0.04,
  leading: 0.86,
  align: 'left',
  valign: 'bottom',
  textCase: 'upper',
  breakMode: 'typed',
  background: 'light',
  backgroundColor: '#E4572E',
  color: DARK,
  aspect: 'poster',
};

export function applyCase(text: string, textCase: Case): string {
  switch (textCase) {
    case 'upper': return text.toUpperCase();
    case 'lower': return text.toLowerCase();
    case 'title': return text.toLowerCase().replace(/(^|[\s\-–—/])(\p{L})/gu, (_, gap: string, ch: string) => gap + ch.toUpperCase());
    default: return text;
  }
}

/** Lines to set: as typed, or one word to a line. Never empty. */
export function toLines(text: string, mode: Break): string[] {
  const clean = text.replace(/\r/g, '');
  let lines = mode === 'words' ? clean.split(/\s+/).filter(Boolean) : clean.split('\n').map((line) => line.replace(/\s+$/, ''));
  while (lines.length && !lines[0].trim()) lines = lines.slice(1);
  while (lines.length && !lines[lines.length - 1].trim()) lines = lines.slice(0, -1);
  return lines.length ? lines : [' '];
}

export function backgroundOf(state: TypeState): string | null {
  if (state.background === 'light') return LIGHT;
  if (state.background === 'dark') return DARK;
  if (state.background === 'color') return state.backgroundColor;
  return null;
}

/** Cap height as a share of the em — close enough to place type optically. */
export const CAP = 0.72;

export interface Layout {
  lines: string[];
  fontSize: number;
  anchor: 'start' | 'middle' | 'end';
  x: number;
  baselines: number[];
  w: number;
  h: number;
  pad: number;
}

export function padding(aspect: Aspect): number {
  const { w, h } = ASPECTS[aspect];
  return Math.round(Math.min(w, h) * 0.07);
}

export function layout(state: TypeState, fontSize: number): Layout {
  const { w, h } = ASPECTS[state.aspect];
  const pad = padding(state.aspect);
  const lines = toLines(applyCase(state.text, state.textCase), state.breakMode);
  const step = fontSize * state.leading;
  const block = (lines.length - 1) * step + fontSize * CAP;
  const top = state.valign === 'top' ? pad : state.valign === 'middle' ? (h - block) / 2 : h - pad - block;
  const first = top + fontSize * CAP;

  /*
   * Letter spacing is added after every character, the last one included, so
   * right- and centre-aligned lines sit off by one space. Shifting by that
   * amount puts the ink where the alignment says it should be.
   */
  const trailing = state.tracking * fontSize;
  const anchor = state.align === 'left' ? 'start' : state.align === 'center' ? 'middle' : 'end';
  const x = state.align === 'left' ? pad : state.align === 'center' ? w / 2 + trailing / 2 : w - pad + trailing;

  return { lines, fontSize, anchor, x, baselines: lines.map((_, i) => first + i * step), w, h, pad };
}

const r1 = (n: number): string => String(Math.round(n * 10) / 10);

/**
 * The composition as an SVG.
 *
 * `fontCss` carries the font inside the file for export; the on-screen preview
 * leaves it out and uses the page's own fonts. `pixelWidth` sets the rendered
 * size, which has to be declared at full size for a sharp PNG.
 */
export function typeSvg(state: TypeState, fontSize: number, opts: { fontCss?: string; pixelWidth?: number } = {}): string {
  const L = layout(state, fontSize);
  const font = fontById(state.font);
  const background = backgroundOf(state);
  const pw = opts.pixelWidth ?? L.w;
  const ph = Math.round((pw / L.w) * L.h);
  const attrs =
    `font-family="${escapeXml(cssFamily(font))}" font-size="${r1(fontSize)}" font-weight="${nearestWeight(font, state.weight)}"` +
    // As a style, not an attribute: percentages in the attribute are not read everywhere.
    (font.width ? ` style="font-stretch:${Math.round(state.width)}%"` : '') +
    (state.italic && font.italic ? ' font-style="italic"' : '') +
    ` letter-spacing="${r1(state.tracking * fontSize)}" fill="${state.color}" text-anchor="${L.anchor}"`;
  const text = L.lines
    .map((line, i) => `<text x="${r1(L.x)}" y="${r1(L.baselines[i])}" ${attrs} xml:space="preserve">${escapeXml(line)}</text>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${pw}" height="${ph}" viewBox="0 0 ${L.w} ${L.h}">` +
    (opts.fontCss ? `<defs><style>${opts.fontCss}</style></defs>` : '') +
    (background ? `<rect width="${L.w}" height="${L.h}" fill="${background}"/>` : '') +
    `${text}</svg>`;
}

/** The same settings as CSS, for taking the look into a real project. */
export function typeCss(state: TypeState, fontSize: number): string {
  const font = fontById(state.font);
  const transform = { upper: 'uppercase', lower: 'lowercase', title: 'capitalize', normal: 'none' }[state.textCase];
  return [
    '.headline {',
    `  font-family: ${cssFamily(font)};`,
    `  font-size: ${Math.round(fontSize)}px;`,
    `  font-weight: ${nearestWeight(font, state.weight)};`,
    ...(font.width ? [`  font-stretch: ${Math.round(state.width)}%;`] : []),
    ...(state.italic && font.italic ? ['  font-style: italic;'] : []),
    `  letter-spacing: ${Math.round(state.tracking * 1000) / 1000}em;`,
    `  line-height: ${Math.round(state.leading * 100) / 100};`,
    `  text-transform: ${transform};`,
    `  text-align: ${state.align};`,
    `  color: ${state.color};`,
    '}',
    '',
  ].join('\n');
}

/* ----------------------------- presets ----------------------------- */

export type PresetId = 'minimal' | 'editorial' | 'poster' | 'centered' | 'huge' | 'tight' | 'experimental';

export const PRESETS: { id: PresetId; label: string }[] = [
  { id: 'minimal', label: 'Minimal' },
  { id: 'editorial', label: 'Editorial' },
  { id: 'poster', label: 'Poster' },
  { id: 'centered', label: 'Centered' },
  { id: 'huge', label: 'Huge Type' },
  { id: 'tight', label: 'Tight Type' },
  { id: 'experimental', label: 'Experimental' },
];

/**
 * A text and background colour that read together.
 *
 * Only pairs that clear 4.5:1 are allowed, which is the whole reason Randomize
 * never produces an unreadable poster: when the palette has no such pair, ink or
 * paper stands in rather than a guess.
 */
export function colourPair(
  palette: readonly string[],
  rng: Rng,
  mode: 'light' | 'dark' | 'color',
): Pick<TypeState, 'background' | 'backgroundColor' | 'color'> {
  if (mode === 'light' || mode === 'dark') {
    const ground = mode === 'light' ? LIGHT : DARK;
    const inks = palette.filter((c) => contrast(c, ground) >= 4.5);
    return {
      background: mode,
      backgroundColor: palette[0] ?? '#E4572E',
      color: inks.length && rng.chance(0.6) ? rng.pick(inks) : mode === 'light' ? DARK : LIGHT,
    };
  }
  for (const ground of rng.shuffle(palette)) {
    const partners = palette.filter((c) => c !== ground && contrast(c, ground) >= 4.5);
    if (partners.length) return { background: 'color', backgroundColor: ground, color: rng.pick(partners) };
  }
  // No pair in the palette reads. The palette colour that best carries ink or
  // paper is next; a mid-tone can fail both, and then it is plain dark ground.
  const best = palette
    .map((ground) => ({ ground, ink: readableOn(ground, [DARK, LIGHT]) }))
    .sort((a, b) => contrast(b.ink, b.ground) - contrast(a.ink, a.ground))[0];
  if (best && contrast(best.ink, best.ground) >= 4.5) return { background: 'color', backgroundColor: best.ground, color: best.ink };
  return { background: 'dark', backgroundColor: palette[0] ?? '#E4572E', color: LIGHT };
}

export function applyPreset(state: TypeState, id: PresetId, palette: readonly string[], rng: Rng): TypeState {
  const base = { ...state, italic: false, width: 100 };
  switch (id) {
    case 'minimal':
      return { ...base, ...colourPair(palette, rng, 'light'), font: 'inter', weight: 500, fit: false, size: 64, tracking: -0.01, leading: 1.15, align: 'left', valign: 'bottom', textCase: 'normal', breakMode: 'typed' };
    case 'editorial':
      return { ...base, ...colourPair(palette, rng, 'light'), font: 'instrument', weight: 400, italic: rng.chance(0.4), fit: false, size: 150, tracking: -0.02, leading: 0.98, align: 'left', valign: 'top', textCase: 'normal', breakMode: 'typed' };
    case 'poster':
      return { ...base, ...colourPair(palette, rng, 'color'), font: 'archivo', weight: 900, width: 72, fit: true, tracking: -0.02, leading: 0.86, align: 'left', valign: 'bottom', textCase: 'upper', breakMode: 'typed' };
    case 'centered':
      return { ...base, ...colourPair(palette, rng, rng.chance(0.5) ? 'light' : 'dark'), font: 'syne', weight: 700, fit: false, size: 120, tracking: 0, leading: 1.02, align: 'center', valign: 'middle', textCase: 'normal', breakMode: 'typed' };
    case 'huge':
      return { ...base, ...colourPair(palette, rng, 'dark'), font: 'inter', weight: 900, fit: true, tracking: -0.05, leading: 0.82, align: 'left', valign: 'middle', textCase: 'upper', breakMode: 'words' };
    case 'tight':
      return { ...base, ...colourPair(palette, rng, 'color'), font: 'archivo', weight: 800, width: 62, fit: true, tracking: -0.06, leading: 0.78, align: 'left', valign: 'top', textCase: 'upper', breakMode: 'words' };
    case 'experimental':
    default:
      return { ...base, ...colourPair(palette, rng, 'dark'), font: 'plex', weight: 600, fit: false, size: 72, tracking: 0.28, leading: 1.5, align: 'right', valign: 'bottom', textCase: 'lower', breakMode: 'words' };
  }
}

/** A preset, then nudged within the range where it still looks intended. */
export function randomType(rng: Rng, palette: readonly string[], state: TypeState): TypeState {
  const next = applyPreset(state, rng.pick(PRESETS).id, palette, rng);
  const font = fontById(next.font);
  return {
    ...next,
    tracking: Math.round((next.tracking + rng.range(-0.012, 0.012)) * 1000) / 1000,
    leading: Math.round((next.leading + rng.range(-0.04, 0.04)) * 100) / 100,
    width: font.width ? Math.round(Math.min(font.width.max, Math.max(font.width.min, next.width + rng.range(-8, 8)))) : 100,
    weight: nearestWeight(font, next.weight),
  };
}
