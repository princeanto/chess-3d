'use client';

/** What every image tool needs: open a file kindly, show what it is, compare before and after. */

import { useCallback, useEffect, useRef, useState } from 'react';
import { FriendlyError, labelFor, openImage, release, type LoadedImage } from '@/utils/image';
import { bytes, number } from '@/utils/format';
import { Button } from '@/components/ui';

export function useImageFile() {
  const [image, setImage] = useState<LoadedImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const current = useRef<LoadedImage | null>(null);

  useEffect(() => () => release(current.current), []);

  const open = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setError(null);
    try {
      const next = await openImage(file);
      release(current.current);
      current.current = next;
      setImage(next);
    } catch (e) {
      setError(e instanceof FriendlyError ? e.message : 'Something went wrong. Try again.');
    }
  }, []);

  const clear = useCallback(() => {
    release(current.current);
    current.current = null;
    setImage(null);
    setError(null);
  }, []);

  return { image, error, open, clear };
}

/** A blob URL that is released when replaced or unmounted. */
export function useObjectUrl(blob: Blob | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) { setUrl(null); return; }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  return url;
}

export function ImageInfo({ image, onClear, label = 'Change image' }: { image: LoadedImage; onClear: () => void; label?: string }) {
  return (
    <div className="image-info">
      <img src={image.url} alt="" className="image-info-thumb" />
      <div className="image-info-text">
        <p className="image-info-name" title={image.name}>{image.name}</p>
        <p className="image-info-meta"><span>{labelFor(image.type)}</span> <span>{number(image.width, 0)} × {number(image.height, 0)}</span> <span>{bytes(image.size)}</span></p>
      </div>
      <Button variant="ghost" size="sm" onClick={onClear}>{label}</Button>
    </div>
  );
}

/** Drag the divider to see the same spot before and after. */
export function Compare({ before, after, alt = 'Image' }: { before: string; after: string; alt?: string }) {
  const [split, setSplit] = useState(50);
  return (
    <div className="compare">
      <div className="compare-stage">
        <img src={after} alt={`${alt}, after`} className="compare-img" />
        <div className="compare-before" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}>
          <img src={before} alt={`${alt}, before`} className="compare-img" />
        </div>
        <span className="compare-line" style={{ left: `${split}%` }} aria-hidden="true" />
        <span className="compare-tag compare-tag-before" aria-hidden="true">Before</span>
        <span className="compare-tag compare-tag-after" aria-hidden="true">After</span>
      </div>
      <input type="range" min={0} max={100} value={split} onChange={(e) => setSplit(Number(e.target.value))} className="slider compare-range" aria-label="Before and after divider" style={{ ['--pct' as string]: `${split}%` }} />
    </div>
  );
}
