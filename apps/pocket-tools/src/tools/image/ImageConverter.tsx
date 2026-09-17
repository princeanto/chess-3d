'use client';

import { useEffect, useRef, useState } from 'react';
import FileDrop from '@/components/FileDrop';
import ExportButton from '@/components/ExportButton';
import { Button, Notice, Segmented, Slider } from '@/components/ui';
import { useApp, useToolActions } from '@/components/AppState';
import { extFor, FriendlyError, IMAGE_ACCEPT, labelFor, openImage, OUTPUT_TYPES, release, runImageJob, type LoadedImage, type OutputType } from '@/utils/image';
import { bytes } from '@/utils/format';
import { downloadBlob, renamed } from '@/utils/download';

interface Item { image: LoadedImage; result?: Blob; error?: string }

export default function ImageConverter() {
  const { toast } = useApp();
  const [items, setItems] = useState<Item[]>([]);
  const [type, setType] = useState<OutputType>('image/jpeg');
  const [quality, setQuality] = useState(90);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const all = useRef<Item[]>([]);
  all.current = items;

  useEffect(() => () => all.current.forEach((i) => release(i.image)), []);
  useEffect(() => { setItems((list) => list.map((i) => ({ image: i.image }))); }, [type, quality]);

  const add = async (files: File[]) => {
    const problems: string[] = [];
    const opened: Item[] = [];
    for (const file of files.slice(0, 30)) {
      try { opened.push({ image: await openImage(file) }); } catch (e) { problems.push(`${file.name}: ${e instanceof FriendlyError ? e.message : 'couldn’t be opened.'}`); }
    }
    setErrors(problems);
    setItems((list) => [...list, ...opened]);
  };

  const convert = async () => {
    if (!items.length || busy) return;
    setBusy(true);
    const next: Item[] = [];
    for (const item of items) {
      try {
        const r = await runImageJob(item.image.file, { kind: 'quality', type, quality: quality / 100 });
        next.push({ image: item.image, result: r.blob });
      } catch {
        next.push({ image: item.image, error: 'Couldn’t convert this one.' });
      }
      setItems([...next, ...items.slice(next.length)]);
    }
    setBusy(false);
    toast(`Done. ${next.filter((i) => i.result).length} converted.`);
  };

  const downloadAll = () => {
    items.forEach((item, i) => { if (item.result) window.setTimeout(() => downloadBlob(item.result!, renamed(item.image.name, '', extFor(type))), i * 250); });
  };
  const remove = (index: number) => setItems((list) => { release(list[index].image); return list.filter((_, i) => i !== index); });
  useToolActions({ run: convert });

  const done = items.length > 0 && items.every((i) => i.result || i.error);

  return (
    <div className="stack">
      <FileDrop accept={IMAGE_ACCEPT} multiple onFiles={add} compact={items.length > 0} title={items.length ? 'Add more images' : 'Drop images to convert'} />
      {errors.map((e) => <Notice key={e} tone="error">{e}</Notice>)}
      {items.length > 0 && (
        <>
          <div className="card options-row">
            <Segmented label="Convert to" value={type} onChange={setType} options={OUTPUT_TYPES} />
            {type !== 'image/png' ? <div className="grow"><Slider label="Quality" min={40} max={100} value={quality} onChange={setQuality} format={(v) => `${v}%`} /></div> : <p className="hint">PNG is lossless: no quality setting, larger files.</p>}
          </div>
          {type === 'image/jpeg' && <p className="hint">JPG has no transparency; transparent areas become white.</p>}
          <ul className="file-list">
            {items.map((item, i) => (
              <li key={item.image.url} className="file-row">
                <img src={item.image.url} alt="" />
                <div className="file-row-text">
                  <p className="file-row-name">{item.image.name}</p>
                  <p className="file-row-meta">
                    {labelFor(item.image.type)} · {bytes(item.image.size)}
                    {item.result && <> → <strong>{labelFor(type)} · {bytes(item.result.size)}</strong></>}
                    {item.error && <> · {item.error}</>}
                  </p>
                </div>
                {item.result
                  ? <ExportButton variant="secondary" size="sm" label="Download" filename={renamed(item.image.name, '', extFor(type))} make={() => item.result!} />
                  : <Button variant="ghost" size="sm" onClick={() => remove(i)} disabled={busy} aria-label={`Remove ${item.image.name}`}>Remove</Button>}
              </li>
            ))}
          </ul>
          <div className="button-row">
            <Button variant="primary" size="lg" onClick={convert} disabled={busy}>{busy ? 'Converting…' : `Convert ${items.length > 1 ? `${items.length} images` : ''} to ${labelFor(type)}`}</Button>
            {done && items.filter((i) => i.result).length > 1 && <Button size="lg" onClick={downloadAll}>Download all</Button>}
          </div>
        </>
      )}
    </div>
  );
}
