'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Field, NumberField, TextField } from '@/components/ui';
import ExportButton from '@/components/ExportButton';
import CurrencyPicker from '@/components/CurrencyPicker';
import { useApp, useToolActions } from '@/components/AppState';
import { Sheet, sheetsToPdf, wrap } from '@/utils/docRender';
import { formatDate, fromIso, toIso, todayYmd, addToDate } from '@/utils/dates';
import { money, number, type Currency } from '@/utils/format';
import { DocPreview, ItemsEditor, newItem, totals, useDraft, type LineItem } from './shared';

interface InvoiceData { from: string; to: string; number: string; date: string; due: string; items: LineItem[]; taxRate: string; notes: string }

const W = 794;
const H = 1123;
const M = 64;
const MUTED = '#6E6E6A';

function layout(d: InvoiceData, currency: Currency): Sheet[] {
  const t = totals(d.items, d.taxRate);
  const sheets: Sheet[] = [];
  let sheet = new Sheet(W, H);
  sheets.push(sheet);
  const date = fromIso(d.date);
  const due = fromIso(d.due);

  sheet.text(M, 104, 'Invoice', { size: 38, weight: 800, spacing: -1.2 });
  let ry = 78;
  for (const [label, value] of [['Invoice no.', d.number], ['Date', date ? formatDate(date, 'short') : ''], ['Due', due ? formatDate(due, 'short') : '']]) {
    if (!value) continue;
    sheet.text(W - M - 130, ry, label, { size: 12, fill: MUTED });
    sheet.text(W - M, ry, value, { size: 12, weight: 600, anchor: 'end' });
    ry += 20;
  }

  const party = (x: number, label: string, text: string) => {
    let y = 170;
    sheet.text(x, y, label.toUpperCase(), { size: 10, weight: 700, fill: MUTED, spacing: 1.4 });
    y += 22;
    text.split('\n').forEach((line, i) => {
      for (const part of wrap(line, 290, i === 0 ? 15 : 13, i === 0 ? 650 : 400)) {
        sheet.text(x, y, part, { size: i === 0 ? 15 : 13, weight: i === 0 ? 650 : 400, fill: i === 0 ? '#111111' : MUTED });
        y += i === 0 ? 22 : 19;
      }
    });
    return y;
  };
  let y = Math.max(party(M, 'From', d.from || 'Your name'), party(W / 2 + 10, 'Bill to', d.to || 'Client name')) + 28;

  const cols = { desc: M, qty: 500, price: 614, amount: W - M };
  const header = (at: number) => {
    sheet.line(M, at, W - M, at, '#111111', undefined, 1.5);
    const hy = at + 24;
    sheet.text(cols.desc, hy, 'DESCRIPTION', { size: 10, weight: 700, fill: MUTED, spacing: 1.2 });
    sheet.text(cols.qty, hy, 'QTY', { size: 10, weight: 700, fill: MUTED, spacing: 1.2, anchor: 'end' });
    sheet.text(cols.price, hy, 'PRICE', { size: 10, weight: 700, fill: MUTED, spacing: 1.2, anchor: 'end' });
    sheet.text(cols.amount, hy, 'AMOUNT', { size: 10, weight: 700, fill: MUTED, spacing: 1.2, anchor: 'end' });
    sheet.line(M, at + 38, W - M, at + 38);
    return at + 38;
  };
  y = header(y);

  for (const line of t.lines) {
    if (!line.description.trim() && !line.p) continue;
    const text = wrap(line.description || '—', 380, 13, 500);
    const rowH = text.length * 19 + 22;
    if (y + rowH > H - 96) {
      sheet = new Sheet(W, H);
      sheets.push(sheet);
      y = header(M);
    }
    text.forEach((part, i) => sheet.text(cols.desc, y + 25 + i * 19, part, { size: 13, weight: 500 }));
    sheet.text(cols.qty, y + 25, number(line.q, 2, 'en-US'), { size: 13, anchor: 'end' });
    sheet.text(cols.price, y + 25, money(line.p, currency), { size: 13, anchor: 'end' });
    sheet.text(cols.amount, y + 25, money(line.amount, currency), { size: 13, weight: 600, anchor: 'end' });
    y += rowH;
    sheet.line(M, y, W - M, y);
  }

  const notes = d.notes.trim() ? wrap(d.notes, 330, 12.5) : [];
  const needed = 130 + (notes.length ? notes.length * 18 + 30 : 0);
  if (y + needed > H - 70) {
    sheet = new Sheet(W, H);
    sheets.push(sheet);
    y = M;
  }
  let ty = y + 34;
  const totalRow = (label: string, value: string, strong = false) => {
    sheet.text(W - M - 230, ty, label, { size: strong ? 15 : 13, weight: strong ? 750 : 400, fill: strong ? '#111111' : MUTED });
    sheet.text(W - M, ty, value, { size: strong ? 20 : 13, weight: strong ? 800 : 600, anchor: 'end' });
    ty += strong ? 30 : 24;
  };
  totalRow('Subtotal', money(t.subtotal, currency));
  if (t.rate) totalRow(`Tax (${number(t.rate, 2, 'en-US')}%)`, money(t.tax, currency));
  sheet.line(W - M - 230, ty - 10, W - M, ty - 10, '#111111');
  ty += 8;
  totalRow('Total due', money(t.total, currency), true);

  if (notes.length) {
    let ny = y + 34;
    sheet.text(M, ny, 'NOTES', { size: 10, weight: 700, fill: MUTED, spacing: 1.4 });
    ny += 22;
    notes.forEach((line) => { sheet.text(M, ny, line, { size: 12.5, fill: MUTED }); ny += 18; });
  }

  if (sheets.length > 1) sheets.forEach((s, i) => s.text(W - M, H - 40, `Page ${i + 1} of ${sheets.length}`, { size: 11, fill: MUTED, anchor: 'end' }));
  return sheets;
}

