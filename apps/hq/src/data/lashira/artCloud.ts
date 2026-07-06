import { cloudEnabled, supabase } from '../../lib/supabase'
import { REQUIRED_LASHIRA_ART, type LashiraArtItem, type LashiraArtStatus } from './art'

const TABLE = 'lashira_pixel_art'
const LOCAL_KEY = 'lashira_pixel_art_local_v1'

interface Row {
  slot_key: string
  label: string
  category: string
  status: LashiraArtStatus
  expected_w: number | null
  expected_h: number | null
  renderer: string
  source_file: string | null
  notes: string | null
  image_data: string | null
  updated_at: string | null
}

const rowToItem = (r: Row): LashiraArtItem => ({
  slotKey: r.slot_key,
  label: r.label,
  category: r.category,
  status: r.status,
  expectedW: r.expected_w,
  expectedH: r.expected_h,
  renderer: r.renderer,
  sourceFile: r.source_file,
  notes: r.notes,
  imageData: r.image_data,
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
      const { data, error } = await supabase.from(TABLE).select('*').order('slot_key')
      if (!error) return { items: merge(((data ?? []) as Row[]).map(rowToItem)), source: 'cloud' }
      console.warn('[lashira-art] cloud load failed:', error.message)
    } catch (err) {
      console.warn('[lashira-art] cloud load failed:', err)
    }
  }
  const local = readLocal()
  return { items: merge(local), source: local.length ? 'local' : 'seed' }
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
