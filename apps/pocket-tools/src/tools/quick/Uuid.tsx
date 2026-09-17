'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, Check, Stepper } from '@/components/ui';
import CopyButton from '@/components/CopyButton';
import ExportButton from '@/components/ExportButton';
import { useToolActions } from '@/components/AppState';
import { uuid } from '@/utils/random';

export default function Uuid() {
  const [count, setCount] = useState(1);
  const [upper, setUpper] = useState(false);
  const [hyphens, setHyphens] = useState(true);
  const [ids, setIds] = useState<string[]>([]);

  const generate = useCallback(() => setIds(Array.from({ length: count }, () => uuid())), [count]);
  useEffect(() => { generate(); }, [generate]);

  const shown = ids.map((id) => { const s = hyphens ? id : id.replace(/-/g, ''); return upper ? s.toUpperCase() : s; });
  const all = shown.join('\n');
  useToolActions({ run: generate, copy: () => all || null });

  return (
    <div className="stack">
      <section className="password-card">
        <p className="result-label">{count > 1 ? `${count} UUIDs (version 4)` : 'UUID (version 4)'}</p>
        {count === 1 ? <p className="password-value uuid-value">{shown[0]}</p> : <pre className="uuid-list">{all}</pre>}
        <div className="result-actions">
          <CopyButton text={all} label={count > 1 ? 'Copy all' : 'Copy'} variant="primary" size="lg" />
          <Button size="lg" onClick={generate}>Generate</Button>
          {count > 1 && <ExportButton variant="ghost" label="Download TXT" filename="uuids.txt" make={() => new Blob([all], { type: 'text/plain' })} />}
        </div>
      </section>
      <div className="card options-row">
        <Stepper label="How many" value={count} onChange={setCount} min={1} max={500} />
        <div className="checks">
          <Check label="Uppercase" checked={upper} onChange={setUpper} />
          <Check label="Hyphens" checked={hyphens} onChange={setHyphens} />
        </div>
      </div>
    </div>
  );
}
