# Two apps

One repo, two unrelated apps, deployed independently from their own
subdirectories.

| | | |
| --- | --- | --- |
| **[Gambit](apps/chess)** | 3D chess with a built-in engine | [chess-3d-dusky.vercel.app](https://chess-3d-dusky.vercel.app) |
| **[Legible](apps/legible)** | WCAG contrast auditor for design systems | [legible-eight.vercel.app](https://legible-eight.vercel.app) |

Each app is standalone: its own `package.json`, its own lockfile, its own
`node_modules`. There is no workspace tooling, because there is nothing to
share — one app needs three.js and a chess engine, the other needs neither.

```bash
cd apps/chess   && npm install && npm run dev   # localhost:3000
cd apps/legible && npm install && npm run dev   # localhost:3000
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

Paste a palette and get every foreground/background pair graded against WCAG
2.2, with APCA alongside as a second opinion. Failing pairs are moved in OKLCH
to the nearest passing value — lightness shifts while hue holds, so the brand
survives the fix. Colour conversion, sRGB gamut mapping and the fix search are
implemented from the specs rather than imported, and checked against published
reference values on every build.
