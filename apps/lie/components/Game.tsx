'use client';

/**
 * The whole game.
 *
 * Five states and it is always in exactly one: the opening screen, a round, the
 * reveal, out of lives, or the end of the deck. Everything the player has done
 * lives in a single object that is written to this browser after every change,
 * so closing the tab mid-run loses nothing.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ROUNDS, plateFor } from '@/lib/rounds';
import { QUESTIONS, pickQuip, tierFor } from '@/lib/quips';

const KEY = 'spotthelie.v2';
const LIVES = 3;
const HINTS = 3;

const PICTURE_CREDIT =
  'Pictures: NASA, Charles J. Sharp, Drew Coffman, the US Patent Office, the Wellcome ' +
  'Collection and other contributors — public domain, CC0 and CC BY, via Wikimedia Commons.';

type Phase = 'start' | 'play' | 'reveal' | 'over' | 'done';

interface Run {
  order: number[];
  at: number;
  score: number;
  streak: number;
  correct: number;
  played: number;
  hints: number;
  strikes: number;
  /** Kept between runs. */
  best: number;
  lifetime: number;
}

const FRESH: Run = {
  order: [],
  at: 0,
  score: 0,
  streak: 0,
  correct: 0,
  played: 0,
  hints: HINTS,
  strikes: 0,
  best: 0,
  lifetime: 0,
};

function shuffle<T>(list: T[]): T[] {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/* Storage is refused outright in some browsers; the game then simply forgets. */
function load(): Run {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<Run>;
    const order = Array.isArray(stored.order) && stored.order.length === ROUNDS.length ? stored.order : [];
    return { ...FRESH, ...stored, order };
  } catch {
    return { ...FRESH };
  }
}

