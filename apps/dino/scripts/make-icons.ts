/**
 * Writes the PWA icons as real PNGs.
 *
 * A manifest that points at an SVG is accepted by some browsers and quietly
 * ignored by others, and "install" then offers a blank tile. Rather than take a
 * dependency on an image library for three flat squares, the PNGs are encoded
 * here: raw RGBA scanlines, deflated with zlib, wrapped in IHDR/IDAT/IEND.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

function crc32(buf: Buffer): number {
  let c: number;
  const table: number[] = [];
  for (let n = 0; n < 256; n += 1) {
    c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function png(size: number, draw: (x: number, y: number) => [number, number, number]): Buffer {
  // Each scanline is prefixed with a filter byte; 0 means "no filter".
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let o = 0;
  for (let y = 0; y < size; y += 1) {
    raw[o] = 0;
    o += 1;
    for (let x = 0; x < size; x += 1) {
      const [r, g, b] = draw(x, y);
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      raw[o + 3] = 255;
      o += 4;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const SAND: [number, number, number] = [242, 239, 233];
const INK: [number, number, number] = [38, 39, 43];

/** A blocky runner silhouette on sand, drawn on a 16x16 grid and scaled up. */
const GRID = [
  '................',
  '.........#####..',
  '.........##.###.',
  '.........#######',
  '.........#####..',
  '.........####...',
  '..#......####...',
  '..##...#######..',
  '..###.########..',
  '...###########..',
  '....##########..',
  '.....########...',
  '.....#######....',
  '.....##...##....',
  '.....##...##....',
  '................',
];

function draw(size: number, inset: number) {
  const cell = size / 16;
  return (x: number, y: number): [number, number, number] => {
    const gx = Math.floor(x / cell);
    const gy = Math.floor(y / cell);
    if (gy < 0 || gy > 15 || gx < 0 || gx > 15) return SAND;
    // `inset` shrinks the artwork so a maskable icon survives being cropped
    // to a circle on Android.
    if (inset > 0) {
      const m = size * inset;
      if (x < m || y < m || x > size - m || y > size - m) return SAND;
    }
    return GRID[gy][gx] === '#' ? INK : SAND;
  };
}

const out = join(process.cwd(), 'public');
writeFileSync(join(out, 'icon-192.png'), png(192, draw(192, 0)));
writeFileSync(join(out, 'icon-512.png'), png(512, draw(512, 0)));
writeFileSync(join(out, 'icon-maskable.png'), png(512, draw(512, 0.12)));
console.log('wrote icon-192.png, icon-512.png, icon-maskable.png');
