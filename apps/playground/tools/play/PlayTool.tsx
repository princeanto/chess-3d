'use client';

/**
 * PLAY: a brief when you need one, and a clock to keep you honest.
 *
 * The prompt is the page. Everything else — filters, the timer, where to go
 * and make it — sits quietly around it.
 */

import { useEffect, useMemo, useState } from 'react';
import styles from './play.module.css';
import { Button, Segmented } from '@/components/ui';
import { useStore, useToolActions, type Command } from '@/lib/store';
import { load, save } from '@/lib/storage';
import { createRng, newSeed } from '@/lib/random';
import { useNow } from '@/lib/useNow';
import { modLabel } from '@/lib/shortcuts';
import {
  CATEGORIES, DURATIONS, TOOL_NAME, formatClock, nextChallenge, toolFor,
  type Category, type Challenge, type Minutes,
} from '@/lib/challenges';
import SavedStrip from '../SavedStrip';

const TIMER_CHOICES = ['5', '10', '15', '30'] as const;
type TimerChoice = (typeof TIMER_CHOICES)[number];

export default function PlayTool() {
  const store = useStore();
  const [categories, setCategories] = useState<Category[]>(() => load<Category[]>('play.categories', []));
  const [minutes, setMinutes] = useState<Minutes | null>(() => load<Minutes | null>('play.minutes', null));
  const [recent, setRecent] = useState<string[]>(() => load<string[]>('play.recent', []));
  const [challenge, setChallenge] = useState<Challenge>(() =>
    load<Challenge | null>('play.current', null) ?? nextChallenge(createRng(newSeed()), [], null, []));
  const [length, setLength] = useState<TimerChoice>(() => String(challenge.minutes) as TimerChoice);
  const [turn, setTurn] = useState(0);

  const timer = store.timer;
  const now = useNow(timer?.status === 'running');
  const left = !timer ? 0 : timer.status === 'running' && timer.endsAt !== null ? Math.max(0, timer.endsAt - now) : timer.left;
  const shown = timer ? { ...challenge, text: timer.text } : challenge;
  const tool = timer ? timer.tool : toolFor(challenge);

  useEffect(() => { save('play.categories', categories); }, [categories]);
  useEffect(() => { save('play.minutes', minutes); }, [minutes]);
  useEffect(() => { save('play.recent', recent); }, [recent]);
  useEffect(() => { save('play.current', challenge); }, [challenge]);

  /* Opened from Saved or Recent. */
  useEffect(() => {
    const recipe = store.takePending('play')?.recipe as { challenge?: Challenge } | undefined;
    if (recipe?.challenge?.text) {
      setChallenge(recipe.challenge);
      setLength(String(recipe.challenge.minutes) as TimerChoice);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const another = () => {
    if (timer && timer.status !== 'done') {
      store.toast('Finish or reset the timer first.');
      return;
    }
    if (timer?.status === 'done') store.endTimer();
    const next = nextChallenge(createRng(newSeed()), categories, minutes, [challenge.text, ...recent]);
    setRecent((list) => [challenge.text, ...list.filter((t) => t !== challenge.text)].slice(0, 40));
    setChallenge(next);
    setLength(String(next.minutes) as TimerChoice);
    setTurn((n) => n + 1);
  };

  const toggle = (id: Category) =>
    setCategories((list) => (list.includes(id) ? list.filter((k) => k !== id) : [...list, id]));

  const start = (choice: TimerChoice = length) => {
    store.startTimer(challenge.text, Number(choice), toolFor(challenge));
    store.toast(`${choice} minutes. Go.`);
  };

  const finish = () => {
    if (!timer) return;
    const used = timer.total - left;
    store.remember({ tool: 'play', kind: 'Challenge', colors: store.palette, recipe: { challenge: { ...challenge, text: timer.text } } });
    store.endTimer();
    store.toast(timer.status === 'done' ? 'Done. Save what you made.' : `Finished in ${formatClock(used)}. Save what you made.`);
  };

  const saveChallenge = () => {
    const result = store.saveItem({ tool: 'play', kind: 'Challenge', colors: store.palette, recipe: { challenge: shown } });
    store.toast(!result ? 'Storage is full. Download a backup from Saved, then delete a few.' : result.repeat ? `Already saved as ${result.item.name}` : `Saved as ${result.item.name}`);
  };

  const commands: Command[] = [
    { id: 'p-another', label: 'Give me another challenge', group: 'Play', hint: 'Space', run: another },
    ...TIMER_CHOICES.map((m) => ({ id: `p-start-${m}`, label: `Start a ${m}-minute timer`, group: 'Play', run: () => start(m) })),
    ...(timer?.status === 'running' ? [{ id: 'p-pause', label: 'Pause timer', group: 'Play', run: store.pauseTimer }] : []),
    ...(timer?.status === 'paused' ? [{ id: 'p-resume', label: 'Resume timer', group: 'Play', run: store.resumeTimer }] : []),
    ...(timer ? [{ id: 'p-finish', label: 'Finish challenge', group: 'Play', run: finish }] : []),
    { id: 'p-save', label: 'Save this challenge', group: 'Play', hint: '⌘S', run: saveChallenge },
    ...CATEGORIES.map((k) => ({ id: `p-cat-${k.id}`, label: `Challenges: ${k.label}`, group: 'Play', run: () => setCategories([k.id]) })),
  ];

  useToolActions({
    randomize: another,
    save: saveChallenge,
    exportDefault: () => store.toast(`Make it in ${TOOL_NAME[tool]}, then export from there.`),
    commands,
  });

  const progress = timer ? 1 - left / timer.total : 0;
  const meta = useMemo(
    () => shown.categories.map((k) => CATEGORIES.find((x) => x.id === k)?.label).filter(Boolean).join(' · '),
    [shown.categories],
  );

  return (
    <div className={styles.play}>
      <div className={styles.filters}>
        <div className={styles.chips} role="group" aria-label="Categories">
          <button type="button" className={styles.chip} aria-pressed={categories.length === 0} onClick={() => setCategories([])}>All</button>
          {CATEGORIES.map((k) => (
            <button key={k.id} type="button" className={styles.chip} aria-pressed={categories.includes(k.id)} onClick={() => toggle(k.id)} onPointerUp={(e) => e.currentTarget.blur()}>
              {k.label}
            </button>
          ))}
        </div>
        <div className={styles.chips} role="group" aria-label="Length">
          <button type="button" className={styles.chip} aria-pressed={minutes === null} onClick={() => setMinutes(null)}>Any length</button>
          {DURATIONS.map((m) => (
            <button key={m} type="button" className={styles.chip} aria-pressed={minutes === m} onClick={() => setMinutes(minutes === m ? null : m)} onPointerUp={(e) => e.currentTarget.blur()}>
              {m}-minute
            </button>
          ))}
        </div>
      </div>

      <section className={styles.card} aria-live="polite">
        <p className={styles.meta}>
          {meta}
          <span className={styles.minutes}>{timer ? `${Math.round(timer.total / 60_000)} minutes` : `${shown.minutes} minutes`}</span>
        </p>
        <h2 key={`${turn}-${shown.text}`} className={styles.prompt}>{shown.text}</h2>

        {!timer ? (
          <div className={styles.actions}>
            <Button variant="solid" className={styles.big} onClick={another}>Give me another →</Button>
            <div className={styles.startGroup}>
              <Segmented label="Timer length" value={length} onChange={setLength} options={TIMER_CHOICES.map((m) => ({ id: m, label: `${m} min` }))} />
              <Button className={styles.big} onClick={() => start()}>Start challenge</Button>
            </div>
          </div>
        ) : (
          <div className={styles.timer}>
            <p className={`${styles.clock} ${timer.status === 'done' ? styles.clockDone : ''}`} role="timer" aria-label={`${formatClock(left)} left`}>
              {timer.status === 'done' ? '00:00' : formatClock(left)}
            </p>
            <div className={styles.bar} aria-hidden="true"><i style={{ transform: `scaleX(${progress})` }} /></div>
            {timer.status === 'done' ? (
              <>
                <p className={styles.done}>Time’s up. Save what you made.</p>
                <div className={styles.actions}>
                  <Button variant="solid" className={styles.big} onClick={() => store.setTool(timer.tool)}>Open {TOOL_NAME[timer.tool]}</Button>
                  <Button className={styles.big} onClick={finish}>Done</Button>
                  <Button className={styles.big} onClick={another}>Give me another →</Button>
                </div>
              </>
            ) : (
              <div className={styles.actions}>
                <Button variant="solid" className={styles.big} onClick={() => store.setTool(timer.tool)}>Make it in {TOOL_NAME[timer.tool]} →</Button>
                {timer.status === 'running'
                  ? <Button className={styles.big} onClick={store.pauseTimer}>Pause</Button>
                  : <Button className={styles.big} onClick={store.resumeTimer}>Resume</Button>}
                <Button className={styles.big} onClick={store.resetTimer}>Reset</Button>
                <Button className={styles.big} onClick={finish}>Finish</Button>
              </div>
            )}
          </div>
        )}
        {!timer && (
          <p className={styles.hint}>
            Best made in <button type="button" className={styles.link} onClick={() => store.setTool(tool)}>{TOOL_NAME[tool]}</button> · <b>Space</b> for another · <b>{modLabel()}S</b> keeps this one
          </p>
        )}
      </section>

      <SavedStrip tool="play" />
    </div>
  );
}
