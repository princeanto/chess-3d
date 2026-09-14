# Spot the Lie

Four statements a round. Three of them are true. One the machine made up. Find
the invention, and try to do it three times in a row without being caught out —
three wrong answers and you start again from the first round.

One file, no dependencies, no build step. Open `index.html` and it runs.

## The game is the content

The code here is small. What makes it work is the writing, and it took one rule:
**the true statements have to be as hard to believe as the invented one.** A
round of ordinary facts with one whopper is not a game, it is a spelling test.

So every true statement is chosen for being implausible — octopuses have three
hearts, a shrimp's heart is in its head, Cleopatra lived closer in time to the
Moon landing than to the building of the Great Pyramid — and every invention is
built to pass. Most are one of two kinds:

- **An inversion of something real.** Polar bear *meat* is poisonous but the
  liver is safe to eat, when it is precisely the other way round.
- **A myth people already half-believe.** Goldfish and their three-second
  memories; lobsters screaming in the pot; humans using 10% of their brains.

All four statements in a round share a theme, so the invention cannot be spotted
by noticing that it is the odd topic out. 56 rounds, none repeated until you have
seen them all, and the four statements are shuffled within a round so the answer
never sits in the same place twice.

## Colour is the answer

The interface is ink on warm paper with one electric blue for anything you can
press. Green and red appear nowhere until you have answered — then green marks
what was true and red marks the invention. Because colour means the answer, it is
not allowed anywhere else: a spent life goes hollow rather than red, and the
theme photograph sits in greyscale while you are deciding and comes into colour
at the reveal.

## The pictures

One per theme rather than one per question, and that is deliberate: a photograph
of an octopus above a round containing an octopus statement hands you the answer.
So Animals gets a zebra, Space the Tarantula Nebula, Words a page of letterpress
— none of them appears in any statement.

They are embedded in the page as data URIs. Sources and licences are recorded in
`assets/picture-credits.json` and credited on the opening screen; for the CC BY
images that credit is a licence condition, not a courtesy.

## The machine talks back

Every answer gets a line, and which line depends on how the run is going rather
than only on whether you were right. A streak earns grudging sarcasm. A run of
misses wears its patience down. Losing a long streak has its own send-off, and
getting one wrong *after* spending a hint is noticed.

## Deploying

Static. Vercel serves the directory as-is with no framework and no build
command — `index.html` is the whole app.
