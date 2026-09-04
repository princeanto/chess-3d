'use client';

import { create } from 'zustand';
import { clonePosition, initialPosition, parseFen, toFen } from '../chess/fen';
import { evaluateResult, repetitionKey, type GameResult } from '../chess/game';
import { generateLegalMoves, makeMove } from '../chess/moves';
import { toSan } from '../chess/san';
import {
  BLACK,
  WHITE,
  moveFrom,
  movePromotion,
  moveTo,
  pieceColor,
  type Color,
  type Position,
} from '../chess/types';
import { LEVELS, type Level } from './difficulty';

export type GameMode = 'vs-engine' | 'two-player' | 'engine-vs-engine';

export interface PlayedMove {
  move: number;
  san: string;
  /** Position index this move led to. */
  ply: number;
}

export interface EngineInfo {
  depth: number;
  score: number;
  nodes: number;
  timeMs: number;
  mateIn: number | null;
  pv: string[];
}

interface GameState {
  /** history[0] is the starting position; history[i] is the position after i plies. */
  history: Position[];
  moves: PlayedMove[];
  cursor: number;

  selected: number | null;
  legalFromSelected: number[];
  lastMove: { from: number; to: number } | null;
  pendingPromotion: { from: number; to: number; options: number[] } | null;

  mode: GameMode;
  humanColor: Color;
  level: Level;
  flipped: boolean;
  /** Rendering style: the 3D set, or a flat diagram board. */
  viewMode: '3d' | '2d';
  thinking: boolean;
  engineInfo: EngineInfo | null;
  result: GameResult;

  showLegalMoves: boolean;
  showCoordinates: boolean;
  animate: boolean;

  position: () => Position;
  isLive: () => boolean;
  humanToMove: () => boolean;

  select: (square: number | null) => void;
  tryMove: (from: number, to: number) => boolean;
  commit: (move: number) => void;
  choosePromotion: (pieceType: number) => void;
  cancelPromotion: () => void;

  undo: () => void;
  redo: () => void;
  goToPly: (ply: number) => void;
  reset: () => void;
  loadFen: (fen: string) => string | null;

  setMode: (mode: GameMode) => void;
  setHumanColor: (color: Color) => void;
  setLevel: (level: Level) => void;
  toggleFlip: () => void;
  setViewMode: (mode: '3d' | '2d') => void;
  setThinking: (thinking: boolean) => void;
  setEngineInfo: (info: EngineInfo | null) => void;
  toggle: (key: 'showLegalMoves' | 'showCoordinates' | 'animate') => void;
}

