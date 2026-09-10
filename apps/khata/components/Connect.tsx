'use client';

/**
 * Setup.
 *
 * The one screen where the app has to ask something of the user, so it is
 * written to be finishable rather than skimmed: numbered steps, one action each,
 * a copy button wherever text has to move, and every step says what it is for.
 *
 * The manifest step exists purely to get read-only access instead of full
 * mailbox control, and that reason is on the screen — otherwise it reads as
 * pointless friction and gets skipped.
 */

import { useEffect, useMemo, useState } from 'react';
import { BRIDGE_VERSION, MANIFEST, codeWithSecret, makeSecret } from '@/lib/bridge/script';
import { looksLikeDeploymentUrl, ping, BridgeError } from '@/lib/bridge/client';
import { Button, Label } from './ui/bits';

const NEW_SCRIPT = 'https://script.google.com/home/projects/create';

function Copy({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          // Clipboard access is refused in some embedded browsers; the textarea
          // below is always there to select by hand.
        }
        setDone(true);
        setTimeout(() => setDone(false), 1600);
      }}
      className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] tight active:opacity-70"
    >
      {done ? 'Copied' : label}
    </button>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 py-4">
      <div className="mono mt-[2px] flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-[12px] text-paper">
        {n}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] tight">{title}</div>
        <div className="mt-2 space-y-3 text-[13px] text-muted">{children}</div>
      </div>
    </div>
  );
}

export default function Connect({
  initialUrl,
  initialSecret,
  onConnected,
}: {
  initialUrl?: string;
  initialSecret?: string;
  onConnected: (bridge: { url: string; secret: string; address: string | null }) => void;
}) {
  // Generated once and kept, so re-opening setup does not invalidate a script
  // that is already deployed and working.
  const [secret] = useState(() => initialSecret || makeSecret());
  const [url, setUrl] = useState(initialUrl ?? '');
  const [state, setState] = useState<'idle' | 'checking' | 'error'>('idle');
  const [error, setError] = useState<{ message: string; hint?: string } | null>(null);

  const code = useMemo(() => codeWithSecret(secret), [secret]);

  useEffect(() => {
    setState('idle');
    setError(null);
  }, [url]);

  const connect = async () => {
    setState('checking');
    setError(null);
    try {
      const result = await ping({ url: url.trim(), secret });
      onConnected({ url: url.trim(), secret, address: result.address });
    } catch (e) {
      const err = e instanceof BridgeError ? e : new BridgeError('Something went wrong.');
      setError({ message: err.message, hint: err.hint });
      setState('error');
    }
  };

  const urlLooksRight = looksLikeDeploymentUrl(url);

  return (
    <div className="mx-auto max-w-[560px] px-5 pb-32 pt-10">
      <h1 className="text-[30px] leading-[1.1] tight">Connect your inbox</h1>
      <p className="mt-3 text-[14px] text-muted">
        Your banks already email you every time money moves. Khata reads those emails and
        nothing else. It runs a small script inside your own Google account, so your mail
        never passes through a server belonging to anyone else — including me.
      </p>

      <div className="mt-6 divide-y divide-line rounded-2xl border border-line bg-surface px-4">
        <Step n={1} title="Open a blank script">
          <p>No Google Cloud console, no project setup. Just an empty file.</p>
          <a
            href={NEW_SCRIPT}
            target="_blank"
            rel="noreferrer"
            className="inline-block rounded-lg bg-ink px-3 py-2 text-[13px] tight text-paper active:opacity-70"
          >
            Open script.google.com ↗
          </a>
        </Step>

        <Step n={2} title="Replace everything with this code">
          <p>
            Select all in the editor, paste this over it, and save. It searches your mail
            and returns what it finds — it does no parsing, so you will never have to come
            back and update it.
          </p>
          <div className="flex items-center gap-2">
            <Copy text={code} label="Copy the code" />
            <span className="text-[12px] text-faint">v{BRIDGE_VERSION}, ~90 lines</span>
          </div>
          <textarea
            readOnly
            value={code}
            spellCheck={false}
            onFocus={(e) => e.currentTarget.select()}
            className="mono h-28 w-full resize-none rounded-lg border border-line bg-sunk p-2 text-[11px] leading-tight text-muted"
          />
        </Step>

        <Step n={3} title="Make it read-only">
          <p>
            In the editor: <strong className="text-ink">Project Settings</strong> (the gear),
            tick <strong className="text-ink">“Show appsscript.json”</strong>, open that file,
            and paste this over it.
          </p>
          <p>
            This step is what limits the script to <strong className="text-ink">reading</strong>{' '}
            your mail. Without it Google grants the convenient shortcut, which can also send
            and delete — and nothing here has any business doing either.
          </p>
          <Copy text={MANIFEST} label="Copy the manifest" />
          <textarea
            readOnly
            value={MANIFEST}
            spellCheck={false}
            onFocus={(e) => e.currentTarget.select()}
            className="mono h-24 w-full resize-none rounded-lg border border-line bg-sunk p-2 text-[11px] leading-tight text-muted"
          />
        </Step>

        <Step n={4} title="Deploy it, and approve">
          <p>
            <strong className="text-ink">Deploy → New deployment → Web app</strong>. Set
            “Execute as” to yourself and “Who has access” to{' '}
            <strong className="text-ink">Anyone</strong>, then Deploy.
          </p>
          <p>
            Google will warn you the app is unverified. It is your own script, in your own
            account — open <strong className="text-ink">Advanced</strong> and continue.
          </p>
          <p>
            “Anyone” sounds alarming and is worth understanding: the URL is unguessable, and
            the script also refuses any request that does not carry the secret this device
            just generated. Deleting the deployment revokes everything instantly.
          </p>
        </Step>

        <Step n={5} title="Paste the URL it gives you">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://script.google.com/macros/s/…/exec"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className="mono w-full rounded-lg border border-line bg-sunk px-3 py-2 text-[12px] text-ink outline-none focus:border-ink"
          />
          {url && !urlLooksRight && (
            <p className="text-warn">
              That does not look like a deployment URL. It should end in <code>/exec</code>.
            </p>
          )}
          {error && (
            <div className="rounded-lg border border-line bg-sunk p-3">
              <div className="text-out">{error.message}</div>
              {error.hint && <div className="mt-1">{error.hint}</div>}
            </div>
          )}
          <Button onClick={connect} disabled={!urlLooksRight || state === 'checking'}>
            {state === 'checking' ? 'Checking…' : 'Connect'}
          </Button>
        </Step>
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-surface p-4">
        <Label>What this can and cannot see</Label>
        <ul className="mt-2 space-y-1.5 text-[13px] text-muted">
          <li>· Only mail matching bank-alert wording. Not your whole inbox.</li>
          <li>· Read-only. It cannot send, delete or change anything.</li>
          <li>· If a bank only texts you, those transactions are invisible to this app.</li>
          <li>· Nothing is uploaded. The ledger is built and stored on this device.</li>
        </ul>
      </div>
    </div>
  );
}
