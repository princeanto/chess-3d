/**
 * Every Google Fonts family, loaded one at a time.
 *
 * The catalogue ships with the app (public/google-fonts.json, ~15 KB gzipped),
 * so browsing and searching work offline. A font itself is fetched only when
 * someone picks it, and the service worker keeps it, so a font used once keeps
 * working without a connection.
 *
 * Fonts are registered through the FontFace API rather than by adding
 * stylesheet links. That keeps two things apart that would otherwise collide:
 * the name-only preview in the browser list, and the real font once chosen —
 * a preview subset registered under the family's own name would quietly stand
 * in for the full font and drop every letter not in the name.
 */

export const CATEGORIES = ['Sans Serif', 'Serif', 'Display', 'Handwriting', 'Monospace'] as const;
export type Category = (typeof CATEGORIES)[number];

export interface GoogleFamily {
  family: string;
  category: Category;
  /** Weights available upright, e.g. [400, 700]. */
  weights: number[];
  /** Weights available in italic. */
  italics: number[];
  /** The variable weight axis, when there is one. */
  wght?: [number, number];
}

type Row = [string, number, number, number, number, number];

const fromBits = (bits: number): number[] =>
  Array.from({ length: 9 }, (_, i) => (bits & (1 << i) ? (i + 1) * 100 : 0)).filter(Boolean);

export function decodeCatalogue(json: { categories: string[]; families: Row[] }): GoogleFamily[] {
  return json.families.map(([family, category, normal, italic, min, max]) => ({
    family,
    category: (json.categories[category] ?? 'Sans Serif') as Category,
    weights: fromBits(normal),
    italics: fromBits(italic),
    ...(max > 0 ? { wght: [min, max] as [number, number] } : {}),
  }));
}

const API = 'https://fonts.googleapis.com/css2';
const param = (family: string): string => encodeURIComponent(family).replace(/%20/g, '+');

/**
 * The css2 request for a whole family.
 *
 * A variable family asks for its weight range, which is one file per style. A
 * static family lists exactly the weights it has — asking for one it lacks
 * fails the entire request.
 */
export function familyCssUrl(font: GoogleFamily): string {
  const name = param(font.family);
  const hasItalic = font.italics.length > 0;
  let spec = '';
  if (font.wght) {
    const range = `${font.wght[0]}..${font.wght[1]}`;
    spec = hasItalic ? `:ital,wght@0,${range};1,${range}` : `:wght@${range}`;
  } else if (hasItalic) {
    const tuples = [...font.weights.map((w) => `0,${w}`), ...font.italics.map((w) => `1,${w}`)];
    spec = `:ital,wght@${tuples.join(';')}`;
  } else if (!(font.weights.length === 1 && font.weights[0] === 400)) {
    spec = `:wght@${font.weights.join(';')}`;
  }
  return `${API}?family=${name}${spec}&display=swap`;
}

/** Just the letters of the name, for the list: a few hundred bytes a row. */
export function previewCssUrl(font: GoogleFamily): string {
  const weight = font.weights.includes(400) ? '' : `:wght@${nearest(font.weights.length ? font.weights : font.italics, 400)}`;
  const italic = font.weights.length === 0 ? `:ital,wght@1,${nearest(font.italics, 400)}` : '';
  return `${API}?family=${param(font.family)}${italic || weight}&text=${encodeURIComponent(font.family)}`;
}

export function nearest(weights: readonly number[], target: number): number {
  return weights.reduce((best, w) => (Math.abs(w - target) < Math.abs(best - target) ? w : best), weights[0] ?? 400);
}

export interface FaceRule {
  style: 'normal' | 'italic';
  /** "400", or "100 900" for a variable file. */
  weight: string;
  url: string;
  unicodeRange?: string;
  stretch?: string;
}

/** The @font-face rules in a css2 response. */
export function parseFaces(css: string): FaceRule[] {
  const faces: FaceRule[] = [];
  for (const match of css.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    const body = match[1];
    const prop = (name: string) => new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(body)?.[1].trim();
    const url = /url\(\s*['"]?([^'")]+)['"]?\s*\)/.exec(body)?.[1];
    if (!url) continue;
    faces.push({
      style: prop('font-style') === 'italic' ? 'italic' : 'normal',
      weight: prop('font-weight') ?? '400',
      url,
      ...(prop('unicode-range') ? { unicodeRange: prop('unicode-range') } : {}),
      ...(prop('font-stretch') ? { stretch: prop('font-stretch') } : {}),
    });
  }
  return faces;
}

