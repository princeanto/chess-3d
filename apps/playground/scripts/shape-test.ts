/**
 * SHAPE's generators. The promise of a seed is that it reproduces, and the
 * promise of Randomize is that it stays inside what looks good; both are easy to
 * break silently and neither shows up until someone's copied seed stops working.
 */

import { createRng } from '../lib/random';
import { contrast } from '../lib/color';
import {
  ASPECTS, PATTERNS, RANGES, colorsFrom, patternCss, patternSvg, randomPattern, type PatternKind, type PatternState,
} from '../lib/pattern';

let passed = 0;
let failed = 0;
function ok(label: string, condition: boolean, detail = ''): void {
  if (condition) { passed += 1; console.log(`  ok   ${label}${detail ? `  ${detail}` : ''}`); }
  else { failed += 1; console.log(`  FAIL ${label}${detail ? `  ${detail}` : ''}`); }
}

const PALETTE = ['#1D1B22', '#E4572E', '#F2C14E', '#7FB5A4', '#F4F0E8'];
const base = (kind: PatternKind, seed = 839204): PatternState => ({
  kind, seed, aspect: 'square', density: 50, scale: 50, spacing: 20, rotation: 0,
  background: '#1D1B22', colors: ['#E4572E', '#F2C14E', '#7FB5A4'],
});
const elements = (svg: string) => (svg.match(/<(rect|circle|path|polygon)\b/g) ?? []).length;
const fills = (svg: string) => new Set([...svg.matchAll(/(?:fill|stroke)="(#[0-9A-Fa-f]{6})"/g)].map((m) => m[1].toUpperCase()));

console.log('\nEVERY PATTERN');
for (const { id } of PATTERNS) {
  const svg = patternSvg(base(id));
  const extremes = [0, 100].flatMap((d) => [0, 100].map((s) => patternSvg({ ...base(id), density: d, scale: s, spacing: d })));
  ok(`${id}: draws something`, svg.startsWith('<svg') && elements(svg) > 1, `${elements(svg)} elements`);
  ok(`${id}: no broken numbers at any slider extreme`, [svg, ...extremes].every((s) => !/NaN|Infinity/.test(s)));
  ok(`${id}: stays light enough for a phone`, extremes.every((s) => elements(s) < 6000), `max ${Math.max(...extremes.map(elements))}`);
  const used = fills(svg);
  const allowed = new Set(['#1D1B22', '#E4572E', '#F2C14E', '#7FB5A4']);
  ok(`${id}: uses only the colours it was given`, [...used].every((c) => allowed.has(c)), [...used].join(' '));
  ok(`${id}: the same state draws the same thing`, patternSvg(base(id)) === svg);
}

console.log('\nSEEDS AND SLIDERS');
{
  const seeded: PatternKind[] = ['dots', 'waves', 'circles', 'squares', 'triangles', 'blobs', 'rings', 'noise', 'geometric', 'organic'];
  const differ = seeded.filter((kind) => patternSvg(base(kind, 111111)) !== patternSvg(base(kind, 222222)));
  ok('a different seed gives a different pattern', differ.length === seeded.length, `${differ.length}/${seeded.length}`);
  ok('rotation turns the pattern', patternSvg({ ...base('lines'), rotation: 45 }) !== patternSvg(base('lines')));
  ok('rotation happens about the centre', patternSvg({ ...base('lines'), rotation: 30 }).includes('rotate(30 600 600)'));
  ok('more density means more dots', elements(patternSvg({ ...base('dots'), density: 90 })) > elements(patternSvg({ ...base('dots'), density: 10 })));
  const sharp = patternSvg(base('grid'), 2400);
  ok('a 2× export is declared at 2× but drawn in the same coordinates', sharp.includes('width="2400"') && sharp.includes('viewBox="0 0 1200 1200"'));
  const tall = patternSvg({ ...base('grid'), aspect: 'portrait' }, 1800);
  ok('pixel size keeps the aspect ratio', tall.includes(`height="${Math.round((1800 / ASPECTS.portrait.w) * ASPECTS.portrait.h)}"`));
  ok('a pattern with no colours still draws, in a readable one', elements(patternSvg({ ...base('dots'), colors: [] })) > 1);
}

console.log('\nCOLOURS');
{
  let backgroundFromPalette = 0;
  let visible = 0;
  let nonEmpty = 0;
  for (let s = 1; s <= 80; s += 1) {
    const { background, colors } = colorsFrom(PALETTE, createRng(s));
    if (PALETTE.includes(background)) backgroundFromPalette += 1;
    if (colors.every((c) => c !== background && contrast(c, background) >= 1.35)) visible += 1;
    if (colors.length > 0) nonEmpty += 1;
  }
  ok('the background comes from your palette', backgroundFromPalette === 80);
  ok('no shape colour disappears into its background', visible === 80);
  ok('there is always something to draw with', nonEmpty === 80);
  const flat = colorsFrom(['#777777', '#787878'], createRng(3));
  ok('a palette with nothing visible falls back to ink or paper', flat.colors.length === 1 && contrast(flat.colors[0], flat.background) > 3);
}

console.log('\nRANDOMIZE');
{
  let within = 0;
  for (let s = 1; s <= 100; s += 1) {
    const p = randomPattern(createRng(s), PALETTE, 'landscape');
    const r = RANGES[p.kind];
    if (p.density >= r.density[0] && p.density <= r.density[1] && p.scale >= r.scale[0] && p.scale <= r.scale[1]
      && p.spacing >= r.spacing[0] && p.spacing <= r.spacing[1] && r.rotations.includes(p.rotation)) within += 1;
  }
  ok('Randomize stays where each pattern looks good', within === 100, `${within}/100`);
  ok('Randomize reproduces from its own seed', JSON.stringify(randomPattern(createRng(9), PALETTE, 'square')) === JSON.stringify(randomPattern(createRng(9), PALETTE, 'square')));
  const kinds = new Set(Array.from({ length: 200 }, (_, s) => randomPattern(createRng(s), PALETTE, 'square').kind));
  ok('Randomize visits every kind of pattern', kinds.size === PATTERNS.length, `${kinds.size}/${PATTERNS.length}`);
  ok('a chosen kind is respected', randomPattern(createRng(4), PALETTE, 'square', 'rings').kind === 'rings');
}

console.log('\nEXPORT');
{
  const css = patternCss(base('dots'));
  ok('CSS carries the pattern inside it', css.includes('background-image: url("data:image/svg+xml,%3Csvg'));
  ok('CSS sets the background colour too', css.includes('background-color: #1D1B22;'));
}

console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'}  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
