'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, Check, Slider } from '@/components/ui';
import CopyButton from '@/components/CopyButton';
import { useApp, useToolActions, useToolParams } from '@/components/AppState';
import { password, strength, type PasswordOptions } from '@/utils/random';

export default function Password() {
  const { toast } = useApp();
  const [o, setO] = useState<PasswordOptions>({ length: 16, upper: true, lower: true, numbers: true, symbols: true, avoidAmbiguous: false });
  const [value, setValue] = useState('');
  const generate = useCallback(() => setValue(password(o)), [o]);

  useToolParams((p) => { const n = Number(p.get('length')); if (n >= 4 && n <= 128) setO((x) => ({ ...x, length: n })); });
  useEffect(() => { generate(); }, [generate]);

  const s = strength(o);
  const none = !o.upper && !o.lower && !o.numbers && !o.symbols;
  const set = (key: keyof PasswordOptions) => (v: boolean) => {
    const next = { ...o, [key]: v };
    if (!next.upper && !next.lower && !next.numbers && !next.symbols) { toast('Keep at least one kind of character.'); return; }
    setO(next);
  };
  useToolActions({ run: generate, copy: () => value || null });

  return (
    <div className="stack">
      <section className="password-card" aria-live="polite">
        <p className="result-label">Your password</p>
        <p className="password-value">{value}</p>
        <div className="strength" data-level={s.label}>
          <span className="strength-bar"><i style={{ width: `${Math.min(100, (s.bits / 128) * 100)}%` }} /></span>
          <span className="strength-label">{s.label} · {Math.round(s.bits)} bits</span>
        </div>
        <div className="result-actions">
          <CopyButton text={value} variant="primary" size="lg" />
          <Button size="lg" onClick={generate} disabled={none}>Generate another</Button>
        </div>
      </section>
      <div className="card stack">
        <Slider label="Length" min={6} max={64} value={o.length} onChange={(length) => setO((x) => ({ ...x, length }))} format={(v) => `${v} characters`} />
        <div className="checks">
          <Check label="Uppercase" hint="A–Z" checked={o.upper} onChange={set('upper')} />
          <Check label="Lowercase" hint="a–z" checked={o.lower} onChange={set('lower')} />
          <Check label="Numbers" hint="0–9" checked={o.numbers} onChange={set('numbers')} />
          <Check label="Symbols" hint="!@#$%" checked={o.symbols} onChange={set('symbols')} />
          <Check label="Avoid look-alikes" hint="No I, l, 1, O, 0" checked={!!o.avoidAmbiguous} onChange={(v) => setO((x) => ({ ...x, avoidAmbiguous: v }))} />
        </div>
        <p className="hint">Made with your browser’s cryptographic random generator. It is never sent or stored.</p>
      </div>
    </div>
  );
}
