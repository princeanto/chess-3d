/**
 * The sample ledger the page opens with before Gmail is connected.
 *
 * The test fixtures, plus an ordinary April: rent, salary, groceries, rides,
 * bills, a pharmacy, a refund that did arrive and a late fee that should not
 * have. Every entry is invented, and the page says so above the first figure —
 * this exists so the first look shows what Khata does, not to be mistaken for
 * anyone's money.
 *
 * Dated as if "now" were 20 April 2026, because the fixtures carry due dates in
 * their bodies; shifting the message dates to the present would leave the bills
 * due in a different month from the mail announcing them.
 */

import type { Message } from '../../lib/ledger/types';
import { fromIst } from '../../lib/ledger/time';
import { ALL } from './mails';

export const SAMPLE_NOW = fromIst(2026, 4, 20, 12, 0);

const HDFC = 'HDFC Bank InstaAlerts <alerts@hdfcbank.net>';
const ICICI = 'ICICI Bank <alert@icicibank.com>';

let id = 1000;
let ref = 410400000100;
const nextRef = (): string => String((ref += 7));
const dd = (n: number): string => String(n).padStart(2, '0');

const mail = (from: string, subject: string, body: string, at: number): Message => {
  id += 1;
  return { id: `s${id}`, threadId: `st${id}`, from, subject, date: at, body };
};

/** A UPI payment out of the HDFC savings account. */
const upi = (day: number, rupees: string, vpa: string, hour: number): Message =>
  mail(
    HDFC,
    'You have done a UPI txn. Check details!',
    `Dear Customer,
Rs.${rupees} has been debited from account **1234 to VPA ${vpa} on ${dd(day)}-04-2026.
Your UPI transaction reference number is ${nextRef()}.`,
    fromIst(2026, 4, day, hour, 12),
  );

/** A swipe on the HDFC credit card. */
const card = (day: number, rupees: string, where: string, hour: number): Message =>
  mail(
    HDFC,
    'Alert: Update on your HDFC Bank Credit Card',
    `Rs.${rupees} has been spent on your HDFC Bank Credit Card ending 8891 at ${where} on ${dd(day)}-04-2026.
Authorisation code: ${nextRef().slice(-6)}`,
    fromIst(2026, 4, day, hour, 40),
  );

/** A bill paid by net banking from the ICICI account. */
const bill = (day: number, rupees: string, what: string): Message =>
  mail(
    ICICI,
    'Transaction alert on your ICICI Bank Account',
    `Dear Customer, your account XX4455 has been debited with Rs.${rupees} on ${dd(day)}-04-2026 towards ${what}.
Reference no: ICI${nextRef().slice(-7)}`,
    fromIst(2026, 4, day, 9, 5),
  );

const APRIL: Message[] = [
  mail(
    HDFC,
    'Salary credited to your account',
    `Rs.1,23,456.78 credited to A/c XX1234 on 01-04-2026 by NEFT.
Info: SALARY APR 2026`,
    fromIst(2026, 4, 1, 6, 2),
  ),
  mail(
    HDFC,
    'Transaction alert',
    `Rs.28,000.00 debited from A/c XX1234 on 01-04-2026 by NEFT towards RENT R SHARMA.
Reference no: HDFCN${nextRef().slice(-8)}`,
    fromIst(2026, 4, 1, 10, 30),
  ),
  upi(3, '612.00', 'zomato@hdfcbank', 21),
  upi(4, '287.00', 'uber.india@axisbank', 9),
  upi(6, '1,146.00', 'blinkit.grofers@hdfcbank', 18),
  upi(8, '389.00', 'swiggy@ybl', 20),
  bill(9, '1,380.00', 'BESCOM ELECTRICITY'),
  upi(10, '342.00', 'uber.india@axisbank', 22),
  bill(11, '599.00', 'AIRTEL PREPAID'),
  mail(
    HDFC,
    'Money credited to your account',
    `Rs.1,299.00 credited to A/c XX1234 on 12-04-2026.
Info: REFUND FROM AMAZON`,
    fromIst(2026, 4, 12, 16, 20),
  ),
  upi(13, '2,340.00', 'bigbasket@icici', 11),
  card(14, '3,499.00', 'AMAZON PAY INDIA', 23),
  upi(15, '96.00', 'rapido@ybl', 8),
  card(16, '842.00', 'APOLLO PHARMACY', 19),
  card(17, '465.00', 'STARBUCKS COFFEE', 10),
  mail(
    ICICI,
    'Late payment charges on your Credit Card',
    `Late payment charges of Rs.750.00 have been debited to your ICICI Bank Credit Card XX4455 on 18-04-2026.`,
    fromIst(2026, 4, 18, 7, 0),
  ),
  upi(19, '523.00', 'zeptonow@ybl', 17),
];

/** Six months of a small subscription on the ICICI card — small enough to forget. */
const SPOTIFY: Message[] = [11, 12, 1, 2, 3, 4].map((month) => {
  const year = month >= 11 ? 2025 : 2026;
  return mail(
    ICICI,
    'Transaction alert for your ICICI Bank Credit Card',
    `Your ICICI Bank Credit Card XX4455 has been used for a transaction of INR 119.00 at SPOTIFY on 05-${dd(month)}-${year}.`,
    fromIst(year, month, 5, 6, 30),
  );
});

export const SAMPLE: Message[] = [...ALL, ...APRIL, ...SPOTIFY];
