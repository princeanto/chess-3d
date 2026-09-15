/**
 * Turning content into questions.
 *
 * Two jobs. First, decide *what* to ask: everything overdue for review comes
 * first, and the lesson is topped up with things never seen before — so a
 * session is mostly the words you are on the edge of forgetting, not the next
 * page of a book. Second, decide *how* to ask it: the same word is a meaning
 * question the first time, a gap in a sentence the next, and a listening
 * question after that, because recognising a word on a card is not the same as
 * knowing it.
 */

import type { Card, Exercise, Item, Progress, WordItem } from './types';
import { isDue } from './srs';
import { wordPool } from './course';

const LESSON_SIZE = 10;

function shuffle<T>(list: T[]): T[] {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Which words differ between the wrong sentence and the right one.
 *
 * This is what lets a mistake be authored once and still make a real exercise:
 * where the error is a word that should not be there or is simply the wrong
 * word, the learner can tap it. Where the fix is a *missing* word there is
 * nothing to tap, and the exercise falls back to choosing the better sentence.
 */
export function offendingWord(wrong: string, right: string): string | null {
  const a = wrong.split(/\s+/);
  const b = right.split(/\s+/);
  const clean = (s: string) => s.replace(/[.,?!]$/, '').toLowerCase();
  if (a.length < b.length) return null; // a word is missing, not wrong
  for (let i = 0; i < a.length; i += 1) {
    if (clean(a[i]) !== clean(b[i] ?? '')) return a[i];
  }
  return null;
}

/** Wrong answers for a gap: other words from the same unit, never the answer. */
function gapOptions(item: WordItem): string[] {
  const others = wordPool(item.unit).filter((word) => word !== item.word);
  return shuffle([item.word, ...shuffle(others).slice(0, 3)]);
}

const blank = (example: string, word: string): string =>
  example.replace(new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'), '———');

/**
 * One item, asked in whichever way it has not been asked recently.
 *
 * The rotation is driven by how many times the item has been seen, so a word
 * met three times has been met three different ways.
 */
export function toExercise(item: Item, reps: number, canListen: boolean): Exercise {
  if (item.kind === 'word') {
    const shapes = canListen ? ['meaning', 'gap', 'listen'] : ['meaning', 'gap'];
    const shape = shapes[reps % shapes.length];

    if (shape === 'gap') {
      return {
        itemId: item.id, unit: item.unit, kind: 'gap',
        prompt: blank(item.example, item.word),
        options: gapOptions(item),
        answer: item.word,
        why: `${item.word} — ${item.meaning}.`,
        note: item.example,
      };
    }
    if (shape === 'listen') {
      return {
        itemId: item.id, unit: item.unit, kind: 'listen',
        prompt: 'Listen, then choose the word you heard.',
        speak: item.example,
        options: gapOptions(item),
        answer: item.word,
        why: `${item.word} — ${item.meaning}.`,
        note: item.example,
      };
    }
    return {
      itemId: item.id, unit: item.unit, kind: 'meaning',
      prompt: item.word,
      speak: item.word,
      options: shuffle([item.meaning, ...item.distractors]),
      answer: item.meaning,
      why: `${item.word} — ${item.meaning}.`,
      note: item.example,
    };
  }

  if (item.kind === 'error') {
    const offender = offendingWord(item.wrong, item.right);
    if (offender) {
      return {
        itemId: item.id, unit: item.unit, kind: 'error',
        prompt: item.wrong,
        tiles: item.wrong.split(/\s+/),
        answer: offender,
        why: item.why,
        note: item.right,
      };
    }
    // A missing word cannot be tapped, so pick the better sentence instead.
    return {
      itemId: item.id, unit: item.unit, kind: 'error',
      prompt: 'Which one is correct?',
      options: shuffle([item.right, item.wrong]),
      answer: item.right,
      why: item.why,
      note: item.right,
    };
  }

  return {
    itemId: item.id, unit: item.unit, kind: 'build',
    prompt: 'Put this in order.',
    speak: item.sentence,
    tiles: shuffle(item.sentence.split(/\s+/)),
    answer: item.sentence,
    why: item.why,
    note: item.sentence,
  };
}

/**
 * A lesson: what is overdue, then whatever is new.
 *
 * Review always comes first. If twenty things are due there is no sense in
 * teaching a twenty-first — the fastest way to know more is to stop forgetting
 * what you have already met.
 */
export function buildLesson(
  items: Item[],
  progress: Progress,
  now: number,
  canListen: boolean,
  size = LESSON_SIZE,
): Exercise[] {
  const card = (id: string): Card | undefined => progress.cards[id];

  const due = items
    .filter((item) => {
      const c = card(item.id);
      return c !== undefined && isDue(c, now);
    })
    .sort((a, b) => (card(a.id)!.due - card(b.id)!.due));

  /*
   * Shuffled, not taken in order.
   *
   * Sliced in author order, a first lesson is the first ten entries of one
   * unit — which are all vocabulary, all brand new, and therefore all the same
   * shape of question. Ten identical cards is a poor advertisement for an app
   * whose whole argument is that it varies how it asks. Shuffling mixes words,
   * mistakes and sentences into the same ten, while new words still meet you as
   * a meaning first, which is the only sensible way to meet a word.
   */
  const unseen = shuffle(items.filter((item) => card(item.id) === undefined));

  const chosen = [...due.slice(0, size), ...unseen.slice(0, Math.max(0, size - due.length))];
  // Nothing due and nothing new: revise the weakest thing rather than refuse.
  const fallback = chosen.length > 0 ? chosen : shuffle(items).slice(0, size);

  return shuffle(fallback).map((item) => toExercise(item, card(item.id)?.reps ?? 0, canListen));
}

/** How far through a unit the learner is, for the ring on the path. */
export function unitProgress(items: Item[], progress: Progress): { known: number; total: number } {
  const total = items.length;
  const known = items.filter((item) => (progress.cards[item.id]?.box ?? 0) >= 3).length;
  return { known, total };
}
