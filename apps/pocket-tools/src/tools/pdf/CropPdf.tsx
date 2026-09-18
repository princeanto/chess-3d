'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, Notice, Slider } from '@/components/ui';
import ExportButton from '@/components/ExportButton';
import { useToolActions } from '@/components/AppState';
import { cropPages } from '@/utils/pdfOps';
import { openForView, renderPage } from '@/utils/pdfBrowser';
import { PdfDrop, PdfInfo, pdfName, usePdf } from './shared';

export default function CropPdf() {
  const { pdf, error, locked, busy, open, clear } = usePdf();
  const [m, setM] = useState({ top: 0, right: 0, bottom: 0, left: 0 });
  const [page, setPage] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  useToolActions({});

  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;
    let made = '';
    (async () => {
      const doc = await openForView(pdf.bytes);
      const p = await doc.getPage(page + 1);
      const base = p.getViewport({ scale: 1 });
      const r = await renderPage(p, Math.min(2, 760 / base.width));
      const blob = await new Promise<Blob | null>((res) => r.canvas.toBlob(res, 'image/jpeg', 0.85));
      p.cleanup();
      await doc.destroy();
      if (cancelled || !blob) return;
      made = URL.createObjectURL(blob);
      setUrl(made);
    })().catch(() => undefined);
    return () => { cancelled = true; if (made) URL.revokeObjectURL(made); };
  }, [pdf, page]);

  const set = (side: keyof typeof m) => (v: number) => setM((prev) => ({ ...prev, [side]: v }));
  const any = m.top + m.right + m.bottom + m.left > 0;
  const tooMuch = m.left + m.right >= 95 || m.top + m.bottom >= 95;

  if (!pdf) return <PdfDrop onFiles={open} locked={locked} error={error} busy={busy} onPassword={(p) => locked && open([locked], p)} title="Drop a PDF to crop" />;

  const size = pdf.sizes[page];
  const kept = size ? { w: Math.round(size.width * (1 - (m.left + m.right) / 100)), h: Math.round(size.height * (1 - (m.top + m.bottom) / 100)) } : null;

  return (
    <div className="image-tool">
      <div className="card stack image-controls">
        <PdfInfo pdf={pdf} onClear={clear} />
        <p className="hint">Trim the same margin from every page. Nothing is deleted — the trimmed area is simply no longer shown or printed.</p>
        <Slider label="Top" min={0} max={45} value={m.top} onChange={set('top')} format={(v) => `${v}%`} />
        <Slider label="Bottom" min={0} max={45} value={m.bottom} onChange={set('bottom')} format={(v) => `${v}%`} />
        <Slider label="Left" min={0} max={45} value={m.left} onChange={set('left')} format={(v) => `${v}%`} />
        <Slider label="Right" min={0} max={45} value={m.right} onChange={set('right')} format={(v) => `${v}%`} />
        {kept && <p className="hint">Each page becomes about {kept.w} × {kept.h} pt.</p>}
        {tooMuch && <Notice tone="error">That leaves nothing of the page.</Notice>}
        <div className="button-row">
          <ExportButton size="lg" label="Crop PDF" disabled={!any || tooMuch} filename={() => pdfName(pdf.name, 'cropped')} make={async () => new Blob([await cropPages(pdf.bytes, { top: m.top / 100, right: m.right / 100, bottom: m.bottom / 100, left: m.left / 100 }) as BlobPart], { type: 'application/pdf' })} />
          <Button size="lg" variant="ghost" onClick={() => setM({ top: 0, right: 0, bottom: 0, left: 0 })} disabled={!any}>Reset</Button>
        </div>
        {pdf.pages > 1 && (
          <div className="button-row">
            <Button size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>← Page {page}</Button>
            <Button size="sm" onClick={() => setPage((p) => Math.min(pdf.pages - 1, p + 1))} disabled={page === pdf.pages - 1}>Page {page + 2} →</Button>
          </div>
        )}
      </div>
      <section className="crop-pdf-stage">
        <div className="crop-pdf-page">
          {url ? <img src={url} alt={`Page ${page + 1}`} /> : <span className="page-thumb-wait" />}
          <span className="crop-shade" style={{ top: 0, left: 0, right: 0, height: `${m.top}%` }} />
          <span className="crop-shade" style={{ bottom: 0, left: 0, right: 0, height: `${m.bottom}%` }} />
          <span className="crop-shade" style={{ top: 0, bottom: 0, left: 0, width: `${m.left}%` }} />
          <span className="crop-shade" style={{ top: 0, bottom: 0, right: 0, width: `${m.right}%` }} />
        </div>
      </section>
    </div>
  );
}
