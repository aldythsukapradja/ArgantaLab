// HQ Vault — file explorer: product folders, tag groups, recents, filter,
// per-note context actions (rename / duplicate / delete / pin).

import { useMemo, useState } from 'react'
import {
  ChevronRight, FilePlus2, FolderOpen, Hash, Clock3, MoreHorizontal,
  Pencil, Copy, Trash2, Pin, FileText, Scale, Terminal, FlaskConical, Map as MapIcon, FileCode2,
  Compass, Layers, Route, GraduationCap, Boxes, Wrench,
} from 'lucide-react'
import { useVault } from '../store'
import type { VaultNote, NoteType, Product } from '../types'
import { PRODUCTS, PRODUCT_COLOR } from '../types'

// Partial so adding a NoteType never breaks the build — NoteRow falls back to FileText.
const TYPE_ICON: Partial<Record<NoteType, typeof FileText>> = {
  note: FileText, strategy: MapIcon, decision: Scale, prompt: Terminal,
  research: FlaskConical, plan: MapIcon, spec: FileCode2,
  moc: Compass, layer: Layers, journey: Route, lesson: GraduationCap,
  atlas: Boxes, map: MapIcon, method: Wrench,
}

function NoteRow({ note, active, onMenu }: { note: VaultNote; active: boolean; onMenu: (id: string, x: number, y: number) => void }) {
  const openNote = useVault(s => s.openNote)
  const pinned = useVault(s => s.pinned.includes(note.id))
  const Icon = TYPE_ICON[note.fm.type] || FileText
  return (
    <div className={'vx-note' + (active ? ' on' : '')}
      onClick={() => openNote(note.id)}
      onContextMenu={e => { e.preventDefault(); onMenu(note.id, e.clientX, e.clientY) }}>
      <Icon size={13} className="vx-note-ic" />
      <span className="vx-note-t">{note.fm.title}</span>
      {pinned && <Pin size={10} className="vx-pin" />}
      <button className="vx-more" title="Note actions"
        onClick={e => { e.stopPropagation(); const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); onMenu(note.id, r.left, r.bottom + 4) }}>
        <MoreHorizontal size={13} />
      </button>
    </div>
  )
}

export function FileExplorer() {
  const notes = useVault(s => s.notes)
  const active = useVault(s => s.active)
  const createNote = useVault(s => s.createNote)
  const renameNote = useVault(s => s.renameNote)
  const deleteNote = useVault(s => s.deleteNote)
  const duplicateNote = useVault(s => s.duplicateNote)
  const togglePin = useVault(s => s.togglePin)

  const [filter, setFilter] = useState('')
  const [open, setOpen] = useState<Record<string, boolean>>({ HQ: true, KinetikCircle: true, ArgantaLabs: true, LashiraBloom: true, Investor: true, Research: true, __tags: false, __recent: true })
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null)

  const all = useMemo(() => Object.values(notes), [notes])
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return all
    return all.filter(n => n.fm.title.toLowerCase().includes(q) || n.fm.tags.some(t => t.toLowerCase().includes(q)))
  }, [all, filter])

  const byProduct = useMemo(() => {
    const m = new Map<Product, VaultNote[]>()
    for (const p of PRODUCTS) m.set(p, [])
    for (const n of filtered) m.get(n.fm.product)?.push(n)
    for (const list of m.values()) list.sort((a, b) => a.fm.title.localeCompare(b.fm.title))
    return m
  }, [filtered])

  const tags = useMemo(() => {
    const m = new Map<string, VaultNote[]>()
    for (const n of filtered) for (const t of n.fm.tags) {
      if (!m.has(t)) m.set(t, [])
      m.get(t)!.push(n)
    }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 12)
  }, [filtered])

  const recents = useMemo(
    () => [...all].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6),
    [all],
  )

  const openMenu = (id: string, x: number, y: number) => setMenu({ id, x, y })

  const newNote = () => {
    const title = window.prompt('New note title')
    if (title?.trim()) createNote(title)
  }

  return (
    <div className="vx" onClick={() => menu && setMenu(null)}>
      <div className="vx-head">
        <input className="vx-filter" placeholder="Filter notes…" value={filter} onChange={e => setFilter(e.target.value)} aria-label="Filter notes" />
        <button className="vx-new" onClick={newNote} title="New note"><FilePlus2 size={14} /></button>
      </div>

      <div className="vx-scroll">
        {/* Recents */}
        <button className="vx-grp" onClick={() => setOpen(o => ({ ...o, __recent: !o.__recent }))}>
          <ChevronRight size={12} className={'vx-chev' + (open.__recent ? ' open' : '')} />
          <Clock3 size={12} /> <span>Recent</span>
        </button>
        {open.__recent && recents.map(n => (
          <NoteRow key={'r-' + n.id} note={n} active={active === n.id} onMenu={openMenu} />
        ))}

        {/* Product folders */}
        {PRODUCTS.map(p => {
          const list = byProduct.get(p) || []
          if (filter && list.length === 0) return null
          return (
            <div key={p}>
              <button className="vx-grp" onClick={() => setOpen(o => ({ ...o, [p]: !o[p] }))}>
                <ChevronRight size={12} className={'vx-chev' + (open[p] ? ' open' : '')} />
                <span className="vx-fdot" style={{ background: PRODUCT_COLOR[p] }} />
                <span>{p}</span>
                <i className="vx-count">{list.length}</i>
              </button>
              {open[p] && list.map(n => (
                <NoteRow key={n.id} note={n} active={active === n.id} onMenu={openMenu} />
              ))}
              {open[p] && list.length === 0 && <div className="vx-empty-f"><FolderOpen size={12} /> empty</div>}
            </div>
          )
        })}

        {/* Tags */}
        <button className="vx-grp" onClick={() => setOpen(o => ({ ...o, __tags: !o.__tags }))}>
          <ChevronRight size={12} className={'vx-chev' + (open.__tags ? ' open' : '')} />
          <Hash size={12} /> <span>Tags</span>
        </button>
        {open.__tags && tags.map(([t, list]) => (
          <div key={t} className="vx-tagrow">
            <div className="vx-tag-h">#{t} <i className="vx-count">{list.length}</i></div>
            {list.map(n => <NoteRow key={t + n.id} note={n} active={active === n.id} onMenu={openMenu} />)}
          </div>
        ))}
      </div>

      {menu && (
        <div className="vx-menu" style={{ left: Math.min(menu.x, window.innerWidth - 180), top: Math.min(menu.y, window.innerHeight - 190) }}
          onClick={e => e.stopPropagation()}>
          <button onClick={() => { togglePin(menu.id); setMenu(null) }}>
            <Pin size={13} /> {useVault.getState().pinned.includes(menu.id) ? 'Unpin tab' : 'Pin tab'}
          </button>
          <button onClick={() => {
            const cur = notes[menu.id]?.fm.title || ''
            const t = window.prompt('Rename note', cur)
            if (t?.trim()) renameNote(menu.id, t)
            setMenu(null)
          }}><Pencil size={13} /> Rename</button>
          <button onClick={() => { duplicateNote(menu.id); setMenu(null) }}><Copy size={13} /> Duplicate</button>
          <button className="danger" onClick={() => {
            const t = notes[menu.id]?.fm.title
            if (window.confirm(`Delete "${t}"? This can't be undone.`)) deleteNote(menu.id)
            setMenu(null)
          }}><Trash2 size={13} /> Delete</button>
        </div>
      )}
    </div>
  )
}
