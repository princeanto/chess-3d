'use client';

import { useEffect, useRef, useState } from 'react';
import FileDrop from '@/components/FileDrop';
import ExportButton from '@/components/ExportButton';
import { Button, Check, Notice, NumberField, Segmented, Stepper } from '@/components/ui';
import { useToolActions } from '@/components/AppState';
import { FriendlyError, IMAGE_ACCEPT, openImage, release, type LoadedImage } from '@/utils/image';
import { buildPdf, PAGE_SIZES } from '@/utils/pdf';
import { dated } from '@/utils/download';
import { parseAmount } from '@/utils/format';

type Paper = 'a4' | 'letter';
type Mode = 'grid' | 'size';
const MM: Record<Paper, [number, number]> = { a4: [210, 297], letter: [215.9, 279.4] };

interface Layout { cols: number; rows: number; cellW: number; cellH: number; x0: number; y0: number; gap: number; pageW: number; pageH: number }

function plan(paper: Paper, landscape: boolean, mode: Mode, rows: number, cols: number, cellWmm: number, cellHmm: number, gap: number, margin: number): Layout | null {
  let [pageW, pageH] = MM[paper];
  if (landscape) [pageW, pageH] = [pageH, pageW];
  const usableW = pageW - margin * 2;
  const usableH = pageH - margin * 2;
  if (mode === 'size') {
    if (!(cellWmm > 0 && cellHmm > 0)) return null;
    const c = Math.floor((usableW + gap) / (cellWmm + gap));
    const r = Math.floor((usableH + gap) / (cellHmm + gap));
    if (c < 1 || r < 1) return null;
    const x0 = (pageW - (c * cellWmm + (c - 1) * gap)) / 2;
    const y0 = (pageH - (r * cellHmm + (r - 1) * gap)) / 2;
    return { cols: c, rows: r, cellW: cellWmm, cellH: cellHmm, x0, y0, gap, pageW, pageH };
  }
  const cellW = (usableW - gap * (cols - 1)) / cols;
  const cellH = (usableH - gap * (rows - 1)) / rows;
  if (cellW <= 1 || cellH <= 1) return null;
  return { cols, rows, cellW, cellH, x0: margin, y0: margin, gap, pageW, pageH };
}

