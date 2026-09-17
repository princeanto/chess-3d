'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, Chips } from '@/components/ui';
import { useApp, useToolActions, useToolParams } from '@/components/AppState';
import { formatClock } from '@/utils/dates';
import { chime, prime } from '@/utils/sound';

type Status = 'idle' | 'running' | 'paused' | 'done';

export default function Countdown() {
  const { toast } = useApp();
  const [h, setH] = useState('0');
  const [m, setM] = useState('5');
  const [s, setS] = useState('0');
  const [status, setStatus] = useState<Status>('idle');
  const [left, setLeft] = useState(0);
  const [total, setTotal] = useState(0);
  const endsAt = useRef(0);

  useToolParams((p) => {
    const secs = Number(p.get('seconds'));
    if (secs > 0) {
      setH(String(Math.floor(secs / 3600)));
      setM(String(Math.floor((secs % 3600) / 60)));
      setS(String(secs % 60));
    }
  });

  const setSeconds = () => (Number(h) || 0) * 3600 + (Number(m) || 0) * 60 + (Number(s) || 0);

  useEffect(() => {
    if (status !== 'running') return;
    const id = window.setInterval(() => {
      const remaining = endsAt.current - Date.now();
      if (remaining <= 0) {
        setLeft(0);
        setStatus('done');
        chime();
        toast('Time’s up.');
      } else {
        setLeft(remaining);
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [status, toast]);

  useEffect(() => {
    if (status === 'running') document.title = `${formatClock(left)} · Countdown`;
    else if (status === 'done') document.title = 'Time’s up · Countdown';
    return () => { document.title = 'Countdown Timer · Pocket Tools'; };
  }, [status, left]);

  const start = () => {
    prime();
    if (status === 'paused') {
      endsAt.current = Date.now() + left;
      setStatus('running');
      return;
    }
    const secs = setSeconds();
    if (secs <= 0) { toast('Add a time to continue.'); return; }
    setTotal(secs * 1000);
    setLeft(secs * 1000);
    endsAt.current = Date.now() + secs * 1000;
    setStatus('running');
  };
  const pause = () => { setLeft(endsAt.current - Date.now()); setStatus('paused'); };
  const reset = () => { setStatus('idle'); setLeft(0); };
  useToolActions({ run: () => (status === 'running' ? pause() : start()) });

  const shown = status === 'idle' ? setSeconds() * 1000 : left;
  const progress = total && status !== 'idle' ? 1 - left / total : 0;

  return (
    <div className="timer-tool">
      {status === 'idle' && (
        <section className="timer-set">
          <div className="hms">
            {([['Hours', h, setH, 99], ['Minutes', m, setM, 59], ['Seconds', s, setS, 59]] as const).map(([label, value, set, max]) => (
              <label key={label} className="hms-part">
                <input className="hms-input" inputMode="numeric" value={value} aria-label={label} onFocus={(e) => e.target.select()}
                  onChange={(e) => { const n = parseInt(e.target.value.replace(/\D/g, '') || '0', 10); set(String(Math.min(max, n))); }} />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <Chips label="Quick timers" options={[1, 3, 5, 10, 15, 30, 60]} value={null} onChange={(v) => { setH(String(Math.floor(v / 60))); setM(String(v % 60)); setS('0'); }} format={(v) => (v === 60 ? '1 h' : `${v} min`)} />
        </section>
      )}
      <section className={`clock-card${status === 'done' ? ' is-done' : ''}`}>
        <div className="ring" style={{ ['--p' as string]: progress }} aria-hidden="true" />
        <p className="clock" role="timer">{status === 'done' ? '00:00' : formatClock(Math.ceil(shown / 1000) * 1000)}</p>
        {status === 'done' && <p className="clock-note">Time’s up.</p>}
        <div className="clock-actions">
          {status === 'running'
            ? <Button variant="primary" size="lg" onClick={pause}>Pause</Button>
            : status === 'done'
              ? <Button variant="primary" size="lg" onClick={reset}>Set another</Button>
              : <Button variant="primary" size="lg" onClick={start}>{status === 'paused' ? 'Resume' : 'Start'}</Button>}
          {status !== 'idle' && status !== 'done' && <Button size="lg" variant="ghost" onClick={reset}>Reset</Button>}
        </div>
      </section>
    </div>
  );
}
