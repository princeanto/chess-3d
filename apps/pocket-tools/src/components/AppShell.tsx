'use client';

/**
 * The frame around every page, and the keyboard.
 *
 * ⌘K opens search from anywhere. ⌘/ goes to the search box. ⌘Enter runs the
 * open tool. ⌘C, when nothing is selected, copies the tool's answer — and
 * when something is selected, does exactly what ⌘C always does.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { AppStateProvider, useApp } from './AppState';
import Header from './Header';
import Sidebar from './Sidebar';
import { copyText } from '@/utils/clipboard';

const CommandPalette = dynamic(() => import('./CommandPalette'), { ssr: false });

const editable = (el: EventTarget | null) => {
  const node = el as HTMLElement | null;
  if (!node) return false;
  const tag = node.tagName;
  return node.isContentEditable || tag === 'TEXTAREA' || tag === 'SELECT' || (tag === 'INPUT' && !['checkbox', 'radio', 'range', 'button'].includes((node as HTMLInputElement).type));
};

function Frame({ children }: { children: ReactNode }) {
  const app = useApp();
  const path = usePathname();
  const [mod, setMod] = useState('⌘');

  useEffect(() => setMod(/Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘' : 'Ctrl '), []);
  useEffect(() => { app.setPaletteOpen(false); window.scrollTo(0, 0); }, [path]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const withMod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (withMod && key === 'k') {
        e.preventDefault();
        app.setPaletteOpen((open) => !open);
        return;
      }
      if (withMod && key === '/') {
        e.preventDefault();
        const home = document.getElementById('home-search');
        if (home) home.focus();
        else app.setPaletteOpen(true);
        return;
      }
      if (app.paletteOpen) return;
      if (withMod && e.key === 'Enter') {
        const run = app.toolActions.current?.run;
        if (run) { e.preventDefault(); run(); }
        return;
      }
      if (withMod && key === 'c' && !e.shiftKey && !e.altKey) {
        const selection = window.getSelection()?.toString() ?? '';
        const field = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
        const fieldSelection = field && editable(field) && typeof field.selectionStart === 'number' && field.selectionStart !== field.selectionEnd;
        if (selection || fieldSelection) return;
        const text = app.toolActions.current?.copy?.();
        if (!text) return;
        e.preventDefault();
        copyText(text).then((ok) => app.toast(ok ? 'Copied' : 'Couldn’t copy that. Try again.'));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [app]);

  return (
    <div className="app">
      <a className="skip" href="#main">Skip to content</a>
      <Header mod={mod} />
      <div className="app-body">
        <Sidebar mod={mod} />
        <main id="main" className="main" tabIndex={-1}>{children}</main>
      </div>
      {app.paletteOpen && <CommandPalette />}
      <div className="toasts" role="status" aria-live="polite">
        {app.toasts.map((t) => <div key={t.id} className="toast">{t.message}</div>)}
      </div>
    </div>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <AppStateProvider>
      <Frame>{children}</Frame>
    </AppStateProvider>
  );
}
