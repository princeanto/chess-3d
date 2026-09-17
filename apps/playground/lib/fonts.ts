/**
 * The bundled type kit.
 *
 * Five families, self-hosted, each with only the weights it actually has — a
 * weight a font does not contain gets faked by the browser, thickening every
 * stroke evenly, and that is not a design choice anybody meant to make.
 *
 * `embeddedFontCss` exists for SVG export. An SVG opened on another machine only
 * has that machine's fonts, and an SVG drawn into a canvas for PNG export has
 * none at all; carrying the font inside the file is the only way either looks
 * the way it did on screen.
 *
 * Any Google Fonts family can join the kit too. Its id is `google:<family>`, and
 * the families someone has picked are remembered on this device, so a poster
 * set in one reopens in it.
 */

import { facesFor, loadFamily, type GoogleFamily } from './googleFonts';
import { load, save } from './storage';

export type BundledId = 'inter' | 'archivo' | 'instrument' | 'plex' | 'syne';
/** A bundled id, or `google:<family>`. */
export type FontId = string;

interface FontFile {
  url: string;
  weight: string;
  style: 'normal' | 'italic';
  stretch?: string;
}

export interface FontInfo {
  id: FontId;
  /** Set for a Google Fonts family, which loads on demand. */
  google?: GoogleFamily;
  label: string;
  family: string;
  fallback: string;
  weights: number[];
  /** Variable width axis, as percentages. Only Archivo has one. */
  width?: { min: number; max: number };
  italic: boolean;
  files: FontFile[];
}

export const FONTS: FontInfo[] = [
  {
    id: 'inter', label: 'Inter', family: 'Inter', fallback: 'ui-sans-serif, system-ui, sans-serif',
    weights: [400, 500, 600, 700, 800, 900], italic: false,
    files: [{ url: '/fonts/inter-normal-400-900.woff2', weight: '400 900', style: 'normal' }],
  },
  {
    id: 'archivo', label: 'Archivo', family: 'Archivo', fallback: 'ui-sans-serif, system-ui, sans-serif',
    weights: [400, 500, 600, 700, 800, 900], width: { min: 62, max: 125 }, italic: false,
    files: [{ url: '/fonts/archivo-normal-400-900.woff2', weight: '400 900', style: 'normal', stretch: '62% 125%' }],
  },
  {
    id: 'instrument', label: 'Instrument Serif', family: 'Instrument Serif', fallback: 'Georgia, serif',
    weights: [400], italic: true,
    files: [
      { url: '/fonts/instrument-serif-normal-400.woff2', weight: '400', style: 'normal' },
      { url: '/fonts/instrument-serif-italic-400.woff2', weight: '400', style: 'italic' },
    ],
  },
  {
    id: 'plex', label: 'Plex Mono', family: 'IBM Plex Mono', fallback: 'ui-monospace, monospace',
    weights: [400, 600], italic: false,
    files: [
      { url: '/fonts/ibm-plex-mono-normal-400.woff2', weight: '400', style: 'normal' },
      { url: '/fonts/ibm-plex-mono-normal-600.woff2', weight: '600', style: 'normal' },
    ],
  },
  {
    id: 'syne', label: 'Syne', family: 'Syne', fallback: 'ui-sans-serif, system-ui, sans-serif',
    weights: [400, 500, 600, 700, 800], italic: false,
    files: [{ url: '/fonts/syne-normal-400-800.woff2', weight: '400 800', style: 'normal' }],
  },
];

/* ------------------------------ google fonts ----------------------------- */

const USED_LIMIT = 12;
const GOOGLE = 'google:';
const FALLBACK: Record<GoogleFamily['category'], string> = {
  'Sans Serif': 'ui-sans-serif, system-ui, sans-serif',
  Serif: 'Georgia, serif',
  Display: 'ui-sans-serif, system-ui, sans-serif',
  Handwriting: 'cursive',
  Monospace: 'ui-monospace, monospace',
};

export const googleFontId = (family: string): FontId => `${GOOGLE}${family}`;

export function googleFontInfo(google: GoogleFamily): FontInfo {
  return {
    id: googleFontId(google.family),
    google,
    label: google.family,
    family: google.family,
    fallback: FALLBACK[google.category] ?? 'sans-serif',
    weights: google.weights.length ? google.weights : google.italics,
    italic: google.italics.length > 0,
    files: [],
  };
}

let used: GoogleFamily[] | null = null;

/** Google families picked on this device, most recent first. */
export function usedGoogleFonts(): GoogleFamily[] {
  used ??= load<GoogleFamily[]>('fonts.google', []);
  return used;
}

export function rememberGoogleFont(font: GoogleFamily): void {
  used = [font, ...usedGoogleFonts().filter((f) => f.family !== font.family)].slice(0, USED_LIMIT);
  save('fonts.google', used);
}

/*
 * Families met without being picked here — in a backup from another device, or
 * a saved poster — known for this session so they draw in the right font.
 */
const known = new Map<string, GoogleFamily>();
export const knowGoogleFont = (font: GoogleFamily): void => { known.set(font.family, font); };

export function fontById(id: FontId): FontInfo {
  if (id.startsWith(GOOGLE)) {
    const family = id.slice(GOOGLE.length);
    const google = usedGoogleFonts().find((f) => f.family === family) ?? known.get(family);
    if (google) return googleFontInfo(google);
  }
  return FONTS.find((font) => font.id === id) ?? FONTS[0];
}

/** Resolves once the font can be drawn. Bundled fonts are always ready. */
export function ensureFont(font: FontInfo): Promise<void> {
  return font.google ? loadFamily(font.google) : Promise.resolve();
}

/** The closest weight the font really has. */
export function nearestWeight(font: FontInfo, weight: number): number {
  return font.weights.reduce((best, w) => (Math.abs(w - weight) < Math.abs(best - weight) ? w : best), font.weights[0]);
}

export const cssFamily = (font: FontInfo): string => `'${font.family}', ${font.fallback}`;

const encoded = new Map<string, string>();

async function base64Of(url: string): Promise<string> {
  const cached = encoded.get(url);
  if (cached) return cached;
  const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
  let binary = '';
  // In chunks: spreading a whole font into one call overflows the stack.
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const value = btoa(binary);
  encoded.set(url, value);
  return value;
}

/**
 * @font-face rules with the font inside them, for a self-contained SVG.
 *
 * For a Google family only the faces the text needs go in: the right style,
 * a file covering the weight, and the scripts the letters come from.
 */
export async function embeddedFontCss(font: FontInfo, italic: boolean, weight: number, text: string): Promise<string> {
  if (font.google) {
    const faces = await facesFor(font.google, weight, italic && font.italic, text);
    const rules = await Promise.all(
      faces.map(async (face) =>
        `@font-face{font-family:'${font.family}';font-style:${face.style};font-weight:${face.weight};` +
        (face.unicodeRange ? `unicode-range:${face.unicodeRange};` : '') +
        `src:url(data:font/woff2;base64,${await base64Of(face.url)}) format('woff2');}`,
      ),
    );
    return rules.join('');
  }
  const style = italic && font.italic ? 'italic' : 'normal';
  const files = font.files.filter((file) => file.style === style);
  const rules = await Promise.all(
    files.map(async (file) =>
      `@font-face{font-family:'${font.family}';font-style:${file.style};font-weight:${file.weight};` +
      (file.stretch ? `font-stretch:${file.stretch};` : '') +
      `src:url(data:font/woff2;base64,${await base64Of(file.url)}) format('woff2');}`,
    ),
  );
  return rules.join('');
}
