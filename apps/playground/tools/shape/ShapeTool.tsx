'use client';

/**
 * SHAPE: patterns from a seed.
 *
 * The whole picture is a function of what the panel shows — the kind, the seed,
 * four sliders and the colours — so copying the seed and those settings is the
 * same as copying the picture, and the preview is the export.
 */

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import styles from '../studio.module.css';
import { Button, Menu, Segmented, Slider } from '@/components/ui';
import { useStore, useToolActions, type Command } from '@/lib/store';
import { useHistory } from '@/lib/history';
import { createRng, newSeed, parseSeed } from '@/lib/random';
import { load, save } from '@/lib/storage';
import { copyText, downloadBlob, downloadText, fileName } from '@/lib/export';
import { svgToPng } from '@/lib/render';
import { modLabel } from '@/lib/shortcuts';
import {
  ASPECTS, PATTERNS, RANGES, colorsFrom, patternCss, patternLabel, patternSvg, randomPattern,
  type Aspect, type BaseKind, type PatternKind, type PatternState,
} from '@/lib/pattern';
import { starterTile, type TileSpec } from '@/lib/tile';
import TileEditor from './TileEditor';
import tileStyles from './tile.module.css';
import { PickMany, PickOne } from '../ColorChips';
import SavedStrip from '../SavedStrip';
import SavedPalettes from '../SavedPalettes';

const Sparkle = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" style={{ marginRight: 6 }}>
    <path d="M7 0.8l1.5 4.2 4.2 1.5-4.2 1.5L7 12.2 5.5 8 1.3 6.5 5.5 5z" fill="currentColor" />
  </svg>
);
const Pen = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" style={{ marginRight: 6 }} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12l.8-2.8L9.8 2.2a1.2 1.2 0 011.7 1.7L4.5 10.9 2 12z" />
  </svg>
);

const ASPECT_OPTIONS = (Object.keys(ASPECTS) as Aspect[]).map((id) => ({ id, label: ASPECTS[id].label }));
const THUMB_SEED = 424242;

