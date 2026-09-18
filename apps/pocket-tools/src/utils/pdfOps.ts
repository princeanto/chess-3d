/**
 * PDF operations, with pdf-lib (the @cantoo fork, MIT, which adds encryption).
 *
 * Everything here works on bytes in and bytes out, and runs the same in a test
 * as in the browser. Rendering pages to pictures needs pdf.js and a canvas, so
 * that lives in pdfBrowser.ts.
 *
 * Output documents are built fresh — pages copied into a new PDF — rather than
 * edited in place. Copying is what makes an unlocked PDF truly unlocked (an
 * in-place save keeps the old encryption), and it drops any unused objects the
 * original was carrying.
 */

import { PDFDocument, StandardFonts, degrees, rgb } from '@cantoo/pdf-lib';

export class PdfProblem extends Error {
  constructor(public kind: 'encrypted' | 'password' | 'invalid' | 'empty', message: string) {
    super(message);
  }
}

const SAVE = { useObjectStreams: true } as const;

/** Opens a PDF, or explains why it can't be opened. */
export async function openPdf(bytes: Uint8Array, password?: string): Promise<PDFDocument> {
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 1024));
  if (!head.includes('%PDF')) throw new PdfProblem('invalid', 'That isn’t a PDF file.');
  let probe: PDFDocument;
  try {
    probe = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  } catch {
    throw new PdfProblem('invalid', 'This PDF couldn’t be read. It may be damaged — try Repair PDF.');
  }
  if (probe.isEncrypted) {
    if (password === undefined) throw new PdfProblem('encrypted', 'This PDF is password-protected.');
    try {
      return await PDFDocument.load(bytes, { password, updateMetadata: false });
    } catch {
      throw new PdfProblem('password', 'That password isn’t right.');
    }
  }
  if (probe.getPageCount() === 0) throw new PdfProblem('empty', 'This PDF has no pages.');
  return probe;
}

async function copyInto(out: PDFDocument, source: PDFDocument, indices: number[]): Promise<void> {
  const pages = await out.copyPages(source, indices);
  pages.forEach((page) => out.addPage(page));
}

function fresh(title?: string): Promise<PDFDocument> {
  return PDFDocument.create().then((doc) => {
    doc.setProducer('Pocket Tools');
    doc.setCreator('Pocket Tools');
    if (title) doc.setTitle(title);
    return doc;
  });
}

/** A plain, unencrypted copy of an opened PDF — the starting point every tool works from. */
export async function normalized(doc: PDFDocument): Promise<Uint8Array> {
  const out = await fresh(doc.getTitle() ?? undefined);
  await copyInto(out, doc, doc.getPageIndices());
  return out.save(SAVE);
}

/* ------------------------------- page lists ------------------------------- */

/**
 * "1-3, 5, 8-10" → [[0,1,2], [4], [7,8,9]] (zero-based). Also "odd", "even",
 * "last", "all", and backwards ranges like "5-3".
 */
export function parseRanges(text: string, pageCount: number): number[][] | { error: string } {
  const parts = text.split(/[,;]+/).map((p) => p.trim().toLowerCase()).filter(Boolean);
  if (!parts.length) return { error: 'Enter which pages, like 1-3, 5.' };
  const out: number[][] = [];
  const page = (s: string): number | null => {
    if (s === 'last' || s === 'end') return pageCount;
    if (!/^\d+$/.test(s)) return null;
    return Number(s);
  };
  for (const part of parts) {
    if (part === 'all') { out.push(Array.from({ length: pageCount }, (_, i) => i)); continue; }
    if (part === 'odd' || part === 'even') { out.push(Array.from({ length: pageCount }, (_, i) => i).filter((i) => (i % 2 === 0) === (part === 'odd'))); continue; }
    const m = /^(\w+)\s*(?:-|–|to)\s*(\w+)$/.exec(part);
    const a = page(m ? m[1] : part);
    const b = m ? page(m[2]) : a;
    if (a === null || b === null) return { error: `“${part}” isn’t a page or a range.` };
    if (a < 1 || b < 1 || a > pageCount || b > pageCount) return { error: `This PDF has ${pageCount} ${pageCount === 1 ? 'page' : 'pages'}; “${part}” is outside that.` };
    const step = a <= b ? 1 : -1;
    const run: number[] = [];
    for (let p = a; step > 0 ? p <= b : p >= b; p += step) run.push(p - 1);
    out.push(run);
  }
  return out;
}

export const formatRanges = (indices: number[]): string => {
  const sorted = [...new Set(indices)].sort((a, b) => a - b);
  const runs: string[] = [];
  for (let i = 0; i < sorted.length; i += 1) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j += 1;
    runs.push(i === j ? `${sorted[i] + 1}` : `${sorted[i] + 1}-${sorted[j] + 1}`);
    i = j;
  }
  return runs.join(', ');
};

/* -------------------------------- organise -------------------------------- */

export async function merge(files: Uint8Array[]): Promise<Uint8Array> {
  const out = await fresh('Merged');
  for (const bytes of files) {
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    await copyInto(out, doc, doc.getPageIndices());
  }
  return out.save(SAVE);
}

