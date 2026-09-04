'use client';

import { useState } from 'react';
import { parsePalette, SAMPLE_PALETTE } from '@/lib/parse';
import { MAX_SWATCHES, type Role, type Swatch } from '@/lib/palette';

const ROLES: Array<{ id: Role; label: string; title: string }> = [
  { id: 'both', label: 'Both', title: 'Used as text and as a background' },
  { id: 'text', label: 'Text', title: 'Only ever sits on top of something' },
  { id: 'surface', label: 'Surface', title: 'Only ever sits behind something' },
];

export default function PaletteInput({
  swatches,
  onReplace,
  onUpdate,
  onRemove,
}: {
  swatches: Swatch[];
  onReplace: (parsed: Array<{ name: string; hex: string }>) => void;
  onUpdate: (id: string, patch: Partial<Swatch>) => void;
  onRemove: (id: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const [note, setNote] = useState<string | null>(null);

  const load = (text: string) => {
    const parsed = parsePalette(text);
    if (parsed.length === 0) {
      setNote('No hex colours found in that.');
      return;
    }
    const capped = parsed.slice(0, MAX_SWATCHES);
    onReplace(capped);
    setNote(
      parsed.length > MAX_SWATCHES
        ? `Loaded the first ${MAX_SWATCHES} of ${parsed.length} — beyond that the matrix stops being readable.`
        : `Loaded ${capped.length} colours.`,
    );
  };

  return (
    <section className="flex min-h-0 flex-col gap-3">
      <div>
        <label htmlFor="palette" className="label">
          Palette
        </label>
        <textarea
          id="palette"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          spellCheck={false}
          rows={6}
          placeholder="Paste hex codes, CSS custom properties, or a JSON palette…"
          className="mono mt-1.5 w-full resize-y p-2.5 text-[11.5px] leading-relaxed"
        />
        <p className="mt-1 text-[11px] leading-snug text-[var(--faint)]">
          Understands bare hex, <code>--token: #hex</code>, <code>$token</code>, and JSON
          (including nested Tailwind scales).
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={() => load(draft)} disabled={!draft.trim()}>
            Load palette
          </button>
          <button
            className="btn"
            onClick={() => {
              setDraft(SAMPLE_PALETTE);
              load(SAMPLE_PALETTE);
            }}
          >
            Use a sample
          </button>
        </div>
        {note && <p className="mt-2 text-[11.5px] text-[var(--muted)]">{note}</p>}
      </div>

      {swatches.length > 0 && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="label mb-1.5 flex items-baseline justify-between">
            <span>{swatches.length} colours</span>
            <span>role</span>
          </div>
          <ul className="flex flex-col gap-1">
            {swatches.map((s) => (
              <li key={s.id} className="card flex items-center gap-2 p-1.5">
                <span
                  className="h-8 w-8 shrink-0 rounded-[2px] border border-[var(--rule-strong)]"
                  style={{ background: s.hex }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <input
                    type="text"
                    value={s.name}
                    onChange={(e) => onUpdate(s.id, { name: e.target.value })}
                    aria-label="Colour name"
                    className="w-full truncate border-none bg-transparent p-0 text-[12px] focus:outline-none"
                  />
                  <input
                    type="text"
                    value={s.hex}
                    onChange={(e) => onUpdate(s.id, { hex: e.target.value })}
                    aria-label="Hex value"
                    className="mono w-full border-none bg-transparent p-0 text-[10.5px] text-[var(--faint)] focus:outline-none"
                  />
                </span>
                <span className="seg shrink-0">
                  {ROLES.map((r) => (
                    <button
                      key={r.id}
                      title={r.title}
                      aria-pressed={s.role === r.id}
                      onClick={() => onUpdate(s.id, { role: r.id })}
                      className="!min-h-[26px] !px-1.5 !text-[10px]"
                    >
                      {r.label}
                    </button>
                  ))}
                </span>
                <button
                  onClick={() => onRemove(s.id)}
                  aria-label={`Remove ${s.name}`}
                  className="shrink-0 px-1 text-[var(--faint)] transition-colors hover:text-[var(--fail)]"
                >
                  <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden>
                    <path d="M1 1l9 9M10 1L1 10" stroke="currentColor" strokeWidth="1.4" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
