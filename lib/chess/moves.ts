import { CASTLE_KEYS, EP_KEYS, PIECE_KEYS, SIDE_KEY } from './zobrist';
import {
  BISHOP,
  BLACK,
  CASTLE_BK,
  CASTLE_BQ,
  CASTLE_WK,
  CASTLE_WQ,
  FLAG_CASTLE_K,
  FLAG_CASTLE_Q,
  FLAG_DOUBLE,
  FLAG_EP,
  KING,
  KNIGHT,
  PAWN,
  QUEEN,
  ROOK,
  SQ_A1,
  SQ_A8,
  SQ_E1,
  SQ_E8,
  SQ_H1,
  SQ_H8,
  WHITE,
  encodeMove,
  makePiece,
  moveCaptured,
  moveFrom,
  moveIsCastleK,
  moveIsCastleQ,
  moveIsEp,
  movePromotion,
  moveTo,
  onBoard,
  pieceColor,
  pieceType,
  type Color,
  type Position,
  type Undo,
} from './types';

const KNIGHT_DELTAS = [31, 33, 14, 18, -31, -33, -14, -18];
const BISHOP_DELTAS = [15, 17, -15, -17];
const ROOK_DELTAS = [1, 16, -1, -16];
const KING_DELTAS = [1, 16, -1, -16, 15, 17, -15, -17];

/**
 * Castling rights are cleared whenever a king or rook leaves — or is captured
 * on — its home square. This table maps each such square to the mask of rights
 * that survive touching it, so make() needs one AND per endpoint.
 */
const CASTLE_MASK = new Int8Array(128).fill(0xf);
CASTLE_MASK[SQ_E1] = ~(CASTLE_WK | CASTLE_WQ) & 0xf;
CASTLE_MASK[SQ_H1] = ~CASTLE_WK & 0xf;
CASTLE_MASK[SQ_A1] = ~CASTLE_WQ & 0xf;
CASTLE_MASK[SQ_E8] = ~(CASTLE_BK | CASTLE_BQ) & 0xf;
CASTLE_MASK[SQ_H8] = ~CASTLE_BK & 0xf;
CASTLE_MASK[SQ_A8] = ~CASTLE_BQ & 0xf;

/* ------------------------------------------------------------------ *
 * Attack detection
 * ------------------------------------------------------------------ */

/** Is `sq` attacked by any piece of colour `by`? */
export function isSquareAttacked(pos: Position, sq: number, by: Color): boolean {
  const board = pos.board;

  // Pawns. A white pawn attacking `sq` sits one rank below it, diagonally.
  if (by === WHITE) {
    const a = sq - 17;
    const b = sq - 15;
    if (onBoard(a) && board[a] === makePiece(PAWN, WHITE)) return true;
    if (onBoard(b) && board[b] === makePiece(PAWN, WHITE)) return true;
  } else {
    const a = sq + 17;
    const b = sq + 15;
    if (onBoard(a) && board[a] === makePiece(PAWN, BLACK)) return true;
    if (onBoard(b) && board[b] === makePiece(PAWN, BLACK)) return true;
  }

  const knight = makePiece(KNIGHT, by);
  for (let i = 0; i < 8; i += 1) {
    const t = sq + KNIGHT_DELTAS[i];
    if (onBoard(t) && board[t] === knight) return true;
  }

  const king = makePiece(KING, by);
  for (let i = 0; i < 8; i += 1) {
    const t = sq + KING_DELTAS[i];
    if (onBoard(t) && board[t] === king) return true;
  }

  const bishop = makePiece(BISHOP, by);
  const queen = makePiece(QUEEN, by);
  for (let i = 0; i < 4; i += 1) {
    const d = BISHOP_DELTAS[i];
    for (let t = sq + d; onBoard(t); t += d) {
      const p = board[t];
      if (p) {
        if (p === bishop || p === queen) return true;
        break;
      }
    }
  }

  const rook = makePiece(ROOK, by);
  for (let i = 0; i < 4; i += 1) {
    const d = ROOK_DELTAS[i];
    for (let t = sq + d; onBoard(t); t += d) {
      const p = board[t];
      if (p) {
        if (p === rook || p === queen) return true;
        break;
      }
    }
  }

  return false;
}

