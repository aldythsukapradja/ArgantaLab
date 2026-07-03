// Read side — loads the vault from Supabase when signed in, else nothing (the
// viewer falls back to the deterministic seed). The bucket is PRIVATE, so
// thumbnails are fetched as short-lived signed URLs, lazily, per visible card.
import { supabase, cloudEnabled } from '../../lib/supabase'
import type { VaultItem, Palette, ItemSource, ItemCurated, ItemForm, Animation } from './types'

interface AssetRow {
  id: string; name: string; source: ItemSource; curated: ItemCurated; form: ItemForm
  animations: Animation[]; status: VaultItem['status'] | null; storage_path: string | null
}
interface PaletteRow { id: string; name: string; author: string | null; colors: string[]; source: string; license: string; tags: string[] }

function rowToItem(r: AssetRow): VaultItem {
  return {
    id: r.id, name: r.name,
    source: r.source, curated: r.curated,
    form: { ...r.form, storagePath: r.storage_path ?? r.form?.storagePath },
    animations: r.animations ?? [], relationships: {},
    status: r.status ?? undefined,
  }
}

export async function loadVaultFromCloud(): Promise<{ items: VaultItem[]; palettes: Palette[] } | null> {
  if (!cloudEnabled) return null
  try {
    const { data: sess } = await supabase.auth.getSession()
    if (!sess.session) return null
    const [{ data: assets, error }, { data: pals }] = await Promise.all([
      supabase.from('pixel_asset').select('id,name,source,curated,form,animations,status,storage_path').limit(20000),
      supabase.from('pixel_palette').select('id,name,author,colors,source,license,tags').limit(2000),
    ])
    if (error || !assets?.length) return null
    const items = (assets as AssetRow[]).map(rowToItem)
    const palettes = ((pals ?? []) as PaletteRow[]).map(p => ({
      id: p.id, name: p.name, author: p.author ?? undefined, colors: p.colors,
      source: p.source, license: p.license as Palette['license'], tags: p.tags ?? [], usedBy: 0,
    }))
    return { items, palettes }
  } catch { return null }
}

// signed URL cache for private-bucket thumbnails (1h), one request per path
const signCache = new Map<string, string>()
export async function signedThumb(path: string): Promise<string | null> {
  if (signCache.has(path)) return signCache.get(path)!
  try {
    const { data } = await supabase.storage.from('pixel-art').createSignedUrl(path, 3600)
    if (data?.signedUrl) { signCache.set(path, data.signedUrl); return data.signedUrl }
  } catch { /* fall through */ }
  return null
}
