// Model Rack — WS-7. Implements docs/media-center/Model-Rack.md (Opus WS-E
// spec) verbatim: four tier columns (Sovereign/Sponsored/Economy/Frontier),
// a Sovereign Completion Rate gauge, a truthful runs feed (actual provider ·
// model · cost · latency · validation — never a generic label), and CAPO
// spend/economics. One non-scrollable page, same Spine discipline as Media
// Center. Session runs come from `intelligence.getRuns()`; persisted history
// (WS-5) comes from the agent_runs_recent/agent_runs_capo RPCs when online.
//
// Persistence-first additions (docs/media-center/Persistence-and-Provider-
// Strategy.md): a neuron-quota gauge (Cloudflare GraphQL Analytics — honest
// fallback if the token lacks Analytics:Read), timestamps + per-run metadata
// on the feed, and a run-detail popup that proves an artifact was actually
// saved (media_asset, linked by run_id) rather than just claiming it was.

import { useEffect, useMemo, useState } from 'react'
import { MODEL_REGISTRY_CATALOG, COST_LABEL, rollupBenchmarks } from '@arganta/ai'
import { getSessionRuns } from '../../lib/ai'
import { getNeuronQuota, type NeuronQuota } from '../../lib/mediaGateway'
import { getCoreQuota, coreEnabled, type CoreQuota } from '../../lib/argantaCoreClient'
import { mediaAssetPublicUrl } from '../../lib/mediaAssets'
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
  inputTokens?: number; input_tokens?: number
  outputTokens?: number; output_tokens?: number
  status: string
  createdAt?: string; created_at?: string
  validationResult?: any; validation_result?: any
}

