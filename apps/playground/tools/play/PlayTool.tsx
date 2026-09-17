'use client';

/**
 * DARE: something to make, and a clock to beat.
 *
 * One reading order: the dare, then the thing to do about it (start the clock),
 * then the way out (another dare, with its key shown on the button), then the
 * quiet settings. Filters sit below the card because they are set once, not
 * read every time.
 *
 * The tool's id is still 'play', which keeps saved dares, backups and a running
 * clock working across the rename.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
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

const LENGTHS = ['5', '10', '15', '30'] as const;
type Length = (typeof LENGTHS)[number];

export default function PlayTool() {
  const store = useStore();
  const [categories, setCategories] = useState<Category[]>(() => load<Category[]>('play.categories', []));
  const [minutes, setMinutes] = useState<Minutes | null>(() => load<Minutes | null>('play.minutes', null));
  const [recent, setRecent] = useState<string[]>(() => load<string[]>('play.recent', []));
  const [dare, setDare] = useState<Challenge>(() =>
    load<Challenge | null>('play.current', null) ?? nextChallenge(createRng(newSeed()), [], null, []));
  const [length, setLength] = useState<Length>(() => String(dare.minutes) as Length);
  const [turn, setTurn] = useState(0);
  const [pressed, setPressed] = useState(false);
  const pressTimer = useRef<number>();

  const timer = store.timer;
  const now = useNow(timer?.status === 'running');
  const left = !timer ? 0 : timer.status === 'running' && timer.endsAt !== null ? Math.max(0, timer.endsAt - now) : timer.left;
  const shown = timer ? { ...dare, text: timer.text } : dare;
  const tool = timer ? timer.tool : toolFor(dare);

  useEffect(() => { save('play.categories', categories); }, [categories]);
  useEffect(() => { save('play.minutes', minutes); }, [minutes]);
  useEffect(() => { save('play.recent', recent); }, [recent]);
  useEffect(() => { save('play.current', dare); }, [dare]);
  useEffect(() => () => window.clearTimeout(pressTimer.current), []);

  /* Opened from Saved or Recent. */
  useEffect(() => {
    const recipe = store.takePending('play')?.recipe as { challenge?: Challenge } | undefined;
    if (recipe?.challenge?.text) {
      setDare(recipe.challenge);
      setLength(String(recipe.challenge.minutes) as Length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const another = () => {
    if (timer && timer.status !== 'done') {
      store.toast('Finish or reset the clock first.');
      return;
    }
    if (timer?.status === 'done') store.endTimer();
    const next = nextChallenge(createRng(newSeed()), categories, minutes, [dare.text, ...recent]);
    setRecent((list) => [dare.text, ...list.filter((t) => t !== dare.text)].slice(0, 40));
    setDare(next);
    setLength(String(next.minutes) as Length);
    setTurn((n) => n + 1);
  };

  /* Space presses the button you can see, so the key and the button are visibly the same thing. */
  const anotherByKey = () => {
    setPressed(true);
    window.clearTimeout(pressTimer.current);
    pressTimer.current = window.setTimeout(() => setPressed(false), 180);
    another();
  };

  const toggle = (id: Category) =>
    setCategories((list) => (list.includes(id) ? list.filter((k) => k !== id) : [...list, id]));

  const start = (choice: Length = length) => {
    store.startTimer(dare.text, Number(choice), toolFor(dare));
    store.toast(`${choice} minutes. Go.`);
  };

  const finish = () => {
    if (!timer) return;
    const used = timer.total - left;
    store.remember({ tool: 'play', kind: 'Dare', colors: store.palette, recipe: { challenge: { ...dare, text: timer.text } } });
    store.endTimer();
    store.toast(timer.status === 'done' ? 'Done. Save what you made.' : `Finished in ${formatClock(used)}. Save what you made.`);
  };

  const saveDare = () => {
    const result = store.saveItem({ tool: 'play', kind: 'Dare', colors: store.palette, recipe: { challenge: shown } });
    store.toast(!result ? 'Storage is full. Download a backup from Saved, then delete a few.' : result.repeat ? `Already saved as ${result.item.name}` : `Saved as ${result.item.name}`);
  };

  const commands: Command[] = [
    { id: 'p-another', label: 'Another dare', group: 'Dare', hint: 'Space', run: another },
    ...LENGTHS.map((m) => ({ id: `p-start-${m}`, label: `Start a ${m}-minute clock`, group: 'Dare', run: () => start(m) })),
    ...(timer?.status === 'running' ? [{ id: 'p-pause', label: 'Pause the clock', group: 'Dare', run: store.pauseTimer }] : []),
    ...(timer?.status === 'paused' ? [{ id: 'p-resume', label: 'Resume the clock', group: 'Dare', run: store.resumeTimer }] : []),
    ...(timer ? [{ id: 'p-finish', label: 'Finish this dare', group: 'Dare', run: finish }] : []),
    { id: 'p-save', label: 'Save this dare', group: 'Dare', hint: '⌘S', run: saveDare },
    ...CATEGORIES.map((k) => ({ id: `p-cat-${k.id}`, label: `Dares about ${k.label.toLowerCase()}`, group: 'Dare', run: () => setCategories([k.id]) })),
  ];

  useToolActions({
    randomize: anotherByKey,
    save: saveDare,
    exportDefault: () => store.toast(`Make it in ${TOOL_NAME[tool]}, then export from there.`),
    commands,
  });

  const progress = timer ? 1 - left / timer.total : 0;
  const meta = useMemo(
    () => shown.categories.map((k) => CATEGORIES.find((x) => x.id === k)?.label).filter(Boolean).join(' · '),
    [shown.categories],
  );
  const mod = modLabel();

  const anotherButton = (
    <button type="button" className={`${styles.another} ${pressed ? styles.pressed : ''}`} onClick={another} onPointerUp={(e) => e.currentTarget.blur()}>
      Another dare
      <kbd className={styles.key} aria-label="shortcut: Space">Space</kbd>
    </button>
  );

  return (
    <div className={styles.play}>
      <section className={`${styles.card} ${timer ? styles.cardTimed : ''}`} aria-live="polite">
        <p className={styles.meta}>
          {meta && <span>{meta}</span>}
          <span className={styles.minutes}>{timer ? Math.round(timer.total / 60_000) : shown.minutes} min</span>
        </p>
        <h2 key={`${turn}-${shown.text}`} className={`${styles.prompt} ${timer ? styles.promptSmall : ''}`}>{shown.text}</h2>

        {!timer && (
          <>
            <div className={styles.primary}>
              <button type="button" className={styles.start} onClick={() => start()} onPointerUp={(e) => e.currentTarget.blur()}>
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1.8v10.4L12 7z" fill="currentColor" /></svg>
                Start the clock
                <span className={styles.startTime}>{length}:00</span>
              </button>
              {anotherButton}
            </div>
            <div className={styles.quiet}>
              <span className={styles.quietItem}>
                <span className={styles.quietLabel}>Clock</span>
                <Segmented label="Clock length" value={length} onChange={setLength} options={LENGTHS.map((m) => ({ id: m, label: `${m} min` }))} />
              </span>
              <span className={styles.quietItem}>
                Best made in
                <button type="button" className={styles.link} onClick={() => store.setTool(tool)}>{TOOL_NAME[tool]} →</button>
              </span>
              <span className={`${styles.quietItem} ${styles.keysOnly}`}>
                <kbd className={styles.keySmall}>{mod}S</kbd> keeps this dare
              </span>
            </div>
          </>
        )}

        {timer && (
          <div className={styles.timer}>
            <p className={`${styles.clock} ${timer.status === 'done' ? styles.clockDone : ''}`} role="timer" aria-label={`${formatClock(left)} left`}>
              {timer.status === 'done' ? '00:00' : formatClock(left)}
            </p>
            <div className={styles.bar} aria-hidden="true"><i style={{ transform: `scaleX(${progress})` }} /></div>
            {timer.status === 'done' ? (
              <>
                <p className={styles.done}>Time’s up. Save what you made.</p>
                <div className={styles.primary}>
                  <button type="button" className={styles.start} onClick={() => store.setTool(timer.tool)}>Open {TOOL_NAME[timer.tool]} →</button>
                  {anotherButton}
                </div>
                <div className={styles.quiet}>
                  <Button variant="ghost" onClick={finish}>Mark as done</Button>
                </div>
              </>
            ) : (
              <>
                <div className={styles.primary}>
                  <button type="button" className={styles.start} onClick={() => store.setTool(timer.tool)}>Make it in {TOOL_NAME[timer.tool]} →</button>
                </div>
                <div className={styles.controls}>
                  {timer.status === 'running'
                    ? <Button onClick={store.pauseTimer}>Pause</Button>
                    : <Button onClick={store.resumeTimer}>Resume</Button>}
                  <Button onClick={store.resetTimer}>Reset</Button>
                  <Button onClick={finish}>Finish</Button>
                </div>
              </>
            )}
          </div>
        )}
      </section>

      <section className={styles.filters} aria-label="Filters">
        <div className={styles.filterRow}>
          <span className={styles.filterLabel}>Dares about</span>
          <div className={styles.chips} role="group" aria-label="Categories">
            <button type="button" className={styles.chip} aria-pressed={categories.length === 0} onClick={() => setCategories([])}>Anything</button>
            {CATEGORIES.map((k) => (
              <button key={k.id} type="button" className={styles.chip} aria-pressed={categories.includes(k.id)} onClick={() => toggle(k.id)} onPointerUp={(e) => e.currentTarget.blur()}>
                {k.label}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.filterRow}>
          <span className={styles.filterLabel}>That take</span>
          <div className={styles.chips} role="group" aria-label="Length">
            <button type="button" className={styles.chip} aria-pressed={minutes === null} onClick={() => setMinutes(null)}>Any time</button>
            {DURATIONS.map((m) => (
              <button key={m} type="button" className={styles.chip} aria-pressed={minutes === m} onClick={() => setMinutes(minutes === m ? null : m)} onPointerUp={(e) => e.currentTarget.blur()}>
                {m} minutes
              </button>
            ))}
          </div>
        </div>
      </section>

      <SavedStrip tool="play" />
    </div>
  );
}
