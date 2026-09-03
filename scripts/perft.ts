/**
 * Perft — the standard correctness test for chess move generation.
 *
 * It walks the full legal game tree to a fixed depth and counts leaf nodes.
 * The reference counts below are published values; matching all of them means
 * castling, en passant, promotion, pins, discovered check and check evasion
 * are all handled exactly. Run with `npm run perft`.
 */
import { clonePosition, parseFen, START_FEN } from '../lib/chess/fen';
import { generateLegalMoves, makeMove, unmakeMove } from '../lib/chess/moves';
import { hashPosition } from '../lib/chess/zobrist';
import type { Position } from '../lib/chess/types';

function perft(pos: Position, depth: number): number {
  if (depth === 0) return 1;
  const moves = generateLegalMoves(pos);
  if (depth === 1) return moves.length;
  let nodes = 0;
  for (const m of moves) {
    const undo = makeMove(pos, m);
    nodes += perft(pos, depth - 1);
    unmakeMove(pos, m, undo);
  }
  return nodes;
}

/** Verifies incremental Zobrist updates against a full recomputation. */
function hashCheck(pos: Position, depth: number): boolean {
  if (depth === 0) return true;
  for (const m of generateLegalMoves(pos)) {
    const undo = makeMove(pos, m);
    const full = hashPosition(pos);
    if (full.lo !== pos.hashLo || full.hi !== pos.hashHi) return false;
    if (!hashCheck(pos, depth - 1)) return false;
    unmakeMove(pos, m, undo);
  }
  return true;
}

interface Case {
  name: string;
  fen: string;
  expected: number[]; // index = depth - 1
}

const CASES: Case[] = [
  { name: 'Start position', fen: START_FEN, expected: [20, 400, 8902, 197281, 4865609] },
  {
    name: 'Kiwipete',
    fen: 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
    expected: [48, 2039, 97862, 4085603],
  },
  {
    name: 'Position 3 (endgame)',
    fen: '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',
    expected: [14, 191, 2812, 43238, 674624],
  },
  {
    name: 'Position 4 (promotions)',
    fen: 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',
    expected: [6, 264, 9467, 422333],
  },
  {
    name: 'Position 4 mirrored',
    fen: 'r2q1rk1/pP1p2pp/Q4n2/bbp1p3/Np6/1B3NBn/pPPP1PPP/R3K2R b KQ - 0 1',
    expected: [6, 264, 9467, 422333],
  },
  {
    name: 'Position 5',
    fen: 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8',
    expected: [44, 1486, 62379, 2103487],
  },
  {
    name: 'Position 6',
    fen: 'r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10',
    expected: [46, 2079, 89890, 3894594],
  },
];

let failures = 0;
let totalNodes = 0;
const started = Date.now();

for (const c of CASES) {
  const base = parseFen(c.fen);
  for (let depth = 1; depth <= c.expected.length; depth += 1) {
    const pos = clonePosition(base);
    const t0 = Date.now();
    const nodes = perft(pos, depth);
    const ms = Date.now() - t0;
    totalNodes += nodes;
    const ok = nodes === c.expected[depth - 1];
    if (!ok) failures += 1;
    const nps = ms > 0 ? Math.round(nodes / (ms / 1000)).toLocaleString() : '—';
    console.log(
      `${ok ? '  ok  ' : ' FAIL '} ${c.name.padEnd(22)} depth ${depth}  ` +
        `${String(nodes).padStart(9)}` +
        `${ok ? '' : `  expected ${c.expected[depth - 1]}`}` +
        `   ${String(ms).padStart(5)}ms  ${nps} nps`,
    );
  }
}

const hashOk = CASES.every((c) => hashCheck(parseFen(c.fen), 3));
console.log(`${hashOk ? '  ok  ' : ' FAIL '} incremental Zobrist matches full recomputation to depth 3`);
if (!hashOk) failures += 1;

const elapsed = ((Date.now() - started) / 1000).toFixed(1);
console.log(
  `\n${failures === 0 ? 'PASS' : `FAIL (${failures})`} — ` +
    `${totalNodes.toLocaleString()} nodes in ${elapsed}s`,
);
process.exit(failures === 0 ? 0 : 1);
