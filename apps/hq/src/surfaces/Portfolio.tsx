import { useEffect, useState } from 'react'
import { data } from '../data'
import type { AppHealth } from '../contract/metrics'
import { Sparkline } from '../components/Sparkline'

const VERDICT: Record<string, { label: string; fg: string; bg: string }> = {
  hero: { label: 'Hero', fg: 'var(--ok)', bg: 'var(--ok-bg)' },
  core: { label: 'Core', fg: 'var(--info)', bg: 'var(--info-bg)' },
  niche: { label: 'Niche', fg: 'var(--acc3)', bg: 'color-mix(in srgb,var(--acc3) 16%,transparent)' },
  watch: { label: 'Watch', fg: 'var(--warn)', bg: 'var(--warn-bg)' },
  dead: { label: 'Dead', fg: 'var(--bad)', bg: 'var(--bad-bg)' },
}
const nf = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`

export function Portfolio() {
  const [apps, setApps] = useState<AppHealth[]>([])
  useEffect(() => { data.appHealth().then(setApps) }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h2 style={{ fontSize: 17, fontWeight: 600 }}>Portfolio</h2>
        <div className="faint" style={{ fontSize: 12 }}>{apps.length} apps · weekly active + health verdict</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12 }}>
        {apps.map((a) => {
          const v = VERDICT[a.verdict]
          const trendUp = a.trend[a.trend.length - 1] >= a.trend[0]
          return (
            <div key={a.appId} className="card" style={{ padding: 14 }}>
              <div className="spread">
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{a.name}</div>
                  <div className="faint" style={{ fontSize: 11 }}>{a.product} · {a.category}</div>
                </div>
                <span style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 6, color: v.fg, background: v.bg }}>{v.label}</span>
              </div>
              <div className="spread" style={{ marginTop: 12, alignItems: 'flex-end' }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 600 }}>{nf(a.wau)}</div>
                  <div className="faint" style={{ fontSize: 11 }}>weekly active</div>
                </div>
                <Sparkline data={a.trend} color={trendUp ? 'var(--ok)' : 'var(--warn)'} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
