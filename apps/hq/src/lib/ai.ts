import { createLLM } from '@arganta/ai'
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
