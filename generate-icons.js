/**
 * generate-icons.js — TabNirvana icon generator
 * Zero npm dependencies. Only uses Node.js built-in `zlib`.
 * Run: node generate-icons.js
 */

'use strict';
const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

// ─────────────────────────────────────────────
// CRC-32 (required by PNG format)
// ─────────────────────────────────────────────
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[i] = c;
}
function crc32(buf) {
  let v = 0xffffffff;
  for (const b of buf) v = CRC_TABLE[(v ^ b) & 0xff] ^ (v >>> 8);
  return (v ^ 0xffffffff) >>> 0;
}

// ─────────────────────────────────────────────
// Minimal RGBA PNG encoder
// ─────────────────────────────────────────────
function encodePNG(w, h, rgba) {
  function chunk(type, data) {
    const t = Buffer.from(type, 'ascii');
    const d = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const len = Buffer.allocUnsafe(4); len.writeUInt32BE(d.length, 0);
    const crcBuf = Buffer.allocUnsafe(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([t, d])), 0);
    return Buffer.concat([len, t, d, crcBuf]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA

  // Raw scanlines: filter byte (0 = None) + 4 bytes per pixel
  const rowLen = 1 + w * 4;
  const raw = Buffer.alloc(h * rowLen);
  for (let y = 0; y < h; y++) {
    raw[y * rowLen] = 0;
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4;
      const d = y * rowLen + 1 + x * 4;
      raw[d] = rgba[s]; raw[d+1] = rgba[s+1]; raw[d+2] = rgba[s+2]; raw[d+3] = rgba[s+3];
    }
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ─────────────────────────────────────────────
// Pixel-level canvas
// ─────────────────────────────────────────────
function makeCanvas(size) {
  const buf = new Uint8ClampedArray(size * size * 4); // transparent

  /** Alpha-composite (r,g,b,a) onto the pixel at (x,y) */
  function put(x, y, r, g, b, a) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || x >= size || y < 0 || y >= size || a <= 0) return;
    const i  = (y * size + x) * 4;
    const sa = a / 255;
    const da = buf[i + 3] / 255;
    const oa = sa + da * (1 - sa);
    if (oa < 0.001) return;
    buf[i]   = Math.round((r * sa + buf[i]     * da * (1 - sa)) / oa);
    buf[i+1] = Math.round((g * sa + buf[i + 1] * da * (1 - sa)) / oa);
    buf[i+2] = Math.round((b * sa + buf[i + 2] * da * (1 - sa)) / oa);
    buf[i+3] = Math.round(oa * 255);
  }

  /** Fill an axis-aligned rectangle */
  function fillRect(x, y, w, h, r, g, b, a = 255) {
    for (let dy = 0; dy < h; dy++)
      for (let dx = 0; dx < w; dx++)
        put(x + dx, y + dy, r, g, b, a);
  }

  return { buf, put, fillRect };
}

// ─────────────────────────────────────────────
// Icon design
//
// Visual:  indigo gradient rounded-square background
//          + white monitor outline + stand
// ─────────────────────────────────────────────
function renderIcon(size) {
  const { buf, put, fillRect } = makeCanvas(size);

  // ── Background: indigo gradient, rounded corners ──
  // Top colour #818cf8  → bottom colour #4f46e5
  const topRGB    = [129, 140, 248];
  const bottomRGB = [79,  70,  229];
  const cr = size * 0.2; // corner radius

  for (let py = 0; py < size; py++) {
    // Interpolate gradient colour for this row
    const t  = py / (size - 1);
    const br = Math.round(topRGB[0] + (bottomRGB[0] - topRGB[0]) * t);
    const bg = Math.round(topRGB[1] + (bottomRGB[1] - topRGB[1]) * t);
    const bb = Math.round(topRGB[2] + (bottomRGB[2] - topRGB[2]) * t);

    for (let px = 0; px < size; px++) {
      // Signed-distance field for rounded rectangle (sub-pixel centre sampling)
      const ncx = Math.max(cr, Math.min(size - cr, px + 0.5));
      const ncy = Math.max(cr, Math.min(size - cr, py + 0.5));
      const d   = Math.hypot((px + 0.5) - ncx, (py + 0.5) - ncy);

      if (d < cr + 0.5) {
        // Soft anti-aliased edge
        const alpha = Math.min(255, Math.round((cr + 0.5 - d) * 255));
        put(px, py, br, bg, bb, alpha);
      }
    }
  }

  // ── White monitor icon ──────────────────────
  const lw  = Math.max(1, Math.round(size * 0.08)); // stroke width
  const pad = Math.round(size * 0.16);
  const mw  = size - pad * 2;                       // monitor width
  const mh  = Math.round(mw * 0.62);                // monitor height
  const mx  = pad;
  const my  = Math.round(size * 0.12);

  // Four sides of the monitor
  fillRect(mx,           my,            mw, lw, 255, 255, 255); // top
  fillRect(mx,           my + mh - lw,  mw, lw, 255, 255, 255); // bottom
  fillRect(mx,           my,            lw, mh, 255, 255, 255); // left
  fillRect(mx + mw - lw, my,            lw, mh, 255, 255, 255); // right

  // Stand: two legs + horizontal base
  const sx1 = Math.round(size * 0.34);
  const sx2 = Math.round(size * 0.66);
  const sy1 = my + mh;
  const sy2 = Math.round(size * 0.87);
  fillRect(sx1,      sy1, lw, sy2 - sy1,    255, 255, 255); // left leg
  fillRect(sx2 - lw, sy1, lw, sy2 - sy1,    255, 255, 255); // right leg
  fillRect(sx1,      sy2, sx2 - sx1, lw,    255, 255, 255); // base

  return buf;
}

// ─────────────────────────────────────────────
// Generate & save
// ─────────────────────────────────────────────
const assetsDir = path.join(__dirname, 'assets');
fs.mkdirSync(assetsDir, { recursive: true });

for (const size of [16, 48, 128]) {
  const pixels  = renderIcon(size);
  const png     = encodePNG(size, size, pixels);
  const outPath = path.join(assetsDir, `icon${size}.png`);
  fs.writeFileSync(outPath, png);
  console.log(`✓  assets/icon${size}.png  (${size}×${size},  ${png.length} bytes)`);
}

console.log('\nDone — no npm packages required.');
