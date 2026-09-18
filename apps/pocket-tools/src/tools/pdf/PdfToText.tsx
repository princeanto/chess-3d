'use client';

import { useState } from 'react';
import { Button, Check, Notice } from '@/components/ui';
import { TextResult } from '@/components/ResultCard';
import ExportButton from '@/components/ExportButton';
import { useApp, useToolActions } from '@/components/AppState';
import { number } from '@/utils/format';
import { extractText } from '@/utils/pdfBrowser';
import { PdfDrop, PdfInfo, pdfName, usePdf } from './shared';

export default function PdfToText() {
  const { toast } = useApp();
  const { pdf, error, locked, busy, open, clear } = usePdf();
  const [pages, setPages] = useState<string[] | null>(null);
  const [marks, setMarks] = useState(true);
  const [working, setWorking] = useState(false);

  const run = async () => {
    if (!pdf || working) return;
    setWorking(true);
    try {
      setPages((await extractText(pdf.bytes)).pages);
    } catch {
      toast('Something went wrong. Try again.');
    } finally {
      setWorking(false);
    }
  };
  useToolActions({ run, copy: () => text || null });

  const text = pages ? pages.map((p, i) => (marks && pages.length > 1 ? `— Page ${i + 1} —\n${p}` : p)).filter((p) => p.trim()).join('\n\n') : '';
  const empty = pages && !pages.some((p) => p.trim());

  if (!pdf) return <PdfDrop onFiles={open} locked={locked} error={error} busy={busy} onPassword={(p) => locked && open([locked], p)} title="Drop a PDF to pull the text out" />;

  return (
    <div className="stack">
      <div className="card stack">
        <PdfInfo pdf={pdf} onClear={clear} />
        <div className="options-row">
          <Button variant="primary" size="lg" onClick={run} disabled={working}>{working ? 'Reading…' : pages ? 'Read again' : 'Get the text'}</Button>
          <Check label="Mark page breaks" checked={marks} onChange={setMarks} />
        </div>
        {empty && <Notice>There’s no text in this PDF — it’s probably a scan. Reading text from pictures needs OCR, which isn’t here.</Notice>}
      </div>
      {pages && !empty && (
        <TextResult
          label="Text"
          text={text}
          note={`${number(pages.length, 0)} ${pages.length === 1 ? 'page' : 'pages'} · ${number(text.split(/\s+/).filter(Boolean).length, 0)} words`}
          actions={<ExportButton variant="secondary" label="Download TXT" filename={pdfName(pdf.name, 'text', 'txt')} make={() => new Blob([text], { type: 'text/plain;charset=utf-8' })} />}
        />
      )}
    </div>
  );
}
