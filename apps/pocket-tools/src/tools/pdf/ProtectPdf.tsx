'use client';

import { useState } from 'react';
import { Check, Notice, TextField } from '@/components/ui';
import ExportButton from '@/components/ExportButton';
import { useToolActions } from '@/components/AppState';
import { strength } from '@/utils/random';
import { protect } from '@/utils/pdfOps';
import { PdfDrop, PdfInfo, pdfName, usePdf } from './shared';

export default function ProtectPdf() {
  const { pdf, error, locked, busy, open, clear } = usePdf();
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [printing, setPrinting] = useState(true);
  useToolActions({});

  const match = password.length > 0 && password === again;
  const s = strength({ length: password.length, upper: /[A-Z]/.test(password), lower: /[a-z]/.test(password), numbers: /\d/.test(password), symbols: /[^A-Za-z0-9]/.test(password) });

  if (!pdf) return <PdfDrop onFiles={open} locked={locked} error={error} busy={busy} onPassword={(p) => locked && open([locked], p)} title="Drop a PDF to lock" />;

  return (
    <div className="stack">
      <div className="card stack">
        <PdfInfo pdf={pdf} onClear={clear} />
        <div className="grid-2">
          <TextField label="Password" type="password" value={password} onChange={setPassword} autoComplete="new-password" />
          <TextField label="Password again" type="password" value={again} onChange={setAgain} autoComplete="new-password" />
        </div>
        {password && (
          <div className="strength" data-level={s.label}>
            <span className="strength-bar"><i style={{ width: `${Math.min(100, (s.bits / 128) * 100)}%` }} /></span>
            <span className="strength-label">{s.label}</span>
          </div>
        )}
        {password && again && !match && <Notice tone="error">The two passwords don’t match.</Notice>}
        <Check label="Still allow printing" checked={printing} onChange={setPrinting} />
        <ExportButton size="lg" label="Lock PDF" disabled={!match} filename={() => pdfName(pdf.name, 'protected')} make={async () => new Blob([await protect(pdf.bytes, password, printing) as BlobPart], { type: 'application/pdf' })} />
        <Notice>Locked with AES-256 on this device. Nobody can recover this password for you — not even us, because we never see it. Keep it somewhere safe.</Notice>
      </div>
    </div>
  );
}