function countRepetitions(history: Position[], upTo: number): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i <= upTo; i += 1) {
    const key = repetitionKey(history[i]);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

const statusFor = (history: Position[], cursor: number): GameResult =>
  evaluateResult(history[cursor], countRepetitions(history, cursor));

export const useGame = create<GameState>((set, get) => {
  const start = initialPosition();

  return {
    history: [start],
    moves: [],
    cursor: 0,

    selected: null,
    legalFromSelected: [],
    lastMove: null,
    pendingPromotion: null,

    mode: 'vs-engine',
    humanColor: WHITE,
    level: 'club',
    flipped: false,
    viewMode: '3d',
    thinking: false,
    engineInfo: null,
    result: { over: false, check: false },

    showLegalMoves: true,
    showCoordinates: true,
    animate: true,

    position: () => get().history[get().cursor],
    isLive: () => get().cursor === get().history.length - 1,

    humanToMove: () => {
      const s = get();
      if (!s.isLive() || s.result.over) return false;
      if (s.mode === 'two-player') return true;
      if (s.mode === 'engine-vs-engine') return false;
      return s.position().turn === s.humanColor;
    },

    select: (square) => {
      const s = get();
      if (square === null) {
        set({ selected: null, legalFromSelected: [] });
        return;
      }
      const pos = s.position();
      const piece = pos.board[square];
      if (!piece || pieceColor(piece) !== pos.turn || !s.humanToMove()) {
        set({ selected: null, legalFromSelected: [] });
        return;
      }
      const legal = generateLegalMoves(pos).filter((m) => moveFrom(m) === square);
      set({ selected: square, legalFromSelected: legal });
    },

    tryMove: (from, to) => {
      const s = get();
      if (!s.humanToMove()) return false;
      const candidates = generateLegalMoves(s.position()).filter(
        (m) => moveFrom(m) === from && moveTo(m) === to,
      );
      if (candidates.length === 0) return false;

      if (candidates.length > 1 && candidates.every((m) => movePromotion(m))) {
        set({ pendingPromotion: { from, to, options: candidates }, selected: null, legalFromSelected: [] });
        return true;
      }

      s.commit(candidates[0]);
      return true;
    },

    commit: (move) => {
      const s = get();
      const base = s.history.slice(0, s.cursor + 1);
      const pos = base[base.length - 1];
      const legal = generateLegalMoves(pos);
      if (!legal.includes(move)) return;

      const san = toSan(pos, move, legal);
      const next = clonePosition(pos);
      makeMove(next, move);

      const history = [...base, next];
      const moves = [...s.moves.slice(0, s.cursor), { move, san, ply: history.length - 1 }];
      const cursor = history.length - 1;

      set({
        history,
        moves,
        cursor,
        selected: null,
        legalFromSelected: [],
        pendingPromotion: null,
        lastMove: { from: moveFrom(move), to: moveTo(move) },
        result: statusFor(history, cursor),
        engineInfo: null,
      });
    },

    choosePromotion: (pieceType) => {
      const s = get();
      const pending = s.pendingPromotion;
      if (!pending) return;
      const move = pending.options.find((m) => movePromotion(m) === pieceType);
      if (move !== undefined) s.commit(move);
      else set({ pendingPromotion: null });
    },

    cancelPromotion: () => set({ pendingPromotion: null }),

    undo: () => {
      const s = get();
      // In engine games, step back over the engine's reply too, so "undo" gives
      // the player their own move back rather than handing them the wrong turn.
      const step = s.mode === 'vs-engine' && s.cursor >= 2 ? 2 : 1;
      const cursor = Math.max(0, s.cursor - step);
      const history = s.history.slice(0, cursor + 1);
      const moves = s.moves.slice(0, cursor);
      const prev = moves[moves.length - 1];
      set({
        history,
        moves,
        cursor,
        selected: null,
        legalFromSelected: [],
        pendingPromotion: null,
        lastMove: prev ? { from: moveFrom(prev.move), to: moveTo(prev.move) } : null,
        result: statusFor(history, cursor),
        engineInfo: null,
      });
    },

    redo: () => {
      const s = get();
      if (s.cursor >= s.history.length - 1) return;
      const cursor = s.cursor + 1;
      const played = s.moves[cursor - 1];
      set({
        cursor,
        selected: null,
        legalFromSelected: [],
        lastMove: played ? { from: moveFrom(played.move), to: moveTo(played.move) } : null,
        result: statusFor(s.history, cursor),
      });
    },

    goToPly: (ply) => {
      const s = get();
      const cursor = Math.max(0, Math.min(ply, s.history.length - 1));
      const played = s.moves[cursor - 1];
      set({
        cursor,
        selected: null,
        legalFromSelected: [],
        lastMove: played ? { from: moveFrom(played.move), to: moveTo(played.move) } : null,
        result: statusFor(s.history, cursor),
      });
    },

    reset: () => {
      const fresh = initialPosition();
      set({
        history: [fresh],
        moves: [],
        cursor: 0,
        selected: null,
        legalFromSelected: [],
        lastMove: null,
        pendingPromotion: null,
        thinking: false,
        engineInfo: null,
        result: { over: false, check: false },
      });
    },

    loadFen: (fen) => {
      try {
        const pos = parseFen(fen);
        // A position with no legal moves for either side is not a game.
        set({
          history: [pos],
          moves: [],
          cursor: 0,
          selected: null,
          legalFromSelected: [],
          lastMove: null,
          pendingPromotion: null,
          thinking: false,
          engineInfo: null,
          result: statusFor([pos], 0),
        });
        return null;
      } catch (err) {
        return err instanceof Error ? err.message : 'Invalid FEN';
      }
    },

    setMode: (mode) => set({ mode, selected: null, legalFromSelected: [] }),
    setHumanColor: (humanColor) => set({ humanColor, flipped: humanColor === BLACK }),
    setLevel: (level) => set({ level }),
    toggleFlip: () => set((s) => ({ flipped: !s.flipped })),

    setViewMode: (viewMode) => set({ viewMode }),
    setThinking: (thinking) => set({ thinking }),
    setEngineInfo: (engineInfo) => set({ engineInfo }),
    toggle: (key) => set((s) => ({ [key]: !s[key] } as Pick<GameState, typeof key>)),
  };
});

export const currentFen = (): string => toFen(useGame.getState().position());
export { LEVELS, WHITE, BLACK };
