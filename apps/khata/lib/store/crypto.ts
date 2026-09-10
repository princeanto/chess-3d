/**
 * Encryption for the local cache.
 *
 * The cache holds derived transactions — amounts, dates, merchants, last-four
 * digits. It never holds an email body and never holds the bridge secret. Even
 * so it is a picture of someone's finances sitting in a browser profile, so it
 * is encrypted with a key that only exists while the app is open.
 *
 * What this protects against: someone with your unlocked laptop opening dev
 * tools, a shared machine, a backup of the profile directory. What it does not
 * protect against: malicious code running inside the page itself, which would
 * have the key in memory anyway. Being clear about that boundary matters more
 * than the cipher choice.
 */

const ITERATIONS = 310_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

export interface Sealed {
  salt: number[];
  iv: number[];
  data: number[];
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * PBKDF2 rather than a raw hash.
 *
 * A passphrase people can remember has perhaps 30 bits of entropy, so the only
 * defence is making each guess expensive. 310,000 iterations of SHA-256 is
 * OWASP's current figure and costs about a quarter of a second on a phone —
 * slow enough to matter at scale, fast enough not to be noticed once.
 */
async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function seal(value: unknown, passphrase: string): Promise<Sealed> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt);
  const data = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    encoder.encode(JSON.stringify(value)),
  );
  return {
    salt: Array.from(salt),
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(data)),
  };
}

export class WrongPassphrase extends Error {
  constructor() {
    super('That passphrase does not open this cache.');
    this.name = 'WrongPassphrase';
  }
}

export async function unseal<T>(sealed: Sealed, passphrase: string): Promise<T> {
  const key = await deriveKey(passphrase, new Uint8Array(sealed.salt));
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(sealed.iv) as BufferSource },
      key,
      new Uint8Array(sealed.data),
    );
  } catch {
    // GCM authenticates as it decrypts, so a wrong key and tampered data are
    // the same failure. There is nothing more specific that can honestly be said.
    throw new WrongPassphrase();
  }
  return JSON.parse(decoder.decode(plain)) as T;
}

/** Weak passphrases are the whole attack; this is the one place to say so. */
export function judgePassphrase(value: string): { ok: boolean; message: string } {
  if (value.length < 8) {
    return { ok: false, message: 'At least 8 characters.' };
  }
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z0-9]/].filter((re) => re.test(value)).length;
  if (value.length < 12 && classes < 3) {
    return { ok: false, message: 'Add a number or symbol, or make it longer.' };
  }
  if (/^(?:\d+|[a-z]+)$/i.test(value) && value.length < 16) {
    return { ok: false, message: 'All one kind of character — try a short phrase instead.' };
  }
  return { ok: true, message: 'Good. There is no way to reset this, so keep it somewhere.' };
}
