'use client';

import { formatRatio } from '@/lib/color/srgb';
import { TIERS, type TierId } from '@/lib/color/wcag';
import { canBeSurface, canBeText, type Pair, type Swatch } from '@/lib/palette';

/**
 * The grid is the product, and it used to arrive unexplained: a wall of numbers
 * with "Lc 104" under each one and no key. Now every cell carries a plain
 * verdict, the APCA figure has moved to the detail panel where there is room to
 * say what it means, and there is a legend directly above.
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
      <p className="prose-note">
        Every colour is currently marked &ldquo;
        {rows.length === 0 ? 'behind' : 'on top'}&rdquo;, so there are no pairs to check. Set
        at least one colour the other way above.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <Key swatchStyle={{ background: 'var(--sunk)' }} label="Passes" />
        <Key
          swatchStyle={{
            background: 'var(--sunk)',
            backgroundImage:
              'repeating-linear-gradient(135deg, var(--ghost) 0 1.5px, transparent 1.5px 7px)',
          }}
          label={`Fails — under ${TIERS[tier].ratio}:1`}
        />
        <p className="text-[13px] text-[var(--muted)]">
          Each square is one colour <em>on</em> another. The number is the contrast ratio —
          bigger is easier to read. Click any square for detail.
        </p>
      </div>

      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <table className="border-separate" style={{ borderSpacing: '4px', minWidth: 'max-content' }}>
          <caption className="sr-only">
            Contrast of every foreground colour (rows) against every background colour
            (columns)
          </caption>
          <thead>
            <tr>
              <th className="sticky left-0 z-30 bg-[var(--card)] p-2 text-left align-bottom">
                <span className="eyebrow !text-[10.5px]">on &darr; / behind &rarr;</span>
              </th>
              {cols.map((bg) => (
                <th key={bg.id} scope="col" className="p-1 align-bottom">
                  <span className="flex flex-col items-center gap-1.5">
                    <span
                      className="h-5 w-16 rounded-[6px]"
                      style={{ background: bg.hex }}
                      aria-hidden
                    />
                    <span className="mono max-w-[100px] truncate text-[11px] text-[var(--muted)]">
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
                <th scope="row" className="sticky left-0 z-20 bg-[var(--card)] p-2 text-left">
                  <span className="flex items-center gap-2">
                    <span
                      className="h-5 w-5 shrink-0 rounded-[6px]"
                      style={{ background: fg.hex }}
                      aria-hidden
                    />
                    <span className="mono max-w-[120px] truncate text-[11px] text-[var(--muted)]">
                      {fg.name}
                    </span>
                  </span>
                </th>
                {cols.map((bg, c) => {
                  const pair = matrix[r][c];
                  const ok = pair.grade.results[tier];
                  const isSelected = selected?.fg.id === fg.id && selected?.bg.id === bg.id;

                  if (fg.id === bg.id) {
                    return (
                      <td key={bg.id}>
                        <div
                          className="flex h-[68px] w-[104px] items-center justify-center rounded-[12px] bg-[var(--sunk)]"
                          title="The same colour on itself"
                        >
                          <span className="mono text-[11px] text-[var(--ghost)]">—</span>
                        </div>
                      </td>
                    );
                  }

                  return (
                    <td key={bg.id}>
                      <button
                        onClick={() => onSelect(pair)}
                        aria-label={`${fg.name} on ${bg.name}. Contrast ${formatRatio(pair.ratio)} to 1. ${ok ? 'Passes' : 'Fails'}.`}
                        aria-pressed={isSelected}
                        className="relative flex h-[70px] w-[106px] flex-col items-center justify-center gap-0.5 overflow-hidden rounded-[14px] transition-transform hover:scale-[1.04] focus:outline-none"
                        style={{
                          background: bg.hex,
                          color: fg.hex,
                          boxShadow: isSelected ? '0 0 0 3px var(--ink)' : 'none',
                        }}
                      >
                        {!ok && (
                          // Failure is carried by texture as well as by the number,
                          // so the grid never depends on colour perception alone.
                          <span
                            aria-hidden
                            className="pointer-events-none absolute inset-0 opacity-30"
                            style={{
                              backgroundImage:
                                'repeating-linear-gradient(135deg, currentColor 0 1px, transparent 1px 7px)',
                            }}
                          />
                        )}
                        <span className="relative mono text-[16px] font-semibold leading-none">
                          {formatRatio(pair.ratio)}
                        </span>
                        <span className="relative text-[10px] font-semibold uppercase tracking-wider opacity-85">
                          {ok ? 'passes' : 'fails'}
                        </span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Key({
  swatchStyle,
  label,
}: {
  swatchStyle: React.CSSProperties;
  label: string;
}) {
  return (
    <span className="flex items-center gap-2">
      <span
        aria-hidden
        className="h-6 w-9 rounded-[7px]"
        style={swatchStyle}
      />
      <span className="text-[13px] text-[var(--muted)]">{label}</span>
    </span>
  );
}
