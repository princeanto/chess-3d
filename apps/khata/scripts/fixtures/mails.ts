/**
 * Synthetic bank mail.
 *
 * Written by hand in the shape real Indian alerts take, and deliberately not
 * taken from anybody's actual inbox — a test corpus of real financial mail is a
 * liability sitting in a git repository forever.
 *
 * Each fixture exists because something specific can go wrong with it, and that
 * reason is written above it. When a parser change breaks one of these, the
 * comment is the argument for why the old behaviour was right.
 */

import type { Message } from '../../lib/ledger/types';
import { fromIst } from '../../lib/ledger/time';

let counter = 0;
const make = (
  from: string,
  subject: string,
  body: string,
  at: number,
): Message => ({
  id: `m${(counter += 1)}`,
  threadId: `t${counter}`,
  from,
  subject,
  date: at,
  body,
});

const HDFC = 'HDFC Bank InstaAlerts <alerts@hdfcbank.net>';
const GPAY = 'Google Pay <googlepay-noreply@google.com>';
const ICICI = 'ICICI Bank <alert@icicibank.com>';
const SBI = 'SBI <donotreply.sbiatm@alerts.sbi.co.in>';
const AXIS = 'Axis Bank <alerts@axisbank.com>';
const AMEX = 'American Express <DoNotReply@americanexpress.com>';
const SWIGGY = 'Swiggy <noreply@swiggy.in>';
const PROMO = 'HDFC Offers <offers@hdfcbank.net>';

/* --------------------------- one payment, thrice -------------------------- */

/**
 * The same coffee reported by the bank, the payment app and the shop.
 *
 * Counted naively this is ₹1,350 of spending on a ₹450 order. All three carry
 * the same UPI reference, which is what makes collapsing them safe.
 */
export const TRIPLE_REPORTED: Message[] = [
  make(
    HDFC,
    'You have done a UPI txn. Check details!',
    `Dear Customer,
Rs.450.00 has been debited from account **1234 to VPA swiggy@ybl on 12-03-2026.
Your UPI transaction reference number is 405312345678.
Available balance: Rs.45,678.90
Not you? Call 18002026161 immediately.`,
    fromIst(2026, 3, 12, 13, 4),
  ),
  make(
    GPAY,
    'You paid ₹450.00 to Swiggy',
    `You paid ₹450.00 to Swiggy on 12 March 2026.
UPI transaction ID: 405312345678
Paid using HDFC Bank ****1234`,
    fromIst(2026, 3, 12, 13, 5),
  ),
  make(
    SWIGGY,
    'Order delivered — your bill',
    `Thanks for ordering. Order total Rs.450.00 paid via UPI on 12 March 2026.`,
    fromIst(2026, 3, 12, 13, 38),
  ),
];

/* ------------------------------ two payments ----------------------------- */

/**
 * The double swipe.
 *
 * Same merchant, same amount, minutes apart — but two different references, so
 * these are two charges and must survive deduplication to be reported as a
 * duplicate.
 */
export const DOUBLE_SWIPE: Message[] = [
  make(
    HDFC,
    'Alert: Update on your HDFC Bank Credit Card',
    `Rs.2499.00 has been spent on your HDFC Bank Credit Card ending 8891 at CROMA STORE on 04-02-2026.
Authorisation code: 553120
Available limit: Rs.1,10,000.00`,
    fromIst(2026, 2, 4, 18, 12),
  ),
  make(
    HDFC,
    'Alert: Update on your HDFC Bank Credit Card',
    `Rs.2499.00 has been spent on your HDFC Bank Credit Card ending 8891 at CROMA STORE on 04-02-2026.
Authorisation code: 553187
Available limit: Rs.1,07,501.00`,
    fromIst(2026, 2, 4, 18, 19),
  ),
];

/* ------------------------------- distractors ----------------------------- */

/** The balance is the biggest number in the mail and is not the transaction. */
export const BALANCE_DISTRACTOR = make(
  ICICI,
  'Transaction alert on your ICICI Bank Account',
  `Dear Customer, your account XX4455 has been debited with Rs.1,200.00 on 09-01-2026 towards BESCOM ELECTRICITY.
Available balance in your account is Rs.2,45,678.90.
Reference no: ICI9930112`,
  fromIst(2026, 1, 9, 9, 30),
);

/** A credit card being used is a debit, however many times the word appears. */
export const CREDIT_CARD_DEBIT = make(
  AXIS,
  'Your Axis Bank Credit Card has been used',
  `Your Axis Bank Credit Card ending 3321 has been used for Rs.7,850.00 at INDIGO AIRLINES on 21-01-2026.
Txn id: AX771203`,
  fromIst(2026, 1, 21, 7, 15),
);

