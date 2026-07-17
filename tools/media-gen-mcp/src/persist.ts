// Persistence-first: after any successful generation, push the bytes to the
// Supabase `media-artifacts` bucket and record lineage in the `media_asset`
// table — the exact schema of supabase/migration_media_assets.sql. Media
// Center / Post Studio then consume the public URL instead of a file on this
// machine.
//
// Fully optional: without SUPABASE_URL + SUPABASE_SERVICE_KEY in .env the MCP
// behaves exactly as before (local file only). The service role bypasses RLS,
// so no operator session is needed here. Any persistence failure is reported
// in the tool result but never fails the generation itself.

export interface PersistResult {
  uploaded: boolean
  publicUrl?: string
  storagePath?: string
  lineageRecorded?: boolean
  error?: string
}

const BUCKET = process.env.MEDIA_BUCKET || 'media-artifacts'

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/png': 'png',
  'audio/mpeg': 'mp3', 'audio/flac': 'flac', 'audio/wav': 'wav', 'audio/webm': 'webm',
}

export async function persistToSupabase(opts: {
  bytes: Uint8Array
  mime: string
  provider: string
  model: string
  prompt: string
  format: string
  width?: number
  height?: number
  kind?: 'image' | 'music' | 'sfx' | 'voice' | 'video'   // default image — decides the folder + lineage kind
  seconds?: number
}): Promise<PersistResult> {
  const url = (process.env.SUPABASE_URL || '').replace(/\/+$/, '')
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) return { uploaded: false, error: 'SUPABASE_URL/SUPABASE_SERVICE_KEY not set (persistence skipped)' }

  const kind = opts.kind || 'image'
  const ext = EXT_BY_MIME[opts.mime] || (kind === 'image' ? 'png' : 'bin')
  const day = new Date().toISOString().slice(0, 10)
  const path = `${kind}/${day}/${opts.provider}-${Date.now().toString(36)}.${ext}`
  const headers = { Authorization: `Bearer ${key}`, apikey: key }

  try {
    const up = await fetch(`${url}/storage/v1/object/${BUCKET}/${path}`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': opts.mime, 'x-upsert': 'true' },
      body: opts.bytes as unknown as BodyInit,
    })
    if (!up.ok) {
      const t = await up.text().catch(() => '')
      return { uploaded: false, error: `upload failed (bucket "${BUCKET}" missing? run migration_media_assets.sql): HTTP ${up.status} ${t.slice(0, 120)}` }
    }
    const publicUrl = `${url}/storage/v1/object/public/${BUCKET}/${path}`

    // Lineage row in media_asset (service role bypasses RLS). Graceful: a
    // missing table reports lineageRecorded:false without undoing the upload.
    const ins = await fetch(`${url}/rest/v1/media_asset`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({
        kind,
        bucket: BUCKET,
        path,
        mime: opts.mime,
        bytes: opts.bytes.length,
        width: opts.width ?? null,
        height: opts.height ?? null,
        prompt: opts.prompt,
        provider: opts.provider,
        model: opts.model,
        cost_usd: 0,
      }),
    })
    return {
      uploaded: true,
      publicUrl,
      storagePath: `${BUCKET}/${path}`,
      lineageRecorded: ins.ok,
      ...(ins.ok ? {} : { error: `lineage insert failed (run migration_media_assets.sql?): HTTP ${ins.status}` }),
    }
  } catch (e: any) {
    return { uploaded: false, error: e?.message || String(e) }
  }
}
