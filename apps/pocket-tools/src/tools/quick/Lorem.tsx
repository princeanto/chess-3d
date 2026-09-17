'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, Check, Segmented, Stepper } from '@/components/ui';
import { TextResult } from '@/components/ResultCard';
import { useToolActions } from '@/components/AppState';
import { lorem, type LoremUnit } from '@/utils/lorem';
import { countText } from '@/utils/text';

export default function Lorem() {
  const [count, setCount] = useState(3);
  const [unit, setUnit] = useState<LoremUnit>('paragraphs');
  const [classic, setClassic] = useState(true);
  const [text, setText] = useState('');
  const generate = useCallback(() => setText(lorem(count, unit, classic)), [count, unit, classic]);
  useEffect(() => { generate(); }, [generate]);
  useToolActions({ run: generate, copy: () => text || null });
  const c = countText(text);

  return (
    <>
      <div className="card options-row">
        <Stepper label="How many" value={count} onChange={setCount} min={1} max={unit === 'words' ? 2000 : unit === 'sentences' ? 200 : 50} />
        <Segmented label="Of" value={unit} onChange={(u) => { setUnit(u); setCount(u === 'words' ? 50 : u === 'sentences' ? 5 : 3); }} options={[{ id: 'words', label: 'Words' }, { id: 'sentences', label: 'Sentences' }, { id: 'paragraphs', label: 'Paragraphs' }]} />
        <Check label="Start with “Lorem ipsum”" checked={classic} onChange={setClassic} />
      </div>
      <TextResult label="Placeholder text" text={text} note={`${c.words} words · ${c.characters} characters`} actions={<Button onClick={generate}>Try another</Button>} />
    </>
  );
}
