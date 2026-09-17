'use client';

/**
 * Pick colours the way a designer would: from the palette you already made,
 * or anything else with the picker on the end.
 */

import { useRef } from 'react';
import styles from './studio.module.css';

export const unique = (hexes: readonly string[]): string[] => {
  const seen = new Set<string>();
  return hexes.filter((hex) => {
    const key = hex.toUpperCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const Plus = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
    <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

/** One colour from a set. The picker changes it to anything. */
export function PickOne({ label, options, value, onChange }: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (hex: string, tag?: string) => void;
}) {
  return (
    <div className={styles.chips} role="group" aria-label={label}>
      {unique([...options, value]).map((hex) => (
        <button
          key={hex}
          type="button"
          className={styles.chip}
          style={{ background: hex }}
          aria-pressed={hex.toUpperCase() === value.toUpperCase()}
          aria-label={`${label}: ${hex}`}
          title={hex}
          onClick={() => onChange(hex)}
          onPointerUp={(e) => e.currentTarget.blur()}
        />
      ))}
      <label className={styles.picker} title="Any colour">
        <Plus />
        <input
          type="color"
          aria-label={`${label}: any colour`}
          value={value.length === 7 ? value.toLowerCase() : '#000000'}
          onChange={(e) => onChange(e.target.value.toUpperCase(), `${label}-picker`)}
        />
      </label>
    </div>
  );
}

/**
 * Several colours from a set, in order. The picker adds one, and keeps
 * changing that same one while it is open rather than adding a colour for
 * every step of the drag.
 */
export function PickMany({ label, options, value, onChange, onEmpty }: {
  label: string;
  options: readonly string[];
  value: readonly string[];
  onChange: (hexes: string[], tag?: string) => void;
  onEmpty: () => void;
}) {
  const slot = useRef<number | null>(null);
  const chosen = new Set(value.map((hex) => hex.toUpperCase()));
  const toggle = (hex: string) => {
    if (chosen.has(hex.toUpperCase())) {
      if (value.length === 1) return onEmpty();
      onChange(value.filter((c) => c.toUpperCase() !== hex.toUpperCase()));
    } else {
      onChange([...value, hex]);
    }
  };
  return (
    <div className={styles.chips} role="group" aria-label={label}>
      {unique([...options, ...value]).map((hex) => (
        <button
          key={hex}
          type="button"
          className={styles.chip}
          style={{ background: hex }}
          aria-pressed={chosen.has(hex.toUpperCase())}
          aria-label={`${label}: ${hex}`}
          title={hex}
          onClick={() => toggle(hex)}
          onPointerUp={(e) => e.currentTarget.blur()}
        />
      ))}
      <label className={styles.picker} title="Add any colour">
        <Plus />
        <input
          type="color"
          aria-label={`Add a ${label.toLowerCase()}`}
          defaultValue="#3366ff"
          onClick={() => { slot.current = null; }}
          onFocus={() => { slot.current = null; }}
          onChange={(e) => {
            const hex = e.target.value.toUpperCase();
            if (slot.current === null || slot.current >= value.length) {
              slot.current = value.length;
              onChange([...value, hex], `${label}-add`);
            } else {
              onChange(value.map((c, i) => (i === slot.current ? hex : c)), `${label}-add`);
            }
          }}
        />
      </label>
    </div>
  );
}
