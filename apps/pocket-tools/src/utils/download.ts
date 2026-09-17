/**
 * Handing a file to the browser's own download. Made here, saved here; there is
 * no server in between to send it to.
 */

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
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  } catch {
    return false;
  }
}

export const downloadText = (text: string, name: string, type = 'text/plain;charset=utf-8'): boolean =>
  downloadBlob(new Blob([text], { type }), name);

export const downloadBytes = (bytes: Uint8Array, name: string, type: string): boolean =>
  downloadBlob(new Blob([bytes as BlobPart], { type }), name);

/** "photo.jpg" → "photo-compressed.webp" */
export function renamed(original: string, suffix: string, ext: string): string {
  const base = original.replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'image';
  return `${base}${suffix ? `-${suffix}` : ''}.${ext}`;
}

export const dated = (prefix: string, ext: string): string => `${prefix}-${new Date().toISOString().slice(0, 10)}.${ext}`;

export function csv(rows: (string | number)[][]): string {
  return rows.map((row) => row.map((cell) => {
    const text = String(cell);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }).join(',')).join('\n');
}
