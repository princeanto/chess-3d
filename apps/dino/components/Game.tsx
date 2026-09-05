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
 * The shell: canvas, input, and the loop that drives the simulation.
 *
 * The loop accumulates real time and consumes it in fixed TICK slices, so the
 * physics behave identically on a 60Hz laptop and a 144Hz monitor. Rendering
 * still happens once per animation frame, at whatever rate the display runs.
 */
export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
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

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

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

      const rect = canvas.getBoundingClientRect();
      render(ctx, s, rect.width, rect.height, now / 1000);
      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);
    return () => {
      running = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
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
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 px-1">
        <div className="flex items-baseline gap-6">
          <p className="mono text-[13px] text-[var(--muted)]">
            Score <span className="ml-1.5 text-[19px] text-[var(--ink)]">{pad(score)}</span>
          </p>
          <p className="mono text-[13px] text-[var(--muted)]">
            Best <span className="ml-1.5 text-[19px] text-[var(--ink)]">{pad(best)}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {installable && (
            <button className="btn btn-sm" onClick={install}>
              Install
            </button>
          )}
          <button
            className="btn btn-sm"
            onClick={toggleMute}
            aria-pressed={muted}
            aria-label={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? 'Sound off' : 'Sound on'}
          </button>
        </div>
      </div>

      <div
        className="stage relative w-full select-none overflow-hidden"
        style={{ aspectRatio: `${WORLD.width} / ${WORLD.height}` }}
        onPointerDown={(e) => {
          e.preventDefault();
          // Bottom third of the stage ducks, everything else jumps — a thumb
          // rests low on a phone, and reaching for a separate button loses runs.
          const rect = e.currentTarget.getBoundingClientRect();
          press(e.clientY - rect.top > rect.height * 0.66 ? 'duck' : 'jump');
        }}
        onPointerUp={() => {
          release('jump');
          release('duck');
        }}
        onPointerLeave={() => {
          release('jump');
          release('duck');
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <canvas ref={canvasRef} className="block h-full w-full" />

        {phase !== 'running' && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
            <div className="pointer-events-auto rounded-[20px] bg-[var(--card)]/92 px-7 py-6 backdrop-blur-sm">
              <p className="display text-[26px] leading-none">
                {phase === 'dead' ? 'Caught by a cactus' : 'Ready'}
              </p>
              <p className="mt-2.5 text-[13.5px] text-[var(--muted)]">
                {phase === 'dead' ? (
                  <>
                    You scored {score}
                    {score >= best && score > 0 ? ' — a new best.' : `. Best is ${best}.`}
                  </>
                ) : (
                  'Space or tap to jump. Hold down to duck.'
                )}
              </p>
              <button className="btn btn-primary mt-4" onClick={start}>
                {phase === 'dead' ? 'Run again' : 'Start running'}
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="px-1 text-[12.5px] text-[var(--faint)]">
        {offlineReady
          ? 'Saved to this device — it runs with no connection.'
          : 'Caching for offline play…'}
        {' Space / ↑ to jump, ↓ to duck. A short tap gives a short hop.'}
      </p>
    </div>
  );
}

const pad = (n: number) => String(n).padStart(5, '0');
