import * as THREE from 'three';

/**
 * The board surface — squares, frame, inlay and coordinates — is baked into one
 * canvas texture, so the whole board is a single draw call and the wood grain
 * can be authored properly instead of being faked with a flat colour.
 */

export const BOARD_SPAN = 8; // playing surface, in world units
export const FRAME = 0.5; // frame width
export const TOTAL = BOARD_SPAN + FRAME * 2;

const LIGHT_SQUARE = [222, 199, 164];
const DARK_SQUARE = [92, 60, 42];
const FRAME_COLOR = [46, 32, 23];

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Rings distorted by low-frequency noise — the essential look of sawn timber. */
function grain(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  base: number[],
  seed: number,
  strength: number,
  angle: number,
) {
  const rand = mulberry32(seed);
  // Ring centres sit far off the square so only a gentle arc crosses it.
  const cx = x + w * (rand() * 6 - 2.5);
  const cy = y + h * (rand() * 8 - 3.5);
  const spacing = 14 + rand() * 16;
  const img = ctx.getImageData(x, y, Math.ceil(w), Math.ceil(h));
  const data = img.data;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  for (let py = 0; py < img.height; py += 1) {
    for (let px = 0; px < img.width; px += 1) {
      const gx = px + x - cx;
      const gy = py + y - cy;
      const rx = gx * cos - gy * sin;
      const ry = (gx * sin + gy * cos) * 0.32;
      const d = Math.sqrt(rx * rx + ry * ry);
      const wobble = Math.sin(d * 0.03 + rx * 0.008) * 9 + Math.sin(ry * 0.02) * 4;
      const ring = Math.sin((d + wobble) / spacing);
      // Fine longitudinal fibre carries most of the character.
      const fibre =
        Math.sin(ry * 0.9 + Math.sin(rx * 0.05) * 2) * 0.5 +
        Math.sin(ry * 2.3) * 0.28 +
        Math.sin(ry * 5.7) * 0.12;
      const v = (ring * 0.34 + fibre * 0.66) * strength;
      const i = (py * img.width + px) * 4;
      data[i] = Math.max(0, Math.min(255, base[0] + v));
      data[i + 1] = Math.max(0, Math.min(255, base[1] + v * 0.86));
      data[i + 2] = Math.max(0, Math.min(255, base[2] + v * 0.66));
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, x, y);
}

export function createBoardTexture(resolution = 2048): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = resolution;
  canvas.height = resolution;
  const ctx = canvas.getContext('2d')!;
  const px = resolution / TOTAL; // world unit -> pixels
  const frame = FRAME * px;
  const square = px;

  ctx.fillStyle = `rgb(${FRAME_COLOR.join(',')})`;
  ctx.fillRect(0, 0, resolution, resolution);
  grain(ctx, 0, 0, resolution, resolution, FRAME_COLOR, 77, 11, 0.06);

  for (let rank = 0; rank < 8; rank += 1) {
    for (let file = 0; file < 8; file += 1) {
      const light = (rank + file) % 2 === 1;
      const x = frame + file * square;
      // Texture rows run top-down; rank 8 is at the top.
      const y = frame + (7 - rank) * square;
      const base = light ? LIGHT_SQUARE : DARK_SQUARE;
      ctx.fillStyle = `rgb(${base.join(',')})`;
      ctx.fillRect(x, y, square, square);
      grain(
        ctx,
        x,
        y,
        square,
        square,
        base,
        rank * 8 + file + 11,
        light ? 9 : 7,
        (rank + file) % 4 < 2 ? 0.08 : 1.5,
      );
    }
  }

  // Brass inlay between frame and playing surface.
  ctx.strokeStyle = 'rgba(198, 158, 78, 0.85)';
  ctx.lineWidth = Math.max(2, px * 0.022);
  ctx.strokeRect(frame - ctx.lineWidth, frame - ctx.lineWidth, square * 8 + ctx.lineWidth * 2, square * 8 + ctx.lineWidth * 2);

  // Coordinates on all four edges so they read from either side of the board.
  const label = Math.round(px * 0.195);
  ctx.fillStyle = 'rgba(206, 183, 146, 0.6)';
  ctx.font = `600 ${label}px ui-monospace, "SF Mono", Menlo, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const files = 'abcdefgh';
  for (let f = 0; f < 8; f += 1) {
    const cx = frame + f * square + square / 2;
    ctx.fillText(files[f], cx, frame + 8 * square + frame / 2);
    ctx.save();
    ctx.translate(cx, frame / 2);
    ctx.rotate(Math.PI);
    ctx.fillText(files[f], 0, 0);
    ctx.restore();
  }
  for (let r = 0; r < 8; r += 1) {
    const cy = frame + (7 - r) * square + square / 2;
    ctx.save();
    ctx.translate(frame / 2, cy);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(String(r + 1), 0, 0);
    ctx.restore();
    ctx.save();
    ctx.translate(frame + 8 * square + frame / 2, cy);
    ctx.rotate(Math.PI / 2);
    ctx.fillText(String(r + 1), 0, 0);
    ctx.restore();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** Roughness map so light squares gloss slightly differently from dark ones. */
export function createBoardRoughness(resolution = 512): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = resolution;
  canvas.height = resolution;
  const ctx = canvas.getContext('2d')!;
  const px = resolution / TOTAL;
  const frame = FRAME * px;

  ctx.fillStyle = '#8a8a8a';
  ctx.fillRect(0, 0, resolution, resolution);
  for (let rank = 0; rank < 8; rank += 1) {
    for (let file = 0; file < 8; file += 1) {
      const light = (rank + file) % 2 === 1;
      ctx.fillStyle = light ? '#6e6e6e' : '#5a5a5a';
      ctx.fillRect(frame + file * px, frame + (7 - rank) * px, px, px);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  return texture;
}
