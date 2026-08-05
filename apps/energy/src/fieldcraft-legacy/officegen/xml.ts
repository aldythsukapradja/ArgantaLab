/** Shared OOXML helpers for the PPTX and DOCX writers. */

export const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

/**
 * Drop every codepoint XML 1.0 forbids.
 *
 * A single stray control character makes PowerPoint reject the whole package
 * with a generic "found a problem with content" repair prompt and no clue which
 * part is at fault, so this is a filter rather than an escape. Iterating by
 * codepoint (not by UTF-16 unit) keeps surrogate pairs — emoji, CJK extensions
 * — intact instead of splitting them into invalid halves.
 */
export function cleanText(value: unknown): string {
  const input = String(value ?? '');
  let out = '';
  for (const ch of input) {
    const c = ch.codePointAt(0) as number;
    const legal =
      c === 0x09 || c === 0x0a || c === 0x0d ||
      (c >= 0x20 && c <= 0xd7ff) ||
      (c >= 0xe000 && c <= 0xfffd) ||
      (c >= 0x10000 && c <= 0x10ffff);
    if (legal) out += ch;
  }
  return out;
}

/** Escape for XML text nodes and attribute values. */
export function esc(value: unknown): string {
  return cleanText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** English Metric Units - OOXML's absolute unit. 914400 per inch. */
export const EMU_PER_INCH = 914400;
export const inches = (n: number) => Math.round(n * EMU_PER_INCH);

/** Hex colour without the leading hash, upper-cased - how DrawingML wants it. */
export function srgb(hex: string | undefined, fallback = '0FB5A6'): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex ?? '');
  return (m ? m[1] : fallback).toUpperCase();
}
