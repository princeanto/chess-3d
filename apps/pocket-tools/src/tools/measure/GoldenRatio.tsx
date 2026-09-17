'use client';

import { useState } from 'react';
import { Columns, NumberField } from '@/components/ui';
import { ResultHero, ResultRows } from '@/components/ResultCard';
import { useToolActions } from '@/components/AppState';
import { goldenRatio, PHI } from '@/utils/design';
import { number, parseAmount } from '@/utils/format';

export default function GoldenRatio() {
  const [value, setValue] = useState('960');
  const v = parseAmount(value);
  const g = v !== null && v > 0 ? goldenRatio(v) : null;
  const f = (n: number) => number(n, 2, 'en-US');
  useToolActions({ copy: () => (g ? f(g.larger) : null) });

  return (
    <Columns
      inputs={
        <>
          <NumberField label="Size" value={value} onChange={setValue} hint="A width, a font size, a column — any length." autoFocus />
          <p className="hint">φ = {PHI.toFixed(6)}. Two lengths are in golden proportion when the larger is φ times the smaller.</p>
        </>
      }
      result={
        g ? (
          <>
            <ResultHero label="Golden larger" value={f(g.larger)} caption={`${f(v!)} × φ`} copy={f(g.larger)} />
            <ResultRows rows={[
              { label: 'Golden smaller', value: f(g.smaller), copy: f(g.smaller) },
              { label: 'Split: long part', value: f(g.long), copy: f(g.long) },
              { label: 'Split: short part', value: f(g.short), copy: f(g.short) },
            ]} />
            <section className="golden" aria-label="Golden split">
              <span style={{ flexGrow: g.long }}>{f(g.long)}</span>
              <span style={{ flexGrow: g.short }}>{f(g.short)}</span>
            </section>
          </>
        ) : <ResultHero tone="muted" label="Golden larger" value="—" caption="Add a size above zero." />
      }
    />
  );
}
