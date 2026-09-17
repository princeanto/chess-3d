'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, TextArea } from '@/components/ui';
import CopyButton from '@/components/CopyButton';
import { useApp, useToolActions } from '@/components/AppState';
import { randomInt } from '@/utils/random';

/**
 * The winner is chosen first, fairly, and then the animation lands on it —
 * the spin is decoration, never the decision.
 */
export default function RandomPicker() {
  const { toast } = useApp();
  const [text, setText] = useState('Pizza\nBurger\nBiryani\nDosa');
  const [highlight, setHighlight] = useState<number | null>(null);
  const [winner, setWinner] = useState<number | null>(null);
  const [spinning, setSpinning] = useState(false);
  const timers = useRef<number[]>([]);
  const options = text.split('\n').map((s) => s.trim()).filter(Boolean);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  useEffect(() => { setWinner(null); setHighlight(null); }, [text]);

  const pick = () => {
    if (spinning) return;
    if (options.length < 2) { toast('Add at least two options, one per line.'); return; }
    const chosen = randomInt(0, options.length - 1);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setWinner(null);
    if (reduce) { setHighlight(chosen); setWinner(chosen); return; }
    setSpinning(true);
    // Around the list a couple of times, slowing down, ending on the chosen one.
    const steps = options.length * 2 + chosen + 1;
    let at = 0;
    let delay = 0;
    for (let i = 0; i < steps; i += 1) {
      delay += 40 + Math.pow(i / steps, 3) * 260;
      const index = at % options.length;
      timers.current.push(window.setTimeout(() => setHighlight(index), delay));
      at += 1;
    }
    timers.current.push(window.setTimeout(() => { setWinner(chosen); setSpinning(false); }, delay + 120));
  };

  const removeWinner = () => {
    if (winner === null) return;
    setText(options.filter((_, i) => i !== winner).join('\n'));
  };
  useToolActions({ run: pick, copy: () => (winner !== null ? options[winner] : null) });

  return (
    <div className="picker">
      <div className="stack">
        <TextArea label="Options, one per line" value={text} onChange={setText} rows={8} disabled={spinning} />
        <Button variant="primary" size="lg" onClick={pick} disabled={spinning}>{winner !== null ? 'Pick again' : 'Pick one'}</Button>
      </div>
      <section className="picker-board" aria-live="polite">
        {winner !== null ? (
          <div className="picker-winner">
            <p className="result-label">The pick is</p>
            <p className="result-value">{options[winner]}</p>
            <div className="result-actions">
              <CopyButton text={options[winner]} />
              {options.length > 2 && <Button variant="ghost" onClick={removeWinner}>Remove it and try another</Button>}
            </div>
          </div>
        ) : (
          <ul className="picker-list">
            {options.map((o, i) => <li key={`${o}-${i}`} className={highlight === i ? 'is-on' : ''}>{o}</li>)}
          </ul>
        )}
      </section>
    </div>
  );
}