export default function ShapeTool() {
  const store = useStore();
  const { state, set, undo, redo } = useHistory<PatternState>(() => {
    const saved = load<PatternState | null>('shape.state', null);
    return saved && RANGES[saved.kind] ? saved : randomPattern(createRng(newSeed()), store.palette, 'landscape');
  });
  const [seedText, setSeedText] = useState(String(state.seed));
  // Dense patterns are thousands of shapes; a dragged slider should not wait for them.
  const shown = useDeferredValue(state);
  const svg = useMemo(() => patternSvg(shown), [shown]);
  const { w, h } = ASPECTS[state.aspect];

  useEffect(() => { save('shape.state', state); }, [state]);
  useEffect(() => { setSeedText(String(state.seed)); }, [state.seed]);

  /* Opened from Recent. */
  useEffect(() => {
    const recent = store.takePending('shape');
    const recipe = recent?.recipe as PatternState | undefined;
    if (recipe && RANGES[recipe.kind]) set(recipe);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const thumbs = useMemo(
    () => Object.fromEntries(PATTERNS.map(({ id }) => {
      const r = RANGES[id];
      return [id, patternSvg({
        kind: id, seed: THUMB_SEED, aspect: 'square',
        density: r.density[0], scale: (r.scale[0] + r.scale[1]) / 2, spacing: r.spacing[0], rotation: 0,
        background: state.background, colors: state.colors,
      }, 64)];
    })) as Record<BaseKind, string>,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.background, state.colors.join()],
  );

  const remember = () =>
    store.remember({ tool: 'shape', kind: state.kind === 'generated' ? 'Generated' : patternLabel(state), colors: [state.background, ...state.colors].slice(0, 5), recipe: { ...state } as Record<string, unknown> });

  const label = patternLabel(state);
  const kindLabel = state.kind === 'generated' ? 'Generated' : label;
  const savePattern = () => {
    const result = store.saveItem({ tool: 'shape', kind: kindLabel, colors: [state.background, ...state.colors].slice(0, 5), recipe: { ...state } as Record<string, unknown> });
    store.toast(!result ? 'Storage is full. Download a backup from Saved, then delete a few.' : result.repeat ? `Already saved as ${result.item.name}` : `Saved as ${result.item.name}`);
    if (result) remember();
  };

  const patch = (changes: Partial<PatternState>, tag?: string) => set((s) => ({ ...s, ...changes }), tag);

  const generate = () => {
    set(randomPattern(createRng(newSeed()), store.palette, state.aspect, 'generated'));
  };
  const drawTile = () => {
    if (state.kind === 'tile') return;
    const r = RANGES.tile;
    patch({ kind: 'tile', tile: state.tile ?? starterTile(state.colors), density: r.density[0] + 10, scale: 100, spacing: 0, rotation: 0 });
  };
  /* Space means "another one of these": a new invention, a new repeat of your tile, or any pattern. */
  const randomize = () => {
    const rng = createRng(newSeed());
    if (state.kind === 'generated') return generate();
    if (state.kind === 'tile' && state.tile) {
      const repeats = (['grid', 'brick', 'halfdrop', 'mirror', 'rotate'] as const).filter((m) => m !== state.tile!.repeat);
      return patch({ tile: { ...state.tile, repeat: rng.pick(repeats) }, density: rng.int(15, 50), rotation: rng.pick([0, 0, 45]) });
    }
    set(randomPattern(rng, store.palette, state.aspect));
  };
  const newSeedOnly = () => patch({ seed: newSeed() });
  const chooseKind = (kind: PatternKind) => {
    if (kind === state.kind) return;
    // A new kind starts where it looks good, not at the last kind's settings.
    const r = RANGES[kind];
    const mid = (range: [number, number]) => Math.round((range[0] + range[1]) / 2);
    patch({ kind, density: mid(r.density), scale: mid(r.scale), spacing: mid(r.spacing), rotation: r.rotations[0] });
  };
  const recolour = () => {
    const next = colorsFrom(store.palette, createRng(newSeed()));
    if (state.kind === 'tile' && state.tile) {
      // Each colour in the tile moves to a palette colour, keeping which parts match.
      const used = [...new Set(state.tile.strokes.map((s) => s.c))];
      const map = new Map(used.map((c, i) => [c, next.colors[i % next.colors.length]]));
      patch({ ...next, tile: { ...state.tile, strokes: state.tile.strokes.map((s) => ({ ...s, c: map.get(s.c) ?? s.c })) } });
    } else {
      patch(next);
    }
    store.toast('Recoloured from your palette');
  };

  const copySeed = async () => {
    const ok = await copyText(String(state.seed));
    store.toast(ok ? `Copied seed ${state.seed}` : 'Couldn’t copy that. Try again.');
    if (ok) remember();
  };
  const applySeed = () => {
    const seed = parseSeed(seedText);
    if (seed === null) {
      store.toast('A seed is a number, like 839204');
      setSeedText(String(state.seed));
    } else if (seed !== state.seed) {
      patch({ seed });
    }
  };

  const exportAs = async (format: 'png' | 'svg' | 'css' | 'json') => {
    const name = (ext: string) => fileName('shape', state.kind, state.seed, ext);
    let ok = false;
    if (format === 'png') {
      const blob = await svgToPng(patternSvg(state, w * 2), w * 2, h * 2);
      ok = !!blob && downloadBlob(blob, name('png'));
    }
    if (format === 'svg') ok = downloadText(patternSvg(state), name('svg'), 'image/svg+xml');
    if (format === 'css') ok = downloadText(patternCss(state), name('css'), 'text/css');
    if (format === 'json') ok = downloadText(`${JSON.stringify({ tool: 'shape', ...state }, null, 2)}\n`, name('json'), 'application/json');
    store.toast(ok ? `Exported ${format.toUpperCase()}` : 'Couldn’t export that. Try again.');
    if (ok) remember();
  };

  const copyCss = async () => {
    const ok = await copyText(patternCss(state));
    store.toast(ok ? 'Copied CSS' : 'Couldn’t copy that. Try again.');
    if (ok) remember();
  };

  const commands: Command[] = [
    { id: 's-random', label: 'Randomize pattern', group: 'Shape', hint: 'Space', run: randomize },
    { id: 's-generate', label: 'Generate a new pattern', group: 'Shape', run: generate },
    { id: 's-tile', label: 'Draw a tile', group: 'Shape', run: drawTile },
    { id: 's-seed', label: 'New seed, same settings', group: 'Shape', run: newSeedOnly },
    { id: 's-copy-seed', label: 'Copy seed', group: 'Shape', run: copySeed },
    { id: 's-save', label: 'Save pattern', group: 'Shape', hint: '⌘S', run: savePattern },
    { id: 's-recolour', label: 'Recolour from palette', group: 'Shape', run: recolour },
    { id: 's-png', label: 'Export pattern as PNG', group: 'Shape', hint: 'E', run: () => exportAs('png') },
    { id: 's-svg', label: 'Export pattern as SVG', group: 'Shape', run: () => exportAs('svg') },
    { id: 's-css', label: 'Copy pattern CSS', group: 'Shape', run: copyCss },
    ...PATTERNS.map((p) => ({ id: `s-kind-${p.id}`, label: `Pattern: ${p.label}`, group: 'Shape', run: () => chooseKind(p.id) })),
  ];

  useToolActions({
    randomize,
    exportDefault: () => exportAs('png'),
    save: savePattern,
    undo: () => { if (!undo()) store.toast('Nothing to undo'); },
    redo: () => { if (!redo()) store.toast('Nothing to redo'); },
    commands,
  });

  return (
    <div className={styles.studio}>
      <div className={styles.panel}>
        <div className={styles.makers}>
          <Button variant={state.kind === 'generated' ? 'solid' : 'line'} onClick={generate} title="Invent a new pattern">
            <Sparkle /> Generate
          </Button>
          <Button variant={state.kind === 'tile' ? 'solid' : 'line'} onClick={drawTile} aria-pressed={state.kind === 'tile'}>
            <Pen /> Draw a tile
          </Button>
        </div>

        <div className={styles.group}>
          <p className={styles.label} id="shape-kind">Pattern</p>
          <div className={styles.kinds} role="group" aria-labelledby="shape-kind">
            {PATTERNS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={styles.kind}
                aria-pressed={p.id === state.kind}
                onClick={() => chooseKind(p.id)}
                onPointerUp={(e) => e.currentTarget.blur()}
              >
                <span className={styles.thumb} aria-hidden="true" dangerouslySetInnerHTML={{ __html: thumbs[p.id] }} />
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.group}>
          <Slider label={state.kind === 'tile' ? 'Tiles' : 'Density'} min={0} max={100} value={state.density} onChange={(v) => patch({ density: v }, 'density')} />
          <Slider label={state.kind === 'tile' ? 'Drawing size' : 'Scale'} min={0} max={100} value={state.scale} onChange={(v) => patch({ scale: v }, 'scale')} />
          <Slider label="Rotation" min={0} max={360} value={state.rotation} format={(v) => `${v}°`} onChange={(v) => patch({ rotation: v }, 'rotation')} />
          <Slider label="Spacing" min={0} max={100} value={state.spacing} onChange={(v) => patch({ spacing: v }, 'spacing')} />
        </div>

        <div className={styles.group}>
          <p className={styles.label}>Background</p>
          <PickOne label="Background" options={store.palette} value={state.background} onChange={(hex, tag) => patch({ background: hex }, tag)} />
        </div>

        <div className={styles.group}>
          <div className={styles.labelRow}>
            <p className={styles.label}>Shape colours</p>
            <button type="button" className={`btn btn-ghost ${styles.note}`} onClick={recolour}>From palette</button>
          </div>
          <PickMany
            label="Shape colour"
            options={store.palette}
            value={state.colors}
            onChange={(colors, tag) => patch({ colors }, tag)}
            onEmpty={() => store.toast('A pattern needs at least one colour')}
          />
          <SavedPalettes onPick={(hexes, name) => { patch(colorsFrom(hexes, createRng(newSeed()))); store.toast(`Colours from ${name}`); }} />
        </div>

        <div className={styles.group}>
          <p className={styles.label}>Canvas</p>
          <div className={styles.scroll}>
            <Segmented label="Canvas" value={state.aspect} onChange={(aspect) => patch({ aspect })} options={ASPECT_OPTIONS} />
          </div>
        </div>
      </div>

      <div className={styles.stage}>
        {state.kind === 'generated' && (
          <p className={styles.caption}>
            <span className={styles.captionKind}>Generated</span> {label}
          </p>
        )}
        <div className={state.kind === 'tile' && state.tile ? styles.tileStage : undefined}>
          {state.kind === 'tile' && state.tile && (
            <TileEditor
              tile={state.tile}
              background={state.background}
              colors={[...state.colors, ...store.palette.filter((c) => !state.colors.includes(c)), '#111111', '#FFFFFF']}
              onChange={(tile: TileSpec) => patch({ tile })}
              onUndo={() => { if (!undo()) store.toast('Nothing to undo'); }}
            />
          )}
          <div
            className={styles.frame}
            style={{ ['--ar' as string]: w / h }}
            role="img"
            aria-label={`${label} pattern, seed ${state.seed}`}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </div>
        <div className={styles.bar}>
          {state.kind === 'generated'
            ? <Button variant="solid" onClick={generate}><Sparkle /> Generate another</Button>
            : <Button variant="solid" onClick={randomize}>{state.kind === 'tile' ? 'Try a repeat' : 'Randomize'}</Button>}
          <div className={styles.seed}>
            Seed:
            <input
              className={styles.seedInput}
              inputMode="numeric"
              aria-label="Seed"
              value={seedText}
              onChange={(e) => setSeedText(e.target.value)}
              onBlur={applySeed}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applySeed(); } }}
            />
            <Button variant="ghost" onClick={copySeed} title="Copy seed">Copy</Button>
          </div>
          <Button onClick={newSeedOnly}>Random seed</Button>
          <Button onClick={savePattern}>Save</Button>
          <Menu
            label="Export"
            variant="line"
            items={[
              { label: 'PNG', hint: `${w * 2} × ${h * 2}`, run: () => exportAs('png') },
              { label: 'SVG', hint: 'Vector', run: () => exportAs('svg') },
              { label: 'CSS', hint: 'Background', run: () => exportAs('css') },
              { label: 'JSON', hint: 'Settings', run: () => exportAs('json') },
            ]}
          />
        </div>
        <p className={styles.hint}>
          {state.kind === 'tile'
            ? <><b>Draw in the square</b> and it repeats · Lines off one edge come back on the other · <b>{modLabel()}Z</b> undo</>
            : state.kind === 'generated'
              ? <><b>Space</b> invents another · Every one is new, and its seed brings it back · <b>{modLabel()}Z</b> for the last one</>
              : <><b>Space</b> for a new pattern · Same seed, same settings, same pattern · <b>{modLabel()}Z</b> brings the last one back</>}
        </p>
        <SavedStrip tool="shape" />
      </div>
    </div>
  );
}
