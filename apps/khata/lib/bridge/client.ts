/**
 * Talking to the bridge.
 *
 * The request is deliberately the dullest possible cross-origin POST: a
 * `text/plain` body and no custom headers, which the browser treats as a simple
 * request and sends without a preflight. Apps Script has no way to answer a
 * preflight, so anything more sophisticated — a JSON content type, an
 * Authorization header — fails with an opaque CORS error and no clue why.
 *
 * The secret travels in the body rather than the query string, so it stays out
 * of browser history, referrers and Google's own request logs.
 */

import type { Message } from '../ledger/types';

export interface Bridge {
  url: string;
  secret: string;
}

export class BridgeError extends Error {
  constructor(
    message: string,
    readonly hint?: string,
  ) {
    super(message);
    this.name = 'BridgeError';
  }
}

async function call<T>(bridge: Bridge, payload: Record<string, unknown>): Promise<T> {
  let response: Response;
  try {
    response = await fetch(bridge.url, {
      method: 'POST',
      // Anything but text/plain triggers a preflight the script cannot answer.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...payload, secret: bridge.secret }),
      redirect: 'follow',
    });
  } catch {
    throw new BridgeError(
      'Could not reach the bridge.',
      'Check the deployment URL, and that the script is deployed with access set to “Anyone”.',
    );
  }

  if (!response.ok) {
    throw new BridgeError(
      `The bridge replied ${response.status}.`,
      response.status === 401 || response.status === 403
        ? 'Re-deploy the script and make sure access is set to “Anyone”.'
        : undefined,
    );
  }

  const text = await response.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    /*
     * An HTML reply here is almost always Google's sign-in page, which means the
     * deployment is restricted to its owner rather than open with a secret.
     */
    throw new BridgeError(
      'The bridge returned a page instead of data.',
      'That usually means the deployment’s access is not set to “Anyone”.',
    );
  }

  const record = data as Record<string, unknown>;
  if (typeof record.error === 'string') {
    throw new BridgeError(
      record.error === 'unauthorized' ? 'The bridge rejected the secret.' : record.error,
      record.error === 'unauthorized'
        ? 'The script holds a different secret from this device. Re-paste the code shown in Setup.'
        : undefined,
    );
  }
  return data as T;
}

export interface Ping {
  ok: true;
  version: number;
  address: string | null;
}

export function ping(bridge: Bridge): Promise<Ping> {
  return call<Ping>(bridge, { action: 'ping' });
}

interface Page {
  messages: Message[];
  nextPageToken: string | null;
}

export interface FetchProgress {
  fetched: number;
  /** Null until Gmail stops handing back page tokens; the total is not known up front. */
  done: boolean;
}

/**
 * Every message matching a query, a page at a time.
 *
 * Paged rather than fetched whole because the first scan can run to thousands of
 * messages, and a progress figure that moves is the difference between a slow
 * app and a broken one. `signal` lets the user leave the screen without leaving
 * the requests running.
 */
export async function fetchAll(
  bridge: Bridge,
  query: string,
  onProgress?: (progress: FetchProgress) => void,
  signal?: AbortSignal,
): Promise<Message[]> {
  const all: Message[] = [];
  let pageToken: string | null = null;

  for (let page = 0; page < 200; page += 1) {
    if (signal?.aborted) break;
    const result: Page = await call<Page>(bridge, {
      action: 'search',
      query,
      pageToken,
      limit: 100,
    });
    all.push(...(result.messages ?? []));
    onProgress?.({ fetched: all.length, done: !result.nextPageToken });
    pageToken = result.nextPageToken;
    if (!pageToken) break;
  }

  return all;
}

/** Apps Script deployment URLs all look like this; catching a wrong paste early. */
export function looksLikeDeploymentUrl(url: string): boolean {
  return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{20,}\/exec\/?$/.test(
    url.trim(),
  );
}
