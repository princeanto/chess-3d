'use client';

import { useEffect, useRef } from 'react';
import { nudge } from '@/lib/color/fix';
import { formatRatio } from '@/lib/color/srgb';
import { TIERS, TIER_ORDER, type TierId } from '@/lib/color/wcag';
import type { Pair } from '@/lib/palette';

/**
 * One pair, explained.
 *
 * This used to be a cramped side panel of unlabelled numbers. As a dialog there
 * is room to say what each number means, show the pairing at a readable size,
 * and put the proposed fix next to the original rather than describing it.
 */
export default function PairDetail({
  pair,
  tier,
  onApply,
  onClose,
}: {
  pair: Pair;
  tier: TierId;
  onApply: (swatchId: string, hex: string) => void;
  onClose: () => void;
}) {
  const target = TIERS[tier].ratio;
  const failing = !pair.grade.results[tier];
  const fix = failing ? nudge(pair.fg.hex, pair.bg.hex, target) : null;
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pair-title"
      onClick={onClose}
    >
      <div
        className="card rise my-auto w-[min(96vw,720px)] p-6 sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">The pairing</p>
            <h2 id="pair-title" className="serif mt-1 text-[26px] leading-tight">
              {pair.fg.name} on {pair.bg.name}
            </h2>
          </div>
          <button ref={closeRef} className="btn btn-sm" onClick={onClose}>
            Close
          </button>
        </header>

        <div
          className="mt-6 flex flex-col items-center justify-center gap-2 rounded-[3px] px-6 py-10"
          style={{ background: pair.bg.hex, color: pair.fg.hex }}
        >
          <span className="text-[24px] font-semibold leading-tight">This is a heading</span>
          <span className="text-[15px] leading-relaxed">
            And this is body text at a normal reading size.
          </span>
          <span className="text-[12.5px] opacity-90">Smaller print, like a caption.</span>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-[1fr_1fr]">
          <div>
            <p className="eyebrow">Contrast</p>
            <p className="mono mt-1 text-[34px] leading-none">{formatRatio(pair.ratio)}:1</p>
            <p className="mt-2 text-[13.5px] leading-snug text-[var(--muted)]">
              {failing
                ? `Below the ${target}:1 this level asks for.`
                : `Clears the ${target}:1 this level asks for.`}
            </p>
          </div>
          <div>
            <p className="eyebrow">Second opinion</p>
            <p className="mono mt-1 text-[34px] leading-none">
              {Math.abs(pair.lc).toFixed(0)}
            </p>
            <p className="mt-2 text-[13.5px] leading-snug text-[var(--muted)]">
              APCA score. {pair.apca.guidance}
            </p>
          </div>
        </div>

        {pair.contested && (
          <p
            className="mt-4 rounded-[3px] border p-3 text-[13.5px] leading-relaxed"
            style={{ borderColor: 'var(--accent)', background: 'var(--accent-wash)' }}
          >
            These two measures disagree about this pair. WCAG treats light-on-dark and
            dark-on-light identically; APCA does not, and it is usually closer to what the eye
            reports. Worth looking at with your own eyes before deciding.
          </p>
        )}

        <div className="mt-6">
          <p className="eyebrow">Where it stands against each level</p>
          <ul className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
            {TIER_ORDER.map((id) => {
              const t = TIERS[id];
              const ok = pair.grade.results[id];
              return (
                <li key={id} className="flex items-baseline gap-2.5 py-1">
                  <span
                    className="mono w-[34px] shrink-0 text-[11px] font-semibold"
                    style={{ color: ok ? 'var(--pass)' : 'var(--fail)' }}
                  >
                    {ok ? 'PASS' : 'FAIL'}
                  </span>
                  <span className="text-[13.5px] leading-snug">
                    {t.label}
                    <span className="text-[var(--faint)]"> — needs {t.ratio}:1</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {failing && (
          <div className="mt-6 border-t border-[var(--rule)] pt-6">
            <p className="eyebrow">The nearest colour that works</p>
            {fix ? (
              <>
                <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                  <Sample hex={pair.fg.hex} bg={pair.bg.hex} caption="Now" ratio={formatRatio(pair.ratio)} />
                  <span className="text-[20px] text-[var(--faint)]" aria-hidden>
                    &rarr;
                  </span>
                  <Sample hex={fix.hex} bg={pair.bg.hex} caption="Fixed" ratio={formatRatio(fix.ratio)} />
                </div>

                <p className="prose-note mt-4 !text-[13.5px]">
                  {fix.deltaL < 0 ? 'Darkened' : 'Lightened'} by{' '}
                  {Math.abs(fix.deltaL * 100).toFixed(1)}%, holding the hue to within{' '}
                  {fix.hueShift.toFixed(2)} of a degree.{' '}
                  {fix.deltaC > 0.001
                    ? 'A little saturation was given up because a screen cannot show this hue that bright at that lightness.'
                    : 'Saturation is untouched — it is the same colour, at a different lightness.'}
                </p>

                <button
                  className="btn btn-primary mt-4"
                  onClick={() => {
                    onApply(pair.fg.id, fix.hex);
                    onClose();
                  }}
                >
                  Use {fix.hex} for {pair.fg.name}
                </button>
              </>
            ) : (
              <p className="prose-note mt-2 !text-[13.5px]">
                No version of this colour reaches {target}:1 against {pair.bg.name}, however
                light or dark you make it. Against a mid-tone background some hues simply
                cannot get there — the background has to change instead.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Sample({
  hex,
  bg,
  caption,
  ratio,
}: {
  hex: string;
  bg: string;
  caption: string;
  ratio: string;
}) {
  return (
    <div>
      <div
        className="flex h-20 items-center justify-center rounded-[3px] border border-[var(--rule)]"
        style={{ background: bg, color: hex }}
      >
        <span className="text-[17px] font-semibold">Sample text</span>
      </div>
      <p className="mt-2 text-[13px] text-[var(--muted)]">
        {caption} — <span className="mono">{hex}</span>, {ratio}:1
      </p>
    </div>
  );
}
