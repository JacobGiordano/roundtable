#!/usr/bin/env node
/**
 * Roundtable favicon generator
 * Owner: Marque
 *
 * Generates /public/favicon.ico (16x16 and 32x32 PNG frames embedded in ICO)
 * and /public/icons/apple-touch-icon.png (180x180 PNG).
 *
 * The Roundtable mark: filled Indigo circle (#2D2B55) with white ring + 6 seat
 * dots + center dot. Constructed on a 48-unit grid.
 *
 * Run: node _design/brand/scripts/generate-favicon.js
 * Requires: Node 20+, no external dependencies (uses only Node built-ins +
 * Canvas API via node-canvas if available, otherwise writes pure-binary ICO).
 *
 * This script uses pure-binary PNG/ICO generation without external deps.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ─── Brand values ─────────────────────────────────────────────────────────────
const INDIGO = { r: 0x2D, g: 0x2B, b: 0x55, a: 0xFF };
const WHITE  = { r: 0xFF, g: 0xFF, b: 0xFF, a: 0xFF };

// ─── Mark geometry (48-unit grid, scaled to target px) ───────────────────────
function drawMark(pixels, size) {
  const cx = size / 2;
  const cy = size / 2;
  const scale = size / 48;

  // Outer circle radius 22 (in 48-unit space)
  const outerR = 22 * scale;
  // Ring radius 14, stroke-width 2 (half = 1)
  const ringR  = 14 * scale;
  const ringHalfStroke = 1 * scale;
  // Seat dot radius 3
  const seatDotR = 3 * scale;
  // Center dot radius 3.5
  const centerDotR = 3.5 * scale;

  // Seat dot positions (pointy-top hexagonal, r=14 from center)
  const seatPositions = [
    [24,    10   ],
    [36.12, 17   ],
    [36.12, 31   ],
    [24,    38   ],
    [11.88, 31   ],
    [11.88, 17   ],
  ].map(([x, y]) => [(x - 24) * scale + cx, (y - 24) * scale + cy]);

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const dx = px - cx + 0.5;  // +0.5 for pixel center
      const dy = py - cy + 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy);

      let color = null;

      // 1. Outer filled circle (Indigo background)
      if (dist <= outerR) {
        color = INDIGO;
      }

      // 2. Ring (white stroked circle at ringR) — annular region
      if (color && dist >= ringR - ringHalfStroke && dist <= ringR + ringHalfStroke) {
        color = WHITE;
      }

      // 3. Seat dots (white filled circles)
      if (color) {
        for (const [sx, sy] of seatPositions) {
          const sdx = px - sx + 0.5;
          const sdy = py - sy + 0.5;
          if (Math.sqrt(sdx * sdx + sdy * sdy) <= seatDotR) {
            color = WHITE;
            break;
          }
        }
      }

      // 4. Center dot (white)
      if (color) {
        const cdx = dx;
        const cdy = dy;
        if (Math.sqrt(cdx * cdx + cdy * cdy) <= centerDotR) {
          color = WHITE;
        }
      }

      if (color) {
        const i = (py * size + px) * 4;
        pixels[i + 0] = color.r;
        pixels[i + 1] = color.g;
        pixels[i + 2] = color.b;
        pixels[i + 3] = color.a;
      }
      // else: transparent (already 0)
    }
  }
}

// ─── Pure-binary PNG encoder ──────────────────────────────────────────────────
function encodePNG(size, pixels) {
  // PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function chunk(type, data) {
    const typeBuf = Buffer.from(type, 'ascii');
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([typeBuf, data]);
    const crc = crc32(body);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeInt32BE(crc | 0);
    return Buffer.concat([len, body, crcBuf]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // IDAT: filter byte 0 (None) per scanline
  const rawRows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    row[0] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      const si = (y * size + x) * 4;
      row[1 + x * 4 + 0] = pixels[si + 0];
      row[1 + x * 4 + 1] = pixels[si + 1];
      row[1 + x * 4 + 2] = pixels[si + 2];
      row[1 + x * 4 + 3] = pixels[si + 3];
    }
    rawRows.push(row);
  }
  const raw = Buffer.concat(rawRows);
  const compressed = zlib.deflateSync(raw, { level: 9 });

  // IEND
  const iend = Buffer.alloc(0);

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', iend),
  ]);
}

// ─── CRC-32 ───────────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  }
  return (c ^ -1) >>> 0;
}

// ─── ICO encoder (multi-size) ─────────────────────────────────────────────────
function encodeICO(pngBuffers) {
  // ICO header: 6 bytes
  // Per-image directory entry: 16 bytes each
  // Then PNG data for each image

  const count = pngBuffers.length;
  const headerSize = 6 + count * 16;

  let offset = headerSize;
  const entries = pngBuffers.map((png, i) => {
    const size = [16, 32][i];
    const entry = { size, offset, length: png.length };
    offset += png.length;
    return entry;
  });

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: ICO
  header.writeUInt16LE(count, 4);

  const dirs = entries.map(({ size, offset, length }) => {
    const d = Buffer.alloc(16);
    d[0] = size === 256 ? 0 : size; // width (0 = 256)
    d[1] = size === 256 ? 0 : size; // height
    d[2] = 0;  // color count
    d[3] = 0;  // reserved
    d.writeUInt16LE(1, 4);  // color planes
    d.writeUInt16LE(32, 6); // bits per pixel
    d.writeUInt32LE(length, 8);
    d.writeUInt32LE(offset, 12);
    return d;
  });

  return Buffer.concat([header, ...dirs, ...pngBuffers]);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const sizes = {
  ico: [16, 32],
  appleTouchIcon: 180,
};

const pngBuffers = sizes.ico.map(size => {
  const pixels = new Uint8Array(size * size * 4);
  drawMark(pixels, size);
  return encodePNG(size, pixels);
});

const ico = encodeICO(pngBuffers);

const root = path.resolve(__dirname, '../../..');
fs.writeFileSync(path.join(root, 'public', 'favicon.ico'), ico);
console.log('Written: public/favicon.ico (16x16 + 32x32 PNG frames)');

// apple-touch-icon at 180px
{
  const size = sizes.appleTouchIcon;
  const pixels = new Uint8Array(size * size * 4);
  drawMark(pixels, size);
  const png = encodePNG(size, pixels);
  fs.writeFileSync(path.join(root, 'public', 'icons', 'apple-touch-icon.png'), png);
  console.log('Written: public/icons/apple-touch-icon.png (180x180)');
}

console.log('Done. Favicon assets generated.');
