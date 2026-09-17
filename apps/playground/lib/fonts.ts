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
 */

export type FontId = 'inter' | 'archivo' | 'instrument' | 'plex' | 'syne';

interface FontFile {
  url: string;
  weight: string;
  style: 'normal' | 'italic';
  stretch?: string;
}

export interface FontInfo {
  id: FontId;
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

export const fontById = (id: FontId): FontInfo => FONTS.find((font) => font.id === id) ?? FONTS[0];

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

/** @font-face rules with the font inside them, for a self-contained SVG. */
export async function embeddedFontCss(font: FontInfo, italic: boolean): Promise<string> {
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
