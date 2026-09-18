/**
 * The PDF work that needs a browser: seeing pages, and turning pictures in and
 * out of PDFs.
 *
 * pdf.js (Apache-2.0, Mozilla) is served from /pdfjs as plain files rather than
 * bundled, so the app's own code stays small and the service worker keeps it for
 * offline use like everything else. Script evaluation inside PDFs is switched
 * off; a PDF here is something to look at, not something to run.
 */

import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFRef, decodePDFRawStream } from '@cantoo/pdf-lib';

type PdfJs = typeof import('pdfjs-dist');
let pdfjs: Promise<PdfJs> | null = null;

export function loadPdfJs(): Promise<PdfJs> {
  pdfjs ??= (async () => {
    const url = '/pdfjs/pdf.min.js';
    const lib = (await import(/* webpackIgnore: true */ url)) as PdfJs;
    lib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.js';
    return lib;
  })();
  pdfjs.catch(() => { pdfjs = null; });
  return pdfjs;
}

/** pdf.js takes ownership of the buffer it is given, so it always gets a copy. */
export async function openForView(bytes: Uint8Array): Promise<PDFDocumentProxy> {
  const lib = await loadPdfJs();
  return lib.getDocument({
    data: bytes.slice(),
    isEvalSupported: false,
    enableXfa: false,
    standardFontDataUrl: '/pdfjs/standard_fonts/',
    wasmUrl: '/pdfjs/wasm/',
  }).promise;
}

export interface Rendered { canvas: HTMLCanvasElement; width: number; height: number }

/** A page at `scale` (1 = 72 dpi), on white. */
export async function renderPage(page: PDFPageProxy, scale: number, maxPixels = 40_000_000): Promise<Rendered> {
  let viewport = page.getViewport({ scale });
  if (viewport.width * viewport.height > maxPixels) {
    viewport = page.getViewport({ scale: scale * Math.sqrt(maxPixels / (viewport.width * viewport.height)) });
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const ctx = canvas.getContext('2d', { alpha: false })!;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  return { canvas, width: canvas.width, height: canvas.height };
}

export async function renderThumb(doc: PDFDocumentProxy, pageNumber: number, cssWidth: number): Promise<string> {
  const page = await doc.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const { canvas } = await renderPage(page, (cssWidth * dpr) / base.width);
  page.cleanup();
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ? URL.createObjectURL(b) : ''), 'image/jpeg', 0.8));
}

const toBlob = (canvas: HTMLCanvasElement | OffscreenCanvas, type: string, quality?: number): Promise<Blob> =>
  'convertToBlob' in canvas
    ? canvas.convertToBlob({ type, quality })
    : new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), type, quality));

const pause = () => new Promise((r) => setTimeout(r, 0));

/* -------------------------------- to images ------------------------------- */

export async function pagesToImages(bytes: Uint8Array, pageNumbers: number[], o: { type: 'image/jpeg' | 'image/png'; dpi: number; quality: number }, progress?: (done: number, total: number) => void): Promise<{ page: number; blob: Blob; width: number; height: number }[]> {
  const doc = await openForView(bytes);
  const out: { page: number; blob: Blob; width: number; height: number }[] = [];
  try {
    for (let i = 0; i < pageNumbers.length; i += 1) {
      progress?.(i, pageNumbers.length);
      const page = await doc.getPage(pageNumbers[i]);
      const r = await renderPage(page, o.dpi / 72);
      out.push({ page: pageNumbers[i], blob: await toBlob(r.canvas, o.type, o.quality), width: r.width, height: r.height });
      page.cleanup();
      await pause();
    }
    progress?.(pageNumbers.length, pageNumbers.length);
    return out;
  } finally {
    await doc.destroy();
  }
}

export async function extractText(bytes: Uint8Array): Promise<{ pages: string[] }> {
  const doc = await openForView(bytes);
  try {
    const pages: string[] = [];
    for (let n = 1; n <= doc.numPages; n += 1) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      let text = '';
      let lastY: number | null = null;
      for (const item of content.items) {
        if (!('str' in item)) continue;
        const y = item.transform[5];
        if (lastY !== null && Math.abs(y - lastY) > 2 && !text.endsWith('\n')) text += '\n';
        text += item.str;
        if (item.hasEOL) text += '\n';
        lastY = y;
      }
      pages.push(text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim());
      page.cleanup();
    }
    return { pages };
  } finally {
    await doc.destroy();
  }
}

/* ------------------------------- compression ------------------------------ */

export type CompressLevel = 'light' | 'recommended' | 'extreme';
const LEVELS: Record<CompressLevel, { maxSide: number; quality: number; dpi: number }> = {
  light: { maxSide: 2600, quality: 0.82, dpi: 150 },
  recommended: { maxSide: 1800, quality: 0.7, dpi: 120 },
  extreme: { maxSide: 1200, quality: 0.5, dpi: 90 },
};

