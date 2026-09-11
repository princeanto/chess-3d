/**
 * Does one email parse correctly.
 *
 * Everything downstream — totals, categories, missed payments, the lot — is
 * arithmetic on what these functions return, so a wrong reading here is not a
 * cosmetic bug. It is a number someone might act on.
 */

import { eq, near, ok, report, section } from './harness';
import {
  findAmounts,
  formatPaise,
  groupingIsPlausible,
  paise,
} from '../lib/parse/money';
import {
  cleanMerchant,
  detectMethod,
  extractReference,
  extractTail,
  flatten,
  merchantKey,
} from '../lib/parse/extract';
import { identifySender, looksPromotional } from '../lib/parse/senders';
import { parseMessage } from '../lib/parse/parse';
import { build } from '../lib/ledger/build';
import { istMonthKey, istDayKey, fromIst, parseIndianDate } from '../lib/ledger/time';
import * as F from './fixtures/mails';

/* --------------------------------- money -------------------------------- */

section('money');

eq('rupees to paise are exact', paise(1234.56), 123456);
eq('a third of a rupee rounds rather than truncates', paise(0.005), 1);

eq('lakh grouping is accepted', groupingIsPlausible('1,23,456'), true);
eq('thousand grouping is accepted', groupingIsPlausible('1,234,567'), true);
eq('mixed grouping is rejected', groupingIsPlausible('1,23,4567'), false);
eq('a stray group of four is rejected', groupingIsPlausible('12,3456'), false);

{
  const found = findAmounts('Rs.450.00 has been debited. Available balance: Rs.45,678.90');
  eq('both amounts are found', found.length, 2);
  eq('the first is 450 rupees', found[0].value, 45000);
  eq('the second keeps its lakh grouping', found[1].value, 4567890);
}

{
  // The single most common false positive: a support number in the footer.
  const found = findAmounts('For queries call 18002026161 or write to us.');
  eq('a phone number is not money', found.length, 0);
}

{
  const found = findAmounts('Card ending 1234 was used. INR 2,499 spent.');
  eq('a card tail is not money', found.length, 1);
  eq('the real amount is still found', found[0].value, 249900);
}

{
  const found = findAmounts('Amount: 2,499/- was paid');
  eq('the trailing slash-dash form parses', found.length, 1);
  eq('and carries the right value', found[0].value, 249900);
}

eq('display uses Indian grouping', formatPaise(12345678), '₹1,23,456.78');
eq('round display drops empty paise', formatPaise(64900, { round: true }), '₹649');

/* --------------------------------- dates -------------------------------- */

section('dates');

eq(
  'an ambiguous date is read day-first',
  istDayKey(parseIndianDate('05/04/2026', Date.now())!),
  '2026-04-05',
);
eq(
  'a day past twelve forces the reading',
  istDayKey(parseIndianDate('21/01/2026', Date.now())!),
  '2026-01-21',
);
eq(
  'a spelled month is unambiguous',
  istDayKey(parseIndianDate('12 March 2026', Date.now())!),
  '2026-03-12',
);

{
  // The bug this exists to prevent: a late-night spend sliding into next month
  // because the browser happened to be running in UTC.
  const lateNight = fromIst(2026, 9, 30, 23, 50);
  eq('a 23:50 IST spend stays in its own month', istMonthKey(lateNight), '2026-09');
  eq('and on its own day', istDayKey(lateNight), '2026-09-30');
}

/* -------------------------------- fields -------------------------------- */

section('fields');

eq('masked account tails are read', extractTail('debited from account **1234 to'), '1234');
eq('“ending 8891” is read', extractTail('Credit Card ending 8891 at CROMA'), '8891');
eq('“XX4455” is read', extractTail('your account XX4455 has been debited'), '4455');

eq(
  'a reference is the value, not its label',
  extractReference('Your UPI transaction reference number is 405312345678.'),
  '405312345678',
);
eq(
  'an authorisation code is a reference',
  extractReference('Authorisation code: 553120'),
  '553120',
);

eq('UPI is detected', detectMethod('debited to VPA swiggy@ybl'), 'upi');
eq('an ATM is not just a card', detectMethod('withdrawn from A/c at ATM SBI'), 'atm');
eq('a mandate is an auto-debit', detectMethod('this is a standing instruction'), 'ach');

