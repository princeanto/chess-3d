'use client';

/**
 * The tile you draw in. It shows its own wrap-around — a line off the right
 * edge reappears on the left as you draw it — so what joins in the pattern is
 * visible in the square itself.
 */

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import styles from './tile.module.css';
import { BRUSHES, BRUSH_DEFAULTS, constrain, farEnough, finish, isEmptyShape, isShape, type Brush, type Stroke } from '@/lib/draw';
import { clear, fit, paintStroke, unitScale, type View } from '@/lib/drawRender';
import { REPEATS, wrapStrokes, type RepeatMode, type TileSpec } from '@/lib/tile';
import { readableOn } from '@/lib/color';
import { load, save } from '@/lib/storage';
import { Segmented, Slider } from '@/components/ui';
import { PickOne } from '../ColorChips';
import { BrushIcon, ClearIcon, UndoIcon } from '../draw/icons';

interface Active { stroke: Stroke; pointer: number; start: [number, number] }

export default function TileEditor({ tile, background, colors, onChange, onUndo }: {
  tile: TileSpec;
  background: string;
  colors: readonly string[];
  onChange: (tile: TileSpec) => void;
  onUndo: () => void;
}) {
  const [brush, setBrush] = useState<Brush>(() => load<Brush>('shape.tileBrush', 'marker'));
  const [sizes, setSizes] = useState<Record<string, number>>(() => load('shape.tileSizes', { pencil: 24, marker: 60, eraser: 90, line: 50, rect: 50, circle: 50 }));
  const [color, setColor] = useState<string>(() => colors[0] ?? '#111111');
  const [view, setView] = useState<View | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const scratch = useRef<HTMLCanvasElement | null>(null);
  const active = useRef<Active | null>(null);
  const frame = useRef(0);
  const size = sizes[brush] ?? BRUSH_DEFAULTS[brush].size;
  const guide = readableOn(background, ['#111111', '#FFFFFF']);

  useEffect(() => { save('shape.tileBrush', brush); }, [brush]);
  useEffect(() => { save('shape.tileSizes', sizes); }, [sizes]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const next = { w: Math.round(r.width), h: Math.round(r.height), dpr: Math.min(2, window.devicePixelRatio || 1) };
      setView((v) => (v && v.w === next.w && v.h === next.h ? v : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const paint = () => {
    frame.current = 0;
    const ctx = canvas.current?.getContext('2d');
    if (!ctx || !view) return;
    scratch.current ??= document.createElement('canvas');
    fit(canvas.current!, view);
    clear(ctx);
    const strokes = active.current ? [...tile.strokes, active.current.stroke] : tile.strokes;
    for (const stroke of wrapStrokes(strokes)) paintStroke(ctx, scratch.current, stroke, view);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(paint, [tile.strokes, view]);

  const toTile = (e: { clientX: number; clientY: number }): [number, number] => {
    const r = box.current!.getBoundingClientRect();
    const k = unitScale({ w: r.width, h: r.height });
    return [(e.clientX - r.left - r.width / 2) / k, (e.clientY - r.top - r.height / 2) / k];
  };
  const schedule = () => { if (!frame.current) frame.current = requestAnimationFrame(paint); };

  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (active.current || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const [x, y] = toTile(e);
    const stroke: Stroke = { b: brush, c: color, s: size, o: BRUSH_DEFAULTS[brush].opacity, p: isShape(brush) ? [x, y, x, y] : [x, y], y: 'n' };
    if (brush === 'pencil' && e.pointerType === 'pen') stroke.w = [e.pressure];
    active.current = { stroke, pointer: e.pointerId, start: [x, y] };
    schedule();
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const a = active.current;
    if (!a || a.pointer !== e.pointerId || !view) return;
    const samples = e.nativeEvent.getCoalescedEvents?.() ?? [];
    const list = samples.length ? samples : [e.nativeEvent];
    if (isShape(a.stroke.b)) {
      const [x, y] = toTile(list[list.length - 1]);
      a.stroke.p = constrain(a.stroke.b, a.start[0], a.start[1], x, y, { shift: e.shiftKey, alt: e.altKey });
    } else {
      for (const sample of list) {
        const [x, y] = toTile(sample);
        if (!farEnough(a.stroke.p, x, y, 0.75 / unitScale(view))) continue;
        a.stroke.p.push(x, y);
        a.stroke.w?.push(sample.pressure);
      }
    }
    schedule();
  };
  const up = (e: ReactPointerEvent<HTMLDivElement>, keep: boolean) => {
    const a = active.current;
    if (!a || a.pointer !== e.pointerId || !view) return;
    active.current = null;
    if (!keep || isEmptyShape(a.stroke, 2 / unitScale(view))) { schedule(); return; }
    onChange({ ...tile, strokes: [...tile.strokes, finish(a.stroke)] });
  };

  const tools = BRUSHES.filter((b) => b.id !== 'eraser').concat(BRUSHES.filter((b) => b.id === 'eraser'));

  return (
    <div className={styles.editor}>
      <div className={styles.bar}>
        <div className={styles.brushes} role="radiogroup" aria-label="Tile brush">
          {tools.map((b) => (
            <button key={b.id} type="button" role="radio" aria-checked={brush === b.id} aria-label={b.label} title={b.label} className={styles.brush} onClick={() => setBrush(b.id)} onPointerUp={(e) => e.currentTarget.blur()}>
              <BrushIcon brush={b.id} />
            </button>
          ))}
        </div>
        <div className={styles.brushes}>
          <button type="button" className={styles.brush} aria-label="Undo" title="Undo" onClick={onUndo}><UndoIcon /></button>
          <button type="button" className={styles.brush} aria-label="Clear tile" title="Clear tile" onClick={() => onChange({ ...tile, strokes: [] })}><ClearIcon /></button>
        </div>
      </div>
      <div
        ref={box}
        className={styles.tile}
        style={{ background, color: guide }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={(e) => up(e, true)}
        onPointerCancel={(e) => up(e, false)}
        role="img"
        aria-label={`Tile with ${tile.strokes.length} strokes. Draw here; it repeats across the pattern.`}
      >
        <canvas ref={canvas} className={styles.canvas} />
        {tile.strokes.length === 0 && <p className={styles.empty}>Draw here. It repeats.</p>}
      </div>
      <Slider label="Brush size" min={4} max={200} value={size} onChange={(v) => setSizes((all) => ({ ...all, [brush]: v }))} />
      {brush !== 'eraser' && <PickOne label="Tile colour" options={colors} value={color} onChange={(hex) => setColor(hex)} />}
      <div className={styles.scroll}>
        <Segmented<RepeatMode> label="Repeat" value={tile.repeat} onChange={(repeat) => onChange({ ...tile, repeat })} options={REPEATS} />
      </div>
    </div>
  );
}
