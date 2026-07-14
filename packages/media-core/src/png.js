// Minimal, dependency-free, ISOMORPHIC PNG encoder (RGBA, 8-bit). Pure JS with
// NO node:zlib / Buffer — runs identically in Node and the browser bundle, so
// the same deterministic bytes come out of `node demo.js` and the HQ Media
// Center. Uses uncompressed ("stored") DEFLATE blocks: valid, deterministic,
// slightly larger files — perfectly fine for Stage-0 placeholder art.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(bytes) {
  let a = 1, b = 0;
  for (let i = 0; i < bytes.length; i++) { a = (a + bytes[i]) % 65521; b = (b + a) % 65521; }
  return ((b << 16) | a) >>> 0;
}

// zlib stream wrapping a raw DEFLATE of only stored (uncompressed) blocks.
function zlibStore(data) {
  const MAX = 65535;
  const nBlocks = Math.max(1, Math.ceil(data.length / MAX));
  const out = new Uint8Array(2 + data.length + nBlocks * 5 + 4);
  let p = 0;
  out[p++] = 0x78; out[p++] = 0x01; // zlib header (no dict, default)
  for (let i = 0; i < data.length || (i === 0 && data.length === 0); i += MAX) {
    const len = Math.min(MAX, data.length - i);
    const final = i + MAX >= data.length ? 1 : 0;
    out[p++] = final;                 // BFINAL, BTYPE=00 (stored)
    out[p++] = len & 0xff; out[p++] = (len >>> 8) & 0xff;         // LEN
    out[p++] = ~len & 0xff; out[p++] = (~len >>> 8) & 0xff;       // NLEN
    out.set(data.subarray(i, i + len), p); p += len;
    if (data.length === 0) break;
  }
  const ad = adler32(data);
  out[p++] = (ad >>> 24) & 0xff; out[p++] = (ad >>> 16) & 0xff;
  out[p++] = (ad >>> 8) & 0xff; out[p++] = ad & 0xff;
  return out.subarray(0, p);
}

function u32(n) { return new Uint8Array([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]); }

function chunk(type, data) {
  const typeBytes = new Uint8Array([type.charCodeAt(0), type.charCodeAt(1), type.charCodeAt(2), type.charCodeAt(3)]);
  const body = new Uint8Array(typeBytes.length + data.length);
  body.set(typeBytes, 0); body.set(data, typeBytes.length);
  const out = new Uint8Array(4 + body.length + 4);
  out.set(u32(data.length), 0);
  out.set(body, 4);
  out.set(u32(crc32(body)), 4 + body.length);
  return out;
}

function concat(parts) {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

/**
 * Encode an RGBA pixel buffer to a PNG.
 * @param {number} width
 * @param {number} height
 * @param {Uint8Array} rgba  length must be width*height*4
 * @returns {Uint8Array}
 */
export function encodePNG(width, height, rgba) {
  if (rgba.length !== width * height * 4) throw new Error(`rgba length ${rgba.length} != ${width}*${height}*4`);
  const sig = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = new Uint8Array(13);
  ihdr.set(u32(width), 0); ihdr.set(u32(height), 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // 8-bit RGBA

  const stride = width * 4;
  const raw = new Uint8Array((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    raw.set(rgba.subarray(y * stride, y * stride + stride), y * (stride + 1) + 1);
  }

  return concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlibStore(raw)), chunk('IEND', new Uint8Array(0))]);
}
