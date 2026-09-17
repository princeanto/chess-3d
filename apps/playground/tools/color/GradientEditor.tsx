'use client';

/**
 * The gradient editor: a big preview, and stops you drag like physical handles.
 *
 * The preview is the CSS string itself, so what you see is exactly what Copy
 * CSS gives you. Handles are sliders to assistive technology and to the
 * keyboard — arrows nudge by one, Shift by ten — and a click on the bar adds a
 * stop where you clicked.
 */

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import styles from './color.module.css';
import { Button, Segmented, Slider } from '@/components/ui';
import { isHex } from '@/lib/color';
import { MAX_STOPS, MIN_STOPS, sorted, stopId, toCss, type Gradient, type Stop } from '@/lib/gradient';

const clamp = (v: number) => Math.min(100, Math.max(0, v));

export default function GradientEditor({
  gradient,
  onChange,
  palette,
}: {
  gradient: Gradient;
  onChange: (g: Gradient) => void;
  palette: string[];
}) {
  const [selected, setSelected] = useState<string>(gradient.stops[0]?.id ?? '');
  const [hexDraft, setHexDraft] = useState('');
  const track = useRef<HTMLDivElement>(null);
  const dragging = useRef<string | null>(null);

  const css = toCss(gradient);
  const barCss = toCss({ ...gradient, kind: 'linear', angle: 90 });
  const current = gradient.stops.find((s) => s.id === selected) ?? gradient.stops[0];

  useEffect(() => {
    if (!gradient.stops.some((s) => s.id === selected)) setSelected(gradient.stops[0]?.id ?? '');
  }, [gradient.stops, selected]);
  useEffect(() => setHexDraft(current?.hex ?? ''), [current?.hex]);

  const update = (id: string, patch: Partial<Stop>) =>
    onChange({ ...gradient, stops: gradient.stops.map((s) => (s.id === id ? { ...s, ...patch } : s)) });

  const posFrom = (clientX: number): number => {
    const rect = track.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    return clamp(((clientX - rect.left) / rect.width) * 100);
  };

  const onHandleDown = (e: PointerEvent<HTMLButtonElement>, id: string) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = id;
    setSelected(id);
  };
  const onHandleMove = (e: PointerEvent<HTMLButtonElement>, id: string) => {
    if (dragging.current !== id) return;
    update(id, { pos: Math.round(posFrom(e.clientX)) });
  };
  const onHandleUp = () => {
    dragging.current = null;
  };

  const onHandleKey = (e: KeyboardEvent<HTMLButtonElement>, stop: Stop) => {
    const step = e.shiftKey ? 10 : 1;
    const delta = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? step : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -step : 0;
    if (delta) {
      e.preventDefault();
      update(stop.id, { pos: clamp(stop.pos + delta) });
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && gradient.stops.length > MIN_STOPS) {
      e.preventDefault();
      remove(stop.id);
    }
  };

  /* Click the bar: a new stop there, coloured like its nearest neighbour. */
  const onTrackDown = (e: PointerEvent<HTMLDivElement>) => {
    if (gradient.stops.length >= MAX_STOPS) return;
    const pos = Math.round(posFrom(e.clientX));
    const nearest = gradient.stops.reduce((a, b) => (Math.abs(b.pos - pos) < Math.abs(a.pos - pos) ? b : a));
    const stop = { id: stopId(), hex: nearest.hex, pos };
    onChange({ ...gradient, stops: [...gradient.stops, stop] });
    setSelected(stop.id);
  };

  const addStop = () => {
    if (gradient.stops.length >= MAX_STOPS) return;
    const s = sorted(gradient.stops);
    // Into the widest gap, with a palette colour that is not already used.
    let gapAt = 50;
    let widest = -1;
    for (let i = 0; i < s.length - 1; i += 1) {
      if (s[i + 1].pos - s[i].pos > widest) {
        widest = s[i + 1].pos - s[i].pos;
        gapAt = (s[i + 1].pos + s[i].pos) / 2;
      }
    }
    const unused = palette.find((hex) => !gradient.stops.some((stop) => stop.hex === hex)) ?? palette[0] ?? '#111111';
    const stop = { id: stopId(), hex: unused, pos: Math.round(gapAt) };
    onChange({ ...gradient, stops: [...gradient.stops, stop] });
    setSelected(stop.id);
  };

  const remove = (id: string) => {
    if (gradient.stops.length <= MIN_STOPS) return;
    onChange({ ...gradient, stops: gradient.stops.filter((s) => s.id !== id) });
  };

  const commitHex = () => {
    if (!current) return;
    const value = hexDraft.startsWith('#') ? hexDraft : `#${hexDraft}`;
    if (isHex(value)) update(current.id, { hex: value.toUpperCase() });
    else setHexDraft(current.hex);
  };

  return (
    <div className={styles.gradientWrap}>
      <div>
        <div className={styles.preview} style={{ background: css }} role="img" aria-label={`Gradient preview: ${css}`} />
        <pre className={styles.code}>
          <code>{css}</code>
        </pre>
      </div>

      <div className={styles.panel}>
        <div>
          <div className={styles.label}>Type</div>
          <Segmented
            label="Gradient type"
            value={gradient.kind}
            onChange={(kind) => onChange({ ...gradient, kind })}
            options={[
              { id: 'linear', label: 'Linear' },
              { id: 'radial', label: 'Radial' },
            ]}
          />
        </div>

        {gradient.kind === 'linear' && (
          <Slider label="Angle" min={0} max={360} value={Math.round(gradient.angle)} onChange={(angle) => onChange({ ...gradient, angle })} format={(v) => `${v}°`} />
        )}

        <div>
          <div className={styles.label}>
            Stops <span className={styles.labelNote}>{gradient.stops.length} of {MAX_STOPS} · click the bar to add</span>
          </div>
          <div ref={track} className={styles.track} style={{ background: barCss }} onPointerDown={onTrackDown}>
            {gradient.stops.map((stop, i) => (
              <button
                key={stop.id}
                type="button"
                role="slider"
                aria-label={`Stop ${i + 1}, ${stop.hex}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(stop.pos)}
                aria-valuetext={`${Math.round(stop.pos)}%`}
                className={`${styles.handle}${stop.id === current?.id ? ` ${styles.handleOn}` : ''}`}
                style={{ left: `${stop.pos}%`, background: stop.hex }}
                onPointerDown={(e) => onHandleDown(e, stop.id)}
                onPointerMove={(e) => onHandleMove(e, stop.id)}
                onPointerUp={onHandleUp}
                onPointerCancel={onHandleUp}
                onFocus={() => setSelected(stop.id)}
                onKeyDown={(e) => onHandleKey(e, stop)}
              />
            ))}
          </div>
        </div>

        {current && (
          <div className={styles.stopEditor}>
            <input
              type="color"
              className={styles.colorInput}
              aria-label="Stop colour"
              value={current.hex.length === 7 ? current.hex.toLowerCase() : '#000000'}
              onChange={(e) => update(current.id, { hex: e.target.value.toUpperCase() })}
            />
            <input
              className={styles.hexInput}
              aria-label="Stop HEX"
              value={hexDraft}
              spellCheck={false}
              maxLength={7}
              onChange={(e) => setHexDraft(e.target.value)}
              onBlur={commitHex}
              onKeyDown={(e) => e.key === 'Enter' && commitHex()}
            />
            <span className={styles.pos}>{Math.round(current.pos)}%</span>
            <Button variant="ghost" onClick={() => remove(current.id)} disabled={gradient.stops.length <= MIN_STOPS}>
              Remove
            </Button>
          </div>
        )}

        <div className={styles.row}>
          <Button onClick={addStop} disabled={gradient.stops.length >= MAX_STOPS}>Add stop</Button>
        </div>
      </div>
    </div>
  );
}
