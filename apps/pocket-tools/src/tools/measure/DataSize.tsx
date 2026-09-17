'use client';

import { useState } from 'react';
import { Columns, NumberField, Segmented, Select } from '@/components/ui';
import { ResultHero, ResultRows } from '@/components/ResultCard';
import { useToolActions, useToolParams } from '@/components/AppState';
import { parseAmount, significant } from '@/utils/format';

const DECIMAL = [['b', 'Bytes', 'B', 1], ['kb', 'Kilobytes', 'KB', 1e3], ['mb', 'Megabytes', 'MB', 1e6], ['gb', 'Gigabytes', 'GB', 1e9], ['tb', 'Terabytes', 'TB', 1e12]] as const;
const BINARY = [['b', 'Bytes', 'B', 1], ['kib', 'Kibibytes', 'KiB', 1024], ['mib', 'Mebibytes', 'MiB', 1024 ** 2], ['gib', 'Gibibytes', 'GiB', 1024 ** 3], ['tib', 'Tebibytes', 'TiB', 1024 ** 4]] as const;
const ALL = [...DECIMAL, ...BINARY.slice(1), ['bit', 'Bits', 'bit', 1 / 8]] as const;

export default function DataSize() {
  const [value, setValue] = useState('1.5');
  const [from, setFrom] = useState('gb');
  const [mode, setMode] = useState<'decimal' | 'binary'>('decimal');
  const [to, setTo] = useState('mb');

  useToolParams((p) => {
    if (p.get('value')) setValue(p.get('value')!);
    const f = p.get('from');
    const t = p.get('to');
    if (f && ALL.some((u) => u[0] === f)) setFrom(f);
    if (t) {
      setTo(t);
      if (BINARY.some((u) => u[0] === t) && t !== 'b') setMode('binary');
    }
  });

  const unitsFor = mode === 'decimal' ? DECIMAL : BINARY;
  const v = parseAmount(value);
  const factor = ALL.find((u) => u[0] === from)?.[3] ?? 1;
  const bytes = v !== null ? v * factor : null;
  const target = unitsFor.find((u) => u[0] === to) ?? unitsFor[2];
  const result = bytes !== null ? bytes / target[3] : null;
  const text = result !== null ? `${significant(result, 8)} ${target[2]}` : null;
  useToolActions({ copy: () => text });

  return (
    <Columns
      inputs={
        <>
          <div className="grid-2 grid-keep">
            <NumberField label="Size" value={value} onChange={setValue} autoFocus />
            <Select label="Unit" value={from} onChange={setFrom} options={ALL.map((u) => ({ id: u[0], label: u[2] }))} />
          </div>
          <Segmented label="Convert using" value={mode} onChange={(m) => { setMode(m); setTo(m === 'decimal' ? 'mb' : 'mib'); }} options={[{ id: 'decimal', label: 'Decimal (1 KB = 1000 B)' }, { id: 'binary', label: 'Binary (1 KiB = 1024 B)' }]} wrap />
          <Select label="To" value={target[0]} onChange={setTo} options={unitsFor.map((u) => ({ id: u[0], label: `${u[1]} (${u[2]})` }))} />
          <p className="hint">Phones, Macs and drive makers count in 1000s. Windows counts in 1024s but labels them KB, MB and GB — which is why a “1 TB” drive shows as 931 GB.</p>
        </>
      }
      result={
        result !== null ? (
          <>
            <ResultHero label={`${value.trim()} ${ALL.find((u) => u[0] === from)?.[2]} is`} value={<>{significant(result, 8)} <span className="unit">{target[2]}</span></>} copy={text ?? ''} />
            <ResultRows title={mode === 'decimal' ? 'Decimal units' : 'Binary units'} rows={unitsFor.map((u) => ({ label: u[1], value: `${significant(bytes! / u[3], 8)} ${u[2]}`, copy: significant(bytes! / u[3], 8) }))} />
          </>
        ) : <ResultHero tone="muted" label="Result" value="—" caption="Add a size to convert." />
      }
    />
  );
}
