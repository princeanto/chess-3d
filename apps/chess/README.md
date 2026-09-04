# Gambit — 3D Chess

**Live: https://chess-3d-dusky.vercel.app**

A complete game of chess in the browser: full FIDE rules, a built-in engine, and a
Staunton piece set rendered in 3D from procedural geometry — no model files, no
textures on disk, no external assets of any kind.

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # typecheck + perft + engine tests
```

---

## The rules are provably correct

Move generation is validated with **perft**, the standard correctness test: walk the
full legal game tree to a fixed depth and count leaf nodes, then compare against
published reference values. Matching them means castling, en passant, promotion,
pins, discovered check and check evasion are all exactly right — a single misplaced
rule shows up as a wrong count immediately.

```
$ npm run perft
  ok   Start position         depth 5    4865609     459ms
  ok   Kiwipete               depth 4    4085603     350ms
  ok   Position 3 (endgame)   depth 5     674624      71ms
  ok   Position 4 (promotions) depth 4     422333      35ms
  ok   Position 4 mirrored    depth 4     422333      40ms
  ok   Position 5             depth 4    2103487     175ms
  ok   Position 6             depth 4    3894594     294ms
  ok   incremental Zobrist matches full recomputation to depth 3
PASS — 16,996,788 nodes in 1.6s
```

Seven positions, 17 million nodes, all exact. The last line separately checks that
incremental Zobrist hashing agrees with a full recomputation after every move, which
is what makes the transposition table trustworthy.

Everything else follows: checkmate, stalemate, the fifty-move rule, threefold
repetition, and the FIDE dead-position set for insufficient material.

## The engine

[lib/chess/search.ts](lib/chess/search.ts) — iterative deepening alpha-beta with:

- **Quiescence search** past the horizon, so it never walks into a recapture
- **Transposition table** (1M entries, depth-preferred replacement)
- **Move ordering**: TT move, MVV-LVA captures, killers, history heuristic
- **Null-move pruning**, skipped in check and in likely-zugzwang endings
- **Late move reductions** on quiet moves that ordering ranked poorly
- **Check extensions**

It runs in a Web Worker ([workers/engine.worker.ts](workers/engine.worker.ts)) — a
five-second search on the main thread would freeze the board, and orbiting the
scene while your opponent thinks is half of what makes a 3D board feel alive.

`npm run test:engine` checks it against mate puzzles whose answers are **derived by
an independent exhaustive prover**, not written by hand, so a wrong expectation in
the test file cannot masquerade as an engine bug. (That caught a mistake of mine:
a position I had labelled with one mating move actually had four.) It then plays a
full game against itself and asserts every move is legal.

### Difficulty

Weak levels are not made weak by injecting blunders. They search less deeply and
choose from among near-equal moves, weighted toward the best — which loses the way
a weaker player loses, rather than by hanging a queen at random.

| Level | Search | Strength |
| --- | --- | --- |
| Novice | 2 ply | ~600 |
| Casual | 3 ply | ~1000 |
| Club | 5 ply | ~1450 |
| Expert | 8 ply, 2.5s | ~1800 |
| Master | iterative, 5s | ~2100 |

`npm run test:levels` plays each level against the one below it; every level wins
its match. Getting there exposed a real bug: root moves searched after the first
report fail-low *upper bounds*, not true scores, so the "within N centipawns" pool
was being built from meaningless numbers and Club was opening 1.Na3. Weak levels now
search root moves with a full window.

## The 3D set

[components/scene/pieceGeometry.ts](components/scene/pieceGeometry.ts) — each piece
is a lathed silhouette plus a few solid details, sharing one foot and collar profile
so the set reads as a set. The knight is the one piece a lathe cannot describe, so
it is an extruded side profile — the same solution a real carver uses.

Profiles are authored at a convenient scale and then stretched vertically to
tournament proportions (a Staunton king stands about 1.65 square-widths). Stretching
in Y only keeps the bases correctly sized; scaling uniformly would have them
spilling over the square edges.

The board is a single canvas texture ([boardTexture.ts](components/scene/boardTexture.ts))
with procedural wood grain, a brass inlay and coordinates on all four edges so they
read from either side.

Lighting is a three-point rig with real shadow maps: a warm key, a cool fill that
keeps the dark set from going flat, and a low rim light that picks the silhouettes
out of the background.

## Playing

- **Click** a piece, then a highlighted square. Legal targets show as dots, captures
  as rings.
- **Drag** to orbit, **scroll** to zoom, **Flip** to walk round to the other side.
- **← →** step through the game, **↑ ↓** jump to start/end, **u** undo, **f** flip,
  **Esc** deselect.
- Paste a **FEN** to set up any position; copy the current one back out.

Legal-move markers are clickable and sit slightly above the board, because a tall
piece in front will otherwise catch the ray before the square behind it does.

## Layout

```
app/                route shell, global stylesheet
components/
  ChessApp.tsx      composition, keyboard, engine turn-taking
  scene/            Canvas, lighting, board, pieces, piece geometry
  ui/               sidebar, move list, captured material, promotion dialog
lib/
  chess/            rules engine — types, movegen, FEN, SAN, evaluation, search
  game/             Zustand store, difficulty levels, worker hook
workers/            engine worker
scripts/            perft, engine tests, level matches
```

The rules engine under `lib/chess/` has no React, no DOM and no three.js in it — it
is plain TypeScript over a 0x88 board, which is why it can be tested at 10M nodes a
second from the command line.