eq('a VPA becomes a name', cleanMerchant('swiggy@ybl'), 'Swiggy');
eq('a UPI string yields the payee', cleanMerchant('UPI-SWIGGY LIMITED-SWIGGY@YBL-HDFC-405312345678'), 'Swiggy');
eq('shouting is calmed down', cleanMerchant('CROMA STORE'), 'Croma Store');
eq(
  'the same shop written four ways shares a key',
  new Set(['SWIGGY', 'Swiggy Ltd', 'swiggy@ybl', 'Swiggy  India'].map((m) => merchantKey(cleanMerchant(m) ?? ''))).size,
  1,
);

/* -------------------------------- senders ------------------------------- */

section('senders');

eq('a bank is recognised by domain', identifySender('alerts@hdfcbank.net')?.issuer, 'HDFC');
eq('a display name does not confuse it', identifySender('HDFC Bank <alerts@hdfcbank.net>')?.issuer, 'HDFC');
eq('the statements mailbox is a bill', identifySender('emailstatements@hdfcbank.net')?.kind, 'bill');
eq('Google Pay is a UPI receipt, not Google', identifySender('googlepay-noreply@google.com')?.kind, 'upi-receipt');
eq('an unknown sender is null', identifySender('someone@example.com'), null);

ok(
  'marketing is recognised',
  looksPromotional('offers@hdfcbank.net', 'Get 10% cashback', 'Shop now. T&C apply.'),
);
ok(
  'a real alert is not mistaken for marketing',
  !looksPromotional('alerts@hdfcbank.net', 'UPI txn', 'Rs.450.00 debited from account **1234.'),
);

/* -------------------------------- whole mails --------------------------- */

section('whole mails');

{
  const { record } = parseMessage(F.TRIPLE_REPORTED[0]);
  ok('the bank alert produces a record', Boolean(record));
  eq('the amount is the spend, not the balance', record!.amountPaise, 45000);
  eq('the direction is out', record!.direction, 'debit');
  eq('the account is identified', record!.account?.tail, '1234');
  eq('the reference is captured', record!.reference, '405312345678');
  eq('the payee is named', record!.merchant, 'Swiggy');
  ok('confidence is high', record!.confidence > 0.8, `${record!.confidence.toFixed(2)}`);
}

{
  const { record } = parseMessage(F.BALANCE_DISTRACTOR);
  eq('the balance is not taken as the transaction', record!.amountPaise, 120000);
}

{
  const { record } = parseMessage(F.CREDIT_CARD_DEBIT);
  // "Credit" appears three times in this mail and the money still went out.
  eq('a credit card spend is a debit', record!.direction, 'debit');
  eq('and for the right amount', record!.amountPaise, 785000);
}

{
  const { record } = parseMessage(F.LAKH_SALARY);
  eq('a lakh salary parses', record!.amountPaise, 12345678);
  eq('and is money coming in', record!.direction, 'credit');
}

{
  const parsed = parseMessage(F.PROMOTIONAL);
  ok('marketing produces nothing at all', !parsed.record && !parsed.obligation);
}

{
  const parsed = parseMessage(F.DECLINED);
  ok('a declined payment is not a transaction', !parsed.record);
}

{
  const { record } = parseMessage(F.ATM_WITHDRAWAL);
  eq('cash out is a debit', record!.direction, 'debit');
  eq('and is tagged as an ATM', record!.method, 'atm');
}

{
  const { obligation } = parseMessage(F.AMEX_BILL);
  ok('a statement becomes an obligation', Boolean(obligation));
  eq('the total due is taken, not the minimum', obligation!.amountPaise, 3456700);
  eq('the due date is read day-first', istDayKey(obligation!.dueAt), '2026-04-05');
  ok('a bill is not also a transaction', !parseMessage(F.AMEX_BILL).record);
}

{
  const { obligation } = parseMessage(F.MANDATE);
  ok('a mandate becomes an obligation', Boolean(obligation));
  eq('with the amount it will take', obligation!.amountPaise, 149900);
  eq('on the date it will take it', istDayKey(obligation!.dueAt), '2026-04-15');
  eq('labelled with what it is for', obligation!.label, 'Netflix Subscription');
}

