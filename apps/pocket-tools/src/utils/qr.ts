/**
 * QR codes, made on this device with qrcode-generator (MIT), bundled with the
 * app rather than fetched. Text is encoded as UTF-8, so a code for "₹450 — café"
 * scans back exactly.
 */

import qrcode from 'qrcode-generator';

// The library's default keeps only the low byte of each character, which garbles
// anything beyond ASCII. Real UTF-8, as scanners expect.
const utf8 = new TextEncoder();
qrcode.stringToBytes = (s: string) => Array.from(utf8.encode(s));

export type Ecc = 'L' | 'M' | 'Q' | 'H';

export interface Qr { count: number; dark: (row: number, col: number) => boolean }

/** Null when the text is too long for a QR code at this error correction. */
export function makeQr(text: string, ecc: Ecc): Qr | null {
  try {
    const code = qrcode(0, ecc);
    code.addData(text, 'Byte');
    code.make();
    return { count: code.getModuleCount(), dark: (r, c) => code.isDark(r, c) };
  } catch {
    return null;
  }
}

/** A crisp PNG-ready canvas: whole pixels per module, quiet zone in modules. */
export function qrCanvas(qr: Qr, size: number, margin: number, fg = '#111111', bg = '#FFFFFF'): HTMLCanvasElement {
  const modules = qr.count + margin * 2;
  const cell = Math.max(1, Math.floor(size / modules));
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = cell * modules;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = fg;
  for (let r = 0; r < qr.count; r += 1) {
    for (let c = 0; c < qr.count; c += 1) {
      if (qr.dark(r, c)) ctx.fillRect((c + margin) * cell, (r + margin) * cell, cell, cell);
    }
  }
  return canvas;
}

/** One path, one module per unit: scales to any size without blur. */
export function qrSvg(qr: Qr, margin: number, fg = '#111111', bg = '#FFFFFF'): string {
  const n = qr.count + margin * 2;
  let d = '';
  for (let r = 0; r < qr.count; r += 1) {
    for (let c = 0; c < qr.count; c += 1) {
      if (qr.dark(r, c)) d += `M${c + margin} ${r + margin}h1v1h-1z`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="${bg}"/><path d="${d}" fill="${fg}"/></svg>`;
}
