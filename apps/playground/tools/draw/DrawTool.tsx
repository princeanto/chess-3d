'use client';

/**
 * DRAW: a canvas for mouse, trackpad, finger and stylus.
 *
 * Three layers: the ink, the stroke being drawn, and the guides (grid and
 * symmetry axes), which are never exported. The drawing itself is a list of
 * strokes, repainted whenever the canvas changes size — resizing the window
 * redraws it, it does not crop or smear it.
 */

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import styles from '../studio.module.css';
import draw from './draw.module.css';
import { Button, Menu, Segmented, Slider } from '@/components/ui';
import { useStore, useToolActions, type Command } from '@/lib/store';
import { useHistory } from '@/lib/history';
import { load, save } from '@/lib/storage';
import { getDoc, setDoc, deleteDoc } from '@/lib/idb';
import { newId } from '@/lib/saved';
import { readableOn } from '@/lib/color';
import { canvasToBlob, downloadBlob, downloadText, fileName } from '@/lib/export';
import { isEditable, modLabel } from '@/lib/shortcuts';
import {
  BRUSHES, BRUSH_DEFAULTS, EMPTY_DOC, GRID_STEP, INK, PAPER, SEGMENTS, UNITS, colorsUsed, constrain, docSvg, farEnough,
  finish, groundColor, isEmptyShape, isShape, symmetryCode, validDoc,
  type Brush, type BrushSettings, type DrawDoc, type Ground, type GridSize, type Stroke, type Symmetry, type SymmetryMode,
} from '@/lib/draw';
import { clear, fit, paintAll, paintStroke, renderDoc, unitScale, type View } from '@/lib/drawRender';
import { createRng, newSeed } from '@/lib/random';
import { PickOne } from '../ColorChips';
import SavedStrip from '../SavedStrip';
import { BrushIcon, ClearIcon, RedoIcon, UndoIcon } from './icons';

const CURRENT = 'draw.current';
const FULL = 'Storage is full. Download a backup from Saved, then delete a few.';

interface Active {
  stroke: Stroke;
  pointer: number;
  start: [number, number];
}

const stamp = () => new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');

