/**
 * The runner: simulation only. Nothing here touches the DOM or a canvas, so the
 * whole game can be stepped and asserted from a test without a browser.
 *
 * Everything runs on a fixed timestep. A variable-dt integrator makes jump
 * height depend on frame rate, which means the same input clears an obstacle on
 * a 60Hz laptop and clips it on a 144Hz monitor. The renderer interpolates
 * between the last two states so motion still looks smooth at any refresh rate.
 */

export const TICK = 1 / 120; // seconds per simulation step

/** World units. The renderer scales this to whatever the canvas actually is. */
export const WORLD = { width: 1200, height: 340, groundY: 268 };

export type Phase = 'ready' | 'running' | 'dead';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type ObstacleKind = 'cactus-small' | 'cactus-tall' | 'cactus-cluster' | 'bird';

export interface Obstacle extends Box {
  kind: ObstacleKind;
  /** Birds flap; cacti do not. */
  phase: number;
  passed: boolean;
}

export interface Cloud {
  x: number;
  y: number;
  scale: number;
  speed: number;
}

export interface Dune {
  x: number;
  seed: number;
}

export interface Runner {
  y: number;
  vy: number;
  ducking: boolean;
  onGround: boolean;
  /** Seconds since leaving the ground, for coyote time. */
  airborne: number;
  /** Squash/stretch, 1 = neutral. Purely cosmetic, driven by vertical speed. */
  squash: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

export interface State {
  phase: Phase;
  time: number;
  distance: number;
  speed: number;
  score: number;
  best: number;
  runner: Runner;
  obstacles: Obstacle[];
  clouds: Cloud[];
  dunes: Dune[];
  particles: Particle[];
  /** 0 = full day, 1 = full night. Eased, not stepped. */
  night: number;
  nightTarget: number;
  spawnIn: number;
  /** Frames of screen shake left, for the death hit. */
  shake: number;
  /** Set on the tick a milestone is crossed so the shell can react. */
  justMilestone: boolean;
  justJumped: boolean;
  justDied: boolean;
  justScored: boolean;
}

const GRAVITY = 2600;
const JUMP_VELOCITY = -840;
/** Cutting the jump short scales remaining upward velocity by this. */
const JUMP_CUT = 0.42;
const FAST_FALL = 2.1;
const COYOTE = 0.09;
const RUNNER_X = 150;
const RUNNER_W = 46;
const RUNNER_H = 52;
const DUCK_H = 30;

const START_SPEED = 460;
const MAX_SPEED = 1180;
const ACCELERATION = 13; // world units per second, per second

export function createState(best = 0): State {
  return {
    phase: 'ready',
    time: 0,
    distance: 0,
    speed: START_SPEED,
    score: 0,
    best,
    runner: {
      y: WORLD.groundY,
      vy: 0,
      ducking: false,
      onGround: true,
      airborne: 0,
      squash: 1,
    },
    obstacles: [],
    clouds: seedClouds(),
    dunes: seedDunes(),
    particles: [],
    night: 0,
    nightTarget: 0,
    spawnIn: 1.4,
    shake: 0,
    justMilestone: false,
    justJumped: false,
    justDied: false,
    justScored: false,
  };
}

function seedClouds(): Cloud[] {
  return Array.from({ length: 5 }, (_, i) => ({
    x: (i / 5) * WORLD.width * 1.4,
    y: 40 + ((i * 37) % 90),
    scale: 0.6 + ((i * 13) % 10) / 14,
    speed: 0.14 + ((i * 7) % 10) / 90,
  }));
}

function seedDunes(): Dune[] {
  return Array.from({ length: 7 }, (_, i) => ({
    x: (i / 7) * WORLD.width * 1.5,
    seed: i * 91 + 17,
  }));
}

/** Deterministic PRNG so a given seed replays identically. */
export function makeRandom(seed = Date.now() >>> 0) {
  let a = seed >>> 0 || 1;
  return () => {
    a ^= a << 13;
    a ^= a >>> 17;
    a ^= a << 5;
    return ((a >>> 0) % 100000) / 100000;
  };
}

export interface Input {
  /** Held this tick. */
  jump: boolean;
  duck: boolean;
  /** Rising edge — set by the shell, cleared by the engine once consumed. */
  jumpPressed: boolean;
}

export function runnerBox(runner: Runner): Box {
  const h = runner.ducking && runner.onGround ? DUCK_H : RUNNER_H;
  return { x: RUNNER_X, y: runner.y - h, w: runner.ducking ? RUNNER_W + 12 : RUNNER_W, h };
}

/** Hitboxes are inset so a near-miss reads as a miss, which is what players expect. */
function hits(a: Box, b: Box): boolean {
  const pad = 6;
  return (
    a.x + pad < b.x + b.w &&
    a.x + a.w - pad > b.x &&
    a.y + pad < b.y + b.h &&
    a.y + a.h - pad > b.y
  );
}

export function step(state: State, input: Input, rand: () => number): State {
  const s = state;
  s.justJumped = false;
  s.justDied = false;
  s.justMilestone = false;
  s.justScored = false;

  if (s.phase !== 'running') {
    // Clouds keep drifting on the title and death screens so the world never
    // looks frozen.
    driftBackground(s, TICK, START_SPEED * 0.35);
    s.time += TICK;
    return s;
  }

  s.time += TICK;
  s.speed = Math.min(MAX_SPEED, s.speed + ACCELERATION * TICK);
  s.distance += s.speed * TICK;

  const previousScore = s.score;
  s.score = Math.floor(s.distance / 18);
  if (s.score !== previousScore) s.justScored = true;
  if (previousScore > 0 && s.score % 100 === 0 && s.score !== previousScore) {
    s.justMilestone = true;
    // Flip day/night every 100 points; the render eases toward the target.
    s.nightTarget = s.nightTarget > 0.5 ? 0 : 1;
  }
  s.night += (s.nightTarget - s.night) * Math.min(1, TICK * 1.1);

  /* ------------------------------ runner ------------------------------ */
  const r = s.runner;
  r.ducking = input.duck;

  if (r.onGround) r.airborne = 0;
  else r.airborne += TICK;

  const canJump = r.onGround || r.airborne < COYOTE;
  if (input.jumpPressed && canJump) {
    r.vy = JUMP_VELOCITY;
    r.onGround = false;
    r.squash = 1.28;
    s.justJumped = true;
  }

  // Releasing jump early trims the arc. Without this the jump is one fixed
  // height and threading a low bird under a tall cactus is impossible.
  if (!input.jump && r.vy < 0) r.vy *= Math.pow(JUMP_CUT, TICK * 60);

  const gravityScale = input.duck && !r.onGround ? FAST_FALL : 1;
  r.vy += GRAVITY * gravityScale * TICK;
  r.y += r.vy * TICK;

  if (r.y >= WORLD.groundY) {
    if (!r.onGround) {
      // Landing: dust and a squash proportional to impact.
      const impact = Math.min(1, r.vy / 900);
      r.squash = 1 - impact * 0.3;
      spawnDust(s, rand, 6 + Math.round(impact * 8));
    }
    r.y = WORLD.groundY;
    r.vy = 0;
    r.onGround = true;
  }

  r.squash += (1 - r.squash) * Math.min(1, TICK * 12);

  // A running puff every so often, so the ground reads as moving.
  if (r.onGround && Math.floor(s.time * 14) % 3 === 0 && rand() > 0.72) {
    spawnDust(s, rand, 1);
  }

  /* ----------------------------- obstacles ---------------------------- */
  s.spawnIn -= TICK;
  if (s.spawnIn <= 0) {
    spawnObstacle(s, rand);
    // Gap shrinks with speed but never below what a jump can clear.
    const base = 1.55 - (s.speed / MAX_SPEED) * 0.72;
    s.spawnIn = base + rand() * 0.55;
  }

  for (const o of s.obstacles) {
    o.x -= s.speed * TICK;
    o.phase += TICK;
  }
  s.obstacles = s.obstacles.filter((o) => o.x + o.w > -60);

  const box = runnerBox(r);
  for (const o of s.obstacles) {
    if (hits(box, o)) {
      s.phase = 'dead';
      s.shake = 0.32;
      s.justDied = true;
      if (s.score > s.best) s.best = s.score;
      spawnDust(s, rand, 18);
      break;
    }
  }

  /* ---------------------------- decoration ---------------------------- */
  driftBackground(s, TICK, s.speed);
  updateParticles(s, TICK);
  if (s.shake > 0) s.shake = Math.max(0, s.shake - TICK);

  return s;
}

function driftBackground(s: State, dt: number, speed: number) {
  for (const c of s.clouds) {
    c.x -= speed * c.speed * dt;
    if (c.x < -160) {
      c.x = WORLD.width + 60;
      c.y = 30 + ((c.y * 7) % 100);
    }
  }
  for (const d of s.dunes) {
    d.x -= speed * 0.22 * dt;
    if (d.x < -400) d.x += WORLD.width * 1.5 + 400;
  }
}

function spawnObstacle(s: State, rand: () => number) {
  const roll = rand();
  // Birds only appear once there is enough speed for them to be a real choice
  // between ducking and jumping.
  const fast = s.speed > START_SPEED * 1.5;
  let kind: ObstacleKind;
  if (fast && roll > 0.76) kind = 'bird';
  else if (roll > 0.58) kind = 'cactus-tall';
  else if (roll > 0.3) kind = 'cactus-cluster';
  else kind = 'cactus-small';

  const x = WORLD.width + 40;
  if (kind === 'bird') {
    // Three lanes: duck under, jump over, or run beneath at full height.
    const lane = rand();
    const y = lane > 0.62 ? WORLD.groundY - 92 : lane > 0.3 ? WORLD.groundY - 58 : WORLD.groundY - 24;
    s.obstacles.push({ kind, x, y: y - 26, w: 46, h: 30, phase: 0, passed: false });
    return;
  }

  const size =
    kind === 'cactus-small'
      ? { w: 24, h: 44 }
      : kind === 'cactus-tall'
        ? { w: 28, h: 66 }
        : { w: 58, h: 50 };

  s.obstacles.push({
    kind,
    x,
    y: WORLD.groundY - size.h,
    w: size.w,
    h: size.h,
    phase: 0,
    passed: false,
  });
}

function spawnDust(s: State, rand: () => number, count: number) {
  for (let i = 0; i < count; i += 1) {
    const life = 0.28 + rand() * 0.4;
    s.particles.push({
      x: RUNNER_X + 6 + rand() * 20,
      y: WORLD.groundY - rand() * 6,
      vx: -60 - rand() * 140,
      vy: -30 - rand() * 90,
      life,
      maxLife: life,
      size: 2 + rand() * 3.5,
    });
  }
  // Hard cap: a long run would otherwise accumulate thousands.
  if (s.particles.length > 160) s.particles.splice(0, s.particles.length - 160);
}

function updateParticles(s: State, dt: number) {
  for (const p of s.particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 420 * dt;
    p.vx *= 1 - dt * 1.6;
  }
  s.particles = s.particles.filter((p) => p.life > 0);
}

export const constants = {
  RUNNER_X,
  RUNNER_W,
  RUNNER_H,
  DUCK_H,
  START_SPEED,
  MAX_SPEED,
};
