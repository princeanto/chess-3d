/**
 * The maths and the matching, checked against known answers.
 */

import { understand } from '../src/utils/intent';
import { parseAmount, money, bytes, parseSize, significant } from '../src/utils/format';
import { cleanText, CLEAN_DEFAULTS, convertCase, countText, dedupeLines, findReplace, extract, sortLines } from '../src/utils/text';
import { percentOf, whatPercent, percentChange, discount, tip, splitBill, gst, emi } from '../src/utils/money';
import { age, addToDate, dateDiff, parseDate, parseTime, timeDiff, fromIso, toIso } from '../src/utils/dates';
import { convert, parseQuantity, parseConversion, feetInches } from '../src/utils/units';
import { aspectRatio, grid, ppi, goldenRatio } from '../src/utils/design';
import { password, randomInt, strength, uuid } from '../src/utils/random';
import { lorem } from '../src/utils/lorem';
import { buildPdf } from '../src/utils/pdf';
import { TOOLS } from '../src/data/tools';
import { makeQr } from '../src/utils/qr';

let passed = 0;
let failed = 0;
function ok(label: string, condition: boolean, detail = ''): void {
  if (condition) { passed += 1; console.log(`  ok   ${label}${detail ? `  ${detail}` : ''}`); }
  else { failed += 1; console.log(`  FAIL ${label}${detail ? `  ${detail}` : ''}`); }
}
const near = (a: number, b: number, eps = 0.005) => Math.abs(a - b) <= eps;
const TODAY = { y: 2026, m: 9, d: 17 };

console.log('\nSEARCH UNDERSTANDS');
const top = (q: string) => understand(q, TODAY)[0];
const expectTool = (q: string, id: string, check?: (m: ReturnType<typeof top>) => boolean) => {
  const m = top(q);
  ok(`“${q}” → ${id}`, m?.tool.id === id && (!check || check(m)), m ? `${m.tool.id}${m.answer ? ` · ${m.answer}` : ''}${m.params ? ` · ${JSON.stringify(m.params)}` : ''}` : 'nothing');
};
expectTool('I need to split ₹4,500 between 5 people', 'split-bill', (m) => m.params?.bill === '4500' && m.params?.people === '5' && m.answer === '₹900 each');
expectTool('Make this photo less than 1MB', 'image-compressor', (m) => m.params?.target === '1000000');
expectTool('How many days until December 25?', 'days-until', (m) => m.params?.date === '2026-12-25' && m.answer === '99 days');
expectTool('5 feet 10 inches in cm', 'unit-converter', (m) => m.answer === '177.8 cm');
expectTool('Turn this text uppercase', 'case-converter', (m) => m.params?.mode === 'upper');
expectTool('Resize an image to 1MB', 'image-compressor');
expectTool('Split ₹2,500 between 4 people', 'split-bill', (m) => m.answer === '₹625 each');
expectTool('Convert 5 feet to cm', 'unit-converter', (m) => m.answer === '152.4 cm');
expectTool('Remove duplicate lines', 'remove-duplicates');
expectTool('Create a QR code', 'qr-code');
expectTool('Calculate 18% of ₹2,500', 'percentage', (m) => m.answer === '₹450');
expectTool('I need to reduce my photo below 1mb', 'image-compressor');
expectTool('who owes whom', 'split-bill');
expectTool('divide money', 'split-bill');
expectTool('18% gst on 1000', 'gst', (m) => m.answer === '₹1,180 with GST');
expectTool('remove 18% gst from 1180', 'gst', (m) => m.answer === '₹1,000 before GST');
expectTool('100 f to c', 'unit-converter', (m) => m.answer === '37.7778 °C');
expectTool('2 gb in mb', 'data-size', (m) => m.answer === '2,000 MB');
expectTool('1920 x 1080 aspect ratio', 'aspect-ratio', (m) => m.answer === '16:9');
expectTool('hours between 9am and 5:30pm', 'time-difference', (m) => m.answer === '8 h 30 min');
expectTool('timer for 10 minutes', 'countdown', (m) => m.params?.seconds === '600');
expectTool('roll a dice', 'dice');
expectTool('flip a coin', 'coin-flip');
expectTool('45 days from today', 'add-date', (m) => m.answer === 'Sunday, 1 November 2026');
expectTool('what is 30 is what percent of 120', 'percentage', (m) => m.answer === '25%');
expectTool('20% off 2500', 'discount', (m) => m.answer === '₹2,000 after discount');
expectTool('how many words', 'word-counter');
expectTool('jpg to png', 'image-converter');
expectTool('emi for 20 lakh at 8.5% for 20 years', 'emi', (m) => m.params?.amount === '2000000' && m.params?.months === '240');
expectTool('random number between 1 and 100', 'random-number');
expectTool('passport photos to print', 'image-sheet');
expectTool('what should i eat', 'random-picker');
expectTool('invoice', 'invoice');
expectTool('days between 1 jan 2026 and 15 march 2026', 'date-difference', (m) => m.answer === '73 days');
ok('“smaller image” finds the image tools first', understand('smaller image', TODAY).slice(0, 2).every((m) => m.tool.category === 'image'));
ok('nonsense finds nothing', understand('zzqx', TODAY).length === 0);
ok('every tool can be found by its own name', TOOLS.every((t) => understand(t.name, TODAY)[0]?.tool.id === t.id),
  TOOLS.filter((t) => understand(t.name, TODAY)[0]?.tool.id !== t.id).map((t) => `${t.name}→${understand(t.name, TODAY)[0]?.tool.id}`).join(', '));

