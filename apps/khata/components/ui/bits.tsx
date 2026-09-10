'use client';

/**
 * The small shared pieces.
 *
 * Money is the one thing in here with real rules: it is always monospaced so
 * columns of figures line up, it is always coloured by direction, and it never
 * appears without its sign when a sign would change what it means.
 */

import { formatPaise } from '@/lib/parse/money';

export function Money({
  paise,
  direction,
  size = 'md',
  round = true,
  className = '',
}: {
  paise: number;
  direction?: 'debit' | 'credit';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  round?: boolean;
  className?: string;
}) {
  const sizes = {
    sm: 'text-[13px]',
    md: 'text-[15px]',
    lg: 'text-[22px]',
    xl: 'text-[38px] leading-none',
  };
  const tone =
    direction === 'credit' ? 'text-in' : direction === 'debit' ? 'text-ink' : 'text-ink';
  return (
    <span className={`mono ${sizes[size]} ${tone} ${className}`}>
      {direction === 'credit' ? '+' : ''}
      {formatPaise(paise, { round })}
    </span>
  );
}

export function Card({
  children,
  className = '',
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={`w-full rounded-2xl border border-line bg-surface ${onClick ? 'text-left active:scale-[0.995] transition-transform' : ''} ${className}`}
    >
      {children}
    </Tag>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] uppercase tracking-[0.14em] text-faint">{children}</div>
  );
}

/** A row of the same three-part shape used everywhere a list appears. */
export function Row({
  title,
  subtitle,
  right,
  belowRight,
  onClick,
  tone,
  wrap,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  belowRight?: React.ReactNode;
  onClick?: () => void;
  tone?: 'warn' | 'out';
  /** Lists where the sentence is the point, rather than the scannable name. */
  wrap?: boolean;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className="flex w-full items-start gap-3 px-4 py-3 text-left"
    >
      {tone && (
        <span
          aria-hidden
          className={`mt-[7px] h-2 w-2 shrink-0 rounded-full ${tone === 'warn' ? 'bg-warn' : 'bg-out'}`}
        />
      )}
      <div className="min-w-0 flex-1">
        <div className={`text-[15px] tight ${wrap ? '' : 'truncate'}`}>{title}</div>
        {subtitle && (
          <div className={`text-[13px] text-muted ${wrap ? '' : 'truncate'}`}>{subtitle}</div>
        )}
      </div>
      {(right || belowRight) && (
        <div className="shrink-0 text-right">
          <div>{right}</div>
          {belowRight && <div className="text-[12px] text-faint">{belowRight}</div>}
        </div>
      )}
    </Tag>
  );
}

/** A horizontal share-of-total bar. Proportion only; no axis, no gridlines. */
export function Bar({ parts }: { parts: Array<{ label: string; value: number }> }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  const shades = ['0.92', '0.72', '0.56', '0.42', '0.3', '0.2'];
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-sunk">
      {parts.slice(0, 6).map((p, i) => (
        <div
          key={p.label}
          title={p.label}
          style={{ width: `${(p.value / total) * 100}%`, opacity: shades[i] }}
          className="h-full bg-ink"
        />
      ))}
    </div>
  );
}

export function Empty({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="px-6 py-14 text-center">
      <div className="text-[15px] tight">{title}</div>
      {detail && <div className="mx-auto mt-1 max-w-[30ch] text-[13px] text-muted">{detail}</div>}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = 'solid',
  disabled,
  type = 'button',
  className = '',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'solid' | 'quiet' | 'danger';
  disabled?: boolean;
  type?: 'button' | 'submit';
  className?: string;
}) {
  const styles = {
    solid: 'bg-ink text-paper',
    quiet: 'border border-line bg-surface text-ink',
    danger: 'border border-line bg-surface text-out',
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl px-4 py-3 text-[15px] tight transition-opacity active:opacity-70 disabled:opacity-40 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
