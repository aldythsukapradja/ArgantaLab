// StudioShell — the shared non-scrollable cockpit for every Studio surface.
//
// UX: type a prompt → get the result instantly. The result dominates; one prompt
// bar sits at the bottom (Enter to run). A collapsible LEFT DRAWER holds version
// history + the current output's actions. Inside the prompt bar, a Claude-style
// PILL opens a popup to pick the tier (Free / Free API / Economical / Premium).
// The maturity + provenance spine is preserved but stays out of the way.

import { useState, useEffect, useRef, Component } from 'react'
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

// A render error in one segment (e.g. a lost WebGL context in the 3D Scene) must
// never white-screen the hub. Contained here; resets when the `key` changes.
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
  outputActions?: ReactNode
  controlsExtra?: ReactNode
  children?: ReactNode // the result
}

export function StudioShell(p: Props) {
  const [showProv, setShowProv] = useState(false)
  const [stageMenu, setStageMenu] = useState(false)
  const [drawer, setDrawer] = useState(true)
  const barRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    const close = (e: MouseEvent) => { if (barRef.current && !barRef.current.contains(e.target as Node)) setStageMenu(false) }
    if (stageMenu) document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [stageMenu])

  const gated = p.result?.status === 'failed' && p.result?.error?.code === 'approval_required'
  const errored = p.result?.status === 'failed' && !gated
  const prov = p.result?.provenance
  const placeholder = p.promptPlaceholder || 'Type a prompt…'

  const submit = (e?: React.FormEvent) => { e?.preventDefault(); if (!p.busy) p.onGenerate() }
  const onKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }

  return (
    <div className={'studio' + (drawer ? ' drawer-open' : '')}>
      {/* left drawer: versions + output */}
      <aside className="studio-drawer">
        <button className="drawer-toggle" onClick={() => setDrawer(d => !d)} title={drawer ? 'Collapse' : 'Expand'}>{drawer ? '‹' : '›'}</button>
        {drawer && (
          <div className="drawer-body">
            <div className="drawer-sec">Versions</div>
            <div className="versions">
              {(!p.history || p.history.length === 0) && <div className="drawer-empty">Your generations appear here</div>}
              {p.history?.map((h, i) => (
                <button key={i} className={'ver st-' + (h.status || 'deferred')} onClick={() => p.onRestore?.(h)} title="Restore this version">
                  <span className="ver-ico">{KIND_ICON[h.kind || ''] || '•'}</span>
                  <span className="ver-main"><b>{h.label}</b><i>{h.sub} · ${h.cost ?? 0} · {ago(h.time)}</i></span>
                </button>
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

      {/* main column: bar · result · prompt */}
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

        {/* one prompt bar — pill (popup) · input · run */}
        <form className="prompt-bar" onSubmit={submit} ref={barRef}>
          <div className="tier-select">
            <button type="button" className={'stage-pill s' + p.stage} onClick={() => setStageMenu(v => !v)} title="Choose tier">
              <span className="sp-dot" />{STAGES[p.stage]?.label}<span className="sp-caret">⌄</span>
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
          <textarea className="prompt-in" value={p.prompt} rows={1} placeholder={placeholder}
            onChange={e => p.onPrompt(e.target.value)} onKeyDown={onKey} />
          {p.controlsExtra && <div className="extra">{p.controlsExtra}</div>}
          <button type="submit" className="run" disabled={p.busy}>{p.busy ? '…' : (p.generateLabel || 'Generate')}</button>
        </form>
      </div>
    </div>
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