/** One new PDF with these pages, in this order. */
export async function extractPages(bytes: Uint8Array, indices: number[]): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const out = await fresh(doc.getTitle() ?? undefined);
  await copyInto(out, doc, indices);
  return out.save(SAVE);
}

export async function splitPdf(bytes: Uint8Array, groups: number[][]): Promise<Uint8Array[]> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const parts: Uint8Array[] = [];
  for (const group of groups) {
    const out = await fresh();
    await copyInto(out, doc, group);
    parts.push(await out.save(SAVE));
  }
  return parts;
}

/** [[0..n-1]] in chunks of `size`. */
export const chunks = (pageCount: number, size: number): number[][] =>
  Array.from({ length: Math.ceil(pageCount / size) }, (_, c) => Array.from({ length: Math.min(size, pageCount - c * size) }, (_, i) => c * size + i));

export async function removePages(bytes: Uint8Array, remove: Iterable<number>): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const drop = new Set(remove);
  const keep = doc.getPageIndices().filter((i) => !drop.has(i));
  if (!keep.length) throw new PdfProblem('empty', 'That would remove every page.');
  return extractPages(bytes, keep);
}

export interface PagePlan { index: number; rotate: number }

/** New order, with extra rotation per page (degrees, multiples of 90). */
export async function organize(bytes: Uint8Array, plan: PagePlan[]): Promise<Uint8Array> {
  if (!plan.length) throw new PdfProblem('empty', 'Keep at least one page.');
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const out = await fresh(doc.getTitle() ?? undefined);
  const pages = await out.copyPages(doc, plan.map((p) => p.index));
  pages.forEach((page, i) => {
    const turn = (((page.getRotation().angle + plan[i].rotate) % 360) + 360) % 360;
    page.setRotation(degrees(turn));
    out.addPage(page);
  });
  return out.save(SAVE);
}

/* ---------------------------------- stamp --------------------------------- */

export type Corner = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
export type NumberFormat = 'n' | 'page-n' | 'n-of-total' | 'page-n-of-total';

export function pageLabel(format: NumberFormat, n: number, total: number): string {
  switch (format) {
    case 'page-n': return `Page ${n}`;
    case 'n-of-total': return `${n} of ${total}`;
    case 'page-n-of-total': return `Page ${n} of ${total}`;
    default: return String(n);
  }
}

/**
 * The page's visible rectangle and how to place something upright on it, for
 * pages that carry a rotation: text goes where a reader sees the corner, not
 * where the unrotated page had it.
 */
function uprightFrame(page: ReturnType<PDFDocument['getPage']>) {
  const box = page.getCropBox();
  const angle = ((page.getRotation().angle % 360) + 360) % 360;
  const w = angle % 180 === 0 ? box.width : box.height;
  const h = angle % 180 === 0 ? box.height : box.width;
  /** Visible (upright) coordinates → page coordinates. */
  const map = (x: number, y: number): { x: number; y: number } => {
    switch (angle) {
      case 90: return { x: box.x + box.width - y, y: box.y + x };
      case 180: return { x: box.x + box.width - x, y: box.y + box.height - y };
      case 270: return { x: box.x + y, y: box.y + box.height - x };
      default: return { x: box.x + x, y: box.y + y };
    }
  };
  return { w, h, angle, map };
}

export async function addPageNumbers(bytes: Uint8Array, o: { corner: Corner; format: NumberFormat; start: number; size: number; margin: number; skipFirst: boolean }): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  const counted = o.skipFirst ? pages.length - 1 : pages.length;
  pages.forEach((page, i) => {
    if (o.skipFirst && i === 0) return;
    const n = o.start + (o.skipFirst ? i - 1 : i);
    const text = pageLabel(o.format, n, o.start + counted - 1);
    const width = font.widthOfTextAtSize(text, o.size);
    const f = uprightFrame(page);
    const [vertical, horizontal] = o.corner.split('-');
    const x = horizontal === 'left' ? o.margin : horizontal === 'right' ? f.w - o.margin - width : (f.w - width) / 2;
    const y = vertical === 'top' ? f.h - o.margin - o.size * 0.72 : o.margin;
    const at = f.map(x, y);
    page.drawText(text, { x: at.x, y: at.y, size: o.size, font, color: rgb(0.15, 0.15, 0.15), rotate: degrees(f.angle) });
  });
  return doc.save(SAVE);
}

export interface StampImage {
  png: Uint8Array;
  /** Pixel size of the PNG, for its proportions. */
  width: number;
  height: number;
}

/**
 * An image laid over pages: a watermark rendered from text or a logo. Centred
 * and rotated, or tiled across the page.
 */
