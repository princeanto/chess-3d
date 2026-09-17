'use client';

import { useEffect, useRef, useState } from 'react';
import { copyText } from '@/utils/clipboard';
import { useApp } from './AppState';

/** Copies, and says so on the button itself — the place you are already looking. */
export default function CopyButton({ text, label = 'Copy', variant = 'secondary', size, disabled, className = '' }: {
  text: string | (() => string | null);
  label?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'lg' | 'sm';
  disabled?: boolean;
  className?: string;
}) {
  const { toast } = useApp();
  const [state, setState] = useState<'idle' | 'done' | 'failed'>('idle');
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onClick = async () => {
    const value = typeof text === 'function' ? text() : text;
    if (!value) {
      toast('Nothing to copy yet.');
      return;
    }
    const ok = await copyText(value);
    setState(ok ? 'done' : 'failed');
    if (!ok) toast('Couldn’t copy that. Try again.');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState('idle'), 1600);
  };

  return (
    <button type="button" className={`btn btn-${variant}${size ? ` btn-${size}` : ''} copy ${state === 'done' ? 'is-done' : ''} ${className}`} onClick={onClick} disabled={disabled} aria-live="polite">
      <svg className="btn-icon" viewBox="0 0 16 16" aria-hidden="true">
        {state === 'done'
          ? <path d="M3.5 8.5l3 3 6-7" />
          : <><rect x="5.5" y="5.5" width="8" height="8" rx="1.5" /><path d="M10.5 3.5v-.5A1.5 1.5 0 009 1.5H4A1.5 1.5 0 002.5 3v5A1.5 1.5 0 004 9.5h.5" /></>}
      </svg>
      {state === 'done' ? 'Copied' : label}
    </button>
  );
}
