import { cloudEnabled, supabase } from '../../lib/supabase'
import { REQUIRED_LASHIRA_ART, type LashiraArtItem, type LashiraArtStatus } from './art'

const TABLE = 'lashira_pixel_art'
const LOCAL_KEY = 'lashira_pixel_art_local_v1'

// EGRESS FIX: the list query used to `select('*')`, pulling every row's full
// `image_data` (base64, can be tens–hundreds of KB) on every panel mount AND
// after every save/delete — the dominant driver behind exceeding the Supabase
// free-tier egress quota. The list now selects everything EXCEPT the bytes,
// using the generated `has_image` column (migration_lashira_art_egress_fix.sql)
// to still show accurate "asset vs procedural" status. The actual image is
// fetched separately, only for the one slot being edited (loadLashiraArtImage).
const LIST_COLUMNS = 'slot_key,label,category,status,expected_w,expected_h,renderer,source_file,notes,has_image,updated_at'

interface ListRow {
  slot_key: string
  label: string
  category: string
  status: LashiraArtStatus
  expected_w: number | null
  expected_h: number | null
  renderer: string
  source_file: string | null
  notes: string | null
  has_image: boolean
  updated_at: string | null
}

const listRowToItem = (r: ListRow): LashiraArtItem => ({
  slotKey: r.slot_key,
  label: r.label,
  category: r.category,
  status: r.status,
  expectedW: r.expected_w,
  expectedH: r.expected_h,
  renderer: r.renderer,
  sourceFile: r.source_file,
  notes: r.notes,
  imageData: null,        // not fetched here — call loadLashiraArtImage() on demand
  hasImage: r.has_image,
  updatedAt: r.updated_at,
})

const itemToRow = (item: LashiraArtItem) => ({
  slot_key: item.slotKey.trim(),
  label: item.label.trim() || item.slotKey.trim(),
  category: item.category.trim() || 'custom',
  status: item.status,
  expected_w: item.expectedW ? Number(item.expectedW) : null,
  expected_h: item.expectedH ? Number(item.expectedH) : null,
  renderer: item.renderer || 'asset',
  source_file: item.sourceFile || null,
  notes: item.notes || null,
  image_data: item.imageData || null,
})

function readLocal(): LashiraArtItem[] {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]') as LashiraArtItem[] } catch { return [] }
}

function writeLocal(items: LashiraArtItem[]) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(items)) } catch { /* quota */ }
}

function merge(stored: LashiraArtItem[]): LashiraArtItem[] {
  const byKey = new Map(REQUIRED_LASHIRA_ART.map(i => [i.slotKey, { ...i }]))
  for (const item of stored) {
    const base = byKey.get(item.slotKey)
    byKey.set(item.slotKey, { ...((base ?? {}) as LashiraArtItem), ...item, builtin: base?.builtin ?? false })
  }
  return [...byKey.values()].sort((a, b) => a.category.localeCompare(b.category) || a.slotKey.localeCompare(b.slotKey))
}

async function signedIn() {
  if (!cloudEnabled) return false
  const { data } = await supabase.auth.getSession()
  return !!data.session
}

export async function loadLashiraArt(): Promise<{ items: LashiraArtItem[]; source: 'cloud' | 'local' | 'seed' }> {
  if (await signedIn()) {
    try {
      const { data, error } = await supabase.from(TABLE).select(LIST_COLUMNS).order('slot_key')
      if (!error) return { items: merge(((data ?? []) as ListRow[]).map(listRowToItem)), source: 'cloud' }
      console.warn('[lashira-art] cloud load failed:', error.message)
    } catch (err) {
      console.warn('[lashira-art] cloud load failed:', err)
    }
  }
  const local = readLocal()
  return { items: merge(local), source: local.length ? 'local' : 'seed' }
}

// On-demand fetch of just ONE slot's image bytes — called when a slot with
// hasImage=true is opened for editing (see LashiraBloomArt.tsx). Keeps the
// list load cheap; only the slot you're actually looking at pays for the bytes.
export async function loadLashiraArtImage(slotKey: string): Promise<string | null> {
  if (!(await signedIn())) return null
  try {
    const { data, error } = await supabase.from(TABLE).select('image_data').eq('slot_key', slotKey).maybeSingle()
    if (error) { console.warn('[lashira-art] image load failed:', error.message); return null }
    return (data as { image_data: string | null } | null)?.image_data ?? null
  } catch (err) {
    console.warn('[lashira-art] image load failed:', err)
    return null
  }
}

export async function saveLashiraArt(item: LashiraArtItem): Promise<void> {
  if (!item.slotKey.trim().startsWith('lashira.')) throw new Error('Lashira art keys must start with lashira.')
  if (await signedIn()) {
    const { error } = await supabase.from(TABLE).upsert(itemToRow(item), { onConflict: 'slot_key' })
    if (error) throw new Error(error.message)
    return
  }
  const items = readLocal().filter(i => i.slotKey !== item.slotKey)
  items.push({ ...item, updatedAt: new Date().toISOString() })
  writeLocal(items)
}

export async function deleteLashiraArt(item: LashiraArtItem): Promise<void> {
  if (item.builtin) {
    const reset = REQUIRED_LASHIRA_ART.find(i => i.slotKey === item.slotKey)
    if (reset) await saveLashiraArt({ ...reset, imageData: null, notes: item.notes ?? reset.notes })
    return
  }
  if (await signedIn()) {
    const { error } = await supabase.from(TABLE).delete().eq('slot_key', item.slotKey)
    if (error) throw new Error(error.message)
    return
  }
  writeLocal(readLocal().filter(i => i.slotKey !== item.slotKey))
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('Unable to read image'))
    reader.readAsDataURL(file)
  })
}
