/**
 * SHAPE's patterns: thirteen generators, one description, any size.
 *
 * Every pattern is a pure function of its state — kind, seed, four sliders and
 * the colours — so the same state always draws the same thing, at any
 * resolution. That is what makes a seed worth copying, and what lets the
 * preview, the PNG, the SVG and the CSS all be the same picture.
 *
 * Patterns are drawn across a square field as wide as the canvas's diagonal and
 * then rotated about the centre, so turning a pattern never exposes a bare
 * corner.
 */

import { createRng, type Rng } from './random';
import { contrast, luminance, readableOn } from './color';

export type PatternKind =
  | 'grid' | 'dots' | 'lines' | 'waves' | 'circles' | 'squares' | 'triangles'
  | 'blobs' | 'rings' | 'noise' | 'checkerboard' | 'geometric' | 'organic';

export const PATTERNS: { id: PatternKind; label: string }[] = [
  { id: 'grid', label: 'Grid' },
  { id: 'dots', label: 'Dots' },
  { id: 'lines', label: 'Lines' },
  { id: 'waves', label: 'Waves' },
  { id: 'circles', label: 'Circles' },
  { id: 'squares', label: 'Squares' },
  { id: 'triangles', label: 'Triangles' },
  { id: 'blobs', label: 'Blobs' },
  { id: 'rings', label: 'Rings' },
  { id: 'noise', label: 'Noise' },
  { id: 'checkerboard', label: 'Checker' },
  { id: 'geometric', label: 'Geometric' },
  { id: 'organic', label: 'Organic' },
];

export type Aspect = 'square' | 'landscape' | 'portrait' | 'poster';

export const ASPECTS: Record<Aspect, { label: string; w: number; h: number }> = {
  square: { label: 'Square', w: 1200, h: 1200 },
  landscape: { label: 'Landscape', w: 1600, h: 900 },
  portrait: { label: 'Portrait', w: 900, h: 1600 },
  poster: { label: 'Poster', w: 1200, h: 1500 },
};

export interface PatternState {
  kind: PatternKind;
  seed: number;
  aspect: Aspect;
  /** 0–100 */
  density: number;
  /** 0–100 */
  scale: number;
  /** 0–100 */
  spacing: number;
  /** Degrees, 0–360. */
  rotation: number;
  background: string;
  colors: string[];
}

/* One decimal is plenty at these sizes, and keeps exported SVGs small. */
const f = (n: number): string => String(Math.round(n * 10) / 10);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const unit = (v: number): number => Math.min(1, Math.max(0, v / 100));
const smooth = (t: number): number => t * t * (3 - 2 * t);

interface Field {
  w: number;
  h: number;
  cx: number;
  cy: number;
  /** Side of the square field: the canvas diagonal. */
  D: number;
  x0: number;
  y0: number;
  rng: Rng;
  density: number;
  scale: number;
  spacing: number;
  colors: string[];
}

function cells(F: Field, fewest: number, most: number): { cols: number; cell: number } {
  const cols = Math.max(1, Math.round(lerp(fewest, most, F.density)));
  return { cols, cell: F.D / cols };
}

/** A closed Catmull-Rom curve through the points, as cubic Béziers. */
function smoothClosed(points: number[][]): string {
  const n = points.length;
  let d = `M${f(points[0][0])} ${f(points[0][1])}`;
  for (let i = 0; i < n; i += 1) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return `${d}Z`;
}

