/**
 * Saved, Google Fonts and DRAW's document: the parts of this update that can
 * be wrong without looking wrong.
 */

import {
  addSaved, defaultName, fromColorFavourites, makeBackup, mergeSaved, readBackup, removeSaved, renameSaved, type Saved,
} from '../lib/saved';
import {
  coversText, decodeCatalogue, faceHasWeight, familyCssUrl, parseFaces, parseUnicodeRange, previewCssUrl, type GoogleFamily,
} from '../lib/googleFonts';
import { fontById, googleFontId, googleFontInfo, knowGoogleFont, nearestWeight } from '../lib/fonts';
import {
  EMPTY_DOC, apply, bounds, colorsUsed, constrain, docSvg, finish, segments, symmetryCode, transforms, validDoc, widthAt,
  type DrawDoc, type Stroke,
} from '../lib/draw';
import { readFileSync } from 'node:fs';

let passed = 0;
let failed = 0;
function ok(label: string, condition: boolean, detail = ''): void {
  if (condition) { passed += 1; console.log(`  ok   ${label}${detail ? `  ${detail}` : ''}`); }
  else { failed += 1; console.log(`  FAIL ${label}${detail ? `  ${detail}` : ''}`); }
}
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;

console.log('\nSAVED');
{
  const pal = { tool: 'color' as const, kind: 'Palette', colors: ['#111111', '#EEEEEE'], recipe: { colors: ['#111111', '#EEEEEE'] } };
  let r = addSaved([], pal, 1000);
  ok('first save is named for its kind', r.item.name === 'Palette 1' && !r.repeat);
  r = addSaved(r.list, { ...pal, colors: ['#222222'], recipe: { colors: ['#222222'] } }, 2000);
  ok('the next takes the next number', r.item.name === 'Palette 2' && r.list[0].id === r.item.id);
  const again = addSaved(r.list, pal, 3000);
  ok('saving the same work again moves it up instead of copying it', again.repeat && again.list.length === 2 && again.list[0].name === 'Palette 1');
  ok('numbers continue past a gap, never reuse', defaultName([{ ...again.list[0], name: 'Palette 7' }], 'Palette') === 'Palette 8');
  const drawing = { tool: 'draw' as const, kind: 'Drawing', colors: [], recipe: { strokes: 3 }, doc: 'saved:x' };
  const d1 = addSaved(again.list, drawing, 4000);
  const d2 = addSaved(d1.list, { ...drawing, doc: 'saved:y' }, 5000);
  ok('two drawings are never merged, even with the same summary', !d2.repeat && d2.list.length === 4);
  const renamed = renameSaved(d2.list, d2.item.id, '   Sunday    sketch ');
  ok('rename tidies spaces', renamed[0].name === 'Sunday sketch');
  ok('a blank rename keeps the old name', renameSaved(renamed, d2.item.id, '   ')[0].name === 'Sunday sketch');
  ok('remove removes one', removeSaved(renamed, d2.item.id).length === 3);

  const backup = JSON.stringify(makeBackup(renamed, { 'saved:y': EMPTY_DOC }, 9000));
  const read = readBackup(backup);
  ok('a backup reads back whole', !('error' in read) && read.items.length === 4 && read.rejected === 0 && !!read.docs['saved:y']);
  ok('garbage is refused kindly', 'error' in readBackup('not json') && 'error' in readBackup('{"app":"other"}'));
  ok('a newer backup says so', (readBackup(JSON.stringify({ ...makeBackup([], {}), version: 2 })) as { error: string }).error.includes('newer'));
  const tampered = JSON.parse(backup);
  tampered.items.push({ id: 'bad', tool: 'hack', kind: 'x', name: 'x', at: 1, colors: [], recipe: {} });
  tampered.items.push({ id: 'bad2', tool: 'color', kind: 'x', name: 'x', at: 1, colors: ['red'], recipe: {} });
  const t = readBackup(JSON.stringify(tampered));
  ok('entries that are not valid are dropped, the rest kept', !('error' in t) && t.items.length === 4 && t.rejected === 2);
  const merged = mergeSaved(renamed.slice(0, 2), renamed);
  ok('merging skips what is already here', merged.added === 2 && merged.skipped === 2 && merged.list.length === 4);
  const sameWorkNewId = { ...renamed[2], id: 'other-id' };
  ok('the same work under another id is not duplicated', mergeSaved(renamed, [sameWorkNewId]).added === 0);
  const favs = fromColorFavourites([{ id: 'a', hexes: ['#111111'], at: 2 }, { id: 'b', hexes: ['#222222'], at: 1 }, { hexes: ['nope'] }]);
  ok('old COLOR favourites move in, oldest numbered first', favs.length === 2 && favs[0].name === 'Palette 2' && favs[1].name === 'Palette 1');
}

