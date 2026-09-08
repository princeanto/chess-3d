/**
 * The picture on the CRT: the Chrome offline page, in classic monochrome.
 *
 * A CRT is 4:3 but the game itself is a wide strip, so rather than letterbox it
 * the screen shows the whole offline page — icon, heading, body copy, the game,
 * and the hint line. That fills the shape honestly and is the form the game is
 * actually recognised in.
 *
 * Everything is drawn at a fixed 512x384 and magnified by the texture with
 * nearest-neighbour filtering, so the pixels stay square and hard-edged instead
 * of being smeared by the GPU.
 */

import { WORLD, type Obstacle, type State } from './engine';
import {
  BIRD_A,
  BIRD_B,
  CACTUS_CLUSTER,
  CACTUS_SMALL,
  CACTUS_TALL,
  CLOUD,
  DINO_DEAD,
  DINO_DUCK_A,
  DINO_DUCK_B,
  DINO_RUN_A,
  DINO_RUN_B,
  DINO_STAND,
  GLYPHS,
  RESTART,
  SPRITE_SCALE,
  spriteSize,
  type Sprite,
} from './sprites';

export const SCREEN_W = 512;
export const SCREEN_H = 384;

/** The band the game occupies, and where its ground line sits. */
export const STRIP_TOP = 138;
export const GROUND_Y = 326;
const STRIP_BOTTOM = 348;

export const INK = '#535353';
export const PAPER = '#f7f7f7';
const INK_SOFT = '#9a9a9a';

/**
 * Screen pixels per world unit. Kept at exactly 1 so sprite edges land on pixel
 * boundaries — the whole reason the strip is sized around the jump arc rather
 * than the other way round.
 */
export const SCALE = 1;

/** The width the engine should treat as visible, so obstacles enter off-screen. */
export const VIEW_WIDTH = SCREEN_W / SCALE;

const worldToScreenY = (worldY: number): number =>
  GROUND_Y + (worldY - WORLD.groundY) * SCALE;

/* ------------------------------- blitting ------------------------------ */

function blit(
  ctx: CanvasRenderingContext2D,
  sprite: Sprite,
  x: number,
  y: number,
  colour = INK,
) {
  ctx.fillStyle = colour;
  const s = SPRITE_SCALE;
  for (let r = 0; r < sprite.length; r += 1) {
    const row = sprite[r];
    let run = 0;
    for (let c = 0; c <= row.length; c += 1) {
      // Runs of adjacent pixels are filled as one rect. A sprite is mostly
      // horizontal strokes, and one fillRect per pixel is ~2000 calls a frame.
      if (row[c] === '#') {
        run += 1;
        continue;
      }
      if (run > 0) {
        ctx.fillRect(x + (c - run) * s, y + r * s, run * s, s);
        run = 0;
      }
    }
  }
}

function textWidth(text: string): number {
  return text.length * 6 * SPRITE_SCALE;
}

function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  colour = INK,
) {
  let cursor = x;
  for (const ch of text.toUpperCase()) {
    const glyph = GLYPHS[ch];
    if (glyph) blit(ctx, glyph, cursor, y, colour);
    cursor += 6 * SPRITE_SCALE;
  }
}

const pad5 = (n: number): string => String(Math.floor(n)).padStart(5, '0');

/* -------------------------------- pieces ------------------------------- */

function obstacleSprite(o: Obstacle, time: number): Sprite {
  switch (o.kind) {
    case 'cactus-small':
      return CACTUS_SMALL;
    case 'cactus-tall':
      return CACTUS_TALL;
    case 'cactus-cluster':
      return CACTUS_CLUSTER;
    case 'bird':
    default:
      // Slow flap: the original alternates about five times a second.
      return Math.floor(time * 5) % 2 === 0 ? BIRD_A : BIRD_B;
  }
}

function runnerSprite(state: State): Sprite {
  const r = state.runner;
  if (state.phase === 'dead') return DINO_DEAD;
  if (state.phase === 'ready') return DINO_STAND;
  if (r.ducking && r.onGround) {
    return Math.floor(state.time * 10) % 2 === 0 ? DINO_DUCK_A : DINO_DUCK_B;
  }
  if (!r.onGround) return DINO_STAND;
  // Leg cadence tracks speed, so the run reads faster as the game accelerates.
  return Math.floor(state.distance / 22) % 2 === 0 ? DINO_RUN_A : DINO_RUN_B;
}

