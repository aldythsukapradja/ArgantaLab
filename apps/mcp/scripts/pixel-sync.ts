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

    const { error } = await db.from('pixel_asset').upsert({
      id: it.id, name: it.name, source: it.source, curated: it.curated, form: it.form,
      animations: it.animations, tier: it.source.tier, license: it.source.license,
      status: it.status ?? null, storage_path: storagePath, updated_at: new Date().toISOString(),
    })
    if (error) console.error(`  x row ${it.id}: ${error.message}`); else rows++
  }

  let pals = 0
  for (const p of PALETTES) {
    const { error } = await db.from('pixel_palette').upsert({
      id: p.id, name: p.name, author: p.author ?? null, colors: p.colors,
      source: p.source, license: p.license, tags: p.tags, updated_at: new Date().toISOString(),
    })
    if (error) console.error(`  x palette ${p.id}: ${error.message}`); else pals++
  }

  console.log(`\n✓ pixel-sync complete — ${rows} assets (${uploaded} with art, ${skipped} art-skipped), ${pals} palettes.`)
  console.log('  Art with no local file yet is catalogued with storage_path=null — add a source fetcher below to download it.')
}

// ── extension seam: add a fetcher per source to download the full libraries ──
// e.g. Lospec palettes (JSON API), Kenney pack zips, the OGA-BY Hugging Face dump.
// Each fetcher yields { buffer, meta } → upload + upsert, exactly like above.

run().catch(e => { console.error(e); process.exit(1) })
