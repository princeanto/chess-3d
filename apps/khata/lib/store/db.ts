/**
 * The on-device cache.
 *
 * IndexedDB rather than localStorage because a year of mail is megabytes and
 * localStorage is both small and synchronous — writing to it on the main thread
 * would stutter the scroll of the very list it exists to make fast.
 *
 * Two stores, deliberately different in kind. `vault` holds the encrypted
 * ledger. `settings` holds unencrypted preferences — which tab you were on, how
 * far back to scan — and, unavoidably, the bridge URL and secret, because they
 * are needed before any passphrase has been entered. Nothing about your money
 * is in `settings`.
 */

import type { Parsed } from '../parse/parse';
import type { Overrides } from '../insight/categories';
import { seal, unseal, type Sealed } from './crypto';

const DB_NAME = 'khata';
const DB_VERSION = 1;

export interface Vault {
  /**
   * What each message meant, keyed by Gmail id — never what it said. Bodies
   * are parsed on arrival and dropped, so the cache holds amounts, dates,
   * senders and subject lines, and a copied browser profile does not carry a
   * year of bank mail.
   */
  parsed: Record<string, Parsed>;
  /** Readings from an older parser are discarded and the mail read again. */
  parserVersion: number;
  /** The newest message date seen, so the next scan only asks for what is new. */
  latestAt: number;
  overrides: Overrides;
  edits: Record<string, Record<string, unknown>>;
  savedAt: number;
}

export interface Settings {
  bridgeUrl?: string;
  bridgeSecret?: string;
  scanDays: number;
  /** Set once the user has finished setup, so the app stops offering it. */
  connected?: boolean;
  lastSyncAt?: number;
  address?: string;
}

export const DEFAULT_SETTINGS: Settings = { scanDays: 365 };

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('vault')) db.createObjectStore('vault');
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function run<T>(store: string, mode: IDBTransactionMode, work: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const request = work(tx.objectStore(store));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
      }),
  );
}

/*
 * Every read is wrapped, because IndexedDB is genuinely unavailable in more
 * places than people expect — private windows in some browsers, embedded
 * webviews, profiles with site data blocked. The app has to work as a
 * session-only tool when that happens rather than refuse to start.
 */
export async function loadSettings(): Promise<Settings> {
  try {
    const stored = await run<Settings | undefined>('settings', 'readonly', (s) => s.get('main'));
    return { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  try {
    await run('settings', 'readwrite', (s) => s.put(settings, 'main'));
  } catch {
    /* Session-only is a working state, not an error worth interrupting for. */
  }
}

export async function hasVault(): Promise<boolean> {
  try {
    const sealed = await run<Sealed | undefined>('vault', 'readonly', (s) => s.get('ledger'));
    return sealed !== undefined;
  } catch {
    return false;
  }
}

export async function saveVault(vault: Vault, passphrase: string): Promise<void> {
  const sealed = await seal(vault, passphrase);
  await run('vault', 'readwrite', (s) => s.put(sealed, 'ledger'));
}

/** Throws `WrongPassphrase` on a bad key; returns null when there is no cache. */
export async function loadVault(passphrase: string): Promise<Vault | null> {
  const sealed = await run<Sealed | undefined>('vault', 'readonly', (s) => s.get('ledger'));
  if (!sealed) return null;
  return unseal<Vault>(sealed, passphrase);
}

/**
 * Forget everything.
 *
 * Deletes the whole database rather than clearing the stores, so the bridge
 * secret goes with it. A "clear my data" that leaves a working key to your
 * mailbox behind is not one.
 */
export function forget(): Promise<void> {
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}
