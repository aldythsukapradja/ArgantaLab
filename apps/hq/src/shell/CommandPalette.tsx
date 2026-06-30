import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Search, CornerDownLeft, LayoutGrid, TrendingUp, Database, Gamepad2, Boxes,
  GraduationCap, Network, Megaphone, Table2, Sparkles, SunMoon, Coins,
} from 'lucide-react'
import { useHQ, surfaceLabel, type SurfaceId } from './store'

interface Cmd { id: string; label: string; hint: string; keywords: string; Icon: typeof Search; run: () => void }

const SURFACE_ICON: Record<SurfaceId, typeof Search> = {
  portfolio: LayoutGrid, growth: TrendingUp, data: Database, content: GraduationCap,
  game: Gamepad2, app: Boxes, agents: Network, broadcast: Megaphone,
}

// A real command palette — type to jump anywhere. Opens on ⌘K / Ctrl+K or the
// topbar search. Keyboard-first: ↑/↓ to move, ⏎ to run, Esc to close.
export function CommandPalette() {
  const { paletteOpen, closePalette, togglePalette, go, setDataTab, openAgent, toggleTheme } = useHQ()
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const cmds = useMemo<Cmd[]>(() => {
    const surfs: SurfaceId[] = ['portfolio', 'growth', 'data', 'game', 'app', 'content', 'agents', 'broadcast']
    const out: Cmd[] = surfs.map(s => ({
      id: 'go-' + s, label: surfaceLabel(s), hint: 'Go to', keywords: s, Icon: SURFACE_ICON[s], run: () => go(s),
    }))
    out.push(
      { id: 'g-mon', label: 'Growth · Monetization', hint: 'Open', keywords: 'revenue forecast arr subscription', Icon: Coins, run: () => go('growth') },
      { id: 'd-schema', label: 'Data · Schema', hint: 'Open', keywords: 'erd model', Icon: Database, run: () => { go('data'); setDataTab('schema') } },
      { id: 'd-tables', label: 'Data · Tables', hint: 'Open', keywords: 'rows preview', Icon: Table2, run: () => { go('data'); setDataTab('tables') } },
      { id: 'd-ont', label: 'Data · Ontology', hint: 'Open', keywords: 'semantic concepts', Icon: Network, run: () => { go('data'); setDataTab('ontology') } },
      { id: 'agent', label: 'Ask the COO Agent', hint: 'Action', keywords: 'ai chat brief', Icon: Sparkles, run: () => openAgent('expanded') },
      { id: 'theme', label: 'Toggle theme', hint: 'Action', keywords: 'dark light mode', Icon: SunMoon, run: () => toggleTheme() },
    )
    return out
  }, [go, setDataTab, openAgent, toggleTheme])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return cmds
    return cmds.filter(c => (c.label + ' ' + c.keywords + ' ' + c.hint).toLowerCase().includes(s))
  }, [q, cmds])

  // Global ⌘K / Ctrl+K toggles the palette from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); togglePalette() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [togglePalette])

  useEffect(() => { if (paletteOpen) { setQ(''); setSel(0); setTimeout(() => inputRef.current?.focus(), 20) } }, [paletteOpen])
  useEffect(() => { setSel(0) }, [q])
  useEffect(() => {
    listRef.current?.querySelector('.cmdk-item.on')?.scrollIntoView({ block: 'nearest' })
  }, [sel])

  if (!paletteOpen) return null

  const run = (c: Cmd) => { c.run(); closePalette() }
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(filtered.length - 1, s + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(0, s - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); const c = filtered[sel]; if (c) run(c) }
    else if (e.key === 'Escape') { e.preventDefault(); closePalette() }
  }

  return (
    <div className="cmdk-overlay" onClick={closePalette}>
      <div className="cmdk" onClick={e => e.stopPropagation()} role="dialog" aria-label="Command palette">
        <div className="cmdk-input">
          <Search size={16} color="var(--tx3)" />
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} onKeyDown={onKeyDown}
            placeholder="Jump to a surface, table, or action…" aria-label="Search commands" />
          <kbd>esc</kbd>
        </div>
        <div className="cmdk-list" ref={listRef}>
          {filtered.length === 0 && <div className="cmdk-empty">No matches for “{q}”</div>}
          {filtered.map((c, i) => (
            <button key={c.id} className={'cmdk-item' + (i === sel ? ' on' : '')}
              onMouseMove={() => setSel(i)} onClick={() => run(c)}>
              <c.Icon size={15} />
              <span className="cmdk-label">{c.label}</span>
              <span className="cmdk-tag">{c.hint}</span>
              {i === sel && <CornerDownLeft size={13} className="cmdk-enter" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
