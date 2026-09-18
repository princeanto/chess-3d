/**
 * Every tool, as data: name, one line, category, and the words people use when
 * they need it. The words are what search listens for — "divide money" and
 * "who owes" should find Split Bill as surely as "split bill" does.
 *
 * Tool components are not imported here, so the shell, the search and the
 * command palette can know about every tool without loading any of them.
 */

export type CategoryId = 'pdf' | 'image' | 'calculate' | 'measure' | 'document' | 'quick';

export const CATEGORIES: { id: CategoryId; label: string; short: string; line: string }[] = [
  { id: 'pdf', label: 'PDF', short: 'PDF', line: 'Merge, split, compress and convert. Files never leave your device.' },
  { id: 'image', label: 'Image', short: 'Image', line: 'Smaller, cropped, converted. Never uploaded.' },
  { id: 'calculate', label: 'Calculate', short: 'Calc', line: 'Money maths without the mental maths.' },
  { id: 'measure', label: 'Measure', short: 'Measure', line: 'Units, sizes and proportions.' },
  { id: 'document', label: 'Document', short: 'Docs', line: 'Receipts, invoices and printable sheets.' },
  { id: 'quick', label: 'Quick', short: 'Quick', line: 'Codes, passwords and decisions in a second.' },
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
  /** Sub-group label inside a category, like "Organize". */
  group?: string;
}

const t = (id: string, name: string, category: CategoryId, description: string, keywords: string[], extra: Partial<ToolInfo> = {}): ToolInfo =>
  ({ id, name, category, description, keywords, ...extra });

