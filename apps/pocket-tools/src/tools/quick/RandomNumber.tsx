'use client';

import { useRef, useState } from 'react';
import { Button, Check, Columns, NumberField, Stepper } from '@/components/ui';
import { ResultHero } from '@/components/ResultCard';
import { useApp, useToolActions, useToolParams } from '@/components/AppState';
import { randomInt } from '@/utils/random';
import { number, parseAmount } from '@/utils/format';

export default function RandomNumber() {
  const { toast } = useApp();
  const [min, setMin] = useState('1');
  const [max, setMax] = useState('100');
  const [count, setCount] = useState(1);
  const [unique, setUnique] = useState(true);
  const [values, setValues] = useState<number[]>([]);
  const [rolling, setRolling] = useState(false);
  const timer = useRef<number>();

  useToolParams((p) => { if (p.get('min')) setMin(p.get('min')!); if (p.get('max')) setMax(p.get('max')!); });

  const generate = () => {
    const lo = parseAmount(min);
    const hi = parseAmount(max);
    if (lo === null || hi === null) { toast('Add a minimum and a maximum.'); return; }
    const a = Math.ceil(Math.min(lo, hi));
    const b = Math.floor(Math.max(lo, hi));
    if (unique && count > b - a + 1) { toast(`There are only ${b - a + 1} whole numbers in that range.`); return; }
    const pick = (): number[] => {
      if (!unique) return Array.from({ length: count }, () => randomInt(a, b));
      const set = new Set<number>();
      while (set.size < count) set.add(randomInt(a, b));
      return [...set];
    };
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setValues(pick()); return; }
    setRolling(true);
    let ticks = 0;
    window.clearInterval(timer.current);
    timer.current = window.setInterval(() => {
      ticks += 1;
      setValues(Array.from({ length: count }, () => randomInt(a, b)));
      if (ticks >= 8) { window.clearInterval(timer.current); setValues(pick()); setRolling(false); }
    }, 45);
  };
  useToolActions({ run: generate, copy: () => (values.length ? values.join(', ') : null) });

  return (
    <Columns
      inputs={
        <>
          <div className="grid-2 grid-keep">
            <NumberField label="Minimum" value={min} onChange={setMin} inputMode="numeric" />
            <NumberField label="Maximum" value={max} onChange={setMax} inputMode="numeric" />
          </div>
          <Stepper label="How many" value={count} onChange={setCount} min={1} max={100} />
          {count > 1 && <Check label="No repeats" checked={unique} onChange={setUnique} />}
          <Button variant="primary" size="lg" onClick={generate}>Generate</Button>
        </>
      }
      result={
        values.length
          ? <ResultHero label={count > 1 ? 'Your numbers' : 'That’s your number'} value={<span className={rolling ? 'rolling' : ''}>{values.map((v) => number(v, 0, 'en-US')).join(', ')}</span>} caption={`Between ${min} and ${max}`} copy={rolling ? '' : values.join(', ')} />
          : <ResultHero tone="muted" label="That’s your number" value="?" caption="Press Generate." />
      }
    />
  );
}
