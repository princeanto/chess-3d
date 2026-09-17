'use client';

/**
 * "What are you trying to do?" — the search that understands.
 *
 * Results show the tool, its one line and its category with the words you
 * typed marked, and where the question already has an answer (18% of ₹2,500),
 * the answer itself. Enter opens the top tool with your numbers filled in.
 */

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { understand, highlightTerms, type Match } from '@/utils/intent';
import { categoryById, toolHref, TOOLS, toolById, type ToolInfo } from '@/data/tools';
import { useApp } from './AppState';

const EXAMPLES = [
  'Resize an image to 1MB',
  'Split ₹2,500 between 4 people',
  'Convert 5 feet to cm',
  'Remove duplicate lines',
  'Create a QR code',
  'Calculate 18% of ₹2,500',
  'How many days until December 25?',
  '18% GST on ₹1,000',
];

export function Highlight({ text, terms }: { text: string; terms: string[] }) {
  if (!terms.length) return <>{text}</>;
  const pattern = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  const parts = text.split(pattern);
  return <>{parts.map((part, i) => (i % 2 === 1 ? <mark key={i}>{part}</mark> : part))}</>;
}

/** Search results for a query; with no query, the given fallback tools. */
export function useSearch(query: string, fallback: ToolInfo[] = []): Match[] {
  return useMemo(() => {
    const q = query.trim();
    if (!q) return fallback.map((tool) => ({ tool, score: 0 }));
    return understand(q);
  }, [query, fallback]);
}

export function ResultList({ matches, query, active, onHover, onPick, id, empty }: {
  matches: Match[]; query: string; active: number; onHover: (i: number) => void; onPick: (m: Match) => void; id: string; empty?: ReactNode;
}) {
  const terms = useMemo(() => highlightTerms(query), [query]);
  if (!matches.length) return <div className="results-empty">{empty ?? 'Nothing matches that yet. Try other words.'}</div>;
  return (
    <ul className="results" role="listbox" id={id}>
      {matches.map((m, i) => (
        <li
          key={m.tool.id}
          id={`${id}-${i}`}
          role="option"
          aria-selected={i === active}
          className={`result-item${i === active ? ' is-active' : ''}`}
          onMouseMove={() => i !== active && onHover(i)}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(m)}
        >
          <span className="result-main">
            <span className="result-name"><Highlight text={m.tool.name} terms={terms} /></span>
            <span className="result-desc"><Highlight text={m.tool.description} terms={terms} /></span>
          </span>
          <span className="result-side">
            {m.answer && <span className="result-answer">{m.answer}</span>}
            <span className="result-cat">{categoryById(m.tool.category)?.label}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function SearchBox({ hero = false, autoFocus = false }: { hero?: boolean; autoFocus?: boolean }) {
  const router = useRouter();
  const { recents } = useApp();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [example, setExample] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const matches = useSearch(query);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    if (!hero || query) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const id = window.setInterval(() => setExample((n) => (n + 1) % EXAMPLES.length), 3200);
    return () => window.clearInterval(id);
  }, [hero, query]);
  useEffect(() => { if (autoFocus && window.matchMedia('(hover: hover)').matches) input.current?.focus(); }, [autoFocus]);

  const pick = (m: Match | undefined) => {
    if (!m) return;
    setOpen(false);
    router.push(toolHref(m.tool.id, m.params));
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(matches.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(matches[active]); }
    else if (e.key === 'Escape') { if (query) setQuery(''); else input.current?.blur(); setOpen(false); }
  };

  const recentTools = recents.slice(0, 3).map((r) => toolById(r.id)).filter(Boolean) as ToolInfo[];
  const showResults = open && query.trim().length > 0;

  return (
    <div className={`search${hero ? ' search-hero' : ''}`}>
      <div className="search-field">
        <svg className="search-icon" viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" /><path d="M13 13l4 4" /></svg>
        <input
          ref={input}
          id={hero ? 'home-search' : undefined}
          className="search-input"
          type="search"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKey}
          placeholder={hero ? '' : 'Search tools…'}
          aria-label="What are you trying to do?"
          role="combobox"
          aria-expanded={showResults}
          aria-controls="search-results"
          aria-activedescendant={showResults && matches[active] ? `search-results-${active}` : undefined}
          autoComplete="off"
          spellCheck={false}
        />
        {hero && !query && (
          <span className="search-ghost" aria-hidden="true">
            <span className="search-ghost-q">What are you trying to do?</span>
            <span key={example} className="search-ghost-example">{EXAMPLES[example]}</span>
          </span>
        )}
      </div>
      {showResults && (
        <div className="search-panel">
          <ResultList id="search-results" matches={matches} query={query} active={active} onHover={setActive} onPick={pick} />
          <p className="search-foot"><span>↑↓ to move · Enter to open</span><span>Runs on this device</span></p>
        </div>
      )}
      {hero && !showResults && recentTools.length > 0 && (
        <p className="search-recent">
          Recently:{' '}
          {recentTools.map((tool, i) => (
            <span key={tool.id}>
              <a href={toolHref(tool.id)} onClick={(e) => { e.preventDefault(); router.push(toolHref(tool.id)); }}>{tool.name}</a>
              {i < recentTools.length - 1 ? ' · ' : ''}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

export { TOOLS };
