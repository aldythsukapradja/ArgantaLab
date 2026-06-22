import { useEffect, useState } from 'react'
import { data } from '../data'
import type { AppManifest } from '../contract/manifest'
import type { FeatureAdoption } from '../contract/metrics'
import { VerdictTable } from '../components/VerdictTable'
import { InsightStrip } from '../components/InsightStrip'
import { featureInsight } from '../insight/domain'

export function Features() {
  const [apps, setApps] = useState<AppManifest[]>([])
  const [appId, setAppId] = useState('arganta')
  const [rows, setRows] = useState<FeatureAdoption[]>([])

  useEffect(() => { data.listManifests().then((m) => setApps(m.filter((a) => a.featureMap || ['arganta', 'kinetik-calendar'].includes(a.id)))) }, [])
  useEffect(() => { data.featureAdoption(appId).then(setRows) }, [appId])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h2 style={{ fontSize: 17, fontWeight: 600 }}>Features</h2>
        <div className="faint" style={{ fontSize: 12 }}>Keep · kill · propagate — adoption + verdict per feature</div>
      </div>

      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        {apps.map((a) => (
          <button key={a.id} onClick={() => setAppId(a.id)}
            style={{ fontSize: 12, padding: '5px 12px', borderRadius: 99,
              color: appId === a.id ? '#fff' : 'var(--dim)',
              background: appId === a.id ? 'linear-gradient(135deg,var(--acc),var(--acc3))' : 'var(--chip)',
              border: '1px solid var(--brd2)' }}>{a.name}</button>
        ))}
      </div>

      <div className="card" style={{ padding: 14 }}>
        <div className="spread" style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Feature adoption</div>
          <span className="faint" style={{ fontSize: 11 }}>% of weekly actives</span>
        </div>
        <VerdictTable rows={rows} />
        {rows.length > 0 && <div style={{ marginTop: 12 }}><InsightStrip insight={featureInsight(rows)} /></div>}
      </div>
    </div>
  )
}
