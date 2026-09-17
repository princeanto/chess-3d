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

export type Theme = 'light' | 'dark' | 'system';

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
  tool: ToolId;
  setTool: (id: ToolId) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  palette: string[];
  setPalette: (hexes: string[]) => void;
  recents: Recent[];
  remember: (entry: Omit<Recent, 'id' | 'at'>) => void;
  openRecent: (recent: Recent) => void;
  /** A tool asks for the recipe it was opened with, once. */
  takePending: (tool: ToolId) => Recent | null;
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
const TOOL_IDS = TOOLS.map((tool) => tool.id);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [tool, setToolState] = useState<ToolId>('color');
  const [theme, setThemeState] = useState<Theme>('system');
  const [palette, setPaletteState] = useState<string[]>(DEFAULT_PALETTE);
  const [recents, setRecents] = useState<Recent[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [commandOpen, setCommandOpen] = useState(false);
  const [secret, setSecret] = useState(false);
  const pending = useRef<Recent | null>(null);
  const toolActions = useRef<MutableRefObject<ToolActions> | null>(null);
  const toastSeq = useRef(0);

  /* Load what this device remembers, after the first paint has matched. */
  useEffect(() => {
    setThemeState(load<Theme>('theme', 'system'));
    setPaletteState(load<string[]>('palette', DEFAULT_PALETTE));
    setRecents(load<Recent[]>('recents', []));
  }, []);

  /* The URL hash is the tool, so Back moves between tools and a link opens one. */
  useEffect(() => {
    const read = () => {
      const hash = window.location.hash.slice(1) as ToolId;
      setToolState(TOOL_IDS.includes(hash) ? hash : 'color');
    };
    read();
    window.addEventListener('popstate', read);
    return () => window.removeEventListener('popstate', read);
  }, []);

  const setTool = useCallback((id: ToolId) => {
    setToolState(id);
    const target = id === 'color' ? window.location.pathname : `#${id}`;
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
      setTool(recent.tool);
    },
    [setTool],
  );

  const takePending = useCallback((forTool: ToolId) => {
    const recent = pending.current;
    if (!recent || recent.tool !== forTool) return null;
    pending.current = null;
    return recent;
  }, []);

  const registerActions = useCallback((ref: MutableRefObject<ToolActions> | null) => {
    toolActions.current = ref;
  }, []);

  const actions = useCallback((): ToolActions => toolActions.current?.current ?? {}, []);

  const value = useMemo<StoreValue>(
    () => ({
      tool, setTool, theme, setTheme, palette, setPalette, recents, remember, openRecent, takePending,
      toasts, toast, commandOpen, setCommandOpen, registerActions, actions, secret, setSecret,
    }),
    [tool, setTool, theme, setTheme, palette, setPalette, recents, remember, openRecent, takePending,
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
