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
  body: string;
  glow: string;
  /** Mid stop, so the falloff is not a hard ring. */
  glowMid: string;
  duneFar: string;
  duneNear: string;
  ground: string;
  groundLine: string;
  /** Scene ink: the runner and obstacles. Chosen against the ground, not
   *  interpolated — ground and ink cross from light to dark at the same moment,
   *  so blending both leaves the silhouette invisible for the whole dawn. */
  ink: string;
  /**
   * HUD ink, chosen per screen region rather than once for the whole overlay.
   * At dawn the sky's top is dark violet while its bottom is pale peach, so no
   * single ink is readable at both ends of the screen.
   */
  hudTop: string;
  hudMid: string;
  hudBottom: string;
  /** Reads against `hudMid` when that is used as a button fill. */
  onHudMid: string;
  cloud: string;
  dust: string;
  /** How much of the star field shows, 0..1. */
  star: number;
}

/**
 * Four times of day, not two.
 *
 * The first version lerped between one day palette and one night palette in
 * sRGB. Blending a warm light scheme to a cool dark one that way passes
 * straight through desaturated grey, so the halfway point — which is most of
 * what a player sees, because it is the transition — looked washed out and
 * muddy. Keyframing dawn and dusk gives those minutes their own colour, and
 * mixing in OKLab keeps saturation up across every crossing.
 */
type Key = Omit<Palette, 'hudTop' | 'hudMid' | 'hudBottom' | 'onHudMid' | 'ink'>;

const KEYS: Array<{ at: number; p: Key }> = [
  {
    at: 0,
    p: {
      skyTop: '#9ec6ea',
      skyBottom: '#f4e2c6',
      body: '#ffd77f',
      glow: 'rgba(255, 196, 110, 0.5)',
      glowMid: 'rgba(255, 176, 90, 0.14)',
      duneFar: '#aebfd4',
      duneNear: '#e2cfae',
      ground: '#eddfc2',
      groundLine: '#b09a7c',
      cloud: '#ffffff',
      dust: 'rgba(150, 132, 108, 0.55)',
      star: 0,
    },
  },
  {
    at: 0.34,
    p: {
      skyTop: '#4c4a8f',
      skyBottom: '#f0855c',
      body: '#ffb257',
      glow: 'rgba(255, 140, 80, 0.55)',
      glowMid: 'rgba(255, 110, 70, 0.16)',
      duneFar: '#5a5288',
      duneNear: '#a86a72',
      ground: '#96626a',
      groundLine: '#b8828b',
      cloud: '#f2a98d',
      dust: 'rgba(220, 160, 130, 0.5)',
      star: 0.25,
    },
  },
  {
    at: 0.52,
    p: {
      skyTop: '#070b1c',
      skyBottom: '#1c2547',
      body: '#e4ecfb',
      glow: 'rgba(180, 205, 255, 0.3)',
      glowMid: 'rgba(150, 180, 240, 0.09)',
      duneFar: '#121a33',
      duneNear: '#1e2748',
      ground: '#232c4e',
      groundLine: '#3d497a',
      cloud: '#2f3a63',
      dust: 'rgba(170, 185, 220, 0.42)',
      star: 1,
    },
  },
  {
    at: 0.72,
    p: {
      skyTop: '#161a3a',
      skyBottom: '#4b3566',
      body: '#cdb9e8',
      glow: 'rgba(150, 120, 200, 0.3)',
      glowMid: 'rgba(130, 100, 180, 0.1)',
      duneFar: '#1d2044',
      duneNear: '#33284f',
      ground: '#33294f',
      groundLine: '#4d3f6d',
      cloud: '#3b3160',
      dust: 'rgba(180, 160, 210, 0.42)',
      star: 0.75,
    },
  },
  {
    at: 0.86,
    p: {
      skyTop: '#6d7fc0',
      skyBottom: '#f7c9a4',
      body: '#ffe0ae',
      glow: 'rgba(255, 210, 165, 0.45)',
      glowMid: 'rgba(255, 185, 145, 0.13)',
      duneFar: '#7f8cba',
      duneNear: '#cfae99',
      ground: '#dfc9b0',
      groundLine: '#a3897a',
      cloud: '#ffd9c2',
      dust: 'rgba(180, 150, 130, 0.5)',
      star: 0.3,
    },
  },
];

