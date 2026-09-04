/// <reference lib="webworker" />
import { parseFen } from '../lib/chess/fen';
import { clearTable, findBestMove } from '../lib/chess/search';
import { toSan, toUci } from '../lib/chess/san';
import { generateLegalMoves, makeMove } from '../lib/chess/moves';

/**
 * The engine runs off the main thread. A five-second search would otherwise
 * freeze the renderer solid, and orbiting the board while the opponent thinks
 * is half of what makes a 3D board feel alive.
 */

export interface EngineRequest {
  type: 'search' | 'reset';
  id?: number;
  fen?: string;
  depth?: number;
  timeMs?: number;
  randomness?: number;
  seed?: number;
}

export interface EngineResponse {
  type: 'progress' | 'result' | 'error';
  id: number;
  move?: number;
  uci?: string;
  san?: string;
  score?: number;
  depth?: number;
  nodes?: number;
  timeMs?: number;
  mateIn?: number | null;
  pv?: string[];
  message?: string;
}

const post = (msg: EngineResponse) => (self as unknown as Worker).postMessage(msg);

self.onmessage = (event: MessageEvent<EngineRequest>) => {
  const req = event.data;

  if (req.type === 'reset') {
    clearTable();
    return;
  }

  const id = req.id ?? 0;
  try {
    const pos = parseFen(req.fen!);
    const result = findBestMove(
      pos,
      {
        depth: req.depth ?? 6,
        timeMs: req.timeMs ?? 1500,
        randomness: req.randomness ?? 0,
        seed: req.seed,
      },
      (info) => {
        post({
          type: 'progress',
          id,
          score: info.score,
          depth: info.depth,
          nodes: info.nodes,
          timeMs: info.timeMs,
          mateIn: info.mateIn,
          uci: toUci(info.move),
        });
      },
    );

    // SAN needs the position the move is played from, so build it here.
    const fresh = parseFen(req.fen!);
    const legal = generateLegalMoves(fresh);
    const san = legal.includes(result.move) ? toSan(fresh, result.move, legal) : undefined;

    const pvPos = parseFen(req.fen!);
    const pvSan: string[] = [];
    for (const m of result.pv) {
      const moves = generateLegalMoves(pvPos);
      if (!moves.includes(m)) break;
      pvSan.push(toSan(pvPos, m, moves));
      makeMove(pvPos, m);
    }

    post({
      type: 'result',
      id,
      move: result.move,
      uci: toUci(result.move),
      san,
      score: result.score,
      depth: result.depth,
      nodes: result.nodes,
      timeMs: result.timeMs,
      mateIn: result.mateIn,
      pv: pvSan,
    });
  } catch (err) {
    post({
      type: 'error',
      id,
      message: err instanceof Error ? err.message : 'Engine failure',
    });
  }
};
