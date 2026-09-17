/**
 * Writes public/google-fonts.json: every Google Fonts family, compactly.
 *
 * Run by hand when the catalogue should be refreshed, and committed, so a build
 * never depends on Google being reachable. The app fetches this list only when
 * the font browser opens; the fonts themselves load one at a time, when picked.
 *
 * Each family is [name, category, normal weights, italic weights, wght min, wght max].
 * Weights are bit masks, 100 → bit 0 … 900 → bit 8. min/max are 0 for a family
 * with no variable weight axis.
 */
import { writeFileSync } from 'node:fs';

const CATEGORIES = ['Sans Serif', 'Serif', 'Display', 'Handwriting', 'Monospace'];

const response = await fetch('https://fonts.google.com/metadata/fonts');
if (!response.ok) throw new Error(`Catalogue request failed: ${response.status}`);
const text = (await response.text()).replace(/^\)\]\}'\s*/, '');
const { familyMetadataList: list } = JSON.parse(text);

const families = [];
let skipped = 0;
for (const meta of list.slice().sort((a, b) => a.popularity - b.popularity)) {
  let normal = 0;
  let italic = 0;
  for (const key of Object.keys(meta.fonts ?? {})) {
    const match = /^([1-9])00(i?)$/.exec(key);
    if (!match) continue;
    const bit = 1 << (Number(match[1]) - 1);
    if (match[2]) italic |= bit;
    else normal |= bit;
  }
  const category = CATEGORIES.indexOf(meta.category);
  if ((!normal && !italic) || category < 0) { skipped += 1; continue; }
  const wght = (meta.axes ?? []).find((axis) => axis.tag === 'wght');
  families.push([meta.family, category, normal, italic, wght ? wght.min : 0, wght ? wght.max : 0]);
}

const out = { version: 1, updated: new Date().toISOString().slice(0, 10), categories: CATEGORIES, families };
writeFileSync('public/google-fonts.json', JSON.stringify(out));
console.log(`google-fonts.json  ${families.length} families (${skipped} skipped)`);