/* ------------------------ colour, blended in OKLab ----------------------- */

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const fromLinear = (c: number) =>
  c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(Math.max(c, 0), 1 / 2.4) - 0.055;

function toOklab(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s2 = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s2,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s2,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s2,
  };
}

function fromOklab(L: number, a: number, b: number): string {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s2 = s_ * s_ * s_;
  const to255 = (v: number) => Math.round(Math.min(1, Math.max(0, fromLinear(v))) * 255);
  return `rgb(${to255(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s2)}, ${to255(
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s2,
  )}, ${to255(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s2)})`;
}

const cache = new Map<string, ReturnType<typeof toOklab>>();
function lab(hex: string) {
  let v = cache.get(hex);
  if (!v) {
    v = toOklab(hex);
    cache.set(hex, v);
  }
  return v;
}

function mix(a: string, b: string, t: number): string {
  const x = lab(a);
  const y = lab(b);
  return fromOklab(
    x.L + (y.L - x.L) * t,
    x.a + (y.a - x.a) * t,
    x.b + (y.b - x.b) * t,
  );
}

/** Smoothstep, so a keyframe is approached and left gently. */
const ease = (t: number) => t * t * (3 - 2 * t);

const HUD_DARK = '#1a1b22';
const HUD_LIGHT = '#f4f6ff';
const INK_DARK = '#1f2027';
const INK_LIGHT = '#f0f3ff';

/**
 * Accepts both `#rrggbb` and `rgb(...)`. The ink constants are hex while every
 * blended colour comes back as rgb(), and a version that only understood the
 * latter scraped the digits out of a hex string as if they were channels —
 * which silently picked the wrong ink for half the cycle.
 */
