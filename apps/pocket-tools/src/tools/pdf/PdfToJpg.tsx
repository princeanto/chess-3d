'use client';

import { useMemo, useState } from 'react';
import { Button, Notice, Segmented, TextField } from '@/components/ui';
import ExportButton from '@/components/ExportButton';
import { useApp, useToolActions } from '@/components/AppState';
import { bytes as formatBytes, number } from '@/utils/format';
import { downloadBlob } from '@/utils/download';
import { parseRanges } from '@/utils/pdfOps';
import { pagesToImages } from '@/utils/pdfBrowser';
import { zip } from '@/utils/zip';
import { PdfDrop, PdfInfo, Progress, pdfName, usePdf } from './shared';

const DPI = [{ id: '72', label: 'Screen · 72 dpi' }, { id: '150', label: 'Good · 150 dpi' }, { id: '300', label: 'Print · 300 dpi' }] as const;

export default function PdfToJpg() {
  const { toast } = useApp();
  const { pdf, error, locked, busy, open, clear } = usePdf();
  const [type, setType] = useState<'image/jpeg' | 'image/png'>('image/jpeg');
  const [dpi, setDpi] = useState<'72' | '150' | '300'>('150');
  const [pagesText, setPagesText] = useState('');
  const [images, setImages] = useState<{ page: number; blob: Blob; url: string }[]>([]);
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState(0);

  const chosen = useMemo(() => {
    if (!pdf) return [];
    if (!pagesText.trim()) return Array.from({ length: pdf.pages }, (_, i) => i + 1);
    const parsed = parseRanges(pagesText, pdf.pages);
    return 'error' in parsed ? [] : parsed.flat().map((i) => i + 1);
  }, [pdf, pagesText]);
  const problem = pdf && pagesText.trim() ? (parseRanges(pagesText, pdf.pages) as { error?: string }).error : undefined;

  const run = async () => {
    if (!pdf || working || !chosen.length) return;
    setWorking(true);
    images.forEach((i) => URL.revokeObjectURL(i.url));
    setImages([]);
    setProgress(0);
    try {
      const out = await pagesToImages(pdf.bytes, chosen, { type, dpi: Number(dpi), quality: 0.92 }, (done, total) => setProgress(total ? done / total : 0));
      setImages(out.map((o) => ({ page: o.page, blob: o.blob, url: URL.createObjectURL(o.blob) })));
    } catch {
      toast('Something went wrong. Try again.');
    } finally {
      setWorking(false);
    }
  };
  useToolActions({ run });

  const ext = type === 'image/png' ? 'png' : 'jpg';
  const total = images.reduce((n, i) => n + i.blob.size, 0);

  if (!pdf) return <PdfDrop onFiles={open} locked={locked} error={error} busy={busy} onPassword={(p) => locked && open([locked], p)} title="Drop a PDF to turn into images" />;

  return (
    <div className="stack">
      <div className="card stack">
        <PdfInfo pdf={pdf} onClear={clear} />
        <div className="options-row">
          <Segmented label="Format" value={type} onChange={(t) => { setType(t); setImages([]); }} options={[{ id: 'image/jpeg', label: 'JPG' }, { id: 'image/png', label: 'PNG' }]} />
          <Segmented label="Resolution" value={dpi} onChange={(d) => { setDpi(d); setImages([]); }} options={DPI.map((d) => ({ id: d.id, label: d.label }))} wrap />
        </div>
        <TextField label="Pages" value={pagesText} onChange={setPagesText} placeholder={`All ${pdf.pages} pages`} hint="Leave empty for every page, or type 1-3, 5." autoComplete="off" />
        {problem && <Notice tone="error">{problem}</Notice>}
        <Button variant="primary" size="lg" onClick={run} disabled={working || !chosen.length}>{working ? 'Rendering…' : `Convert ${chosen.length} ${chosen.length === 1 ? 'page' : 'pages'}`}</Button>
        {working && <Progress value={progress} label={`Page ${Math.min(Math.round(progress * chosen.length) + 1, chosen.length)} of ${chosen.length}`} />}
      </div>

      {images.length > 0 && (
        <>
          <div className="button-row">
            <ExportButton
              size="lg"
              label={images.length > 1 ? `Download all (${formatBytes(total)})` : 'Download image'}
              filename={() => (images.length > 1 ? pdfName(pdf.name, 'pages', 'zip') : pdfName(pdf.name, `page-${images[0].page}`, ext))}
              make={async () => (images.length === 1
                ? images[0].blob
                : new Blob([zip(await Promise.all(images.map(async (i) => ({ name: pdfName(pdf.name, `page-${i.page}`, ext), data: new Uint8Array(await i.blob.arrayBuffer()) })))) as BlobPart], { type: 'application/zip' }))}
            />
            <Button size="lg" variant="ghost" onClick={() => images.forEach((i, k) => window.setTimeout(() => downloadBlob(i.blob, pdfName(pdf.name, `page-${i.page}`, ext)), k * 200))}>Download one by one</Button>
          </div>
          <section className="page-grid" aria-label="Converted pages">
            {images.map((i) => (
              <figure key={i.page} className="page-thumb">
                <img src={i.url} alt={`Page ${i.page}`} />
                <figcaption className="page-thumb-n">{i.page} · {formatBytes(i.blob.size)}</figcaption>
              </figure>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
