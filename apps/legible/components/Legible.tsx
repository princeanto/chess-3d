'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { TIERS, TIER_ORDER, type TierId } from '@/lib/color/wcag';
import { parsePalette, SAMPLE_PALETTE } from '@/lib/parse';
import {
  buildMatrix,
  makeSwatch,
  summarise,
  type Pair,
  type Swatch,
} from '@/lib/palette';
import FixReview from './FixReview';
import Matrix from './Matrix';
import PairDetail from './PairDetail';
import PaletteInput from './PaletteInput';

export default function Legible() {
  const [swatches, setSwatches] = useState<Swatch[]>(() =>
    parsePalette(SAMPLE_PALETTE).map((s) => makeSwatch(s.name, s.hex)),
  );
  const [tier, setTier] = useState<TierId>('body-aa');
  const [selected, setSelected] = useState<Pair | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme');
    if (current === 'dark' || current === 'light') setTheme(current);
  }, []);

  const setMode = (next: 'light' | 'dark') => {
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('legible-theme', next);
    } catch {
      // Private browsing; the choice just will not persist.
    }
  };

  const matrix = useMemo(() => buildMatrix(swatches), [swatches]);
  const summary = useMemo(() => summarise(matrix, tier), [matrix, tier]);

  // The selected pair holds a snapshot of its swatches, so re-resolve it against
  // current state or the detail panel would show stale colours after a fix.
  const livePair = useMemo(() => {
    if (!selected) return null;
    for (const row of matrix) {
      for (const p of row) {
        if (p.fg.id === selected.fg.id && p.bg.id === selected.bg.id) return p;
      }
    }
    return null;
  }, [selected, matrix]);

  const replace = useCallback((parsed: Array<{ name: string; hex: string }>) => {
    setSwatches(parsed.map((s) => makeSwatch(s.name, s.hex)));
    setSelected(null);
  }, []);

  const update = useCallback((id: string, patch: Partial<Swatch>) => {
    setSwatches((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const remove = useCallback((id: string) => {
    setSwatches((prev) => prev.filter((s) => s.id !== id));
    setSelected(null);
  }, []);

  const applyMany = useCallback((next: Array<{ id: string; hex: string }>) => {
    const byId = new Map(next.map((n) => [n.id, n.hex]));
    setSwatches((prev) => prev.map((s) => (byId.has(s.id) ? { ...s, hex: byId.get(s.id)! } : s)));
    setReviewing(false);
  }, []);

  const pct = summary.total === 0 ? 0 : Math.round((summary.passing / summary.total) * 100);

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-[1500px] flex-col gap-4 p-4 lg:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="serif text-[34px] leading-none">Legible</h1>
          <p className="mt-1.5 max-w-[54ch] text-[12.5px] leading-relaxed text-[var(--muted)]">
            Every foreground and background pair in your palette, graded against WCAG 2.2.
            Failing pairs are moved in OKLCH to the nearest passing value — lightness shifts,
            hue holds, so the brand survives the fix.
          </p>
        </div>
        <div className="seg">
          <button aria-pressed={theme === 'light'} onClick={() => setMode('light')}>
            Light
          </button>
          <button aria-pressed={theme === 'dark'} onClick={() => setMode('dark')}>
            Dark
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)_300px]">
        <PaletteInput
          swatches={swatches}
          onReplace={replace}
          onUpdate={update}
          onRemove={remove}
        />

        <section className="flex min-h-0 flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <div className="seg">
              {TIER_ORDER.map((id) => (
                <button key={id} aria-pressed={tier === id} onClick={() => setTier(id)}>
                  {TIERS[id].short}
                </button>
              ))}
            </div>
            <p className="text-[11.5px] text-[var(--muted)]">
              needs {TIERS[tier].ratio}:1 · {TIERS[tier].note}
            </p>
          </div>

          <div className="card flex flex-wrap items-center gap-x-5 gap-y-2 px-3 py-2">
            <Figure value={`${pct}%`} label={`${summary.passing} of ${summary.total} pairs pass`} />
            {summary.failing > 0 && (
              <Figure value={String(summary.failing)} label="failing" tone="fail" />
            )}
            {summary.contested > 0 && (
              <Figure
                value={String(summary.contested)}
                label="WCAG and APCA disagree"
                tone="warn"
              />
            )}
            <button
              className="btn btn-primary ml-auto"
              disabled={summary.failing === 0}
              onClick={() => setReviewing(true)}
            >
              Fix all
            </button>
          </div>

          <div className="card min-h-0 flex-1 overflow-hidden">
            <Matrix
              swatches={swatches}
              matrix={matrix}
              tier={tier}
              selected={livePair}
              onSelect={setSelected}
            />
          </div>
        </section>

        <div className="min-h-0">
          {livePair ? (
            <PairDetail
              pair={livePair}
              tier={tier}
              onApply={(id, hex) => update(id, { hex })}
              onClose={() => setSelected(null)}
            />
          ) : (
            <aside className="card flex h-full flex-col justify-center gap-2 p-4 text-center">
              <p className="label">Pick a cell</p>
              <p className="text-[12px] leading-relaxed text-[var(--muted)]">
                Every cell is drawn in the pairing it grades. Select one to see which criteria
                it meets, what APCA makes of it, and the nearest passing colour.
              </p>
            </aside>
          )}
        </div>
      </div>

      <footer className="rule-x border-b-0 border-t pt-3 text-[11px] leading-relaxed text-[var(--faint)]">
        WCAG 2.2 is the verdict — it is what audits and procurement reference. APCA is shown
        alongside because WCAG is blind to polarity and misjudges dark themes; where the two
        disagree the cell is marked, and that is a prompt to look, not a failure. Colour
        conversion, gamut mapping and the fix search are implemented here rather than
        imported, and are checked against published reference values on every build.
        Legible&rsquo;s own interface passes AA against both of its grounds.
      </footer>

      {reviewing && (
        <FixReview
          swatches={swatches}
          tier={tier}
          onApplyAll={applyMany}
          onClose={() => setReviewing(false)}
        />
      )}
    </main>
  );
}

function Figure({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone?: 'fail' | 'warn';
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span
        className="mono text-[19px] leading-none"
        style={{ color: tone ? `var(--${tone})` : 'var(--ink)' }}
      >
        {value}
      </span>
      <span className="text-[11px] text-[var(--muted)]">{label}</span>
    </div>
  );
}