export const inCheck = (pos: Position, color: Color = pos.turn): boolean =>
  isSquareAttacked(pos, pos.kings[color], (color ^ 1) as Color);

/* ------------------------------------------------------------------ *
 * Move generation
 * ------------------------------------------------------------------ */

const PROMOTIONS = [QUEEN, ROOK, BISHOP, KNIGHT];

/**
 * Pseudo-legal moves — everything that moves like a legal move but may leave
 * the mover's own king in check. Callers filter with `isLegal`, which is how
 * pins and discovered checks are handled without a separate pin detector.
 */
export function generateMoves(pos: Position, capturesOnly = false): number[] {
  const moves: number[] = [];
  const board = pos.board;
  const us = pos.turn;
  const them = (us ^ 1) as Color;

  for (let sq = 0; sq < 128; sq += 1) {
    if (sq & 0x88) {
      sq += 7; // skip the off-board half of the rank in one jump
      continue;
    }
    const piece = board[sq];
    if (!piece || pieceColor(piece) !== us) continue;
    const type = pieceType(piece);

    if (type === PAWN) {
      const forward = us === WHITE ? 16 : -16;
      const startRank = us === WHITE ? 1 : 6;
      const promoRank = us === WHITE ? 7 : 0;
      const one = sq + forward;

      if (!capturesOnly && onBoard(one) && !board[one]) {
        if (one >> 4 === promoRank) {
          for (const p of PROMOTIONS) moves.push(encodeMove(sq, one, p));
        } else {
          moves.push(encodeMove(sq, one));
          const two = one + forward;
          if (sq >> 4 === startRank && !board[two]) {
            moves.push(encodeMove(sq, two, 0, 0, FLAG_DOUBLE));
          }
        }
      }

      for (const dc of [forward - 1, forward + 1]) {
        const t = sq + dc;
        if (!onBoard(t)) continue;
        const target = board[t];
        if (target && pieceColor(target) === them) {
          if (t >> 4 === promoRank) {
            for (const p of PROMOTIONS) moves.push(encodeMove(sq, t, p, target));
          } else {
            moves.push(encodeMove(sq, t, 0, target));
          }
        } else if (!target && t === pos.ep) {
          moves.push(encodeMove(sq, t, 0, makePiece(PAWN, them), FLAG_EP));
        }
      }
      continue;
    }

    if (type === KNIGHT || type === KING) {
      const deltas = type === KNIGHT ? KNIGHT_DELTAS : KING_DELTAS;
      for (let i = 0; i < 8; i += 1) {
        const t = sq + deltas[i];
        if (!onBoard(t)) continue;
        const target = board[t];
        if (!target) {
          if (!capturesOnly) moves.push(encodeMove(sq, t));
        } else if (pieceColor(target) === them) {
          moves.push(encodeMove(sq, t, 0, target));
        }
      }
      continue;
    }

    // Sliding pieces.
    const deltas =
      type === BISHOP ? BISHOP_DELTAS : type === ROOK ? ROOK_DELTAS : KING_DELTAS;
    const count = type === QUEEN ? 8 : 4;
    for (let i = 0; i < count; i += 1) {
      const d = deltas[i];
      for (let t = sq + d; onBoard(t); t += d) {
        const target = board[t];
        if (!target) {
          if (!capturesOnly) moves.push(encodeMove(sq, t));
          continue;
        }
        if (pieceColor(target) === them) moves.push(encodeMove(sq, t, 0, target));
        break;
      }
    }
  }

  if (!capturesOnly) addCastles(pos, moves);
  return moves;
}

