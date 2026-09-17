/**
 * Every tool, as data: name, one line, category, and the words people use when
 * they need it. The words are what search listens for — "divide money" and
 * "who owes" should find Split Bill as surely as "split bill" does.
 *
 * Tool components are not imported here, so the shell, the search and the
 * command palette can know about every tool without loading any of them.
 */

export type CategoryId = 'quick' | 'text' | 'image' | 'calculate' | 'time' | 'measure' | 'document';

export const CATEGORIES: { id: CategoryId; label: string; short: string; line: string }[] = [
  { id: 'quick', label: 'Quick', short: 'Quick', line: 'Codes, passwords and decisions in a second.' },
  { id: 'text', label: 'Text', short: 'Text', line: 'Clean it, count it, change it.' },
  { id: 'image', label: 'Image', short: 'Image', line: 'Smaller, cropped, converted. Never uploaded.' },
  { id: 'calculate', label: 'Calculate', short: 'Calc', line: 'Money maths without the mental maths.' },
  { id: 'time', label: 'Time', short: 'Time', line: 'Dates, countdowns and clocks.' },
  { id: 'measure', label: 'Measure', short: 'Measure', line: 'Units, sizes and proportions.' },
  { id: 'document', label: 'Document', short: 'Docs', line: 'Receipts, invoices and printable sheets.' },
];

export interface ToolInfo {
  id: string;
  name: string;
  description: string;
  category: CategoryId;
  /** Phrases and words people use. Multi-word phrases score higher. */
  keywords: string[];
  /** Shown on the home page. */
  quick?: boolean;
  /** Sub-group label inside a category, like "For designers". */
  group?: string;
}

const t = (id: string, name: string, category: CategoryId, description: string, keywords: string[], extra: Partial<ToolInfo> = {}): ToolInfo =>
  ({ id, name, category, description, keywords, ...extra });

