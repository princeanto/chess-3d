'use client';

/**
 * State with undo.
 *
 * Randomize is only fun if the one you just lost can come back, so every tool
 * that randomizes keeps a history. Changes that arrive in a stream — a slider
 * being dragged, text being typed — carry a tag, and a run of the same tag
 * within a moment becomes a single step, so one undo reverses one gesture
 * rather than one pixel of it.
 */

import { useCallback, useRef, useState } from 'react';

const LIMIT = 80;
const COALESCE_MS = 700;

export interface History<T> {
  state: T;
  set: (update: T | ((previous: T) => T), tag?: string) => void;
  undo: () => boolean;
  redo: () => boolean;
}

export function useHistory<T>(initial: () => T): History<T> {
  const [state, setState] = useState<T>(initial);
  // The current value lives in a ref too, so updates stay pure: React may call
  // a setState updater twice, and a history push must happen exactly once.
  const current = useRef<T>(state);
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  const last = useRef({ tag: '', at: 0 });

  const set = useCallback((update: T | ((previous: T) => T), tag = '') => {
    const previous = current.current;
    const next = typeof update === 'function' ? (update as (p: T) => T)(previous) : update;
    if (Object.is(next, previous)) return;
    const now = Date.now();
    const sameGesture = tag !== '' && tag === last.current.tag && now - last.current.at < COALESCE_MS;
    if (!sameGesture) past.current = [...past.current, previous].slice(-LIMIT);
    future.current = [];
    last.current = { tag, at: now };
    current.current = next;
    setState(next);
  }, []);

  const move = (from: typeof past, to: typeof past): boolean => {
    const target = from.current[from.current.length - 1];
    if (target === undefined) return false;
    from.current = from.current.slice(0, -1);
    to.current = [...to.current, current.current];
    last.current = { tag: '', at: 0 };
    current.current = target;
    setState(target);
    return true;
  };

  const undo = useCallback(() => move(past, future), []);
  const redo = useCallback(() => move(future, past), []);

  return { state, set, undo, redo };
}
