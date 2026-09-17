'use client';

/**
 * The small amount of state that belongs to the whole playground.
 *
 * Deliberately small: which tool is open, the theme, the shared palette, Recent,
 * toasts and the command palette. Everything a tool does stays inside that tool.
 *
 * Tools talk to the shell through one channel, `useToolActions`: each tool says
 * what "randomize", "export", "save" and "undo" mean for it, and the keyboard
 * shortcuts and command palette call whatever the open tool registered. That is
 * how Space can mean a new palette in COLOR and a new pattern in SHAPE without
 * the shell knowing anything about either.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from 'react';
import { addRecent, load, save, type Recent, type ToolId } from './storage';
import { TOOLS } from './tools';
import {
  addSaved, fromColorFavourites, mergeSaved, removeSaved, renameSaved, type NewSaved, type Saved,
} from './saved';
import { deleteDoc, setDoc } from './idb';

export type Theme = 'light' | 'dark' | 'system';

/** Where the main area is: a tool, or the Saved page. */
export type Place = ToolId | 'saved';

/**
 * DARE's countdown. It belongs to the playground rather than to DARE, because
 * the point of starting one is to go and make something in another tool.
 */
export interface ChallengeTimer {
  text: string;
  tool: ToolId;
  total: number;
  /** When running: the moment it ends. Clock time, so a background tab stays honest. */
  endsAt: number | null;
  /** When paused or done: what was left. */
  left: number;
  status: 'running' | 'paused' | 'done';
}

/** What a tool is being opened with, from Recent or Saved. */
export type Pending = Pick<Recent, 'tool' | 'kind' | 'recipe'> & { doc?: string; name?: string };

export interface Command {
  id: string;
  label: string;
  group: string;
  hint?: string;
  run: () => void;
}

export interface ToolActions {
  randomize?: () => void;
  exportDefault?: () => void;
  save?: () => void;
  undo?: () => void;
  redo?: () => void;
  clear?: () => void;
  /** Extra entries for the command palette while this tool is open. */
  commands?: Command[];
}

/*
 * A fixed palette for the very first paint, so the server-rendered shell and
 * the browser agree before anything random has happened.
 */
export const DEFAULT_PALETTE = ['#1D1B22', '#E4572E', '#F2C14E', '#7FB5A4', '#F4F0E8'];

interface Toast {
  id: number;
  message: string;
}

interface StoreValue {
  tool: Place;
  setTool: (id: Place) => void;
  /** Changes whenever something is opened, so the tool remounts with it. */
  opened: number;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  palette: string[];
  setPalette: (hexes: string[]) => void;
  recents: Recent[];
  remember: (entry: Omit<Recent, 'id' | 'at'>) => void;
  openRecent: (recent: Recent) => void;
  /** A tool asks for the recipe it was opened with, once. */
  takePending: (tool: ToolId) => Pending | null;
  saved: Saved[];
  /** Null when the browser refused to store it. */
  saveItem: (entry: NewSaved) => { item: Saved; repeat: boolean } | null;
  renameItem: (id: string, name: string) => void;
  removeItem: (id: string) => void;
  importItems: (items: Saved[], docs: Record<string, unknown>) => Promise<{ added: number; skipped: number }>;
  openSaved: (item: Saved) => void;
  timer: ChallengeTimer | null;
  startTimer: (text: string, minutes: number, tool: ToolId) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  resetTimer: () => void;
  endTimer: () => void;
  toasts: Toast[];
  toast: (message: string) => void;
  commandOpen: boolean;
  setCommandOpen: (open: boolean | ((open: boolean) => boolean)) => void;
  registerActions: (ref: MutableRefObject<ToolActions> | null) => void;
  actions: () => ToolActions;
  secret: boolean;
  setSecret: (on: boolean | ((on: boolean) => boolean)) => void;
}

const Ctx = createContext<StoreValue | null>(null);
const PLACES: Place[] = [...TOOLS.map((tool) => tool.id), 'saved'];