export const TOOLS: ToolInfo[] = [
  /* ----------------------------------- pdf ---------------------------------- */
  t('merge-pdf', 'Merge PDF', 'pdf', 'Combine PDFs into one, in the order you choose.',
    ['merge pdf', 'combine pdf', 'join pdf', 'merge pdfs', 'combine pdfs', 'join pdfs', 'put pdfs together', 'one pdf', 'append pdf', 'merge'], { quick: true, group: 'Organize' }),
  t('split-pdf', 'Split PDF', 'pdf', 'Break a PDF into parts, by page ranges or page by page.',
    ['split pdf', 'separate pdf', 'break pdf', 'divide pdf', 'split pages', 'pdf into pages', 'split'], { quick: true, group: 'Organize' }),
  t('extract-pages', 'Extract Pages', 'pdf', 'Pick the pages you want and save them as a new PDF.',
    ['extract pages', 'extract pdf pages', 'save some pages', 'pull pages', 'select pages', 'copy pages'], { group: 'Organize' }),
  t('remove-pages', 'Remove Pages', 'pdf', 'Delete pages you don’t need.',
    ['remove pages', 'delete pages', 'delete pdf pages', 'remove pdf pages', 'drop pages'], { group: 'Organize' }),
  t('organize-pdf', 'Organize PDF', 'pdf', 'Reorder, rotate and delete pages by dragging them.',
    ['organize pdf', 'reorder pages', 'rearrange pages', 'sort pages', 'move pages', 'page order', 'organise pdf'], { group: 'Organize' }),
  t('rotate-pdf', 'Rotate PDF', 'pdf', 'Turn sideways or upside-down pages the right way up.',
    ['rotate pdf', 'turn pdf', 'rotate pages', 'upside down pdf', 'sideways pdf', 'landscape pdf'], { group: 'Organize' }),
  t('compress-pdf', 'Compress PDF', 'pdf', 'Make a PDF smaller while keeping it readable.',
    ['compress pdf', 'reduce pdf size', 'shrink pdf', 'smaller pdf', 'pdf size', 'pdf too big', 'pdf under 1mb', 'optimize pdf'], { quick: true, group: 'Optimize' }),
  t('repair-pdf', 'Repair PDF', 'pdf', 'Rebuild a damaged PDF that won’t open properly.',
    ['repair pdf', 'fix pdf', 'broken pdf', 'corrupt pdf', 'damaged pdf', 'pdf won’t open', 'recover pdf'], { group: 'Optimize' }),
  t('pdf-to-jpg', 'PDF to JPG', 'pdf', 'Turn every page into a JPG or PNG image.',
    ['pdf to jpg', 'pdf to jpeg', 'pdf to png', 'pdf to image', 'pdf to images', 'convert pdf to image', 'pdf pages as pictures', 'save pdf as image'], { quick: true, group: 'Convert' }),
  t('jpg-to-pdf', 'JPG to PDF', 'pdf', 'Photos and scans into one PDF, in your order.',
    ['jpg to pdf', 'jpeg to pdf', 'png to pdf', 'image to pdf', 'images to pdf', 'photo to pdf', 'photos to pdf', 'scan to pdf', 'picture to pdf', 'make pdf from images'], { quick: true, group: 'Convert' }),
  t('pdf-to-text', 'PDF to Text', 'pdf', 'Pull the text out of a PDF to copy or save.',
    ['pdf to text', 'pdf to txt', 'extract text', 'copy text from pdf', 'text from pdf', 'pdf text'], { group: 'Convert' }),
  t('page-numbers', 'Add Page Numbers', 'pdf', 'Number the pages, where and how you like.',
    ['page numbers', 'add page numbers', 'number pages', 'pdf page numbers', 'pagination'], { group: 'Edit' }),
  t('watermark-pdf', 'Add Watermark', 'pdf', 'Stamp text or a logo across your pages.',
    ['watermark', 'add watermark', 'watermark pdf', 'stamp pdf', 'confidential stamp', 'draft stamp', 'logo on pdf'], { group: 'Edit' }),
  t('sign-pdf', 'Sign PDF', 'pdf', 'Draw, type or upload a signature and place it on the page.',
    ['sign pdf', 'signature', 'add signature', 'e-sign', 'esign', 'sign document', 'sign a pdf', 'initials'], { group: 'Edit' }),
  t('crop-pdf', 'Crop PDF', 'pdf', 'Trim the margins of every page.',
    ['crop pdf', 'trim pdf', 'cut pdf margins', 'remove margins', 'crop pages'], { group: 'Edit' }),
  t('protect-pdf', 'Protect PDF', 'pdf', 'Lock a PDF with a password.',
    ['protect pdf', 'password protect', 'lock pdf', 'encrypt pdf', 'add password', 'secure pdf', 'password pdf'], { group: 'Security' }),
  t('unlock-pdf', 'Unlock PDF', 'pdf', 'Remove the password from a PDF you can open.',
    ['unlock pdf', 'remove password', 'remove pdf password', 'decrypt pdf', 'pdf password', 'unprotect pdf'], { group: 'Security' }),

  /* ---------------------------------- image -------------------------------- */
  t('image-compressor', 'Image Compressor', 'image', 'Make an image smaller, down to a target file size.',
    ['compress image', 'compress photo', 'reduce image size', 'reduce photo size', 'smaller image', 'smaller photo', 'image size', 'photo size', 'less than 1mb', 'under 1mb', 'below 1mb', 'kb', 'shrink photo', 'compress', 'optimize image'], { quick: true }),
  t('image-resizer', 'Image Resizer', 'image', 'Change an image’s width and height, or use a preset.',
    ['resize image', 'resize photo', 'change dimensions', 'image dimensions', 'width and height', 'instagram size', 'passport size', 'profile picture', 'resize', 'pixels', 'scale image', 'whatsapp dp'], { quick: true }),
  t('image-converter', 'Image Converter', 'image', 'Turn images into JPG, PNG or WebP.',
    ['convert image', 'png to jpg', 'jpg to png', 'webp to jpg', 'jpg to webp', 'png to webp', 'webp to png', 'change format', 'image format', 'jpeg']),
  t('image-cropper', 'Image Cropper', 'image', 'Crop to a ratio, rotate and flip.',
    ['crop image', 'crop photo', 'cut image', 'rotate image', 'flip image', 'crop', 'square photo', 'trim image']),

  /* -------------------------------- calculate ------------------------------ */
  t('percentage', 'Percentage Calculator', 'calculate', 'X% of Y, X as a percentage of Y, and change.',
    ['percent', 'percentage', '% of', 'what percent', 'percentage increase', 'percentage decrease', 'percent change', 'how much percent', 'percentage of']),
  t('discount', 'Discount Calculator', 'calculate', 'The price after a discount, with tax if you like.',
    ['discount', '% off', 'percent off', 'sale price', 'price after discount', 'how much will i save', 'offer price']),
  t('split-bill', 'Split Bill', 'calculate', 'Who owes what, evenly or not.',
    ['split bill', 'split the bill', 'divide bill', 'divide money', 'split money', 'share bill', 'who owes', 'split between', 'divide between', 'per head', 'split expenses'], { quick: true }),
  t('tip', 'Tip Calculator', 'calculate', 'Tip, total and each person’s share.',
    ['tip', 'gratuity', 'how much to tip', 'service charge', 'tip calculator']),
  t('gst', 'GST Calculator', 'calculate', 'Add GST to a price or take it out.',
    ['gst', 'goods and services tax', 'add gst', 'remove gst', 'inclusive gst', 'exclusive gst', 'cgst', 'sgst', 'tax amount', 'vat'], { quick: true }),
  t('emi', 'EMI Calculator', 'calculate', 'Monthly payment and total interest on a loan.',
    ['emi', 'loan', 'monthly installment', 'monthly instalment', 'home loan', 'car loan', 'interest', 'mortgage', 'loan payment', 'repayment']),
  t('age', 'Age Calculator', 'calculate', 'Exact age, and days until the next birthday.',
    ['age', 'how old', 'date of birth', 'born on', 'birthday', 'dob', 'my age', 'years old']),

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
    ['pick one', 'random picker', 'choose for me', 'decide', 'pick randomly', 'random choice', 'what should i eat', 'draw a name', 'pick a winner', 'raffle']),
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
