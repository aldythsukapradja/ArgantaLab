// Kingdom client-asset pipeline (Phase A1 of docs/BUILD-PLAN.md)
//
// Consolidates the two NexusTK client extractions into apps/kingdom/data/client/:
//   1. Claude extractor library (canonical colors, per-part animation data)
//      C:\Users\aldhy\OneDrive\Documents\Baginda's App\Nexus\app\assets\extracted
//   2. Codex "canonical/" slice (UI kit, world maps, field maps, misc effects)
//      C:\Users\aldhy\...\RPG\Prototype\assets\nexustk-client\pixel-art\canonical
//
// The Codex "needs-mapping/" tree is intentionally NOT copied — it is
// superseded (probe colors, no segmentation, no animations). See
// docs/CLIENT-ASSETS-AND-CHARACTER-LAB.md §1.
//
// Usage: node scripts/build-client.mjs [--force]
//   default: incremental (folder skipped when file count already matches)
//   --force: re-copy everything
//
// Output: data/client/** + data/client/manifest.json (provenance + counts)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KINGDOM = path.resolve(__dirname, '..');
const CLIENT = path.join(KINGDOM, 'data', 'client');

const CLAUDE_SRC =
  "C:/Users/aldhy/OneDrive/Documents/Baginda's App/Nexus/app/assets/extracted";
const CODEX_SRC =
  "C:/Users/aldhy/OneDrive/Documents/Baginda's App/RPG/Prototype/assets/nexustk-client/pixel-art/canonical";

const force = process.argv.includes('--force');

// dest (under data/client) -> { src, source: provenance tag }
const COPY_PLAN = [
  // Claude extractor — canonical char/creature/effect/item library
  ...[
    'char', 'monsters', 'mounts', 'effects', 'items', 'tiles', 'audio',
  ].map((name) => ({
    dest: name,
    src: path.join(CLAUDE_SRC, name),
    source: 'claude-extractor',
    optional: name === 'tiles' || name === 'audio', // arrive with Phase A2
  })),
  // Codex canonical — the three slices the Claude extractor skipped
  { dest: 'ui', src: path.join(CODEX_SRC, 'ui'), source: 'codex-canonical' },
  { dest: 'worldmaps', src: path.join(CODEX_SRC, 'maps', 'wm'), source: 'codex-canonical' },
  { dest: 'fieldmaps', src: path.join(CODEX_SRC, 'maps', 'misc'), source: 'codex-canonical' },
  { dest: 'effects-misc', src: path.join(CODEX_SRC, 'skill-effects', 'misc'), source: 'codex-canonical' },
];

function countFiles(dir) {
  if (!fs.existsSync(dir)) return 0;
  let n = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    n += e.isDirectory() ? countFiles(path.join(dir, e.name)) : 1;
  }
  return n;
}

function bytesOf(dir) {
  if (!fs.existsSync(dir)) return 0;
  let n = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    n += e.isDirectory() ? bytesOf(p) : fs.statSync(p).size;
  }
  return n;
}

fs.mkdirSync(CLIENT, { recursive: true });
fs.mkdirSync(path.join(KINGDOM, 'data', 'links'), { recursive: true });
fs.mkdirSync(path.join(KINGDOM, 'data', 'derived'), { recursive: true });

const manifest = {
  generated: new Date().toISOString(),
  sources: {
    'claude-extractor': CLAUDE_SRC,
    'codex-canonical': CODEX_SRC,
  },
  folders: {},
};

for (const job of COPY_PLAN) {
  const destPath = path.join(CLIENT, job.dest);
  if (!fs.existsSync(job.src)) {
    if (job.optional) {
      console.log(`  ~ ${job.dest}: source not present yet (optional, Phase A2)`);
      continue;
    }
    console.error(`  ! ${job.dest}: MISSING SOURCE ${job.src}`);
    process.exitCode = 1;
    continue;
  }
  const srcCount = countFiles(job.src);
  const destCount = countFiles(destPath);
  if (!force && destCount === srcCount && srcCount > 0) {
    console.log(`  = ${job.dest}: up to date (${srcCount} files)`);
  } else {
    const t0 = Date.now();
    fs.cpSync(job.src, destPath, { recursive: true, force: true });
    console.log(
      `  + ${job.dest}: copied ${srcCount} files (${((Date.now() - t0) / 1000).toFixed(1)}s)`
    );
  }
  manifest.folders[job.dest] = {
    source: job.source,
    files: countFiles(destPath),
    bytes: bytesOf(destPath),
  };
}

// surface the extractor's own manifest (motions, layers, haircol) at top level
const extractorManifest = path.join(CLAUDE_SRC, 'manifest.json');
if (fs.existsSync(extractorManifest)) {
  fs.copyFileSync(extractorManifest, path.join(CLIENT, 'extractor-manifest.json'));
  manifest.extractorManifest = 'extractor-manifest.json';
}

// headline counts for quick sanity checks (parts.json lengths)
manifest.counts = {};
for (const [key, rel] of Object.entries({
  monsters: 'monsters/parts.json',
  mounts: 'mounts/parts.json',
  effects: 'effects/effects.json',
})) {
  const p = path.join(CLIENT, rel);
  if (fs.existsSync(p)) manifest.counts[key] = JSON.parse(fs.readFileSync(p, 'utf8')).length;
}
const charDir = path.join(CLIENT, 'char');
if (fs.existsSync(charDir)) {
  let parts = 0;
  const perCat = {};
  for (const cat of fs.readdirSync(charDir)) {
    const pj = path.join(charDir, cat, 'parts.json');
    if (fs.existsSync(pj)) {
      perCat[cat] = JSON.parse(fs.readFileSync(pj, 'utf8')).length;
      parts += perCat[cat];
    }
  }
  manifest.counts.charParts = parts;
  manifest.counts.charByCategory = perCat;
}
const itemsJson = path.join(CLIENT, 'items', 'items.json');
if (fs.existsSync(itemsJson)) {
  manifest.counts.itemIcons = JSON.parse(fs.readFileSync(itemsJson, 'utf8')).count;
}

fs.writeFileSync(path.join(CLIENT, 'manifest.json'), JSON.stringify(manifest, null, 2));

const totalBytes = Object.values(manifest.folders).reduce((a, f) => a + f.bytes, 0);
console.log('\nmanifest counts:', JSON.stringify(manifest.counts));
console.log(`total: ${Object.values(manifest.folders).reduce((a, f) => a + f.files, 0)} files, ${(totalBytes / 1e6).toFixed(0)} MB`);
console.log('done -> data/client/manifest.json');
