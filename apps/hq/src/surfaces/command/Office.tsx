import { type ReactNode } from 'react'
import { Landmark, Gamepad2, Cpu, Wallet, Scale, Users2, MessageSquare, Gavel, Compass, Target } from 'lucide-react'
import { officeById, OFFICE_CHAT } from '../../data/graph/agents'
import {
  ownedBy, verdictsFor, allConsults, rollupHealth, nodeById, childrenOf,
} from '../../data/graph/engine'
import type { OfficeId, GraphNode, VerdictKind } from '../../data/graph/types'
import { SourceBadge } from './SourceBadge'
import { HealthDot } from './HealthDot'

export const OFFICE_ICON: Record<OfficeId, typeof Landmark> = {
  bridge: Landmark, operations: Gamepad2, technology: Cpu, treasury: Wallet, legal: Scale, roster: Users2,
}
export const OFFICE_ACCENT: Record<OfficeId, string> = {
  bridge: 'var(--acc)', operations: 'var(--mag)', technology: 'var(--acc-text)',
  treasury: 'var(--ok)', legal: 'var(--warn)', roster: 'var(--acc)',
}

const VERDICT_TONE: Partial<Record<VerdictKind, string>> = {
  INSTRUMENT: 'var(--warn)', FIX: 'var(--bad)', POLISH: 'var(--acc-text)',
  MONETIZE: 'var(--ok)', RETAIN: 'var(--tx2)', DEEPEN: 'var(--mag)',
}

// One generic component renders ALL six offices from the graph. The only office-
// specific injection is an optional custom cockpit (Treasury's financial fan).
export function Office({ id, cockpit }: { id: OfficeId; cockpit?: ReactNode }) {
  const office = officeById(id)
  const accent = OFFICE_ACCENT[id]
  const Icon = OFFICE_ICON[id]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ height: 3, background: accent }} />
        <div style={{ padding: '14px 16px', display: 'flex', gap: 13, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, flex: 'none', display: 'grid', placeItems: 'center', background: 'var(--bg3)', color: accent }}><Icon size={19} /></div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div className="row" style={{ gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>{office.office}</span>
              <span className="pill pill-mut" style={{ fontSize: 10 }}>{office.chief}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--tx2)', marginTop: 3, lineHeight: 1.5 }}>{OFFICE_CHAT[id].brief}</div>
          </div>
        </div>
      </div>

      <div className="two">
        <NorthStarSlice id={id} />
        {cockpit ?? <Cockpit id={id} />}
      </div>
      <div className="two">
        <VerdictQueue id={id} />
        <ConsultPanel id={id} />
      </div>
    </div>
  )
}

function NorthStarSlice({ id }: { id: OfficeId }) {
  const office = officeById(id)
  const sla = office.sla[0]
  const owned = ownedBy(id).filter(n => n.metric)
  const health = owned.length ? worst(owned) : 'blind'
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="row" style={{ gap: 7, fontSize: 13, fontWeight: 600, marginBottom: 8 }}><Compass size={14} /> North Star slice</div>
      <div style={{ fontSize: 12.5, color: 'var(--tx2)', lineHeight: 1.5, marginBottom: 12 }}>{office.slice}</div>
      <div className="row" style={{ gap: 10, justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--tx3)' }}>{sla.label}</div>
          <div className="row" style={{ gap: 8, marginTop: 4 }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 24, fontWeight: 800, color: 'var(--tx3)' }}>—</span>
            <SourceBadge source={sla.source} />
          </div>
        </div>
        <HealthDot health={health} size={12} />
      </div>
    </div>
  )
}

