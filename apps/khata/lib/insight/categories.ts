/**
 * What kind of spending was it.
 *
 * Rules over a lookup table, because merchant strings are never twice the same:
 * "SWIGGY", "Swiggy Instamart", "swiggy@ybl" and "SWIGGYLIMITED" all have to
 * reach Food. The user's own overrides sit on top and always win — a category
 * you have corrected is never re-guessed.
 */

import type { Txn } from '../ledger/types';
import { merchantKey } from '../parse/extract';

export const CATEGORIES = [
  'Food',
  'Groceries',
  'Transport',
  'Shopping',
  'Bills',
  'Rent',
  'Health',
  'Entertainment',
  'Travel',
  'Education',
  'Investment',
  'Transfer',
  'Income',
  'Fees',
  'Cash',
  'Other',
] as const;

export type Category = (typeof CATEGORIES)[number];

const RULES: Array<[RegExp, Category]> = [
  [/swiggy|zomato|dominos|pizza|mcdonald|kfc|starbucks|cafe|coffee|restaurant|eatery|biryani|barbeque|chaayos|dunkin|subway|burger/i, 'Food'],
  [/bigbasket|blinkit|zepto|instamart|dmart|grofers|jiomart|reliance ?fresh|more ?retail|spencer|nature.?s basket|licious|country ?delight/i, 'Groceries'],
  [/uber|ola|rapido|namma ?yatri|metro|irctc|redbus|petrol|fuel|indian ?oil|bharat ?petro|hp ?petro|shell|fastag|parking|blusmart/i, 'Transport'],
  [/amazon|flipkart|myntra|ajio|nykaa|meesho|tatacliq|croma|decathlon|ikea|lifestyle|shoppers ?stop|westside|zara|uniqlo|hm\b/i, 'Shopping'],
  [/airtel|jio|vodafone|\bvi\b|bsnl|electricity|\bbescom\b|\bmseb\b|\btneb\b|gas|water|broadband|act ?fibernet|hathway|tata ?play|dish ?tv|municipal|property ?tax/i, 'Bills'],
  [/\brent\b|nobroker|nestaway|housing|landlord|society ?maintenance|maintenance ?charge/i, 'Rent'],
  [/apollo|pharm|medplus|1mg|pharmeasy|netmeds|hospital|clinic|diagnostic|lab|doctor|practo|cult\.?fit|gym|fitness/i, 'Health'],
  [/netflix|spotify|prime ?video|hotstar|jiocinema|sonyliv|zee5|youtube ?premium|bookmyshow|pvr|inox|cinepolis|steam|playstation|xbox|nintendo/i, 'Entertainment'],
  [/makemytrip|goibibo|cleartrip|yatra|ixigo|airbnb|oyo|booking\.?com|indigo|vistara|air ?india|spicejet|akasa|hotel|resort/i, 'Travel'],
  [/udemy|coursera|unacademy|byju|vedantu|upgrad|school|college|university|tuition|course|scaler|masterclass/i, 'Education'],
  [/zerodha|groww|upstox|angel ?one|kuvera|coin|smallcase|mutual ?fund|\bsip\b|\bnps\b|\bppf\b|\belss\b|stock|nse|bse|policybazaar|\blic\b|insurance|premium/i, 'Investment'],
  [/salary|payroll|stipend|reimbursement|interest ?credit|dividend|refund/i, 'Income'],
  [/\bfee\b|\bcharges?\b|\bgst\b|penalty|late ?payment|interest ?charged|annual ?fee|renewal ?fee|convenience ?fee|surcharge|markup/i, 'Fees'],
];

/** Fee and charge language beats a merchant match — a Netflix late fee is a fee. */
const FEE_PATTERN = RULES[RULES.length - 1][0];

export type Overrides = Record<string, Category>;

export function categorise(txn: Txn, overrides: Overrides = {}): Category {
  const key = merchantKey(txn.merchant);
  if (key && overrides[key]) return overrides[key];

  const haystack = [
    txn.merchant ?? '',
    txn.sources.map((s) => s.subject).join(' '),
  ].join(' ');

  if (FEE_PATTERN.test(haystack)) return 'Fees';

  if (txn.method === 'atm') return 'Cash';

  for (const [pattern, category] of RULES) {
    if (pattern.test(haystack)) {
      // Income rules describe credits; applied to a debit they are meaningless.
      if (category === 'Income' && txn.direction === 'debit') continue;
      return category;
    }
  }

  if (txn.direction === 'credit') {
    return /\bself\b|own account|transfer/i.test(haystack) ? 'Transfer' : 'Income';
  }
  if (txn.method === 'netbanking' || /\bself\b|own account/i.test(haystack)) return 'Transfer';
  return 'Other';
}

/** Applies categories in place across a ledger. */
export function applyCategories(txns: Txn[], overrides: Overrides = {}): Txn[] {
  return txns.map((t) => ({
    ...t,
    category: t.edited?.category ?? categorise(t, overrides),
  }));
}
