'use client';

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Button, Notice, Segmented, Slider, TextField } from '@/components/ui';
import ExportButton from '@/components/ExportButton';
import FileDrop from '@/components/FileDrop';
import { useApp, useToolActions } from '@/components/AppState';
import { IMAGE_ACCEPT } from '@/utils/image';
import { number } from '@/utils/format';
import { sign, type Placement } from '@/utils/pdfOps';
import { canvasToPng, openForView, renderPage, trimCanvas } from '@/utils/pdfBrowser';
import { PdfDrop, PdfInfo, pdfName, usePdf } from './shared';

type Stamp = { png: Uint8Array; width: number; height: number; url: string };
const SCRIPT = "'Snell Roundhand', 'Brush Script MT', 'Segoe Script', 'Bradley Hand', cursive";

/** Draw with a finger, a stylus or a mouse. */
function SignaturePad({ onDone }: { onDone: (stamp: Stamp) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const c = canvas.current!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = c.clientWidth * dpr;
    c.height = c.clientHeight * dpr;
    const ctx = c.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111111';
  }, []);

  const point = (e: ReactPointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const down = (e: ReactPointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const ctx = canvas.current!.getContext('2d')!;
    const p = point(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    drawing.current = true;
    setEmpty(false);
  };
  const move = (e: ReactPointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvas.current!.getContext('2d')!;
    const p = point(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };
  const up = () => { drawing.current = false; };
  const clear = () => {
    const c = canvas.current!;
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
    setEmpty(true);
  };
  const use = async () => {
    const trimmed = trimCanvas(canvas.current!);
    if (!trimmed) return;
    const png = await canvasToPng(trimmed);
    onDone({ ...png, url: URL.createObjectURL(new Blob([png.png as BlobPart], { type: 'image/png' })) });
  };

  return (
    <div className="stack-sm">
      <canvas ref={canvas} className="sign-pad" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} aria-label="Draw your signature" />
      <div className="button-row">
        <Button variant="primary" onClick={use} disabled={empty}>Use this signature</Button>
        <Button variant="ghost" onClick={clear} disabled={empty}>Clear</Button>
      </div>
    </div>
  );
}

export default function SignPdf() {
  const { toast } = useApp();
  const { pdf, error, locked, busy, open, clear } = usePdf();
  const [mode, setMode] = useState<'draw' | 'type' | 'image'>('draw');
  const [typed, setTyped] = useState('');
  const [stamp, setStamp] = useState<Stamp | null>(null);
  const [page, setPage] = useState(0);
  const [pageUrl, setPageUrl] = useState<string | null>(null);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [width, setWidth] = useState(28);
  const view = useRef<HTMLDivElement>(null);
  useToolActions({});

  /* The page being signed, big enough to place a signature accurately. */
  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;
    let url = '';
    (async () => {
      const doc = await openForView(pdf.bytes);
      const p = await doc.getPage(page + 1);
      const base = p.getViewport({ scale: 1 });
      const r = await renderPage(p, Math.min(2, 900 / base.width));
      const blob = await new Promise<Blob | null>((res) => r.canvas.toBlob(res, 'image/jpeg', 0.85));
      p.cleanup();
      await doc.destroy();
      if (cancelled || !blob) return;
      url = URL.createObjectURL(blob);
      setPageUrl(url);
    })().catch(() => undefined);
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [pdf, page]);

  const useTyped = async () => {
    if (!typed.trim()) return;
    const size = 200;
    const font = `500 ${size}px ${SCRIPT}`;
    const measure = document.createElement('canvas').getContext('2d')!;
    measure.font = font;
    const w = Math.ceil(measure.measureText(typed).width) + 40;
    const canvas = document.createElement('canvas');
    canvas.width = Math.min(3000, w);
    canvas.height = Math.round(size * 1.6);
    const ctx = canvas.getContext('2d')!;
    ctx.font = font;
    ctx.fillStyle = '#111111';
    ctx.textBaseline = 'middle';
    ctx.fillText(typed, 20, canvas.height / 2);
    const trimmed = trimCanvas(canvas) ?? canvas;
    const png = await canvasToPng(trimmed);
    setStamp({ ...png, url: URL.createObjectURL(new Blob([png.png as BlobPart], { type: 'image/png' })) });
  };

  const useImage = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      canvas.width = Math.min(1600, bitmap.width);
      canvas.height = Math.round((canvas.width / bitmap.width) * bitmap.height);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      // Paper-white backgrounds become transparent, so a photo of a signature sits on the page.
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < data.data.length; i += 4) {
        const [r, g, b] = [data.data[i], data.data[i + 1], data.data[i + 2]];
        const light = (r + g + b) / 3;
        if (light > 190) data.data[i + 3] = 0;
        else if (light > 140) data.data[i + 3] = Math.round(255 * ((190 - light) / 50));
      }
      ctx.putImageData(data, 0, 0);
      const trimmed = trimCanvas(canvas) ?? canvas;
      const png = await canvasToPng(trimmed);
      setStamp({ ...png, url: URL.createObjectURL(new Blob([png.png as BlobPart], { type: 'image/png' })) });
    } catch {
      toast('That image couldn’t be used. Try a PNG or JPG.');
    }
  };

  const place = (e: React.MouseEvent) => {
    if (!stamp || !view.current) return;
    const r = view.current.getBoundingClientRect();
    const w = width / 100;
    const h = (w * (stamp.height / stamp.width) * r.width) / r.height;
    const x = Math.min(1 - w, Math.max(0, (e.clientX - r.left) / r.width - w / 2));
    const y = Math.min(1 - h, Math.max(0, (e.clientY - r.top) / r.height - h / 2));
    setPlacements((list) => [...list, { page, x, y, w, h }]);
  };

  if (!pdf) return <PdfDrop onFiles={open} locked={locked} error={error} busy={busy} onPassword={(p) => locked && open([locked], p)} title="Drop the PDF to sign" />;

  return (
    <div className="image-tool">
      <div className="card stack image-controls">
        <PdfInfo pdf={pdf} onClear={clear} />
        {!stamp ? (
          <>
            <Segmented label="Your signature" value={mode} onChange={setMode} options={[{ id: 'draw', label: 'Draw' }, { id: 'type', label: 'Type' }, { id: 'image', label: 'Upload' }]} />
            {mode === 'draw' && <SignaturePad onDone={setStamp} />}
            {mode === 'type' && (
              <div className="stack-sm">
                <TextField label="Your name" value={typed} onChange={setTyped} placeholder="Your name" autoComplete="off" />
                <p className="sign-preview" style={{ fontFamily: SCRIPT }}>{typed || 'Your name'}</p>
                <Button variant="primary" onClick={useTyped} disabled={!typed.trim()}>Use this signature</Button>
              </div>
            )}
            {mode === 'image' && <FileDrop accept={IMAGE_ACCEPT} onFiles={useImage} compact title="Photo of your signature" />}
          </>
        ) : (
          <>
            <div className="image-info">
              <img src={stamp.url} alt="Your signature" className="sign-thumb" />
              <div className="image-info-text"><p className="image-info-name">Signature ready</p><p className="image-info-meta">Click the page to place it</p></div>
              <Button variant="ghost" size="sm" onClick={() => { setStamp(null); setPlacements([]); }}>Change</Button>
            </div>
            <Slider label="Signature width" min={10} max={60} value={width} onChange={setWidth} format={(v) => `${v}% of the page`} />
            {pdf.pages > 1 && (
              <div className="field">
                <span className="label">Page {page + 1} of {pdf.pages}</span>
                <div className="button-row">
                  <Button size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>← Previous</Button>
                  <Button size="sm" onClick={() => setPage((p) => Math.min(pdf.pages - 1, p + 1))} disabled={page === pdf.pages - 1}>Next →</Button>
                  <Button size="sm" variant="ghost" onClick={() => setPage(pdf.pages - 1)}>Last page</Button>
                </div>
              </div>
            )}
            <p className="hint">{placements.length ? `${number(placements.length, 0)} placed. Click again to add another.` : 'Click where the signature should go.'}</p>
            <div className="button-row">
              <ExportButton size="lg" label="Sign and download" disabled={!placements.length} filename={() => pdfName(pdf.name, 'signed')} make={async () => new Blob([await sign(pdf.bytes, stamp, placements) as BlobPart], { type: 'application/pdf' })} />
              <Button size="lg" variant="ghost" onClick={() => setPlacements([])} disabled={!placements.length}>Clear placements</Button>
            </div>
            <Notice>This places a picture of your signature. It isn’t a cryptographic e-signature.</Notice>
          </>
        )}
      </div>

      <section className="sign-stage">
        <div ref={view} className={`sign-page${stamp ? ' is-ready' : ''}`} onClick={stamp ? place : undefined}>
          {pageUrl ? <img src={pageUrl} alt={`Page ${page + 1}`} /> : <span className="page-thumb-wait" />}
          {placements.filter((p) => p.page === page).map((p, i) => (
            <span key={i} className="sign-placed" style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, width: `${p.w * 100}%` }}>
              <img src={stamp?.url} alt="" />
              <button type="button" onClick={(e) => { e.stopPropagation(); setPlacements((list) => list.filter((x) => x !== placements.filter((q) => q.page === page)[i])); }} aria-label="Remove this signature">✕</button>
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
