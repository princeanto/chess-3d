/**
 * Local persistence. Every access is guarded: the game must stay playable in
 * private windows and with site data blocked, where touching localStorage
 * throws rather than returning null.
 */

const BEST = 'runner-best';
const MUTED = 'runner-muted';

export function loadBest(): number {
  try {
    return Number(localStorage.getItem(BEST)) || 0;
  } catch {
    return 0;
  }
}

export function saveBest(score: number) {
  try {
    localStorage.setItem(BEST, String(score));
  } catch {
    // Nothing to do — the score simply will not persist.
  }
}

export function loadMuted(): boolean {
  try {
    return localStorage.getItem(MUTED) === '1';
  } catch {
    return false;
  }
}

export function saveMuted(value: boolean) {
  try {
    localStorage.setItem(MUTED, value ? '1' : '0');
  } catch {
    // As above.
  }
}
