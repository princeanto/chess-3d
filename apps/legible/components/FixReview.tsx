'use client';

import { useMemo, useState } from 'react';
import { resolveSwatch, type Resolution } from '@/lib/color/fix';
import { contrastHex, formatRatio } from '@/lib/color/srgb';
import { TIERS, type TierId } from '@/lib/color/wcag';
import {
  requirementsFor,
  toCssVariables,
  toJson,
  toTailwind,
  type Swatch,
} from '@/lib/palette';

type Format = 'css' | 'json' | 'tailwind';

/**
 * The "fix all" review.
 *
 * The point of the screen is the left-hand column: the palette after the fix,
 * sitting next to the palette before it, so you can see at a glance that the
 * system still looks like itself. If the fixed palette reads as a different
 * brand, the tool has failed regardless of what the numbers say.
 */
export default function FixReview({
  swatches,
  tier,
  onApplyAll,
  onClose,
}: {
  swatches: Swatch[];
  tier: TierId;
  onApplyAll: (next: Array<{ id: string; hex: string }>) => void;
  onClose: () => void;
}) {
  const [format, setFormat] = useState<Format>('css');

  const resolutions = useMemo(() => {
    const out = new Map<string, Resolution>();
    for (const s of swatches) {
      out.set(s.id, resolveSwatch(s.hex, requirementsFor(s, swatches, tier)));
    }
    return out;
  }, [swatches, tier]);

  const changed = swatches.filter((s) => resolutions.get(s.id)?.status === 'ok');
  const conflicts = swatches.filter((s) => resolutions.get(s.id)?.status === 'conflict');

  const fixedSwatches = swatches.map((s) => {
    const r = resolutions.get(s.id);
    return r?.status === 'ok' ? { ...s, hex: r.fix.hex } : s;
  });

  const exported =
    format === 'css'
      ? toCssVariables(fixedSwatches)
      : format === 'json'
        ? toJson(fixedSwatches)
        : toTailwind(fixedSwatches);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fix-title"
    >
      <div className="card rise my-auto w-[min(96vw,900px)] p-7 sm:p-9">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h2 id="fix-title" className="display text-[30px]">
              Fixed palette
            </h2>
            <p className="mt-1.5 text-[12px] text-[var(--muted)]">
              {changed.length} of {swatches.length} colours moved to clear{' '}
              {TIERS[tier].short} ({TIERS[tier].ratio}:1). Hue held; only lightness changed.
            </p>
          </div>
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
          <div>
            <div className="eyebrow mb-2 grid grid-cols-[1fr_auto_1fr] gap-2">
              <span>before</span>
              <span />
              <span>after</span>
            </div>
            <ul className="flex flex-col gap-1">
              {swatches.map((s) => {
                const r = resolutions.get(s.id);
                const after = r?.status === 'ok' ? r.fix.hex : s.hex;
                return (
                  <li
                    key={s.id}
                    className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-[14px] bg-[var(--sunk)] p-2.5"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="h-8 w-8 shrink-0 rounded-[9px]"
                        style={{ background: s.hex }}
                        aria-hidden
                      />
                      <span className="min-w-0">
                        <span className="mono block truncate text-[11px]">{s.name}</span>
                        <span className="mono block text-[9.5px] text-[var(--faint)]">
                          {s.hex}
                        </span>
                      </span>
                    </span>

                    <span className="text-[var(--faint)]" aria-hidden>
                      {r?.status === 'ok' ? '→' : r?.status === 'conflict' ? '×' : '='}
                    </span>

                    <span className="flex items-center gap-2">
                      <span
                        className="h-8 w-8 shrink-0 rounded-[9px]"
                        style={{ background: after }}
                        aria-hidden
                      />
                      <span className="min-w-0">
                        <span className="mono block text-[9.5px] text-[var(--faint)]">
                          {after}
                        </span>
                        {r?.status === 'ok' && (
                          <span className="mono block text-[9.5px] text-[var(--muted)]">
                            ΔL {r.fix.deltaL > 0 ? '+' : ''}
                            {(r.fix.deltaL * 100).toFixed(1)}% · ΔE {r.fix.deltaE.toFixed(3)}
                          </span>
                        )}
                        {r?.status === 'unchanged' && (
                          <span className="text-[9.5px] text-[var(--faint)]">
                            already passing
                          </span>
                        )}
                        {r?.status === 'conflict' && (
                          <span className="text-[9.5px]" style={{ color: 'var(--fail)' }}>
                            cannot satisfy every pairing
                          </span>
                        )}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>

            {conflicts.length > 0 && (
              <div className="mt-4 rounded-[16px] bg-[var(--sunk)] p-4">
                <p className="eyebrow" style={{ color: 'var(--fail)' }}>
                  Needs a decision, not a nudge
                </p>
                <ul className="mt-1.5 flex flex-col gap-1.5">
                  {conflicts.map((s) => {
                    const r = resolutions.get(s.id);
                    if (r?.status !== 'conflict') return null;
                    return (
                      <li key={s.id} className="text-[11.5px] leading-relaxed">
                        <span className="mono">{s.name}</span> — {r.suggestion}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          <div className="flex flex-col">
            <div className="seg self-start">
              {(
                [
                  ['css', 'CSS'],
                  ['json', 'JSON'],
                  ['tailwind', 'Tailwind'],
                ] as Array<[Format, string]>
              ).map(([id, label]) => (
                <button key={id} aria-pressed={format === id} onClick={() => setFormat(id)}>
                  {label}
                </button>
              ))}
            </div>
            <pre className="mono mt-3 max-h-[300px] flex-1 overflow-auto rounded-[16px] bg-[var(--sunk)] p-4 text-[11px] leading-relaxed">
              {exported}
            </pre>
            <div className="mt-2 flex gap-2">
              <button
                className="btn flex-1"
                onClick={() => navigator.clipboard?.writeText(exported)}
              >
                Copy
              </button>
              <button
                className="btn btn-primary flex-1"
                disabled={changed.length === 0}
                onClick={() =>
                  onApplyAll(
                    changed.map((s) => {
                      const r = resolutions.get(s.id);
                      return { id: s.id, hex: r?.status === 'ok' ? r.fix.hex : s.hex };
                    }),
                  )
                }
              >
                Apply {changed.length}
              </button>
            </div>
            <p className="mt-2 text-[10.5px] leading-relaxed text-[var(--faint)]">
              Each colour is solved against every background it is paired with at once, so a
              fix for one pairing cannot break another. Where no single value satisfies them
              all, it is listed above rather than averaged into something that fails both.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export { contrastHex, formatRatio };
