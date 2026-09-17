# Playground

`playground●` — creative tools that work anywhere. **Make something.**

Open → create → export. No account, no onboarding, no backend. Everything runs in
the browser and keeps working with no connection once it has loaded.

```bash
npm install && npm run dev    # localhost:3000
npm test                      # colour, seeds, gradients, recents, shortcuts
npm run build                 # static export in out/, plus the service worker
```

| Tool | Status |
| --- | --- |
| COLOR — palettes and gradients | Built |
| SHAPE, TYPE | Next |
| DRAW | After |
| MAKE | After |
| PLAY | Last |

## Six tools, one playground

The palette you make in COLOR is the playground's shared palette. The `●` in the
wordmark takes its most colourful entry the moment it changes, and the other
tools default to it. That is the difference between one playground and six apps
sharing a sidebar.

Everything has a seed. One generator drives every tool, so any creation can be
reproduced, and Recent stores a recipe — a tool, a seed, a few settings — rather
than a picture. It reopens exactly as it was and costs almost nothing to keep.

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
