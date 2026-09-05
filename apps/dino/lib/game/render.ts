/**
 * Everything is drawn with paths — no sprite sheet, no image files.
 *
 * That is partly taste and partly the offline requirement: an app with zero
 * binary assets has nothing to fail to load, so the service worker only ever
 * has to cache code. It also means the art scales cleanly to any resolution
 * instead of going soft on a retina display.
 */

import { WORLD, constants, type Obstacle, type State } from './engine';

interface Palette {
  skyTop: string;
  skyBottom: string;
  sun: string;
  sunGlow: string;
  duneFar: string;
  duneNear: string;
  ground: string;
  groundLine: string;
  ink: string;
  dust: string;
  star: number;
}

const DAY: Palette = {
  skyTop: '#dbe6f0',
  skyBottom: '#f6e7d4',
  sun: '#ffd9a0',
  sunGlow: 'rgba(255, 198, 128, 0.55)',
  duneFar: '#c9cfd8',
  duneNear: '#e3d3bb',
  ground: '#efe3cd',
  groundLine: '#b9a892',
  ink: '#26272b',
  dust: 'rgba(150, 132, 108, 0.55)',
  star: 0,
};

const NIGHT: Palette = {
  skyTop: '#10131f',
  skyBottom: '#232a3d',
  sun: '#e8eef7',
  sunGlow: 'rgba(190, 210, 240, 0.28)',
  duneFar: '#1b2030',
  duneNear: '#252c3e',
  ground: '#2b3145',
  groundLine: '#414a63',
  ink: '#e8eaf0',
  dust: 'rgba(180, 190, 210, 0.4)',
  star: 1,
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function mixHex(a: string, b: string, t: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  const c = (k: 'r' | 'g' | 'b') => Math.round(lerp(x[k], y[k], t));
  return `rgb(${c('r')}, ${c('g')}, ${c('b')})`;
}

function blend(t: number): Palette {
  return {
    skyTop: mixHex(DAY.skyTop, NIGHT.skyTop, t),
    skyBottom: mixHex(DAY.skyBottom, NIGHT.skyBottom, t),
    sun: mixHex(DAY.sun, NIGHT.sun, t),
    sunGlow: t > 0.5 ? NIGHT.sunGlow : DAY.sunGlow,
    duneFar: mixHex(DAY.duneFar, NIGHT.duneFar, t),
    duneNear: mixHex(DAY.duneNear, NIGHT.duneNear, t),
    ground: mixHex(DAY.ground, NIGHT.ground, t),
    groundLine: mixHex(DAY.groundLine, NIGHT.groundLine, t),
    ink: mixHex(DAY.ink, NIGHT.ink, t),
    dust: t > 0.5 ? NIGHT.dust : DAY.dust,
    star: t,
  };
}

export function render(
  ctx: CanvasRenderingContext2D,
  state: State,
  width: number,
  height: number,
  frameTime: number,
) {
  const p = blend(state.night);
  const scale = Math.min(width / WORLD.width, height / WORLD.height);
  const offsetX = (width - WORLD.width * scale) / 2;
  const offsetY = (height - WORLD.height * scale) / 2;

  ctx.save();
  ctx.clearRect(0, 0, width, height);

  // Sky fills the whole canvas so letterboxing never shows through.
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, p.skyTop);
  sky.addColorStop(1, p.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  if (state.shake > 0) {
    const k = state.shake * 26;
    ctx.translate((Math.random() - 0.5) * k, (Math.random() - 0.5) * k);
  }

  drawStars(ctx, p, state);
  drawSun(ctx, p, state);
  drawDunes(ctx, p, state);
  drawClouds(ctx, p, state);
  drawGround(ctx, p, state);
  drawParticles(ctx, p, state);
  for (const o of state.obstacles) drawObstacle(ctx, p, o, state);
  drawRunner(ctx, p, state, frameTime);

  ctx.restore();
}

function drawStars(ctx: CanvasRenderingContext2D, p: Palette, s: State) {
  if (p.star < 0.02) return;
  ctx.save();
  ctx.globalAlpha = p.star;
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 46; i += 1) {
    // Fixed pseudo-random field, drifting slowly with the world.
    const x = (((i * 137.5) % WORLD.width) - (s.distance * 0.02) % WORLD.width + WORLD.width) % WORLD.width;
    const y = 14 + ((i * 53) % 150);
    const twinkle = 0.5 + 0.5 * Math.sin(s.time * 2 + i);
    ctx.globalAlpha = p.star * (0.25 + twinkle * 0.6);
    ctx.beginPath();
    ctx.arc(x, y, i % 7 === 0 ? 1.7 : 1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawSun(ctx: CanvasRenderingContext2D, p: Palette, s: State) {
  const x = WORLD.width * 0.78;
  const y = 74;
  const r = p.star > 0.5 ? 26 : 34;

  const glow = ctx.createRadialGradient(x, y, r * 0.4, x, y, r * 3.4);
  glow.addColorStop(0, p.sunGlow);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);

  ctx.fillStyle = p.sun;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // A crescent bite turns the sun into a moon without a second asset.
  if (p.star > 0.5) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x + 11, y - 7, r * 0.92, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
}

function duneHeight(seed: number, t: number): number {
  return (
    52 +
    Math.sin(t * 1.7 + seed) * 16 +
    Math.sin(t * 3.1 + seed * 1.7) * 9 +
    Math.sin(t * 0.7 + seed * 0.4) * 12
  );
}

function drawDunes(ctx: CanvasRenderingContext2D, p: Palette, s: State) {
  const layers: Array<{ colour: string; parallax: number; base: number; scaleY: number }> = [
    { colour: p.duneFar, parallax: 0.35, base: WORLD.groundY - 6, scaleY: 1 },
    { colour: p.duneNear, parallax: 0.62, base: WORLD.groundY + 4, scaleY: 0.66 },
  ];

  for (const layer of layers) {
    ctx.fillStyle = layer.colour;
    ctx.beginPath();
    ctx.moveTo(0, WORLD.height);
    const shift = (s.distance * layer.parallax * 0.08) % 200;
    for (let x = -20; x <= WORLD.width + 20; x += 10) {
      const t = (x + shift) / 90;
      ctx.lineTo(x, layer.base - duneHeight(layer.parallax * 10, t) * layer.scaleY);
    }
    ctx.lineTo(WORLD.width + 20, WORLD.height);
    ctx.closePath();
    ctx.fill();
  }
}

function drawClouds(ctx: CanvasRenderingContext2D, p: Palette, s: State) {
  ctx.save();
  ctx.globalAlpha = 0.85 - p.star * 0.55;
  ctx.fillStyle = p.star > 0.5 ? '#3a4560' : '#ffffff';
  for (const c of s.clouds) {
    const w = 54 * c.scale;
    const h = 15 * c.scale;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, w, h, 0, 0, Math.PI * 2);
    ctx.ellipse(c.x + w * 0.55, c.y + h * 0.2, w * 0.6, h * 0.78, 0, 0, Math.PI * 2);
    ctx.ellipse(c.x - w * 0.5, c.y + h * 0.25, w * 0.5, h * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawGround(ctx: CanvasRenderingContext2D, p: Palette, s: State) {
  ctx.fillStyle = p.ground;
  ctx.fillRect(0, WORLD.groundY, WORLD.width, WORLD.height - WORLD.groundY);

  ctx.strokeStyle = p.groundLine;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, WORLD.groundY + 1);
  ctx.lineTo(WORLD.width, WORLD.groundY + 1);
  ctx.stroke();

  // Speckle that scrolls with the world, so speed is legible even on flat ground.
  ctx.fillStyle = p.groundLine;
  ctx.globalAlpha = 0.5;
  const shift = s.distance % 60;
  for (let i = 0; i < 40; i += 1) {
    const x = ((i * 71) % (WORLD.width + 60)) - shift;
    const y = WORLD.groundY + 12 + ((i * 29) % 46);
    const w = i % 5 === 0 ? 14 : 6;
    ctx.fillRect(x, y, w, 2);
  }
  ctx.globalAlpha = 1;
}

function drawParticles(ctx: CanvasRenderingContext2D, p: Palette, s: State) {
  ctx.fillStyle = p.dust;
  for (const particle of s.particles) {
    ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife) * 0.8;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function drawObstacle(
  ctx: CanvasRenderingContext2D,
  p: Palette,
  o: Obstacle,
  s: State,
) {
  ctx.save();
  // Contact shadow, tighter and darker the closer the object is to the ground.
  const gap = Math.max(0, WORLD.groundY - (o.y + o.h));
  ctx.globalAlpha = 0.18 * (1 - Math.min(1, gap / 90));
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.ellipse(o.x + o.w / 2, WORLD.groundY + 3, o.w * 0.55, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = p.ink;

  if (o.kind === 'bird') {
    const flap = Math.sin(o.phase * 13);
    const cx = o.x + o.w / 2;
    const cy = o.y + o.h / 2;
    // Body
    ctx.beginPath();
    ctx.ellipse(cx, cy, 15, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    // Beak
    ctx.beginPath();
    ctx.moveTo(cx + 13, cy - 1);
    ctx.lineTo(cx + 25, cy + 2);
    ctx.lineTo(cx + 13, cy + 5);
    ctx.closePath();
    ctx.fill();
    // Wings, mirrored around the body
    ctx.beginPath();
    ctx.moveTo(cx - 2, cy - 2);
    ctx.quadraticCurveTo(cx - 14, cy - 6 + flap * 16, cx - 26, cy - 2 + flap * 20);
    ctx.quadraticCurveTo(cx - 14, cy + 2 + flap * 10, cx - 2, cy + 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    return;
  }

  /**
   * Trunk plus arms, each arm an elbow: out, then up. The first version used
   * arms as wide as the trunk and half its height, which read as a blob rather
   * than a cactus.
   */
  const drawCactus = (cx: number, cy: number, cw: number, ch: number) => {
    const limb = cw * 0.62;
    roundRect(ctx, cx, cy, cw, ch, cw / 2);
    ctx.fill();

    // Left arm
    const lY = cy + ch * 0.42;
    roundRect(ctx, cx - limb * 1.5, lY, limb * 1.5 + cw * 0.4, limb, limb / 2);
    ctx.fill();
    roundRect(ctx, cx - limb * 1.5, lY - ch * 0.26, limb, ch * 0.26 + limb, limb / 2);
    ctx.fill();

    // Right arm, set lower so the two do not mirror
    const rY = cy + ch * 0.56;
    roundRect(ctx, cx + cw * 0.6, rY, limb * 1.4, limb, limb / 2);
    ctx.fill();
    roundRect(ctx, cx + cw * 0.6 + limb * 0.4, rY - ch * 0.2, limb, ch * 0.2 + limb, limb / 2);
    ctx.fill();
  };

  if (o.kind === 'cactus-cluster') {
    drawCactus(o.x + 8, o.y + 10, 16, o.h - 10);
    drawCactus(o.x + 34, o.y, 18, o.h);
  } else {
    drawCactus(o.x + o.w * 0.18, o.y, o.w * 0.64, o.h);
  }

  ctx.restore();
}

/**
 * The runner, as one continuous silhouette.
 *
 * The first version stacked rounded rectangles for head, body and tail. At
 * playing size that reads as a blob: there is no neck, the head merges into the
 * shoulders and the tail looks detached. A single closed path, authored in a
 * 100x100 local space and scaled, gives the profile a real neck and a tail with
 * weight — which is the whole silhouette a player actually recognises.
 */
function dinoBody(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const px = (l: number) => x + (l / 100) * w;
  const py = (l: number) => y + (l / 100) * h;

  ctx.beginPath();
  ctx.moveTo(px(97), py(19));
  ctx.lineTo(px(75), py(9)); // brow
  ctx.bezierCurveTo(px(64), py(2), px(51), py(7), px(49), py(20)); // skull
  ctx.bezierCurveTo(px(47), py(30), px(43), py(35), px(35), py(39)); // nape into neck
  ctx.bezierCurveTo(px(25), py(43), px(15), py(43), px(7), py(45)); // back
  ctx.bezierCurveTo(px(-3), py(41), px(-13), py(39), px(-19), py(43)); // tail, sweeping up
  ctx.bezierCurveTo(px(-8), py(51), px(2), py(55), px(12), py(57)); // tail underside
  ctx.bezierCurveTo(px(20), py(61), px(24), py(67), px(27), py(75)); // haunch
  ctx.lineTo(px(59), py(75)); // belly
  ctx.bezierCurveTo(px(65), py(67), px(67), py(57), px(65), py(47)); // chest
  ctx.bezierCurveTo(px(65), py(38), px(71), py(32), px(79), py(30)); // throat to jaw
  ctx.lineTo(px(97), py(28)); // muzzle underside
  ctx.closePath();
  ctx.fill();

  // The little arm. Small, but it is the one detail that says tyrannosaur.
  roundRect(ctx, px(56), py(48), w * 0.14, h * 0.07, h * 0.035);
  ctx.fill();
}

function drawRunner(
  ctx: CanvasRenderingContext2D,
  p: Palette,
  s: State,
  frameTime: number,
) {
  const r = s.runner;
  const ducking = r.ducking && r.onGround;
  const h = ducking ? constants.DUCK_H : constants.RUNNER_H;
  const w = ducking ? constants.RUNNER_W + 14 : constants.RUNNER_W;
  const x = constants.RUNNER_X;
  const baseY = r.y;

  // Squash and stretch, conserving area so the silhouette stays believable.
  const sy = r.squash;
  const sx = 1 / Math.sqrt(Math.max(0.35, sy));

  ctx.save();

  const air = Math.max(0, WORLD.groundY - baseY);
  ctx.globalAlpha = 0.2 * (1 - Math.min(1, air / 120));
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.ellipse(x + w / 2, WORLD.groundY + 3, w * 0.5, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.translate(x + w / 2, baseY);
  ctx.scale(sx, sy);
  ctx.translate(-(x + w / 2), -baseY);

  ctx.fillStyle = p.ink;

  // Legs first, so the body overlaps them at the hip.
  const running = s.phase === 'running' && r.onGround;
  const cycle = Math.floor(frameTime * 15) % 2;
  const hipY = baseY - h * 0.3;
  const legW = w * 0.13;
  const thigh = h * 0.3;

  const leg = (lx: number, drop: number, len: number) => {
    roundRect(ctx, lx, hipY + drop, legW, len, legW * 0.5);
    ctx.fill();
    // Foot
    roundRect(ctx, lx - legW * 0.15, hipY + drop + len - legW * 0.4, legW * 1.7, legW * 0.62, legW * 0.3);
    ctx.fill();
  };

  if (!r.onGround) {
    leg(x + w * 0.3, -h * 0.02, thigh * 0.62);
    leg(x + w * 0.52, -h * 0.08, thigh * 0.6);
  } else if (running && cycle === 0) {
    leg(x + w * 0.26, 0, thigh);
    leg(x + w * 0.54, h * 0.08, thigh * 0.72);
  } else {
    leg(x + w * 0.28, h * 0.08, thigh * 0.72);
    leg(x + w * 0.52, 0, thigh);
  }

  // Ducking flattens and stretches the profile forward rather than swapping in
  // a separate crouched drawing.
  const bodyTop = baseY - h;
  if (ducking) {
    ctx.save();
    ctx.translate(x + w / 2, bodyTop + h * 0.5);
    ctx.scale(1.16, 0.78);
    ctx.translate(-(x + w / 2), -(bodyTop + h * 0.5));
    dinoBody(ctx, x, bodyTop, w, h * 1.24);
    ctx.restore();
  } else {
    dinoBody(ctx, x, bodyTop, w, h);
  }

  // Eye, punched out so it works whatever colour the body is.
  const eyeX = x + w * (ducking ? 0.84 : 0.78);
  const eyeY = bodyTop + h * (ducking ? 0.2 : 0.16);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(eyeX, eyeY, Math.max(2.4, w * 0.062), 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  ctx.restore();
}