type Asset = {
  id: string; run_id: string | null; kind: string; bucket: string; path: string
  mime: string | null; bytes: number | null; width: number | null; height: number | null
  duration: number | null; prompt: string | null; provider: string | null; model: string | null
  cost_usd: number; accepted: boolean | null; created_at: string
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
  inputTokens: r.inputTokens ?? r.input_tokens ?? 0,
  outputTokens: r.outputTokens ?? r.output_tokens ?? 0,
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

function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const s = Math.round(ms / 1000)
  if (s < 5) return 'now'
  if (s < 60) return `${s}s`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const QUOTA_ERROR_LABEL: Record<string, string> = {
  insufficient_scope: 'token needs Analytics:Read',
  unreachable: 'offline',
  no_data: 'no data yet',
}

// Gemini (the Sponsored chat brain) exposes NO live remaining-quota API, so —
// unlike the Cloudflare neuron gauge (real GraphQL analytics) — this cap is
// Google's published free-tier requests/day for Flash, an ESTIMATE that drifts
// over time. The USAGE number is real: it's counted from the truthful run
// ledger. Kept as a named constant so it's a one-line edit when Google changes it.
const GEMINI_FREE_RPD_EST = 250

export function ModelRack() {
  const [sessionRuns, setSessionRuns] = useState(() => getSessionRuns())
  const [liveRuns, setLiveRuns] = useState<Run[]>([])
  const [liveCapo, setLiveCapo] = useState<any>(null)
  const [assets, setAssets] = useState<Asset[]>([])
  const [quota, setQuota] = useState<NeuronQuota | null>(null)
  const [coreQuota, setCoreQuota] = useState<CoreQuota | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
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
      const [{ data: recent }, { data: capo }, { data: assetRows }, q] = await Promise.all([
        supabase.rpc('agent_runs_recent', { p_limit: 50, p_domain: null }),
        supabase.rpc('agent_runs_capo', { p_days: 30 }),
        supabase.rpc('media_assets_recent', { p_limit: 100 }),
        getNeuronQuota(),
      ])
      if (cancelled) return
      setLiveRuns((recent as Run[]) || [])
      setLiveCapo((capo as any[])?.[0] || null)
      setAssets((assetRows as Asset[]) || [])
      setQuota(q)
    })()
    return () => { cancelled = true }
  }, [tick])

  // Arganta Core quota — independent of Supabase (the Worker itself is the
  // dependency), so this polls regardless of cloudEnabled.
  useEffect(() => {
    if (!coreEnabled) return
    let cancelled = false
    getCoreQuota().then(q => { if (!cancelled) setCoreQuota(q) })
    return () => { cancelled = true }
  }, [tick])

  const rawMerged = useMemo(() => [...sessionRuns, ...liveRuns], [sessionRuns, liveRuns])

  const allRuns = useMemo(() => {
    const merged = rawMerged.map((r) => norm(r as Run))
    return merged.sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 60)
  }, [rawMerged])

  const assetByRunId = useMemo(() => {
    const m = new Map<string, Asset>()
    for (const a of assets) if (a.run_id) m.set(a.run_id, a)
    return m
  }, [assets])

  // WS-8 — the same rollup the router uses for ranking, shown here so the
  // score is visible + auditable, not just an internal number affecting routing.
  const benchmarks = useMemo(() => rollupBenchmarks(rawMerged, { minSamples: 3 }), [rawMerged])

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

  // Gemini requests seen in the ledger today (real count vs an estimated cap).
  const geminiToday = useMemo(() => {
    const today = new Date().toDateString()
    return allRuns.filter((r) => (r.model || '').toLowerCase().includes('gemini') && new Date(r.at).toDateString() === today).length
  }, [allRuns])

  const selectedRun = allRuns.find((r) => r.id === selectedId) || null
  const selectedAsset = selectedId ? assetByRunId.get(selectedId) || null : null

  const setAccepted = async (assetId: string, accepted: boolean) => {
    setAssets((prev) => prev.map((a) => (a.id === assetId ? { ...a, accepted } : a)))
    const { error } = await supabase.rpc('media_asset_set_accepted', { p_id: assetId, p_accepted: accepted })
    if (error) console.warn('[media_asset_set_accepted]', error.message)
  }

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
          {quota && (
            <div className="kpi" title={quota.error ? QUOTA_ERROR_LABEL[quota.error] || quota.error : `${quota.byModel?.length || 0} models used today`}>
              {quota.error ? (
                <><b className="kpi-dim">—</b><i>neurons — {QUOTA_ERROR_LABEL[quota.error] || 'unavailable'}</i></>
              ) : (
                <>
                  <b>{(quota.neuronsUsedToday ?? 0).toLocaleString()}<span className="kpi-of"> / {quota.freePerDay.toLocaleString()}</span></b>
                  <i>neurons · today</i>
                  <div className="kpi-bar"><span style={{ width: `${Math.min(100, Math.round(((quota.neuronsUsedToday ?? 0) / quota.freePerDay) * 100))}%` }} /></div>
                </>
              )}
            </div>
          )}
          {coreQuota && (
            <div className="kpi" title={coreQuota.note || 'Arganta Core (Cloudflare Workers AI) free-tier allowance'}>
              <b className={coreQuota.estimated ? 'kpi-dim' : ''}>{coreQuota.freePerDay.toLocaleString()}</b>
              <i>Arganta Core · {coreQuota.estimated ? 'est. daily cap' : 'neurons/day'}</i>
            </div>
          )}
          <div className="kpi" title={`Gemini (the chat brain) requests seen in the run ledger today, vs Google's published free-tier requests/day for Flash (≈${GEMINI_FREE_RPD_EST}/day). The usage count is real; the cap is an estimate — Gemini exposes no live remaining-quota API.`}>
            <b>{geminiToday}<span className="kpi-of"> / {GEMINI_FREE_RPD_EST.toLocaleString()}</span></b>
            <i>Gemini · today <span className="kpi-dim">est.</span></i>
            <div className="kpi-bar"><span style={{ width: `${Math.min(100, Math.round((geminiToday / GEMINI_FREE_RPD_EST) * 100))}%` }} /></div>
          </div>
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
                {models.map((m: any) => {
                  const b = benchmarks[m.apiModel]
                  return (
                    <div key={m.id} className="model-chip" title={b ? `${b.n} runs · ${b.averageLatencyMs}ms avg` : m.apiModel}>
                      <span className="model-name">{m.name || m.id}</span>
                      {b ? <span className="model-score" data-good={b.score >= 80}>{b.score}</span> : <span className="model-exec">{m.execution}</span>}
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>

      <footer className="rack-feed">
        <div className="feed-head">
          Runs <span className="feed-count">{allRuns.length}</span>
          <span className="feed-cols">
            <span>time</span><span>tier</span><span>task</span><span>provider · model</span>
            <span>meta</span><span>cost</span><span>latency</span><span>status</span><span></span>
          </span>
        </div>
        <div className="feed-list">
          {allRuns.length === 0 && <div className="feed-empty">No runs yet — generate something in Media Center.</div>}
          {allRuns.map((r) => {
            const asset = assetByRunId.get(r.id)
            const meta = r.domain === 'llm' && (r.inputTokens || r.outputTokens)
              ? `${r.inputTokens + r.outputTokens} tok`
              : asset?.kind === 'image' && asset.width && asset.height ? `${asset.width}×${asset.height}`
              : asset?.kind === 'tts' && asset.duration ? `${asset.duration.toFixed(1)}s`
              : asset?.bytes ? `${Math.round(asset.bytes / 1024)}KB`
              : '—'
            return (
              <button key={r.id} className={`feed-row st-${r.status}`} onClick={() => setSelectedId(r.id)} disabled={!asset}>
                <span className="feed-time" title={new Date(r.at).toLocaleString()}>{relTime(r.at)}</span>
                <span className={`feed-tier t${r.costClass ?? '-'}`}>{r.costClass != null ? COST_LABEL[r.costClass] : '?'}</span>
                <span className="feed-task">{r.task || r.domain}</span>
                <span className="feed-provider">{r.provider || '—'}{r.model ? ` · ${r.model}` : ''}</span>
                <span className="feed-meta">{meta}</span>
                <span className="feed-cost">${(r.costUsd || 0).toFixed(4)}</span>
                <span className="feed-latency">{r.latencyMs ? `${r.latencyMs}ms` : '—'}</span>
                <span className={`feed-status s-${r.status}`}>{r.status}</span>
                <span className="feed-saved" title={asset ? 'artifact saved' : 'no saved artifact'}>{asset ? '📎' : ''}</span>
              </button>
            )
          })}
        </div>
      </footer>

      {selectedRun && (
        <div className="rack-modal-backdrop" onClick={() => setSelectedId(null)}>
          <div className="rack-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rack-modal-head">
              <b>Run detail</b>
              <button className="rack-modal-close" onClick={() => setSelectedId(null)}>✕</button>
            </div>
            {selectedAsset ? (
              <>
                <div className="rack-modal-preview">
                  {selectedAsset.kind === 'image' ? (
                    <img src={mediaAssetPublicUrl(selectedAsset.path)} alt={selectedAsset.prompt || ''} />
                  ) : selectedAsset.kind === 'tts' || selectedAsset.kind === 'audio' || selectedAsset.kind === 'music' ? (
                    <audio controls src={mediaAssetPublicUrl(selectedAsset.path)} />
                  ) : (
                    <div className="rack-modal-noicon">{selectedAsset.kind}</div>
                  )}
                </div>
                <div className="rack-modal-body">
                  <div className="rack-modal-saved">✓ saved to Supabase</div>
                  <div className="rack-modal-path">{selectedAsset.bucket}/{selectedAsset.path}</div>
                  <div className="rack-modal-sub">
                    {selectedAsset.bytes ? `${Math.round(selectedAsset.bytes / 1024)}KB` : ''}
                    {selectedAsset.width && selectedAsset.height ? ` · ${selectedAsset.width}×${selectedAsset.height}` : ''}
                    {selectedAsset.duration ? ` · ${selectedAsset.duration.toFixed(1)}s` : ''}
                    {selectedAsset.mime ? ` · ${selectedAsset.mime}` : ''}
                  </div>
                  {selectedAsset.prompt && <div className="rack-modal-prompt">“{selectedAsset.prompt}”</div>}
                  <div className="rack-modal-grid">
                    <span>provider</span><span>{selectedAsset.provider || '—'}</span>
                    <span>model</span><span>{selectedAsset.model || '—'}</span>
                    <span>run_id</span><span className="rack-modal-mono">{selectedAsset.run_id}</span>
                    <span>cost</span><span>${selectedAsset.cost_usd.toFixed(4)}</span>
                  </div>
                  <div className="rack-modal-actions">
                    <button className={'rack-modal-btn' + (selectedAsset.accepted === true ? ' on' : '')} onClick={() => setAccepted(selectedAsset.id, true)}>♥ accept</button>
                    <button className={'rack-modal-btn' + (selectedAsset.accepted === false ? ' on-bad' : '')} onClick={() => setAccepted(selectedAsset.id, false)}>reject</button>
                    <a className="rack-modal-btn" href={mediaAssetPublicUrl(selectedAsset.path)} target="_blank" rel="noreferrer">open</a>
                  </div>
                </div>
              </>
            ) : (
              <div className="rack-modal-body">
                <div className="rack-modal-nosave">⚠ no saved artifact for this run — {selectedRun.domain === 'media' ? 'it stayed local-only (save may have failed or the run predates persistence)' : 'text runs don’t persist bytes'}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