/** Undoes PNG row filters (the "predictor" PDFs use with Flate). */
function unpredict(data: Uint8Array, columns: number, colors: number): Uint8Array | null {
  const bpp = colors;
  const row = columns * colors;
  const rows = Math.floor(data.length / (row + 1));
  const out = new Uint8Array(rows * row);
  for (let r = 0; r < rows; r += 1) {
    const type = data[r * (row + 1)];
    const src = r * (row + 1) + 1;
    const dst = r * row;
    for (let i = 0; i < row; i += 1) {
      const raw = data[src + i];
      const left = i >= bpp ? out[dst + i - bpp] : 0;
      const up = r ? out[dst - row + i] : 0;
      const upLeft = r && i >= bpp ? out[dst - row + i - bpp] : 0;
      let v: number;
      switch (type) {
        case 0: v = raw; break;
        case 1: v = raw + left; break;
        case 2: v = raw + up; break;
        case 3: v = raw + ((left + up) >> 1); break;
        case 4: {
          const p = left + up - upLeft;
          const pa = Math.abs(p - left);
          const pb = Math.abs(p - up);
          const pc = Math.abs(p - upLeft);
          v = raw + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft);
          break;
        }
        default: return null;
      }
      out[dst + i] = v & 0xff;
    }
  }
  return out;
}

function components(doc: PDFDocument, space: unknown): number | null {
  if (space === PDFName.of('DeviceRGB')) return 3;
  if (space === PDFName.of('DeviceGray')) return 1;
  if (space instanceof PDFArray && space.get(0) === PDFName.of('ICCBased')) {
    const stream = doc.context.lookup(space.get(1));
    const n = stream && 'dict' in (stream as object) ? (stream as PDFRawStream).dict.lookup(PDFName.of('N')) : undefined;
    return n instanceof PDFNumber && (n.asNumber() === 1 || n.asNumber() === 3) ? n.asNumber() : null;
  }
  return null;
}

async function decodeImage(doc: PDFDocument, stream: PDFRawStream): Promise<ImageBitmap | null> {
  const d = stream.dict;
  if (d.get(PDFName.of('ImageMask')) || d.get(PDFName.of('Decode'))) return null;
  const width = (d.lookup(PDFName.of('Width')) as PDFNumber | undefined)?.asNumber() ?? 0;
  const height = (d.lookup(PDFName.of('Height')) as PDFNumber | undefined)?.asNumber() ?? 0;
  if (width * height < 60_000) return null;
  const filter = d.lookup(PDFName.of('Filter'));
  const name = filter instanceof PDFArray ? (filter.size() === 1 ? filter.get(0) : null) : filter;
  const n = components(doc, d.lookup(PDFName.of('ColorSpace')));
  if (name === PDFName.of('DCTDecode')) {
    if (n === null) return null; // CMYK and friends decode wrongly in browsers
    return createImageBitmap(new Blob([stream.contents as BlobPart], { type: 'image/jpeg' }));
  }
  if (name === PDFName.of('FlateDecode')) {
    const bpc = (d.lookup(PDFName.of('BitsPerComponent')) as PDFNumber | undefined)?.asNumber();
    if (bpc !== 8 || n === null) return null;
    let raw = decodePDFRawStream(stream).decode();
    const parms = d.lookup(PDFName.of('DecodeParms'));
    const predictor = parms instanceof PDFDict ? (parms.lookup(PDFName.of('Predictor')) as PDFNumber | undefined)?.asNumber() ?? 1 : 1;
    if (predictor >= 10) {
      const un = unpredict(raw, width, n);
      if (!un) return null;
      raw = un;
    } else if (predictor !== 1) {
      return null;
    }
    if (raw.length < width * height * n) return null;
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let i = 0, j = 0; i < width * height; i += 1, j += n) {
      rgba[i * 4] = raw[j];
      rgba[i * 4 + 1] = n === 3 ? raw[j + 1] : raw[j];
      rgba[i * 4 + 2] = n === 3 ? raw[j + 2] : raw[j];
      rgba[i * 4 + 3] = 255;
    }
    return createImageBitmap(new ImageData(rgba, width, height));
  }
  return null;
}

/**
 * Shrinks the pictures inside a PDF and leaves everything else — text stays text,
 * lines stay sharp. Photos are scaled down to a sensible size and re-encoded;
 * any picture that wouldn't come out meaningfully smaller is left alone.
 */
