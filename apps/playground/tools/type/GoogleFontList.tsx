'use client';

/**
 * Every Google Fonts family, right in the panel, as plain names.
 *
 * Nothing is fetched to show the list — the names come with the app. A font is
 * fetched only when its name is clicked, and applied once it has arrived, so
 * the poster never flickers through a fallback. Only the rows in view exist.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './fontList.module.css';
import { CATEGORIES, loadCatalogue, loadFamily, type GoogleFamily } from '@/lib/googleFonts';

const ROW = 34;
const HEIGHT = 272;
const OVERSCAN = 8;
type Filter = 'all' | (typeof CATEGORIES)[number];

export default function GoogleFontList({ current, onPick }: { current: string; onPick: (font: GoogleFamily) => void }) {
  const [fonts, setFonts] = useState<GoogleFamily[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [scrollTop, setScrollTop] = useState(0);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadCatalogue().then(setFonts, () => setFailed(true));
  }, []);

  const results = useMemo(() => {
    if (!fonts) return [];
    const q = query.trim().toLowerCase();
    const matches = fonts.filter((f) => (filter === 'all' || f.category === filter) && (!q || f.family.toLowerCase().includes(q)));
    return q ? matches.sort((a, b) => Number(!a.family.toLowerCase().startsWith(q)) - Number(!b.family.toLowerCase().startsWith(q))) : matches;
  }, [fonts, query, filter]);

  useEffect(() => {
    setScrollTop(0);
    if (list.current) list.current.scrollTop = 0;
  }, [query, filter]);

  const first = Math.max(0, Math.floor(scrollTop / ROW) - OVERSCAN);
  const last = Math.min(results.length, Math.ceil((scrollTop + HEIGHT) / ROW) + OVERSCAN);

  const pick = async (font: GoogleFamily) => {
    if (loading) return;
    setLoading(font.family);
    setError(null);
    try {
      await loadFamily(font);
      onPick(font);
    } catch {
      setError(navigator.onLine
        ? `Couldn’t load ${font.family}. Try again.`
        : `${font.family} needs a connection the first time.`);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <input
          className={styles.search}
          type="search"
          placeholder={fonts ? `Search ${fonts.length.toLocaleString()} Google Fonts` : 'Search Google Fonts'}
          aria-label="Search Google Fonts"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select className={styles.select} aria-label="Category" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
          <option value="all">All</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c === 'Sans Serif' ? 'Sans' : c === 'Monospace' ? 'Mono' : c}</option>)}
        </select>
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div
        ref={list}
        className={styles.list}
        style={{ height: HEIGHT }}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        role="group"
        aria-label="Google Fonts families"
      >
        {failed ? (
          <p className={styles.note}>Couldn’t open the font list. Reload and try again.</p>
        ) : !fonts ? (
          <p className={styles.note}>Loading names…</p>
        ) : results.length === 0 ? (
          <p className={styles.note}>No family called “{query}”.</p>
        ) : (
          <div style={{ height: results.length * ROW, position: 'relative' }}>
            {results.slice(first, last).map((font, i) => {
              const index = first + i;
              const on = `google:${font.family}` === current;
              return (
                <button
                  key={font.family}
                  type="button"
                  className={`${styles.row} ${on ? styles.on : ''}`}
                  style={{ top: index * ROW }}
                  aria-pressed={on}
                  onClick={() => pick(font)}
                >
                  <span className={styles.name}>{font.family}</span>
                  <span className={styles.meta}>{loading === font.family ? 'Loading…' : on ? 'In use' : font.category === 'Sans Serif' ? 'Sans' : font.category === 'Monospace' ? 'Mono' : font.category}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <p className={styles.note}>A font downloads from Google Fonts when you click it, then works offline.</p>
    </div>
  );
}
