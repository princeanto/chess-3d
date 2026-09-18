'use client';

import { useState } from 'react';
import { Check, NumberField, Segmented, Slider } from '@/components/ui';
import ExportButton from '@/components/ExportButton';
import { useToolActions } from '@/components/AppState';
import { addPageNumbers, pageLabel, type Corner, type NumberFormat } from '@/utils/pdfOps';
import { PageThumb, PdfDrop, PdfInfo, pdfName, usePageThumbs, usePdf } from './shared';

const CORNERS: Corner[] = ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'];

export default function PageNumbers() {
  const { pdf, error, locked, busy, open, clear } = usePdf();
  const [corner, setCorner] = useState<Corner>('bottom-center');
  const [format, setFormat] = useState<NumberFormat>('n');
  const [start, setStart] = useState('1');
  const [size, setSize] = useState(11);
  const [margin, setMargin] = useState(28);
  const [skipFirst, setSkipFirst] = useState(false);
  const { thumbs, request } = usePageThumbs(pdf?.bytes ?? null, pdf?.pages ?? 0, 150);
  useToolActions({});

  if (!pdf) return <PdfDrop onFiles={open} locked={locked} error={error} busy={busy} onPassword={(p) => locked && open([locked], p)} title="Drop a PDF to number" />;

  const first = Number(start) || 1;
  const total = first + (skipFirst ? pdf.pages - 1 : pdf.pages) - 1;
  const [vertical, horizontal] = corner.split('-');

  return (
    <div className="image-tool">
      <div className="card stack image-controls">
        <PdfInfo pdf={pdf} onClear={clear} />
        <div className="field">
          <span className="label">Position</span>
          <div className="corner-grid" role="radiogroup" aria-label="Position">
            {CORNERS.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={corner === c} aria-label={c.replace('-', ' ')} className="corner" onClick={() => setCorner(c)}>
                <span />
              </button>
            ))}
          </div>
        </div>
        <Segmented<NumberFormat> label="Style" value={format} onChange={setFormat} wrap options={[
          { id: 'n', label: '1' }, { id: 'page-n', label: 'Page 1' }, { id: 'n-of-total', label: '1 of n' }, { id: 'page-n-of-total', label: 'Page 1 of n' },
        ]} />
        <div className="grid-2 grid-keep">
          <NumberField label="Start at" value={start} onChange={setStart} inputMode="numeric" />
          <Slider label="Size" min={7} max={24} value={size} onChange={setSize} format={(v) => `${v} pt`} />
        </div>
        <Slider label="Distance from the edge" min={10} max={72} value={margin} onChange={setMargin} format={(v) => `${v} pt`} />
        <Check label="Skip the first page" hint="For covers" checked={skipFirst} onChange={setSkipFirst} />
        <ExportButton size="lg" label="Add page numbers" filename={() => pdfName(pdf.name, 'numbered')} make={async () => new Blob([await addPageNumbers(pdf.bytes, { corner, format, start: first, size, margin, skipFirst }) as BlobPart], { type: 'application/pdf' })} />
      </div>
      <section className="page-grid" aria-label="Preview">
        {Array.from({ length: Math.min(pdf.pages, 8) }, (_, i) => (
          <PageThumb key={i} n={i + 1} url={thumbs[i + 1]} onVisible={request}>
            {!(skipFirst && i === 0) && (
              <span
                className="number-preview"
                style={{
                  [vertical === 'top' ? 'top' : 'bottom']: `${(margin / 792) * 100}%`,
                  ...(horizontal === 'left' ? { left: `${(margin / 612) * 100}%` } : horizontal === 'right' ? { right: `${(margin / 612) * 100}%` } : { left: '50%', transform: 'translateX(-50%)' }),
                  fontSize: `${Math.max(6, size * 0.55)}px`,
                }}
              >
                {pageLabel(format, first + (skipFirst ? i - 1 : i), total)}
              </span>
            )}
          </PageThumb>
        ))}
      </section>
    </div>
  );
}
