/**
 * MAKE's posters: a few blocks of text, a few shapes, one background.
 *
 * Intentionally small. A poster is a template's structure (which text blocks
 * exist and how they stack), a layout (where the stack sits), an alignment and
 * a spacing — plus any nudges from dragging, kept as offsets on top. Change the
 * format and everything re-flows, because positions are shares of the canvas,
 * not pixels.
 *
 * Laying text out needs real glyph widths, so `layoutPoster` takes a measuring
 * function: the browser's in the tool, an approximation in tests.
 */

import type { Rng } from './random';
import { contrast, luminance } from './color';
import { escapeXml } from './export';
import { smoothClosed } from './pattern';
import { cssFamily, fontById, nearestWeight, type FontId } from './fonts';
import { CAP, applyCase, colourPair, DARK, LIGHT, type Align, type Case } from './typeset';

export type FormatId = 'square' | 'portrait' | 'landscape' | 'wallpaper' | 'instagram' | 'story';

export const FORMATS: Record<FormatId, { label: string; w: number; h: number }> = {
  square: { label: 'Square', w: 1080, h: 1080 },
  portrait: { label: 'Portrait', w: 1240, h: 1754 },
  landscape: { label: 'Landscape', w: 1920, h: 1080 },
  wallpaper: { label: 'Phone wallpaper', w: 1179, h: 2556 },
  instagram: { label: 'Instagram post', w: 1080, h: 1350 },
  story: { label: 'Story', w: 1080, h: 1920 },
};

export type TemplateId = 'quote' | 'announcement' | 'event' | 'minimal' | 'experimental';
export const TEMPLATES: { id: TemplateId; label: string }[] = [
  { id: 'quote', label: 'Quote' },
  { id: 'announcement', label: 'Announcement' },
  { id: 'event', label: 'Event' },
  { id: 'minimal', label: 'Minimal' },
  { id: 'experimental', label: 'Experimental' },
];

export type Role = 'headline' | 'text' | 'detail';

export interface TextBlock {
  id: string;
  role: Role;
  label: string;
  text: string;
  font: FontId;
  weight: number;
  /** Width axis, for fonts that have one. */
  stretch: number;
  italic: boolean;
  /** Share of the canvas's shorter side. */
  size: number;
  tracking: number;
  leading: number;
  textCase: Case;
  /** Share of the width inside the margins. */
  width: number;
  /** Shrink to keep the longest word inside the width. */
  fit: boolean;
  /** Nudges from dragging, as shares of the canvas. */
  dx: number;
  dy: number;
}

export type ShapeKind = 'circle' | 'square' | 'triangle' | 'arch' | 'ring' | 'blob' | 'star' | 'half' | 'stripes';
export const SHAPE_KINDS: { id: ShapeKind; label: string }[] = [
  { id: 'circle', label: 'Circle' }, { id: 'square', label: 'Square' }, { id: 'triangle', label: 'Triangle' },
  { id: 'arch', label: 'Arch' }, { id: 'half', label: 'Half circle' }, { id: 'ring', label: 'Ring' },
  { id: 'blob', label: 'Blob' }, { id: 'star', label: 'Burst' }, { id: 'stripes', label: 'Stripes' },
];

export interface PosterShape {
  id: string;
  kind: ShapeKind;
  /** Centre, as shares of the canvas. */
  x: number;
  y: number;
  /** Diameter, as a share of the shorter side. */
  size: number;
  rotation: number;
  color: string;
  opacity: number;
  seed: number;
}

export type LayoutId = 'top' | 'center' | 'bottom' | 'split' | 'flip';
export const LAYOUTS: { id: LayoutId; label: string }[] = [
  { id: 'top', label: 'Top' }, { id: 'center', label: 'Middle' }, { id: 'bottom', label: 'Bottom' },
  { id: 'split', label: 'Split' }, { id: 'flip', label: 'Flip' },
];

