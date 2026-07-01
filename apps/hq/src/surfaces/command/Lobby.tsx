import { Landmark, Gamepad2, Cpu, Wallet, Scale, Users2, ChevronRight, MessageSquare, Gavel } from 'lucide-react'
import { useHQ, type CommandTab } from '../../shell/store'
import { OFFICE_ORDER, officeById } from '../../data/graph/agents'
import { NORTHSTAR } from '../../data/graph/seed'
import {
  coverage, ownedBy, rollupHealth, verdictsFor, allConsults, nodeById,
} from '../../data/graph/engine'
import type { OfficeId, GraphNode } from '../../data/graph/types'
import { SourceBadge } from './SourceBadge'
import { HealthDot } from './HealthDot'
import { CoverageBar } from './CoverageBar'

const OFFICE_ICON: Record<OfficeId, typeof Landmark> = {
  bridge: Landmark, operations: Gamepad2, technology: Cpu, treasury: Wallet, legal: Scale, roster: Users2,
}
const OFFICE_ACCENT: Record<OfficeId, string> = {
  bridge: 'var(--acc)', operations: 'var(--mag)', technology: 'var(--acc-text)',
  treasury: 'var(--ok)', legal: 'var(--warn)', roster: 'var(--acc)',
}

const STAGES = ['stage.learn', 'stage.parentlock', 'stage.pay', 'stage.kinetiklock', 'stage.expansion']

export function Lobby() {
  const cov = coverage()
  const consults = allConsults()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <NorthStarHero />
      <ValueLadder />
      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--tx2)', marginTop: 2 }}>Six offices</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
        {OFFICE_ORDER.map(id => <OfficeCard key={id} id={id} />)}
      </div>
      <div className="two" style={{ marginTop: 2 }}>
        <ConsultLog consults={consults} />
        <ResolveQueue consults={consults} />
      </div>
      <CoverageBar c={cov} />
    </div>
  )
}

function NorthStarHero() {
  const n = NORTHSTAR
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ height: 3, background: 'linear-gradient(90deg,var(--acc),var(--mag))' }} />
      <div style={{ padding: '18px 20px', display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div className="row" style={{ gap: 8, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--acc-text)', fontWeight: 600 }}>North Star</div>
          <div style={{ fontSize: 22, fontWeight: 800, margin: '6px 0 4px', letterSpacing: '-.02em' }}>{n.label}</div>
          <div style={{ fontSize: 12.5, color: 'var(--tx2)', maxWidth: 520, lineHeight: 1.5 }}>{n.note}</div>
        </div>
        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 34, fontWeight: 800, color: 'var(--tx3)' }}>—</div>
          <SourceBadge source={n.metric!.source} />
          <div style={{ fontSize: 10.5, color: 'var(--tx3)', maxWidth: 200 }}>Buildable now via <span className="src">w2f_weekly()</span> — awaiting the query.</div>
        </div>
      </div>
    </div>
  )
}

