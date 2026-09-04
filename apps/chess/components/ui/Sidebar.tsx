'use client';

import { useState } from 'react';
import { toFen } from '@/lib/chess/fen';
import { colorName, resultText } from '@/lib/chess/game';
import { BLACK, WHITE, type Color, type Position } from '@/lib/chess/types';
import { LEVELS, LEVEL_ORDER, type Level } from '@/lib/game/difficulty';
import type { EngineInfo, GameMode, PlayedMove } from '@/lib/game/store';
import type { GameResult } from '@/lib/chess/game';
import Captured from './Captured';
import MoveList from './MoveList';

interface Props {
  position: Position;
  result: GameResult;
  moves: PlayedMove[];
  cursor: number;
  historyLength: number;
  mode: GameMode;
  humanColor: Color;
  level: Level;
  thinking: boolean;
  engineInfo: EngineInfo | null;
  engineError: string | null;
  showLegalMoves: boolean;
  animate: boolean;
  onNewGame: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onFlip: () => void;
  onGoTo: (ply: number) => void;
  onMode: (mode: GameMode) => void;
  onHumanColor: (color: Color) => void;
  onLevel: (level: Level) => void;
  onToggle: (key: 'showLegalMoves' | 'animate') => void;
  onLoadFen: (fen: string) => string | null;
  viewMode: '3d' | '2d';
  onViewMode: (mode: '3d' | '2d') => void;
  /** Present only when the panel is a drawer, i.e. on small screens. */
  onClose?: () => void;
}

