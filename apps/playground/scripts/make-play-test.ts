/**
 * MAKE's layout and Surprise me, and DARE's briefs.
 */

import { createRng } from '../lib/random';
import { contrast } from '../lib/color';
import {
  FORMATS, TEMPLATES, approxMeasure, applyTemplate, layoutPoster, posterSvg, surprise, templatePoster, wrap,
  type FormatId, type Poster,
} from '../lib/poster';
import { CATEGORIES, DECK, formatClock, generateChallenge, nextChallenge, toolFor } from '../lib/challenges';

let passed = 0;
let failed = 0;
function ok(label: string, condition: boolean, detail = ''): void {
  if (condition) { passed += 1; console.log(`  ok   ${label}${detail ? `  ${detail}` : ''}`); }
  else { failed += 1; console.log(`  FAIL ${label}${detail ? `  ${detail}` : ''}`); }
}
const PALETTE = ['#1D1B22', '#E4572E', '#F2C14E', '#7FB5A4', '#F4F0E8'];
const inside = (p: Poster) => {
  const { w, h } = FORMATS[p.format];
  return layoutPoster(p, approxMeasure).every((pl) => !pl.lines.length || (pl.box.x >= -1 && pl.box.x + pl.box.w <= w + 1 && pl.box.y >= -1 && pl.box.y + pl.box.h <= h + 1));
};

console.log('\nMAKE');
{
  ok('wrap breaks at the width and keeps line breaks', wrap('one two three\nfour', 70, (t) => t.length * 10).join('|') === 'one two|three|four');
  ok('wrap never splits a word', wrap('extraordinarily', 20, (t) => t.length * 10).join('|') === 'extraordinarily');

  let fits = 0;
  let total = 0;
  for (const t of TEMPLATES) {
    for (const format of Object.keys(FORMATS) as FormatId[]) {
      total += 1;
      if (inside(templatePoster(t.id, format, PALETTE, createRng(3)))) fits += 1;
    }
  }
  ok('every template fits inside every format', fits === total, `${fits}/${total}`);

  const long = templatePoster('announcement', 'landscape', PALETTE, createRng(1));
  long.blocks[0].text = 'Supercalifragilisticexpialidocious';
  ok('a long headline shrinks to fit rather than overflowing', inside(long));
  const tall = templatePoster('minimal', 'landscape', PALETTE, createRng(1));
  tall.blocks[0].text = 'one two three four five six seven eight nine ten';
  ok('a headline too tall for the canvas shrinks too', inside(tall));

  const p = templatePoster('event', 'story', PALETTE, createRng(2));
  const placed = layoutPoster(p, approxMeasure);
  const { h } = FORMATS.story;
  ok('split puts the title at the top and the rest at the bottom', placed[0].box.y < h * 0.2 && placed[2].box.y + placed[2].box.h > h * 0.8);
  const nudged = { ...p, blocks: p.blocks.map((b, i) => (i === 0 ? { ...b, dx: 0.1 } : b)) };
  ok('dragging is an offset on top of the layout', Math.abs(layoutPoster(nudged, approxMeasure)[0].x - placed[0].x - 0.1 * FORMATS.story.w) < 1e-6);
  const right = layoutPoster({ ...p, align: 'right' }, approxMeasure);
  ok('right alignment anchors text at the end', right.every((pl) => pl.anchor === 'end'));

  const svg = posterSvg(p, placed);
  ok('the poster draws: background, shape, every line', svg.includes(`fill="${p.background}"`) && svg.includes('<path') && (svg.match(/<text /g) ?? []).length >= 3);
  ok('no broken numbers', !/NaN|Infinity|undefined/.test(svg));
  const escaped = posterSvg({ ...p, blocks: [{ ...p.blocks[0], text: 'Fish & <chips>' }] }, layoutPoster({ ...p, blocks: [{ ...p.blocks[0], text: 'Fish & <chips>' }] }, approxMeasure));
  ok('text is escaped', escaped.includes('Fish &amp;') && escaped.includes('&lt;chips&gt;') && !escaped.includes('<chips>'));

  const mine = { ...p, blocks: p.blocks.map((b) => ({ ...b, text: `${b.label} by me` })) };
  const switched = applyTemplate(mine, 'announcement', PALETTE, createRng(4));
  ok('switching template keeps your words, role for role', switched.blocks[0].text === 'Title by me' && switched.template === 'announcement');

  let readable = 0;
  let wordsKept = 0;
  let within = 0;
  let varied = new Set<string>();
  for (let s = 1; s <= 150; s += 1) {
    const base = templatePoster(TEMPLATES[s % TEMPLATES.length].id, (Object.keys(FORMATS) as FormatId[])[s % 6], PALETTE, createRng(s));
    const next = surprise(base, PALETTE, createRng(s * 7));
    if (contrast(next.ink, next.background) >= 4.5) readable += 1;
    if (next.blocks.every((b, i) => b.text === base.blocks[i].text)) wordsKept += 1;
    if (inside(next)) within += 1;
    varied.add(`${next.layout}|${next.align}|${next.blocks[0].font}|${next.background}`);
  }
  ok('Surprise me always keeps text readable against the background', readable === 150, `${readable}/150`);
  ok('Surprise me never changes your words', wordsKept === 150);
  ok('Surprise me keeps text on the canvas', within === 150, `${within}/150`);
  ok('Surprise me actually varies', varied.size > 60, `${varied.size} distinct`);
  const again = surprise(templatePoster('quote', 'square', PALETTE, createRng(9)), PALETTE, createRng(11));
  ok('Surprise me reproduces from its seed (apart from ids)', JSON.stringify({ ...again, blocks: again.blocks.map(({ id, ...b }) => b), shapes: again.shapes.map(({ id, ...s }) => s) })
    === JSON.stringify((() => { const x = surprise(templatePoster('quote', 'square', PALETTE, createRng(9)), PALETTE, createRng(11)); return { ...x, blocks: x.blocks.map(({ id, ...b }) => b), shapes: x.shapes.map(({ id, ...s }) => s) }; })()));
}

