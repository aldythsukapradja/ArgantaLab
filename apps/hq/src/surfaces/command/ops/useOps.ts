// Ops data for the Command Center. LOCAL truth comes from the bridge's
// /health + /launch (same token/url the Bridge Console already saved). CLOUD
// truth is best-effort from the browser today (Supabase ping is CORS-open); the
// rest are links until the status Worker lands. Every value carries where it
// came from so the UI never presents a guess as a measurement.
import { useCallback, useEffect, useRef, useState } from 'react'

export interface EngineHealth { id: string; label: string; ready: boolean; detail?: string }
export interface ServiceHealth { id: string; label: string; up: boolean; detail?: string; launchable: boolean }
export interface HealthReport {
  node: string; bridgeVersion: string; nodeVersion: string
  engines: EngineHealth[]; services: ServiceHealth[]; at: string
}

const TOKEN_KEY = 'hq_bridge_token'
const URL_KEY = 'hq_bridge_url'
const DEFAULT_WS = 'ws://127.0.0.1:7717'

/** ws://host:port -> http://host:port  |  wss://host -> https://host */
export function httpBaseFromWs(wsUrl: string): string {
  try {
    const u = new URL(wsUrl)
    const scheme = u.protocol === 'wss:' ? 'https:' : 'http:'
    return `${scheme}//${u.host}`
  } catch { return 'http://127.0.0.1:7717' }
}

export function bridgeConfig(): { base: string; token: string } {
  const token = localStorage.getItem(TOKEN_KEY) || ''
  const wsUrl = localStorage.getItem(URL_KEY) || DEFAULT_WS
  return { base: httpBaseFromWs(wsUrl), token }
}

export type BridgeReach = 'ok' | 'unauthorized' | 'unreachable' | 'no-token'

export interface OpsState {
  health: HealthReport | null
  reach: BridgeReach
  lastChecked: number | null
  loading: boolean
}

async function fetchHealth(base: string, token: string, signal: AbortSignal): Promise<{ health?: HealthReport; reach: BridgeReach }> {
  if (!token) return { reach: 'no-token' }
  try {
    const r = await fetch(`${base}/health?token=${encodeURIComponent(token)}`, { signal })
    if (r.status === 401) return { reach: 'unauthorized' }
    if (!r.ok) return { reach: 'unreachable' }
    return { health: await r.json(), reach: 'ok' }
  } catch {
    return { reach: 'unreachable' }
  }
}

