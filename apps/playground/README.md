# Playground

`playground●` — creative tools that work anywhere. **Make something.**

Open → create → export. No account, no onboarding, no backend. Everything runs in
the browser and keeps working with no connection once it has loaded.

```bash
npm install && npm run dev    # localhost:3000
npm test                      # colour, patterns, type, saves, fonts, drawing, shortcuts
npm run build                 # static export in out/, plus the service worker
```

| Tool | Status |
| --- | --- |
| COLOR — palettes and gradients | Built |
| SHAPE — thirteen seeded patterns | Built |
| TYPE — poster typography, seven presets, every Google font | Built |
| DRAW — brushes, shapes, grid, symmetry | Built |
| SAVED — everything kept, with backups | Built |
| MAKE | Next |
| PLAY | Last |

## Six tools, one playground

The palette you make in COLOR is the playground's shared palette. The `●` in the
wordmark takes its most colourful entry the moment it changes, and the other
tools default to it. That is the difference between one playground and six apps
sharing a sidebar.

Everything has a seed. One generator drives every tool, so any creation can be
reproduced, and Recent stores a recipe — a tool, a seed, a few settings — rather
than a picture. It reopens exactly as it was and costs almost nothing to keep.

## Patterns you can hand to someone

A SHAPE pattern is a pure function of what the panel shows: the kind, the seed,
density, scale, rotation, spacing and the colours. The same state draws the same
SVG, byte for byte, which is what makes a copied seed worth anything. The preview,
the PNG, the SVG and the CSS background are all that one SVG.

Patterns are drawn across a square as wide as the canvas's diagonal and rotated
about the centre, so turning one never shows a bare corner. Randomize picks from
ranges tuned per pattern, because every kind has a density past which it turns to
grey mush and a scale below which it vanishes. Shape colours too close to the
background to see are left out.

## Type that fits, and exports as it looked

"Fit to width" measures the real glyphs after the font has loaded, then sizes
the longest line to the width, capped so a column of single words cannot run
off the bottom. Right- and centre-aligned lines are shifted by one letter-space,
because tracking is added after the last character too.

Exports carry the font inside the SVG. An SVG drawn into a canvas for PNG
export cannot see the page's fonts, and one opened on another machine only has
that machine's, so embedding is the only way either looks like the preview.
Presets and Randomize only choose text and background pairs that clear 4.5:1,
and fall back to ink or paper when the palette has none.

Randomize is only fun if the last one can come back: SHAPE and TYPE keep an undo
history, with a dragged slider or a run of typing counted as one step.

## Saved, and why it has a backup button

⌘S saves in every tool, and everything saved appears in that tool's Saved row
and on the Saved page, where it can be renamed, filtered and deleted. A save is
a recipe, like Recent, except for drawings, whose strokes go in IndexedDB with
a small thumbnail beside the entry.

Nothing leaves the device, which means clearing the browser's site data erases
it. The backup is one JSON file with every entry and every drawing in it; loading
it merges, skipping anything already there, and ignores entries that are not
valid rather than trusting the file.

## Every Google font, one at a time

The whole Google Fonts catalogue — 1,946 families, 15 KB gzipped — ships with
the app (`npm run fonts` refreshes it), so browsing and search work offline.
A font loads only when picked. The list previews each family using just the
letters of its name, a few hundred bytes a row, and only for the rows in view.
Fonts are registered through the FontFace API under separate names for preview
and use, so a name-only preview can never stand in for the real font.

Picked fonts are cached by the service worker and work offline afterwards.
Exports embed only the faces the text needs. This is the one place Playground
talks to anyone else, and the dialog says so.

## Drawing as strokes

DRAW stores strokes, not pixels, in coordinates centred on the canvas with 1000
units across its shorter side, so resizing redraws rather than crops, undo drops
a stroke, and SVG export is exact. Each stroke is painted opaque onto a scratch
canvas and composited once at its opacity, so a translucent marker does not
darken where it crosses itself or its symmetry copies. The eraser composites the
same way, removing ink and never the background, and exports as an SVG mask
over what came before it. Symmetry is stored per stroke. A stylus gets pressure,
and once one is used, touches are ignored so a resting palm does not draw.

## Colour that looks designed

Palettes are built in **OKLCH**, not HSL. HSL lightness is arithmetic rather than
perception: a yellow and a blue at the same HSL lightness look nothing alike, so
rotating hue in HSL is how generated palettes end up with a glaring yellow next
to a muddy blue. OKLCH is built so equal steps look equal.

That lets every palette start from a **value plan** — something dark to anchor
it, something light to breathe, steps between — before any hue is chosen. Five
well-related mid-tones read as paint chips; a range of values reads as a palette.
Multi-hue schemes also get one near-neutral, which gives the eye a place to rest.

Colours a screen cannot show are brought into range by reducing chroma while
holding lightness and hue, found by bisection. Clipping each channel instead
would shift the hue, and hue relationships are the whole point.

Locking a colour makes its hue the anchor for the next palette, so a locked
terracotta gets colours that belong with terracotta.

## Gradients that match their CSS

The preview is the CSS itself, so Copy CSS gives you exactly what you see. PNG
and SVG exports reproduce CSS's own geometry: a linear gradient's line is not
corner to corner but `|w·sin θ| + |h·cos θ|` long through the centre, and a
naive canvas version comes out visibly wrong at any angle that is not a right
angle.

## Offline, honestly

`npm run build` runs `next build` and then writes a service worker listing every
file in the export. Tools load lazily, each as its own chunk, so caching only
what a first visit happens to fetch would leave the tools you have not opened yet
broken offline. The sidebar says **Offline ready** only once the worker has
actually cached everything — before that it says it is still saving.

Fonts are self-hosted: Inter for the interface, and Archivo, Instrument Serif,
IBM Plex Mono and Syne for the creative tools. 218 KB of latin subsets under the
SIL Open Font License, and the app never requests a font over the network.

## Keyboard

| Key | |
| --- | --- |
| `Space` / `R` | Randomize |
| `E` | Export |
| `⌘/Ctrl S` | Save locally |
| `⌘/Ctrl Z`, `⌘/Ctrl ⇧ Z` | Undo, redo |
| `⌘/Ctrl K` | Command palette |
| `C` `T` `S` `D` `M` `P` | Open a tool |

Plain-key shortcuts stand down while you are typing in a field, so typing
"CREATE" does not send you to Color. Space also stands down while a button has
keyboard focus — Space on a lock means *toggle this lock*. Buttons let go of
focus after a mouse press, so Space still randomizes for mouse users.

## Accessibility

Real elements throughout: buttons are buttons, segmented controls are radio
groups with arrow-key movement, gradient stops are sliders you can nudge from the
keyboard. Visible focus, a skip link, polite live-region toasts, reduced-motion
respected, and secondary text at 4.9:1 rather than the brief's `#737373`, which
measures 4.2:1 on the off-white background.
