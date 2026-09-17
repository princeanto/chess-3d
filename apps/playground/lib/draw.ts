/**
 * DRAW's document: strokes, not pixels.
 *
 * A drawing is a list of strokes in its own coordinates — the origin at the
 * centre of the canvas, 1000 units across its shorter side. That one decision
 * is what lets the window resize without destroying the drawing (it is simply
 * drawn again at the new size), what makes undo a matter of dropping the last
 * stroke, and what makes SVG export exact rather than traced.
 *
 * Symmetry is stored per stroke, so switching it on later does not rewrite
 * what was already drawn. Everything here is pure; lib/drawRender.ts paints.
 */

export const UNITS = 1000;

export type Brush = 'pencil' | 'marker' | 'eraser' | 'line' | 'rect' | 'circle';

export const BRUSHES: { id: Brush; label: string; key: string }[] = [
  { id: 'pencil', label: 'Pencil', key: '1' },
  { id: 'marker', label: 'Marker', key: '2' },
  { id: 'eraser', label: 'Eraser', key: '3' },
  { id: 'line', label: 'Line', key: '4' },
  { id: 'rect', label: 'Rectangle', key: '5' },
  { id: 'circle', label: 'Circle', key: '6' },
];

export const SHAPES: readonly Brush[] = ['line', 'rect', 'circle'];
export const isShape = (brush: Brush): boolean => SHAPES.includes(brush);

export interface BrushSettings { size: number; opacity: number }

export const BRUSH_DEFAULTS: Record<Brush, BrushSettings> = {
  pencil: { size: 4, opacity: 1 },
  marker: { size: 18, opacity: 0.7 },
  eraser: { size: 30, opacity: 1 },
  line: { size: 5, opacity: 1 },
  rect: { size: 5, opacity: 1 },
  circle: { size: 5, opacity: 1 },
};

export type SymmetryMode = 'none' | 'vertical' | 'horizontal' | 'radial';
export const SEGMENTS = [2, 4, 6, 8, 12] as const;
export interface Symmetry { mode: SymmetryMode; segments: number }

export type GridSize = 'small' | 'medium' | 'large';
export const GRID_STEP: Record<GridSize, number> = { small: 25, medium: 50, large: 100 };

export interface Stroke {
  /** Brush. */
  b: Brush;
  /** Colour. */
  c: string;
  /** Size, in document units. */
  s: number;
  /** Opacity, 0–1. */
  o: number;
  /** Points as x, y, x, y… Shapes have exactly two: start and end. */
  p: number[];
  /** Pen pressure per point, 0–1, when drawn with a stylus. */
  w?: number[];
  /** Symmetry: 'n', 'v', 'h' or 'r' plus segments, like 'r6'. */
  y: string;
}

export type Ground = 'light' | 'dark' | 'color' | 'transparent';

export interface DrawDoc {
  v: 1;
  strokes: Stroke[];
  ground: Ground;
  groundColor: string;
}

export const EMPTY_DOC: DrawDoc = { v: 1, strokes: [], ground: 'light', groundColor: '#F2C14E' };
export const PAPER = '#FFFFFF';
export const INK = '#111111';

export function groundColor(doc: Pick<DrawDoc, 'ground' | 'groundColor'>): string | null {
  if (doc.ground === 'light') return PAPER;
  if (doc.ground === 'dark') return INK;
  if (doc.ground === 'color') return doc.groundColor;
  return null;
}

/* -------------------------------- symmetry -------------------------------- */

export function symmetryCode(sym: Symmetry): string {
  if (sym.mode === 'vertical') return 'v';
  if (sym.mode === 'horizontal') return 'h';
  if (sym.mode === 'radial') return `r${sym.segments}`;
  return 'n';
}

/** A linear map about the origin, in canvas order: x' = a·x + c·y, y' = b·x + d·y. */
export type Matrix = [number, number, number, number];

export function transforms(code: string): Matrix[] {
  if (code === 'v') return [[1, 0, 0, 1], [-1, 0, 0, 1]];
  if (code === 'h') return [[1, 0, 0, 1], [1, 0, 0, -1]];
  const radial = /^r(\d+)$/.exec(code);
  if (radial) {
    const n = Math.max(1, Math.min(24, Number(radial[1])));
    return Array.from({ length: n }, (_, k) => {
      const t = (k * 2 * Math.PI) / n;
      // Exact at the quarter turns, so a 4-way copy lands on the same pixels.
      const cos = Math.round(Math.cos(t) * 1e9) / 1e9;
      const sin = Math.round(Math.sin(t) * 1e9) / 1e9;
      return [cos, sin, -sin, cos] as Matrix;
    });
  }
  return [[1, 0, 0, 1]];
}

export const apply = ([a, b, c, d]: Matrix, x: number, y: number): [number, number] => [a * x + c * y, b * x + d * y];

/* --------------------------------- shapes --------------------------------- */

/**
 * The end of a shape drag, with the usual modifiers: Shift keeps a line to
 * 45° steps and makes a rectangle square and an ellipse round; Alt draws from
 * the centre instead of the corner.
 */
