import { BLACK, type Color, type Position } from './types';

/**
 * Zobrist hashing, held as two 32-bit halves because JavaScript bitwise
 * operators are 32-bit. BigInt would be correct too but allocates on every
 * XOR, which the search cannot afford.
 */

function xorshift32(seed: number) {
  let x = seed | 0;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return x | 0;
  };
}

const rand = xorshift32(0x1a2b3c4d);

const alloc = (n: number) => {
  const lo = new Int32Array(n);
  const hi = new Int32Array(n);
  for (let i = 0; i < n; i += 1) {
    lo[i] = rand();
    hi[i] = rand();
  }
  return { lo, hi };
};

/** [pieceCode * 128 + square] */
export const PIECE_KEYS = alloc(15 * 128);
export const CASTLE_KEYS = alloc(16);
/** Indexed by file; en-passant only matters up to its file. */
export const EP_KEYS = alloc(8);
export const SIDE_KEY = { lo: rand(), hi: rand() };

export function hashPosition(pos: Position): { lo: number; hi: number } {
  let lo = 0;
  let hi = 0;
  for (let sq = 0; sq < 128; sq += 1) {
    if (sq & 0x88) continue;
    const piece = pos.board[sq];
    if (!piece) continue;
    const k = piece * 128 + sq;
    lo ^= PIECE_KEYS.lo[k];
    hi ^= PIECE_KEYS.hi[k];
  }
  lo ^= CASTLE_KEYS.lo[pos.castling];
  hi ^= CASTLE_KEYS.hi[pos.castling];
  if (pos.ep >= 0) {
    lo ^= EP_KEYS.lo[pos.ep & 7];
    hi ^= EP_KEYS.hi[pos.ep & 7];
  }
  if (pos.turn === BLACK) {
    lo ^= SIDE_KEY.lo;
    hi ^= SIDE_KEY.hi;
  }
  return { lo, hi };
}

/** Stable string key for repetition tables. */
export const hashKey = (pos: Position): string =>
  `${pos.hashLo >>> 0}:${pos.hashHi >>> 0}`;

export const sideKeyFor = (_color: Color) => SIDE_KEY;
