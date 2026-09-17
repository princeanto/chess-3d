'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui';
import CopyButton from '@/components/CopyButton';
import { useToolActions } from '@/components/AppState';
import { formatClock } from '@/utils/dates';

/**
 * Time is measured from performance.now(), not by counting frames, so the
 * reading is right even if the tab was in the background. Space starts and
 * stops; L takes a lap.
 */
export default function Stopwatch() {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [laps, setLaps] = useState<number[]>([]);
  const base = useRef(0);
  const startedAt = useRef(0);
  const frame = useRef(0);

  const current = () => (running ? base.current + performance.now() - startedAt.current : base.current);

  useEffect(() => {
    if (!running) return;
    const tick = () => { setElapsed(base.current + performance.now() - startedAt.current); frame.current = requestAnimationFrame(tick); };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [running]);

  const toggle = () => {
    if (running) { base.current += performance.now() - startedAt.current; setElapsed(base.current); setRunning(false); }
    else { startedAt.current = performance.now(); setRunning(true); }
  };
  const lap = () => { if (running || elapsed) setLaps((l) => [current(), ...l]); };
  const reset = () => { setRunning(false); base.current = 0; setElapsed(0); setLaps([]); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || e.metaKey || e.ctrlKey) return;
      if (e.key === ' ' && t.tagName !== 'BUTTON') { e.preventDefault(); toggle(); }
      if (e.key.toLowerCase() === 'l') lap();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const lapTimes = laps.map((total, i) => total - (laps[i + 1] ?? 0));
  const fastest = lapTimes.length > 1 ? Math.min(...lapTimes) : null;
  const slowest = lapTimes.length > 1 ? Math.max(...lapTimes) : null;
  const text = [`Total ${formatClock(elapsed, true)}`, ...laps.map((t, i) => `Lap ${laps.length - i}: ${formatClock(lapTimes[i], true)} (${formatClock(t, true)})`)].join('\n');
  useToolActions({ run: toggle, copy: () => (elapsed ? text : null) });

  return (
    <div className="timer-tool">
      <section className="clock-card">
        <p className="clock" role="timer" aria-live="off">{formatClock(elapsed, true)}</p>
        <div className="clock-actions">
          <Button variant="primary" size="lg" onClick={toggle}>{running ? 'Pause' : elapsed ? 'Resume' : 'Start'}</Button>
          <Button size="lg" onClick={lap} disabled={!running}>Lap</Button>
          <Button size="lg" variant="ghost" onClick={reset} disabled={!elapsed}>Reset</Button>
        </div>
        <p className="hint">Space to start and pause · L for a lap</p>
      </section>
      {laps.length > 0 && (
        <section className="laps">
          <div className="laps-head"><p className="result-label">Laps</p><CopyButton text={text} variant="ghost" size="sm" /></div>
          <ol>
            {laps.map((total, i) => (
              <li key={laps.length - i} className={lapTimes[i] === fastest ? 'lap-fast' : lapTimes[i] === slowest ? 'lap-slow' : ''}>
                <span>Lap {laps.length - i}{lapTimes[i] === fastest ? ' · fastest' : lapTimes[i] === slowest ? ' · slowest' : ''}</span>
                <span>{formatClock(lapTimes[i], true)}</span>
                <span className="lap-total">{formatClock(total, true)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
