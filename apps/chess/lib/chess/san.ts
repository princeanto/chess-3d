import { generateLegalMoves, inCheck, makeMove, unmakeMove } from './moves';
import {
  BISHOP,
  KING,
  KNIGHT,
  PAWN,
  QUEEN,
  ROOK,
  fileOf,
  moveFrom,
  moveIsCapture,
  moveIsCastleK,
  moveIsCastleQ,
  movePromotion,
  moveTo,
  pieceType,
  rankOf,
  squareName,
  type Position,
} from './types';

const LETTER: Record<number, string> = {
  [KNIGHT]: 'N',
  [BISHOP]: 'B',
  [ROOK]: 'R',
  [QUEEN]: 'Q',
  [KING]: 'K',
};

const FILES = 'abcdefgh';

/**
 * Standard Algebraic Notation.
 *
 * Disambiguation follows the FIDE rule: prefer the file, fall back to the rank,
 * and use both only when two same-type pieces share file and rank lines to the
 * destination — which is reachable with three queens after promotion.
 */
export function toSan(pos: Position, move: number, legal?: number[]): string {
  if (moveIsCastleK(move)) return withSuffix(pos, move, 'O-O');
  if (moveIsCastleQ(move)) return withSuffix(pos, move, 'O-O-O');

  const from = moveFrom(move);
  const to = moveTo(move);
  const piece = pos.board[from];
  const type = pieceType(piece);
  const capture = moveIsCapture(move);
  const promotion = movePromotion(move);

  let san = '';

  if (type === PAWN) {
    if (capture) san += `${FILES[fileOf(from)]}x`;
    san += squareName(to);
    if (promotion) san += `=${LETTER[promotion]}`;
  } else {
    san += LETTER[type];

    const moves = legal ?? generateLegalMoves(pos);
    const rivals = moves.filter(
      (m) =>
        m !== move &&
        moveTo(m) === to &&
        pieceType(pos.board[moveFrom(m)]) === type &&
        moveFrom(m) !== from,
    );

    if (rivals.length) {
      const sameFile = rivals.some((m) => fileOf(moveFrom(m)) === fileOf(from));
      const sameRank = rivals.some((m) => rankOf(moveFrom(m)) === rankOf(from));
      if (!sameFile) san += FILES[fileOf(from)];
      else if (!sameRank) san += String(rankOf(from) + 1);
      else san += squareName(from);
    }

    if (capture) san += 'x';
    san += squareName(to);
  }

  return withSuffix(pos, move, san);
}

/** Appends '+' or '#' by actually playing the move and asking the position. */
function withSuffix(pos: Position, move: number, san: string): string {
  const undo = makeMove(pos, move);
  let suffix = '';
  if (inCheck(pos)) {
    suffix = generateLegalMoves(pos).length === 0 ? '#' : '+';
  }
  unmakeMove(pos, move, undo);
  return san + suffix;
}

/** Long algebraic / UCI form, e.g. e2e4, e7e8q. */
export function toUci(move: number): string {
  const promo = movePromotion(move);
  const letters: Record<number, string> = {
    [QUEEN]: 'q',
    [ROOK]: 'r',
    [BISHOP]: 'b',
    [KNIGHT]: 'n',
  };
  return (
    squareName(moveFrom(move)) +
    squareName(moveTo(move)) +
    (promo ? letters[promo] : '')
  );
}