export function constrain(brush: Brush, x0: number, y0: number, x1: number, y1: number, keys: { shift?: boolean; alt?: boolean } = {}): number[] {
  let ex = x1;
  let ey = y1;
  if (keys.shift) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    if (brush === 'line') {
      const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
      const length = Math.hypot(dx, dy);
      ex = x0 + Math.round(Math.cos(angle) * 1e9) / 1e9 * length;
      ey = y0 + Math.round(Math.sin(angle) * 1e9) / 1e9 * length;
    } else {
      const side = Math.max(Math.abs(dx), Math.abs(dy));
      ex = x0 + (dx < 0 ? -side : side);
      ey = y0 + (dy < 0 ? -side : side);
    }
  }
  if (keys.alt) return [x0 - (ex - x0), y0 - (ey - y0), ex, ey];
  return [x0, y0, ex, ey];
}

/* -------------------------------- freehand -------------------------------- */

export interface Segment {
  x0: number; y0: number;
  /** Quadratic control point; absent for a straight piece. */
  cx?: number; cy?: number;
  x1: number; y1: number;
  /** Which point's pressure this piece takes. */
  i: number;
}

/**
 * A smooth line through the points: quadratic curves from midpoint to
 * midpoint, with each recorded point as the control. It passes near every
 * point rather than through it, which is what takes the jitter out of a hand.
 */
export function segments(p: readonly number[]): Segment[] {
  const n = p.length / 2;
  if (n < 2) return [];
  if (n === 2) return [{ x0: p[0], y0: p[1], x1: p[2], y1: p[3], i: 1 }];
  const out: Segment[] = [];
  let sx = p[0];
  let sy = p[1];
  for (let i = 1; i < n - 1; i += 1) {
    const mx = (p[2 * i] + p[2 * i + 2]) / 2;
    const my = (p[2 * i + 1] + p[2 * i + 3]) / 2;
    out.push({ x0: sx, y0: sy, cx: p[2 * i], cy: p[2 * i + 1], x1: mx, y1: my, i });
    sx = mx;
    sy = my;
  }
  out.push({ x0: sx, y0: sy, x1: p[2 * n - 2], y1: p[2 * n - 1], i: n - 1 });
  return out;
}

/** Line width at a point: pressure thins a stylus line, never to nothing. */
export function widthAt(stroke: Pick<Stroke, 's' | 'w'>, i: number): number {
  const pressure = stroke.w?.[i];
  return pressure === undefined ? stroke.s : stroke.s * (0.25 + 0.75 * Math.max(0, Math.min(1, pressure)));
}

/** Whether a new point is far enough from the last to be worth keeping. */
export function farEnough(p: readonly number[], x: number, y: number, min: number): boolean {
  const n = p.length;
  return n < 2 || Math.hypot(x - p[n - 2], y - p[n - 1]) >= min;
}

const r1 = (n: number): number => Math.round(n * 10) / 10;

/** Rounds a finished stroke for storage: a tenth of a unit is invisible. */
export function finish(stroke: Stroke): Stroke {
  const out: Stroke = { b: stroke.b, c: stroke.c, s: r1(stroke.s), o: Math.round(stroke.o * 100) / 100, p: stroke.p.map(r1), y: stroke.y };
  if (stroke.w && stroke.w.length) {
    // Even pressure is just a width: store it as one, at the width it was drawn.
    if (stroke.w.every((v) => v === stroke.w![0])) out.s = r1(widthAt(stroke, 0));
    else out.w = stroke.w.map((v) => Math.round(v * 100) / 100);
  }
  return out;
}