const GENERATORS: Record<PatternKind, (F: Field) => string> = {
  grid(F) {
    const { cols, cell } = cells(F, 4, 32);
    const width = Math.max(1, cell * lerp(0.02, 0.22, F.scale));
    // Spacing breaks the lines into dashes, from solid to a dotted lattice.
    const dash = F.spacing > 0.06
      ? ` stroke-dasharray="${f(cell * (1 - F.spacing) * 0.5)} ${f(cell * F.spacing * 0.5)}"`
      : '';
    let d = '';
    for (let i = 0; i <= cols; i += 1) {
      const p = F.x0 + i * cell;
      const q = F.y0 + i * cell;
      d += `M${f(p)} ${f(F.y0)}V${f(F.y0 + F.D)}M${f(F.x0)} ${f(q)}H${f(F.x0 + F.D)}`;
    }
    return `<path d="${d}" fill="none" stroke="${F.colors[0]}" stroke-width="${f(width)}"${dash}/>`;
  },

  dots(F) {
    const { cols, cell } = cells(F, 5, 36);
    const r = cell * 0.5 * lerp(0.12, 0.95, F.scale) * (1 - F.spacing * 0.55);
    const mode = F.rng.pick(['solid', 'checker', 'rows', 'random'] as const);
    const stagger = F.rng.chance(0.4);
    let out = '';
    for (let j = 0; j < cols; j += 1) {
      for (let i = 0; i < cols; i += 1) {
        const x = F.x0 + (i + 0.5 + (stagger && j % 2 ? 0.5 : 0)) * cell;
        const y = F.y0 + (j + 0.5) * cell;
        const color =
          mode === 'solid' ? F.colors[0]
          : mode === 'checker' ? F.colors[(i + j) % F.colors.length]
          : mode === 'rows' ? F.colors[j % F.colors.length]
          : F.rng.pick(F.colors);
        out += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${color}"/>`;
      }
    }
    return out;
  },

  lines(F) {
    const { cols, cell } = cells(F, 4, 40);
    const thick = cell * lerp(0.06, 0.92, F.scale) * (1 - F.spacing * 0.5);
    const cycle = F.rng.chance(0.55);
    let out = '';
    for (let j = 0; j < cols; j += 1) {
      const color = cycle ? F.colors[j % F.colors.length] : F.colors[0];
      out += `<rect x="${f(F.x0)}" y="${f(F.y0 + j * cell + (cell - thick) / 2)}" width="${f(F.D)}" height="${f(thick)}" fill="${color}"/>`;
    }
    return out;
  },

  waves(F) {
    const { cols, cell } = cells(F, 4, 30);
    const amp = cell * lerp(0.08, 1.4, F.scale);
    const width = Math.max(1, cell * lerp(0.42, 0.06, F.spacing));
    const wavelength = cell * F.rng.range(2.5, 6);
    const drift = F.rng.range(0, 0.9);
    const steps = Math.ceil(F.D / (wavelength / 12));
    let out = '';
    for (let j = -1; j <= cols; j += 1) {
      const base = F.y0 + (j + 0.5) * cell;
      let d = '';
      for (let s = 0; s <= steps; s += 1) {
        const x = F.x0 + (s / steps) * F.D;
        const y = base + amp * Math.sin((x / wavelength) * Math.PI * 2 + j * drift);
        d += `${s === 0 ? 'M' : 'L'}${f(x)} ${f(y)}`;
      }
      out += `<path d="${d}" fill="none" stroke="${F.colors[(j + cols + 1) % F.colors.length]}" stroke-width="${f(width)}" stroke-linecap="round"/>`;
    }
    return out;
  },

  circles(F) {
    const { cols, cell } = cells(F, 3, 22);
    const keep = lerp(0.95, 0.35, F.spacing);
    const outlined = F.rng.chance(0.35);
    let out = '';
    for (let j = 0; j < cols; j += 1) {
      for (let i = 0; i < cols; i += 1) {
        if (!F.rng.chance(keep)) continue;
        const r = cell * 0.5 * lerp(0.2, 1.25, F.scale) * F.rng.range(0.35, 1);
        const x = F.x0 + (i + F.rng.range(0.2, 0.8)) * cell;
        const y = F.y0 + (j + F.rng.range(0.2, 0.8)) * cell;
        const color = F.rng.pick(F.colors);
        out += outlined && F.rng.chance(0.5)
          ? `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="none" stroke="${color}" stroke-width="${f(Math.max(1.5, r * 0.18))}"/>`
          : `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${color}"/>`;
      }
    }
    return out;
  },

  squares(F) {
    const { cols, cell } = cells(F, 3, 26);
    const size = cell * lerp(0.2, 0.96, F.scale);
    const keep = lerp(1, 0.4, F.spacing);
    const tilt = F.rng.pick(['none', 'quarter', 'jitter'] as const);
    let out = '';
    for (let j = 0; j < cols; j += 1) {
      for (let i = 0; i < cols; i += 1) {
        if (!F.rng.chance(keep)) continue;
        const cx = F.x0 + (i + 0.5) * cell;
        const cy = F.y0 + (j + 0.5) * cell;
        const angle = tilt === 'none' ? 0 : tilt === 'quarter' ? F.rng.pick([0, 45]) : F.rng.range(-18, 18);
        const s = size * (tilt === 'jitter' ? F.rng.range(0.6, 1) : 1);
        const turn = angle ? ` transform="rotate(${f(angle)} ${f(cx)} ${f(cy)})"` : '';
        out += `<rect x="${f(cx - s / 2)}" y="${f(cy - s / 2)}" width="${f(s)}" height="${f(s)}" fill="${F.rng.pick(F.colors)}"${turn}/>`;
      }
    }
    return out;
  },

  triangles(F) {
    const { cols, cell } = cells(F, 3, 24);
    const tall = (cell * Math.sqrt(3)) / 2;
    const rows = Math.ceil(F.D / tall) + 1;
    const shrink = lerp(0.35, 1, F.scale) * (1 - F.spacing * 0.5);
    let out = '';
    for (let j = 0; j < rows; j += 1) {
      for (let i = -1; i <= cols * 2 + 1; i += 1) {
        const up = (i + j) % 2 === 0;
        const x = F.x0 + (i * cell) / 2;
        const top = F.y0 + j * tall;
        const pts = up
          ? [[x, top + tall], [x + cell / 2, top], [x + cell, top + tall]]
          : [[x, top], [x + cell, top], [x + cell / 2, top + tall]];
        const gx = (pts[0][0] + pts[1][0] + pts[2][0]) / 3;
        const gy = (pts[0][1] + pts[1][1] + pts[2][1]) / 3;
        const points = pts.map(([px, py]) => `${f(gx + (px - gx) * shrink)},${f(gy + (py - gy) * shrink)}`).join(' ');
        out += `<polygon points="${points}" fill="${F.rng.pick(F.colors)}"/>`;
      }
    }
    return out;
  },

  blobs(F) {
    const count = Math.round(lerp(2, 10, F.density));
    const wobble = lerp(0.1, 0.45, F.spacing);
    let out = '';
    for (let k = 0; k < count; k += 1) {
      const cx = F.cx + F.rng.range(-0.5, 0.5) * F.w;
      const cy = F.cy + F.rng.range(-0.5, 0.5) * F.h;
      const R = Math.min(F.w, F.h) * lerp(0.08, 0.42, F.scale) * F.rng.range(0.6, 1.2);
      const points = Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        const rr = R * (1 + F.rng.range(-wobble, wobble));
        return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
      });
      out += `<path d="${smoothClosed(points)}" fill="${F.colors[k % F.colors.length]}" fill-opacity="${f(F.rng.range(0.8, 1))}"/>`;
    }
    return out;
  },

  rings(F) {
    const { cols, cell } = cells(F, 6, 60);
    const width = Math.max(1, cell * lerp(0.08, 0.9, F.scale));
    const centres = F.rng.int(1, 3);
    let out = '';
    for (let c = 0; c < centres; c += 1) {
      const x = F.cx + F.rng.range(-0.5, 0.5) * F.w;
      const y = F.cy + F.rng.range(-0.5, 0.5) * F.h;
      for (let k = 1; k <= cols; k += 1) {
        if (F.rng.chance(F.spacing * 0.6)) continue;
        out += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(k * cell)}" fill="none" stroke="${F.colors[(k + c) % F.colors.length]}" stroke-width="${f(width)}"/>`;
      }
    }
    return out;
  },

  noise(F) {
    const { cols, cell } = cells(F, 10, 64);
    const lattice = Math.max(2, Math.round(lerp(2, 12, F.scale)));
    const values = Array.from({ length: (lattice + 1) ** 2 }, () => F.rng.next());
    const at = (u: number, v: number): number => {
      const gx = u * lattice;
      const gy = v * lattice;
      const ix = Math.min(lattice - 1, Math.floor(gx));
      const iy = Math.min(lattice - 1, Math.floor(gy));
      const tx = smooth(gx - ix);
      const ty = smooth(gy - iy);
      const val = (i: number, j: number) => values[j * (lattice + 1) + i];
      return lerp(lerp(val(ix, iy), val(ix + 1, iy), tx), lerp(val(ix, iy + 1), val(ix + 1, iy + 1), tx), ty);
    };
    const gap = cell * F.spacing * 0.5;
    let out = '';
    for (let j = 0; j < cols; j += 1) {
      for (let i = 0; i < cols; i += 1) {
        const band = Math.min(F.colors.length - 1, Math.floor(at((i + 0.5) / cols, (j + 0.5) / cols) * F.colors.length));
        out += `<rect x="${f(F.x0 + i * cell + gap / 2)}" y="${f(F.y0 + j * cell + gap / 2)}" width="${f(cell - gap)}" height="${f(cell - gap)}" fill="${F.colors[band]}"/>`;
      }
    }
    return out;
  },

  checkerboard(F) {
    const { cols, cell } = cells(F, 2, 24);
    const inset = (cell * (1 - lerp(0.4, 1, F.scale))) / 2 + cell * F.spacing * 0.2;
    const second = F.colors[1];
    let out = '';
    for (let j = 0; j < cols; j += 1) {
      for (let i = 0; i < cols; i += 1) {
        const odd = (i + j) % 2 === 1;
        // With one colour the other squares are simply the background.
        if (odd && !second) continue;
        out += `<rect x="${f(F.x0 + i * cell + inset)}" y="${f(F.y0 + j * cell + inset)}" width="${f(cell - inset * 2)}" height="${f(cell - inset * 2)}" fill="${odd ? second : F.colors[0]}"/>`;
      }
    }
    return out;
  },

  /* Truchet tiles: the same few marks in random orientations, read as a maze. */
  geometric(F) {
    const { cols, cell } = cells(F, 3, 26);
    const mode = F.rng.pick(['arcs', 'diagonals', 'halves'] as const);
    const width = Math.max(1.5, cell * lerp(0.05, 0.45, F.scale));
    const r = cell / 2;
    if (mode === 'halves') {
      let out = '';
      for (let j = 0; j < cols; j += 1) {
        for (let i = 0; i < cols; i += 1) {
          const x = F.x0 + i * cell;
          const y = F.y0 + j * cell;
          const corners = [[x, y], [x + cell, y], [x + cell, y + cell], [x, y + cell]];
          const skip = F.rng.int(0, 3);
          const points = corners.filter((_, k) => k !== skip).map(([px, py]) => `${f(px)},${f(py)}`).join(' ');
          out += `<polygon points="${points}" fill="${F.rng.pick(F.colors)}"/>`;
        }
      }
      return out;
    }
    let d = '';
    for (let j = 0; j < cols; j += 1) {
      for (let i = 0; i < cols; i += 1) {
        const x = F.x0 + i * cell;
        const y = F.y0 + j * cell;
        const flip = F.rng.chance(0.5);
        if (mode === 'diagonals') {
          d += flip ? `M${f(x)} ${f(y)}L${f(x + cell)} ${f(y + cell)}` : `M${f(x + cell)} ${f(y)}L${f(x)} ${f(y + cell)}`;
        } else {
          d += flip
            ? `M${f(x + r)} ${f(y)}A${f(r)} ${f(r)} 0 0 1 ${f(x)} ${f(y + r)}M${f(x + cell)} ${f(y + r)}A${f(r)} ${f(r)} 0 0 0 ${f(x + r)} ${f(y + cell)}`
            : `M${f(x + r)} ${f(y)}A${f(r)} ${f(r)} 0 0 0 ${f(x + cell)} ${f(y + r)}M${f(x)} ${f(y + r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + r)} ${f(y + cell)}`;
        }
      }
    }
    return `<path d="${d}" fill="none" stroke="${F.colors[0]}" stroke-width="${f(width)}" stroke-linecap="round"/>`;
  },

  /* Layered bands with soft noisy edges, each laid over the last. */
  organic(F) {
    const bands = Math.round(lerp(3, 12, F.density));
    const amp = (F.D / bands) * lerp(0.15, 1.3, F.scale);
    const lattice = 6;
    const steps = 72;
    let out = '';
    for (let b = 0; b < bands; b += 1) {
      const base = F.y0 + (b / bands) * F.D + F.rng.range(0, F.spacing) * (F.D / bands);
      const knots = Array.from({ length: lattice + 1 }, () => F.rng.range(-1, 1));
      let d = `M${f(F.x0)} ${f(F.y0 + F.D)}`;
      for (let s = 0; s <= steps; s += 1) {
        const u = s / steps;
        const g = u * lattice;
        const i0 = Math.min(lattice - 1, Math.floor(g));
        const n = lerp(knots[i0], knots[i0 + 1], smooth(g - i0));
        d += `L${f(F.x0 + u * F.D)} ${f(base + n * amp)}`;
      }
      out += `<path d="${d}L${f(F.x0 + F.D)} ${f(F.y0 + F.D)}Z" fill="${F.colors[b % F.colors.length]}"/>`;
    }
    return out;
  },
};

