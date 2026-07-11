// HQ Vault — workspace store. Local-first: hydrates from localStorage (or the
// seed vault on first run), autosaves debounced, keeps the link index derived.

import { create } from 'zustand'
import type {
  VaultNote, CanvasState, VaultSettings, Frontmatter, CanvasCard, CanvasEdge,
} from './types'
import { DEFAULT_SETTINGS, slugify, todayISO, uid } from './types'
import { buildBacklinks, type LinkIndex } from './graph'
import { seedNotes, seedCanvas, SEED_VERSION } from './seed'
import { loadSnapshot, saveSnapshot, clearSnapshot } from './storage'
import { normalizeFrontmatter } from './markdown'

export type CenterView = 'note' | 'graph' | 'canvas' | 'bases' | 'decisions' | 'prompts'
export type EditorMode = 'edit' | 'preview' | 'split'
export type LeftPanel = 'files' | 'search'

interface VaultState {
  notes: Record<string, VaultNote>
  index: LinkIndex
  tabs: string[]
  active: string | null
  pinned: string[]
  centerView: CenterView
  editorMode: EditorMode
  leftPanel: LeftPanel
  searchQuery: string
  canvas: CanvasState
  settings: VaultSettings
  lastSaved: number
  paletteOpen: boolean
  settingsOpen: boolean

  openNote: (id: string, opts?: { newTab?: boolean }) => void
  closeTab: (id: string) => void
  togglePin: (id: string) => void
  createNote: (title: string, partial?: Partial<Frontmatter>, body?: string) => string
  renameNote: (id: string, title: string) => void
  deleteNote: (id: string) => void
  duplicateNote: (id: string) => string | null
  updateBody: (id: string, body: string) => void
  updateFrontmatter: (id: string, patch: Partial<Frontmatter>) => void
  importNote: (note: VaultNote) => void

  setCenterView: (v: CenterView) => void
  setEditorMode: (m: EditorMode) => void
  cycleEditorMode: () => void
  setLeftPanel: (p: LeftPanel) => void
  toggleLeft: () => void
  toggleRight: () => void
  setSearchQuery: (q: string) => void

  setCanvas: (fn: (c: CanvasState) => CanvasState) => void
  addCanvasCard: (card: Omit<CanvasCard, 'id'>) => void
  removeCanvasCard: (id: string) => void
  connectCards: (from: string, to: string) => void
  removeCanvasEdge: (id: string) => void

  updateSettings: (patch: Partial<VaultSettings>) => void
  resetVault: () => void
  replaceVault: (notes: VaultNote[], canvas?: CanvasState, settings?: VaultSettings) => void

  openPalette: () => void
  closePalette: () => void
  openSettings: () => void
  closeSettings: () => void
}

// ---------- hydrate ----------

const snap = loadSnapshot()
// Re-seed once when the seed edition changes: the founder KB is the seed, so a
// content bump should reach existing vaults instead of being pinned by the
// first-run snapshot. User settings/tabs are preserved; seed notes refresh.
const needsReseed = !snap || snap.seedVersion !== SEED_VERSION
const initialNotes = (!needsReseed && snap?.notes && Object.keys(snap.notes).length) ? snap.notes : seedNotes()
const initialCanvas = (!needsReseed && snap?.canvas?.cards) ? snap.canvas : seedCanvas()
const initialSettings: VaultSettings = { ...DEFAULT_SETTINGS, ...(snap?.settings || {}) }
// Theme v2 migration: the vault used to default to its own dark theme; it now
// follows the Circle HQ shell ('hq'). Migrate stored snapshots once, then
// respect whatever the user picks going forward.
let themeMigrated = false
try {
  if (!localStorage.getItem('hq_vault_theme_v3')) {
    initialSettings.theme = 'hq'
    initialSettings.accent = 'indigo'
    localStorage.setItem('hq_vault_theme_v3', '1')
    themeMigrated = true
  }
} catch { /* storage unavailable — default already 'hq' */ }
if (!['hq', 'dark', 'light'].includes(initialSettings.theme)) initialSettings.theme = 'hq'
if (!['indigo', 'iris', 'ember', 'jade', 'aurum', 'rose'].includes(initialSettings.accent)) initialSettings.accent = 'indigo'
const initialTabs = (snap?.tabs || ['hq']).filter(t => initialNotes[t])
const initialActive = snap?.active && initialNotes[snap.active] ? snap.active : (initialTabs[0] ?? null)
const initialPinned = (snap?.pinned || []).filter(t => initialNotes[t])
// Persist the migrated settings right away — otherwise the marker blocks a
// re-migration while the old snapshot still carries the legacy theme.
if ((themeMigrated || needsReseed) && snap) {
  saveSnapshot({
    seedVersion: SEED_VERSION,
    notes: initialNotes, canvas: initialCanvas, settings: initialSettings,
    tabs: initialTabs, active: initialActive, pinned: initialPinned,
  })
}

