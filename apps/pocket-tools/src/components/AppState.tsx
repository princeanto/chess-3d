'use client';

/**
 * The little the whole app shares: theme, favourites, recent tools, toasts, the
 * command palette, a currency preference, and a channel for the open tool to
 * say what ⌘Enter and ⌘C mean for it.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import { load, recordUse, save, type Usage } from '@/utils/storage';
import type { Currency } from '@/utils/format';

export type Theme = 'light' | 'dark' | 'system';
export type OfflineState = 'saving' | 'ready' | 'offline' | 'local';

export interface ToolActions {
  /** ⌘Enter. */
  run?: () => void;
  /** ⌘C with nothing selected: the text of the main result, or null if there isn't one yet. */
  copy?: () => string | null;
}

interface Toast { id: number; message: string }

interface State {
  theme: Theme;
  setTheme: (t: Theme) => void;
  favorites: string[];
  toggleFavorite: (id: string) => void;
  recents: Usage[];
  recordUse: (id: string) => void;
  currency: Currency;
  setCurrency: (c: Currency) => void;
  toasts: Toast[];
  toast: (message: string) => void;
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean | ((o: boolean) => boolean)) => void;
  toolActions: MutableRefObject<ToolActions | null>;
  offline: OfflineState;
  ready: boolean;
}

const Ctx = createContext<State | null>(null);

function useOfflineState(): OfflineState {
  const [state, setState] = useState<OfflineState>('saving');
  useEffect(() => {
    const online = () => setState(navigator.serviceWorker?.controller ? 'ready' : 'local');
    const offline = () => setState('offline');
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) {
      setState('local');
    } else {
      const sw = navigator.serviceWorker;
      const ready = () => setState((s) => (s === 'offline' ? s : 'ready'));
      sw.addEventListener('controllerchange', ready);
      sw.addEventListener('message', (e) => e.data === 'precached' && ready());
      sw.register('/sw.js').then(() => sw.controller && ready()).catch(() => setState('local'));
    }
    if (!navigator.onLine) setState('offline');
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }, []);
  return state;
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recents, setRecents] = useState<Usage[]>([]);
  const [currency, setCurrencyState] = useState<Currency>('INR');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const toolActions = useRef<ToolActions | null>(null);
  const seq = useRef(0);
  const offline = useOfflineState();

  useEffect(() => {
    setThemeState(load<Theme>('theme', 'light'));
    setFavorites(load<string[]>('favorites', []));
    setRecents(load<Usage[]>('recents', []));
    setCurrencyState(load<Currency>('currency', 'INR'));
    setReady(true);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = theme;
  }, [theme]);

  const setTheme = useCallback((t: Theme) => { setThemeState(t); save('theme', t); }, []);
  const setCurrency = useCallback((c: Currency) => { setCurrencyState(c); save('currency', c); }, []);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((list) => {
      const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
      save('favorites', next);
      return next;
    });
  }, []);

  const recordUseCb = useCallback((id: string) => {
    setRecents((list) => {
      const next = recordUse(load<Usage[]>('recents', list), id);
      save('recents', next);
      return next;
    });
  }, []);

  const toast = useCallback((message: string) => {
    seq.current += 1;
    const id = seq.current;
    setToasts((list) => [...list.slice(-2), { id, message }]);
    window.setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 2400);
  }, []);

  const value = useMemo<State>(() => ({
    theme, setTheme, favorites, toggleFavorite, recents, recordUse: recordUseCb, currency, setCurrency,
    toasts, toast, paletteOpen, setPaletteOpen, toolActions, offline, ready,
  }), [theme, setTheme, favorites, toggleFavorite, recents, recordUseCb, currency, setCurrency, toasts, toast, paletteOpen, offline, ready]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): State {
  const value = useContext(Ctx);
  if (!value) throw new Error('useApp outside AppStateProvider');
  return value;
}

/** A tool tells the shell what ⌘Enter and ⌘C do. Kept fresh every render. */
export function useToolActions(actions: ToolActions): void {
  const { toolActions } = useApp();
  const ref = useRef(actions);
  ref.current = actions;
  useEffect(() => {
    const proxy: ToolActions = {
      run: () => ref.current.run?.(),
      copy: () => ref.current.copy?.() ?? null,
    };
    toolActions.current = proxy;
    return () => { if (toolActions.current === proxy) toolActions.current = null; };
  }, [toolActions]);
}

/** The query string the tool was opened with — how search fills in a tool's fields. */
export function useToolParams(apply: (params: URLSearchParams) => void): void {
  const applied = useRef(false);
  useEffect(() => {
    if (applied.current) return;
    applied.current = true;
    const params = new URLSearchParams(window.location.search);
    if ([...params.keys()].length) apply(params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