export async function watermark(bytes: Uint8Array, stamp: StampImage, o: { scale: number; opacity: number; rotation: number; layout: 'center' | 'tile'; pages?: number[] }): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const image = await doc.embedPng(stamp.png);
  const only = o.pages ? new Set(o.pages) : null;
  doc.getPages().forEach((page, i) => {
    if (only && !only.has(i)) return;
    const f = uprightFrame(page);
    const w = f.w * o.scale;
    const h = (w * stamp.height) / stamp.width;
    const place = (cx: number, cy: number) => {
      // Rotation in pdf-lib turns around the image's lower-left corner; offset so it turns around its centre.
      const t = ((o.rotation + f.angle) * Math.PI) / 180;
      const corner = f.map(cx, cy);
      const x = corner.x - (w / 2) * Math.cos(t) + (h / 2) * Math.sin(t);
      const y = corner.y - (w / 2) * Math.sin(t) - (h / 2) * Math.cos(t);
      page.drawImage(image, { x, y, width: w, height: h, opacity: o.opacity, rotate: degrees(o.rotation + f.angle) });
    };
    if (o.layout === 'center') {
      place(f.w / 2, f.h / 2);
    } else {
      const stepX = w * 1.6;
      const stepY = Math.max(h * 3, w * 0.9);
      for (let row = 0, y = stepY / 2; y < f.h + stepY; row += 1, y += stepY) {
        for (let x = row % 2 ? 0 : stepX / 2; x < f.w + stepX; x += stepX) place(x, y);
      }
    }
  });
  return doc.save(SAVE);
}

export interface Placement {
  page: number;
  /** Box in fractions of the visible page, from the top-left. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export async function sign(bytes: Uint8Array, stamp: StampImage, placements: Placement[]): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const image = await doc.embedPng(stamp.png);
  const pages = doc.getPages();
  for (const p of placements) {
    const page = pages[p.page];
    if (!page) continue;
    const f = uprightFrame(page);
    const w = p.w * f.w;
    const h = p.h * f.h;
    // Lower-left corner of the box in upright coordinates.
    const at = f.map(p.x * f.w, f.h - (p.y + p.h) * f.h);
    page.drawImage(image, { x: at.x, y: at.y, width: w, height: h, rotate: degrees(f.angle) });
  }
  return doc.save(SAVE);
}

/** Trims margins by setting each page's crop box. Margins are fractions of the visible page. */
export async function cropPages(bytes: Uint8Array, m: { top: number; right: number; bottom: number; left: number }, pages?: number[]): Promise<Uint8Array> {
  if (m.left + m.right >= 0.95 || m.top + m.bottom >= 0.95) throw new PdfProblem('empty', 'That crop leaves nothing of the page.');
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const only = pages ? new Set(pages) : null;
  doc.getPages().forEach((page, i) => {
    if (only && !only.has(i)) return;
    const box = page.getCropBox();
    const angle = ((page.getRotation().angle % 360) + 360) % 360;
    // Margins as seen upright, turned back to the page's own sides.
    const sides = { 0: [m.left, m.bottom, m.right, m.top], 90: [m.top, m.left, m.bottom, m.right], 180: [m.right, m.top, m.left, m.bottom], 270: [m.bottom, m.right, m.top, m.left] }[angle as 0 | 90 | 180 | 270] ?? [m.left, m.bottom, m.right, m.top];
    const [l, b, r, t] = sides;
    const x = box.x + box.width * l;
    const y = box.y + box.height * b;
    const w = box.width * (1 - l - r);
    const h = box.height * (1 - b - t);
    page.setCropBox(x, y, w, h);
    page.setMediaBox(x, y, w, h);
  });
  return doc.save(SAVE);
}

/* -------------------------------- security -------------------------------- */

export async function protect(bytes: Uint8Array, password: string, allowPrinting: boolean): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const out = await fresh(doc.getTitle() ?? undefined);
  await copyInto(out, doc, doc.getPageIndices());
  // A random owner password: nobody can lift the restrictions without the open password either.
  const owner = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, '0')).join('');
  out.encrypt({ userPassword: password, ownerPassword: owner, permissions: allowPrinting ? { printing: 'highResolution' } : {} });
  return out.save({ useObjectStreams: false });
}

/** Rebuilds a PDF's structure — the cross-reference table most damage lives in. */
export async function repair(bytes: Uint8Array): Promise<{ bytes: Uint8Array; pages: number }> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, throwOnInvalidObject: false, updateMetadata: false });
  if (doc.isEncrypted) throw new PdfProblem('encrypted', 'This PDF is password-protected. Unlock it first.');
  const out = await fresh(doc.getTitle() ?? undefined);
  await copyInto(out, doc, doc.getPageIndices());
  if (!out.getPageCount()) throw new PdfProblem('empty', 'No pages could be recovered from this file.');
  return { bytes: await out.save(SAVE), pages: out.getPageCount() };
}

/** Structure-only savings: unused objects dropped, objects packed into compressed streams. */
export async function tidy(bytes: Uint8Array): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const out = await fresh(doc.getTitle() ?? undefined);
  await copyInto(out, doc, doc.getPageIndices());
  return out.save(SAVE);
}

export async function blankPdf(pages: { width: number; height: number; label?: string }[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const p of pages) {
    const page = doc.addPage([p.width, p.height]);
    if (p.label) page.drawText(p.label, { x: 40, y: p.height - 60, size: 24, font });
  }
  return doc.save();
}
