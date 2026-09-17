/**
 * The six areas, and the shortcut that opens each.
 *
 * Your spec's shortcut list covers C, T and D; S, M and P complete the set so
 * every tool is one key away. `ready` marks what has been built so far — an
 * unbuilt tool says plainly that it is on the way rather than pretending.
 */

import type { ToolId } from './storage';

export interface ToolInfo {
  id: ToolId;
  label: string;
  title: string;
  description: string;
  key: string;
  ready: boolean;
}

export const TOOLS: ToolInfo[] = [
  { id: 'color', label: 'COLOR', title: 'Color', description: 'Make something beautiful. No account. No internet.', key: 'c', ready: true },
  { id: 'type', label: 'TYPE', title: 'Type', description: 'Set a line of words like you mean it.', key: 't', ready: false },
  { id: 'shape', label: 'SHAPE', title: 'Shape', description: 'Patterns from a seed. Same seed, same pattern.', key: 's', ready: false },
  { id: 'draw', label: 'DRAW', title: 'Draw', description: 'Blank canvas. Your move.', key: 'd', ready: false },
  { id: 'make', label: 'MAKE', title: 'Make', description: 'Posters, wallpapers and cards in a minute.', key: 'm', ready: false },
  { id: 'play', label: 'PLAY', title: 'Play', description: 'A small brief when you need one.', key: 'p', ready: false },
];

export const toolById = (id: ToolId): ToolInfo => TOOLS.find((tool) => tool.id === id) ?? TOOLS[0];
