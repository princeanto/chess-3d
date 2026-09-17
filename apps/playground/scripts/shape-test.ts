/**
 * SHAPE's generators. The promise of a seed is that it reproduces, and the
 * promise of Randomize is that it stays inside what looks good; both are easy to
 * break silently and neither shows up until someone's copied seed stops working.
 */

import { createRng } from '../lib/random';
import { contrast } from '../lib/color';
import {
  ASPECTS, PATTERNS, RANGES, colorsFrom, patternCss, patternLabel, patternSvg, randomPattern, type PatternKind, type PatternState,
} from '../lib/pattern';
import { designFor } from '../lib/generative';
import { REPEATS, starterTile, wrapStrokes } from '../lib/tile';

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

console.log('\nGENERATE');
{
  const designs = new Set<string>();
  const svgs = new Set<string>();
  let clean = 0;
  let light = 0;
  let paletteOnly = 0;
  let heaviest = 0;
  const allowed = new Set(['#1D1B22', '#E4572E', '#F2C14E', '#7FB5A4']);
  for (let seed = 1; seed <= 300; seed += 1) {
    designs.add(JSON.stringify(designFor(seed)));
    const state: PatternState = { ...base('generated' as PatternKind, seed), density: 50 };
    const svg = patternSvg(state);
    svgs.add(svg);
    const dense = patternSvg({ ...state, density: 100, scale: 100 });
    if (!/NaN|Infinity|undefined/.test(svg + dense)) clean += 1;
    const count = elements(dense);
    heaviest = Math.max(heaviest, count);
    if (count < 7000) light += 1;
    if ([...fills(svg)].every((c) => allowed.has(c))) paletteOnly += 1;
  }
  ok('300 seeds make 300 different designs', designs.size === 300, `${designs.size}`);
  ok('…and 300 different pictures', svgs.size === 300);
  ok('no broken numbers, even at full density', clean === 300);
  ok('stays light enough for a phone at full density', light === 300, `heaviest ${heaviest}`);
  ok('uses only the palette and the background', paletteOnly === 300);
  ok('the same seed generates the same pattern', patternSvg(base('generated' as PatternKind, 42)) === patternSvg(base('generated' as PatternKind, 42)));
  ok('a generated pattern says what it is made of', / on a /.test(patternLabel({ kind: 'generated', seed: 7 })), patternLabel({ kind: 'generated', seed: 7 }));
  ok('Generate is not one of the random kinds', PATTERNS.every((p) => p.id !== ('generated' as unknown)));
}

console.log('\nTILE');
{
  const tile = starterTile(['#E4572E', '#F2C14E']);
  const state: PatternState = { ...base('tile' as PatternKind), tile, density: 30, scale: 100, spacing: 0 };
  const svg = patternSvg(state);
  ok('the tile is defined once and placed by reference', (svg.match(/<g id="t839204">/g) ?? []).length === 1 && (svg.match(/<use /g) ?? []).length > 20);
  ok('it is clipped to its square', svg.includes('clip-path="url(#t839204c)"'));
  const wrapped = wrapStrokes([{ b: 'pencil', c: '#111111', s: 20, o: 1, p: [450, 0, 520, 0], y: 'n' }]);
  ok('a stroke over the right edge comes back in on the left', wrapped.length === 2 && wrapped[1].p[0] === -550);
  const corner = wrapStrokes([{ b: 'pencil', c: '#111111', s: 20, o: 1, p: [495, 495], y: 'n' }]);
  ok('a stroke in a corner wraps into all three neighbours', corner.length === 4);
  ok('a stroke in the middle does not wrap', wrapStrokes([{ b: 'pencil', c: '#111111', s: 10, o: 1, p: [0, 0, 10, 10], y: 'n' }]).length === 1);
  for (const r of REPEATS) {
    const out = patternSvg({ ...state, tile: { ...tile, repeat: r.id } });
    ok(`repeat ${r.label} draws cleanly`, !/NaN|Infinity/.test(out) && out.includes('<use '));
  }
  ok('mirror flips alternate tiles', patternSvg({ ...state, tile: { ...tile, repeat: 'mirror' } }).includes('scale(-'));
  ok('an empty tile is just the background', elements(patternSvg({ ...state, tile: { strokes: [], repeat: 'grid' } })) >= 1);
  const erased = patternSvg({ ...state, tile: { repeat: 'grid', strokes: [...tile.strokes, { b: 'eraser', c: '#111111', s: 80, o: 1, p: [0, 0, 100, 100], y: 'n' }] } });
  ok('the eraser works inside a tile', erased.includes('<mask id="t839204e'));
}

console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'}  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
