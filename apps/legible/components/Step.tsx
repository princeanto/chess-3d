'use client';

/**
 * A numbered section.
 *
 * The tool previously showed three dense columns at once and expected the
 * reader to work out the order themselves. Numbering the work — colours, then
 * standard, then results — costs a little vertical space and removes the
 * "where do I start" problem entirely.
 */
export default function Step({
  number,
  title,
  description,
  aside,
  children,
}: {
  number: number;
  title: string;
  description?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-[var(--rule)] pt-8">
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
        <div>
          <p className="eyebrow">Step {number}</p>
          <h2 className="serif mt-1.5 text-[26px] leading-tight">{title}</h2>
          {description && <p className="prose-note mt-2">{description}</p>}
        </div>
        {aside && <div className="shrink-0">{aside}</div>}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}
