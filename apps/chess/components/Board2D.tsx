'use client';

import { useMemo } from 'react';
import { fileOf, pieceColor, pieceType, rankOf, type Position } from '@/lib/chess/types';
import Piece2D from './pieces2d';

const LIGHT = '#E4D3B2';
const DARK = '#67432D';
const FILES = 'abcdefgh';

interface Props {
  position: Position;
  flipped: boolean;
  selected: number | null;
  targets: Array<{ square: number; capture: boolean }>;
  lastMove: { from: number; to: number } | null;
  checkSquare: number | null;
  showLegal: boolean;
  onSquareClick: (square: number) => void;
}

export default function Board2D({
  position,
  flipped,
  selected,
  targets,
  lastMove,
  checkSquare,
  showLegal,
  onSquareClick,
}: Props) {
  const targetMap = useMemo(() => {
    const m = new Map<number, boolean>();
    for (const t of targets) m.set(t.square, t.capture);
    return m;
  }, [targets]);

  // Rank 8 first when White is at the bottom; reversed when the board is turned.
  const rows = useMemo(() => {
    const order = [7, 6, 5, 4, 3, 2, 1, 0];
    const ranks = flipped ? [...order].reverse() : order;
    const files = flipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
    return ranks.map((rank) => files.map((file) => (rank << 4) | file));
  }, [flipped]);

  return (
    <div className="flex h-full w-full items-center justify-center p-3">
      <div
        className="grid aspect-square w-full max-w-[min(92vw,calc(100dvh-7rem))] select-none overflow-hidden rounded-[3px] shadow-[0_24px_70px_-30px_rgba(0,0,0,0.9)] ring-1 ring-[rgba(212,165,49,0.35)]"
        role="grid"
        aria-label="Chess board"
        style={{
          containerType: 'inline-size',
          gridTemplateColumns: 'repeat(8, 1fr)',
          gridTemplateRows: 'repeat(8, 1fr)',
        }}
      >
        {rows.flat().map((sq) => {
          const piece = position.board[sq];
          const file = fileOf(sq);
          const rank = rankOf(sq);
          const light = (file + rank) % 2 === 1;
          const isTarget = showLegal && targetMap.has(sq);
          const isCapture = targetMap.get(sq) === true;
          const isLast = lastMove && (lastMove.from === sq || lastMove.to === sq);
          const isSelected = selected === sq;
          const inCheck = checkSquare === sq;

          // Coordinates ride in the corners of the edge squares, as on a diagram.
          const showFile = flipped ? rank === 7 : rank === 0;
          const showRank = flipped ? file === 7 : file === 0;

          return (
            <button
              key={sq}
              role="gridcell"
              onClick={() => onSquareClick(sq)}
              aria-label={`${FILES[file]}${rank + 1}${piece ? ', occupied' : ''}`}
              className="relative flex min-w-0 items-center justify-center overflow-hidden transition-colors"
              style={{ background: light ? LIGHT : DARK }}
            >
              {isLast && (
                <span
                  aria-hidden
                  className="absolute inset-0"
                  style={{ background: 'rgba(212, 165, 49, 0.32)' }}
                />
              )}
              {inCheck && (
                <span
                  aria-hidden
                  className="absolute inset-0"
                  style={{
                    background:
                      'radial-gradient(circle at 50% 50%, rgba(255,60,45,0.85), rgba(255,60,45,0) 72%)',
                  }}
                />
              )}
              {isSelected && (
                <span
                  aria-hidden
                  className="absolute inset-0 border-[3px]"
                  style={{ borderColor: 'var(--jade)' }}
                />
              )}

              {piece !== 0 && (
                <Piece2D type={pieceType(piece)} color={pieceColor(piece)} />
              )}

              {isTarget && !isCapture && (
                <span
                  aria-hidden
                  className="absolute z-20 rounded-full"
                  style={{
                    width: '28%',
                    height: '28%',
                    background: 'rgba(127, 227, 176, 0.62)',
                  }}
                />
              )}
              {isTarget && isCapture && (
                <span
                  aria-hidden
                  className="absolute inset-[6%] z-20 rounded-full border-[5px]"
                  style={{ borderColor: 'rgba(255, 122, 92, 0.85)' }}
                />
              )}

              {showFile && (
                <span
                  aria-hidden
                  className="mono absolute bottom-[2px] right-[3px] leading-none"
                  style={{
                    color: light ? DARK : LIGHT,
                    opacity: 0.85,
                    fontSize: 'min(2.1cqw, 11px)',
                  }}
                >
                  {FILES[file]}
                </span>
              )}
              {showRank && (
                <span
                  aria-hidden
                  className="mono absolute left-[3px] top-[2px] leading-none"
                  style={{
                    color: light ? DARK : LIGHT,
                    opacity: 0.85,
                    fontSize: 'min(2.1cqw, 11px)',
                  }}
                >
                  {rank + 1}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
