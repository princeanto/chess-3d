/**
 * Painting DRAW's strokes onto a canvas.
 *
 * Each stroke is drawn fully opaque onto a scratch canvas and then laid onto
 * the drawing in one step at its opacity. Drawn directly, a translucent marker
 * darkens wherever it crosses itself, and every symmetry copy darkens where it
 * meets the next; one composite per stroke is what makes it look like one mark.
 * The eraser composites the same way, removing instead of adding.
 */

import { UNITS, bounds, groundColor, isShape, segments, transforms, widthAt, type DrawDoc, type Stroke } from './draw';

export interface View {
  /** CSS pixels. */
  w: number;
  h: number;
  /** Device pixels per CSS pixel. */
  dpr: number;
}

export const unitScale = (view: Pick<View, 'w' | 'h'>): number => Math.min(view.w, view.h) / UNITS;

/** The canvas transform that puts document units on device pixels. */
function base(ctx: CanvasRenderingContext2D, view: View): void {
  const k = unitScale(view) * view.dpr;
  ctx.setTransform(k, 0, 0, k, (view.w / 2) * view.dpr, (view.h / 2) * view.dpr);
}

function trace(ctx: CanvasRenderingContext2D, stroke: Stroke, color: string): void {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = stroke.s;
  const p = stroke.p;
  if (isShape(stroke.b)) {
    const [x0, y0, x1, y1] = p;
    ctx.beginPath();
    if (stroke.b === 'line') {
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
    } else if (stroke.b === 'rect') {
      ctx.rect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
    } else {
      ctx.ellipse((x0 + x1) / 2, (y0 + y1) / 2, Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, 0, 0, Math.PI * 2);
    }
    ctx.stroke();
    return;
  }
  if (p.length === 2) {
    ctx.beginPath();
    ctx.arc(p[0], p[1], widthAt(stroke, 0) / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const segs = segments(p);
  if (stroke.w) {
    for (const s of segs) {
      ctx.lineWidth = widthAt(stroke, s.i);
      ctx.beginPath();
      ctx.moveTo(s.x0, s.y0);
      if (s.cx === undefined) ctx.lineTo(s.x1, s.y1);
      else ctx.quadraticCurveTo(s.cx, s.cy!, s.x1, s.y1);
      ctx.stroke();
    }
    return;
  }
  ctx.beginPath();
  ctx.moveTo(segs[0].x0, segs[0].y0);
  for (const s of segs) {
    if (s.cx === undefined) ctx.lineTo(s.x1, s.y1);
    else ctx.quadraticCurveTo(s.cx, s.cy!, s.x1, s.y1);
  }
  ctx.stroke();
}

/** Sizes a canvas's backing store to the view. Returns true if it changed. */
export function fit(canvas: HTMLCanvasElement, view: View): boolean {
  const w = Math.max(1, Math.round(view.w * view.dpr));
  const h = Math.max(1, Math.round(view.h * view.dpr));
  if (canvas.width === w && canvas.height === h) return false;
  canvas.width = w;
  canvas.height = h;
  return true;
}

export function clear(ctx: CanvasRenderingContext2D): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

export function paintStroke(target: CanvasRenderingContext2D, scratch: HTMLCanvasElement, stroke: Stroke, view: View): void {
  const k = unitScale(view) * view.dpr;
  const [minX, minY, maxX, maxY] = bounds(stroke);
  const cw = target.canvas.width;
  const ch = target.canvas.height;
  const x = Math.max(0, Math.floor((view.w / 2) * view.dpr + minX * k) - 2);
  const y = Math.max(0, Math.floor((view.h / 2) * view.dpr + minY * k) - 2);
  const r = Math.min(cw, Math.ceil((view.w / 2) * view.dpr + maxX * k) + 2);
  const b = Math.min(ch, Math.ceil((view.h / 2) * view.dpr + maxY * k) + 2);
  if (r <= x || b <= y) return;

  if (scratch.width !== cw || scratch.height !== ch) {
    scratch.width = cw;
    scratch.height = ch;
  }
  const s = scratch.getContext('2d');
  if (!s) return;
  s.setTransform(1, 0, 0, 1, 0, 0);
  s.clearRect(x, y, r - x, b - y);
  const eraser = stroke.b === 'eraser';
  for (const [ma, mb, mc, md] of transforms(stroke.y)) {
    base(s, view);
    s.transform(ma, mb, mc, md, 0, 0);
    trace(s, stroke, eraser ? '#000' : stroke.c);
  }

  target.save();
  target.setTransform(1, 0, 0, 1, 0, 0);
  target.globalAlpha = stroke.o;
  target.globalCompositeOperation = eraser ? 'destination-out' : 'source-over';
  target.drawImage(scratch, x, y, r - x, b - y, x, y, r - x, b - y);
  target.restore();
}

export function paintAll(ctx: CanvasRenderingContext2D, scratch: HTMLCanvasElement, strokes: readonly Stroke[], view: View): void {
  clear(ctx);
  for (const stroke of strokes) paintStroke(ctx, scratch, stroke, view);
}

/**
 * The whole picture on a new canvas: background, then the ink layer on top,
 * so the eraser never reaches the background.
 */
export function renderDoc(doc: DrawDoc, view: View): HTMLCanvasElement | null {
  const ink = document.createElement('canvas');
  const scratch = document.createElement('canvas');
  const out = document.createElement('canvas');
  fit(ink, view);
  fit(out, view);
  const inkCtx = ink.getContext('2d');
  const outCtx = out.getContext('2d');
  if (!inkCtx || !outCtx) return null;
  paintAll(inkCtx, scratch, doc.strokes, view);
  const ground = groundColor(doc);
  if (ground) {
    outCtx.fillStyle = ground;
    outCtx.fillRect(0, 0, out.width, out.height);
  }
  outCtx.drawImage(ink, 0, 0);
  return out;
}
