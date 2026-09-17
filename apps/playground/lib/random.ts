/**
 * Seeded randomness, shared by every tool.
 *
 * Nothing in Playground calls Math.random() to make something. Every palette,
 * pattern, poster and challenge comes from a seed, which is what makes the work
 * reproducible — copy a seed, get the same thing back — and what lets Recent
 * store a tiny recipe instead of a picture.
 *
 * Mulberry32: a 32-bit generator, fast, small, and statistically fine for
 * choosing colours. It is not for cryptography and does not need to be.
 */

export interface Rng {
  /** [0, 1) */
  next(): number;
  /** [min, max) */
  range(min: number, max: number): number;
  /** Integer in [min, max], both ends included. */
  int(min: number, max: number): number;
  pick<T>(list: readonly T[]): T;
  chance(probability: number): boolean;
  shuffle<T>(list: readonly T[]): T[];
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min, max) => min + next() * (max - min),
    int: (min, max) => Math.floor(min + next() * (max - min + 1)),
    pick: (list) => list[Math.floor(next() * list.length)],
    chance: (probability) => next() < probability,
    shuffle: (list) => {
      const out = list.slice();
      for (let i = out.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
  };
}

/** Six digits, because a seed is something people read aloud and paste. */
export function newSeed(): number {
  return 100000 + Math.floor(Math.random() * 900000);
}

/** Seeds typed or pasted by a person: digits only, otherwise refuse. */
export function parseSeed(text: string): number | null {
  const cleaned = text.trim().replace(/^seed[:\s]*/i, '');
  if (!/^\d{1,9}$/.test(cleaned)) return null;
  return Number(cleaned);
}
