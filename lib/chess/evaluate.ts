import {
  BISHOP,
  BLACK,
  KING,
  KNIGHT,
  PAWN,
  QUEEN,
  ROOK,
  WHITE,
  fileOf,
  pieceColor,
  pieceType,
  rankOf,
  squareToIndex,
  type Color,
  type Position,
} from './types';

export const PIECE_VALUE = [0, 100, 320, 330, 500, 900, 0];
/** Phase weights: the position is "endgame" once the heavy pieces are gone. */
const PHASE_WEIGHT = [0, 0, 1, 1, 2, 4, 0];
const TOTAL_PHASE = 24;

/**
 * Piece-square tables, written rank 8 at the top so they read like a board.
 * Values are White's view; Black mirrors vertically.
 */
const table = (rows: number[]) => Int16Array.from(rows);

const PAWN_MG = table([
   0,  0,  0,  0,  0,  0,  0,  0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
   5,  5, 10, 25, 25, 10,  5,  5,
   0,  0,  0, 20, 20,  0,  0,  0,
   5, -5,-10,  0,  0,-10, -5,  5,
   5, 10, 10,-20,-20, 10, 10,  5,
   0,  0,  0,  0,  0,  0,  0,  0,
]);

const PAWN_EG = table([
   0,  0,  0,  0,  0,  0,  0,  0,
  90, 90, 90, 90, 90, 90, 90, 90,
  55, 55, 55, 55, 55, 55, 55, 55,
  30, 30, 30, 30, 30, 30, 30, 30,
  18, 18, 18, 18, 18, 18, 18, 18,
   8,  8,  8,  8,  8,  8,  8,  8,
   4,  4,  4,  4,  4,  4,  4,  4,
   0,  0,  0,  0,  0,  0,  0,  0,
]);

const KNIGHT_PST = table([
 -50,-40,-30,-30,-30,-30,-40,-50,
 -40,-20,  0,  0,  0,  0,-20,-40,
 -30,  0, 10, 15, 15, 10,  0,-30,
 -30,  5, 15, 20, 20, 15,  5,-30,
 -30,  0, 15, 20, 20, 15,  0,-30,
 -30,  5, 10, 15, 15, 10,  5,-30,
 -40,-20,  0,  5,  5,  0,-20,-40,
 -50,-40,-30,-30,-30,-30,-40,-50,
]);

const BISHOP_PST = table([
 -20,-10,-10,-10,-10,-10,-10,-20,
 -10,  0,  0,  0,  0,  0,  0,-10,
 -10,  0,  5, 10, 10,  5,  0,-10,
 -10,  5,  5, 10, 10,  5,  5,-10,
 -10,  0, 10, 10, 10, 10,  0,-10,
 -10, 10, 10, 10, 10, 10, 10,-10,
 -10,  5,  0,  0,  0,  0,  5,-10,
 -20,-10,-10,-10,-10,-10,-10,-20,
]);

const ROOK_PST = table([
   0,  0,  0,  0,  0,  0,  0,  0,
   5, 10, 10, 10, 10, 10, 10,  5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
   0,  0,  0,  5,  5,  0,  0,  0,
]);

const QUEEN_PST = table([
 -20,-10,-10, -5, -5,-10,-10,-20,
 -10,  0,  0,  0,  0,  0,  0,-10,
 -10,  0,  5,  5,  5,  5,  0,-10,
  -5,  0,  5,  5,  5,  5,  0, -5,
   0,  0,  5,  5,  5,  5,  0, -5,
 -10,  5,  5,  5,  5,  5,  0,-10,
 -10,  0,  5,  0,  0,  0,  0,-10,
 -20,-10,-10, -5, -5,-10,-10,-20,
]);

const KING_MG = table([
 -30,-40,-40,-50,-50,-40,-40,-30,
 -30,-40,-40,-50,-50,-40,-40,-30,
 -30,-40,-40,-50,-50,-40,-40,-30,
 -30,-40,-40,-50,-50,-40,-40,-30,
 -20,-30,-30,-40,-40,-30,-30,-20,
 -10,-20,-20,-20,-20,-20,-20,-10,
  20, 20,  0,  0,  0,  0, 20, 20,
  20, 30, 10,  0,  0, 10, 30, 20,
]);

const KING_EG = table([
 -50,-40,-30,-20,-20,-30,-40,-50,
 -30,-20,-10,  0,  0,-10,-20,-30,
 -30,-10, 20, 30, 30, 20,-10,-30,
 -30,-10, 30, 40, 40, 30,-10,-30,
 -30,-10, 30, 40, 40, 30,-10,-30,
 -30,-10, 20, 30, 30, 20,-10,-30,
 -30,-30,  0,  0,  0,  0,-30,-30,
 -50,-30,-30,-30,-30,-30,-30,-50,
]);

