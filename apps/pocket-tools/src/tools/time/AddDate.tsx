'use client';

import { useEffect, useState } from 'react';
import { Columns, Field, NumberField, Segmented } from '@/components/ui';
import { ResultHero, ResultRows } from '@/components/ResultCard';
import { useToolActions, useToolParams } from '@/components/AppState';
import { addToDate, dateDiff, formatDate, fromIso, toIso, todayYmd } from '@/utils/dates';
import { parseAmount, number } from '@/utils/format';

type Unit = 'days' | 'weeks' | 'months' | 'years';

export default function AddDate() {
  const [start, setStart] = useState('');
  const [op, setOp] = useState<'add' | 'subtract'>('add');
  const [amount, setAmount] = useState('45');
  const [unit, setUnit] = useState<Unit>('days');

  useEffect(() => setStart(toIso(todayYmd())), []);
  useToolParams((p) => {
    const a = Number(p.get('amount'));
    if (Number.isFinite(a) && p.get('amount')) { setOp(a < 0 ? 'subtract' : 'add'); setAmount(String(Math.abs(a))); }
    const u = p.get('unit') as Unit | null;
    if (u && ['days', 'weeks', 'months', 'years'].includes(u)) setUnit(u);
  });

  const s = fromIso(start);
  const n = parseAmount(amount);
  const result = s && n !== null && Number.isInteger(n) ? addToDate(s, op === 'add' ? n : -n, unit) : null;
  const iso = result ? toIso(result) : null;
  const today = todayYmd();
  const away = result ? dateDiff(today, result) : null;
  useToolActions({ copy: () => (result ? formatDate(result) : null) });

  return (
    <Columns
      inputs={
        <>
          <Field label="Start from" htmlFor="start"><input id="start" type="date" className="input" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
          <Segmented label="Add or subtract" hideLabel value={op} onChange={setOp} options={[{ id: 'add', label: '+ Add' }, { id: 'subtract', label: '− Subtract' }]} />
          <NumberField label="How many" value={amount} onChange={setAmount} inputMode="numeric" />
          <Segmented label="Of" hideLabel value={unit} onChange={setUnit} options={[{ id: 'days', label: 'Days' }, { id: 'weeks', label: 'Weeks' }, { id: 'months', label: 'Months' }, { id: 'years', label: 'Years' }]} />
        </>
      }
      result={
        result ? (
          <>
            <ResultHero label="That’s" value={formatDate(result, 'short')} caption={formatDate(result)} copy={formatDate(result)} />
            <ResultRows rows={[
              { label: 'ISO date', value: iso, copy: iso ?? '' },
              { label: 'From today', value: away ? (away.days === 0 ? 'Today' : `${number(away.days, 0)} days ${away.past ? 'ago' : 'away'}`) : '—' },
            ]} />
          </>
        ) : <ResultHero tone="muted" label="That’s" value="—" caption="Add a whole number of days, weeks, months or years." />
      }
    />
  );
}
