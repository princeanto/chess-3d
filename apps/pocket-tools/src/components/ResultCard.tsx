'use client';

/**
 * Results that look like answers. The number is the biggest thing on the
 * screen; what it means sits under it; Copy is right there.
 */

import type { ReactNode } from 'react';
import CopyButton from './CopyButton';

export function ResultHero({ label = 'Your result', value, caption, copy, children, tone }: {
  label?: string;
  value: ReactNode;
  caption?: ReactNode;
  /** Text to copy; omit to hide the button. */
  copy?: string;
  children?: ReactNode;
  tone?: 'muted';
}) {
  return (
    <section className={`result${tone === 'muted' ? ' result-muted' : ''}`} aria-live="polite">
      <p className="result-label">{label}</p>
      <p className="result-value">{value}</p>
      {caption && <p className="result-caption">{caption}</p>}
      {(copy !== undefined || children) && (
        <div className="result-actions">
          {copy !== undefined && <CopyButton text={copy} disabled={!copy} />}
          {children}
        </div>
      )}
    </section>
  );
}

export interface Row { label: ReactNode; value: ReactNode; copy?: string; strong?: boolean; muted?: boolean }

export function ResultRows({ rows, title }: { rows: Row[]; title?: string }) {
  return (
    <section className="rows" aria-live="polite">
      {title && <p className="result-label">{title}</p>}
      <dl>
        {rows.map((row, i) => (
          <div key={i} className={`row${row.strong ? ' row-strong' : ''}${row.muted ? ' row-muted' : ''}`}>
            <dt>{row.label}</dt>
            <dd>
              <span>{row.value}</span>
              {row.copy !== undefined && <CopyButton text={row.copy} label="Copy" variant="ghost" size="sm" className="row-copy" />}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** For tools whose answer is text: the output, with Copy and Download underneath. */
export function TextResult({ label = 'Result', text, actions, placeholder = 'Give it something to work with.', note }: {
  label?: string; text: string; actions?: ReactNode; placeholder?: string; note?: ReactNode;
}) {
  return (
    <section className="text-result" aria-live="polite">
      <div className="text-result-head">
        <p className="result-label">{label}</p>
        {note && <p className="text-result-note">{note}</p>}
      </div>
      {text ? <pre className="text-result-body">{text}</pre> : <p className="text-result-empty">{placeholder}</p>}
      <div className="result-actions">
        <CopyButton text={text} disabled={!text} variant="primary" />
        {actions}
      </div>
    </section>
  );
}