console.log('\nGOOGLE FONTS');
{
  const json = JSON.parse(readFileSync('public/google-fonts.json', 'utf8'));
  const all = decodeCatalogue(json);
  ok('the catalogue has every family', all.length > 1800, `${all.length}`);
  const roboto = all.find((f) => f.family === 'Roboto')!;
  ok('weights decode from the bit mask', roboto.weights[0] === 100 && roboto.weights.includes(900) && roboto.italics.length > 0);
  ok('variable families keep their range', roboto.wght?.[0] === 100 && roboto.wght?.[1] === 900);
  ok('every family has something to draw with', all.every((f) => f.weights.length + f.italics.length > 0));

  const variable: GoogleFamily = { family: 'Open Sans', category: 'Sans Serif', weights: [300, 400, 800], italics: [300, 400], wght: [300, 800] };
  ok('variable with italic asks for both ranges', familyCssUrl(variable) === 'https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300..800;1,300..800&display=swap');
  const staticFont: GoogleFamily = { family: 'Abril Fatface', category: 'Display', weights: [400], italics: [] };
  ok('a single regular weight needs no spec', familyCssUrl(staticFont) === 'https://fonts.googleapis.com/css2?family=Abril+Fatface&display=swap');
  const staticMany: GoogleFamily = { family: 'Lato', category: 'Sans Serif', weights: [100, 400, 900], italics: [400] };
  ok('static weights are listed exactly, italic after', familyCssUrl(staticMany).includes('Lato:ital,wght@0,100;0,400;0,900;1,400&'));
  const light: GoogleFamily = { family: 'Buda', category: 'Display', weights: [300], italics: [] };
  ok('a family without 400 asks for what it has', familyCssUrl(light).includes('Buda:wght@300&') && previewCssUrl(light).includes(':wght@300&text=Buda'));
  ok('italic-only families preview in italic', previewCssUrl({ family: 'X Y', category: 'Serif', weights: [], italics: [400] }).includes('X+Y:ital,wght@1,400&text=X%20Y'));

  const css = `/* latin-ext */
@font-face {
  font-family: 'Roboto';
  font-style: italic;
  font-weight: 100 900;
  font-stretch: 100%;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/roboto/v1/ext.woff2) format('woff2');
  unicode-range: U+0100-02BA, U+1E00-1E9F;
}
/* latin */
@font-face {
  font-family: 'Roboto';
  font-style: normal;
  font-weight: 400;
  src: url(https://fonts.gstatic.com/s/roboto/v1/latin.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+4??;
}`;
  const faces = parseFaces(css);
  ok('faces parse with style, weight, url and range', faces.length === 2 && faces[0].style === 'italic' && faces[0].weight === '100 900' && faces[1].url.endsWith('latin.woff2'));
  ok('unicode ranges parse, wildcards included', JSON.stringify(parseUnicodeRange('U+0000-00FF, U+0131, U+4??')) === JSON.stringify([[0, 255], [305, 305], [1024, 1279]]));
  ok('a face covers text only when it has one of its letters', coversText(faces[1], 'Hello') && !coversText(faces[0], 'Hello') && coversText(faces[0], 'Łódź'));
  ok('weight ranges include what they span', faceHasWeight(faces[0], 650) && !faceHasWeight(faces[1], 700));

  knowGoogleFont(roboto);
  const info = fontById(googleFontId('Roboto'));
  ok('a Google family resolves to font info', info.family === 'Roboto' && !!info.google && info.italic);
  ok('an unknown Google family falls back to a bundled font', fontById('google:Nope Sans').id === 'inter');
  ok('nearest weight works for Google families too', nearestWeight(googleFontInfo(light), 700) === 300);
}

