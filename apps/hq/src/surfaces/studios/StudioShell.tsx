// StudioShell — the shared non-scrollable cockpit for every Studio surface.
//
// Redesigned for the simplest possible loop, learned from v0 / Suno / Julius:
//   type a prompt → get the result instantly. That's it.
//
// The result DOMINATES the page. One prompt bar at the bottom (Enter to run).
// The maturity + provenance spine is preserved but recedes into two subtle
// affordances: a stage pill in the prompt bar, and a provenance chip on the
// result (click to expand full lineage). No side panels, no history clutter.

import { useState, Component } from 'react'
import { MATURITY } from '@arganta/media-core'
import './studio.css'
import type { ReactNode } from 'react'

// A render error in one segment (e.g. a lost WebGL context in the 3D Scene, or a
// chart glitch) must never white-screen the whole hub. This contains it and
// resets when you switch segments (the `key` prop remounts it).
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

export interface Segment { id: string; label: string; hint?: string }
export interface HistoryItem { label: string; sub?: string; cost?: number; status?: string }

export const STAGES = [
  { s: MATURITY.DETERMINISTIC, label: 'Free', note: 'deterministic · reproducible' },
  { s: MATURITY.FREE_API, label: 'Free API', note: 'free hosted' },
  { s: MATURITY.ECONOMICAL, label: 'Economical', note: 'low cost' },
  { s: MATURITY.PREMIUM, label: 'Premium', note: 'needs approval' },
]

interface Props {
  title: string
  segments?: Segment[]
  segment?: string
  onSegment?: (id: string) => void
  stage: number
  onStage: (s: number) => void
  prompt: string
  onPrompt: (v: string) => void
  promptLabel?: string
  promptPlaceholder?: string
  generateLabel?: string
  onGenerate: () => void
  busy?: boolean
  result: any | null
  onApprove?: () => void
  history?: HistoryItem[]
  controlsExtra?: ReactNode
  children?: ReactNode // the result
}

export function StudioShell(p: Props) {
  const [showProv, setShowProv] = useState(false)
  const gated = p.result?.status === 'failed' && p.result?.error?.code === 'approval_required'
  const errored = p.result?.status === 'failed' && !gated
  const prov = p.result?.provenance
  const placeholder = p.promptPlaceholder || `${p.promptLabel || 'Type a prompt'}…`

  const submit = (e?: React.FormEvent) => { e?.preventDefault(); if (!p.busy) p.onGenerate() }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
  }

  return (
    <div className="studio">
      {/* thin top bar: brand + segment pills */}
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

      {/* the result dominates */}
      <main className="studio-stage">
        {gated ? (
          <div className="gate">
            <div className="lock">🔒</div>
            <h3>Premium — one tap to approve</h3>
            <p>This stage uses a paid provider. Approve to run it.</p>
            <button className="gen" onClick={() => p.onApprove?.()}>Approve &amp; generate</button>
          </div>
        ) : errored ? (
          <div className="empty err">✗ {p.result.error.code}<br /><small>{p.result.error.message}</small></div>
        ) : <StageBoundary key={p.segment}>{p.children}</StageBoundary>}

        {/* subtle provenance chip on the result */}
        {prov && !gated && !errored && (
          <div className={'prov-chip' + (showProv ? ' open' : '')} onClick={() => setShowProv(v => !v)}>
            <span className="pc-dot" data-s={prov.maturityStage} />
            {prov.provider} · {prov.estimated ? '~' : ''}${prov.cost ?? 0}
            {showProv && (
              <div className="prov-pop" onClick={e => e.stopPropagation()}>
                <b>Provenance</b>
                <div><i>status</i><span className={'st-' + p.result.status}>{p.result.status}</span></div>
                <div><i>runtime</i><span>{p.result.runtime}</span></div>
                <div><i>stage</i><span>{prov.maturityLabel}</span></div>
                {p.result.downgraded && <div><i>routed</i><span className="warn">↓ cheapest</span></div>}
                {prov.seed != null && <div><i>seed</i><span>{prov.seed}</span></div>}
                {prov.checksum && <div><i>checksum</i><span className="mono">{prov.checksum.slice(0, 16)}</span></div>}
                {p.result.descriptor && <div><i>source</i><span className="mono">{p.result.descriptor.engine || p.result.descriptor.tool}</span></div>}
              </div>
            )}
          </div>
        )}
      </main>

      {/* one prompt bar — type, Enter, done */}
      <form className="prompt-bar" onSubmit={submit}>
        <button type="button" className={'stage-pill s' + p.stage} title={STAGES[p.stage]?.note}
          onClick={() => p.onStage((p.stage + 1) % 4)}>
          <span className="sp-dot" />{STAGES[p.stage]?.label}
        </button>
        <textarea className="prompt-in" value={p.prompt} rows={1} placeholder={placeholder}
          onChange={e => p.onPrompt(e.target.value)} onKeyDown={onKey} />
        {p.controlsExtra && <div className="extra">{p.controlsExtra}</div>}
        <button type="submit" className="run" disabled={p.busy}>{p.busy ? '…' : (p.generateLabel || 'Generate')}</button>
      </form>
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
