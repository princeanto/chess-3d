'use client';

import { useState } from 'react';
import { Columns, NumberField, Segmented } from '@/components/ui';
import { ResultHero } from '@/components/ResultCard';
import { useApp, useToolActions, useToolParams } from '@/components/AppState';
import { currencyInfo, money, number, parseAmount, type Currency } from '@/utils/format';
import { percentChange, percentOf, whatPercent } from '@/utils/money';

type Mode = 'of' | 'what' | 'change';

const hasMoney = (s: string) => /[₹$€£]/.test(s);

export default function Percentage() {
  const app = useApp();
  const [mode, setMode] = useState<Mode>('of');
  const [x, setX] = useState('');
  const [y, setY] = useState('');
  const [currency, setCurrency] = useState<Currency | null>(null);

  useToolParams((p) => {
    const m = p.get('mode') as Mode | null;
    if (m === 'of' || m === 'what' || m === 'change') setMode(m);
    if (p.get('x')) setX(p.get('x')!);
    if (p.get('y')) setY(p.get('y')!);
    if (p.get('currency')) setCurrency(p.get('currency') as Currency);
  });

  const xv = parseAmount(x);
  const yv = parseAmount(y);
  const cur = currency ?? (hasMoney(y) || hasMoney(x) ? app.currency : null);
  const fmt = (n: number) => (cur ? money(n, cur) : number(n, 4, 'en-US'));

  let value: string | null = null;
  let caption = '';
  if (xv !== null && yv !== null) {
    if (mode === 'of') {
      value = fmt(percentOf(xv, yv));
      caption = `${number(xv, 4, 'en-US')}% of ${fmt(yv)}`;
    } else if (mode === 'what') {
      const r = whatPercent(xv, yv);
      value = r === null ? null : `${number(r, 2, 'en-US')}%`;
      caption = r === null ? 'Can’t take a percentage of zero.' : `${fmt(xv)} is ${number(r, 2, 'en-US')}% of ${fmt(yv)}`;
    } else {
      const r = percentChange(xv, yv);
      value = r === null ? null : `${r > 0 ? '+' : ''}${number(r, 2, 'en-US')}%`;
      caption = r === null ? 'Can’t measure change from zero.' : `From ${fmt(xv)} to ${fmt(yv)} is ${r >= 0 ? 'an increase' : 'a decrease'} of ${number(Math.abs(r), 2, 'en-US')}% (${yv - xv >= 0 ? '+' : '−'}${fmt(Math.abs(yv - xv))})`;
    }
  }
  useToolActions({ copy: () => value });

  const labels: Record<Mode, [string, string, string?, string?]> = {
    of: ['Percentage', 'Of', '%', undefined],
    what: ['Value', 'Out of', undefined, undefined],
    change: ['From', 'To', undefined, undefined],
  };
  const [lx, ly, sx] = labels[mode];
  const symbol = cur ? currencyInfo(cur).symbol : undefined;

  return (
    <Columns
      inputs={
        <>
          <Segmented label="What do you want to know?" value={mode} onChange={setMode} wrap options={[
            { id: 'of', label: 'X% of Y' },
            { id: 'what', label: 'X is what % of Y' },
            { id: 'change', label: '% change' },
          ]} />
          <div className="grid-2">
            <NumberField label={lx} value={x} onChange={setX} suffix={sx} prefix={mode !== 'of' ? symbol : undefined} placeholder={mode === 'of' ? '18' : '30'} autoFocus />
            <NumberField label={ly} value={y} onChange={setY} prefix={symbol} placeholder={mode === 'of' ? '2,500' : '120'} />
          </div>
          <p className="hint">Type amounts any way you like: 2,500 · ₹2,500 · 2.5k</p>
        </>
      }
      result={
        value !== null
          ? <ResultHero value={value} caption={caption} copy={value} />
          : <ResultHero tone="muted" value="—" caption={caption || 'Add two numbers to see the answer.'} />
      }
    />
  );
}
