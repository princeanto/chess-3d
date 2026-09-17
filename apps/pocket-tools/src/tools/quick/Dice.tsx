'use client';

import { useRef, useState } from 'react';
import { Button, Segmented, Stepper } from '@/components/ui';
import { useToolActions } from '@/components/AppState';
import { randomInt } from '@/utils/random';

const SIDES = ['4', '6', '8', '10', '12', '20'] as const;
type Sides = (typeof SIDES)[number];

const PIPS: Record<number, [number, number][]> = {
  1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]], 4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]], 6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
};

export default function Dice() {
  const [sides, setSides] = useState<Sides>('6');
  const [count, setCount] = useState(2);
  const [values, setValues] = useState<number[]>([]);
  const [rolling, setRolling] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const timer = useRef<number>();
  const n = Number(sides);

  const roll = () => {
    if (rolling) return;
    const final = Array.from({ length: count }, () => randomInt(1, n));
    const done = () => {
      setValues(final);
      setRolling(false);
      setHistory((h) => [`${final.join(' + ')}${count > 1 ? ` = ${final.reduce((a, b) => a + b, 0)}` : ''}`, ...h].slice(0, 8));
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { done(); return; }
    setRolling(true);
    let ticks = 0;
    window.clearInterval(timer.current);
    timer.current = window.setInterval(() => {
      ticks += 1;
      setValues(Array.from({ length: count }, () => randomInt(1, n)));
      if (ticks >= 7) { window.clearInterval(timer.current); done(); }
    }, 55);
  };
  const total = values.reduce((a, b) => a + b, 0);
  useToolActions({ run: roll, copy: () => (values.length ? String(total) : null) });

  return (
    <div className="stack">
      <div className="options-row">
        <Segmented label="Dice" value={sides} onChange={(s) => { setSides(s); setValues([]); }} options={SIDES.map((s) => ({ id: s, label: `D${s}` }))} />
        <Stepper label="How many" value={count} onChange={(c) => { setCount(c); setValues([]); }} min={1} max={6} />
      </div>
      <section className="dice-board" aria-live="polite" aria-label={values.length ? `Rolled ${values.join(', ')}` : 'Not rolled yet'}>
        <div className="dice">
          {(values.length ? values : Array.from({ length: count }, () => 0)).map((v, i) => (
            <div key={i} className={`die${rolling ? ' is-rolling' : ''}${n !== 6 ? ' die-number' : ''}`} style={{ animationDelay: `${i * 30}ms` }}>
              {n === 6 && v ? (
                <span className="pips">{PIPS[v].map(([r, c], k) => <i key={k} style={{ gridRow: r + 1, gridColumn: c + 1 }} />)}</span>
              ) : <span>{v || '?'}</span>}
              {n !== 6 && <small>D{n}</small>}
            </div>
          ))}
        </div>
        {values.length > 1 && !rolling && <p className="dice-total">Total <strong>{total}</strong></p>}
        <Button variant="primary" size="lg" onClick={roll} disabled={rolling}>Roll</Button>
      </section>
      {history.length > 1 && (
        <p className="hint">Earlier: {history.slice(1).join(' · ')}</p>
      )}
    </div>
  );
}
