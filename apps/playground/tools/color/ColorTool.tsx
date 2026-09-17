'use client';

/**
 * COLOR: palettes and gradients.
 *
 * The palette made here is the playground's shared palette — the brand dot
 * picks it up at once, and the other tools will default to it — so this is
 * where most sessions start and where the colour everywhere else comes from.
 */

import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import styles from './color.module.css';
import { Button, Menu, Segmented } from '@/components/ui';
import { useStore, useToolActions, type Command } from '@/lib/store';
import { SCHEMES, generatePalette, readableOn, regenerateSwatch, type Scheme, type Swatch } from '@/lib/color';
import { createRng, newSeed } from '@/lib/random';
import { load, save } from '@/lib/storage';
import { copyText, downloadText, fileName } from '@/lib/export';
import { fromPalette, gradientSvg, toCss, type Gradient } from '@/lib/gradient';
import GradientEditor from './GradientEditor';
import { LockIcon, RefreshIcon } from './icons';
import * as out from './exports';
import SavedStrip from '../SavedStrip';

type Mode = 'palette' | 'gradient';

export default function ColorTool() {
  const store = useStore();
  const [mode, setMode] = useState<Mode>(() => load<Mode>('color.mode', 'palette'));
  const [scheme, setScheme] = useState<Scheme>(() => load<Scheme>('color.scheme', 'harmony'));
  const [seed, setSeed] = useState<number>(() => load<number>('color.seed', 0) || newSeed());
  const [swatches, setSwatches] = useState<Swatch[]>(() => {
    const saved = load<Swatch[] | null>('color.swatches', null);
    // A first visit gets a fresh palette rather than the same fixed one for everybody.
    return saved && saved.length === 5 ? saved : generatePalette(createRng(newSeed()), 'harmony');
  });
  const [gradient, setGradient] = useState<Gradient>(
    () => load<Gradient | null>('color.gradient', null) ?? fromPalette(swatches.map((s) => s.hex), createRng(seed)),
  );
  const clickSeq = useRef(0);
  const cancelledThrough = useRef(0);
  const hexes = swatches.map((s) => s.hex);

  /* Persist, and share the palette with the rest of the playground. */
  useEffect(() => {
    save('color.swatches', swatches);
    save('color.seed', seed);
    store.setPalette(swatches.map((s) => s.hex));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swatches, seed]);
  useEffect(() => { save('color.mode', mode); }, [mode]);
  useEffect(() => { save('color.scheme', scheme); }, [scheme]);
  useEffect(() => { save('color.gradient', gradient); }, [gradient]);

  /* Opened from Recent: put back exactly what was there. */
  useEffect(() => {
    const recent = store.takePending('color');
    if (!recent) return;
    const recipe = recent.recipe as { colors?: string[]; scheme?: Scheme; seed?: number; gradient?: Gradient };
    if (recent.kind === 'Gradient' && recipe.gradient) {
      setGradient(recipe.gradient);
      setMode('gradient');
    } else if (recipe.colors?.length) {
      setSwatches(recipe.colors.map((hex) => ({ hex, locked: false })));
      if (recipe.scheme) setScheme(recipe.scheme);
      if (recipe.seed) setSeed(recipe.seed);
      setMode('palette');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rememberPalette = useCallback(
    () => store.remember({ tool: 'color', kind: 'Palette', colors: hexes, recipe: { colors: hexes, scheme, seed } }),
    [store, hexes, scheme, seed],
  );
  const rememberGradient = useCallback(
    () => store.remember({ tool: 'color', kind: 'Gradient', colors: gradient.stops.map((s) => s.hex), recipe: { gradient } }),
    [store, gradient],
  );

  /* ------------------------------- palette ------------------------------- */

  const newPalette = useCallback(() => {
    const next = newSeed();
    setSeed(next);
    setSwatches((previous) => generatePalette(createRng(next), scheme, previous));
  }, [scheme]);

  const changeScheme = (next: Scheme) => {
    setScheme(next);
    const s = newSeed();
    setSeed(s);
    // Switching scheme shows it straight away, keeping whatever is locked.
    setSwatches((previous) => generatePalette(createRng(s), next, previous));
  };

  const regenerate = (index: number) =>
    setSwatches((previous) => (previous[index].locked ? previous : regenerateSwatch(createRng(newSeed()), scheme, previous, index)));

  const toggleLock = (index: number) =>
    setSwatches((previous) => previous.map((s, i) => (i === index ? { ...s, locked: !s.locked } : s)));

  const copy = useCallback(
    async (text: string, success: string): Promise<boolean> => {
      const ok = await copyText(text);
      store.toast(ok ? success : 'Couldn’t copy that. Try again.');
      return ok;
    },
    [store],
  );

  /*
   * Click copies at once — clipboard access has to happen inside the click in
   * Safari — but the toast waits a beat, so the first half of a double-click
   * does not announce a copy just before the colour changes under it.
   */
  const onSwatchClick = (index: number, e: MouseEvent) => {
    if (e.detail > 1) return;
    const hex = hexes[index];
    clickSeq.current += 1;
    const click = clickSeq.current;
    copyText(hex).then((ok) => {
      window.setTimeout(() => {
        // Cancelled by a double-click that followed — checked here rather than
        // by clearing a timer, because the copy promise can resolve after the
        // double-click has already happened, and would set a fresh timer.
        if (click <= cancelledThrough.current) return;
        store.toast(ok ? `Copied ${hex}` : 'Couldn’t copy that. Try again.');
        if (ok) rememberPalette();
      }, 240);
    });
  };
  const onSwatchDouble = (index: number) => {
    cancelledThrough.current = clickSeq.current;
    regenerate(index);
  };

  const exportPalette = async (format: 'png' | 'svg' | 'css' | 'json') => {
    let ok = false;
    if (format === 'png') ok = await out.paletteToPng(hexes, seed);
    if (format === 'svg') ok = downloadText(out.paletteSvg(hexes), fileName('color', 'palette', seed, 'svg'), 'image/svg+xml');
    if (format === 'css') ok = downloadText(out.paletteCss(hexes), fileName('color', 'palette', seed, 'css'), 'text/css');
    if (format === 'json') ok = downloadText(out.paletteJson(hexes, seed, scheme), fileName('color', 'palette', seed, 'json'), 'application/json');
    store.toast(ok ? `Exported ${format.toUpperCase()}` : 'Couldn’t export that. Try again.');
    if (ok) rememberPalette();
  };

  const savePalette = () => {
    const result = store.saveItem({ tool: 'color', kind: 'Palette', colors: hexes, recipe: { colors: hexes, scheme, seed } });
    store.toast(!result ? 'Storage is full. Download a backup from Saved, then delete a few.' : result.repeat ? `Already saved as ${result.item.name}` : `Saved as ${result.item.name}`);
    if (result) rememberPalette();
  };

  const saveGradient = () => {
    const colors = gradient.stops.map((stop) => stop.hex);
    const result = store.saveItem({ tool: 'color', kind: 'Gradient', colors, recipe: { gradient } });
    store.toast(!result ? 'Storage is full. Download a backup from Saved, then delete a few.' : result.repeat ? `Already saved as ${result.item.name}` : `Saved as ${result.item.name}`);
    if (result) rememberGradient();
  };

  /* ------------------------------- gradient ------------------------------ */

  const randomGradient = useCallback(() => {
    const s = newSeed();
    setSeed(s);
    setGradient(fromPalette(hexes, createRng(s)));
  }, [hexes]);

  const exportGradient = async (format: 'png' | 'svg' | 'css') => {
    let ok = false;
    if (format === 'png') ok = await out.gradientToPng(gradient, seed);
    if (format === 'svg') ok = downloadText(gradientSvg(gradient, 1920, 1080), fileName('color', 'gradient', seed, 'svg'), 'image/svg+xml');
    if (format === 'css') ok = downloadText(out.gradientCss(gradient), fileName('color', 'gradient', seed, 'css'), 'text/css');
    store.toast(ok ? `Exported ${format.toUpperCase()}` : 'Couldn’t export that. Try again.');
    if (ok) rememberGradient();
  };

  const copyCss = async () => {
    if (await copy(`background: ${toCss(gradient)};`, 'Copied CSS')) rememberGradient();
  };

  /* ---------------------------- shell contract --------------------------- */

  const commands: Command[] = [
    { id: 'c-new', label: 'Generate palette', group: 'Color', hint: 'Space', run: () => { setMode('palette'); newPalette(); } },
    { id: 'c-grad', label: 'Create gradient', group: 'Color', run: () => setMode('gradient') },
    { id: 'c-copy', label: 'Copy HEX codes', group: 'Color', run: () => { copy(hexes.join(', '), 'Copied all five HEX codes'); } },
    { id: 'c-css', label: 'Copy gradient CSS', group: 'Color', run: copyCss },
    { id: 'c-png', label: 'Export palette as PNG', group: 'Color', run: () => exportPalette('png') },
    { id: 'c-save', label: 'Save palette', group: 'Color', hint: `${'⌘'}S`, run: savePalette },
    { id: 'c-save-gradient', label: 'Save gradient', group: 'Color', run: saveGradient },
    ...SCHEMES.map((s) => ({ id: `c-scheme-${s.id}`, label: `Scheme: ${s.label}`, group: 'Color', run: () => { setMode('palette'); changeScheme(s.id); } })),
  ];

  useToolActions({
    randomize: mode === 'palette' ? newPalette : randomGradient,
    exportDefault: () => (mode === 'palette' ? exportPalette('png') : exportGradient('png')),
    save: mode === 'palette' ? savePalette : saveGradient,
    commands,
  });

  return (
    <div className={styles.tool}>
      <div className={styles.toolbar}>
        <Segmented
          label="Mode"
          value={mode}
          onChange={setMode}
          options={[
            { id: 'palette', label: 'Palette' },
            { id: 'gradient', label: 'Gradient' },
          ]}
        />
        {mode === 'palette' && (
          <div className={styles.schemes}>
            <Segmented label="Scheme" value={scheme} onChange={changeScheme} options={SCHEMES} />
          </div>
        )}
        <div className={styles.actions}>
          {mode === 'palette' ? (
            <>
              <Button variant="solid" onClick={newPalette}>New palette</Button>
              <Button onClick={() => { copy(hexes.join(', '), 'Copied all five HEX codes').then((ok) => ok && rememberPalette()); }}>
                Copy HEX
              </Button>
              <Button onClick={savePalette}>Save</Button>
              <Menu
                label="Export"
                variant="line"
                items={[
                  { label: 'PNG', hint: 'Image', run: () => exportPalette('png') },
                  { label: 'SVG', hint: 'Vector', run: () => exportPalette('svg') },
                  { label: 'CSS', hint: 'Variables', run: () => exportPalette('css') },
                  { label: 'JSON', hint: 'Data', run: () => exportPalette('json') },
                ]}
              />
            </>
          ) : (
            <>
              <Button variant="solid" onClick={randomGradient}>Randomize</Button>
              <Button onClick={copyCss}>Copy CSS</Button>
              <Button onClick={saveGradient}>Save</Button>
              <Menu
                label="Export"
                variant="line"
                items={[
                  { label: 'PNG', hint: '1920 × 1080', run: () => exportGradient('png') },
                  { label: 'SVG', hint: 'Vector', run: () => exportGradient('svg') },
                  { label: 'CSS', hint: 'Stylesheet', run: () => exportGradient('css') },
                ]}
              />
            </>
          )}
        </div>
      </div>

      {mode === 'palette' ? (
        <>
          <div className={styles.palette} role="list" aria-label="Palette">
            {swatches.map((swatch, i) => {
              const ink = readableOn(swatch.hex);
              return (
                <div key={i} role="listitem" className={styles.swatch} style={{ background: swatch.hex, color: ink }}>
                  <button
                    className={styles.hit}
                    aria-label={`Copy ${swatch.hex}`}
                    onClick={(e) => onSwatchClick(i, e)}
                    onDoubleClick={() => onSwatchDouble(i)}
                    onPointerUp={(e) => e.currentTarget.blur()}
                  />
                  <div className={styles.swatchTools}>
                    <button
                      className={styles.iconBtn}
                      aria-pressed={swatch.locked}
                      aria-label={swatch.locked ? `Unlock ${swatch.hex}` : `Lock ${swatch.hex}`}
                      title={swatch.locked ? 'Unlock' : 'Lock'}
                      onClick={() => toggleLock(i)}
                      onPointerUp={(e) => e.currentTarget.blur()}
                    >
                      <LockIcon locked={swatch.locked} />
                    </button>
                    <button
                      className={styles.iconBtn}
                      aria-label={`Change ${swatch.hex}`}
                      title="Change this one"
                      disabled={swatch.locked}
                      onClick={() => regenerate(i)}
                      onPointerUp={(e) => e.currentTarget.blur()}
                    >
                      <RefreshIcon />
                    </button>
                  </div>
                  {swatch.locked && <span className={styles.lockedTag}>Locked</span>}
                  <span className={styles.hex}>{swatch.hex}</span>
                </div>
              );
            })}
          </div>
          <p className={styles.hint}>
            <b>Space</b> for a new palette · Click a colour to copy · Double-click to change one · Lock the ones you love
          </p>

          <SavedStrip tool="color" />
        </>
      ) : (
        <>
          <GradientEditor gradient={gradient} onChange={setGradient} palette={hexes} />
          <SavedStrip tool="color" />
        </>
      )}
    </div>
  );
}
