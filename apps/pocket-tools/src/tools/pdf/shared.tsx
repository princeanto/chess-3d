'use client';

/**
 * What every PDF tool needs: open a file (asking for the password when there is
 * one), see the pages, and hand back a result.
 *
 * A PDF is opened once and kept as decrypted bytes, so every tool downstream
 * works on a plain document and nothing has to think about encryption again.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import FileDrop from '@/components/FileDrop';
import ExportButton from '@/components/ExportButton';
import { Button, Notice, TextField } from '@/components/ui';
import { bytes as formatBytes, number } from '@/utils/format';
import { normalized, openPdf, PdfProblem } from '@/utils/pdfOps';
import { openForView, renderThumb } from '@/utils/pdfBrowser';

export const PDF_ACCEPT = 'application/pdf,.pdf';

export interface LoadedPdf {
  name: string;
  size: number;
  pages: number;
  /** Decrypted, plain PDF bytes. */
  bytes: Uint8Array;
  /** Page sizes in points, as the viewer sees them (rotation applied). */
  sizes: { width: number; height: number }[];
}

async function read(file: File, password?: string): Promise<LoadedPdf> {
  const raw = new Uint8Array(await file.arrayBuffer());
  const doc = await openPdf(raw, password);
  const plain = await normalized(doc);
  const view = await openForView(plain);
  const sizes: { width: number; height: number }[] = [];
  for (let n = 1; n <= view.numPages; n += 1) {
    const page = await view.getPage(n);
    const v = page.getViewport({ scale: 1 });
    sizes.push({ width: v.width, height: v.height });
    page.cleanup();
  }
  await view.destroy();
  return { name: file.name, size: file.size, pages: doc.getPageCount(), bytes: plain, sizes };
}

/** One PDF, with the password question handled. */
export function usePdf() {
  const [pdf, setPdf] = useState<LoadedPdf | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const open = useCallback(async (files: File[], password?: string) => {
    const file = files[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      setPdf(await read(file, password));
      setLocked(null);
    } catch (e) {
      const problem = e instanceof PdfProblem ? e : null;
      if (problem?.kind === 'encrypted') { setLocked(file); setError(null); }
      else { setError(problem?.message ?? 'Something went wrong. Try again.'); if (problem?.kind !== 'password') setLocked(null); }
      if (problem?.kind === 'password') { setLocked(file); setError(problem.message); }
    } finally {
      setBusy(false);
    }
  }, []);

  const clear = useCallback(() => { setPdf(null); setError(null); setLocked(null); }, []);
  return { pdf, error, locked, busy, open, clear };
}

export function PdfDrop({ onFiles, multiple = false, title, locked, error, onPassword, busy, children }: {
  onFiles: (files: File[]) => void;
  multiple?: boolean;
  title?: string;
  locked?: File | null;
  error?: string | null;
  onPassword?: (password: string) => void;
  busy?: boolean;
  children?: ReactNode;
}) {
  const [password, setPassword] = useState('');
  if (locked && onPassword) {
    return (
      <div className="card stack locked-card">
        <div>
          <p className="locked-title">🔒 {locked.name} is password-protected</p>
          <p className="setting-text">Enter the password to open it here. It is used on this device only.</p>
        </div>
        <form className="locked-form" onSubmit={(e) => { e.preventDefault(); onPassword(password); }}>
          <TextField label="Password" type="password" value={password} onChange={setPassword} autoFocus autoComplete="off" />
          <Button variant="primary" type="submit" disabled={busy || !password}>{busy ? 'Opening…' : 'Open PDF'}</Button>
        </form>
        {error && <Notice tone="error">{error}</Notice>}
      </div>
    );
  }
  return (
    <>
      <FileDrop accept={PDF_ACCEPT} multiple={multiple} onFiles={onFiles} title={title ?? (multiple ? 'Drop PDFs here' : 'Drop a PDF here')}>{children}</FileDrop>
      {busy && <p className="hint">Opening…</p>}
      {error && <Notice tone="error">{error}</Notice>}
    </>
  );
}

export function PdfInfo({ pdf, onClear, extra }: { pdf: LoadedPdf; onClear: () => void; extra?: ReactNode }) {
  return (
    <div className="image-info">
      <span className="pdf-badge" aria-hidden="true">PDF</span>
      <div className="image-info-text">
        <p className="image-info-name" title={pdf.name}>{pdf.name}</p>
        <p className="image-info-meta">{number(pdf.pages, 0)} {pdf.pages === 1 ? 'page' : 'pages'} · {formatBytes(pdf.size)}{extra ? <> · {extra}</> : null}</p>
      </div>
      <Button variant="ghost" size="sm" onClick={onClear}>Change file</Button>
    </div>
  );
}

