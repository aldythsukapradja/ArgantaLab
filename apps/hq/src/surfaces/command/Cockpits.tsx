import { useState } from 'react'
import { Radar, Activity, BookOpen, Scale, Users2, Compass, Gavel, Coins } from 'lucide-react'
import { NODES } from '../../data/graph/seed'
import {
  coverage, nodeById, ownedBy, rollupHealth, pendingConsults,
} from '../../data/graph/engine'
import { officeById, OFFICE_ORDER } from '../../data/graph/agents'
import { AGENTS, officeOf, OFFICE_META, OFFICE_KEYS, MODEL_META } from '../../data/agents'
import type { Source, GraphNode, OfficeId } from '../../data/graph/types'
import { SourceBadge } from './SourceBadge'
import { HealthDot } from './HealthDot'

const statusColor = (s: Source) =>
  s === 'live' ? 'var(--ok)' : s === 'partial' ? 'var(--warn)' : s === 'simulated' ? 'var(--acc)' : 'var(--bg3)'

function worst(nodes: GraphNode[]) {
  const rank = { green: 0, amber: 1, blind: 2, red: 3 } as const
  let w: keyof typeof rank = 'green'
  for (const n of nodes) { const h = rollupHealth(n).health; if (rank[h] >= rank[w]) w = h }
  return nodes.length ? w : 'blind'
}

// ── TECHNOLOGY — the coverage x-ray (grey = the build backlog) ──────────────
export function CoverageXray() {
  const [sel, setSel] = useState<string | null>(null)
  const cov = coverage()
  const cells = NODES.filter(n => n.metric).sort((a, b) => order(a.status) - order(b.status))
  const s = sel ? nodeById(sel) : null
  return (
    <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="row" style={{ gap: 7, fontSize: 13, fontWeight: 600 }}><Radar size={14} /> Coverage x-ray</div>
      <div style={{ fontSize: 11, color: 'var(--tx3)' }}>
        <b style={{ color: cov.pct >= 80 ? 'var(--ok)' : 'var(--warn)' }}>{cov.pct}%</b> grounded → 80% target · <b>{cov.placeholder}</b> surfaces blind = the CTO backlog. Tap a cell.
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {cells.map(n => {
          const on = sel === n.id
          const c = statusColor(n.status)
          const blind = n.status === 'placeholder'
          return (
            <button key={n.id} onClick={() => setSel(on ? null : n.id)} title={n.label}
              style={{
                width: 15, height: 15, borderRadius: 4, cursor: 'pointer', padding: 0,
                background: blind ? 'transparent' : c,
                border: blind ? `1.5px dashed var(--bd2)` : on ? '2px solid var(--tx)' : 'none',
                outline: on && !blind ? '2px solid var(--tx)' : 'none',
              }} />
          )
        })}
      </div>
      {s && (
        <div style={{ borderTop: '1px solid var(--bd)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="row" style={{ gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{s.label}</span>
            <SourceBadge source={s.status} small />
            <span className="pill pill-mut" style={{ fontSize: 10 }}>{officeById((s.owner ?? 'technology') as OfficeId).chief}</span>
          </div>
          {s.status === 'placeholder'
            ? <div style={{ fontSize: 11.5, color: 'var(--tx2)', lineHeight: 1.5 }}>
                Blind. Wire {s.emits?.length
                  ? <>event <span className="src">{s.emits.join(', ')}</span> into <span className="src">hq_event</span></>
                  : <>a <span className="src">feature_view</span> event into <span className="src">hq_event</span></>}, then read via <span className="src">surface_health()</span>. → <b>INSTRUMENT</b> verdict.
              </div>
            : <div style={{ fontSize: 11.5, color: 'var(--tx2)', lineHeight: 1.5 }}>Grounded — backed by a real table/RPC. Value lands when the client swaps to the live snapshot.</div>}
        </div>
      )}
    </div>
  )
}
const order = (s: Source) => (s === 'placeholder' ? 0 : s === 'partial' ? 1 : s === 'simulated' ? 2 : 3)

// ── OPERATIONS — CURR machine + two-hook + content depth ────────────────────
export function OpsCockpit() {
  const curr = [
    { k: 'New', note: 'joined ≤7d' }, { k: 'Current', note: 'both hooks this week' },
    { k: 'At-risk', note: 'one hook cold' }, { k: 'Dormant', note: 'both cold' },
  ]
  const worlds = ['learn.num', 'learn.wrd', 'learn.won', 'learn.log', 'learn.wld', 'learn.lif'].map(id => nodeById(id)!).filter(Boolean)
  return (
    <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="row" style={{ gap: 7, fontSize: 13, fontWeight: 600 }}><Activity size={14} /> CURR state machine <SourceBadge source="partial" small /></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
        {curr.map((c, i) => (
          <div key={c.k} style={{ background: 'var(--bg)', border: '1px solid var(--bd2)', borderRadius: 'var(--r-lg)', padding: '9px 10px' }}>
            <div style={{ fontSize: 11, color: 'var(--tx3)' }}>{c.k}</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 800, color: 'var(--tx3)' }}>—</div>
            <div style={{ fontSize: 9.5, color: i === 1 ? 'var(--ok)' : i === 2 ? 'var(--warn)' : 'var(--tx3)' }}>{c.note}</div>
          </div>
        ))}
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Two-hook decomposition</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
          {['Kid hook', 'Parent hook', 'Both = W2F'].map((l, i) => (
            <div key={l} style={{ background: 'var(--bg)', border: `1px solid ${i === 2 ? 'var(--acc)' : 'var(--bd2)'}`, borderRadius: 'var(--r-lg)', padding: '8px 10px' }}>
              <div style={{ fontSize: 10.5, color: 'var(--tx3)' }}>{l}</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 800, color: 'var(--tx3)' }}>—</div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="row" style={{ gap: 6, fontSize: 12, fontWeight: 600, marginBottom: 6 }}><BookOpen size={13} /> Content depth · six worlds</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {worlds.map(w => (
            <div key={w.id} className="row" style={{ gap: 8, padding: '4px 0', borderTop: '1px solid var(--bd)' }}>
              <HealthDot health={rollupHealth(w).health} />
              <span style={{ flex: 1, fontSize: 12 }}>{w.label}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--tx3)' }}>—</span>
              <SourceBadge source={w.status} small />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── LEGAL — the register (consent · IP · risk · holds) ──────────────────────
export function LegalRegister() {
  const items = ownedBy('legal')
  return (
    <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="row" style={{ gap: 7, fontSize: 13, fontWeight: 600 }}><Scale size={14} /> Register — trust & holds</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map(n => (
          <div key={n.id} className="row" style={{ gap: 8, padding: '7px 0', borderTop: '1px solid var(--bd)' }}>
            <HealthDot health={rollupHealth(n).health} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>{n.label}</div>
              <div style={{ fontSize: 10.5, color: 'var(--tx3)', textTransform: 'capitalize' }}>{n.kind}</div>
            </div>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--tx3)' }}>—</span>
            <SourceBadge source={n.status} small />
          </div>
        ))}
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--tx3)' }}>A HOLD freezes revenue — surfaced to Treasury as revenue-at-risk. Tables (<span className="src">ip_asset · risk_hold · ugc_flag</span>) land in P2 data.</div>
    </div>
  )
}

// ── THE GUILD — roster + ROI board ──────────────────────────────────────────
export function GuildBoard() {
  const cost: Record<string, number> = { sonnet: 0.35, haiku: 0.06, det: 0 }
  return (
    <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="row" style={{ gap: 7, fontSize: 13, fontWeight: 600 }}><Users2 size={14} /> Roster & ROI board <SourceBadge source="placeholder" small /></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {OFFICE_KEYS.map(office => {
          const list = AGENTS.filter(a => officeOf(a) === office)
          if (!list.length) return null
          const est = list.reduce((s, a) => s + (cost[a.model] ?? 0), 0)
          return (
            <div key={office} className="row" style={{ gap: 8, padding: '7px 0', borderTop: '1px solid var(--bd)' }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: OFFICE_META[office].accent, flex: 'none' }} />
              <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600 }}>{OFFICE_META[office].label}</span>
              <span style={{ fontSize: 11, color: 'var(--tx3)' }}>{list.length} agents</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--tx2)' }}>~${est.toFixed(2)}/mo</span>
            </div>
          )
        })}
      </div>
      <div className="row" style={{ gap: 8, justifyContent: 'space-between', borderTop: '2px solid var(--bd2)', paddingTop: 9 }}>
        <span style={{ fontSize: 12, fontWeight: 700 }}>Lowest-ROI agent</span>
        <span className="row" style={{ gap: 6 }}><span style={{ fontFamily: 'var(--mono)', color: 'var(--tx3)' }}>—</span><SourceBadge source="placeholder" small /></span>
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--tx3)' }}>ROI = verdict-value ÷ token budget — null until <span className="src">agent_sla · agent_cost</span> track real tokens. Models: {Object.keys(MODEL_META).length} tiers.</div>
    </div>
  )
}

