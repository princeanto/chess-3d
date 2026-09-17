/**
 * Documents drawn as SVG, exported as PDF and PNG.
 *
 * The preview on screen and the exported file come from the same SVG, so what
 * you see is what downloads. For export the SVG is drawn into a canvas, which
 * can't see the page's fonts — so Inter goes inside the SVG itself.
 */

import { buildPdf, type PdfPage } from './pdf';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const f = (n: number) => String(Math.round(n * 10) / 10);

export interface TextStyle { size?: number; weight?: number; anchor?: 'start' | 'middle' | 'end'; fill?: string; spacing?: number }

/** A tiny SVG writer: text, lines, rectangles. */
export class Sheet {
  private parts: string[] = [];
  constructor(public width: number, public height: number) {}
  text(x: number, y: number, value: string, s: TextStyle = {}) {
    if (!value) return;
    this.parts.push(`<text x="${f(x)}" y="${f(y)}" font-size="${s.size ?? 13}" font-weight="${s.weight ?? 400}" fill="${s.fill ?? '#111111'}"${s.anchor && s.anchor !== 'start' ? ` text-anchor="${s.anchor}"` : ''}${s.spacing ? ` letter-spacing="${s.spacing}"` : ''} xml:space="preserve">${esc(value)}</text>`);
  }
  line(x1: number, y1: number, x2: number, y2: number, stroke = '#DDDDD8', dash?: string, width = 1) {
    this.parts.push(`<path d="M${f(x1)} ${f(y1)}H${f(x2)}${y2 !== y1 ? `V${f(y2)}` : ''}" stroke="${stroke}" stroke-width="${width}"${dash ? ` stroke-dasharray="${dash}"` : ''} fill="none"/>`);
  }
  rect(x: number, y: number, w: number, h: number, fill: string, radius = 0) {
    this.parts.push(`<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${radius}" fill="${fill}"/>`);
  }
  svg(fontCss = '', pixelWidth = this.width): string {
    const ph = Math.round((pixelWidth / this.width) * this.height);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${pixelWidth}" height="${ph}" viewBox="0 0 ${this.width} ${this.height}" font-family="Inter, ui-sans-serif, system-ui, sans-serif">` +
      (fontCss ? `<defs><style>${fontCss}</style></defs>` : '') +
      `<rect width="${this.width}" height="${this.height}" fill="#FFFFFF"/>${this.parts.join('')}</svg>`;
  }
}

let context: CanvasRenderingContext2D | null = null;

/** Width of a line of Inter, from the browser; a fair estimate before the font loads. */
export function textWidth(text: string, size: number, weight = 400): number {
  if (typeof document !== 'undefined') {
    context ??= document.createElement('canvas').getContext('2d');
    if (context) {
      context.font = `${weight} ${size}px Inter, ui-sans-serif, system-ui, sans-serif`;
      return context.measureText(text).width;
    }
  }
  return text.length * size * 0.52;
}

export function wrap(text: string, maxWidth: number, size: number, weight = 400): string[] {
  const out: string[] = [];
  for (const paragraph of text.replace(/\r/g, '').split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) { out.push(''); continue; }
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (textWidth(next, size, weight) <= maxWidth || !line) {
        // A single word wider than the line is cut rather than overflowing.
        if (!line && textWidth(word, size, weight) > maxWidth) {
          let piece = '';
          for (const ch of word) {
            if (textWidth(piece + ch, size, weight) > maxWidth && piece) { out.push(piece); piece = ch; } else piece += ch;
          }
          line = piece;
        } else {
          line = next;
        }
      } else {
        out.push(line);
        line = word;
      }
    }
    out.push(line);
  }
  return out;
}

let fontCss: Promise<string> | null = null;

export function embeddedInter(): Promise<string> {
  fontCss ??= fetch('/fonts/inter-normal-400-900.woff2')
    .then((r) => r.arrayBuffer())
    .then((buffer) => {
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return `@font-face{font-family:'Inter';font-weight:400 900;src:url(data:font/woff2;base64,${btoa(binary)}) format('woff2');}`;
    })
    .catch(() => { fontCss = null; return ''; });
  return fontCss;
}

export async function svgToCanvas(svg: string, width: number, height: number): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), type, quality));

/**
 * Sheets → PDF. Each page is rendered at `scale` × its CSS pixel size (2 gives
 * about 192 dpi, sharp in print) and placed at `pointsPerPixel`.
 */
export async function sheetsToPdf(sheets: Sheet[], title: string, scale = 2.5, pointsPerPixel = 0.75): Promise<Blob> {
  const css = await embeddedInter();
  const pages: PdfPage[] = [];
  for (const sheet of sheets) {
    const pw = Math.round(sheet.width * scale);
    const ph = Math.round(sheet.height * scale);
    const canvas = await svgToCanvas(sheet.svg(css, pw), pw, ph);
    const jpeg = new Uint8Array(await (await toBlob(canvas, 'image/jpeg', 0.92)).arrayBuffer());
    const w = sheet.width * pointsPerPixel;
    const h = sheet.height * pointsPerPixel;
    pages.push({ width: w, height: h, images: [{ jpeg, width: pw, height: ph, x: 0, y: 0, w, h }] });
  }
  return new Blob([buildPdf(pages, title) as BlobPart], { type: 'application/pdf' });
}

export async function sheetToPng(sheet: Sheet, scale = 3): Promise<Blob> {
  const css = await embeddedInter();
  const pw = Math.round(sheet.width * scale);
  const ph = Math.round(sheet.height * scale);
  return toBlob(await svgToCanvas(sheet.svg(css, pw), pw, ph), 'image/png');
}
