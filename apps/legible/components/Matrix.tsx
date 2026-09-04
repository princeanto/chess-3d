'use client';

import { formatRatio } from '@/lib/color/srgb';
import type { TierId } from '@/lib/color/wcag';
import { canBeSurface, canBeText, type Pair, type Swatch } from '@/lib/palette';

/**
 * The matrix is the product.
 *
 * Each cell is drawn in the pairing it describes — the foreground's own text on
 * the background's own colour — because a table of numbers is not evidence. The
 * ratio sits on top so the judgement and the number are read in one movement,
 * and cells that fail carry a hatch so the grid stays parseable without relying
 * on colour, which would be an odd thing for this tool to get wrong.
 */
export default function Matrix({
  swatches,
  matrix,
  tier,
  selected,
  onSelect,
}: {
  swatches: Swatch[];
  matrix: Pair[][];
  tier: TierId;
  selected: Pair | null;
  onSelect: (pair: Pair) => void;
}) {
  const rows = swatches.filter(canBeText);
  const cols = swatches.filter(canBeSurface);

  if (rows.length === 0 || cols.length === 0) {
    return (
      <p className="p-6 text-[12.5px] text-[var(--muted)]">
        Every colour is marked {rows.length === 0 ? '"surface"' : '"text"'}, so there are no
        pairs to grade. Set at least one the other way.
      </p>
    );
  }

  return (
    <div className="overflow-auto">
      <table className="border-collapse" style={{ minWidth: 'max-content' }}>
        <caption className="sr-only">
          Contrast of every foreground colour (rows) against every background colour
          (columns)
        </caption>
        <thead>
          <tr>
            <th className="sticky left-0 top-0 z-30 bg-[var(--paper)] p-2 text-left">
              <span className="label">fg &darr; / bg &rarr;</span>
            </th>
            {cols.map((bg) => (
              <th
                key={bg.id}
                scope="col"
                className="sticky top-0 z-20 bg-[var(--paper)] p-1.5 align-bottom"
              >
                <span className="flex flex-col items-center gap-1">
                  <span
                    className="h-4 w-12 rounded-[2px] border border-[var(--rule-strong)]"
                    style={{ background: bg.hex }}
                    aria-hidden
                  />
                  <span className="mono max-w-[86px] truncate text-[10px] text-[var(--muted)]">
                    {bg.name}
                  </span>
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((fg, r) => (
            <tr key={fg.id}>
              <th scope="row" className="sticky left-0 z-20 bg-[var(--paper)] p-1.5 text-left">
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-4 w-4 shrink-0 rounded-[2px] border border-[var(--rule-strong)]"
                    style={{ background: fg.hex }}
                    aria-hidden
                  />
                  <span className="mono max-w-[104px] truncate text-[10px] text-[var(--muted)]">
                    {fg.name}
                  </span>
                </span>
              </th>
              {cols.map((bg, c) => {
                const pair = matrix[r][c];
                const same = fg.id === bg.id;
                const ok = pair.grade.results[tier];
                const isSelected = selected?.fg.id === fg.id && selected?.bg.id === bg.id;

                if (same) {
                  return (
                    <td key={bg.id} className="p-0.5">
                      <div
                        className="flex h-[52px] w-[92px] items-center justify-center border border-dashed border-[var(--rule)] text-[var(--faint)]"
                        aria-label="Same colour"
                      >
                        <span className="mono text-[10px]">—</span>
                      </div>
                    </td>
                  );
                }

                return (
                  <td key={bg.id} className="p-0.5">
                    <button
                      onClick={() => onSelect(pair)}
                      aria-label={`${fg.name} on ${bg.name}, ratio ${formatRatio(pair.ratio)} to 1, ${ok ? 'passes' : 'fails'}`}
                      aria-pressed={isSelected}
                      className="relative flex h-[52px] w-[92px] items-center justify-center overflow-hidden rounded-[2px] transition-[outline] focus:outline-none"
                      style={{
                        background: bg.hex,
                        color: fg.hex,
                        outline: isSelected
                          ? '2px solid var(--accent)'
                          : '1px solid var(--rule)',
                        outlineOffset: isSelected ? '1px' : '-1px',
                      }}
                    >
                      {!ok && (
                        // Failure is marked by texture as well as by the number,
                        // so the grid does not depend on colour perception.
                        <span
                          aria-hidden
                          className="pointer-events-none absolute inset-0 opacity-[0.28]"
                          style={{
                            backgroundImage:
                              'repeating-linear-gradient(135deg, currentColor 0 1px, transparent 1px 6px)',
                          }}
                        />
                      )}
                      <span className="relative flex flex-col items-center leading-none">
                        <span className="mono text-[13px] font-semibold">
                          {formatRatio(pair.ratio)}
                        </span>
                        <span className="mono mt-0.5 text-[9px] opacity-80">
                          Lc {Math.round(Math.abs(pair.lc))}
                        </span>
                      </span>
                      {pair.contested && (
                        <span
                          aria-hidden
                          title="WCAG and APCA disagree here"
                          className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full"
                          style={{ background: 'var(--accent)' }}
                        />
                      )}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
