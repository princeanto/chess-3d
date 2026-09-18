'use client';

import { useState } from 'react';
import { Button, Check, Notice, Segmented } from '@/components/ui';
import { useApp, useToolActions } from '@/components/AppState';
import { bytes as formatBytes } from '@/utils/format';
import { tidy } from '@/utils/pdfOps';
import { compressImages, flattenPages, type CompressLevel } from '@/utils/pdfBrowser';
import { PdfDrop, PdfInfo, PdfResult, Progress, pdfName, usePdf } from './shared';

export default function CompressPdf() {
  const { toast } = useApp();
  const { pdf, error, locked, busy, open, clear } = usePdf();
  const [level, setLevel] = useState<CompressLevel>('recommended');
  const [flatten, setFlatten] = useState(false);
  const [result, setResult] = useState<{ blob: Blob; kept: boolean; changed: number } | null>(null);
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');

  const run = async () => {
    if (!pdf || working) return;
    setWorking(true);
    setResult(null);
    setProgress(0);
    try {
      let out: Uint8Array;
      let changed = 0;
      if (flatten) {
        setStage('Rendering pages…');
        out = await flattenPages(pdf.bytes, level, (done, total) => { setProgress(total ? done / total : 0); setStage(`Page ${Math.min(done + 1, total)} of ${total}`); });
        changed = pdf.pages;
      } else {
        setStage('Looking at the pictures inside…');
        const r = await compressImages(pdf.bytes, level, (done, total) => { setProgress(total ? done / total : 0); setStage(total ? `Image ${Math.min(done + 1, total)} of ${total}` : 'Tidying up…'); });
        out = r.bytes;
        changed = r.changed;
        if (r.changed === 0) {
          const tidied = await tidy(pdf.bytes);
          if (tidied.length < out.length) out = tidied;
        }
      }
      const kept = out.length >= pdf.size;
      setResult({ blob: new Blob([(kept ? pdf.bytes : out) as BlobPart], { type: 'application/pdf' }), kept, changed });
    } catch {
      toast('Something went wrong. Try again.');
    } finally {
      setWorking(false);
      setStage('');
    }
  };
  useToolActions({ run });

  if (!pdf) return <PdfDrop onFiles={open} locked={locked} error={error} busy={busy} onPassword={(p) => locked && open([locked], p)} title="Drop a PDF to make it smaller" />;

  return (
    <div className="stack">
      <div className="card stack">
        <PdfInfo pdf={pdf} onClear={clear} />
        <Segmented label="How much" value={level} onChange={(l) => { setLevel(l); setResult(null); }} options={[
          { id: 'light', label: 'Less — best quality' },
          { id: 'recommended', label: 'Recommended' },
          { id: 'extreme', label: 'Most — smallest file' },
        ]} wrap />
        <Check
          label="Flatten pages into pictures"
          hint="For scans. Much smaller, but the text stops being selectable."
          checked={flatten}
          onChange={(v) => { setFlatten(v); setResult(null); }}
        />
        <p className="hint">{flatten
          ? 'Every page is redrawn as one picture at the chosen quality.'
          : 'Photos inside the PDF are shrunk and re-saved. Text, lines and layout are untouched.'}</p>
        <Button variant="primary" size="lg" onClick={run} disabled={working}>{working ? 'Compressing…' : 'Compress PDF'}</Button>
        {working && <Progress value={progress} label={stage} />}
      </div>

      {result && (
        <PdfResult
          label={result.kept ? 'Already as small as it gets' : 'Compressed'}
          beforeSize={pdf.size}
          afterSize={result.blob.size}
          filename={pdfName(pdf.name, 'compressed')}
          make={() => result.blob}
          onAgain={clear}
          note={result.kept
            ? 'Nothing here could be squeezed further without spoiling it, so this is your original file, unchanged.'
            : flatten ? `${pdf.pages} ${pdf.pages === 1 ? 'page' : 'pages'} redrawn as pictures.` : result.changed ? `${result.changed} ${result.changed === 1 ? 'picture' : 'pictures'} re-saved. Text is still text.` : 'Structure tidied; there were no pictures to shrink.'}
        />
      )}
      {result && !result.kept && !flatten && result.blob.size > pdf.size * 0.9 && (
        <Notice>Not much came off. If this is a scan, try “Flatten pages into pictures”.</Notice>
      )}
      {result && <p className="hint">Saved {formatBytes(Math.max(0, pdf.size - result.blob.size))}.</p>}
    </div>
  );
}
