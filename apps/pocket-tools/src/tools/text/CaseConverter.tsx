'use client';

import { useMemo, useState } from 'react';
import { Segmented, TextArea } from '@/components/ui';
import { TextResult } from '@/components/ResultCard';
import ExportButton from '@/components/ExportButton';
import { useToolActions, useToolParams } from '@/components/AppState';
import { convertCase, type CaseMode } from '@/utils/text';

const MODES: { id: CaseMode; label: string }[] = [
  { id: 'upper', label: 'UPPERCASE' },
  { id: 'lower', label: 'lowercase' },
  { id: 'title', label: 'Title Case' },
  { id: 'sentence', label: 'Sentence case' },
  { id: 'alternating', label: 'aLtErNaTiNg' },
];

export default function CaseConverter() {
  const [text, setText] = useState('');
  const [mode, setMode] = useState<CaseMode>('title');
  const result = useMemo(() => convertCase(text, mode), [text, mode]);

  useToolParams((p) => {
    const m = p.get('mode') as CaseMode | null;
    if (m && MODES.some((x) => x.id === m)) setMode(m);
  });
  useToolActions({ copy: () => result || null });

  return (
    <>
      <TextArea label="Your text" hideLabel value={text} onChange={setText} placeholder="Paste or type text to convert…" rows={7} />
      <Segmented label="Convert to" value={mode} onChange={setMode} options={MODES} wrap />
      <TextResult
        label={MODES.find((m) => m.id === mode)?.label ?? 'Result'}
        text={result}
        placeholder="Your converted text appears here as you type."
        actions={<ExportButton variant="secondary" label="Download TXT" disabled={!result} filename={`text-${mode}.txt`} make={() => new Blob([result], { type: 'text/plain;charset=utf-8' })} />}
      />
    </>
  );
}
