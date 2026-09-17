'use client';

/**
 * TYPE: a line of words, set like a poster.
 *
 * The canvas is the poster — the same SVG that exports, drawn with the page's
 * own copy of the font. "Fit" sizes the longest line to the width by measuring
 * the real glyphs once the font has loaded, which is why the fitted size is
 * state here and not arithmetic in the engine.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import styles from '../studio.module.css';
import { Button, Menu, Segmented, Slider } from '@/components/ui';
import { useStore, useToolActions, type Command } from '@/lib/store';
import { useHistory } from '@/lib/history';
import { contrast } from '@/lib/color';
import { createRng, newSeed } from '@/lib/random';
import { load, save } from '@/lib/storage';
import { copyText, downloadBlob, downloadText, fileName } from '@/lib/export';
import { svgToPng } from '@/lib/render';
import { modLabel } from '@/lib/shortcuts';
import { ASPECTS, type Aspect } from '@/lib/pattern';
import { FONTS, embeddedFontCss, fontById, nearestWeight, type FontId } from '@/lib/fonts';
import {
  CAP, DARK, DEFAULT_TYPE, LIGHT, PRESETS, applyPreset, backgroundOf, padding, randomType, toLines, applyCase,
  typeCss, typeSvg, type Align, type Background, type Break, type Case, type PresetId, type TypeState, type VAlign,
} from '@/lib/typeset';
import { PickOne } from '../ColorChips';

const ASPECT_OPTIONS = (Object.keys(ASPECTS) as Aspect[]).map((id) => ({ id, label: ASPECTS[id].label }));
const MEASURE_AT = 100;

const slug = (text: string): string =>
  text.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 32).toLowerCase() || 'poster';

export default function TypeTool() {
  const store = useStore();
  const { state, set, undo, redo } = useHistory<TypeState>(() => ({ ...DEFAULT_TYPE, ...load<Partial<TypeState>>('type.state', {}) }));
  const [fitted, setFitted] = useState<number | null>(null);
  const measurer = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const font = fontById(state.font);
  const { w, h } = ASPECTS[state.aspect];
  const size = state.fit ? fitted ?? state.size : state.size;
  const ground = backgroundOf(state);

  useEffect(() => { save('type.state', state); }, [state]);

  /* Opened from Recent. */
  useEffect(() => {
    const recipe = store.takePending('type')?.recipe as TypeState | undefined;
    if (recipe?.text !== undefined) set({ ...DEFAULT_TYPE, ...recipe });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * Fit to width. The font is loaded first — measuring the fallback and then
   * swapping in the real face is exactly how a poster ends up overflowing.
   */
  const fitKey = [state.text, state.font, state.weight, state.width, state.italic, state.tracking, state.leading, state.textCase, state.breakMode, state.aspect].join('|');
  useEffect(() => {
    let cancelled = false;
    const measure = async () => {
      const weight = nearestWeight(font, state.weight);
      await document.fonts.load(`${state.italic && font.italic ? 'italic ' : ''}${weight} ${MEASURE_AT}px '${font.family}'`).catch(() => undefined);
      const host = measurer.current;
      if (cancelled || !host) return;
      host.innerHTML = typeSvg({ ...state, background: 'transparent' }, MEASURE_AT);
      let widest = 0;
      host.querySelectorAll('text').forEach((node) => { widest = Math.max(widest, node.getBBox().width); });
      host.innerHTML = '';
      const pad = padding(state.aspect);
      const lines = toLines(applyCase(state.text, state.textCase), state.breakMode).length;
      const byWidth = widest > 0 ? (MEASURE_AT * (w - pad * 2) * 0.985) / widest : state.size;
      // A column of single words can fit the width and still run off the bottom.
      const byHeight = (h - pad * 2) / ((lines - 1) * state.leading + CAP);
      setFitted(Math.max(12, Math.min(byWidth, byHeight)));
    };
    measure();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  const svg = useMemo(() => typeSvg(state, size), [state, size]);
  const patch = (changes: Partial<TypeState>, tag?: string) => set((s) => ({ ...s, ...changes }), tag);

  const remember = () =>
    store.remember({ tool: 'type', kind: 'Poster', colors: [ground ?? '#FFFFFF', state.color], recipe: { ...state } as Record<string, unknown> });

  const chooseFont = (id: FontId) => {
    const next = fontById(id);
    patch({ font: id, weight: nearestWeight(next, state.weight), italic: state.italic && next.italic });
  };
  const usePreset = (id: PresetId) => set(applyPreset(state, id, store.palette, createRng(newSeed())));
  const randomize = () => set(randomType(createRng(newSeed()), store.palette, state));

  const exportAs = async (format: 'png' | 'svg') => {
    const name = fileName('type', 'poster', slug(applyCase(state.text, state.textCase)), format);
    let ok = false;
    try {
      const fontCss = await embeddedFontCss(font, state.italic);
      if (format === 'svg') {
        ok = downloadText(typeSvg(state, size, { fontCss }), name, 'image/svg+xml');
      } else {
        const blob = await svgToPng(typeSvg(state, size, { fontCss, pixelWidth: w * 2 }), w * 2, h * 2);
        ok = !!blob && downloadBlob(blob, name);
      }
    } catch {
      ok = false;
    }
    store.toast(ok ? `Exported ${format.toUpperCase()}` : 'Couldn’t export that. Try again.');
    if (ok) remember();
  };
  const copyCss = async () => {
    const ok = await copyText(typeCss(state, size));
    store.toast(ok ? 'Copied CSS' : 'Couldn’t copy that. Try again.');
    if (ok) remember();
  };

  const commands: Command[] = [
    { id: 't-random', label: 'Randomize typography', group: 'Type', hint: 'Space', run: randomize },
    { id: 't-edit', label: 'Edit text', group: 'Type', run: () => textarea.current?.focus() },
    { id: 't-png', label: 'Export poster as PNG', group: 'Type', hint: 'E', run: () => exportAs('png') },
    { id: 't-svg', label: 'Export poster as SVG', group: 'Type', run: () => exportAs('svg') },
    { id: 't-css', label: 'Copy type CSS', group: 'Type', run: copyCss },
    ...PRESETS.map((p) => ({ id: `t-preset-${p.id}`, label: `Preset: ${p.label}`, group: 'Type', run: () => usePreset(p.id) })),
    ...FONTS.map((f) => ({ id: `t-font-${f.id}`, label: `Font: ${f.label}`, group: 'Type', run: () => chooseFont(f.id) })),
  ];

  useToolActions({
    randomize,
    exportDefault: () => exportAs('png'),
    save: () => { remember(); store.toast('Saved to Recent'); },
    undo: () => { if (!undo()) store.toast('Nothing to undo'); },
    redo: () => { if (!redo()) store.toast('Nothing to redo'); },
    commands,
  });

  const ratio = ground ? contrast(state.color, ground) : null;
  const inks = [DARK, LIGHT, ...store.palette];

  return (
    <div className={styles.studio}>
      <div className={styles.panel}>
        <div className={styles.group}>
          <label className={styles.label} htmlFor="type-text">Text</label>
          <textarea
            id="type-text"
            ref={textarea}
            className={styles.textarea}
            value={state.text}
            spellCheck={false}
            onChange={(e) => patch({ text: e.target.value }, 'text')}
          />
        </div>

        <div className={styles.group}>
          <p className={styles.label}>Presets</p>
          <div className={styles.presets}>
            {PRESETS.map((p) => (
              <Button key={p.id} onClick={() => usePreset(p.id)}>{p.label}</Button>
            ))}
          </div>
        </div>

        <div className={styles.group}>
          <p className={styles.label} id="type-font">Font</p>
          <div className={styles.fonts} role="group" aria-labelledby="type-font">
            {FONTS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={styles.font}
                aria-pressed={f.id === state.font}
                style={{ fontFamily: `'${f.family}', ${f.fallback}`, fontWeight: nearestWeight(f, 600) }}
                onClick={() => chooseFont(f.id)}
                onPointerUp={(e) => e.currentTarget.blur()}
              >
                {f.label}
                <small>{f.weights.length > 1 ? `${f.weights[0]}–${f.weights[f.weights.length - 1]}` : f.italic ? 'Roman + italic' : f.weights[0]}</small>
              </button>
            ))}
          </div>
          <div>
            <Segmented
              compact
              label="Weight"
              value={String(nearestWeight(font, state.weight))}
              onChange={(v) => patch({ weight: Number(v) })}
              options={font.weights.map((wt) => ({ id: String(wt), label: String(wt) }))}
            />
          </div>
          {font.width && (
            <Slider label="Width" min={font.width.min} max={font.width.max} value={state.width} format={(v) => `${v}%`} onChange={(v) => patch({ width: v }, 'width')} />
          )}
          {font.italic && (
            <div className={styles.row}>
              <Button aria-pressed={state.italic} variant={state.italic ? 'solid' : 'line'} onClick={() => patch({ italic: !state.italic })}>Italic</Button>
            </div>
          )}
        </div>

        <div className={styles.group}>
          <div className={styles.labelRow}>
            <p className={styles.label}>Size</p>
            <Button variant={state.fit ? 'solid' : 'ghost'} aria-pressed={state.fit} onClick={() => patch({ fit: !state.fit, size: Math.round(size) })}>
              Fit to width
            </Button>
          </div>
          <Slider label="Font size" min={24} max={Math.round(Math.max(w, h) * 0.6)} value={Math.round(size)} format={(v) => `${v}px`} onChange={(v) => patch({ size: v, fit: false }, 'size')} />
          <Slider label="Letter spacing" min={-0.1} max={0.4} step={0.005} value={state.tracking} format={(v) => `${Math.round(v * 1000)}`} onChange={(v) => patch({ tracking: v }, 'tracking')} />
          <Slider label="Line height" min={0.7} max={2} step={0.01} value={state.leading} format={(v) => v.toFixed(2)} onChange={(v) => patch({ leading: v }, 'leading')} />
        </div>

        <div className={styles.group}>
          <p className={styles.label}>Layout</p>
          <Segmented<Align> label="Alignment" value={state.align} onChange={(align) => patch({ align })} options={[{ id: 'left', label: 'Left' }, { id: 'center', label: 'Center' }, { id: 'right', label: 'Right' }]} />
          <Segmented<VAlign> label="Vertical position" value={state.valign} onChange={(valign) => patch({ valign })} options={[{ id: 'top', label: 'Top' }, { id: 'middle', label: 'Middle' }, { id: 'bottom', label: 'Bottom' }]} />
          <div className={styles.scroll}>
            <Segmented<Case> label="Case" value={state.textCase} onChange={(textCase) => patch({ textCase })} options={[{ id: 'normal', label: 'Aa' }, { id: 'upper', label: 'AA' }, { id: 'lower', label: 'aa' }, { id: 'title', label: 'Title' }]} />
          </div>
          <Segmented<Break> label="Lines" value={state.breakMode} onChange={(breakMode) => patch({ breakMode })} options={[{ id: 'typed', label: 'As typed' }, { id: 'words', label: 'Word per line' }]} />
        </div>

        <div className={styles.group}>
          <p className={styles.label}>Background</p>
          <div className={styles.scroll}>
            <Segmented<Background> label="Background" value={state.background} onChange={(background) => patch({ background })} options={[{ id: 'light', label: 'Light' }, { id: 'dark', label: 'Dark' }, { id: 'color', label: 'Colour' }, { id: 'transparent', label: 'None' }]} />
          </div>
          {state.background === 'color' && (
            <PickOne label="Background colour" options={store.palette} value={state.backgroundColor} onChange={(hex, tag) => patch({ backgroundColor: hex }, tag)} />
          )}
        </div>

        <div className={styles.group}>
          <div className={styles.labelRow}>
            <p className={styles.label}>Text colour</p>
            {ratio !== null && (
              <span className={`${styles.contrast} ${ratio < 3 ? styles.contrastLow : ''}`}>
                {ratio.toFixed(1)}:1 {ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : ratio >= 3 ? 'Large only' : 'Hard to read'}
              </span>
            )}
          </div>
          <PickOne label="Text colour" options={inks} value={state.color} onChange={(hex, tag) => patch({ color: hex }, tag)} />
        </div>

        <div className={styles.group}>
          <p className={styles.label}>Canvas</p>
          <div className={styles.scroll}>
            <Segmented label="Canvas" value={state.aspect} onChange={(aspect) => patch({ aspect })} options={ASPECT_OPTIONS} />
          </div>
        </div>
      </div>

      <div className={styles.stage}>
        <div
          className={`${styles.frame} ${styles.stageText} ${ground ? '' : styles.transparent}`}
          style={{ ['--ar' as string]: w / h, opacity: state.fit && fitted === null ? 0 : 1 }}
          role="img"
          aria-label={`Poster reading: ${toLines(applyCase(state.text, state.textCase), state.breakMode).join(' ')}`}
          onClick={() => textarea.current?.focus()}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <div className={styles.bar}>
          <Button variant="solid" onClick={randomize}>Randomize</Button>
          <Button onClick={copyCss}>Copy CSS</Button>
          <Menu
            label="Export"
            variant="line"
            items={[
              { label: 'PNG', hint: `${w * 2} × ${h * 2}`, run: () => exportAs('png') },
              { label: 'SVG', hint: 'Font included', run: () => exportAs('svg') },
            ]}
          />
        </div>
        <p className={styles.hint}><b>Space</b> for a new composition · Click the poster to edit the words · <b>{modLabel()}Z</b> to go back</p>
      </div>

      {/* Off-screen, but laid out: getBBox needs real layout to measure. */}
      <div ref={measurer} aria-hidden="true" style={{ position: 'fixed', left: -99999, top: 0, width: w, visibility: 'hidden', pointerEvents: 'none' }} />
    </div>
  );
}
