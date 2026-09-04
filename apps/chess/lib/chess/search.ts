import { PIECE_VALUE, evaluate } from './evaluate';
import {
  generateLegalMoves,
  generateMoves,
  inCheck,
  isSquareAttacked,
  makeMove,
  makeNullMove,
  unmakeMove,
  unmakeNullMove,
} from './moves';
import {
  KING,
  moveCaptured,
  moveFrom,
  moveIsCapture,
  movePromotion,
  moveTo,
  pieceType,
  type Color,
  type Position,
} from './types';

export const MATE = 30000;
export const MATE_THRESHOLD = MATE - 1000;

const TT_BITS = 20; // 1,048,576 entries ≈ 20MB across five typed arrays
const TT_SIZE = 1 << TT_BITS;
const TT_MASK = TT_SIZE - 1;

const EXACT = 0;
const LOWER = 1; // fail-high, score is a lower bound
const UPPER = 2; // fail-low, score is an upper bound

const ttLo = new Int32Array(TT_SIZE);
const ttHi = new Int32Array(TT_SIZE);
const ttMove = new Int32Array(TT_SIZE);
const ttScore = new Int32Array(TT_SIZE);
const ttMeta = new Int32Array(TT_SIZE); // depth << 2 | flag
const ttStamp = new Int32Array(TT_SIZE);

let generation = 0;

export function clearTable() {
  ttLo.fill(0);
  ttHi.fill(0);
  ttMove.fill(0);
  ttScore.fill(0);
  ttMeta.fill(0);
  ttStamp.fill(0);
  generation = 0;
}

const MAX_PLY = 64;
const killers = new Int32Array(MAX_PLY * 2);
/** history[colour][from][to] — how often a quiet move caused a cutoff. */
const history = new Int32Array(2 * 128 * 128);

export interface SearchLimits {
  depth: number;
  timeMs: number;
  /** 0 = always play the best move; higher widens the random pick. */
  randomness?: number;
  /** Deterministic tie-breaking when randomness is on. */
  seed?: number;
}

export interface SearchResult {
  move: number;
  score: number;
  depth: number;
  nodes: number;
  timeMs: number;
  pv: number[];
  mateIn: number | null;
}

interface Ctx {
  pos: Position;
  nodes: number;
  deadline: number;
  aborted: boolean;
  rootColor: Color;
}

/* ------------------------------ ordering ----------------------------- */

/** Most Valuable Victim / Least Valuable Attacker. */
function captureScore(pos: Position, move: number): number {
  const victim = moveCaptured(move);
  const attacker = pos.board[moveFrom(move)];
  const victimValue = victim ? PIECE_VALUE[victim & 7] : PIECE_VALUE[1];
  return victimValue * 16 - PIECE_VALUE[attacker & 7] + 100000;
}

function scoreMoves(
  ctx: Ctx,
  moves: number[],
  ttBest: number,
  ply: number,
): Int32Array {
  const scores = new Int32Array(moves.length);
  const k1 = killers[ply * 2];
  const k2 = killers[ply * 2 + 1];
  const color = ctx.pos.turn;

  for (let i = 0; i < moves.length; i += 1) {
    const m = moves[i];
    if (m === ttBest) {
      scores[i] = 1_000_000;
    } else if (moveIsCapture(m)) {
      scores[i] = captureScore(ctx.pos, m);
    } else if (movePromotion(m)) {
      scores[i] = 90000 + PIECE_VALUE[movePromotion(m)];
    } else if (m === k1) {
      scores[i] = 80000;
    } else if (m === k2) {
      scores[i] = 79000;
    } else {
      scores[i] = history[(color * 128 + moveFrom(m)) * 128 + moveTo(m)];
    }
  }
  return scores;
}

/** Selection sort one move at a time — cheaper than sorting a list we may cut. */
function pickMove(moves: number[], scores: Int32Array, start: number) {
  let best = start;
  for (let i = start + 1; i < moves.length; i += 1) {
    if (scores[i] > scores[best]) best = i;
  }
  if (best !== start) {
    const m = moves[start];
    moves[start] = moves[best];
    moves[best] = m;
    const s = scores[start];
    scores[start] = scores[best];
    scores[best] = s;
  }
}

