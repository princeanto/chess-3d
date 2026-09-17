'use client';

import { useMemo, useState } from 'react';
import { Button, Columns, Field, Segmented, Select } from '@/components/ui';
import { ResultHero, ResultRows } from '@/components/ResultCard';
import { useToolActions, useToolParams } from '@/components/AppState';
import { CATEGORIES, categoryOf, convert, feetInches, parseQuantity, type UnitCategory } from '@/utils/units';
import { parseAmount, significant } from '@/utils/format';

export default function UnitConverter() {
  const [category, setCategory] = useState<UnitCategory>('length');
  const [input, setInput] = useState('5 ft 10 in');
  const [from, setFrom] = useState('ft');
  const [to, setTo] = useState('cm');
  const cat = categoryOf(category);

  useToolParams((p) => {
    const c = p.get('category') as UnitCategory | null;
    if (c && CATEGORIES.some((x) => x.id === c)) setCategory(c);
    const q = p.get('q');
    if (q) {
      const match = /^(.*?)\s+(?:to|in|into|as|=)\s+[a-z°²³/ ]+$/i.exec(q);
      const quantity = parseQuantity(match?.[1] ?? q) ?? parseQuantity(q);
      if (quantity) { setInput(match?.[1] ?? q); setFrom(quantity.unit.id); }
    }
    if (p.get('to')) setTo(p.get('to')!);
  });

  const chooseCategory = (c: UnitCategory) => {
    setCategory(c);
    const next = categoryOf(c);
    setFrom(next.defaults[0]);
    setTo(next.defaults[1]);
    setInput('1');
  };

  // "5 ft 10 in" carries its own units; a plain number uses the From list.
  const reading = useMemo(() => {
    const q = parseQuantity(input);
    if (q && q.category === category) return { value: q.value, unit: q.unit.id, typed: true };
    const n = parseAmount(input);
    return n === null ? null : { value: n, unit: from, typed: false };
  }, [input, category, from]);

  const result = reading ? convert(reading.value, category, reading.unit, to) : null;
  const toUnit = cat.units.find((u) => u.id === to)!;
  const fromUnit = cat.units.find((u) => u.id === (reading?.unit ?? from))!;
  const text = result !== null ? `${significant(result)} ${toUnit.symbol}` : null;
  useToolActions({ copy: () => text });

  const swap = () => {
    setFrom(to);
    setTo(reading?.unit ?? from);
    if (result !== null) setInput(significant(result));
  };

  return (
    <div className="stack">
      <Segmented label="Measure" hideLabel value={category} onChange={chooseCategory} options={CATEGORIES.map((c) => ({ id: c.id, label: c.label }))} wrap />
      <Columns
        inputs={
          <>
            <Field label="Value" htmlFor="uc-value" hint={category === 'length' ? 'Try 5 ft 10 in, or 5\'10"' : 'A number, or a number with its unit'}>
              <input id="uc-value" className="input input-lg" value={input} onChange={(e) => setInput(e.target.value)} inputMode="text" autoComplete="off" spellCheck={false} autoFocus />
            </Field>
            <div className="convert-units">
              <Select label="From" value={reading?.typed ? reading.unit : from} onChange={(v) => { setFrom(v); if (reading?.typed) setInput(significant(reading.value)); }} options={cat.units.map((u) => ({ id: u.id, label: `${u.label} (${u.symbol})` }))} />
              <Button variant="ghost" className="swap" onClick={swap} aria-label="Swap units">⇅</Button>
              <Select label="To" value={to} onChange={setTo} options={cat.units.map((u) => ({ id: u.id, label: `${u.label} (${u.symbol})` }))} />
            </div>
          </>
        }
        result={
          result !== null && reading ? (
            <>
              <ResultHero
                label={`${significant(reading.value)} ${fromUnit.symbol} is`}
                value={<>{significant(result)} <span className="unit">{toUnit.symbol}</span></>}
                caption={category === 'length' && to !== 'ft' && to !== 'in' ? `= ${feetInches(convert(reading.value, category, reading.unit, 'm')!)}` : undefined}
                copy={text ?? ''}
              />
              <ResultRows title="In other units" rows={cat.units.filter((u) => u.id !== to && u.id !== reading.unit).map((u) => {
                const v = convert(reading.value, category, reading.unit, u.id)!;
                return { label: u.label, value: `${significant(v)} ${u.symbol}`, copy: significant(v) };
              })} />
            </>
          ) : <ResultHero tone="muted" label="Result" value="—" caption="Type a value to convert." />
        }
      />
    </div>
  );
}
