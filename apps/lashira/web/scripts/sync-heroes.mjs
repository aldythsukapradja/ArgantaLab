// Sync the Kingdom Heroes rendering engine into LashiraBloom, so improvements you
// make to Heroes (the avatar compositor + control/movement feel) propagate here.
// Run after updating apps/kingdom/web:
//     node apps/lashira/web/scripts/sync-heroes.mjs
// Mirrors the repo's Kingdom->arena sync convention (apps/web/scripts/sync-arena.mjs).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../../..');            // .../ArgantaLab
const from = resolve(repo, 'apps/kingdom/web/src');
const to = resolve(repo, 'apps/lashira/web/src');

// The engine files are copied verbatim (the composited-avatar renderer). The
// control cluster + unit-frame *visual design* is intentionally matched in
// LashiraBloom's own styles.css; when you restyle the Heroes HUD, re-copy those
// classes (see the REFERENCE dump below to diff against).
const ENGINE = ['engine/compositor.js', 'engine/data.js', 'engine/palettes.js'];

let changed = 0;
for (const rel of ENGINE) {
  const src = resolve(from, rel), dst = resolve(to, rel);
  if (!existsSync(src)) { console.warn('! missing in kingdom:', rel); continue; }
  const a = readFileSync(src, 'utf8');
  const b = existsSync(dst) ? readFileSync(dst, 'utf8') : null;
  if (a !== b) { mkdirSync(dirname(dst), { recursive: true }); writeFileSync(dst, a); console.log('updated', rel); changed++; }
  else console.log('unchanged', rel);
}

// Dump Kingdom's styles.css as a read-only reference so you can diff the HUD /
// controller classes (.unit-frame, .cluster, .skill-circle, .attack-circle,
// .stick-zone) after a Heroes restyle, then port the deltas into styles.css.
const kStyles = resolve(from, 'styles.css');
if (existsSync(kStyles)) {
  const dst = resolve(to, 'heroes-hud.reference.css');
  writeFileSync(dst, '/* AUTO-DUMPED from apps/kingdom/web/src/styles.css — reference only, not imported.\n   Diff the HUD/controller classes here after a Heroes restyle, then port to styles.css. */\n\n' + readFileSync(kStyles, 'utf8'));
  console.log('wrote heroes-hud.reference.css');
}

console.log(changed ? `\n✓ synced ${changed} engine file(s) from Kingdom Heroes.` : '\n✓ already up to date with Kingdom Heroes.');
