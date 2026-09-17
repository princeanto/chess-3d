'use client';

import { useMemo, useState } from 'react';
import { Check, Segmented, TextArea } from '@/components/ui';
import { TextResult } from '@/components/ResultCard';
import ExportButton from '@/components/ExportButton';
import { useToolActions } from '@/components/AppState';
import { dedupeLines } from '@/utils/text';
import { plural } from '@/utils/format';

export default function RemoveDuplicates() {
  const [text, setText] = useState('');
  const [keep, setKeep] = useState<'first' | 'last'>('first');
  const [sort, setSort] = useState(false);
  const [ignoreCase, setIgnoreCase] = useState(false);
  const result = useMemo(() => dedupeLines(text, { keep, sort, ignoreCase, ignoreEmpty: true }), [text, keep, sort, ignoreCase]);
  useToolActions({ copy: () => result.text || null });

  return (
    <>
      <TextArea label="Your lines" hideLabel value={text} onChange={setText} placeholder={'Paste a list, one item per line…\napple\nbanana\napple'} rows={9} />
      <div className="options-row">
        <Segmented label="When a line repeats, keep" value={keep} onChange={setKeep} options={[{ id: 'first', label: 'First occurrence' }, { id: 'last', label: 'Last occurrence' }]} />
        <div className="checks">
          <Check label="Sort alphabetically" checked={sort} onChange={setSort} />
          <Check label="Ignore upper and lower case" checked={ignoreCase} onChange={setIgnoreCase} />
        </div>
      </div>
      <TextResult
        label="Unique lines"
        text={result.text}
        note={text ? (result.removed ? `${plural(result.removed, 'duplicate')} removed` : 'No duplicates found.') : undefined}
        actions={<ExportButton variant="secondary" label="Download TXT" disabled={!result.text} filename="unique-lines.txt" make={() => new Blob([result.text], { type: 'text/plain;charset=utf-8' })} />}
      />
    </>
  );
}
