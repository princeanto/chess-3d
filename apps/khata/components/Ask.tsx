'use client';

/**
 * Questions, answered on the device.
 *
 * There is no model behind this and no request leaves the phone. That is partly
 * principle — shipping a year of someone's spending to an API to be told a sum
 * would undo every other decision in this app — and partly that arithmetic does
 * not need one.
 */

import { useState } from 'react';
import type { Txn } from '@/lib/ledger/types';
import { ask, EXAMPLES, type Answer } from '@/lib/query/ask';
import { formatDay } from '@/lib/ledger/time';
import { Card, Label, Money, Row } from './ui/bits';

export default function Ask({ txns, now }: { txns: Txn[]; now: number }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<Answer | null>(null);

  const run = (q: string) => {
    setQuestion(q);
    setAnswer(ask(q, txns, now));
  };

  return (
    <div className="space-y-3 px-4 pb-6 pt-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(question);
        }}
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="How much on food last month?"
          enterKeyHint="search"
          className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-[16px] outline-none focus:border-ink"
        />
      </form>

      {!answer && (
        <div className="space-y-2 pt-2">
          <Label>Try</Label>
          {EXAMPLES.map((e) => (
            <button
              key={e}
              onClick={() => run(e)}
              className="block w-full rounded-xl border border-line bg-surface px-4 py-3 text-left text-[14px] text-muted active:opacity-70"
            >
              {e}
            </button>
          ))}
          <p className="px-1 pt-2 text-[12px] text-faint">
            Answered from the ledger on this device. Nothing is sent anywhere, which is also
            why it works with no connection.
          </p>
        </div>
      )}

      {answer && (
        <>
          <Card className="p-5">
            <div className={`mono ${answer.understood ? 'text-[38px] leading-none' : 'text-[17px]'}`}>
              {answer.headline}
            </div>
            {answer.detail && <div className="mt-2 text-[13px] text-muted">{answer.detail}</div>}
          </Card>

          {answer.txns.length > 0 && (
            <Card>
              <div className="px-4 pt-4">
                <Label>{answer.txns.length} matching</Label>
              </div>
              <div className="mt-1 divide-y divide-line">
                {answer.txns.map((t) => (
                  <Row
                    key={t.id}
                    title={t.merchant ?? 'Unnamed'}
                    subtitle={`${t.category} · ${formatDay(t.at)}`}
                    right={<Money paise={t.amountPaise} direction={t.direction} />}
                  />
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
