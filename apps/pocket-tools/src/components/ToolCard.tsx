import Link from 'next/link';
import { categoryById, toolHref, type ToolInfo } from '@/data/tools';

/** Name, one line, a small arrow. No giant icons. */
export default function ToolCard({ tool, showCategory = true }: { tool: ToolInfo; showCategory?: boolean }) {
  return (
    <Link href={toolHref(tool.id)} className="tool-card">
      {showCategory && <span className="tool-card-cat">{categoryById(tool.category)?.label}</span>}
      <span className="tool-card-name">{tool.name}</span>
      <span className="tool-card-desc">{tool.description}</span>
      <span className="tool-card-go" aria-hidden="true">
        <svg viewBox="0 0 16 16"><path d="M3 8h9.5M8.5 4l4 4-4 4" /></svg>
      </span>
    </Link>
  );
}

export function ToolRow({ tool, favorite }: { tool: ToolInfo; favorite?: boolean }) {
  return (
    <li>
      <Link href={toolHref(tool.id)} className="tool-row">
        <span className="tool-row-text">
          <span className="tool-row-name">{tool.name}{favorite && <span className="tool-row-star" aria-label="Favorite"> ★</span>}</span>
          <span className="tool-row-desc">{tool.description}</span>
        </span>
        <svg className="tool-row-go" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9.5M8.5 4l4 4-4 4" /></svg>
      </Link>
    </li>
  );
}
