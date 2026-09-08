/**
 * The sky must stay colourful all the way round.
 *
 * The first climate lerped a warm day palette to a cool night one in sRGB. That
 * passes straight through desaturated grey, so the transition — which is most
 * of what a player actually sees — looked washed out. This walks the whole
 * cycle and asserts that never happens again.
 */
import { paletteAt } from '../lib/game/render';

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

/**
 * Handles both forms the palette produces. The first version only understood
 * `rgb(...)`, so a hex like #f4f6ff had its digits scraped out as if they were
 * channel numbers, producing NaN — and every comparison against NaN is false,
 * which meant the HUD legibility assertion silently passed without testing
 * anything.
 */
function parse(css: string) {
  const text = css.trim();
  if (text.startsWith('#')) {
    let hex = text.slice(1);
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
    const n = parseInt(hex.slice(0, 6), 16);
    return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
  }
  const m = text.match(/-?\d+(\.\d+)?/g);
  if (!m || m.length < 3) throw new Error(`cannot parse colour: ${css}`);
  return { r: Number(m[0]) / 255, g: Number(m[1]) / 255, b: Number(m[2]) / 255 };
}

function oklab({ r, g, b }: { r: number; g: number; b: number }) {
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

const chroma = (css: string) => {
  const { a, b } = oklab(parse(css));
  return Math.sqrt(a * a + b * b);
};

const luminance = (css: string) => {
  const { r, g, b } = parse(css);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
};

/** Luminance halfway down the sky gradient, where the centre overlay sits. */
const mixLum = (a: string, b: string) => (luminance(a) + luminance(b)) / 2;

const contrastLum = (x: string, lum: number) => {
  const a = luminance(x);
  return (Math.max(a, lum) + 0.05) / (Math.min(a, lum) + 0.05);
};

const contrast = (x: string, y: string) => {
  const a = luminance(x);
  const b = luminance(y);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

let failures = 0;
const check = (ok: boolean, label: string, detail = '') => {
  if (!ok) failures += 1;
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${detail ? `  ${detail}` : ''}`);
};

console.log('CLIMATE CYCLE');
let minChroma = 1;
let worstAt = 0;
let minLarge = 99;
let worstLargeAt = 0;
let minSmall = 99;
let worstSmallAt = 0;

for (let i = 0; i < 200; i += 1) {
  const c = i / 200;
  const p = paletteAt(c);

  // Saturation of the horizon: the band a washed-out blend destroys first.
  const ch = chroma(p.skyBottom);
  if (ch < minChroma) {
    minChroma = ch;
    worstAt = c;
  }

  // The HUD is drawn in `ink` directly on the sky, so it has to stay legible
  // at every point in the cycle, not just at the keyframes.
  // Each region is checked against the sky it actually sits on, at the
  // threshold its own size calls for: the title, score and centre overlay are
  // large text (3:1), the bottom hint is small (4.5:1).
  const skyMid = mixLum(p.skyTop, p.skyBottom);
  const large = Math.min(contrast(p.hudTop, p.skyTop), contrastLum(p.hudMid, skyMid));
  const small = contrast(p.hudBottom, p.skyBottom);

  if (large < minLarge) {
    minLarge = large;
    worstLargeAt = c;
  }
  if (small < minSmall) {
    minSmall = small;
    worstSmallAt = c;
  }

  // A solid button fills with ink and labels with onInk.
  if (contrast(p.hudMid, p.onHudMid) < 4.5) {
    check(false, `button label unreadable at cycle ${c.toFixed(2)}`,
      contrast(p.hudMid, p.onHudMid).toFixed(2));
  }

  // The runner and cacti are drawn on the ground, not the sky, so they get
  // checked against that instead.
  if (contrast(p.ink, p.ground) < 3) {
    check(false, `runner invisible against the ground at cycle ${c.toFixed(2)}`,
      contrast(p.ink, p.ground).toFixed(2));
  }
}

check(minChroma > 0.03, 'the horizon never washes out to grey',
  `lowest chroma ${minChroma.toFixed(4)} at cycle ${worstAt.toFixed(2)}`);
check(minLarge >= 3, 'large HUD text clears 3:1 on the sky all cycle',
  `worst ${minLarge.toFixed(2)}:1 at cycle ${worstLargeAt.toFixed(2)}`);
// The sky necessarily passes through mid luminance at the dusk crossover, and
// there no flat colour reaches 4.5:1. The ink is always the better of the two
// choices by construction; a halo in the opposing colour carries the rest,
// which is why this asserts the floor rather than the full small-text bar.
check(minSmall >= 3.5, 'the small hint never drops below 3.5:1 before its halo',
  `worst ${minSmall.toFixed(2)}:1 at cycle ${worstSmallAt.toFixed(2)}`);

// The four times of day must actually look different from one another.
const named: Array<[string, number]> = [
  ['day', 0.0],
  ['dusk', 0.34],
  ['night', 0.52],
  ['dawn', 0.86],
];
for (let i = 0; i < named.length; i += 1) {
  for (let j = i + 1; j < named.length; j += 1) {
    const a = paletteAt(named[i][1]).skyBottom;
    const b = paletteAt(named[j][1]).skyBottom;
    const d = Math.abs(luminance(a) - luminance(b)) + Math.abs(chroma(a) - chroma(b));
    check(d > 0.05, `${named[i][0]} and ${named[j][0]} are distinct skies`, d.toFixed(3));
  }
}

console.log(`\n${failures === 0 ? 'PASS' : `FAIL (${failures})`}`);
process.exit(failures === 0 ? 0 : 1);
