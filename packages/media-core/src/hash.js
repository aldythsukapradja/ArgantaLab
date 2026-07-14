// Pure-JS, isomorphic content hash for provenance/dedup. NOT cryptographic —
// it's a stable fingerprint of produced bytes so lineage can show a checksum and
// dedup can key on it, in both Node and the browser bundle (no node:crypto).
// FNV-1a 64-bit (two 32-bit lanes) rendered as 16 hex chars.

/** @param {Uint8Array} bytes @returns {string|null} */
export function checksum(bytes) {
  if (!bytes || bytes.length === 0) return null;
  let h1 = 0x811c9dc5, h2 = 0x811c9dc5 ^ 0x9e3779b9;
  for (let i = 0; i < bytes.length; i++) {
    h1 ^= bytes[i]; h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= bytes[i] + i; h2 = Math.imul(h2, 0x01000193) >>> 0;
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}
