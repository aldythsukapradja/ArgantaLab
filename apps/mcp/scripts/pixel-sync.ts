// Pixel Vault → Supabase sync. Uploads real pixel art into the private
// `pixel-art` bucket and upserts rows + palettes. Reuses the app's catalogue as
// the single source of truth. Idempotent (upsert everywhere), safe to re-run.
//
// Prereq: run supabase/migration_pixel_vault.sql once. Then:
//   cd apps/mcp
//   SUPABASE_URL=… SUPABASE_SERVICE_KEY=… npm run pixel-sync
//   (add FETCH_LOSPEC=1 to also pull the full Lospec palette library)
//
// Grow it: drop any art into apps/hq/public/pixel/import/ —
//   import/sheets/<pack>/*.png   → each spritesheet is sliced into tiles
//   import/sprites/<pack>/*.png  → each file uploaded as one sprite
// The SERVICE key bypasses RLS — keep it secret, never commit it.
import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join, basename } from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { PNG } from 'pngjs'
import { CATALOGUE } from '../../hq/src/data/pixel/catalogue'
import { PALETTES } from '../../hq/src/data/pixel/palettes'
import { sliceSheet } from './kenney-slice'

const URL = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_KEY
if (!URL || !KEY) { console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY'); process.exit(1) }

const REPO = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const PUBLIC = join(REPO, 'apps/hq/public')
const IMPORT = join(PUBLIC, 'pixel/import')
const BUCKET = 'pixel-art'
const TODAY = new Date().toISOString().slice(0, 10)
const NOW = () => new Date().toISOString()
const db: SupabaseClient = createClient(URL, KEY, { auth: { persistSession: false } })

// ---- helpers ---------------------------------------------------------------
async function upsertRows(rows: Record<string, unknown>[]) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from('pixel_asset').upsert(rows.slice(i, i + 500))
    if (error) console.error(`  x rows @${i}: ${error.message}`)
  }
}
function dims(buf: Buffer) { try { const p = PNG.sync.read(buf); return { w: p.width, h: p.height } } catch { return { w: 0, h: 0 } } }
async function listPngs(dir: string): Promise<string[]> {
  try {
    const ents = await readdir(dir, { withFileTypes: true, recursive: true })
    return ents.filter(e => e.isFile() && e.name.toLowerCase().endsWith('.png')).map(e => join(e.parentPath ?? (e as unknown as { path: string }).path, e.name))
  } catch { return [] }
}
const packOf = (file: string, root: string) => {
  const rel = file.slice(root.length + 1).split(/[/\\]/)
  return rel.length > 1 ? rel[0] : 'import'
}

// slice a spritesheet buffer → upload every non-blank tile
async function syncSheet(buf: Buffer, o: { pack: string; source: string; license: string; tier: string; url: string; domain: string[]; theme: string[] }): Promise<number> {
  const sprites = sliceSheet(buf)
  console.log(`  · slice ${o.pack}: ${sprites.length} sprites`)
  const rows: Record<string, unknown>[] = []
  let n = 0
  for (const t of sprites) {
    const id = `ref.${o.source}.${o.pack}.r${t.r}c${t.c}`
    const path = `assets/${o.source}/${o.pack}/r${t.r}c${t.c}.png`
    const { error } = await db.storage.from(BUCKET).upload(path, t.png, { contentType: 'image/png', upsert: true })
    if (error) { console.warn(`  ! ${id}: ${error.message}`); continue }
    rows.push({
      id, name: `${o.pack} r${t.r}c${t.c}`,
      source: { name: o.source, sourceId: `${o.pack}/r${t.r}c${t.c}`, pack: o.pack, url: o.url, license: o.license, tier: o.tier, fetchedAt: TODAY },
      curated: { domain: o.domain, kind: 'tile', isCharacter: false, theme: o.theme, style: '16bit', groupId: `${o.source}-${o.pack}`, tags: [o.source, o.pack, 'tile', 'sliced'], verified: false },
      form: { size: { w: 16, h: 16 }, perspective: 'top-down', colorCount: t.colors },
      animations: [], tier: o.tier, license: o.license, status: null, storage_path: path, updated_at: NOW(),
    })
    n++
  }
  await upsertRows(rows)
  return n
}

// upload one PNG as a single sprite
async function syncSprite(buf: Buffer, o: { id: string; name: string; pack: string; source: string; license: string; tier: string; url: string; domain: string[]; theme: string[]; kind?: string }): Promise<boolean> {
  const path = `assets/${o.source}/${o.pack}/${basename(o.id)}.png`
  const { error } = await db.storage.from(BUCKET).upload(path, buf, { contentType: 'image/png', upsert: true })
  if (error) { console.warn(`  ! ${o.id}: ${error.message}`); return false }
  const d = dims(buf)
  await db.from('pixel_asset').upsert({
    id: o.id, name: o.name,
    source: { name: o.source, sourceId: o.id, pack: o.pack, url: o.url, license: o.license, tier: o.tier, fetchedAt: TODAY },
    curated: { domain: o.domain, kind: o.kind ?? 'prop', isCharacter: false, theme: o.theme, tags: [o.source, o.pack, 'import'], verified: false },
    form: { size: d }, animations: [], tier: o.tier, license: o.license, status: null, storage_path: path, updated_at: NOW(),
  })
  return true
}

