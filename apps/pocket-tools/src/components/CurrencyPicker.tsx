'use client';

import { CURRENCIES } from '@/utils/format';
import { useApp } from './AppState';
import { Segmented } from './ui';

/** ₹ $ € £ — remembered for every money tool on this device. */
export default function CurrencyPicker() {
  const { currency, setCurrency } = useApp();
  return (
    <Segmented
      label="Currency"
      hideLabel
      value={currency}
      onChange={setCurrency}
      options={CURRENCIES.map((c) => ({ id: c.id, label: <span title={c.id}>{c.symbol}</span> }))}
    />
  );
}
