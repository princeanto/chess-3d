/**
 * Image work that runs the same in a worker or on the page.
 *
 * In a worker it uses OffscreenCanvas, so a 12-megapixel photo being squeezed
 * under 1 MB — which can mean a dozen encodes — never freezes the page. Where a
 * browser has no OffscreenCanvas, the same code runs on an ordinary canvas.
 */

export type OutputType = 'image/jpeg' | 'image/png' | 'image/webp';
export type Fit = 'stretch' | 'cover' | 'contain';

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
type AnyContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type Source = ImageBitmap | HTMLImageElement | AnyCanvas;

/** Browsers refuse canvases much past this, silently returning an empty image. */
export const MAX_PIXELS = 36_000_000;
export const MAX_SIDE = 16_000;

function makeCanvas(w: number, h: number): AnyCanvas {
  const width = Math.max(1, Math.round(w));
  const height = Math.max(1, Math.round(h));
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

const context = (canvas: AnyCanvas): AnyContext => canvas.getContext('2d') as AnyContext;
const sizeOf = (s: Source) => ({ w: 'naturalWidth' in s ? s.naturalWidth : s.width, h: 'naturalHeight' in s ? s.naturalHeight : s.height });

export async function encode(canvas: AnyCanvas, type: OutputType, quality: number): Promise<Blob> {
  if ('convertToBlob' in canvas) return canvas.convertToBlob({ type, quality });
  return new Promise((resolve, reject) => (canvas as HTMLCanvasElement).toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), type, quality));
}

/**
 * Downscaling in halves before the last step keeps fine detail: one big jump
 * from 4000 px to 400 px skips most of the source pixels and looks jagged.
 */
function stepDown(source: Source, sx: number, sy: number, sw: number, sh: number, w: number, h: number): { canvas: Source; sx: number; sy: number; sw: number; sh: number } {
  let current: Source = source;
  let cx = sx, cy = sy, cw = sw, ch = sh;
  while (cw / 2 > w && ch / 2 > h) {
    const half = makeCanvas(cw / 2, ch / 2);
    const ctx = context(half);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(current as CanvasImageSource, cx, cy, cw, ch, 0, 0, half.width, half.height);
    current = half;
    cx = 0; cy = 0; cw = half.width; ch = half.height;
  }
  return { canvas: current, sx: cx, sy: cy, sw: cw, sh: ch };
}

export interface Transform {
  width: number;
  height: number;
  fit?: Fit;
  /** Source rectangle, in source pixels, after rotation. */
  crop?: { x: number; y: number; w: number; h: number };
  /** Quarter turns clockwise. */
  rotate?: 0 | 1 | 2 | 3;
  flipX?: boolean;
  flipY?: boolean;
  /** Fill behind transparent areas — needed for JPEG, which has no transparency. */
  background?: string;
}

/** Rotate and flip first, as whole pixels, so crops can be measured on what you see. */
export function orient(source: Source, rotate: 0 | 1 | 2 | 3 = 0, flipX = false, flipY = false): Source {
  if (!rotate && !flipX && !flipY) return source;
  const { w, h } = sizeOf(source);
  const swap = rotate % 2 === 1;
  const canvas = makeCanvas(swap ? h : w, swap ? w : h);
  const ctx = context(canvas);
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rotate * Math.PI) / 2);
  ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
  ctx.drawImage(source as CanvasImageSource, -w / 2, -h / 2);
  return canvas;
}

export function render(source: Source, t: Transform): AnyCanvas {
  const oriented = orient(source, t.rotate ?? 0, t.flipX, t.flipY);
  const { w: ow, h: oh } = sizeOf(oriented);
  let { x: sx, y: sy, w: sw, h: sh } = t.crop ?? { x: 0, y: 0, w: ow, h: oh };
  let width = Math.max(1, Math.min(MAX_SIDE, Math.round(t.width)));
  let height = Math.max(1, Math.min(MAX_SIDE, Math.round(t.height)));
  if (width * height > MAX_PIXELS) {
    const k = Math.sqrt(MAX_PIXELS / (width * height));
    width = Math.floor(width * k);
    height = Math.floor(height * k);
  }
  const canvas = makeCanvas(width, height);
  const ctx = context(canvas);
  if (t.background) {
    ctx.fillStyle = t.background;
    ctx.fillRect(0, 0, width, height);
  }
  let dx = 0, dy = 0, dw = width, dh = height;
  if (t.fit === 'cover') {
    const scale = Math.max(width / sw, height / sh);
    const cw = width / scale;
    const ch = height / scale;
    sx += (sw - cw) / 2;
    sy += (sh - ch) / 2;
    sw = cw;
    sh = ch;
  } else if (t.fit === 'contain') {
    const scale = Math.min(width / sw, height / sh);
    dw = sw * scale;
    dh = sh * scale;
    dx = (width - dw) / 2;
    dy = (height - dh) / 2;
  }
  const stepped = stepDown(oriented, sx, sy, sw, sh, dw, dh);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(stepped.canvas as CanvasImageSource, stepped.sx, stepped.sy, stepped.sw, stepped.sh, dx, dy, dw, dh);
  return canvas;
}

export interface CompressResult { blob: Blob; quality: number; width: number; height: number; reached: boolean }

/**
 * The best-looking file under the target: the highest quality that fits, found
 * by halving the range, and only if no quality is small enough, fewer pixels.
 */
export async function compressToTarget(source: Source, type: OutputType, target: number): Promise<CompressResult> {
  const { w, h } = sizeOf(source);
  let scale = Math.min(1, Math.sqrt(MAX_PIXELS / (w * h)));
  let smallest: CompressResult | null = null;
  const background = type === 'image/jpeg' ? '#FFFFFF' : undefined;
  for (let pass = 0; pass < 6; pass += 1) {
    const width = Math.max(1, Math.round(w * scale));
    const height = Math.max(1, Math.round(h * scale));
    const canvas = render(source, { width, height, background });
    const top = await encode(canvas, type, 0.92);
    if (top.size <= target) return { blob: top, quality: 0.92, width, height, reached: true };
    let lo = 0.08;
    let hi = 0.92;
    let best: CompressResult | null = null;
    const floor = await encode(canvas, type, lo);
    if (!smallest || floor.size < smallest.blob.size) smallest = { blob: floor, quality: lo, width, height, reached: floor.size <= target };
    if (floor.size <= target) {
      best = { blob: floor, quality: lo, width, height, reached: true };
      for (let i = 0; i < 7; i += 1) {
        const q = (lo + hi) / 2;
        const blob = await encode(canvas, type, q);
        if (blob.size <= target) { best = { blob, quality: q, width, height, reached: true }; lo = q; } else { hi = q; }
      }
      return best;
    }
    // Even the lowest quality is too big: take away pixels in proportion, and try again.
    scale *= Math.max(0.3, Math.min(0.9, Math.sqrt(target / floor.size) * 0.95));
  }
  return smallest!;
}

export async function encodeWithTransform(source: Source, t: Transform, type: OutputType, quality: number): Promise<{ blob: Blob; width: number; height: number }> {
  const canvas = render(source, { ...t, background: t.background ?? (type === 'image/jpeg' ? '#FFFFFF' : undefined) });
  return { blob: await encode(canvas, type, quality), width: canvas.width, height: canvas.height };
}