export default function Game() {
  const [run, setRun] = useState<Run>(load);
  const [phase, setPhase] = useState<Phase>('start');
  const [shown, setShown] = useState<number[]>([0, 1, 2, 3]);
  const [picked, setPicked] = useState<number | null>(null);
  const [removed, setRemoved] = useState<number | null>(null);
  const [quip, setQuip] = useState('');
  const [gained, setGained] = useState(0);

  // Consecutive misses steer the insults, but are nobody's business after a
  // reload, so they stay out of storage.
  const miss = useRef(0);
  const recent = useRef<string[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(run));
    } catch {
      /* nothing to be done, and nothing worth interrupting the game for */
    }
  }, [run]);

  const round = run.order.length === ROUNDS.length ? ROUNDS[run.order[run.at]] : ROUNDS[0];
  const playing = phase === 'play' || phase === 'reveal';

  const deal = useCallback(() => {
    // The invented statement moves every round, so the answer is never twice in
    // the same place.
    setShown(shuffle([0, 1, 2, 3]));
    setPicked(null);
    setRemoved(null);
  }, []);

  const start = useCallback(
    (fresh: boolean) => {
      setRun((prev) =>
        fresh || prev.order.length !== ROUNDS.length
          ? {
              ...prev,
              order: shuffle(ROUNDS.map((_, i) => i)),
              at: 0,
              score: 0,
              streak: 0,
              correct: 0,
              played: 0,
              hints: HINTS,
              strikes: 0,
            }
          : prev,
      );
      miss.current = 0;
      deal();
      setPhase('play');
    },
    [deal],
  );

  const answer = useCallback(
    (index: number) => {
      if (phase !== 'play' || index === removed) return;
      const right = shown[index] === round.fake;
      const streakBefore = run.streak;
      const missBefore = miss.current;
      const usedHint = removed !== null;

      const streak = right ? run.streak + 1 : 0;
      const points = right ? 10 + Math.min(streak - 1, 5) * 2 : 0;
      miss.current = right ? 0 : miss.current + 1;

      const line = pickQuip(
        right ? 'right' : 'wrong',
        tierFor(right, { streak, miss: miss.current, missBefore, streakBefore, usedHint }),
        recent.current,
      );
      recent.current = [...recent.current, line].slice(-9);

      setGained(points);
      setQuip(line);
      setPicked(index);
      setPhase('reveal');
      setRun((prev) => ({
        ...prev,
        streak,
        score: prev.score + points,
        correct: prev.correct + (right ? 1 : 0),
        played: prev.played + 1,
        lifetime: prev.lifetime + 1,
        best: Math.max(prev.best, streak),
        strikes: prev.strikes + (right ? 0 : 1),
      }));
    },
    [phase, removed, round, run.streak, shown],
  );

  const next = useCallback(() => {
    if (run.strikes >= LIVES) {
      // Nothing left to resume: the next run starts at the first round.
      setRun((prev) => ({ ...prev, order: [], at: 0 }));
      setPhase('over');
      return;
    }
    const at = run.at + 1;
    if (at >= ROUNDS.length) {
      setPhase('done');
      return;
    }
    setRun((prev) => ({ ...prev, at }));
    deal();
    setPhase('play');
    window.scrollTo(0, 0);
  }, [deal, run.at, run.strikes]);

  const hint = useCallback(() => {
    if (phase !== 'play' || run.hints <= 0 || removed !== null) return;
    const candidates = shown
      .map((source, i) => ({ source, i }))
      .filter((c) => c.source !== round.fake);
    const drop = candidates[Math.floor(Math.random() * candidates.length)];
    setRemoved(drop.i);
    setRun((prev) => ({ ...prev, hints: prev.hints - 1, score: Math.max(0, prev.score - 5) }));
  }, [phase, removed, round, run.hints, shown]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase === 'play' && e.key >= '1' && e.key <= '4') answer(Number(e.key) - 1);
      else if (phase === 'play' && e.key.toLowerCase() === 'h') hint();
      else if (phase === 'reveal' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [answer, hint, next, phase]);

  const accuracy = run.played ? Math.round((run.correct / run.played) * 100) : 0;

  return (
    <>
      <div className="rail">
        <span style={{ width: playing ? `${(run.at / ROUNDS.length) * 100}%` : 0 }} />
      </div>

      <div className="wrap">
        <header className="top" hidden={!playing}>
          <h1 className="mark">Spot the Lie</h1>
          <div className="state">
            <div className="pips" role="img" aria-label={`${LIVES - run.strikes} of ${LIVES} lives left`}>
              {[0, 1, 2].map((i) => (
                <span key={i} className={`pip${i < run.strikes ? ' lost' : ''}`} />
              ))}
            </div>
            <div className="score">{run.score}</div>
          </div>
        </header>

        <main id="view">
          {phase === 'start' && (
            <section>
              <h2 className="title">
                Three are true.
                <br />
                One is a <em>filthy lie</em>.
              </h2>
              <p className="lede">
                Four statements a round. Three genuinely happened. One I invented on a whim.{' '}
                <b>All four sound invented</b> — that is rather the point.
              </p>
              <button className="go" onClick={() => start(false)}>
                {run.order.length === ROUNDS.length && run.at > 0
                  ? `Back in at round ${run.at + 1}`
                  : 'Deal me in'}
              </button>
              {run.lifetime > 0 && (
                <dl className="record">
                  <div>
                    <dt>Best streak</dt>
                    <dd>{run.best}</dd>
                  </div>
                  <div>
                    <dt>Rounds played</dt>
                    <dd>{run.lifetime}</dd>
                  </div>
                </dl>
              )}
              <p className="how">
                {ROUNDS.length} rounds, none of them repeated until you have seen them all. Tap a
                statement to answer, or press 1 to 4. You get three hints a run, each ruling out one
                statement that is true. <b>Three wrong answers and you start again from the first
                round.</b>
              </p>
              <p className="credit">{PICTURE_CREDIT}</p>
            </section>
          )}

          {playing && (
            <section>
              <div
                className={`plate${phase === 'reveal' ? ' lit' : ''}`}
                role="img"
                aria-label={round.t}
                style={{ backgroundImage: `url(${plateFor(round.t)})` }}
              />
              <span className="theme">{round.t}</span>
              <p className="ask">{QUESTIONS[run.at % QUESTIONS.length]}</p>

              <div className="cards">
                {shown.map((source, i) => {
                  const isFake = source === round.fake;
                  const revealed = phase === 'reveal';
                  const marked = revealed ? (isFake ? 'is-fake' : 'is-true') : i === removed ? 'is-true gone' : '';
                  const mine = revealed && i === picked;
                  return (
                    <button
                      key={`${run.at}-${i}`}
                      className={`card ${marked}${mine ? ' picked' : ''}${mine && !isFake ? ' wrong' : ''}`}
                      disabled={revealed || i === removed}
                      onClick={() => answer(i)}
                    >
                      <span className="key">{i + 1}</span>
                      <span className="claim">
                        {round.s[source]}
                        {mine && <span className="mine">Your pick, sadly</span>}
                      </span>
                      <span className="verdict">
                        {revealed ? (isFake ? 'Invented' : 'True') : i === removed ? 'True' : ''}
                      </span>
                    </button>
                  );
                })}
              </div>

              {phase === 'play' && (
                <button className="hint" onClick={hint} disabled={run.hints === 0 || removed !== null}>
                  {run.hints > 0 ? `Throw me a bone — ${run.hints} left` : 'No bones left'}
                </button>
              )}

              {phase === 'reveal' && (
                <div className="outcome">
                  <p className={`headline ${picked !== null && shown[picked] === round.fake ? 'good' : 'bad'}`}>
                    {quip}
                    {gained > 0 && (
                      <span className="gain">
                        +{gained}
                        {run.streak > 2 ? ` · streak ${run.streak}` : ''}
                      </span>
                    )}
                  </p>
                  <p className="why">
                    <b>{round.s[round.fake]}</b> — {round.why}
                  </p>
                  <button className="next" onClick={next} autoFocus>
                    {run.strikes >= LIVES
                      ? 'Survey the wreckage'
                      : run.at + 1 >= ROUNDS.length
                        ? 'Show me the damage'
                        : 'Go again'}
                  </button>
                </div>
              )}
            </section>
          )}

          {phase === 'over' && (
            <section className="done">
              <h2 className="title">Three strikes.</h2>
              <p className="lede" style={{ marginLeft: 'auto', marginRight: 'auto' }}>
                You lasted {run.played} {run.played === 1 ? 'round' : 'rounds'} and got {accuracy}% of
                them right. Back to round one with you.
              </p>
              <dl className="grades">
                <div>
                  <dt>Score</dt>
                  <dd>{run.score}</dd>
                </div>
                <div>
                  <dt>Right</dt>
                  <dd>
                    {run.correct}/{run.played}
                  </dd>
                </div>
                <div>
                  <dt>Best streak</dt>
                  <dd>{run.best}</dd>
                </div>
              </dl>
              <button className="go" onClick={() => start(true)}>
                Back to round one
              </button>
            </section>
          )}

          {phase === 'done' && (
            <section className="done">
              <h2 className="title">
                {accuracy >= 85
                  ? 'Unfoolable. Frankly suspicious.'
                  : accuracy >= 65
                    ? 'A good nose for nonsense.'
                    : accuracy >= 45
                      ? 'Fooled roughly half the time, like everyone.'
                      : 'I had your number the whole way.'}
              </h2>
              <dl className="grades">
                <div>
                  <dt>Score</dt>
                  <dd>{run.score}</dd>
                </div>
                <div>
                  <dt>Right</dt>
                  <dd>
                    {run.correct}/{run.played}
                  </dd>
                </div>
                <div>
                  <dt>Best streak</dt>
                  <dd>{run.best}</dd>
                </div>
              </dl>
              <button className="go" onClick={() => start(true)}>
                Go round again
              </button>
              <p className="how">
                The same {ROUNDS.length} rounds come back in a new order, with the four statements
                shuffled inside each one.
              </p>
            </section>
          )}
        </main>
      </div>
    </>
  );
}
