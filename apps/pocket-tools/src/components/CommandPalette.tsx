'use client';

/** ⌘K: every tool, one keystroke away. Arrows to move, Enter to open, Escape to leave. */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toolById, toolHref, TOOLS, type ToolInfo } from '@/data/tools';
import type { Match } from '@/utils/intent';
import { useApp } from './AppState';
import { ResultList, useSearch } from './Search';

export default function CommandPalette() {
  const router = useRouter();
  const { setPaletteOpen, recents, favorites } = useApp();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  const fallback = useMemo(() => {
    const ids = [...favorites, ...recents.map((r) => r.id)];
    const first = [...new Set(ids)].map((id) => toolById(id)).filter(Boolean) as ToolInfo[];
    const rest = TOOLS.filter((t) => t.quick && !first.includes(t));
    return [...first, ...rest].slice(0, 8);
  }, [favorites, recents]);
  const matches = useSearch(query, fallback);

  useEffect(() => {
    returnTo.current = document.activeElement as HTMLElement | null;
    input.current?.focus();
    return () => returnTo.current?.focus?.();
  }, []);
  useEffect(() => setActive(0), [query]);

  const close = () => setPaletteOpen(false);
  const pick = (m: Match | undefined) => {
    if (!m) return;
    close();
    router.push(toolHref(m.tool.id, m.params));
  };

  return (
    <div className="palette-scrim" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Search tools">
        <div className="palette-field">
          <svg className="search-icon" viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" /><path d="M13 13l4 4" /></svg>
          <input
            ref={input}
            className="palette-input"
            value={query}
            placeholder="Search tools, or say what you need…"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(matches.length - 1, a + 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
              else if (e.key === 'Enter') { e.preventDefault(); pick(matches[active]); }
              else if (e.key === 'Escape') { e.preventDefault(); close(); }
            }}
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-results"
            aria-activedescendant={matches[active] ? `palette-results-${active}` : undefined}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="kbd">Esc</kbd>
        </div>
        {!query && <p className="palette-section">{recents.length || favorites.length ? 'Yours' : 'Quick tools'}</p>}
        <ResultList id="palette-results" matches={matches} query={query} active={active} onHover={setActive} onPick={pick} />
      </div>
    </div>
  );
}
