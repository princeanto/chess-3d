/**
 * Images, on this device.
 *
 * Files are opened with createImageBitmap, which honours the rotation a phone
 * camera writes into the file (so portraits don't come out sideways), and heavy
 * work goes to a worker. Nothing is uploaded: the File never leaves the page
 * except into that worker, which is part of the page.
 */

import type { Job } from './image.worker';
import { compressToTarget, encodeWithTransform, type OutputType } from './imageCore';

export type { OutputType, Fit, Transform } from './imageCore';

export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/bmp,image/avif';

export interface LoadedImage {
  file: File;
  name: string;
  type: string;
  size: number;
  width: number;
  height: number;
  /** For <img> previews. Revoke with `release`. */
  url: string;
}

export const extFor = (type: string): string => (type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg');
export const labelFor = (type: string): string => (type === 'image/png' ? 'PNG' : type === 'image/webp' ? 'WebP' : type === 'image/gif' ? 'GIF' : type === 'image/avif' ? 'AVIF' : type === 'image/bmp' ? 'BMP' : 'JPG');

export class FriendlyError extends Error {}

export async function openImage(file: File): Promise<LoadedImage> {
  const heic = /\.(heic|heif)$/i.test(file.name) || /heic|heif/i.test(file.type);
  if (heic) throw new FriendlyError('HEIC photos aren’t supported by this browser yet. On an iPhone, share the photo as “Most Compatible” (JPG) and try again.');
  if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(file.name)) {
    throw new FriendlyError('This file type isn’t supported yet.');
  }
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    const info = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return { file, name: file.name, type: file.type || 'image/jpeg', size: file.size, ...info, url: URL.createObjectURL(file) };
  } catch {
    throw new FriendlyError('That image couldn’t be opened. It may be damaged, or in a format this browser can’t read.');
  }
}

export const release = (image: LoadedImage | null | undefined) => { if (image) URL.revokeObjectURL(image.url); };

export interface JobResult { blob: Blob; width: number; height: number; quality: number; reached: boolean }

let worker: Worker | null | undefined;
let seq = 0;
const waiting = new Map<number, { resolve: (r: JobResult) => void; reject: (e: Error) => void }>();

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    if (typeof OffscreenCanvas === 'undefined' || typeof Worker === 'undefined') return (worker = null);
    worker = new Worker(new URL('./image.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<{ id: number; ok: boolean; error?: string } & JobResult>) => {
      const task = waiting.get(event.data.id);
      if (!task) return;
      waiting.delete(event.data.id);
      if (event.data.ok) task.resolve(event.data);
      else task.reject(new Error(event.data.error));
    };
    worker.onerror = () => {
      waiting.forEach((task) => task.reject(new Error('worker')));
      waiting.clear();
      worker = null;
    };
  } catch {
    worker = null;
  }
  return worker;
}

async function onPage(file: Blob, job: Job): Promise<JobResult> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  try {
    if (job.kind === 'compress') {
      const r = await compressToTarget(bitmap, job.type, job.target);
      return { blob: r.blob, width: r.width, height: r.height, quality: r.quality, reached: r.reached };
    }
    const t = job.kind === 'transform' ? job.transform : { width: bitmap.width, height: bitmap.height, ...job.transform };
    const r = await encodeWithTransform(bitmap, t, job.type, job.quality);
    return { ...r, quality: job.quality, reached: true };
  } finally {
    bitmap.close();
  }
}

/** Runs in the worker when there is one; on the page otherwise, and if the worker fails. */
export async function runImageJob(file: Blob, job: Job): Promise<JobResult> {
  const w = getWorker();
  if (w) {
    try {
      return await new Promise<JobResult>((resolve, reject) => {
        seq += 1;
        waiting.set(seq, { resolve, reject });
        w.postMessage({ id: seq, file, job });
      });
    } catch {
      /* fall back to the page */
    }
  }
  return onPage(file, job);
}

/** Canvas → JPEG bytes, for the PDF writer. */
export async function canvasToJpegBytes(canvas: HTMLCanvasElement, quality = 0.9): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('jpeg'))), 'image/jpeg', quality));
  return new Uint8Array(await blob.arrayBuffer());
}

/** Any image file → JPEG bytes and size, flattened on white, at most `maxSide` pixels. */
export async function fileToJpeg(file: Blob, maxSide = 3000, quality = 0.9): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const r = await runImageJob(file, { kind: 'transform', type: 'image/jpeg', quality, transform: { width, height, background: '#FFFFFF' } });
  bitmap.close();
  return { bytes: new Uint8Array(await r.blob.arrayBuffer()), width: r.width, height: r.height };
}

export type { OutputType as ImageType };
export const OUTPUT_TYPES: { id: OutputType; label: string }[] = [
  { id: 'image/jpeg', label: 'JPG' },
  { id: 'image/png', label: 'PNG' },
  { id: 'image/webp', label: 'WebP' },
];
