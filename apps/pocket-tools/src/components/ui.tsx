'use client';

/**
 * The controls every tool is built from. Real elements underneath — buttons,
 * labelled inputs, radio groups — so keyboards and screen readers work without
 * each tool having to remember to make them work.
 */

import { useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type KeyboardEvent, type ReactNode, type TextareaHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

export function Button({ variant = 'secondary', size, className = '', children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'lg' | 'sm'; children: ReactNode }) {
  return (
    <button type="button" className={`btn btn-${variant}${size ? ` btn-${size}` : ''} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function Field({ label, hint, htmlFor, children, className = '' }: { label: ReactNode; hint?: ReactNode; htmlFor?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`field ${className}`}>
      <label className="label" htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

/** A text box for numbers people type loosely: "4,500", "2.5k". The raw text is kept while typing. */
export function NumberField({ label, value, onChange, prefix, suffix, hint, placeholder, id, className = '', ...rest }: {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  prefix?: ReactNode;
  suffix?: ReactNode;
  hint?: ReactNode;
  placeholder?: string;
  id?: string;
  className?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'prefix'>) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <Field label={label} hint={hint} htmlFor={inputId} className={className}>
      <div className="affix">
        {prefix && <span className="affix-part" aria-hidden="true">{prefix}</span>}
        <input
          id={inputId}
          className="input"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          {...rest}
        />
        {suffix && <span className="affix-part" aria-hidden="true">{suffix}</span>}
      </div>
    </Field>
  );
}

export function TextField({ label, value, onChange, hint, id, className = '', ...rest }: {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  hint?: ReactNode;
  id?: string;
  className?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'>) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <Field label={label} hint={hint} htmlFor={inputId} className={className}>
      <input id={inputId} className="input" value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
    </Field>
  );
}

export function TextArea({ label, value, onChange, hint, id, className = '', hideLabel, ...rest }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: ReactNode;
  id?: string;
  className?: string;
  hideLabel?: boolean;
} & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'>) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <div className={`field ${className}`}>
      <label className={hideLabel ? 'sr-only' : 'label'} htmlFor={inputId}>{label}</label>
      <textarea id={inputId} className="textarea" value={value} spellCheck={false} onChange={(e) => onChange(e.target.value)} {...rest} />
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export function Segmented<T extends string>({ label, options, value, onChange, hideLabel, wrap }: {
  label: string;
  options: readonly { id: T; label: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  hideLabel?: boolean;
  wrap?: boolean;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const labelId = useId();
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (index + step + options.length) % options.length;
    onChange(options[next].id);
    refs.current[next]?.focus();
  };
  return (
    <div className="field">
      <span id={labelId} className={hideLabel ? 'sr-only' : 'label'}>{label}</span>
      <div className={`seg${wrap ? ' seg-wrap' : ''}`} role="radiogroup" aria-labelledby={labelId}>
        {options.map((option, i) => (
          <button
            key={option.id}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={value === option.id}
            tabIndex={value === option.id ? 0 : -1}
            className="seg-item"
            onClick={() => onChange(option.id)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Check({ label, checked, onChange, hint }: { label: ReactNode; checked: boolean; onChange: (checked: boolean) => void; hint?: ReactNode }) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="check-box" aria-hidden="true">
        <svg viewBox="0 0 12 12"><path d="M2.5 6.2l2.2 2.2 4.8-4.9" /></svg>
      </span>
      <span className="check-text">
        {label}
        {hint && <small>{hint}</small>}
      </span>
    </label>
  );
}

export function Slider({ label, value, onChange, min, max, step = 1, format }: {
  label: ReactNode; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; format?: (v: number) => ReactNode;
}) {
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="field">
      <div className="slider-head">
        <label className="label" htmlFor={id}>{label}</label>
        <output htmlFor={id} className="slider-value">{format ? format(value) : value}</output>
      </div>
      <input id={id} type="range" className="slider" min={min} max={max} step={step} value={value} style={{ ['--pct' as string]: `${pct}%` }} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

export function Select<T extends string>({ label, value, onChange, options, hideLabel }: {
  label: string; value: T; onChange: (v: T) => void; options: readonly { id: T; label: string }[]; hideLabel?: boolean;
}) {
  const id = useId();
  return (
    <div className="field">
      <label className={hideLabel ? 'sr-only' : 'label'} htmlFor={id}>{label}</label>
      <select id={id} className="input select" value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </div>
  );
}

export function Card({ children, className = '', ...rest }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLElement>) {
  return <section className={`card ${className}`} {...rest}>{children}</section>;
}

export function Empty({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <div className="empty">
      {icon && <span className="empty-icon" aria-hidden="true">{icon}</span>}
      <p>{children}</p>
    </div>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'error' | 'ok'; children: ReactNode }) {
  return <p className={`notice notice-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>{children}</p>;
}

/** Inputs on one side, the answer large on the other; stacked on a phone. */
export function Columns({ inputs, result, wide }: { inputs: ReactNode; result: ReactNode; wide?: 'inputs' | 'result' }) {
  return (
    <div className={`columns${wide ? ` columns-${wide}` : ''}`}>
      <div className="columns-inputs">{inputs}</div>
      <div className="columns-result">{result}</div>
    </div>
  );
}

export const Kbd = ({ children }: { children: ReactNode }) => <kbd className="kbd">{children}</kbd>;

/** A whole number with − and + either side, for counts like people and dice. */
export function Stepper({ label, value, onChange, min = 1, max = 99, suffix }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; suffix?: string }) {
  const id = useId();
  const clamp = (v: number) => Math.max(min, Math.min(max, Math.round(v)));
  return (
    <div className="field">
      <label className="label" htmlFor={id}>{label}</label>
      <div className="stepper">
        <button type="button" className="stepper-btn" aria-label={`Fewer ${label.toLowerCase()}`} onClick={() => onChange(clamp(value - 1))} disabled={value <= min}>−</button>
        <input
          id={id}
          className="input stepper-input"
          inputMode="numeric"
          value={String(value)}
          onChange={(e) => { const n = parseInt(e.target.value.replace(/\D/g, ''), 10); onChange(Number.isFinite(n) ? clamp(n) : min); }}
          aria-describedby={suffix ? `${id}-s` : undefined}
        />
        {suffix && <span id={`${id}-s`} className="stepper-suffix">{suffix}</span>}
        <button type="button" className="stepper-btn" aria-label={`More ${label.toLowerCase()}`} onClick={() => onChange(clamp(value + 1))} disabled={value >= max}>+</button>
      </div>
    </div>
  );
}

/** Quick values as chips beside a field: 5% 12% 18% 28%. */
export function Chips<T extends string | number>({ label, options, value, onChange, format = (v) => String(v) }: {
  label: string; options: readonly T[]; value: T | null; onChange: (v: T) => void; format?: (v: T) => ReactNode;
}) {
  return (
    <div className="chips" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o)} type="button" className="chip" aria-pressed={value === o} onClick={() => onChange(o)}>{format(o)}</button>
      ))}
    </div>
  );
}
