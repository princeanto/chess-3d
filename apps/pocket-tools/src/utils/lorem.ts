/** Placeholder text, shaped like real text: sentences of varied length, paragraphs of a few sentences. */

import { randomInt } from './random';

const WORDS = (
  'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ' +
  'enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in ' +
  'reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui ' +
  'officia deserunt mollit anim id est laborum curabitur pretium tincidunt lacus nulla gravida orci a odio nullam varius turpis ' +
  'et commodo pharetra eros bibendum nec luctus magna felis sollicitudin mauris integer dignissim vivamus viverra fermentum ' +
  'felis donec nonummy pellentesque ante phasellus adipiscing semper elit proin fermentum massa ac quam sed diam turpis molestie'
).split(' ');

type Random = (min: number, max: number) => number;

const capital = (s: string) => s[0].toUpperCase() + s.slice(1);

function words(count: number, random: Random, classic: boolean): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) out.push(classic && i < 5 ? WORDS[i] : WORDS[random(0, WORDS.length - 1)]);
  return out;
}

function sentence(random: Random, classic: boolean): string {
  const list = words(random(6, 16), random, classic);
  // A comma now and then, where a person would pause.
  if (list.length > 9) list[random(3, list.length - 4)] += ',';
  return `${capital(list.join(' '))}.`;
}

export type LoremUnit = 'words' | 'sentences' | 'paragraphs';

export function lorem(count: number, unit: LoremUnit, classic = true, random: Random = randomInt): string {
  const n = Math.max(1, Math.min(unit === 'words' ? 5000 : unit === 'sentences' ? 500 : 100, Math.floor(count)));
  if (unit === 'words') return `${capital(words(n, random, classic).join(' '))}.`;
  if (unit === 'sentences') return Array.from({ length: n }, (_, i) => sentence(random, classic && i === 0)).join(' ');
  return Array.from({ length: n }, (_, p) =>
    Array.from({ length: random(3, 6) }, (_, i) => sentence(random, classic && p === 0 && i === 0)).join(' ')).join('\n\n');
}