/** "U+0000-00FF, U+0131, U+4??" as inclusive [start, end] pairs. */
export function parseUnicodeRange(range: string): [number, number][] {
  return range.split(',').map((part) => part.trim().replace(/^U\+/i, '')).filter(Boolean).map((part) => {
    if (part.includes('?')) return [parseInt(part.replace(/\?/g, '0'), 16), parseInt(part.replace(/\?/g, 'F'), 16)];
    const [a, b] = part.split('-');
    return [parseInt(a, 16), parseInt(b ?? a, 16)];
  });
}

export function coversText(face: FaceRule, text: string): boolean {
  if (!face.unicodeRange) return true;
  const ranges = parseUnicodeRange(face.unicodeRange);
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (ranges.some(([a, b]) => code >= a && code <= b)) return true;
  }
  return false;
}

/** Whether a face's weight, "400" or "100 900", includes this weight. */
export function faceHasWeight(face: FaceRule, weight: number): boolean {
  const [a, b] = face.weight.split(/\s+/).map(Number);
  return b === undefined ? a === weight : weight >= a && weight <= b;
}

/* ------------------------------ in the browser ----------------------------- */

let catalogue: Promise<GoogleFamily[]> | null = null;

export function loadCatalogue(): Promise<GoogleFamily[]> {
  catalogue ??= fetch('/google-fonts.json')
    .then((r) => {
      if (!r.ok) throw new Error('catalogue');
      return r.json();
    })
    .then(decodeCatalogue)
    .catch((error) => {
      catalogue = null;
      throw error;
    });
  return catalogue;
}

const cssText = new Map<string, Promise<string>>();

function fetchCss(url: string): Promise<string> {
  let request = cssText.get(url);
  if (!request) {
    request = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`css ${r.status}`);
      return r.text();
    });
    request.catch(() => cssText.delete(url));
    cssText.set(url, request);
  }
  return request;
}

const previews = new Map<string, Promise<string>>();
let previewCount = 0;

/** Registers the name-only face and resolves to the name to use in CSS. */
export function loadPreview(font: GoogleFamily): Promise<string> {
  let request = previews.get(font.family);
  if (!request) {
    previewCount += 1;
    const alias = `pg-preview-${previewCount}`;
    request = fetchCss(previewCssUrl(font)).then(async (css) => {
      const face = parseFaces(css)[0];
      if (!face) throw new Error('no face');
      const loaded = await new FontFace(alias, `url(${face.url})`, { style: face.style, weight: face.weight }).load();
      document.fonts.add(loaded);
      return alias;
    });
    request.catch(() => previews.delete(font.family));
    previews.set(font.family, request);
  }
  return request;
}

const families = new Map<string, Promise<void>>();

/**
 * Registers every face of a family. Faces carry their unicode ranges, so the
 * browser downloads only the scripts the text actually uses.
 */
export function loadFamily(font: GoogleFamily): Promise<void> {
  let request = families.get(font.family);
  if (!request) {
    request = fetchCss(familyCssUrl(font)).then(async (css) => {
      const faces = parseFaces(css);
      if (!faces.length) throw new Error('no faces');
      for (const face of faces) {
        document.fonts.add(new FontFace(font.family, `url(${face.url})`, {
          style: face.style,
          weight: face.weight,
          display: 'swap',
          ...(face.unicodeRange ? { unicodeRange: face.unicodeRange } : {}),
        }));
      }
      // Proves the files are reachable now, rather than failing quietly later.
      const weight = font.weights.length ? nearest(font.weights, 400) : nearest(font.italics, 400);
      const loaded = await document.fonts.load(`${font.weights.length ? '' : 'italic '}${weight} 16px '${font.family}'`, font.family);
      if (!loaded.length) throw new Error('not loaded');
    });
    request.catch(() => families.delete(font.family));
    families.set(font.family, request);
  }
  return request;
}

/** The faces a piece of text needs, for embedding in an export. */
export async function facesFor(font: GoogleFamily, weight: number, italic: boolean, text: string): Promise<FaceRule[]> {
  const faces = parseFaces(await fetchCss(familyCssUrl(font)));
  const style = italic ? 'italic' : 'normal';
  const styled = faces.filter((face) => face.style === style);
  const pool = styled.length ? styled : faces;
  const weighted = pool.filter((face) => faceHasWeight(face, weight));
  const candidates = weighted.length ? weighted : pool;
  const needed = candidates.filter((face) => coversText(face, text));
  return needed.length ? needed : candidates.slice(-1);
}
