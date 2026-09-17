'use client';

import { useEffect, useState } from 'react';

/** The current time, refreshed while `active` — for clocks that count down. */
export function useNow(active: boolean, every = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), every);
    return () => window.clearInterval(id);
  }, [active, every]);
  return now;
}
