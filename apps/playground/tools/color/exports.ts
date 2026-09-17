/**
 * What COLOR hands you: images, vectors, and code you can paste.
 */

import { canvasToBlob, downloadBlob, escapeXml, fileName, fontsReady, makeCanvas } from '@/lib/export';
import { readableOn, type Scheme } from '@/lib/color';
import { paintGradient, toCss, type Gradient } from '@/lib/gradient';

const W = 2000;
const H = 1125;

/** A palette as a picture you would actually put in a deck: big fields, HEX on each. */
export async function paletteToPng(hexes: readonly string[], seed: number): Promise<boolean> {
  await fontsReady(['700 34px Inter']);
  const made = makeCanvas(W, H);
  if (!made) return false;
  const { canvas, ctx } = made;
  const column = W / hexes.length;
  hexes.forEach((hex, i) => {
    const x = Math.floor(i * column);
    ctx.fillStyle = hex;
    ctx.fillRect(x, 0, Math.ceil(column) + 1, H);
    ctx.fillStyle = readableOn(hex);
    ctx.font = '700 34px Inter, ui-sans-serif, sans-serif';
    ctx.fillText(hex, x + 44, H - 60);
  });
  const blob = await canvasToBlob(canvas);
  return blob ? downloadBlob(blob, fileName('color', 'palette', seed, 'png')) : false;
}

/*
 * HEX labels in the SVG use a system monospace stack rather than Inter. An SVG
 * opened on someone else's machine only has the fonts that machine has, and a
 * palette's labels should look right everywhere without embedding a font.
 */
export function paletteSvg(hexes: readonly string[]): string {
  const column = W / hexes.length;
  const body = hexes
    .map((hex, i) => {
      const x = i * column;
      return `<rect x="${x}" y="0" width="${column + 1}" height="${H}" fill="${hex}"/>` +
        `<text x="${x + 44}" y="${H - 60}" fill="${readableOn(hex)}" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="34" font-weight="700">${escapeXml(hex)}</text>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`;
}

export function paletteCss(hexes: readonly string[]): string {
  return `:root {\n${hexes.map((hex, i) => `  --color-${i + 1}: ${hex};`).join('\n')}\n}\n`;
}

export function paletteJson(hexes: readonly string[], seed: number, scheme: Scheme): string {
  return JSON.stringify({ tool: 'playground/color', kind: 'palette', seed, scheme, colors: hexes }, null, 2);
}

export async function gradientToPng(g: Gradient, seed: number): Promise<boolean> {
  const w = 1920;
  const h = 1080;
  const made = makeCanvas(w, h);
  if (!made) return false;
  paintGradient(made.ctx, g, w, h);
  const blob = await canvasToBlob(made.canvas);
  return blob ? downloadBlob(blob, fileName('color', 'gradient', seed, 'png')) : false;
}

export function gradientCss(g: Gradient): string {
  return `.gradient {\n  background: ${toCss(g)};\n}\n`;
}
