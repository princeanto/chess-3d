'use client';

import { useMemo, useState } from 'react';
import { TextArea } from '@/components/ui';
import CopyButton from '@/components/CopyButton';
import ExportButton from '@/components/ExportButton';
import { useToolActions } from '@/components/AppState';
import { extract } from '@/utils/text';
import { csv } from '@/utils/download';

export default function Extractor() {
  const [text, setText] = useState('');
  const found = useMemo(() => extract(text), [text]);
  const groups = [
    { key: 'urls', title: 'Links', items: found.urls },
    { key: 'emails', title: 'Email addresses', items: found.emails },
    { key: 'phones', title: 'Phone numbers', items: found.phones },
  ];
  const total = found.urls.length + found.emails.length + found.phones.length;
  const all = groups.filter((g) => g.items.length).map((g) => `${g.title}\n${g.items.join('\n')}`).join('\n\n');
  useToolActions({ copy: () => all || null });

  return (
    <>
      <TextArea label="Your text" hideLabel value={text} onChange={setText} placeholder="Paste an email thread, a web page, notes — anything with links, emails or phone numbers in it…" rows={8} />
      {!text ? null : total === 0 ? (
        <p className="notice notice-info">No links, emails or phone numbers in that text.</p>
      ) : (
        <>
          <div className="extract-grid">
            {groups.map((g) => (
              <section key={g.key} className="extract-group" aria-labelledby={`h-${g.key}`}>
                <div className="extract-head">
                  <h2 id={`h-${g.key}`} className="result-label">{g.title} <span className="extract-count">{g.items.length}</span></h2>
                  <CopyButton text={g.items.join('\n')} label="Copy all" variant="ghost" size="sm" disabled={!g.items.length} />
                </div>
                {g.items.length ? (
                  <ul className="extract-list">
                    {g.items.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                ) : <p className="extract-none">None found.</p>}
              </section>
            ))}
          </div>
          <div className="button-row">
            <CopyButton text={all} label="Copy everything" variant="primary" />
            <ExportButton variant="secondary" label="Download CSV" filename="extracted.csv" make={() => new Blob([csv([['type', 'value'], ...found.urls.map((u) => ['link', u]), ...found.emails.map((e) => ['email', e]), ...found.phones.map((p) => ['phone', p])])], { type: 'text/csv;charset=utf-8' })} />
          </div>
        </>
      )}
    </>
  );
}
