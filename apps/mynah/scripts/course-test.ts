/**
 * Checks the course, which is the part of this app that can be wrong in a way
 * nobody notices.
 *
 * A broken button is obvious. A gap exercise whose answer is not in its own
 * sentence, a "wrong" answer that is actually right, or a correction that
 * repeats the mistake — those look fine and teach the wrong thing, and you
 * would only meet them by happening to get that item.
 */

import { ITEMS, UNITS, UNIT_ITEMS, wordPool } from '../lib/course';
import { offendingWord, toExercise, buildLesson } from '../lib/lesson';
import { EMPTY, review, fresh, streak, dayKey } from '../lib/srs';
import type { WordItem } from '../lib/types';

let passed = 0;
let failed = 0;

function ok(label: string, condition: boolean, detail = ''): void {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${label}${detail ? `  ${detail}` : ''}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${label}${detail ? `  ${detail}` : ''}`);
  }
}

console.log('\nSHAPE');
ok('every unit has items', UNITS.every((unit) => UNIT_ITEMS(unit.id).length > 0));
ok(
  'every item belongs to a real unit',
  ITEMS.every((item) => UNITS.some((unit) => unit.id === item.unit)),
  ITEMS.filter((i) => !UNITS.some((u) => u.id === i.unit)).map((i) => i.id).join(', '),
);
{
  const ids = ITEMS.map((item) => item.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  ok('ids are unique', dupes.length === 0, dupes.join(', '));
}
ok('the course spans A1 to C1', new Set(UNITS.map((u) => u.level)).size === 5);
console.log(`       ${ITEMS.length} items across ${UNITS.length} units`);

console.log('\nWORDS');
const words = ITEMS.filter((item): item is WordItem => item.kind === 'word');
{
  // The gap exercise is made by cutting the word out of its own example. If the
  // word is not there, the learner sees a sentence with no gap in it.
  const orphans = words.filter(
    (item) => !new RegExp(`\\b${item.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(item.example),
  );
  ok('every example contains its own word', orphans.length === 0, orphans.map((i) => i.id).join(', '));
}
ok('every word has three wrong meanings', words.every((item) => item.distractors.length === 3));
{
  const clashes = words.filter((item) => item.distractors.includes(item.meaning));
  ok('no wrong meaning is also the right one', clashes.length === 0, clashes.map((i) => i.id).join(', '));
}
{
  const dull = words.filter((item) => new Set(item.distractors).size !== 3);
  ok('the wrong meanings differ from each other', dull.length === 0, dull.map((i) => i.id).join(', '));
}
{
  // A gap needs four plausible words, which means four words in the unit.
  const thin = UNITS.filter((unit) => wordPool(unit.id).length > 0 && wordPool(unit.id).length < 4);
  ok('every unit with words has enough for a gap', thin.length === 0, thin.map((u) => u.id).join(', '));
}

console.log('\nMISTAKES');
const errors = ITEMS.filter((item) => item.kind === 'error');
ok('every mistake differs from its correction', errors.every((item) => item.kind === 'error' && item.wrong !== item.right));
{
  // A correction that only asserts ("takes on, always") teaches nothing. Name
  // the offenders, or a failure here is a puzzle rather than a to-do list.
  const thin = errors.filter((item) => item.kind === 'error' && item.why.trim().length <= 25);
  ok('every correction explains itself', thin.length === 0, thin.map((item) => item.id).join(', '));
}
{
  const tappable = errors.filter((item) => item.kind === 'error' && offendingWord(item.wrong, item.right));
  ok(
    'most mistakes have a word you can point at',
    tappable.length / errors.length > 0.6,
    `${tappable.length} of ${errors.length}`,
  );
}

console.log('\nSENTENCES');
const builds = ITEMS.filter((item) => item.kind === 'build');
ok('every sentence is worth assembling', builds.every((item) => item.kind === 'build' && item.sentence.split(/\s+/).length >= 4));
ok('every sentence says why it is ordered that way', builds.every((item) => item.kind === 'build' && item.why.trim().length > 20));

console.log('\nEXERCISES');
{
  // Every item, in every shape it can take, must produce a usable question.
  const broken: string[] = [];
  for (const item of ITEMS) {
    for (let reps = 0; reps < 3; reps += 1) {
      const ex = toExercise(item, reps, true);
      const hasAnswer = ex.options ? ex.options.includes(ex.answer) : ex.answer.length > 0;
      const tilesHold = !ex.tiles || ex.tiles.length >= 2;
      if (!hasAnswer || !tilesHold || ex.why.trim().length === 0) broken.push(`${item.id}/${ex.kind}`);
    }
  }
  ok('every exercise holds its own answer', broken.length === 0, broken.slice(0, 6).join(', '));
}
{
  const gaps = words.map((item) => toExercise(item, 1, false));
  ok('every gap actually has a gap', gaps.every((ex) => ex.prompt.includes('———')));
  ok('no gap gives the answer away in its options', gaps.every((ex) => new Set(ex.options).size === ex.options!.length));
}

console.log('\nSCHEDULE');
{
  const now = Date.now();
  let card = fresh('x');
  card = review(card, true, now);
  const first = card.due - now;
  card = review(card, true, now);
  ok('getting it right pushes it further away', card.due - now > first);
  const before = card.box;
  card = review(card, false, now);
  ok('getting it wrong sends it back to the start', card.box === 0 && before > 0);
  ok('and brings it back within the same sitting', card.due - now < 15 * 60_000);
  ok('a lapse is remembered', card.lapses === 1);
}
{
  const now = Date.now();
  const days = [dayKey(now), dayKey(now - 86_400_000), dayKey(now - 2 * 86_400_000)];
  ok('three days running is a streak of three', streak(days, now) === 3, `${streak(days, now)}`);
  ok('a gap breaks the streak', streak([dayKey(now - 5 * 86_400_000)], now) === 0);
}
{
  const lesson = buildLesson(ITEMS, EMPTY, Date.now(), true);
  ok('a first lesson is full', lesson.length === 10, `${lesson.length}`);
  ok('a first lesson repeats nothing', new Set(lesson.map((ex) => ex.itemId)).size === lesson.length);
}

console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'}  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
