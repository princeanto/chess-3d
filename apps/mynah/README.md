# Mynah

An English course that teaches from your mistakes. Named for the bird that
learns to talk.

Free, and it stays free. No account, no ads, no lives to lose, nothing to pay
for. It runs in the browser, keeps everything on your device, and works with no
connection.

```bash
npm install && npm run dev    # localhost:3000
npm test                      # the course: the part that can be quietly wrong
```

## What makes it different from a drill app

Most apps march you down a fixed path and let you quietly forget unit one while
you are busy with unit six. Mynah runs a **Leitner schedule**: every item has a
box and a due date, a right answer moves it up and pushes it further away, and a
wrong answer sends it back to the first box so it returns within minutes, then
tomorrow, then next week. A lesson is assembled from **what you are about to
forget**, not from what comes next in a list.

A miss goes all the way back rather than down one step, deliberately. Half
remembering is what produces the illusion of learning; if something has just
fallen out of your head, the honest assumption is that you do not know it.

And every wrong answer gets the *reason*, not just the correction — "since marks
the moment it started, for measures the length" — which is the step that
actually fixes an error and the one drill apps skip.

## Content and exercises are different things

You author facts: a word with a real sentence around it, a mistake with the
reason it is a mistake, a sentence worth being able to assemble. `lesson.ts`
turns each into several kinds of question, rotating by how many times you have
seen it.

So one vocabulary entry is a meaning question the first time, a gap in its own
sentence the second, and a listening question the third. Three encounters in
three shapes, rather than the same flashcard three times — which is both better
teaching and far less to write.

The mistakes get a trick worth noting: the app diffs the wrong sentence against
the right one, and where a word is simply *wrong* you tap it. Where the fix is a
**missing** word there is nothing to point at, so that item quietly becomes a
choice between the two sentences instead. One authored fact, the right exercise
either way.

## The course

Twelve units from A1 to C1 — first words, your day, the past, getting around,
describing people, the prepositions that trip everyone, phrasal verbs, the words
that get mixed up, tenses that nearly work, English that earns its keep at work,
and register and nuance at the end.

The grammar content is weighted towards mistakes learners actually make and keep
making: *since* against *for*, *say* against *tell*, *fewer* against *less*,
*I am agree*, *discussed about*, *revert back*, *between you and I*.

## Sound

Listening exercises use the browser's own speech synthesis — no API key, no
network, no cost, and it works offline. Sound can be switched off, and every
exercise still works without it.

## What is tested

`npm test` checks the course rather than the interface. That every example
sentence contains its own word, because the gap exercise is made by cutting the
word out of it. That no wrong meaning is secretly the right one. That every
mistake differs from its correction and explains itself. That every exercise,
in every shape an item can take, still contains its own answer. And that the
schedule does what it claims: right pushes an item away, wrong sends it back
within the same sitting.

A broken button is obvious. A gap with no gap in it, or a "wrong" answer that is
actually correct, looks fine and teaches the wrong thing.

## Building

A Next.js static export, like the rest of the apps here. `npm run build` writes
`out/` — plain files, no server, nothing to hold your data.