/* ---------------------------- quiescence ----------------------------- */

/**
 * Search only forcing moves past the horizon. Without this the engine happily
 * plays into a recapture because the depth limit hid it.
 */
function quiescence(ctx: Ctx, alpha: number, beta: number, ply: number): number {
  ctx.nodes += 1;
  if ((ctx.nodes & 2047) === 0 && Date.now() > ctx.deadline) {
    ctx.aborted = true;
    return 0;
  }

  const standPat = evaluate(ctx.pos);
  if (standPat >= beta) return beta;
  if (standPat > alpha) alpha = standPat;
  if (ply >= MAX_PLY - 1) return standPat;

  const moves = generateMoves(ctx.pos, true);
  const scores = new Int32Array(moves.length);
  for (let i = 0; i < moves.length; i += 1) scores[i] = captureScore(ctx.pos, moves[i]);

  for (let i = 0; i < moves.length; i += 1) {
    pickMove(moves, scores, i);
    const m = moves[i];

    // Delta pruning: skip captures that cannot possibly raise alpha.
    const victim = moveCaptured(m);
    if (victim && standPat + PIECE_VALUE[victim & 7] + 200 < alpha) continue;

    const undo = makeMove(ctx.pos, m);
    if (isSquareAttacked(ctx.pos, ctx.pos.kings[ctx.pos.turn ^ 1], ctx.pos.turn)) {
      unmakeMove(ctx.pos, m, undo);
      continue;
    }
    const score = -quiescence(ctx, -beta, -alpha, ply + 1);
    unmakeMove(ctx.pos, m, undo);

    if (ctx.aborted) return 0;
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }

  return alpha;
}

/* ------------------------------- search ------------------------------ */

function search(
  ctx: Ctx,
  depth: number,
  alpha: number,
  beta: number,
  ply: number,
  allowNull: boolean,
): number {
  if (ply > 0 && isRepetitionOrFifty(ctx.pos)) return 0;

  const alphaOrig = alpha;
  const index = (ctx.pos.hashLo >>> 0) & TT_MASK;
  let ttBest = 0;

  if (ttLo[index] === ctx.pos.hashLo && ttHi[index] === ctx.pos.hashHi) {
    ttBest = ttMove[index];
    const entryDepth = ttMeta[index] >> 2;
    if (ply > 0 && entryDepth >= depth) {
      const flag = ttMeta[index] & 3;
      let score = ttScore[index];
      if (score > MATE_THRESHOLD) score -= ply;
      else if (score < -MATE_THRESHOLD) score += ply;
      if (flag === EXACT) return score;
      if (flag === LOWER && score > alpha) alpha = score;
      else if (flag === UPPER && score < beta) beta = score;
      if (alpha >= beta) return score;
    }
  }

  if (depth <= 0) return quiescence(ctx, alpha, beta, ply);

  ctx.nodes += 1;
  if ((ctx.nodes & 2047) === 0 && Date.now() > ctx.deadline) {
    ctx.aborted = true;
    return 0;
  }

  const checked = inCheck(ctx.pos);
  if (checked) depth += 1; // check extension

  // Null-move pruning. Skipped in check and in likely-zugzwang endings, where
  // "passing" is not a valid null hypothesis.
  if (
    allowNull &&
    !checked &&
    depth >= 3 &&
    ply > 0 &&
    hasNonPawnMaterial(ctx.pos, ctx.pos.turn)
  ) {
    const undo = makeNullMove(ctx.pos);
    const R = depth > 6 ? 3 : 2;
    const score = -search(ctx, depth - 1 - R, -beta, -beta + 1, ply + 1, false);
    unmakeNullMove(ctx.pos, undo);
    if (ctx.aborted) return 0;
    if (score >= beta) return beta;
  }

  const moves = generateMoves(ctx.pos);
  const scores = scoreMoves(ctx, moves, ttBest, ply);

  let best = -MATE * 2;
  let bestMove = 0;
  let legalCount = 0;

  for (let i = 0; i < moves.length; i += 1) {
    pickMove(moves, scores, i);
    const m = moves[i];

    const undo = makeMove(ctx.pos, m);
    if (isSquareAttacked(ctx.pos, ctx.pos.kings[ctx.pos.turn ^ 1], ctx.pos.turn)) {
      unmakeMove(ctx.pos, m, undo);
      continue;
    }
    legalCount += 1;

    let score: number;
    if (legalCount === 1) {
      score = -search(ctx, depth - 1, -beta, -alpha, ply + 1, true);
    } else {
      // Late move reductions on quiet moves that ordering ranked poorly.
      let reduction = 0;
      if (depth >= 3 && legalCount > 3 && !moveIsCapture(m) && !movePromotion(m) && !checked) {
        reduction = legalCount > 6 ? 2 : 1;
      }
      score = -search(ctx, depth - 1 - reduction, -alpha - 1, -alpha, ply + 1, true);
      if (score > alpha && reduction > 0) {
        score = -search(ctx, depth - 1, -alpha - 1, -alpha, ply + 1, true);
      }
      if (score > alpha && score < beta) {
        score = -search(ctx, depth - 1, -beta, -alpha, ply + 1, true);
      }
    }

    unmakeMove(ctx.pos, m, undo);
    if (ctx.aborted) return 0;

    if (score > best) {
      best = score;
      bestMove = m;
      if (score > alpha) {
        alpha = score;
        if (alpha >= beta) {
          if (!moveIsCapture(m)) {
            const slot = ply * 2;
            if (killers[slot] !== m) {
              killers[slot + 1] = killers[slot];
              killers[slot] = m;
            }
            const h = (ctx.pos.turn * 128 + moveFrom(m)) * 128 + moveTo(m);
            history[h] = Math.min(history[h] + depth * depth, 60000);
          }
          break;
        }
      }
    }
  }

  if (legalCount === 0) return checked ? -MATE + ply : 0;

  let stored = best;
  if (stored > MATE_THRESHOLD) stored += ply;
  else if (stored < -MATE_THRESHOLD) stored -= ply;

  // Replace on greater depth or a new generation, so a deep entry from this
  // search is not evicted by a shallow one from the same search.
  const existingDepth = ttMeta[index] >> 2;
  if (ttStamp[index] !== generation || depth >= existingDepth) {
    ttLo[index] = ctx.pos.hashLo;
    ttHi[index] = ctx.pos.hashHi;
    ttMove[index] = bestMove;
    ttScore[index] = stored;
    ttMeta[index] =
      (depth << 2) | (best <= alphaOrig ? UPPER : best >= beta ? LOWER : EXACT);
    ttStamp[index] = generation;
  }

  return best;
}

