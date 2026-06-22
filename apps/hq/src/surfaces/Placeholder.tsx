import type { SurfaceId } from '../shell/store'

// Each later surface is scaffolded with its planned widgets + insight rules,
// so the IA is complete and the build order is visible in-app.
const PLAN: Record<string, { title: string; phase: string; widgets: string[]; rules: string[] }> = {
  features: { title: 'Features', phase: 'P2', widgets: ['Keep/kill/propagate verdict table', 'Per-app feature drilldown'], rules: ['LowAdoption', 'HeroFeature'] },
  audience: { title: 'Audience', phase: 'P3', widgets: ['Retention cohort triangle', 'DAU/MAU gauge', 'Activation funnel', 'k-factor'], rules: ['CohortDecay', 'BenchmarkGap', 'FunnelDrop'] },
  economy: { title: 'Economy', phase: 'P3', widgets: ['Diamond source→sink flow', 'Float trend', 'Sink coverage'], rules: ['EconomyImbalance', 'SinkCoverage'] },
  agents: { title: 'Agents', phase: 'P4', widgets: ['Action log', 'Success-rate KPI', '⌘K command center'], rules: ['AgentSuccessDrop', 'AgentVolumeSpike'] },
  forge: { title: 'Forge', phase: 'P4', widgets: ['App Builder', 'Game Builder → ArgantaLab'], rules: ['EngineReuse', 'ContentGap', 'EconomyHookCheck'] },
  studio: { title: 'Studio', phase: 'P5', widgets: ['Pitch · notes · brainstorm · roadmap', 'Investor Data Room export'], rules: ['PitchReadiness', 'MetricStaleness'] },
  registry: { title: 'Registry', phase: 'P0+', widgets: ['Manifest table', 'Metric-tree editor', 'InsightRule catalog', 'LLM toggle'], rules: ['—'] },
}

export function Placeholder({ id }: { id: SurfaceId }) {
  const p = PLAN[id] ?? { title: id, phase: '', widgets: [], rules: [] }
  return (
    <div>
      <div className="row" style={{ gap: 10 }}>
        <h2 style={{ fontSize: 17, fontWeight: 600 }}>{p.title}</h2>
        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'var(--chip)', color: 'var(--dim)' }}>{p.phase}</span>
      </div>
      <div className="faint" style={{ fontSize: 12, marginBottom: 14 }}>Scaffolded — wires to the same data layer + InsightCards.</div>
      <div className="hq-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div className="card" style={{ padding: 14 }}>
          <div className="lbl" style={{ marginBottom: 8 }}>Planned widgets</div>
          {p.widgets.map((w) => <div key={w} style={{ fontSize: 13, padding: '5px 0' }}>· {w}</div>)}
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div className="lbl" style={{ marginBottom: 8 }}>Insight rules</div>
          {p.rules.map((r) => <div key={r} className="mono" style={{ fontSize: 12.5, padding: '5px 0', color: 'var(--dim)' }}>{r}</div>)}
        </div>
      </div>
    </div>
  )
}
