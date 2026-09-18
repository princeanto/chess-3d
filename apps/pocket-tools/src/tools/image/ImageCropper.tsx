'use client';

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import FileDrop from '@/components/FileDrop';
import ExportButton from '@/components/ExportButton';
import { Button, Notice, Segmented } from '@/components/ui';
import { useToolActions } from '@/components/AppState';
import { extFor, IMAGE_ACCEPT, runImageJob, type OutputType } from '@/utils/image';
import { number } from '@/utils/format';
import { renamed } from '@/utils/download';
import { ImageInfo, useImageFile } from './shared';

const RATIOS = [
  { id: 'free', label: 'Free', r: 0 },
  { id: '1:1', label: '1:1', r: 1 },
  { id: '4:5', label: '4:5', r: 4 / 5 },
  { id: '16:9', label: '16:9', r: 16 / 9 },
  { id: '9:16', label: '9:16', r: 9 / 16 },
  { id: '3:2', label: '3:2', r: 3 / 2 },
];

interface Rect { x: number; y: number; w: number; h: number }
type Drag = { mode: 'move' | 'nw' | 'ne' | 'sw' | 'se'; start: { x: number; y: number }; rect: Rect; pointer: number };

export default function ImageCropper() {
  const { image, error, open, clear } = useImageFile();
  const [rotate, setRotate] = useState<0 | 1 | 2 | 3>(0);
  const [flipX, setFlipX] = useState(false);
  const [flipY, setFlipY] = useState(false);
  const [ratio, setRatio] = useState('free');
  const [crop, setCrop] = useState<Rect>({ x: 0, y: 0, w: 0, h: 0 });
  const [view, setView] = useState({ w: 0, h: 0, scale: 1 });
  // Bumped when the decoded image arrives, so the drawing effect runs then too.
  const [ready, setReady] = useState(0);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const bitmap = useRef<ImageBitmap | null>(null);
  const drag = useRef<Drag | null>(null);

  const oriented = image ? (rotate % 2 ? { w: image.height, h: image.width } : { w: image.width, h: image.height }) : { w: 0, h: 0 };
  const r = RATIOS.find((x) => x.id === ratio)!.r;

  const fullCrop = useCallback((ratioValue: number) => {
    const { w, h } = oriented;
    if (!ratioValue) return { x: 0, y: 0, w, h };
    let cw = w;
    let ch = cw / ratioValue;
    if (ch > h) { ch = h; cw = ch * ratioValue; }
    return { x: (w - cw) / 2, y: (h - ch) / 2, w: cw, h: ch };
  }, [oriented.w, oriented.h]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!image) return;
    let cancelled = false;
    createImageBitmap(image.file, { imageOrientation: 'from-image' } as ImageBitmapOptions).then((b) => {
      if (cancelled) { b.close(); return; }
      bitmap.current?.close();
      bitmap.current = b;
      setRotate(0); setFlipX(false); setFlipY(false); setRatio('free');
      setCrop({ x: 0, y: 0, w: b.width, h: b.height });
      setReady((n) => n + 1);
    });
    return () => { cancelled = true; };
  }, [image]);

  // Draw the rotated, flipped image to fit the stage.
  useEffect(() => {
    const b = bitmap.current;
    const c = canvas.current;
    const s = stage.current;
    if (!b || !c || !s || !oriented.w) return;
    const maxW = s.clientWidth;
    const maxH = Math.min(560, window.innerHeight * 0.6);
    const scale = Math.min(maxW / oriented.w, maxH / oriented.h, 1);
    const w = Math.round(oriented.w * scale);
    const h = Math.round(oriented.h * scale);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = w * dpr;
    c.height = h * dpr;
    c.style.width = `${w}px`;
    c.style.height = `${h}px`;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.translate(w / 2, h / 2);
    ctx.rotate((rotate * Math.PI) / 2);
    ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
    const dw = rotate % 2 ? h : w;
    const dh = rotate % 2 ? w : h;
    ctx.drawImage(b, -dw / 2, -dh / 2, dw, dh);
    setView({ w, h, scale });
  }, [rotate, flipX, flipY, oriented.w, oriented.h, ready]);

  // Refit when the stage gets wider or narrower. Only width matters — watching
  // height too would loop, because drawing sets the canvas height.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    let last = el.clientWidth;
    const observer = new ResizeObserver(() => {
      if (el.clientWidth === last) return;
      last = el.clientWidth;
      setReady((n) => n + 1);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const turn = (dir: 1 | -1) => {
    setRotate((x) => (((x + dir) % 4 + 4) % 4) as 0 | 1 | 2 | 3);
    setCrop(() => {
      const w = oriented.h;
      const h = oriented.w;
      if (!r) return { x: 0, y: 0, w, h };
      let cw = w; let ch = cw / r;
      if (ch > h) { ch = h; cw = ch * r; }
      return { x: (w - cw) / 2, y: (h - ch) / 2, w: cw, h: ch };
    });
  };
  const chooseRatio = (id: string) => { setRatio(id); setCrop(fullCrop(RATIOS.find((x) => x.id === id)!.r)); };

  const clamp = (rect: Rect): Rect => {
    const w = Math.max(8, Math.min(rect.w, oriented.w));
    const h = Math.max(8, Math.min(rect.h, oriented.h));
    return { w, h, x: Math.max(0, Math.min(oriented.w - w, rect.x)), y: Math.max(0, Math.min(oriented.h - h, rect.y)) };
  };

  const onDown = (e: ReactPointerEvent, mode: Drag['mode']) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { mode, start: { x: e.clientX, y: e.clientY }, rect: crop, pointer: e.pointerId };
  };
  const onMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    const dx = (e.clientX - d.start.x) / view.scale;
    const dy = (e.clientY - d.start.y) / view.scale;
    const s = d.rect;
    if (d.mode === 'move') { setCrop(clamp({ ...s, x: s.x + dx, y: s.y + dy })); return; }
    const west = d.mode === 'nw' || d.mode === 'sw';
    const north = d.mode === 'nw' || d.mode === 'ne';
    const anchorX = west ? s.x + s.w : s.x;
    const anchorY = north ? s.y + s.h : s.y;
    let w = Math.max(16, west ? s.w - dx : s.w + dx);
    let h = Math.max(16, north ? s.h - dy : s.h + dy);
    const maxW = west ? anchorX : oriented.w - anchorX;
    const maxH = north ? anchorY : oriented.h - anchorY;
    if (r) {
      if (w / h > r) w = h * r; else h = w / r;
      if (w > maxW) { w = maxW; h = w / r; }
      if (h > maxH) { h = maxH; w = h * r; }
    } else {
      w = Math.min(w, maxW);
      h = Math.min(h, maxH);
    }
    setCrop({ x: west ? anchorX - w : anchorX, y: north ? anchorY - h : anchorY, w, h });
  };
  const onUp = () => { drag.current = null; };

  const onKey = (e: KeyboardEvent) => {
    const step = (e.shiftKey ? 10 : 1) / view.scale;
    const move: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (!move[e.key]) return;
    e.preventDefault();
    setCrop((c) => clamp({ ...c, x: c.x + move[e.key][0], y: c.y + move[e.key][1] }));
  };

  const type: OutputType = image?.type === 'image/png' ? 'image/png' : image?.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
  const rounded = { x: Math.round(crop.x), y: Math.round(crop.y), w: Math.round(crop.w), h: Math.round(crop.h) };
  const make = async () => {
    if (!image) return null;
    const res = await runImageJob(image.file, { kind: 'transform', type, quality: 0.92, transform: { width: rounded.w, height: rounded.h, crop: rounded, rotate, flipX, flipY } });
    return res.blob;
  };
  useToolActions({});

  if (!image) {
    return (
      <>
        <FileDrop accept={IMAGE_ACCEPT} onFiles={open} title="Drop an image to crop" />
        {error && <Notice tone="error">{error}</Notice>}
      </>
    );
  }

  const box = { left: crop.x * view.scale, top: crop.y * view.scale, width: crop.w * view.scale, height: crop.h * view.scale };

  return (
    <div className="stack">
      <div className="card stack">
        <ImageInfo image={image} onClear={clear} />
        <div className="options-row">
          <Segmented label="Aspect ratio" value={ratio} onChange={chooseRatio} options={RATIOS} wrap />
          <div className="button-row">
            <Button size="sm" onClick={() => turn(-1)} aria-label="Rotate left">↺ Rotate</Button>
            <Button size="sm" onClick={() => turn(1)} aria-label="Rotate right">↻</Button>
            <Button size="sm" onClick={() => setFlipX((f) => !f)} aria-pressed={flipX}>⇋ Flip</Button>
            <Button size="sm" onClick={() => setFlipY((f) => !f)} aria-pressed={flipY} aria-label="Flip vertically">⇅</Button>
          </div>
        </div>
      </div>
      <div ref={stage} className="crop-stage" onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <div className="crop-canvas-wrap" style={{ width: view.w, height: view.h }}>
          <canvas ref={canvas} className="crop-canvas" />
          {view.w > 0 && (
            <div
              className="crop-box"
              style={box}
              tabIndex={0}
              role="group"
              aria-label={`Crop area ${rounded.w} by ${rounded.h} pixels. Arrow keys move it.`}
              onPointerDown={(e) => onDown(e, 'move')}
              onKeyDown={onKey}
            >
              <span className="crop-thirds" aria-hidden="true" />
              {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => (
                <span key={corner} className={`crop-handle crop-${corner}`} onPointerDown={(e) => onDown(e, corner)} aria-hidden="true" />
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="crop-foot">
        <p className="result-caption">{number(rounded.w, 0)} × {number(rounded.h, 0)} px</p>
        <div className="button-row">
          <Button variant="ghost" onClick={() => setCrop(fullCrop(r))}>Reset crop</Button>
          <ExportButton size="lg" label="Download cropped image" filename={renamed(image.name, 'cropped', extFor(type))} make={make} />
        </div>
      </div>
    </div>
  );
}
