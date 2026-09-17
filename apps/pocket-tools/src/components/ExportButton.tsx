'use client';

import { useState } from 'react';
import { downloadBlob } from '@/utils/download';
import { useApp } from './AppState';

/**
 * Makes the file when pressed, then downloads it. The label changes while it
 * works, so a PDF of twenty photos never looks like a button that did nothing.
 */
export default function ExportButton({ make, filename, label = 'Download', variant = 'primary', size, disabled, className = '' }: {
  make: () => Promise<Blob | null> | Blob | null;
  filename: string | (() => string);
  label?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'lg' | 'sm';
  disabled?: boolean;
  className?: string;
}) {
  const { toast } = useApp();
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const blob = await make();
      if (!blob) throw new Error('empty');
      const name = typeof filename === 'function' ? filename() : filename;
      if (!downloadBlob(blob, name)) throw new Error('download');
      toast(`Downloaded ${name}`);
    } catch {
      toast('Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button type="button" className={`btn btn-${variant}${size ? ` btn-${size}` : ''} ${className}`} onClick={onClick} disabled={disabled || busy} aria-busy={busy}>
      <svg className="btn-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v8.5M4.5 7.5L8 11l3.5-3.5M3 13.5h10" /></svg>
      {busy ? 'Working…' : label}
    </button>
  );
}
