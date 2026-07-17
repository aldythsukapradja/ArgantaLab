// Ingest queue — cloud side (S3a contract). The media-gen MCP writes rows +
// bytes; this module reads the queue and performs the two verdicts with the
// signed-in admin session (RLS: pixel_ingest_write / pixel_asset_write are
// is_admin-gated, so a non-admin session gets a clean error, not a silent no-op).
import { supabase, cloudEnabled } from '../../lib/supabase'
import type { Animation, VaultItem } from './types'

export interface CloudIngestRow {
  id: string
  suggested_name: string
  generated_via: string
  source_job_id: string | null
  style_ref_id: string | null
  prompt: string | null
  kind: string
  size: { w?: number; h?: number }
  swatch: string[]
  suggested_tags: string[]
  animations: Animation[]
  storage_path: string
  status: 'pending' | 'rejected' | 'promoted'
  created_at: string
}

export async function loadIngestQueue(): Promise<CloudIngestRow[] | null> {
  if (!cloudEnabled) return null
  try {
    const { data: sess } = await supabase.auth.getSession()
    if (!sess.session) return null
    const { data, error } = await supabase
      .from('pixel_ingest')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) return null
    return (data ?? []) as CloudIngestRow[]
  } catch { return null }
}

export async function rejectIngest(id: string): Promise<string | null> {
  const { error } = await supabase
    .from('pixel_ingest')
    .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
    .eq('id', id)
  return error ? error.message : null
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'pixel'

/** Promote: create the canonical pixel_asset row (T0 — generated art is owned),
 * pointing at the SAME storage object (the contract moves metadata, not bytes),
 * then flip the queue row. Returns the new asset id, or throws with a reason. */
export async function promoteIngest(row: CloudIngestRow, edits?: { name?: string; tags?: string[]; kind?: string }): Promise<string> {
  const name = edits?.name?.trim() || row.suggested_name
  const kind = edits?.kind || row.kind
  const assetId = `asset.${kind}.${slug(name)}`

  const item: Omit<VaultItem, 'relationships'> & { relationships?: VaultItem['relationships'] } = {
    id: assetId,
    name,
    source: {
      name: row.generated_via,
      sourceId: row.source_job_id || row.id,
      url: '',
      license: 'CC0',           // generated in-house — owned, ship-as-is
      tier: 'T0',
      fetchedAt: row.created_at,
    },
    curated: {
      domain: [], kind, isCharacter: kind === 'character',
      theme: [], tags: edits?.tags ?? row.suggested_tags, verified: true,
    },
    form: {
      size: { w: row.size?.w ?? 0, h: row.size?.h ?? 0 },
      swatch: row.swatch,
      storagePath: row.storage_path,
    },
    animations: row.animations ?? [],
    relationships: row.style_ref_id ? { derivedFrom: [row.style_ref_id] } : {},
    status: 'draft',
  }

  const { error: insErr } = await supabase.from('pixel_asset').insert({
    id: item.id, name: item.name, source: item.source, curated: item.curated,
    form: item.form, animations: item.animations,
    tier: 'T0', license: 'CC0', status: 'draft', storage_path: row.storage_path,
  })
  if (insErr) throw new Error(`promote failed (admin session required): ${insErr.message}`)

  const { error: updErr } = await supabase
    .from('pixel_ingest')
    .update({ status: 'promoted', promoted_id: assetId, reviewed_at: new Date().toISOString() })
    .eq('id', row.id)
  if (updErr) throw new Error(`asset created as ${assetId}, but queue flip failed: ${updErr.message}`)
  return assetId
}
