/**
 * Randomness from the Web Crypto API.
 *
 * Math.random is fine for a shuffle nobody depends on, but a password generator
 * built on it is a liability, and dice that are merely "random-looking" are an
 * argument waiting to happen. Every integer here comes from crypto, with
 * rejection sampling so no outcome is even slightly more likely than another.
 */

function uint32(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0];
}

/** A uniformly random integer from min to max, inclusive. */
export function randomInt(min: number, max: number): number {
  const lo = Math.ceil(Math.min(min, max));
  const hi = Math.floor(Math.max(min, max));
  const range = hi - lo + 1;
  if (range <= 1) return lo;
  if (range > 2 ** 32) {
    // Two draws for ranges beyond 32 bits.
    const big = (uint32() * 2 ** 21 + (uint32() >>> 11)) / 2 ** 53;
    return lo + Math.floor(big * range);
  }
  const limit = 2 ** 32 - (2 ** 32 % range);
  let x = uint32();
  while (x >= limit) x = uint32();
  return lo + (x % range);
}

/** A float in [0, 1), for shuffles. */
export const randomFloat = (): number => uint32() / 2 ** 32;

export const pick = <T,>(list: readonly T[]): T => list[randomInt(0, list.length - 1)];

export function shuffle<T>(list: readonly T[]): T[] {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const SETS = {
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lower: 'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.?/~',
};
const AMBIGUOUS = /[Il1O0o]/g;

export interface PasswordOptions { length: number; upper: boolean; lower: boolean; numbers: boolean; symbols: boolean; avoidAmbiguous?: boolean }

/** At least one character from every chosen set, then shuffled, so the guarantee leaves no pattern. */
export function password(o: PasswordOptions): string {
  const sets = (['upper', 'lower', 'numbers', 'symbols'] as const)
    .filter((k) => o[k])
    .map((k) => (o.avoidAmbiguous ? SETS[k].replace(AMBIGUOUS, '') : SETS[k]));
  if (!sets.length) return '';
  const length = Math.max(sets.length, Math.min(256, Math.floor(o.length)));
  const pool = sets.join('');
  const chars = sets.map((set) => set[randomInt(0, set.length - 1)]);
  while (chars.length < length) chars.push(pool[randomInt(0, pool.length - 1)]);
  return shuffle(chars).join('');
}

/** Entropy in bits, and what that means. */
export function strength(o: PasswordOptions): { bits: number; label: 'Weak' | 'Okay' | 'Strong' | 'Very strong' } {
  const pool = (['upper', 'lower', 'numbers', 'symbols'] as const)
    .filter((k) => o[k])
    .reduce((n, k) => n + (o.avoidAmbiguous ? SETS[k].replace(AMBIGUOUS, '') : SETS[k]).length, 0);
  const bits = pool ? o.length * Math.log2(pool) : 0;
  return { bits, label: bits < 45 ? 'Weak' : bits < 64 ? 'Okay' : bits < 100 ? 'Strong' : 'Very strong' };
}

export function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
