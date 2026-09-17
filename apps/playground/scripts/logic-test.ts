/**
 * The logic under the playground: colour, seeds, gradients, recents, keys.
 *
 * Interface bugs are visible. These are not: a palette whose "harmony" drifts,
 * a seed that stops reproducing, a gradient export that quietly disagrees with
 * the CSS preview, a shortcut that fires while you are typing.
 */

import { createRng, parseSeed } from '../lib/random';
import {
  contrast, generatePalette, hexToOklch, hexToRgb, hueDistance, isHex, oklchToHex, readableOn,
  regenerateSwatch, rgbToHex, SCHEMES, type Swatch,
} from '../lib/color';
import { fromPalette, gradientSvg, linearEndpoints, radialRadius, toCss, type Gradient } from '../lib/gradient';
import { addRecent, ago, type Recent } from '../lib/storage';
import { isEditable, spaceIsTaken } from '../lib/shortcuts';
import { escapeXml, fileName } from '../lib/export';

let passed = 0;
let failed = 0;
function ok(label: string, condition: boolean, detail = ''): void {
  if (condition) { passed += 1; console.log(`  ok   ${label}${detail ? `  ${detail}` : ''}`); }
  else { failed += 1; console.log(`  FAIL ${label}${detail ? `  ${detail}` : ''}`); }
}

console.log('\nSEEDS');
{
  const a = createRng(839204);
  const b = createRng(839204);
  const seqA = Array.from({ length: 20 }, () => a.next());
  const seqB = Array.from({ length: 20 }, () => b.next());
  ok('the same seed gives the same sequence', seqA.every((v, i) => v === seqB[i]));
  ok('a different seed gives a different one', createRng(839205).next() !== seqA[0]);
  const r = createRng(1);
  const ints = Array.from({ length: 2000 }, () => r.int(1, 6));
  ok('int stays inside both bounds', ints.every((n) => n >= 1 && n <= 6) && ints.includes(1) && ints.includes(6));
  ok('a pasted seed is read', parseSeed('Seed: 839204') === 839204 && parseSeed(' 42 ') === 42);
  ok('junk is not a seed', parseSeed('abc') === null && parseSeed('') === null);
}

console.log('\nCOLOUR MATHS');
{
  ok('HEX survives a round trip', rgbToHex(hexToRgb('#E4572E')) === '#E4572E');
  ok('three-digit HEX expands', rgbToHex(hexToRgb('#abc')) === '#AABBCC');
  const samples = ['#E4572E', '#1D1B22', '#7FB5A4', '#F2C14E', '#3B82F6', '#FFFFFF', '#000000'];
  const drift = samples.map((hex) => {
    const back = hexToRgb(oklchToHex(hexToOklch(hex)));
    const orig = hexToRgb(hex);
    return Math.max(...back.map((v, i) => Math.abs(v - orig[i])));
  });
  ok('OKLCH round-trips screen colours', drift.every((d) => d <= 1 / 255 + 1e-9), drift.map((d) => (d * 255).toFixed(2)).join(' '));
  const extremes = [{ l: 0.7, c: 0.4, h: 140 }, { l: 1.2, c: 0.3, h: 30 }, { l: -1, c: 0.2, h: 250 }, { l: 0.5, c: 0.5, h: 720 }];
  ok('impossible colours still come out as real HEX', extremes.every((c) => isHex(oklchToHex(c))));
  const vivid = hexToOklch(oklchToHex({ l: 0.72, c: 0.4, h: 145 }));
  ok('gamut mapping keeps the hue', hueDistance(vivid.h, 145) < 3, `${vivid.h.toFixed(1)}°`);
  ok('black on white is 21:1', Math.abs(contrast('#000000', '#FFFFFF') - 21) < 1e-9);
  ok('text on a light swatch is dark', readableOn('#F2C14E') === '#111111');
  ok('text on a dark swatch is light', readableOn('#1D1B22') === '#FFFFFF');
}

console.log('\nPALETTES');
{
  const chromatic = (p: Swatch[]) => p.map((s) => hexToOklch(s.hex)).filter((c) => c.c > 0.035);
  for (const { id } of SCHEMES) {
    let spreadOk = 0;
    let validOk = 0;
    for (let seed = 1; seed <= 60; seed += 1) {
      const p = generatePalette(createRng(seed * 7919), id);
      if (p.length === 5 && p.every((s) => isHex(s.hex))) validOk += 1;
      const ls = p.map((s) => hexToOklch(s.hex).l);
      // Taste guard: something dark and something light, not five mid-tones.
      if (Math.max(...ls) - Math.min(...ls) >= 0.4) spreadOk += 1;
    }
    ok(`${id}: always five real colours`, validOk === 60);
    ok(`${id}: always a real range from dark to light`, spreadOk === 60, `${spreadOk}/60`);
  }

  const same = generatePalette(createRng(4242), 'triadic').map((s) => s.hex).join();
  ok('a seed reproduces its palette', generatePalette(createRng(4242), 'triadic').map((s) => s.hex).join() === same);

  let monoOk = 0;
  let analogOk = 0;
  let compOk = 0;
  for (let seed = 1; seed <= 60; seed += 1) {
    const mono = chromatic(generatePalette(createRng(seed), 'monochrome'));
    if (mono.every((a) => mono.every((b) => hueDistance(a.h, b.h) <= 26))) monoOk += 1;
    const analog = chromatic(generatePalette(createRng(seed), 'analogous'));
    if (analog.every((a) => analog.every((b) => hueDistance(a.h, b.h) <= 95))) analogOk += 1;
    const comp = chromatic(generatePalette(createRng(seed), 'complementary'));
    if (comp.some((a) => comp.some((b) => hueDistance(a.h, b.h) >= 150))) compOk += 1;
  }
  // Dark and light colours carry little chroma, so their measured hue wobbles;
  // the checks allow for that rather than demanding perfection from a sensor.
  ok('monochrome stays within one hue', monoOk >= 57, `${monoOk}/60`);
  ok('analogous stays within a neighbourhood', analogOk >= 57, `${analogOk}/60`);
  ok('complementary really has opposites', compOk >= 57, `${compOk}/60`);

  const base = generatePalette(createRng(77), 'harmony');
  const locked = base.map((s, i) => ({ ...s, locked: i === 1 || i === 3 }));
  const next = generatePalette(createRng(78), 'harmony', locked);
  ok('locked colours survive a new palette', next[1].hex === base[1].hex && next[3].hex === base[3].hex);
  ok('unlocked colours change', [0, 2, 4].some((i) => next[i].hex !== base[i].hex));

  const one = regenerateSwatch(createRng(5), 'analogous', base, 2);
  ok('changing one colour changes only that one', one.every((s, i) => (i === 2 ? s.hex !== base[2].hex : s.hex === base[i].hex)));
}