function hasNonPawnMaterial(pos: Position, color: Color): boolean {
  for (let sq = 0; sq < 128; sq += 1) {
    if (sq & 0x88) {
      sq += 7;
      continue;
    }
    const p = pos.board[sq];
    if (!p || (p >> 3) !== color) continue;
    const t = p & 7;
    if (t >= 2 && t <= 5) return true;
  }
  return false;
}

/** Cheap in-search draw detection; full repetition history lives at game level. */
function isRepetitionOrFifty(pos: Position): boolean {
  return pos.halfmove >= 100;
}

function extractPv(pos: Position, maxLength: number): number[] {
  const pv: number[] = [];
  const undos: Array<{ move: number; undo: ReturnType<typeof makeMove> }> = [];

  for (let i = 0; i < maxLength; i += 1) {
    const index = (pos.hashLo >>> 0) & TT_MASK;
    if (ttLo[index] !== pos.hashLo || ttHi[index] !== pos.hashHi) break;
    const move = ttMove[index];
    if (!move) break;
    const legal = generateLegalMoves(pos);
    if (!legal.includes(move)) break;
    pv.push(move);
    undos.push({ move, undo: makeMove(pos, move) });
  }

  for (let i = undos.length - 1; i >= 0; i -= 1) {
    unmakeMove(pos, undos[i].move, undos[i].undo);
  }
  return pv;
}

let rngState = 0x2f6e2b1;
function rng(): number {
  rngState ^= rngState << 13;
  rngState ^= rngState >>> 17;
  rngState ^= rngState << 5;
  return ((rngState >>> 0) % 100000) / 100000;
}

/**
 * Iterative deepening with aspiration-free full windows at the root. Each
 * completed depth replaces the answer, so an aborted search still returns the
 * best move from the last depth that finished.
 */
