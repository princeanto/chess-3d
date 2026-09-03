/**
 * Difficulty sanity: each level should beat the one below it over a short
 * match, and no level should be hanging material in the opening.
 */
import { parseFen, START_FEN } from '../lib/chess/fen';
import { evaluateResult, repetitionKey } from '../lib/chess/game';
import { generateLegalMoves, makeMove } from '../lib/chess/moves';
import { toSan } from '../lib/chess/san';
import { clearTable, findBestMove } from '../lib/chess/search';
import { LEVELS, LEVEL_ORDER } from '../lib/game/difficulty';
import { WHITE } from '../lib/chess/types';

console.log('OPENING CHOICE (first move as White, 6 samples per level)');
for (const id of LEVEL_ORDER) {
  const spec = LEVELS[id];
  const picks: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    clearTable();
    const pos = parseFen(START_FEN);
    const legal = generateLegalMoves(pos);
    const r = findBestMove(pos, { ...spec, seed: 1000 + i * 7717 });
    picks.push(toSan(pos, r.move, legal));
  }
  console.log(`  ${spec.name.padEnd(8)} ${picks.join(' ')}`);
}

console.log('\nMATCH: each level vs the one below (2 games, colours swapped)');
for (let i = 1; i < LEVEL_ORDER.length; i += 1) {
  const strong = LEVELS[LEVEL_ORDER[i]];
  const weak = LEVELS[LEVEL_ORDER[i - 1]];
  let strongPoints = 0;

  for (let game = 0; game < 2; game += 1) {
    clearTable();
    const pos = parseFen(START_FEN);
    const reps = new Map<string, number>();
    reps.set(repetitionKey(pos), 1);
    const strongIsWhite = game === 0;
    let plies = 0;
    let status = evaluateResult(pos, reps);

    while (!status.over && plies < 140) {
      const strongToMove = (pos.turn === WHITE) === strongIsWhite;
      const spec = strongToMove ? strong : weak;
      const r = findBestMove(pos, { ...spec, timeMs: Math.min(spec.timeMs, 700), seed: game * 31 + plies });
      if (!r.move) break;
      makeMove(pos, r.move);
      const key = repetitionKey(pos);
      reps.set(key, (reps.get(key) ?? 0) + 1);
      plies += 1;
      status = evaluateResult(pos, reps);
    }

    if (status.over && status.reason === 'checkmate') {
      strongPoints += (status.winner === WHITE) === strongIsWhite ? 1 : 0;
    } else {
      strongPoints += 0.5;
    }
  }

  console.log(
    `  ${strong.name.padEnd(8)} vs ${weak.name.padEnd(8)} → ${strongPoints}/2 for the stronger side`,
  );
}
