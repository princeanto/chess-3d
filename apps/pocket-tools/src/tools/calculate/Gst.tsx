'use client';

import { useState } from 'react';
import { Chips, Columns, NumberField, Segmented } from '@/components/ui';
import { ResultHero, ResultRows } from '@/components/ResultCard';
import { useToolActions, useToolParams } from '@/components/AppState';
import { money, number, parseAmount } from '@/utils/format';
import { gst } from '@/utils/money';

/* GST is Indian, so it is always in rupees. */
export default function Gst() {
  const [amount, setAmount] = useState('');
  const [rate, setRate] = useState('18');
  const [mode, setMode] = useState<'add' | 'remove'>('add');

  useToolParams((p) => {
    if (p.get('amount')) setAmount(p.get('amount')!);
    if (p.get('rate')) setRate(p.get('rate')!);
    const m = p.get('mode');
    if (m === 'add' || m === 'remove') setMode(m);
  });

  const a = parseAmount(amount);
  const r = parseAmount(rate);
  const res = a !== null && r !== null ? gst(a, r, mode) : null;
  const headline = res ? money(mode === 'add' ? res.total : res.base, 'INR') : null;
  useToolActions({ copy: () => headline });

  return (
    <Columns
      inputs={
        <>
          <Segmented label="The amount I have" value={mode} onChange={setMode} options={[{ id: 'add', label: 'Excludes GST — add it' }, { id: 'remove', label: 'Includes GST — remove it' }]} wrap />
          <NumberField label={mode === 'add' ? 'Amount before GST' : 'Amount including GST'} value={amount} onChange={setAmount} prefix="₹" placeholder="1,000" autoFocus />
          <div className="stack-sm">
            <NumberField label="GST rate" value={rate} onChange={setRate} suffix="%" />
            <Chips label="GST slabs" options={[5, 12, 18, 28]} value={r} onChange={(v) => setRate(String(v))} format={(v) => `${v}%`} />
          </div>
        </>
      }
      result={
        res ? (
          <>
            <ResultHero label={mode === 'add' ? 'Total with GST' : 'Price before GST'} value={headline} caption={`GST at ${number(r!, 2, 'en-US')}% is ${money(res.gst, 'INR')}`} copy={headline ?? ''} />
            <ResultRows rows={[
              { label: 'Base amount', value: money(res.base, 'INR'), copy: money(res.base, 'INR') },
              { label: `CGST (${number(r! / 2, 2, 'en-US')}%)`, value: money(res.cgst, 'INR'), muted: true },
              { label: `SGST (${number(r! / 2, 2, 'en-US')}%)`, value: money(res.sgst, 'INR'), muted: true },
              { label: `GST (${number(r!, 2, 'en-US')}%)`, value: money(res.gst, 'INR'), copy: money(res.gst, 'INR') },
              { label: 'Total', value: money(res.total, 'INR'), strong: true, copy: money(res.total, 'INR') },
            ]} />
            <p className="hint">Within a state, GST splits equally into CGST and SGST. Between states it is charged as IGST at the full rate.</p>
          </>
        ) : <ResultHero tone="muted" label="Total with GST" value="—" caption="Add an amount to calculate GST." />
      }
    />
  );
}
