'use client';

import { useState } from 'react';
import { Check, Chips, Columns, NumberField } from '@/components/ui';
import { ResultHero, ResultRows } from '@/components/ResultCard';
import CurrencyPicker from '@/components/CurrencyPicker';
import { useApp, useToolActions, useToolParams } from '@/components/AppState';
import { currencyInfo, money, number, parseAmount, type Currency } from '@/utils/format';
import { discount } from '@/utils/money';

export default function Discount() {
  const app = useApp();
  const [price, setPrice] = useState('');
  const [off, setOff] = useState('20');
  const [withTax, setWithTax] = useState(false);
  const [tax, setTax] = useState('18');

  useToolParams((p) => {
    if (p.get('price')) setPrice(p.get('price')!);
    if (p.get('off')) setOff(p.get('off')!);
    if (p.get('currency')) app.setCurrency(p.get('currency') as Currency);
  });

  const cur = app.currency;
  const pv = parseAmount(price);
  const ov = parseAmount(off);
  const tv = withTax ? parseAmount(tax) ?? 0 : 0;
  const r = pv !== null && ov !== null ? discount(pv, ov, tv) : null;
  const final = r ? money(r.final, cur) : null;
  useToolActions({ copy: () => final });

  return (
    <Columns
      inputs={
        <>
          <div className="inline-head"><span className="label">Currency</span><CurrencyPicker /></div>
          <NumberField label="Original price" value={price} onChange={setPrice} prefix={currencyInfo(cur).symbol} placeholder="2,500" autoFocus />
          <div className="stack-sm">
            <NumberField label="Discount" value={off} onChange={setOff} suffix="%" placeholder="20" />
            <Chips label="Common discounts" options={[10, 15, 20, 25, 30, 50]} value={ov} onChange={(v) => setOff(String(v))} format={(v) => `${v}%`} />
          </div>
          <Check label="Add tax after the discount" checked={withTax} onChange={setWithTax} />
          {withTax && <NumberField label="Tax" value={tax} onChange={setTax} suffix="%" placeholder="18" />}
        </>
      }
      result={
        r ? (
          <>
            <ResultHero label="You pay" value={final} caption={`You save ${money(r.discount, cur)} (${number(ov ?? 0, 2, 'en-US')}% off)`} copy={final ?? ''} />
            <ResultRows rows={[
              { label: 'Original', value: money(r.original, cur) },
              { label: 'Discount', value: `− ${money(r.discount, cur)}` },
              ...(withTax ? [{ label: 'After discount', value: money(r.afterDiscount, cur) }, { label: `Tax (${number(tv, 2, 'en-US')}%)`, value: `+ ${money(r.tax, cur)}` }] : []),
              { label: 'Final price', value: final, strong: true, copy: final ?? '' },
            ]} />
          </>
        ) : <ResultHero tone="muted" label="You pay" value="—" caption="Add a price to see the discount." />
      }
    />
  );
}
