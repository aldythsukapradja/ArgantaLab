// Model Rack — WS-7. Implements docs/media-center/Model-Rack.md (Opus WS-E
// spec) verbatim: four tier columns (Sovereign/Sponsored/Economy/Frontier),
// a Sovereign Completion Rate gauge, a truthful runs feed (actual provider ·
// model · cost · latency · validation — never a generic label), and CAPO
// spend/economics. One non-scrollable page, same Spine discipline as Media
// Center. Session runs come from `intelligence.getRuns()`; persisted history
// (WS-5) comes from the agent_runs_recent/agent_runs_capo RPCs when online.

import { useEffect, useMemo, useState } from 'react'
import { MODEL_REGISTRY_CATALOG, COST_LABEL } from '@arganta/ai'
import { getSessionRuns } from '../../lib/ai'
import { supabase, cloudEnabled } from '../../lib/supabase'
import './rack.css'

type Run = {
  runId?: string; run_id?: string
  domain: string; task: string | null; dataClass?: string; data_class?: string
  actualCostClass?: number | null; actual_cost_class?: number | null
  actualProvider?: string | null; actual_provider?: string | null
  actualModel?: string | null; actual_model?: string | null
  costUsd?: number; cost_usd?: number
  latencyMs?: number; latency_ms?: number
  status: string
  createdAt?: string; created_at?: string
  validationResult?: any; validation_result?: any
}

// normalize camelCase (in-memory) vs snake_case (Supabase RPC) into one shape
const norm = (r: Run) => ({
  id: r.runId || r.run_id || Math.random().toString(36),
  domain: r.domain, task: r.task, dataClass: r.dataClass || r.data_class || 'public',
  costClass: r.actualCostClass ?? r.actual_cost_class ?? null,
  provider: r.actualProvider || r.actual_provider || null,
  model: r.actualModel || r.actual_model || null,
  costUsd: r.costUsd ?? r.cost_usd ?? 0,
  latencyMs: r.latencyMs ?? r.latency_ms ?? 0,
  status: r.status,
  at: r.createdAt || r.created_at || new Date().toISOString(),
  validation: r.validationResult ?? r.validation_result ?? null,
})

const TIER_META = [
  { c: 0, name: 'Sovereign', note: 'local · $0 · private' },
  { c: 1, name: 'Sponsored', note: 'free API quotas' },
  { c: 2, name: 'Economy', note: 'cheap paid production' },
  { c: 3, name: 'Frontier', note: 'premium reasoning' },
]

export function ModelRack() {
  const [sessionRuns, setSessionRuns] = useState(() => getSessionRuns())
  const [liveRuns, setLiveRuns] = useState<Run[]>([])
  const [liveCapo, setLiveCapo] = useState<any>(null)
  const [tick, setTick] = useState(0)

  // poll the in-memory session ledger (no event emitter wired yet — cheap + simple)
  useEffect(() => {
    const id = setInterval(() => setSessionRuns(getSessionRuns()), 2000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!cloudEnabled) return
    let cancelled = false
    ;(async () => {
      const [{ data: recent }, { data: capo }] = await Promise.all([
        supabase.rpc('agent_runs_recent', { p_limit: 50, p_domain: null }),
        supabase.rpc('agent_runs_capo', { p_days: 30 }),
      ])
      if (!cancelled) { setLiveRuns((recent as Run[]) || []); setLiveCapo((capo as any[])?.[0] || null) }
    })()
    return () => { cancelled = true }
  }, [tick])

  const allRuns = useMemo(() => {
    const merged = [...sessionRuns, ...liveRuns].map((r) => norm(r as Run))
    return merged.sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 60)
  }, [sessionRuns, liveRuns])

  const scr = useMemo(() => {
    const eligible = allRuns.filter((r) => r.status !== 'rejected')
    if (eligible.length === 0) return 0
    return eligible.filter((r) => r.costClass === 0).length / eligible.length
  }, [allRuns])

  const registryByTier = useMemo(() => {
    const byTier: Record<number, typeof MODEL_REGISTRY_CATALOG> = { 0: [], 1: [], 2: [], 3: [] }
    for (const m of MODEL_REGISTRY_CATALOG as any[]) byTier[m.costClass]?.push(m)
    return byTier
  }, [])

  const spend = liveCapo?.cost_usd ?? allRuns.reduce((s, r) => s + (r.costUsd || 0), 0)
  const frontierCalls = allRuns.filter((r) => r.costClass === 3).length

  return (
    <div className="rack">
      <header className="rack-top">
        <span className="rack-brand"><span className="rack-dot" />Model Rack</span>
        <div className="rack-kpis">
          <div className="kpi">
            <b>{Math.round(scr * 100)}%</b><i>Sovereign Completion Rate</i>
            <div className="kpi-bar"><span style={{ width: `${Math.round(scr * 100)}%` }} /></div>
          </div>
          <div className="kpi"><b>${spend.toFixed(3)}</b><i>spend {cloudEnabled ? '· 30d' : '· session'}</i></div>
          <div className="kpi"><b>{frontierCalls}</b><i>Frontier calls</i></div>
          {!cloudEnabled && <span className="rack-offline">offline preview — session-only</span>}
          {cloudEnabled && <button className="rack-refresh" onClick={() => setTick((t) => t + 1)}>↻ refresh</button>}
        </div>
      </header>

      <div className="rack-tiers">
        {TIER_META.map((t) => {
          const models = registryByTier[t.c] || []
          const runsHere = allRuns.filter((r) => r.costClass === t.c)
          return (
            <section key={t.c} className={`tier tier-${t.c}`}>
              <div className="tier-head"><b>{t.name}</b><i>{t.note}</i></div>
              <div className="tier-stat">{models.length} model{models.length === 1 ? '' : 's'} · {runsHere.length} run{runsHere.length === 1 ? '' : 's'}</div>
              <div className="tier-models">
                {models.length === 0 && <div className="tier-empty">none registered</div>}
                {models.map((m: any) => (
                  <div key={m.id} className="model-chip" title={m.apiModel}>
                    <span className="model-name">{m.name || m.id}</span>
                    <span className="model-exec">{m.execution}</span>
                  </div>
                ))}
              </div>
            </section>
          )
        })}
      </div>

      <footer className="rack-feed">
        <div className="feed-head">Runs <span className="feed-count">{allRuns.length}</span></div>
        <div className="feed-list">
          {allRuns.length === 0 && <div className="feed-empty">No runs yet — generate something in Media Center.</div>}
          {allRuns.map((r) => (
            <div key={r.id} className={`feed-row st-${r.status}`}>
              <span className={`feed-tier t${r.costClass ?? '-'}`}>{r.costClass != null ? COST_LABEL[r.costClass] : '?'}</span>
              <span className="feed-task">{r.task || r.domain}</span>
              <span className="feed-provider">{r.provider || '—'}{r.model ? ` · ${r.model}` : ''}</span>
              <span className="feed-cost">${(r.costUsd || 0).toFixed(4)}</span>
              <span className="feed-latency">{r.latencyMs ? `${r.latencyMs}ms` : '—'}</span>
              <span className={`feed-status s-${r.status}`}>{r.status}</span>
            </div>
          ))}
        </div>
      </footer>
    </div>
  )
}
