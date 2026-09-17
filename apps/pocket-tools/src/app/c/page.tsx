import type { Metadata } from 'next';
import Link from 'next/link';
import { CATEGORIES, TOOLS, toolsIn } from '@/data/tools';
import { ToolRow } from '@/components/ToolCard';

export const metadata: Metadata = { title: 'All tools', description: 'Every tool in Pocket Tools, by category.' };

export default function AllTools() {
  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">{TOOLS.length} tools</p>
        <h1 className="page-title">All tools</h1>
        <p className="page-line">Seven drawers. Everything runs on your device.</p>
      </header>
      {CATEGORIES.map((c) => (
        <section key={c.id} className="list-section" aria-labelledby={`h-${c.id}`}>
          <div className="list-section-head">
            <h2 id={`h-${c.id}`} className="list-title"><Link href={`/c/${c.id}/`}>{c.label}</Link></h2>
            <p className="list-line">{c.line}</p>
          </div>
          <ul className="tool-list">
            {toolsIn(c.id).map((tool) => <ToolRow key={tool.id} tool={tool} />)}
          </ul>
        </section>
      ))}
      <p className="page-foot"><Link href="/settings/">Settings</Link> · <Link href="/about/">About</Link></p>
    </div>
  );
}
