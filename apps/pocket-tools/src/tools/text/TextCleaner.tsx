'use client';

import { useMemo, useState } from 'react';
import { Button, Check, TextArea } from '@/components/ui';
import { TextResult } from '@/components/ResultCard';
import ExportButton from '@/components/ExportButton';
import { useApp, useToolActions } from '@/components/AppState';
import { cleanText, CLEAN_DEFAULTS, countText, type CleanOptions } from '@/utils/text';
import { plural } from '@/utils/format';

const OPTIONS: { key: keyof CleanOptions; label: string; hint: string }[] = [
  { key: 'extraSpaces', label: 'Remove extra spaces', hint: 'Runs of spaces become one' },
  { key: 'emptyLines', label: 'Remove empty lines', hint: 'Blank lines go' },
  { key: 'trimLines', label: 'Trim lines', hint: 'No spaces at either end' },
  { key: 'duplicateLines', label: 'Remove duplicate lines', hint: 'Each line once' },
  { key: 'punctuation', label: 'Normalize punctuation', hint: 'Straight quotes, no space before commas' },
];

export default function TextCleaner() {
  const { toast } = useApp();
  const [text, setText] = useState('');
  const [opts, setOpts] = useState<CleanOptions>(CLEAN_DEFAULTS);
  const cleaned = useMemo(() => cleanText(text, opts), [text, opts]);
  const before = useMemo(() => countText(text), [text]);
  const after = useMemo(() => countText(cleaned), [cleaned]);
  const changed = text && cleaned !== text;

  const applyInPlace = () => {
    if (!text) return toast('Add some text to continue.');
    setText(cleaned);
    toast('Done.');
  };
  useToolActions({ run: applyInPlace, copy: () => cleaned || null });

  return (
    <>
      <TextArea label="Your text" hideLabel value={text} onChange={setText} placeholder="Paste your text here…" rows={9} />
      <div className="checks">
        {OPTIONS.map((o) => (
          <Check key={o.key} label={o.label} hint={o.hint} checked={opts[o.key]} onChange={(v) => setOpts((p) => ({ ...p, [o.key]: v }))} />
        ))}
      </div>
      <TextResult
        label="Cleaned text"
        text={text ? cleaned : ''}
        note={text ? (changed ? `${plural(before.characters - after.characters, 'character')} and ${plural(before.lines - after.lines, 'line')} removed` : 'Already clean.') : undefined}
        actions={
          <>
            <ExportButton variant="secondary" label="Download TXT" disabled={!cleaned} filename="cleaned-text.txt" make={() => new Blob([cleaned], { type: 'text/plain;charset=utf-8' })} />
            <Button variant="ghost" onClick={applyInPlace} disabled={!changed}>Replace my text</Button>
          </>
        }
      />
    </>
  );
}
