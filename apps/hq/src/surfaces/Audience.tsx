import { useEffect, useState, type ReactNode } from 'react'
import { Users, Activity, Grid3x3 } from 'lucide-react'
import { live } from '../data/live'
import type { SchemaInsights } from '../data/types'
import { Kpi } from '../components/Kpi'
import { Empty, Loading } from '../components/Empty'
import { compact } from '../lib/format'

export function Audience() {
  const [i, setI] = useState<SchemaInsights | null | undefined>(undefined)
  useEffect(() => { live.schemaInsights().then((d) => setI(d)) }, [])

  if (i === undefined) return <Wrap><Loading label="Loading audience…" /></Wrap>
  if (i === null) return <Wrap><Empty title="No live connection">Audience metrics derive from real <span className="src">item_attempts</span> activity. Connect Supabase to populate.</Empty></Wrap>

  const stick = i.learners > 0 ? Math.round((i.activeLearners7d / i.learners) * 100) : null

  return (
    <Wrap>
      <div className="kpi-grid">
        <Kpi label="Total learners" value={i.learners} icon={<Users size={13} />} sub={<>{compact(i.kids)} kids</>} />
        <Kpi label="Active this week" value={i.activeLearners7d} icon={<Activity size={13} />}
          sub={stick === null ? undefined : <>{stick}% of base</>} accent={stick !== null && stick >= 20 ? 'ok' : 'warn'} />
        <Kpi label="Attempts / active" value={i.activeLearners7d > 0 ? Math.round(i.attempts7d / i.activeLearners7d) : '—'}
          icon={<Activity size={13} />} sub="depth this week" />
      </div>

      <div className="card" style={{ padding: 18 }}>
        <Empty icon={<Grid3x3 />} title="Retention cohort triangle — next">
          The D1/D7/D14/D30 cohort grid computes from <span className="src">item_attempts.created_at</span> via an
          <span className="src">hq_retention()</span> RPC (next build step). It will fill with your real cohorts —
          no sample numbers are shown in the meantime.
        </Empty>
      </div>
    </Wrap>
  )
}

function Wrap({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div><div className="h1">Audience</div><div className="sub">Stickiness + retention from real learning activity</div></div>
      {children}
    </div>
  )
}