// ---------- debounced persistence ----------

let saveTimer: ReturnType<typeof setTimeout> | null = null
function schedulePersist(get: () => VaultState, set: (p: Partial<VaultState>) => void, delay = 600) {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    const s = get()
    const savedAt = saveSnapshot({
      seedVersion: SEED_VERSION,
      notes: s.notes, canvas: s.canvas, settings: s.settings,
      tabs: s.tabs, active: s.active, pinned: s.pinned,
    })
    set({ lastSaved: savedAt })
  }, delay)
}

const dedupeId = (base: string, notes: Record<string, VaultNote>) => {
  let id = base || 'untitled'
  let n = 2
  while (notes[id]) id = `${base}-${n++}`
  return id
}

export const useVault = create<VaultState>((set, get) => {
  const persist = (delay = 600) => schedulePersist(get, (p) => set(p as VaultState), delay)

  const touch = (note: VaultNote): VaultNote => ({
    ...note, updatedAt: Date.now(), fm: { ...note.fm, updated: todayISO() },
  })

  return {
    notes: initialNotes,
    index: buildBacklinks(initialNotes),
    tabs: initialTabs,
    active: initialActive,
    pinned: initialPinned,
    centerView: 'note',
    editorMode: 'edit',
    leftPanel: 'files',
    searchQuery: '',
    canvas: initialCanvas,
    settings: initialSettings,
    lastSaved: snap?.savedAt || 0,
    paletteOpen: false,
    settingsOpen: false,

    openNote: (id, opts) => {
      const s = get()
      if (!s.notes[id]) return
      let tabs = s.tabs
      if (!tabs.includes(id)) {
        if (opts?.newTab || tabs.length === 0 || !s.active) tabs = [...tabs, id]
        else {
          // replace the active tab unless it's pinned (Obsidian-style reuse)
          const ai = tabs.indexOf(s.active)
          if (ai >= 0 && !s.pinned.includes(s.active)) tabs = tabs.map((t, i) => (i === ai ? id : t))
          else tabs = [...tabs, id]
        }
      }
      set({ tabs, active: id, centerView: 'note' })
      persist()
    },

    closeTab: (id) => {
      const s = get()
      const tabs = s.tabs.filter(t => t !== id)
      let active = s.active
      if (active === id) {
        const i = s.tabs.indexOf(id)
        active = tabs[Math.min(i, tabs.length - 1)] ?? null
      }
      set({ tabs, active, pinned: s.pinned.filter(p => p !== id) })
      persist()
    },

    togglePin: (id) => {
      const s = get()
      set({ pinned: s.pinned.includes(id) ? s.pinned.filter(p => p !== id) : [...s.pinned, id] })
      persist()
    },

    createNote: (title, partial, body) => {
      const s = get()
      const clean = title.trim() || 'Untitled'
      const id = dedupeId(slugify(clean), s.notes)
      const fm = normalizeFrontmatter({ ...partial, title: clean, updated: todayISO() }, clean)
      const note: VaultNote = {
        id, fm, body: body ?? `# ${clean}\n\n`,
        createdAt: Date.now(), updatedAt: Date.now(),
      }
      const notes = { ...s.notes, [id]: note }
      set({ notes, index: buildBacklinks(notes) })
      get().openNote(id, { newTab: true })
      persist(150)
      return id
    },

    renameNote: (id, title) => {
      const s = get()
      const note = s.notes[id]
      const clean = title.trim()
      if (!note || !clean) return
      const notes = { ...s.notes, [id]: touch({ ...note, fm: { ...note.fm, title: clean } }) }
      set({ notes, index: buildBacklinks(notes) })
      persist()
    },

    deleteNote: (id) => {
      const s = get()
      if (!s.notes[id]) return
      const notes = { ...s.notes }
      delete notes[id]
      const tabs = s.tabs.filter(t => t !== id)
      const active = s.active === id ? (tabs[0] ?? null) : s.active
      const canvas: CanvasState = {
        cards: s.canvas.cards.filter(c => c.noteId !== id),
        edges: s.canvas.edges.filter(e =>
          s.canvas.cards.find(c => c.id === e.fromCard)?.noteId !== id &&
          s.canvas.cards.find(c => c.id === e.toCard)?.noteId !== id),
      }
      set({ notes, index: buildBacklinks(notes), tabs, active, pinned: s.pinned.filter(p => p !== id), canvas })
      persist()
    },

    duplicateNote: (id) => {
      const s = get()
      const src = s.notes[id]
      if (!src) return null
      const title = src.fm.title + ' (copy)'
      return get().createNote(title, { ...src.fm, title }, src.body)
    },

    updateBody: (id, body) => {
      const s = get()
      const note = s.notes[id]
      if (!note || note.body === body) return
      const notes = { ...s.notes, [id]: touch({ ...note, body }) }
      set({ notes, index: buildBacklinks(notes) })
      persist()
    },

    updateFrontmatter: (id, patch) => {
      const s = get()
      const note = s.notes[id]
      if (!note) return
      const notes = { ...s.notes, [id]: touch({ ...note, fm: { ...note.fm, ...patch } }) }
      set({ notes, index: buildBacklinks(notes) })
      persist()
    },

    importNote: (note) => {
      const s = get()
      const id = dedupeId(note.id || slugify(note.fm.title), s.notes)
      const notes = { ...s.notes, [id]: { ...note, id } }
      set({ notes, index: buildBacklinks(notes) })
      persist(150)
    },

    setCenterView: (centerView) => { set({ centerView }); persist() },
    setEditorMode: (editorMode) => set({ editorMode }),
    cycleEditorMode: () => set(s => ({
      editorMode: s.editorMode === 'edit' ? 'preview' : s.editorMode === 'preview' ? 'split' : 'edit',
    })),
    setLeftPanel: (leftPanel) => set(s => ({
      leftPanel,
      settings: s.settings.leftOpen ? s.settings : { ...s.settings, leftOpen: true },
    })),
    toggleLeft: () => { set(s => ({ settings: { ...s.settings, leftOpen: !s.settings.leftOpen } })); persist() },
    toggleRight: () => { set(s => ({ settings: { ...s.settings, rightOpen: !s.settings.rightOpen } })); persist() },
    setSearchQuery: (searchQuery) => set({ searchQuery }),

    setCanvas: (fn) => { set(s => ({ canvas: fn(s.canvas) })); persist() },
    addCanvasCard: (card) => {
      set(s => ({ canvas: { ...s.canvas, cards: [...s.canvas.cards, { ...card, id: 'c-' + uid() }] } }))
      persist()
    },
    removeCanvasCard: (id) => {
      set(s => ({ canvas: {
        cards: s.canvas.cards.filter(c => c.id !== id),
        edges: s.canvas.edges.filter(e => e.fromCard !== id && e.toCard !== id),
      } }))
      persist()
    },
    connectCards: (from, to) => {
      const s = get()
      if (from === to) return
      if (s.canvas.edges.some(e => (e.fromCard === from && e.toCard === to) || (e.fromCard === to && e.toCard === from))) return
      const edge: CanvasEdge = { id: 'e-' + uid(), fromCard: from, toCard: to }
      set({ canvas: { ...s.canvas, edges: [...s.canvas.edges, edge] } })
      persist()
    },
    removeCanvasEdge: (id) => {
      set(s => ({ canvas: { ...s.canvas, edges: s.canvas.edges.filter(e => e.id !== id) } }))
      persist()
    },

    updateSettings: (patch) => { set(s => ({ settings: { ...s.settings, ...patch } })); persist(200) },

    resetVault: () => {
      clearSnapshot()
      const notes = seedNotes()
      set({
        notes, index: buildBacklinks(notes), canvas: seedCanvas(), settings: { ...DEFAULT_SETTINGS },
        tabs: ['hq'], active: 'hq', pinned: [], centerView: 'note', searchQuery: '',
      })
      persist(150)
    },

    replaceVault: (list, canvas, settings) => {
      const notes: Record<string, VaultNote> = {}
      for (const n of list) notes[n.id] = n
      set(s => ({
        notes, index: buildBacklinks(notes),
        canvas: canvas ?? s.canvas,
        settings: settings ?? s.settings,
        tabs: list.length ? [list[0].id] : [], active: list.length ? list[0].id : null, pinned: [],
      }))
      persist(150)
    },

    openPalette: () => set({ paletteOpen: true }),
    closePalette: () => set({ paletteOpen: false }),
    openSettings: () => set({ settingsOpen: true }),
    closeSettings: () => set({ settingsOpen: false }),
  }
})

/** Open a note by wikilink target text; creates the note when the link is broken
 *  and `createIfMissing` is set. Returns the opened/created id or null. */
export function openByTarget(target: string, createIfMissing = false): string | null {
  const s = useVault.getState()
  const t = target.trim().toLowerCase()
  const found = Object.values(s.notes).find(n => n.fm.title.toLowerCase() === t) ||
    Object.values(s.notes).find(n => n.id === slugify(target))
  if (found) { s.openNote(found.id); return found.id }
  if (createIfMissing) return s.createNote(target.trim())
  return null
}
