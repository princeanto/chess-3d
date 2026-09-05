# Two apps

One repo, two unrelated apps, deployed independently from their own
subdirectories.

| | | |
| --- | --- | --- |
| **[Gambit](apps/chess)** | 3D chess with a built-in engine | [chess-3d-dusky.vercel.app](https://chess-3d-dusky.vercel.app) |
| **[Legible](apps/legible)** | WCAG contrast auditor for design systems | [legible-eight.vercel.app](https://legible-eight.vercel.app) |
| **[Runner](apps/dino)** | Offline-first endless runner | — |

Each app is standalone: its own `package.json`, its own lockfile, its own
`node_modules`. There is no workspace tooling, because there is nothing to
share — one app needs three.js and a chess engine, the other needs neither.

```bash
cd apps/chess   && npm install && npm run dev   # localhost:3000
cd apps/legible && npm install && npm run dev   # localhost:3000
cd apps/dino    && npm install && npm run dev   # localhost:3000
```

Both ship with real test suites that run from the command line:

```bash
cd apps/chess   && npm test    # perft to depth 5 + tactics + self-play
cd apps/legible && npm test    # colour conversion, gamut, APCA, the fix search
```

---

### Gambit — [apps/chess](apps/chess)

A complete game of chess: full FIDE rules, an alpha-beta engine with quiescence
search running in a Web Worker, and a Staunton set built from procedural
geometry — no model files or texture assets anywhere. Move generation is
validated with perft against seven published reference positions, 17M nodes,
exact. 3D and 2D board views.

### Legible — [apps/legible](apps/legible)

Checks whether the colours in a product are readable, for people who do not
have a tokens file to hand. Three ways in:

- **A screenshot** — pixels are clustered in OKLab to recover the palette
  actually on screen. Runs entirely in the browser; the image is never uploaded.
- **A web address** — a server route reads the colours declared in the page's
  stylesheets. Fenced against SSRF: http(s) only, and nothing resolving to
  loopback, link-local or private ranges.
- **Colour codes** — hex, CSS custom properties, Sass variables, or JSON.

Every foreground/background pair is graded against WCAG 2.2, with APCA
alongside as a second opinion. Failing pairs are moved in OKLCH to the nearest
passing value — lightness shifts while hue holds, so the brand survives the
fix. Colour conversion, sRGB gamut mapping and the fix search are implemented
from the specs rather than imported, and checked against published reference
values on every build.

### Runner — [apps/dino](apps/dino)

The game you get when the connection drops, rebuilt: parallax dunes, a day that
turns to night, dust that kicks up on landing, and a jump you can cut short by
releasing early.

It is a real PWA — installable, and genuinely playable with no connection. The
service worker precaches the shell and caches hashed chunks on first fetch,
since Next's filenames change every build and a hardcoded precache list would
rot immediately. Verified by cutting the network in the browser, reloading, and
playing.

Every pixel is drawn from paths and every sound is synthesised with an
oscillator, so the app ships **zero binary assets** except its own icons —
which are themselves encoded at build time by `npm run icons`, writing PNG
chunks directly rather than taking on an image dependency. Nothing to fail to
load is the strongest form of "works offline".

The simulation runs on a fixed 120Hz timestep, decoupled from rendering. A
variable-dt integrator makes jump height depend on frame rate, so the same
input clears an obstacle on a 60Hz laptop and clips it on a 144Hz monitor.
