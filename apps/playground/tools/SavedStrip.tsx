'use client';

/**
 * The row of saved work at the foot of a tool.
 *
 * Only that tool's saves, newest first, one click to reopen. Renaming, backups
 * and the rest live on the Saved page, one click away.
 */

import type { Saved } from '@/lib/saved';
import type { ToolId } from '@/lib/storage';
import { useStore } from '@/lib/store';
import { modLabel } from '@/lib/shortcuts';
import SavedPreview from './SavedPreview';
import styles from './saved.module.css';

const Close = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
    <path d="M1.5 1.5l7 7m0-7l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export default function SavedStrip({ tool, extra, limit = 16 }: {
  tool: ToolId;
  /** A second way to use an item, such as "Style only" in TYPE. */
  extra?: { label: string; title: string; run: (item: Saved) => void };
  limit?: number;
}) {
  const store = useStore();
  const items = store.saved.filter((item) => item.tool === tool);

  return (
    <section className={styles.strip} aria-labelledby={`saved-${tool}`}>
      <div className={styles.stripHead}>
        <h2 id={`saved-${tool}`} className={styles.stripTitle}>
          Saved <span className={styles.count}>{items.length || ''}</span>
        </h2>
        <button type="button" className={styles.link} onClick={() => store.setTool('saved')}>
          All saved work →
        </button>
      </div>
      {items.length === 0 ? (
        <p className={styles.empty}>Nothing saved yet. Press {modLabel()}S to keep what you like.</p>
      ) : (
        <ul className={styles.row}>
          {items.slice(0, limit).map((item) => (
            <li key={item.id} className={styles.mini}>
              <button type="button" className={styles.miniOpen} onClick={() => store.openSaved(item)} title={`Open ${item.name}`}>
                <span className={styles.miniPreview}><SavedPreview item={item} /></span>
                <span className={styles.miniName}>{item.name}</span>
              </button>
              {extra && (
                <button type="button" className={styles.miniExtra} title={extra.title} onClick={() => extra.run(item)}>
                  {extra.label}
                </button>
              )}
              <button
                type="button"
                className={styles.miniRemove}
                aria-label={`Delete ${item.name}`}
                onClick={() => { store.removeItem(item.id); store.toast(`Deleted ${item.name}`); }}
              >
                <Close />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
