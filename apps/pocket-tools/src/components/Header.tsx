'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { toolById } from '@/data/tools';
import { useApp } from './AppState';
import Logo from './Logo';
import OfflineStatus from './OfflineStatus';
import { Kbd } from './ui';

const MOBILE: { id: string; label: string }[] = [
  { id: 'text', label: 'Text' },
  { id: 'image', label: 'Image' },
  { id: 'calculate', label: 'Calc' },
  { id: 'time', label: 'Time' },
];

export default function Header({ mod }: { mod: string }) {
  const path = usePathname();
  const { setPaletteOpen } = useApp();
  const tool = /^\/tools\/([^/]+)/.exec(path)?.[1];
  const category = /^\/c\/([^/]+)/.exec(path)?.[1] ?? (tool ? toolById(tool)?.category : undefined);
  const inMore = path === '/c/' || (!!category && !MOBILE.some((m) => m.id === category));

  return (
    <header className="header">
      <div className="header-bar">
        <Logo />
        <div className="header-end">
          <OfflineStatus compact />
          <button type="button" className="header-search" onClick={() => setPaletteOpen(true)} aria-label="Search tools">
            <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" /><path d="M13 13l4 4" /></svg>
            <span className="header-search-text">Search tools…</span>
            <Kbd>{mod}K</Kbd>
          </button>
        </div>
      </div>
      <nav className="mobile-nav" aria-label="Categories">
        <ul>
          {MOBILE.map((m) => (
            <li key={m.id}>
              <Link href={`/c/${m.id}/`} className={category === m.id ? 'is-on' : ''} aria-current={category === m.id ? 'page' : undefined}>{m.label}</Link>
            </li>
          ))}
          <li><Link href="/c/" className={inMore ? 'is-on' : ''}>More</Link></li>
        </ul>
      </nav>
    </header>
  );
}
