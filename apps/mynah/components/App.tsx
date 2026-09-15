'use client';

/**
 * The whole app.
 *
 * Three screens: the path of units, a lesson, and what you did. The lesson is
 * assembled fresh each time from the review schedule, so the same button never
 * gives you the same ten questions twice.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ITEMS, UNITS, UNIT_ITEMS } from '@/lib/course';
import { buildLesson, unitProgress } from '@/lib/lesson';
import { EMPTY, dayKey, fresh, isDue, review, streak, weakest } from '@/lib/srs';
import type { Exercise, Progress } from '@/lib/types';

const KEY = 'mynah.v1';
const XP_PER_RIGHT = 10;

type Screen = 'path' | 'lesson' | 'summary';

function load(): Progress {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<Progress>;
    return { ...EMPTY, ...stored, cards: stored.cards ?? {} };
  } catch {
    return { ...EMPTY };
  }
}

/** The browser's own voice. No key, no network, no cost. */
function speak(text: string, on: boolean): void {
  if (!on || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const said = new SpeechSynthesisUtterance(text);
    said.lang = 'en-GB';
    said.rate = 0.95;
    window.speechSynthesis.speak(said);
  } catch {
    /* some browsers refuse without a gesture; the exercise still works */
  }
}

export default function App() {
  const [progress, setProgress] = useState<Progress>(load);
  const [screen, setScreen] = useState<Screen>('path');
  const [queue, setQueue] = useState<Exercise[]>([]);
  const [at, setAt] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [placed, setPlaced] = useState<string[]>([]);
  const [checked, setChecked] = useState(false);
  const [right, setRight] = useState(false);
  const [tally, setTally] = useState({ right: 0, total: 0, xp: 0 });
  const canListen = useRef(false);

  useEffect(() => {
    canListen.current = typeof window !== 'undefined' && 'speechSynthesis' in window;
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(progress));
    } catch {
      /* private windows refuse storage; the session still works */
    }
  }, [progress]);

  const now = Date.now();
  const due = useMemo(
    () => ITEMS.filter((item) => {
      const card = progress.cards[item.id];
      return card !== undefined && isDue(card, now);
    }).length,
    [progress, now],
  );
  const shaky = useMemo(() => weakest(progress, 100).length, [progress]);
  const exercise = queue[at];

  const begin = useCallback(
    (items: typeof ITEMS) => {
      const lesson = buildLesson(items, progress, Date.now(), canListen.current);
      if (lesson.length === 0) return;
      setQueue(lesson);
      setAt(0);
      setPicked(null);
      setPlaced([]);
      setChecked(false);
      setTally({ right: 0, total: 0, xp: 0 });
      setScreen('lesson');
      if (lesson[0].kind === 'listen' && lesson[0].speak) speak(lesson[0].speak, progress.sound);
    },
    [progress],
  );

  const answerGiven =
    exercise?.kind === 'build' ? placed.length > 0 : picked !== null;

  const check = useCallback(() => {
    if (!exercise || checked || !answerGiven) return;
    const given = exercise.kind === 'build' ? placed.join(' ') : picked ?? '';
    const correct = given.trim() === exercise.answer.trim();
    setRight(correct);
    setChecked(true);
    setTally((t) => ({
      right: t.right + (correct ? 1 : 0),
      total: t.total + 1,
      xp: t.xp + (correct ? XP_PER_RIGHT : 0),
    }));
    setProgress((prev) => {
      const card = prev.cards[exercise.itemId] ?? fresh(exercise.itemId);
      return { ...prev, cards: { ...prev.cards, [exercise.itemId]: review(card, correct, Date.now()) } };
    });
    if (!correct && exercise.note) speak(exercise.note, progress.sound);
  }, [answerGiven, checked, exercise, picked, placed, progress.sound]);

  const advance = useCallback(() => {
    const next = at + 1;
    if (next >= queue.length) {
      setProgress((prev) => ({
        ...prev,
        xp: prev.xp + tally.xp,
        days: prev.days.includes(dayKey(Date.now())) ? prev.days : [...prev.days, dayKey(Date.now())],
      }));
      setScreen('summary');
      return;
    }
    setAt(next);
    setPicked(null);
    setPlaced([]);
    setChecked(false);
    const upcoming = queue[next];
    if (upcoming.kind === 'listen' && upcoming.speak) speak(upcoming.speak, progress.sound);
  }, [at, progress.sound, queue, tally.xp]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (screen !== 'lesson' || !exercise) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        checked ? advance() : check();
        return;
      }
      if (!checked && exercise.options && e.key >= '1' && e.key <= '4') {
        const option = exercise.options[Number(e.key) - 1];
        if (option) setPicked(option);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance, check, checked, exercise, screen]);

  /* ---------------------------------- path -------------------------------- */

  if (screen === 'path') {
    return (
      <div className="wrap">
        <header className="top">
          <div>
            <h1 className="brand">Mynah</h1>
            <p className="tagline">English that teaches from your mistakes</p>
          </div>
          <div className="stats">
            <div className="stat">
              <dt>Streak</dt>
              <dd>{streak(progress.days, now)}</dd>
            </div>
            <div className="stat">
              <dt>XP</dt>
              <dd>{progress.xp}</dd>
            </div>
          </div>
        </header>

        <button
          className="banner"
          onClick={() => begin(ITEMS)}
          disabled={ITEMS.length === 0}
        >
          <span className="banner-title">
            {due > 0 ? `${due} ${due === 1 ? 'item is' : 'items are'} ready for review` : 'Start a mixed lesson'}
          </span>
          <span className="banner-sub">
            {due > 0
              ? 'These are the ones you are about to forget. Ten questions.'
              : 'Nothing is due yet — this will teach you something new.'}
            {shaky > 0 ? ` · ${shaky} weak ${shaky === 1 ? 'spot' : 'spots'}` : ''}
          </span>
        </button>

        <div className="path">
          {UNITS.map((unit) => {
            const items = UNIT_ITEMS(unit.id);
            const { known, total } = unitProgress(items, progress);
            const pct = total ? Math.round((known / total) * 100) : 0;
            return (
              <button key={unit.id} className="unit" onClick={() => begin(items)}>
                <div className="ring" style={{ ['--pct' as string]: `${pct}%` }} aria-hidden="true">
                  <span>{pct}%</span>
                </div>
                <div className="unit-body">
                  <div className="unit-head">
                    <h2>{unit.title}</h2>
                    <span className="level">{unit.level}</span>
                  </div>
                  <p className="blurb">{unit.blurb}</p>
                  <p className="count">
                    {known} of {total} known
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <footer className="foot">
          <button
            className="ghost"
            onClick={() => setProgress((prev) => ({ ...prev, sound: !prev.sound }))}
          >
            Sound: {progress.sound ? 'on' : 'off'}
          </button>
          <p>
            Free, and it stays that way. Everything is on this device — no account, no ads, nothing
            to lose when you get one wrong.
          </p>
        </footer>
      </div>
    );
  }

  /* -------------------------------- summary ------------------------------- */

  if (screen === 'summary') {
    const perfect = tally.right === tally.total;
    return (
      <div className="wrap">
        <section className="summary">
          <h2 className="big">
            {perfect ? 'Every one right.' : tally.right >= tally.total * 0.7 ? 'Good work.' : 'Worth another look.'}
          </h2>
          <p className="lede">
            {perfect
              ? 'Those will now come back at longer and longer intervals until they stop needing to.'
              : 'The ones you missed will be back within minutes, then tomorrow, then next week.'}
          </p>
          <dl className="grades">
            <div>
              <dt>Right</dt>
              <dd>
                {tally.right}/{tally.total}
              </dd>
            </div>
            <div>
              <dt>XP</dt>
              <dd>+{tally.xp}</dd>
            </div>
            <div>
              <dt>Streak</dt>
              <dd>{streak(progress.days, Date.now())}</dd>
            </div>
          </dl>
          <button className="cta" onClick={() => begin(ITEMS)}>
            Another ten
          </button>
          <button className="ghost" onClick={() => setScreen('path')}>
            Back to the units
          </button>
        </section>
      </div>
    );
  }

  /* -------------------------------- lesson -------------------------------- */

  if (!exercise) return null;
  const isTap = exercise.kind === 'error' && Boolean(exercise.tiles);

  return (
    <div className="wrap">
      <header className="lesson-top">
        <button className="ghost" onClick={() => setScreen('path')}>
          Leave
        </button>
        <div className="bar" aria-label={`Question ${at + 1} of ${queue.length}`}>
          <span style={{ width: `${(at / queue.length) * 100}%` }} />
        </div>
        <span className="counter">
          {at + 1}/{queue.length}
        </span>
      </header>

      <section className="lesson">
        <p className="kicker">
          {exercise.kind === 'meaning' && 'What does this mean?'}
          {exercise.kind === 'gap' && 'Choose the missing word'}
          {exercise.kind === 'listen' && 'Listen and choose'}
          {exercise.kind === 'error' && (isTap ? 'One word is wrong. Tap it.' : 'Which one is correct?')}
          {exercise.kind === 'build' && 'Put the words in order'}
        </p>

        {exercise.kind === 'listen' ? (
          <button className="play" onClick={() => speak(exercise.speak ?? '', true)}>
            ▶ Play again
          </button>
        ) : (
          <p className={exercise.kind === 'meaning' ? 'headword' : 'sentence'}>{exercise.prompt}</p>
        )}

        {exercise.kind === 'meaning' && progress.sound && (
          <button className="play small" onClick={() => speak(exercise.speak ?? exercise.prompt, true)}>
            ▶ Hear it
          </button>
        )}

        {/* Choices: meaning, gap, listen, and the two-sentence form of a mistake. */}
        {exercise.options && (
          <div className="choices">
            {exercise.options.map((option, i) => {
              const state = !checked
                ? picked === option
                  ? ' sel'
                  : ''
                : option === exercise.answer
                  ? ' right'
                  : picked === option
                    ? ' wrong'
                    : '';
              return (
                <button
                  key={option}
                  className={`choice${state}`}
                  disabled={checked}
                  onClick={() => setPicked(option)}
                >
                  <span className="num">{i + 1}</span>
                  <span className="text">{option}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Tap the offending word. */}
        {isTap && (
          <div className="tiles">
            {exercise.tiles!.map((word, i) => {
              const state = !checked
                ? picked === word
                  ? ' sel'
                  : ''
                : word === exercise.answer
                  ? ' wrong-word'
                  : '';
              return (
                <button
                  key={`${word}-${i}`}
                  className={`tile${state}`}
                  disabled={checked}
                  onClick={() => setPicked(word)}
                >
                  {word}
                </button>
              );
            })}
          </div>
        )}

        {/* Build the sentence. */}
        {exercise.kind === 'build' && (
          <>
            <div className="slot">
              {placed.length === 0 && <span className="slot-hint">Tap the words below</span>}
              {placed.map((word, i) => (
                <button
                  key={`${word}-${i}`}
                  className="tile"
                  disabled={checked}
                  onClick={() => setPlaced(placed.filter((_, j) => j !== i))}
                >
                  {word}
                </button>
              ))}
            </div>
            <div className="tiles">
              {exercise.tiles!.map((word, i) => {
                const used = placed.filter((p) => p === word).length;
                const available = exercise.tiles!.slice(0, i + 1).filter((t) => t === word).length;
                if (available <= used) return null;
                return (
                  <button
                    key={`${word}-${i}`}
                    className="tile"
                    disabled={checked}
                    onClick={() => setPlaced([...placed, word])}
                  >
                    {word}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {checked && (
          <div className={`fb ${right ? 'good' : 'bad'}`}>
            <h3>{right ? 'Correct' : 'Not quite'}</h3>
            {!right && <p className="why">{exercise.why}</p>}
            {exercise.note && (
              <p className="note">
                {exercise.note}
                {progress.sound && (
                  <button className="play tiny" onClick={() => speak(exercise.note ?? '', true)}>
                    ▶
                  </button>
                )}
              </p>
            )}
          </div>
        )}
      </section>

      <div className="actions">
        {!checked ? (
          <button className="cta" onClick={check} disabled={!answerGiven}>
            Check
          </button>
        ) : (
          <button className="cta" onClick={advance} autoFocus>
            {at + 1 >= queue.length ? 'Finish' : 'Continue'}
          </button>
        )}
      </div>
    </div>
  );
}
