/**
 * Who sent it, and what that usually means.
 *
 * Matching is on the domain rather than the exact address, because banks rotate
 * the local part constantly — `alerts@`, `noreply@`, `donotreply.sbiatm@` — and
 * a registry of exact addresses would be stale within a month. Where the local
 * part genuinely carries meaning (a statements mailbox versus an alerts one) it
 * is matched as a hint, not as the identity.
 *
 * Nothing here is authoritative. The sender suggests an issuer and a likely kind
 * of mail; the body decides what actually happened.
 */

import type { Account, MessageKind } from '../ledger/types';

export interface Sender {
  issuer: string;
  type: Account['type'];
  /** What mail from here usually is. The body can and does override it. */
  kind: MessageKind;
}

interface Rule {
  domain: RegExp;
  issuer: string;
  type: Account['type'];
  kind: MessageKind;
  /** Refines the kind when the local part says so. */
  local?: Array<[RegExp, MessageKind]>;
}

const STATEMENTY: Array<[RegExp, MessageKind]> = [
  [/statement|estmt|smartstatement|bill/i, 'bill'],
  [/mandate|enach|autopay|si_|standinginstruction/i, 'mandate'],
];

const RULES: Rule[] = [
  // ---- banks and card issuers ----
  { domain: /(^|\.)hdfcbank\.(net|com)$/i, issuer: 'HDFC', type: 'bank', kind: 'bank-alert', local: STATEMENTY },
  { domain: /(^|\.)icicibank\.com$/i, issuer: 'ICICI', type: 'bank', kind: 'bank-alert', local: [...STATEMENTY, [/credit_?cards?/i, 'bill']] },
  { domain: /(^|\.)sbi\.co\.in$|(^|\.)alerts\.sbi\.co\.in$/i, issuer: 'SBI', type: 'bank', kind: 'bank-alert', local: STATEMENTY },
  { domain: /(^|\.)sbicard\.com$/i, issuer: 'SBI Card', type: 'card', kind: 'bank-alert', local: STATEMENTY },
  { domain: /(^|\.)axisbank\.com$/i, issuer: 'Axis', type: 'bank', kind: 'bank-alert', local: STATEMENTY },
  { domain: /(^|\.)kotak\.com$/i, issuer: 'Kotak', type: 'bank', kind: 'bank-alert', local: STATEMENTY },
  { domain: /(^|\.)indusind\.com$/i, issuer: 'IndusInd', type: 'bank', kind: 'bank-alert', local: STATEMENTY },
  { domain: /(^|\.)idfcfirstbank\.com$/i, issuer: 'IDFC First', type: 'bank', kind: 'bank-alert', local: STATEMENTY },
  { domain: /(^|\.)yesbank\.in$/i, issuer: 'Yes Bank', type: 'bank', kind: 'bank-alert', local: STATEMENTY },
  { domain: /(^|\.)rblbank\.com$/i, issuer: 'RBL', type: 'bank', kind: 'bank-alert', local: STATEMENTY },
  { domain: /(^|\.)federalbank\.co\.in$/i, issuer: 'Federal', type: 'bank', kind: 'bank-alert', local: STATEMENTY },
  { domain: /(^|\.)aubank\.in$/i, issuer: 'AU', type: 'bank', kind: 'bank-alert', local: STATEMENTY },
  { domain: /(^|\.)bankofbaroda\.(com|co\.in)$/i, issuer: 'BoB', type: 'bank', kind: 'bank-alert', local: STATEMENTY },
  { domain: /(^|\.)pnb\.co\.in$/i, issuer: 'PNB', type: 'bank', kind: 'bank-alert', local: STATEMENTY },
  { domain: /(^|\.)canarabank\.com$/i, issuer: 'Canara', type: 'bank', kind: 'bank-alert', local: STATEMENTY },
  { domain: /americanexpress\.com$/i, issuer: 'Amex', type: 'card', kind: 'bank-alert', local: STATEMENTY },
  { domain: /(^|\.)citi(corp|bank)?\.com$/i, issuer: 'Citi', type: 'card', kind: 'bank-alert', local: STATEMENTY },
  { domain: /(^|\.)onecard\.app$/i, issuer: 'OneCard', type: 'card', kind: 'bank-alert', local: STATEMENTY },

  // ---- UPI and wallets ----
  { domain: /(^|\.)phonepe\.com$/i, issuer: 'PhonePe', type: 'wallet', kind: 'upi-receipt' },
  { domain: /(^|\.)paytm\.(com|in)$/i, issuer: 'Paytm', type: 'wallet', kind: 'upi-receipt' },
  { domain: /(^|\.)amazonpay\.in$/i, issuer: 'Amazon Pay', type: 'wallet', kind: 'upi-receipt' },
  { domain: /(^|\.)cred\.club$/i, issuer: 'CRED', type: 'wallet', kind: 'upi-receipt' },
  { domain: /(^|\.)navi\.com$/i, issuer: 'Navi', type: 'wallet', kind: 'upi-receipt' },

  // ---- merchants, which enrich rather than report ----
  { domain: /(^|\.)amazon\.(in|com)$/i, issuer: 'Amazon', type: 'wallet', kind: 'merchant-receipt' },
  { domain: /(^|\.)flipkart\.com$/i, issuer: 'Flipkart', type: 'wallet', kind: 'merchant-receipt' },
  { domain: /(^|\.)swiggy\.(in|com)$/i, issuer: 'Swiggy', type: 'wallet', kind: 'merchant-receipt' },
  { domain: /(^|\.)zomato\.com$/i, issuer: 'Zomato', type: 'wallet', kind: 'merchant-receipt' },
  { domain: /(^|\.)uber\.com$/i, issuer: 'Uber', type: 'wallet', kind: 'merchant-receipt' },
  { domain: /(^|\.)olacabs\.com$/i, issuer: 'Ola', type: 'wallet', kind: 'merchant-receipt' },
  { domain: /(^|\.)bookmyshow\.com$/i, issuer: 'BookMyShow', type: 'wallet', kind: 'merchant-receipt' },
  { domain: /(^|\.)blinkit\.com$/i, issuer: 'Blinkit', type: 'wallet', kind: 'merchant-receipt' },
  { domain: /(^|\.)zeptonow\.com$/i, issuer: 'Zepto', type: 'wallet', kind: 'merchant-receipt' },
  { domain: /(^|\.)netflix\.com$/i, issuer: 'Netflix', type: 'wallet', kind: 'merchant-receipt' },
  { domain: /(^|\.)spotify\.com$/i, issuer: 'Spotify', type: 'wallet', kind: 'merchant-receipt' },
  { domain: /(^|\.)apple\.com$/i, issuer: 'Apple', type: 'wallet', kind: 'merchant-receipt' },
  { domain: /(^|\.)google\.com$/i, issuer: 'Google', type: 'wallet', kind: 'merchant-receipt', local: [[/googlepay|gpay/i, 'upi-receipt']] },
];