/** Lakh grouping, and a toll-free number that must not read as an amount. */
export const LAKH_SALARY = make(
  HDFC,
  'Salary credited to your account',
  `Rs.1,23,456.78 credited to A/c XX1234 on 01-03-2026 by NEFT.
Info: SALARY MAR 2026
For queries call 18002026161.`,
  fromIst(2026, 3, 1, 6, 2),
);

/** Marketing parses beautifully and must never reach the ledger. */
export const PROMOTIONAL = make(
  PROMO,
  'Get up to 10% cashback this festive season!',
  `Flat 10% off on all spends above Rs.5,000. Shop now and win up to Rs.2,000 cashback.
Limited time offer. T&C apply.`,
  fromIst(2026, 3, 3, 11, 0),
);

/** A declined payment moved no money. */
export const DECLINED = make(
  ICICI,
  'Transaction declined',
  `Your transaction of Rs.5,000.00 at AMAZON was declined due to insufficient balance on 14-02-2026.`,
  fromIst(2026, 2, 14, 20, 41),
);

/** Cash out of a machine is still money gone. */
export const ATM_WITHDRAWAL = make(
  SBI,
  'ATM withdrawal alert',
  `Rs.10,000.00 withdrawn from A/c XX7788 at ATM SBI KORAMANGALA on 18-02-2026.
Txn no: S91002271`,
  fromIst(2026, 2, 18, 19, 5),
);

/* ------------------------------ obligations ------------------------------ */

/** A bill is a demand with a date, not a payment. */
export const AMEX_BILL = make(
  AMEX,
  'Your American Express Card statement is ready',
  `Statement generated for card ending 2007.
Total Amount Due: Rs.34,567.00
Minimum Amount Due: Rs.1,730.00
Payment Due Date: 05/04/2026`,
  fromIst(2026, 3, 18, 8, 0),
);

/** The payment that clears it, three days early and from another account. */
export const AMEX_BILL_PAID = make(
  HDFC,
  'You have done a UPI txn. Check details!',
  `Rs.34,567.00 has been debited from account **1234 to VPA amex.billdesk@hdfcbank on 02-04-2026.
Your UPI transaction reference number is 409922114455.`,
  fromIst(2026, 4, 2, 10, 12),
);

/** An auto-debit that was announced. Nothing will tell you if it fails. */
export const MANDATE = make(
  HDFC,
  'E-mandate registered on your account',
  `An amount of Rs.1,499.00 will be debited on 15/04/2026 towards NETFLIX SUBSCRIPTION.
A/c XX1234. This is a standing instruction.`,
  fromIst(2026, 4, 1, 9, 0),
);

/* -------------------------------- promises ------------------------------- */

/** A refund promised and, in the ledger below, never delivered. */
export const REFUND_PROMISE = make(
  SWIGGY,
  'Refund initiated for your order',
  `A refund of Rs.320.00 has been initiated for your cancelled order and will be credited to your account in 5-7 working days.`,
  fromIst(2026, 2, 20, 15, 0),
);

/* ------------------------------- recurring ------------------------------- */

/**
 * Fourteen months of a subscription with October missing.
 *
 * The gap is the point: a charge that stopped appearing is how a failed
 * auto-debit shows up, and it is invisible in any single month.
 */
export const NETFLIX_SERIES: Message[] = (() => {
  const out: Message[] = [];
  // Runs to April 2026 so the series is still live at the suite's fixed "now";
  // a subscription that stopped two months ago is a different test.
  for (let i = 0; i < 16; i += 1) {
    const month = 1 + i;
    const year = 2025 + Math.floor((month - 1) / 12);
    const m = ((month - 1) % 12) + 1;
    if (year === 2025 && m === 10) continue; // the missing one
    out.push(
      make(
        HDFC,
        'Alert: Update on your HDFC Bank Credit Card',
        `Rs.649.00 has been spent on your HDFC Bank Credit Card ending 8891 at NETFLIX COM on ${String(m).padStart(2, '0')}-${String(m).padStart(2, '0')}-${year}.
Authorisation code: NF${year}${String(m).padStart(2, '0')}`,
        fromIst(year, m, 12, 3, 0),
      ),
    );
  }
  return out;
})();

/* -------------------------------- the lot -------------------------------- */

export const ALL: Message[] = [
  ...TRIPLE_REPORTED,
  ...DOUBLE_SWIPE,
  BALANCE_DISTRACTOR,
  CREDIT_CARD_DEBIT,
  LAKH_SALARY,
  PROMOTIONAL,
  DECLINED,
  ATM_WITHDRAWAL,
  AMEX_BILL,
  AMEX_BILL_PAID,
  MANDATE,
  REFUND_PROMISE,
  ...NETFLIX_SERIES,
];
