'use client';

import { useState } from 'react';
import { Columns, Field, NumberField } from '@/components/ui';
import { ResultHero, ResultRows } from '@/components/ResultCard';
import { useToolActions, useToolParams } from '@/components/AppState';
import { minutesToText, parseTime, timeDiff } from '@/utils/dates';
import { number, parseAmount } from '@/utils/format';

const toInput = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

export default function TimeDifference() {
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('17:30');
  const [breakMin, setBreakMin] = useState('0');

  useToolParams((p) => {
    const a = parseTime(p.get('start') ?? '');
    const b = parseTime(p.get('end') ?? '');
    if (a !== null) setStart(toInput(a));
    if (b !== null) setEnd(toInput(b));
  });

  const a = parseTime(start);
  const b = parseTime(end);
  const pause = Math.max(0, parseAmount(breakMin) ?? 0);
  const d = a !== null && b !== null ? timeDiff(a, b) : null;
  const minutes = d ? Math.max(0, d.minutes - pause) : 0;
  useToolActions({ copy: () => (d ? minutesToText(minutes) : null) });

  return (
    <Columns
      inputs={
        <>
          <div className="grid-2 grid-keep">
            <Field label="Start" htmlFor="ts"><input id="ts" type="time" className="input" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
            <Field label="End" htmlFor="te"><input id="te" type="time" className="input" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
          </div>
          <NumberField label="Minus a break" value={breakMin} onChange={setBreakMin} suffix="min" inputMode="numeric" hint="For shifts and timesheets. Leave at 0 otherwise." />
        </>
      }
      result={
        d ? (
          <>
            <ResultHero label="Duration" value={minutesToText(minutes)} caption={d.overnight ? 'Runs past midnight into the next day.' : pause ? `${minutesToText(d.minutes)} minus a ${pause} min break` : undefined} copy={minutesToText(minutes)} />
            <ResultRows rows={[
              { label: 'In hours', value: `${number(minutes / 60, 2, 'en-US')} h`, copy: number(minutes / 60, 2, 'en-US') },
              { label: 'In minutes', value: `${number(minutes, 0)} min`, copy: String(minutes) },
            ]} />
          </>
        ) : <ResultHero tone="muted" label="Duration" value="—" caption="Pick a start and end time." />
      }
    />
  );
}
