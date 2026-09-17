'use client';

/**
 * Every Google Fonts family: search, filter, pick.
 *
 * Nearly two thousand rows, so only the ones in view exist, and only those
 * fetch a preview — each one just the letters of its own name, a few hundred
 * bytes. Picking loads the real font, and only then does the dialog close, so
 * the poster never flashes the wrong face.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import styles from './fontBrowser.module.css';
import { Segmented } from '@/components/ui';
import { CATEGORIES, loadCatalogue, loadFamily, loadPreview, type GoogleFamily } from '@/lib/googleFonts';

const ROW = 56;
const OVERSCAN = 6;
type Filter = 'all' | (typeof CATEGORIES)[number];
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'Sans Serif', label: 'Sans' },
  { id: 'Serif', label: 'Serif' },
  { id: 'Display', label: 'Display' },
  { id: 'Handwriting', label: 'Handwriting' },
  { id: 'Monospace', label: 'Mono' },
];

function describe(font: GoogleFamily): string {
  const styles = font.weights.length + font.italics.length;
  if (font.wght) return `Variable ${font.wght[0]}–${font.wght[1]}${font.italics.length ? ' + italic' : ''}`;
  return styles === 1 ? '1 style' : `${styles} styles`;
}

export default function FontBrowser({ current, onPick, onClose }: {
  current: string;
  onPick: (font: GoogleFamily) => void;
  onClose: () => void;
}) {
  const [fonts, setFonts] = useState<GoogleFamily[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [active, setActive] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [aliases, setAliases] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const height = 440;

  useEffect(() => {
    returnTo.current = document.activeElement as HTMLElement | null;
    input.current?.focus();
    setOnline(navigator.onLine);
    loadCatalogue().then(setFonts, () => setFailed(true));
    return () => returnTo.current?.focus?.();
  }, []);

  const results = useMemo(() => {
    if (!fonts) return [];
    const q = query.trim().toLowerCase();
    const matches = fonts.filter((f) => (filter === 'all' || f.category === filter) && (!q || f.family.toLowerCase().includes(q)));
    // A name that starts with what was typed beats one that merely contains it.
    return q ? matches.sort((a, b) => Number(!a.family.toLowerCase().startsWith(q)) - Number(!b.family.toLowerCase().startsWith(q))) : matches;
  }, [fonts, query, filter]);

  useEffect(() => {
    setActive(0);
    setScrollTop(0);
    if (list.current) list.current.scrollTop = 0;
  }, [query, filter]);

  const first = Math.max(0, Math.floor(scrollTop / ROW) - OVERSCAN);
  const viewHeight = list.current?.clientHeight || height;
  const last = Math.min(results.length, Math.ceil((scrollTop + viewHeight) / ROW) + OVERSCAN);
  const visible = results.slice(first, last);

  /* Previews for the rows in view, once scrolling pauses. */
  const visibleKey = visible.map((f) => f.family).join('|');
  useEffect(() => {
    if (!online) return;
    const timer = window.setTimeout(() => {
      for (const font of visible) {
        if (aliases[font.family]) continue;
        loadPreview(font).then((alias) => setAliases((a) => (a[font.family] ? a : { ...a, [font.family]: alias })), () => undefined);
      }
    }, 90);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleKey, online]);

  const pick = useCallback(async (font: GoogleFamily | undefined) => {
    if (!font || loading) return;
    setLoading(font.family);
    setError(null);
    try {
      await loadFamily(font);
      onPick(font);
      onClose();
    } catch {
      setError(navigator.onLine
        ? `Couldn’t load ${font.family}. Try again in a moment.`
        : `${font.family} needs a connection the first time. Fonts you’ve used before still work offline.`);
    } finally {
      setLoading(null);
    }
  }, [loading, onPick, onClose]);

  const moveTo = (index: number) => {
    const next = Math.max(0, Math.min(results.length - 1, index));
    setActive(next);
    const box = list.current;
    if (!box) return;
    if (next * ROW < box.scrollTop) box.scrollTop = next * ROW;
    else if ((next + 1) * ROW > box.scrollTop + box.clientHeight) box.scrollTop = (next + 1) * ROW - box.clientHeight;
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); moveTo(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveTo(active - 1); }
    else if (e.key === 'PageDown') { e.preventDefault(); moveTo(active + 8); }
    else if (e.key === 'PageUp') { e.preventDefault(); moveTo(active - 8); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(results[active]); }
  };

  return (
    <div className={styles.scrim} onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="gf-title" onKeyDown={onKey}>
        <div className={styles.head}>
          <h2 id="gf-title" className={styles.title}>Google Fonts</h2>
          <span className={styles.total}>{fonts ? `${results.length.toLocaleString()} of ${fonts.length.toLocaleString()}` : ''}</span>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">Esc</button>
        </div>
        <input
          ref={input}
          className={styles.search}
          type="search"
          placeholder="Search families"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          role="combobox"
          aria-expanded="true"
          aria-controls="gf-list"
          aria-activedescendant={results[active] ? `gf-${active}` : undefined}
        />
        <div className={styles.filters}>
          <Segmented label="Category" value={filter} onChange={setFilter} options={FILTERS} />
        </div>

        {!online && <p className={styles.notice}>You’re offline. Browsing works; a font you haven’t used before needs a connection to load.</p>}
        {error && <p className={styles.notice} role="alert">{error}</p>}

        <div
          ref={list}
          id="gf-list"
          role="listbox"
          aria-label="Font families"
          className={styles.list}
          style={{ height }}
          onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        >
          {failed ? (
            <p className={styles.empty}>Couldn’t open the font list. Reload and try again.</p>
          ) : !fonts ? (
            <p className={styles.empty}>Loading the catalogue…</p>
          ) : results.length === 0 ? (
            <p className={styles.empty}>No family called “{query}”.</p>
          ) : (
            <div style={{ height: results.length * ROW, position: 'relative' }}>
              {visible.map((font, i) => {
                const index = first + i;
                const alias = aliases[font.family];
                const on = `google:${font.family}` === current;
                return (
                  <div
                    key={font.family}
                    id={`gf-${index}`}
                    role="option"
                    aria-selected={index === active}
                    className={`${styles.option} ${index === active ? styles.active : ''}`}
                    style={{ top: index * ROW }}
                    onPointerMove={() => index !== active && setActive(index)}
                    onClick={() => pick(font)}
                  >
                    <span className={styles.name} style={alias ? { fontFamily: `'${alias}', ${font.category === 'Serif' ? 'serif' : 'sans-serif'}` } : { color: 'var(--muted)' }}>
                      {font.family}
                    </span>
                    <span className={styles.meta}>
                      {loading === font.family ? 'Loading…' : on ? 'In use' : `${font.category} · ${describe(font)}`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <p className={styles.foot}>
          Every family is open source and free to use in anything. Fonts load from Google Fonts when you pick them, so Google sees your IP address then, and they stay on this device afterwards.
        </p>
      </div>
    </div>
  );
}