// ---- steps -----------------------------------------------------------------
async function syncCatalogue() {
  let uploaded = 0, skipped = 0
  for (const it of CATALOGUE) {
    const local = it.form.thumbUrl?.startsWith('/pixel/') ? it.form.thumbUrl : null
    if (!local) { skipped++; continue }              // real data only
    try {
      const buf = await readFile(join(PUBLIC, local))
      const path = `assets/${it.id}.png`
      const { error } = await db.storage.from(BUCKET).upload(path, buf, { contentType: 'image/png', upsert: true })
      if (error) throw error
      await db.from('pixel_asset').upsert({
        id: it.id, name: it.name, source: it.source, curated: it.curated, form: { ...it.form, storagePath: path },
        animations: it.animations, tier: it.source.tier, license: it.source.license, status: it.status ?? null, storage_path: path, updated_at: NOW(),
      })
      uploaded++
    } catch (e) { console.warn(`  ! ${it.id}: ${(e as Error).message}`); skipped++ }
  }
  return { uploaded, skipped }
}

async function syncBuiltinSheets() {
  const SHEETS = [
    { pack: 'roguelike', file: '/pixel/kenney/roguelike.png', domain: ['rpg', 'roguelike', 'tileset'], theme: ['fantasy', 'dungeon', 'medieval'] },
    { pack: 'tiny-town', file: '/pixel/kenney/tinytown.png', domain: ['rpg', 'topdown', 'tileset'], theme: ['nature', 'cute', 'medieval'] },
  ]
  let tiles = 0
  for (const sh of SHEETS) {
    let buf: Buffer
    try { buf = await readFile(join(PUBLIC, sh.file)) } catch { continue }
    tiles += await syncSheet(buf, { pack: sh.pack, source: 'kenney', license: 'CC0', tier: 'T0', url: 'https://kenney.nl', domain: sh.domain, theme: sh.theme })
  }
  return tiles
}

// drop-folder: import/sheets/<pack>/*.png (sliced) + import/sprites/<pack>/*.png (as-is)
async function syncImportFolder() {
  let tiles = 0, sprites = 0
  for (const f of await listPngs(join(IMPORT, 'sheets'))) {
    const buf = await readFile(f)
    tiles += await syncSheet(buf, { pack: packOf(f, join(IMPORT, 'sheets')), source: 'import', license: 'Unknown', tier: 'T0', url: 'local', domain: ['tileset'], theme: [] })
  }
  for (const f of await listPngs(join(IMPORT, 'sprites'))) {
    const pack = packOf(f, join(IMPORT, 'sprites'))
    const name = basename(f, '.png')
    const ok = await syncSprite(await readFile(f), { id: `import.${pack}.${name}`, name, pack, source: 'import', license: 'Unknown', tier: 'T0', url: 'local', domain: [], theme: [] })
    if (ok) sprites++
  }
  if (tiles || sprites) console.log(`  · import folder: ${tiles} sliced + ${sprites} sprites`)
  return tiles + sprites
}

async function syncPalettes() {
  let n = 0
  for (const p of PALETTES) {
    const { error } = await db.from('pixel_palette').upsert({ id: p.id, name: p.name, author: p.author ?? null, colors: p.colors, source: p.source, license: p.license, tags: p.tags, updated_at: NOW() })
    if (!error) n++
  }
  return n
}

// opt-in: pull the full Lospec palette library (runs on your machine; network)
async function syncLospec(): Promise<number> {
  const pages = Number(process.env.LOSPEC_PAGES ?? 60)
  let n = 0
  for (let page = 0; page < pages; page++) {
    let list: { slug: string; title: string; colors?: string[] }[] = []
    try {
      const res = await fetch(`https://lospec.com/palette-list/load?colorNumberFilterType=any&page=${page}&tag=&sortingType=default`)
      const j = await res.json() as { palettes?: { slug: string; title: string; colors?: string[] }[] }
      list = j.palettes ?? []
    } catch (e) { console.warn(`  ! lospec page ${page}: ${(e as Error).message}`); break }
    if (!list.length) break
    const rows = list.map(p => ({
      id: `pal.lospec.${p.slug}`, name: p.title, author: null,
      colors: (p.colors ?? []).map(c => (c.startsWith('#') ? c : '#' + c)),
      source: 'lospec', license: 'PublicDomain', tags: ['lospec'], updated_at: NOW(),
    })).filter(r => r.colors.length)
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await db.from('pixel_palette').upsert(rows.slice(i, i + 500))
      if (error) console.error(`  x lospec @${page}: ${error.message}`)
    }
    n += rows.length
    if (page % 10 === 0) console.log(`  · lospec page ${page}: ${n} palettes so far`)
  }
  return n
}

async function run() {
  await db.storage.createBucket(BUCKET, { public: false }).catch(() => {})
  console.log('syncing…')
  const cat = await syncCatalogue()
  const builtinTiles = await syncBuiltinSheets()
  const imported = await syncImportFolder()
  let pals = await syncPalettes()
  if (process.env.FETCH_LOSPEC === '1') { console.log('fetching Lospec…'); pals += await syncLospec() }

  console.log(`\n✓ pixel-sync complete`)
  console.log(`  ${cat.uploaded} owned assets · ${builtinTiles} Kenney slices · ${imported} imported · ${pals} palettes`)
  console.log(`  (${cat.skipped} metadata-only rows skipped — real data only)`)
}

run().catch(e => { console.error(e); process.exit(1) })
