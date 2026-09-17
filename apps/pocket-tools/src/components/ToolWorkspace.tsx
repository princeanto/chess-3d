'use client';

/**
 * The page every tool lives in: what it's called, what it does, a star, and
 * then the tool itself. Opening a tool counts as using it, for Recent.
 */

import Link from 'next/link';
import { useEffect } from 'react';
import { categoryById, toolById, toolsIn } from '@/data/tools';
import { TOOL_COMPONENTS } from '@/tools';
import { useApp } from './AppState';
import ToolCard from './ToolCard';

export default function ToolWorkspace({ id }: { id: string }) {
  const tool = toolById(id)!;
  const category = categoryById(tool.category)!;
  const { favorites, toggleFavorite, recordUse, toast, ready } = useApp();
  const Tool = TOOL_COMPONENTS[id];
  const favorite = favorites.includes(id);
  const related = toolsIn(tool.category).filter((t) => t.id !== id).slice(0, 3);

  useEffect(() => { recordUse(id); }, [id, recordUse]);

  return (
    <article className="tool">
      <header className="tool-head">
        <Link href={`/c/${category.id}/`} className="eyebrow">{category.label}</Link>
        <div className="tool-title-row">
          <h1 className="tool-title">{tool.name}</h1>
          <button
            type="button"
            className={`star${favorite ? ' is-on' : ''}`}
            aria-pressed={favorite}
            aria-label={favorite ? `Remove ${tool.name} from favorites` : `Add ${tool.name} to favorites`}
            title={favorite ? 'Remove from favorites' : 'Add to favorites'}
            disabled={!ready}
            onClick={() => { toggleFavorite(id); toast(favorite ? 'Removed from favorites' : 'Added to favorites'); }}
          >
            {favorite ? '★' : '☆'}
          </button>
        </div>
        <p className="tool-desc">{tool.description}</p>
      </header>

      <div className="tool-body">{Tool ? <Tool /> : null}</div>

      {related.length > 0 && (
        <aside className="related" aria-labelledby="related-h">
          <p id="related-h" className="section-label">More {category.label.toLowerCase()} tools</p>
          <div className="card-grid card-grid-3">
            {related.map((t) => <ToolCard key={t.id} tool={t} showCategory={false} />)}
          </div>
        </aside>
      )}
    </article>
  );
}