/** The address between the angle brackets, lowercased. */
export function addressOf(from: string): string {
  const angled = /<([^>]+)>/.exec(from);
  return (angled ? angled[1] : from).trim().toLowerCase();
}

export function identifySender(from: string): Sender | null {
  const address = addressOf(from);
  const at = address.lastIndexOf('@');
  if (at < 0) return null;
  const local = address.slice(0, at);
  const domain = address.slice(at + 1);

  for (const rule of RULES) {
    if (!rule.domain.test(domain)) continue;
    let kind = rule.kind;
    for (const [pattern, refined] of rule.local ?? []) {
      if (pattern.test(local)) {
        kind = refined;
        break;
      }
    }
    return { issuer: rule.issuer, type: rule.type, kind };
  }
  return null;
}

/**
 * Senders whose mail is advertising.
 *
 * This is the largest source of wrong numbers in the whole app. "Get ₹500
 * cashback on your next order" parses beautifully as a ₹500 credit, and a
 * promotional calendar can add tens of thousands of rupees of money that never
 * existed. Marketing addresses are dropped before anything else runs.
 */
const PROMO_LOCAL = /^(offers?|promo(tions?)?|deals?|marketing|newsletter|news|updates?|info|hello|team|support|no-?reply-?marketing)$/i;

export function looksPromotional(from: string, subject: string, body: string): boolean {
  const address = addressOf(from);
  const local = address.slice(0, Math.max(0, address.lastIndexOf('@')));
  if (PROMO_LOCAL.test(local)) return true;

  const text = `${subject}\n${body}`;
  const markers = [
    /\bcashback up to\b/i,
    /\bup to \d+% ?(off|cashback)/i,
    /\bflat \d+% ?off\b/i,
    /\blimited (time|period) offer\b/i,
    /\bhurry\b|\bdon'?t miss\b|\blast chance\b/i,
    /\bwin (up to|a|an)\b/i,
    /\bapply now\b|\bshop now\b|\bbook now\b|\border now\b/i,
    /\bT ?& ?C ?(apply|s apply)\b/i,
    /\bpre-?approved\b/i,
    /\byou (are|'re) eligible\b/i,
  ];
  const hits = markers.filter((m) => m.test(text)).length;
  return hits >= 2;
}
