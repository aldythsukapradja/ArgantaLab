// HQ Vault — Ctrl/⌘+P quick switcher & command palette (vault-scoped).
// Fuzzy-matches commands and every note; arrows + Enter, Esc closes.

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Search, FileText, FilePlus2, Waypoints, Frame, Database, Scale, Terminal,
  Columns2, PanelLeft, PanelRight, Download, Upload, RotateCcw, Settings2, CornerDownLeft, Eye,
} from 'lucide-react'
import { useVault } from '../store'
import { exportVault, importVault, downloadFile, noteToMarkdown } from '../storage'
import { parseFrontmatter, normalizeFrontmatter } from '../markdown'
import { PRODUCT_COLOR } from '../types'

interface Cmd { id: string; label: string; hint: string; keywords: string; Icon: typeof Search; color?: string; run: () => void }

/** subsequence fuzzy score — favors prefix and word-start hits */
function fuzzy(q: string, s: string): number {
  const needle = q.toLowerCase(), hay = s.toLowerCase()
  if (!needle) return 1
  if (hay.includes(needle)) return 100 - hay.indexOf(needle)
  let i = 0, score = 0
  for (let j = 0; j < hay.length && i < needle.length; j++) {
    if (hay[j] === needle[i]) { score += (j === 0 || hay[j - 1] === ' ' ? 6 : 1); i++ }
  }
  return i === needle.length ? score : -1
}

