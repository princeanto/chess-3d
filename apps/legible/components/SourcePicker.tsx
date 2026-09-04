'use client';

import { useRef, useState } from 'react';
import { extractFromImage, loadImage, nameExtracted } from '@/lib/extract';
import { parsePalette, SAMPLE_PALETTE } from '@/lib/parse';
import { MAX_SWATCHES, type Role } from '@/lib/palette';

export interface Incoming {
  name: string;
  hex: string;
  role?: Role;
}

type Source = 'image' | 'site' | 'paste';

const TABS: Array<{ id: Source; label: string; blurb: string }> = [
  { id: 'image', label: 'A screenshot', blurb: 'Drop in a picture of your site or design' },
  { id: 'site', label: 'A web address', blurb: 'We read the colours off the page' },
  { id: 'paste', label: 'Colour codes', blurb: 'Paste hex values or a tokens file' },
];

export default function SourcePicker({ onLoad }: { onLoad: (colours: Incoming[]) => void }) {
  const [source, setSource] = useState<Source>('image');

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-3">
        {TABS.map((t) => {
          const active = source === t.id;
          return (
            <button
              key={t.id}
              aria-pressed={active}
              onClick={() => setSource(t.id)}
              className="card flex flex-col items-start gap-1 p-4 text-left transition-colors"
              style={{
                borderColor: active ? 'var(--accent)' : 'var(--rule)',
                background: active ? 'var(--accent-wash)' : 'var(--card)',
              }}
            >
              <span className="text-[15px] font-semibold">{t.label}</span>
              <span className="text-[13px] leading-snug text-[var(--muted)]">{t.blurb}</span>
            </button>
          );
        })}
      </div>

      {source === 'image' && <ImageSource onLoad={onLoad} />}
      {source === 'site' && <SiteSource onLoad={onLoad} />}
      {source === 'paste' && <PasteSource onLoad={onLoad} />}
    </div>
  );
}

/* ------------------------------- screenshot ------------------------------ */