function addCastles(pos: Position, moves: number[]) {
  const board = pos.board;
  const us = pos.turn;
  const them = (us ^ 1) as Color;
  const kingSq = us === WHITE ? SQ_E1 : SQ_E8;
  if (board[kingSq] !== makePiece(KING, us)) return;

  const kingRight = us === WHITE ? CASTLE_WK : CASTLE_BK;
  const queenRight = us === WHITE ? CASTLE_WQ : CASTLE_BQ;

  // The king may not start in check, nor pass through an attacked square. The
  // destination square is covered by the legality filter.
  const startAttacked = isSquareAttacked(pos, kingSq, them);
  if (startAttacked) return;

  if (
    pos.castling & kingRight &&
    !board[kingSq + 1] &&
    !board[kingSq + 2] &&
    board[kingSq + 3] === makePiece(ROOK, us) &&
    !isSquareAttacked(pos, kingSq + 1, them)
  ) {
    moves.push(encodeMove(kingSq, kingSq + 2, 0, 0, FLAG_CASTLE_K));
  }

  if (
    pos.castling & queenRight &&
    !board[kingSq - 1] &&
    !board[kingSq - 2] &&
    !board[kingSq - 3] &&
    board[kingSq - 4] === makePiece(ROOK, us) &&
    !isSquareAttacked(pos, kingSq - 1, them)
  ) {
    moves.push(encodeMove(kingSq, kingSq - 2, 0, 0, FLAG_CASTLE_Q));
  }
}

/** Legal moves — pseudo-legal moves that do not leave the mover in check. */
export function generateLegalMoves(pos: Position, capturesOnly = false): number[] {
  const pseudo = generateMoves(pos, capturesOnly);
  const legal: number[] = [];
  for (let i = 0; i < pseudo.length; i += 1) {
    const m = pseudo[i];
    const undo = makeMove(pos, m);
    // makeMove has already flipped the turn, so the mover is the other side.
    if (!isSquareAttacked(pos, pos.kings[pos.turn ^ 1], pos.turn)) legal.push(m);
    unmakeMove(pos, m, undo);
  }
  return legal;
}

/* ------------------------------------------------------------------ *
 * make / unmake
 * ------------------------------------------------------------------ */

function xorPiece(pos: Position, piece: number, sq: number) {
  const k = piece * 128 + sq;
  pos.hashLo ^= PIECE_KEYS.lo[k];
  pos.hashHi ^= PIECE_KEYS.hi[k];
}

export function makeMove(pos: Position, move: number): Undo {
  const undo: Undo = {
    castling: pos.castling,
    ep: pos.ep,
    halfmove: pos.halfmove,
    hashLo: pos.hashLo,
    hashHi: pos.hashHi,
  };

  const board = pos.board;
  const from = moveFrom(move);
  const to = moveTo(move);
  const piece = board[from];
  const type = pieceType(piece);
  const us = pos.turn;
  const them = (us ^ 1) as Color;
  const promotion = movePromotion(move);
  const captured = moveCaptured(move);

  // Hash out the state fields that are about to change.
  pos.hashLo ^= CASTLE_KEYS.lo[pos.castling];
  pos.hashHi ^= CASTLE_KEYS.hi[pos.castling];
  if (pos.ep >= 0) {
    pos.hashLo ^= EP_KEYS.lo[pos.ep & 7];
    pos.hashHi ^= EP_KEYS.hi[pos.ep & 7];
  }

  xorPiece(pos, piece, from);
  board[from] = 0;

  if (moveIsEp(move)) {
    const capSq = us === WHITE ? to - 16 : to + 16;
    xorPiece(pos, board[capSq], capSq);
    board[capSq] = 0;
  } else if (captured) {
    xorPiece(pos, captured, to);
  }

  const placed = promotion ? makePiece(promotion, us) : piece;
  board[to] = placed;
  xorPiece(pos, placed, to);

  if (moveIsCastleK(move)) {
    const rookFrom = to + 1;
    const rookTo = to - 1;
    const rook = board[rookFrom];
    board[rookFrom] = 0;
    board[rookTo] = rook;
    xorPiece(pos, rook, rookFrom);
    xorPiece(pos, rook, rookTo);
  } else if (moveIsCastleQ(move)) {
    const rookFrom = to - 2;
    const rookTo = to + 1;
    const rook = board[rookFrom];
    board[rookFrom] = 0;
    board[rookTo] = rook;
    xorPiece(pos, rook, rookFrom);
    xorPiece(pos, rook, rookTo);
  }

  if (type === KING) pos.kings[us] = to;

  pos.castling &= CASTLE_MASK[from] & CASTLE_MASK[to];
  pos.ep = (move & FLAG_DOUBLE) !== 0 ? (us === WHITE ? from + 16 : from - 16) : -1;

  pos.halfmove = type === PAWN || captured ? 0 : pos.halfmove + 1;
  if (us === BLACK) pos.fullmove += 1;
  pos.turn = them;

  pos.hashLo ^= CASTLE_KEYS.lo[pos.castling];
  pos.hashHi ^= CASTLE_KEYS.hi[pos.castling];
  if (pos.ep >= 0) {
    pos.hashLo ^= EP_KEYS.lo[pos.ep & 7];
    pos.hashHi ^= EP_KEYS.hi[pos.ep & 7];
  }
  pos.hashLo ^= SIDE_KEY.lo;
  pos.hashHi ^= SIDE_KEY.hi;

  return undo;
}

