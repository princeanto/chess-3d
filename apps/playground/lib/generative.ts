/**
 * Generate: a new pattern structure from nothing but a seed.
 *
 * The thirteen named patterns are thirteen fixed ideas with dials. This makes
 * the idea itself: a lattice to lay things on, and up to three layers of motif,
 * each with its own shape, scale, fill, rotation rule, colour rule and rhythm of
 * gaps. Twenty motifs, six lattices and a dozen rules multiply into more
 * designs than anyone will click through, and the seed still reproduces each
 * one exactly.
 *
 * Taste lives in the constraints. Layers get smaller as they stack, stroked
 * motifs get weights that read at the cell size, truchet-style motifs get
 * quarter-turn rotations, a lone colour is answered with a knockout in the
 * background colour, and the cell count drops when motifs are complex, so
 * nothing turns into grey fuzz or a file too heavy for a phone.
 */

import { createRng, type Rng } from './random';

export const MOTIFS = [
  'circle', 'ring', 'square', 'squircle', 'diamond', 'triangle', 'plus', 'cross', 'star', 'flower',
  'petal', 'half', 'quarter', 'arc', 'bar', 'chevron', 'wave', 'dots', 'hexagon', 'drop',
] as const;
export type Motif = (typeof MOTIFS)[number];

const LABEL: Record<Motif, string> = {
  circle: 'circles', ring: 'rings', square: 'squares', squircle: 'soft squares', diamond: 'diamonds',
  triangle: 'triangles', plus: 'pluses', cross: 'crosses', star: 'stars', flower: 'flowers', petal: 'petals',
  half: 'half moons', quarter: 'quarter circles', arc: 'arcs', bar: 'bars', chevron: 'chevrons', wave: 'waves',
  dots: 'dot clusters', hexagon: 'hexagons', drop: 'drops',
};

/** Always drawn as lines, whatever the layer's fill says. */
const STROKED: readonly Motif[] = ['ring', 'arc', 'chevron', 'wave'];
/** Read as tiles: they connect across cells when turned in quarter steps. */
const TRUCHET: readonly Motif[] = ['quarter', 'arc', 'half', 'triangle'];
/** Elements per motif, for keeping the total in check. */
const WEIGHT: Partial<Record<Motif, number>> = { flower: 9, dots: 4, plus: 2, cross: 2 };

export const LATTICES = ['grid', 'brick', 'halfdrop', 'hex', 'diamond', 'radial'] as const;
export type Lattice = (typeof LATTICES)[number];
const LATTICE_LABEL: Record<Lattice, string> = {
  grid: 'grid', brick: 'brick lattice', halfdrop: 'half-drop', hex: 'hex lattice', diamond: 'diamond lattice', radial: 'radial burst',
};

type RotRule = 'fixed' | 'alternate' | 'quarter' | 'step' | 'random';
type ColorRule = 'fixed' | 'row' | 'column' | 'checker' | 'diagonal' | 'random';
type SkipRule = 'none' | 'checker' | 'random' | 'rows';

export interface Layer {
  motif: Motif;
  /** Of half a cell. */
  scale: number;
  filled: boolean;
  /** Stroke weight, as a share of a cell. */
  weight: number;
  rot: number;
  rotRule: RotRule;
  step: number;
  /** Index into the colours; -1 is the background colour, for knockouts. */
  color: number;
  colorRule: ColorRule;
  skip: SkipRule;
  skipChance: number;
  /** Copies turned about the cell centre, with an offset: a rosette. */
  fold: 1 | 2 | 4;
  offset: number;
  points: number;
}

export interface Design {
  lattice: Lattice;
  layers: Layer[];
}

