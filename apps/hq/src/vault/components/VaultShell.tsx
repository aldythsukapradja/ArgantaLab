// HQ Vault — the workspace shell: activity ribbon · left sidebar · tabbed
// center · right context panel · status bar. Obsidian-inspired interaction
// model, Arganta graphite skin, fully local-first.

import { useEffect, useMemo, useState } from 'react'
import {
  Files, Search, Waypoints, Frame, Database, Scale, Terminal, Settings2,
  X, Pin, PanelRight, Pencil, Eye, Columns2, FileText, Download,
  HardDrive, Command as CommandIcon, Vault as VaultIcon,
} from 'lucide-react'
import { useVault, type CenterView, type EditorMode } from '../store'
import { useHQ } from '../../shell/store'
import { FileExplorer } from './FileExplorer'
import { SearchPanel } from './SearchPanel'
import { MarkdownEditor } from './MarkdownEditor'
import { Preview } from './Preview'
import { RightPanel } from './RightPanel'
import { GraphView } from './GraphView'
import { CanvasView } from './CanvasView'
import { BasesView } from './BasesView'
import { DecisionsView } from './DecisionsView'
import { PromptsView } from './PromptsView'
import { VaultCommandPalette } from './VaultCommandPalette'
import { VaultSettingsSheet } from './VaultSettings'
import { wordCount, parseWikiLinks } from '../markdown'
import { downloadFile, noteToMarkdown } from '../storage'
import { PRODUCT_COLOR } from '../types'

const RIBBON: { view: CenterView; Icon: typeof Files; label: string }[] = [
  { view: 'graph', Icon: Waypoints, label: 'Graph' },
  { view: 'canvas', Icon: Frame, label: 'Canvas' },
  { view: 'bases', Icon: Database, label: 'Bases' },
  { view: 'decisions', Icon: Scale, label: 'Decisions' },
  { view: 'prompts', Icon: Terminal, label: 'Prompts' },
]

const MODE_META: Record<EditorMode, { Icon: typeof Pencil; label: string }> = {
  edit: { Icon: Pencil, label: 'Editing' },
  preview: { Icon: Eye, label: 'Reading' },
  split: { Icon: Columns2, label: 'Split' },
}

function timeAgo(ts: number): string {
  if (!ts) return 'not yet'
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 5) return 'just now'
  if (s < 60) return s + 's ago'
  if (s < 3600) return Math.floor(s / 60) + 'm ago'
  if (s < 86400) return Math.floor(s / 3600) + 'h ago'
  return new Date(ts).toLocaleDateString()
}

// Below 760px the left explorer collapses into a slide-over drawer, so the
// workspace tracks the viewport rather than persisting a desktop sidebar state.
function useIsMobile() {
  const [m, setM] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 760px)')
    const on = () => setM(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return m
}

