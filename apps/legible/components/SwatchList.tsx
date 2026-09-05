'use client';

import type { Role, Swatch } from '@/lib/palette';

/**
 * "Both / Text / Surface" meant nothing to anyone who had not read the source.
 * The question a designer can actually answer is where the colour sits, so that
 * is what is asked — and the answer visibly changes the grid, because it decides
 * which pairings are considered at all.
 */
const ROLES: Array<{ id: Role; label: string; hint: string }> = [
  { id: 'text', label: 'On top', hint: 'Only used for text, icons or lines' },
  { id: 'surface', label: 'Behind', hint: 'Only used as a background' },
  { id: 'both', label: 'Either', hint: 'Used both ways' },
];

export default function SwatchList({
  swatches,
  onUpdate,
  onRemove,
}: {
  swatches: Swatch[];
  onUpdate: (id: string, patch: Partial<Swatch>) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {swatches.map((s) => (
        <li key={s.id} className="flex items-start gap-3 rounded-[18px] bg-[var(--sunk)] p-3.5">
          <span
            className="mt-0.5 h-12 w-12 shrink-0 rounded-[12px]" 
            style={{ background: s.hex }}
            aria-hidden
          />
          <span className="min-w-0 flex-1">
            <input
              type="text"
              value={s.name}
              onChange={(e) => onUpdate(s.id, { name: e.target.value })}
              aria-label="Colour name"
              className="w-full truncate border-none bg-transparent p-0 text-[14.5px] focus:outline-none"
            />
            <input
              type="text"
              value={s.hex}
              onChange={(e) => onUpdate(s.id, { hex: e.target.value })}
              aria-label="Hex value"
              spellCheck={false}
              className="mono w-full border-none bg-transparent p-0 text-[12px] text-[var(--faint)] focus:outline-none"
            />
            <span className="seg mt-2">
              {ROLES.map((r) => (
                <button
                  key={r.id}
                  title={r.hint}
                  aria-pressed={s.role === r.id}
                  onClick={() => onUpdate(s.id, { role: r.id })}
                  className="!min-h-[30px] !px-2.5 !text-[12px]"
                >
                  {r.label}
                </button>
              ))}
            </span>
          </span>
          <button
            onClick={() => onRemove(s.id)}
            aria-label={`Remove ${s.name}`}
            className="shrink-0 p-1 text-[var(--faint)] transition-colors hover:text-[var(--fail)]"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        </li>
      ))}
    </ul>
  );
}