// ── BRIDGE — the six-chief roll-up ──────────────────────────────────────────
export function BridgeRollup() {
  const flags = pendingConsults().filter(c => c.consultType === 'flag')
  return (
    <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="row" style={{ gap: 7, fontSize: 13, fontWeight: 600 }}><Compass size={14} /> Chief roll-up</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {OFFICE_ORDER.filter(o => o !== 'bridge').map(office => {
          const o = officeById(office)
          const owned = ownedBy(office).filter(n => n.metric)
          const sla = o.sla[0]
          return (
            <div key={office} className="row" style={{ gap: 8, padding: '7px 0', borderTop: '1px solid var(--bd)' }}>
              <HealthDot health={worst(owned)} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>{o.chief} · {o.office}</div>
                <div style={{ fontSize: 10.5, color: 'var(--tx2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.slice}</div>
              </div>
              <span className="row" style={{ gap: 5, flex: 'none' }}><span style={{ fontSize: 10.5, color: 'var(--tx3)' }}>{sla.label}</span><SourceBadge source={sla.source} small /></span>
            </div>
          )
        })}
      </div>
      <div style={{ borderTop: '1px solid var(--bd)', paddingTop: 10 }}>
        <div className="row" style={{ gap: 6, fontSize: 12, fontWeight: 600, marginBottom: 8 }}><Gavel size={13} /> Waiting on you · <Coins size={12} /> Trust &gt; North Star &gt; Retention &gt; Money</div>
        {flags.length === 0 && <div style={{ fontSize: 12, color: 'var(--tx3)' }}>Nothing to resolve.</div>}
        {flags.map((c, i) => (
          <div key={c.id} className="row" style={{ gap: 8, alignItems: 'flex-start', marginBottom: 6 }}>
            <span className="pill pill-mut" style={{ fontSize: 10, flex: 'none' }}>#{i + 1}</span>
            <div style={{ fontSize: 11.5, color: 'var(--tx2)', lineHeight: 1.45 }}><b>{officeById(c.from as OfficeId).chief}:</b> {c.note}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
