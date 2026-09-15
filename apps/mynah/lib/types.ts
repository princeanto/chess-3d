/**
 * The shapes the course and the app agree on.
 *
 * The important idea here is that **content and exercises are different things**.
 * You author a small number of facts — this word means that, this sentence is
 * wrong and here is why — and the lesson builder turns each one into several
 * kinds of question. One vocabulary entry becomes a meaning question, a gap in
 * a real sentence, and a listening question, which is three encounters with the
 * same word in three different shapes rather than the same flashcard three
 * times. That is both better teaching and far less to write.
 */

export type Level = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';

export interface Unit {
  id: string;
  title: string;
  level: Level;
  /** One line on what this unit fixes, shown on the path. */
  blurb: string;
}

/** A word or phrase worth knowing, with a sentence it actually lives in. */
export interface WordItem {
  kind: 'word';
  id: string;
  unit: string;
  word: string;
  meaning: string;
  /** Must contain `word`, because the gap exercise is made by removing it. */
  example: string;
  /** Wrong meanings, close enough to be tempting. */
  distractors: string[];
}

/** A mistake learners really make, and the reason it is a mistake. */
export interface ErrorItem {
  kind: 'error';
  id: string;
  unit: string;
  wrong: string;
  right: string;
  why: string;
}

/** A sentence to assemble, which is how word order gets learned. */
export interface BuildItem {
  kind: 'build';
  id: string;
  unit: string;
  sentence: string;
  why: string;
}

export type Item = WordItem | ErrorItem | BuildItem;

export type ExerciseKind = 'meaning' | 'gap' | 'listen' | 'error' | 'build' | 'say';

/** One question, ready to render. Built fresh each lesson, never stored. */
export interface Exercise {
  /** The item it came from — this is what the review schedule tracks. */
  itemId: string;
  unit: string;
  kind: ExerciseKind;
  /** The question, with `___` marking a gap where there is one. */
  prompt: string;
  /** What the browser should read aloud, if anything. */
  speak?: string;
  /** Multiple choice, already shuffled, always containing the answer. */
  options?: string[];
  /** Word tiles to put in order, already shuffled. */
  tiles?: string[];
  answer: string;
  /** Shown when you get it wrong. The reason, not just the correction. */
  why: string;
  /** Shown after answering either way: the word in context. */
  note?: string;
}

/** How well known one item is. The schedule, not the score. */
export interface Card {
  id: string;
  /** 0 to BOXES.length - 1. Higher means longer until it comes back. */
  box: number;
  /** When it is next worth asking, in epoch milliseconds. */
  due: number;
  /** How many times it has been forgotten. Drives the "weak spots" list. */
  lapses: number;
  reps: number;
}

export interface Progress {
  cards: Record<string, Card>;
  xp: number;
  /** Day keys, so a streak survives timezone drift better than a counter. */
  days: string[];
  /** Units the learner has opened. Everything before them stays available. */
  reached: string[];
  sound: boolean;
}
