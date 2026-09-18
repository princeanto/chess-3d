'use client';

import { useMemo, useState } from 'react';
import { Notice, NumberField, Segmented, TextField } from '@/components/ui';
import ExportButton from '@/components/ExportButton';
import { useToolActions } from '@/components/AppState';
import { number } from '@/utils/format';
import { chunks, formatRanges, parseRanges, splitPdf } from '@/utils/pdfOps';
import { zip } from '@/utils/zip';
import { PageThumb, PdfDrop, PdfInfo, pdfName, usePageThumbs, usePdf } from './shared';

type Mode = 'ranges' | 'each' | 'every';

export default function SplitPdf() {
  const { pdf, error, locked, busy, open, clear } = usePdf();
  const [mode, setMode] = useState<Mode>('ranges');
  const [ranges, setRanges] = useState('1-1');
  const [size, setSize] = useState('2');
  const { thumbs, request } = usePageThumbs(pdf?.bytes ?? null, pdf?.pages ?? 0, 130);

  const groups = useMemo(() => {
    if (!pdf) return null;
    if (mode === 'each') return chunks(pdf.pages, 1);
    if (mode === 'every') return chunks(pdf.pages, Math.max(1, Math.min(pdf.pages, Number(size) || 1)));
    return parseRanges(ranges, pdf.pages);
  }, [pdf, mode, ranges, size]);
  const problem = groups && 'error' in groups ? groups.error : null;
  const list = groups && !('error' in groups) ? groups : [];
  useToolActions({});

  const make = async () => {
    if (!pdf || !list.length) return null;
    const parts = await splitPdf(pdf.bytes, list);
    if (parts.length === 1) return new Blob([parts[0] as BlobPart], { type: 'application/pdf' });
    return new Blob([zip(parts.map((part, i) => ({ name: pdfName(pdf.name, `pages-${formatRanges(list[i]).replace(/, /g, '_')}`), data: part }))) as BlobPart], { type: 'application/zip' });
  };

  if (!pdf) return <PdfDrop onFiles={open} locked={locked} error={error} busy={busy} onPassword={(p) => locked && open([locked], p)} title="Drop a PDF to split" />;

  return (
    <div className="stack">
      <div className="card stack">
        <PdfInfo pdf={pdf} onClear={clear} />
        <Segmented label="Split" value={mode} onChange={setMode} options={[{ id: 'ranges', label: 'By page ranges' }, { id: 'each', label: 'One file per page' }, { id: 'every', label: 'Every N pages' }]} wrap />
        {mode === 'ranges' && <TextField label="Pages" value={ranges} onChange={setRanges} placeholder="1-3, 5, 8-10" hint="Each range becomes its own PDF. Also “odd”, “even”, “last”." autoComplete="off" />}
        {mode === 'every' && <NumberField label="Pages per file" value={size} onChange={setSize} inputMode="numeric" />}
        {problem && <Notice tone="error">{problem}</Notice>}
        {!problem && list.length > 0 && (
          <p className="hint">
            {list.length === 1 ? `One PDF with ${number(list[0].length, 0)} ${list[0].length === 1 ? 'page' : 'pages'}.` : `${list.length} PDFs, downloaded together as a ZIP.`}
          </p>
        )}
        <ExportButton size="lg" label={list.length > 1 ? `Split into ${list.length} files` : 'Split PDF'} disabled={!!problem || !list.length} filename={() => (list.length > 1 ? pdfName(pdf.name, 'split', 'zip') : pdfName(pdf.name, `pages-${formatRanges(list[0] ?? [])}`))} make={make} />
      </div>
      <section className="page-grid" aria-label="Pages">
        {Array.from({ length: pdf.pages }, (_, i) => {
          const part = list.findIndex((g) => g.includes(i));
          return (
            <PageThumb key={i} n={i + 1} url={thumbs[i + 1]} onVisible={request} className={part >= 0 ? 'is-in' : 'is-out'}>
              {part >= 0 && list.length > 1 && <span className="page-part">Part {part + 1}</span>}
            </PageThumb>
          );
        })}
      </section>
    </div>
  );
}
