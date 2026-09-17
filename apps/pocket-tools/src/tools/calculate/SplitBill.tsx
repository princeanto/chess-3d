'use client';

import { useMemo, useState } from 'react';
import { Chips, Columns, NumberField, Segmented, Stepper } from '@/components/ui';
import { ResultHero, ResultRows } from '@/components/ResultCard';
import CurrencyPicker from '@/components/CurrencyPicker';
import CopyButton from '@/components/CopyButton';
import { useApp, useToolActions, useToolParams } from '@/components/AppState';
import { currencyInfo, money, parseAmount, type Currency } from '@/utils/format';
import { splitBill } from '@/utils/money';

export default function SplitBill() {
  const app = useApp();
  const [bill, setBill] = useState('');
  const [people, setPeople] = useState(2);
  const [tip, setTip] = useState('0');
  const [mode, setMode] = useState<'even' | 'custom'>('even');
  const [names, setNames] = useState<string[]>([]);
  const [own, setOwn] = useState<string[]>([]);

  useToolParams((p) => {
    if (p.get('bill')) setBill(p.get('bill')!);
    if (p.get('people')) setPeople(Math.max(1, Math.min(50, Number(p.get('people')))));
    if (p.get('tip')) setTip(p.get('tip')!);
    if (p.get('currency')) app.setCurrency(p.get('currency') as Currency);
  });

  const cur = app.currency;
  const symbol = currencyInfo(cur).symbol;
  const total = parseAmount(bill);
  const tipPct = parseAmount(tip) ?? 0;
  const nameOf = (i: number) => names[i]?.trim() || `Person ${i + 1}`;
  const result = useMemo(() => {
    if (total === null) return null;
    return splitBill(total, people, tipPct, mode === 'custom' ? Array.from({ length: people }, (_, i) => parseAmount(own[i] ?? '') ?? 0) : undefined);
  }, [total, people, tipPct, mode, own]);

  const summary = result && !result.error
    ? mode === 'even'
      ? `${money(result.each, cur)} each (${people} people, total ${money(result.grand, cur)})`
      : result.people.map((p, i) => `${nameOf(i)}: ${money(p.amount, cur)}`).join('\n')
    : null;
  useToolActions({ copy: () => summary });

  const claimed = own.slice(0, people).reduce((s, v) => s + (parseAmount(v) ?? 0), 0);

  return (
    <Columns
      inputs={
        <>
          <div className="inline-head"><span className="label">Currency</span><CurrencyPicker /></div>
          <NumberField label="Total bill" value={bill} onChange={setBill} prefix={symbol} placeholder="4,500" autoFocus />
          <Stepper label="People" value={people} onChange={setPeople} min={1} max={50} />
          <div className="stack-sm">
            <NumberField label="Tip" value={tip} onChange={setTip} suffix="%" placeholder="0" />
            <Chips label="Tip presets" options={[0, 5, 10, 15, 20]} value={tipPct} onChange={(v) => setTip(String(v))} format={(v) => (v ? `${v}%` : 'No tip')} />
          </div>
          <Segmented label="How to split" value={mode} onChange={setMode} options={[{ id: 'even', label: 'Evenly' }, { id: 'custom', label: 'By what each had' }]} />
          {mode === 'custom' && (
            <div className="people">
              <p className="hint">Enter what each person ordered. Anything left over — shared plates, service — is split evenly, and the tip follows each share.</p>
              {Array.from({ length: people }, (_, i) => (
                <div key={i} className="person">
                  <input className="input person-name" aria-label={`Name for person ${i + 1}`} placeholder={`Person ${i + 1}`} value={names[i] ?? ''} onChange={(e) => setNames((list) => { const next = list.slice(); next[i] = e.target.value; return next; })} />
                  <div className="affix person-amount">
                    <span className="affix-part" aria-hidden="true">{symbol}</span>
                    <input className="input" inputMode="decimal" aria-label={`What ${nameOf(i)} had`} placeholder="0" value={own[i] ?? ''} onChange={(e) => setOwn((list) => { const next = list.slice(); next[i] = e.target.value; return next; })} />
                  </div>
                </div>
              ))}
              {total !== null && <p className="hint">Claimed {money(claimed, cur)} of {money(total, cur)} · {money(Math.max(0, total - claimed), cur)} shared</p>}
            </div>
          )}
        </>
      }
      result={
        !result ? <ResultHero tone="muted" label="Each person" value="—" caption="Add the bill to split it." />
          : result.error ? <ResultHero tone="muted" label="Each person" value="—" caption={result.error} />
          : mode === 'even' ? (
            <>
              <ResultHero label="Each person pays" value={money(result.each, cur)} caption={`${people} ${people === 1 ? 'person' : 'people'} · ${money(result.grand, cur)} in total`} copy={money(result.each, cur)} />
              <ResultRows rows={[
                { label: 'Bill', value: money(result.total, cur) },
                { label: `Tip (${tipPct}%)`, value: money(result.tip, cur) },
                { label: 'Total', value: money(result.grand, cur), strong: true },
              ]} />
            </>
          ) : (
            <>
              <ResultRows title="Who owes what" rows={[
                ...result.people.map((p, i) => ({ label: nameOf(i), value: money(p.amount, cur), copy: money(p.amount, cur) })),
                { label: 'Total with tip', value: money(result.grand, cur), strong: true },
              ]} />
              <div className="button-row"><CopyButton text={summary ?? ''} label="Copy the split" variant="primary" /></div>
            </>
          )
      }
    />
  );
}
