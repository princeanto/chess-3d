'use client';

import { useState } from 'react';
import { Columns, NumberField, Stepper } from '@/components/ui';
import { ResultHero, ResultRows } from '@/components/ResultCard';
import CopyButton from '@/components/CopyButton';
import { useToolActions } from '@/components/AppState';
import { grid } from '@/utils/design';
import { number, parseAmount } from '@/utils/format';

export default function GridCalculator() {
  const [container, setContainer] = useState('1440');
  const [columns, setColumns] = useState(12);
  const [gutter, setGutter] = useState('24');
  const [margin, setMargin] = useState('80');

  const c = parseAmount(container);
  const g = parseAmount(gutter) ?? 0;
  const m = parseAmount(margin) ?? 0;
  const r = c ? grid(c, columns, g, m) : null;
  const f = (n: number) => number(n, 2, 'en-US');
  const css = r && !r.error
    ? `.grid {\n  display: grid;\n  grid-template-columns: repeat(${columns}, minmax(0, 1fr));\n  column-gap: ${g}px;\n  max-width: ${c}px;\n  padding-inline: ${m}px;\n  margin-inline: auto;\n}\n/* column width: ${f(r.column)}px */`
    : '';
  useToolActions({ copy: () => (r && !r.error ? `${f(r.column)}px` : null) });

  return (
    <Columns
      inputs={
        <>
          <NumberField label="Container width" value={container} onChange={setContainer} suffix="px" inputMode="decimal" autoFocus />
          <Stepper label="Columns" value={columns} onChange={setColumns} min={1} max={48} />
          <div className="grid-2 grid-keep">
            <NumberField label="Gutter" value={gutter} onChange={setGutter} suffix="px" inputMode="decimal" />
            <NumberField label="Margin (each side)" value={margin} onChange={setMargin} suffix="px" inputMode="decimal" />
          </div>
        </>
      }
      result={
        r && !r.error ? (
          <>
            <ResultHero label="Column width" value={<>{f(r.column)} <span className="unit">px</span></>} caption={`${columns} columns · ${g}px gutters · ${m}px margins`} copy={`${f(r.column)}px`}>
              <CopyButton text={css} label="Copy CSS" variant="ghost" />
            </ResultHero>
            <section className="grid-preview" aria-hidden="true" style={{ padding: `0 ${(m / c!) * 100}%`, gap: `${(g / c!) * 100}%` }}>
              {r.columns.map((_, i) => <span key={i} />)}
            </section>
            <ResultRows rows={[
              { label: 'Content width', value: `${f(r.content)} px` },
              { label: 'Total gutters', value: `${f(g * (columns - 1))} px` },
              { label: 'Span of 2 columns', value: `${f(r.column * 2 + g)} px`, copy: f(r.column * 2 + g) },
              { label: 'Span of 3 columns', value: `${f(r.column * 3 + g * 2)} px`, copy: f(r.column * 3 + g * 2) },
            ]} />
          </>
        ) : <ResultHero tone="muted" label="Column width" value="—" caption={r?.error ?? 'Add a container width.'} />
      }
    />
  );
}