console.log('\nGRADIENTS');
{
  const g: Gradient = { kind: 'linear', angle: 135, stops: [{ id: 'a', hex: '#111111', pos: 0 }, { id: 'b', hex: '#FF6B6B', pos: 100 }] };
  ok('evenly spaced stops read like hand-written CSS', toCss(g) === 'linear-gradient(135deg, #111111, #FF6B6B)', toCss(g));
  const uneven = { ...g, stops: [{ id: 'a', hex: '#111111', pos: 10 }, { id: 'b', hex: '#FF6B6B', pos: 80 }] };
  ok('moved stops keep their positions', toCss(uneven) === 'linear-gradient(135deg, #111111 10%, #FF6B6B 80%)', toCss(uneven));
  ok('radial is a circle from the centre', toCss({ ...g, kind: 'radial' }).startsWith('radial-gradient(circle at center,'));
  const right = linearEndpoints(90, 400, 200);
  ok('90° runs left to right, like CSS', right.x1 < right.x2 && Math.abs(right.y1 - right.y2) < 1e-9);
  const down = linearEndpoints(180, 400, 200);
  ok('180° runs top to bottom, like CSS', down.y1 < down.y2 && Math.abs(down.x1 - down.x2) < 1e-9);
  const diag = linearEndpoints(45, 400, 200);
  const length = Math.hypot(diag.x2 - diag.x1, diag.y2 - diag.y1);
  const expected = Math.abs(400 * Math.sin(Math.PI / 4)) + Math.abs(200 * Math.cos(Math.PI / 4));
  ok('the line length matches the CSS spec, not corner to corner', Math.abs(length - expected) < 1e-6, `${length.toFixed(1)}`);
  ok('radial reaches the farthest corner', Math.abs(radialRadius(400, 300) - 250) < 1e-9);
  ok('the SVG carries every stop', (gradientSvg(uneven, 800, 400).match(/<stop /g) ?? []).length === 2);
  let fromOk = true;
  for (let s = 1; s <= 40; s += 1) {
    const made = fromPalette(['#111111', '#222222', '#333333', '#444444', '#555555'], createRng(s));
    if (made.stops.length < 2 || made.stops.length > 4 || made.stops.some((st) => st.pos < 0 || st.pos > 100)) fromOk = false;
  }
  ok('gradients from a palette stay within 2–4 stops', fromOk);
}

console.log('\nRECENT');
{
  const make = (n: number, colors: string[]): Recent => ({ id: `r${n}`, tool: 'color', kind: 'Palette', at: n, colors, recipe: { colors } });
  let list: Recent[] = [];
  list = addRecent(list, make(1, ['#111111']));
  list = addRecent(list, make(2, ['#222222']));
  list = addRecent(list, make(3, ['#111111']));
  ok('repeating a recipe moves it to the top instead of duplicating', list.length === 2 && list[0].id === 'r3');
  let big: Recent[] = [];
  for (let i = 0; i < 50; i += 1) big = addRecent(big, make(i, [`#${String(i).padStart(6, '0')}`]), 30);
  ok('the list stays within its limit', big.length === 30);
  const now = Date.now();
  ok('times read like a person says them', ago(now - 2 * 60_000, now) === '2 min ago' && ago(now - 26 * 3_600_000, now) === 'Yesterday');
}

console.log('\nKEYS');
{
  ok('typing in a text field is protected', isEditable({ tagName: 'INPUT', type: 'text' }) && isEditable({ tagName: 'TEXTAREA' }));
  ok('a slider does not block shortcuts', !isEditable({ tagName: 'INPUT', type: 'range' }));
  ok('a colour picker does not block shortcuts', !isEditable({ tagName: 'INPUT', type: 'color' }));
  ok('Space presses a focused button, not randomize', spaceIsTaken({ tagName: 'BUTTON' }));
  ok('Space randomizes from the page itself', !spaceIsTaken({ tagName: 'MAIN', getAttribute: () => null }));
  ok('Space respects a slider role', spaceIsTaken({ tagName: 'DIV', getAttribute: (n: string) => (n === 'role' ? 'slider' : null) }));
}

console.log('\nEXPORT');
{
  ok('file names are safe', fileName('color', 'palette', 839204, 'png') === 'playground-color-palette-839204.png');
  ok('text in SVG is escaped', escapeXml('<a & "b">') === '&lt;a &amp; &quot;b&quot;&gt;');
}

console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'}  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
