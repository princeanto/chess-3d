'use client';

import { Notice } from '@/components/ui';
import { useToolActions } from '@/components/AppState';
import { PdfDrop, PdfInfo, PdfResult, pdfName, usePdf } from './shared';

export default function UnlockPdf() {
  const { pdf, error, locked, busy, open, clear } = usePdf();
  useToolActions({});

  if (!pdf) {
    return (
      <div className="stack">
        <PdfDrop onFiles={open} locked={locked} error={error} busy={busy} onPassword={(p) => locked && open([locked], p)} title="Drop a password-protected PDF" />
        <p className="hint">You’ll need the password once. This removes it so the file opens freely afterwards — it can’t break into a PDF you can’t already open.</p>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="card stack">
        <PdfInfo pdf={pdf} onClear={clear} />
      </div>
      <PdfResult
        label="Unlocked"
        afterSize={pdf.bytes.length}
        filename={pdfName(pdf.name, 'unlocked')}
        make={() => new Blob([pdf.bytes as BlobPart], { type: 'application/pdf' })}
        note="No password needed to open this copy."
        onAgain={clear}
      />
      <Notice>The password was used on this device only, and isn’t stored anywhere.</Notice>
    </div>
  );
}