/**
 * The pattern as a complete SVG.
 *
 * `pixelWidth` sets the rendered size separately from the drawing's own
 * coordinates. Browsers rasterise an SVG image at its declared size before
 * scaling it onto a canvas, so a 2× PNG has to be declared at 2× or it comes
 * out soft.
 */
export function patternSvg(state: PatternState, pixelWidth?: number): string {
  const { w, h } = ASPECTS[state.aspect];
  const D = Math.hypot(w, h);
  const colors = state.colors.length ? state.colors : [readableOn(state.background)];
  const field: Field = {
    w, h, cx: w / 2, cy: h / 2, D, x0: w / 2 - D / 2, y0: h / 2 - D / 2,
    rng: createRng(state.seed),
    density: unit(state.density), scale: unit(state.scale), spacing: unit(state.spacing),
    colors,
  };
  const body = GENERATORS[state.kind](field);
  const pw = pixelWidth ?? w;
  const ph = Math.round((pw / w) * h);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${pw}" height="${ph}" viewBox="0 0 ${w} ${h}">` +
    `<rect width="${w}" height="${h}" fill="${state.background}"/>` +
    `<g transform="rotate(${f(state.rotation)} ${f(w / 2)} ${f(h / 2)})">${body}</g></svg>`;
}

/** CSS for a background: the SVG itself, inlined, so it works with no files. */
export function patternCss(state: PatternState): string {
  return `.pattern {\n  background-color: ${state.background};\n  background-image: url("data:image/svg+xml,${encodeURIComponent(patternSvg(state))}");\n  background-size: cover;\n  background-position: center;\n}\n`;
}

