// StudioShell — the shared non-scrollable cockpit for every Studio surface.
//
// Layout (learned from Claude Code's session sidebar + AI-SDK's PromptInput):
//   ┌────────┬───────────────────────────────┐
//   │ drawer │ brand · segment tabs          │
//   │ search │ COMPOSER (tier ▾ · prompt · ✨)│  ← composer at the TOP
//   │ versns │───────────────────────────────│
//   │ output │        RESULT (dominates)     │
//   └────────┴───────────────────────────────┘
// Type → Enter/Cmd+Enter → result. Versions are searchable + restorable; the
// tier picker is a Claude-style popup; the maturity+provenance spine recedes.

import { useState, useEffect, useRef, useMemo, Component } from 'react'
import { MATURITY } from '@arganta/media-core'
import './studio.css'
import type { ReactNode } from 'react'

export interface Segment { id: string; label: string; hint?: string }
export interface HistoryItem { kind?: string; prompt?: string; stage?: number; label: string; sub?: string; cost?: number; status?: string; time?: number }

export const STAGES = [
  { s: MATURITY.DETERMINISTIC, label: 'Free', note: 'deterministic · reproducible · $0' },
  { s: MATURITY.FREE_API, label: 'Free API', note: 'free hosted models' },
  { s: MATURITY.ECONOMICAL, label: 'Economical', note: 'cheap paid models' },
  { s: MATURITY.PREMIUM, label: 'Premium', note: 'best providers · needs approval' },
]
const KIND_ICON: Record<string, string> = { image: '🖼️', music: '🎵', video: '🎬', website: '🌐', brand: '🎨', deck: '🎞️', scene: '🧊', campaign: '🚀', analytics: '📊' }
const ago = (t?: number) => { if (!t) return ''; const s = (Date.now() - t) / 1000; return s < 60 ? 'now' : s < 3600 ? `${Math.floor(s / 60)}m` : `${Math.floor(s / 3600)}h` }

class StageBoundary extends Component<{ children: ReactNode }, { err: boolean }> {
  state = { err: false }
  static getDerivedStateFromError() { return { err: true } }
  componentDidCatch() {}
  render() {
    return this.state.err
      ? <div className="empty err">This preview hit an error<br /><small>(often a WebGL/context limit) — switch segment or regenerate.</small></div>
      : this.props.children
  }
}

interface Props {
  title: string
  segments?: Segment[]
  segment?: string
  onSegment?: (id: string) => void
  stage: number
  onStage: (s: number) => void
  prompt: string
  onPrompt: (v: string) => void
  promptPlaceholder?: string
  generateLabel?: string
  onGenerate: () => void
  busy?: boolean
  result: any | null
  onApprove?: () => void
  history?: HistoryItem[]
  onRestore?: (h: HistoryItem) => void
  onDelete?: (h: HistoryItem) => void
  outputActions?: ReactNode
  controlsExtra?: ReactNode
  children?: ReactNode // the result
}

