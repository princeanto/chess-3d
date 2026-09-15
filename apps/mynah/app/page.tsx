'use client';

import dynamic from 'next/dynamic';

/*
 * Client-only. Everything shown depends on the review schedule in this
 * browser's storage, which does not exist when the export is generated.
 */
const App = dynamic(() => import('@/components/App'), { ssr: false });

export default function Page() {
  return <App />;
}
