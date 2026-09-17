'use client';

import { useState } from 'react';
import { Chips, Columns, NumberField } from '@/components/ui';
import { ResultHero, ResultRows } from '@/components/ResultCard';
import { useToolActions, useToolParams } from '@/components/AppState';
import { aspectRatio, heightFor, widthFor } from '@/utils/design';
import { number, parseAmount } from '@/utils/format';

export default function AspectRatio() {
  const [w, setW] = useState('1920');
  const [h, setH] = useState('1080');
  const [newW, setNewW] = useState('1280');
  const [newH, setNewH] = useState('');
  const [last, setLast] = useState<'w' | 'h'>('w');

  useToolParams((p) => { if (p.get('w')) setW(p.get('w')!); if (p.get('h')) setH(p.get('h')!); });

  const wv = parseAmount(w);
  const hv = parseAmount(h);
  const r = wv && hv ? aspectRatio(wv, hv) : null;
  const text = r ? `${r.w}:${r.h}` : null;
  useToolActions({ copy: () => text });

  const scaledH = r && last === 'w' && parseAmount(newW) ? heightFor(parseAmount(newW)!, wv!, hv!) : null;
  const scaledW = r && last === 'h' && parseAmount(newH) ? widthFor(parseAmount(newH)!, wv!, hv!) : null;
  const previewW = r ? Math.min(1, r.decimal) * 100 : 0;
  const previewH = r ? Math.min(1, 1 / r.decimal) * 100 : 0;

  return (
    <Columns
      inputs={
        <>
          <div className="grid-2 grid-keep">
            <NumberField label="Width" value={w} onChange={setW} suffix="px" inputMode="numeric" autoFocus />
            <NumberField label="Height" value={h} onChange={setH} suffix="px" inputMode="numeric" />
          </div>
          <Chips label="Common sizes" options={['1920×1080', '1080×1080', '1080×1350', '1080×1920', '1280×720', '2560×1440', '3840×2160']} value={`${w}×${h}`} onChange={(v) => { const [a, b] = v.split('×'); setW(a); setH(b); }} />
          <hr className="divider" />
          <p className="label">Resize, keeping the ratio</p>
          <div className="grid-2 grid-keep">
            <NumberField label="New width" value={last === 'w' ? newW : scaledW !== null ? number(scaledW, 2, 'en-US') : newW} onChange={(v) => { setNewW(v); setLast('w'); }} suffix="px" inputMode="decimal" />
            <NumberField label="New height" value={last === 'h' ? newH : scaledH !== null ? number(scaledH, 2, 'en-US') : newH} onChange={(v) => { setNewH(v); setLast('h'); }} suffix="px" inputMode="decimal" />
          </div>
        </>
      }
      result={
        r ? (
          <>
            <ResultHero label="Aspect ratio" value={text} caption={r.nearest ? `Close to ${r.nearest}` : `${number(r.decimal, 4, 'en-US')} : 1`} copy={text ?? ''}>
              <span className="ratio-preview" aria-hidden="true"><i style={{ width: `${previewW}%`, height: `${previewH}%` }} /></span>
            </ResultHero>
            <ResultRows rows={[
              { label: 'As a decimal', value: number(r.decimal, 4, 'en-US'), copy: number(r.decimal, 4, 'en-US') },
              ...(scaledH !== null ? [{ label: `At ${newW} px wide`, value: `${number(scaledH, 2, 'en-US')} px tall`, strong: true, copy: number(scaledH, 2, 'en-US') }] : []),
              ...(scaledW !== null ? [{ label: `At ${newH} px tall`, value: `${number(scaledW, 2, 'en-US')} px wide`, strong: true, copy: number(scaledW, 2, 'en-US') }] : []),
            ]} />
          </>
        ) : <ResultHero tone="muted" label="Aspect ratio" value="—" caption="Add a width and height." />
      }
    />
  );
}
