'use client';

import { useMemo, useState } from 'react';
import { Button, Check, Segmented, TextArea } from '@/components/ui';
import { TextResult } from '@/components/ResultCard';
import ExportButton from '@/components/ExportButton';
import { useToolActions } from '@/components/AppState';
import { sortLines, type SortMode } from '@/utils/text';
import { randomFloat } from '@/utils/random';

const MODES: { id: SortMode; label: string }[] = [
  { id: 'az', label: 'A → Z' },
  { id: 'za', label: 'Z → A' },
  { id: 'length', label: 'Length' },
  { id: 'numeric', label: 'Numbers' },
  { id: 'random', label: 'Random' },
];

export default function TextSorter() {
  const [text, setText] = useState('');
  const [mode, setMode] = useState<SortMode>('az');
  const [dedupe, setDedupe] = useState(false);
  const [shuffle, setShuffle] = useState(0);
  // `shuffle` is in the deps so "Shuffle again" makes a new order.
  const sorted = useMemo(() => sortLines(text, mode, { dedupe, random: randomFloat }), [text, mode, dedupe, shuffle]); // eslint-disable-line react-hooks/exhaustive-deps
  useToolActions({ run: () => mode === 'random' && setShuffle((n) => n + 1), copy: () => sorted || null });

  return (
    <>
      <TextArea label="Your lines" hideLabel value={text} onChange={setText} placeholder={'One item per line…\nitem 10\nitem 2\nitem 1'} rows={9} />
      <div className="options-row">
        <Segmented label="Sort by" value={mode} onChange={setMode} options={MODES} wrap />
        <div className="checks"><Check label="Remove duplicates" checked={dedupe} onChange={setDedupe} /></div>
      </div>
      <TextResult
        label="Sorted"
        text={sorted}
        actions={
          <>
            {mode === 'random' && <Button onClick={() => setShuffle((n) => n + 1)} disabled={!sorted}>Shuffle again</Button>}
            <ExportButton variant="secondary" label="Download TXT" disabled={!sorted} filename="sorted-lines.txt" make={() => new Blob([sorted], { type: 'text/plain;charset=utf-8' })} />
          </>
        }
      />
    </>
  );
}
