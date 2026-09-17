/** Proportions for people who make things: ratios, grids, screens. */

export const gcd = (a: number, b: number): number => {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y) [x, y] = [y, x % y];
  return x || 1;
};

const NAMED: [number, number][] = [[1, 1], [5, 4], [4, 3], [3, 2], [16, 10], [16, 9], [2, 1], [21, 9], [32, 9], [4, 5], [2, 3], [9, 16], [9, 19.5], [1, 1.414]];

export interface Ratio { w: number; h: number; decimal: number; nearest: string | null }

/** 1920 × 1080 → 16:9. 1366 × 768 → 683:384, which is close to 16:9. */
export function aspectRatio(width: number, height: number): Ratio | null {
  if (!(width > 0) || !(height > 0)) return null;
  const whole = Number.isInteger(width) && Number.isInteger(height);
  const k = whole ? gcd(width, height) : 1;
  const w = whole ? width / k : Math.round((width / height) * 100) / 100;
  const h = whole ? height / k : 1;
  const decimal = width / height;
  let nearest: string | null = null;
  let best = Infinity;
  for (const [a, b] of NAMED) {
    const off = Math.abs(a / b - decimal) / (a / b);
    if (off < best) { best = off; nearest = `${a}:${b}`; }
  }
  const exact = `${w}:${h}`;
  return { w, h, decimal, nearest: best < 0.02 && nearest !== exact ? nearest : null };
}

export const heightFor = (width: number, rw: number, rh: number): number => (width * rh) / rw;
export const widthFor = (height: number, rw: number, rh: number): number => (height * rw) / rh;

export const PHI = (1 + Math.sqrt(5)) / 2;

export function goldenRatio(value: number) {
  return {
    larger: value * PHI,
    smaller: value / PHI,
    /** The value cut in two, golden-section: long part and short part. */
    long: value / PHI,
    short: value - value / PHI,
  };
}

export interface GridResult { column: number; content: number; columns: { start: number; end: number }[]; error?: string }

export function grid(container: number, columns: number, gutter: number, margin: number): GridResult {
  const n = Math.max(1, Math.floor(columns));
  const content = container - margin * 2;
  const column = (content - gutter * (n - 1)) / n;
  if (!(column > 0)) return { column: 0, content, columns: [], error: 'The margins and gutters are wider than the container.' };
  return {
    column,
    content,
    columns: Array.from({ length: n }, (_, i) => {
      const start = margin + i * (column + gutter);
      return { start, end: start + column };
    }),
  };
}

export function ppi(width: number, height: number, diagonal: number) {
  if (!(width > 0 && height > 0 && diagonal > 0)) return null;
  const density = Math.hypot(width, height) / diagonal;
  const aspect = width / height;
  const physicalHeight = diagonal / Math.sqrt(1 + aspect * aspect);
  return {
    ppi: density,
    dotPitch: 25.4 / density,
    widthInches: physicalHeight * aspect,
    heightInches: physicalHeight,
    megapixels: (width * height) / 1e6,
  };
}
