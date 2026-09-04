import type { SearchLimits } from '../chess/search';

export type Level = 'novice' | 'casual' | 'club' | 'expert' | 'master';

export interface LevelSpec extends SearchLimits {
  id: Level;
  name: string;
  blurb: string;
  /** Rough playing strength, for the UI only. */
  elo: string;
}

/**
 * Weaker levels are not made weak by adding random blunders — they search less
 * deeply and choose from among near-equal moves, which loses games the way a
 * weaker human does rather than by hanging a queen at random.
 */
export const LEVELS: Record<Level, LevelSpec> = {
  novice: {
    id: 'novice',
    name: 'Novice',
    blurb: '2-ply search, plays the first plausible idea',
    elo: '~600',
    depth: 2,
    timeMs: 250,
    randomness: 150,
  },
  casual: {
    id: 'casual',
    name: 'Casual',
    blurb: 'Sees one-move tactics, misses deeper traps',
    elo: '~1000',
    depth: 3,
    timeMs: 500,
    randomness: 60,
  },
  club: {
    id: 'club',
    name: 'Club',
    blurb: 'Solid tactics to four plies, punishes hanging pieces',
    elo: '~1450',
    depth: 5,
    timeMs: 1200,
    randomness: 22,
  },
  expert: {
    id: 'expert',
    name: 'Expert',
    blurb: 'Deep search with quiescence — no free material',
    elo: '~1800',
    depth: 8,
    timeMs: 2500,
    randomness: 0,
  },
  master: {
    id: 'master',
    name: 'Master',
    blurb: 'Full strength, five seconds a move',
    elo: '~2100',
    depth: 20,
    timeMs: 5000,
    randomness: 0,
  },
};

export const LEVEL_ORDER: Level[] = ['novice', 'casual', 'club', 'expert', 'master'];