export interface Poster {
  v: 1;
  format: FormatId;
  template: TemplateId;
  layout: LayoutId;
  align: Align;
  /** Margins and gaps, 0.5–1.6. */
  spacing: number;
  background: string;
  ink: string;
  blocks: TextBlock[];
  shapes: PosterShape[];
}

export const MAX_SHAPES = 3;

/* ------------------------------- measuring ------------------------------- */

export interface MeasureFont { family: string; weight: number; stretch?: number; italic: boolean; tracking: number }
/** Width of a line at font-size 100. */
export type Measure = (text: string, font: MeasureFont) => number;

/** A rough stand-in for tests and for the first paint. */
export const approxMeasure: Measure = (text, font) => text.length * (52 + (font.weight - 400) * 0.03) * ((font.stretch ?? 100) / 100) + text.length * font.tracking * 100;

export function fontSpec(block: TextBlock): MeasureFont {
  const font = fontById(block.font);
  return {
    family: cssFamily(font),
    weight: nearestWeight(font, block.weight),
    ...(font.width ? { stretch: Math.round(block.stretch) } : {}),
    italic: block.italic && font.italic,
    tracking: block.tracking,
  };
}

export function wrap(text: string, maxWidth: number, widthOf: (line: string) => number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) { lines.push(''); continue; }
    let line = words[0];
    for (const word of words.slice(1)) {
      const next = `${line} ${word}`;
      if (widthOf(next) <= maxWidth) line = next;
      else { lines.push(line); line = word; }
    }
    lines.push(line);
  }
  while (lines.length && !lines[0]) lines.shift();
  while (lines.length && !lines[lines.length - 1]) lines.pop();
  return lines;
}

/* -------------------------------- layout -------------------------------- */

export interface Box { x: number; y: number; w: number; h: number }

export interface Placed {
  id: string;
  lines: string[];
  size: number;
  anchor: 'start' | 'middle' | 'end';
  x: number;
  baselines: number[];
  /** The ink, roughly: for selecting and dragging. */
  box: Box;
}

const blockHeight = (lines: number, size: number, leading: number): number =>
  lines ? size * CAP + (lines - 1) * size * leading + size * 0.26 : 0;

export function layoutPoster(p: Poster, measure: Measure): Placed[] {
  const { w: W, h: H } = FORMATS[p.format];
  const m = Math.min(W, H);
  const margin = m * 0.075 * p.spacing;
  const gap = m * 0.034 * p.spacing;
  const contentW = W - margin * 2;
  const contentH = H - margin * 2;

  const sized = p.blocks.map((block) => {
    const spec = fontSpec(block);
    const text = applyCase(block.text, block.textCase);
    const boxW = contentW * Math.min(1, Math.max(0.2, block.width));
    const widthOf = (line: string, size: number) => (measure(line, spec) * size) / 100;
    let size = Math.max(4, block.size * m);
    if (block.fit) {
      const longest = Math.max(0, ...text.split(/\s+/).filter(Boolean).map((word) => widthOf(word, size)));
      if (longest > boxW) size *= (boxW / longest) * 0.98;
    }
    let lines = wrap(text, boxW, (line) => widthOf(line, size));
    const tall = blockHeight(lines.length, size, block.leading);
    if (tall > contentH) {
      size *= contentH / tall;
      lines = wrap(text, boxW, (line) => widthOf(line, size));
    }
    const widest = Math.max(0, ...lines.map((line) => widthOf(line, size)));
    return { block, size, lines, boxW, widest, height: blockHeight(lines.length, size, block.leading) };
  });

  const visible = sized.filter((s) => s.lines.length);
  const gapAfter = (s: (typeof sized)[number]) => (s.block.role === 'headline' ? gap * 1.5 : gap);
  const stack = (items: typeof sized) => items.reduce((sum, s, i) => sum + s.height + (i < items.length - 1 ? gapAfter(s) : 0), 0);

  const tops = new Map<string, number>();
  const place = (items: typeof sized, top: number) => {
    let y = top;
    for (const s of items) { tops.set(s.block.id, y); y += s.height + gapAfter(s); }
  };
  if (p.layout === 'top') place(visible, margin);
  else if (p.layout === 'center') place(visible, (H - stack(visible)) / 2);
  else if (p.layout === 'bottom') place(visible, H - margin - stack(visible));
  else if (p.layout === 'split') {
    place(visible.slice(0, 1), margin);
    const rest = visible.slice(1);
    place(rest, H - margin - stack(rest));
  } else {
    const last = visible.slice(-1);
    const rest = visible.slice(0, -1);
    place(last, margin);
    place(rest, H - margin - stack(rest));
  }

  return sized.map((s) => {
    const { block, size, lines, boxW, widest } = s;
    const boxX = p.align === 'left' ? margin : p.align === 'center' ? (W - boxW) / 2 : W - margin - boxW;
    const trailing = block.tracking * size;
    const anchor = p.align === 'left' ? 'start' : p.align === 'center' ? 'middle' : 'end';
    const offsetX = block.dx * W;
    const top = (tops.get(block.id) ?? margin) + block.dy * H;
    const x = (p.align === 'left' ? boxX : p.align === 'center' ? boxX + boxW / 2 + trailing / 2 : boxX + boxW + trailing) + offsetX;
    const inkLeft = (p.align === 'left' ? boxX : p.align === 'center' ? boxX + (boxW - widest) / 2 : boxX + boxW - widest) + offsetX;
    return {
      id: block.id,
      lines,
      size,
      anchor,
      x,
      baselines: lines.map((_, i) => top + size * CAP + i * size * block.leading),
      box: { x: inkLeft, y: top, w: widest, h: s.height },
    };
  });
}