console.log('\nDARE');
{
  ok('the deck is big enough to play for a while', DECK.length >= 100, `${DECK.length}`);
  ok('every brief ends properly and has a category', DECK.every((c) => /[.!?]$/.test(c.text) && c.categories.length > 0));
  ok('no brief appears twice', new Set(DECK.map((c) => c.text)).size === DECK.length);
  ok('every category has at least eight briefs', CATEGORIES.every((k) => DECK.filter((c) => c.categories.includes(k.id)).length >= 8),
    CATEGORIES.map((k) => `${k.id}:${DECK.filter((c) => c.categories.includes(k.id)).length}`).join(' '));
  let matches = 0;
  for (let s = 1; s <= 100; s += 1) {
    const ch = nextChallenge(createRng(s), ['typography'], 5, []);
    if (ch.categories.includes('typography') || !DECK.includes(ch)) matches += 1;
  }
  ok('filters are respected', matches === 100);
  const seen: string[] = [];
  const rng = createRng(5);
  let repeats = 0;
  for (let i = 0; i < 60; i += 1) {
    const ch = nextChallenge(rng, [], null, seen);
    if (seen.includes(ch.text)) repeats += 1;
    seen.unshift(ch.text);
  }
  ok('sixty in a row without a repeat', repeats === 0);
  ok('a narrow filter never runs dry', Array.from({ length: 30 }, (_, i) => nextChallenge(createRng(i), ['photography'], 30, DECK.map((c) => c.text))).every((c) => c.text.length > 10));
  const made = generateChallenge(createRng(3), ['branding'], 10);
  ok('invented briefs read like sentences', /^(Design|Draw) .+ for .+, .+\.$/.test(made.text), made.text);
  ok('briefs suggest the right tool', toolFor({ text: 'Draw a cat.', categories: ['drawing'] }) === 'draw' && toolFor({ text: 'Set a word.', categories: ['typography'] }) === 'type' && toolFor({ text: 'Brand a shop.', categories: ['branding'] }) === 'make'
    && toolFor({ text: 'Draw a building shaped like its purpose.', categories: ['drawing', 'design'] }) === 'draw');
  ok('the clock counts down in minutes and seconds', formatClock(582_000) === '09:42' && formatClock(0) === '00:00' && formatClock(59_001) === '01:00');
}

console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'}  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