export function designFor(seed: number): Design {
  // Its own stream, so the design stays put while per-cell randomness varies.
  const rng = createRng((seed ^ 0x5bd1e995) >>> 0);
  const lattice = rng.pick(LATTICES);
  const count = rng.chance(0.25) ? 1 : rng.chance(0.6) ? 2 : 3;
  const layers: Layer[] = [];
  let ceiling = 1;
  for (let k = 0; k < count; k += 1) {
    const motif = k === 0 && rng.chance(0.3) ? rng.pick(TRUCHET) : rng.pick(MOTIFS);
    const truchet = TRUCHET.includes(motif);
    const fold = k > 0 || motif === 'flower' || motif === 'dots' || !rng.chance(0.18) ? 1 : rng.pick([2, 4] as const);
    const scale = k === 0
      ? (truchet ? rng.range(0.9, 1) : rng.range(0.55, 0.95)) * ceiling
      : rng.range(0.25, 0.6) * ceiling;
    ceiling = Math.max(0.25, scale);
    const rotRule: RotRule = truchet
      ? rng.pick(['quarter', 'quarter', 'alternate'] as const)
      : rng.pick(['fixed', 'fixed', 'alternate', 'step', 'random'] as const);
    layers.push({
      motif,
      scale: fold > 1 ? scale * 0.55 : scale,
      filled: STROKED.includes(motif) ? false : rng.chance(0.72),
      weight: rng.range(0.04, 0.13),
      rot: rng.pick([0, 0, 45, 90, 30]),
      rotRule,
      step: rng.pick([15, 30, 45, 90]),
      // A small top layer sometimes punches through in the background colour.
      color: k > 0 && rng.chance(0.3) ? -1 : k,
      colorRule: rng.pick(['fixed', 'fixed', 'row', 'column', 'checker', 'diagonal', 'random'] as const),
      skip: k === 0 ? rng.pick(['none', 'none', 'none', 'checker', 'random'] as const) : rng.pick(['none', 'checker', 'random', 'rows'] as const),
      skipChance: rng.range(0.15, 0.45),
      fold,
      offset: fold > 1 ? rng.range(0.28, 0.45) : 0,
      points: rng.int(5, 8),
    });
  }
  return { lattice, layers };
}

export function describe(design: Design): string {
  const names = design.layers.slice(0, 2).map((layer) => LABEL[layer.motif]);
  const unique = names.filter((name, i) => names.indexOf(name) === i);
  const subject = unique.join(' and ');
  return `${subject[0].toUpperCase()}${subject.slice(1)} on a ${LATTICE_LABEL[design.lattice]}`;
}

/* ------------------------------ drawing ------------------------------ */

const f = (n: number): string => String(Math.round(n * 10) / 10);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

function polygon(points: number[][]): string {
  return points.map(([x, y]) => `${f(x)},${f(y)}`).join(' ');
}

