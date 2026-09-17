/**
 * Getting work out of the browser, without it going anywhere else.
 *
 * Every export here is made on this device and handed to the browser's own
 * download. Nothing is uploaded, because there is nowhere to upload it to.
 */

export type Format = 'png' | 'svg' | 'css' | 'json';

export function fileName(tool: string, kind: string, seed: number | string, ext: string): string {
  return `playground-${tool}-${kind}-${seed}.${ext}`.toLowerCase().replace(/[^a-z0-9.-]+/g, '-');
}

/** Returns false rather than throwing: a failed download gets a friendly toast. */
export function downloadBlob(blob: Blob, name: string): boolean {
  try {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Give the browser a moment to start the download before the URL goes.
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    return true;
  } catch {
    return false;
  }
}

export const downloadText = (text: string, name: string, type: string): boolean =>
  downloadBlob(new Blob([text], { type }), name);

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), 'image/png');
    } catch {
      resolve(null);
    }
  });
}

/**
 * A canvas at export size, with a backing store capped so a huge poster cannot
 * exhaust memory on a phone — browsers silently return a blank canvas past
 * their limit, which is a worse failure than a slightly smaller file.
 */
export function makeCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  const MAX_PIXELS = 16_000_000;
  const scale = Math.min(1, Math.sqrt(MAX_PIXELS / (w * h)));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  if (scale < 1) ctx.scale(scale, scale);
  return { canvas, ctx };
}

/**
 * Copy text, with a fallback for browsers that refuse the Clipboard API.
 *
 * The modern API needs a secure page and a recent click. When either is
 * missing, a hidden textarea and execCommand still works almost everywhere.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the old way */
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

/** Wait for a font to be ready, so canvas text never falls back to Times. */
export async function fontsReady(specs: readonly string[]): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) return;
  try {
    await Promise.all(specs.map((spec) => document.fonts.load(spec)));
  } catch {
    /* an export in a fallback font beats no export */
  }
}

export const escapeXml = (text: string): string =>
  text.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);
