/**
 * Real text widths, from the browser.
 *
 * An off-screen SVG <text> measures with the same engine that draws the poster,
 * including letter spacing and the width axis, which a canvas cannot set in
 * percentages. Results are cached per line and font, at size 100, and the cache
 * is dropped whenever a font finishes loading.
 */

import type { Measure, MeasureFont } from '@/lib/poster';

export function createMeasure(): Measure & { reset: () => void } {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('width', '10');
  svg.setAttribute('height', '10');
  svg.style.cssText = 'position:fixed;left:-99999px;top:0;visibility:hidden;pointer-events:none';
  const node = document.createElementNS(ns, 'text');
  node.setAttribute('font-size', '100');
  node.setAttribute('xml:space', 'preserve');
  svg.appendChild(node);
  document.body.appendChild(svg);
  const cache = new Map<string, number>();

  const measure = ((text: string, font: MeasureFont) => {
    const key = `${font.family}|${font.weight}|${font.stretch ?? ''}|${font.italic}|${font.tracking}|${text}`;
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    node.setAttribute('font-family', font.family);
    node.setAttribute('font-weight', String(font.weight));
    node.setAttribute('font-style', font.italic ? 'italic' : 'normal');
    node.setAttribute('letter-spacing', String(font.tracking * 100));
    node.style.fontStretch = font.stretch ? `${font.stretch}%` : '';
    node.textContent = text;
    const width = node.getComputedTextLength();
    cache.set(key, width);
    return width;
  }) as Measure & { reset: () => void };
  measure.reset = () => cache.clear();
  return measure;
}
