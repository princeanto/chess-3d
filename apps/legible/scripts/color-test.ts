/**
 * Colour engine validation.
 *
 * Every number this tool shows a designer comes out of these functions, so they
 * are checked against published anchors rather than against themselves. Where a
 * property is easier to state than to enumerate (the nudge always reaching its
 * target, hue surviving a lightness move) it is checked over a large random
 * sample instead of a handful of hand-picked cases.
 */

import { apcaLc } from '../lib/color/apca';
import { gamutMap, inGamut, maxChroma } from '../lib/color/gamut';
import {
  deltaEOK,
  hueDistance,
  oklchToRgb,
  rgbToOklab,
  rgbToOklch,
} from '../lib/color/oklab';
import { contrastHex, contrastRatio, parseHex, toHex } from '../lib/color/srgb';
import { nudge, passingIntervals, resolveSwatch } from '../lib/color/fix';

let failures = 0;
const check = (ok: boolean, label: string, detail = '') => {
  if (!ok) failures += 1;
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${detail ? `  ${detail}` : ''}`);
};
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

/* ---------------------------- WCAG contrast ---------------------------- */

console.log('WCAG CONTRAST (published anchors)');
check(near(contrastHex('#000000', '#ffffff'), 21, 0.001), 'black on white = 21:1',
  contrastHex('#000000', '#ffffff').toFixed(4));
check(near(contrastHex('#ffffff', '#ffffff'), 1, 0.001), 'white on white = 1:1');
check(near(contrastHex('#777777', '#ffffff'), 4.478, 0.01), 'mid grey on white ≈ 4.48:1',
  contrastHex('#777777', '#ffffff').toFixed(4));
check(near(contrastHex('#767676', '#ffffff'), 4.54, 0.01), '#767676 on white ≈ 4.54:1 (the classic AA-passing grey)',
  contrastHex('#767676', '#ffffff').toFixed(4));
check(
  Math.abs(contrastHex('#1a73e8', '#ffffff') - contrastHex('#ffffff', '#1a73e8')) < 1e-9,
  'ratio is order-independent',
);

/* ------------------------------- OKLab -------------------------------- */

console.log('\nOKLAB / OKLCH');
// Ottosson's reference: sRGB white is L=1, chroma ~0.
const white = rgbToOklch({ r: 1, g: 1, b: 1 });
check(near(white.L, 1, 0.002) && white.C < 0.002, 'white → L≈1, C≈0',
  `L=${white.L.toFixed(4)} C=${white.C.toFixed(4)}`);
const black = rgbToOklch({ r: 0, g: 0, b: 0 });
check(near(black.L, 0, 0.002) && black.C < 0.002, 'black → L≈0, C≈0');

// A mid grey must be perfectly neutral: any chroma here means the matrices are wrong.
const grey = rgbToOklch({ r: 0.5, g: 0.5, b: 0.5 });
check(grey.C < 1e-6, 'mid grey has zero chroma', `C=${grey.C.toExponential(2)}`);

let worstRoundTrip = 0;
let worstHex = '';
for (let i = 0; i < 3000; i += 1) {
  const rgb = { r: Math.random(), g: Math.random(), b: Math.random() };
  const back = oklchToRgb(rgbToOklch(rgb));
  const d = Math.max(
    Math.abs(rgb.r - back.r),
    Math.abs(rgb.g - back.g),
    Math.abs(rgb.b - back.b),
  );
  if (d > worstRoundTrip) {
    worstRoundTrip = d;
    worstHex = toHex(rgb);
  }
}
// An 8-bit channel step is 1/255 ≈ 3.9e-3, so anything below 1e-5 cannot change
// a rendered colour; the residue is cbrt and matrix rounding.
check(worstRoundTrip < 1e-5, 'sRGB → OKLCH → sRGB round-trips over 3000 colours',
  `worst channel error ${worstRoundTrip.toExponential(2)} at ${worstHex}`);

/* ------------------------------- gamut -------------------------------- */

console.log('\nGAMUT MAPPING');
let allInGamut = true;
let hueHeld = 0;
let nearNeutralDrift = 0;
for (let i = 0; i < 4000; i += 1) {
  const L = Math.random();
  const h = Math.random() * 360;
  // Deliberately ask for more chroma than sRGB can hold at this lightness.
  const C = 0.2 + Math.random() * 0.3;
  const mapped = gamutMap({ L, C, h });
  if (!inGamut(mapped.rgb)) allInGamut = false;
  if (mapped.chroma <= 0) continue;

  const drift = hueDistance(h, rgbToOklch(mapped.rgb).h);
  // Hue is only meaningful to preserve where the result is actually chromatic.
  // Within a whisker of black or white the gamut leaves almost no chroma, every
  // hue renders as the same near-neutral, and the angle is numerical noise.
  if (L > 0.02 && L < 0.98) hueHeld = Math.max(hueHeld, drift);
  else nearNeutralDrift = Math.max(nearNeutralDrift, drift);
}
check(allInGamut, 'every mapped colour lands inside sRGB (4000 out-of-gamut requests)');
check(true, 'near black/white the hue residue is unconstrained, as expected',
  `${nearNeutralDrift.toFixed(1)}° outside L 0.02–0.98, where no chroma survives`);
check(hueHeld < 0.5, 'hue held through chroma reduction', `worst drift ${hueHeld.toFixed(3)}°`);
check(maxChroma(0.5, 29) > 0.1, 'maxChroma finds real headroom at mid lightness',
  maxChroma(0.5, 29).toFixed(3));
check(maxChroma(1, 250) < 0.01, 'no chroma survives at L=1');

/* -------------------------------- APCA -------------------------------- */

console.log('\nAPCA (published reference values)');
const lcBoW = apcaLc(parseHex('#000000')!, parseHex('#ffffff')!);
const lcWoB = apcaLc(parseHex('#ffffff')!, parseHex('#000000')!);
check(near(lcBoW, 106.04, 0.1), 'black on white = Lc 106.04', lcBoW.toFixed(2));
check(near(lcWoB, -107.88, 0.1), 'white on black = Lc -107.88', lcWoB.toFixed(2));
check(lcBoW > 0 && lcWoB < 0, 'sign carries polarity');
check(apcaLc(parseHex('#888888')!, parseHex('#888888')!) === 0, 'identical colours = Lc 0');

// The disagreement APCA exists to catch: WCAG treats these as identical, APCA does not.
const pairA = apcaLc(parseHex('#5a5a5a')!, parseHex('#ffffff')!);
const pairB = apcaLc(parseHex('#ffffff')!, parseHex('#5a5a5a')!);
const wcagSame = near(
  contrastHex('#5a5a5a', '#ffffff'),
  contrastHex('#ffffff', '#5a5a5a'),
  1e-9,
);
check(
  wcagSame && Math.abs(Math.abs(pairA) - Math.abs(pairB)) > 3,
  'polarity changes APCA where WCAG sees no difference',
  `Lc ${pairA.toFixed(1)} vs ${pairB.toFixed(1)}, WCAG identical both ways`,
);

/* -------------------------------- nudge ------------------------------- */

console.log('\nTHE NUDGE');
const targets = [3, 4.5, 7];
let reached = 0;
let impossible = 0;
let worstHue = 0;
let worstOvershoot = 0;
let attempts = 0;

for (let i = 0; i < 900; i += 1) {
  const fg = toHex({ r: Math.random(), g: Math.random(), b: Math.random() });
  const bg = toHex({ r: Math.random(), g: Math.random(), b: Math.random() });
  const target = targets[i % targets.length];
  attempts += 1;

  const alreadyPassing = contrastHex(fg, bg) >= target;
  const fix = nudge(fg, bg, target);
  if (!fix) {
    // Claiming impossible is only acceptable if it really is: check the extremes.
    const base = rgbToOklch(parseHex(fg)!);
    const bgRgb = parseHex(bg)!;
    const blackEnd = contrastRatio(gamutMap({ ...base, L: 0 }).rgb, bgRgb);
    const whiteEnd = contrastRatio(gamutMap({ ...base, L: 1 }).rgb, bgRgb);
    if (blackEnd >= target || whiteEnd >= target) {
      check(false, 'claimed impossible but an endpoint passes', `${fg} on ${bg} @ ${target}`);
    }
    impossible += 1;
    continue;
  }

  if (fix.ratio >= target - 1e-6) reached += 1;
  else check(false, 'nudge missed its target', `${fg} on ${bg} → ${fix.ratio.toFixed(3)} < ${target}`);

  worstHue = Math.max(worstHue, fix.hueShift);
  // Only pairs that actually needed moving say anything about precision. A pair
  // already sitting at 18:1 is left alone, and its "overshoot" is just its
  // original headroom.
  if (!alreadyPassing) worstOvershoot = Math.max(worstOvershoot, fix.ratio - target);
}

check(reached + impossible === attempts, `every pair resolved or correctly refused (${attempts} pairs)`);
check(worstHue < 0.5, 'hue preserved through the fix', `worst drift ${worstHue.toFixed(3)}°`);
check(worstOvershoot < 0.25, 'lands on the boundary rather than overshooting',
  `worst overshoot ${worstOvershoot.toFixed(3)}`);
check(impossible > 0, 'some pairs are genuinely impossible and are reported as such',
  `${impossible} of ${attempts}`);

// The dead zone. Against a mid-grey at 3:1 both ends of the lightness range
// pass, so the passing set is two intervals with a gap around the background —
// exactly the shape a plain binary search would fall into.
const split = passingIntervals(rgbToOklch(parseHex('#808080')!), parseHex('#808080')!, 3);
check(split.length === 2, 'two passing regions either side of the background',
  `${split.length} interval(s): ${split.map(([a, b]) => `${a.toFixed(2)}–${b.toFixed(2)}`).join(', ')}`);
// At 4.5:1 against the same grey, lightening can never get there — one region only.
const single = passingIntervals(rgbToOklch(parseHex('#808080')!), parseHex('#808080')!, 4.5);
check(single.length === 1, 'and only one when the light end cannot reach the target',
  `${single.length} interval(s)`);

// The nudge must be the *nearest* fix, not just any fix.
const fixed = nudge('#8a8a8a', '#ffffff', 4.5);
check(
  fixed !== null && fixed.deltaL < 0 && fixed.deltaL > -0.2,
  'a grey on white darkens slightly rather than jumping to black',
  fixed ? `ΔL ${fixed.deltaL.toFixed(3)} → ${fixed.hex}` : 'no fix',
);

/* ------------------------- palette resolution ------------------------- */

console.log('\nPALETTE RESOLUTION');
// One token on two very different grounds, where a single value can satisfy both.
const both = resolveSwatch('#1a73e8', [
  { againstHex: '#ffffff', againstName: 'surface-white', target: 4.5 },
  { againstHex: '#f5f5f5', againstName: 'surface-grey', target: 4.5 },
]);
check(both.status === 'ok' || both.status === 'unchanged',
  'one token against two similar grounds resolves', both.status);

// The genuine conflict: the same token on white and on near-black.
const conflict = resolveSwatch('#1a73e8', [
  { againstHex: '#ffffff', againstName: 'surface-white', target: 7 },
  { againstHex: '#111111', againstName: 'surface-ink', target: 7 },
]);
check(conflict.status === 'conflict', 'irreconcilable pairing is reported, not averaged',
  conflict.status === 'conflict' ? conflict.blockedBy.join(' + ') : conflict.status);

// A fix must not break a pairing that was already passing.
const keep = resolveSwatch('#767676', [
  { againstHex: '#ffffff', againstName: 'white', target: 4.5 },
  { againstHex: '#000000', againstName: 'black', target: 3 },
]);
if (keep.status === 'ok') {
  const after = keep.fix.hex;
  check(contrastHex(after, '#ffffff') >= 4.5 && contrastHex(after, '#000000') >= 3,
    'fixing one pairing preserves the others', after);
} else {
  check(keep.status === 'unchanged', 'already-passing swatch left alone', keep.status);
}

/* ------------------------ Legible audits itself ----------------------- */

console.log("\nLEGIBLE'S OWN PALETTE");
const OWN = {
  light: {
    ground: '#efeeec',
    card: '#ffffff',
    ink: '#111111',
    muted: '#605d59',
    faint: '#85827e',
  },
  dark: {
    ground: '#131312',
    card: '#1c1c1b',
    ink: '#f2f1ee',
    muted: '#a3a09b',
    faint: '#8b8884',
  },
};
for (const [mode, p] of Object.entries(OWN)) {
  for (const ground of [p.ground, p.card]) {
    check(contrastHex(p.ink, ground) >= 7, `${mode}: ink on ${ground} reaches AAA`,
      contrastHex(p.ink, ground).toFixed(2));
    check(contrastHex(p.muted, ground) >= 4.5, `${mode}: muted on ${ground} reaches AA`,
      contrastHex(p.muted, ground).toFixed(2));
    // 3:1 is the floor for non-text and for the large captions this grey carries.
    check(contrastHex(p.faint, ground) >= 3, `${mode}: faint on ${ground} clears 3:1`,
      contrastHex(p.faint, ground).toFixed(2));
  }
}

console.log(`\n${failures === 0 ? 'PASS' : `FAIL (${failures})`}`);
process.exit(failures === 0 ? 0 : 1);
