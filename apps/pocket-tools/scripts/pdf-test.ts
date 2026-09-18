/**
 * PDF operations and the ZIP writer, on real files made here.
 */

import { writeFileSync, mkdtempSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PDFDocument } from '@cantoo/pdf-lib';
import {
  addPageNumbers, blankPdf, chunks, cropPages, extractPages, formatRanges, merge, normalized, openPdf, organize, parseRanges,
  PdfProblem, protect, removePages, repair, sign, splitPdf, watermark,
} from '../src/utils/pdfOps';
import { crc32, zip } from '../src/utils/zip';

let passed = 0;
let failed = 0;
function ok(label: string, condition: boolean, detail = ''): void {
  if (condition) { passed += 1; console.log(`  ok   ${label}${detail ? `  ${detail}` : ''}`); }
  else { failed += 1; console.log(`  FAIL ${label}${detail ? `  ${detail}` : ''}`); }
}
const load = (b: Uint8Array) => PDFDocument.load(b);
const labels = async (b: Uint8Array) => {
  const doc = await load(b);
  return doc.getPages().map((p) => `${Math.round(p.getWidth())}x${Math.round(p.getHeight())}`);
};
const PNG = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));

(async () => {
  const five = await blankPdf(Array.from({ length: 5 }, (_, i) => ({ width: 500 + i * 10, height: 700, label: `Page ${i + 1}` })));
  const letter = await blankPdf([{ width: 612, height: 792 }, { width: 612, height: 792 }]);

  console.log('\nRANGES');
  ok('ranges', JSON.stringify(parseRanges('1-3, 5', 10)) === '[[0,1,2],[4]]');
  ok('backwards, odd, last', JSON.stringify(parseRanges('3-1', 5)) === '[[2,1,0]]' && JSON.stringify(parseRanges('odd', 5)) === '[[0,2,4]]' && JSON.stringify(parseRanges('4-last', 5)) === '[[3,4]]');
  ok('out of range is explained', 'error' in (parseRanges('2-9', 5) as object) && (parseRanges('2-9', 5) as { error: string }).error.includes('5 pages'));
  ok('nonsense is explained', 'error' in (parseRanges('abc', 5) as object) && 'error' in (parseRanges('', 5) as object));
  ok('ranges written back tidily', formatRanges([4, 0, 1, 2, 7]) === '1-3, 5, 8');
  ok('chunks', JSON.stringify(chunks(5, 2)) === '[[0,1],[2,3],[4]]');

  console.log('\nORGANISE');
  const merged = await merge([five, letter]);
  ok('merge keeps every page in order', JSON.stringify(await labels(merged)) === JSON.stringify(['500x700', '510x700', '520x700', '530x700', '540x700', '612x792', '612x792']));
  const extracted = await extractPages(five, [4, 0]);
  ok('extract in the order asked', JSON.stringify(await labels(extracted)) === '["540x700","500x700"]');
  const parts = await splitPdf(five, [[0, 1], [2], [3, 4]]);
  ok('split into parts', parts.length === 3 && (await load(parts[2])).getPageCount() === 2);
  const removed = await removePages(five, [1, 3]);
  ok('remove pages', JSON.stringify(await labels(removed)) === '["500x700","520x700","540x700"]');
  let threw = false;
  try { await removePages(five, [0, 1, 2, 3, 4]); } catch (e) { threw = e instanceof PdfProblem; }
  ok('removing every page is refused', threw);
  const organized = await organize(five, [{ index: 2, rotate: 90 }, { index: 0, rotate: -90 }, { index: 1, rotate: 180 }]);
  const od = await load(organized);
  ok('organise reorders and rotates', od.getPageCount() === 3 && od.getPage(0).getRotation().angle === 90 && od.getPage(1).getRotation().angle === 270 && od.getPage(2).getRotation().angle === 180 && Math.round(od.getPage(0).getWidth()) === 520);

  console.log('\nSTAMPS');
  const numbered = await addPageNumbers(five, { corner: 'bottom-center', format: 'page-n-of-total', start: 1, size: 11, margin: 28, skipFirst: true });
  ok('page numbers add a font and keep every page', (await load(numbered)).getPageCount() === 5 && Buffer.from(numbered).includes('Helvetica'));
  const rotatedNumbers = await addPageNumbers(organized, { corner: 'top-right', format: 'n', start: 1, size: 11, margin: 28, skipFirst: false });
  ok('numbers on rotated pages', (await load(rotatedNumbers)).getPageCount() === 3);
  const marked = await watermark(five, { png: PNG, width: 1, height: 1 }, { scale: 0.5, opacity: 0.2, rotation: 45, layout: 'tile' });
  ok('watermark embeds the image once and keeps pages', (await load(marked)).getPageCount() === 5 && (Buffer.from(marked).toString('latin1').match(/\/Subtype \/Image/g) ?? []).length <= 2);
  const signed = await sign(five, { png: PNG, width: 3, height: 1 }, [{ page: 0, x: 0.6, y: 0.8, w: 0.3, h: 0.1 }, { page: 4, x: 0.1, y: 0.1, w: 0.3, h: 0.1 }]);
  ok('signature placed', (await load(signed)).getPageCount() === 5);
  const cropped = await cropPages(five, { top: 0.1, right: 0.05, bottom: 0.1, left: 0.05 });
  const cb = (await load(cropped)).getPage(0).getCropBox();
  ok('crop trims the visible page', Math.round(cb.width) === 450 && Math.round(cb.height) === 560 && Math.round(cb.x) === 25, JSON.stringify(cb));

  console.log('\nSECURITY');
  const locked = await protect(five, 'open sesame', true);
  let kind = '';
  try { await openPdf(locked); } catch (e) { kind = (e as PdfProblem).kind; }
  ok('protected PDFs ask for a password', kind === 'encrypted');
  try { await openPdf(locked, 'nope'); } catch (e) { kind = (e as PdfProblem).kind; }
  ok('a wrong password says so', kind === 'password');
  const unlocked = await normalized(await openPdf(locked, 'open sesame'));
  const probe = await PDFDocument.load(unlocked, { ignoreEncryption: true });
  ok('unlocking really removes the encryption', !probe.isEncrypted && probe.getPageCount() === 5 && !Buffer.from(unlocked).toString('latin1').includes('/Encrypt'));
  let invalid = '';
  try { await openPdf(new TextEncoder().encode('hello')); } catch (e) { invalid = (e as PdfProblem).kind; }
  ok('not a PDF', invalid === 'invalid');

  console.log('\nREPAIR');
  // Damage the cross-reference table: the offsets now point at the wrong bytes.
  const text = Buffer.from(five).toString('latin1');
  const broken = Buffer.from(text.replace(/startxref\s+\d+/, 'startxref\n999999'), 'latin1');
  const fixed = await repair(new Uint8Array(broken));
  ok('a broken xref is rebuilt', fixed.pages === 5 && (await load(fixed.bytes)).getPageCount() === 5);

  console.log('\nZIP');
  ok('crc32', crc32(new TextEncoder().encode('The quick brown fox jumps over the lazy dog')) === 0x414fa339);
  const archive = zip([{ name: 'part.pdf', data: parts[0] }, { name: 'part.pdf', data: parts[1] }, { name: 'notes – ₹.txt', data: new TextEncoder().encode('hello') }]);
  const dir = mkdtempSync(join(tmpdir(), 'pt-zip-'));
  writeFileSync(join(dir, 'out.zip'), archive);
  let listing = '';
  try { listing = execSync(`python3 -c "import zipfile,sys; z=zipfile.ZipFile('${join(dir, 'out.zip')}'); print(z.testzip()); print('|'.join(z.namelist())); print(len(z.read('part (2).pdf')))"`).toString(); } catch (e) { listing = String(e); }
  ok('a valid ZIP, with repeated names made unique and UTF-8 names intact', listing.startsWith('None') && listing.includes('part.pdf|part (2).pdf|notes – ₹.txt') && listing.trim().endsWith(String(parts[1].length)), listing.trim().replace(/\n/g, ' / '));

  console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'}  ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})();
