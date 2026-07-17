// Pixel brief queue client (S3b). The Forge tab writes generation briefs here
// with the admin session; Claude fulfills them via the pixel_brief_list MCP tool
// + PixelLab + pixel_vault_ingest. Schema: supabase/migration_pixel_brief.sql.
import { supabase, cloudEnabled } from '../../lib/supabase'

export interface PixelBrief {
  id: string
  kind: string
  prompt: string
  count: number
  style_ref_id: string | null
  size: { w?: number; h?: number }
  via: string
  status: 'pending' | 'claimed' | 'done' | 'cancelled'
  note: string | null
  result_count: number
  created_at: string
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'brief'
const shortId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5)

export async function loadBriefs(): Promise<PixelBrief[] | null> {
  if (!cloudEnabled) return null
  try {
    const { data: sess } = await supabase.auth.getSession()
    if (!sess.session) return null
    const { data, error } = await supabase.from('pixel_brief').select('*').order('created_at', { ascending: false }).limit(50)
    if (error) return null
    return (data ?? []) as PixelBrief[]
  } catch { return null }
}

export async function submitBrief(b: {
  kind: string; prompt: string; count: number; styleRefId?: string; via?: string;
  width?: number; height?: number; note?: string
}): Promise<string> {
  const id = `brief.${slug(b.prompt)}-${shortId()}`
  const { error } = await supabase.from('pixel_brief').insert({
    id, kind: b.kind, prompt: b.prompt, count: b.count,
    style_ref_id: b.styleRefId ?? null,
    size: b.width && b.height ? { w: b.width, h: b.height } : {},
    via: b.via ?? 'pixellab', status: 'pending', note: b.note ?? null,
  })
  if (error) throw new Error(`brief submit failed (admin + migration_pixel_brief.sql?): ${error.message}`)
  return id
}

export async function cancelBrief(id: string): Promise<string | null> {
  const { error } = await supabase.from('pixel_brief').update({ status: 'cancelled', resolved_at: new Date().toISOString() }).eq('id', id)
  return error ? error.message : null
}
