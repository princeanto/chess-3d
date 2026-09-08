/**
 * Keyboard layout.
 *
 * Widths are in key units, the way real keycaps are specified — 1u is a letter
 * key, the spacebar is 6.25u. Laying it out from units rather than hardcoded
 * positions means the rows line up automatically, and the `code` on the keys
 * that matter is the same `KeyboardEvent.code` the game already listens for, so
 * one lookup drives both the physical key and the mesh that depresses.
 */

export interface KeyDef {
  /** KeyboardEvent.code, on the keys that do something. */
  code?: string;
  label?: string;
  /** Width in key units. */
  w: number;
}

export interface PlacedKey extends KeyDef {
  /** Centre, in units, relative to the keyboard's centre. */
  x: number;
  z: number;
  width: number;
  depth: number;
}

/** One key unit, in world units. */
export const UNIT = 0.26;
export const GAP = 0.028;
const ROW_DEPTH = UNIT;

const ROWS: KeyDef[][] = [
  [
    { code: 'Escape', label: 'esc', w: 1 },
    { w: 1 }, { w: 1 }, { w: 1 }, { w: 1 },
    { w: 1 }, { w: 1 }, { w: 1 }, { w: 1 },
    { w: 1 }, { w: 1 }, { w: 1 }, { w: 1 },
    { w: 1 }, { w: 1 },
  ],
  [
    { w: 1 }, { w: 1 }, { w: 1 }, { w: 1 }, { w: 1 }, { w: 1 }, { w: 1 },
    { w: 1 }, { w: 1 }, { w: 1 }, { w: 1 }, { w: 1 }, { w: 1 },
    { w: 2 },
  ],
  [
    { w: 1.5 },
    { w: 1 }, { w: 1 }, { w: 1 }, { w: 1 }, { w: 1 }, { w: 1 },
    { w: 1 }, { w: 1 }, { w: 1 }, { w: 1 }, { w: 1 }, { w: 1 },
    { w: 1.5 },
  ],
  [
    { w: 1.75 },
    { w: 1 }, { w: 1 }, { w: 1 }, { w: 1 }, { w: 1 }, { w: 1 },
    { w: 1 }, { w: 1 }, { w: 1 }, { w: 1 }, { w: 1 },
    { w: 2.25 },
  ],
  [
    { w: 2.25 },
    { w: 1 }, { w: 1 }, { w: 1 }, { w: 1 }, { w: 1 }, { w: 1 },
    { w: 1 }, { w: 1 }, { w: 1 }, { w: 1 },
    { w: 2.75 },
  ],
  [
    { w: 1.25 }, { w: 1.25 }, { w: 1.25 },
    { code: 'Space', label: 'space', w: 6.25 },
    { w: 1.25 }, { w: 1.25 }, { w: 1.25 }, { w: 1.25 },
  ],
];

/** The arrow cluster, placed to the right of the main block. */
const ARROWS: Array<KeyDef & { col: number; row: number }> = [
  { code: 'ArrowUp', label: '↑', w: 1, col: 1, row: 4 },
  { code: 'ArrowLeft', label: '←', w: 1, col: 0, row: 5 },
  { code: 'ArrowDown', label: '↓', w: 1, col: 1, row: 5 },
  { code: 'ArrowRight', label: '→', w: 1, col: 2, row: 5 },
];

function rowWidth(row: KeyDef[]): number {
  return row.reduce((sum, k) => sum + k.w * UNIT + GAP, 0) - GAP;
}

/**
 * Resolves the layout into positioned keys. The main block is centred on its
 * widest row, then the arrow cluster is hung off the right-hand edge.
 */
export function layoutKeys(): { keys: PlacedKey[]; width: number; depth: number } {
  const widest = Math.max(...ROWS.map(rowWidth));
  const keys: PlacedKey[] = [];

  ROWS.forEach((row, r) => {
    let cursor = -widest / 2;
    const z = (r - (ROWS.length - 1) / 2) * (ROW_DEPTH + GAP);
    for (const def of row) {
      const width = def.w * UNIT;
      keys.push({ ...def, x: cursor + width / 2, z, width, depth: ROW_DEPTH });
      cursor += width + GAP;
    }
  });

  const clusterX = widest / 2 + GAP * 2 + UNIT / 2;
  for (const a of ARROWS) {
    keys.push({
      ...a,
      x: clusterX + a.col * (UNIT + GAP),
      z: (a.row - (ROWS.length - 1) / 2) * (ROW_DEPTH + GAP),
      width: UNIT,
      depth: ROW_DEPTH,
    });
  }

  /*
   * Centre on what was actually placed, not on the main block.
   *
   * The arrow cluster hangs off the right-hand side, so the assembly is not
   * symmetric about zero. Sizing the case from the main block alone left the
   * cluster and the right-hand keys floating past its edge — measure the real
   * extent, then shift everything so the case can be centred on it.
   */
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const k of keys) {
    minX = Math.min(minX, k.x - k.width / 2);
    maxX = Math.max(maxX, k.x + k.width / 2);
    minZ = Math.min(minZ, k.z - k.depth / 2);
    maxZ = Math.max(maxZ, k.z + k.depth / 2);
  }

  const shift = (minX + maxX) / 2;
  for (const k of keys) k.x -= shift;

  return { keys, width: maxX - minX, depth: maxZ - minZ };
}

/** Codes the game reacts to — used to tint those keycaps so they stand out. */
export const LIVE_CODES = new Set([
  'Space',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
]);
