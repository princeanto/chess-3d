'use client';

import { useEffect, useRef } from 'react';
import type { PlayedMove } from '@/lib/game/store';

export default function MoveList({
  moves,
  cursor,
  onGoTo,
  emptyLabel,
}: {
  moves: PlayedMove[];
  cursor: number;
  onGoTo: (ply: number) => void;
  emptyLabel: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const active = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    active.current?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  const pairs: Array<{ no: number; white?: PlayedMove; black?: PlayedMove }> = [];
  moves.forEach((m, i) => {
    const no = Math.floor(i / 2) + 1;
    if (i % 2 === 0) pairs.push({ no, white: m });
    else pairs[pairs.length - 1].black = m;
  });

  return (
    <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
      {pairs.length === 0 ? (
        <p className="px-3 py-4 text-[12px] text-[var(--faint)]">{emptyLabel}</p>
      ) : (
        <ol className="mono text-[12px]">
          {pairs.map((pair) => (
            <li key={pair.no} className="grid grid-cols-[2.4rem_1fr_1fr] items-stretch">
              <span className="flex items-center px-2 py-[3px] text-[var(--faint)]">
                {pair.no}.
              </span>
              {[pair.white, pair.black].map((m, i) =>
                m ? (
                  <button
                    key={i}
                    ref={m.ply === cursor ? active : undefined}
                    onClick={() => onGoTo(m.ply)}
                    className={`move-row px-2 py-[3px] text-left transition-colors ${
                      m.ply === cursor ? 'move-current' : ''
                    }`}
                  >
                    {m.san}
                  </button>
                ) : (
                  <span key={i} />
                ),
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
