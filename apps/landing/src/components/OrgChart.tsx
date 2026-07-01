// A real organizational chart built from the live agent roster: CEO → COO →
// C-suite → five department columns, with connector lines and a cascading reveal.
// Used on the Editorial "company" slide and the General deck's Company flight.
import { AGENTS, TIER_META, MODEL_META, type Agent } from '../data/agents'

const DEPTS: { tier: Agent['tier']; label: string }[] = [
  { tier: 'argantalab', label: 'ArgantaLab' },
  { tier: 'kinetik', label: 'KinetikCircle' },
  { tier: 'growth', label: 'Growth' },
  { tier: 'platform', label: 'Platform' },
  { tier: 'brand', label: 'Brand' },
]

function Node({ a, cls = '', d = 0 }: { a: Agent; cls?: string; d?: number }) {
  return (
    <span className={`org-node ${cls}`} style={{ ['--tc' as string]: TIER_META[a.tier].accent, ['--d' as string]: `${d}s` }} title={a.mission}>
      <b>{a.name}</b>
      <i className="org-dot" style={{ background: MODEL_META[a.model].fg }} />
    </span>
  )
}

export default function OrgChart() {
  const ceo = AGENTS.find(a => a.id === 'ceo')!
  const coo = AGENTS.find(a => a.id === 'coo')!
  const csuite = ['cpo', 'cto', 'cfo', 'gc'].map(id => AGENTS.find(a => a.id === id)!)
  return (
    <div className="org">
      <div className="org-row"><Node a={ceo} cls="ceo" d={0.05} /></div>
      <span className="org-v" style={{ ['--d' as string]: '0.18s' }} />
      <div className="org-row"><Node a={coo} cls="exec" d={0.24} /></div>
      <span className="org-v" style={{ ['--d' as string]: '0.32s' }} />
      <div className="org-bus">{csuite.map((a, i) => <Node key={a.id} a={a} cls="exec" d={0.4 + i * 0.06} />)}</div>
      <span className="org-v" style={{ ['--d' as string]: '0.66s' }} />
      <div className="org-depts">
        {DEPTS.map((dep, di) => (
          <div key={dep.tier} className="org-dept" style={{ ['--tc' as string]: TIER_META[dep.tier].accent, ['--d' as string]: `${0.74 + di * 0.06}s` }}>
            <span className="org-dept-head">{dep.label}</span>
            {AGENTS.filter(a => a.tier === dep.tier).map((a, mi) => <Node key={a.id} a={a} d={0.86 + di * 0.06 + mi * 0.04} />)}
          </div>
        ))}
      </div>
    </div>
  )
}
