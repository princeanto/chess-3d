'use client';

/** Favourites first, then the seven categories, then what you used lately. */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CATEGORIES, toolById, toolHref, toolsIn, type ToolInfo } from '@/data/tools';
import { useApp } from './AppState';
import { Kbd } from './ui';
import OfflineStatus from './OfflineStatus';

export default function Sidebar({ mod }: { mod: string }) {
  const path = usePathname();
  const { favorites, recents, setPaletteOpen, ready } = useApp();
  const currentTool = /^\/tools\/([^/]+)/.exec(path)?.[1];
  const currentCategory = /^\/c\/([^/]+)/.exec(path)?.[1] ?? (currentTool ? toolById(currentTool)?.category : undefined);
  const favoriteTools = favorites.map((id) => toolById(id)).filter(Boolean) as ToolInfo[];
  const recentTools = recents.map((r) => toolById(r.id)).filter((t): t is ToolInfo => !!t && !favorites.includes(t.id)).slice(0, 4);

  return (
    <aside className="sidebar" aria-label="Tools">
      <button type="button" className="side-search" onClick={() => setPaletteOpen(true)}>
        <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" /><path d="M13 13l4 4" /></svg>
        <span>Search</span>
        <Kbd>{mod}K</Kbd>
      </button>

      {ready && favoriteTools.length > 0 && (
        <nav className="side-group" aria-labelledby="fav-h">
          <p id="fav-h" className="side-label">Favorites</p>
          <ul>
            {favoriteTools.map((tool) => (
              <li key={tool.id}>
                <Link href={toolHref(tool.id)} className={`side-link${currentTool === tool.id ? ' is-on' : ''}`} aria-current={currentTool === tool.id ? 'page' : undefined}>
                  <span className="side-star" aria-hidden="true">★</span>{tool.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <nav className="side-group" aria-labelledby="cat-h">
        <p id="cat-h" className="side-label">Tools</p>
        <ul>
          {CATEGORIES.map((c) => (
            <li key={c.id}>
              <Link href={`/c/${c.id}/`} className={`side-cat${currentCategory === c.id ? ' is-on' : ''}`} aria-current={currentCategory === c.id && !currentTool ? 'page' : undefined}>
                <span>{c.label}</span>
                <span className="side-count">{toolsIn(c.id).length}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {ready && recentTools.length > 0 && (
        <nav className="side-group" aria-labelledby="recent-h">
          <p id="recent-h" className="side-label">Recent</p>
          <ul>
            {recentTools.map((tool) => (
              <li key={tool.id}>
                <Link href={toolHref(tool.id)} className={`side-link${currentTool === tool.id ? ' is-on' : ''}`}>{tool.name}</Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div className="side-foot">
        <OfflineStatus />
        <div className="side-foot-links">
          <Link href="/settings/" className={path.startsWith('/settings') ? 'is-on' : ''}>Settings</Link>
          <Link href="/about/" className={path.startsWith('/about') ? 'is-on' : ''}>About</Link>
        </div>
      </div>
    </aside>
  );
}
