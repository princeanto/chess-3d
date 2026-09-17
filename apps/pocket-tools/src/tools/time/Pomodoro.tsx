'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, NumberField, Segmented } from '@/components/ui';
import { useApp, useToolActions } from '@/components/AppState';
import { formatClock } from '@/utils/dates';
import { chime, prime } from '@/utils/sound';
import { load, save } from '@/utils/storage';

type Preset = '15-5' | '25-5' | '50-10' | 'custom';
type Phase = 'focus' | 'break';

export default function Pomodoro() {
  const { toast } = useApp();
  const [preset, setPreset] = useState<Preset>('25-5');
  const [customFocus, setCustomFocus] = useState('30');
  const [customBreak, setCustomBreak] = useState('5');
  const [phase, setPhase] = useState<Phase>('focus');
  const [running, setRunning] = useState(false);
  const [left, setLeft] = useState(25 * 60_000);
  const [sessions, setSessions] = useState(0);
  const endsAt = useRef(0);

  const lengths = (): [number, number] => {
    if (preset === 'custom') return [Math.max(1, Number(customFocus) || 25), Math.max(1, Number(customBreak) || 5)];
    const [f, b] = preset.split('-').map(Number);
    return [f, b];
  };
  const [focusMin, breakMin] = lengths();
  const phaseTotal = (phase === 'focus' ? focusMin : breakMin) * 60_000;

  useEffect(() => {
    setPreset(load<Preset>('pomodoro.preset', '25-5'));
    setSessions(load<{ day: string; n: number }>('pomodoro.today', { day: '', n: 0 }).day === new Date().toDateString() ? load<{ day: string; n: number }>('pomodoro.today', { day: '', n: 0 }).n : 0);
  }, []);
  useEffect(() => { save('pomodoro.preset', preset); }, [preset]);
  useEffect(() => { if (!running) setLeft(phaseTotal); }, [preset, customFocus, customBreak, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const remaining = endsAt.current - Date.now();
      if (remaining > 0) { setLeft(remaining); return; }
      chime();
      if (phase === 'focus') {
        const n = sessions + 1;
        setSessions(n);
        save('pomodoro.today', { day: new Date().toDateString(), n });
        toast('Focus done. Take a break.');
        setPhase('break');
        endsAt.current = Date.now() + breakMin * 60_000;
        setLeft(breakMin * 60_000);
      } else {
        toast('Break over. Back to it.');
        setPhase('focus');
        endsAt.current = Date.now() + focusMin * 60_000;
        setLeft(focusMin * 60_000);
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [running, phase, sessions, focusMin, breakMin, toast]);

  useEffect(() => {
    if (running) document.title = `${formatClock(left)} · ${phase === 'focus' ? 'Focus' : 'Break'}`;
    return () => { document.title = 'Pomodoro · Pocket Tools'; };
  }, [running, left, phase]);

  const toggle = () => {
    if (running) { setLeft(endsAt.current - Date.now()); setRunning(false); }
    else { prime(); endsAt.current = Date.now() + left; setRunning(true); }
  };
  const reset = () => { setRunning(false); setLeft(phaseTotal); };
  const skip = () => {
    const next: Phase = phase === 'focus' ? 'break' : 'focus';
    const ms = (next === 'focus' ? focusMin : breakMin) * 60_000;
    setPhase(next);
    setLeft(ms);
    if (running) endsAt.current = Date.now() + ms;
  };
  useToolActions({ run: toggle });

  const progress = 1 - left / phaseTotal;

  return (
    <div className="timer-tool">
      <div className="options-row">
        <Segmented label="Focus / break" value={preset} onChange={(p) => { setPreset(p); setRunning(false); setPhase('focus'); }} options={[{ id: '15-5', label: '15 / 5' }, { id: '25-5', label: '25 / 5' }, { id: '50-10', label: '50 / 10' }, { id: 'custom', label: 'Custom' }]} />
        {preset === 'custom' && (
          <div className="grid-2 grid-keep pomo-custom">
            <NumberField label="Focus" value={customFocus} onChange={setCustomFocus} suffix="min" inputMode="numeric" />
            <NumberField label="Break" value={customBreak} onChange={setCustomBreak} suffix="min" inputMode="numeric" />
          </div>
        )}
      </div>
      <section className={`clock-card phase-${phase}`}>
        <p className="phase-label">{phase === 'focus' ? 'Focus' : 'Break'}</p>
        <div className="ring" style={{ ['--p' as string]: progress }} aria-hidden="true" />
        <p className="clock" role="timer">{formatClock(Math.ceil(left / 1000) * 1000)}</p>
        <div className="clock-actions">
          <Button variant="primary" size="lg" onClick={toggle}>{running ? 'Pause' : left < phaseTotal ? 'Resume' : 'Start'}</Button>
          <Button size="lg" onClick={skip}>{phase === 'focus' ? 'Skip to break' : 'Skip break'}</Button>
          <Button size="lg" variant="ghost" onClick={reset}>Reset</Button>
        </div>
        <p className="hint">{sessions ? `${sessions} focus ${sessions === 1 ? 'session' : 'sessions'} today` : 'A chime marks the end of each focus and break.'}</p>
      </section>
    </div>
  );
}
