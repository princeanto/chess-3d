/**
 * What this device remembers: theme, favourites, which tools get used, and a
 * few preferences. Tool usage is names and counts only — never what you typed
 * or which files you opened.
 *
 * Every call survives storage being refused, as in some private windows; the
 * app then works for the session and forgets on close.
 */

const PREFIX = 'pocket.';

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export interface Usage { id: string; at: number; count: number }

export const RECENT_LIMIT = 12;

export function recordUse(list: readonly Usage[], id: string, now = Date.now()): Usage[] {
  const existing = list.find((u) => u.id === id);
  const entry = { id, at: now, count: (existing?.count ?? 0) + 1 };
  return [entry, ...list.filter((u) => u.id !== id)].slice(0, RECENT_LIMIT);
}

/** Everything under this app's name: preferences, favourites, drafts. The offline copy of the app stays. */
export async function clearLocalData(): Promise<void> {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key?.startsWith(PREFIX)) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch {
    /* nothing to clear */
  }
  try {
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase('pocket-tools');
      request.onsuccess = request.onerror = request.onblocked = () => resolve();
    });
  } catch {
    /* no IndexedDB */
  }
}
