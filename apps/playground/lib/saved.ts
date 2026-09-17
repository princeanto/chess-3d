/**
 * Saved: the things someone chose to keep, from every tool.
 *
 * Different from Recent. Recent is a trail that fills itself and forgets;
 * Saved only grows when you press ⌘S, keeps a name you can change, and stays
 * until you delete it.
 *
 * An entry is a recipe, like Recent — settings, not pictures — so a saved
 * pattern costs a few hundred bytes. Drawings are the exception: their strokes
 * go in IndexedDB under `doc`, with only a small thumbnail kept here.
 *
 * Nothing here leaves the device, which also means clearing the browser's site
 * data erases it. The backup file is the answer to that.
 */

import type { ToolId } from './storage';

export interface Saved {
  id: string;
  tool: ToolId;
  /** "Palette", "Gradient", "Blobs", "Poster", "Drawing". */
  kind: string;
  name: string;
  at: number;
  /** Colours for the small chip preview. */
  colors: string[];
  recipe: Record<string, unknown>;
  /** A small image, for work that cannot be redrawn from its recipe cheaply. */
  thumb?: string;
  /** IndexedDB key of a large document, for drawings. */
  doc?: string;
}

export type NewSaved = Omit<Saved, 'id' | 'at' | 'name'> & { name?: string };

export const SAVED_LIMIT = 400;
export const NAME_LIMIT = 60;
const TOOL_IDS: readonly string[] = ['color', 'type', 'shape', 'draw', 'make', 'play'];

export const newId = (now: number = Date.now()): string =>
  `${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`;

const sameWork = (a: Pick<Saved, 'tool' | 'kind' | 'recipe'>, b: Pick<Saved, 'tool' | 'kind' | 'recipe'>): boolean =>
  a.tool === b.tool && a.kind === b.kind && JSON.stringify(a.recipe) === JSON.stringify(b.recipe);

/** "Palette 4": the next free number for that kind. */
export function defaultName(list: readonly Saved[], kind: string): string {
  const pattern = new RegExp(`^${kind.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} (\\d+)$`);
  const taken = list.map((item) => Number(pattern.exec(item.name)?.[1] ?? 0));
  return `${kind} ${Math.max(0, ...taken) + 1}`;
}

/**
 * Newest first. Saving the same work twice moves it to the top and keeps the
 * name it already has, instead of filling the list with copies.
 */
export function addSaved(list: readonly Saved[], entry: NewSaved, now: number = Date.now()): { list: Saved[]; item: Saved; repeat: boolean } {
  const existing = entry.doc ? undefined : list.find((item) => sameWork(item, entry));
  if (existing) {
    const item = { ...existing, at: now };
    return { list: [item, ...list.filter((x) => x.id !== existing.id)], item, repeat: true };
  }
  const item: Saved = { ...entry, id: newId(now), at: now, name: cleanName(entry.name ?? '') || defaultName(list, entry.kind) };
  return { list: [item, ...list].slice(0, SAVED_LIMIT), item, repeat: false };
}

export const cleanName = (name: string): string => name.replace(/\s+/g, ' ').trim().slice(0, NAME_LIMIT);

export function renameSaved(list: readonly Saved[], id: string, name: string): Saved[] {
  const clean = cleanName(name);
  return clean ? list.map((item) => (item.id === id ? { ...item, name: clean } : item)) : list.slice();
}

export const removeSaved = (list: readonly Saved[], id: string): Saved[] => list.filter((item) => item.id !== id);

/* --------------------------------- backup -------------------------------- */

export interface Backup {
  app: 'playground';
  kind: 'saved';
  version: 1;
  exportedAt: string;
  items: Saved[];
  /** Large documents by key, for drawings. */
  docs: Record<string, unknown>;
}

export function makeBackup(items: readonly Saved[], docs: Record<string, unknown>, now: number = Date.now()): Backup {
  return { app: 'playground', kind: 'saved', version: 1, exportedAt: new Date(now).toISOString(), items: items.slice(), docs };
}

const isHexList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((hex) => typeof hex === 'string' && /^#[0-9a-f]{6}$/i.test(hex));

/** Checks an entry from a file, which could contain anything. */
export function validSaved(value: unknown): value is Saved {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' && v.id.length > 0 && v.id.length < 64
    && typeof v.tool === 'string' && TOOL_IDS.includes(v.tool)
    && typeof v.kind === 'string' && v.kind.length < 40
    && typeof v.name === 'string'
    && typeof v.at === 'number' && Number.isFinite(v.at)
    && isHexList(v.colors)
    && !!v.recipe && typeof v.recipe === 'object' && !Array.isArray(v.recipe)
    && (v.thumb === undefined || (typeof v.thumb === 'string' && v.thumb.startsWith('data:image/')))
    && (v.doc === undefined || typeof v.doc === 'string');
}

export function readBackup(text: string): { items: Saved[]; docs: Record<string, unknown>; rejected: number } | { error: string } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { error: 'That file isn’t a Playground backup.' };
  }
  const b = data as Partial<Backup> | null;
  if (!b || b.app !== 'playground' || b.kind !== 'saved' || !Array.isArray(b.items)) {
    return { error: 'That file isn’t a Playground backup.' };
  }
  if (typeof b.version !== 'number' || b.version > 1) {
    return { error: 'That backup is from a newer Playground. Reload to update, then try again.' };
  }
  const items = b.items.filter(validSaved).map((item) => ({ ...item, name: cleanName(item.name) || item.kind }));
  const docs = b.docs && typeof b.docs === 'object' && !Array.isArray(b.docs) ? b.docs : {};
  return { items, docs, rejected: b.items.length - items.length };
}

/**
 * Adds what the backup has and this device does not. An id already here, or
 * the same work under another id, is skipped rather than duplicated.
 */
export function mergeSaved(list: readonly Saved[], incoming: readonly Saved[]): { list: Saved[]; added: number; skipped: number } {
  const merged = list.slice();
  let added = 0;
  for (const item of incoming) {
    const duplicate = merged.some((x) => x.id === item.id || (!item.doc && !x.doc && sameWork(x, item)));
    if (duplicate) continue;
    merged.push(item);
    added += 1;
  }
  merged.sort((a, b) => b.at - a.at);
  const kept = merged.slice(0, SAVED_LIMIT);
  return { list: kept, added: Math.min(added, kept.length), skipped: incoming.length - added };
}

/* ----------------------------- older favourites ---------------------------- */

/** COLOR kept its own favourites before Saved existed. They move in once. */
export function fromColorFavourites(favourites: unknown): Saved[] {
  if (!Array.isArray(favourites)) return [];
  const out: Saved[] = [];
  favourites.forEach((f: { id?: unknown; hexes?: unknown; at?: unknown }) => {
    if (!isHexList(f?.hexes) || f.hexes.length === 0) return;
    const at = typeof f.at === 'number' ? f.at : Date.now();
    out.push({ id: `fav${typeof f.id === 'string' ? f.id : at}`, tool: 'color', kind: 'Palette', name: '', at, colors: f.hexes, recipe: { colors: f.hexes } });
  });
  // Oldest gets "Palette 1", so the numbers read in the order they were made.
  const named: Saved[] = [];
  for (const item of out.slice().sort((a, b) => a.at - b.at)) named.push({ ...item, name: defaultName(named, 'Palette') });
  return named.sort((a, b) => b.at - a.at);
}
