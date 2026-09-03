'use client';

import { useEffect, useRef } from 'react';
import { colorName } from '@/lib/chess/game';
import { BLACK, WHITE, type Color } from '@/lib/chess/types';
import { LEVELS, LEVEL_ORDER, type Level } from '@/lib/game/difficulty';
import type { GameMode } from '@/lib/game/store';

interface Props {
  mode: GameMode;
  humanColor: Color;
  level: Level;
  showLegalMoves: boolean;
  animate: boolean;
  /** Only offered once there is a game to go back to. */
  canCancel: boolean;
  viewMode: '3d' | '2d';
  onViewMode: (mode: '3d' | '2d') => void;
  onMode: (mode: GameMode) => void;
  onHumanColor: (color: Color) => void;
  onLevel: (level: Level) => void;
  onToggle: (key: 'showLegalMoves' | 'animate') => void;
  onStart: () => void;
  onCancel: () => void;
}

const MODES: Array<{ value: GameMode; label: string; hint: string }> = [
  { value: 'vs-engine', label: 'Play the engine', hint: 'You against the computer' },
  { value: 'two-player', label: 'Two players', hint: 'Both sides on this board' },
  { value: 'engine-vs-engine', label: 'Engine duel', hint: 'Watch it play itself' },
];

export default function SetupDialog({
  mode,
  humanColor,
  level,
  showLegalMoves,
  animate,
  canCancel,
  onMode,
  onHumanColor,
  onLevel,
  onToggle,
  viewMode,
  onViewMode,
  onStart,
  onCancel,
}: Props) {
  const start = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    start.current?.focus();
  }, []);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="setup-title"
    >
      <div className="pop panel w-[min(94vw,440px)] max-h-[92dvh] overflow-y-auto p-6">
        <header className="text-center">
          <h2 id="setup-title" className="serif text-[27px] leading-none">
            Gambit
          </h2>
          <p className="label mt-2">Set up the game</p>
        </header>

        <section className="mt-5">
          <span className="label">Opponent</span>
          <div className="mt-2 grid gap-1">
            {MODES.map((m) => (
              <button
                key={m.value}
                aria-pressed={mode === m.value}
                onClick={() => onMode(m.value)}
                className={`flex min-h-[46px] items-center gap-3 rounded-[3px] border px-3 text-left transition-colors ${
                  mode === m.value
                    ? 'border-[#b78c22] bg-[rgba(212,165,49,0.1)]'
                    : 'border-[var(--line)] hover:bg-[var(--raised)]'
                }`}
              >
                <span
                  aria-hidden
                  className={`h-2 w-2 rounded-full ${
                    mode === m.value ? 'bg-[var(--brass)]' : 'bg-[var(--line-soft)]'
                  }`}
                />
                <span className="flex-1">
                  <span className="block text-[13px] text-[var(--text)]">{m.label}</span>
                  <span className="block text-[10.5px] text-[var(--faint)]">{m.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        {mode === 'vs-engine' && (
          <section className="mt-4">
            <span className="label">Play as</span>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {([WHITE, BLACK] as Color[]).map((c) => (
                <button
                  key={c}
                  aria-pressed={humanColor === c}
                  onClick={() => onHumanColor(c)}
                  className={`flex min-h-[76px] flex-col items-center justify-center gap-1 rounded-[3px] border transition-colors ${
                    humanColor === c
                      ? 'border-[#b78c22] bg-[rgba(212,165,49,0.1)]'
                      : 'border-[var(--line)] hover:bg-[var(--raised)]'
                  }`}
                >
                  <span
                    className="text-[32px] leading-none"
                    style={{ color: c === WHITE ? '#EBDFC6' : '#9aa1ad' }}
                  >
                    {c === WHITE ? '♔' : '♚'}
                  </span>
                  <span className="text-[11.5px] text-[var(--text)]">{colorName(c)}</span>
                  <span className="label !text-[8px]">
                    {c === WHITE ? 'you move first' : 'engine opens'}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {mode !== 'two-player' && (
          <section className="mt-4">
            <div className="flex items-baseline">
              <span className="label">Engine strength</span>
              <span className="mono ml-auto text-[10px] text-[var(--brass)]">
                {LEVELS[level].elo}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-5 gap-1">
              {LEVEL_ORDER.map((id) => (
                <button
                  key={id}
                  aria-pressed={level === id}
                  onClick={() => onLevel(id)}
                  className={`min-h-[36px] rounded-[3px] border text-[10px] transition-colors ${
                    level === id
                      ? 'border-[#b78c22] bg-[var(--brass)] font-semibold text-[#17140b]'
                      : 'border-[var(--line)] text-[var(--muted)] hover:bg-[var(--raised)] hover:text-[var(--text)]'
                  }`}
                >
                  {LEVELS[id].name}
                </button>
              ))}
            </div>
            <p className="mt-2 min-h-[30px] text-[11px] leading-relaxed text-[var(--faint)]">
              {LEVELS[level].blurb}
            </p>
          </section>
        )}

        <section className="mt-3 border-t border-[var(--line-soft)] pt-3">
          <span className="label">Board</span>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(
              [
                ['3d', '3D set', 'Turned pieces, orbit the board'],
                ['2d', '2D board', 'Flat diagram, easier to read'],
              ] as Array<['3d' | '2d', string, string]>
            ).map(([value, label, hint]) => (
              <button
                key={value}
                aria-pressed={viewMode === value}
                onClick={() => onViewMode(value)}
                className={`flex min-h-[58px] flex-col items-start justify-center gap-0.5 rounded-[3px] border px-3 text-left transition-colors ${
                  viewMode === value
                    ? 'border-[#b78c22] bg-[rgba(212,165,49,0.1)]'
                    : 'border-[var(--line)] hover:bg-[var(--raised)]'
                }`}
              >
                <span className="text-[12px] text-[var(--text)]">{label}</span>
                <span className="text-[10px] leading-tight text-[var(--faint)]">{hint}</span>
              </button>
            ))}
          </div>
          <div className="mt-2 grid gap-1.5">
            <Option
              label="Show legal move hints"
              hint="Dots for quiet moves, rings for captures"
              checked={showLegalMoves}
              onChange={() => onToggle('showLegalMoves')}
            />
            <Option
              label="Animate moves"
              hint="Pieces travel to their square"
              checked={animate}
              onChange={() => onToggle('animate')}
            />
          </div>
        </section>

        <div className="mt-5 grid gap-2">
          <button ref={start} className="btn btn-primary !min-h-[46px]" onClick={onStart}>
            Start game
          </button>
          {canCancel && (
            <button className="btn" onClick={onCancel}>
              Back to the current game
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Option({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-[3px] border border-[var(--line)] px-3 py-2 transition-colors hover:bg-[var(--raised)]">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-3.5 w-3.5 accent-[var(--brass)]"
      />
      <span>
        <span className="block text-[12px] text-[var(--text)]">{label}</span>
        <span className="block text-[10px] text-[var(--faint)]">{hint}</span>
      </span>
    </label>
  );
}