function ValueLadder() {
  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 10 }}>Value ladder — who owns each rung</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {STAGES.map((sid, i) => {
          const s = nodeById(sid)!
          const office = s.owner ? officeById(s.owner) : null
          const { health } = rollupHealth(s)
          return (
            <div key={sid} className="row" style={{ gap: 6, flex: '1 1 160px' }}>
              <div style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--bd2)', borderRadius: 'var(--r-lg)', padding: '10px 11px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className="row" style={{ gap: 6, justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{s.label}</span>
                  <HealthDot health={health} />
                </div>
                <div className="row" style={{ gap: 5, justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 10.5, color: 'var(--tx3)' }}>{office?.office ?? '—'}</span>
                  <SourceBadge source={s.status} small />
                </div>
              </div>
              {i < STAGES.length - 1 && <ChevronRight size={15} color="var(--tx3)" style={{ flex: 'none', alignSelf: 'center' }} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function OfficeCard({ id }: { id: OfficeId }) {
  const { goOffice } = useHQ()
  const office = officeById(id)
  const Icon = OFFICE_ICON[id]
  const accent = OFFICE_ACCENT[id]
  const owned = ownedBy(id)
  const verdicts = verdictsFor(id).length
  const consults = allConsults().filter(c => (c.from === id || c.to === id) && c.status !== 'answered').length
  const sla = office.sla[0]
  // office node health = worst of its owned nodes
  const kids = owned.filter(n => n.metric)
  const health = kids.length ? worstHealth(kids) : 'blind'
  return (
    <button onClick={() => goOffice(id as CommandTab)} className="card" style={{
      textAlign: 'left', cursor: 'pointer', padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ height: 3, background: accent }} />
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, flex: 'none', display: 'grid', placeItems: 'center', background: 'var(--bg3)', color: accent }}><Icon size={17} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 650, lineHeight: 1.15 }}>{office.office}</div>
            <div style={{ fontSize: 11, color: 'var(--tx3)' }}>{office.chief}</div>
          </div>
          <HealthDot health={health} />
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--tx2)', lineHeight: 1.5 }}>{office.slice}</div>
        <div className="spread" style={{ fontSize: 11 }}>
          <span className="row" style={{ gap: 5, color: 'var(--tx2)' }}>{sla.label} <SourceBadge source={sla.source} small /></span>
        </div>
        <div className="spread" style={{ fontSize: 11, color: 'var(--tx3)', borderTop: '1px solid var(--bd)', paddingTop: 9 }}>
          <span>{owned.length} surfaces</span>
          <span>{verdicts} verdicts</span>
          <span>{consults} consults</span>
          <ChevronRight size={13} />
        </div>
      </div>
    </button>
  )
}

function ConsultLog({ consults }: { consults: ReturnType<typeof allConsults> }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="row" style={{ gap: 7, fontSize: 13, fontWeight: 600, marginBottom: 10 }}><MessageSquare size={14} /> Consult log</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {consults.map(c => {
          const from = officeById(c.from as OfficeId), to = officeById(c.to as OfficeId)
          const pill = c.status === 'answered' ? 'pill-ok' : c.status === 'blocked' ? 'pill-bad' : 'pill-mut'
          return (
            <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: 3, borderLeft: '2px solid var(--bd2)', paddingLeft: 10 }}>
              <div className="spread">
                <span style={{ fontSize: 12, fontWeight: 600 }}>{from?.chief} → {to?.chief}</span>
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

function ResolveQueue({ consults }: { consults: ReturnType<typeof allConsults> }) {
  // verdict conflicts / open flags escalate to the Bridge, priority Trust>NorthStar>Retention>Money.
  const open = consults.filter(c => c.status === 'open' && c.consultType === 'flag')
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="row" style={{ gap: 7, fontSize: 13, fontWeight: 600, marginBottom: 4 }}><Gavel size={14} /> Resolve queue</div>
      <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 10 }}>priority: Trust &gt; North Star &gt; Retention &gt; Money</div>
      {open.length === 0 && <div style={{ fontSize: 12, color: 'var(--tx3)' }}>Nothing waiting on the Bridge.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {open.map((c, i) => {
          const from = officeById(c.from as OfficeId)
          const about = c.about ? nodeById(c.about) : undefined
          return (
            <div key={c.id} className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
              <span className="pill pill-mut" style={{ fontSize: 10, flex: 'none' }}>#{i + 1}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{from?.office} · {about?.label ?? c.about}</div>
                <div style={{ fontSize: 11.5, color: 'var(--tx2)', lineHeight: 1.45 }}>{c.note}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function worstHealth(nodes: GraphNode[]) {
  const rank = { green: 0, amber: 1, blind: 2, red: 3 } as const
  let worst: keyof typeof rank = 'green'
  for (const n of nodes) {
    const h = rollupHealth(n).health
    if (rank[h] >= rank[worst]) worst = h
  }
  return worst
}
