'use client';

/**
 * The frame around the tools.
 *
 * Rendered on the server with fixed defaults, so the sidebar and heading are on
 * screen before any JavaScript runs; each tool then loads on its own and only
 * when opened, which is what keeps the first screen small.
 */

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { StoreProvider, useStore } from '@/lib/store';
import { TOOLS, toolById } from '@/lib/tools';
import { mostChromatic, luminance, readableOn } from '@/lib/color';
import { isEditable, modLabel, spaceIsTaken } from '@/lib/shortcuts';
import { ago } from '@/lib/storage';
import { Kbd, Segmented } from './ui';

const ColorTool = dynamic(() => import('@/tools/color/ColorTool'), { ssr: false, loading: () => <Loading /> });
const Soon = dynamic(() => import('@/tools/Soon'), { ssr: false, loading: () => <Loading /> });
const CommandPalette = dynamic(() => import('./CommandPalette'), { ssr: false });

function Loading() {
  return <div className="loading" aria-hidden="true" />;
}

export default function Shell() {
  return (
    <StoreProvider>
      <Frame />
    </StoreProvider>
  );
}

type Offline = 'saving' | 'ready' | 'offline' | 'local';

/**
 * An offline label that tells the truth.
 *
 * "Offline ready" appears only once the service worker has actually cached the
 * app. On a first visit that takes a moment, and a green dot that claims it
 * before it is so is worse than no dot at all.
 */
function useOffline(): Offline {
  const [state, setState] = useState<Offline>('saving');
  useEffect(() => {
    const goOffline = () => setState('offline');
    const goOnline = () => setState(navigator.serviceWorker?.controller ? 'ready' : 'local');
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) {
      setState('local');
    } else {
      const sw = navigator.serviceWorker;
      const ready = () => setState((s) => (s === 'offline' ? s : 'ready'));
      sw.addEventListener('controllerchange', ready);
      sw.addEventListener('message', (e) => e.data === 'precached' && ready());
      sw.register('/sw.js')
        .then(() => sw.controller && ready())
        .catch(() => setState('local'));
    }
    if (!navigator.onLine) setState('offline');
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);
  return state;
}

const OFFLINE_LABEL: Record<Offline, string> = {
  ready: 'Offline ready',
  offline: 'Offline — everything still works',
  saving: 'Saving for offline…',
  local: 'Works locally',
};

