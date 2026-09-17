'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Field, NumberField, Segmented, TextField } from '@/components/ui';
import ExportButton from '@/components/ExportButton';
import CurrencyPicker from '@/components/CurrencyPicker';
import { useApp, useToolActions } from '@/components/AppState';
import { Sheet, sheetToPng, sheetsToPdf, wrap } from '@/utils/docRender';
import { formatDate, fromIso, toIso, todayYmd } from '@/utils/dates';
import { money, number, type Currency } from '@/utils/format';
import { DocPreview, ItemsEditor, newItem, totals, useDraft, type LineItem } from './shared';

type Payment = 'Cash' | 'Card' | 'UPI' | 'Bank transfer' | 'Other';
interface ReceiptData { business: string; details: string; number: string; date: string; customer: string; items: LineItem[]; taxRate: string; payment: Payment; note: string }

/* A till roll: 80 mm wide at 96 px to the inch, as long as it needs to be. */
const W = 302;
const P = 20;
const MUTED = '#6E6E6A';

function layout(d: ReceiptData, currency: Currency): Sheet {
  const t = totals(d.items, d.taxRate);
  const ops: ((s: Sheet) => void)[] = [];
  let y = 40;
  const push = (op: (s: Sheet) => void) => ops.push(op);
  const center = W / 2;
  const dashed = () => { const at = y; push((s) => s.line(P, at, W - P, at, '#9A9A96', '3 3')); y += 20; };
  const pair = (label: string, value: string, bold = false, size = 11.5) => {
    const at = y;
    push((s) => { s.text(P, at, label, { size, weight: bold ? 750 : 400, fill: bold ? '#111111' : MUTED }); s.text(W - P, at, value, { size: bold ? size + 3 : size, weight: bold ? 800 : 600, anchor: 'end' }); });
    y += bold ? 24 : 18;
  };

  for (const line of wrap(d.business || 'Your business', W - P * 2, 17, 750)) { const at = y; push((s) => s.text(center, at, line, { size: 17, weight: 750, anchor: 'middle' })); y += 22; }
  for (const line of d.details.split('\n').flatMap((l) => (l.trim() ? wrap(l, W - P * 2, 10.5) : []))) { const at = y; push((s) => s.text(center, at, line, { size: 10.5, fill: MUTED, anchor: 'middle' })); y += 15; }
  y += 8;
  dashed();
  const date = fromIso(d.date);
  if (d.number) pair('Receipt no.', d.number);
  if (date) pair('Date', formatDate(date, 'short'));
  if (d.customer.trim()) pair('Customer', d.customer.trim());
  y += 2;
  dashed();

  for (const line of t.lines) {
    if (!line.description.trim() && !line.p) continue;
    for (const part of wrap(line.description || 'Item', W - P * 2, 12, 600)) { const at = y; push((s) => s.text(P, at, part, { size: 12, weight: 600 })); y += 16; }
    const at = y;
    push((s) => { s.text(P, at, `${number(line.q, 2, 'en-US')} × ${money(line.p, currency)}`, { size: 11, fill: MUTED }); s.text(W - P, at, money(line.amount, currency), { size: 12, weight: 600, anchor: 'end' }); });
    y += 24;
  }
  dashed();
  pair('Subtotal', money(t.subtotal, currency));
  if (t.rate) pair(`Tax (${number(t.rate, 2, 'en-US')}%)`, money(t.tax, currency));
  y += 4;
  pair('TOTAL', money(t.total, currency), true, 14);
  pair('Paid by', d.payment);
  y += 4;
  dashed();
  for (const line of d.note.trim() ? wrap(d.note, W - P * 2, 11.5, 500) : []) { const at = y; push((s) => s.text(center, at, line, { size: 11.5, weight: 500, anchor: 'middle' })); y += 17; }

  const sheet = new Sheet(W, y + 24);
  ops.forEach((op) => op(sheet));
  return sheet;
}

export default function Receipt() {
  const app = useApp();
  const [data, setData] = useDraft<ReceiptData>('receipt.draft', () => ({
    business: '', details: '', number: '0001', date: '', customer: '',
    items: [newItem('Coffee', '2', '180'), newItem('Croissant', '1', '220')], taxRate: '5', payment: 'UPI', note: 'Thank you! Come again.',
  }));
  const [, force] = useState(0);
  useEffect(() => {
    setData((d) => ({ ...d, date: d.date || toIso(todayYmd()) }));
    document.fonts?.ready.then(() => force((n) => n + 1));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof ReceiptData>(key: K) => (value: ReceiptData[K]) => setData((d) => ({ ...d, [key]: value }));
  const sheet = useMemo(() => layout(data, app.currency), [data, app.currency]);
  const t = totals(data.items, data.taxRate);
  useToolActions({ copy: () => money(t.total, app.currency) });
  const base = `receipt-${data.number.replace(/[^\w-]+/g, '') || 'draft'}-${data.date || toIso(todayYmd())}`;

  return (
    <div className="doc-tool doc-tool-narrow">
      <div className="doc-form no-print card stack">
        <div className="inline-head"><span className="label">Currency</span><CurrencyPicker /></div>
        <TextField label="Business name" value={data.business} onChange={set('business')} placeholder="Corner Café" />
        <Field label="Address, phone, tax number" htmlFor="rc-details"><textarea id="rc-details" className="textarea textarea-sm" rows={2} value={data.details} onChange={(e) => set('details')(e.target.value)} placeholder={'12 Market Road\n+91 98765 43210'} /></Field>
        <div className="grid-3">
          <TextField label="Receipt no." value={data.number} onChange={set('number')} />
          <Field label="Date" htmlFor="rc-date"><input id="rc-date" type="date" className="input" value={data.date} onChange={(e) => set('date')(e.target.value)} /></Field>
          <TextField label="Customer" value={data.customer} onChange={set('customer')} placeholder="Optional" />
        </div>
        <ItemsEditor items={data.items} onChange={set('items')} currency={app.currency} />
        <div className="grid-2">
          <NumberField label="Tax" value={data.taxRate} onChange={set('taxRate')} suffix="%" />
          <TextField label="Note" value={data.note} onChange={set('note')} />
        </div>
        <Segmented label="Paid by" value={data.payment} onChange={set('payment')} options={(['Cash', 'Card', 'UPI', 'Bank transfer', 'Other'] as Payment[]).map((p) => ({ id: p, label: p }))} wrap />
        <div className="doc-total"><span>Total</span><strong>{money(t.total, app.currency)}</strong></div>
        <div className="button-row">
          <ExportButton size="lg" label="Download PDF" filename={`${base}.pdf`} make={() => sheetsToPdf([layout(data, app.currency)], 'Receipt', 3)} />
          <ExportButton size="lg" variant="secondary" label="PNG" filename={`${base}.png`} make={() => sheetToPng(layout(data, app.currency))} />
          <Button size="lg" onClick={() => window.print()}>Print</Button>
        </div>
      </div>
      <DocPreview sheets={[sheet]} label="Receipt preview" />
    </div>
  );
}