function ImageSource({ onLoad }: { onLoad: (c: Incoming[]) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [count, setCount] = useState(8);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastFile = useRef<File | null>(null);

  const handle = async (file: File, howMany = count) => {
    setBusy(true);
    setError(null);
    try {
      lastFile.current = file;
      const { img, url } = await loadImage(file);
      // Release the previous preview only once the new one has decoded.
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old);
        return url;
      });
      const found = extractFromImage(img, howMany);
      if (found.length === 0) {
        setError('No colours could be read from that image.');
        return;
      }
      onLoad(nameExtracted(found).slice(0, MAX_SWATCHES));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That image could not be read.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_290px]">
      <div>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void handle(file);
          }}
          className="card flex flex-col items-center justify-center gap-3 px-6 py-12 text-center transition-colors"
          style={{
            borderStyle: 'dashed',
            borderColor: dragging ? 'var(--accent)' : 'var(--rule-strong)',
            background: dragging ? 'var(--accent-wash)' : 'var(--card)',
          }}
        >
          {preview ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={preview}
              alt="The screenshot the colours were taken from"
              className="max-h-[190px] w-auto rounded-[3px] border border-[var(--rule)]"
            />
          ) : (
            <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden className="text-[var(--faint)]">
              <rect x="2" y="6" width="30" height="22" rx="2" stroke="currentColor" strokeWidth="1.6" fill="none" />
              <circle cx="11" cy="14" r="3" stroke="currentColor" strokeWidth="1.6" fill="none" />
              <path d="M4 25l8-7 6 5 5-4 7 6" stroke="currentColor" strokeWidth="1.6" fill="none" />
            </svg>
          )}
          <p className="text-[14.5px]">
            {busy ? 'Reading the colours…' : 'Drag a screenshot here'}
          </p>
          <button className="btn" onClick={() => inputRef.current?.click()} disabled={busy}>
            {preview ? 'Choose a different image' : 'Choose an image'}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handle(file);
            }}
          />
        </div>

        {preview && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="text-[13.5px] text-[var(--muted)]">How many colours?</span>
            <div className="seg">
              {[5, 8, 12].map((n) => (
                <button
                  key={n}
                  aria-pressed={count === n}
                  onClick={() => {
                    setCount(n);
                    if (lastFile.current) void handle(lastFile.current, n);
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && <p className="mt-3 text-[13.5px]" style={{ color: 'var(--fail)' }}>{error}</p>}
      </div>

      <aside className="card p-4">
        <p className="eyebrow">How this works</p>
        <p className="mt-2.5 text-[13px] leading-relaxed text-[var(--muted)]">
          The image never leaves your computer. Every pixel is sorted into groups of
          perceptually similar colour, and the centre of each group becomes a swatch — so a
          gradient or a photo gives you the colours you actually see, not a thousand
          near-identical ones.
        </p>
        <p className="mt-3 border-t border-[var(--rule)] pt-3 text-[12.5px] leading-relaxed text-[var(--faint)]">
          Works best on a clean screenshot of a page or a design. Photographs give muddier
          results, because real light is never flat.
        </p>
      </aside>
    </div>
  );
}

/* --------------------------------- site --------------------------------- */

function SiteSource({ onLoad }: { onLoad: (c: Incoming[]) => void }) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const go = async () => {
    if (!url.trim()) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch('/api/site-colours', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = (await res.json()) as {
        colours?: Array<{ hex: string; count: number }>;
        site?: string;
        note?: string | null;
        error?: string;
      };
      if (!res.ok || data.error) {
        setError(data.error ?? 'That site could not be read.');
        return;
      }
      const colours = data.colours ?? [];
      if (colours.length === 0) {
        setError(data.note ?? 'No colours were found on that page.');
        return;
      }
      onLoad(
        colours.slice(0, MAX_SWATCHES).map((c, i) => ({
          name: i === 0 ? 'most-used' : `colour-${i + 1}`,
          hex: c.hex,
        })),
      );
      setNote(`Found ${colours.length} colours on ${data.site}. The most-used ones come first.`);
    } catch {
      setError('That site could not be reached.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_290px]">
      <div>
        <label htmlFor="site-url" className="sr-only">
          Web address
        </label>
        <div className="flex flex-wrap gap-2.5">
          <input
            id="site-url"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void go();
            }}
            placeholder="stripe.com"
            spellCheck={false}
            className="min-w-[220px] flex-1 px-3.5 py-3"
          />
          <button className="btn btn-primary" onClick={() => void go()} disabled={busy || !url.trim()}>
            {busy ? 'Reading…' : 'Read the colours'}
          </button>
        </div>
        {error && <p className="mt-3 text-[13.5px]" style={{ color: 'var(--fail)' }}>{error}</p>}
        {note && <p className="mt-3 text-[13.5px] text-[var(--muted)]">{note}</p>}
      </div>

      <aside className="card p-4">
        <p className="eyebrow">What this reads</p>
        <p className="mt-2.5 text-[13px] leading-relaxed text-[var(--muted)]">
          The colours written in the page&rsquo;s stylesheets — usually the design tokens the
          team actually defined, ordered by how often each is used.
        </p>
        <p className="mt-3 border-t border-[var(--rule)] pt-3 text-[12.5px] leading-relaxed text-[var(--faint)]">
          It cannot see colours that only appear once JavaScript runs, and it cannot see
          images. If the result looks thin or wrong, take a screenshot instead — that reads
          what is actually on screen.
        </p>
      </aside>
    </div>
  );
}

/* -------------------------------- paste --------------------------------- */

function PasteSource({ onLoad }: { onLoad: (c: Incoming[]) => void }) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = (text: string) => {
    const parsed = parsePalette(text);
    if (parsed.length === 0) {
      setError("Couldn't find any hex colours in that. They need to look like #1a73e8.");
      return;
    }
    setError(null);
    onLoad(parsed.slice(0, MAX_SWATCHES));
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_290px]">
      <div>
        <label htmlFor="palette" className="sr-only">
          Your colours
        </label>
        <textarea
          id="palette"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          spellCheck={false}
          rows={8}
          placeholder={'#1a73e8\n#ffffff\n#5c5a50'}
          className="mono w-full resize-y p-4 leading-relaxed"
        />
        <div className="mt-3 flex flex-wrap gap-2.5">
          <button className="btn btn-primary" onClick={() => load(draft)} disabled={!draft.trim()}>
            Check these colours
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
        {error && <p className="mt-3 text-[13.5px]" style={{ color: 'var(--fail)' }}>{error}</p>}
      </div>

      <aside className="card p-4">
        <p className="eyebrow">Formats it reads</p>
        <ul className="mt-2.5 flex flex-col gap-2 text-[13px] leading-snug text-[var(--muted)]">
          <li>
            <span className="mono text-[var(--ink)]">#1a73e8</span> — plain hex codes
          </li>
          <li>
            <span className="mono text-[var(--ink)]">--brand-500: #1a73e8;</span> — CSS
            variables
          </li>
          <li>
            <span className="mono text-[var(--ink)]">$brand: #1a73e8;</span> — Sass variables
          </li>
          <li>
            <span className="mono text-[var(--ink)]">{'{ "brand": "#1a73e8" }'}</span> — JSON
            and Tailwind scales
          </li>
        </ul>
      </aside>
    </div>
  );
}