export function findBestMove(
  position: Position,
  limits: SearchLimits,
  onProgress?: (info: SearchResult) => void,
): SearchResult {
  const pos = position;
  const started = Date.now();
  generation = (generation + 1) | 0;
  killers.fill(0);
  for (let i = 0; i < history.length; i += 1) history[i] = (history[i] / 8) | 0;
  if (limits.seed !== undefined) rngState = limits.seed | 0 || 1;

  const ctx: Ctx = {
    pos,
    nodes: 0,
    deadline: started + Math.max(30, limits.timeMs),
    aborted: false,
    rootColor: pos.turn,
  };

  const rootMoves = generateLegalMoves(pos);
  if (rootMoves.length === 0) {
    return { move: 0, score: 0, depth: 0, nodes: 0, timeMs: 0, pv: [], mateIn: null };
  }

  let result: SearchResult = {
    move: rootMoves[0],
    score: 0,
    depth: 0,
    nodes: 0,
    timeMs: 0,
    pv: [],
    mateIn: null,
  };

  const scoredRoot: Array<{ move: number; score: number }> = [];

  // Levels that choose among near-best moves need true scores for every root
  // move. Narrowing alpha as the root loop proceeds makes every later move fail
  // low and report an upper bound instead of its real value, so the "within N
  // centipawns" pool would be built from meaningless numbers. Full windows at
  // the root cost cutoffs, which only these shallow levels can afford.
  const wantsTrueRootScores = (limits.randomness ?? 0) > 0;

  for (let depth = 1; depth <= limits.depth; depth += 1) {
    let alpha = -MATE * 2;
    const beta = MATE * 2;
    let bestMove = 0;
    const thisDepth: Array<{ move: number; score: number }> = [];

    const ordered = [...rootMoves];
    if (result.move) {
      const i = ordered.indexOf(result.move);
      if (i > 0) ordered.splice(0, 0, ordered.splice(i, 1)[0]);
    }

    for (const m of ordered) {
      const undo = makeMove(pos, m);
      const window = wantsTrueRootScores ? MATE * 2 : -alpha;
      const score = -search(ctx, depth - 1, -beta, window, 1, true);
      unmakeMove(pos, m, undo);
      if (ctx.aborted) break;

      thisDepth.push({ move: m, score });
      if (score > alpha) {
        alpha = score;
        bestMove = m;
      }
    }

    if (ctx.aborted && depth > 1) break;
    if (!bestMove && thisDepth.length === 0) break;

    if (bestMove) {
      scoredRoot.length = 0;
      scoredRoot.push(...thisDepth.sort((a, b) => b.score - a.score));
      const pv = extractPv(pos, depth);
      result = {
        move: bestMove,
        score: alpha,
        depth,
        nodes: ctx.nodes,
        timeMs: Date.now() - started,
        pv: pv.length ? pv : [bestMove],
        mateIn:
          Math.abs(alpha) > MATE_THRESHOLD
            ? Math.sign(alpha) * Math.ceil((MATE - Math.abs(alpha)) / 2)
            : null,
      };
      onProgress?.(result);
    }

    if (Math.abs(alpha) > MATE_THRESHOLD) break; // mate found, no need to go deeper
    if (Date.now() - started > limits.timeMs * 0.5) break;
  }

  // Weaker levels pick from among the near-best moves rather than always the top
  // one. The pool is capped and weighted toward the front: a flat pick over
  // every move within the window makes the opening look silly, because dozens of
  // first moves evaluate within a few centipawns of each other.
  const spread = limits.randomness ?? 0;
  if (spread > 0 && scoredRoot.length > 1) {
    const best = scoredRoot[0].score;
    const pool = scoredRoot.filter((e) => best - e.score <= spread).slice(0, 4);
    const weights = [0.55, 0.25, 0.13, 0.07].slice(0, pool.length);
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rng() * total;
    let picked = pool[0];
    for (let i = 0; i < pool.length; i += 1) {
      r -= weights[i];
      if (r <= 0) {
        picked = pool[i];
        break;
      }
    }
    result = { ...result, move: picked.move, score: picked.score };
  }

  result.timeMs = Date.now() - started;
  result.nodes = ctx.nodes;
  return result;
}
