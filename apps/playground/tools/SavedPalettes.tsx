'use client';

/** Saved palettes, offered as a one-click recolour in the other tools. */

import { useStore } from '@/lib/store';
import styles from './saved.module.css';

export default function SavedPalettes({ onPick, label = 'Saved palettes' }: { onPick: (hexes: string[], name: string) => void; label?: string }) {
  const store = useStore();
  const palettes = store.saved.filter((item) => item.tool === 'color' && item.kind === 'Palette').slice(0, 10);
  if (palettes.length === 0) return null;
  return (
    <div className={styles.palettes} role="group" aria-label={label}>
      {palettes.map((item) => {
        const hexes = (Array.isArray(item.recipe.colors) ? item.recipe.colors : item.colors) as string[];
        return (
          <button
            key={item.id}
            type="button"
            className={styles.palette}
            title={`Use ${item.name}`}
            aria-label={`Use ${item.name}`}
            onClick={() => onPick(hexes, item.name)}
            onPointerUp={(e) => e.currentTarget.blur()}
          >
            {hexes.map((hex, i) => <i key={i} style={{ background: hex }} />)}
          </button>
        );
      })}
    </div>
  );
}
