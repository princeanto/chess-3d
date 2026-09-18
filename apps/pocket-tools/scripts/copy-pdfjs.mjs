/**
 * Puts pdf.js in public/pdfjs before a build: the library, its worker, the
 * standard fonts it falls back on and its image decoders. Served as plain files,
 * they stay out of the app's bundle and are cached for offline use with
 * everything else. The copies are build output, not source, so git ignores them.
 */
import { cpSync, mkdirSync, rmSync } from 'node:fs';

const from = 'node_modules/pdfjs-dist';
const to = 'public/pdfjs';
rmSync(to, { recursive: true, force: true });
mkdirSync(to, { recursive: true });
cpSync(`${from}/legacy/build/pdf.min.mjs`, `${to}/pdf.min.js`);
cpSync(`${from}/legacy/build/pdf.worker.min.mjs`, `${to}/pdf.worker.min.js`);
cpSync(`${from}/standard_fonts`, `${to}/standard_fonts`, { recursive: true });
cpSync(`${from}/wasm`, `${to}/wasm`, { recursive: true });
cpSync(`${from}/LICENSE`, `${to}/LICENSE`);
console.log('pdfjs copied to public/pdfjs');
