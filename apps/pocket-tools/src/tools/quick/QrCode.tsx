'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Segmented, Slider, TextArea } from '@/components/ui';
import ExportButton from '@/components/ExportButton';
import { Button } from '@/components/ui';
import { useApp, useToolActions, useToolParams } from '@/components/AppState';
import { makeQr, qrCanvas, qrSvg, type Ecc } from '@/utils/qr';
import { copyImage } from '@/utils/clipboard';

const luminance = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};

export default function QrCode() {
  const { toast } = useApp();
  const [text, setText] = useState('https://');
  const [ecc, setEcc] = useState<Ecc>('M');
  const [size, setSize] = useState(1024);
  const [margin, setMargin] = useState(4);
  const [fg, setFg] = useState('#111111');
  const [bg, setBg] = useState('#FFFFFF');
  const preview = useRef<HTMLCanvasElement>(null);

  useToolParams((p) => { if (p.get('text')) setText(p.get('text')!); });

  const value = text.trim() === 'https://' ? '' : text;
  const qr = useMemo(() => (value ? makeQr(value, ecc) : null), [value, ecc]);
  const tooLong = !!value && !qr;
  const [l1, l2] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  const lowContrast = (l1 + 0.05) / (l2 + 0.05) < 3 || luminance(fg) > luminance(bg);

  useEffect(() => {
    const canvas = preview.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    if (!qr) { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }
    const src = qrCanvas(qr, 640, margin, fg, bg);
    canvas.width = src.width;
    canvas.height = src.height;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 0);
  }, [qr, margin, fg, bg]);

  const png = () => new Promise<Blob | null>((resolve) => (qr ? qrCanvas(qr, size, margin, fg, bg).toBlob((b) => resolve(b), 'image/png') : resolve(null)));
  useToolActions({ copy: () => value || null });

  return (
    <div className="qr-tool">
      <div className="stack">
        <TextArea label="Link or text" value={text} onChange={setText} rows={4} placeholder="https://example.com, a Wi-Fi password, a phone number…" autoFocus />
        {tooLong && <p className="notice notice-error">That’s too long for a QR code at this error correction. Try less text, or choose L.</p>}
        <Segmented label="Error correction" value={ecc} onChange={setEcc} options={[{ id: 'L', label: 'L · 7%' }, { id: 'M', label: 'M · 15%' }, { id: 'Q', label: 'Q · 25%' }, { id: 'H', label: 'H · 30%' }]} wrap />
        <p className="hint">Higher correction still scans when part of the code is damaged or covered — at the cost of a denser code.</p>
        <Slider label="Download size" min={256} max={2048} step={64} value={size} onChange={setSize} format={(v) => `${v} px`} />
        <Slider label="Margin" min={0} max={10} value={margin} onChange={setMargin} format={(v) => `${v} modules`} />
        <div className="grid-2 grid-keep">
          <label className="color-field"><span className="label">Code colour</span><span className="color-pick"><input type="color" value={fg} onChange={(e) => setFg(e.target.value.toUpperCase())} /><code>{fg}</code></span></label>
          <label className="color-field"><span className="label">Background</span><span className="color-pick"><input type="color" value={bg} onChange={(e) => setBg(e.target.value.toUpperCase())} /><code>{bg}</code></span></label>
        </div>
        {lowContrast && <p className="notice notice-error">Scanners need a dark code on a light background with strong contrast. This may not scan.</p>}
      </div>
      <section className="qr-preview" aria-live="polite">
        <div className="qr-frame">
          {qr ? <canvas ref={preview} className="qr-canvas" role="img" aria-label={`QR code for ${value}`} /> : <p className="qr-empty">Type a link or some text to make a code.</p>}
        </div>
        <div className="result-actions">
          <ExportButton label="Download PNG" disabled={!qr} filename="qr-code.png" make={png} />
          <ExportButton variant="secondary" label="SVG" disabled={!qr} filename="qr-code.svg" make={() => (qr ? new Blob([qrSvg(qr, margin, fg, bg)], { type: 'image/svg+xml' }) : null)} />
          <Button variant="ghost" disabled={!qr} onClick={async () => { const b = await png(); toast(b && (await copyImage(b)) ? 'Copied image' : 'Your browser won’t copy images. Download it instead.'); }}>Copy image</Button>
        </div>
      </section>
    </div>
  );
}
