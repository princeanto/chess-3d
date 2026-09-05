'use client';

import { useMemo } from 'react';
import type { Swatch } from '@/lib/palette';

/**
 * The dot field from the reference, doing actual work.
 *
 * Each column is one colour from the loaded palette, and the dots fade down the
 * column. It reads as a spectrum of the system at a glance — and because the
 * chrome around it is entirely black, white and grey, it is the only colour on
 * the page besides the grid itself.
 */
export default function PaletteDots({
  swatches,
  rows = 7,
  cell = 11,
  dot = 3.1,
}: {
  swatches: Swatch[];
  rows?: number;
  cell?: number;
  dot?: number;
}) {
  const columns = useMemo(() => {
    if (swatches.length === 0) return [];
    // Spread the palette across a fixed width so a four-colour system and a
    // sixteen-colour one both fill the field instead of leaving it ragged.
    const target = Math.max(28, swatches.length * 4);
    return Array.from({ length: target }, (_, i) => {
      const t = i / Math.max(1, target - 1);
      return swatches[Math.min(swatches.length - 1, Math.floor(t * swatches.length))];
    });
  }, [swatches]);

  if (columns.length === 0) return null;

  const width = columns.length * cell;
  const height = rows * cell;

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden
      style={{ display: 'block', maxHeight: height }}
    >
      {columns.map((s, c) =>
        Array.from({ length: rows }, (_, r) => (
          <circle
            key={`${c}-${r}`}
            cx={c * cell + cell / 2}
            cy={r * cell + cell / 2}
            r={dot}
            fill={s.hex}
            opacity={1 - (r / rows) * 0.82}
          />
        )),
      )}
    </svg>
  );
}
