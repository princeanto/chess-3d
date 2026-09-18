'use client';

import { useEffect, useState } from 'react';
import { Button, Segmented } from '@/components/ui';
import ExportButton from '@/components/ExportButton';
import { useToolActions } from '@/components/AppState';
import { organize } from '@/utils/pdfOps';
import { PageThumb, PdfDrop, PdfInfo, pdfName, usePageThumbs, usePdf } from './shared';

export default function RotatePdf() {
  const { pdf, error, locked, busy, open, clear } = usePdf();
  const [turns, setTurns] = useState<number[]>([]);
  const [scope, setScope] = useState<'all' | 'each'>('all');
  const { thumbs, request } = usePageThumbs(pdf?.bytes ?? null, pdf?.pages ?? 0, 150);

  useEffect(() => { setTurns(pdf ? Array(pdf.pages).fill(0) : []); }, [pdf]);

  const rotateAll = (by: number) => setTurns((list) => list.map((t) => (((t + by) % 360) + 360) % 360));
  const rotateOne = (i: number, by: number) => setTurns((list) => list.map((t, k) => (k === i ? (((t + by) % 360) + 360) % 360 : t)));
  const changed = turns.some((t) => t !== 0);
  useToolActions({ run: () => rotateAll(90) });

  if (!pdf) return <PdfDrop onFiles={open} locked={locked} error={error} busy={busy} onPassword={(p) => locked && open([locked], p)} title="Drop a PDF to rotate" />;

  return (
    <div className="stack">
      <div className="card stack">
        <PdfInfo pdf={pdf} onClear={clear} />
        <Segmented label="Rotate" value={scope} onChange={setScope} options={[{ id: 'all', label: 'Every page' }, { id: 'each', label: 'Page by page' }]} />
        {scope === 'all' && (
          <div className="button-row">
            <Button onClick={() => rotateAll(-90)}>↺ Left</Button>
            <Button onClick={() => rotateAll(90)}>↻ Right</Button>
            <Button onClick={() => rotateAll(180)}>↓ Upside down</Button>
          </div>
        )}
        <div className="button-row">
          <ExportButton size="lg" label="Save PDF" disabled={!changed} filename={() => pdfName(pdf.name, 'rotated')} make={async () => new Blob([await organize(pdf.bytes, turns.map((rotate, index) => ({ index, rotate }))) as BlobPart], { type: 'application/pdf' })} />
          <Button size="lg" variant="ghost" onClick={() => setTurns(Array(pdf.pages).fill(0))} disabled={!changed}>Reset</Button>
        </div>
      </div>
      <section className="page-grid page-grid-lg" aria-label="Pages">
        {turns.map((t, i) => (
          <PageThumb key={i} n={i + 1} url={thumbs[i + 1]} onVisible={request} style={{ ['--turn' as string]: `${t}deg` }} className="page-turnable">
            {scope === 'each' && (
              <span className="page-tools">
                <button type="button" onClick={() => rotateOne(i, -90)} aria-label={`Rotate page ${i + 1} left`}>↺</button>
                <button type="button" onClick={() => rotateOne(i, 90)} aria-label={`Rotate page ${i + 1} right`}>↻</button>
              </span>
            )}
          </PageThumb>
        ))}
      </section>
    </div>
  );
}
