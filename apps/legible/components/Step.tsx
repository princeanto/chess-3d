'use client';

/**
 * A section, presented as a card on the grey ground.
 *
 * The heading is split in two — solid ink for the verb, pale grey for the rest.
 * It reads as one phrase but gives the eye an obvious entry point at each step,
 * which is what carries the sequence now that there are no rules or borders
 * dividing the page.
 */
export default function Step({
  lead,
  tail,
  description,
  aside,
  children,
}: {
  lead: string;
  tail: string;
  description?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="card px-6 py-7 sm:px-9 sm:py-9">
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-5">
        <div>
          <h2 className="display text-[30px] sm:text-[34px]">
            <span style={{ color: 'var(--ink)' }}>{lead}</span>
            <br />
            <span style={{ color: 'var(--ghost)' }}>{tail}</span>
          </h2>
          {description && <p className="prose-note mt-4">{description}</p>}
        </div>
        {aside && <div className="shrink-0">{aside}</div>}
      </div>
      <div className="mt-8">{children}</div>
    </section>
  );
}

/** A selectable tile: no border, ink fill when chosen. */
export function Tile({
  active,
  onClick,
  title,
  blurb,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  blurb: string;
}) {
  return (
    <button
      aria-pressed={active}
      onClick={onClick}
      className="flex flex-col items-start gap-1 rounded-[16px] px-4 py-4 text-left transition-all"
      style={{
        background: active ? 'var(--accent)' : 'var(--sunk)',
        color: active ? 'var(--on-accent)' : 'var(--ink)',
      }}
    >
      <span className="text-[15px] font-semibold">{title}</span>
      <span
        className="text-[13px] leading-snug"
        style={{ color: active ? 'var(--on-accent)' : 'var(--muted)', opacity: active ? 0.75 : 1 }}
      >
        {blurb}
      </span>
    </button>
  );
}
