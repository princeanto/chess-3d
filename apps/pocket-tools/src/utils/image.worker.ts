/// <reference lib="webworker" />
/* Image jobs off the main thread. The file arrives as a Blob, is decoded here, and only the result goes back. */

import { compressToTarget, encodeWithTransform, type OutputType, type Transform } from './imageCore';

export type Job =
  | { kind: 'compress'; type: OutputType; target: number }
  | { kind: 'quality'; type: OutputType; quality: number; transform?: Partial<Transform> }
  | { kind: 'transform'; type: OutputType; quality: number; transform: Transform };

self.onmessage = async (event: MessageEvent<{ id: number; file: Blob; job: Job }>) => {
  const { id, file, job } = event.data;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    if (job.kind === 'compress') {
      const r = await compressToTarget(bitmap, job.type, job.target);
      postMessage({ id, ok: true, blob: r.blob, width: r.width, height: r.height, quality: r.quality, reached: r.reached });
    } else {
      const t: Transform = job.kind === 'transform' ? job.transform : { width: bitmap.width, height: bitmap.height, ...job.transform };
      const r = await encodeWithTransform(bitmap, t, job.type, job.quality);
      postMessage({ id, ok: true, blob: r.blob, width: r.width, height: r.height, quality: job.quality, reached: true });
    }
    bitmap.close();
  } catch (error) {
    postMessage({ id, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
};
