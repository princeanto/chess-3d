'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Dot-matrix numerals.
 *
 * Rather than hand-drawing a bitmap font, the text is rendered once into an
 * offscreen canvas and the glyph coverage is sampled on a grid — a dot is
 * emitted wherever the letterform actually covers its cell. That means any
 * string works at any size, in the same typeface as the rest of the page, and
 * the shapes stay correct instead of approximating digits on a 5x7 grid.
 *
 * Sampling averages the alpha across each cell rather than reading its centre;
 * centre-sampling drops dots on thin diagonals and the numerals come out
 * visibly broken.
 */

interface Dot {
  x: number;
  y: number;
  r: number;
}

export default function DotText({
  text,
  height = 116,
  cell = 7,
  weight = 700,
  colour = 'var(--ink)',
  className,
}: {
  text: string;
  /** Cap height of the rendered text, in px. */
  height?: number;
  /** Grid pitch. Smaller means finer, denser dots. */
  cell?: number;
  weight?: number;
  colour?: string;
  className?: string;
}) {
  const [dots, setDots] = useState<Dot[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const frame = useRef<number | null>(null);

  const key = useMemo(() => `${text}|${height}|${cell}|${weight}`, [text, height, cell, weight]);

  useEffect(() => {
    // Fonts load asynchronously; sampling before they arrive measures the
    // fallback and the dots jump when the real face lands.
    let cancelled = false;

    const build = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      const family =
        getComputedStyle(document.documentElement).getPropertyValue('--font-ui').trim() ||
        'sans-serif';
      const font = `${weight} ${height}px ${family}`;

      ctx.font = font;
      const metrics = ctx.measureText(text);
      const ascent = metrics.actualBoundingBoxAscent || height * 0.72;
      const descent = metrics.actualBoundingBoxDescent || height * 0.2;
      const w = Math.ceil(metrics.width) + cell * 2;
      const h = Math.ceil(ascent + descent) + cell * 2;

      canvas.width = w;
      canvas.height = h;
      ctx.font = font;
      ctx.fillStyle = '#000';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(text, cell, ascent + cell);

      const { data } = ctx.getImageData(0, 0, w, h);
      const found: Dot[] = [];
      const step = cell;

      for (let y = 0; y + step <= h; y += step) {
        for (let x = 0; x + step <= w; x += step) {
          let sum = 0;
          for (let sy = 0; sy < step; sy += 1) {
            for (let sx = 0; sx < step; sx += 1) {
              sum += data[((y + sy) * w + (x + sx)) * 4 + 3];
            }
          }
          const coverage = sum / (step * step * 255);
          if (coverage < 0.22) continue;
          // Radius tracks coverage a little, so edges soften instead of
          // stair-stepping — the same trick a halftone screen uses.
          const r = step * 0.5 * (0.52 + Math.min(1, coverage) * 0.34);
          found.push({ x: x + step / 2, y: y + step / 2, r });
        }
      }

      if (cancelled) return;
      setSize({ w, h });
      setDots(found);
    };

    const start = () => {
      if (document.fonts?.status === 'loaded') build();
      else document.fonts?.ready.then(() => !cancelled && build()).catch(build);
    };

    frame.current = requestAnimationFrame(start);
    return () => {
      cancelled = true;
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [key, text, height, cell, weight]);

  if (dots.length === 0) {
    // Before sampling, show the real text so the value is never missing —
    // screen readers get it from the label below in either case.
    return (
      <span className={className} style={{ fontSize: height, fontWeight: weight, lineHeight: 1 }}>
        {text}
      </span>
    );
  }

  return (
    <svg
      className={className}
      width={size.w}
      height={size.h}
      viewBox={`0 0 ${size.w} ${size.h}`}
      role="img"
      aria-label={text}
      style={{ display: 'block', maxWidth: '100%' }}
    >
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={colour} />
      ))}
    </svg>
  );
}
