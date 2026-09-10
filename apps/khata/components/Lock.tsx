'use client';

/**
 * The passphrase gate.
 *
 * Two modes from one component, because the wording is the only real difference
 * and getting the wording right matters more than the code: setting a
 * passphrase needs a warning that it cannot be reset, and entering one needs to
 * say plainly that a wrong guess is indistinguishable from a corrupted cache.
 */

import { useState } from 'react';
import { judgePassphrase } from '@/lib/store/crypto';
import { Button, Label } from './ui/bits';

export default function Lock({
  mode,
  onSubmit,
  onForget,
  error,
  busy,
}: {
  mode: 'create' | 'unlock';
  onSubmit: (passphrase: string) => void;
  onForget: () => void;
  error?: string | null;
  busy?: boolean;
}) {
  const [value, setValue] = useState('');
  const [confirm, setConfirm] = useState('');
  const judgement = judgePassphrase(value);

  const ready =
    mode === 'unlock' ? value.length > 0 : judgement.ok && value === confirm && confirm.length > 0;

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-[460px] flex-col justify-center px-6 pb-20">
      <h1 className="text-[30px] leading-[1.1] tight">
        {mode === 'create' ? 'Lock your ledger' : 'Unlock'}
      </h1>
      <p className="mt-3 text-[14px] text-muted">
        {mode === 'create'
          ? 'Your transactions are cached on this device so the app opens instantly instead of re-reading a year of mail every time. That cache is encrypted with this passphrase.'
          : 'Enter the passphrase you set for the cache on this device.'}
      </p>

      <form
        className="mt-6 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) onSubmit(value);
        }}
      >
        <input
          type="password"
          value={value}
          autoFocus
          autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Passphrase"
          className="w-full rounded-xl border border-line bg-surface px-4 py-3 outline-none focus:border-ink"
        />

        {mode === 'create' && (
          <>
            <input
              type="password"
              value={confirm}
              autoComplete="new-password"
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Again"
              className="w-full rounded-xl border border-line bg-surface px-4 py-3 outline-none focus:border-ink"
            />
            {value.length > 0 && (
              <p className={`text-[13px] ${judgement.ok ? 'text-muted' : 'text-warn'}`}>
                {judgement.message}
              </p>
            )}
            {confirm.length > 0 && value !== confirm && (
              <p className="text-[13px] text-out">These do not match.</p>
            )}
          </>
        )}

        {error && <p className="text-[13px] text-out">{error}</p>}

        <Button type="submit" disabled={!ready || busy} className="w-full">
          {busy ? 'Working…' : mode === 'create' ? 'Set passphrase' : 'Unlock'}
        </Button>
      </form>

      {mode === 'unlock' && (
        <div className="mt-8 border-t border-line pt-5">
          <Label>Forgotten it?</Label>
          <p className="mt-2 text-[13px] text-muted">
            There is no recovery — that is what makes the encryption worth having. You can
            clear the cache and read your mail again from scratch; nothing is lost but the
            time it takes to re-scan, and any categories you corrected by hand.
          </p>
          <button
            onClick={onForget}
            className="mt-3 text-[13px] text-out underline underline-offset-4 active:opacity-70"
          >
            Clear the cache and start over
          </button>
        </div>
      )}

      {mode === 'create' && (
        <p className="mt-6 text-[12px] text-faint">
          Keep this somewhere. It is not stored anywhere, not sent anywhere, and cannot be
          reset — if you lose it the cache is unreadable and has to be rebuilt from mail.
        </p>
      )}
    </div>
  );
}
