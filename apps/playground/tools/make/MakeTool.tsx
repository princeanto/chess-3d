'use client';

/**
 * MAKE: quick posters. Not a design suite — a template, your words, a shape or
 * two, and a Surprise me that has taste.
 *
 * Everything on the poster can be dragged. A drag is an offset on top of the
 * layout, so Surprise me and the layout buttons still work afterwards, and the
 * centre lines pull things into line as they pass.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import styles from '../studio.module.css';
import make from './make.module.css';
import { Button, Menu, Segmented, Slider } from '@/components/ui';
import { useStore, useToolActions, type Command } from '@/lib/store';
import { useHistory } from '@/lib/history';
import { load, save } from '@/lib/storage';
import { contrast } from '@/lib/color';
import { createRng, newSeed } from '@/lib/random';
import { downloadBlob, downloadText, fileName } from '@/lib/export';
import { svgToPng } from '@/lib/render';
import { isEditable, modLabel } from '@/lib/shortcuts';
import { FONTS, embeddedFontCss, ensureFont, fontById, nearestWeight, usedGoogleFonts, googleFontId } from '@/lib/fonts';
import { applyCase, DARK, LIGHT, type Align, type Case } from '@/lib/typeset';
import {
  FORMATS, LAYOUTS, MAX_SHAPES, SHAPE_KINDS, TEMPLATES, applyTemplate, approxMeasure, isDark, layoutPoster, makeShape,
  posterColours, posterSvg, shapeColours, shapeMarkup, surprise, templatePoster, validPoster,
  type FormatId, type LayoutId, type Placed, type Poster, type PosterShape, type ShapeKind, type TemplateId, type TextBlock,
} from '@/lib/poster';
import { PickOne } from '../ColorChips';
import SavedStrip from '../SavedStrip';
import SavedPalettes from '../SavedPalettes';
import { createMeasure } from './measure';

const DRAFT_LIMIT = 12;
type Selection = { kind: 'block' | 'shape'; id: string } | null;
interface Drafts { list: Poster[]; index: number }

const SNAP = 0.012;

export default function MakeTool() {
  const store = useStore();
  const [drafts, setDrafts] = useState<Drafts>(() => {
    const kept = load<Drafts | null>('make.drafts', null);
    if (kept && Array.isArray(kept.list) && kept.list.length && kept.list.every(validPoster)) {
      return { list: kept.list, index: Math.min(kept.index, kept.list.length - 1) };
    }
    return { list: [templatePoster('announcement', 'instagram', store.palette, createRng(newSeed()))], index: 0 };
  });
  const { state: poster, set, undo, redo, reset } = useHistory<Poster>(() => drafts.list[drafts.index]);
  const [selected, setSelected] = useState<Selection>(null);
  const [guides, setGuides] = useState<{ v: boolean; h: boolean }>({ v: false, h: false });
  const [fontsVersion, setFontsVersion] = useState(0);
  const [hovering, setHovering] = useState(false);
  const measure = useMemo(() => (typeof document === 'undefined' ? null : createMeasure()), []);
  const frame = useRef<HTMLDivElement>(null);
  const textareas = useRef(new Map<string, HTMLTextAreaElement>());
  const drag = useRef<{ kind: 'block' | 'shape'; id: string; pointer: number; startX: number; startY: number; ax: number; ay: number } | null>(null);

  const { w: W, h: H } = FORMATS[poster.format];
  const placed: Placed[] = useMemo(
    () => layoutPoster(poster, measure ?? approxMeasure),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [poster, fontsVersion, measure],
  );
  const svg = useMemo(() => posterSvg(poster, placed), [poster, placed]);

  /* The current draft is the poster; keep the list and storage in step. */
  useEffect(() => {
    setDrafts((d) => {
      if (d.list[d.index] === poster) return d;
      const next = { ...d, list: d.list.map((p, i) => (i === d.index ? poster : p)) };
      save('make.drafts', next);
      return next;
    });
  }, [poster]);

  /* Fonts first, then measure — and again whenever one finishes loading. */
  const fontKey = poster.blocks.map((b) => `${b.font}:${b.weight}:${b.italic}`).join('|');
  useEffect(() => {
    let cancelled = false;
    Promise.all(poster.blocks.map(async (b) => {
      const font = fontById(b.font);
      await ensureFont(font).catch(() => undefined);
      await document.fonts.load(`${b.italic && font.italic ? 'italic ' : ''}${nearestWeight(font, b.weight)} 100px '${font.family}'`).catch(() => undefined);
    })).then(() => {
      if (cancelled) return;
      measure?.reset();
      setFontsVersion((v) => v + 1);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontKey]);
  useEffect(() => {
    const onLoaded = () => { measure?.reset(); setFontsVersion((v) => v + 1); };
    document.fonts.addEventListener?.('loadingdone', onLoaded);
    return () => document.fonts.removeEventListener?.('loadingdone', onLoaded);
  }, [measure]);

  /* Opened from Saved or Recent: arrives as a new draft, so nothing is lost. */
  useEffect(() => {
    const pending = store.takePending('make');
    const incoming = (pending?.recipe as { poster?: Poster } | undefined)?.poster;
    if (!validPoster(incoming)) return;
    setDrafts((d) => {
      const list = [...d.list, incoming].slice(-DRAFT_LIMIT);
      const next = { list, index: list.length - 1 };
      save('make.drafts', next);
      return next;
    });
    reset(incoming);
    store.toast(`Opened ${pending?.name ?? 'poster'} as a new draft`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------------- editing ------------------------------- */

  const patch = (changes: Partial<Poster>, tag?: string) => set((p) => ({ ...p, ...changes }), tag);
  const patchBlock = (id: string, changes: Partial<TextBlock>, tag?: string) =>
    set((p) => ({ ...p, blocks: p.blocks.map((b) => (b.id === id ? { ...b, ...changes } : b)) }), tag);
  const patchShape = (id: string, changes: Partial<PosterShape>, tag?: string) =>
    set((p) => ({ ...p, shapes: p.shapes.map((s) => (s.id === id ? { ...s, ...changes } : s)) }), tag);

  const block = poster.blocks.find((b) => selected?.kind === 'block' && b.id === selected.id) ?? poster.blocks[0];
  const shape = poster.shapes.find((s) => selected?.kind === 'shape' && s.id === selected.id) ?? poster.shapes[0];
  const blockFont = fontById(block?.font ?? 'inter');
  const inks = shapeColours(store.palette, poster.background, poster.ink);

  const surpriseMe = useCallback(() => {
    set(surprise(poster, store.palette, createRng(newSeed()), measure ?? approxMeasure));
    setSelected(null);
  }, [poster, store.palette, measure, set]);

  const chooseTemplate = (id: TemplateId) => {
    set(applyTemplate(poster, id, store.palette, createRng(newSeed())));
    setSelected(null);
  };

  const addShape = (kind: ShapeKind = 'circle') => {
    if (poster.shapes.length >= MAX_SHAPES) {
      store.toast(`Three shapes is plenty. Remove one first.`);
      return;
    }
    const next = makeShape(kind, inks[poster.shapes.length % inks.length], { x: 0.5, y: 0.4, size: 0.5 });
    patch({ shapes: [...poster.shapes, next] });
    setSelected({ kind: 'shape', id: next.id });
  };
  const removeShape = (id: string) => {
    patch({ shapes: poster.shapes.filter((s) => s.id !== id) });
    setSelected(null);
  };
  const chooseShapeKind = (kind: ShapeKind | 'none') => {
    if (kind === 'none') { if (shape) removeShape(shape.id); return; }
    if (!shape) addShape(kind);
    else patchShape(shape.id, { kind });
  };

  /* ------------------------------- drafts ------------------------------- */

  const switchDraft = (index: number) => {
    const target = drafts.list[index];
    if (!target || index === drafts.index) return;
    const next = { ...drafts, index };
    setDrafts(next);
    save('make.drafts', next);
    reset(target);
    setSelected(null);
  };
  const duplicate = () => {
    if (drafts.list.length >= DRAFT_LIMIT) {
      store.toast(`${DRAFT_LIMIT} drafts is the limit. Delete one to make room.`);
      return;
    }
    const copy: Poster = JSON.parse(JSON.stringify(poster));
    const list = [...drafts.list.slice(0, drafts.index + 1), copy, ...drafts.list.slice(drafts.index + 1)];
    const next = { list, index: drafts.index + 1 };
    setDrafts(next);
    save('make.drafts', next);
    reset(copy);
    store.toast('Duplicated. Now try something different.');
  };
  const removeDraft = (index: number) => {
    if (drafts.list.length <= 1) return;
    const list = drafts.list.filter((_, i) => i !== index);
    const current = index === drafts.index ? Math.max(0, index - 1) : drafts.index > index ? drafts.index - 1 : drafts.index;
    const next = { list, index: current };
    setDrafts(next);
    save('make.drafts', next);
    if (index === drafts.index) reset(list[current]);
  };

  /* ------------------------------- export ------------------------------- */

  const slug = () => applyCase(poster.blocks[0]?.text ?? 'poster', 'lower').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 28) || 'poster';

  const fontCss = async (): Promise<string> => {
    const rules = new Set<string>();
    for (const b of poster.blocks) {
      if (!b.text.trim()) continue;
      const font = fontById(b.font);
      const css = await embeddedFontCss(font, b.italic, nearestWeight(font, b.weight), applyCase(b.text, b.textCase));
      rules.add(css);
    }
    return [...rules].join('');
  };

  const remember = () => store.remember({ tool: 'make', kind: 'Poster', colors: posterColours(poster), recipe: { poster } });

  const exportAs = async (format: 'png' | 'svg') => {
    let ok = false;
    try {
      const css = await fontCss();
      const name = fileName('make', poster.format, slug(), format);
      if (format === 'svg') ok = downloadText(posterSvg(poster, placed, { fontCss: css }), name, 'image/svg+xml');
      else {
        const blob = await svgToPng(posterSvg(poster, placed, { fontCss: css }), W, H);
        ok = !!blob && downloadBlob(blob, name);
      }
    } catch {
      ok = false;
    }
    store.toast(ok ? `Exported ${format.toUpperCase()} · ${W} × ${H}` : 'Couldn’t export that. Try again.');
    if (ok) remember();
  };

  const savePoster = () => {
    const result = store.saveItem({ tool: 'make', kind: 'Poster', colors: posterColours(poster), recipe: { poster, preview: svg } });
    store.toast(!result ? 'Storage is full. Download a backup from Saved, then delete a few.' : result.repeat ? `Already saved as ${result.item.name}` : `Saved as ${result.item.name}`);
    if (result) remember();
  };

  /* ---------------------------- drag and drop ---------------------------- */

  const toCanvas = (e: { clientX: number; clientY: number }) => {
    const r = frame.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  const hit = (x: number, y: number): Selection => {
    for (let i = placed.length - 1; i >= 0; i -= 1) {
      const { box, lines, id } = placed[i];
      const pad = Math.min(W, H) * 0.012;
      if (lines.length && x >= box.x - pad && x <= box.x + box.w + pad && y >= box.y - pad && y <= box.y + box.h + pad) return { kind: 'block', id };
    }
    for (let i = poster.shapes.length - 1; i >= 0; i -= 1) {
      const s = poster.shapes[i];
      if (Math.hypot(x - s.x * W, y - s.y * H) <= (s.size * Math.min(W, H)) / 2) return { kind: 'shape', id: s.id };
    }
    return null;
  };

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const { x, y } = toCanvas(e);
    const target = hit(x, y);
    setSelected(target);
    if (!target) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    if (target.kind === 'block') {
      const b = poster.blocks.find((k) => k.id === target.id)!;
      drag.current = { ...target, pointer: e.pointerId, startX: x, startY: y, ax: b.dx, ay: b.dy };
    } else {
      const s = poster.shapes.find((k) => k.id === target.id)!;
      drag.current = { ...target, pointer: e.pointerId, startX: x, startY: y, ax: s.x, ay: s.y };
    }
  };

  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const { x, y } = toCanvas(e);
    if (!d || d.pointer !== e.pointerId) {
      setHovering(!!hit(x, y));
      return;
    }
    let nx = d.ax + (x - d.startX) / W;
    let ny = d.ay + (y - d.startY) / H;
    let v = false;
    let h = false;
    if (d.kind === 'shape') {
      if (Math.abs(nx - 0.5) < SNAP) { nx = 0.5; v = true; }
      if (Math.abs(ny - 0.5) < SNAP) { ny = 0.5; h = true; }
      patchShape(d.id, { x: Math.round(nx * 1000) / 1000, y: Math.round(ny * 1000) / 1000 }, 'drag');
    } else {
      const pl = placed.find((k) => k.id === d.id)!;
      const b = poster.blocks.find((k) => k.id === d.id)!;
      // Where the block's centre would be, from its current box and the change in offset.
      const cx = (pl.box.x + pl.box.w / 2) / W + (nx - b.dx);
      const cy = (pl.box.y + pl.box.h / 2) / H + (ny - b.dy);
      if (Math.abs(cx - 0.5) < SNAP) { nx += 0.5 - cx; v = true; }
      if (Math.abs(cy - 0.5) < SNAP) { ny += 0.5 - cy; h = true; }
      patchBlock(d.id, { dx: Math.round(nx * 1000) / 1000, dy: Math.round(ny * 1000) / 1000 }, 'drag');
    }
    setGuides({ v, h });
  };

  const onUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointer !== e.pointerId) return;
    drag.current = null;
    setGuides({ v: false, h: false });
  };

  const onDouble = (e: React.MouseEvent<HTMLDivElement>) => {
    const { x, y } = toCanvas(e);
    const target = hit(x, y);
    if (target?.kind === 'block') {
      const area = textareas.current.get(target.id);
      area?.focus();
      area?.select();
    }
  };

  /* Arrows nudge, Delete removes a shape, Escape lets go. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selected || isEditable(e.target) || e.metaKey || e.ctrlKey || store.commandOpen) return;
      const step = e.shiftKey ? 0.05 : 0.005;
      const arrows: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (arrows[e.key]) {
        e.preventDefault();
        const [ddx, ddy] = arrows[e.key];
        if (selected.kind === 'shape') {
          const s = poster.shapes.find((k) => k.id === selected.id);
          if (s) patchShape(s.id, { x: s.x + ddx, y: s.y + ddy }, 'nudge');
        } else {
          const b = poster.blocks.find((k) => k.id === selected.id);
          if (b) patchBlock(b.id, { dx: b.dx + ddx, dy: b.dy + ddy }, 'nudge');
        }
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selected.kind === 'shape') {
        e.preventDefault();
        removeShape(selected.id);
      } else if (e.key === 'Escape') {
        setSelected(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, poster, store.commandOpen]);

  /* ------------------------------ shell ------------------------------ */

  const commands: Command[] = [
    { id: 'm-surprise', label: 'Surprise me', group: 'Make', hint: 'Space', run: surpriseMe },
    { id: 'm-duplicate', label: 'Duplicate poster', group: 'Make', run: duplicate },
    { id: 'm-save', label: 'Save poster', group: 'Make', hint: '⌘S', run: savePoster },
    { id: 'm-png', label: 'Export poster as PNG', group: 'Make', hint: 'E', run: () => exportAs('png') },
    { id: 'm-svg', label: 'Export poster as SVG', group: 'Make', run: () => exportAs('svg') },
    ...TEMPLATES.map((t) => ({ id: `m-t-${t.id}`, label: `Template: ${t.label}`, group: 'Make', run: () => chooseTemplate(t.id) })),
    ...(Object.keys(FORMATS) as FormatId[]).map((id) => ({ id: `m-f-${id}`, label: `Format: ${FORMATS[id].label}`, group: 'Make', run: () => patch({ format: id }) })),
  ];

  useToolActions({
    randomize: surpriseMe,
    exportDefault: () => exportAs('png'),
    save: savePoster,
    undo: () => { if (!undo()) store.toast('Nothing to undo'); },
    redo: () => { if (!redo()) store.toast('Nothing to redo'); },
    commands,
  });

  const selectedBox = selected?.kind === 'block' ? placed.find((p) => p.id === selected.id)?.box : undefined;
  const selectedShape = selected?.kind === 'shape' ? poster.shapes.find((s) => s.id === selected.id) : undefined;
  const outline = isDark(poster.background) ? '#FFFFFF' : '#111111';
  const ratio = contrast(poster.ink, poster.background);
  const googleFonts = usedGoogleFonts();
  const moved = poster.blocks.some((b) => b.dx || b.dy);

  return (
    <div className={styles.studio}>
      <div className={styles.panel}>
        <div className={styles.group}>
          <p className={styles.label}>Template</p>
          <div className={make.grid2}>
            {TEMPLATES.map((t) => (
              <Button key={t.id} variant={poster.template === t.id ? 'solid' : 'line'} onClick={() => chooseTemplate(t.id)}>{t.label}</Button>
            ))}
          </div>
        </div>

        <div className={styles.group}>
          <p className={styles.label}>Format</p>
          <div className={make.formats}>
            {(Object.keys(FORMATS) as FormatId[]).map((id) => (
              <button key={id} type="button" className={make.format} aria-pressed={poster.format === id} onClick={() => patch({ format: id })} onPointerUp={(e) => e.currentTarget.blur()}>
                <i style={{ aspectRatio: `${FORMATS[id].w} / ${FORMATS[id].h}` }} />
                <span>{FORMATS[id].label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.group}>
          <p className={styles.label}>Text</p>
          {poster.blocks.map((b) => (
            <label key={b.id} className={make.field}>
              <span>{b.label}</span>
              <textarea
                ref={(el) => { if (el) textareas.current.set(b.id, el); else textareas.current.delete(b.id); }}
                className={`${styles.textarea} ${make.text}`}
                rows={b.role === 'text' ? 3 : 2}
                value={b.text}
                spellCheck={false}
                onFocus={() => setSelected({ kind: 'block', id: b.id })}
                onChange={(e) => patchBlock(b.id, { text: e.target.value }, `text-${b.id}`)}
              />
            </label>
          ))}
        </div>

        {block && (
          <div className={styles.group}>
            <div className={styles.labelRow}>
              <p className={styles.label}>Type · {block.label}</p>
            </div>
            <select
              className={make.select}
              aria-label="Font"
              value={block.font}
              onChange={(e) => {
                const font = fontById(e.target.value);
                patchBlock(block.id, { font: e.target.value, weight: nearestWeight(font, block.weight), italic: block.italic && font.italic });
              }}
            >
              <optgroup label="Built in">
                {FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </optgroup>
              {googleFonts.length > 0 && (
                <optgroup label="Google Fonts you’ve used">
                  {googleFonts.map((g) => <option key={g.family} value={googleFontId(g.family)}>{g.family}</option>)}
                </optgroup>
              )}
            </select>
            <Slider label="Font size" min={8} max={Math.round(Math.min(W, H) * 0.5)} value={Math.round(block.size * Math.min(W, H))} format={(v) => `${v}px`} onChange={(v) => patchBlock(block.id, { size: v / Math.min(W, H), fit: false }, 'size')} />
            <Segmented
              label="Font weight"
              compact
              value={String(nearestWeight(blockFont, block.weight))}
              onChange={(v) => patchBlock(block.id, { weight: Number(v) })}
              options={blockFont.weights.map((wt) => ({ id: String(wt), label: String(wt) }))}
            />
            {blockFont.width && <Slider label="Width" min={blockFont.width.min} max={blockFont.width.max} value={block.stretch} format={(v) => `${v}%`} onChange={(v) => patchBlock(block.id, { stretch: v }, 'stretch')} />}
            <Segmented<Case> label="Case" compact value={block.textCase} onChange={(textCase) => patchBlock(block.id, { textCase })} options={[{ id: 'normal', label: 'Aa' }, { id: 'upper', label: 'AA' }, { id: 'lower', label: 'aa' }, { id: 'title', label: 'Title' }]} />
          </div>
        )}

        <div className={styles.group}>
          <p className={styles.label}>Layout</p>
          <Segmented<Align> label="Alignment" compact value={poster.align} onChange={(align) => patch({ align })} options={[{ id: 'left', label: 'Left' }, { id: 'center', label: 'Center' }, { id: 'right', label: 'Right' }]} />
          <Segmented<LayoutId> label="Position" compact value={poster.layout} onChange={(layout) => patch({ layout })} options={LAYOUTS} />
          <Slider label="Spacing" min={50} max={160} value={Math.round(poster.spacing * 100)} format={(v) => `${v}%`} onChange={(v) => patch({ spacing: v / 100 }, 'spacing')} />
          {moved && <Button variant="ghost" onClick={() => patch({ blocks: poster.blocks.map((b) => ({ ...b, dx: 0, dy: 0 })) })}>Put text back in line</Button>}
        </div>

        <div className={styles.group}>
          <p className={styles.label}>Background</p>
          <PickOne label="Background" options={[LIGHT, DARK, ...store.palette]} value={poster.background} onChange={(hex, tag) => patch({ background: hex }, tag)} />
          <div className={styles.labelRow}>
            <p className={styles.label}>Text colour</p>
            <span className={`${styles.contrast} ${ratio < 3 ? styles.contrastLow : ''}`}>
              {ratio.toFixed(1)}:1 {ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : ratio >= 3 ? 'Large only' : 'Hard to read'}
            </span>
          </div>
          <PickOne label="Text colour" options={[DARK, LIGHT, ...store.palette]} value={poster.ink} onChange={(hex, tag) => patch({ ink: hex }, tag)} />
          <SavedPalettes onPick={(hexes, name) => {
            const next = surprise({ ...poster }, hexes, createRng(newSeed()), measure ?? approxMeasure);
            patch({ background: next.background, ink: next.ink, shapes: poster.shapes.map((s, i) => ({ ...s, color: shapeColours(hexes, next.background, next.ink)[i % 3] ?? s.color })) });
            store.toast(`Colours from ${name}`);
          }} />
        </div>

        <div className={styles.group}>
          <div className={styles.labelRow}>
            <p className={styles.label}>Shape{poster.shapes.length > 1 ? ` · ${poster.shapes.findIndex((s) => s.id === shape?.id) + 1} of ${poster.shapes.length}` : ''}</p>
            {poster.shapes.length < MAX_SHAPES && <button type="button" className={`btn btn-ghost ${styles.note}`} onClick={() => addShape()}>Add shape</button>}
          </div>
          {poster.shapes.length > 1 && (
            <div className={styles.row}>
              {poster.shapes.map((s, i) => (
                <Button key={s.id} variant={s.id === shape?.id ? 'solid' : 'line'} onClick={() => setSelected({ kind: 'shape', id: s.id })}>Shape {i + 1}</Button>
              ))}
            </div>
          )}
          <div className={make.kinds} role="radiogroup" aria-label="Shape">
            <button type="button" role="radio" aria-checked={!shape} className={make.kind} onClick={() => chooseShapeKind('none')} title="No shape">
              <svg viewBox="-12 -12 24 24" aria-hidden="true"><path d="M-7 7L7 -7" stroke="currentColor" strokeWidth="1.6" /></svg>
            </button>
            {SHAPE_KINDS.map((k) => (
              <button key={k.id} type="button" role="radio" aria-checked={shape?.kind === k.id} className={make.kind} title={k.label} aria-label={k.label} onClick={() => chooseShapeKind(k.id)} onPointerUp={(e) => e.currentTarget.blur()}>
                <svg viewBox="-12 -12 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: shapeMarkup({ id: '', kind: k.id, x: 0, y: 0, size: 0.8, rotation: 0, color: 'currentColor', opacity: 1, seed: 7 }, 24, 24).replace('translate(0 0)', '') }} />
              </button>
            ))}
          </div>
          {shape && (
            <>
              <PickOne label="Shape colour" options={[...inks, poster.ink]} value={shape.color} onChange={(hex, tag) => patchShape(shape.id, { color: hex }, tag)} />
              <Slider label="Size" min={5} max={160} value={Math.round(shape.size * 100)} format={(v) => `${v}%`} onChange={(v) => patchShape(shape.id, { size: v / 100 }, 'shape-size')} />
              <Slider label="Opacity" min={5} max={100} value={Math.round(shape.opacity * 100)} format={(v) => `${v}%`} onChange={(v) => patchShape(shape.id, { opacity: v / 100 }, 'shape-opacity')} />
              <Slider label="Rotation" min={-180} max={180} value={Math.round(shape.rotation)} format={(v) => `${v}°`} onChange={(v) => patchShape(shape.id, { rotation: v }, 'shape-rotation')} />
              <Slider label="Across" min={-20} max={120} value={Math.round(shape.x * 100)} format={(v) => `${v}%`} onChange={(v) => patchShape(shape.id, { x: v / 100 }, 'shape-x')} />
              <Slider label="Down" min={-20} max={120} value={Math.round(shape.y * 100)} format={(v) => `${v}%`} onChange={(v) => patchShape(shape.id, { y: v / 100 }, 'shape-y')} />
            </>
          )}
        </div>
      </div>

      <div className={styles.stage}>
        <div className={styles.bar}>
          <Button variant="solid" className={make.surprise} onClick={surpriseMe}>Surprise me</Button>
          <Button onClick={duplicate}>Duplicate</Button>
          <Button onClick={savePoster}>Save</Button>
          <Menu
            label="Export"
            variant="line"
            items={[
              { label: 'PNG', hint: `${W} × ${H}`, run: () => exportAs('png') },
              { label: 'SVG', hint: 'Fonts included', run: () => exportAs('svg') },
            ]}
          />
        </div>

        <div
          ref={frame}
          className={`${styles.frame} ${make.frame}`}
          style={{ ['--ar' as string]: W / H, cursor: drag.current ? 'grabbing' : hovering ? 'grab' : 'default' }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onDoubleClick={onDouble}
          role="img"
          aria-label={`Poster: ${poster.blocks.map((b) => b.text).join('. ')}`}
        >
          <div className={make.art} dangerouslySetInnerHTML={{ __html: svg }} />
          {guides.v && <i className={make.guideV} style={{ background: outline }} />}
          {guides.h && <i className={make.guideH} style={{ background: outline }} />}
          {selectedBox && (
            <i className={make.selection} style={{
              left: `${(selectedBox.x / W) * 100}%`, top: `${(selectedBox.y / H) * 100}%`,
              width: `${(selectedBox.w / W) * 100}%`, height: `${(selectedBox.h / H) * 100}%`, borderColor: outline,
            }} />
          )}
          {selectedShape && (
            <i className={`${make.selection} ${make.round}`} style={{
              left: `${((selectedShape.x * W - (selectedShape.size * Math.min(W, H)) / 2) / W) * 100}%`,
              top: `${((selectedShape.y * H - (selectedShape.size * Math.min(W, H)) / 2) / H) * 100}%`,
              width: `${((selectedShape.size * Math.min(W, H)) / W) * 100}%`, height: `${((selectedShape.size * Math.min(W, H)) / H) * 100}%`, borderColor: outline,
            }} />
          )}
        </div>

        <p className={styles.hint}>
          <b>Drag</b> anything · <b>Double-click</b> text to edit · <b>Arrows</b> nudge · <b>Space</b> surprises you · <b>{modLabel()}Z</b> undo
        </p>

        {drafts.list.length > 1 && (
          <section aria-label="Drafts" className={make.drafts}>
            <p className={styles.label}>Drafts</p>
            <ul>
              {drafts.list.map((draft, i) => (
                <li key={i} className={make.draft}>
                  <button
                    type="button"
                    aria-pressed={i === drafts.index}
                    aria-label={`Draft ${i + 1}`}
                    className={make.draftOpen}
                    onClick={() => switchDraft(i)}
                    dangerouslySetInnerHTML={{ __html: posterSvg(draft, layoutPoster(draft, measure ?? approxMeasure)) }}
                  />
                  <button type="button" className={make.draftRemove} aria-label={`Delete draft ${i + 1}`} onClick={() => removeDraft(i)}>×</button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <SavedStrip tool="make" />
      </div>
    </div>
  );
}