console.log('\nNUMBERS');
ok('amounts read the way people type them', parseAmount('₹4,500') === 4500 && parseAmount('2.5k') === 2500 && parseAmount('1.2 lakh') === 120000 && parseAmount('1,00,000') === 100000 && parseAmount('2 crore') === 2e7 && parseAmount('abc') === null);
ok('rupees group in lakhs, dollars in thousands', money(100000, 'INR') === '₹1,00,000' && money(100000, 'USD') === '$100,000' && money(450.5, 'INR') === '₹450.50');
ok('file sizes', bytes(824_000) === '824 KB' && bytes(3_800_000) === '3.8 MB' && bytes(1024, 'binary') === '1 KiB' && parseSize('< 500 KB') === 500_000);
ok('significant figures', significant(177.8) === '177.8' && significant(37.77777778) === '37.7778' && significant(0.1 + 0.2) === '0.3');

console.log('\nMONEY');
ok('18% of 2,500 is 450', percentOf(18, 2500) === 450);
ok('30 of 120 is 25%', whatPercent(30, 120) === 25 && whatPercent(1, 0) === null);
ok('80 to 100 is +25%', percentChange(80, 100) === 25);
const d = discount(2500, 20, 18);
ok('discount with tax', d.discount === 500 && d.afterDiscount === 2000 && d.tax === 360 && d.final === 2360);
const tp = tip(1000, 15, 4);
ok('tip', tp.tip === 150 && tp.total === 1150 && tp.perPerson === 287.5);
const sb = splitBill(4500, 5, 10);
ok('split ₹4,500 with 10% tip between 5 is ₹990 each', near(sb.each, 990));
const un = splitBill(1000, 2, 10, [600, 200]);
ok('unequal split: shared part split, tip follows share, adds up', near(un.people[0].amount, 770) && near(un.people[1].amount, 330) && near(un.people[0].amount + un.people[1].amount, 1100));
ok('claims over the bill are refused', !!splitBill(100, 2, 0, [80, 40]).error);
const g1 = gst(1000, 18, 'add');
const g2 = gst(1180, 18, 'remove');
ok('GST added and removed', near(g1.total, 1180) && near(g1.cgst, 90) && near(g2.base, 1000) && near(g2.gst, 180));
const loan = emi(1_000_000, 8.5, 240);
ok('EMI on ₹10 lakh at 8.5% for 20 years is ₹8,678.23', near(loan.emi, 8678.23, 0.01), loan.emi.toFixed(2));
ok('EMI schedule pays off the loan', loan.schedule.length === 20 && near(loan.schedule[19].balance, 0, 0.01) && near(loan.schedule.reduce((s, y) => s + y.principal, 0), 1_000_000, 0.05));
ok('zero-interest EMI', emi(12000, 0, 12).emi === 1000);

