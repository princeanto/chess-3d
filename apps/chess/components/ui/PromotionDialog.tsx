'use client';

import { BISHOP, KNIGHT, QUEEN, ROOK, WHITE, type Color } from '@/lib/chess/types';

const GLYPHS: Record<number, { white: string; black: string; name: string }> = {
  [QUEEN]: { white: '♕', black: '♛', name: 'Queen' },
  [ROOK]: { white: '♖', black: '♜', name: 'Rook' },
  [BISHOP]: { white: '♗', black: '♝', name: 'Bishop' },
  [KNIGHT]: { white: '♘', black: '♞', name: 'Knight' },
};

const ORDER = [QUEEN, ROOK, BISHOP, KNIGHT];

export default function PromotionDialog({
  color,
  onChoose,
  onCancel,
}: {
  color: Color;
  onChoose: (pieceType: number) => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Choose promotion piece"
      onClick={onCancel}
    >
      <div
        className="panel rise w-[min(92vw,380px)] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="serif text-[19px] leading-tight">Promote the pawn</h2>
        <p className="mt-1 text-[12px] text-[var(--muted)]">
          It reached the last rank — choose what it becomes.
        </p>
        <div className="mt-4 grid grid-cols-4 gap-2">
          {ORDER.map((type) => (
            <button
              key={type}
              onClick={() => onChoose(type)}
              className="btn flex-col !h-auto !min-h-0 py-3"
              autoFocus={type === QUEEN}
            >
              <span
                className="text-[34px] leading-none"
                style={{ color: color === WHITE ? '#EBDFC6' : '#c8ccd6' }}
              >
                {color === WHITE ? GLYPHS[type].white : GLYPHS[type].black}
              </span>
              <span className="label !text-[9px] mt-1.5">{GLYPHS[type].name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
