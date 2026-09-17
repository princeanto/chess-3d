/**
 * TYPE's engine: case, lines, layout, presets and the contrast promise.
 */

import { createRng } from '../lib/random';
import { contrast } from '../lib/color';
import { ASPECTS } from '../lib/pattern';
import { FONTS, fontById, nearestWeight } from '../lib/fonts';
import {
  CAP, DARK, DEFAULT_TYPE, LIGHT, PRESETS, applyCase, applyPreset, backgroundOf, colourPair, layout, padding,
  randomType, toLines, typeCss, typeSvg, type TypeState,
} from '../lib/typeset';

let passed = 0;
let failed = 0;
function ok(label: string, condition: boolean, detail = ''): void {
  if (condition) { passed += 1; console.log(`  ok   ${label}${detail ? `  ${detail}` : ''}`); }
  else { failed += 1; console.log(`  FAIL ${label}${detail ? `  ${detail}` : ''}`); }
}

const PALETTE = ['#1D1B22', '#E4572E', '#F2C14E', '#7FB5A4', '#F4F0E8'];

console.log('\nTEXT');
ok('Title Case capitalises each word', applyCase('make something-new today', 'title') === 'Make Something-New Today', applyCase('make something-new today', 'title'));
ok('UPPERCASE and lowercase', applyCase('Make', 'upper') === 'MAKE' && applyCase('Make', 'lower') === 'make');
ok('lines are kept as typed', toLines('MAKE\nSOMETHING', 'typed').join('|') === 'MAKE|SOMETHING');
ok('one word per line splits on any space', toLines('make  some\nthing', 'words').join('|') === 'make|some|thing');
ok('blank lines at the ends are dropped, ones between are kept', toLines('\n\nA\n\nB\n\n', 'typed').join('|') === 'A||B');
ok('empty text still sets a line', toLines('   ', 'typed').length === 1);

console.log('\nLAYOUT');
{
  const s: TypeState = { ...DEFAULT_TYPE, aspect: 'poster', leading: 1 };
  const { w, h } = ASPECTS.poster;
  const pad = padding('poster');
  const top = layout({ ...s, valign: 'top' }, 100);
  ok('top: the first line’s cap sits on the padding', Math.abs(top.baselines[0] - (pad + 100 * CAP)) < 1e-6);
  const bottom = layout({ ...s, valign: 'bottom' }, 100);
  ok('bottom: the last line sits on the padding', Math.abs(bottom.baselines[bottom.baselines.length - 1] - (h - pad)) < 1e-6);
  const middle = layout({ ...s, valign: 'middle' }, 100);
  const blockTop = middle.baselines[0] - 100 * CAP;
  const blockBottom = middle.baselines[middle.baselines.length - 1];
  ok('middle: the block is centred', Math.abs(blockTop - (h - blockBottom)) < 1e-6);
  const right = layout({ ...s, align: 'right', tracking: 0 }, 100);
  ok('right alignment anchors at the right padding', right.anchor === 'end' && Math.abs(right.x - (w - pad)) < 1e-6);
  const tracked = layout({ ...s, align: 'right', tracking: 0.1 }, 100);
  ok('trailing letter spacing is compensated on the right', Math.abs(tracked.x - (w - pad + 10)) < 1e-6);
  ok('left alignment needs no compensation', layout({ ...s, align: 'left', tracking: 0.2 }, 100).x === pad);
}

console.log('\nSVG');
{
  const svg = typeSvg({ ...DEFAULT_TYPE, text: 'Fish & <chips>', textCase: 'normal' }, 120);
  ok('text is escaped', svg.includes('Fish &amp; &lt;chips&gt;'));
  ok('Archivo carries its width', typeSvg({ ...DEFAULT_TYPE, font: 'archivo', width: 72 }, 100).includes('style="font-stretch:72%"'));
  ok('other fonts do not', !typeSvg({ ...DEFAULT_TYPE, font: 'inter' }, 100).includes('font-stretch'));
  ok('italic only where the font has one', typeSvg({ ...DEFAULT_TYPE, font: 'instrument', italic: true }, 100).includes('font-style="italic"')
    && !typeSvg({ ...DEFAULT_TYPE, font: 'inter', italic: true }, 100).includes('font-style'));
  ok('a transparent background draws no rectangle', !typeSvg({ ...DEFAULT_TYPE, background: 'transparent' }, 100).includes('<rect'));
  ok('an embedded font goes inside the file', typeSvg(DEFAULT_TYPE, 100, { fontCss: '@font-face{}' }).includes('<defs><style>@font-face{}</style></defs>'));
  ok('a missing weight snaps to a real one', typeSvg({ ...DEFAULT_TYPE, font: 'plex', weight: 900 }, 100).includes('font-weight="600"'));
  ok('backgrounds resolve to real colours', backgroundOf({ ...DEFAULT_TYPE, background: 'light' }) === LIGHT && backgroundOf({ ...DEFAULT_TYPE, background: 'dark' }) === DARK);
}

console.log('\nFONTS');
ok('every font lists at least one real weight and file', FONTS.every((font) => font.weights.length > 0 && font.files.length > 0));
ok('nearest weight picks the closest available', nearestWeight(fontById('plex'), 500) === 400 || nearestWeight(fontById('plex'), 500) === 600);
ok('Instrument Serif only claims the weight it has', fontById('instrument').weights.join() === '400');

console.log('\nPRESETS AND RANDOMIZE');
{
  let readable = 0;
  let valid = 0;
  let total = 0;
  for (const { id } of PRESETS) {
    for (let s = 1; s <= 30; s += 1) {
      total += 1;
      const next = applyPreset(DEFAULT_TYPE, id, PALETTE, createRng(s));
      const font = fontById(next.font);
      const ground = backgroundOf(next);
      if (!ground || contrast(next.color, ground) >= 4.5) readable += 1;
      if (font.weights.includes(nearestWeight(font, next.weight)) && next.leading > 0.5 && next.leading < 2) valid += 1;
    }
  }
  ok('every preset is readable, every time', readable === total, `${readable}/${total}`);
  ok('every preset uses a weight its font really has', valid === total);
  let randomReadable = 0;
  for (let s = 1; s <= 200; s += 1) {
    const r = randomType(createRng(s), PALETTE, DEFAULT_TYPE);
    const ground = backgroundOf(r);
    if (!ground || contrast(r.color, ground) >= 4.5) randomReadable += 1;
  }
  ok('Randomize never produces unreadable type', randomReadable === 200, `${randomReadable}/200`);
  ok('Randomize reproduces from its seed', JSON.stringify(randomType(createRng(7), PALETTE, DEFAULT_TYPE)) === JSON.stringify(randomType(createRng(7), PALETTE, DEFAULT_TYPE)));
  ok('Randomize keeps your words', randomType(createRng(3), PALETTE, { ...DEFAULT_TYPE, text: 'hello there' }).text === 'hello there');
  const grey = colourPair(['#777777', '#7A7A7A'], createRng(1), 'color');
  ok('a palette with no readable pair falls back to ink or paper', contrast(grey.color, backgroundOf({ ...DEFAULT_TYPE, ...grey })!) >= 4.5);
}

console.log('\nCSS');
{
  const css = typeCss({ ...DEFAULT_TYPE, font: 'archivo', width: 70, textCase: 'upper' }, 142.4);
  ok('CSS includes the width axis and transform', css.includes('font-stretch: 70%;') && css.includes('text-transform: uppercase;') && css.includes('font-size: 142px;'));
}

console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'}  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
