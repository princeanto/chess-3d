'use client';

import { useEffect, useState } from 'react';
import { Button, Check, Columns, Field } from '@/components/ui';
import { ResultHero, ResultRows } from '@/components/ResultCard';
import { useToolActions, useToolParams } from '@/components/AppState';
import { addToDate, dateDiff, dayNumber, formatDate, fromIso, toIso, todayYmd } from '@/utils/dates';
import { number, plural } from '@/utils/format';

function weekdays(a: number, b: number): number {
  let count = 0;
  for (let n = a; n < b; n += 1) {
    const day = new Date(n * 86_400_000).getUTCDay();
    if (day !== 0 && day !== 6) count += 1;
  }
  return count;
}

export default function DateDifference() {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [inclusive, setInclusive] = useState(false);

  useEffect(() => {
    const today = todayYmd();
    setA(toIso(today));
    setB(toIso(addToDate(today, 30, 'days')));
  }, []);
  useToolParams((p) => {
    if (p.get('a')) setA(p.get('a')!);
    if (p.get('b')) setB(p.get('b')!);
  });

  const da = fromIso(a);
  const db = fromIso(b);
  const d = da && db ? dateDiff(da, db) : null;
  const days = d ? d.days + (inclusive ? 1 : 0) : 0;
  useToolActions({ copy: () => (d ? `${days} days` : null) });

  const [from, to] = d?.past ? [db!, da!] : [da!, db!];
  const work = d && days <= 36600 ? weekdays(dayNumber(from), dayNumber(to) + (inclusive ? 1 : 0)) : null;

  return (
    <Columns
      inputs={
        <>
          <Field label="From" htmlFor="da"><input id="da" type="date" className="input" value={a} onChange={(e) => setA(e.target.value)} /></Field>
          <Field label="To" htmlFor="db"><input id="db" type="date" className="input" value={b} onChange={(e) => setB(e.target.value)} /></Field>
          <div className="button-row">
            <Button variant="ghost" size="sm" onClick={() => { setA(b); setB(a); }}>Swap dates</Button>
            <Button variant="ghost" size="sm" onClick={() => setA(toIso(todayYmd()))}>From today</Button>
          </div>
          <Check label="Include the end date" hint="Counts both the first and last day" checked={inclusive} onChange={setInclusive} />
        </>
      }
      result={
        d ? (
          <>
            <ResultHero label={d.past ? 'Days (the second date is earlier)' : 'Days between'} value={number(days, 0)} caption={`${formatDate(from, 'short')} → ${formatDate(to, 'short')}`} copy={`${days} days`} />
            <ResultRows rows={[
              { label: 'Weeks', value: `${plural(Math.floor(days / 7), 'week')}${days % 7 ? `, ${plural(days % 7, 'day')}` : ''}` },
              { label: 'Months', value: `${plural(d.months, 'month')}${d.calendar.days ? `, ${plural(d.calendar.days + (inclusive ? 1 : 0), 'day')}` : ''}` },
              { label: 'Years', value: `${plural(d.calendar.years, 'year')}, ${plural(d.calendar.months, 'month')}, ${plural(d.calendar.days + (inclusive ? 1 : 0), 'day')}` },
              ...(work !== null ? [{ label: 'Weekdays (Mon–Fri)', value: number(work, 0) }] : []),
            ]} />
          </>
        ) : <ResultHero tone="muted" label="Days between" value="—" caption="Pick two dates." />
      }
    />
  );
}
