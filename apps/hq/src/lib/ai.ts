import { createLLM, createIntelligence, buildRegistry, SOVEREIGN_MODELS } from '@arganta/ai'
import { supabase, cloudEnabled } from './supabase'

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

export const ai = createLLM({
  edgeProxy: cloudEnabled
    ? { invoke: (body: unknown) => supabase.functions.invoke('llm-proxy', { body: body as Record<string, unknown> }) }
    : undefined,
  webllm: WEBLLM || undefined,
})

// True when a real (non-mock) tier is reachable — used to show honest UI states.
export const aiLive = ai.info().available.edgeProxy || ai.info().available.webllm

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

// gatewayIsTruthful stays false until WS-3 rebuilds llm-proxy to return the real
// upstream provider/model/cost — until then, non-sovereign registry entries are
// `preview` (excluded from routing) so we never CLAIM a paid tier we can't yet
// truthfully meter.
const intelligenceRegistry = buildRegistry({ webllm: true, edgeProxy: cloudEnabled, gatewayIsTruthful: false })

// ── WS-5 metering: persist every run to agent_runs (migration_agent_runs.sql) ──
// The ONE choke point every domain funnels through — intelligence.ask() (via
// its `sink`) AND Media Center's direct @arganta/media-core generations both
// call this. So it's also where we mirror an in-memory session view (WS-7's
// Model Rack reads getSessionRuns()) — this keeps the offline/no-Supabase case
// fully observable, not just whatever happens to route through intelligence.
const sessionRuns: Record<string, unknown>[] = []
export function getSessionRuns() { return [...sessionRuns] }

export function logAgentRun(run: Record<string, unknown>) {
  sessionRuns.push({ ...run, createdAt: run.createdAt || new Date().toISOString() })
  if (sessionRuns.length > 200) sessionRuns.shift()
  if (!cloudEnabled) return
  supabase.rpc('agent_run_log', { run }).then(({ error }: { error: { message: string } | null }) => {
    if (error) console.warn('[agent_run_log]', error.message)
  })
}

export const intelligence = createIntelligence({ llm: intelligenceLLM, registry: intelligenceRegistry, sink: logAgentRun })
