'use client';

import { useEffect, useState } from 'react';
import { Columns, Field } from '@/components/ui';
import { ResultHero, ResultRows } from '@/components/ResultCard';
import { useToolActions, useToolParams } from '@/components/AppState';
import { age, formatDate, fromIso, toIso, todayYmd } from '@/utils/dates';
import { number } from '@/utils/format';

export default function Age() {
  const [dob, setDob] = useState('');
  const [on, setOn] = useState('');
  useEffect(() => setOn(toIso(todayYmd())), []);
  useToolParams((p) => { if (p.get('dob')) setDob(p.get('dob')!); });

  const born = fromIso(dob);
  const at = fromIso(on);
  const r = born && at ? age(born, at) : null;
  const headline = r ? `${r.years} ${r.years === 1 ? 'year' : 'years'}` : null;
  useToolActions({ copy: () => (r ? `${r.years} years, ${r.months} months, ${r.days} days` : null) });

  return (
    <Columns
      inputs={
        <>
          <Field label="Date of birth" htmlFor="dob"><input id="dob" type="date" className="input" value={dob} max={on || undefined} onChange={(e) => setDob(e.target.value)} /></Field>
          <Field label="Age on" htmlFor="on" hint="Today, unless you change it."><input id="on" type="date" className="input" value={on} onChange={(e) => setOn(e.target.value)} /></Field>
        </>
      }
      result={
        r ? (
          <>
            <ResultHero label="Age" value={headline} caption={`${r.months} ${r.months === 1 ? 'month' : 'months'} and ${r.days} ${r.days === 1 ? 'day' : 'days'}`} copy={`${r.years} years, ${r.months} months, ${r.days} days`} />
            <ResultRows rows={[
              { label: 'Next birthday', value: r.daysUntilBirthday === 0 ? 'Today 🎉' : formatDate(r.nextBirthday) },
              { label: 'Days until then', value: r.daysUntilBirthday === 0 ? '0' : `${number(r.daysUntilBirthday, 0)} (turning ${r.turning})` },
              { label: 'Days alive', value: number(r.totalDays, 0), copy: String(r.totalDays) },
              { label: 'Weeks alive', value: number(Math.floor(r.totalDays / 7), 0) },
            ]} />
          </>
        ) : <ResultHero tone="muted" label="Age" value="—" caption={born && at ? 'That date of birth is after the date you’re measuring to.' : 'Add a date of birth.'} />
      }
    />
  );
}
