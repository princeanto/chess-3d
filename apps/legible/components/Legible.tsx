'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { TIERS } from '@/lib/color/wcag';
import { type Role } from '@/lib/palette';
import { buildMatrix, makeSwatch, summarise, type Pair, type Swatch } from '@/lib/palette';
import FixReview from './FixReview';
import LevelPicker, { toTier, type Level, type Size } from './LevelPicker';
import Matrix from './Matrix';
import PairDetail from './PairDetail';
import SourcePicker, { type Incoming } from './SourcePicker';
import SwatchList from './SwatchList';
import Step from './Step';

export default function Legible() {
  const [swatches, setSwatches] = useState<Swatch[]>([]);
  const [size, setSize] = useState<Size>('normal');
  const [level, setLevel] = useState<Level>('aa');
  const [selected, setSelected] = useState<Pair | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const tier = toTier(size, level);

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

  const load = useCallback((incoming: Incoming[]) => {
    setSwatches(incoming.map((c) => makeSwatch(c.name, c.hex, c.role)));
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

  const hasColours = swatches.length > 0;
  const pct = summary.total === 0 ? 0 : Math.round((summary.passing / summary.total) * 100);

  return (
    <main className="mx-auto w-full max-w-[1180px] px-6 py-12 lg:px-10 lg:py-16">
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-[62ch]">
          <h1 className="serif text-[44px] leading-[1.05] lg:text-[54px]">Legible</h1>
          <p className="mt-4 text-[17px] leading-relaxed text-[var(--muted)]">
            Checks whether the colours in your product are readable. Show it a screenshot, a
            web address, or a list of colour codes — it grades every combination against the
            accessibility standard, then fixes the ones that fail without changing the colour
            you chose.
          </p>
        </div>
        <div className="seg shrink-0">
          <button aria-pressed={theme === 'light'} onClick={() => setMode('light')}>
            Light
          </button>
          <button aria-pressed={theme === 'dark'} onClick={() => setMode('dark')}>
            Dark
          </button>
        </div>
      </header>

      <div className="mt-14 flex flex-col gap-14">
        <Step
          number={1}
          title="Show it your colours"
          description="Any of these works. A screenshot is usually the quickest, and never leaves your computer."
        >
          <SourcePicker onLoad={load} />
        </Step>

        {hasColours && (
          <>
            <Step
              number={2}
              title="Say where each one is used"
              description="A colour used as a background is never tested as text, and the other way round. Getting this right keeps the results to the combinations you would actually ship."
            >
              <SwatchList swatches={swatches} onUpdate={update} onRemove={remove} />
            </Step>

            <Step
              number={3}
              title="Choose what you're checking"
              description="The standard asks for different contrast depending on how big the text is, because larger type is easier to read at lower contrast."
            >
              <LevelPicker size={size} level={level} onSize={setSize} onLevel={setLevel} />
            </Step>

            <Step
              number={4}
              title="The results"
              aside={
                <button
                  className="btn btn-primary"
                  disabled={summary.failing === 0}
                  onClick={() => setReviewing(true)}
                >
                  {summary.failing === 0 ? 'Nothing to fix' : `Fix the ${summary.failing} failures`}
                </button>
              }
            >
              <div className="flex flex-col gap-6">
                <div className="card flex flex-wrap items-center gap-x-10 gap-y-4 p-5">
                  <Figure
                    value={`${pct}%`}
                    caption={`${summary.passing} of ${summary.total} combinations are readable`}
                  />
                  {summary.failing > 0 && (
                    <Figure value={String(summary.failing)} caption="need attention" tone="fail" />
                  )}
                  <p className="max-w-[40ch] text-[13px] leading-snug text-[var(--faint)]">
                    Measured against {TIERS[tier].ratio}:1, the level {TIERS[tier].criterion}{' '}
                    asks for.
                  </p>
                </div>

                <Matrix
                  swatches={swatches}
                  matrix={matrix}
                  tier={tier}
                  selected={livePair}
                  onSelect={setSelected}
                />
              </div>
            </Step>
          </>
        )}
      </div>

      <footer className="mt-20 border-t border-[var(--rule)] pt-6">
        <p className="prose-note !max-w-[76ch] !text-[13px]">
          Grading follows WCAG 2.2, the standard accessibility audits reference. Fixes move a
          colour&rsquo;s lightness in OKLCH, a colour space built so that changing lightness
          does not drag hue along with it — which is why a fixed blue is still your blue.
          Colour conversion, gamut mapping and the fix search are implemented here rather than
          imported, and checked against published reference values on every build. Legible
          passes its own audit in both light and dark.
        </p>
      </footer>

      {livePair && (
        <PairDetail
          pair={livePair}
          tier={tier}
          onApply={(id, hex) => update(id, { hex })}
          onClose={() => setSelected(null)}
        />
      )}

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
  caption,
  tone,
}: {
  value: string;
  caption: string;
  tone?: 'fail';
}) {
  return (
    <div>
      <p
        className="mono text-[30px] leading-none"
        style={{ color: tone ? 'var(--fail)' : 'var(--ink)' }}
      >
        {value}
      </p>
      <p className="mt-1.5 text-[13.5px] text-[var(--muted)]">{caption}</p>
    </div>
  );
}

export type { Role };
