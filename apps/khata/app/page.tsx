'use client';

import dynamic from 'next/dynamic';

/*
 * Client-only, and deliberately so.
 *
 * Everything the app renders comes from IndexedDB and WebCrypto, neither of
 * which exists during a static export. Rendering a shell on the server and
 * hydrating over it would only produce a flash of an empty ledger.
 */
const App = dynamic(() => import('@/components/App'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[100dvh] items-center justify-center text-faint">···</div>
  ),
});

export default function Page() {
  return <App />;
}
