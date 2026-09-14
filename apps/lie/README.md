# Spot the Lie

Four statements a round. Three of them are true. One the machine made up. Find
the invention, and keep finding it — three wrong answers and you start again
from the first round.

```bash
npm install && npm run dev    # localhost:3000
npm test                      # the deck: the part that can actually be wrong
```

## The game is the content

The code is the small half. What makes this work is the writing, and it comes
down to one rule: **the true statements have to be as hard to believe as the
invented one.** A round of ordinary facts with a single whopper in it is not a
game, it is a spelling test.

So every true statement is chosen for being implausible — octopuses have three
hearts, a shrimp's heart is in its head, Cleopatra lived closer in time to the
Moon landing than to the building of the Great Pyramid — and every invention is
built to pass. Most are one of two kinds:

- **An inversion of something real.** Polar bear *meat* is poisonous but the
  liver is safe to eat, when it is precisely the other way round.
- **A myth people already half-believe.** Goldfish and their three-second
  memories, lobsters screaming in the pot, humans using 10% of their brains.

All four statements in a round share a theme, so the invention cannot be found
by noticing that it is the odd topic out. There are 56 rounds, none repeated
until you have seen them all, and the statements are shuffled within a round so
the answer never sits in the same place twice.

## Colour is the answer

Ink on warm paper, sticker-like cards with hard offset shadows, and one electric
blue for anything you can press. Green and red appear nowhere until you have
answered — then green marks what was true and red marks the invention.

Because colour carries the answer, nothing else is allowed to use it: a spent
life goes hollow rather than red, and the theme photograph sits in greyscale
while you are deciding, coming into colour only at the reveal.

## The pictures

One per theme rather than one per question, which is deliberate. A photograph of
an octopus above a round containing an octopus statement hands over the answer.
So Animals gets a zebra, Space the Tarantula Nebula, Words a page of letterpress
— and none of them appears in any statement.

They live in `public/plates`, named after their theme. Sources and licences are
recorded in `assets/picture-credits.json` and credited on the opening screen;
for the CC BY images that credit is a licence condition, not a courtesy.

## The machine talks back

Every answer gets a line, and which line depends on how the run is going rather
than only on whether this one was right. A streak earns grudging sarcasm — *"I
am running out of lies you will fall for."* A run of misses wears its patience
down. Losing a long streak has its own send-off, and being wrong *after*
spending a hint is noticed.

## What is tested

`npm test` checks the deck rather than the interface, because that is what can
be quietly, invisibly wrong: exactly four statements a round, a `fake` index
that points at something, no claim appearing in two rounds (it cannot be both
true and invented), a photograph on disk for every theme, and a line available
for every mood the game can ask for.

A bug in the interface is annoying. A bad round is unwinnable, or teaches
somebody something false, and you would only find it by happening to play it.

## Building

A Next.js static export, like the rest of the apps here. `npm run build` writes
`out/`, which is plain files — there is no server, and nothing for one to hold.