/** One motif centred on 0,0 with radius r. */
function motifMarkup(layer: Layer, r: number, cell: number, color: string): string {
  const paint = layer.filled && !STROKED.includes(layer.motif)
    ? `fill="${color}"`
    : `fill="none" stroke="${color}" stroke-width="${f(Math.max(1, cell * layer.weight))}" stroke-linecap="round" stroke-linejoin="round"`;
  switch (layer.motif) {
    case 'circle': return `<circle r="${f(r)}" ${paint}/>`;
    case 'ring': return `<circle r="${f(r * 0.8)}" ${paint}/>`;
    case 'square': return `<rect x="${f(-r)}" y="${f(-r)}" width="${f(2 * r)}" height="${f(2 * r)}" ${paint}/>`;
    case 'squircle': return `<rect x="${f(-r)}" y="${f(-r)}" width="${f(2 * r)}" height="${f(2 * r)}" rx="${f(r * 0.45)}" ${paint}/>`;
    case 'diamond': return `<polygon points="${polygon([[0, -r], [r, 0], [0, r], [-r, 0]])}" ${paint}/>`;
    case 'triangle': return `<polygon points="${polygon([[-r, -r], [r, -r], [-r, r]])}" ${paint}/>`;
    case 'hexagon': return `<polygon points="${polygon(Array.from({ length: 6 }, (_, i) => [Math.cos((i * Math.PI) / 3) * r, Math.sin((i * Math.PI) / 3) * r]))}" ${paint}/>`;
    case 'plus':
    case 'cross': {
      const w = r * 0.36;
      const turn = layer.motif === 'cross' ? ' transform="rotate(45)"' : '';
      return `<g${turn}><rect x="${f(-r)}" y="${f(-w / 2)}" width="${f(2 * r)}" height="${f(w)}" ${paint}/><rect x="${f(-w / 2)}" y="${f(-r)}" width="${f(w)}" height="${f(2 * r)}" ${paint}/></g>`;
    }
    case 'star': {
      const n = layer.points;
      const pts = Array.from({ length: n * 2 }, (_, i) => {
        const a = (i * Math.PI) / n - Math.PI / 2;
        const rr = i % 2 ? r * 0.46 : r;
        return [Math.cos(a) * rr, Math.sin(a) * rr];
      });
      return `<polygon points="${polygon(pts)}" ${paint}/>`;
    }
    case 'flower': {
      const n = layer.points;
      const petals = Array.from({ length: n }, (_, i) => {
        const a = (i * 2 * Math.PI) / n;
        return `<circle cx="${f(Math.cos(a) * r * 0.58)}" cy="${f(Math.sin(a) * r * 0.58)}" r="${f(r * 0.38)}" ${paint}/>`;
      }).join('');
      return `<g>${petals}</g>`;
    }
    case 'petal': return `<path d="M0 ${f(-r)}Q${f(r)} 0 0 ${f(r)}Q${f(-r)} 0 0 ${f(-r)}Z" ${paint}/>`;
    case 'half': return `<path d="M${f(-r)} 0A${f(r)} ${f(r)} 0 0 1 ${f(r)} 0Z" ${paint}/>`;
    case 'quarter': return `<path d="M${f(-r)} ${f(-r)}H${f(r)}A${f(2 * r)} ${f(2 * r)} 0 0 1 ${f(-r)} ${f(r)}Z" ${paint}/>`;
    case 'arc': return `<path d="M0 ${f(-r)}A${f(r)} ${f(r)} 0 0 1 ${f(-r)} 0M${f(r)} 0A${f(r)} ${f(r)} 0 0 0 0 ${f(r)}" ${paint}/>`;
    case 'bar': return `<rect x="${f(-r)}" y="${f(-r * 0.2)}" width="${f(2 * r)}" height="${f(r * 0.4)}" ${paint}/>`;
    case 'chevron': return `<path d="M${f(-r)} ${f(r * 0.4)}L0 ${f(-r * 0.4)}L${f(r)} ${f(r * 0.4)}" ${paint}/>`;
    case 'wave': return `<path d="M${f(-r)} 0C${f(-r * 0.33)} ${f(-r * 0.9)} ${f(r * 0.33)} ${f(r * 0.9)} ${f(r)} 0" ${paint}/>`;
    case 'dots': return `<g>${[[0, -0.5], [0.45, 0.3], [-0.45, 0.3]].map(([x, y]) => `<circle cx="${f(x * r)}" cy="${f(y * r)}" r="${f(r * 0.26)}" ${layer.filled ? `fill="${color}"` : paint}/>`).join('')}</g>`;
    case 'drop':
    default:
      return `<path d="M0 ${f(-r)}C${f(r * 0.9)} ${f(-r * 0.1)} ${f(r * 0.7)} ${f(r)} 0 ${f(r)}C${f(-r * 0.7)} ${f(r)} ${f(-r * 0.9)} ${f(-r * 0.1)} 0 ${f(-r)}Z" ${paint}/>`;
  }
}

export interface GenField {
  w: number; h: number; cx: number; cy: number; D: number; x0: number; y0: number;
  rng: Rng; density: number; scale: number; spacing: number; colors: string[]; background: string;
}

interface Site { x: number; y: number; i: number; j: number; angle: number }

