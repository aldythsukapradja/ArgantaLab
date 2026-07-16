import { createLLM, createIntelligence, buildRegistry, SOVEREIGN_MODELS, rollupBenchmarks } from '@arganta/ai'
import { supabase, cloudEnabled } from './supabase'
import { getPreferredModelId } from './modelPreference'

// The single Circle AI runtime. Shared by the Video Director chat AND the C-suite
// agents. Free by default:
//   • edgeProxy → supabase/functions/llm-proxy → Gemini/Groq (keys server-side).
//     Active once cloud is wired + the function is deployed + a key is set.
//   • webllm → in-browser, weights from Supabase. Off until you `npm i
//     @mlc-ai/web-llm` and set WEBLLM below (see docs/circle-ai-llm-runtime-mapping.md).
//   • mock → deterministic fallback so nothing ever hard-fails offline.

// To enable the local Tier-0 model: install @mlc-ai/web-llm and set this to
// { modelId, appConfig:{ model_list:[{ model, model_id, model_lib }] } } pointing
// at your Supabase `models` bucket. Left null so the package builds without the dep.
const WEBLLM: { modelId: string; appConfig: unknown } | null = null

const rawAi = createLLM({
  edgeProxy: cloudEnabled
    ? { invoke: (body: unknown) => supabase.functions.invoke('llm-proxy', { body: body as Record<string, unknown> }) }
    : undefined,
  webllm: WEBLLM || undefined,
})

// The founder's picked default brain (modelPreference), applied to any client-side
// ai.* call that DIDN'T already choose a provider/model. Governed calls (analyze,
// grounded offices) pass an explicit provider/model from selectModel(dataClass),
// so they skip this — their data-class routing is never overridden. Auto (no
// preference) leaves the legacy task-router untouched. `needsTools` guards the
// tool path: a non-tools pick can't serve chatTools, so we don't inject it there.
function preferredInjection(needsTools: boolean): { provider: string; model: string } | null {
  const id = getPreferredModelId()
  if (!id) return null
  const spec = (intelligenceRegistry as any[]).find((m) => m.id === id)
  if (!spec) return null
  if (needsTools && !spec.capabilities?.tools) return null
  return { provider: spec.provider, model: spec.apiModel }
}
function withPref<A extends { provider?: string; model?: string }, R>(
  fn: (o: A, ...rest: any[]) => R, needsTools: boolean,
): (o: A, ...rest: any[]) => R {
  return (o, ...rest) => {
    if (o && !o.provider && !o.model) {
      const inj = preferredInjection(needsTools)
      if (inj) return fn({ ...o, ...inj }, ...rest)
    }
    return fn(o, ...rest)
  }
}

export const ai = {
  ...rawAi,
  chat: withPref(rawAi.chat, false),
  chatJSON: withPref(rawAi.chatJSON, false),
  chatStream: withPref(rawAi.chatStream, false),
  chatTools: withPref(rawAi.chatTools, true),
}

// True when a real (non-mock) tier is reachable — used to show honest UI states.
export const aiLive = rawAi.info().available.edgeProxy || rawAi.info().available.webllm

// ── Four-Tier Intelligence Router (WS-1/WS-2) ──────────────────────────────
// A SEPARATE runtime + facade from `ai` above — existing call sites (Video
// Director chat, C-suite agents, postTemplates) keep their exact current
// behavior untouched. New surfaces (Media Center Analytics, WS-6) opt into
// `intelligence.ask()` instead, which is registry-driven (selectModel, cheapest
// CAPABLE tier wins) and data-class aware (restricted/confidential never leave
// the device). @mlc-ai/web-llm is installed; the smallest sovereign model
// (Qwen3.5-0.8B, ~1.6GB) is the static default — only actually fetched the
// first time a Tier-0 call is made (lazy dynamic import, see adapter.js).
const DEFAULT_SOVEREIGN_MODEL = SOVEREIGN_MODELS.find((m: { subtier: string }) => m.subtier === '0B')?.apiModel

// First use of a Tier-0 call downloads the model (≈1.6GB for the 0.8B default,
// larger for stronger picks) — that must never happen silently. Surfaces that
// call `intelligence.ask()` should gate it behind an explicit user action and
// subscribe here to show real progress instead of a frozen spinner.
type ModelProgress = { progress: number; text: string; modelId: string }
const progressListeners = new Set<(p: ModelProgress) => void>()
export function onModelProgress(cb: (p: ModelProgress) => void) {
  progressListeners.add(cb)
  return () => { progressListeners.delete(cb) }
}

const intelligenceLLM = createLLM({
  edgeProxy: cloudEnabled
    ? { invoke: (body: unknown) => supabase.functions.invoke('llm-proxy', { body: body as Record<string, unknown> }) }
    : undefined,
  webllm: { modelId: DEFAULT_SOVEREIGN_MODEL, onProgress: (p: ModelProgress) => progressListeners.forEach((cb) => cb(p)) },
})

// WS-3 shipped a truthful llm-proxy (real upstream provider/model/cost/latency,
// verified end-to-end incl. the Cloudflare Sponsored addition) — non-sovereign
// registry entries are `active`, not `preview`, so selectModel can actually
// route to them. Exported (not module-local) so C3's tool-loop runtime
// (lib/core/runtime.ts) can call selectModel() directly for tasks
// intelligence.ask() doesn't support (tool-calling — see orchestrate policy).
export const intelligenceRegistry = buildRegistry({ webllm: true, edgeProxy: cloudEnabled, gatewayIsTruthful: true })

// ── WS-5 metering: persist every run to agent_runs (migration_agent_runs.sql) ──
// The ONE choke point every domain funnels through — intelligence.ask() (via
// its `sink`) AND Media Center's direct @arganta/media-core generations both
// call this. So it's also where we mirror an in-memory session view (WS-7's
// Model Rack reads getSessionRuns()) — this keeps the offline/no-Supabase case
// fully observable, not just whatever happens to route through intelligence.
const sessionRuns: Record<string, unknown>[] = []
export function getSessionRuns() { return [...sessionRuns] }

// Returns a promise so callers that need the row to exist first (e.g.
// saveMediaAsset's run_id foreign key) can await it — existing fire-and-forget
// callers are unaffected, they just don't await it, same as before.
export async function logAgentRun(run: Record<string, unknown>): Promise<void> {
  sessionRuns.push({ ...run, createdAt: run.createdAt || new Date().toISOString() })
  if (sessionRuns.length > 200) sessionRuns.shift()
  // WS-8: recompute the benchmark rollup from real session usage after every
  // run, so ranking/floor decisions get genuine data as it accrues — no
  // separate eval harness, no manual "turn on scaling" step. Cheap (session
  // is capped at 200 rows) and self-contained; `intelligence` is always
  // initialized by the time a real run is ever logged (see below).
  intelligence.setBenchmarks(rollupBenchmarks(sessionRuns))
  if (!cloudEnabled) return
  const { error } = await supabase.rpc('agent_run_log', { run })
  if (error) console.warn('[agent_run_log]', error.message)
}

export const intelligence = createIntelligence({ llm: intelligenceLLM, registry: intelligenceRegistry, sink: logAgentRun })
