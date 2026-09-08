/**
 * Screen checks that do not need a browser.
 *
 * The drawing itself has to be looked at, but three things underneath it are
 * pure and worth asserting: the sprites are rectangular, the world-to-screen
 * mapping keeps the runner's feet on the ground line through a whole jump, and
 * the ink clears contrast on the paper.
 */

import { WORLD, constants } from '../lib/game/engine';
import {
  GROUND_Y,
  INK,
  PAPER,
  SCALE,
  SCREEN_H,
  SCREEN_W,
  STRIP_TOP,
  VIEW_WIDTH,
  worldToScreenY,
} from '../lib/game/screen';
import * as sprites from '../lib/game/sprites';
import { spriteSize, type Sprite } from '../lib/game/sprites';

let failures = 0;
const check = (ok: boolean, label: string, detail = '') => {
  if (!ok) failures += 1;
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${detail ? `  ${detail}` : ''}`);
};

/* ------------------------------- sprites -------------------------------- */

console.log('SPRITES');
const named = Object.entries(sprites).filter(
  (entry): entry is [string, Sprite] =>
    Array.isArray(entry[1]) && typeof entry[1][0] === 'string',
);

let ragged = 0;
let empty = 0;
for (const [name, sprite] of named) {
  const widths = new Set(sprite.map((r) => r.length));
  if (widths.size !== 1) {
    ragged += 1;
    check(false, `${name} has rows of differing length`, [...widths].join(','));
  }
  if (!sprite.some((r) => r.includes('#'))) {
    empty += 1;
    check(false, `${name} has no ink in it`);
  }
}
check(ragged === 0, `all ${named.length} sprites are rectangular`);
check(empty === 0, 'every sprite has ink in it');

// Glyphs share one cell size, or text spacing drifts across a string.
const glyphSizes = new Set(
  Object.values(sprites.GLYPHS).map((g) => `${g[0].length}x${g.length}`),
);
check(glyphSizes.size === 1, 'every glyph is the same cell size', [...glyphSizes].join(' '));

/* ---------------------------- runner geometry ---------------------------- */

console.log('\nGEOMETRY');
const runner = spriteSize(sprites.DINO_RUN_A);
check(
  runner.h === constants.RUNNER_H,
  'the runner sprite is the height the physics uses',
  `sprite ${runner.h}, hitbox ${constants.RUNNER_H}`,
);

const duck = spriteSize(sprites.DINO_DUCK_A);
check(
  duck.h === constants.DUCK_H,
  'the ducking sprite matches the ducking hitbox',
  `sprite ${duck.h}, hitbox ${constants.DUCK_H}`,
);

// Feet stay on the ground line, and the apex stays inside the strip.
check(
  worldToScreenY(WORLD.groundY) === GROUND_Y,
  'a runner standing on the ground lands exactly on the ground line',
);

const apex = constants.JUMP_VELOCITY ** 2 / (2 * constants.GRAVITY);
const headroom = GROUND_Y - STRIP_TOP;
check(
  headroom >= apex + runner.h,
  'the strip is tall enough for a full jump',
  `needs ${Math.ceil(apex + runner.h)}, has ${headroom}`,
);

const apexTop = worldToScreenY(WORLD.groundY - apex) - runner.h;
check(apexTop >= STRIP_TOP, 'the runner is never clipped at the top of its jump',
  `top of sprite at ${Math.round(apexTop)}, strip starts at ${STRIP_TOP}`);

check(SCALE === 1, 'one world unit is one screen pixel, so sprites land on pixel edges');
check(VIEW_WIDTH === SCREEN_W, 'the engine is told the strip width, so obstacles enter off-screen',
  `${VIEW_WIDTH}`);
check(SCREEN_W / SCREEN_H > 1.3 && SCREEN_W / SCREEN_H < 1.35, 'the screen is 4:3',
  (SCREEN_W / SCREEN_H).toFixed(3));

/* --------------------------- sprite vs hitbox --------------------------- */

/*
 * Every obstacle sprite must be exactly the size of the box the physics uses.
 * They were not, and both of the bugs that produced were invisible in the code:
 * a sprite shorter than its box floats above the ground line, and one narrower
 * than its box kills the runner from a gap you can see daylight through.
 */
console.log('\nSPRITES MATCH HITBOXES');
const HITBOX: Array<[string, Sprite, number, number]> = [
  ['cactus-small', sprites.CACTUS_SMALL, 24, 44],
  ['cactus-tall', sprites.CACTUS_TALL, 28, 66],
  ['cactus-cluster', sprites.CACTUS_CLUSTER, 58, 50],
  ['bird', sprites.BIRD_A, 46, 30],
  ['bird (flap)', sprites.BIRD_B, 46, 30],
  ['runner', sprites.DINO_RUN_A, 46, 52],
  ['runner (stride)', sprites.DINO_RUN_B, 46, 52],
  ['ducking', sprites.DINO_DUCK_A, 58, 30],
  ['ducking (stride)', sprites.DINO_DUCK_B, 58, 30],
];
for (const [name, sprite, w, h] of HITBOX) {
  const size = spriteSize(sprite);
  check(
    size.w === w && size.h === h,
    `${name} sprite is exactly its hitbox`,
    `${size.w}x${size.h} vs ${w}x${h}`,
  );
}

/* ------------------------------- contrast ------------------------------- */

console.log('\nLEGIBILITY');
const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
const lum = (hex: string) => {
  const f = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * f(channel(hex, 0)) + 0.7152 * f(channel(hex, 1)) + 0.0722 * f(channel(hex, 2));
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const inkOnPaper = ratio(INK, PAPER);
check(inkOnPaper >= 4.5, 'ink on paper clears 4.5:1', `${inkOnPaper.toFixed(2)}:1`);

console.log(`\n${failures === 0 ? 'PASS' : `FAIL (${failures})`}`);
process.exit(failures === 0 ? 0 : 1);
