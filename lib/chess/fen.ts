import { hashPosition } from './zobrist';
import {
  BISHOP,
  BLACK,
  CASTLE_BK,
  CASTLE_BQ,
  CASTLE_WK,
  CASTLE_WQ,
  KING,
  KNIGHT,
  PAWN,
  QUEEN,
  ROOK,
  WHITE,
  makePiece,
  parseSquare,
  pieceColor,
  pieceType,
  squareName,
  type Color,
  type Position,
} from './types';

export const START_FEN =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const CHAR_TO_TYPE: Record<string, number> = {
  p: PAWN,
  n: KNIGHT,
  b: BISHOP,
  r: ROOK,
  q: QUEEN,
  k: KING,
};

const TYPE_TO_CHAR = ['', 'p', 'n', 'b', 'r', 'q', 'k'];

export function emptyPosition(): Position {
  return {
    board: new Int8Array(128),
    turn: WHITE,
    castling: 0,
    ep: -1,
    halfmove: 0,
    fullmove: 1,
    kings: new Int8Array([-1, -1]),
    hashLo: 0,
    hashHi: 0,
  };
}

export function clonePosition(pos: Position): Position {
  return {
    board: Int8Array.from(pos.board),
    turn: pos.turn,
    castling: pos.castling,
    ep: pos.ep,
    halfmove: pos.halfmove,
    fullmove: pos.fullmove,
    kings: Int8Array.from(pos.kings),
    hashLo: pos.hashLo,
    hashHi: pos.hashHi,
  };
}

export class FenError extends Error {}

export function parseFen(fen: string): Position {
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 4) throw new FenError('FEN needs at least four fields.');
  const [placement, active, castling, ep] = parts;

  const pos = emptyPosition();
  const ranks = placement.split('/');
  if (ranks.length !== 8) throw new FenError('FEN must describe eight ranks.');

  for (let r = 0; r < 8; r += 1) {
    const rank = 7 - r; // FEN starts at rank 8
    let file = 0;
    for (const ch of ranks[r]) {
      if (ch >= '1' && ch <= '8') {
        file += Number(ch);
        continue;
      }
      const type = CHAR_TO_TYPE[ch.toLowerCase()];
      if (!type) throw new FenError(`Unknown piece '${ch}'.`);
      if (file > 7) throw new FenError(`Rank ${rank + 1} overflows.`);
      const color: Color = ch === ch.toUpperCase() ? WHITE : BLACK;
      const sq = (rank << 4) | file;
      pos.board[sq] = makePiece(type, color);
      if (type === KING) pos.kings[color] = sq;
      file += 1;
    }
    if (file !== 8) throw new FenError(`Rank ${rank + 1} has ${file} files.`);
  }

  if (pos.kings[WHITE] < 0 || pos.kings[BLACK] < 0) {
    throw new FenError('Both kings must be on the board.');
  }

  pos.turn = active === 'b' ? BLACK : WHITE;

  pos.castling = 0;
  if (castling !== '-') {
    if (castling.includes('K')) pos.castling |= CASTLE_WK;
    if (castling.includes('Q')) pos.castling |= CASTLE_WQ;
    if (castling.includes('k')) pos.castling |= CASTLE_BK;
    if (castling.includes('q')) pos.castling |= CASTLE_BQ;
  }

  pos.ep = ep && ep !== '-' ? parseSquare(ep) : -1;
  pos.halfmove = parts[4] !== undefined ? Number(parts[4]) || 0 : 0;
  pos.fullmove = parts[5] !== undefined ? Number(parts[5]) || 1 : 1;

  const h = hashPosition(pos);
  pos.hashLo = h.lo;
  pos.hashHi = h.hi;
  return pos;
}

export function toFen(pos: Position): string {
  const rows: string[] = [];
  for (let rank = 7; rank >= 0; rank -= 1) {
    let row = '';
    let empty = 0;
    for (let file = 0; file < 8; file += 1) {
      const piece = pos.board[(rank << 4) | file];
      if (!piece) {
        empty += 1;
        continue;
      }
      if (empty) {
        row += String(empty);
        empty = 0;
      }
      const ch = TYPE_TO_CHAR[pieceType(piece)];
      row += pieceColor(piece) === WHITE ? ch.toUpperCase() : ch;
    }
    if (empty) row += String(empty);
    rows.push(row);
  }

  let rights = '';
  if (pos.castling & CASTLE_WK) rights += 'K';
  if (pos.castling & CASTLE_WQ) rights += 'Q';
  if (pos.castling & CASTLE_BK) rights += 'k';
  if (pos.castling & CASTLE_BQ) rights += 'q';

  return [
    rows.join('/'),
    pos.turn === WHITE ? 'w' : 'b',
    rights || '-',
    pos.ep >= 0 ? squareName(pos.ep) : '-',
    String(pos.halfmove),
    String(pos.fullmove),
  ].join(' ');
}

export const initialPosition = (): Position => parseFen(START_FEN);