console.log('\nDRAW');
{
  ok('symmetry codes', symmetryCode({ mode: 'none', segments: 6 }) === 'n' && symmetryCode({ mode: 'radial', segments: 8 }) === 'r8');
  ok('radial makes one copy per segment', transforms('r12').length === 12 && transforms('v').length === 2 && transforms('n').length === 1);
  const [qx, qy] = apply(transforms('r4')[1], 10, 0);
  ok('a quarter turn is exact', qx === 0 && qy === 10);
  const [mx, my] = apply(transforms('v')[1], 10, 5);
  ok('vertical symmetry mirrors left and right', mx === -10 && my === 5);
  const [hx, hy] = apply(transforms('h')[1], 10, 5);
  ok('horizontal symmetry mirrors top and bottom', hx === 10 && hy === -5);

  const snapped = constrain('line', 0, 0, 100, 40, { shift: true });
  ok('Shift snaps a line to the nearest 45°', near(snapped[3], 0) && near(snapped[2], Math.hypot(100, 40)));
  const diag = constrain('line', 0, 0, 90, 100, { shift: true });
  ok('…including diagonals', near(diag[2], diag[3]));
  const square = constrain('rect', 0, 0, -30, 80, { shift: true });
  ok('Shift makes a square, in the direction dragged', square[2] === -80 && square[3] === 80);
  const centred = constrain('circle', 10, 10, 20, 30, { alt: true });
  ok('Alt draws from the centre', centred.join() === '0,-10,20,30');

  const pts = [0, 0, 10, 0, 20, 10, 30, 10, 40, 0];
  const segs = segments(pts);
  ok('a smooth line has one piece per point after the first', segs.length === 4);
  ok('pieces join end to start', segs.every((s, i) => i === 0 || (s.x0 === segs[i - 1].x1 && s.y0 === segs[i - 1].y1)));
  ok('it starts and ends on the real points', segs[0].x0 === 0 && segs[3].x1 === 40 && segs[3].y1 === 0);
  ok('pressure thins the line but never to nothing', widthAt({ s: 20, w: [0] }, 0) === 5 && widthAt({ s: 20, w: [1] }, 0) === 20);

  const raw: Stroke = { b: 'pencil', c: '#111111', s: 4.04, o: 0.999, p: [1.234, 5.678], w: [0.5, 0.5], y: 'n' };
  const done = finish(raw);
  ok('finishing rounds for storage', done.p.join() === '1.2,5.7' && done.o === 1);
  ok('even pressure becomes a plain width, drawn as it looked', done.w === undefined && done.s === 2.5);
  const b = bounds({ b: 'pencil', c: '#111111', s: 10, o: 1, p: [100, 0, 110, 0], y: 'v' });
  ok('bounds include symmetry copies and the brush', b[0] === -116 && b[2] === 116);

  const doc: DrawDoc = {
    v: 1, ground: 'light', groundColor: '#000000',
    strokes: [
      { b: 'pencil', c: '#E4572E', s: 6, o: 1, p: [0, 0, 50, 50, 100, 0], y: 'n' },
      { b: 'marker', c: '#1D1B22', s: 20, o: 0.5, p: [0, 0, 10, 10], y: 'r4' },
      { b: 'eraser', c: '#111111', s: 30, o: 1, p: [0, 0, 20, 20], y: 'n' },
      { b: 'circle', c: '#7FB5A4', s: 4, o: 1, p: [-50, -50, 50, 50], y: 'n' },
    ],
  };
  const svg = docSvg(doc, { x: -800, y: -500, w: 1600, h: 1000 }, 1600);
  const eraseAt = svg.indexOf('<g mask="url(#erase2)">');
  ok('the eraser masks only what came before it', eraseAt > 0 && svg.indexOf('#E4572E') > eraseAt && svg.indexOf('<ellipse') > svg.lastIndexOf('</g>', svg.indexOf('<ellipse')));
  ok('the background stays outside the eraser', svg.indexOf('fill="#FFFFFF"') < eraseAt);
  ok('translucent strokes are one group at their opacity', svg.includes('<g opacity="0.5">'));
  ok('radial copies are rotations', (svg.match(/<g transform="matrix\(/g) ?? []).length === 3);
  ok('the size matches the view', svg.includes('width="1600" height="1000" viewBox="-800 -500 1600 1000"'));
  ok('no broken numbers', !/NaN|Infinity/.test(svg));
  const pressure = docSvg({ ...EMPTY_DOC, strokes: [{ b: 'pencil', c: '#111111', s: 10, o: 1, p: [0, 0, 5, 5, 10, 0], w: [0.2, 0.6, 1], y: 'n' }] }, { x: -10, y: -10, w: 20, h: 20 });
  ok('a pressure stroke exports its changing width', (pressure.match(/stroke-width=/g) ?? []).length === 2);
  const dot = docSvg({ ...EMPTY_DOC, ground: 'transparent', strokes: [{ b: 'pencil', c: '#111111', s: 10, o: 1, p: [0, 0], y: 'n' }] }, { x: -10, y: -10, w: 20, h: 20 });
  ok('a tap is a dot, and no background means none', dot.includes('<circle') && !dot.includes('<rect'));
  ok('chip colours start with the background', colorsUsed(doc)[0] === '#FFFFFF' && colorsUsed(doc).includes('#E4572E'));
  ok('documents validate', validDoc(doc) && !validDoc({ ...doc, strokes: [{ ...doc.strokes[0], c: 'red' }] }) && !validDoc(null));
}

console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'}  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
