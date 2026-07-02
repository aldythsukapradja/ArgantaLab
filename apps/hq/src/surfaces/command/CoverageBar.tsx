import type { Coverage } from '../../data/graph/engine'

// "Instrumentation coverage X% → 80%". Honest scoreboard of how blind we still
// are: live+partial = grounded; placeholder = the CTO build backlog.
export function CoverageBar({ c, target = 80 }: { c: Coverage; target?: number }) {
  const seg = (n: number) => (c.total ? (n / c.total) * 100 : 0)
  const parts: { key: keyof Coverage; color: string }[] = [
    { key: 'live', color: 'var(--ok)' },
    { key: 'partial', color: 'var(--warn)' },
    { key: 'simulated', color: 'var(--acc)' },
    { key: 'placeholder', color: 'var(--bg3)' },
  ]
  return (
    <div className="card" style={{ padding: '12px 15px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="spread">
        <span className="row" style={{ gap: 8, fontSize: 12.5, fontWeight: 600 }}>
          Instrumentation coverage
          <span style={{ color: c.pct >= target ? 'var(--ok)' : 'var(--warn)' }}>{c.pct}%</span>
          <span style={{ fontSize: 11, color: 'var(--tx3)', fontWeight: 400 }}>→ {target}% target</span>
        </span>
        <span style={{ fontSize: 11, color: 'var(--tx3)' }}>{c.placeholder} surfaces still blind</span>
      </div>
      <div style={{ display: 'flex', height: 8, borderRadius: 6, overflow: 'hidden', background: 'var(--bg3)' }}>
        {parts.map(p => {
          const w = seg(c[p.key])
          return w > 0 ? <div key={p.key} style={{ width: `${w}%`, background: p.color }} /> : null
        })}
      </div>
      <div className="row" style={{ gap: 14, fontSize: 10.5, color: 'var(--tx2)', flexWrap: 'wrap' }}>
        <span className="row" style={{ gap: 4 }}><i style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--ok)' }} />live {c.live}</span>
        <span className="row" style={{ gap: 4 }}><i style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--warn)' }} />partial {c.partial}</span>
        <span className="row" style={{ gap: 4 }}><i style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--acc)' }} />simulated {c.simulated}</span>
        <span className="row" style={{ gap: 4 }}><i style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--bg3)', border: '1px solid var(--bd2)' }} />blind {c.placeholder}</span>
      </div>
    </div>
  )
}
