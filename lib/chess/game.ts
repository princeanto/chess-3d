import { toFen } from './fen';
import { generateLegalMoves, inCheck } from './moves';
import {
  BISHOP,
  BLACK,
  KNIGHT,
  PAWN,
  QUEEN,
  ROOK,
  WHITE,
  fileOf,
  pieceColor,
  pieceType,
  rankOf,
  type Color,
  type Position,
} from './types';

export type GameResult =
  | { over: false; check: boolean }
  | {
      over: true;
      check: boolean;
      reason:
        | 'checkmate'
        | 'stalemate'
        | 'fifty-move'
        | 'threefold'
        | 'insufficient-material';
      winner: Color | null;
    };

/**
 * Insufficient material, using the FIDE "dead position" set that can be decided
 * without search: K vs K, K+minor vs K, and K+B vs K+B with both bishops on the
 * same colour complex. Anything else is at least theoretically winnable.
 */
export function isInsufficientMaterial(pos: Position): boolean {
  const minors: number[] = [];
  let bishops = 0;
  let knights = 0;

  for (let sq = 0; sq < 128; sq += 1) {
    if (sq & 0x88) {
      sq += 7;
      continue;
    }
    const piece = pos.board[sq];
    if (!piece) continue;
    const type = pieceType(piece);
    if (type === PAWN || type === ROOK || type === QUEEN) return false;
    if (type === BISHOP) {
      bishops += 1;
      minors.push((fileOf(sq) + rankOf(sq)) & 1);
    } else if (type === KNIGHT) {
      knights += 1;
      minors.push(-1);
    }
  }

  if (bishops + knights === 0) return true; // K vs K
  if (bishops + knights === 1) return true; // K + one minor vs K
  if (knights === 0 && bishops === 2) {
    // Two bishops only draw when they share a colour complex.
    const squares = minors.filter((c) => c >= 0);
    return squares[0] === squares[1];
  }
  return false;
}

/** Position key ignoring move counters — what repetition actually compares. */
export function repetitionKey(pos: Position): string {
  const fen = toFen(pos);
  return fen.split(' ').slice(0, 4).join(' ');
}

export function evaluateResult(
  pos: Position,
  repetitions: Map<string, number>,
): GameResult {
  const check = inCheck(pos);
  const legal = generateLegalMoves(pos);

  if (legal.length === 0) {
    return check
      ? {
          over: true,
          check: true,
          reason: 'checkmate',
          winner: (pos.turn ^ 1) as Color,
        }
      : { over: true, check: false, reason: 'stalemate', winner: null };
  }

  if (isInsufficientMaterial(pos)) {
    return { over: true, check, reason: 'insufficient-material', winner: null };
  }

  if ((repetitions.get(repetitionKey(pos)) ?? 0) >= 3) {
    return { over: true, check, reason: 'threefold', winner: null };
  }

  // The fifty-move rule counts full moves, so 100 plies without a pawn move or
  // capture. Checkmate delivered on the hundredth ply still stands, which is why
  // this is tested after the mate check.
  if (pos.halfmove >= 100) {
    return { over: true, check, reason: 'fifty-move', winner: null };
  }

  return { over: false, check };
}

export function resultText(result: GameResult): string {
  if (!result.over) return result.check ? 'Check' : '';
  switch (result.reason) {
    case 'checkmate':
      return `Checkmate — ${result.winner === WHITE ? 'White' : 'Black'} wins`;
    case 'stalemate':
      return 'Draw — stalemate';
    case 'fifty-move':
      return 'Draw — fifty-move rule';
    case 'threefold':
      return 'Draw — threefold repetition';
    case 'insufficient-material':
      return 'Draw — insufficient material';
  }
}

export function resultScore(result: GameResult): string {
  if (!result.over) return '*';
  if (result.reason === 'checkmate') return result.winner === WHITE ? '1-0' : '0-1';
  return '1/2-1/2';
}

export const colorName = (c: Color): string => (c === WHITE ? 'White' : 'Black');
export { BLACK, WHITE };