export function VaultCommandPalette() {
  const open = useVault(s => s.paletteOpen)
  const close = useVault(s => s.closePalette)
  const notes = useVault(s => s.notes)
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const cmds = useMemo<Cmd[]>(() => {
    const s = useVault.getState()
    const out: Cmd[] = [
      { id: 'new', label: 'New note', hint: 'Create', keywords: 'create add note', Icon: FilePlus2, run: () => { const t = window.prompt('New note title'); if (t?.trim()) s.createNote(t) } },
      { id: 'graph', label: 'Open graph view', hint: 'View', keywords: 'graph network links', Icon: Waypoints, run: () => s.setCenterView('graph') },
      { id: 'canvas', label: 'Open canvas', hint: 'View', keywords: 'canvas board map', Icon: Frame, run: () => s.setCenterView('canvas') },
      { id: 'bases', label: 'Open bases', hint: 'View', keywords: 'bases database table', Icon: Database, run: () => s.setCenterView('bases') },
      { id: 'decisions', label: 'Open decisions', hint: 'View', keywords: 'decision log ledger', Icon: Scale, run: () => s.setCenterView('decisions') },
      { id: 'prompts', label: 'Open prompt library', hint: 'View', keywords: 'prompts ai fable', Icon: Terminal, run: () => s.setCenterView('prompts') },
      { id: 'mode', label: 'Cycle edit / preview / split', hint: 'Ctrl+E', keywords: 'mode toggle preview edit split reading', Icon: Columns2, run: () => { s.setCenterView('note'); s.cycleEditorMode() } },
      { id: 'reading', label: 'Toggle reading view', hint: 'Editor', keywords: 'preview read', Icon: Eye, run: () => { s.setCenterView('note'); s.setEditorMode(s.editorMode === 'preview' ? 'edit' : 'preview') } },
      { id: 'left', label: 'Toggle left sidebar', hint: 'Layout', keywords: 'sidebar explorer files hide', Icon: PanelLeft, run: () => s.toggleLeft() },
      { id: 'right', label: 'Toggle right sidebar', hint: 'Layout', keywords: 'sidebar backlinks properties hide', Icon: PanelRight, run: () => s.toggleRight() },
      { id: 'export-note', label: 'Export current note as Markdown', hint: 'Export', keywords: 'download md save', Icon: Download, run: () => {
        const st = useVault.getState()
        const n = st.active ? st.notes[st.active] : null
        if (n) downloadFile(n.id + '.md', noteToMarkdown(n), 'text/markdown')
      } },
      { id: 'export-vault', label: 'Export whole vault (JSON)', hint: 'Export', keywords: 'download backup json all', Icon: Download, run: () => {
        const st = useVault.getState()
        downloadFile('hq-vault-' + new Date().toISOString().slice(0, 10) + '.json', exportVault(st.notes, st.canvas, st.settings), 'application/json')
      } },
      { id: 'import', label: 'Import Markdown or vault JSON…', hint: 'Import', keywords: 'upload restore md json', Icon: Upload, run: () => fileRef.current?.click() },
      { id: 'reset', label: 'Reset to seed vault', hint: 'Danger', keywords: 'reset seed restore default', Icon: RotateCcw, run: () => {
        if (window.confirm('Reset the vault to the seed notes? Your local changes will be lost.')) useVault.getState().resetVault()
      } },
      { id: 'settings', label: 'Vault settings', hint: 'Open', keywords: 'settings theme accent font', Icon: Settings2, run: () => s.openSettings() },
    ]
    for (const n of Object.values(notes)) {
      out.push({
        id: 'open-' + n.id, label: n.fm.title, hint: n.fm.product, color: PRODUCT_COLOR[n.fm.product],
        keywords: n.fm.tags.join(' ') + ' ' + n.fm.type, Icon: FileText,
        run: () => useVault.getState().openNote(n.id),
      })
    }
    return out
  }, [notes])

  const filtered = useMemo(() => {
    const needle = q.trim()
    if (!needle) return cmds.slice(0, 40)
    return cmds
      .map(c => ({ c, s: Math.max(fuzzy(needle, c.label), fuzzy(needle, c.keywords) * 0.6) }))
      .filter(x => x.s >= 0)
      .sort((a, b) => b.s - a.s)
      .map(x => x.c)
      .slice(0, 40)
  }, [q, cmds])

  useEffect(() => { if (open) { setQ(''); setSel(0); setTimeout(() => inputRef.current?.focus(), 20) } }, [open])
  useEffect(() => { setSel(0) }, [q])
  useEffect(() => { listRef.current?.querySelector('.vk-item.on')?.scrollIntoView({ block: 'nearest' }) }, [sel])

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const text = await file.text()
    const st = useVault.getState()
    if (file.name.endsWith('.json')) {
      const res = importVault(text)
      if (!res) { window.alert('Not a valid HQ Vault export.'); return }
      if (window.confirm(`Import ${res.notes.length} notes? This replaces the current vault.`)) {
        st.replaceVault(res.notes, res.canvas, res.settings)
      }
    } else {
      // markdown → new note
      const { fm, body } = parseFrontmatter(text)
      const title = (typeof fm.title === 'string' && fm.title) || file.name.replace(/\.md$/i, '')
      st.createNote(title, normalizeFrontmatter(fm, title), body || text)
    }
    close()
  }

  if (!open) return (
    <input ref={fileRef} type="file" accept=".md,.json,.markdown,.txt" style={{ display: 'none' }} onChange={onImportFile} />
  )

  const run = (c: Cmd) => { c.run(); if (c.id !== 'import') close() }
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(filtered.length - 1, s + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(0, s - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); const c = filtered[sel]; if (c) run(c) }
    else if (e.key === 'Escape') { e.preventDefault(); close() }
  }

  return (
    <div className="vk-overlay" onClick={close}>
      <input ref={fileRef} type="file" accept=".md,.json,.markdown,.txt" style={{ display: 'none' }} onChange={onImportFile} />
      <div className="vk" onClick={e => e.stopPropagation()} role="dialog" aria-label="Vault command palette">
        <div className="vk-input">
          <Search size={15} />
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} onKeyDown={onKeyDown}
            placeholder="Open a note or run a command…" aria-label="Vault palette search" />
          <kbd>esc</kbd>
        </div>
        <div className="vk-list" ref={listRef}>
          {filtered.length === 0 && <div className="vk-none">No matches for “{q}”</div>}
          {filtered.map((c, i) => (
            <button key={c.id} className={'vk-item' + (i === sel ? ' on' : '')}
              onMouseMove={() => setSel(i)} onClick={() => run(c)}>
              <c.Icon size={14} style={c.color ? { color: c.color } : undefined} />
              <span className="vk-label">{c.label}</span>
              <span className="vk-hint">{c.hint}</span>
              {i === sel && <CornerDownLeft size={12} className="vk-enter" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
