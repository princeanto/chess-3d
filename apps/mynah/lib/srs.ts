/**
 * When to ask again.
 *
 * A Leitner schedule: get something right and it moves up a box and comes back
 * later; get it wrong and it drops to the bottom and comes back in minutes,
 * inside the same sitting. The intervals stretch roughly threefold each time,
 * which is the shape of the forgetting curve — you need reminding often at
 * first and hardly ever once it has stuck.
 *
 * This is the whole reason the app exists. A fixed path of lessons lets you
 * forget unit one while you are busy with unit six, and never notices. Here the
 * lesson is assembled from what is *about* to be forgotten, so the words that
 * keep slipping keep coming back, and the ones you know get out of the way.
 */

import type { Card, Progress } from './types';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/** Time until an item returns, per box. */
export const BOXES = [10 * MINUTE, DAY, 3 * DAY, 7 * DAY, 21 * DAY, 60 * DAY];

export const fresh = (id: string): Card => ({ id, box: 0, due: 0, lapses: 0, reps: 0 });

export const isDue = (card: Card, now: number): boolean => card.due <= now;

/**
 * Move a card after an answer.
 *
 * A miss goes all the way back to the first box rather than down one step. Half
 * remembering is what produces the illusion of learning: if something has just
 * fallen out of your head, the honest assumption is that you do not know it.
 */
export function review(card: Card, correct: boolean, now: number): Card {
  if (!correct) {
    return { ...card, box: 0, due: now + BOXES[0], lapses: card.lapses + 1, reps: card.reps + 1 };
  }
  const box = Math.min(card.box + 1, BOXES.length - 1);
  return { ...card, box, due: now + BOXES[box], reps: card.reps + 1 };
}

/** 0 to 1, for a unit's progress ring. Box 3 is "known", the rest is polish. */
export const strength = (card: Card | undefined): number =>
  card ? Math.min(1, card.box / 3) : 0;

/* --------------------------------- streak -------------------------------- */

/** Local calendar day, so a streak means "a day as you live it". */
export function dayKey(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Days in a row up to today, counted backwards from the most recent.
 *
 * Yesterday still counts, so a streak is not lost by practising in the evening
 * and then the next morning — a technicality that punishes nobody usefully.
 */
export function streak(days: string[], now: number): number {
  if (days.length === 0) return 0;
  const set = new Set(days);
  const today = dayKey(now);
  const yesterday = dayKey(now - DAY);
  if (!set.has(today) && !set.has(yesterday)) return 0;

  let count = 0;
  for (let back = set.has(today) ? 0 : 1; ; back += 1) {
    if (!set.has(dayKey(now - back * DAY))) break;
    count += 1;
  }
  return count;
}

export const EMPTY: Progress = { cards: {}, xp: 0, days: [], reached: [], sound: true };

/** Items that keep slipping, worst first — the "weak spots" list. */
export function weakest(progress: Progress, limit: number): Card[] {
  return Object.values(progress.cards)
    .filter((card) => card.lapses > 0)
    .sort((a, b) => b.lapses - a.lapses || a.box - b.box)
    .slice(0, limit);
}
