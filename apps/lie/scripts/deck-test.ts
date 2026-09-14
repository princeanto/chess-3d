/**
 * Checks the deck, which is the part of this game that can actually be wrong.
 *
 * A bug in the interface is annoying. A bad round — two invented statements, a
 * `fake` index pointing at nothing, the same claim appearing twice — makes the
 * game unwinnable or, worse, quietly teaches somebody something false. None of
 * that is visible by playing: you would have to hit that one round.
 */

import { ROUNDS, plateFor } from '../lib/rounds';
import { QUIPS, QUESTIONS, tierFor } from '../lib/quips';
import { existsSync } from 'fs';
import { resolve } from 'path';

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

console.log('\nDECK');
ok('there are more than fifty rounds', ROUNDS.length > 50, `${ROUNDS.length}`);
ok('every round has exactly four statements', ROUNDS.every((r) => r.s.length === 4));
ok(
  'every fake index points at a statement',
  ROUNDS.every((r) => Number.isInteger(r.fake) && r.fake >= 0 && r.fake < 4),
);
ok('every round explains itself', ROUNDS.every((r) => r.why.trim().length > 20));
ok('every round has a theme', ROUNDS.every((r) => r.t.trim().length > 0));

{
  // A statement repeated across two rounds means one of them is wrong, since
  // the same claim cannot be both true and invented.
  const seen = new Map<string, string>();
  const clashes: string[] = [];
  for (const round of ROUNDS) {
    for (const claim of round.s) {
      const key = claim.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      const already = seen.get(key);
      if (already) clashes.push(`"${claim.slice(0, 40)}…" in ${already} and ${round.t}`);
      else seen.set(key, round.t);
    }
  }
  ok('no statement appears in two rounds', clashes.length === 0, clashes.join('; '));
}

{
  const stutter = ROUNDS.filter((r) => new Set(r.s).size !== 4).map((r) => r.t);
  ok('no round repeats itself', stutter.length === 0, stutter.join(', '));
}

console.log('\nPICTURES');
{
  const missing = [...new Set(ROUNDS.map((r) => r.t))].filter(
    (theme) => !existsSync(resolve(__dirname, '..', 'public', plateFor(theme).slice(1))),
  );
  ok('every theme has its photograph', missing.length === 0, missing.join(', '));
}

console.log('\nTHE MACHINE');
ok('there are questions to ask', QUESTIONS.length > 0);
{
  const tiers = ['plain', 'warm', 'hot', 'recover'];
  ok('every praise tier has lines', tiers.every((t) => (QUIPS.right[t] ?? []).length > 0));
}
{
  const tiers = ['plain', 'again', 'dire', 'fall', 'hint'];
  ok('every insult tier has lines', tiers.every((t) => (QUIPS.wrong[t] ?? []).length > 0));
}
{
  // The tiers the game can actually ask for must all exist, or a run of bad
  // luck would hand the player an empty line.
  const asked = new Set<string>();
  for (const right of [true, false]) {
    for (const streak of [0, 1, 3, 6]) {
      for (const miss of [0, 2, 4]) {
        for (const usedHint of [true, false]) {
          asked.add(
            `${right ? 'right' : 'wrong'}:${tierFor(right, {
              streak,
              miss,
              missBefore: miss,
              streakBefore: streak,
              usedHint,
            })}`,
          );
        }
      }
    }
  }
  const empty = [...asked].filter((key) => {
    const [kind, tier] = key.split(':') as ['right' | 'wrong', string];
    return (QUIPS[kind][tier] ?? []).length === 0;
  });
  ok('every tier the game asks for exists', empty.length === 0, empty.join(', '));
}

console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'}  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
