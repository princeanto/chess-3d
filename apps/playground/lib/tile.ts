/**
 * Draw a tile: your own drawing, repeated.
 *
 * The tile is a DRAW document in miniature — strokes in a 1000-unit square
 * centred on 0,0 — so the same brushes and the same painter work on it. Two
 * things make it a pattern rather than a stamp:
 *
 * Wrapping. A stroke that runs off one edge comes back in on the opposite one,
 * both while drawing and in the result, so lines join across tiles and the
 * repeat has no seams unless you want them.
 *
 * <use>. The tile is written once in the SVG and placed by reference, so two
 * hundred copies cost two hundred short tags rather than two hundred drawings.
 */

import { bounds, strokesMarkup, type Stroke } from './draw';

export const TILE = 1000;
export type RepeatMode = 'grid' | 'brick' | 'halfdrop' | 'mirror' | 'rotate';

export const REPEATS: { id: RepeatMode; label: string }[] = [
  { id: 'grid', label: 'Grid' },
  { id: 'brick', label: 'Brick' },
  { id: 'halfdrop', label: 'Half-drop' },
  { id: 'mirror', label: 'Mirror' },
  { id: 'rotate', label: 'Rotate' },
];

export interface TileSpec {
  strokes: Stroke[];
  repeat: RepeatMode;
}

export function shiftStroke(stroke: Stroke, dx: number, dy: number): Stroke {
  return { ...stroke, p: stroke.p.map((v, i) => v + (i % 2 ? dy : dx)) };
}

/** Each stroke plus the copies of it that wrap in from neighbouring tiles. */
export function wrapStrokes(strokes: readonly Stroke[]): Stroke[] {
  const half = TILE / 2;
  const out: Stroke[] = [];
  for (const stroke of strokes) {
    const [minX, minY, maxX, maxY] = bounds(stroke);
    for (const dy of [0, -TILE, TILE]) {
      for (const dx of [0, -TILE, TILE]) {
        if (dx === 0 && dy === 0) { out.push(stroke); continue; }
        if (maxX + dx < -half || minX + dx > half || maxY + dy < -half || minY + dy > half) continue;
        out.push(shiftStroke(stroke, dx, dy));
      }
    }
  }
  return out;
}

/** A first tile, so the repeat shows what it does before anything is drawn. */
export function starterTile(colors: readonly string[]): TileSpec {
  const a = colors[0] ?? '#111111';
  const b = colors[1] ?? a;
  return {
    repeat: 'brick',
    strokes: [
      { b: 'circle', c: a, s: 60, o: 1, p: [-260, -260, 260, 260], y: 'n' },
      { b: 'line', c: b, s: 60, o: 1, p: [-500, 500, 500, -500], y: 'n' },
    ],
  };
}

export interface TileField { D: number; x0: number; y0: number; density: number; scale: number; spacing: number }

/** The body of a tiled pattern: the tile once in <defs>, then its copies. */
export function tileBody(F: TileField, tile: TileSpec, id: string): string {
  const half = TILE / 2;
  const { defs, body } = strokesMarkup(wrapStrokes(tile.strokes), { x: -half * 3, y: -half * 3, w: TILE * 3, h: TILE * 3 }, `${id}e`);
  const cols = Math.max(1, Math.round(2 + F.density * 14));
  const cell = F.D / cols;
  const k = (cell / TILE) * (0.35 + 0.65 * F.scale) * (1 - F.spacing * 0.5);
  const f = (n: number) => String(Math.round(n * 1000) / 1000);
  let uses = '';
  for (let j = -1; j <= cols; j += 1) {
    for (let i = -1; i <= cols; i += 1) {
      let x = F.x0 + (i + 0.5) * cell;
      let y = F.y0 + (j + 0.5) * cell;
      let transform = '';
      const oddI = Math.abs(i) % 2 === 1;
      const oddJ = Math.abs(j) % 2 === 1;
      if (tile.repeat === 'brick' && oddJ) x += cell / 2;
      if (tile.repeat === 'halfdrop' && oddI) y += cell / 2;
      if (tile.repeat === 'mirror') transform = ` scale(${f(oddI ? -k : k)} ${f(oddJ ? -k : k)})`;
      else if (tile.repeat === 'rotate') transform = ` rotate(${[[0, 90], [270, 180]][oddJ ? 1 : 0][oddI ? 1 : 0]}) scale(${f(k)})`;
      else transform = ` scale(${f(k)})`;
      uses += `<use href="#${id}" transform="translate(${f(x)} ${f(y)})${transform}"/>`;
    }
  }
  return `<defs>${defs}<clipPath id="${id}c"><rect x="${-half}" y="${-half}" width="${TILE}" height="${TILE}"/></clipPath>` +
    `<g id="${id}"><g clip-path="url(#${id}c)">${body}</g></g></defs>${uses}`;
}
