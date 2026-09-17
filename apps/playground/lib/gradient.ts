/**
 * Gradients: one description, three outputs that match.
 *
 * The preview is the CSS itself, so what you copy is exactly what you see. The
 * PNG and SVG exports reproduce CSS's own geometry rather than approximating
 * it — a CSS linear gradient's line is not corner to corner, and a naive canvas
 * version comes out visibly different at any angle that is not a right angle.
 */

import type { Rng } from './random';

export interface Stop {
  id: string;
  hex: string;
  /** Position along the gradient, 0 to 100. */
  pos: number;
}

export interface Gradient {
  kind: 'linear' | 'radial';
  /** CSS convention: 0 points up, 90 to the right, clockwise. */
  angle: number;
  stops: Stop[];
}

export const MIN_STOPS = 2;
export const MAX_STOPS = 4;

let counter = 0;
export const stopId = (): string => `s${Date.now().toString(36)}${(counter += 1)}`;

export const sorted = (stops: readonly Stop[]): Stop[] => stops.slice().sort((a, b) => a.pos - b.pos);

/** True when stops sit where CSS would put them anyway, so positions can be left out. */
function evenlySpaced(stops: readonly Stop[]): boolean {
  const s = sorted(stops);
  return s.every((stop, i) => Math.abs(stop.pos - (i / (s.length - 1)) * 100) < 0.5);
}

/** The CSS, positions included only when they say something. */
export function toCss(g: Gradient): string {
  const even = evenlySpaced(g.stops);
  const list = sorted(g.stops)
    .map((stop) => (even ? stop.hex : `${stop.hex} ${Math.round(stop.pos)}%`))
    .join(', ');
  return g.kind === 'linear'
    ? `linear-gradient(${Math.round(g.angle)}deg, ${list})`
    : `radial-gradient(circle at center, ${list})`;
}

/**
 * Where CSS draws a linear gradient's line inside a w × h box.
 *
 * The line runs through the centre at the given angle, and its length is chosen
 * so the corners reach exactly the first and last stop:
 * |w·sin θ| + |h·cos θ|. That is the part a corner-to-corner guess gets wrong.
 */
export function linearEndpoints(angle: number, w: number, h: number): { x1: number; y1: number; x2: number; y2: number } {
  const rad = (angle * Math.PI) / 180;
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  const half = (Math.abs(w * Math.sin(rad)) + Math.abs(h * Math.cos(rad))) / 2;
  const cx = w / 2;
  const cy = h / 2;
  return { x1: cx - dx * half, y1: cy - dy * half, x2: cx + dx * half, y2: cy + dy * half };
}

/** `circle at center` reaches the farthest corner, as CSS does by default. */
export const radialRadius = (w: number, h: number): number => Math.hypot(w / 2, h / 2);

export function paintGradient(ctx: CanvasRenderingContext2D, g: Gradient, w: number, h: number): void {
  const fill =
    g.kind === 'linear'
      ? (() => {
          const { x1, y1, x2, y2 } = linearEndpoints(g.angle, w, h);
          return ctx.createLinearGradient(x1, y1, x2, y2);
        })()
      : ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, radialRadius(w, h));
  for (const stop of sorted(g.stops)) fill.addColorStop(Math.min(1, Math.max(0, stop.pos / 100)), stop.hex);
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, w, h);
}

export function gradientSvg(g: Gradient, w: number, h: number): string {
  const stops = sorted(g.stops)
    .map((stop) => `<stop offset="${(stop.pos / 100).toFixed(4)}" stop-color="${stop.hex}"/>`)
    .join('');
  const def =
    g.kind === 'linear'
      ? (() => {
          const { x1, y1, x2, y2 } = linearEndpoints(g.angle, w, h);
          return `<linearGradient id="g" gradientUnits="userSpaceOnUse" x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}">${stops}</linearGradient>`;
        })()
      : `<radialGradient id="g" gradientUnits="userSpaceOnUse" cx="${w / 2}" cy="${h / 2}" r="${radialRadius(w, h).toFixed(2)}">${stops}</radialGradient>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${def}</defs><rect width="${w}" height="${h}" fill="url(#g)"/></svg>`;
}

/** A gradient built from the shared palette, so COLOR's two modes agree. */
export function fromPalette(hexes: readonly string[], rng: Rng, count = rng.int(2, 3)): Gradient {
  const chosen = rng.shuffle(hexes).slice(0, Math.max(MIN_STOPS, Math.min(MAX_STOPS, count)));
  return {
    kind: rng.chance(0.78) ? 'linear' : 'radial',
    angle: rng.pick([0, 45, 90, 120, 135, 160, 180, 225, 270, 315]),
    stops: chosen.map((hex, i) => ({ id: stopId(), hex, pos: (i / (chosen.length - 1)) * 100 })),
  };
}
