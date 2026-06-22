import { useEffect, useState } from 'react'
import { data } from '../data'
import type { AudienceData } from '../contract/metrics'
import { CohortGrid } from '../components/CohortGrid'
import { InsightStrip } from '../components/InsightStrip'
import { cohortInsight } from '../insight/domain'

export function Audience() {
  const [a, setA] = useState<AudienceData | null>(null)
  useEffect(() => { data.audience().then(setA) }, [])
  if (!a) return <div className="dim" style={{ padding: 20 }}>Loading…</div>

  const sticky = a.dauMau >= 20 ? 'var(--ok)' : a.dauMau >= 10 ? 'var(--warn)' : 'var(--bad)'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h2 style={{ fontSize: 17, fontWeight: 600 }}>Audience</h2>
        <div className="faint" style={{ fontSize: 12 }}>Retention cohorts + stickiness</div>
      </div>
      <div className="card" style={{ padding: 14 }}>
        <div className="spread" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Retention by signup cohort</div>
          <div className="row" style={{ gap: 6, fontSize: 11.5 }}>
            <span className="dim">DAU/MAU</span>
            <span style={{ fontWeight: 700, color: sticky }}>{a.dauMau}%</span>
          </div>
        </div>
        <CohortGrid rows={a.cohorts} />
        <div style={{ marginTop: 14 }}><InsightStrip insight={cohortInsight(a.cohorts)} /></div>
      </div>
    </div>
  )
}
