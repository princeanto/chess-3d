import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ToolWorkspace from '@/components/ToolWorkspace';
import { TOOLS, toolById } from '@/data/tools';

export const dynamicParams = false;

export function generateStaticParams() {
  return TOOLS.map((tool) => ({ slug: tool.id }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const tool = toolById(params.slug);
  return tool ? { title: tool.name, description: `${tool.description} Free, private, works offline.` } : {};
}

export default function ToolPage({ params }: { params: { slug: string } }) {
  if (!toolById(params.slug)) notFound();
  return <ToolWorkspace id={params.slug} />;
}