export default function DrawTool() {
  const store = useStore();
  const { state: doc, set, undo, redo, reset } = useHistory<DrawDoc>(() => EMPTY_DOC);
  const [loaded, setLoaded] = useState(false);
  const [brush, setBrush] = useState<Brush>(() => load<Brush>('draw.brush', 'pencil'));
  const [settings, setSettings] = useState<Record<Brush, BrushSettings>>(() => ({ ...BRUSH_DEFAULTS, ...load<Partial<Record<Brush, BrushSettings>>>('draw.settings', {}) }));
  const [color, setColor] = useState<string>(() => load<string>('draw.color', INK));
  const [grid, setGrid] = useState<{ on: boolean; size: GridSize }>(() => load('draw.grid', { on: false, size: 'medium' as GridSize }));
  const [symmetry, setSymmetry] = useState<Symmetry>(() => load<Symmetry>('draw.symmetry', { mode: 'none', segments: 6 }));
  const [view, setView] = useState<View | null>(null);

  const wrap = useRef<HTMLDivElement>(null);
  const inkCanvas = useRef<HTMLCanvasElement>(null);
  const liveCanvas = useRef<HTMLCanvasElement>(null);
  const guideCanvas = useRef<HTMLCanvasElement>(null);
  const cursor = useRef<HTMLDivElement>(null);
  const scratch = useRef<HTMLCanvasElement | null>(null);
  const snapshot = useRef<HTMLCanvasElement | null>(null);
  const active = useRef<Active | null>(null);
  const frame = useRef(0);
  const painted = useRef<{ strokes: Stroke[]; view: View } | null>(null);
  const penSeen = useRef(false);
  const warnedFull = useRef(false);

  const { size, opacity } = settings[brush];
  const ground = groundColor(doc);
  const guideInk = readableOn(ground ?? PAPER, ['#111111', '#FFFFFF']);

  useEffect(() => { save('draw.brush', brush); }, [brush]);
  useEffect(() => { save('draw.settings', settings); }, [settings]);
  useEffect(() => { save('draw.color', color); }, [color]);
  useEffect(() => { save('draw.grid', grid); }, [grid]);
  useEffect(() => { save('draw.symmetry', symmetry); }, [symmetry]);

  /* Load the drawing in progress, then whatever was opened from Saved. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const current = await getDoc<DrawDoc>(CURRENT);
      if (cancelled) return;
      if (validDoc(current)) reset(current);
      const pending = store.takePending('draw');
      if (pending?.doc) {
        const opened = await getDoc<DrawDoc>(pending.doc);
        if (cancelled) return;
        if (validDoc(opened)) {
          // Undoable: the drawing that was here is one ⌘Z away.
          set(opened);
          store.toast(`Opened ${pending.name ?? 'drawing'}. ${modLabel()}Z brings back what was here.`);
        } else {
          store.toast('That drawing couldn’t be found on this device.');
        }
      }
      setLoaded(true);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Keep the drawing in progress, a moment after each change. */
  useEffect(() => {
    if (!loaded) return;
    const timer = window.setTimeout(() => {
      setDoc(CURRENT, doc).then((ok) => {
        if (!ok && !warnedFull.current) {
          warnedFull.current = true;
          store.toast('This drawing is too big to keep in the browser. Export it to be safe.');
        }
      });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [doc, loaded, store]);

  /* The canvas follows its box. */
  useEffect(() => {
    const box = wrap.current;
    if (!box) return;
    const measure = () => {
      const rect = box.getBoundingClientRect();
      const next = { w: Math.round(rect.width), h: Math.round(rect.height), dpr: Math.min(2, window.devicePixelRatio || 1) };
      setView((v) => (v && v.w === next.w && v.h === next.h && v.dpr === next.dpr ? v : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  /* Ink: only the new stroke when one was added, everything otherwise. */
  useEffect(() => {
    const canvas = inkCanvas.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !view) return;
    scratch.current ??= document.createElement('canvas');
    const resized = fit(canvas, view);
    if (liveCanvas.current) fit(liveCanvas.current, view);
    const before = painted.current;
    const strokes = doc.strokes;
    const appended = !resized && before && before.view === view && strokes.length === before.strokes.length + 1
      && strokes.slice(0, -1).every((s, i) => s === before.strokes[i]);
    if (appended) paintStroke(ctx, scratch.current, strokes[strokes.length - 1], view);
    else paintAll(ctx, scratch.current, strokes, view);
    painted.current = { strokes, view };
  }, [doc.strokes, view]);

  /* Guides: the grid and the symmetry axes. Never exported. */
  useEffect(() => {
    const canvas = guideCanvas.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !view) return;
    fit(canvas, view);
    clear(ctx);
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    const cx = view.w / 2;
    const cy = view.h / 2;
    const k = unitScale(view);
    ctx.strokeStyle = guideInk;
    ctx.lineWidth = 1 / view.dpr;
    if (grid.on) {
      const step = GRID_STEP[grid.size] * k;
      ctx.globalAlpha = 0.13;
      ctx.beginPath();
      for (let x = cx % step; x <= view.w; x += step) { ctx.moveTo(Math.round(x * view.dpr) / view.dpr, 0); ctx.lineTo(Math.round(x * view.dpr) / view.dpr, view.h); }
      for (let y = cy % step; y <= view.h; y += step) { ctx.moveTo(0, Math.round(y * view.dpr) / view.dpr); ctx.lineTo(view.w, Math.round(y * view.dpr) / view.dpr); }
      ctx.stroke();
    }
    if (symmetry.mode !== 'none') {
      ctx.globalAlpha = 0.35;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      if (symmetry.mode === 'vertical') { ctx.moveTo(cx, 0); ctx.lineTo(cx, view.h); }
      else if (symmetry.mode === 'horizontal') { ctx.moveTo(0, cy); ctx.lineTo(view.w, cy); }
      else {
        const reach = Math.hypot(view.w, view.h);
        for (let i = 0; i < symmetry.segments; i += 1) {
          const t = (i * 2 * Math.PI) / symmetry.segments - Math.PI / 2 + Math.PI / symmetry.segments;
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(t) * reach, cy + Math.sin(t) * reach);
        }
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.globalAlpha = 1;
  }, [view, grid, symmetry, guideInk]);

  /* ------------------------------ drawing ------------------------------ */

  const render = useCallback(() => {
    frame.current = 0;
    const live = liveCanvas.current?.getContext('2d');
    const ink = inkCanvas.current?.getContext('2d');
    if (!live || !ink || !view || !scratch.current) return;
    clear(live);
    const a = active.current;
    if (!a) return;
    if (a.stroke.b === 'eraser') {
      // The eraser works on the ink itself, from a copy taken at pen-down.
      clear(ink);
      if (snapshot.current) ink.drawImage(snapshot.current, 0, 0);
      paintStroke(ink, scratch.current, a.stroke, view);
    } else {
      paintStroke(live, scratch.current, a.stroke, view);
    }
  }, [view]);

  const schedule = () => {
    if (!frame.current) frame.current = requestAnimationFrame(render);
  };

  const toDoc = (e: { clientX: number; clientY: number }): [number, number] => {
    const rect = wrap.current!.getBoundingClientRect();
    const k = unitScale({ w: rect.width, h: rect.height });
    return [(e.clientX - rect.left - rect.width / 2) / k, (e.clientY - rect.top - rect.height / 2) / k];
  };

  const restoreSnapshot = () => {
    const ink = inkCanvas.current?.getContext('2d');
    if (ink && snapshot.current) {
      clear(ink);
      ink.drawImage(snapshot.current, 0, 0);
    }
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!loaded || !view) return;
    if (e.pointerType === 'pen') penSeen.current = true;
    // With a stylus in use, a resting palm is not a brush.
    if (e.pointerType === 'touch' && penSeen.current) return;
    if (active.current || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const [x, y] = toDoc(e);
    const stroke: Stroke = { b: brush, c: color, s: size, o: opacity, p: isShape(brush) ? [x, y, x, y] : [x, y], y: symmetryCode(symmetry) };
    if (brush === 'pencil' && e.pointerType === 'pen') stroke.w = [e.pressure];
    active.current = { stroke, pointer: e.pointerId, start: [x, y] };
    if (brush === 'eraser' && inkCanvas.current) {
      snapshot.current ??= document.createElement('canvas');
      snapshot.current.width = inkCanvas.current.width;
      snapshot.current.height = inkCanvas.current.height;
      const copy = snapshot.current.getContext('2d');
      copy?.clearRect(0, 0, snapshot.current.width, snapshot.current.height);
      copy?.drawImage(inkCanvas.current, 0, 0);
    }
    schedule();
  };

  const moveCursor = (e: ReactPointerEvent<HTMLDivElement>) => {
    const dot = cursor.current;
    const box = wrap.current;
    if (!dot || !box || !view) return;
    if (e.pointerType === 'touch') { dot.style.opacity = '0'; return; }
    const rect = box.getBoundingClientRect();
    const d = isShape(brush) ? 10 : Math.max(4, size * unitScale(view));
    dot.style.width = `${d}px`;
    dot.style.height = `${d}px`;
    dot.style.transform = `translate(${e.clientX - rect.left - d / 2}px, ${e.clientY - rect.top - d / 2}px)`;
    dot.style.opacity = '1';
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    moveCursor(e);
    const a = active.current;
    if (!a || a.pointer !== e.pointerId || !view) return;
    const minStep = 0.75 / unitScale(view);
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [];
    const samples = events.length ? events : [e.nativeEvent];
    if (isShape(a.stroke.b)) {
      const [x, y] = toDoc(samples[samples.length - 1]);
      a.stroke.p = constrain(a.stroke.b, a.start[0], a.start[1], x, y, { shift: e.shiftKey, alt: e.altKey });
    } else {
      for (const sample of samples) {
        const [x, y] = toDoc(sample);
        if (!farEnough(a.stroke.p, x, y, minStep)) continue;
        a.stroke.p.push(x, y);
        a.stroke.w?.push(sample.pressure);
      }
    }
    schedule();
  };

  const finishStroke = (e: ReactPointerEvent<HTMLDivElement>, keep: boolean) => {
    const a = active.current;
    if (!a || a.pointer !== e.pointerId || !view) return;
    active.current = null;
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = 0;
    const live = liveCanvas.current?.getContext('2d');
    if (live) clear(live);
    if (a.stroke.b === 'eraser') restoreSnapshot();
    if (!keep || isEmptyShape(a.stroke, 2 / unitScale(view))) return;
    const stroke = finish(a.stroke);
    set((d) => ({ ...d, strokes: [...d.strokes, stroke] }));
  };

  /* ------------------------------ actions ------------------------------ */

  const changeSetting = (key: keyof BrushSettings, value: number) =>
    setSettings((all) => ({ ...all, [brush]: { ...all[brush], [key]: value } }));

  const clearCanvas = () => {
    if (doc.strokes.length === 0) {
      store.toast('Already blank');
      return;
    }
    set((d) => ({ ...d, strokes: [] }));
    store.toast(`Cleared. ${modLabel()}Z brings it back.`);
  };

  const setGround = (next: Partial<Pick<DrawDoc, 'ground' | 'groundColor'>>, tag?: string) => set((d) => ({ ...d, ...next }), tag);

  const exportBox = () => {
    const k = view ? unitScale(view) : 1;
    const w = (view?.w ?? UNITS) / k;
    const h = (view?.h ?? UNITS) / k;
    return { x: -w / 2, y: -h / 2, w, h };
  };

  const remember = () => store.remember({ tool: 'draw', kind: 'Drawing', colors: colorsUsed(doc), recipe: {} });

  const exportAs = async (format: 'png' | 'svg') => {
    if (!view) return;
    if (doc.strokes.length === 0) {
      store.toast('Draw something first');
      return;
    }
    let ok = false;
    if (format === 'png') {
      const canvas = renderDoc(doc, { w: view.w, h: view.h, dpr: 2 });
      const blob = canvas ? await canvasToBlob(canvas) : null;
      ok = !!blob && downloadBlob(blob, fileName('draw', 'drawing', stamp(), 'png'));
    } else {
      ok = downloadText(docSvg(doc, exportBox(), view.w), fileName('draw', 'drawing', stamp(), 'svg'), 'image/svg+xml');
    }
    store.toast(ok ? `Exported ${format.toUpperCase()}` : 'Couldn’t export that. Try again.');
    if (ok) remember();
  };

  const saveDrawing = async () => {
    if (!view) return;
    if (doc.strokes.length === 0) {
      store.toast('Draw something first');
      return;
    }
    const key = `saved:${newId()}`;
    if (!(await setDoc(key, doc))) {
      store.toast(FULL);
      return;
    }
    const scale = Math.min(1, 360 / view.w);
    const thumbCanvas = renderDoc(doc, { w: view.w * scale, h: view.h * scale, dpr: 1 });
    const thumb = thumbCanvas?.toDataURL('image/png');
    const result = store.saveItem({ tool: 'draw', kind: 'Drawing', colors: colorsUsed(doc), recipe: { strokes: doc.strokes.length }, thumb, doc: key });
    if (!result) {
      deleteDoc(key);
      store.toast(FULL);
      return;
    }
    store.toast(`Saved as ${result.item.name}`);
    remember();
  };

  const randomColour = () => {
    const rng = createRng(newSeed());
    const choices = store.palette.filter((hex) => hex !== color && hex !== ground);
    const next = choices.length ? rng.pick(choices) : color;
    setColor(next);
    store.toast(`Brush colour ${next}`);
  };

  /* Brush keys, size and grid. Tool-switching letters stay with the shell. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isEditable(e.target) || store.commandOpen) return;
      const found = BRUSHES.find((b) => b.key === e.key);
      if (found) { setBrush(found.id); return; }
      if (e.key === '[' || e.key === ']') {
        const step = Math.max(1, Math.round(size * 0.15));
        changeSetting('size', Math.max(1, Math.min(120, size + (e.key === ']' ? step : -step))));
        return;
      }
      if (e.key.toLowerCase() === 'g') setGrid((g) => ({ ...g, on: !g.on }));
      if (e.key === 'Escape' && active.current) {
        active.current = null;
        const live = liveCanvas.current?.getContext('2d');
        if (live) clear(live);
        restoreSnapshot();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brush, size, store.commandOpen]);

  const commands: Command[] = [
    ...BRUSHES.map((b) => ({ id: `d-${b.id}`, label: `Brush: ${b.label}`, group: 'Draw', hint: b.key, run: () => setBrush(b.id) })),
    { id: 'd-grid', label: grid.on ? 'Hide grid' : 'Show grid', group: 'Draw', hint: 'G', run: () => setGrid((g) => ({ ...g, on: !g.on })) },
    { id: 'd-sym-none', label: 'Symmetry: None', group: 'Draw', run: () => setSymmetry((s) => ({ ...s, mode: 'none' })) },
    { id: 'd-sym-v', label: 'Symmetry: Vertical', group: 'Draw', run: () => setSymmetry((s) => ({ ...s, mode: 'vertical' })) },
    { id: 'd-sym-h', label: 'Symmetry: Horizontal', group: 'Draw', run: () => setSymmetry((s) => ({ ...s, mode: 'horizontal' })) },
    ...SEGMENTS.map((n) => ({ id: `d-sym-r${n}`, label: `Symmetry: Radial ${n}`, group: 'Draw', run: () => setSymmetry({ mode: 'radial' as SymmetryMode, segments: n }) })),
    { id: 'd-color', label: 'Random brush colour from palette', group: 'Draw', hint: 'Space', run: randomColour },
    { id: 'd-save', label: 'Save drawing', group: 'Draw', hint: '⌘S', run: saveDrawing },
    { id: 'd-png', label: 'Export drawing as PNG', group: 'Draw', hint: 'E', run: () => exportAs('png') },
    { id: 'd-svg', label: 'Export drawing as SVG', group: 'Draw', run: () => exportAs('svg') },
  ];

  useToolActions({
    randomize: randomColour,
    exportDefault: () => exportAs('png'),
    save: saveDrawing,
    undo: () => { if (!undo()) store.toast('Nothing to undo'); },
    redo: () => { if (!redo()) store.toast('Nothing to redo'); },
    clear: clearCanvas,
    commands,
  });

  const inks = [INK, PAPER, ...store.palette];

  return (
    <div className={styles.studio}>
      <div className={styles.panel}>
        <div className={styles.group}>
          <p className={styles.label}>{BRUSHES.find((b) => b.id === brush)?.label}</p>
          <Slider label="Size" min={1} max={120} value={size} onChange={(v) => changeSetting('size', v)} />
          <Slider label="Opacity" min={5} max={100} value={Math.round(opacity * 100)} format={(v) => `${v}%`} onChange={(v) => changeSetting('opacity', v / 100)} />
        </div>

        {brush !== 'eraser' && (
          <div className={styles.group}>
            <p className={styles.label}>Colour</p>
            <PickOne label="Brush colour" options={inks} value={color} onChange={(hex) => setColor(hex)} />
          </div>
        )}

        <div className={styles.group}>
          <p className={styles.label}>Background</p>
          <div className={styles.scroll}>
            <Segmented<Ground>
              label="Background"
              value={doc.ground}
              onChange={(g) => setGround({ ground: g })}
              options={[{ id: 'light', label: 'Light' }, { id: 'dark', label: 'Dark' }, { id: 'color', label: 'Colour' }, { id: 'transparent', label: 'None' }]}
            />
          </div>
          {doc.ground === 'color' && (
            <PickOne label="Background colour" options={store.palette} value={doc.groundColor} onChange={(hex, tag) => setGround({ groundColor: hex }, tag)} />
          )}
        </div>

        <div className={styles.group}>
          <div className={styles.labelRow}>
            <p className={styles.label}>Grid</p>
            <Button variant={grid.on ? 'solid' : 'ghost'} aria-pressed={grid.on} onClick={() => setGrid((g) => ({ ...g, on: !g.on }))}>
              {grid.on ? 'On' : 'Off'}
            </Button>
          </div>
          <Segmented<GridSize>
            label="Grid size"
            value={grid.size}
            onChange={(sizeName) => setGrid({ on: true, size: sizeName })}
            options={[{ id: 'small', label: 'Small' }, { id: 'medium', label: 'Medium' }, { id: 'large', label: 'Large' }]}
          />
        </div>

        <div className={styles.group}>
          <p className={styles.label}>Symmetry</p>
          <div className={draw.symmetry} role="radiogroup" aria-label="Symmetry">
            {([['none', 'None'], ['vertical', 'Vertical'], ['horizontal', 'Horizontal'], ['radial', 'Radial']] as [SymmetryMode, string][]).map(([mode, label]) => (
              <Button
                key={mode}
                role="radio"
                aria-checked={symmetry.mode === mode}
                variant={symmetry.mode === mode ? 'solid' : 'line'}
                onClick={() => setSymmetry((s) => ({ ...s, mode }))}
              >
                {label}
              </Button>
            ))}
          </div>
          {symmetry.mode === 'radial' && (
            <Segmented
              label="Segments"
              compact
              value={String(symmetry.segments)}
              onChange={(n) => setSymmetry({ mode: 'radial', segments: Number(n) })}
              options={SEGMENTS.map((n) => ({ id: String(n), label: String(n) }))}
            />
          )}
        </div>
      </div>

      <div className={`${styles.stage} ${draw.stage}`}>
        <div className={draw.toolbar}>
          <div className={draw.brushes} role="radiogroup" aria-label="Brush">
            {BRUSHES.map((b) => (
              <button
                key={b.id}
                type="button"
                role="radio"
                aria-checked={brush === b.id}
                className={draw.brush}
                title={`${b.label} (${b.key})`}
                aria-label={b.label}
                onClick={() => setBrush(b.id)}
                onPointerUp={(e) => e.currentTarget.blur()}
              >
                <BrushIcon brush={b.id} />
              </button>
            ))}
          </div>
          <div className={draw.history}>
            <button type="button" className={draw.brush} title={`Undo (${modLabel()}Z)`} aria-label="Undo" onClick={() => { if (!undo()) store.toast('Nothing to undo'); }}><UndoIcon /></button>
            <button type="button" className={draw.brush} title={`Redo (⇧${modLabel()}Z)`} aria-label="Redo" onClick={() => { if (!redo()) store.toast('Nothing to redo'); }}><RedoIcon /></button>
            <button type="button" className={draw.brush} title="Clear" aria-label="Clear" onClick={clearCanvas}><ClearIcon /></button>
          </div>
          <div className={draw.end}>
            <Button onClick={saveDrawing}>Save</Button>
            <Menu
              label="Export"
              variant="line"
              items={[
                { label: 'PNG', hint: view ? `${view.w * 2} × ${view.h * 2}` : 'Image', run: () => exportAs('png') },
                { label: 'SVG', hint: 'Vector', run: () => exportAs('svg') },
              ]}
            />
          </div>
        </div>

        <div
          ref={wrap}
          className={`${draw.canvas} ${ground ? '' : styles.transparent}`}
          style={{ background: ground ?? undefined, cursor: isShape(brush) ? 'crosshair' : 'none' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => finishStroke(e, true)}
          onPointerCancel={(e) => finishStroke(e, false)}
          onPointerLeave={() => { if (cursor.current) cursor.current.style.opacity = '0'; }}
          role="img"
          aria-label={`Drawing canvas, ${doc.strokes.length} ${doc.strokes.length === 1 ? 'stroke' : 'strokes'}`}
        >
          <canvas ref={inkCanvas} className={draw.layer} />
          <canvas ref={liveCanvas} className={draw.layer} />
          <canvas ref={guideCanvas} className={draw.layer} />
          <div ref={cursor} className={draw.cursor} style={{ borderColor: guideInk }} aria-hidden="true" />
          {loaded && doc.strokes.length === 0 && <p className={draw.blank} style={{ color: guideInk }}>Blank canvas. Your move.</p>}
        </div>

        <p className={styles.hint}>
          <b>1–6</b> brushes · <b>[ ]</b> size · <b>G</b> grid · <b>Shift</b> straight lines, squares, circles · <b>{modLabel()}Z</b> undo
        </p>
        <SavedStrip tool="draw" />
      </div>
    </div>
  );
}
