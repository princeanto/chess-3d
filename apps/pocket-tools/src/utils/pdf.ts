/**
 * A PDF, written by hand.
 *
 * Every PDF this app makes is pages of images — photos for Image → PDF, a
 * rendered invoice, a sheet of passport photos — so the writer only needs to
 * place JPEGs on pages. JPEG data goes in untouched (PDF reads it natively with
 * DCTDecode), which keeps files small and quality exactly as encoded. A few
 * dozen lines instead of a library, and nothing leaves the device.
 */

export const PAGE_SIZES = {
  a4: { label: 'A4', w: 595.28, h: 841.89 },
  letter: { label: 'Letter', w: 612, h: 792 },
} as const;

export type PaperSize = keyof typeof PAGE_SIZES;

export interface PdfImage {
  /** Baseline JPEG bytes, RGB. */
  jpeg: Uint8Array;
  /** Pixel size of the JPEG. */
  width: number;
  height: number;
  /** Placement on the page in points, from the bottom-left corner. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PdfPage { width: number; height: number; images: PdfImage[] }

const encoder = new TextEncoder();

export function buildPdf(pages: PdfPage[], title = 'Pocket Tools'): Uint8Array {
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (data: string | Uint8Array) => {
    const bytes = typeof data === 'string' ? encoder.encode(data) : data;
    chunks.push(bytes);
    length += bytes.length;
  };
  const f = (n: number) => String(Math.round(n * 100) / 100);

  // Object numbers: 1 catalog, 2 pages, 3 info, then per page: page, content, images…
  let next = 4;
  const plan = pages.map((page) => {
    const pageId = next++;
    const contentId = next++;
    const imageIds = page.images.map(() => next++);
    return { page, pageId, contentId, imageIds };
  });

  const object = (id: number, body: string | (() => void)) => {
    offsets[id] = length;
    push(`${id} 0 obj\n`);
    if (typeof body === 'string') push(body);
    else body();
    push('\nendobj\n');
  };

  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, `<< /Type /Pages /Kids [${plan.map((p) => `${p.pageId} 0 R`).join(' ')}] /Count ${plan.length} >>`);
  const safeTitle = title.replace(/[()\\]/g, '').replace(/[^\x20-\x7E]/g, '');
  object(3, `<< /Title (${safeTitle}) /Producer (Pocket Tools) >>`);

  for (const { page, pageId, contentId, imageIds } of plan) {
    const xobjects = imageIds.map((id, i) => `/Im${i} ${id} 0 R`).join(' ');
    object(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${f(page.width)} ${f(page.height)}] /Resources << /XObject << ${xobjects} >> >> /Contents ${contentId} 0 R >>`);
    const content = page.images.map((img, i) => `q ${f(img.w)} 0 0 ${f(img.h)} ${f(img.x)} ${f(img.y)} cm /Im${i} Do Q`).join('\n');
    object(contentId, `<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream`);
    page.images.forEach((img, i) => {
      object(imageIds[i], () => {
        push(`<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.jpeg.length} >>\nstream\n`);
        push(img.jpeg);
        push('\nendstream');
      });
    });
  }

  const xref = length;
  const count = next;
  let table = `xref\n0 ${count}\n0000000000 65535 f \n`;
  for (let id = 1; id < count; id += 1) table += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  push(table);
  push(`trailer\n<< /Size ${count} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let at = 0;
  for (const chunk of chunks) { out.set(chunk, at); at += chunk.length; }
  return out;
}

/** Where an image goes on a page: as large as fits inside the margins, centred. */
export function fitOnPage(imgW: number, imgH: number, pageW: number, pageH: number, margin: number) {
  const boxW = pageW - margin * 2;
  const boxH = pageH - margin * 2;
  const scale = Math.min(boxW / imgW, boxH / imgH);
  const w = imgW * scale;
  const h = imgH * scale;
  return { x: (pageW - w) / 2, y: (pageH - h) / 2, w, h };
}
