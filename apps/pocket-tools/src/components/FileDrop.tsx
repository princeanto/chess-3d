'use client';

/**
 * Where files come in: drop them, choose them, or paste an image straight from
 * the clipboard. The line underneath is the promise — they stay here.
 */

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

export default function FileDrop({ onFiles, accept, multiple = false, title, compact = false, children }: {
  onFiles: (files: File[]) => void;
  accept: string;
  multiple?: boolean;
  title?: string;
  compact?: boolean;
  children?: ReactNode;
}) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT')) return;
      const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'));
      if (files.length) {
        e.preventDefault();
        onFiles(multiple ? files : files.slice(0, 1));
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [onFiles, multiple]);

  return (
    <div
      className={`drop${over ? ' is-over' : ''}${compact ? ' drop-compact' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const files = [...e.dataTransfer.files];
        if (files.length) onFiles(multiple ? files : files.slice(0, 1));
      }}
    >
      <input
        ref={input}
        id={id}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          if (files.length) onFiles(files);
          e.target.value = '';
        }}
      />
      <svg className="drop-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M4 15v3.5A1.5 1.5 0 005.5 20h13a1.5 1.5 0 001.5-1.5V15" /></svg>
      <p className="drop-title">{title ?? (multiple ? 'Drop images here' : 'Drop an image here')}</p>
      <p className="drop-sub">
        or <label htmlFor={id} className="drop-choose">choose {multiple ? 'files' : 'a file'}</label>, or paste
      </p>
      {children}
      <p className="drop-private">Your files stay on your device.</p>
    </div>
  );
}
