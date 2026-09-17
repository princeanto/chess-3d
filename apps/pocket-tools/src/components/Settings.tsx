'use client';

/** Theme, offline, shortcuts, a way to forget everything. That's it. */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useApp, type Theme } from './AppState';
import { Button, Kbd, Segmented } from './ui';
import OfflineStatus from './OfflineStatus';
import { clearLocalData } from '@/utils/storage';

const VERSION = '1.0.0';

export default function Settings() {
  const { theme, setTheme, offline, toast } = useApp();
  const [confirming, setConfirming] = useState(false);
  const [mod, setMod] = useState('⌘');
  useEffect(() => setMod(/Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘' : 'Ctrl'), []);

  const clear = async () => {
    if (!confirming) { setConfirming(true); return; }
    await clearLocalData();
    toast('Local data cleared.');
    window.setTimeout(() => window.location.reload(), 600);
  };

  return (
    <div className="page page-narrow settings">
      <header className="page-head">
        <h1 className="page-title">Settings</h1>
      </header>

      <section className="setting">
        <h2 className="setting-title">Theme</h2>
        <Segmented<Theme> label="Theme" hideLabel value={theme} onChange={setTheme} options={[{ id: 'light', label: 'Light' }, { id: 'dark', label: 'Dark' }, { id: 'system', label: 'System' }]} />
      </section>

      <section className="setting">
        <h2 className="setting-title">Offline</h2>
        <OfflineStatus />
        <p className="setting-text">
          {offline === 'ready' || offline === 'offline'
            ? 'Every tool is saved on this device and works with no connection. Install Pocket Tools from your browser’s menu to open it like an app.'
            : 'The first visit saves every tool on this device. After that, Pocket Tools works with no connection.'}
        </p>
      </section>

      <section className="setting">
        <h2 className="setting-title">Keyboard shortcuts</h2>
        <dl className="shortcuts">
          <div><dt><Kbd>{mod}</Kbd><Kbd>K</Kbd></dt><dd>Search every tool</dd></div>
          <div><dt><Kbd>{mod}</Kbd><Kbd>/</Kbd></dt><dd>Focus search</dd></div>
          <div><dt><Kbd>{mod}</Kbd><Kbd>Enter</Kbd></dt><dd>Run the current tool</dd></div>
          <div><dt><Kbd>{mod}</Kbd><Kbd>C</Kbd></dt><dd>Copy the result, when nothing is selected</dd></div>
          <div><dt><Kbd>Esc</Kbd></dt><dd>Close search</dd></div>
        </dl>
      </section>

      <section className="setting">
        <h2 className="setting-title">Local data</h2>
        <p className="setting-text">Favorites, recent tools, preferences and saved drafts live in this browser. Nothing else is stored, and nothing is sent anywhere.</p>
        <div className="setting-actions">
          <Button variant={confirming ? 'primary' : 'secondary'} className={confirming ? 'btn-danger' : ''} onClick={clear}>
            {confirming ? 'Yes, clear it all' : 'Clear local data'}
          </Button>
          {confirming && <Button variant="ghost" onClick={() => setConfirming(false)}>Keep it</Button>}
        </div>
      </section>

      <section className="setting">
        <h2 className="setting-title">About</h2>
        <p className="setting-text">Pocket Tools {VERSION}. <Link href="/about/">Small problems. Solved quickly.</Link></p>
      </section>
    </div>
  );
}
