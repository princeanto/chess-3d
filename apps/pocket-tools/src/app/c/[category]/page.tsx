import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CATEGORIES, categoryById, toolsIn } from '@/data/tools';
import { ToolRow } from '@/components/ToolCard';

export const dynamicParams = false;

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ category: c.id }));
}

export function generateMetadata({ params }: { params: { category: string } }): Metadata {
  const category = categoryById(params.category);
  return category ? { title: `${category.label} tools`, description: category.line } : {};
}

export default function CategoryPage({ params }: { params: { category: string } }) {
  const category = categoryById(params.category);
  if (!category) notFound();
  const tools = toolsIn(category.id);
  const groups = [...new Set(tools.map((t) => t.group ?? ''))];
  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">{tools.length} tools</p>
        <h1 className="page-title">{category.label}</h1>
        <p className="page-line">{category.line}</p>
      </header>
      {groups.map((group) => (
        <section key={group || 'main'} className="list-section">
          {group && <p className="section-label">{group}</p>}
          <ul className="tool-list">
            {tools.filter((t) => (t.group ?? '') === group).map((tool) => <ToolRow key={tool.id} tool={tool} />)}
          </ul>
        </section>
      ))}
    </div>
  );
}
