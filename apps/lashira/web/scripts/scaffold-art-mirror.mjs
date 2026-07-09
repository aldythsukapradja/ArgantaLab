// Step 5 of the art-mirror pipeline: scaffold a 1:1 LashiraBloom twin of the
// Kingdom Heroes art tree — same relative paths, same filenames, one file per
// real sheet/idx-sheet slot (2,895 char parts + 53 mounts + 2,013 monsters + 648
// effects = 11,212 files) — so a real replacement is a same-name file drop, zero
// code change.
//
// Engineering note: the real catalogue is ~10 BILLION pixels across those files
// (one monster sheet alone is 13220×8040px) — rendering real-size placeholder
// bitmaps for all of them would mean tens of GB of raster work for content nobody
// will look at (it exists only to be replaced). So every slot gets a copy of ONE
// small shared "missing art" marker (a magenta/black checker — the standard
// missing-texture convention) at its correct path; the REAL expected dimensions
// live in mirror-manifest.json (step 4) for validation when real art lands.
// "Replaced" detection needs no extra bookkeeping: a slot counts as done the
// moment its file no longer matches the marker's bytes (see report-art-mirror.mjs).
//
// Run:  node apps/lashira/web/scripts/build-art-manifest.mjs   (step 4, if stale)
//       node apps/lashira/web/scripts/scaffold-art-mirror.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { encodePNG } from './lib/minipng.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(here, '../art-mirror')
const MANIFEST = resolve(OUT_DIR, 'mirror-manifest.json')

if (!existsSync(MANIFEST)) {
  console.error('! mirror-manifest.json not found — run build-art-manifest.mjs first')
  process.exit(1)
}
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))

// One shared marker per kind: a 32x32 magenta/black checker for color sheets
// (the industry "missing texture" convention — unmistakable at a glance), and a
// flat mid-index gray for idx sheets (only consulted when a custom dye is picked;
// index 1 is a safe in-range default across every real palette we queried).
const MARK_SIZE = 32
const colorMarker = encodePNG(MARK_SIZE, MARK_SIZE, (x, y) => {
  const on = ((x >> 3) + (y >> 3)) % 2 === 0
  return on ? [214, 0, 214, 255] : [20, 20, 24, 255] // magenta / near-black
})
const idxMarker = encodePNG(MARK_SIZE, MARK_SIZE, () => [1, 0, 0, 255]) // R channel = palette index 1

const sharedDir = resolve(OUT_DIR, '_shared')
mkdirSync(sharedDir, { recursive: true })
writeFileSync(join(sharedDir, 'missing.png'), colorMarker)
writeFileSync(join(sharedDir, 'missing.idx.png'), idxMarker)

let written = 0, skippedDud = 0
function stampSlot(dir, sheet, idxSheet) {
  mkdirSync(dir, { recursive: true })
  if (sheet) { writeFileSync(join(dir, sheet), colorMarker); written++ }
  if (idxSheet) { writeFileSync(join(dir, idxSheet), idxMarker); written++ }
  if (!sheet) skippedDud++
}

for (const [cat, coll] of Object.entries(manifest.categories)) {
  const dir = resolve(OUT_DIR, 'char', cat)
  for (const p of coll.parts) stampSlot(dir, p.sheet, p.idxSheet)
}
for (const p of manifest.mounts.parts) stampSlot(resolve(OUT_DIR, 'mounts'), p.sheet, p.idxSheet)
for (const p of manifest.monsters.parts) stampSlot(resolve(OUT_DIR, 'monsters'), p.sheet, p.idxSheet)
for (const p of manifest.effects.parts) stampSlot(resolve(OUT_DIR, 'effects'), p.sheet, p.idxSheet)

// A tiny status file — total slots vs the marker bytes, so a report script (or the
// future HQ art-mirror UI) can show "X / 11,212 replaced" without re-walking the
// whole manifest each time.
const status = {
  generatedAt: new Date().toISOString(),
  markerBytes: { color: colorMarker.length, idx: idxMarker.length },
  totalSlots: written, skippedDudEffects: skippedDud,
}
writeFileSync(resolve(OUT_DIR, 'status.json'), JSON.stringify(status, null, 1))

console.log(`Stamped ${written} placeholder files (skipped ${skippedDud} dud effect entries with no sheet).`)
console.log('Marker:', join(sharedDir, 'missing.png'), `(${colorMarker.length}B)`, '/', join(sharedDir, 'missing.idx.png'), `(${idxMarker.length}B)`)
console.log('Tree root:', OUT_DIR)
