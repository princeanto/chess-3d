'use client';

import { useEffect, useRef, useState } from 'react';
import FileDrop from '@/components/FileDrop';
import ExportButton from '@/components/ExportButton';
import { Button, Chips, Notice, Segmented, Slider } from '@/components/ui';
import { useApp, useToolActions, useToolParams } from '@/components/AppState';
import { extFor, IMAGE_ACCEPT, runImageJob, type JobResult, type OutputType } from '@/utils/image';
import { bytes, number } from '@/utils/format';
import { renamed } from '@/utils/download';
import { Compare, ImageInfo, useImageFile, useObjectUrl } from './shared';

const PRESETS = [5e6, 2e6, 1e6, 5e5, 2e5];
const presetLabel = (n: number) => `< ${bytes(n)}`;

export default function ImageCompressor() {
  const { toast } = useApp();
  const { image, error, open, clear } = useImageFile();
  const [mode, setMode] = useState<'target' | 'quality'>('target');
  const [target, setTarget] = useState<number>(1e6);
  const [quality, setQuality] = useState(75);
  const [type, setType] = useState<OutputType>('image/jpeg');
  const [result, setResult] = useState<JobResult | null>(null);
  const [kept, setKept] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const paramTarget = useRef<number | null>(null);
  const url = useObjectUrl(result?.blob ?? null);

  useToolParams((p) => { const t = Number(p.get('target')); if (t > 0) { paramTarget.current = t; setTarget(t); } });

  // A new image gets a sensible target and format straight away.
  useEffect(() => {
    setResult(null);
    setKept(false);
    if (!image) return;
    setType(image.type === 'image/png' || image.type === 'image/webp' || image.type === 'image/gif' ? 'image/webp' : 'image/jpeg');
    if (paramTarget.current === null) setTarget(PRESETS.find((p) => p < image.size * 0.6) ?? 2e5);
  }, [image]);

  const compress = async () => {
    if (!image || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      if (mode === 'target' && image.size <= target && image.type === type) {
        setResult({ blob: image.file, width: image.width, height: image.height, quality: 1, reached: true });
        setKept(true);
      } else {
        const r = await runImageJob(image.file, mode === 'target' ? { kind: 'compress', type, target } : { kind: 'quality', type, quality: quality / 100 });
        setKept(false);
        setResult(r);
      }
    } catch {
      setFailed(true);
      toast('Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  // Quality mode shows the size as the slider moves.
  useEffect(() => {
    if (!image || mode !== 'quality') return;
    const id = window.setTimeout(compress, 300);
    return () => window.clearTimeout(id);
  }, [quality, type, mode, image]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (mode === 'target') setResult(null); }, [target, type, mode]);

  useToolActions({ run: compress });

  if (!image) {
    return (
      <>
        <FileDrop accept={IMAGE_ACCEPT} onFiles={open} title="Drop a photo to make it smaller" />
        {error && <Notice tone="error">{error}</Notice>}
      </>
    );
  }

  const saved = result ? 1 - result.blob.size / image.size : 0;
  const bigger = result && result.blob.size >= image.size && !kept;

  return (
    <div className="image-tool">
      <div className="image-controls card stack">
        <ImageInfo image={image} onClear={clear} />
        <Segmented label="How" value={mode} onChange={setMode} options={[{ id: 'target', label: 'Target size' }, { id: 'quality', label: 'Quality' }]} />
        {mode === 'target' ? (
          <div className="field">
            <span className="label">Make it smaller than</span>
            <Chips label="Target size" options={PRESETS} value={target} onChange={setTarget} format={presetLabel} />
            {!PRESETS.includes(target) && <p className="hint">Target: {presetLabel(target)}</p>}
          </div>
        ) : (
          <Slider label="Quality" min={10} max={95} value={quality} onChange={setQuality} format={(v) => `${v}%`} />
        )}
        <Segmented label="Save as" value={type} onChange={setType} options={[{ id: 'image/jpeg', label: 'JPG' }, { id: 'image/webp', label: 'WebP' }]} />
        <p className="hint">{type === 'image/webp' ? 'WebP is smaller at the same quality and keeps transparency. Most apps and sites accept it.' : 'JPG works everywhere. Transparent areas become white.'}</p>
        {mode === 'target' && <Button variant="primary" size="lg" onClick={compress} disabled={busy}>{busy ? 'Compressing…' : 'Compress'}</Button>}
      </div>

      <section className="image-result" aria-live="polite">
        {result && url ? (
          <>
            <div className="size-compare">
              <div><p className="result-label">Before</p><p className="size-value">{bytes(image.size)}</p></div>
              <span className="size-arrow" aria-hidden="true">→</span>
              <div><p className="result-label">After</p><p className="size-value">{bytes(result.blob.size)}</p></div>
              <p className={`size-delta${bigger ? ' is-worse' : ''}`}>{kept ? 'Already small enough' : bigger ? 'Not smaller' : `↓ ${number(saved * 100, 0)}%`}</p>
            </div>
            {kept && <Notice tone="ok">This image is already under {presetLabel(target)}. You can download it as it is.</Notice>}
            {!result.reached && <Notice tone="error">Couldn’t get under {presetLabel(target)} while keeping it recognisable. This is the smallest version.</Notice>}
            {bigger && <Notice>This version is bigger than the original — keep the original, or try a lower quality.</Notice>}
            {(result.width !== image.width || result.height !== image.height) && <p className="hint">Resized to {number(result.width, 0)} × {number(result.height, 0)} to reach the target.</p>}
            <Compare before={image.url} after={url} />
            <div className="result-actions">
              <ExportButton label="Download image" size="lg" filename={renamed(image.name, kept ? '' : 'compressed', kept ? extFor(image.type) : extFor(type))} make={() => result.blob} />
            </div>
          </>
        ) : (
          <div className="image-waiting">
            <img src={image.url} alt="Your image" />
            {busy ? <p className="image-busy">Compressing on your device…</p> : failed ? <p className="image-busy">That didn’t work. Try again.</p> : null}
          </div>
        )}
      </section>
    </div>
  );
}
