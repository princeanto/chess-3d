/**
 * Builds the single-file Khata that runs inside claude.ai.
 *
 * The engine is the same TypeScript `npm test` checks — bundled into a browser
 * global, not rewritten — so the page and the tests cannot drift apart. The
 * result is one HTML file with no dependencies at runtime at all.
 */

import { execFileSync } from 'child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { SAMPLE, SAMPLE_NOW } from './fixtures/sample';

const root = resolve(__dirname, '..');
const cache = resolve(root, 'node_modules/.cache');
const bundle = resolve(cache, 'khata-engine.js');
mkdirSync(cache, { recursive: true });

execFileSync(
  'npx',
  [
    '--yes',
    'esbuild@0.24.0',
    'lib/engine.ts',
    '--bundle',
    '--format=iife',
    '--global-name=Khata',
    '--target=es2020',
    '--minify',
    '--legal-comments=none',
    `--outfile=${bundle}`,
  ],
  { cwd: root, stdio: 'inherit' },
);

// Nothing inlined into a <script> may contain that element's closing tag.
const safe = (text: string): string => text.replace(/<\/(script)/gi, '<\\/$1');

const engine = safe(readFileSync(bundle, 'utf8'));
const sample = safe(JSON.stringify(SAMPLE));
const template = readFileSync(resolve(root, 'artifact/khata.template.html'), 'utf8');

for (const token of ['/*__ENGINE__*/', '/*__SAMPLE__*/[]', '/*__SAMPLE_NOW__*/0']) {
  if (!template.includes(token)) throw new Error(`template is missing ${token}`);
}

// Function replacers: minified code is full of `$&` and `$1`, which a string
// replacement would expand.
const html = template
  .replace('/*__ENGINE__*/', () => engine)
  .replace('/*__SAMPLE__*/[]', () => sample)
  .replace('/*__SAMPLE_NOW__*/0', () => String(SAMPLE_NOW));

const out = resolve(root, 'artifact/khata.html');
writeFileSync(out, html);
console.log(`artifact/khata.html  ${(html.length / 1024).toFixed(1)} kB, ${SAMPLE.length} sample messages`);
