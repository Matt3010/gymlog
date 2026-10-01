// Le icone dell'app, disegnate qui e scritte in public/: node scripts/icons.mjs
//
// Un manubrio chiaro su fondo scuro, lo stesso in tutte. Le «maskable» (Android
// le ritaglia a cerchio, a goccia, a quadrato) tengono il disegno dentro la
// zona sicura, il cerchio centrale di quattro quinti, quindi più piccolo;
// quella di Apple è piena, senza trasparenza, perché iOS gli tonda gli angoli da sé.
// Nessuna dipendenza: rettangoli smussati campionati 4×4 per pixel, e il PNG
// scritto a mano con zlib.

import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BACK = [14, 17, 22];
const INK = [242, 244, 247];

/** The dumbbell in a 512 box: [x, y, width, height, radius]. */
const SHAPES = [
  [80, 196, 40, 120, 14], // left outer plate
  [128, 160, 52, 192, 16], // left inner plate
  [120, 236, 272, 40, 0], // bar
  [332, 160, 52, 192, 16], // right inner plate
  [392, 196, 40, 120, 14], // right outer plate
];

function inside(x, y, [rx, ry, w, h, r]) {
  if (x < rx || y < ry || x > rx + w || y > ry + h) return false;
  const cx = Math.min(Math.max(x, rx + r), rx + w - r);
  const cy = Math.min(Math.max(y, ry + r), ry + h - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

/** RGB pixels of the icon at `size`, the drawing shrunk to `scale` around the centre. */
function draw(size, scale) {
  const pixels = Buffer.alloc(size * size * 3);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let covered = 0;
      for (let sy = 0; sy < 4; sy++) {
        for (let sx = 0; sx < 4; sx++) {
          // the pixel's sample in the 512 box, scaled about the centre
          const x = 256 + (((px + (sx + 0.5) / 4) / size) * 512 - 256) / scale;
          const y = 256 + (((py + (sy + 0.5) / 4) / size) * 512 - 256) / scale;
          if (SHAPES.some((shape) => inside(x, y, shape))) covered++;
        }
      }
      const t = covered / 16;
      for (let c = 0; c < 3; c++) pixels[(py * size + px) * 3 + c] = Math.round(BACK[c] * (1 - t) + INK[c] * t);
    }
  }
  return pixels;
}

const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});

function crc32(bytes) {
  let c = -1;
  for (const byte of bytes) c = CRC[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

function png(size, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8 bits, RGB, no interlace
  const rows = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) pixels.copy(rows, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}

const ICONS = [
  ['icona-192.png', 192, 1],
  ['icona-512.png', 512, 1],
  // the drawing spans 352 of 512 wide: at 0.72 it stays inside the safe circle (radius 204.8)
  ['icona-maskable-192.png', 192, 0.72],
  ['icona-maskable-512.png', 512, 0.72],
  ['apple-touch-icon.png', 180, 0.86],
];

for (const [file, size, scale] of ICONS) {
  writeFileSync(new URL(`../public/${file}`, import.meta.url), png(size, draw(size, scale)));
  console.log(`public/${file} ${size}×${size}`);
}