async function draw(l: Layout, bitmaps: ImageBitmap[], dpi: number, fit: 'cover' | 'contain', cutLines: boolean): Promise<HTMLCanvasElement> {
  const k = dpi / 25.4;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(l.pageW * k);
  canvas.height = Math.round(l.pageH * k);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = 'high';
  let n = 0;
  for (let r = 0; r < l.rows; r += 1) {
    for (let c = 0; c < l.cols; c += 1) {
      const b = bitmaps[n % bitmaps.length];
      n += 1;
      const x = (l.x0 + c * (l.cellW + l.gap)) * k;
      const y = (l.y0 + r * (l.cellH + l.gap)) * k;
      const w = l.cellW * k;
      const h = l.cellH * k;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      const scale = fit === 'cover' ? Math.max(w / b.width, h / b.height) : Math.min(w / b.width, h / b.height);
      const dw = b.width * scale;
      const dh = b.height * scale;
      ctx.drawImage(b, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
      ctx.restore();
      if (cutLines) {
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = Math.max(1, k * 0.1);
        ctx.setLineDash([k * 1.2, k * 1.2]);
        ctx.strokeRect(x, y, w, h);
        ctx.setLineDash([]);
      }
    }
  }
  return canvas;
}

export default function ImageSheet() {
  const [images, setImages] = useState<LoadedImage[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [paper, setPaper] = useState<Paper>('a4');
  const [landscape, setLandscape] = useState(false);
  const [mode, setMode] = useState<Mode>('size');
  const [rows, setRows] = useState(4);
  const [cols, setCols] = useState(3);
  const [cellW, setCellW] = useState('35');
  const [cellH, setCellH] = useState('45');
  const [gap, setGap] = useState('3');
  const [margin, setMargin] = useState('10');
  const [fit, setFit] = useState<'cover' | 'contain'>('cover');
  const [cutLines, setCutLines] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const bitmaps = useRef(new Map<string, ImageBitmap>());
  const all = useRef<LoadedImage[]>([]);
  all.current = images;

  useEffect(() => () => { all.current.forEach(release); bitmaps.current.forEach((b) => b.close()); }, []);

  const add = async (files: File[]) => {
    const problems: string[] = [];
    const opened: LoadedImage[] = [];
    for (const file of files.slice(0, 24)) {
      try {
        const img = await openImage(file);
        bitmaps.current.set(img.url, await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions));
        opened.push(img);
      } catch (e) { problems.push(`${file.name}: ${e instanceof FriendlyError ? e.message : 'couldn’t be opened.'}`); }
    }
    setErrors(problems);
    setImages((list) => [...list, ...opened]);
  };

  const layout = plan(paper, landscape, mode, rows, cols, parseAmount(cellW) ?? 0, parseAmount(cellH) ?? 0, Math.max(0, parseAmount(gap) ?? 0), Math.max(0, parseAmount(margin) ?? 0));
  const list = () => images.map((i) => bitmaps.current.get(i.url)!).filter(Boolean);

  useEffect(() => {
    if (!layout || !images.length) { setPreviewUrl(null); return; }
    let cancelled = false;
    let url: string | null = null;
    const id = window.setTimeout(async () => {
      const canvas = await draw(layout, list(), 72, fit, cutLines);
      canvas.toBlob((b) => { if (!b || cancelled) return; url = URL.createObjectURL(b); setPreviewUrl(url); }, 'image/png');
    }, 120);
    return () => { cancelled = true; window.clearTimeout(id); if (url) URL.revokeObjectURL(url); };
  }, [JSON.stringify(layout), images, fit, cutLines]); // eslint-disable-line react-hooks/exhaustive-deps

  const png = async () => (layout ? new Promise<Blob | null>(async (resolve) => (await draw(layout, list(), 300, fit, cutLines)).toBlob(resolve, 'image/png')) : null);
  const pdf = async () => {
    if (!layout) return null;
    const canvas = await draw(layout, list(), 300, fit, cutLines);
    const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (!jpeg) return null;
    const size = PAGE_SIZES[paper];
    const [w, h] = landscape ? [size.h, size.w] : [size.w, size.h];
    return new Blob([buildPdf([{ width: w, height: h, images: [{ jpeg: new Uint8Array(await jpeg.arrayBuffer()), width: canvas.width, height: canvas.height, x: 0, y: 0, w, h }] }], 'Image sheet') as BlobPart], { type: 'application/pdf' });
  };
  useToolActions({});

  return (
    <div className="stack">
      <FileDrop accept={IMAGE_ACCEPT} multiple onFiles={add} compact={images.length > 0} title={images.length ? 'Add more images' : 'Drop the photos for your sheet'}>
        {!images.length && <p className="drop-sub">One photo fills every space. Several take turns.</p>}
      </FileDrop>
      {errors.map((e) => <Notice key={e} tone="error">{e}</Notice>)}
      {images.length > 0 && (
        <div className="sheet-tool">
          <div className="card stack no-print">
            <div className="thumbs">
              {images.map((img, i) => (
                <span key={img.url} className="thumb">
                  <img src={img.url} alt={img.name} />
                  <button type="button" aria-label={`Remove ${img.name}`} onClick={() => setImages((l) => { release(l[i]); return l.filter((_, k) => k !== i); })}>✕</button>
                </span>
              ))}
            </div>
            <div className="options-row">
              <Segmented label="Paper" value={paper} onChange={setPaper} options={[{ id: 'a4', label: 'A4' }, { id: 'letter', label: 'Letter' }]} />
              <Segmented label="Orientation" value={landscape ? 'l' : 'p'} onChange={(v) => setLandscape(v === 'l')} options={[{ id: 'p', label: 'Portrait' }, { id: 'l', label: 'Landscape' }]} />
            </div>
            <Segmented label="Lay out by" value={mode} onChange={setMode} options={[{ id: 'size', label: 'Photo size' }, { id: 'grid', label: 'Rows × columns' }]} />
            {mode === 'size' ? (
              <>
                <div className="grid-2 grid-keep">
                  <NumberField label="Width" value={cellW} onChange={setCellW} suffix="mm" />
                  <NumberField label="Height" value={cellH} onChange={setCellH} suffix="mm" />
                </div>
                <div className="chips">
                  {([['Passport (India) 35×45', '35', '45'], ['US passport 51×51', '51', '51'], ['Stamp 25×30', '25', '30'], ['Wallet 64×89', '64', '89']] as const).map(([label, a, b]) => (
                    <button key={label} type="button" className="chip" aria-pressed={cellW === a && cellH === b} onClick={() => { setCellW(a); setCellH(b); }}>{label} mm</button>
                  ))}
                </div>
              </>
            ) : (
              <div className="grid-2 grid-keep">
                <Stepper label="Rows" value={rows} onChange={setRows} min={1} max={20} />
                <Stepper label="Columns" value={cols} onChange={setCols} min={1} max={12} />
              </div>
            )}
            <div className="grid-2 grid-keep">
              <NumberField label="Spacing" value={gap} onChange={setGap} suffix="mm" />
              <NumberField label="Margin" value={margin} onChange={setMargin} suffix="mm" />
            </div>
            <div className="options-row">
              <Segmented label="Fit" value={fit} onChange={setFit} options={[{ id: 'cover', label: 'Fill (crop)' }, { id: 'contain', label: 'Fit (no crop)' }]} />
              <Check label="Cut lines" checked={cutLines} onChange={setCutLines} />
            </div>
            {layout ? <p className="hint">{layout.cols} × {layout.rows} = {layout.cols * layout.rows} photos, each {layout.cellW.toFixed(1)} × {layout.cellH.toFixed(1)} mm. Print at 100% (“actual size”) to keep the size exact.</p> : <Notice tone="error">That doesn’t fit on the page. Try smaller photos, less spacing or smaller margins.</Notice>}
            <div className="button-row">
              <ExportButton size="lg" label="Download PDF" disabled={!layout} filename={() => dated('image-sheet', 'pdf')} make={pdf} />
              <ExportButton size="lg" variant="secondary" label="PNG" disabled={!layout} filename={() => dated('image-sheet', 'png')} make={png} />
              <Button size="lg" disabled={!layout} onClick={() => window.print()}>Print</Button>
            </div>
          </div>
          <section className="sheet-preview print-area" aria-label="Sheet preview">
            {previewUrl && layout && <img src={previewUrl} alt="Preview of the printable sheet" style={{ aspectRatio: `${layout.pageW} / ${layout.pageH}` }} />}
          </section>
        </div>
      )}
    </div>
  );
}
