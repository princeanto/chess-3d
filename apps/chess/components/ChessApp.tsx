'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { colorName, resultText } from '@/lib/chess/game';
import { WHITE, moveIsCapture, moveTo, pieceColor } from '@/lib/chess/types';
import { useEngine } from '@/lib/game/useEngine';
import { useGame } from '@/lib/game/store';
import Board2D from './Board2D';
import GameOverDialog, { describeOutcome } from './ui/GameOverDialog';
import PromotionDialog from './ui/PromotionDialog';
import SetupDialog from './ui/SetupDialog';
import Sidebar from './ui/Sidebar';

// WebGL cannot render on the server, and pulling three into the server bundle
// only to throw it away costs build time and a hydration mismatch.
const Scene = dynamic(() => import('./scene/Scene'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <span className="label thinking-dot">Setting the board…</span>
    </div>
  ),
});

export default function ChessApp() {
  const game = useGame();
  const { status, think, cancel, reset: resetEngine } = useEngine();
  const [resultDismissed, setResultDismissed] = useState(false);
  // The setup sheet opens on load and whenever a new game is requested, so
  // colour, opponent and strength are chosen before the first move rather than
  // discovered in a sidebar afterwards.
  const [setupOpen, setSetupOpen] = useState(true);
  // Below the lg breakpoint the panel becomes a drawer so the board gets the
  // whole screen; above it, it is always on show and this flag is inert.
  const [menuOpen, setMenuOpen] = useState(false);

  const engineToMove = useMemo(() => {
    if (game.result.over || game.cursor !== game.history.length - 1) return false;
    if (game.mode === 'engine-vs-engine') return true;
    if (game.mode === 'two-player') return false;
    return game.position().turn !== game.humanColor;
  }, [game]);

  // Hand the position to the engine when it is its turn. The small delay lets
  // the move animation land first, so the reply does not stomp on it.
  useEffect(() => {
    if (!status.ready || game.thinking || game.pendingPromotion || setupOpen) return;
    if (!engineToMove) return;
    const timer = setTimeout(() => think(game.level), 340);
    return () => clearTimeout(timer);
  }, [
    engineToMove,
    status.ready,
    game.thinking,
    game.pendingPromotion,
    game.level,
    setupOpen,
    think,
  ]);

  const handleSquare = useCallback(
    (square: number) => {
      const state = useGame.getState();
      if (state.pendingPromotion) return;
      const pos = state.position();
      const piece = pos.board[square];

      if (state.selected !== null) {
        if (square === state.selected) {
          state.select(null);
          return;
        }
        if (state.tryMove(state.selected, square)) return;
      }

      // Selecting an own piece starts a move; anything else clears.
      if (piece && pieceColor(piece) === pos.turn) state.select(square);
      else state.select(null);
    },
    [],
  );

  /** Opens the setup sheet; the board is only cleared once the game is started. */
  const openSetup = useCallback(() => {
    cancel();
    setResultDismissed(true);
    setSetupOpen(true);
  }, [cancel]);

  const startGame = useCallback(() => {
    cancel();
    resetEngine();
    useGame.getState().reset();
    setResultDismissed(false);
    setSetupOpen(false);
  }, [cancel, resetEngine]);

  const undo = useCallback(() => {
    cancel();
    useGame.getState().undo();
  }, [cancel]);

  const loadFen = useCallback(
    (fen: string) => {
      cancel();
      return useGame.getState().loadFen(fen);
    },
    [cancel],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /input|textarea/i.test(target.tagName)) return;
      if (setupOpen) return;
      const state = useGame.getState();
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          state.goToPly(state.cursor - 1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          state.goToPly(state.cursor + 1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          state.goToPly(0);
          break;
        case 'ArrowDown':
          e.preventDefault();
          state.goToPly(state.history.length - 1);
          break;
        case 'f':
          state.toggleFlip();
          break;
        case 'u':
          undo();
          break;
        case 'Escape':
          setMenuOpen(false);
          state.select(null);
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, setupOpen]);

  useEffect(() => {
    if (setupOpen || game.pendingPromotion) setMenuOpen(false);
  }, [setupOpen, game.pendingPromotion]);

  const position = game.position();

  // Re-arm the result dialog whenever a *new* ending appears. Keying on the ply
  // means stepping back through the game and forward again will not pop it a
  // second time, but a fresh game that ends will.
  const endingKey = game.result.over ? `${game.cursor}:${game.result.reason}` : null;
  useEffect(() => {
    setResultDismissed(false);
  }, [endingKey]);

  const outcome = useMemo(
    () => describeOutcome(game.result, game.mode, game.humanColor),
    [game.result, game.mode, game.humanColor],
  );
  const showResult =
    outcome !== null &&
    game.cursor === game.history.length - 1 &&
    !resultDismissed &&
    !setupOpen;

  const targets = useMemo(
    () =>
      game.legalFromSelected.map((m) => ({
        square: moveTo(m),
        capture: moveIsCapture(m),
      })),
    [game.legalFromSelected],
  );

  const checkSquare = game.result.check ? position.kings[position.turn] : null;

  const statusLine = game.result.over
    ? resultText(game.result)
    : `${colorName(position.turn)} to move${game.result.check ? ' — check' : ''}`;

  return (
    <main className="flex h-[100dvh] flex-col gap-3 p-3 lg:flex-row lg:gap-4 lg:p-4">
      <div className="stage-glow panel relative min-h-0 flex-1 overflow-hidden rounded-[4px]">
        {game.viewMode === '3d' ? (
          <Scene
            position={position}
            lastMove={game.lastMove}
            selected={game.selected}
            targets={targets}
            checkSquare={checkSquare}
            flipped={game.flipped}
            showLegal={game.showLegalMoves}
            animate={game.animate}
            onSquareClick={handleSquare}
          />
        ) : (
          <Board2D
            position={position}
            lastMove={game.lastMove}
            flipped={game.flipped}
            selected={game.selected}
            targets={targets}
            checkSquare={checkSquare}
            showLegal={game.showLegalMoves}
            onSquareClick={handleSquare}
          />
        )}

        {/* Small-screen chrome: whose move it is, and the way into the panel. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-2 lg:hidden">
          <div className="pointer-events-auto flex items-center gap-2 rounded-[3px] border border-[var(--line)] bg-[var(--panel)]/92 px-2.5 py-1.5 backdrop-blur">
            <span
              aria-hidden
              className="h-3.5 w-3.5 shrink-0 rounded-full border"
              style={{
                background: position.turn === WHITE ? '#EBDFC6' : '#23262B',
                borderColor: position.turn === WHITE ? '#c8bda3' : '#3a3f4a',
              }}
            />
            <span className="text-[11.5px] leading-none text-[var(--text)]">{statusLine}</span>
            {game.thinking && (
              <span
                className="thinking-dot h-1.5 w-1.5 rounded-full bg-[var(--brass)]"
                aria-label="Engine thinking"
              />
            )}
          </div>

          <button
            onClick={() => setMenuOpen(true)}
            aria-label="Open game menu"
            aria-expanded={menuOpen}
            className="pointer-events-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-[3px] border border-[var(--line)] bg-[var(--panel)]/92 text-[var(--text)] backdrop-blur transition-colors active:bg-[var(--raised)]"
          >
            <svg width="17" height="13" viewBox="0 0 17 13" aria-hidden>
              <path
                d="M1 1.5h15M1 6.5h15M1 11.5h15"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <p className="label pointer-events-none absolute bottom-2 left-3 !text-[9px] opacity-60">
          {game.viewMode === '3d' ? (
            <>
              <span className="hidden sm:inline">
                drag to orbit · scroll to zoom · ← → to review
              </span>
              <span className="sm:hidden">drag to orbit · pinch to zoom</span>
            </>
          ) : (
            <span>← → to review the game</span>
          )}
        </p>
      </div>

      {menuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMenuOpen(false)}
          aria-hidden
        />
      )}

      <div
        // `invisible` keeps the closed drawer out of the tab order and the
        // accessibility tree; transitioning visibility alongside the transform
        // means it only disappears once the slide-out has finished.
        className={`fixed inset-y-0 right-0 z-50 flex w-[min(90vw,380px)] flex-col overflow-y-auto border-l border-[var(--line)] bg-[var(--bg)] p-3 transition-[transform,visibility] duration-300 ease-out lg:visible lg:static lg:z-auto lg:h-full lg:w-auto lg:translate-x-0 lg:overflow-visible lg:border-l-0 lg:bg-transparent lg:p-0 lg:transition-none ${
          menuOpen ? 'visible translate-x-0' : 'invisible translate-x-full'
        }`}
      >
        <Sidebar
          position={position}
          result={game.result}
          moves={game.moves}
          cursor={game.cursor}
          historyLength={game.history.length}
          mode={game.mode}
          humanColor={game.humanColor}
          level={game.level}
          thinking={game.thinking}
          engineInfo={game.engineInfo}
          engineError={status.error}
          showLegalMoves={game.showLegalMoves}
          animate={game.animate}
          onNewGame={openSetup}
          onUndo={undo}
          onRedo={game.redo}
          onFlip={game.toggleFlip}
          onGoTo={game.goToPly}
          onMode={game.setMode}
          onHumanColor={game.setHumanColor}
          onLevel={game.setLevel}
          onToggle={game.toggle}
          onLoadFen={loadFen}
          viewMode={game.viewMode}
          onViewMode={game.setViewMode}
          onClose={() => setMenuOpen(false)}
        />
      </div>

      {setupOpen && (
        <SetupDialog
          mode={game.mode}
          humanColor={game.humanColor}
          level={game.level}
          showLegalMoves={game.showLegalMoves}
          animate={game.animate}
          canCancel={game.moves.length > 0}
          onMode={game.setMode}
          onHumanColor={game.setHumanColor}
          onLevel={game.setLevel}
          onToggle={game.toggle}
          viewMode={game.viewMode}
          onViewMode={game.setViewMode}
          onStart={startGame}
          onCancel={() => setSetupOpen(false)}
        />
      )}

      {game.pendingPromotion && (
        <PromotionDialog
          color={position.turn}
          onChoose={game.choosePromotion}
          onCancel={game.cancelPromotion}
        />
      )}

      {showResult && outcome && (
        <GameOverDialog
          outcome={outcome}
          lastMove={game.moves[game.moves.length - 1]?.san ?? null}
          moveCount={game.moves.length}
          canUndo={outcome.tone === 'loss' && game.cursor > 0}
          onNewGame={openSetup}
          onUndo={() => {
            setResultDismissed(true);
            undo();
          }}
          onClose={() => setResultDismissed(true)}
        />
      )}
    </main>
  );
}