/* ---------------------------------- svg ---------------------------------- */

const f = (n: number): string => String(Math.round(n * 10) / 10);

export function shapeMarkup(s: PosterShape, W: number, H: number): string {
  const r = (s.size * Math.min(W, H)) / 2;
  const paint = `fill="${s.color}"`;
  let body: string;
  switch (s.kind) {
    case 'square': body = `<rect x="${f(-r)}" y="${f(-r)}" width="${f(2 * r)}" height="${f(2 * r)}" ${paint}/>`; break;
    case 'triangle': body = `<polygon points="0,${f(-r)} ${f(r * 0.866)},${f(r * 0.5)} ${f(-r * 0.866)},${f(r * 0.5)}" ${paint}/>`; break;
    case 'arch': body = `<path d="M${f(-r * 0.8)} ${f(r)}V${f(-r * 0.2)}A${f(r * 0.8)} ${f(r * 0.8)} 0 0 1 ${f(r * 0.8)} ${f(-r * 0.2)}V${f(r)}Z" ${paint}/>`; break;
    case 'half': body = `<path d="M${f(-r)} ${f(r * 0.5)}A${f(r)} ${f(r)} 0 0 1 ${f(r)} ${f(r * 0.5)}Z" ${paint}/>`; break;
    case 'ring': body = `<circle r="${f(r * 0.84)}" fill="none" stroke="${s.color}" stroke-width="${f(r * 0.32)}"/>`; break;
    case 'star': {
      const n = 12;
      const pts = Array.from({ length: n * 2 }, (_, i) => {
        const a = (i * Math.PI) / n - Math.PI / 2;
        const rr = i % 2 ? r * 0.74 : r;
        return `${f(Math.cos(a) * rr)},${f(Math.sin(a) * rr)}`;
      });
      body = `<polygon points="${pts.join(' ')}" ${paint}/>`;
      break;
    }
    case 'stripes': {
      const band = (2 * r) / 5;
      body = Array.from({ length: 5 }, (_, i) => `<rect x="${f(-r)}" y="${f(-r + i * band)}" width="${f(2 * r)}" height="${f(band * 0.55)}" ${paint}/>`).join('');
      break;
    }
    case 'blob': {
      let t = s.seed >>> 0;
      const next = () => { t = (t * 1664525 + 1013904223) >>> 0; return t / 4294967296; };
      const pts = Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        const rr = r * (0.78 + next() * 0.3);
        return [Math.cos(a) * rr, Math.sin(a) * rr];
      });
      body = `<path d="${smoothClosed(pts)}" ${paint}/>`;
      break;
    }
    case 'circle':
    default:
      body = `<circle r="${f(r)}" ${paint}/>`;
  }
  const opacity = s.opacity < 1 ? ` opacity="${Math.round(s.opacity * 100) / 100}"` : '';
  return `<g transform="translate(${f(s.x * W)} ${f(s.y * H)})${s.rotation ? ` rotate(${f(s.rotation)})` : ''}"${opacity}>${body}</g>`;
}

