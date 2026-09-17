/**
 * SVG to PNG, on this device.
 *
 * The SVG is drawn as an image into a canvas and read back out. It must be
 * declared at the size it is being drawn — browsers rasterise an SVG image at
 * its own size before scaling — and any font it uses must be inside it, because
 * an SVG loaded as an image cannot see the page's fonts.
 */

import { canvasToBlob, makeCanvas } from './export';

export async function svgToPng(svg: string, width: number, height: number): Promise<Blob | null> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    await image.decode();
    const made = makeCanvas(width, height);
    if (!made) return null;
    made.ctx.drawImage(image, 0, 0, width, height);
    return await canvasToBlob(made.canvas);
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
