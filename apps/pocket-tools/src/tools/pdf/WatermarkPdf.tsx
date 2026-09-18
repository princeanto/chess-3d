'use client';

import { useEffect, useState } from 'react';
import { Notice, Segmented, Slider, TextField } from '@/components/ui';
import ExportButton from '@/components/ExportButton';
import FileDrop from '@/components/FileDrop';
import { useApp, useToolActions } from '@/components/AppState';
import { IMAGE_ACCEPT } from '@/utils/image';
import { watermark } from '@/utils/pdfOps';
import { textStamp } from '@/utils/pdfBrowser';
import { PageThumb, PdfDrop, PdfInfo, pdfName, usePageThumbs, usePdf } from './shared';

export default function WatermarkPdf() {
  const { toast } = useApp();
  const { pdf, error, locked, busy, open, clear } = usePdf();
  const [kind, setKind] = useState<'text' | 'image'>('text');
  const [text, setText] = useState('CONFIDENTIAL');
  const [color, setColor] = useState('#E4572E');
  const [opacity, setOpacity] = useState(20);
  const [rotation, setRotation] = useState(45);
  const [scale, setScale] = useState(70);
  const [layout, setLayout] = useState<'center' | 'tile'>('center');
  const [image, setImage] = useState<{ png: Uint8Array; width: number; height: number; url: string } | null>(null);
  const { thumbs, request } = usePageThumbs(pdf?.bytes ?? null, pdf?.pages ?? 0, 170);
  const [stampUrl, setStampUrl] = useState<string | null>(null);
  useToolActions({});

  // The preview shows the very image that gets stamped, at the size it lands.
  useEffect(() => {
    if (kind !== 'text' || !text.trim()) { setStampUrl(null); return; }
    let dead = false;
    let url: string | null = null;
    const id = window.setTimeout(() => {
      textStamp(text, color).then((stamp) => {
        if (dead) return;
        url = URL.createObjectURL(new Blob([stamp.png as BlobPart], { type: 'image/png' }));
        setStampUrl(url);
      }).catch(() => undefined);
    }, 120);
    return () => { dead = true; window.clearTimeout(id); if (url) URL.revokeObjectURL(url); };
  }, [kind, text, color]);

  const pickImage = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      canvas.width = Math.min(2000, bitmap.width);
      canvas.height = Math.round((canvas.width / bitmap.width) * bitmap.height);
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
      if (!blob) throw new Error('png');
      setImage({ png: new Uint8Array(await blob.arrayBuffer()), width: canvas.width, height: canvas.height, url: URL.createObjectURL(blob) });
    } catch {
      toast('That image couldn’t be used. Try a PNG or JPG.');
    }
  };

  const make = async () => {
    if (!pdf) return null;
    const stamp = kind === 'text' ? await textStamp(text || ' ', color) : image;
    if (!stamp) return null;
    const out = await watermark(pdf.bytes, stamp, { scale: scale / 100, opacity: opacity / 100, rotation, layout });
    return new Blob([out as BlobPart], { type: 'application/pdf' });
  };

  if (!pdf) return <PdfDrop onFiles={open} locked={locked} error={error} busy={busy} onPassword={(p) => locked && open([locked], p)} title="Drop a PDF to stamp" />;

  const ready = kind === 'text' ? !!text.trim() : !!image;
  const mark = kind === 'text' ? stampUrl : image?.url ?? null;

  return (
    <div className="image-tool">
      <div className="card stack image-controls">
        <PdfInfo pdf={pdf} onClear={clear} />
        <Segmented label="Watermark" value={kind} onChange={setKind} options={[{ id: 'text', label: 'Text' }, { id: 'image', label: 'Image or logo' }]} />
        {kind === 'text' ? (
          <>
            <TextField label="Words" value={text} onChange={setText} placeholder="CONFIDENTIAL" autoComplete="off" />
            <label className="color-field"><span className="label">Colour</span><span className="color-pick"><input type="color" value={color} onChange={(e) => setColor(e.target.value.toUpperCase())} /><code>{color}</code></span></label>
          </>
        ) : image ? (
          <div className="image-info">
            <img src={image.url} alt="" className="image-info-thumb" />
            <div className="image-info-text"><p className="image-info-name">Your logo</p><p className="image-info-meta">{image.width} × {image.height}</p></div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setImage(null)}>Change</button>
          </div>
        ) : (
          <FileDrop accept={IMAGE_ACCEPT} onFiles={pickImage} compact title="Drop a logo" />
        )}
        <Segmented label="Layout" value={layout} onChange={setLayout} options={[{ id: 'center', label: 'Across the middle' }, { id: 'tile', label: 'Tiled' }]} />
        <Slider label="Size" min={10} max={120} value={scale} onChange={setScale} format={(v) => `${v}%`} />
        <Slider label="Opacity" min={5} max={100} value={opacity} onChange={setOpacity} format={(v) => `${v}%`} />
        <Slider label="Angle" min={-90} max={90} step={5} value={rotation} onChange={setRotation} format={(v) => `${v}°`} />
        <ExportButton size="lg" label="Add watermark" disabled={!ready} filename={() => pdfName(pdf.name, 'watermarked')} make={make} />
        {!ready && <Notice>{kind === 'text' ? 'Type the words to stamp.' : 'Choose a logo image.'}</Notice>}
      </div>
      <section className="page-grid" aria-label="Preview">
        {Array.from({ length: Math.min(pdf.pages, 4) }, (_, i) => (
          <PageThumb key={i} n={i + 1} url={thumbs[i + 1]} onVisible={request}>
            {mark && (
              <span className="mark-preview" style={{ opacity: opacity / 100 }} aria-hidden="true">
                {layout === 'center'
                  ? <img src={mark} alt="" style={{ width: `${scale}%`, transform: `rotate(${rotation}deg)` }} />
                  : <span className="mark-tile" style={{ transform: `rotate(${rotation}deg)`, backgroundImage: `url(${mark})`, backgroundSize: `${scale * 1.6}% auto` }} />}
              </span>
            )}
          </PageThumb>
        ))}
      </section>
    </div>
  );
}