export function StudioShell(p: Props) {
  const [showProv, setShowProv] = useState(false)
  const [stageMenu, setStageMenu] = useState(false)
  const [drawer, setDrawer] = useState(true)
  const [q, setQ] = useState('')
  const composerRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    const close = (e: MouseEvent) => { if (composerRef.current && !composerRef.current.contains(e.target as Node)) setStageMenu(false) }
    if (stageMenu) document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [stageMenu])

  const gated = p.result?.status === 'failed' && p.result?.error?.code === 'approval_required'
  const errored = p.result?.status === 'failed' && !gated
  const prov = p.result?.provenance
  const placeholder = p.promptPlaceholder || 'Type a prompt…'

  const versions = useMemo(() => {
    const s = q.trim().toLowerCase()
    const h = p.history || []
    return s ? h.filter(v => `${v.prompt || ''} ${v.label} ${v.kind || ''}`.toLowerCase().includes(s)) : h
  }, [p.history, q])

  const submit = (e?: React.FormEvent) => { e?.preventDefault(); if (!p.busy) p.onGenerate() }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
  }

  return (
    <div className={'studio' + (drawer ? ' drawer-open' : '')}>
      {/* left drawer: search · versions · output */}
      <aside className="studio-drawer">
        <button className="drawer-toggle" onClick={() => setDrawer(d => !d)} title={drawer ? 'Collapse' : 'Expand'}>{drawer ? '‹' : '›'}</button>
        {drawer && (
          <div className="drawer-body">
            <div className="drawer-search">
              <span className="ds-ico">⌕</span>
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search versions…" />
              {q && <button className="ds-clear" onClick={() => setQ('')}>×</button>}
            </div>
            <div className="drawer-sec">Versions <span className="sec-count">{versions.length}</span></div>
            <div className="versions">
              {(!p.history || p.history.length === 0) && <div className="drawer-empty">Your generations appear here</div>}
              {p.history && p.history.length > 0 && versions.length === 0 && <div className="drawer-empty">No matches for “{q}”</div>}
              {versions.map((h, i) => (
                <div key={i} className={'ver st-' + (h.status || 'deferred')}>
                  <button className="ver-hit" onClick={() => p.onRestore?.(h)} title="Restore this version">
                    <span className="ver-ico">{KIND_ICON[h.kind || ''] || '•'}</span>
                    <span className="ver-main">
                      <b>{h.prompt || h.label}</b>
                      <i>{h.label} · {h.sub} · ${h.cost ?? 0} · {ago(h.time)}</i>
                    </span>
                  </button>
                  {p.onDelete && <button className="ver-del" title="Remove" onClick={() => p.onDelete?.(h)}>×</button>}
                </div>
              ))}
            </div>
            {(prov && !gated && !errored) && (
              <div className="drawer-out">
                <div className="drawer-sec">Output</div>
                <div className="out-prov"><span className="pc-dot" data-s={prov.maturityStage} />{prov.provider} · {prov.estimated ? '~' : ''}${prov.cost ?? 0}</div>
                {p.outputActions && <div className="out-actions">{p.outputActions}</div>}
              </div>
            )}
          </div>
        )}
      </aside>

      {/* main column: bar · composer (top) · result */}
      <div className="studio-main">
        <header className="studio-bar">
          <span className="studio-brand"><span className="studio-dot" />{p.title}</span>
          {p.segments && (
            <nav className="seg-tabs">
              {p.segments.map(s => (
                <button key={s.id} className={'seg-tab' + (p.segment === s.id ? ' on' : '')} onClick={() => p.onSegment?.(s.id)} title={s.hint}>{s.label}</button>
              ))}
            </nav>
          )}
        </header>

        {/* composer — one unified box at the top (textarea + inner toolbar) */}
        <form className="composer" onSubmit={submit} ref={composerRef}>
          <div className="composer-box">
            <textarea className="prompt-in" value={p.prompt} rows={1} placeholder={placeholder}
              onChange={e => p.onPrompt(e.target.value)} onKeyDown={onKey} autoFocus />
            <div className="composer-bar">
              <div className="tier-select">
                <button type="button" className={'stage-pill s' + p.stage} onClick={() => setStageMenu(v => !v)} title="Choose generation tier">
                  <span className="sp-dot" />{STAGES[p.stage]?.label}
                  <svg className="sp-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
                </button>
                {stageMenu && (
                  <div className="tier-menu">
                    <div className="tier-menu-h">Generation tier</div>
                    {STAGES.map(st => (
                      <button key={st.s} type="button" className={'tier-opt s' + st.s + (p.stage === st.s ? ' on' : '')} onClick={() => { p.onStage(st.s); setStageMenu(false) }}>
                        <span className="sp-dot" />
                        <span className="tier-main"><b>{st.label}</b><i>{st.note}</i></span>
                        {p.stage === st.s && <span className="tier-check">✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="composer-actions">
                {p.controlsExtra && <div className="extra">{p.controlsExtra}</div>}
                <button type="submit" className="run" disabled={p.busy || !p.prompt.trim()}>
                  <Sparkle />{p.busy ? 'Working…' : (p.generateLabel || 'Generate')}
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* the result dominates */}
        <main className="studio-stage">
          {gated ? (
            <div className="gate">
              <div className="lock">🔒</div>
              <h3>Premium — one tap to approve</h3>
              <p>This tier uses a paid provider. Approve to run it.</p>
              <button className="gen" onClick={() => p.onApprove?.()}>Approve &amp; generate</button>
            </div>
          ) : errored ? (
            <div className="empty err">✗ {p.result.error.code}<br /><small>{p.result.error.message}</small></div>
          ) : <StageBoundary key={p.segment}>{p.children}</StageBoundary>}

          {prov && !gated && !errored && (
            <div className={'prov-chip' + (showProv ? ' open' : '')} onClick={() => setShowProv(v => !v)}>
              <span className="pc-dot" data-s={prov.maturityStage} />{prov.provider} · {prov.estimated ? '~' : ''}${prov.cost ?? 0}
              {showProv && (
                <div className="prov-pop" onClick={e => e.stopPropagation()}>
                  <b>Provenance</b>
                  <div><i>status</i><span className={'st-' + p.result.status}>{p.result.status}</span></div>
                  <div><i>runtime</i><span>{p.result.runtime}</span></div>
                  <div><i>tier</i><span>{prov.maturityLabel}</span></div>
                  {p.result.downgraded && <div><i>routed</i><span className="warn">↓ cheapest</span></div>}
                  {prov.seed != null && <div><i>seed</i><span>{prov.seed}</span></div>}
                  {prov.checksum && <div><i>checksum</i><span className="mono">{prov.checksum.slice(0, 16)}</span></div>}
                  {p.result.descriptor && <div><i>source</i><span className="mono">{p.result.descriptor.engine || p.result.descriptor.tool}</span></div>}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

/** A twinkling 4-point sparkle (main star + companion) for the Make button. */
function Sparkle() {
  return (
    <svg className="run-spark" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path className="spark-a" d="M12 1.5c.3 3.9 1.4 6.3 3 7.9s4 2.7 7.5 3.1c-3.5.4-5.9 1.5-7.5 3.1s-2.7 4-3 7.9c-.3-3.9-1.4-6.3-3-7.9s-4-2.7-7.5-3.1c3.5-.4 5.9-1.5 7.5-3.1s2.7-4 3-7.9Z" />
      <path className="spark-b" d="M19.5 2.2c.15 1.7.6 2.6 1.3 3.3s1.6 1.1 3.2 1.3c-1.6.2-2.5.6-3.2 1.3s-1.1 1.6-1.3 3.3c-.15-1.7-.6-2.6-1.3-3.3s-1.6-1.1-3.2-1.3c1.6-.2 2.5-.6 3.2-1.3s1.15-1.6 1.3-3.3Z" />
    </svg>
  )
}

/** Placeholder card for a segment whose real engine isn't wired yet. */
export function StubStage({ icon, title, body, result }: { icon: string; title: string; body: string; result?: any }) {
  const done = result && result.status !== 'failed'
  return (
    <div className="stub-card">
      <div className="big">{icon}</div>
      <h3>{title}</h3>
      <p>{done ? 'Routed through the maturity engine — real generator not wired yet.' : body}</p>
    </div>
  )
}
