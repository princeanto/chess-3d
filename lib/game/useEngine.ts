'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toFen } from '../chess/fen';
import { generateLegalMoves } from '../chess/moves';
import type { EngineRequest, EngineResponse } from '../../workers/engine.worker';
import { LEVELS, type Level } from './difficulty';
import { useGame } from './store';

export interface EngineStatus {
  ready: boolean;
  error: string | null;
}

/**
 * Owns the engine worker and the rule that a returned move is only played if the
 * board still stands where it was asked. Without that check an undo during a
 * five-second search would apply a move from a position that no longer exists.
 */
export function useEngine() {
  const workerRef = useRef<Worker | null>(null);
  const requestId = useRef(0);
  const pendingFen = useRef<string | null>(null);
  const [status, setStatus] = useState<EngineStatus>({ ready: false, error: null });

  useEffect(() => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('../../workers/engine.worker.ts', import.meta.url));
    } catch (err) {
      setStatus({
        ready: false,
        error: err instanceof Error ? err.message : 'Engine worker failed to start',
      });
      return;
    }

    workerRef.current = worker;
    setStatus({ ready: true, error: null });

    worker.onmessage = (event: MessageEvent<EngineResponse>) => {
      const msg = event.data;
      const store = useGame.getState();

      if (msg.type === 'error') {
        setStatus({ ready: true, error: msg.message ?? 'Engine error' });
        store.setThinking(false);
        return;
      }

      if (msg.id !== requestId.current) return; // stale search, discard

      if (msg.type === 'progress') {
        store.setEngineInfo({
          depth: msg.depth ?? 0,
          score: msg.score ?? 0,
          nodes: msg.nodes ?? 0,
          timeMs: msg.timeMs ?? 0,
          mateIn: msg.mateIn ?? null,
          pv: [],
        });
        return;
      }

      // The position must be exactly the one we asked about.
      const currentFen = toFen(store.position());
      if (pendingFen.current !== currentFen) {
        store.setThinking(false);
        return;
      }

      const move = msg.move ?? 0;
      if (move && generateLegalMoves(store.position()).includes(move)) {
        store.setEngineInfo({
          depth: msg.depth ?? 0,
          score: msg.score ?? 0,
          nodes: msg.nodes ?? 0,
          timeMs: msg.timeMs ?? 0,
          mateIn: msg.mateIn ?? null,
          pv: msg.pv ?? [],
        });
        store.commit(move);
      }
      store.setThinking(false);
    };

    worker.onerror = (event) => {
      setStatus({ ready: false, error: event.message || 'Engine worker crashed' });
      useGame.getState().setThinking(false);
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const think = useCallback((level: Level) => {
    const worker = workerRef.current;
    if (!worker) return;
    const store = useGame.getState();
    const fen = toFen(store.position());
    const spec = LEVELS[level];

    requestId.current += 1;
    pendingFen.current = fen;
    store.setThinking(true);
    store.setEngineInfo(null);

    const req: EngineRequest = {
      type: 'search',
      id: requestId.current,
      fen,
      depth: spec.depth,
      timeMs: spec.timeMs,
      randomness: spec.randomness,
      seed: (Date.now() & 0x7fffffff) || 1,
    };
    worker.postMessage(req);
  }, []);

  /** Invalidates any in-flight search — used by undo, reset and FEN load. */
  const cancel = useCallback(() => {
    requestId.current += 1;
    pendingFen.current = null;
    useGame.getState().setThinking(false);
  }, []);

  const reset = useCallback(() => {
    cancel();
    workerRef.current?.postMessage({ type: 'reset' } satisfies EngineRequest);
  }, [cancel]);

  return { status, think, cancel, reset };
}
