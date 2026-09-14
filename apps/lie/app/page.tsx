'use client';

import dynamic from 'next/dynamic';

/*
 * Client-only. The game's whole state — where you are in the deck, your streak,
 * your remaining lives — is read from this browser's storage, which does not
 * exist while a static export is being generated. Rendering a shell on the
 * server would only produce a flash of the wrong screen.
 */
const Game = dynamic(() => import('@/components/Game'), { ssr: false });

export default function Page() {
  return <Game />;
}
