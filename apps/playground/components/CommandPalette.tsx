'use client';

/**
 * ⌘K. Every tool, every action the open tool offers, the theme, and Recent —
 * searchable, and runnable without touching the mouse.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, type Command } from '@/lib/store';
import { TOOLS } from '@/lib/tools';
import { ago } from '@/lib/storage';

export default function CommandPalette() {
  const store = useStore();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    returnTo.current = document.activeElement as HTMLElement | null;
    input.current?.focus();
    return () => returnTo.current?.focus?.();
  }, []);

  const close = () => store.setCommandOpen(false);

  const commands = useMemo<Command[]>(() => {
    const tool = store.actions();
    const list: Command[] = [];
    // The open tool's own actions come first: they are what you are most likely after.
    for (const command of tool.commands ?? []) list.push(command);
    if (tool.exportDefault) list.push({ id: 'export', label: 'Export current work', group: 'Actions', hint: 'E', run: tool.exportDefault });
    if (tool.clear) list.push({ id: 'clear', label: 'Clear canvas', group: 'Actions', run: tool.clear });
    for (const t of TOOLS) {
      list.push({ id: `open-${t.id}`, label: `Open ${t.title}`, group: 'Tools', hint: t.key.toUpperCase(), run: () => store.setTool(t.id) });
    }
    list.push({ id: 'open-saved', label: 'Open Saved', group: 'Tools', run: () => store.setTool('saved') });
    list.push({ id: 'challenge', label: 'Give me a challenge', group: 'Tools', run: () => store.setTool('play') });
    for (const theme of ['light', 'dark', 'system'] as const) {
      list.push({ id: `theme-${theme}`, label: `Theme: ${theme[0].toUpperCase()}${theme.slice(1)}`, group: 'Preferences', run: () => store.setTheme(theme) });
    }
    const now = Date.now();
    for (const recent of store.recents.slice(0, 8)) {
      list.push({ id: `recent-${recent.id}`, label: `${recent.kind} · ${ago(recent.at, now)}`, group: 'Recent', run: () => store.openRecent(recent) });
    }
    for (const item of store.saved.slice(0, 8)) {
      list.push({ id: `saved-${item.id}`, label: `${item.name} · ${item.kind}`, group: 'Saved', run: () => store.openSaved(item) });
    }
    return list;
    // The palette is rebuilt each time it opens, which is when this mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const results = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) return commands;
    return commands
      .filter((c) => words.every((w) => `${c.label} ${c.group}`.toLowerCase().includes(w)))
      .sort((a, b) => Number(!a.label.toLowerCase().startsWith(words[0])) - Number(!b.label.toLowerCase().startsWith(words[0])));
  }, [commands, query]);

  useEffect(() => setActive(0), [query]);

  const run = (command: Command | undefined) => {
    if (!command) return;
    close();
    // Let the dialog close first, so focus lands where the command sends it.
    window.setTimeout(command.run, 0);
  };

  let lastGroup = '';

  return (
    <div className="cmd-scrim" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div className="cmd" role="dialog" aria-modal="true" aria-label="Command palette">
        <input
          ref={input}
          className="cmd-input"
          placeholder="Search tools..."
          value={query}
          role="combobox"
          aria-expanded="true"
          aria-controls="cmd-list"
          aria-activedescendant={results[active] ? `cmd-${results[active].id}` : undefined}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { e.preventDefault(); close(); }
            else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(results.length - 1, i + 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
            else if (e.key === 'Enter') { e.preventDefault(); run(results[active]); }
          }}
        />
        <ul id="cmd-list" role="listbox" className="cmd-list">
          {results.length === 0 && <li className="cmd-empty">Nothing matches. Try “palette” or “export”.</li>}
          {results.map((command, i) => {
            const heading = command.group !== lastGroup ? command.group : null;
            lastGroup = command.group;
            return (
              <li key={command.id} role="presentation">
                {heading && <div className="cmd-group">{heading}</div>}
                <div
                  id={`cmd-${command.id}`}
                  role="option"
                  aria-selected={i === active}
                  className={`cmd-item${i === active ? ' on' : ''}`}
                  onPointerMove={() => setActive(i)}
                  onClick={() => run(command)}
                >
                  <span>{command.label}</span>
                  {command.hint && <kbd className="kbd">{command.hint}</kbd>}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
