'use client';

/**
 * The first screen is a question, not a catalogue: what are you trying to do?
 * Below it, the ten tools people reach for most, then the drawers.
 */

import Link from 'next/link';
import { CATEGORIES, TOOLS, toolById, toolsIn, type ToolInfo } from '@/data/tools';
import SearchBox from './Search';
import ToolCard from './ToolCard';
import { useApp } from './AppState';

export default function Home() {
  const { favorites, recents, ready } = useApp();
  const quick = TOOLS.filter((t) => t.quick);
  const yours = [...new Set([...favorites, ...recents.map((r) => r.id)])].map((id) => toolById(id)).filter(Boolean).slice(0, 4) as ToolInfo[];

  return (
    <div className="home">
      <section className="hero">
        <h1 className="hero-title">Pocket Tools</h1>
        <p className="hero-tag">Small problems. Solved quickly.</p>
        <SearchBox hero autoFocus />
        <p className="hero-privacy">
          <span>No account.</span> <span>No uploads.</span> <span>Your files stay on your device.</span>
        </p>
      </section>

      {ready && yours.length > 0 && (
        <section className="home-section" aria-labelledby="yours-h">
          <h2 id="yours-h" className="section-label">{favorites.length ? 'Your tools' : 'Pick up where you left off'}</h2>
          <div className="card-grid card-grid-4">
            {yours.map((tool) => <ToolCard key={tool.id} tool={tool} />)}
          </div>
        </section>
      )}

      <section className="home-section" aria-labelledby="quick-h">
        <h2 id="quick-h" className="section-label">Quick tools</h2>
        <div className="card-grid">
          {quick.map((tool) => <ToolCard key={tool.id} tool={tool} />)}
        </div>
      </section>

      <section className="home-section" aria-labelledby="drawers-h">
        <h2 id="drawers-h" className="section-label">Every drawer</h2>
        <ul className="drawers">
          {CATEGORIES.map((c) => {
            const tools = toolsIn(c.id);
            return (
              <li key={c.id}>
                <Link href={`/c/${c.id}/`} className="drawer">
                  <span className="drawer-head">
                    <span className="drawer-name">{c.label}</span>
                    <span className="drawer-count">{tools.length}</span>
                  </span>
                  <span className="drawer-line">{c.line}</span>
                  <span className="drawer-tools">{tools.slice(0, 4).map((t) => t.name).join(' · ')}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
