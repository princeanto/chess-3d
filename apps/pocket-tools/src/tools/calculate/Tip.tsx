'use client';

import { useState } from 'react';
import { Chips, Columns, NumberField, Stepper } from '@/components/ui';
import { ResultHero, ResultRows } from '@/components/ResultCard';
import CurrencyPicker from '@/components/CurrencyPicker';
import { useApp, useToolActions, useToolParams } from '@/components/AppState';
import { currencyInfo, money, parseAmount } from '@/utils/format';
import { tip as tipCalc } from '@/utils/money';

export default function Tip() {
  const app = useApp();
  const [bill, setBill] = useState('');
  const [percent, setPercent] = useState('10');
  const [people, setPeople] = useState(1);

  useToolParams((p) => {
    if (p.get('bill')) setBill(p.get('bill')!);
    if (p.get('percent')) setPercent(p.get('percent')!);
  });

  const cur = app.currency;
  const b = parseAmount(bill);
  const pct = parseAmount(percent) ?? 0;
  const r = b !== null ? tipCalc(b, pct, people) : null;
  useToolActions({ copy: () => (r ? money(people > 1 ? r.perPerson : r.tip, cur) : null) });

  return (
    <Columns
      inputs={
        <>
          <div className="inline-head"><span className="label">Currency</span><CurrencyPicker /></div>
          <NumberField label="Bill" value={bill} onChange={setBill} prefix={currencyInfo(cur).symbol} placeholder="1,200" autoFocus />
          <div className="stack-sm">
            <NumberField label="Tip" value={percent} onChange={setPercent} suffix="%" />
            <Chips label="Tip presets" options={[5, 10, 12, 15, 18, 20]} value={pct} onChange={(v) => setPercent(String(v))} format={(v) => `${v}%`} />
          </div>
          <Stepper label="People" value={people} onChange={setPeople} min={1} max={50} />
        </>
      }
      result={
        r ? (
          <>
            <ResultHero label={people > 1 ? 'Each person pays' : 'Tip'} value={money(people > 1 ? r.perPerson : r.tip, cur)} caption={people > 1 ? `Including ${money(r.tipPerPerson, cur)} tip each` : `${pct}% of ${money(b!, cur)}`} copy={money(people > 1 ? r.perPerson : r.tip, cur)} />
            <ResultRows rows={[
              { label: 'Tip', value: money(r.tip, cur), copy: money(r.tip, cur) },
              { label: 'Total', value: money(r.total, cur), strong: true, copy: money(r.total, cur) },
              ...(people > 1 ? [{ label: 'Per person', value: money(r.perPerson, cur), copy: money(r.perPerson, cur) }] : []),
            ]} />
          </>
        ) : <ResultHero tone="muted" label="Tip" value="—" caption="Add the bill to work out the tip." />
      }
    />
  );
}