export const TOOLS: ToolInfo[] = [
  /* ---------------------------------- text --------------------------------- */
  t('text-cleaner', 'Text Cleaner', 'text', 'Remove extra spaces, empty lines and messy formatting.',
    ['clean text', 'clean up text', 'extra spaces', 'empty lines', 'blank lines', 'messy text', 'copied text', 'tidy text', 'fix formatting', 'strip spaces', 'trim', 'whitespace', 'smart quotes'], { quick: true }),
  t('case-converter', 'Case Converter', 'text', 'UPPERCASE, lowercase, Title Case and more.',
    ['uppercase', 'upper case', 'lowercase', 'lower case', 'title case', 'sentence case', 'capitalize', 'capitalise', 'capital letters', 'caps', 'change case', 'alternating case', 'all caps']),
  t('word-counter', 'Word Counter', 'text', 'Words, characters, lines and reading time.',
    ['word count', 'count words', 'how many words', 'character count', 'count characters', 'how many characters', 'letters count', 'reading time', 'essay length', 'characters']),
  t('remove-duplicates', 'Remove Duplicate Lines', 'text', 'Keep each line once.',
    ['duplicate lines', 'remove duplicates', 'duplicates', 'unique lines', 'dedupe', 'deduplicate', 'repeated lines']),
  t('find-replace', 'Find & Replace', 'text', 'Swap one word or phrase for another, everywhere.',
    ['find and replace', 'replace', 'replace word', 'swap word', 'substitute', 'search and replace', 'change every']),
  t('extractor', 'Link & Email Extractor', 'text', 'Pull URLs, emails and phone numbers out of text.',
    ['extract emails', 'extract links', 'extract urls', 'find emails', 'find links', 'email addresses', 'phone numbers', 'get links', 'urls from text', 'extract']),
  t('text-sorter', 'Text Sorter', 'text', 'Sort lines A–Z, by length, numbers or at random.',
    ['sort lines', 'sort text', 'alphabetical', 'alphabetize', 'alphabetise', 'a to z', 'order lines', 'shuffle lines', 'sort list']),

  /* ---------------------------------- image -------------------------------- */
  t('image-compressor', 'Image Compressor', 'image', 'Make an image smaller, down to a target file size.',
    ['compress image', 'compress photo', 'reduce image size', 'reduce photo size', 'smaller image', 'smaller photo', 'image size', 'file size', 'less than 1mb', 'under 1mb', 'below 1mb', 'kb', 'mb', 'shrink photo', 'compress', 'optimize image'], { quick: true }),
  t('image-resizer', 'Image Resizer', 'image', 'Change an image’s width and height, or use a preset.',
    ['resize image', 'resize photo', 'change dimensions', 'image dimensions', 'width and height', 'instagram size', 'passport size', 'profile picture', 'resize', 'pixels', 'scale image', 'whatsapp dp'], { quick: true }),
  t('image-converter', 'Image Converter', 'image', 'Turn images into JPG, PNG or WebP.',
    ['convert image', 'png to jpg', 'jpg to png', 'webp to jpg', 'jpg to webp', 'png to webp', 'webp to png', 'change format', 'image format', 'jpeg']),
  t('image-cropper', 'Image Cropper', 'image', 'Crop to a ratio, rotate and flip.',
    ['crop image', 'crop photo', 'cut image', 'rotate image', 'flip image', 'crop', 'square photo', 'trim image']),
  t('image-to-pdf', 'Image → PDF', 'image', 'Put photos into one PDF, in the order you choose.',
    ['image to pdf', 'images to pdf', 'photo to pdf', 'jpg to pdf', 'png to pdf', 'combine images', 'scan to pdf', 'make pdf', 'pdf']),

  /* -------------------------------- calculate ------------------------------ */
  t('percentage', 'Percentage Calculator', 'calculate', 'X% of Y, X as a percentage of Y, and change.',
    ['percent', 'percentage', '% of', 'what percent', 'percentage increase', 'percentage decrease', 'percent change', 'how much percent', 'percentage of'], { quick: true }),
  t('discount', 'Discount Calculator', 'calculate', 'The price after a discount, with tax if you like.',
    ['discount', '% off', 'percent off', 'sale price', 'price after discount', 'how much will i save', 'offer price']),
  t('split-bill', 'Split Bill', 'calculate', 'Who owes what, evenly or not.',
    ['split bill', 'split the bill', 'divide bill', 'divide money', 'split money', 'share bill', 'who owes', 'split between', 'divide between', 'per head', 'split expenses', 'split'], { quick: true }),
  t('tip', 'Tip Calculator', 'calculate', 'Tip, total and each person’s share.',
    ['tip', 'gratuity', 'how much to tip', 'service charge', 'tip calculator']),
  t('gst', 'GST Calculator', 'calculate', 'Add GST to a price or take it out.',
    ['gst', 'goods and services tax', 'add gst', 'remove gst', 'inclusive gst', 'exclusive gst', 'cgst', 'sgst', 'tax amount', 'vat'], { quick: true }),
  t('emi', 'EMI Calculator', 'calculate', 'Monthly payment and total interest on a loan.',
    ['emi', 'loan', 'monthly installment', 'monthly instalment', 'home loan', 'car loan', 'interest', 'mortgage', 'loan payment', 'repayment']),
  t('age', 'Age Calculator', 'calculate', 'Exact age, and days until the next birthday.',
    ['age', 'how old', 'date of birth', 'born on', 'birthday', 'dob', 'my age', 'years old']),

  /* ---------------------------------- time --------------------------------- */
  t('date-difference', 'Date Difference', 'time', 'Days, weeks, months and years between two dates.',
    ['days between', 'between dates', 'date difference', 'how many days', 'difference between dates', 'weeks between', 'months between', 'date calculator'], { quick: true }),
  t('days-until', 'Days Until', 'time', 'A countdown in days to any date.',
    ['days until', 'days till', 'days to go', 'how many days until', 'how long until', 'countdown to', 'days left', 'days before']),
  t('add-date', 'Add to a Date', 'time', 'Today plus 45 days, or minus 3 months.',
    ['add days', 'days from today', 'days from now', 'weeks from now', 'months from now', 'subtract days', 'days ago', 'date after', 'plus days']),
  t('stopwatch', 'Stopwatch', 'time', 'Start, pause, laps.',
    ['stopwatch', 'stop watch', 'lap timer', 'time something', 'laps']),
  t('countdown', 'Countdown Timer', 'time', 'Set hours, minutes and seconds. It rings.',
    ['timer', 'countdown', 'count down', 'set a timer', 'minute timer', 'alarm', 'kitchen timer', 'timer for']),
  t('pomodoro', 'Pomodoro', 'time', 'Focus for 25, rest for 5.',
    ['pomodoro', 'focus timer', 'study timer', 'work timer', 'productivity timer', 'focus session']),
  t('time-difference', 'Time Difference', 'time', 'How long between two times, even past midnight.',
    ['hours between', 'time between', 'time difference', 'how many hours', 'duration', 'hours worked', 'shift length', 'time duration']),

  /* --------------------------------- measure ------------------------------- */
  t('unit-converter', 'Unit Converter', 'measure', 'Length, weight, temperature and six more.',
    ['convert', 'conversion', 'feet to cm', 'cm to feet', 'inches', 'kg to lbs', 'pounds to kg', 'celsius', 'fahrenheit', 'miles to km', 'km to miles', 'litres', 'gallons', 'square feet', 'unit converter', 'height in cm', 'temperature'], { quick: true }),
  t('data-size', 'Data Size Converter', 'measure', 'Bytes, KB, MB, GB and TB, decimal or binary.',
    ['mb to gb', 'gb to mb', 'kb to mb', 'bytes', 'megabytes', 'gigabytes', 'file size convert', 'mib', 'gib', 'storage size']),
  t('aspect-ratio', 'Aspect Ratio', 'measure', '1920 × 1080 is 16:9. Find the missing side.',
    ['aspect ratio', 'ratio', '16:9', '4:3', 'resolution', 'width height ratio', 'proportional size'], { group: 'For designers' }),
  t('golden-ratio', 'Golden Ratio', 'measure', 'Golden proportions from any number.',
    ['golden ratio', 'golden section', 'phi', '1.618', 'divine proportion'], { group: 'For designers' }),
  t('grid-calculator', 'Grid Calculator', 'measure', 'Column width from container, columns, gutter and margin.',
    ['grid', 'columns', 'gutter', 'column width', 'layout grid', '12 column', 'css grid'], { group: 'For designers' }),
  t('pixel-density', 'Pixel Density', 'measure', 'PPI from resolution and screen size.',
    ['ppi', 'dpi', 'pixel density', 'pixels per inch', 'screen density', 'retina', 'display size'], { group: 'For designers' }),

  /* -------------------------------- document ------------------------------- */
  t('receipt', 'Receipt Generator', 'document', 'A clean, printable receipt in a minute.',
    ['receipt', 'make a receipt', 'payment receipt', 'cash receipt', 'bill receipt', 'rent receipt']),
  t('invoice', 'Invoice Generator', 'document', 'A simple invoice to print or save as PDF.',
    ['invoice', 'make an invoice', 'create invoice', 'bill to client', 'freelance invoice', 'tax invoice', 'quotation']),
  t('image-sheet', 'Image Sheet', 'document', 'Many photos on one printable page — passport photos, stickers, labels.',
    ['passport photos', 'photo sheet', 'contact sheet', 'print photos', 'stickers', 'labels', 'photos on one page', 'image grid', 'print sheet']),

  /* ---------------------------------- quick -------------------------------- */
  t('qr-code', 'QR Code', 'quick', 'A QR code for any link or text.',
    ['qr', 'qr code', 'qrcode', 'make a qr', 'generate qr', 'barcode', 'scan code', 'wifi qr'], { quick: true }),
  t('password', 'Password Generator', 'quick', 'Strong, random, generated on this device.',
    ['password', 'generate password', 'strong password', 'random password', 'passphrase', 'secure password', 'passcode'], { quick: true }),
  t('random-number', 'Random Number', 'quick', 'A random number between two others.',
    ['random number', 'number between', 'pick a number', 'rng', 'lottery number', 'random integer']),
  t('random-picker', 'Random Picker', 'quick', 'Can’t decide? Paste the options and pick one.',
    ['pick one', 'random picker', 'choose for me', 'decide', 'pick randomly', 'random choice', 'what should i eat', 'draw a name', 'pick a winner', 'raffle'], { quick: true }),
  t('dice', 'Dice', 'quick', 'D4 to D20, rolled fairly.',
    ['dice', 'die', 'roll', 'roll a dice', 'd20', 'd6', 'board game']),
  t('coin-flip', 'Coin Flip', 'quick', 'Heads or tails.',
    ['coin', 'flip a coin', 'toss a coin', 'heads or tails', 'coin toss']),
  t('uuid', 'UUID Generator', 'quick', 'Random version 4 UUIDs.',
    ['uuid', 'guid', 'unique id', 'random id', 'uuid v4']),
  t('lorem-ipsum', 'Lorem Ipsum', 'quick', 'Placeholder text by the word, sentence or paragraph.',
    ['lorem ipsum', 'lorem', 'placeholder text', 'dummy text', 'filler text', 'sample text']),
];

export const toolById = (id: string): ToolInfo | undefined => TOOLS.find((tool) => tool.id === id);
export const categoryById = (id: string) => CATEGORIES.find((c) => c.id === id);
export const toolsIn = (category: CategoryId) => TOOLS.filter((tool) => tool.category === category);
export const toolHref = (id: string, params?: Record<string, string>) => {
  const query = params && Object.keys(params).length ? `?${new URLSearchParams(params).toString()}` : '';
  return `/tools/${id}/${query}`;
};