export function VaultShell() {
  const centerView = useVault(s => s.centerView)
  const setCenterView = useVault(s => s.setCenterView)
  const leftPanel = useVault(s => s.leftPanel)
  const setLeftPanel = useVault(s => s.setLeftPanel)
  const settings = useVault(s => s.settings)
  const toggleLeft = useVault(s => s.toggleLeft)
  const toggleRight = useVault(s => s.toggleRight)
  const tabs = useVault(s => s.tabs)
  const active = useVault(s => s.active)
  const pinned = useVault(s => s.pinned)
  const notes = useVault(s => s.notes)
  const index = useVault(s => s.index)
  const openNote = useVault(s => s.openNote)
  const closeTab = useVault(s => s.closeTab)
  const togglePin = useVault(s => s.togglePin)
  const editorMode = useVault(s => s.editorMode)
  const setEditorMode = useVault(s => s.setEditorMode)
  const cycleEditorMode = useVault(s => s.cycleEditorMode)
  const lastSaved = useVault(s => s.lastSaved)
  const openPalette = useVault(s => s.openPalette)
  const openSettings = useVault(s => s.openSettings)
  const [, bumpClock] = useState(0)

  const activeNote = active ? notes[active] : null

  // refresh the "saved Xs ago" readout
  useEffect(() => {
    const t = setInterval(() => bumpClock(c => c + 1), 15_000)
    return () => clearInterval(t)
  }, [])

  // vault-scoped shortcuts: Ctrl+P palette, Ctrl+E cycle mode
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'p') { e.preventDefault(); openPalette() }
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'e') { e.preventDefault(); cycleEditorMode() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openPalette, cycleEditorMode])

  const stats = useMemo(() => {
    if (!activeNote) return null
    return {
      words: wordCount(activeNote.body),
      out: (index.outgoing[activeNote.id] || []).length,
      back: (index.backlinks[activeNote.id] || []).length,
      broken: (index.broken[activeNote.id] || []).length,
      links: parseWikiLinks(activeNote.body).length,
    }
  }, [activeNote, index])

  // theme resolution: by default the Vault follows the Circle HQ shell theme
  // so the workspace reads as one product; dark/light are explicit overrides.
  const hqTheme = useHQ(s => s.theme)
  const resolvedTheme = settings.theme === 'hq' ? hqTheme : settings.theme

  // Mobile drawer: a transient overlay for the explorer/search, independent of
  // the persisted desktop `leftOpen`. It closes when a note opens or the scrim
  // is tapped, so the sidebar never traps the reader on a phone.
  const isMobile = useIsMobile()
  const [drawerOpen, setDrawerOpen] = useState(false)
  useEffect(() => { setDrawerOpen(false) }, [active])
  const leftShown = isMobile ? drawerOpen : settings.leftOpen

  const handleLeft = (panel: 'files' | 'search') => {
    if (isMobile) {
      setLeftPanel(panel)
      if (panel === 'files') setCenterView('note')
      setDrawerOpen(o => !(o && leftPanel === panel))
    } else if (panel === 'files') {
      if (settings.leftOpen && leftPanel === 'files' && centerView === 'note') toggleLeft()
      else { setLeftPanel('files'); setCenterView('note') }
    } else {
      if (settings.leftOpen && leftPanel === 'search') toggleLeft()
      else setLeftPanel('search')
    }
  }

  return (
    <div className={'vault' + (settings.compact ? ' compact' : '')}
      data-vtheme={resolvedTheme} data-vaccent={settings.accent}>

      {/* ── Activity ribbon ─────────────────────────────── */}
      <div className="v-ribbon">
        <div className="v-ribbon-mark" title="HQ Vault"><VaultIcon size={16} /></div>
        <button className={'v-rib' + (centerView === 'note' && leftShown && leftPanel === 'files' ? ' on' : '')}
          title="Files" onClick={() => handleLeft('files')}>
          <Files size={17} />
        </button>
        <button className={'v-rib' + (leftShown && leftPanel === 'search' ? ' on' : '')}
          title="Search" onClick={() => handleLeft('search')}>
          <Search size={17} />
        </button>
        <div className="v-rib-sep" />
        {RIBBON.map(r => (
          <button key={r.view} className={'v-rib' + (centerView === r.view ? ' on' : '')}
            title={r.label} onClick={() => { setCenterView(r.view); setDrawerOpen(false) }}>
            <r.Icon size={17} />
          </button>
        ))}
        <div className="v-rib-flex" />
        <button className="v-rib" title="Command palette (Ctrl+P)" onClick={openPalette}><CommandIcon size={16} /></button>
        <button className="v-rib" title="Settings" onClick={openSettings}><Settings2 size={17} /></button>
      </div>

      {/* ── Left sidebar (slide-over drawer on mobile) ──── */}
      {(isMobile || settings.leftOpen) && (
        <div className={'v-left' + (isMobile ? ' v-left-drawer' : '') + (isMobile && drawerOpen ? ' open' : '')}>
          {leftPanel === 'files' ? <FileExplorer /> : <SearchPanel />}
        </div>
      )}
      {isMobile && drawerOpen && <div className="v-left-scrim" onClick={() => setDrawerOpen(false)} />}

      {/* ── Center ──────────────────────────────────────── */}
      <div className="v-center">
        {centerView === 'note' && (
          <>
            <div className="v-tabs">
              <div className="v-tabs-scroll">
                {tabs.map(id => {
                  const n = notes[id]
                  if (!n) return null
                  const isPinned = pinned.includes(id)
                  return (
                    <div key={id} className={'v-tab' + (active === id ? ' on' : '')}
                      onClick={() => openNote(id)} title={n.fm.title}>
                      <span className="vp-dot" style={{ background: PRODUCT_COLOR[n.fm.product] }} />
                      <span className="v-tab-t">{n.fm.title}</span>
                      {isPinned
                        ? <button className="v-tab-x pin" title="Unpin" onClick={e => { e.stopPropagation(); togglePin(id) }}><Pin size={10} /></button>
                        : <button className="v-tab-x" title="Close tab" onClick={e => { e.stopPropagation(); closeTab(id) }}><X size={12} /></button>}
                    </div>
                  )
                })}
              </div>
              {activeNote && (
                <div className="v-tabbar-tools">
                  <button className="vg-tool" title="Export note (.md)"
                    onClick={() => downloadFile(activeNote.id + '.md', noteToMarkdown(activeNote), 'text/markdown')}>
                    <Download size={13} />
                  </button>
                  <div className="v-modes">
                    {(Object.keys(MODE_META) as EditorMode[]).map(m => {
                      const { Icon, label } = MODE_META[m]
                      return (
                        <button key={m} className={editorMode === m ? 'on' : ''} title={label + ' (Ctrl+E cycles)'}
                          onClick={() => setEditorMode(m)}><Icon size={13} /></button>
                      )
                    })}
                  </div>
                  <button className={'vg-tool v-right-toggle' + (settings.rightOpen ? ' active' : '')} title="Toggle context panel"
                    onClick={toggleRight}><PanelRight size={14} /></button>
                </div>
              )}
            </div>

            {activeNote ? (
              <div className={'v-note' + (editorMode === 'split' ? ' split' : '')}>
                {(editorMode === 'edit' || editorMode === 'split') && (
                  <div className="v-pane"><MarkdownEditor noteId={activeNote.id} /></div>
                )}
                {editorMode === 'split' && <div className="v-pane-sep" />}
                {(editorMode === 'preview' || editorMode === 'split') && (
                  <div className="v-pane v-pane-read"><Preview body={activeNote.body} title={activeNote.fm.title} /></div>
                )}
              </div>
            ) : (
              <div className="v-note-empty">
                <FileText size={26} />
                <p className="v-note-empty-t">No note open</p>
                <p className="v-dim">Pick a note in the explorer, press <kbd>Ctrl P</kbd> to jump anywhere,<br />or create a new note to start thinking.</p>
                <button className="vg-open" style={{ maxWidth: 180 }} onClick={() => {
                  const t = window.prompt('New note title'); if (t?.trim()) useVault.getState().createNote(t)
                }}>New note</button>
              </div>
            )}
          </>
        )}

        {centerView === 'graph' && <GraphView />}
        {centerView === 'canvas' && <CanvasView />}
        {centerView === 'bases' && <BasesView />}
        {centerView === 'decisions' && <div className="v-page"><DecisionsView /></div>}
        {centerView === 'prompts' && <div className="v-page"><PromptsView /></div>}
      </div>

      {/* ── Right sidebar ───────────────────────────────── */}
      {settings.rightOpen && centerView === 'note' && activeNote && (
        <RightPanel noteId={activeNote.id} />
      )}

      {/* ── Status bar ──────────────────────────────────── */}
      <div className="v-status">
        <span className="v-st-note">
          {activeNote
            ? <><span className="vp-dot" style={{ background: PRODUCT_COLOR[activeNote.fm.product] }} />{activeNote.fm.product} / {activeNote.fm.title}.md</>
            : centerView !== 'note' ? RIBBON.find(r => r.view === centerView)?.label : 'HQ Vault'}
        </span>
        {stats && (
          <>
            <span className="v-st">{stats.words} words</span>
            <span className="v-st">{stats.back} in · {stats.out} out{stats.broken > 0 ? ` · ${stats.broken} broken` : ''}</span>
          </>
        )}
        <span className="v-st-flex" />
        <span className="v-st" title="Autosaves to this browser">saved {timeAgo(lastSaved)}</span>
        <span className="v-st v-st-store" title="Local-first: stored in this browser, export anytime">
          <HardDrive size={11} /> local vault
        </span>
        <span className="v-st">{resolvedTheme}</span>
        {centerView === 'note' && activeNote && (
          <button className="v-st v-st-btn" onClick={cycleEditorMode} title="Ctrl+E">
            {MODE_META[editorMode].label.toLowerCase()}
          </button>
        )}
      </div>

      <VaultCommandPalette />
      <VaultSettingsSheet />
    </div>
  )
}
