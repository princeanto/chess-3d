/**
 * Pulling a palette out of an image.
 *
 * Counting identical pixels does not work: a screenshot of a gradient, a JPEG,
 * or anything anti-aliased has thousands of near-identical colours and the
 * "most common" one is an arbitrary member of a cloud. So the pixels are
 * clustered instead, and clustered in OKLab rather than RGB — RGB distance does
 * not match what the eye calls "the same colour", and clustering in it merges
 * colours that plainly differ while splitting ones that plainly do not.
 *
 * Runs entirely in the browser. No upload, no API, no cost.
 */

import { gamutMap } from './color/gamut';
import { deltaEOK, rgbToOklab, rgbToOklch, type Oklab } from './color/oklab';
import { toHex, type RGB } from './color/srgb';

export interface ExtractedColour {
  hex: string;
  /** Share of sampled pixels in this cluster, 0..1. */
  weight: number;
}

/** Longest edge the image is sampled at. Beyond this is wasted work. */
const SAMPLE_EDGE = 220;
const ITERATIONS = 14;

/**
 * Loads a file into an image element and hands back the object URL alongside
 * it. The caller owns that URL and must revoke it — revoking here would be
 * tidier but breaks any preview still pointing at it, which is exactly what
 * happened the first time.
 */
export async function loadImage(
  file: File | Blob,
): Promise<{ img: HTMLImageElement; url: string }> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('That file could not be read as an image.'));
      img.src = url;
    });
    return { img, url };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

function samplePixels(img: HTMLImageElement): Oklab[] {
  const scale = Math.min(1, SAMPLE_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('This browser will not give us a canvas to read the image with.');
  ctx.drawImage(img, 0, 0, w, h);

  const { data } = ctx.getImageData(0, 0, w, h);
  const out: Oklab[] = [];
  for (let i = 0; i < data.length; i += 4) {
    // Skip anything meaningfully transparent — its colour is not really on screen.
    if (data[i + 3] < 200) continue;
    out.push(
      rgbToOklab({ r: data[i] / 255, g: data[i + 1] / 255, b: data[i + 2] / 255 }),
    );
  }
  return out;
}

/** k-means++ seeding — plain random seeds give visibly different results per run. */
function seed(points: Oklab[], k: number): Oklab[] {
  const centroids: Oklab[] = [points[Math.floor(Math.random() * points.length)]];
  while (centroids.length < k) {
    const distances = points.map((p) =>
      Math.min(...centroids.map((c) => deltaEOK(p, c) ** 2)),
    );
    const total = distances.reduce((a, b) => a + b, 0);
    if (total <= 0) break;
    let r = Math.random() * total;
    let chosen = points[points.length - 1];
    for (let i = 0; i < points.length; i += 1) {
      r -= distances[i];
      if (r <= 0) {
        chosen = points[i];
        break;
      }
    }
    centroids.push(chosen);
  }
  return centroids;
}

export function extractFromImage(img: HTMLImageElement, count = 8): ExtractedColour[] {
  const points = samplePixels(img);
  if (points.length === 0) return [];

  const k = Math.min(count, points.length);
  let centroids = seed(points, k);
  const assignment = new Int32Array(points.length);

  for (let iter = 0; iter < ITERATIONS; iter += 1) {
    let moved = false;
    for (let i = 0; i < points.length; i += 1) {
      let best = 0;
      let bestDist = Infinity;
      for (let c = 0; c < centroids.length; c += 1) {
        const d = deltaEOK(points[i], centroids[c]);
        if (d < bestDist) {
          bestDist = d;
          best = c;
        }
      }
      if (assignment[i] !== best) {
        assignment[i] = best;
        moved = true;
      }
    }

    const sums = centroids.map(() => ({ L: 0, a: 0, b: 0, n: 0 }));
    for (let i = 0; i < points.length; i += 1) {
      const s = sums[assignment[i]];
      s.L += points[i].L;
      s.a += points[i].a;
      s.b += points[i].b;
      s.n += 1;
    }
    centroids = sums.map((s, i) =>
      s.n === 0 ? centroids[i] : { L: s.L / s.n, a: s.a / s.n, b: s.b / s.n },
    );

    if (!moved) break; // converged
  }

  const counts = new Array(centroids.length).fill(0);
  for (let i = 0; i < points.length; i += 1) counts[assignment[i]] += 1;

  const results: ExtractedColour[] = centroids
    .map((c, i) => ({ lab: c, weight: counts[i] / points.length }))
    .filter((c) => c.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .map(({ lab, weight }) => ({
      // A cluster centroid is an average of real pixels, so it is normally in
      // gamut — but averaging can drift slightly outside it, and mapping costs
      // nothing when it is already inside.
      hex: gamutMap(rgbToOklch(oklabAsRgb(lab))).hex,
      weight,
    }));

  return dedupe(results);
}

/** OKLab straight back to (possibly out-of-gamut) sRGB, for gamut mapping. */
function oklabAsRgb(lab: Oklab): RGB {
  const l_ = lab.L + 0.3963377774 * lab.a + 0.2158037573 * lab.b;
  const m_ = lab.L - 0.1055613458 * lab.a - 0.0638541728 * lab.b;
  const s_ = lab.L - 0.0894841775 * lab.a - 1.291485548 * lab.b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  const lin = {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  };
  const enc = (c: number) =>
    c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(Math.max(c, 0), 1 / 2.4) - 0.055;
  return { r: enc(lin.r), g: enc(lin.g), b: enc(lin.b) };
}

/** Merge clusters that landed on perceptually the same colour. */
function dedupe(list: ExtractedColour[], threshold = 0.035): ExtractedColour[] {
  const out: ExtractedColour[] = [];
  for (const item of list) {
    const near = out.find((kept) => {
      const a = rgbToOklab(hexToRgbSafe(kept.hex));
      const b = rgbToOklab(hexToRgbSafe(item.hex));
      return deltaEOK(a, b) < threshold;
    });
    if (near) near.weight += item.weight;
    else out.push({ ...item });
  }
  return out;
}

function hexToRgbSafe(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

/**
 * Guesses names and roles from cluster weight. The colour covering most of a
 * screenshot is almost always the page background; the rarest strongly-coloured
 * ones are accents. Wrong sometimes, and every guess is editable.
 */
export function nameExtracted(colours: ExtractedColour[]): Array<{
  name: string;
  hex: string;
  role: 'both' | 'text' | 'surface';
}> {
  return colours.map((c, i) => {
    const lch = rgbToOklch(hexToRgbSafe(c.hex));
    const dominant = c.weight > 0.18;
    const vivid = lch.C > 0.08;

    let name: string;
    if (i === 0) name = 'background';
    else if (dominant && !vivid) name = `surface-${i + 1}`;
    else if (vivid) name = `accent-${i}`;
    else name = lch.L < 0.5 ? `text-${i}` : `tint-${i}`;

    return {
      name,
      hex: c.hex,
      role: dominant && !vivid ? 'surface' : 'both',
    };
  });
}

export { toHex };
