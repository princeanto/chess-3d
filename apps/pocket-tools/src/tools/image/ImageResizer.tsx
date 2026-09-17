'use client';

import { useEffect, useState } from 'react';
import FileDrop from '@/components/FileDrop';
import ExportButton from '@/components/ExportButton';
import { Button, Check, Notice, NumberField, Segmented, Slider } from '@/components/ui';
import { useApp, useToolActions, useToolParams } from '@/components/AppState';
import { extFor, IMAGE_ACCEPT, runImageJob, type Fit, type JobResult, type OutputType } from '@/utils/image';
import { bytes, number } from '@/utils/format';
import { renamed } from '@/utils/download';
import { ImageInfo, useImageFile, useObjectUrl } from './shared';

const PRESETS: { id: string; label: string; w: number; h: number }[] = [
  { id: 'instagram', label: 'Instagram', w: 1080, h: 1080 },
  { id: 'portrait', label: 'Insta portrait', w: 1080, h: 1350 },
  { id: 'story', label: 'Story', w: 1080, h: 1920 },
  { id: 'whatsapp', label: 'WhatsApp DP', w: 500, h: 500 },
  { id: 'profile', label: 'Profile', w: 400, h: 400 },
  { id: 'passport', label: 'Passport 35×45 mm', w: 413, h: 531 },
];

export default function ImageResizer() {
  const { toast } = useApp();
  const { image, error, open, clear } = useImageFile();
  const [w, setW] = useState('');
  const [h, setH] = useState('');
  const [lock, setLock] = useState(true);
  const [preset, setPreset] = useState('custom');
  const [fit, setFit] = useState<Fit>('cover');
  const [quality, setQuality] = useState(90);
  const [result, setResult] = useState<JobResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [paramSize, setParamSize] = useState<[string, string] | null>(null);
  const url = useObjectUrl(result?.blob ?? null);

  useToolParams((p) => { if (p.get('w') && p.get('h')) setParamSize([p.get('w')!, p.get('h')!]); });

  useEffect(() => {
    setResult(null);
    if (!image) return;
    if (paramSize) { setW(paramSize[0]); setH(paramSize[1]); setLock(false); setPreset('custom'); }
    else { setW(String(image.width)); setH(String(image.height)); setPreset('custom'); setLock(true); }
  }, [image]); // eslint-disable-line react-hooks/exhaustive-deps

  const type: OutputType = image?.type === 'image/png' ? 'image/png' : image?.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
  const width = Math.round(Number(w.replace(/,/g, '')));
  const height = Math.round(Number(h.replace(/,/g, '')));
  const valid = width > 0 && height > 0 && width <= 16000 && height <= 16000;
  const ratioDiffers = image && valid && Math.abs(width / height - image.width / image.height) > 0.01;

  const onW = (v: string) => {
    setW(v); setPreset('custom'); setResult(null);
    const n = Number(v.replace(/,/g, ''));
    if (lock && image && n > 0) setH(String(Math.round((n * image.height) / image.width)));
  };
  const onH = (v: string) => {
    setH(v); setPreset('custom'); setResult(null);
    const n = Number(v.replace(/,/g, ''));
    if (lock && image && n > 0) setW(String(Math.round((n * image.width) / image.height)));
  };
  const choosePreset = (id: string) => {
    setPreset(id);
    setResult(null);
    const p = PRESETS.find((x) => x.id === id);
    if (p) { setW(String(p.w)); setH(String(p.h)); setLock(false); }
    else if (image) { setW(String(image.width)); setH(String(image.height)); setLock(true); }
  };
  const scale = (k: number) => { if (!image) return; setPreset('custom'); setLock(true); setW(String(Math.round(image.width * k))); setH(String(Math.round(image.height * k))); setResult(null); };

  const resize = async () => {
    if (!image || busy) return;
    if (!valid) { toast('Add a width and height to continue.'); return; }
    setBusy(true);
    try {
      setResult(await runImageJob(image.file, { kind: 'transform', type, quality: quality / 100, transform: { width, height, fit: ratioDiffers ? fit : 'stretch' } }));
    } catch {
      toast('Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };
  useToolActions({ run: resize });

  if (!image) {
    return (
      <>
        <FileDrop accept={IMAGE_ACCEPT} onFiles={open} title="Drop an image to resize" />
        {error && <Notice tone="error">{error}</Notice>}
      </>
    );
  }

  return (
    <div className="image-tool">
      <div className="image-controls card stack">
        <ImageInfo image={image} onClear={clear} />
        <Segmented label="Size" value={preset} onChange={choosePreset} options={[{ id: 'custom', label: 'Custom' }, ...PRESETS.map((p) => ({ id: p.id, label: p.label }))]} wrap />
        <div className="grid-2 grid-keep">
          <NumberField label="Width" value={w} onChange={onW} suffix="px" inputMode="numeric" />
          <NumberField label="Height" value={h} onChange={onH} suffix="px" inputMode="numeric" />
        </div>
        <div className="options-row">
          <Check label="Lock aspect ratio" checked={lock} onChange={(v) => { setLock(v); if (v) onW(w); }} />
          <div className="button-row">
            <Button variant="ghost" size="sm" onClick={() => scale(0.5)}>50%</Button>
            <Button variant="ghost" size="sm" onClick={() => scale(0.25)}>25%</Button>
          </div>
        </div>
        {ratioDiffers && (
          <Segmented label="The shape is different — so" value={fit} onChange={(f) => { setFit(f); setResult(null); }} options={[{ id: 'cover', label: 'Crop to fill' }, { id: 'contain', label: 'Fit inside' }, { id: 'stretch', label: 'Stretch' }]} wrap />
        )}
        {type !== 'image/png' && <Slider label="Quality" min={50} max={100} value={quality} onChange={(q) => { setQuality(q); setResult(null); }} format={(v) => `${v}%`} />}
        {valid && (width > image.width || height > image.height) && <p className="hint">That’s bigger than the original, so it will look softer, not sharper.</p>}
        <Button variant="primary" size="lg" onClick={resize} disabled={busy || !valid}>{busy ? 'Resizing…' : `Resize to ${valid ? `${number(width, 0)} × ${number(height, 0)}` : '…'}`}</Button>
      </div>
      <section className="image-result" aria-live="polite">
        {result && url ? (
          <>
            <div className="image-preview checker"><img src={url} alt="Resized image" /></div>
            <p className="result-caption">{number(result.width, 0)} × {number(result.height, 0)} · {bytes(result.blob.size)}</p>
            <div className="result-actions">
              <ExportButton label="Download image" size="lg" filename={renamed(image.name, `${result.width}x${result.height}`, extFor(type))} make={() => result.blob} />
            </div>
          </>
        ) : (
          <div className="image-waiting"><img src={image.url} alt="Your image" />{busy && <p className="image-busy">Resizing on your device…</p>}</div>
        )}
      </section>
    </div>
  );
}
