'use client';

import { nudge } from '@/lib/color/fix';
import { formatRatio } from '@/lib/color/srgb';
import { TIERS, TIER_ORDER, type TierId } from '@/lib/color/wcag';
import type { Pair } from '@/lib/palette';

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

  return (
    <aside className="card rise flex flex-col gap-3 p-3">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="label">Pair</p>
          <h2 className="mono mt-0.5 truncate text-[12.5px]">
            {pair.fg.name} <span className="text-[var(--faint)]">on</span> {pair.bg.name}
          </h2>
        </div>
        <button onClick={onClose} aria-label="Close pair detail" className="btn !min-h-[26px] !px-2">
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
            <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.4" />
          </svg>
        </button>
      </header>

      <div
        className="flex h-[86px] flex-col items-center justify-center gap-1 rounded-[2px] border border-[var(--rule)]"
        style={{ background: pair.bg.hex, color: pair.fg.hex }}
      >
        <span className="text-[17px] font-semibold leading-none">Body text sample</span>
        <span className="text-[11px] leading-none opacity-90">
          The quick brown fox jumps over the lazy dog
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Stat label="WCAG 2.2" value={`${formatRatio(pair.ratio)}:1`} />
        <Stat
          label="APCA"
          value={`Lc ${Math.abs(pair.lc).toFixed(1)}`}
          hint={pair.lc < 0 ? 'light on dark' : 'dark on light'}
        />
      </div>

      <ul className="flex flex-col gap-0.5">
        {TIER_ORDER.map((id) => {
          const t = TIERS[id];
          const ok = pair.grade.results[id];
          return (
            <li key={id} className="flex items-center gap-2 py-0.5">
              <span
                aria-hidden
                className="mono w-[30px] shrink-0 text-center text-[9.5px] font-semibold"
                style={{ color: ok ? 'var(--pass)' : 'var(--fail)' }}
              >
                {ok ? 'PASS' : 'FAIL'}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11.5px] leading-tight">{t.label}</span>
                <span className="block text-[10px] leading-tight text-[var(--faint)]">
                  {t.criterion} · needs {t.ratio}:1
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      <p className="border-t border-[var(--rule)] pt-2 text-[11px] leading-relaxed text-[var(--muted)]">
        {pair.apca.guidance}
        {pair.contested && (
          <>
            {' '}
            <span style={{ color: 'var(--accent)' }}>
              APCA and WCAG disagree about body text here — worth a human look.
            </span>
          </>
        )}
      </p>

      {failing && (
        <div className="border-t border-[var(--rule)] pt-2.5">
          <p className="label mb-1.5">Nearest passing value</p>
          {fix ? (
            <>
              <div className="flex items-stretch gap-2">
                <Chip hex={pair.fg.hex} caption="now" bg={pair.bg.hex} />
                <span className="self-center text-[var(--faint)]" aria-hidden>
                  &rarr;
                </span>
                <Chip hex={fix.hex} caption={`${formatRatio(fix.ratio)}:1`} bg={pair.bg.hex} />
              </div>
              <dl className="mono mt-2 grid grid-cols-3 gap-1 text-[10px]">
                <Delta label="ΔL" value={`${fix.deltaL > 0 ? '+' : ''}${(fix.deltaL * 100).toFixed(1)}%`} />
                <Delta label="ΔE" value={fix.deltaE.toFixed(3)} />
                <Delta label="hue" value={`${fix.hueShift.toFixed(2)}°`} />
              </dl>
              <p className="mt-1.5 text-[10.5px] leading-relaxed text-[var(--faint)]">
                {fix.deltaC > 0.001
                  ? `Chroma reduced by ${fix.deltaC.toFixed(3)} — sRGB cannot hold this hue at that lightness.`
                  : 'Hue and chroma held; only lightness moved.'}
              </p>
              <button
                className="btn btn-primary mt-2 w-full"
                onClick={() => onApply(pair.fg.id, fix.hex)}
              >
                Apply to {pair.fg.name}
              </button>
            </>
          ) : (
            <p className="text-[11.5px] leading-relaxed text-[var(--muted)]">
              No lightness of this hue reaches {target}:1 against {pair.bg.name}. Against a
              mid-tone background some hues simply cannot get there — the background has to
              move instead.
            </p>
          )}
        </div>
      )}
    </aside>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-[2px] border border-[var(--rule)] p-2">
      <p className="label !text-[9px]">{label}</p>
      <p className="mono mt-0.5 text-[15px] leading-none">{value}</p>
      {hint && <p className="mt-1 text-[9.5px] text-[var(--faint)]">{hint}</p>}
    </div>
  );
}

function Chip({ hex, caption, bg }: { hex: string; caption: string; bg: string }) {
  return (
    <div className="flex-1">
      <div
        className="flex h-11 items-center justify-center rounded-[2px] border border-[var(--rule)]"
        style={{ background: bg, color: hex }}
      >
        <span className="text-[12px] font-semibold">Aa</span>
      </div>
      <p className="mono mt-1 text-center text-[9.5px] text-[var(--faint)]">{hex}</p>
      <p className="mono text-center text-[9.5px] text-[var(--muted)]">{caption}</p>
    </div>
  );
}

function Delta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[2px] bg-[var(--sunk)] px-1.5 py-1 text-center">
      <dt className="text-[8.5px] uppercase tracking-wider text-[var(--faint)]">{label}</dt>
      <dd className="mt-0.5 text-[11px]">{value}</dd>
    </div>
  );
}