function sites(F: GenField, lattice: Lattice, cols: number): { cell: number; list: Site[] } {
  const cell = F.D / cols;
  const list: Site[] = [];
  if (lattice === 'radial') {
    const rings = Math.max(2, Math.round(cols / 2));
    const step = F.D / 2 / rings;
    list.push({ x: F.cx, y: F.cy, i: 0, j: 0, angle: 0 });
    for (let k = 1; k <= rings; k += 1) {
      const n = Math.max(6, Math.round(2 * Math.PI * k));
      for (let i = 0; i < n; i += 1) {
        const a = (i * 2 * Math.PI) / n + (k % 2 ? 0 : Math.PI / n);
        list.push({ x: F.cx + Math.cos(a) * k * step, y: F.cy + Math.sin(a) * k * step, i, j: k, angle: (a * 180) / Math.PI + 90 });
      }
    }
    return { cell: step, list };
  }
  const rowStep = lattice === 'hex' ? cell * 0.866 : cell;
  const rows = Math.ceil(F.D / rowStep) + 1;
  for (let j = -1; j < rows; j += 1) {
    for (let i = -1; i <= cols; i += 1) {
      if (lattice === 'diamond' && (i + j) % 2 !== 0) continue;
      let x = F.x0 + (i + 0.5) * cell;
      let y = F.y0 + (j + 0.5) * rowStep;
      if ((lattice === 'brick' || lattice === 'hex') && Math.abs(j) % 2 === 1) x += cell / 2;
      if (lattice === 'halfdrop' && Math.abs(i) % 2 === 1) y += cell / 2;
      list.push({ x, y, i, j, angle: 0 });
    }
  }
  return { cell: lattice === 'diamond' ? cell * 1.2 : cell, list };
}

const mod = (a: number, n: number): number => ((a % n) + n) % n;

export function generatedBody(F: GenField, seed: number): string {
  const design = designFor(seed);
  const cost = design.layers.reduce((sum, layer) => sum + (WEIGHT[layer.motif] ?? 1) * layer.fold, 0);
  const wanted = Math.round(lerp(4, 24, F.density));
  // Complex designs get fewer, larger cells, so the file stays light.
  const affordable = Math.max(3, Math.floor(Math.sqrt(5200 / cost)));
  const { cell, list } = sites(F, design.lattice, Math.min(wanted, affordable));
  const shrink = lerp(0.65, 1.3, F.scale) * (1 - F.spacing * 0.45);
  const n = F.colors.length;
  let out = '';
  for (const layer of design.layers) {
    const r = (cell / 2) * layer.scale * shrink;
    if (r < 0.5) continue;
    for (const s of list) {
      if (layer.skip === 'checker' && mod(s.i + s.j, 2) === 1) continue;
      if (layer.skip === 'rows' && mod(s.j, 3) === 2) continue;
      if (layer.skip === 'random' && F.rng.chance(layer.skipChance)) continue;
      const colorIndex =
        layer.colorRule === 'row' ? layer.color + s.j
        : layer.colorRule === 'column' ? layer.color + s.i
        : layer.colorRule === 'checker' ? layer.color + mod(s.i + s.j, 2)
        : layer.colorRule === 'diagonal' ? layer.color + s.i + s.j
        : layer.colorRule === 'random' ? F.rng.int(0, n - 1)
        : layer.color;
      const color = layer.color === -1 ? F.background : F.colors[mod(colorIndex, n)];
      const rot = s.angle + layer.rot + (
        layer.rotRule === 'alternate' ? mod(s.i + s.j, 2) * 90
        : layer.rotRule === 'quarter' ? 90 * F.rng.int(0, 3)
        : layer.rotRule === 'step' ? (s.i + s.j) * layer.step
        : layer.rotRule === 'random' ? F.rng.range(0, 360)
        : 0);
      const one = motifMarkup(layer, r, cell, color);
      if (layer.fold === 1) {
        out += `<g transform="translate(${f(s.x)} ${f(s.y)})${rot ? ` rotate(${f(rot)})` : ''}">${one}</g>`;
      } else {
        const copies = Array.from({ length: layer.fold }, (_, k) =>
          `<g transform="rotate(${(360 / layer.fold) * k}) translate(0 ${f(-cell * layer.offset * shrink)})">${one}</g>`).join('');
        out += `<g transform="translate(${f(s.x)} ${f(s.y)})${rot ? ` rotate(${f(rot)})` : ''}">${copies}</g>`;
      }
    }
  }
  return out;
}
