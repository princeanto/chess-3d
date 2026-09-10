# Khata

An accountant that works for you and nobody else.

Your banks already email you every time money moves. Two years of those alerts is
a complete record of your financial life, sitting unread in Gmail. Khata reads
them, reconciles them into a ledger, and answers the four questions that
actually matter: what am I spending, what do I owe, did I miss anything, and
where did money go that shouldn't have.

There is no server. The app is a static export; the only other machine involved
is an Apps Script running inside your own Google account.

```bash
npm install && npm run dev    # localhost:3000
npm test                      # 115 checks: parsing, reconciliation, insight
```

## Setup

Four minutes, once, and no Google Cloud console — Apps Script creates its own
Cloud project in the background and you never see it.

1. Open a blank script at [script.google.com](https://script.google.com/home/projects/create)
2. Paste in the code the app gives you (~90 lines, with a secret baked in)
3. Paste in the manifest, which pins the scope to **`gmail.readonly`**
4. Deploy as a web app, approve, and paste the URL back into Khata

Step 3 is the one that looks skippable and isn't. The convenient way to read
Gmail from Apps Script is `GmailApp`, which requires `https://mail.google.com/`
— full mailbox control, including send and delete. Declaring the scope by hand
and calling the REST API with the script's own token gets read-only instead.
Nothing here has any business being able to delete your mail.

The script does no parsing. It searches, returns, and stops, so improvements to
the parser ship with the app and you never touch the script again.

## The hard part is reconciliation

Buy a coffee with UPI and three systems email you about it: your bank's debit
alert, the payment app's receipt, and the merchant's confirmation. Count all
three and your spending is triple what it was.

The obvious fix — merge anything with a matching amount inside a time window —
is exactly wrong, because it also swallows the double-swipe, which is one of the
things you most want to be told about. So the rule is the bank's own reference:

- **Same reference → same payment**, even days apart.
- **Different references → different payments**, even seconds apart.
- **No reference → merge only across different systems.** Two alerts from the
  same bank for the same amount are two charges; that's the bank telling you it
  happened twice.

Everything else in the app is arithmetic on top of that, which is why it has the
most tests.

## Reading the mail

Indian bank alerts are marketing templates with one sentence of truth in the
middle, and every bank writes that sentence differently. Nothing matches whole
templates. The parser finds the pieces of a shared grammar — a verb saying which
way money went, an amount, an account, a counterparty — and scores how well they
agree, so a bank changing its HTML on a Tuesday doesn't break anything.

Some things that took a specific fix:

- **The balance is not the transaction.** Every alert quotes your balance in the
  same sentence as the spend, and it's a much larger number. Amounts are scored
  against nearby direction verbs and against distractor phrases like "available
  balance", weighted by distance.
- **A credit card is a debit.** "Your credit card has been used for Rs 900" has
  the word *credit* four characters from the verb. Card nouns are blanked before
  direction is read — blanked, not deleted, so every other index still lines up.
- **A promise is not a payment.** "Your refund will be credited in 5–7 days" is
  future tense. Reading it as income is doubly wrong: it invents a credit that
  never landed, and then hides the fact that it never landed, because the chaser
  finds its own phantom and concludes the money came through.
- **Marketing parses beautifully.** "Get ₹500 cashback" is a clean ₹500 credit,
  and a year of promotional mail can invent tens of thousands of rupees.
  Advertising is dropped outright rather than scored down — a false negative
  loses one row, a false positive corrupts every total that row is in.
- **₹1,23,456.78 is a real number and 18002026161 is not.** Amounts need a
  currency marker and comma grouping a human would write.
- Money is integer paise throughout. A ledger that adds up floating-point rupees
  drifts, and the drift lands in a total someone is going to act on.

## Being an accountant

- **Recurring charges** are found by clustering on merchant, amount and cadence.
  Three occurrences minimum — two points make a line through anything.
- **Missed payments** come from matching bill emails, which carry a total and a
  due date, against a later debit. A card bill names the card while the payment
  names the account it came from, so for bills the last-four is only ever
  positive evidence — nobody pays an Amex bill from Amex.
- **Failed auto-debits** are absences. A mandate says "₹X will be debited on the
  5th"; nothing tells you when it silently doesn't, because the bank has no
  reason to write about a debit that didn't happen.
- **Money lost** is a list with dates on it, not a feeling: duplicate charges,
  refunds promised and never delivered, reversals that never came back, every
  fee named, and subscriptions priced annually — ₹649 a month is a decision
  nobody revisits, ₹7,788 a year is a decision anybody would.
- **Ask** answers questions with arithmetic, on the device. No model, no network.

## What it cannot see

Only accounts that email you. Cash is invisible, and a bank that sends SMS but
not email is invisible. Rather than report a confident total that's missing a
card, every month carries a coverage note saying which accounts were heard from
— and transactions the parser wasn't sure about are held out of the figures and
counted separately, because a total that quietly drops what it couldn't read is
worse than one that says "and eleven more I couldn't read".

## Where the data is

- The ledger is cached in the browser, encrypted with AES-GCM under a passphrase
  (PBKDF2-SHA256, 310k iterations). It holds derived transactions — amounts,
  dates, merchants, last-four — never email bodies, never the bridge secret.
- The passphrase lives in memory for the session and is never persisted.
- The Apps Script deployment must accept anonymous requests, so the guard is a
  24-byte secret sent in the request body — out of URLs, referrers and logs.
- One button deletes the whole database, secret included. A "clear my data" that
  leaves a working key to your mailbox behind is not one.
