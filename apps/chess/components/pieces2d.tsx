'use client';

import { BISHOP, KING, KNIGHT, PAWN, QUEEN, ROOK, WHITE, type Color } from '@/lib/chess/types';

/**
 * Flat piece artwork.
 *
 * Unicode chess glyphs were the first attempt and were a mistake: the outline
 * codepoints render inconsistently across platforms, and faking an outline on
 * the filled ones with `-webkit-text-stroke` lets the stroke swallow the fill at
 * board size, so white pieces read as black on some squares. These are plain
 * paths in a shared 45-unit box — stroke widths scale with the square, and the
 * two colours are separated by fill and stroke rather than by font rendering.
 *
 * The three tall pieces are deliberately given different tops, because that is
 * the only part a player reads at a glance: the bishop a pointed mitre with a
 * bud, the queen a spiked coronet with beads, the king a flat band and a cross.
 */

const BOX = 45;

interface PieceArt {
  paths: string[];
  /** [cx, cy, r] — filled the same as the body. */
  dots?: Array<[number, number, number]>;
  /** Stroke-only detail, e.g. the bishop's cut. */
  lines?: string[];
  /** Stroke-coloured accent, e.g. the knight's eye. */
  accents?: Array<[number, number, number]>;
}

const ART: Record<number, PieceArt> = {
  [PAWN]: {
    paths: [
      'M22.5 9.4a5.4 5.4 0 0 1 3.1 9.8c2.6 1.5 4.4 4.2 4.4 7.4 0 2.5-1.1 4.5-2.5 6h-10c-1.4-1.5-2.5-3.5-2.5-6 0-3.2 1.8-5.9 4.4-7.4a5.4 5.4 0 0 1 3.1-9.8z',
      'M13.4 33h18.2c1.6 1.6 2.6 3.4 3 5.4H10.4c.4-2 1.4-3.8 3-5.4z',
    ],
  },
  [ROOK]: {
    paths: [
      'M11 10.5h4.6v3.1h4V10.5h5.8v3.1h4V10.5H34v6.6l-3 2.6v9.6l3 2.6v2.9H11v-2.9l3-2.6v-9.6l-3-2.6z',
      'M9.8 35.2h25.4c.8 1 1.4 2 1.8 3H8c.4-1 1-2 1.8-3z',
    ],
  },
  [BISHOP]: {
    paths: [
      'M22.5 9.4c3.5 2.5 6 6.2 6 9.9 0 3-2 5.5-4.3 7h-3.4c-2.3-1.5-4.3-4-4.3-7 0-3.7 2.5-7.4 6-9.9z',
      'M18.3 27.1h8.4c1.5 1.1 2.5 2.4 3 3.8H15.3c.5-1.4 1.5-2.7 3-3.8z',
      'M10.4 34.6h24.2c.9 1.1 1.5 2.2 1.9 3.4H8.5c.4-1.2 1-2.3 1.9-3.4z',
    ],
    dots: [[22.5, 6.2, 2.4]],
    lines: ['M22.5 12.2v6.6'],
  },
  [QUEEN]: {
    paths: [
      'M8.8 13.2l2.9 12.2h21.6l2.9-12.2-5.6 6-3-8.8-5.1 8-5.1-8-3 8.8z',
      'M11.5 27.2h22c.9 2.4.6 4.7-.7 6.6H12.2c-1.3-1.9-1.6-4.2-.7-6.6z',
      'M10.4 34.9h24.2c.9 1.1 1.5 2.2 1.9 3.4H8.5c.4-1.2 1-2.3 1.9-3.4z',
    ],
    dots: [
      [8.8, 11.4, 2.1],
      [14.6, 8.6, 2.1],
      [22.5, 7.4, 2.3],
      [30.4, 8.6, 2.1],
      [36.2, 11.4, 2.1],
    ],
  },
  [KING]: {
    paths: [
      'M20.8 2.6h3.4v3.8h3.8v3.4h-3.8v4.4h-3.4V9.8H17V6.4h3.8z',
      'M13 15.2h19c.9 0 1.6.8 1.4 1.7l-1.1 6.6H12.7l-1.1-6.6c-.2-.9.5-1.7 1.4-1.7z',
      'M12.4 24.4h20.2c1.1 2.7.8 5.4-.9 7.7H13.3c-1.7-2.3-2-5-.9-7.7z',
      'M10.4 34.9h24.2c.9 1.1 1.5 2.2 1.9 3.4H8.5c.4-1.2 1-2.3 1.9-3.4z',
    ],
  },
  [KNIGHT]: {
    // Same silhouette family as the 3D carving: arched neck, stepped mane, two
    // ears, long muzzle.
    paths: [
      'M23.8 5.2l1.1 3.3 2.4-2.1.3 3.6c3.7 1.9 6.3 5.4 6.9 9.6.6 4.2-.6 8-1.6 11.2-.5 1.7-.8 3.3-.8 4.7H14.6c0-3.9.9-7.4 2.6-10.4l-2.7 2.6c-1 1-2.6.7-3-.7-.8-2.8.2-5.8 2-8.2 1.6-2.2 3.7-3.8 5.7-4.9l.6-3.8 2.2 1.9z',
      'M10.4 35h24.2c.8 1 1.4 2 1.8 3.2H8.6c.4-1.2 1-2.2 1.8-3.2z',
    ],
    accents: [[20.6, 16.4, 1.15]],
  },
};

export default function Piece2D({ type, color }: { type: number; color: Color }) {
  const white = color === WHITE;
  const fill = white ? '#F3EAD7' : '#22262C';
  const stroke = white ? '#22190F' : '#C6BBA6';
  const art = ART[type];

  return (
    <svg
      viewBox={`0 0 ${BOX} ${BOX}`}
      className="pointer-events-none relative z-10 h-[88%] w-[88%]"
      aria-hidden
      style={{ filter: 'drop-shadow(0 1px 1.5px rgba(0,0,0,0.45))' }}
    >
      <g fill={fill} stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round">
        {art.paths.map((d, i) => (
          <path key={`p${i}`} d={d} />
        ))}
        {art.dots?.map(([cx, cy, r], i) => (
          <circle key={`d${i}`} cx={cx} cy={cy} r={r} />
        ))}
        {art.lines?.map((d, i) => (
          <path key={`l${i}`} d={d} fill="none" strokeWidth={1.6} />
        ))}
        {art.accents?.map(([cx, cy, r], i) => (
          <circle key={`a${i}`} cx={cx} cy={cy} r={r} fill={stroke} stroke="none" />
        ))}
      </g>
    </svg>
  );
}
