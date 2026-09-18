'use client';

import { useState } from 'react';
import FileDrop from '@/components/FileDrop';
import { Notice } from '@/components/ui';
import { useToolActions } from '@/components/AppState';
import { number } from '@/utils/format';
import { repair, PdfProblem } from '@/utils/pdfOps';
import { PdfResult, pdfName, PDF_ACCEPT } from './shared';

export default function RepairPdf() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<{ blob: Blob; pages: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setFile(f);
    setResult(null);
    setError(null);
    setBusy(true);
    try {
      const fixed = await repair(new Uint8Array(await f.arrayBuffer()));
      setResult({ blob: new Blob([fixed.bytes as BlobPart], { type: 'application/pdf' }), pages: fixed.pages });
    } catch (e) {
      setError(e instanceof PdfProblem ? e.message : 'This file couldn’t be recovered. It may not be a PDF at all.');
    } finally {
      setBusy(false);
    }
  };
  useToolActions({});

  return (
    <div className="stack">
      <FileDrop accept={PDF_ACCEPT} onFiles={run} compact={!!result} title={result ? 'Repair another PDF' : 'Drop a PDF that won’t open'} />
      {busy && <p className="hint">Rebuilding…</p>}
      {error && <Notice tone="error">{error}</Notice>}
      {result && file && (
        <PdfResult
          label="Rebuilt"
          afterSize={result.blob.size}
          filename={pdfName(file.name, 'repaired')}
          make={() => result.blob}
          note={`${number(result.pages, 0)} ${result.pages === 1 ? 'page' : 'pages'} recovered. The file’s structure was rewritten from scratch.`}
        />
      )}
      <p className="hint">This rebuilds a PDF’s index, which is what usually breaks in a half-downloaded or interrupted file. Content that is genuinely missing can’t be brought back.</p>
    </div>
  );
}