/** Page thumbnails, rendered as they come into view. */
export function usePageThumbs(bytes: Uint8Array | null, pages: number, width = 150) {
  const [thumbs, setThumbs] = useState<Record<number, string>>({});
  const [wanted, setWanted] = useState<Set<number>>(new Set());
  const urls = useRef<string[]>([]);

  useEffect(() => {
    setThumbs({});
    urls.current.forEach(URL.revokeObjectURL);
    urls.current = [];
    setWanted(new Set(Array.from({ length: Math.min(pages, 12) }, (_, i) => i + 1)));
  }, [bytes, pages]);
  useEffect(() => () => urls.current.forEach(URL.revokeObjectURL), []);

  useEffect(() => {
    if (!bytes || !wanted.size) return;
    let cancelled = false;
    (async () => {
      const doc = await openForView(bytes);
      try {
        for (const n of [...wanted].sort((a, b) => a - b)) {
          if (cancelled) return;
          if (thumbs[n]) continue;
          const url = await renderThumb(doc, n, width);
          if (cancelled) { URL.revokeObjectURL(url); return; }
          urls.current.push(url);
          setThumbs((t) => ({ ...t, [n]: url }));
        }
      } finally {
        await doc.destroy();
      }
    })().catch(() => undefined);
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bytes, wanted]);

  const request = useCallback((n: number) => setWanted((w) => (w.has(n) ? w : new Set(w).add(n))), []);
  return { thumbs, request };
}

export function PageThumb({ n, url, onVisible, children, className = '', style }: {
  n: number; url?: string; onVisible: (n: number) => void; children?: ReactNode; className?: string; style?: React.CSSProperties;
}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el || url) return;
    const observer = new IntersectionObserver((entries) => entries.forEach((e) => e.isIntersecting && onVisible(n)), { rootMargin: '300px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [n, url, onVisible]);
  return (
    <div ref={box} className={`page-thumb ${className}`} style={style}>
      {url ? <img src={url} alt={`Page ${n}`} /> : <span className="page-thumb-wait" aria-label={`Page ${n} loading`} />}
      <span className="page-thumb-n">{n}</span>
      {children}
    </div>
  );
}

/** Before → after, and the download. */
export function PdfResult({ label = 'Done', beforeSize, afterSize, filename, make, note, onAgain, children }: {
  label?: string;
  beforeSize?: number;
  afterSize: number;
  filename: string | (() => string);
  make: () => Promise<Blob | null> | Blob | null;
  note?: ReactNode;
  onAgain?: () => void;
  children?: ReactNode;
}) {
  const saved = beforeSize ? 1 - afterSize / beforeSize : 0;
  return (
    <section className="pdf-result" aria-live="polite">
      <p className="result-label">{label}</p>
      {beforeSize ? (
        <div className="size-compare size-compare-plain">
          <div><p className="result-label">Before</p><p className="size-value">{formatBytes(beforeSize)}</p></div>
          <span className="size-arrow" aria-hidden="true">→</span>
          <div><p className="result-label">After</p><p className="size-value">{formatBytes(afterSize)}</p></div>
          {saved > 0.01 && <p className="size-delta">↓ {number(saved * 100, 0)}%</p>}
        </div>
      ) : (
        <p className="result-value pdf-result-size">{formatBytes(afterSize)}</p>
      )}
      {note && <p className="hint">{note}</p>}
      <div className="result-actions">
        <ExportButton size="lg" label="Download" filename={filename} make={make} />
        {children}
        {onAgain && <Button size="lg" variant="ghost" onClick={onAgain}>Start over</Button>}
      </div>
    </section>
  );
}

export function Progress({ value, label }: { value: number; label: string }) {
  return (
    <div className="progress" role="status">
      <div className="progress-bar"><i style={{ width: `${Math.round(value * 100)}%` }} /></div>
      <p className="hint">{label}</p>
    </div>
  );
}

export const pdfName = (name: string, suffix: string, ext = 'pdf'): string => {
  const base = name.replace(/\.pdf$/i, '').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'document';
  // "pages-1, 3" is a filename with a space in it. Tidy the suffix too.
  const tail = suffix.replace(/,\s*/g, '+').replace(/[^\w.+-]+/g, '-').replace(/^-+|-+$/g, '');
  return `${base}${tail ? `-${tail}` : ''}.${ext}`;
};
