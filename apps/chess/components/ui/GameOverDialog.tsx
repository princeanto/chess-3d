'use client';

import { useEffect, useRef } from 'react';
import type { GameResult } from '@/lib/chess/game';
import { colorName } from '@/lib/chess/game';
import { WHITE, type Color } from '@/lib/chess/types';
import type { GameMode } from '@/lib/game/store';

export type Tone = 'win' | 'loss' | 'neutral';

interface Outcome {
  tone: Tone;
  mark: string;
  title: string;
  detail: string;
}

/**
 * Win and loss only mean something when one side is the player. In two-player
 * and engine-duel games nobody at the keyboard lost, so the result is announced
 * neutrally rather than congratulating or commiserating with a spectator.
 */
export function describeOutcome(
  result: GameResult,
  mode: GameMode,
  humanColor: Color,
): Outcome | null {
  if (!result.over) return null;

  if (result.reason === 'checkmate') {
    const winner = result.winner as Color;
    const title = `${colorName(winner)} wins`;

    // Win and loss only mean something when one side is the player. In
    // two-player and engine-duel games nobody at the keyboard lost, so the
    // result is announced neutrally rather than congratulating a spectator.
    if (mode !== 'vs-engine') {
      return { tone: 'neutral', mark: '♛', title, detail: 'Checkmate on the board.' };
    }
    return winner === humanColor
      ? {
          tone: 'win',
          mark: '✓',
          title,
          detail: `Checkmate — you mated the engine playing ${colorName(
            (winner ^ 1) as Color,
          ).toLowerCase()}.`,
        }
      : {
          tone: 'loss',
          mark: '✕',
          title,
          detail: `Checkmate — the engine mated you playing ${colorName(
            (winner ^ 1) as Color,
          ).toLowerCase()}.`,
        };
  }

  const drawDetail: Record<string, string> = {
    stalemate: 'The side to move has no legal move and is not in check.',
    'fifty-move': 'Fifty moves passed with no capture and no pawn move.',
    threefold: 'The same position occurred three times.',
    'insufficient-material': 'Neither side has enough material to force mate.',
  };

  return {
    tone: 'neutral',
    mark: '½',
    title: 'Draw',
    detail: `${result.reason.replace('-', ' ')} — ${drawDetail[result.reason] ?? ''}`,
  };
}

const TONES: Record<Tone, { accent: string; glow: string; ring: string }> = {
  win: {
    accent: 'var(--jade)',
    glow: 'rgba(127, 227, 176, 0.16)',
    ring: 'rgba(127, 227, 176, 0.45)',
  },
  loss: {
    accent: 'var(--crimson)',
    glow: 'rgba(255, 92, 77, 0.16)',
    ring: 'rgba(255, 92, 77, 0.45)',
  },
  neutral: {
    accent: 'var(--brass)',
    glow: 'rgba(212, 165, 49, 0.14)',
    ring: 'rgba(212, 165, 49, 0.4)',
  },
};

export default function GameOverDialog({
  outcome,
  lastMove,
  moveCount,
  canUndo,
  onNewGame,
  onUndo,
  onClose,
}: {
  outcome: Outcome;
  lastMove: string | null;
  moveCount: number;
  canUndo: boolean;
  onNewGame: () => void;
  onUndo: () => void;
  onClose: () => void;
}) {
  const primary = useRef<HTMLButtonElement>(null);
  const tone = TONES[outcome.tone];

  // Deliberately no backdrop click and no Escape handler: the game is over, and
  // the result stays up until it is acknowledged with one of the buttons.
  useEffect(() => {
    primary.current?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key === 'Escape') e.stopPropagation();
    };
    window.addEventListener('keydown', trap, true);
    return () => window.removeEventListener('keydown', trap, true);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="result-title"
    >
      <div
        className="pop panel relative w-[min(94vw,420px)] overflow-hidden p-6 text-center"
        style={{ borderColor: tone.ring, boxShadow: `0 0 60px -12px ${tone.glow}` }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${tone.accent}, transparent)` }}
        />

        <span
          aria-hidden
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border text-[26px] leading-none"
          style={{ borderColor: tone.ring, color: tone.accent, background: tone.glow }}
        >
          {outcome.mark}
        </span>

        <h2 id="result-title" className="serif mt-4 text-[24px] leading-tight">
          {outcome.title}
        </h2>
        <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--muted)]">{outcome.detail}</p>

        <dl className="mono mt-4 flex items-center justify-center gap-5 border-y border-[var(--line-soft)] py-2.5 text-[11px]">
          {lastMove && (
            <div>
              <dt className="label !text-[8px]">final move</dt>
              <dd className="mt-0.5" style={{ color: tone.accent }}>
                {lastMove}
              </dd>
            </div>
          )}
          {moveCount > 0 && (
            <div>
              <dt className="label !text-[8px]">length</dt>
              <dd className="mt-0.5 text-[var(--text)]">{Math.ceil(moveCount / 2)} moves</dd>
            </div>
          )}
          {moveCount === 0 && !lastMove && (
            <div>
              <dt className="label !text-[8px]">position</dt>
              <dd className="mt-0.5 text-[var(--text)]">loaded</dd>
            </div>
          )}
        </dl>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button ref={primary} className="btn btn-primary" onClick={onNewGame}>
            New game
          </button>
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
        {canUndo && (
          <button
            className="mt-2 w-full py-1 text-[11px] text-[var(--faint)] transition-colors hover:text-[var(--text)]"
            onClick={onUndo}
          >
            Take back the last move and keep playing
          </button>
        )}
      </div>
    </div>
  );
}

export { WHITE };