function Frame() {
  const store = useStore();
  const info = toolById(store.tool);
  const offline = useOffline();
  const [mod, setMod] = useState('⌘');
  const [now, setNow] = useState(() => Date.now());
  const logoClicks = useRef<number[]>([]);
  const rPresses = useRef<number[]>([]);
  const main = useRef<HTMLElement>(null);

  useEffect(() => setMod(modLabel()), []);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  /* Every shortcut, routed to whatever the open tool registered. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const withMod = e.metaKey || e.ctrlKey;
      if (withMod && key === 'k') {
        e.preventDefault();
        store.setCommandOpen((open) => !open);
        return;
      }
      if (store.commandOpen) return;
      const tool = store.actions();
      if (withMod && key === 's') {
        e.preventDefault();
        if (tool.save) tool.save();
        else store.toast('Nothing to save here yet.');
        return;
      }
      if (withMod && key === 'z' && !isEditable(e.target)) {
        if (!tool.undo && !tool.redo) return;
        e.preventDefault();
        if (e.shiftKey) tool.redo?.();
        else tool.undo?.();
        return;
      }
      if (withMod || e.altKey || isEditable(e.target)) return;
      if (e.key === ' ') {
        if (spaceIsTaken(e.target) || !tool.randomize) return;
        e.preventDefault();
        tool.randomize();
        return;
      }
      if (key === 'r' && !e.repeat) {
        tool.randomize?.();
        // R R R: three presses in quick succession.
        const t = Date.now();
        rPresses.current = [...rPresses.current.filter((at) => t - at < 700), t];
        if (rPresses.current.length >= 3) {
          rPresses.current = [];
          const root = document.documentElement;
          root.classList.add('strange');
          store.toast('Strange mode. It wears off.');
          window.setTimeout(() => root.classList.remove('strange'), 5000);
        }
        return;
      }
      if (key === 'e') {
        if (tool.exportDefault) tool.exportDefault();
        else store.toast('Nothing to export here yet.');
        return;
      }
      const target = TOOLS.find((t) => t.key === key);
      if (target) store.setTool(target.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store]);

  const onLogo = () => {
    const t = Date.now();
    logoClicks.current = [...logoClicks.current.filter((at) => t - at < 2500), t];
    if (logoClicks.current.length >= 5) {
      logoClicks.current = [];
      store.setSecret((on) => !on);
      store.toast(store.secret ? 'Back to normal.' : '🎨 You found the secret mode.');
      return;
    }
    store.setTool('color');
  };

  // Secret mode: the chrome wears your palette.
  const darkest = store.palette.slice().sort((a, b) => luminance(a) - luminance(b))[0] ?? '#111111';
  const secretStyle = store.secret
    ? ({ ['--side-bg' as string]: darkest, ['--side-ink' as string]: readableOn(darkest, ['#F5F5F2', '#111111']) })
    : undefined;

  const dot = mostChromatic(store.palette);

  return (
    <div className={`app${store.secret ? ' is-secret' : ''}`} style={secretStyle}>
      <a className="skip" href="#work">Skip to workspace</a>

      <aside className="side">
        <div className="side-top">
          <button className="mark" onClick={onLogo} aria-label="Playground. Back to Color">
            playground<span className="mark-dot" style={{ color: dot }} aria-hidden="true">●</span>
          </button>
          <span className={`status status-${offline} status-mobile`} title={OFFLINE_LABEL[offline]}>
            <span className="status-dot" aria-hidden="true" />
            <span className="sr-only">{OFFLINE_LABEL[offline]}</span>
          </span>
        </div>

        <nav aria-label="Tools" className="nav">
          <ul>
            {TOOLS.map((t) => (
              <li key={t.id}>
                <button
                  className={`nav-item${store.tool === t.id ? ' on' : ''}`}
                  aria-current={store.tool === t.id ? 'page' : undefined}
                  onClick={() => store.setTool(t.id)}
                  onPointerUp={(e) => e.currentTarget.blur()}
                >
                  <span>{t.label}</span>
                  <span className="nav-key" aria-hidden="true">{t.key.toUpperCase()}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <button className="find" onClick={() => store.setCommandOpen(true)}>
          <span>Search</span>
          <Kbd>{mod} K</Kbd>
        </button>

        <section className="recent" aria-labelledby="recent-h">
          <h2 id="recent-h" className="side-label">Recent</h2>
          {store.recents.length === 0 ? (
            <p className="recent-empty">Your next masterpiece goes here.</p>
          ) : (
            <ul>
              {store.recents.slice(0, 5).map((recent) => (
                <li key={recent.id}>
                  <button className="recent-item" onClick={() => store.openRecent(recent)}>
                    <span className="chips" aria-hidden="true">
                      {recent.colors.slice(0, 5).map((hex, i) => (
                        <i key={i} style={{ background: hex }} />
                      ))}
                    </span>
                    <span className="recent-text">
                      {recent.kind} · {ago(recent.at, now)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="side-foot">
          <p className={`status status-${offline}`}>
            <span className="status-dot" aria-hidden="true" />
            {OFFLINE_LABEL[offline]}
          </p>
          <Segmented
            label="Theme"
            compact
            value={store.theme}
            onChange={store.setTheme}
            options={[
              { id: 'light', label: 'Light' },
              { id: 'dark', label: 'Dark' },
              { id: 'system', label: 'System' },
            ]}
          />
        </div>
      </aside>

      <main id="work" ref={main} className="main" tabIndex={-1}>
        <header className="tool-head">
          <p className="eyebrow">Creative Swiss Army Knife</p>
          <h1 className="tool-title">{info.title}</h1>
          <p className="tool-desc">{info.description}</p>
        </header>
        <div className="tool-body" key={store.tool}>
          {store.tool === 'color' ? <ColorTool /> : <Soon tool={info} />}
        </div>
      </main>

      {store.commandOpen && <CommandPalette />}

      <div className="toasts" role="status" aria-live="polite">
        {store.toasts.map((t) => (
          <div key={t.id} className="toast">
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
