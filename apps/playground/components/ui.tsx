'use client';

/**
 * The handful of controls every tool shares.
 *
 * Crisp, quiet, and built on real elements: buttons are buttons, a segmented
 * control is a radio group, sliders are native ranges. That is where keyboard
 * support and screen reader labels come from for free.
 */

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';

type Variant = 'solid' | 'line' | 'ghost';

/**
 * A button that lets go of focus after a mouse or touch press.
 *
 * Browsers keep focus on a clicked button, so the next Space would press it
 * again instead of randomizing. Letting go only for pointer presses keeps
 * keyboard focus exactly where keyboard users expect it.
 */
export function Button({
  variant = 'line',
  className = '',
  onPointerUp,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; children: ReactNode }) {
  return (
    <button
      type="button"
      className={`btn btn-${variant} ${className}`}
      onPointerUp={(e: PointerEvent<HTMLButtonElement>) => {
        onPointerUp?.(e);
        // Pointer-up only fires for real presses; keyboard activation never
        // reaches here, so keyboard focus is left exactly where it was.
        e.currentTarget.blur();
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  compact = false,
}: {
  label: string;
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  compact?: boolean;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (e: KeyboardEvent, index: number) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (index + step + options.length) % options.length;
    onChange(options[next].id);
    refs.current[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className={`seg${compact ? ' seg-compact' : ''}`}>
      {options.map((option, i) => {
        const on = option.id === value;
        return (
          <button
            key={option.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            className={`seg-item${on ? ' on' : ''}`}
            onClick={() => onChange(option.id)}
            onKeyDown={(e) => move(e, i)}
            onPointerUp={(e) => e.currentTarget.blur()}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Slider({
  label,
  min,
  max,
  step = 1,
  value,
  onChange,
  format = (v) => String(v),
}: {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
}) {
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="slider">
      <div className="slider-head">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>{format(value)}</output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ ['--pct' as string]: `${pct}%` }}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export interface MenuItem {
  label: string;
  hint?: string;
  run: () => void;
}

/** A small menu for Export, closable by Escape, a click outside, or choosing. */
export function Menu({ label, items, variant = 'solid' }: { label: string; items: MenuItem[]; variant?: Variant }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    itemRefs.current[0]?.focus();
    const away = (e: globalThis.PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const list = itemRefs.current.filter(Boolean) as HTMLButtonElement[];
      const at = list.indexOf(document.activeElement as HTMLButtonElement);
      const next = (at + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length;
      list[next]?.focus();
    }
  };

  return (
    <div className="menu-wrap" ref={wrap} onKeyDown={onKey}>
      <button
        ref={trigger}
        type="button"
        className={`btn btn-${variant}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
      </button>
      {open && (
        <div id={menuId} role="menu" className="menu">
          {items.map((item, i) => (
            <button
              key={item.label}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              type="button"
              role="menuitem"
              className="menu-item"
              onClick={() => {
                setOpen(false);
                item.run();
              }}
            >
              <span>{item.label}</span>
              {item.hint && <span className="menu-hint">{item.hint}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}
