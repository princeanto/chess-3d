/**
 * Engine sanity tests.
 *
 * Mate puzzles are not checked against a hand-written answer — an exhaustive
 * prover computes the true set of forced-mate moves for the position, and the
 * engine's choice is checked against that. A wrong expectation in the test file
 * therefore cannot masquerade as an engine bug.
 */
import { parseFen, toFen, START_FEN } from '../lib/chess/fen';
import { evaluateResult, repetitionKey } from '../lib/chess/game';
import { generateLegalMoves, inCheck, makeMove, unmakeMove } from '../lib/chess/moves';
import { toSan, toUci } from '../lib/chess/san';
import { clearTable, findBestMove, MATE, MATE_THRESHOLD } from '../lib/chess/search';
import type { Position } from '../lib/chess/types';

/** Does the side to move force mate within `n` of its own moves? */
function forcesMateIn(pos: Position, n: number): boolean {
  if (n <= 0) return false;
  for (const m of generateLegalMoves(pos)) {
    const undo = makeMove(pos, m);
    const replies = generateLegalMoves(pos);
    if (replies.length === 0) {
      const mated = inCheck(pos);
      unmakeMove(pos, m, undo);
      if (mated) return true;
      continue; // stalemate is not mate
    }
    if (n > 1) {
      let allForced = true;
      for (const r of replies) {
        const u2 = makeMove(pos, r);
        const ok = forcesMateIn(pos, n - 1);
        unmakeMove(pos, r, u2);
        if (!ok) {
          allForced = false;
          break;
        }
      }
      if (allForced) {
        unmakeMove(pos, m, undo);
        return true;
      }
    }
    unmakeMove(pos, m, undo);
  }
  return false;
}

/** Every first move that forces mate in exactly `n`. */
function matingMoves(pos: Position, n: number): string[] {
  const found: string[] = [];
  for (const m of generateLegalMoves(pos)) {
    const undo = makeMove(pos, m);
    const replies = generateLegalMoves(pos);
    let ok = false;
    if (replies.length === 0) {
      ok = n === 1 && inCheck(pos);
    } else if (n > 1) {
      ok = replies.every((r) => {
        const u2 = makeMove(pos, r);
        const forced = forcesMateIn(pos, n - 1);
        unmakeMove(pos, r, u2);
        return forced;
      });
    }
    unmakeMove(pos, m, undo);
    if (ok) found.push(toUci(m));
  }
  return found;
}

let failures = 0;
const pass = (ok: boolean) => {
  if (!ok) failures += 1;
  return ok ? '  ok  ' : ' FAIL ';
};

/* ------------------------------ mate puzzles ----------------------------- */

interface MatePuzzle {
  name: string;
  fen: string;
  mateIn: number;
  depth: number;
}

const MATES: MatePuzzle[] = [
  { name: 'Back-rank mate', fen: '6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1', mateIn: 1, depth: 4 },
  { name: 'Queen + king mate', fen: '7k/6pp/8/8/8/8/6QK/8 w - - 0 1', mateIn: 1, depth: 4 },
  { name: 'Smothered mate', fen: '6rk/6pp/8/4N3/8/8/8/6K1 w - - 0 1', mateIn: 1, depth: 4 },
  { name: 'Corner box mate', fen: '7k/5K2/8/8/8/8/8/6Q1 w - - 0 1', mateIn: 1, depth: 4 },
  { name: 'Two-rook ladder', fen: '7k/8/8/8/8/8/1R6/R6K w - - 0 1', mateIn: 2, depth: 6 },
  {
    name: 'Exposed king, mate in 2',
    fen: 'r1b1kb1r/pppp1ppp/2n2q2/4n3/3KP3/2N3PN/PPP4P/R1BQ1B1R b kq - 0 1',
    mateIn: 2,
    depth: 6,
  },
];

