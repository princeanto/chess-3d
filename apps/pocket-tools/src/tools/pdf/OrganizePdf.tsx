'use client';

import { useEffect, useState } from 'react';
import { Button, Notice } from '@/components/ui';
import ExportButton from '@/components/ExportButton';
import { useToolActions } from '@/components/AppState';
import { number } from '@/utils/format';
import { organize, type PagePlan } from '@/utils/pdfOps';
import { PageThumb, PdfDrop, PdfInfo, pdfName, usePageThumbs, usePdf } from './shared';

export default function OrganizePdf() {
  const { pdf, error, locked, busy, open, clear } = usePdf();
  const [plan, setPlan] = useState<PagePlan[]>([]);
  const [dragging, setDragging] = useState<number | null>(null);
  const { thumbs, request } = usePageThumbs(pdf?.bytes ?? null, pdf?.pages ?? 0, 150);

  useEffect(() => { setPlan(pdf ? Array.from({ length: pdf.pages }, (_, index) => ({ index, rotate: 0 })) : []); }, [pdf]);

  const move = (from: number, to: number) => setPlan((list) => {
    if (to < 0 || to >= list.length) return list;
    const next = list.slice();
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  });
  const turn = (at: number, by: number) => setPlan((list) => list.map((p, i) => (i === at ? { ...p, rotate: (((p.rotate + by) % 360) + 360) % 360 } : p)));
  const drop = (at: number) => setPlan((list) => list.filter((_, i) => i !== at));
  const changed = pdf && (plan.length !== pdf.pages || plan.some((p, i) => p.index !== i || p.rotate !== 0));
  useToolActions({});

  if (!pdf) return <PdfDrop onFiles={open} locked={locked} error={error} busy={busy} onPassword={(p) => locked && open([locked], p)} title="Drop a PDF to reorder" />;

  return (
    <div className="stack">
      <div className="card stack">
        <PdfInfo pdf={pdf} onClear={clear} extra={plan.length !== pdf.pages ? `${number(plan.length, 0)} kept` : undefined} />
        <p className="hint">Drag pages to reorder. Use the buttons on a page to rotate or delete it.</p>
        <div className="button-row">
          <ExportButton size="lg" label="Save PDF" disabled={!plan.length || !changed} filename={() => pdfName(pdf.name, 'organized')} make={async () => new Blob([await organize(pdf.bytes, plan) as BlobPart], { type: 'application/pdf' })} />
          <Button size="lg" variant="ghost" onClick={() => setPlan(Array.from({ length: pdf.pages }, (_, index) => ({ index, rotate: 0 })))} disabled={!changed}>Reset</Button>
        </div>
        {!plan.length && <Notice tone="error">Keep at least one page.</Notice>}
      </div>
      <section className="page-grid page-grid-lg" aria-label="Pages">
        {plan.map((p, i) => (
          <div
            key={`${p.index}-${i}`}
            draggable
            onDragStart={() => setDragging(i)}
            onDragOver={(e) => { e.preventDefault(); if (dragging !== null && dragging !== i) { move(dragging, i); setDragging(i); } }}
            onDragEnd={() => setDragging(null)}
            className={dragging === i ? 'is-dragging' : ''}
          >
            <PageThumb n={p.index + 1} url={thumbs[p.index + 1]} onVisible={request} style={{ ['--turn' as string]: `${p.rotate}deg` }} className="page-turnable">
              <span className="page-tools">
                <button type="button" onClick={() => turn(i, -90)} aria-label={`Rotate page ${p.index + 1} left`}>↺</button>
                <button type="button" onClick={() => turn(i, 90)} aria-label={`Rotate page ${p.index + 1} right`}>↻</button>
                <button type="button" onClick={() => drop(i)} aria-label={`Delete page ${p.index + 1}`}>✕</button>
              </span>
              {/* Only worth showing once a page has actually moved. */}
              {p.index !== i && <span className="page-order">now {i + 1}</span>}
            </PageThumb>
          </div>
        ))}
      </section>
    </div>
  );
}