export function posterSvg(p: Poster, placed: Placed[], opts: { fontCss?: string; pixelWidth?: number } = {}): string {
  const { w: W, h: H } = FORMATS[p.format];
  const pw = opts.pixelWidth ?? W;
  const ph = Math.round((pw / W) * H);
  const text = placed.map((pl) => {
    const block = p.blocks.find((b) => b.id === pl.id);
    if (!block || !pl.lines.length) return '';
    const spec = fontSpec(block);
    const attrs =
      `font-family="${escapeXml(spec.family)}" font-size="${f(pl.size)}" font-weight="${spec.weight}"` +
      (spec.stretch ? ` style="font-stretch:${spec.stretch}%"` : '') +
      (spec.italic ? ' font-style="italic"' : '') +
      ` letter-spacing="${f(block.tracking * pl.size)}" fill="${p.ink}" text-anchor="${pl.anchor}"`;
    return pl.lines.map((line, i) => `<text x="${f(pl.x)}" y="${f(pl.baselines[i])}" ${attrs} xml:space="preserve">${escapeXml(line)}</text>`).join('');
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${pw}" height="${ph}" viewBox="0 0 ${W} ${H}">` +
    (opts.fontCss ? `<defs><style>${opts.fontCss}</style></defs>` : '') +
    `<rect width="${W}" height="${H}" fill="${p.background}"/>` +
    p.shapes.map((s) => shapeMarkup(s, W, H)).join('') +
    text + '</svg>';
}

/* ------------------------------ templates ------------------------------ */

let counter = 0;
export const uid = (prefix: string): string => `${prefix}${Date.now().toString(36)}${(counter++).toString(36)}`;

const block = (role: Role, label: string, text: string, props: Partial<TextBlock>): TextBlock => ({
  id: uid('b'), role, label, text, font: 'inter', weight: 500, stretch: 100, italic: false, size: 0.034,
  tracking: 0, leading: 1.3, textCase: 'normal', width: 1, fit: false, dx: 0, dy: 0, ...props,
});

/** A text and background colour pair that reads, from the palette when it can. */
function pair(palette: readonly string[], rng: Rng, mode: 'light' | 'dark' | 'color'): { background: string; ink: string } {
  const picked = colourPair(palette, rng, mode);
  const background = picked.background === 'light' ? LIGHT : picked.background === 'dark' ? DARK : picked.backgroundColor;
  return { background, ink: picked.color };
}

/** Palette colours that show against the background and are not the text colour. */
export function shapeColours(palette: readonly string[], background: string, ink: string): string[] {
  const usable = palette.filter((c) => c.toUpperCase() !== background.toUpperCase() && c.toUpperCase() !== ink.toUpperCase() && contrast(c, background) >= 1.3);
  return usable.length ? usable : [ink];
}

export function makeShape(kind: ShapeKind, color: string, props: Partial<PosterShape> = {}): PosterShape {
  return { id: uid('s'), kind, x: 0.5, y: 0.4, size: 0.6, rotation: 0, color, opacity: 1, seed: Math.floor(Math.random() * 1e9), ...props };
}

export function templatePoster(id: TemplateId, format: FormatId, palette: readonly string[], rng: Rng): Poster {
  const base = { v: 1 as const, format, template: id, spacing: 1, align: 'left' as Align };
  switch (id) {
    case 'quote': {
      const colors = pair(palette, rng, 'light');
      return { ...base, ...colors, layout: 'center', shapes: [], blocks: [
        block('headline', 'Quote', '“Make the thing you wish existed.”', { font: 'instrument', weight: 400, size: 0.12, leading: 1, tracking: -0.02, width: 0.94, fit: true }),
        block('detail', 'Attribution', '— A note to self', { font: 'plex', weight: 400, size: 0.03, tracking: 0.06, textCase: 'upper' }),
      ] };
    }
    case 'announcement': {
      const colors = pair(palette, rng, 'color');
      return { ...base, ...colors, layout: 'bottom',
        shapes: [makeShape('circle', shapeColours(palette, colors.background, colors.ink)[0], { x: 0.72, y: 0.28, size: 0.72 })],
        blocks: [
          block('headline', 'Headline', 'Big news.', { font: 'archivo', weight: 900, stretch: 75, size: 0.2, leading: 0.86, tracking: -0.01, textCase: 'upper', fit: true }),
          block('text', 'Supporting text', 'We’re opening a small studio on the corner of Fifth and Main. Come and say hello.', { size: 0.036, width: 0.74 }),
          block('detail', 'Detail', 'Opening Saturday', { weight: 700, size: 0.026, tracking: 0.1, textCase: 'upper' }),
        ] };
    }
    case 'event': {
      const colors = pair(palette, rng, 'dark');
      return { ...base, ...colors, layout: 'split',
        shapes: [makeShape('half', shapeColours(palette, colors.background, colors.ink)[0], { x: 0.62, y: 0.52, size: 0.7 })],
        blocks: [
          block('headline', 'Title', 'Night Market', { font: 'syne', weight: 800, size: 0.16, leading: 0.92, tracking: -0.02, width: 0.9, fit: true }),
          block('text', 'Date', 'Saturday 14 June · 7–11 pm', { weight: 700, size: 0.045, leading: 1.15 }),
          block('detail', 'Location', 'Riverside Warehouse, Pier 4', { size: 0.032 }),
        ] };
    }
    case 'minimal': {
      const colors = pair(palette, rng, rng.chance(0.5) ? 'light' : 'dark');
      return { ...base, ...colors, layout: 'flip', spacing: 1.2, shapes: [], blocks: [
        block('headline', 'Word', 'Less.', { font: 'inter', weight: 900, size: 0.34, leading: 0.85, tracking: -0.06, fit: true }),
        block('detail', 'Caption', 'A small exhibition about enough', { font: 'plex', weight: 400, size: 0.024, tracking: 0.02 }),
      ] };
    }
    case 'experimental':
    default: {
      const colors = pair(palette, rng, 'light');
      const inks = shapeColours(palette, colors.background, colors.ink);
      return { ...base, ...colors, template: 'experimental', layout: 'bottom',
        shapes: [
          makeShape('circle', inks[0], { x: 0.3, y: 0.3, size: 0.66 }),
          makeShape('triangle', inks[1 % inks.length], { x: 0.72, y: 0.36, size: 0.6, rotation: 15 }),
          makeShape('arch', inks[2 % inks.length], { x: 0.5, y: 0.56, size: 0.42 }),
        ],
        blocks: [
          block('headline', 'Headline', 'Odd shapes', { font: 'archivo', weight: 900, stretch: 62, size: 0.17, leading: 0.82, textCase: 'upper', fit: true }),
          block('text', 'Supporting text', 'A festival of things that don’t quite fit', { font: 'plex', weight: 600, size: 0.03, tracking: 0.04, textCase: 'upper', width: 0.62 }),
        ] };
    }
  }
}

/** Switch template, keeping the words you have already written, role for role. */
export function applyTemplate(p: Poster, id: TemplateId, palette: readonly string[], rng: Rng): Poster {
  const next = templatePoster(id, p.format, palette, rng);
  const written = new Map(p.blocks.map((b) => [b.role, b.text]));
  return { ...next, blocks: next.blocks.map((b) => (written.has(b.role) && written.get(b.role)!.trim() ? { ...b, text: written.get(b.role)! } : b)) };
}

/* ------------------------------ surprise me ------------------------------ */

type Type = Pick<TextBlock, 'font' | 'weight' | 'stretch' | 'italic' | 'textCase' | 'tracking' | 'leading'>;

/* Pairings chosen to work together, rather than any two fonts at random. */
const PAIRS: { head: Type; body: Type }[] = [
  { head: { font: 'archivo', weight: 900, stretch: 70, italic: false, textCase: 'upper', tracking: -0.01, leading: 0.84 }, body: { font: 'inter', weight: 500, stretch: 100, italic: false, textCase: 'normal', tracking: 0, leading: 1.3 } },
  { head: { font: 'instrument', weight: 400, stretch: 100, italic: false, textCase: 'normal', tracking: -0.02, leading: 0.96 }, body: { font: 'plex', weight: 400, stretch: 100, italic: false, textCase: 'upper', tracking: 0.05, leading: 1.4 } },
  { head: { font: 'instrument', weight: 400, stretch: 100, italic: true, textCase: 'normal', tracking: -0.02, leading: 0.96 }, body: { font: 'inter', weight: 500, stretch: 100, italic: false, textCase: 'normal', tracking: 0, leading: 1.3 } },
  { head: { font: 'syne', weight: 800, stretch: 100, italic: false, textCase: 'normal', tracking: -0.03, leading: 0.9 }, body: { font: 'inter', weight: 500, stretch: 100, italic: false, textCase: 'normal', tracking: 0, leading: 1.3 } },
  { head: { font: 'inter', weight: 900, stretch: 100, italic: false, textCase: 'normal', tracking: -0.05, leading: 0.86 }, body: { font: 'instrument', weight: 400, stretch: 100, italic: true, textCase: 'normal', tracking: 0, leading: 1.2 } },
  { head: { font: 'plex', weight: 600, stretch: 100, italic: false, textCase: 'upper', tracking: 0.02, leading: 1 }, body: { font: 'plex', weight: 400, stretch: 100, italic: false, textCase: 'normal', tracking: 0, leading: 1.45 } },
  { head: { font: 'archivo', weight: 800, stretch: 115, italic: false, textCase: 'normal', tracking: -0.03, leading: 0.9 }, body: { font: 'archivo', weight: 500, stretch: 100, italic: false, textCase: 'normal', tracking: 0, leading: 1.3 } },
];

const LAYOUT_CHOICES: Record<TemplateId, LayoutId[]> = {
  quote: ['center', 'top', 'bottom'],
  announcement: ['bottom', 'top', 'split'],
  event: ['split', 'flip', 'top', 'bottom'],
  minimal: ['flip', 'bottom', 'center'],
  experimental: ['bottom', 'top', 'center'],
};

const HEADLINE_SIZE: Record<TemplateId, number> = { quote: 0.12, announcement: 0.18, event: 0.15, minimal: 0.3, experimental: 0.16 };

function overlaps(shape: PosterShape, box: Box, W: number, H: number): boolean {
  const r = (shape.size * Math.min(W, H)) / 2;
  const cx = shape.x * W;
  const cy = shape.y * H;
  const nx = Math.max(box.x, Math.min(cx, box.x + box.w));
  const ny = Math.max(box.y, Math.min(cy, box.y + box.h));
  return Math.hypot(cx - nx, cy - ny) < r;
}

/**
 * Surprise me: layout, type, colour, shape, scale, alignment and spacing all
 * change; your words do not. Every choice comes from a short list of things
 * that work, and a shape that would sit behind text it makes hard to read is
 * faded back until it doesn't.
 */
export function surprise(p: Poster, palette: readonly string[], rng: Rng, measure: Measure = approxMeasure): Poster {
  const layout = rng.pick(LAYOUT_CHOICES[p.template]);
  const align: Align = layout === 'center' ? (rng.chance(0.6) ? 'center' : 'left') : rng.pick(['left', 'left', 'left', 'center', 'right'] as const);
  const { head, body } = rng.pick(PAIRS);
  const colors = pair(palette, rng, rng.pick(['light', 'dark', 'color', 'color'] as const));
  const blocks = p.blocks.map((b) => {
    if (b.role === 'headline') {
      return { ...b, ...head, size: HEADLINE_SIZE[p.template] * rng.range(0.82, 1.2), width: rng.pick([1, 1, 0.86]), fit: true, dx: 0, dy: 0 };
    }
    const detail = b.role === 'detail';
    return {
      ...b, ...body,
      ...(detail ? { textCase: rng.chance(0.5) ? 'upper' as Case : body.textCase, tracking: rng.chance(0.5) ? 0.08 : body.tracking } : {}),
      size: (detail ? 0.026 : 0.035) * rng.range(0.9, 1.15),
      width: detail ? 1 : rng.pick([0.6, 0.72, 0.86]),
      dx: 0, dy: 0,
    };
  });

  const inks = shapeColours(palette, colors.background, colors.ink);
  const kinds: ShapeKind[] = ['circle', 'half', 'arch', 'ring', 'blob', 'star', 'square', 'triangle', 'stripes'];
  let shapes: PosterShape[] = [];
  const mirror = (x: number) => (align === 'right' ? 1 - x : x);
  if (p.template === 'experimental') {
    const count = rng.int(2, 3);
    shapes = Array.from({ length: count }, (_, i) => makeShape(rng.pick(kinds), inks[i % inks.length], {
      x: rng.range(0.2, 0.8), y: rng.range(0.18, 0.62), size: rng.range(0.35, 0.75), rotation: rng.pick([0, 0, 15, -20, 45]), seed: rng.int(1, 1e9),
    }));
  } else if (rng.chance(0.72)) {
    const kind = rng.pick(kinds);
    const place: Record<LayoutId, () => Partial<PosterShape>> = {
      bottom: () => ({ x: mirror(rng.range(0.45, 0.78)), y: rng.range(0.2, 0.36), size: rng.range(0.55, 0.95) }),
      top: () => ({ x: mirror(rng.range(0.45, 0.78)), y: rng.range(0.64, 0.82), size: rng.range(0.5, 0.9) }),
      center: () => ({ x: 0.5, y: 0.5, size: rng.range(0.8, 1.15), opacity: rng.range(0.16, 0.3) }),
      split: () => ({ x: mirror(rng.range(0.6, 0.82)), y: rng.range(0.45, 0.58), size: rng.range(0.4, 0.7) }),
      flip: () => ({ x: mirror(rng.range(0.55, 0.8)), y: rng.range(0.35, 0.55), size: rng.range(0.5, 0.8) }),
    };
    shapes = [makeShape(kind, rng.pick(inks), { ...place[layout](), rotation: kind === 'triangle' || kind === 'square' ? rng.pick([0, 12, -15, 45]) : 0, seed: rng.int(1, 1e9) })];
  }

  const next: Poster = { ...p, layout, align, spacing: rng.pick([0.8, 1, 1, 1.2, 1.45]), ...colors, blocks, shapes };
  const { w: W, h: H } = FORMATS[p.format];
  const placed = layoutPoster(next, measure);
  next.shapes = next.shapes.map((s) => {
    const hidesText = placed.some((pl) => pl.lines.length && overlaps(s, pl.box, W, H));
    return hidesText && contrast(next.ink, s.color) < 3 ? { ...s, opacity: Math.min(s.opacity, 0.22) } : s;
  });
  return next;
}

/** The colours that describe a poster, for its chip in Recent and Saved. */
export const posterColours = (p: Poster): string[] => [p.background, p.ink, ...p.shapes.map((s) => s.color)].slice(0, 5);

export function validPoster(value: unknown): value is Poster {
  const p = value as Partial<Poster> | null;
  return !!p && p.v === 1 && !!p.format && p.format in FORMATS && Array.isArray(p.blocks) && Array.isArray(p.shapes)
    && typeof p.background === 'string' && typeof p.ink === 'string';
}

/** Light or dark, for choosing the selection outline over the poster. */
export const isDark = (hex: string): boolean => luminance(hex) < 0.35;