export function StoreProvider({ children }: { children: ReactNode }) {
  const [tool, setToolState] = useState<Place>('color');
  const [opened, setOpened] = useState(0);
  const [saved, setSaved] = useState<Saved[]>([]);
  const savedRef = useRef<Saved[]>([]);
  const [timer, setTimerState] = useState<ChallengeTimer | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const [theme, setThemeState] = useState<Theme>('system');
  const [palette, setPaletteState] = useState<string[]>(DEFAULT_PALETTE);
  const [recents, setRecents] = useState<Recent[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [commandOpen, setCommandOpen] = useState(false);
  const [secret, setSecret] = useState(false);
  const pending = useRef<Pending | null>(null);
  const toolActions = useRef<MutableRefObject<ToolActions> | null>(null);
  const toastSeq = useRef(0);

  /* Load what this device remembers, after the first paint has matched. */
  useEffect(() => {
    setThemeState(load<Theme>('theme', 'system'));
    setPaletteState(load<string[]>('palette', DEFAULT_PALETTE));
    setRecents(load<Recent[]>('recents', []));
    let list = load<Saved[] | null>('saved', null);
    if (list === null) {
      // First visit since Saved arrived: COLOR's favourites move in.
      list = fromColorFavourites(load<unknown>('color.favourites', []));
      if (save('saved', list)) save('color.favourites', []);
    }
    savedRef.current = list;
    setSaved(list);
    const kept = load<ChallengeTimer | null>('play.timer', null);
    if (kept?.status === 'running' && kept.endsAt !== null && kept.endsAt <= Date.now()) setTimerState({ ...kept, status: 'done', endsAt: null, left: 0 });
    else setTimerState(kept);
  }, []);

  /* The URL hash is the tool, so Back moves between tools and a link opens one. */
  useEffect(() => {
    const read = () => {
      const raw = window.location.hash.slice(1);
      // DARE lives at #dare; #play still works for links made before the rename.
      const hash = (raw === 'dare' ? 'play' : raw) as Place;
      setToolState(PLACES.includes(hash) ? hash : 'color');
    };
    read();
    window.addEventListener('popstate', read);
    return () => window.removeEventListener('popstate', read);
  }, []);

  const setTool = useCallback((id: Place) => {
    setToolState(id);
    const target = id === 'color' ? window.location.pathname : `#${id === 'play' ? 'dare' : id}`;
    const current = window.location.hash ? window.location.hash : window.location.pathname;
    if (current !== target) window.history.pushState(null, '', target);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = theme;
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    save('theme', next);
  }, []);

  const setPalette = useCallback((hexes: string[]) => {
    setPaletteState(hexes);
    save('palette', hexes);
  }, []);

  const toast = useCallback((message: string) => {
    toastSeq.current += 1;
    const id = toastSeq.current;
    setToasts((list) => [...list.slice(-2), { id, message }]);
    window.setTimeout(() => setToasts((list) => list.filter((item) => item.id !== id)), 2600);
  }, []);

  const remember = useCallback(
    (entry: Omit<Recent, 'id' | 'at'>) => {
      setRecents((list) => {
        const next = addRecent(list, { ...entry, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, at: Date.now() });
        if (!save('recents', next)) toast('Storage is full. Older items were not saved.');
        return next;
      });
    },
    [toast],
  );

  const openRecent = useCallback(
    (recent: Recent) => {
      pending.current = recent;
      setOpened((n) => n + 1);
      setTool(recent.tool);
    },
    [setTool],
  );

  const commitSaved = useCallback((list: Saved[]): boolean => {
    if (!save('saved', list)) return false;
    savedRef.current = list;
    setSaved(list);
    return true;
  }, []);

  const saveItem = useCallback(
    (entry: NewSaved) => {
      const result = addSaved(savedRef.current, entry);
      return commitSaved(result.list) ? { item: result.item, repeat: result.repeat } : null;
    },
    [commitSaved],
  );

  const renameItem = useCallback((id: string, name: string) => {
    if (!commitSaved(renameSaved(savedRef.current, id, name))) toast('Couldn’t rename that. Storage is full.');
  }, [commitSaved, toast]);

  const removeItem = useCallback((id: string) => {
    const item = savedRef.current.find((x) => x.id === id);
    commitSaved(removeSaved(savedRef.current, id));
    if (item?.doc) deleteDoc(item.doc);
  }, [commitSaved]);

  const importItems = useCallback(async (items: Saved[], docs: Record<string, unknown>) => {
    const merged = mergeSaved(savedRef.current, items);
    const addedIds = new Set(merged.list.map((x) => x.id));
    // Documents first: a saved drawing with no strokes behind it is worse than none.
    for (const item of items) {
      if (item.doc && addedIds.has(item.id) && docs[item.doc] !== undefined) await setDoc(item.doc, docs[item.doc]);
    }
    if (!commitSaved(merged.list)) return { added: 0, skipped: items.length };
    return { added: merged.added, skipped: merged.skipped };
  }, [commitSaved]);

  const openSaved = useCallback(
    (item: Saved) => {
      pending.current = { tool: item.tool, kind: item.kind, recipe: item.recipe, doc: item.doc, name: item.name };
      setOpened((n) => n + 1);
      setTool(item.tool);
    },
    [setTool],
  );

  const takePending = useCallback((forTool: ToolId) => {
    const recent = pending.current;
    if (!recent || recent.tool !== forTool) return null;
    pending.current = null;
    return recent;
  }, []);

  const setTimer = useCallback((next: ChallengeTimer | null) => {
    setTimerState(next);
    save('play.timer', next);
  }, []);

  /* Browsers only allow sound after a click, so the chime is readied on Start. */
  const readyAudio = () => {
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!audio.current && Ctor) audio.current = new Ctor();
      audio.current?.resume();
    } catch {
      /* no sound, no problem */
    }
  };

  const chime = () => {
    const ctx = audio.current;
    if (!ctx) return;
    try {
      [0, 0.18, 0.36].forEach((at, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = [880, 1108.7, 1318.5][i];
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + at);
        gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.5);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + at);
        osc.stop(ctx.currentTime + at + 0.55);
      });
    } catch {
      /* ignore */
    }
    navigator.vibrate?.([120, 80, 120]);
  };

  const startTimer = useCallback((text: string, minutes: number, forTool: ToolId) => {
    readyAudio();
    const total = minutes * 60_000;
    setTimer({ text, tool: forTool, total, endsAt: Date.now() + total, left: total, status: 'running' });
  }, [setTimer]);

  const pauseTimer = useCallback(() => {
    setTimerState((t) => {
      if (!t || t.status !== 'running' || t.endsAt === null) return t;
      const next = { ...t, status: 'paused' as const, left: Math.max(0, t.endsAt - Date.now()), endsAt: null };
      save('play.timer', next);
      return next;
    });
  }, []);

  const resumeTimer = useCallback(() => {
    readyAudio();
    setTimerState((t) => {
      if (!t || t.status !== 'paused') return t;
      const next = { ...t, status: 'running' as const, endsAt: Date.now() + t.left };
      save('play.timer', next);
      return next;
    });
  }, []);

  const resetTimer = useCallback(() => {
    setTimerState((t) => {
      if (!t) return t;
      const next = { ...t, status: 'paused' as const, left: t.total, endsAt: null };
      save('play.timer', next);
      return next;
    });
  }, []);

  const endTimer = useCallback(() => setTimer(null), [setTimer]);

  /* The moment it runs out, wherever you are. */
  useEffect(() => {
    if (timer?.status !== 'running' || timer.endsAt === null) return;
    const wait = Math.max(0, timer.endsAt - Date.now());
    const id = window.setTimeout(() => {
      setTimer({ ...timer, status: 'done', endsAt: null, left: 0 });
      toast('Time’s up. Save what you made.');
      chime();
    }, wait);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer]);

  const registerActions = useCallback((ref: MutableRefObject<ToolActions> | null) => {
    toolActions.current = ref;
  }, []);

  const actions = useCallback((): ToolActions => toolActions.current?.current ?? {}, []);

  const value = useMemo<StoreValue>(
    () => ({
      tool, setTool, opened, theme, setTheme, palette, setPalette, recents, remember, openRecent, takePending,
      saved, saveItem, renameItem, removeItem, importItems, openSaved,
      timer, startTimer, pauseTimer, resumeTimer, resetTimer, endTimer,
      toasts, toast, commandOpen, setCommandOpen, registerActions, actions, secret, setSecret,
    }),
    [tool, setTool, opened, theme, setTheme, palette, setPalette, recents, remember, openRecent, takePending,
      saved, saveItem, renameItem, removeItem, importItems, openSaved,
      timer, startTimer, pauseTimer, resumeTimer, resetTimer, endTimer,
      toasts, toast, commandOpen, registerActions, actions, secret],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): StoreValue {
  const value = useContext(Ctx);
  if (!value) throw new Error('useStore outside StoreProvider');
  return value;
}

/**
 * Tell the shell what this tool's randomize, export, save and undo do.
 *
 * Kept in a ref that is refreshed every render, so shortcuts always call the
 * current closure without the tool re-registering on each change.
 */
export function useToolActions(actions: ToolActions): void {
  const { registerActions } = useStore();
  const ref = useRef(actions);
  ref.current = actions;
  useEffect(() => {
    registerActions(ref);
    return () => registerActions(null);
  }, [registerActions]);
}
