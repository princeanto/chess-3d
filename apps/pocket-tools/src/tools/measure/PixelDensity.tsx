'use client';

import { useState } from 'react';
import { Chips, Columns, NumberField } from '@/components/ui';
import { ResultHero, ResultRows } from '@/components/ResultCard';
import { useToolActions } from '@/components/AppState';
import { ppi } from '@/utils/design';
import { number, parseAmount } from '@/utils/format';

const DEVICES: Record<string, [number, number, number]> = {
  'Phone 6.1″': [1179, 2556, 6.1],
  'Laptop 13.6″': [2560, 1664, 13.6],
  'Monitor 24″ FHD': [1920, 1080, 24],
  'Monitor 27″ 4K': [3840, 2160, 27],
  'TV 55″ 4K': [3840, 2160, 55],
};

export default function PixelDensity() {
  const [w, setW] = useState('1920');
  const [h, setH] = useState('1080');
  const [d, setD] = useState('24');

  const r = ppi(parseAmount(w) ?? 0, parseAmount(h) ?? 0, parseAmount(d) ?? 0);
  useToolActions({ copy: () => (r ? `${number(r.ppi, 1, 'en-US')} PPI` : null) });

  return (
    <Columns
      inputs={
        <>
          <div className="grid-2 grid-keep">
            <NumberField label="Width" value={w} onChange={setW} suffix="px" inputMode="numeric" autoFocus />
            <NumberField label="Height" value={h} onChange={setH} suffix="px" inputMode="numeric" />
          </div>
          <NumberField label="Diagonal" value={d} onChange={setD} suffix="in" inputMode="decimal" />
          <Chips label="Examples" options={Object.keys(DEVICES)} value={null} onChange={(k) => { const [a, b, c] = DEVICES[k]; setW(String(a)); setH(String(b)); setD(String(c)); }} />
        </>
      }
      result={
        r ? (
          <>
            <ResultHero label="Pixel density" value={<>{number(r.ppi, 1, 'en-US')} <span className="unit">PPI</span></>} caption={r.ppi >= 300 ? 'Sharp enough that pixels disappear at phone distance.' : r.ppi >= 200 ? 'Crisp at laptop distance.' : 'Normal for a desktop monitor.'} copy={`${number(r.ppi, 1, 'en-US')} PPI`} />
            <ResultRows rows={[
              { label: 'Dot pitch', value: `${number(r.dotPitch, 4, 'en-US')} mm` },
              { label: 'Physical size', value: `${number(r.widthInches, 2, 'en-US')} × ${number(r.heightInches, 2, 'en-US')} in` },
              { label: 'In centimetres', value: `${number(r.widthInches * 2.54, 1, 'en-US')} × ${number(r.heightInches * 2.54, 1, 'en-US')} cm` },
              { label: 'Megapixels', value: `${number(r.megapixels, 2, 'en-US')} MP` },
            ]} />
          </>
        ) : <ResultHero tone="muted" label="Pixel density" value="—" caption="Add width, height and diagonal." />
      }
    />
  );
}
