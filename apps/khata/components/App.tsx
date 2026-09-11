'use client';

/**
 * The whole application state, in one place.
 *
 * There are five states and the app is always in exactly one: still loading,
 * not connected, locked, syncing, or reading. Keeping them in a single union
 * rather than a pile of booleans is what stops the app rendering a ledger while
 * it is still deciding whether it has one.
 *
 * The passphrase lives in a ref and never in state that gets persisted or
 * serialised. It exists in memory for the session and goes with the tab.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildFromParsed, gmailQuery, safeParse, type Books } from '@/lib/ledger/build';
import type { Txn } from '@/lib/ledger/types';
import { PARSER_VERSION, type Parsed } from '@/lib/parse/parse';
import { fetchAll, BridgeError, type Bridge } from '@/lib/bridge/client';
import {
  DEFAULT_SETTINGS,
  forget,
  hasVault,
  loadSettings,
  loadVault,
  saveSettings,
  saveVault,
  type Settings,
  type Vault,
} from '@/lib/store/db';
import { WrongPassphrase } from '@/lib/store/crypto';
import type { Category, Overrides } from '@/lib/insight/categories';
import { merchantKey } from '@/lib/parse/extract';
import Connect from './Connect';
import Lock from './Lock';
import Now from './Now';
import Ledger, { type Filter } from './Ledger';
import Watch from './Watch';
import Ask from './Ask';
import Settings_ from './Settings';
import { Button } from './ui/bits';

type Stage =
  | { name: 'booting' }
  | { name: 'connect' }
  | { name: 'lock'; mode: 'create' | 'unlock'; error?: string }
  | { name: 'ready' };

const TABS = ['Now', 'Ledger', 'Watch', 'Ask'] as const;
type Tab = (typeof TABS)[number];

export default function App() {
  const [stage, setStage] = useState<Stage>({ name: 'booting' });
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [vault, setVault] = useState<Vault | null>(null);
  const [tab, setTab] = useState<Tab>('Now');
  const [filter, setFilter] = useState<Filter | undefined>();
  const [showSettings, setShowSettings] = useState(false);
  const [sync, setSync] = useState<{ busy: boolean; fetched: number; error?: string }>({
    busy: false,
    fetched: 0,
  });
  const [busy, setBusy] = useState(false);

  const passphrase = useRef<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  /*
   * A fixed "now" for the whole render.
   *
   * Every figure — this month's total, what is overdue, what is due soon — is
   * relative to a moment. Reading Date.now() in a dozen components means the
   * front page can disagree with itself across a midnight boundary.
   */
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    (async () => {
      const stored = await loadSettings();
      setSettings(stored);
      if (!stored.connected || !stored.bridgeUrl || !stored.bridgeSecret) {
        setStage({ name: 'connect' });
        return;
      }
      setStage({ name: 'lock', mode: (await hasVault()) ? 'unlock' : 'create' });
    })();
  }, []);

  const bridge: Bridge | null = useMemo(
    () =>
      settings.bridgeUrl && settings.bridgeSecret
        ? { url: settings.bridgeUrl, secret: settings.bridgeSecret }
        : null,
    [settings.bridgeUrl, settings.bridgeSecret],
  );

  const books: Books = useMemo(
    () =>
      buildFromParsed(Object.values(vault?.parsed ?? {}), {
        overrides: vault?.overrides ?? {},
        edits: (vault?.edits ?? {}) as Record<string, Txn['edited']>,
        now,
      }),
    [vault, now],
  );

  const persist = useCallback(async (next: Vault) => {
    setVault(next);
    if (passphrase.current) await saveVault(next, passphrase.current);
  }, []);

  /**
   * Fetch, merge, save.
   *
   * Merging by message id rather than replacing means a re-scan tops up the
   * cache instead of rebuilding it, so a shorter window later never loses the
   * history a longer one found.
   */
  const runSync = useCallback(
    async (current: Vault, days: number) => {
      if (!bridge) return;
      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;
      setSync({ busy: true, fetched: 0 });

      try {
        const fetched = await fetchAll(
          bridge,
          gmailQuery(days),
          (p) => setSync({ busy: true, fetched: p.fetched }),
          controller.signal,
        );

        /*
         * Parsed on arrival, and the body dropped right here. The cache keeps
         * what each email meant, never what it said.
         */
        const parsed: Record<string, Parsed> = { ...current.parsed };
        let latestAt = current.latestAt;
        for (const m of fetched) {
          parsed[m.id] = safeParse(m);
          latestAt = Math.max(latestAt, m.date || 0);
        }

        await persist({
          ...current,
          parsed,
          parserVersion: PARSER_VERSION,
          latestAt,
          savedAt: Date.now(),
        });
        const next = { ...settings, lastSyncAt: Date.now() };
        setSettings(next);
        await saveSettings(next);
        setSync({ busy: false, fetched: Object.keys(parsed).length });
      } catch (e) {
        const message =
          e instanceof BridgeError
            ? `${e.message}${e.hint ? ` ${e.hint}` : ''}`
            : 'Could not reach Gmail.';
        setSync({ busy: false, fetched: 0, error: message });
      }
    },
    [bridge, persist, settings],
  );

  const openVault = useCallback(
    async (secret: string, mode: 'create' | 'unlock') => {
      setBusy(true);
      try {
        const empty: Vault = {
          parsed: {},
          parserVersion: PARSER_VERSION,
          latestAt: 0,
          overrides: {},
          edits: {},
          savedAt: 0,
        };
        const loaded = mode === 'unlock' ? await loadVault(secret) : null;
        passphrase.current = secret;
        /*
         * A cache from an older parser — including the first release, which
         * stored whole message bodies — is rebuilt from scratch rather than
         * spread into the new one, so the bodies are gone on the next save.
         * Hand corrections survive; they are keyed to transactions, not mail.
         */
        const opened: Vault =
          loaded && loaded.parserVersion === PARSER_VERSION
            ? loaded
            : { ...empty, overrides: loaded?.overrides ?? {}, edits: loaded?.edits ?? {} };
        setVault(opened);
        setStage({ name: 'ready' });
        // A first unlock with nothing cached has nothing to show, so go and get it.
        if (Object.keys(opened.parsed).length === 0) void runSync(opened, settings.scanDays);
      } catch (e) {
        passphrase.current = null;
        setStage({
          name: 'lock',
          mode,
          error:
            e instanceof WrongPassphrase
              ? 'That passphrase does not open this cache.'
              : 'Could not open the cache.',
        });
      } finally {
        setBusy(false);
      }
    },
    [runSync, settings.scanDays],
  );

  const edit = useCallback(
    (id: string, patch: Partial<Txn>) => {
      if (!vault) return;
      const txn = books.txns.find((t) => t.id === id);
      const overrides: Overrides = { ...vault.overrides };
      // A category correction is really a statement about the merchant, so it is
      // stored against the merchant and applies to every payment to them.
      if (patch.category && txn) {
        const key = merchantKey(txn.merchant);
        if (key) overrides[key] = patch.category as Category;
      }
      void persist({
        ...vault,
        overrides,
        edits: { ...vault.edits, [id]: { ...(vault.edits[id] ?? {}), ...patch } },
      });
    },
    [vault, books.txns, persist],
  );

  if (stage.name === 'booting') {
    return <div className="flex min-h-[100dvh] items-center justify-center text-faint">···</div>;
  }

  if (stage.name === 'connect') {
    return (
      <Connect
        initialUrl={settings.bridgeUrl}
        initialSecret={settings.bridgeSecret}
        onConnected={async ({ url, secret, address }) => {
          const next = { ...settings, bridgeUrl: url, bridgeSecret: secret, address: address ?? undefined, connected: true };
          setSettings(next);
          await saveSettings(next);
          setStage({ name: 'lock', mode: (await hasVault()) ? 'unlock' : 'create' });
        }}
      />
    );
  }

  if (stage.name === 'lock') {
    return (
      <Lock
        mode={stage.mode}
        error={stage.error}
        busy={busy}
        onSubmit={(secret) => void openVault(secret, stage.mode)}
        onForget={async () => {
          await forget();
          passphrase.current = null;
          setVault(null);
          setSettings(DEFAULT_SETTINGS);
          setStage({ name: 'connect' });
        }}
      />
    );
  }

  const screen = () => {
    switch (tab) {
      case 'Now':
        return (
          <Now
            books={books}
            now={now}
            onOpenLedger={(f) => {
              setFilter(f);
              setTab('Ledger');
            }}
          />
        );
      case 'Ledger':
        return (
          <Ledger
            txns={books.txns}
            clearedTxnIds={books.clearedTxnIds}
            filter={filter}
            onClearFilter={() => setFilter(undefined)}
            onEdit={edit}
          />
        );
      case 'Watch':
        return <Watch books={books} now={now} />;
      case 'Ask':
        return <Ask txns={books.txns} now={now} />;
    }
  };

  return (
    <div className="mx-auto min-h-[100dvh] max-w-[560px] pb-[calc(72px+env(safe-area-inset-bottom))]">
      <header className="flex items-center justify-between px-4 pt-[max(14px,env(safe-area-inset-top))]">
        <div>
          <div className="text-[19px] tight">Khata</div>
          <div className="text-[12px] text-faint">
            {sync.busy
              ? `Reading your mail — ${sync.fetched} so far`
              : sync.error
                ? 'Sync failed'
                : settings.lastSyncAt
                  ? `Updated ${relative(settings.lastSyncAt, now)}`
                  : 'Not synced yet'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => vault && void runSync(vault, settings.scanDays)}
            disabled={sync.busy}
            className="rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] active:opacity-70 disabled:opacity-40"
          >
            {sync.busy ? '…' : 'Sync'}
          </button>
          <button
            onClick={() => setShowSettings(true)}
            aria-label="Settings"
            className="rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] active:opacity-70"
          >
            ⚙
          </button>
        </div>
      </header>

      {sync.busy && (
        <div className="sweep relative mx-4 mt-3 h-[2px] overflow-hidden rounded-full bg-sunk" />
      )}

      {sync.error && (
        <div className="mx-4 mt-3 rounded-xl border border-line bg-surface p-3 text-[13px]">
          <div className="text-out">{sync.error}</div>
          <Button
            variant="quiet"
            className="mt-2"
            onClick={() => vault && void runSync(vault, settings.scanDays)}
          >
            Try again
          </Button>
        </div>
      )}

      <main className="rise">{screen()}</main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-[560px] pb-[env(safe-area-inset-bottom)]">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                if (t !== 'Ledger') setFilter(undefined);
              }}
              className={`flex-1 py-3.5 text-[13px] tight ${tab === t ? 'text-ink' : 'text-faint'}`}
            >
              {t}
              <span
                className={`mx-auto mt-1 block h-[2px] w-6 rounded-full ${tab === t ? 'bg-ink' : 'bg-transparent'}`}
              />
            </button>
          ))}
        </div>
      </nav>

      {showSettings && (
        <Settings_
          settings={settings}
          books={books}
          onClose={() => setShowSettings(false)}
          onScanDays={async (days) => {
            const next = { ...settings, scanDays: days };
            setSettings(next);
            await saveSettings(next);
            if (vault) void runSync(vault, days);
          }}
          onForget={async () => {
            await forget();
            passphrase.current = null;
            setVault(null);
            setSettings(DEFAULT_SETTINGS);
            setShowSettings(false);
            setStage({ name: 'connect' });
          }}
        />
      )}
    </div>
  );
}

function relative(then: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 90) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