{
  const { promise } = parseMessage(F.REFUND_PROMISE);
  ok('a promised refund is recorded', Boolean(promise));
  eq('for the right amount', promise!.amountPaise, 32000);
  near(
    'and expected inside a fortnight',
    Math.round((promise!.expectBy - promise!.promisedAt) / 86400000),
    11,
    2,
  );
}

/* --------------------------------- html --------------------------------- */

section('html');

{
  // Table cells running together would hide the digit boundaries the amount
  // scanner depends on: "Rs 500Available" parses as neither.
  const text = flatten('<table><tr><td>Rs.500.00</td><td>Available balance</td></tr></table>');
  ok('cells are separated', /500\.00\s*\n?\s*Available/.test(text), JSON.stringify(text));
  eq('entities are decoded', flatten('<p>&#8377;450 &amp; more</p>').includes('₹450 & more'), true);
}

/* ---------------------------- real-world forms --------------------------- */

section('real-world forms');

{
  /*
   * The template HDFC's alerts take since the move to .bank.in, as observed:
   * a bare sender address, "is debited", "account ending", and the payee's
   * registered name in brackets after the handle. The values are invented —
   * only the shape is real.
   */
  const message = {
    id: 'rw1',
    threadId: 'rw1',
    from: 'alerts@hdfcbank.bank.in',
    subject: '❗  You have done a UPI txn. Check details!',
    body: 'Dear Customer, Greetings from HDFC Bank! Rs.310.00 is debited from your account ending 4821 towards VPA example.stall@okaxis (EXAMPLE TEA STALL) on 02-09-26. UPI transaction reference no.: 612345678901. If you did not authorize this transaction, please report it immediately.',
    date: fromIst(2026, 9, 2, 13, 0),
  };
  eq('a .bank.in sender is recognised', identifySender(message.from)?.issuer, 'HDFC');
  const { record } = parseMessage(message);
  eq('the amount is read', record?.amountPaise, 31000);
  eq('as money out', record?.direction, 'debit');
  eq('from the right account', record?.account?.tail, '4821');
  eq('with its reference', record?.reference, '612345678901');
  eq('the payee is the registered name, not the handle', record?.merchant, 'Example Tea Stall');
  ok('and it is confident', (record?.confidence ?? 0) > 0.8, (record?.confidence ?? 0).toFixed(2));

  const bare = parseMessage({
    ...message,
    id: 'rw2',
    body: message.body.replace(' (EXAMPLE TEA STALL)', ''),
  });
  eq('without a registered name, the handle stands in', bare.record?.merchant, 'Example Stall');
}

{
  /*
   * The body as the Gmail connector actually delivers it: plain text laid out
   * as a markdown table, with tracking links full of digits, the bank's
   * helplines, and a "Service charges and Fees" footer on every single alert.
   * Invented values in the observed layout.
   */
  const body = [
    ' HDFC BANK',
    '',
    '| |',
    '| [](https://trkt.example.com/v1/r/Zx81%2Fq9Lk2025091012345678%3D) |',
    '',
    '| |',
    '| |',
    "| Dear Customer, Greetings from HDFC Bank! Rs.26000.00 is debited from your account ending 4821 towards VPA example.landlord-1@okicici (EXAMPLE LANDLORD) on 10-09-26. UPI transaction reference no.: 612398765432. If you did not authorize this transaction, please report it immediately at: a. When in India (Toll free): 1800 258 6161 b. When abroad: 9122 61606160 c. Or SMS 'BLOCK UPI' to 7308080808. We're here to support you in every step of the way. Warm regards, HDFC Bank |",
    '| |',
    '',
    '| |',
    '| For more details on Service charges and Fees, click here.[](https://trkt.example.com/v1/r/Abt4F6%2BOZ9876543210) |',
    '| © HDFC Bank |',
  ].join('\n');
  const message = {
    id: 'rw3',
    threadId: 'rw3',
    from: 'alerts@hdfcbank.bank.in',
    subject: '❗  You have done a UPI txn. Check details!',
    body,
    date: fromIst(2026, 9, 10, 9, 6),
  };
  const { record } = parseMessage(message);
  eq('a table-laid body still yields the amount', record?.amountPaise, 2600000);
  eq('and the reference, not a digit run from a tracking link', record?.reference, '612398765432');
  eq('and the payee', record?.merchant, 'Example Landlord');
  const [txn] = build([message]).txns;
  eq('the footer’s mention of fees does not make it a fee', txn?.category, 'Rent');
}

report();