export function unmakeMove(pos: Position, move: number, undo: Undo) {
  const board = pos.board;
  const from = moveFrom(move);
  const to = moveTo(move);
  const them = pos.turn;
  const us = (them ^ 1) as Color;
  const promotion = movePromotion(move);
  const captured = moveCaptured(move);

  pos.turn = us;
  if (us === BLACK) pos.fullmove -= 1;

  const moved = promotion ? makePiece(PAWN, us) : board[to];
  board[from] = moved;
  board[to] = 0;

  if (moveIsEp(move)) {
    board[us === WHITE ? to - 16 : to + 16] = makePiece(PAWN, them);
  } else if (captured) {
    board[to] = captured;
  }

  if (moveIsCastleK(move)) {
    const rookFrom = to + 1;
    const rookTo = to - 1;
    board[rookFrom] = board[rookTo];
    board[rookTo] = 0;
  } else if (moveIsCastleQ(move)) {
    const rookFrom = to - 2;
    const rookTo = to + 1;
    board[rookFrom] = board[rookTo];
    board[rookTo] = 0;
  }

  if (pieceType(moved) === KING) pos.kings[us] = from;

  pos.castling = undo.castling;
  pos.ep = undo.ep;
  pos.halfmove = undo.halfmove;
  pos.hashLo = undo.hashLo;
  pos.hashHi = undo.hashHi;
}

/** Null move — used by the search to detect zugzwang-free cutoffs. */
export function makeNullMove(pos: Position): Undo {
  const undo: Undo = {
    castling: pos.castling,
    ep: pos.ep,
    halfmove: pos.halfmove,
    hashLo: pos.hashLo,
    hashHi: pos.hashHi,
  };
  if (pos.ep >= 0) {
    pos.hashLo ^= EP_KEYS.lo[pos.ep & 7];
    pos.hashHi ^= EP_KEYS.hi[pos.ep & 7];
  }
  pos.ep = -1;
  pos.turn = (pos.turn ^ 1) as Color;
  pos.hashLo ^= SIDE_KEY.lo;
  pos.hashHi ^= SIDE_KEY.hi;
  return undo;
}

export function unmakeNullMove(pos: Position, undo: Undo) {
  pos.turn = (pos.turn ^ 1) as Color;
  pos.castling = undo.castling;
  pos.ep = undo.ep;
  pos.halfmove = undo.halfmove;
  pos.hashLo = undo.hashLo;
  pos.hashHi = undo.hashHi;
}