/** Tables are authored rank-8-first; convert an a1=0 index into a table slot. */
const slot = (index: number, color: Color): number =>
  color === WHITE
    ? (7 - (index >> 3)) * 8 + (index & 7)
    : (index >> 3) * 8 + (index & 7);

const BISHOP_PAIR = 32;
const DOUBLED_PAWN = -14;
const ISOLATED_PAWN = -16;
const PASSED_PAWN = [0, 8, 14, 24, 44, 78, 120, 0];
const ROOK_OPEN_FILE = 18;
const ROOK_SEMI_OPEN = 9;

/**
 * Static evaluation in centipawns from the side-to-move's point of view.
 * Tapered between midgame and endgame tables by remaining material, so the king
 * stops hiding and starts marching as pieces come off.
 */
export function evaluate(pos: Position): number {
  let mg = 0;
  let eg = 0;
  let phase = 0;

  const pawnFiles = [new Int8Array(8), new Int8Array(8)];
  const pawnSquares: number[][] = [[], []];
  const bishops = [0, 0];
  const rooks: number[][] = [[], []];

  for (let sq = 0; sq < 128; sq += 1) {
    if (sq & 0x88) {
      sq += 7;
      continue;
    }
    const piece = pos.board[sq];
    if (!piece) continue;

    const color = pieceColor(piece);
    const type = pieceType(piece);
    const index = squareToIndex(sq);
    const s = slot(index, color);
    const sign = color === WHITE ? 1 : -1;

    phase += PHASE_WEIGHT[type];
    const value = PIECE_VALUE[type];
    mg += sign * value;
    eg += sign * value;

    switch (type) {
      case PAWN:
        mg += sign * PAWN_MG[s];
        eg += sign * PAWN_EG[s];
        pawnFiles[color][fileOf(sq)] += 1;
        pawnSquares[color].push(sq);
        break;
      case KNIGHT:
        mg += sign * KNIGHT_PST[s];
        eg += sign * KNIGHT_PST[s];
        break;
      case BISHOP:
        mg += sign * BISHOP_PST[s];
        eg += sign * BISHOP_PST[s];
        bishops[color] += 1;
        break;
      case ROOK:
        mg += sign * ROOK_PST[s];
        eg += sign * ROOK_PST[s];
        rooks[color].push(sq);
        break;
      case QUEEN:
        mg += sign * QUEEN_PST[s];
        eg += sign * QUEEN_PST[s];
        break;
      case KING:
        mg += sign * KING_MG[s];
        eg += sign * KING_EG[s];
        break;
    }
  }

  for (const color of [WHITE, BLACK] as Color[]) {
    const sign = color === WHITE ? 1 : -1;
    const them = (color ^ 1) as Color;

    if (bishops[color] >= 2) {
      mg += sign * BISHOP_PAIR;
      eg += sign * BISHOP_PAIR;
    }

    for (let f = 0; f < 8; f += 1) {
      const count = pawnFiles[color][f];
      if (count > 1) {
        mg += sign * DOUBLED_PAWN * (count - 1);
        eg += sign * DOUBLED_PAWN * (count - 1);
      }
      if (count > 0) {
        const left = f > 0 ? pawnFiles[color][f - 1] : 0;
        const right = f < 7 ? pawnFiles[color][f + 1] : 0;
        if (!left && !right) {
          mg += sign * ISOLATED_PAWN;
          eg += sign * ISOLATED_PAWN;
        }
      }
    }

    for (const sq of pawnSquares[color]) {
      const f = fileOf(sq);
      const r = rankOf(sq);
      let blocked = false;
      for (const sq2 of pawnSquares[them]) {
        const f2 = fileOf(sq2);
        if (Math.abs(f2 - f) > 1) continue;
        const r2 = rankOf(sq2);
        if (color === WHITE ? r2 > r : r2 < r) {
          blocked = true;
          break;
        }
      }
      if (!blocked) {
        const advance = color === WHITE ? r : 7 - r;
        mg += sign * PASSED_PAWN[advance] * 0.5;
        eg += sign * PASSED_PAWN[advance];
      }
    }

    for (const sq of rooks[color]) {
      const f = fileOf(sq);
      if (!pawnFiles[color][f]) {
        const bonus = pawnFiles[them][f] ? ROOK_SEMI_OPEN : ROOK_OPEN_FILE;
        mg += sign * bonus;
        eg += sign * bonus;
      }
    }
  }

  const p = Math.min(phase, TOTAL_PHASE);
  const score = (mg * p + eg * (TOTAL_PHASE - p)) / TOTAL_PHASE;
  return Math.round(pos.turn === WHITE ? score : -score);
}
