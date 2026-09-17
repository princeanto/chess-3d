'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';
import { useToolActions } from '@/components/AppState';
import { randomInt } from '@/utils/random';

export default function CoinFlip() {
  const [side, setSide] = useState<'heads' | 'tails' | null>(null);
  const [turns, setTurns] = useState(0);
  const [flipping, setFlipping] = useState(false);
  const [tally, setTally] = useState({ heads: 0, tails: 0 });

  const flip = () => {
    if (flipping) return;
    const next = randomInt(0, 1) === 0 ? 'heads' : 'tails';
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Whole turns to spin, plus a half when it should land on tails.
    const target = Math.ceil(turns / 2) * 2 + 6 + (next === 'tails' ? 1 : 0);
    setTurns(target);
    if (reduce) { setSide(next); setTally((t) => ({ ...t, [next]: t[next] + 1 })); return; }
    setFlipping(true);
    setSide(null);
    window.setTimeout(() => { setSide(next); setFlipping(false); setTally((t) => ({ ...t, [next]: t[next] + 1 })); }, 900);
  };
  useToolActions({ run: flip, copy: () => (side ? (side === 'heads' ? 'Heads' : 'Tails') : null) });

  return (
    <section className="coin-board" aria-live="polite">
      <button type="button" className="coin-stage" onClick={flip} aria-label="Flip the coin">
        <span className="coin" style={{ transform: `rotateY(${turns * 180}deg)` }}>
          <span className="coin-face coin-heads">H</span>
          <span className="coin-face coin-tails">T</span>
        </span>
      </button>
      <p className="coin-result">{flipping ? 'Flipping…' : side ? (side === 'heads' ? 'Heads' : 'Tails') : 'Heads or tails?'}</p>
      <Button variant="primary" size="lg" onClick={flip} disabled={flipping}>{side ? 'Flip again' : 'Flip'}</Button>
      {tally.heads + tally.tails > 0 && <p className="hint">Heads {tally.heads} · Tails {tally.tails}</p>}
    </section>
  );
}
