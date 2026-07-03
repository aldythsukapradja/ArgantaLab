// Pixel Vault → Supabase sync. Uploads the repo's real pixel art into the private
// `pixel-art` bucket and upserts every catalogue row + palette. Reuses the app's
// catalogue as the single source of truth (no duplicate metadata).
//
// Prereq: run supabase/migration_pixel_vault.sql once. Then:
//   cd apps/mcp
//   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_KEY=eyJ... npx tsx scripts/pixel-sync.ts
//
// The SERVICE key bypasses RLS — keep it secret, never commit it. Idempotent:
// re-running upserts (upload uses upsert:true), so it's safe to run repeatedly.
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { CATALOGUE } from '../../hq/src/data/pixel/catalogue'
import { PALETTES } from '../../hq/src/data/pixel/palettes'
import { sliceSheet } from './kenney-slice'

const URL = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_KEY
if (!URL || !KEY) { console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY'); process.exit(1) }

const REPO = join(dirname(fileURLToPath(import.meta.url)), '../../..')   // apps/mcp/scripts → repo root
const PUBLIC = join(REPO, 'apps/hq/public')
const BUCKET = 'pixel-art'
const db = createClient(URL, KEY, { auth: { persistSession: false } })

async function run() {
  // ensure the bucket (no-op if the migration already made it)
  await db.storage.createBucket(BUCKET, { public: false }).catch(() => {})

  let uploaded = 0, rows = 0, skipped = 0
  for (const it of CATALOGUE) {
    let storagePath: string | null = it.form.storagePath ?? null

    // upload the real binary when we have a local file (owned mounts, CC0 packs)
    const local = it.form.thumbUrl && it.form.thumbUrl.startsWith('/pixel/') ? it.form.thumbUrl : null
    if (local) {
      try {
        const buf = await readFile(join(PUBLIC, local))
        const path = `assets/${it.id}.png`
        const { error } = await db.storage.from(BUCKET).upload(path, buf, { contentType: 'image/png', upsert: true })
        if (error) throw error
        storagePath = path
        uploaded++
      } catch (e) {
        console.warn(`  ! upload skipped for ${it.id}: ${(e as Error).message}`)
        skipped++
      }
    }

    // real data only — skip metadata-only rows that have no actual pixels
    if (!storagePath) { skipped++; continue }

    const { error } = await db.from('pixel_asset').upsert({
      id: it.id, name: it.name, source: it.source, curated: it.curated, form: it.form,
      animations: it.animations, tier: it.source.tier, license: it.source.license,
      status: it.status ?? null, storage_path: storagePath, updated_at: new Date().toISOString(),
    })
    if (error) console.error(`  x row ${it.id}: ${error.message}`); else rows++
  }

  // slice the local Kenney CC0 sheets into individual real sprites → upload each
  const SHEETS: { pack: string; file: string; domain: string[]; theme: string[] }[] = [
    { pack: 'roguelike', file: '/pixel/kenney/roguelike.png', domain: ['rpg', 'roguelike', 'tileset'], theme: ['fantasy', 'dungeon', 'medieval'] },
    { pack: 'tiny-town', file: '/pixel/kenney/tinytown.png', domain: ['rpg', 'topdown', 'tileset'], theme: ['nature', 'cute', 'medieval'] },
  ]
  let tiles = 0
  for (const sh of SHEETS) {
    let buf: Buffer
    try { buf = await readFile(join(PUBLIC, sh.file)) } catch { console.warn(`  ! sheet missing: ${sh.file}`); continue }
    const sprites = sliceSheet(buf)
    console.log(`  · slicing ${sh.pack}: ${sprites.length} sprites`)
    const rowsBatch: Record<string, unknown>[] = []
    for (const t of sprites) {
      const id = `ref.kenney.${sh.pack}.r${t.r}c${t.c}`
      const path = `assets/kenney/${sh.pack}/r${t.r}c${t.c}.png`
      const { error } = await db.storage.from(BUCKET).upload(path, t.png, { contentType: 'image/png', upsert: true })
      if (error) { console.warn(`  ! tile ${id}: ${error.message}`); continue }
      rowsBatch.push({
        id, name: `Kenney ${sh.pack} r${t.r}c${t.c}`,
        source: { name: 'kenney', sourceId: `${sh.pack}/r${t.r}c${t.c}`, pack: sh.pack, url: 'https://kenney.nl', author: 'Kenney', license: 'CC0', tier: 'T0', fetchedAt: new Date().toISOString().slice(0, 10) },
        curated: { domain: sh.domain, kind: 'tile', isCharacter: false, theme: sh.theme, style: '16bit', groupId: `kenney-${sh.pack}`, tags: ['kenney', sh.pack, 'tile', 'sliced'], verified: false },
        form: { size: { w: 16, h: 16 }, perspective: 'top-down', colorCount: t.colors },
        animations: [], tier: 'T0', license: 'CC0', status: null, storage_path: path, updated_at: new Date().toISOString(),
      })
      tiles++
    }
    // batch the metadata upserts (500 at a time)
    for (let i = 0; i < rowsBatch.length; i += 500) {
      const { error } = await db.from('pixel_asset').upsert(rowsBatch.slice(i, i + 500))
      if (error) console.error(`  x tile rows ${sh.pack} @${i}: ${error.message}`)
    }
  }

  let pals = 0
  for (const p of PALETTES) {
    const { error } = await db.from('pixel_palette').upsert({
      id: p.id, name: p.name, author: p.author ?? null, colors: p.colors,
      source: p.source, license: p.license, tags: p.tags, updated_at: new Date().toISOString(),
    })
    if (error) console.error(`  x palette ${p.id}: ${error.message}`); else pals++
  }

  console.log(`\n✓ pixel-sync complete — ${uploaded} real catalogue assets + ${tiles} sliced Kenney sprites + ${pals} palettes.`)
  console.log(`  (${skipped} metadata-only rows skipped — real data only.)`)
  console.log(`  Total in Supabase: ${rows + tiles} assets, ${pals} palettes.`)
}

// ── extension seam: add a fetcher per source to download the full libraries ──
// e.g. Lospec palettes (JSON API), Kenney pack zips, the OGA-BY Hugging Face dump.
// Each fetcher yields { buffer, meta } → upload + upsert, exactly like above.

run().catch(e => { console.error(e); process.exit(1) })