function Cockpit({ id }: { id: OfficeId }) {
  const owned = ownedBy(id)
  // group owned nodes under their nearest owned app/tab parent for a drill feel
  const roots = owned.filter(n => !owned.some(o => o.id === n.parent))
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="row" style={{ gap: 7, fontSize: 13, fontWeight: 600, marginBottom: 4 }}><Target size={14} /> Cockpit</div>
      <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 12 }}>{owned.length} owned surfaces · tap-through drill (values land when RPCs wire)</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 320, overflowY: 'auto' }}>
        {roots.map(r => <NodeRow key={r.id} node={r} owned={owned} depth={0} />)}
      </div>
    </div>
  )
}

function NodeRow({ node, owned, depth }: { node: GraphNode; owned: GraphNode[]; depth: number }) {
  const kids = childrenOf(node.id).filter(k => owned.some(o => o.id === k.id))
  const { health } = rollupHealth(node)
  return (
    <>
      <div className="row" style={{ gap: 8, padding: '5px 0', paddingLeft: depth * 14, borderTop: depth === 0 ? '1px solid var(--bd)' : 'none' }}>
        <HealthDot health={health} />
        <span style={{ fontSize: 12, fontWeight: depth === 0 ? 600 : 400, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.role === 'guardrail' ? '⚠ ' : ''}{node.label}
        </span>
        {node.metric && <SourceBadge source={node.metric.source} small />}
      </div>
      {kids.map(k => <NodeRow key={k.id} node={k} owned={owned} depth={depth + 1} />)}
    </>
  )
}

function VerdictQueue({ id }: { id: OfficeId }) {
  const verdicts = verdictsFor(id).slice(0, 12)
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="row" style={{ gap: 7, fontSize: 13, fontWeight: 600, marginBottom: 4 }}><Gavel size={14} /> Verdict queue</div>
      <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 12 }}>every verdict carries a LADDERS_TO — or the engine rejects it</div>
      {verdicts.length === 0 && <div style={{ fontSize: 12, color: 'var(--tx3)' }}>No verdicts yet.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {verdicts.map(v => {
          const target = nodeById(v.targetNode)
          const ladder = nodeById(v.laddersTo)
          return (
            <div key={v.id} className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
              <span className="pill" style={{ fontSize: 9.5, fontWeight: 700, flex: 'none', color: '#fff', background: VERDICT_TONE[v.kind] ?? 'var(--tx3)' }}>{v.kind}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{target?.label}</div>
                <div style={{ fontSize: 11, color: 'var(--tx2)', lineHeight: 1.4 }}>{v.rationale}</div>
                <div style={{ fontSize: 10, color: 'var(--tx3)', marginTop: 2 }}>↳ ladders to <span className="src">{ladder?.label}</span></div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ConsultPanel({ id }: { id: OfficeId }) {
  const consults = allConsults().filter(c => c.from === id || c.to === id)
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="row" style={{ gap: 7, fontSize: 13, fontWeight: 600, marginBottom: 10 }}><MessageSquare size={14} /> Consults</div>
      {consults.length === 0 && <div style={{ fontSize: 12, color: 'var(--tx3)' }}>No open consults.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {consults.map(c => {
          const from = officeById(c.from as OfficeId), to = officeById(c.to as OfficeId)
          const outbound = c.from === id
          const pill = c.status === 'answered' ? 'pill-ok' : c.status === 'blocked' ? 'pill-bad' : 'pill-mut'
          return (
            <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: 3, borderLeft: `2px solid ${outbound ? 'var(--acc)' : 'var(--bd2)'}`, paddingLeft: 10 }}>
              <div className="spread">
                <span style={{ fontSize: 12, fontWeight: 600 }}>{outbound ? `→ ${to?.chief}` : `← ${from?.chief}`}</span>
                <span className={'pill ' + pill} style={{ fontSize: 9.5 }}>{c.status}</span>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--tx2)', lineHeight: 1.45 }}>{c.note}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function worst(nodes: GraphNode[]) {
  const rank = { green: 0, amber: 1, blind: 2, red: 3 } as const
  let w: keyof typeof rank = 'green'
  for (const n of nodes) { const h = rollupHealth(n).health; if (rank[h] >= rank[w]) w = h }
  return w
}
