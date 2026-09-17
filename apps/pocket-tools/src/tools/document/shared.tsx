'use client';

/** Line items, their totals, and the document preview shared by receipts and invoices. */

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui';
import { currencyInfo, money, parseAmount, type Currency } from '@/utils/format';
import { load, save } from '@/utils/storage';
import type { Sheet } from '@/utils/docRender';

export interface LineItem { id: string; description: string; qty: string; price: string }

let n = 0;
export const newItem = (description = '', qty = '1', price = ''): LineItem => ({ id: `i${Date.now().toString(36)}${(n++).toString(36)}`, description, qty, price });

export function totals(items: LineItem[], taxRate: string) {
  const lines = items.map((i) => {
    const qty = parseAmount(i.qty) ?? (i.qty.trim() ? 0 : 1);
    const price = parseAmount(i.price) ?? 0;
    return { ...i, q: qty, p: price, amount: qty * price };
  });
  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const rate = parseAmount(taxRate) ?? 0;
  const tax = subtotal * (rate / 100);
  return { lines, subtotal, rate, tax, total: subtotal + tax };
}

export function ItemsEditor({ items, onChange, currency }: { items: LineItem[]; onChange: (items: LineItem[]) => void; currency: Currency }) {
  const set = (id: string, key: keyof LineItem, value: string) => onChange(items.map((i) => (i.id === id ? { ...i, [key]: value } : i)));
  const t = totals(items, '0');
  return (
    <div className="items">
      <div className="items-head" aria-hidden="true"><span>Item</span><span>Qty</span><span>Price</span><span /></div>
      {items.map((item, index) => (
        <div key={item.id} className="item-row">
          <input className="input" aria-label={`Item ${index + 1} description`} placeholder="Description" value={item.description} onChange={(e) => set(item.id, 'description', e.target.value)} />
          <input className="input" aria-label={`Item ${index + 1} quantity`} inputMode="decimal" value={item.qty} onChange={(e) => set(item.id, 'qty', e.target.value)} />
          <div className="affix">
            <span className="affix-part" aria-hidden="true">{currencyInfo(currency).symbol}</span>
            <input className="input" aria-label={`Item ${index + 1} price`} inputMode="decimal" placeholder="0" value={item.price} onChange={(e) => set(item.id, 'price', e.target.value)} />
          </div>
          <button type="button" className="item-remove" aria-label={`Remove item ${index + 1}`} onClick={() => onChange(items.length > 1 ? items.filter((i) => i.id !== item.id) : [newItem()])}>✕</button>
          <span className="item-amount">{money(t.lines[index].amount, currency)}</span>
        </div>
      ))}
      <Button variant="ghost" size="sm" onClick={() => onChange([...items, newItem()])}>+ Add item</Button>
    </div>
  );
}

/** Form state that survives a reload, so your business details are there next time. */
export function useDraft<T>(key: string, initial: () => T): [T, (update: T | ((t: T) => T)) => void, boolean] {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);
  const timer = useRef<number>();
  useEffect(() => {
    const kept = load<T | null>(key, null);
    if (kept) setValue((v) => ({ ...v, ...kept }));
    setLoaded(true);
  }, [key]);
  useEffect(() => {
    if (!loaded) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => save(key, value), 400);
    return () => window.clearTimeout(timer.current);
  }, [key, value, loaded]);
  return [value, setValue, loaded];
}

export function DocPreview({ sheets, label }: { sheets: Sheet[]; label: string }) {
  return (
    <section className="doc-preview print-area" aria-label={label}>
      {sheets.map((sheet, i) => (
        <div key={i} className="doc-page" style={{ aspectRatio: `${sheet.width} / ${sheet.height}`, maxWidth: sheet.width }} dangerouslySetInnerHTML={{ __html: sheet.svg() }} />
      ))}
    </section>
  );
}