console.log('\nDATES AND TIMES');
const a = age({ y: 2000, m: 2, d: 29 }, TODAY)!;
ok('age of a leap-day birthday', a.years === 26 && a.months === 6 && toIso(a.nextBirthday) === '2027-02-28' && a.daysUntilBirthday === 164, JSON.stringify(a));
ok('a birthday today', age({ y: 1990, m: 9, d: 17 }, TODAY)!.daysUntilBirthday === 0);
ok('month-end clamps', toIso(addToDate({ y: 2026, m: 1, d: 31 }, 1, 'months')) === '2026-02-28' && toIso(addToDate({ y: 2024, m: 1, d: 31 }, 1, 'months')) === '2024-02-29');
const dd = dateDiff({ y: 2026, m: 1, d: 31 }, { y: 2026, m: 3, d: 1 });
ok('date difference', dd.days === 29 && dd.calendar.months === 1 && dd.calendar.days === 1, JSON.stringify(dd.calendar));
ok('backwards date difference is flagged', dateDiff({ y: 2026, m: 3, d: 1 }, { y: 2026, m: 1, d: 1 }).past);
ok('dates as people write them', toIso(parseDate('December 25', TODAY)!) === '2026-12-25' && toIso(parseDate('25th dec', TODAY)!) === '2026-12-25'
  && toIso(parseDate('1 jan', TODAY)!) === '2027-01-01' && toIso(parseDate('25/12/2027', TODAY)!) === '2027-12-25' && toIso(parseDate('christmas', TODAY)!) === '2026-12-25' && parseDate('31/02/2026', TODAY) === null);
ok('times as people write them', parseTime('9am') === 540 && parseTime('5:30pm') === 1050 && parseTime('12am') === 0 && parseTime('12pm') === 720 && parseTime('21:15') === 1275 && parseTime('25:00') === null);
ok('past midnight', timeDiff(22 * 60, 6 * 60).minutes === 480 && timeDiff(22 * 60, 6 * 60).overnight);
ok('ISO dates validate', fromIso('2026-02-29') === null && fromIso('2028-02-29') !== null);

console.log('\nUNITS');
const h = parseQuantity('5 ft 10 in')!;
ok('5 ft 10 in is 177.8 cm', near(convert(h.value, 'length', 'ft', 'cm')!, 177.8, 1e-9));
ok("5'10\" reads the same", near(parseQuantity("5'10\"")!.base, h.base, 1e-12));
ok('98.6 °F is 37 °C', near(convert(98.6, 'temperature', 'f', 'c')!, 37, 1e-9) && near(convert(0, 'temperature', 'c', 'k')!, 273.15, 1e-9));
ok('an acre is 43,560 square feet', near(convert(1, 'area', 'acre', 'sqft')!, 43560, 1e-6));
ok('a US gallon is 3.785411784 litres', convert(1, 'volume', 'gal', 'l') === 3.785411784);
ok('a mile is 1.609344 km', near(convert(1, 'length', 'mi', 'km')!, 1.609344, 1e-12));
ok('a pound is 0.45359237 kg', convert(1, 'weight', 'lb', 'kg') === 0.45359237);
ok('mixing categories is refused', parseQuantity('5 kg 3 cm') === null && parseConversion('5 kg in cm') === null);
ok('"in" as a unit and as a word', near(parseConversion('12 in in cm')?.result ?? 0, 30.48, 1e-9));
ok('heights back to feet and inches', feetInches(1.778) === '5 ft 10 in');

console.log('\nTEXT');
ok('cleaner', cleanText('  Hello   world  ,  friend\n\n\n“quoted” text   ', CLEAN_DEFAULTS) === 'Hello world, friend\n"quoted" text', JSON.stringify(cleanText('  Hello   world  ,  friend\n\n\n“quoted” text   ', CLEAN_DEFAULTS)));
ok('title case keeps small words small', convertCase('the lord of the rings', 'title') === 'The Lord of the Rings');
ok('sentence case', convertCase('HELLO THERE. how ARE you? i am fine', 'sentence') === 'Hello there. How are you? I am fine');
ok('alternating case skips non-letters', convertCase('ab c', 'alternating') === 'aB c');
const counts = countText("It's a test.\nSecond line here.\n\nNew paragraph! 🙂");
ok('counts', counts.words === 8 && counts.lines === 4 && counts.paragraphs === 2 && counts.sentences === 3, JSON.stringify(counts));
ok('counts emoji as one character', countText('🙂').characters === 1);
ok('dedupe keep first / last / case', dedupeLines('b\na\nB\nb', { keep: 'first', sort: false, ignoreCase: false, ignoreEmpty: true }).text === 'b\na\nB'
  && dedupeLines('b\na\nb', { keep: 'last', sort: false, ignoreCase: false, ignoreEmpty: true }).text === 'a\nb'
  && dedupeLines('b\na\nB', { keep: 'first', sort: true, ignoreCase: true, ignoreEmpty: true }).text === 'a\nb');
