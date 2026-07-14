// StudioShell — the shared non-scrollable cockpit for every Studio surface.
// Owns the chrome (title · optional segments · maturity chips · prompt +
// Generate · provenance panel · history filmstrip · premium approval gate) and
// leaves the STAGE preview + any studio-specific controls to the caller.
//
// This is the Marketing Fabric principle in UI form: one shell, many outputs.

import { MATURITY } from '@arganta/media-core'
import './studio.css'
import type { ReactNode } from 'react'

export interface Segment { id: string; label: string; hint?: string }
export interface HistoryItem { label: string; sub?: string; cost?: number; status?: string }

export const STAGES = [
  { s: MATURITY.DETERMINISTIC, label: 'Deterministic', note: 'free · reproducible' },
  { s: MATURITY.FREE_API, label: 'Free API', note: 'free' },
  { s: MATURITY.ECONOMICAL, label: 'Economical', note: 'low $' },
  { s: MATURITY.PREMIUM, label: 'Premium', note: 'approval' },
]

interface Props {
  title: string
  tagline?: string
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
  children?: ReactNode // the stage preview
}

export function StudioShell(p: Props) {
  const gated = p.result?.status === 'failed' && p.result?.error?.code === 'approval_required'
  const prov = p.result?.provenance

  return (
    <div className="studio">
      {/* top bar */}
      <header className="studio-top">
        <div className="studio-title"><span className="studio-dot" /> {p.title}
          {p.tagline && <small>· {p.tagline}</small>}
        </div>
        {p.segments && (
          <div className="seg">
            {p.segments.map(s => (
              <button key={s.id} className={'seg-btn' + (p.segment === s.id ? ' on' : '')} onClick={() => p.onSegment?.(s.id)} title={s.hint}>{s.label}</button>
            ))}
          </div>
        )}
        <div className="stages">
          {STAGES.map(st => (
            <button key={st.s} className={'stage-chip s' + st.s + (p.stage === st.s ? ' on' : '')} onClick={() => p.onStage(st.s)}>
              <b>{st.label}</b><i>{st.note}</i>
            </button>
          ))}
        </div>
      </header>

      {/* work band */}
      <div className="studio-band">
        <aside className="panel controls">
          <label className="fld">
            <span>{p.promptLabel || 'Prompt / spec'}</span>
            <textarea value={p.prompt} onChange={e => p.onPrompt(e.target.value)} rows={5} placeholder={p.promptPlaceholder || 'Describe what to generate…'} />
          </label>
          <button className="gen" onClick={p.onGenerate} disabled={p.busy}>{p.busy ? 'Generating…' : (p.generateLabel || 'Generate')}</button>
          {p.controlsExtra}
        </aside>

        <main className="panel stage">
          {gated ? (
            <div className="gate">
              <div className="lock">🔒</div>
              <h3>Premium is approval-gated</h3>
              <p>Stage&nbsp;3 requires explicit approval before any paid provider runs.</p>
              <button className="gen" onClick={() => p.onApprove?.()}>Request premium approval</button>
            </div>
          ) : p.children}
        </main>

        <aside className="panel prov">
          <h4>Provenance</h4>
          {p.result ? (
            p.result.status === 'failed' && !gated ? (
              <div className="prov-err">✗ {p.result.error.code}<br /><small>{p.result.error.message}</small></div>
            ) : (
              <dl>
                <dt>Status</dt><dd className={'st-' + p.result.status}>{p.result.status}</dd>
                <dt>Provider</dt><dd>{prov?.provider}</dd>
                <dt>Runtime</dt><dd>{p.result.runtime}</dd>
                <dt>Stage</dt><dd>{prov?.maturityLabel} ({prov?.maturityStage})</dd>
                {p.result.downgraded && <><dt>Routed</dt><dd className="warn">↓ cheapest capable</dd></>}
                <dt>Cost</dt><dd>{prov?.estimated ? '~' : ''}${prov?.cost ?? 0}</dd>
                {prov?.seed != null && <><dt>Seed</dt><dd>{prov.seed}</dd></>}
                {prov?.checksum && <><dt>Checksum</dt><dd className="mono">{prov.checksum.slice(0, 16)}</dd></>}
                {p.result.descriptor && <><dt>Fulfil via</dt><dd className="mono">{p.result.descriptor.engine || p.result.descriptor.tool}</dd></>}
              </dl>
            )
          ) : <div className="empty">Generate to see lineage</div>}
        </aside>
      </div>

      {/* history filmstrip — the only internally-scrolling zone */}
      <footer className="studio-strip">
        {(!p.history || p.history.length === 0) && <span className="strip-empty">Recent generations appear here</span>}
        {p.history?.map((h, i) => (
          <div key={i} className={'chip st-' + (h.status || 'deferred')}>
            <b>{h.label}</b>{h.sub && <span>{h.sub}</span>}<i>${h.cost ?? 0}</i>
          </div>
        ))}
      </footer>
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
      <p>{done ? 'Routed through the maturity engine — real generator not wired yet. See provenance →' : body}</p>
      <span className="stub-tag">{done ? `${result.provenance?.maturityLabel} · $${result.provenance?.cost ?? 0}` : 'shell ready · engine stubbed'}</span>
    </div>
  )
}
