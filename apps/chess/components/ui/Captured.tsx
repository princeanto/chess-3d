'use client';

import { useMemo } from 'react';
import { PIECE_VALUE } from '@/lib/chess/evaluate';
import {
  BISHOP,
  BLACK,
  KNIGHT,
  PAWN,
  QUEEN,
  ROOK,
  WHITE,
  pieceColor,
  pieceType,
  type Color,
  type Position,
} from '@/lib/chess/types';

const START_COUNT: Record<number, number> = {
  [PAWN]: 8,
  [KNIGHT]: 2,
  [BISHOP]: 2,
  [ROOK]: 2,
  [QUEEN]: 1,
};

const GLYPH: Record<number, [string, string]> = {
  [PAWN]: ['♙', '♟'],
  [KNIGHT]: ['♘', '♞'],
  [BISHOP]: ['♗', '♝'],
  [ROOK]: ['♖', '♜'],
  [QUEEN]: ['♕', '♛'],
};

const ORDER = [QUEEN, ROOK, BISHOP, KNIGHT, PAWN];

/**
 * Captured material is derived from what is missing rather than tracked as a
 * list, so it stays correct after undo, board browsing, or loading a FEN.
 */
export default function Captured({ position }: { position: Position }) {
  const { lost, balance } = useMemo(() => {
    const alive: Record<number, [number, number]> = {
      [PAWN]: [0, 0],
      [KNIGHT]: [0, 0],
      [BISHOP]: [0, 0],
      [ROOK]: [0, 0],
      [QUEEN]: [0, 0],
    };

    for (let sq = 0; sq < 128; sq += 1) {
      if (sq & 0x88) {
        sq += 7;
        continue;
      }
      const p = position.board[sq];
      if (!p) continue;
      const t = pieceType(p);
      if (alive[t]) alive[t][pieceColor(p)] += 1;
    }

    const lost: Record<Color, Array<{ type: number; count: number }>> = {
      [WHITE]: [],
      [BLACK]: [],
    };
    let score = 0;

    for (const t of ORDER) {
      for (const c of [WHITE, BLACK] as Color[]) {
        // Promotions can put more queens on the board than started there.
        const missing = Math.max(0, START_COUNT[t] - alive[t][c]);
        if (missing > 0) lost[c].push({ type: t, count: missing });
        score += (c === WHITE ? -1 : 1) * missing * PIECE_VALUE[t];
      }
    }

    return { lost, balance: Math.round(score / 100) };
  }, [position]);

  return (
    <div className="grid gap-2 px-3 py-2.5">
      <Row label="White captured" items={lost[BLACK]} color={BLACK} lead={balance} />
      <Row label="Black captured" items={lost[WHITE]} color={WHITE} lead={-balance} />
    </div>
  );
}

function Row({
  label,
  items,
  color,
  lead,
}: {
  label: string;
  items: Array<{ type: number; count: number }>;
  color: Color;
  lead: number;
}) {
  return (
    <div className="flex min-h-[26px] items-center gap-2">
      <span className="label w-[104px] shrink-0">{label}</span>
      <span
        className="flex flex-wrap items-center gap-x-0.5 text-[19px] leading-none"
        style={{ color: color === WHITE ? '#d8d2c4' : '#7d838f' }}
      >
        {items.length === 0 ? (
          <span className="text-[11px] text-[var(--faint)]">—</span>
        ) : (
          items.map(({ type, count }) =>
            Array.from({ length: count }, (_, i) => (
              <span key={`${type}-${i}`}>{GLYPH[type][color]}</span>
            )),
          )
        )}
      </span>
      {lead > 0 && (
        <span className="mono ml-auto text-[11px] text-[var(--brass)]">+{lead}</span>
      )}
    </div>
  );
}
