// HQ Vault — local-first persistence + import/export + query helpers.
// localStorage is the store of record (synchronous, reload-safe, no backend);
// the snapshot is versioned so a future IndexedDB/Supabase sync can migrate it.

import type { VaultNote, VaultSnapshot, CanvasState, VaultSettings, Product, NoteStatus } from './types'
import { DEFAULT_SETTINGS } from './types'
import { serializeFrontmatter, wordCount } from './markdown'

const KEY = 'hq_vault_v1'

export function loadSnapshot(): VaultSnapshot | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const snap = JSON.parse(raw) as VaultSnapshot
    if (!snap || snap.version !== 1 || !snap.notes) return null
    return snap
  } catch { return null }
}

export function saveSnapshot(snap: Omit<VaultSnapshot, 'version' | 'savedAt'>): number {
  const savedAt = Date.now()
  try {
    localStorage.setItem(KEY, JSON.stringify({ version: 1, savedAt, ...snap }))
  } catch { /* quota — vault keeps working in-memory */ }
  return savedAt
}

export function clearSnapshot() { try { localStorage.removeItem(KEY) } catch { /* noop */ } }

// ---------- Export / import ----------

export function noteToMarkdown(note: VaultNote): string {
  return serializeFrontmatter(note.fm) + '\n' + note.body
}

export function exportVault(notes: Record<string, VaultNote>, canvas: CanvasState, settings: VaultSettings): string {
  return JSON.stringify({
    format: 'hq-vault', version: 1, exportedAt: new Date().toISOString(),
    notes: Object.values(notes), canvas, settings,
  }, null, 2)
}

export interface ImportResult { notes: VaultNote[]; canvas?: CanvasState; settings?: VaultSettings }

export function importVault(json: string): ImportResult | null {
  try {
    const data = JSON.parse(json)
    if (!data || data.format !== 'hq-vault' || !Array.isArray(data.notes)) return null
    const notes = (data.notes as VaultNote[]).filter(n => n && typeof n.id === 'string' && n.fm && typeof n.body === 'string')
    return { notes, canvas: data.canvas, settings: data.settings ? { ...DEFAULT_SETTINGS, ...data.settings } : undefined }
  } catch { return null }
}

export function downloadFile(name: string, content: string, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime + ';charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 800)
}

// ---------- Search ----------

export interface SearchHit {
  id: string
  title: string
  score: number
  snippet: string            // plain text around the first body match
  matchIn: ('title' | 'tags' | 'frontmatter' | 'body')[]
}

export function searchNotes(q: string, notes: Record<string, VaultNote>): SearchHit[] {
  const needle = q.trim().toLowerCase()
  if (!needle) return []
  const hits: SearchHit[] = []
  for (const n of Object.values(notes)) {
    const matchIn: SearchHit['matchIn'] = []
    let score = 0
    const title = n.fm.title.toLowerCase()
    if (title.includes(needle)) { score += title === needle ? 60 : title.startsWith(needle) ? 40 : 25; matchIn.push('title') }
    if (n.fm.tags.some(t => t.toLowerCase().includes(needle))) { score += 14; matchIn.push('tags') }
    const fmStr = `${n.fm.product} ${n.fm.type} ${n.fm.status} ${n.fm.owner}`.toLowerCase()
    if (fmStr.includes(needle)) { score += 8; matchIn.push('frontmatter') }
    const body = n.body.toLowerCase()
    const bi = body.indexOf(needle)
    let snippet = ''
    if (bi >= 0) {
      score += 10 + Math.min(10, (body.split(needle).length - 1) * 2)
      matchIn.push('body')
      const from = Math.max(0, bi - 44)
      snippet = (from > 0 ? '…' : '') +
        n.body.slice(from, Math.min(n.body.length, bi + needle.length + 76)).replace(/\n+/g, ' ').trim() + '…'
    }
    if (score > 0) hits.push({ id: n.id, title: n.fm.title, score, snippet, matchIn })
  }
  return hits.sort((a, b) => b.score - a.score)
}

// ---------- Sort / filter (Bases + explorer) ----------

export type SortKey = 'title' | 'product' | 'status' | 'updated' | 'confidence'
const CONF_RANK = { low: 0, medium: 1, high: 2 } as const
const STATUS_RANK: Record<string, number> = {
  // main-KB living-doc order first, then legacy vault statuses
  living: 0, baseline: 1, current: 2, frozen: 3, superseded: 4,
  seed: 5, draft: 6, active: 7, shipped: 8, archived: 9,
}

export function sortNotes(list: VaultNote[], key: SortKey, dir: 1 | -1): VaultNote[] {
  const arr = [...list]
  arr.sort((a, b) => {
    let r = 0
    switch (key) {
      case 'title': r = a.fm.title.localeCompare(b.fm.title); break
      case 'product': r = a.fm.product.localeCompare(b.fm.product); break
      case 'status': r = STATUS_RANK[a.fm.status] - STATUS_RANK[b.fm.status]; break
      case 'updated': r = a.fm.updated.localeCompare(b.fm.updated); break
      case 'confidence': r = CONF_RANK[a.fm.confidence] - CONF_RANK[b.fm.confidence]; break
    }
    return r * dir || a.fm.title.localeCompare(b.fm.title)
  })
  return arr
}

export interface NoteFilter { product?: Product | 'all'; status?: NoteStatus | 'all'; tag?: string | 'all'; type?: string | 'all' }

export function filterNotes(list: VaultNote[], f: NoteFilter): VaultNote[] {
  return list.filter(n =>
    (!f.product || f.product === 'all' || n.fm.product === f.product) &&
    (!f.status || f.status === 'all' || n.fm.status === f.status) &&
    (!f.type || f.type === 'all' || n.fm.type === f.type) &&
    (!f.tag || f.tag === 'all' || n.fm.tags.includes(f.tag)),
  )
}

export const vaultStats = (notes: Record<string, VaultNote>) => {
  const all = Object.values(notes)
  return {
    count: all.length,
    words: all.reduce((s, n) => s + wordCount(n.body), 0),
  }
}