const fr = findReplace('cat catalog Cat', 'cat', '$1', { caseSensitive: false, wholeWord: true, all: true });
ok('find & replace: whole words, literal replacement', fr.text === '$1 catalog $1' && fr.count === 2);
ok('replace first only', findReplace('a a a', 'a', 'b', { caseSensitive: true, wholeWord: false, all: false }).text === 'b a a');
const ex = extract('Mail me at hi@example.com or visit https://pocket.tools/x). Call +91 98765 43210 on 12/05/2026.');
ok('extractor', ex.emails[0] === 'hi@example.com' && ex.urls[0] === 'https://pocket.tools/x' && ex.phones.length === 1 && ex.phones[0] === '+91 98765 43210', JSON.stringify(ex));
ok('numeric sort', sortLines('item 10\nitem 2\nitem 1', 'numeric', { dedupe: false }) === 'item 1\nitem 2\nitem 10');
ok('A–Z sorts naturally', sortLines('file10\nfile2', 'az', { dedupe: false }) === 'file2\nfile10');

console.log('\nDESIGN');
ok('1920 × 1080 is 16:9', aspectRatio(1920, 1080)?.w === 16 && aspectRatio(1920, 1080)?.h === 9);
ok('1366 × 768 is close to 16:9', aspectRatio(1366, 768)?.nearest === '16:9');
ok('grid: 1200, 12 columns, 24 gutter', near(grid(1200, 12, 24, 0).column, 78) && !!grid(100, 12, 24, 0).error);
ok('pixel density of 1179 × 2556 at 6.1"', near(ppi(1179, 2556, 6.1)!.ppi, 461.4, 0.1), ppi(1179, 2556, 6.1)!.ppi.toFixed(1));
ok('golden ratio', near(goldenRatio(100).larger, 161.803, 0.001) && near(goldenRatio(100).long + goldenRatio(100).short, 100, 1e-9));

console.log('\nRANDOM');
const pw = password({ length: 16, upper: true, lower: true, numbers: true, symbols: true });
ok('password has every chosen set and the right length', pw.length === 16 && /[A-Z]/.test(pw) && /[a-z]/.test(pw) && /\d/.test(pw) && /[^A-Za-z0-9]/.test(pw));
ok('strength', strength({ length: 16, upper: true, lower: true, numbers: true, symbols: true }).label === 'Very strong' && strength({ length: 6, upper: false, lower: true, numbers: false, symbols: false }).label === 'Weak');
const rolls = Array.from({ length: 6000 }, () => randomInt(1, 6));
const counts6 = [1, 2, 3, 4, 5, 6].map((f) => rolls.filter((r) => r === f).length);
ok('dice are fair and in range', rolls.every((r) => r >= 1 && r <= 6) && counts6.every((c) => c > 850 && c < 1150), counts6.join(' '));
ok('uuid v4', /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(uuid()));
ok('lorem starts classically and counts words', lorem(5, 'words').startsWith('Lorem ipsum dolor sit amet') && lorem(12, 'words').split(' ').length === 12);

console.log('\nPDF');
{
  const jpeg = new Uint8Array([0xff, 0xd8, 1, 2, 3, 0xff, 0xd9]);
  const pdf = buildPdf([{ width: 595.28, height: 841.89, images: [{ jpeg, width: 10, height: 10, x: 0, y: 0, w: 100, h: 100 }] }, { width: 612, height: 792, images: [] }]);
  const text = Buffer.from(pdf).toString('latin1');
  const xref = Number(/startxref\n(\d+)/.exec(text)![1]);
  ok('starts and ends like a PDF', text.startsWith('%PDF-1.4') && text.trimEnd().endsWith('%%EOF'));
  ok('startxref points at the xref table', text.slice(xref, xref + 4) === 'xref');
  const offsets = [...text.slice(xref).matchAll(/(\d{10}) 00000 n/g)].map((m) => Number(m[1]));
  ok('every xref offset points at its object', offsets.every((o, i) => text.slice(o).startsWith(`${i + 1} 0 obj`)));
  ok('two pages, image data intact', text.includes('/Count 2') && text.includes('\xff\xd8\x01\x02\x03\xff\xd9'));
}

console.log('\nQR');
{
  const a = makeQr('https://pocket.tools', 'M')!;
  ok('a URL makes a version-2 code (25 modules)', a.count === 25, `${a.count}`);
  ok('finder patterns in the corners', a.dark(0, 0) && a.dark(0, 6) && !a.dark(1, 1) && a.dark(2, 2) && a.dark(a.count - 1, 0) && a.dark(0, a.count - 1));
  const ascii = makeQr('cafe', 'L')!;
  const accented = makeQr('café ₹450', 'L')!;
  ok('non-ASCII text is encoded as UTF-8, not truncated', !!accented && accented.count >= ascii.count);
  ok('too much text is refused, not thrown', makeQr('x'.repeat(8000), 'H') === null);
}

console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'}  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
