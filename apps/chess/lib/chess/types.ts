/**
 * Core chess types.
 *
 * The board is a 0x88 mailbox: a 128-entry array where a square index is valid
 * exactly when `(sq & 0x88) === 0`. Off-board detection is therefore a single
 * bitwise test, which is what keeps sliding-piece generation branch-cheap.
 *
 *   file = sq & 7          rank = sq >> 4
 *   a1 = 0x00              h8 = 0x77
 */

export const WHITE = 0;
export const BLACK = 1;
export type Color = typeof WHITE | typeof BLACK;

export const EMPTY = 0;
export const PAWN = 1;
export const KNIGHT = 2;
export const BISHOP = 3;
export const ROOK = 4;
export const QUEEN = 5;
export const KING = 6;

export type PieceType =
  | typeof PAWN
  | typeof KNIGHT
  | typeof BISHOP
  | typeof ROOK
  | typeof QUEEN
  | typeof KING;

/** Piece codes: white = type (1-6), black = type | 8 (9-14). 0 is an empty square. */
export const BLACK_FLAG = 8;

export const pieceType = (p: number): number => p & 7;
export const pieceColor = (p: number): Color => ((p >> 3) & 1) as Color;
export const makePiece = (type: number, color: Color): number =>
  color === WHITE ? type : type | BLACK_FLAG;

/** Castling-rights bitmask. */
export const CASTLE_WK = 1;
export const CASTLE_WQ = 2;
export const CASTLE_BK = 4;
export const CASTLE_BQ = 8;

export const SQ_A1 = 0x00;
export const SQ_E1 = 0x04;
export const SQ_H1 = 0x07;
export const SQ_A8 = 0x70;
export const SQ_E8 = 0x74;
export const SQ_H8 = 0x77;

export interface Position {
  board: Int8Array; // 128 entries, 0x88 layout
  turn: Color;
  castling: number;
  ep: number; // en-passant target square, or -1
  halfmove: number; // plies since last capture or pawn move
  fullmove: number;
  kings: Int8Array; // [whiteKingSquare, blackKingSquare]
  hashLo: number; // Zobrist hash, low 32 bits
  hashHi: number; // Zobrist hash, high 32 bits
}

/* ------------------------------------------------------------------ *
 * Move encoding — one 32-bit integer, so search never allocates.
 *
 *   bits  0-6   from square
 *   bits  7-13  to square
 *   bits 14-16  promotion piece type (0 = none)
 *   bits 17-20  captured piece code (0 = none)
 *   bit  21     en-passant capture
 *   bit  22     double pawn push
 *   bit  23     castle kingside
 *   bit  24     castle queenside
 * ------------------------------------------------------------------ */

export const FLAG_EP = 1 << 21;
export const FLAG_DOUBLE = 1 << 22;
export const FLAG_CASTLE_K = 1 << 23;
export const FLAG_CASTLE_Q = 1 << 24;

export const encodeMove = (
  from: number,
  to: number,
  promotion = 0,
  captured = 0,
  flags = 0,
): number => from | (to << 7) | (promotion << 14) | (captured << 17) | flags;

export const moveFrom = (m: number): number => m & 0x7f;
export const moveTo = (m: number): number => (m >> 7) & 0x7f;
export const movePromotion = (m: number): number => (m >> 14) & 7;
export const moveCaptured = (m: number): number => (m >> 17) & 0xf;
export const moveIsEp = (m: number): boolean => (m & FLAG_EP) !== 0;
export const moveIsDouble = (m: number): boolean => (m & FLAG_DOUBLE) !== 0;
export const moveIsCastleK = (m: number): boolean => (m & FLAG_CASTLE_K) !== 0;
export const moveIsCastleQ = (m: number): boolean => (m & FLAG_CASTLE_Q) !== 0;
export const moveIsCastle = (m: number): boolean =>
  (m & (FLAG_CASTLE_K | FLAG_CASTLE_Q)) !== 0;
export const moveIsCapture = (m: number): boolean =>
  moveCaptured(m) !== 0 || moveIsEp(m);

/** State that make() must stash so unmake() can restore it exactly. */
export interface Undo {
  castling: number;
  ep: number;
  halfmove: number;
  hashLo: number;
  hashHi: number;
}

export const onBoard = (sq: number): boolean => (sq & 0x88) === 0;
export const fileOf = (sq: number): number => sq & 7;
export const rankOf = (sq: number): number => sq >> 4;

const FILE_NAMES = 'abcdefgh';

export const squareName = (sq: number): string =>
  `${FILE_NAMES[fileOf(sq)]}${rankOf(sq) + 1}`;

export function parseSquare(name: string): number {
  const file = FILE_NAMES.indexOf(name[0]);
  const rank = Number(name[1]) - 1;
  if (file < 0 || rank < 0 || rank > 7) return -1;
  return (rank << 4) | file;
}

/** 0..63 index used by the renderer, counting a1=0 to h8=63. */
export const squareToIndex = (sq: number): number => rankOf(sq) * 8 + fileOf(sq);
export const indexToSquare = (i: number): number => ((i >> 3) << 4) | (i & 7);
