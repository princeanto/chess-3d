'use client';

/** Choosing pages by clicking them or by typing ranges — Extract and Remove share it. */

import { useMemo, useState } from 'react';
import { Button, Notice, TextField } from '@/components/ui';
import ExportButton from '@/components/ExportButton';
import { useToolActions } from '@/components/AppState';
import { number } from '@/utils/format';
import { extractPages, formatRanges, parseRanges, removePages } from '@/utils/pdfOps';
import { PageThumb, PdfDrop, PdfInfo, pdfName, usePageThumbs, usePdf } from './shared';

export default function PagePicker({ action }: { action: 'extract' | 'remove' }) {
  const { pdf, error, locked, busy, open, clear } = usePdf();
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const [text, setText] = useState('');
  const { thumbs, request } = usePageThumbs(pdf?.bytes ?? null, pdf?.pages ?? 0, 130);

  const typed = useMemo(() => (pdf && text.trim() ? parseRanges(text, pdf.pages) : null), [pdf, text]);
  const problem = typed && 'error' in typed ? typed.error : null;

  const setFromText = (value: string) => {
    setText(value);
    if (!pdf) return;
    const parsed = parseRanges(value, pdf.pages);
    if (!('error' in parsed)) setChosen(new Set(parsed.flat()));
    if (!value.trim()) setChosen(new Set());
  };
  const toggle = (i: number) => {
    const next = new Set(chosen);
    if (next.has(i)) next.delete(i); else next.add(i);
    setChosen(next);
    setText(formatRanges([...next]));
  };
  const all = () => { const next = new Set(Array.from({ length: pdf?.pages ?? 0 }, (_, i) => i)); setChosen(next); setText(formatRanges([...next])); };
  const none = () => { setChosen(new Set()); setText(''); };

  const count = chosen.size;
  const keeping = (pdf?.pages ?? 0) - count;
  const ready = !!pdf && count > 0 && (action === 'extract' || keeping > 0);
  useToolActions({});

  const make = async () => {
    if (!pdf) return null;
    const order = [...chosen].sort((a, b) => a - b);
    const out = action === 'extract' ? await extractPages(pdf.bytes, order) : await removePages(pdf.bytes, order);
    return new Blob([out as BlobPart], { type: 'application/pdf' });
  };

  if (!pdf) return <PdfDrop onFiles={open} locked={locked} error={error} busy={busy} onPassword={(p) => locked && open([locked], p)} title={action === 'extract' ? 'Drop a PDF to take pages from' : 'Drop a PDF to remove pages from'} />;

  return (
    <div className="stack">
      <div className="card stack">
        <PdfInfo pdf={pdf} onClear={clear} />
        <TextField label="Pages" value={text} onChange={setFromText} placeholder="1-3, 5" hint="Type page numbers, or click the pages below." autoComplete="off" />
        {problem && <Notice tone="error">{problem}</Notice>}
        <div className="button-row">
          <Button size="sm" variant="ghost" onClick={all}>Select all</Button>
          <Button size="sm" variant="ghost" onClick={none} disabled={!count}>Clear</Button>
        </div>
        <p className="hint">
          {action === 'extract'
            ? count ? `Keeping ${number(count, 0)} of ${number(pdf.pages, 0)} pages.` : 'Choose the pages to keep.'
            : count ? `Removing ${number(count, 0)}, leaving ${number(keeping, 0)}.` : 'Choose the pages to delete.'}
        </p>
        <ExportButton
          size="lg"
          label={action === 'extract' ? `Extract ${count || ''} ${count === 1 ? 'page' : 'pages'}`.replace('  ', ' ') : `Remove ${count || ''} ${count === 1 ? 'page' : 'pages'}`.replace('  ', ' ')}
          disabled={!ready}
          filename={() => pdfName(pdf.name, action === 'extract' ? `pages-${formatRanges([...chosen])}` : 'trimmed')}
          make={make}
        />
        {action === 'remove' && count > 0 && keeping === 0 && <Notice tone="error">That would remove every page.</Notice>}
      </div>
      <section className="page-grid" aria-label="Pages">
        {Array.from({ length: pdf.pages }, (_, i) => (
          <PageThumb key={i} n={i + 1} url={thumbs[i + 1]} onVisible={request} className={chosen.has(i) ? (action === 'extract' ? 'is-in' : 'is-cut') : ''}>
            <button type="button" className="page-pick" aria-pressed={chosen.has(i)} aria-label={`${action === 'extract' ? 'Keep' : 'Remove'} page ${i + 1}`} onClick={() => toggle(i)}>
              <span aria-hidden="true">{chosen.has(i) ? (action === 'extract' ? '✓' : '✕') : ''}</span>
            </button>
          </PageThumb>
        ))}
      </section>
    </div>
  );
}
