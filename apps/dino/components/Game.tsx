'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { sfx, setMuted } from '@/lib/game/audio';
import {
  TICK,
  WORLD,
  createState,
  makeRandom,
  step,
  type Input,
  type State,
} from '@/lib/game/engine';
import { render } from '@/lib/game/render';
import { loadBest, loadMuted, saveBest, saveMuted } from '@/lib/game/storage';

/**
 * The shell: a full-bleed canvas with the HUD floating on top of it.
 *
 * The loop accumulates real time and consumes it in fixed TICK slices, so the
 * physics behave identically on a 60Hz laptop and a 144Hz monitor. Rendering
 * happens once per animation frame, at whatever rate the display runs.
 */
export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<State | null>(null);
  const inputRef = useRef<Input>({ jump: false, duck: false, jumpPressed: false });
  const randRef = useRef(makeRandom());
  const rafRef = useRef<number | null>(null);

  // Mirrored into React state only for the HUD; the loop never reads these.
  const [phase, setPhase] = useState<State['phase']>('ready');
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [muted, setMutedState] = useState(false);
  const [installable, setInstallable] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const promptRef = useRef<Event | null>(null);

  const start = useCallback(() => {
    const s = stateRef.current;
    if (!s) return;
    if (s.phase === 'running') return;
    const fresh = createState(s.best);
    fresh.phase = 'running';
    // Carry the sky across a restart: resetting to dawn every death would make
    // the cycle feel like a scoreboard rather than weather.
    fresh.cycle = s.cycle;
    fresh.viewWidth = s.viewWidth;
    stateRef.current = fresh;
    randRef.current = makeRandom();
    setPhase('running');
    setScore(0);
  }, []);

  /* ------------------------------- input ------------------------------- */

  const press = useCallback(
    (kind: 'jump' | 'duck') => {
      const s = stateRef.current;
      if (!s) return;
      if (kind === 'jump') {
        inputRef.current.jump = true;
        inputRef.current.jumpPressed = true;
        if (s.phase !== 'running') start();
      } else {
        inputRef.current.duck = true;
      }
    },
    [start],
  );

  const release = useCallback((kind: 'jump' | 'duck') => {
    if (kind === 'jump') inputRef.current.jump = false;
    else inputRef.current.duck = false;
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        press('jump');
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault();
        press('duck');
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') release('jump');
      else if (e.code === 'ArrowDown' || e.code === 'KeyS') release('duck');
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [press, release]);

  /* -------------------------------- loop ------------------------------- */

  useEffect(() => {
    const initialBest = loadBest();
    const initialMuted = loadMuted();
    stateRef.current = createState(initialBest);
    setBest(initialBest);
    setMutedState(initialMuted);
    setMuted(initialMuted);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let accumulator = 0;
    let last = performance.now();
    let running = true;
    let cssWidth = 0;
    let cssHeight = 0;
    let dpr = 1;

    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      const rect = canvas.getBoundingClientRect();
      cssWidth = rect.width;
      cssHeight = rect.height;
      canvas.width = Math.round(cssWidth * dpr);
      canvas.height = Math.round(cssHeight * dpr);

      // Tell the simulation how much world is actually on screen, so obstacles
      // enter from beyond the real edge rather than an invisible inner one.
      const s = stateRef.current;
      if (s) {
        const scale = Math.min(cssHeight / WORLD.height, cssWidth / WORLD.minWidth);
        s.viewWidth = cssWidth / scale;
      }
    };
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);

    const frame = (now: number) => {
      if (!running) return;
      const s = stateRef.current;
      if (!s) return;

      // Clamp the delta: returning to a backgrounded tab would otherwise
      // deliver a multi-second dt and run hundreds of ticks at once.
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      accumulator += dt;

      while (accumulator >= TICK) {
        const wasPhase = s.phase;
        step(s, inputRef.current, randRef.current);
        inputRef.current.jumpPressed = false;
        accumulator -= TICK;

        if (s.justJumped) sfx.jump();
        if (s.justMilestone) sfx.milestone();
        if (s.justDied) {
          sfx.die();
          saveBest(s.best);
        }
        if (wasPhase !== s.phase) setPhase(s.phase);
      }

      setScore((prev) => (prev === s.score ? prev : s.score));
      setBest((prev) => (prev === s.best ? prev : s.best));

      const palette = render(ctx, s, cssWidth, cssHeight, now / 1000, dpr);
      // The HUD sits on a sky that changes colour all run, so its ink is driven
      // straight from the palette. Set on the node rather than through state:
      // a re-render every frame would be wasteful and jittery.
      const shell = shellRef.current;
      if (shell) {
        shell.style.setProperty('--hud-top', palette.hudTop);
        shell.style.setProperty('--hud-mid', palette.hudMid);
        shell.style.setProperty('--hud-bottom', palette.hudBottom);
        shell.style.setProperty('--hud-ink', palette.hudMid);
        shell.style.setProperty('--hud-on-ink', palette.onHudMid);
        // The halo is whatever the text is not, so it separates in both directions.
        shell.style.setProperty(
          '--hud-halo',
          palette.hudBottom === palette.onHudMid ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.5)',
        );
      }

      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);
    return () => {
      running = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('orientationchange', resize);
    };
  }, []);

  /* ------------------------------ install ------------------------------ */

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      promptRef.current = e;
      setInstallable(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          if (reg.active) setOfflineReady(true);
          reg.addEventListener('updatefound', () => {
            reg.installing?.addEventListener('statechange', function onChange() {
              if (this.state === 'activated') setOfflineReady(true);
            });
          });
        })
        .catch(() => setOfflineReady(false));

      if (navigator.serviceWorker.controller) setOfflineReady(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const install = async () => {
    const e = promptRef.current as (Event & { prompt?: () => Promise<void> }) | null;
    if (!e?.prompt) return;
    await e.prompt();
    promptRef.current = null;
    setInstallable(false);
  };

  const toggleMute = () => {
    const next = !muted;
    setMutedState(next);
    setMuted(next);
    saveMuted(next);
  };

  return (
    <div
      ref={shellRef}
      className="fixed inset-0 select-none overflow-hidden"
      style={
        {
          ['--hud-top' as string]: '#1a1b22',
          ['--hud-mid' as string]: '#1a1b22',
          ['--hud-bottom' as string]: '#1a1b22',
          ['--hud-ink' as string]: '#1a1b22',
          ['--hud-on-ink' as string]: '#f4f6ff',
        } as React.CSSProperties
      }
      onPointerDown={(e) => {
        e.preventDefault();
        // Bottom third ducks, everything above jumps — a thumb rests low on a
        // phone, and reaching for a separate button loses runs.
        press(e.clientY > window.innerHeight * 0.66 ? 'duck' : 'jump');
      }}
      onPointerUp={() => {
        release('jump');
        release('duck');
      }}
      onPointerCancel={() => {
        release('jump');
        release('duck');
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas ref={canvasRef} className="block h-full w-full" />

      {/* HUD. Pointer events off so nothing steals a jump except real buttons. */}
      <div
        className="pointer-events-none absolute inset-0 flex flex-col justify-between p-5 sm:p-8"
      >
        <div
          className="flex items-start justify-between gap-6"
          style={{ color: 'var(--hud-top)' }}
        >
          <div>
            <h1 className="display text-[26px] leading-none sm:text-[32px]">Runner</h1>
            <p className="hud-text mt-1.5 text-[12.5px] opacity-80">
              {offlineReady ? 'Runs with no connection' : 'Saving for offline…'}
            </p>
          </div>

          <div className="flex items-start gap-6">
            <div className="text-right">
              <p className="mono text-[26px] leading-none sm:text-[34px]">{pad(score)}</p>
              <p className="hud-text mono mt-1 text-[12px] opacity-80">best {pad(best)}</p>
            </div>
            <div className="pointer-events-auto flex gap-2">
              {installable && (
                <button className="hud-btn" onClick={install}>
                  Install
                </button>
              )}
              <button
                className="hud-btn"
                onClick={toggleMute}
                aria-pressed={muted}
                aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
              >
                {muted ? 'Sound off' : 'Sound on'}
              </button>
            </div>
          </div>
        </div>

        <p
          className="hud-text mono text-center text-[12px] opacity-80"
          style={{ color: 'var(--hud-bottom)' }}
        >
          space or tap to jump &middot; hold ↓ to duck &middot; a short tap gives a short hop
        </p>
      </div>

      {phase !== 'running' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
          <div className="pointer-events-auto text-center" style={{ color: 'var(--hud-mid)' }}>
            <p className="display text-[38px] leading-none sm:text-[52px]">
              {phase === 'dead' ? 'Caught by a cactus' : 'Ready when you are'}
            </p>
            <p className="mt-3 text-[15px] opacity-75">
              {phase === 'dead' ? (
                <>
                  You scored {score}
                  {score >= best && score > 0 ? ' — a new best.' : `. Best is ${best}.`}
                </>
              ) : (
                'Press space, or tap anywhere.'
              )}
            </p>
            <button className="hud-btn-primary mt-6" onClick={start}>
              {phase === 'dead' ? 'Run again' : 'Start running'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const pad = (n: number) => String(n).padStart(5, '0');
