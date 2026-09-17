'use client';

import { useEffect, useState } from 'react';
import { Chips, Field, TextField } from '@/components/ui';
import CopyButton from '@/components/CopyButton';
import { useToolActions, useToolParams } from '@/components/AppState';
import { dateDiff, formatDate, fromIso, parseDate, toIso, todayYmd, type Ymd } from '@/utils/dates';
import { number, plural } from '@/utils/format';

const EVENTS = ['New Year', 'Valentine’s Day', 'Halloween', 'Christmas'] as const;

export default function DaysUntil() {
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    if (!date) setDate(toIso(parseDate('christmas', todayYmd())!));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useToolParams((p) => { if (p.get('date')) setDate(p.get('date')!); if (p.get('name')) setName(p.get('name')!); });

  const target = fromIso(date);
  const today: Ymd | null = now ? todayYmd(now) : null;
  const d = target && today ? dateDiff(today, target) : null;
  const label = name.trim() || (target ? formatDate(target, 'short') : '');

  // Hours and minutes until the start of that day, for the last stretch.
  const msLeft = target && now ? new Date(target.y, target.m - 1, target.d).getTime() - now.getTime() : 0;
  const h = Math.max(0, Math.floor((msLeft % 86_400_000) / 3_600_000));
  const m = Math.max(0, Math.floor((msLeft % 3_600_000) / 60_000));
  const s = Math.max(0, Math.floor((msLeft % 60_000) / 1000));

  const copy = d ? (d.days === 0 ? `${label} is today` : d.past ? `${label} was ${d.days} days ago` : `${d.days} days until ${label}`) : null;
  useToolActions({ copy: () => copy });

  return (
    <div className="stack">
      <div className="grid-2">
        <Field label="Date" htmlFor="until"><input id="until" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <TextField label="What’s happening? (optional)" value={name} onChange={setName} placeholder="Trip to Goa" />
      </div>
      <Chips label="Quick dates" options={EVENTS} value={null} onChange={(e) => { setDate(toIso(parseDate(e.replace('’s Day', '').replace('Valentine', 'valentines'), todayYmd())!)); setName(e); }} />

      <section className="countdown-card" aria-live="polite">
        {d ? (
          <>
            <p className="countdown-number">{number(d.days, 0)}</p>
            <p className="countdown-unit">{d.days === 0 ? 'Today' : d.past ? (d.days === 1 ? 'Day ago' : 'Days ago') : d.days === 1 ? 'Day to go' : 'Days to go'}</p>
            <p className="countdown-what">{d.days === 0 ? `${label} is today.` : `${d.past ? 'Since' : 'Until'} ${name.trim() ? `${name.trim()} · ` : ''}${formatDate(target!)}`}</p>
            {!d.past && d.days > 0 && (
              <p className="countdown-detail">
                {d.days >= 7 && <span>{plural(Math.floor(d.days / 7), 'week')}{d.days % 7 ? ` and ${plural(d.days % 7, 'day')}` : ''} · </span>}
                <span className="countdown-clock">{Math.max(0, Math.floor(msLeft / 86_400_000))}d {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}</span>
              </p>
            )}
            <div className="result-actions"><CopyButton text={copy ?? ''} /></div>
          </>
        ) : <p className="countdown-what">Pick a date to count down to.</p>}
      </section>
    </div>
  );
}
