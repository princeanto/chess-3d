import { fileOf, rankOf } from '@/lib/chess/types';

/**
 * World placement. The board is centred on the origin with one unit per square;
 * rank 1 sits at +Z so White is nearest the default camera.
 */
export const SQUARE = 1;
export const BOARD_TOP = 0.24; // y of the playing surface

export const squareToWorld = (sq: number): [number, number, number] => [
  fileOf(sq) - 3.5,
  BOARD_TOP,
  3.5 - rankOf(sq),
];

export const worldToSquare = (x: number, z: number): number => {
  const file = Math.round(x + 3.5);
  const rank = Math.round(3.5 - z);
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return -1;
  return (rank << 4) | file;
};
