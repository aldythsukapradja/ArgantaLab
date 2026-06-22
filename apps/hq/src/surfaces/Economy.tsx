import { useEffect, useState } from 'react'
import { data } from '../data'
import type { EconomyFlow } from '../contract/metrics'
import { EconomyFlowView } from '../components/EconomyFlowView'
import { InsightStrip } from '../components/InsightStrip'
import { economyInsight } from '../insight/domain'

export function Economy() {
  const [flow, setFlow] = useState<EconomyFlow | null>(null)
  useEffect(() => { data.economyFlow().then(setFlow) }, [])
  if (!flow) return <div className="dim" style={{ padding: 20 }}>Loading…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h2 style={{ fontSize: 17, fontWeight: 600 }}>Economy</h2>
        <div className="faint" style={{ fontSize: 12 }}>Diamond flow · ArgantaLab ↔ KinetikCircle</div>
      </div>
      <div className="card" style={{ padding: 14 }}>
        <EconomyFlowView flow={flow} />
        <div style={{ marginTop: 14 }}><InsightStrip insight={economyInsight(flow)} /></div>
      </div>
    </div>
  )
}