function relLuminance(css: string): number {
  const text = css.trim();
  let r: number;
  let g: number;
  let b: number;

  if (text.startsWith('#')) {
    let hex = text.slice(1);
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
    const n = parseInt(hex.slice(0, 6), 16);
    r = (n >> 16) & 255;
    g = (n >> 8) & 255;
    b = n & 255;
  } else {
    const m = text.match(/-?\d+(\.\d+)?/g);
    if (!m || m.length < 3) return 0.5;
    r = +m[0];
    g = +m[1];
    b = +m[2];
  }

  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

const ratio = (a: number, b: number) =>
  (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/**
 * HUD ink is chosen, not blended.
 *
 * Interpolating it from dark to light across the cycle drags it through mid
 * grey, and at dusk — where the sky is also mid-toned — the overlay drops to
 * about 1:1 and vanishes. Picking whichever of a fixed dark and a fixed light
 * has more contrast right now keeps it maximally readable, and the swap happens
 * exactly where the two are equal, so it is invisible.
 */
function inkForLum(bg: number): string {
  return ratio(relLuminance(HUD_DARK), bg) >= ratio(relLuminance(HUD_LIGHT), bg)
    ? HUD_DARK
    : HUD_LIGHT;
}

const inkFor = (background: string) => inkForLum(relLuminance(background));

/** Same reasoning as the HUD, but measured against the ground the runner is on. */
function sceneInk(ground: string): string {
  const g = relLuminance(ground);
  return ratio(relLuminance(INK_DARK), g) >= ratio(relLuminance(INK_LIGHT), g)
    ? INK_DARK
    : INK_LIGHT;
}

function climate(cycle: number): Palette {
  const c = ((cycle % 1) + 1) % 1;
  let i = 0;
  for (let k = 0; k < KEYS.length; k += 1) if (c >= KEYS[k].at) i = k;
  const from = KEYS[i];
  const to = KEYS[(i + 1) % KEYS.length];
  const span = (to.at > from.at ? to.at : to.at + 1) - from.at;
  const t = ease(Math.min(1, Math.max(0, (c - from.at) / span)));

  const a = from.p;
  const b = to.p;
  const skyTop = mix(a.skyTop, b.skyTop, t);
  const skyBottom = mix(a.skyBottom, b.skyBottom, t);
  const ground = mix(a.ground, b.ground, t);
  const hudMid = inkForLum(
    (relLuminance(skyTop) + relLuminance(skyBottom)) / 2,
  );
  return {
    hudTop: inkFor(skyTop),
    hudMid,
    hudBottom: inkFor(skyBottom),
    onHudMid: hudMid === HUD_DARK ? HUD_LIGHT : HUD_DARK,
    ink: sceneInk(ground),
    ground,
    skyTop,
    skyBottom,
    body: mix(a.body, b.body, t),
    glow: t < 0.5 ? a.glow : b.glow,
    glowMid: t < 0.5 ? a.glowMid : b.glowMid,
    duneFar: mix(a.duneFar, b.duneFar, t),
    duneNear: mix(a.duneNear, b.duneNear, t),
    groundLine: mix(a.groundLine, b.groundLine, t),
    cloud: mix(a.cloud, b.cloud, t),
    dust: t < 0.5 ? a.dust : b.dust,
    star: a.star + (b.star - a.star) * t,
  };
}

/** What the HUD needs to stay readable against a sky that keeps changing. */
export function hudInk(cycle: number): string {
  return climate(cycle).hudTop;
}

/** Exposed for the palette test; the game itself never calls this directly. */
export const paletteAt = climate;

export function render(
  ctx: CanvasRenderingContext2D,
  state: State,
  width: number,
  height: number,
  frameTime: number,
  dpr: number,
): Palette {
  const p = climate(state.cycle);

  // Scale from height so the world is always the same "tall", then let the
  // width follow the viewport. Clamped so an extremely wide window does not
  // shrink the runner to nothing.
  const scale = Math.min(height / WORLD.height, width / WORLD.minWidth);
  const viewWidth = width / scale;

  // The device-pixel-ratio transform is re-established every frame rather than
  // set once on resize. Anything that reassigns canvas.width silently resets the
  // context to identity, and the scene then renders at half size in the corner
  // of a retina backing store — which also covers a window being dragged to a
  // display with a different pixel ratio.
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.save();
  ctx.clearRect(0, 0, width, height);

  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, p.skyTop);
  sky.addColorStop(1, p.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  ctx.scale(scale, scale);

  if (state.shake > 0) {
    const k = state.shake * 26;
    ctx.translate((Math.random() - 0.5) * k, (Math.random() - 0.5) * k);
  }

  drawStars(ctx, p, state, viewWidth);
  drawBody(ctx, p, state, viewWidth);
  drawDunes(ctx, p, state, viewWidth);
  drawClouds(ctx, p, state);
  drawGround(ctx, p, state, viewWidth, height / scale);
  drawParticles(ctx, p, state);
  for (const o of state.obstacles) drawObstacle(ctx, p, o, state);
  drawRunner(ctx, p, state, frameTime);

  ctx.restore();
  return p;
}

function drawStars(ctx: CanvasRenderingContext2D, p: Palette, s: State, viewWidth: number) {
  if (p.star < 0.02) return;
  ctx.save();
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 64; i += 1) {
    // Fixed pseudo-random field, drifting slowly with the world.
    const x = ((((i * 137.5) % viewWidth) - (s.distance * 0.02)) % viewWidth + viewWidth) % viewWidth;
    const y = 12 + ((i * 53) % 160);
    const twinkle = 0.5 + 0.5 * Math.sin(s.time * 2 + i);
    ctx.globalAlpha = p.star * (0.25 + twinkle * 0.6);
    ctx.beginPath();
    ctx.arc(x, y, i % 7 === 0 ? 1.7 : 1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * One body that rises, crosses and sets — sun through the day half of the
 * cycle, moon through the night half. Previously a fixed disc that had a
 * crescent bitten out of it when night arrived, which read as a light being
 * switched rather than time passing.
 */
function drawBody(ctx: CanvasRenderingContext2D, p: Palette, s: State, viewWidth: number) {
  const c = ((s.cycle % 1) + 1) % 1;
  // Two arcs offset by half a cycle: while one body is above the horizon the
  // other is below it, so exactly one is ever visible.
  const isNight = c > 0.43 && c < 0.95;
  const t = isNight ? (c - 0.43) / 0.52 : (c < 0.43 ? c + 0.05 : c - 0.95) / 0.53;

  const x = viewWidth * (0.08 + 0.84 * t);
  const arc = Math.sin(Math.min(1, Math.max(0, t)) * Math.PI);
  const y = WORLD.groundY - 30 - arc * 190;
  const r = isNight ? 24 : 32;

  // Additive, not painted over. A translucent warm gradient laid on top of a
  // blue sky greys it out and reads as a smudge; 'lighter' adds light, which is
  // what a glow physically is.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const glow = ctx.createRadialGradient(x, y, r * 0.25, x, y, r * 3.8);
  glow.addColorStop(0, p.glow);
  glow.addColorStop(0.45, p.glowMid);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - r * 4.2, y - r * 4.2, r * 8.4, r * 8.4);
  ctx.restore();

  ctx.fillStyle = p.body;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  if (isNight) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x + 10, y - 7, r * 0.9, 0, Math.PI * 2);
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

function drawDunes(ctx: CanvasRenderingContext2D, p: Palette, s: State, viewWidth: number) {
  const layers: Array<{ colour: string; parallax: number; base: number; scaleY: number }> = [
    { colour: p.duneFar, parallax: 0.35, base: WORLD.groundY - 6, scaleY: 1 },
    { colour: p.duneNear, parallax: 0.62, base: WORLD.groundY + 4, scaleY: 0.66 },
  ];

  for (const layer of layers) {
    ctx.fillStyle = layer.colour;
    ctx.beginPath();
    ctx.moveTo(0, WORLD.height * 2);
    const shift = (s.distance * layer.parallax * 0.08) % 200;
    for (let x = -20; x <= viewWidth + 20; x += 10) {
      const t = (x + shift) / 90;
      ctx.lineTo(x, layer.base - duneHeight(layer.parallax * 10, t) * layer.scaleY);
    }
    ctx.lineTo(viewWidth + 20, WORLD.height * 2);
    ctx.closePath();
    ctx.fill();
  }
}

function drawClouds(ctx: CanvasRenderingContext2D, p: Palette, s: State) {
  ctx.save();
  ctx.globalAlpha = 0.9 - p.star * 0.45;
  ctx.fillStyle = p.cloud;
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

function drawGround(
  ctx: CanvasRenderingContext2D,
  p: Palette,
  s: State,
  viewWidth: number,
  viewHeight: number,
) {
  // Extends past the bottom of the viewport so a full-bleed canvas never shows
  // the page behind it, whatever the window aspect happens to be.
  ctx.fillStyle = p.ground;
  ctx.fillRect(0, WORLD.groundY, viewWidth, Math.max(viewHeight, WORLD.height) - WORLD.groundY);

  ctx.strokeStyle = p.groundLine;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, WORLD.groundY + 1);
  ctx.lineTo(viewWidth, WORLD.groundY + 1);
  ctx.stroke();

  // Speckle that scrolls with the world, so speed is legible even on flat ground.
  ctx.fillStyle = p.groundLine;
  ctx.globalAlpha = 0.5;
  const shift = s.distance % 60;
  for (let i = 0; i < 56; i += 1) {
    const x = ((i * 71) % (viewWidth + 60)) - shift;
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
 * The runner.
 *
 * Authored in a 100x100 local box and scaled, so the proportions hold at any
 * size. Two earlier attempts failed for the same reason in different ways:
 * stacked rounded rectangles gave a blob with no neck, and a single blunt path
 * gave a neck but no jaw or knee. What actually makes it read as a tyrannosaur
 * at a glance is the profile of the skull — brow, deep jaw, blunt snout — and
 * legs that bend, so the run cycle has a knee to move.
 */
function dinoSilhouette(
  ctx: CanvasRenderingContext2D,
  X: (l: number) => number,
  Y: (l: number) => number,
) {
  ctx.beginPath();
  ctx.moveTo(X(99), Y(15));
  ctx.lineTo(X(82), Y(10)); // top of the snout
  ctx.quadraticCurveTo(X(73), Y(3), X(63), Y(6)); // brow ridge
  ctx.quadraticCurveTo(X(54), Y(9), X(53), Y(19)); // back of the skull
  ctx.bezierCurveTo(X(51), Y(29), X(45), Y(33), X(37), Y(37)); // nape into the neck
  ctx.bezierCurveTo(X(27), Y(41), X(17), Y(42), X(9), Y(45)); // along the back
  ctx.bezierCurveTo(X(-5), Y(41), X(-18), Y(36), X(-30), Y(32)); // tail, tapering
  ctx.bezierCurveTo(X(-17), Y(44), X(-4), Y(50), X(9), Y(55)); // tail underside
  ctx.bezierCurveTo(X(17), Y(60), X(23), Y(67), X(27), Y(75)); // haunch
  ctx.lineTo(X(53), Y(77)); // belly
  ctx.bezierCurveTo(X(61), Y(71), X(64), Y(60), X(62), Y(50)); // chest
  ctx.bezierCurveTo(X(61), Y(41), X(63), Y(34), X(69), Y(30)); // throat
  ctx.lineTo(X(85), Y(29)); // jaw line
  ctx.lineTo(X(99), Y(25)); // blunt snout
  ctx.closePath();
  ctx.fill();
}

/** Thigh, shin and foot, so the run cycle has a knee rather than a sliding stump. */
function dinoLeg(
  ctx: CanvasRenderingContext2D,
  X: (l: number) => number,
  Y: (l: number) => number,
  unit: number,
  hipX: number,
  kneeX: number,
  kneeY: number,
  footX: number,
  footY: number,
) {
  const limb = unit * 9;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.lineWidth = limb * 1.25;
  ctx.beginPath();
  ctx.moveTo(X(hipX), Y(62));
  ctx.lineTo(X(kneeX), Y(kneeY));
  ctx.stroke();

  ctx.lineWidth = limb * 0.85;
  ctx.beginPath();
  ctx.moveTo(X(kneeX), Y(kneeY));
  ctx.lineTo(X(footX), Y(footY));
  ctx.stroke();

  // Foot, pointing forward.
  ctx.lineWidth = limb * 0.7;
  ctx.beginPath();
  ctx.moveTo(X(footX - 2), Y(footY));
  ctx.lineTo(X(footX + 9), Y(footY));
  ctx.stroke();
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
  const w = ducking ? constants.RUNNER_W + 16 : constants.RUNNER_W;
  const x = constants.RUNNER_X;
  const baseY = r.y;

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

  // Ducking squashes the whole profile and stretches it forward, rather than
  // swapping in a second drawing that would not match.
  const squat = ducking ? 0.74 : 1;
  const stretch = ducking ? 1.2 : 1;
  const boxH = h / squat;
  const top = baseY - h;

  const X = (l: number) => x + (l / 100) * w * stretch - (stretch - 1) * w * 0.28;
  const Y = (l: number) => top + (l / 100) * boxH * squat;
  const unit = (w / 100) * 1.35;

  ctx.fillStyle = p.ink;
  ctx.strokeStyle = p.ink;

  // Back leg first so the body overlaps it, then the front leg on top.
  const grounded = r.onGround;
  const cycle = Math.floor(frameTime * 15) % 2;
  const airPose = !grounded;

  if (airPose) {
    // Tucked, both legs forward.
    dinoLeg(ctx, X, Y, unit, 34, 40, 74, 44, 86);
    dinoLeg(ctx, X, Y, unit, 46, 54, 72, 58, 84);
  } else if (cycle === 0) {
    dinoLeg(ctx, X, Y, unit, 34, 30, 80, 26, 96); // back leg, extended
    dinoLeg(ctx, X, Y, unit, 46, 54, 76, 50, 96); // front leg, planted
  } else {
    dinoLeg(ctx, X, Y, unit, 34, 38, 78, 44, 96);
    dinoLeg(ctx, X, Y, unit, 46, 50, 74, 58, 88);
  }

  dinoSilhouette(ctx, X, Y);

  // The little arm, tucked under the chest.
  ctx.lineCap = 'round';
  ctx.lineWidth = unit * 5.5;
  ctx.beginPath();
  ctx.moveTo(X(58), Y(48));
  ctx.lineTo(X(66), Y(54));
  ctx.stroke();

  // Eye and nostril, punched out so they work whatever colour the body is.
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(X(72), Y(15), unit * 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(X(93), Y(18), unit * 1.1, 0, Math.PI * 2);
  ctx.fill();
  // Mouth: a thin wedge back from the snout, which is what gives it a jaw.
  ctx.beginPath();
  ctx.moveTo(X(99), Y(21.5));
  ctx.lineTo(X(80), Y(23));
  ctx.lineTo(X(80), Y(25));
  ctx.lineTo(X(99), Y(24));
  ctx.closePath();
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  ctx.restore();
}