export default function Sidebar(props: Props) {
  const { position, result, thinking, engineInfo } = props;
  const live = props.cursor === props.historyLength - 1;

  return (
    <aside className="flex min-h-0 w-full flex-col gap-3 lg:h-full lg:w-[352px]">
      <header className="flex items-baseline gap-3 px-1">
        <h1 className="serif text-[26px] font-semibold leading-none tracking-tight">
          Gambit
        </h1>
        <span className="label">3D Chess</span>
        {props.onClose && (
          <button
            onClick={props.onClose}
            aria-label="Close menu"
            className="ml-auto -my-2 flex h-9 w-9 items-center justify-center rounded-[3px] border border-[var(--line)] text-[var(--muted)] transition-colors hover:bg-[var(--raised)] hover:text-[var(--text)] lg:hidden"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
              <path
                d="M1 1l12 12M13 1L1 13"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </header>

      <section className="panel rise px-3 py-3">
        <div className="flex items-center gap-3">
          <span
            className="h-7 w-7 shrink-0 rounded-full border"
            style={{
              background: position.turn === WHITE ? '#EBDFC6' : '#23262B',
              borderColor: position.turn === WHITE ? '#c8bda3' : '#3a3f4a',
              boxShadow: thinking ? '0 0 0 3px rgba(212,165,49,0.25)' : 'none',
            }}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="serif text-[17px] leading-tight">
              {result.over
                ? resultText(result)
                : `${colorName(position.turn)} to move${result.check ? ' — check' : ''}`}
            </p>
            <p className="label mt-0.5 !text-[9px]">
              {!live
                ? `Reviewing move ${props.cursor} of ${props.historyLength - 1}`
                : thinking
                  ? 'Engine thinking'
                  : `Move ${position.fullmove}`}
            </p>
          </div>
          {thinking && (
            <span className="thinking-dot h-2 w-2 rounded-full bg-[var(--brass)]" aria-hidden />
          )}
        </div>

        {engineInfo && (
          <dl className="mono mt-3 grid grid-cols-4 gap-px border-t border-[var(--line-soft)] pt-2.5 text-[10px]">
            <Stat label="depth" value={String(engineInfo.depth)} />
            <Stat
              label="eval"
              value={
                engineInfo.mateIn !== null
                  ? `#${Math.abs(engineInfo.mateIn)}`
                  : formatScore(engineInfo.score, position.turn)
              }
            />
            <Stat label="nodes" value={compact(engineInfo.nodes)} />
            <Stat label="time" value={`${(engineInfo.timeMs / 1000).toFixed(1)}s`} />
            {engineInfo.pv.length > 0 && (
              <dd className="col-span-4 mt-1.5 truncate text-[10px] text-[var(--faint)]">
                {engineInfo.pv.slice(0, 8).join(' ')}
              </dd>
            )}
          </dl>
        )}

        {props.engineError && (
          <p className="mt-2 border border-[var(--crimson)]/40 bg-[var(--crimson)]/10 px-2 py-1.5 text-[11px] text-[var(--crimson)]">
            {props.engineError}
          </p>
        )}
      </section>

      <div className="flex items-center gap-2">
        <span className="label shrink-0">View</span>
        <div className="seg flex-1">
          {(
            [
              ['3d', '3D board'],
              ['2d', '2D board'],
            ] as Array<['3d' | '2d', string]>
          ).map(([value, text]) => (
            <button
              key={value}
              aria-pressed={props.viewMode === value}
              onClick={() => props.onViewMode(value)}
            >
              {text}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <button className="btn btn-primary col-span-1" onClick={props.onNewGame}>
          New
        </button>
        <button className="btn" onClick={props.onUndo} disabled={props.cursor === 0}>
          Undo
        </button>
        <button
          className="btn"
          onClick={props.onRedo}
          disabled={props.cursor >= props.historyLength - 1}
        >
          Redo
        </button>
        <button className="btn" onClick={props.onFlip} title="Rotate the board">
          Flip
        </button>
      </div>

      <section className="panel rise">
        <div className="border-b border-[var(--line-soft)] px-3 py-2.5">
          <span className="label">Opponent</span>
          <div className="seg mt-2">
            {(
              [
                ['vs-engine', 'Engine'],
                ['two-player', 'Two player'],
                ['engine-vs-engine', 'Engine duel'],
              ] as Array<[GameMode, string]>
            ).map(([value, text]) => (
              <button
                key={value}
                aria-pressed={props.mode === value}
                onClick={() => props.onMode(value)}
              >
                {text}
              </button>
            ))}
          </div>
        </div>

        {props.mode === 'vs-engine' && (
          <div className="border-b border-[var(--line-soft)] px-3 py-2.5">
            <span className="label">Play as</span>
            <div className="seg mt-2">
              {([WHITE, BLACK] as Color[]).map((c) => (
                <button
                  key={c}
                  aria-pressed={props.humanColor === c}
                  onClick={() => props.onHumanColor(c)}
                >
                  {colorName(c)}
                </button>
              ))}
            </div>
          </div>
        )}

        {props.mode !== 'two-player' && (
          <div className="px-3 py-2.5">
            <div className="flex items-baseline">
              <span className="label">Strength</span>
              <span className="mono ml-auto text-[10px] text-[var(--brass)]">
                {LEVELS[props.level].elo}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-5 gap-1">
              {LEVEL_ORDER.map((id) => (
                <button
                  key={id}
                  aria-pressed={props.level === id}
                  onClick={() => props.onLevel(id)}
                  className={`min-h-[34px] rounded-[3px] border text-[10px] transition-colors ${
                    props.level === id
                      ? 'border-[#b78c22] bg-[var(--brass)] font-semibold text-[#17140b]'
                      : 'border-[var(--line)] text-[var(--muted)] hover:bg-[var(--raised)] hover:text-[var(--text)]'
                  }`}
                >
                  {LEVELS[id].name}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-[var(--faint)]">
              {LEVELS[props.level].blurb}
            </p>
          </div>
        )}
      </section>

      <section className="panel rise flex min-h-[168px] flex-1 flex-col overflow-hidden">
        <div className="flex items-center border-b border-[var(--line-soft)] px-3 py-2">
          <span className="label">Moves</span>
          <span className="mono ml-auto text-[10px] text-[var(--faint)]">
            {props.moves.length} ply
          </span>
        </div>
        <MoveList
          moves={props.moves}
          cursor={props.cursor}
          onGoTo={props.onGoTo}
          emptyLabel={
            position.fullmove > 1 || position.turn !== WHITE
              ? `Position loaded — ${colorName(position.turn)} to move.`
              : 'No moves yet. White to open.'
          }
        />
        <div className="border-t border-[var(--line-soft)]">
          <Captured position={position} />
        </div>
      </section>

      <FenPanel position={position} onLoadFen={props.onLoadFen} />

      <div className="flex flex-wrap gap-x-4 gap-y-2 px-1 pb-1">
        <Toggle
          label="Legal move hints"
          checked={props.showLegalMoves}
          onChange={() => props.onToggle('showLegalMoves')}
        />
        <Toggle
          label="Animate moves"
          checked={props.animate}
          onChange={() => props.onToggle('animate')}
        />
      </div>
    </aside>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="label !text-[9px] !tracking-[0.12em]">{label}</dt>
      <dd className="mt-0.5 text-[12px] text-[var(--text)]">{value}</dd>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[11px] text-[var(--muted)]">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-3.5 w-3.5 accent-[var(--brass)]"
      />
      {label}
    </label>
  );
}

function FenPanel({
  position,
  onLoadFen,
}: {
  position: Position;
  onLoadFen: (fen: string) => string | null;
}) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fen = toFen(position);

  return (
    <section className="panel px-3 py-2.5">
      <div className="flex items-baseline">
        <span className="label">Position (FEN)</span>
        <button
          className="mono ml-auto text-[10px] text-[var(--brass)] hover:underline"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(fen);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? 'copied' : 'copy'}
        </button>
      </div>
      <p className="mono mt-1.5 break-all text-[10px] leading-relaxed text-[var(--muted)]">
        {fen}
      </p>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!value.trim()) return;
          const err = onLoadFen(value.trim());
          setError(err);
          if (!err) setValue('');
        }}
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Paste a FEN to load…"
          spellCheck={false}
          className="mono min-w-0 flex-1 rounded-[3px] border border-[var(--line)] bg-[#0a0b0e] px-2 py-1.5 text-[10px] text-[var(--text)] placeholder:text-[var(--faint)] focus:border-[var(--brass-dim)] focus:outline-none"
        />
        <button type="submit" className="btn !min-h-[30px] !px-3 !text-[11px]">
          Load
        </button>
      </form>
      {error && <p className="mt-1.5 text-[10px] text-[var(--crimson)]">{error}</p>}
    </section>
  );
}

const compact = (n: number): string =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(0)}k` : String(n);

/** Engine scores are side-to-move relative; show them from White's point of view. */
function formatScore(score: number, turn: Color): string {
  const white = turn === WHITE ? score : -score;
  const pawns = white / 100;
  return `${pawns > 0 ? '+' : ''}${pawns.toFixed(2)}`;
}
