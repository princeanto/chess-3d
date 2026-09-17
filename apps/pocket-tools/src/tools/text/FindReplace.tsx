'use client';

import { useMemo, useState } from 'react';
import { Check, Segmented, TextArea, TextField } from '@/components/ui';
import { TextResult } from '@/components/ResultCard';
import ExportButton from '@/components/ExportButton';
import { useToolActions } from '@/components/AppState';
import { findReplace } from '@/utils/text';
import { plural } from '@/utils/format';

export default function FindReplace() {
  const [text, setText] = useState('');
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [scope, setScope] = useState<'all' | 'first'>('all');
  const result = useMemo(() => findReplace(text, find, replace, { caseSensitive, wholeWord, all: scope === 'all' }), [text, find, replace, caseSensitive, wholeWord, scope]);
  useToolActions({ copy: () => (text ? result.text : null) });

  return (
    <>
      <TextArea label="Your text" hideLabel value={text} onChange={setText} placeholder="Paste your text here…" rows={8} />
      <div className="grid-2">
        <TextField label="Find" value={find} onChange={setFind} placeholder="Word or phrase" autoComplete="off" spellCheck={false} />
        <TextField label="Replace with" value={replace} onChange={setReplace} placeholder="Leave empty to delete it" autoComplete="off" spellCheck={false} />
      </div>
      <div className="options-row">
        <div className="checks">
          <Check label="Match case" checked={caseSensitive} onChange={setCaseSensitive} />
          <Check label="Whole words only" checked={wholeWord} onChange={setWholeWord} />
        </div>
        <Segmented label="Replace" hideLabel value={scope} onChange={setScope} options={[{ id: 'all', label: 'Replace all' }, { id: 'first', label: 'First only' }]} />
      </div>
      <TextResult
        label="Result"
        text={text ? result.text : ''}
        note={find && text ? (result.count ? `${plural(result.count, 'replacement')}` : `“${find}” wasn’t found.`) : undefined}
        actions={<ExportButton variant="secondary" label="Download TXT" disabled={!text} filename="replaced-text.txt" make={() => new Blob([result.text], { type: 'text/plain;charset=utf-8' })} />}
      />
    </>
  );
}