/**
 * Background and shape colours from a palette.
 *
 * The background is usually the darkest or the lightest colour, occasionally a
 * bold mid-tone. Shape colours too close to it to see are left out; if that
 * leaves nothing, the readable one of ink or paper steps in.
 */
export function colorsFrom(palette: readonly string[], rng: Rng): { background: string; colors: string[] } {
  const byValue = palette.slice().sort((a, b) => luminance(a) - luminance(b));
  const mids = byValue.slice(1, -1);
  const roll = rng.next();
  const background =
    roll < 0.45 ? byValue[0] : roll < 0.85 ? byValue[byValue.length - 1] : rng.pick(mids.length ? mids : byValue);
  let colors = rng.shuffle(palette.filter((c) => c !== background && contrast(c, background) >= 1.35));
  if (colors.length === 0) colors = [readableOn(background, ['#111111', '#F5F5F2'])];
  return { background, colors };
}

/*
 * Where each pattern looks good. Randomize stays inside these, which is the
 * difference between random and random with taste: every kind has a density
 * past which it turns to grey mush and a scale below which it disappears.
 */
export const RANGES: Record<PatternKind, { density: [number, number]; scale: [number, number]; spacing: [number, number]; rotations: number[] }> = {
  grid: { density: [15, 60], scale: [5, 35], spacing: [0, 40], rotations: [0, 0, 45, 15] },
  dots: { density: [20, 70], scale: [30, 80], spacing: [0, 30], rotations: [0, 0, 45] },
  lines: { density: [15, 70], scale: [20, 70], spacing: [0, 30], rotations: [0, 45, 90, 135, 30] },
  waves: { density: [15, 60], scale: [20, 60], spacing: [20, 70], rotations: [0, 0, 90, 20] },
  circles: { density: [15, 55], scale: [40, 90], spacing: [10, 50], rotations: [0] },
  squares: { density: [15, 60], scale: [40, 90], spacing: [0, 40], rotations: [0, 0, 45] },
  triangles: { density: [15, 55], scale: [70, 100], spacing: [0, 20], rotations: [0, 90, 30] },
  blobs: { density: [20, 70], scale: [40, 90], spacing: [20, 60], rotations: [0] },
  rings: { density: [20, 70], scale: [20, 60], spacing: [0, 30], rotations: [0] },
  noise: { density: [30, 80], scale: [20, 60], spacing: [0, 25], rotations: [0, 0, 45] },
  checkerboard: { density: [10, 60], scale: [70, 100], spacing: [0, 20], rotations: [0, 45] },
  geometric: { density: [20, 65], scale: [15, 55], spacing: [0, 0], rotations: [0, 0, 45] },
  organic: { density: [25, 70], scale: [40, 90], spacing: [0, 40], rotations: [0, 0, 180, 90] },
};

export function randomPattern(rng: Rng, palette: readonly string[], aspect: Aspect, kind?: PatternKind): PatternState {
  const k = kind ?? rng.pick(PATTERNS).id;
  const r = RANGES[k];
  const { background, colors } = colorsFrom(palette, rng);
  return {
    kind: k,
    seed: rng.int(100000, 999999),
    aspect,
    density: Math.round(rng.range(r.density[0], r.density[1])),
    scale: Math.round(rng.range(r.scale[0], r.scale[1])),
    spacing: Math.round(rng.range(r.spacing[0], r.spacing[1])),
    rotation: rng.pick(r.rotations),
    background,
    colors,
  };
}
