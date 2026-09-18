'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, Notice } from '@/components/ui';
import ExportButton from '@/components/ExportButton';
import { useToolActions } from '@/components/AppState';
import { bytes as formatBytes, number } from '@/utils/format';
import { dated } from '@/utils/download';
import { merge, normalized, openPdf, PdfProblem } from '@/utils/pdfOps';
import { PdfDrop, PDF_ACCEPT } from './shared';
import FileDrop from '@/components/FileDrop';

interface Item { name: string; size: number; pages: number; bytes: Uint8Array }

export default function MergePdf() {
  const [items, setItems] = useState<Item[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const locked = useRef<{ file: File; index: number } | null>(null);

  const add = async (files: File[]) => {
    setBusy(true);
    const problems: string[] = [];
    const opened: Item[] = [];
    for (const file of files.slice(0, 40)) {
      try {
        const doc = await openPdf(new Uint8Array(await file.arrayBuffer()));
        opened.push({ name: file.name, size: file.size, pages: doc.getPageCount(), bytes: await normalized(doc) });
      } catch (e) {
        const problem = e instanceof PdfProblem ? e : null;
        problems.push(`${file.name}: ${problem?.kind === 'encrypted' ? 'password-protected — unlock it first.' : problem?.message ?? 'couldn’t be opened.'}`);
      }
    }
    setErrors(problems);
    setItems((list) => [...list, ...opened]);
    setBusy(false);
  };

  const move = (from: number, to: number) => setItems((list) => {
    if (to < 0 || to >= list.length) return list;
    const next = list.slice();
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  });

  const totalPages = items.reduce((n, i) => n + i.pages, 0);
  const totalSize = items.reduce((n, i) => n + i.size, 0);
  const make = () => merge(items.map((i) => i.bytes)).then((b) => new Blob([b as BlobPart], { type: 'application/pdf' }));
  useToolActions({});

  return (
    <div className="stack">
      {items.length === 0
        ? <PdfDrop multiple onFiles={add} busy={busy} title="Drop the PDFs you want to combine" />
        : <FileDrop accept={PDF_ACCEPT} multiple onFiles={add} compact title="Add more PDFs" />}
      {errors.map((e) => <Notice key={e} tone="error">{e}</Notice>)}

      {items.length > 0 && (
        <>
          <p className="hint">Drag to reorder — the first file’s pages come first.</p>
          <ol className="merge-list">
            {items.map((item, i) => (
              <li
                key={`${item.name}-${i}`}
                className={`merge-item${dragging === i ? ' is-dragging' : ''}`}
                draggable
                onDragStart={() => setDragging(i)}
                onDragOver={(e) => { e.preventDefault(); if (dragging !== null && dragging !== i) { move(dragging, i); setDragging(i); } }}
                onDragEnd={() => setDragging(null)}
              >
                <span className="merge-order">{i + 1}</span>
                <span className="pdf-badge" aria-hidden="true">PDF</span>
                <span className="merge-text">
                  <span className="file-row-name">{item.name}</span>
                  <span className="file-row-meta">{number(item.pages, 0)} {item.pages === 1 ? 'page' : 'pages'} · {formatBytes(item.size)}</span>
                </span>
                <span className="pdf-page-actions">
                  <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={`Move ${item.name} up`}>↑</button>
                  <button type="button" onClick={() => move(i, i + 1)} disabled={i === items.length - 1} aria-label={`Move ${item.name} down`}>↓</button>
                  <button type="button" onClick={() => setItems((l) => l.filter((_, k) => k !== i))} aria-label={`Remove ${item.name}`}>✕</button>
                </span>
              </li>
            ))}
          </ol>
          <div className="button-row">
            <ExportButton size="lg" label={`Merge ${items.length} ${items.length === 1 ? 'file' : 'files'} · ${number(totalPages, 0)} pages`} disabled={items.length < 2} filename={() => dated('merged', 'pdf')} make={make} />
            <Button size="lg" variant="ghost" onClick={() => setItems([])}>Clear</Button>
          </div>
          {items.length < 2 && <p className="hint">Add at least two PDFs to merge. Total so far: {formatBytes(totalSize)}.</p>}
        </>
      )}
    </div>
  );
}
