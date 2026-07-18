// officeSense — grounding for the two offices that own INFRASTRUCTURE, not
// product metrics: Technology (CTO) and The Guild (CAPO). The operations/
// treasury path (agentSense) reads product/economy RPCs; those are the wrong
// facts for "is the AI stack healthy?" and "what does the agent OS cost?".
//
// Same doctrine as agentSense: deterministic Sense → real facts + tone-tagged
// signals, LLM only later at Generate (in tools.ts), honest offline degrade.
// Facts here are operational (probe results, run ledger) — dataClass 'internal',
// never confidential, so they may reason on a paid tier if local is unavailable.

import { probeBridge, probeComfy } from './agentFabric'
import { supabase, cloudEnabled } from '../lib/supabase'
import { getSessionRuns } from '../lib/ai'
import { AGENTS } from './agents'
import { live } from './live'

// The offices that give a GROUNDED answer (live data), not persona. Canonical
// source for the UI so Agent Studio's Author badge can't drift from tools.ts.
// operations/treasury run agentSense; technology/roster run officeSense below.
export const GROUNDED_OFFICE_IDS = new Set(['operations', 'treasury', 'technology', 'roster'])

export type OfficeSignal = { tone: 'ok' | 'warn' | 'info'; text: string }
export interface OfficeFacts {
  facts: string
  signals: OfficeSignal[]
  source: 'live' | 'offline'
  /** the intent role the delegation should be labelled with */
  role: string
}

type Run = { costClass: number | null; provider: string | null; costUsd: number; status: string }
function normRuns(rows: any[]): Run[] {
  return rows.map((r) => ({
    costClass: r.actualCostClass ?? r.actual_cost_class ?? null,
    provider: r.actualProvider || r.actual_provider || null,
    costUsd: r.costUsd ?? r.cost_usd ?? 0,
    status: r.status,
  }))
}

async function loadRuns(): Promise<{ runs: Run[]; capoSpend: number | null; cloud: boolean }> {
  const session = normRuns(getSessionRuns())
  if (!cloudEnabled) return { runs: session, capoSpend: null, cloud: false }
  try {
    const [{ data: recent }, { data: capo }] = await Promise.all([
      supabase.rpc('agent_runs_recent', { p_limit: 200, p_domain: null }),
      supabase.rpc('agent_runs_capo', { p_days: 30 }),
    ])
    const runs = [...session, ...normRuns((recent as any[]) || [])]
    const capoSpend = (capo as any[])?.[0]?.cost_usd ?? null
    return { runs, capoSpend, cloud: true }
  } catch {
    return { runs: session, capoSpend: null, cloud: false }
  }
}

const TIER_NAME = ['Sovereign', 'Sponsored', 'Economy', 'Frontier']
function scrOf(runs: Run[]): number | null {
  const eligible = runs.filter((r) => r.status !== 'rejected')
  return eligible.length ? Math.round((100 * eligible.filter((r) => r.costClass === 0).length) / eligible.length) : null
}
/** silent-mock rate: runs that requested a real provider but the adapter fell
 * back to mock. This is the gateway-health signal the CTO actually needs. */
function gatewayFailPct(runs: Run[]): number | null {
  const external = runs.filter((r) => (r.costClass ?? 0) >= 1)
  if (!external.length) return null
  return Math.round((100 * external.filter((r) => r.provider === 'mock' || r.status === 'failed').length) / external.length)
}

