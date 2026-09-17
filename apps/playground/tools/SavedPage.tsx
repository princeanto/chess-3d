'use client';

/**
 * Saved: everything kept, from every tool, in one place.
 *
 * Saves live in this browser only, and the page says so plainly — with a
 * backup file one click away, because "clear site data" should not be able to
 * take someone's work with it.
 */

import { useMemo, useRef, useState } from 'react';
import styles from './saved.module.css';
import { Button, Segmented } from '@/components/ui';
import { useStore } from '@/lib/store';
import { TOOLS } from '@/lib/tools';
import { ago, type ToolId } from '@/lib/storage';
import { makeBackup, readBackup, type Saved } from '@/lib/saved';
import { getDoc } from '@/lib/idb';
import { downloadText } from '@/lib/export';
import { modLabel } from '@/lib/shortcuts';
import SavedPreview from './SavedPreview';

type Filter = 'all' | ToolId;

function Card({ item, now }: { item: Saved; now: number }) {
  const store = useStore();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const timer = useRef<number>();
  const tool = TOOLS.find((t) => t.id === item.tool);

  const remove = () => {
    if (!confirming) {
      setConfirming(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setConfirming(false), 3000);
      return;
    }
    store.removeItem(item.id);
    store.toast(`Deleted ${item.name}`);
  };

  return (
    <li className={styles.card}>
      <button type="button" className={styles.cardPreview} onClick={() => store.openSaved(item)} aria-label={`Open ${item.name}`}>
        <SavedPreview item={item} />
      </button>
      <div className={styles.cardBody}>
        {editing ? (
          <input
            className={styles.nameInput}
            defaultValue={item.name}
            aria-label="Name"
            maxLength={60}
            autoFocus
            onFocus={(e) => e.currentTarget.select()}
            onBlur={(e) => { store.renameItem(item.id, e.currentTarget.value); setEditing(false); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') { e.currentTarget.value = item.name; e.currentTarget.blur(); }
            }}
          />
        ) : (
          <button type="button" className={styles.name} title="Rename" onClick={() => setEditing(true)}>{item.name}</button>
        )}
        <p className={styles.meta}>{tool?.title ?? item.tool} · {item.kind} · {ago(item.at, now)}</p>
        <div className={styles.cardActions}>
          <Button variant="ghost" onClick={() => store.openSaved(item)}>Open</Button>
          <Button variant="ghost" onClick={() => setEditing(true)}>Rename</Button>
          <Button variant="ghost" className={confirming ? styles.danger : ''} onClick={remove}>
            {confirming ? 'Delete?' : 'Delete'}
          </Button>
        </div>
      </div>
    </li>
  );
}

export default function SavedPage() {
  const store = useStore();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const now = Date.now();

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const item of store.saved) c[item.tool] = (c[item.tool] ?? 0) + 1;
    return c;
  }, [store.saved]);

  const shown = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return store.saved.filter((item) =>
      (filter === 'all' || item.tool === filter) &&
      words.every((w) => `${item.name} ${item.kind} ${item.tool}`.toLowerCase().includes(w)));
  }, [store.saved, filter, query]);

  const options = [
    { id: 'all' as Filter, label: `All · ${store.saved.length}` },
    ...TOOLS.filter((t) => counts[t.id]).map((t) => ({ id: t.id as Filter, label: `${t.title} · ${counts[t.id]}` })),
  ];

  const download = async () => {
    const docs: Record<string, unknown> = {};
    for (const item of store.saved) {
      if (item.doc) {
        const doc = await getDoc(item.doc);
        if (doc !== undefined) docs[item.doc] = doc;
      }
    }
    const day = new Date().toISOString().slice(0, 10);
    const ok = downloadText(JSON.stringify(makeBackup(store.saved, docs)), `playground-saved-${day}.json`, 'application/json');
    store.toast(ok ? `Backup downloaded · ${store.saved.length} items` : 'Couldn’t make the backup. Try again.');
  };

  const restore = async (file: File | undefined) => {
    if (!file) return;
    const result = readBackup(await file.text());
    if ('error' in result) {
      store.toast(result.error);
      return;
    }
    const { added, skipped } = await store.importItems(result.items, result.docs);
    store.toast(added === 0 && skipped > 0 ? 'Everything in that backup is already here.' : `Added ${added}${skipped ? ` · ${skipped} already here` : ''}`);
  };

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        {store.saved.length > 0 && (
          <div className={styles.filters}>
            <Segmented label="Show" value={filter} onChange={setFilter} options={options} />
          </div>
        )}
        {store.saved.length > 6 && (
          <input className={styles.search} type="search" placeholder="Find by name" aria-label="Find by name" value={query} onChange={(e) => setQuery(e.target.value)} />
        )}
        <div className={styles.backup}>
          <Button onClick={download} disabled={store.saved.length === 0}>Download backup</Button>
          <Button onClick={() => fileInput.current?.click()}>Load backup</Button>
          <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(e) => { restore(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
      </div>

      {store.saved.length === 0 ? (
        <div className={styles.none}>
          <p className={styles.noneLine}>Nothing saved yet.</p>
          <p className={styles.noneSub}>Press {modLabel()}S in any tool to keep what you made. It shows up here, and in that tool.</p>
          <Button variant="solid" onClick={() => store.setTool('color')}>Start with a palette</Button>
        </div>
      ) : shown.length === 0 ? (
        <p className={styles.empty}>Nothing matches “{query}”.</p>
      ) : (
        <ul className={styles.grid}>
          {shown.map((item) => <Card key={item.id} item={item} now={now} />)}
        </ul>
      )}

      <p className={styles.note}>
        Saves live in this browser, on this device. Clearing site data erases them, so download a backup now and then. The same file moves them to another device.
      </p>
    </div>
  );
}