/** The area a stroke can touch, symmetry copies included. */
export function bounds(stroke: Stroke): [number, number, number, number] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const pts: number[] = stroke.p.slice();
  if (stroke.b === 'circle' || stroke.b === 'rect') pts.push(stroke.p[0], stroke.p[3], stroke.p[2], stroke.p[1]);
  for (const m of transforms(stroke.y)) {
    for (let i = 0; i < pts.length; i += 2) {
      const [x, y] = apply(m, pts[i], pts[i + 1]);
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  const pad = stroke.s / 2 + 1;
  return [minX - pad, minY - pad, maxX + pad, maxY + pad];
}

/** A shape whose drag was too small to mean anything. */
export function isEmptyShape(stroke: Stroke, min: number): boolean {
  return isShape(stroke.b) && Math.hypot(stroke.p[2] - stroke.p[0], stroke.p[3] - stroke.p[1]) < min;
}

/* ----------------------------------- svg ---------------------------------- */

const f = (n: number): string => String(Math.round(n * 10) / 10);

function shapeMarkup(stroke: Stroke, color: string): string {
  const [x0, y0, x1, y1] = stroke.p;
  const line = `fill="none" stroke="${color}" stroke-width="${f(stroke.s)}" stroke-linecap="round" stroke-linejoin="round"`;
  if (stroke.b === 'line') return `<path d="M${f(x0)} ${f(y0)}L${f(x1)} ${f(y1)}" ${line}/>`;
  if (stroke.b === 'rect') {
    return `<rect x="${f(Math.min(x0, x1))}" y="${f(Math.min(y0, y1))}" width="${f(Math.abs(x1 - x0))}" height="${f(Math.abs(y1 - y0))}" ${line}/>`;
  }
  if (stroke.b === 'circle') {
    return `<ellipse cx="${f((x0 + x1) / 2)}" cy="${f((y0 + y1) / 2)}" rx="${f(Math.abs(x1 - x0) / 2)}" ry="${f(Math.abs(y1 - y0) / 2)}" ${line}/>`;
  }
  const p = stroke.p;
  if (p.length === 2) return `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="${f(widthAt(stroke, 0) / 2)}" fill="${color}"/>`;
  const segs = segments(p);
  const piece = (s: Segment) => (s.cx === undefined ? `L${f(s.x1)} ${f(s.y1)}` : `Q${f(s.cx)} ${f(s.cy!)} ${f(s.x1)} ${f(s.y1)}`);
  if (stroke.w) {
    return segs.map((s) => `<path d="M${f(s.x0)} ${f(s.y0)}${piece(s)}" fill="none" stroke="${color}" stroke-width="${f(widthAt(stroke, s.i))}" stroke-linecap="round"/>`).join('');
  }
  return `<path d="M${f(segs[0].x0)} ${f(segs[0].y0)}${segs.map(piece).join('')}" ${line}/>`;
}

function strokeMarkup(stroke: Stroke, color: string): string {
  const one = shapeMarkup(stroke, color);
  const copies = transforms(stroke.y)
    .map(([a, b, c, d], k) => (k === 0 && a === 1 && d === 1 && b === 0 && c === 0 ? one : `<g transform="matrix(${a} ${b} ${c} ${d} 0 0)">${one}</g>`))
    .join('');
  // A group's opacity applies once to the whole, as on the canvas: overlapping
  // copies and segments of one stroke do not darken each other.
  return stroke.o < 1 ? `<g opacity="${stroke.o}">${copies}</g>` : copies;
}

/**
 * Strokes as SVG markup, over the area `box`.
 *
 * The eraser is a mask over everything drawn before it, so it removes ink and
 * leaves the background — exactly what it did on screen. Mask ids start with
 * `prefix`, so two drawings in one page never share one.
 */
export function strokesMarkup(strokes: readonly Stroke[], box: { x: number; y: number; w: number; h: number }, prefix = 'erase'): { defs: string; body: string } {
  let body = '';
  let defs = '';
  strokes.forEach((stroke, k) => {
    if (stroke.b === 'eraser') {
      if (!body) return;
      defs += `<mask id="${prefix}${k}" maskUnits="userSpaceOnUse" x="${f(box.x)}" y="${f(box.y)}" width="${f(box.w)}" height="${f(box.h)}">` +
        `<rect x="${f(box.x)}" y="${f(box.y)}" width="${f(box.w)}" height="${f(box.h)}" fill="#fff"/>${strokeMarkup(stroke, '#000')}</mask>`;
      body = `<g mask="url(#${prefix}${k})">${body}</g>`;
    } else {
      body += strokeMarkup(stroke, stroke.c);
    }
  });
  return { defs, body };
}

/** The drawing as SVG, over the area `box` (document units). */
export function docSvg(doc: DrawDoc, box: { x: number; y: number; w: number; h: number }, pixelWidth: number = box.w): string {
  const { defs, body } = strokesMarkup(doc.strokes, box);
  const ground = groundColor(doc);
  const ph = Math.round((pixelWidth / box.w) * box.h);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(pixelWidth)}" height="${ph}" viewBox="${f(box.x)} ${f(box.y)} ${f(box.w)} ${f(box.h)}">` +
    (defs ? `<defs>${defs}</defs>` : '') +
    (ground ? `<rect x="${f(box.x)}" y="${f(box.y)}" width="${f(box.w)}" height="${f(box.h)}" fill="${ground}"/>` : '') +
    `${body}</svg>`;
}

/** The colours a drawing uses most, for its chip in Recent and Saved. */
export function colorsUsed(doc: DrawDoc, limit = 5): string[] {
  const counts = new Map<string, number>();
  for (const stroke of doc.strokes) if (stroke.b !== 'eraser') counts.set(stroke.c, (counts.get(stroke.c) ?? 0) + stroke.p.length);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c).slice(0, limit - 1);
  const ground = groundColor(doc);
  return ground ? [ground, ...top] : top;
}

const HEX = /^#[0-9a-f]{6}$/i;

export function validDoc(value: unknown): value is DrawDoc {
  if (!value || typeof value !== 'object') return false;
  const d = value as Partial<DrawDoc>;
  return d.v === 1 && Array.isArray(d.strokes) && typeof d.ground === 'string' && typeof d.groundColor === 'string'
    && d.strokes.every((s) => s && BRUSHES.some((b) => b.id === s.b) && HEX.test(s.c) && typeof s.s === 'number'
      && typeof s.o === 'number' && Array.isArray(s.p) && s.p.length >= 2 && s.p.length % 2 === 0 && typeof s.y === 'string');
}
