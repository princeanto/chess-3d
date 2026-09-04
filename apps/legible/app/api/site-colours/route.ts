/**
 * Reads a site's palette off its stylesheets.
 *
 * This has to run on the server: the browser will not let a page fetch another
 * origin's HTML, so a client-side version would be blocked by CORS on every
 * site worth checking.
 *
 * It reads *declared* colours, not rendered pixels. That is the honest
 * trade-off — it finds the design tokens a team actually wrote, which is
 * usually what you want to audit, but it will miss colours applied only by
 * JavaScript at runtime and it cannot see images. When it comes back thin, a
 * screenshot through the image route is the better tool.
 */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 20;

const FETCH_TIMEOUT_MS = 8000;
const MAX_BYTES = 3_000_000;
const MAX_STYLESHEETS = 8;

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/**
 * Server-side fetch of a user-supplied URL is a server-side request forgery
 * hole unless it is fenced in. Only http(s), and never anything that resolves
 * to the machine itself or to a private network — otherwise this endpoint
 * becomes a proxy into infrastructure that is not meant to be reachable.
 */
function assertPublicUrl(raw: string): URL {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error('Enter a web address first.');

  // Detect an explicit scheme before defaulting, so that `file://…` is rejected
  // by the protocol check rather than being silently rewritten into
  // `https://file://…` and failing later with a confusing message.
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed);

  let url: URL;
  try {
    url = new URL(hasScheme ? trimmed : `https://${trimmed}`);
  } catch {
    throw new Error("That doesn't look like a web address.");
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http and https addresses can be checked.');
  }

  const host = url.hostname.toLowerCase();
  const blocked =
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host === '::1' ||
    host.startsWith('[');

  if (blocked) throw new Error('That address is not publicly reachable.');
  return url;
}

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'user-agent': UA, accept: 'text/html,text/css,*/*' },
    });
    if (!res.ok) throw new Error(`The site returned ${res.status}.`);

    const reader = res.body?.getReader();
    if (!reader) return await res.text();

    // Read with a hard byte cap rather than trusting content-length, which is
    // often absent on compressed responses and can simply be wrong.
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      total += value.length;
      if (total >= MAX_BYTES) {
        await reader.cancel();
        break;
      }
    }

    const joined = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      joined.set(chunk, offset);
      offset += chunk.length;
    }
    return new TextDecoder().decode(joined);
  } finally {
    clearTimeout(timer);
  }
}

/* Colour literals in CSS. Named colours are skipped: `red` and `white` appear
 * in class names and comments far more often than as real declarations. */
const COLOUR_RE =
  /#[0-9a-fA-F]{3,8}\b|rgba?\(\s*[\d.\s,%/]+\)|hsla?\(\s*[\d.\s,%/deg]+\)|oklch\(\s*[\d.\s%/-]+\)/g;

function toHexFromCss(token: string): string | null {
  const t = token.trim().toLowerCase();

  if (t.startsWith('#')) {
    let h = t.slice(1);
    if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    return `#${h.slice(0, 6)}`;
  }

  if (t.startsWith('rgb')) {
    const parts = t.match(/[\d.]+%?/g);
    if (!parts || parts.length < 3) return null;
    const channel = (p: string) => {
      const v = parseFloat(p);
      return Math.round(Math.min(255, Math.max(0, p.endsWith('%') ? (v / 100) * 255 : v)));
    };
    const [r, g, b] = [channel(parts[0]), channel(parts[1]), channel(parts[2])];
    return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  }

  if (t.startsWith('hsl')) {
    const parts = t.match(/-?[\d.]+/g);
    if (!parts || parts.length < 3) return null;
    const h = ((parseFloat(parts[0]) % 360) + 360) % 360;
    const s = Math.min(1, Math.max(0, parseFloat(parts[1]) / 100));
    const l = Math.min(1, Math.max(0, parseFloat(parts[2]) / 100));
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    const seg = Math.floor(h / 60) % 6;
    const rgb = [
      [c, x, 0],
      [x, c, 0],
      [0, c, x],
      [0, x, c],
      [x, 0, c],
      [c, 0, x],
    ][seg].map((v) => Math.round((v + m) * 255));
    return `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  }

  return null; // oklch() is matched so it is not mistaken for junk, but not converted here
}

export async function POST(request: Request) {
  let target: URL;
  try {
    const body = (await request.json()) as { url?: string };
    target = assertPublicUrl(body.url ?? '');
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Bad request.' },
      { status: 400 },
    );
  }

  try {
    const html = await fetchText(target.href);

    // Inline styles first, then linked stylesheets in document order.
    const sources: string[] = [];
    for (const m of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) sources.push(m[1]);
    for (const m of html.matchAll(/style\s*=\s*"([^"]*)"/gi)) sources.push(m[1]);

    const links: string[] = [];
    for (const m of html.matchAll(/<link[^>]+>/gi)) {
      const tag = m[0];
      if (!/rel\s*=\s*["']?stylesheet/i.test(tag)) continue;
      const href = /href\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
      if (!href) continue;
      try {
        const abs = new URL(href, target).href;
        assertPublicUrl(abs);
        links.push(abs);
      } catch {
        // Skip anything that resolves somewhere we will not go.
      }
      if (links.length >= MAX_STYLESHEETS) break;
    }

    const sheets = await Promise.all(
      links.map((href) => fetchText(href).catch(() => '')),
    );
    sources.push(...sheets);

    const counts = new Map<string, number>();
    for (const src of sources) {
      for (const token of src.match(COLOUR_RE) ?? []) {
        const hex = toHexFromCss(token);
        if (!hex) continue;
        counts.set(hex, (counts.get(hex) ?? 0) + 1);
      }
    }

    const colours = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 24)
      .map(([hex, count]) => ({ hex, count }));

    return NextResponse.json({
      site: target.hostname,
      stylesheets: links.length,
      colours,
      note:
        colours.length === 0
          ? 'No colours were declared in this page’s CSS. It may build its styles in JavaScript — a screenshot will work better.'
          : null,
    });
  } catch (err) {
    const message =
      err instanceof Error && err.name === 'AbortError'
        ? 'The site took too long to respond.'
        : err instanceof Error
          ? err.message
          : 'That site could not be read.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