export default function Invoice() {
  const app = useApp();
  const [data, setData] = useDraft<InvoiceData>('invoice.draft', () => ({
    from: '', to: '', number: 'INV-001', date: '', due: '',
    items: [newItem('Design work', '10', '1500'), newItem('Revisions', '2', '1200')], taxRate: '18', notes: 'Payment within 14 days. Thank you!',
  }));
  const [, force] = useState(0);
  useEffect(() => {
    setData((d) => ({ ...d, date: d.date || toIso(todayYmd()), due: d.due || toIso(addToDate(todayYmd(), 14, 'days')) }));
    document.fonts?.ready.then(() => force((n) => n + 1));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof InvoiceData>(key: K) => (value: InvoiceData[K]) => setData((d) => ({ ...d, [key]: value }));
  const sheets = useMemo(() => layout(data, app.currency), [data, app.currency]);
  const t = totals(data.items, data.taxRate);
  useToolActions({ copy: () => money(t.total, app.currency) });

  return (
    <div className="doc-tool">
      <div className="doc-form no-print card stack">
        <div className="inline-head"><span className="label">Currency</span><CurrencyPicker /></div>
        <div className="grid-2">
          <Field label="From" htmlFor="inv-from"><textarea id="inv-from" className="textarea textarea-sm" rows={4} placeholder={'Your name or business\nAddress\nEmail · GSTIN'} value={data.from} onChange={(e) => set('from')(e.target.value)} /></Field>
          <Field label="Bill to" htmlFor="inv-to"><textarea id="inv-to" className="textarea textarea-sm" rows={4} placeholder={'Client name\nAddress'} value={data.to} onChange={(e) => set('to')(e.target.value)} /></Field>
        </div>
        <div className="grid-3">
          <TextField label="Invoice no." value={data.number} onChange={set('number')} />
          <Field label="Date" htmlFor="inv-date"><input id="inv-date" type="date" className="input" value={data.date} onChange={(e) => set('date')(e.target.value)} /></Field>
          <Field label="Due" htmlFor="inv-due"><input id="inv-due" type="date" className="input" value={data.due} onChange={(e) => set('due')(e.target.value)} /></Field>
        </div>
        <ItemsEditor items={data.items} onChange={set('items')} currency={app.currency} />
        <NumberField label="Tax" value={data.taxRate} onChange={set('taxRate')} suffix="%" hint="GST, VAT or sales tax. 0 for none." />
        <Field label="Notes" htmlFor="inv-notes"><textarea id="inv-notes" className="textarea textarea-sm" rows={3} value={data.notes} onChange={(e) => set('notes')(e.target.value)} /></Field>
        <div className="doc-total"><span>Total due</span><strong>{money(t.total, app.currency)}</strong></div>
        <div className="button-row">
          <ExportButton size="lg" label="Download PDF" filename={() => `invoice-${data.number.replace(/[^\w-]+/g, '') || 'draft'}-${data.date || toIso(todayYmd())}.pdf`} make={() => sheetsToPdf(layout(data, app.currency), `Invoice ${data.number}`)} />
          <Button size="lg" onClick={() => window.print()}>Print</Button>
        </div>
        <p className="hint">Your details are kept in this browser for next time. Nothing is uploaded.</p>
      </div>
      <DocPreview sheets={sheets} label="Invoice preview" />
    </div>
  );
}
