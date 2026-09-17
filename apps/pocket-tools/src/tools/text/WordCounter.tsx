'use client';

import { useMemo, useState } from 'react';
import { TextArea } from '@/components/ui';
import CopyButton from '@/components/CopyButton';
import { useToolActions } from '@/components/AppState';
import { countText } from '@/utils/text';
import { number } from '@/utils/format';

export default function WordCounter() {
  const [text, setText] = useState('');
  const c = useMemo(() => countText(text), [text]);
  const minutes = c.readingMinutes < 1 ? (c.words ? '< 1 min' : '0 min') : `${Math.round(c.readingMinutes)} min`;
  const summary = `Words: ${c.words}\nCharacters: ${c.characters}\nCharacters without spaces: ${c.charactersNoSpaces}\nLines: ${c.lines}\nParagraphs: ${c.paragraphs}\nSentences: ${c.sentences}\nReading time: ${minutes}`;
  useToolActions({ copy: () => (text ? summary : null) });

  const stats = [
    { label: 'Characters', value: c.characters },
    { label: 'Without spaces', value: c.charactersNoSpaces },
    { label: 'Lines', value: c.lines },
    { label: 'Paragraphs', value: c.paragraphs },
    { label: 'Sentences', value: c.sentences },
  ];

  return (
    <>
      <TextArea label="Your text" hideLabel value={text} onChange={setText} placeholder="Paste or start typing…" rows={10} />
      <section className="counter" aria-live="polite">
        <div className="counter-hero">
          <p className="result-label">Words</p>
          <p className="result-value">{number(c.words, 0)}</p>
          <p className="result-caption">{minutes} to read</p>
        </div>
        <dl className="counter-grid">
          {stats.map((s) => (
            <div key={s.label}>
              <dt>{s.label}</dt>
              <dd>{number(s.value, 0)}</dd>
            </div>
          ))}
        </dl>
        <div className="result-actions"><CopyButton text={summary} label="Copy counts" disabled={!text} /></div>
      </section>
    </>
  );
}