// ── CTO · Technology — is the AI infrastructure healthy right now? ──
export async function techSense(): Promise<OfficeFacts> {
  const [bridge, comfy, { runs, cloud }] = await Promise.all([probeBridge(), probeComfy(), loadRuns()])
  let tables: number | null = null
  try { const m = await live.schemaModel(); tables = m?.tables.length ?? null } catch { /* ignore */ }

  const scr = scrOf(runs)
  const gwFail = gatewayFailPct(runs)
  const frontier = runs.filter((r) => r.costClass === 3).length

  const signals: OfficeSignal[] = []
  if (bridge !== 'connected') signals.push({ tone: 'warn', text: 'Arganta Bridge offline — Claude Code / Codex missions cannot run' })
  else signals.push({ tone: 'ok', text: 'Arganta Bridge connected' })
  if (comfy.status !== 'connected') signals.push({ tone: 'warn', text: 'ComfyUI offline — the Sovereign media engines (image/music/video) are unavailable' })
  else signals.push({ tone: 'ok', text: `ComfyUI connected (${comfy.info ?? 'engines up'})` })
  if (gwFail != null && gwFail > 20) signals.push({ tone: 'warn', text: `LLM gateway failing ${gwFail}% of external calls — studio copilots may be silently mocking` })
  if (scr != null && scr < 50) signals.push({ tone: 'info', text: `Sovereign Completion Rate ${scr}% — more work could stay local/free` })
  if (scr != null && scr >= 50) signals.push({ tone: 'ok', text: `Sovereign Completion Rate ${scr}%` })
  if (signals.length === 0) signals.push({ tone: 'info', text: 'No infrastructure signal yet — connect the bridge/ComfyUI and run a few tasks' })

  const facts = [
    `bridge: ${bridge}`,
    `comfyui: ${comfy.status}${comfy.info ? ' — ' + comfy.info : ''}`,
    `runs observed: ${runs.length}`,
    `sovereign completion rate: ${scr == null ? '—' : scr + '%'}`,
    `gateway external-call failure rate: ${gwFail == null ? '— (no external calls)' : gwFail + '%'}`,
    `frontier (Tier-3) calls: ${frontier}`,
    `schema tables: ${tables ?? '—'}`,
    `cloud ledger: ${cloud ? 'live' : 'offline (session runs only)'}`,
  ].join('\n')

  const anySignal = bridge === 'connected' || comfy.status === 'connected' || cloud || runs.length > 0
  return { facts, signals, source: anySignal ? 'live' : 'offline', role: 'CTO' }
}

// ── CAPO · The Guild — what does the agent OS cost, and where? ──
export async function capoSense(): Promise<OfficeFacts> {
  const { runs, capoSpend, cloud } = await loadRuns()
  const spend = capoSpend ?? runs.reduce((s, r) => s + (r.costUsd || 0), 0)
  const scr = scrOf(runs)
  const byTier = [0, 1, 2, 3].map((c) => ({ c, n: runs.filter((r) => r.costClass === c).length }))
  const byProvider = new Map<string, { n: number; cost: number }>()
  for (const r of runs) {
    const k = r.provider || 'unknown'
    const cur = byProvider.get(k) || { n: 0, cost: 0 }
    cur.n += 1; cur.cost += r.costUsd || 0
    byProvider.set(k, cur)
  }
  const providers = [...byProvider.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 6)

  const signals: OfficeSignal[] = []
  if (runs.length === 0) signals.push({ tone: 'info', text: 'No runs recorded yet — the agent OS cost is $0 so far, not an estimate' })
  else {
    signals.push({ tone: spend > 0 ? 'info' : 'ok', text: `30-day AI spend: $${spend.toFixed(2)} across ${runs.length} runs` })
    if (scr != null && scr >= 50) signals.push({ tone: 'ok', text: `${scr}% of runs stayed Sovereign (free/local)` })
    const topPaid = providers.find((p) => p[1].cost > 0)
    if (topPaid) signals.push({ tone: 'info', text: `Top paid provider: ${topPaid[0]} ($${topPaid[1].cost.toFixed(3)})` })
  }
  signals.push({ tone: 'info', text: `${AGENTS.length} agents on the roster; the Claude/Codex brains run plan-authed and are NOT in this ledger yet (metering gap)` })

  const facts = [
    `roster size: ${AGENTS.length} agents`,
    `runs observed: ${runs.length}`,
    `30-day spend: $${spend.toFixed(4)}`,
    `sovereign completion rate: ${scr == null ? '—' : scr + '%'}`,
    'runs by tier: ' + byTier.map((t) => `${TIER_NAME[t.c]} ${t.n}`).join(', '),
    'by provider: ' + (providers.length ? providers.map(([p, v]) => `${p} (${v.n} runs, $${v.cost.toFixed(3)})`).join('; ') : 'none'),
    `cloud ledger: ${cloud ? 'live' : 'offline (session runs only)'}`,
  ].join('\n')

  return { facts, signals, source: runs.length > 0 || cloud ? 'live' : 'offline', role: 'CAPO' }
}
