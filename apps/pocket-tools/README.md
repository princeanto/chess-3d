# Pocket Tools

**Small problems. Solved quickly.** Tiny utilities for everyday life — 43 of them — in one
app that runs entirely on your device and keeps working offline.

Open → find a tool → enter something → get the answer → copy or download → leave.

```bash
npm install && npm run dev    # localhost:3000
npm test                      # the maths, the search, the PDF writer, QR codes
npm run build                 # static export in out/, plus the service worker
```

## What's in it

| Drawer | Tools |
| --- | --- |
| Quick | QR Code · Password Generator · Random Number · Random Picker · Dice · Coin Flip · UUID · Lorem Ipsum |
| Text | Text Cleaner · Case Converter · Word Counter · Remove Duplicate Lines · Find & Replace · Link & Email Extractor · Text Sorter |
| Image | Image Compressor · Image Resizer · Image Converter · Image Cropper · Image → PDF |
| Calculate | Percentage · Discount · Split Bill · Tip · GST · EMI · Age |
| Time | Date Difference · Days Until · Add to a Date · Stopwatch · Countdown · Pomodoro · Time Difference |
| Measure | Unit Converter · Data Size · Aspect Ratio · Golden Ratio · Grid Calculator · Pixel Density |
| Document | Receipt · Invoice · Image Sheet |

## Search that understands

Type what you're trying to do. "I need to split ₹4,500 between 5 people" opens Split Bill
with the bill and head count filled in, and the answer — ₹900 each — is already in the
results. "Make this photo less than 1MB" opens the compressor with the target set.

There is no AI and no network: `src/utils/intent.ts` scores every tool against the words in
its catalogue entry, then pattern readers recognise the shapes of specific requests (an
amount and a head count, a percentage of something, a quantity and a unit, a date) and pass
what they found to the tool through its URL. The spec's examples are tests.

## Private by construction

It's a static site. There is no server to upload a file to, so nothing is uploaded.

- **Images** are opened with `createImageBitmap` (which honours the rotation phones write
  into photos) and processed with `OffscreenCanvas` in a Web Worker, so squeezing a
  12-megapixel photo under 1 MB — a binary search over quality, then fewer pixels only if
  needed — never freezes the page.
- **PDFs** are written by `src/utils/pdf.ts`, a few dozen lines that place JPEGs on pages.
- **Receipts and invoices** are laid out as SVG — the preview and the export are the same
  drawing — then rendered with Inter embedded in the file.
- **QR codes** use qrcode-generator (MIT), bundled, with real UTF-8 encoding.
- **Passwords, dice, coins and pickers** use the Web Crypto API with rejection sampling.
- **Local storage** holds only the theme, favorites, tool usage counts and form drafts.
  Settings → Clear local data removes all of it.

## Offline

`scripts/build-sw.mjs` runs after `next build` and writes a service worker listing every
file in `out/`, including every tool's page and code chunk, so every tool works offline
after the first visit — not just the ones you happened to open. "Offline ready" appears
only once that is true.

## Accuracy

Money is exact until displayed. EMI uses the standard reducing-balance formula
(₹10 lakh at 8.5% over 20 years is ₹8,678.23 a month). GST can be added or removed and is
split into CGST and SGST. Unit factors are the defined values (an inch is exactly 25.4 mm).
Dates are calendar dates with no time of day, so daylight saving can't make "days until"
come out a day short, and month arithmetic clamps (31 January + 1 month = 28 February).
