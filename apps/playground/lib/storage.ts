/**
 * Local storage, and only local storage.
 *
 * Small things — preferences, the shared palette, each tool's last state, and
 * the Recent list — go in localStorage. Recent holds recipes (a tool, a seed and
 * a few settings), never pictures, so hundreds of them cost less than a single
 * thumbnail would. Larger work such as drawings will use IndexedDB when DRAW
 * arrives.
 *
 * Every call survives storage being refused outright, which private windows
 * and locked-down browsers do. Playground then works for the session and simply
 * forgets on close, instead of refusing to start.
 */

const PREFIX = 'playground.';

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

/** False when the browser refused — usually full, occasionally forbidden. */
export function save(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/* --------------------------------- recent -------------------------------- */

export type ToolId = 'color' | 'type' | 'shape' | 'draw' | 'make' | 'play';

export interface Recent {
  id: string;
  tool: ToolId;
  /** "Palette", "Gradient", "Pattern" — what the list says. */
  kind: string;
  at: number;
  /** Colours to draw the small preview chip from. */
  colors: string[];
  /** Everything needed to reopen it exactly. */
  recipe: Record<string, unknown>;
}

export const RECENT_LIMIT = 30;

/**
 * Newest first, with a repeat of the same recipe moving to the top instead of
 * appearing twice — copying a palette three times is one piece of work.
 */
export function addRecent(list: readonly Recent[], entry: Recent, limit = RECENT_LIMIT): Recent[] {
  const key = JSON.stringify([entry.tool, entry.kind, entry.recipe]);
  const rest = list.filter((item) => JSON.stringify([item.tool, item.kind, item.recipe]) !== key);
  return [entry, ...rest].slice(0, limit);
}

/** "2 min ago", "Yesterday" — how a person says it. */
export function ago(at: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 45) return 'Just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