export async function compressImages(bytes: Uint8Array, level: CompressLevel, progress?: (done: number, total: number) => void): Promise<{ bytes: Uint8Array; images: number; changed: number }> {
  const s = LEVELS[level];
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const candidates: [PDFRef, PDFRawStream][] = [];
  for (const [ref, obj] of doc.context.enumerateIndirectObjects()) {
    if (obj instanceof PDFRawStream && obj.dict.get(PDFName.of('Subtype')) === PDFName.of('Image')) candidates.push([ref, obj]);
  }
  let changed = 0;
  for (let i = 0; i < candidates.length; i += 1) {
    progress?.(i, candidates.length);
    const [ref, stream] = candidates[i];
    try {
      const bitmap = await decodeImage(doc, stream);
      if (!bitmap) continue;
      const masked = !!(stream.dict.get(PDFName.of('SMask')) || stream.dict.get(PDFName.of('Mask')));
      const scale = masked ? 1 : Math.min(1, s.maxSide / Math.max(bitmap.width, bitmap.height));
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
      const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, w, h);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bitmap, 0, 0, w, h);
      bitmap.close();
      const jpeg = new Uint8Array(await (await toBlob(canvas, 'image/jpeg', s.quality)).arrayBuffer());
      if (jpeg.length >= stream.contents.length * 0.9) continue;
      const dict = stream.dict.clone(doc.context);
      dict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));
      dict.set(PDFName.of('Width'), PDFNumber.of(w));
      dict.set(PDFName.of('Height'), PDFNumber.of(h));
      dict.set(PDFName.of('ColorSpace'), PDFName.of('DeviceRGB'));
      dict.set(PDFName.of('BitsPerComponent'), PDFNumber.of(8));
      dict.delete(PDFName.of('DecodeParms'));
      dict.set(PDFName.of('Length'), PDFNumber.of(jpeg.length));
      doc.context.assign(ref, PDFRawStream.of(dict, jpeg));
      changed += 1;
    } catch {
      /* leave this picture as it was */
    }
    if (i % 4 === 3) await pause();
  }
  progress?.(candidates.length, candidates.length);
  const out = await PDFDocument.create();
  out.setProducer('Pocket Tools');
  (await out.copyPages(doc, doc.getPageIndices())).forEach((p) => out.addPage(p));
  return { bytes: await out.save({ useObjectStreams: true }), images: candidates.length, changed };
}

/**
 * The strongest squeeze: every page becomes one picture. For scans and photo
 * documents; text is no longer selectable afterwards.
 */
export async function flattenPages(bytes: Uint8Array, level: CompressLevel, progress?: (done: number, total: number) => void): Promise<Uint8Array> {
  const s = LEVELS[level];
  const view = await openForView(bytes);
  const out = await PDFDocument.create();
  out.setProducer('Pocket Tools');
  try {
    for (let n = 1; n <= view.numPages; n += 1) {
      progress?.(n - 1, view.numPages);
      const page = await view.getPage(n);
      const size = page.getViewport({ scale: 1 });
      const r = await renderPage(page, s.dpi / 72);
      const jpeg = new Uint8Array(await (await toBlob(r.canvas, 'image/jpeg', s.quality)).arrayBuffer());
      const image = await out.embedJpg(jpeg);
      out.addPage([size.width, size.height]).drawImage(image, { x: 0, y: 0, width: size.width, height: size.height });
      page.cleanup();
      await pause();
    }
  } finally {
    await view.destroy();
  }
  progress?.(1, 1);
  return out.save({ useObjectStreams: true });
}

/* --------------------------------- stamps --------------------------------- */

export async function canvasToPng(canvas: HTMLCanvasElement): Promise<{ png: Uint8Array; width: number; height: number }> {
  const blob = await toBlob(canvas, 'image/png');
  return { png: new Uint8Array(await blob.arrayBuffer()), width: canvas.width, height: canvas.height };
}

/** Text drawn big and crisp, to be laid over pages as a picture — any script, any character. */
export async function textStamp(text: string, color: string, weight = 800): Promise<{ png: Uint8Array; width: number; height: number }> {
  const size = 220;
  const font = `${weight} ${size}px Inter, ui-sans-serif, system-ui, sans-serif`;
  await document.fonts?.load(font).catch(() => undefined);
  const measure = document.createElement('canvas').getContext('2d')!;
  measure.font = font;
  const lines = text.split('\n');
  const width = Math.ceil(Math.max(...lines.map((l) => measure.measureText(l).width))) + size * 0.4;
  const height = Math.ceil(lines.length * size * 1.15) + size * 0.2;
  const canvas = document.createElement('canvas');
  canvas.width = Math.min(8000, width);
  canvas.height = Math.min(8000, height);
  const ctx = canvas.getContext('2d')!;
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((line, i) => ctx.fillText(line, canvas.width / 2, size * 0.1 + size * 1.15 * (i + 0.5)));
  return canvasToPng(canvas);
}

/** Crops a canvas to where it has ink, with a little breathing room. */
export function trimCanvas(source: HTMLCanvasElement, pad = 12): HTMLCanvasElement | null {
  const ctx = source.getContext('2d')!;
  const { width, height } = source;
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  const out = document.createElement('canvas');
  out.width = maxX - minX + 1 + pad * 2;
  out.height = maxY - minY + 1 + pad * 2;
  out.getContext('2d')!.drawImage(source, minX, minY, maxX - minX + 1, maxY - minY + 1, pad, pad, maxX - minX + 1, maxY - minY + 1);
  return out;
}
