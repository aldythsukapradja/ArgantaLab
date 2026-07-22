// Extracts the DESIGNER_STUDIO_URL (self-contained COSMO Designer Studio data: URL)
// verbatim from public/cosmo/index.html into src/cosmo/designer-studio-url.ts.
import { readFileSync, writeFileSync } from 'node:fs';
const src = readFileSync('public/cosmo/index.html', 'utf8');
const m = src.match(/const DESIGNER_STUDIO_URL=('[^']*');/);
if (!m) { console.error('DESIGNER_STUDIO_URL not found'); process.exit(1); }
const literal = m[1].slice(1, -1); // strip the single quotes
const out =
  `// AUTO-EXTRACTED verbatim from COSMO_Final.html — the embedded COSMO Designer Studio\n` +
  `// (self-contained data: URL). Do not hand-edit; re-run scripts/extract-designer-url.mjs.\n` +
  `export const DESIGNER_STUDIO_URL = ${JSON.stringify(literal)};\n`;
writeFileSync('src/cosmo/designer-studio-url.ts', out);
console.log('wrote src/cosmo/designer-studio-url.ts · base64 length', literal.length);