/** The scrolling ground: a solid line with grit scattered under it. */
function drawGround(ctx: CanvasRenderingContext2D, state: State) {
  ctx.fillStyle = INK;
  ctx.fillRect(0, GROUND_Y, SCREEN_W, 2);

  const offset = Math.floor(state.distance) % 46;
  ctx.fillStyle = INK_SOFT;
  for (let i = -1; i < SCREEN_W / 46 + 1; i += 1) {
    const x = i * 46 - offset;
    ctx.fillRect(x + 6, GROUND_Y + 5, 8, 2);
    ctx.fillRect(x + 22, GROUND_Y + 9, 4, 2);
    ctx.fillRect(x + 33, GROUND_Y + 4, 6, 2);
  }
}

function drawClouds(ctx: CanvasRenderingContext2D, state: State) {
  const { w } = spriteSize(CLOUD);
  for (const c of state.clouds) {
    const x = Math.round(c.x * SCALE);
    if (x < -w || x > SCREEN_W) continue;
    // Clouds sit in the upper half of the strip, never over the page copy.
    const y = Math.round(STRIP_TOP + 8 + (c.y % 46));
    blit(ctx, CLOUD, x, y, INK_SOFT);
  }
}

/* -------------------------------- page --------------------------------- */

/**
 * The page furniture around the game. Real text rather than pixel glyphs,
 * because the Chrome page itself is real text — and it keeps the pixel font to
 * the game UI, where it belongs.
 */
function drawPage(ctx: CanvasRenderingContext2D, state: State) {
  blit(ctx, DINO_STAND, 40, 34, INK_SOFT);

  ctx.fillStyle = INK;
  ctx.textBaseline = 'alphabetic';
  ctx.font = '600 21px ui-sans-serif, system-ui, -apple-system, Arial, sans-serif';
  ctx.fillText('No internet', 40, 104);

  ctx.fillStyle = INK_SOFT;
  ctx.font = '12px ui-sans-serif, system-ui, -apple-system, Arial, sans-serif';
  ctx.fillText('Try checking the network cables, or restarting the router.', 40, 124);

  ctx.fillStyle = INK_SOFT;
  ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
  const hint =
    state.phase === 'ready'
      ? 'ERR_INTERNET_DISCONNECTED  ·  press space to play'
      : 'ERR_INTERNET_DISCONNECTED';
  ctx.fillText(hint, 40, 368);
}

/* ------------------------------ CRT effects ----------------------------- */

function drawScanlines(ctx: CanvasRenderingContext2D) {
  // Baked into the picture rather than added as a second mesh, so the lines
  // scale with the texture and stay aligned to its pixels.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.055)';
  for (let y = 0; y < SCREEN_H; y += 3) ctx.fillRect(0, y, SCREEN_W, 1);

  const vignette = ctx.createRadialGradient(
    SCREEN_W / 2,
    SCREEN_H / 2,
    SCREEN_H * 0.34,
    SCREEN_W / 2,
    SCREEN_H / 2,
    SCREEN_H * 0.82,
  );
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(30,32,28,0.3)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
}

/* -------------------------------- render -------------------------------- */

export function renderScreen(ctx: CanvasRenderingContext2D, state: State) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

  drawPage(ctx, state);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, STRIP_TOP, SCREEN_W, STRIP_BOTTOM - STRIP_TOP);
  ctx.clip();

  drawClouds(ctx, state);
  drawGround(ctx, state);

  for (const o of state.obstacles) {
    const sprite = obstacleSprite(o, state.time);
    const { w, h } = spriteSize(sprite);
    const x = Math.round(o.x * SCALE);
    if (x < -w || x > SCREEN_W) continue;
    // Obstacle boxes are anchored by their top edge in world space.
    blit(ctx, sprite, x, Math.round(worldToScreenY(o.y)), INK);
    void h;
  }

  const sprite = runnerSprite(state);
  const { h: rh } = spriteSize(sprite);
  const feet = worldToScreenY(state.runner.y);
  blit(ctx, sprite, 150, Math.round(feet - rh), INK);

  ctx.restore();

  // Score sits above the strip on the right, as it does in the original.
  const scoreText = pad5(state.score);
  drawText(ctx, scoreText, SCREEN_W - 40 - textWidth(scoreText), 90);
  if (state.best > 0) {
    const bestText = `HI ${pad5(state.best)}`;
    drawText(
      ctx,
      bestText,
      SCREEN_W - 40 - textWidth(scoreText) - 26 - textWidth(bestText),
      90,
      INK_SOFT,
    );
  }

  if (state.phase === 'dead') {
    const over = 'GAME OVER';
    drawText(ctx, over, (SCREEN_W - textWidth(over)) / 2, STRIP_TOP + 38);
    const { w: rw } = spriteSize(RESTART);
    blit(ctx, RESTART, (SCREEN_W - rw) / 2, STRIP_TOP + 74);
  }

  drawScanlines(ctx);
}

/** Creates the offscreen canvas the CRT texture is built from. */
export function createScreenCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = SCREEN_W;
  canvas.height = SCREEN_H;
  return canvas;
}

export { worldToScreenY };