export function useOps(pollMs = 10000): OpsState & { refetch: () => void; launch: (service: string) => Promise<{ ok: boolean; message: string }> } {
  const [state, setState] = useState<OpsState>({ health: null, reach: 'no-token', lastChecked: null, loading: true })
  const abortRef = useRef<AbortController | null>(null)

  const refetch = useCallback(() => {
    abortRef.current?.abort()
    const ctl = new AbortController()
    abortRef.current = ctl
    const { base, token } = bridgeConfig()
    setState((s) => ({ ...s, loading: true }))
    void fetchHealth(base, token, ctl.signal).then(({ health, reach }) => {
      if (ctl.signal.aborted) return
      setState({ health: health || null, reach, lastChecked: Date.now(), loading: false })
    })
  }, [])

  const launch = useCallback(async (service: string) => {
    const { base, token } = bridgeConfig()
    try {
      const r = await fetch(`${base}/launch?token=${encodeURIComponent(token)}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ service }),
      })
      const j = await r.json()
      setTimeout(refetch, 1500)
      return { ok: !!j.ok, message: j.message || (j.ok ? 'started' : 'failed') }
    } catch (e) {
      return { ok: false, message: (e as Error).message }
    }
  }, [refetch])

  useEffect(() => {
    refetch()
    const t = setInterval(refetch, pollMs)
    return () => { clearInterval(t); abortRef.current?.abort() }
  }, [refetch, pollMs])

  return { ...state, refetch, launch }
}

// --- Telemetry: LLM usage + ComfyUI workload from the bridge /telemetry ------
export interface Telemetry {
  claude: {
    provenance: 'est'; today: { tokens: number; costUsd: number }; allTime: { tokens: number; costUsd: number }; weekCostUsd: number
    last5hTokens: number; fivehFillPct: number
    byModel: { label: string; tokens: number; cost: number }[]
    days: { date: string; tokens: number }[]; files: number
  }
  codex: {
    provenance: 'est'; sessions: number; lastActiveAt: string | null
    today: { tokens: number }; allTime: { tokens: number; costUsd: number }; weekCostUsd: number
    inputTokens: number; cachedTokens: number; outputTokens: number
  }
  comfy: {
    provenance: 'live' | 'unknown'; up: boolean; jobsToday?: number; jobsWeek?: number
    avgJobSec?: number | null; computeSec?: number; totalNodeExecutions?: number
    outputs?: { images: number; videos: number; audios: number }
    queueRunning?: number; queuePending?: number
    topModels?: { name: string; runs: number }[]; vram?: { usedGb: number; totalGb: number } | null; comfyVersion?: string | null
  }
  system: { provenance: 'live'; ramUsedGb: number; ramTotalGb: number; cpuCount: number; bridgeUptimeSec: number }
  monthly: { month: string; byModel: Record<string, { tokens: number; cost: number }> }[]
  at: string
}

export function useTelemetry(pollMs = 20000): { telemetry: Telemetry | null; loading: boolean } {
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let alive = true
    const read = async () => {
      const { base, token } = bridgeConfig()
      if (!token) { setLoading(false); return }
      try {
        const r = await fetch(`${base}/telemetry?token=${encodeURIComponent(token)}`)
        if (!alive || !r.ok) { setLoading(false); return }
        setTelemetry(await r.json()); setLoading(false)
      } catch { if (alive) setLoading(false) }
    }
    void read()
    const t = setInterval(read, pollMs)
    return () => { alive = false; clearInterval(t) }
  }, [pollMs])
  return { telemetry, loading }
}

// --- Heartbeat: "last seen" from Supabase when the bridge is unreachable ---
export interface Heartbeat { node: string; at: string; bridge_version?: string }

export function useHeartbeat(enabled: boolean, pollMs = 30000): Heartbeat | null {
  const [hb, setHb] = useState<Heartbeat | null>(null)
  useEffect(() => {
    if (!enabled) return
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
    if (!url || !key || !/^https?:\/\//.test(url) || url.includes('placeholder')) return
    let alive = true
    const read = async () => {
      try {
        const r = await fetch(`${url}/rest/v1/heartbeat?select=node,at,bridge_version&order=at.desc&limit=1`, { headers: { apikey: key } })
        if (!alive || !r.ok) return
        const rows = await r.json()
        setHb(Array.isArray(rows) && rows[0] ? rows[0] : null)
      } catch { /* offline / not migrated — no last-seen */ }
    }
    void read()
    const t = setInterval(read, pollMs)
    return () => { alive = false; clearInterval(t) }
  }, [enabled, pollMs])
  return hb
}

// --- Cloud: one honest live probe (Supabase is CORS-open) -----------------
export type CloudReach = 'ok' | 'down' | 'checking' | 'unknown'

export interface CloudTarget { id: string; label: string; up: boolean; ms: number; detail?: string }

// Deployed arganta-status Worker (workers/arganta-status). Public URL — /status
// exposes only up/down/latency of public infra, and CORS scopes browser reads
// to HQ origins. VITE_STATUS_URL overrides (e.g. a custom domain).
const DEFAULT_STATUS_URL = 'https://arganta-status.aldhyt-sukapradja.workers.dev'

/** Cloud truth from the status Worker (P2). Falls back to link tiles only if the
 * Worker is unreachable. */
export function useCloudStatus(pollMs = 30000): CloudTarget[] | null {
  const [targets, setTargets] = useState<CloudTarget[] | null>(null)
  useEffect(() => {
    const base = (import.meta.env.VITE_STATUS_URL as string | undefined) || DEFAULT_STATUS_URL
    if (!base || !/^https?:\/\//.test(base)) return
    let alive = true
    const read = async () => {
      try {
        const r = await fetch(`${base.replace(/\/+$/, '')}/status`)
        if (!alive || !r.ok) return
        const j = await r.json()
        setTargets(Array.isArray(j.targets) ? j.targets : null)
      } catch { /* worker down — keep last known / null */ }
    }
    void read()
    const t = setInterval(read, pollMs)
    return () => { alive = false; clearInterval(t) }
  }, [pollMs])
  return targets
}

export function useSupabasePing(pollMs = 30000): { reach: CloudReach; ms: number | null } {
  const [reach, setReach] = useState<CloudReach>('checking')
  const [ms, setMs] = useState<number | null>(null)
  useEffect(() => {
    let alive = true
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
    // Guard against placeholder/relative URLs (offline dev): a non-absolute URL
    // would resolve against the local origin and falsely read "up".
    if (!url || !key || !/^https?:\/\//.test(url) || url.includes('placeholder')) { setReach('unknown'); return }
    const ping = async () => {
      const ctl = new AbortController()
      const to = setTimeout(() => ctl.abort(), 4000)
      const t0 = performance.now()
      try {
        const r = await fetch(`${url}/rest/v1/`, { headers: { apikey: key }, signal: ctl.signal })
        if (!alive) return
        setReach(r.ok || r.status === 400 || r.status === 404 ? 'ok' : 'down') // reachable REST root = up
        setMs(Math.round(performance.now() - t0))
      } catch { if (alive) { setReach('down'); setMs(null) } } finally { clearTimeout(to) }
    }
    void ping()
    const t = setInterval(ping, pollMs)
    return () => { alive = false; clearInterval(t) }
  }, [pollMs])
  return { reach, ms }
}
