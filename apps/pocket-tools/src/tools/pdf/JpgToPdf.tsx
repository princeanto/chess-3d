'use client';

import { useEffect, useRef, useState } from 'react';
import FileDrop from '@/components/FileDrop';
import ExportButton from '@/components/ExportButton';
import { Button, Notice, Segmented } from '@/components/ui';
import { useToolActions } from '@/components/AppState';
import { fileToJpeg, FriendlyError, IMAGE_ACCEPT, openImage, release, type LoadedImage } from '@/utils/image';
import { buildPdf, fitOnPage, PAGE_SIZES, type PdfPage } from '@/utils/pdf';
import { dated } from '@/utils/download';
import { bytes } from '@/utils/format';

type Size = 'a4' | 'letter' | 'fit';
type Orientation = 'auto' | 'portrait' | 'landscape';
type Margin = 'none' | 'small' | 'normal';
const MARGIN: Record<Margin, number> = { none: 0, small: 18, normal: 36 };

export default function JpgToPdf() {
  const [images, setImages] = useState<LoadedImage[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [size, setSize] = useState<Size>('a4');
  const [orientation, setOrientation] = useState<Orientation>('auto');
  const [margin, setMargin] = useState<Margin>('small');
  const [dragging, setDragging] = useState<number | null>(null);
  const all = useRef<LoadedImage[]>([]);
  all.current = images;
  useEffect(() => () => all.current.forEach(release), []);

  const add = async (files: File[]) => {
    const problems: string[] = [];
    const opened: LoadedImage[] = [];
    for (const file of files.slice(0, 60)) {
      try { opened.push(await openImage(file)); } catch (e) { problems.push(`${file.name}: ${e instanceof FriendlyError ? e.message : 'couldn’t be opened.'}`); }
    }
    setErrors(problems);
    setImages((list) => [...list, ...opened]);
  };
  const move = (from: number, to: number) => setImages((list) => {
    if (to < 0 || to >= list.length) return list;
    const next = list.slice();
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  });
  const remove = (i: number) => setImages((list) => { release(list[i]); return list.filter((_, k) => k !== i); });

  const make = async () => {
    const pages: PdfPage[] = [];
    for (const img of images) {
      const jpeg = await fileToJpeg(img.file, 2480, 0.88);
      const m = MARGIN[margin];
      if (size === 'fit') {
        // A page the shape of the photo: 96 pixels to the inch, capped at PDF's page limit.
        const k = Math.min(0.75, 14000 / Math.max(jpeg.width, jpeg.height));
        const w = jpeg.width * k + m * 2;
        const h = jpeg.height * k + m * 2;
        pages.push({ width: w, height: h, images: [{ jpeg: jpeg.bytes, width: jpeg.width, height: jpeg.height, x: m, y: m, w: jpeg.width * k, h: jpeg.height * k }] });
      } else {
        const paper = PAGE_SIZES[size];
        const landscape = orientation === 'landscape' || (orientation === 'auto' && jpeg.width > jpeg.height);
        const pw = landscape ? paper.h : paper.w;
        const ph = landscape ? paper.w : paper.h;
        const place = fitOnPage(jpeg.width, jpeg.height, pw, ph, m);
        pages.push({ width: pw, height: ph, images: [{ jpeg: jpeg.bytes, width: jpeg.width, height: jpeg.height, ...place }] });
      }
    }
    return new Blob([buildPdf(pages, 'Images') as BlobPart], { type: 'application/pdf' });
  };
  useToolActions({});

  return (
    <div className="stack">
      <FileDrop accept={IMAGE_ACCEPT} multiple onFiles={add} compact={images.length > 0} title={images.length ? 'Add more images' : 'Drop photos to turn into a PDF'}>
        <label className="camera">
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { const files = [...(e.target.files ?? [])]; if (files.length) add(files); e.target.value = ''; }} />
          <span className="btn btn-secondary btn-sm">📷 Take a photo</span>
        </label>
      </FileDrop>
      {errors.map((e) => <Notice key={e} tone="error">{e}</Notice>)}
      {images.length > 0 && (
        <>
          <div className="card options-row">
            <Segmented label="Page size" value={size} onChange={setSize} options={[{ id: 'a4', label: 'A4' }, { id: 'letter', label: 'Letter' }, { id: 'fit', label: 'Original size' }]} />
            {size !== 'fit' && <Segmented label="Orientation" value={orientation} onChange={setOrientation} options={[{ id: 'auto', label: 'Auto' }, { id: 'portrait', label: 'Portrait' }, { id: 'landscape', label: 'Landscape' }]} />}
            <Segmented label="Margin" value={margin} onChange={setMargin} options={[{ id: 'none', label: 'None' }, { id: 'small', label: 'Small' }, { id: 'normal', label: 'Normal' }]} />
          </div>
          <p className="hint">Drag to reorder, or use the arrows. Page 1 is first.</p>
          <ol className="pdf-pages">
            {images.map((img, i) => (
              <li
                key={img.url}
                className={`pdf-page${dragging === i ? ' is-dragging' : ''}`}
                draggable
                onDragStart={() => setDragging(i)}
                onDragOver={(e) => { e.preventDefault(); if (dragging !== null && dragging !== i) { move(dragging, i); setDragging(i); } }}
                onDragEnd={() => setDragging(null)}
              >
                <span className="pdf-page-number">{i + 1}</span>
                <img src={img.url} alt={`Page ${i + 1}: ${img.name}`} />
                <p className="pdf-page-name" title={img.name}>{img.name}</p>
                <p className="pdf-page-meta">{bytes(img.size)}</p>
                <div className="pdf-page-actions">
                  <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={`Move ${img.name} earlier`}>←</button>
                  <button type="button" onClick={() => move(i, i + 1)} disabled={i === images.length - 1} aria-label={`Move ${img.name} later`}>→</button>
                  <button type="button" onClick={() => remove(i)} aria-label={`Remove ${img.name}`}>✕</button>
                </div>
              </li>
            ))}
          </ol>
          <div className="button-row">
            <ExportButton size="lg" label={`Create PDF · ${images.length} ${images.length === 1 ? 'page' : 'pages'}`} filename={() => dated('images', 'pdf')} make={make} />
            <Button variant="ghost" onClick={() => { images.forEach(release); setImages([]); }}>Start over</Button>
          </div>
        </>
      )}
    </div>
  );
}