console.log('MATE PUZZLES  (expected moves derived by exhaustive prover)');
for (const p of MATES) {
  const truth = matingMoves(parseFen(p.fen), p.mateIn);
  clearTable();
  const pos = parseFen(p.fen);
  const r = findBestMove(pos, { depth: p.depth, timeMs: 5000 });
  const uci = toUci(r.move);
  const foundMate = truth.includes(uci);
  const scoreIsMate = Math.abs(r.score) > MATE_THRESHOLD;
  const claimedIn = scoreIsMate ? Math.ceil((MATE - Math.abs(r.score)) / 2) : null;
  const ok = truth.length > 0 && foundMate && claimedIn === p.mateIn;
  console.log(
    `${pass(ok)} ${p.name.padEnd(24)} #${p.mateIn}  played ${uci.padEnd(6)}` +
      `claims #${claimedIn ?? '-'}  (${truth.length} mating move${truth.length === 1 ? '' : 's'}: ${truth.slice(0, 4).join(',')})` +
      `  ${r.nodes.toLocaleString()}n ${r.timeMs}ms`,
  );
}

/* ---------------------------- positional tests --------------------------- */

interface Tactic {
  name: string;
  fen: string;
  best: string[];
  depth: number;
}

const TACTICS: Tactic[] = [
  { name: 'Knight forks the queen', fen: '4k3/8/8/3q4/8/2N5/8/4K3 w - - 0 1', best: ['c3d5'], depth: 5 },
  { name: 'Take the hanging rook', fen: '4k3/8/8/8/8/8/4r3/4K2R w K - 0 1', best: ['e1e2'], depth: 5 },
  { name: 'Promote to queen', fen: '8/P6k/8/8/8/8/6K1/8 w - - 0 1', best: ['a7a8q'], depth: 5 },
  {
    name: 'Recapture, not a blunder',
    fen: 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2',
    best: ['e4d5'],
    depth: 6,
  },
];

console.log('\nTACTICS');
for (const t of TACTICS) {
  clearTable();
  const pos = parseFen(t.fen);
  const r = findBestMove(pos, { depth: t.depth, timeMs: 5000 });
  const uci = toUci(r.move);
  const ok = t.best.includes(uci);
  console.log(
    `${pass(ok)} ${t.name.padEnd(24)} played ${uci.padEnd(6)}` +
      `${ok ? '' : `expected ${t.best.join('/')} `}` +
      `score ${String(r.score).padStart(6)}  d${r.depth}  ${r.nodes.toLocaleString()}n ${r.timeMs}ms`,
  );
}

/* -------------------------------- self play ------------------------------ */

console.log('\nSELF-PLAY (depth 5, 400ms/move, max 200 plies)');
clearTable();
const pos = parseFen(START_FEN);
const reps = new Map<string, number>();
reps.set(repetitionKey(pos), 1);
const line: string[] = [];
let plies = 0;
let outcome = 'move limit reached';
let illegal = false;

while (plies < 200) {
  const status = evaluateResult(pos, reps);
  if (status.over) {
    outcome = status.reason;
    break;
  }
  const legal = generateLegalMoves(pos);
  const r = findBestMove(pos, { depth: 5, timeMs: 400 });
  if (!legal.includes(r.move)) {
    console.log(` FAIL  illegal engine move at ply ${plies}: ${toUci(r.move)}`);
    illegal = true;
    failures += 1;
    break;
  }
  line.push(toSan(pos, r.move, legal));
  makeMove(pos, r.move);
  const key = repetitionKey(pos);
  reps.set(key, (reps.get(key) ?? 0) + 1);
  plies += 1;
}

console.log(`${pass(!illegal)} ${plies} plies, all legal, ended: ${outcome}`);
console.log(`       ${line.slice(0, 20).join(' ')}${line.length > 20 ? ' …' : ''}`);
console.log(`${pass(toFen(parseFen(toFen(pos))) === toFen(pos))} FEN round-trip on final position`);

console.log(`\n${failures === 0 ? 'PASS' : `FAIL (${failures})`}`);
process.exit(failures === 0 ? 0 : 1);
