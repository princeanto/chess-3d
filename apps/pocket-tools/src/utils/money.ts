/**
 * The money maths. Every function returns exact values; rounding happens only
 * when a number is shown, so a split that shows ₹900.00 each still adds back up
 * to the bill.
 */

export function percentOf(percent: number, of: number): number {
  return (percent / 100) * of;
}

export function whatPercent(part: number, whole: number): number | null {
  return whole === 0 ? null : (part / whole) * 100;
}

export function percentChange(from: number, to: number): number | null {
  return from === 0 ? null : ((to - from) / Math.abs(from)) * 100;
}

export interface DiscountResult { original: number; discount: number; afterDiscount: number; tax: number; final: number }

export function discount(price: number, percent: number, taxPercent = 0): DiscountResult {
  const off = price * (percent / 100);
  const afterDiscount = price - off;
  const tax = afterDiscount * (taxPercent / 100);
  return { original: price, discount: off, afterDiscount, tax, final: afterDiscount + tax };
}

export interface TipResult { tip: number; total: number; perPerson: number; tipPerPerson: number }

export function tip(bill: number, percent: number, people = 1): TipResult {
  const t = bill * (percent / 100);
  const n = Math.max(1, Math.floor(people));
  return { tip: t, total: bill + t, perPerson: (bill + t) / n, tipPerPerson: t / n };
}

export interface SplitPerson { name: string; amount: number }
export interface SplitResult { total: number; tip: number; grand: number; each: number; people: SplitPerson[]; error?: string }

/**
 * Equal split: everyone pays the same share of bill plus tip.
 *
 * Unequal split: each person names what they had. Anything not claimed — shared
 * starters, the service charge — is split equally, and the tip follows what
 * each person's share came to, so the bigger order carries more of it.
 */
export function splitBill(total: number, people: number, tipPercent: number, own?: number[]): SplitResult {
  const n = Math.max(1, Math.floor(people));
  const t = total * (tipPercent / 100);
  const grand = total + t;
  if (!own) {
    return { total, tip: t, grand, each: grand / n, people: Array.from({ length: n }, (_, i) => ({ name: `Person ${i + 1}`, amount: grand / n })) };
  }
  const claims = Array.from({ length: n }, (_, i) => Math.max(0, own[i] ?? 0));
  const claimed = claims.reduce((a, b) => a + b, 0);
  if (claimed - total > 0.005) {
    return { total, tip: t, grand, each: grand / n, people: [], error: 'Individual amounts add up to more than the bill.' };
  }
  const shared = (total - claimed) / n;
  const amounts = claims.map((c) => {
    const before = c + shared;
    return total === 0 ? 0 : before + t * (before / total);
  });
  return { total, tip: t, grand, each: grand / n, people: amounts.map((amount, i) => ({ name: `Person ${i + 1}`, amount })) };
}

export interface GstResult { base: number; gst: number; total: number; cgst: number; sgst: number }

/** Add GST to a price, or take it out of a price that already includes it. */
export function gst(amount: number, rate: number, mode: 'add' | 'remove'): GstResult {
  const base = mode === 'add' ? amount : amount / (1 + rate / 100);
  const tax = mode === 'add' ? amount * (rate / 100) : amount - base;
  return { base, gst: tax, total: base + tax, cgst: tax / 2, sgst: tax / 2 };
}

export interface EmiYear { year: number; principal: number; interest: number; balance: number }
export interface EmiResult { emi: number; totalInterest: number; totalPayment: number; schedule: EmiYear[] }

/** The standard reducing-balance EMI, with a year-by-year breakdown. */
export function emi(principal: number, annualRate: number, months: number): EmiResult {
  const n = Math.max(1, Math.round(months));
  const r = annualRate / 12 / 100;
  const payment = r === 0 ? principal / n : (principal * r * (1 + r) ** n) / ((1 + r) ** n - 1);
  const schedule: EmiYear[] = [];
  let balance = principal;
  for (let m = 1; m <= n; m += 1) {
    const interest = balance * r;
    const toPrincipal = Math.min(balance, payment - interest);
    balance = Math.max(0, balance - toPrincipal);
    const year = Math.ceil(m / 12);
    const row = schedule[year - 1] ?? (schedule[year - 1] = { year, principal: 0, interest: 0, balance: 0 });
    row.principal += toPrincipal;
    row.interest += interest;
    row.balance = balance;
  }
  const totalPayment = payment * n;
  return { emi: payment, totalInterest: totalPayment - principal, totalPayment, schedule };
}
