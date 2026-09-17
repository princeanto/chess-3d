'use client';

import { useMemo, useState } from 'react';
import { Columns, NumberField, Segmented } from '@/components/ui';
import { ResultHero, ResultRows } from '@/components/ResultCard';
import CurrencyPicker from '@/components/CurrencyPicker';
import ExportButton from '@/components/ExportButton';
import { useApp, useToolActions, useToolParams } from '@/components/AppState';
import { currencyInfo, money, number, parseAmount } from '@/utils/format';
import { emi } from '@/utils/money';
import { csv } from '@/utils/download';

export default function Emi() {
  const app = useApp();
  const [amount, setAmount] = useState('');
  const [rate, setRate] = useState('8.5');
  const [tenure, setTenure] = useState('20');
  const [unit, setUnit] = useState<'years' | 'months'>('years');

  useToolParams((p) => {
    if (p.get('amount')) setAmount(p.get('amount')!);
    if (p.get('rate')) setRate(p.get('rate')!);
    if (p.get('months')) {
      const m = Number(p.get('months'));
      if (m % 12 === 0) { setTenure(String(m / 12)); setUnit('years'); } else { setTenure(String(m)); setUnit('months'); }
    }
  });

  const cur = app.currency;
  const principal = parseAmount(amount);
  const annual = parseAmount(rate);
  const t = parseAmount(tenure);
  const months = t !== null ? Math.round(unit === 'years' ? t * 12 : t) : null;
  const r = useMemo(() => (principal && principal > 0 && annual !== null && annual >= 0 && months && months > 0 && months <= 600 ? emi(principal, annual, months) : null), [principal, annual, months]);
  useToolActions({ copy: () => (r ? money(r.emi, cur) : null) });

  const principalShare = r ? (principal! / r.totalPayment) * 100 : 0;

  return (
    <Columns
      inputs={
        <>
          <div className="inline-head"><span className="label">Currency</span><CurrencyPicker /></div>
          <NumberField label="Loan amount" value={amount} onChange={setAmount} prefix={currencyInfo(cur).symbol} placeholder="20 lakh" hint="20,00,000 · 20 lakh · 2000000" autoFocus />
          <NumberField label="Interest rate (per year)" value={rate} onChange={setRate} suffix="%" />
          <div className="grid-2 grid-keep">
            <NumberField label="Tenure" value={tenure} onChange={setTenure} />
            <Segmented label="In" value={unit} onChange={setUnit} options={[{ id: 'years', label: 'Years' }, { id: 'months', label: 'Months' }]} />
          </div>
        </>
      }
      result={
        r ? (
          <>
            <ResultHero label="Monthly EMI" value={money(r.emi, cur)} caption={`${months} monthly payments`} copy={money(r.emi, cur)} />
            <section className="breakdown" aria-label="Principal and interest">
              <div className="breakdown-bar" role="img" aria-label={`${number(principalShare, 0)}% principal, ${number(100 - principalShare, 0)}% interest`}>
                <span className="breakdown-principal" style={{ width: `${principalShare}%` }} />
                <span className="breakdown-interest" style={{ width: `${100 - principalShare}%` }} />
              </div>
              <div className="breakdown-legend">
                <span><i className="breakdown-principal" /> Principal {number(principalShare, 0)}%</span>
                <span><i className="breakdown-interest" /> Interest {number(100 - principalShare, 0)}%</span>
              </div>
            </section>
            <ResultRows rows={[
              { label: 'Principal', value: money(principal!, cur) },
              { label: 'Total interest', value: money(r.totalInterest, cur), copy: money(r.totalInterest, cur) },
              { label: 'Total payment', value: money(r.totalPayment, cur), strong: true, copy: money(r.totalPayment, cur) },
            ]} />
            <details className="schedule">
              <summary>Year-by-year breakdown</summary>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Year</th><th>Principal</th><th>Interest</th><th>Balance</th></tr></thead>
                  <tbody>
                    {r.schedule.map((y) => (
                      <tr key={y.year}><td>{y.year}</td><td>{money(y.principal, cur)}</td><td>{money(y.interest, cur)}</td><td>{money(y.balance, cur)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ExportButton variant="secondary" size="sm" label="Download CSV" filename="emi-schedule.csv" make={() => new Blob([csv([['Year', 'Principal', 'Interest', 'Balance'], ...r.schedule.map((y) => [y.year, y.principal.toFixed(2), y.interest.toFixed(2), y.balance.toFixed(2)])])], { type: 'text/csv' })} />
            </details>
          </>
        ) : <ResultHero tone="muted" label="Monthly EMI" value="—" caption={months !== null && months > 600 ? 'Tenure can be at most 50 years.' : 'Add the loan amount, rate and tenure.'} />
      }
    />
  );
}
