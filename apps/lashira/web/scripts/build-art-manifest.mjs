// Query the WHOLE Kingdom Heroes pixel-art catalogue into one manifest — step 1 of
// the 1:1 art-mirror pipeline (Character Forge roadmap step 4). Every character
// part, mount, monster and effect is ONE sheet PNG (all its frames in a grid) +
// one palette-index PNG for re-dyeing — that single-sheet-per-part shape is what
// a "twin" actually replaces, confirmed against the real data (not per-frame files).
//
// Run:  node apps/lashira/web/scripts/build-art-manifest.mjs
// Reads apps/kingdom/data/client (source of truth); writes
// apps/lashira/web/art-mirror/mirror-manifest.json (consumed by the step-5
// scaffold script, which creates the placeholder mirror tree from this list).
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../../..');                       // .../ArgantaLab
const SRC = resolve(repo, 'apps/kingdom/data/client');
const OUT_DIR = resolve(here, '../art-mirror');
const OUT_FILE = resolve(OUT_DIR, 'mirror-manifest.json');

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const fileSize = (p) => (existsSync(p) ? statSync(p).size : 0);

// A part's replaceable unit = its sheet + idx_sheet (one color PNG, one palette-
// index PNG). Geometry (cell size, cols, frame_count) is preserved so a twin
// drawn at the same cell size composites identically through the shared engine.
function summarizePart(dir, p, { withMotions = true } = {}) {
  const motions = withMotions
    ? Object.entries(p.animations || {}).map(([name, steps]) => ({ name, steps: steps.length }))
    : undefined;
  return {
    id: p.id,
    sheet: p.sheet ?? null, idxSheet: p.idx_sheet ?? null,
    sheetBytes: p.sheet ? fileSize(join(dir, p.sheet)) : 0,
    idxBytes: p.idx_sheet ? fileSize(join(dir, p.idx_sheet)) : 0,
    cellW: p.cell_w, cellH: p.cell_h, cols: p.cols,
    frameCount: p.frame_count ?? p.frames?.length ?? 0,
    paletteId: p.palette_id ?? 0,
    ...(motions ? { motionCount: motions.length, motions } : {}),
  }
}

function summarizeCharCategory(cat) {
  const dir = resolve(SRC, 'char', cat)
  const parts = readJson(join(dir, 'parts.json'))
  let palettes = []
  try { palettes = readJson(join(dir, 'palettes.json')) } catch { /* none */ }
  return {
    kind: 'char', partCount: parts.length, paletteCount: palettes.length,
    parts: parts.map((p) => summarizePart(dir, p)),
  }
}

function summarizeFlatCollection(name, { withMotions = true, animKey = 'animations' } = {}) {
  const dir = resolve(SRC, name)
  const file = name === 'effects' ? 'effects.json' : 'parts.json'
  const raw = readJson(join(dir, file))
  let palettes = []
  try { palettes = readJson(join(dir, 'palettes.json')) } catch { /* none */ }
  const parts = raw.map((p) => {
    if (animKey === 'animation') {
      // effects store ONE flat animation array, not a name->steps map. A few ids
      // (72, 133, 134) are dud entries with no sheet at all — keep the id, skip file stats.
      return {
        id: p.id, sheet: p.sheet ?? null, idxSheet: p.idx_sheet ?? null,
        sheetBytes: p.sheet ? fileSize(join(dir, p.sheet)) : 0,
        idxBytes: p.idx_sheet ? fileSize(join(dir, p.idx_sheet)) : 0,
        cellW: p.cell_w, cellH: p.cell_h, cols: p.cols,
        frameCount: p.frames?.length ?? 0, animationSteps: p.animation?.length ?? 0,
      }
    }
    return summarizePart(dir, p, { withMotions })
  })
  return { kind: name, partCount: parts.length, paletteCount: palettes.length, parts }
}

console.log('Querying Kingdom Heroes art from', SRC)
if (!existsSync(SRC)) { console.error('! source data not found:', SRC); process.exit(1) }

const extractor = readJson(resolve(SRC, 'extractor-manifest.json'))
const CHAR_CATEGORIES = readdirSync(resolve(SRC, 'char')).filter((c) => statSync(resolve(SRC, 'char', c)).isDirectory())

const categories = {}
for (const cat of CHAR_CATEGORIES) {
  categories[cat] = summarizeCharCategory(cat)
  console.log(`  char/${cat}: ${categories[cat].partCount} parts, ${categories[cat].paletteCount} palettes`)
}

const mounts = summarizeFlatCollection('mounts')
const monsters = summarizeFlatCollection('monsters', { withMotions: false }) // 2013 parts — skip per-motion lists, keep the manifest lean
const effects = summarizeFlatCollection('effects', { animKey: 'animation' })
console.log(`  mounts: ${mounts.partCount}, monsters: ${monsters.partCount}, effects: ${effects.partCount}`)

const totals = {
  categories: CHAR_CATEGORIES.length,
  charParts: Object.values(categories).reduce((s, c) => s + c.partCount, 0),
  charSheetPngs: Object.values(categories).reduce((s, c) => s + c.parts.reduce((a, p) => a + (p.sheet ? 1 : 0) + (p.idxSheet ? 1 : 0), 0), 0),
  mounts: mounts.partCount, monsters: monsters.partCount, effects: effects.partCount,
  motions: extractor.motions?.length ?? 0, layers: extractor.layers?.length ?? 0,
}

const manifest = {
  generatedAt: new Date().toISOString(),
  sourceRoot: 'apps/kingdom/data/client',
  motions: extractor.motions ?? [],
  layers: extractor.layers ?? [],
  categories, mounts, monsters, effects, totals,
}

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(OUT_FILE, JSON.stringify(manifest, null, 1))
console.log('\nWrote', OUT_FILE)
console.log('Totals:', totals)
