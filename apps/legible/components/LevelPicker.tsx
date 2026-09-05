'use client';

import { TIERS, type TierId } from '@/lib/color/wcag';
import { Tile } from './Step';

/**
 * Five tier buttons labelled "Body AA / Body AAA / Large AA / Large AAA / UI
 * 3:1" asked the reader to already know WCAG. The same five options split into
 * two plain questions — what kind of thing, and which level — and each one says
 * what it is for and what number it demands.
 */

export type Size = 'normal' | 'large' | 'ui';
export type Level = 'aa' | 'aaa';

const SIZES: Array<{ id: Size; label: string; blurb: string }> = [
  { id: 'normal', label: 'Normal text', blurb: 'Body copy, labels, buttons — anything under 24px' },
  { id: 'large', label: 'Large text', blurb: 'Headings: 24px and up, or 18.7px bold' },
  { id: 'ui', label: 'UI & graphics', blurb: 'Icons, borders, focus rings, chart lines' },
];

export function toTier(size: Size, level: Level): TierId {
  if (size === 'ui') return 'non-text';
  if (size === 'large') return level === 'aaa' ? 'large-aaa' : 'large-aa';
  return level === 'aaa' ? 'body-aaa' : 'body-aa';
}

export default function LevelPicker({
  size,
  level,
  onSize,
  onLevel,
}: {
  size: Size;
  level: Level;
  onSize: (s: Size) => void;
  onLevel: (l: Level) => void;
}) {
  const tier = TIERS[toTier(size, level)];

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-2.5 sm:grid-cols-3">
        {SIZES.map((s) => (
          <Tile
            key={s.id}
            active={size === s.id}
            onClick={() => onSize(s.id)}
            title={s.label}
            blurb={s.blurb}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        {size !== 'ui' ? (
          <div className="flex items-center gap-3">
            <span className="text-[13.5px] text-[var(--muted)]">Level</span>
            <div className="seg">
              <button aria-pressed={level === 'aa'} onClick={() => onLevel('aa')}>
                AA
              </button>
              <button aria-pressed={level === 'aaa'} onClick={() => onLevel('aaa')}>
                AAA
              </button>
            </div>
          </div>
        ) : (
          <span className="text-[13.5px] text-[var(--muted)]">
            There is only one level for this — WCAG defines no AAA for non-text contrast.
          </span>
        )}

        <p className="text-[13.5px] text-[var(--muted)]">
          Needs{' '}
          <span className="mono font-semibold text-[var(--ink)]">{tier.ratio}:1</span>{' '}
          &middot; {tier.criterion}
        </p>
      </div>

      {level === 'aaa' && size !== 'ui' && (
        <p className="prose-note !text-[13px]">
          AAA is the enhanced level. Most teams are held to AA — AAA is usually only
          mandated for public-sector work, and hitting it across a whole palette is hard.
        </p>
      )}
    </div>
  );
}
