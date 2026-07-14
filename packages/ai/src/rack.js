// ─────────────────────────────────────────────────────────────────────────
// WS-1 · Sovereign Model Rack  (Sonnet)
// Tier-0 model manifest + device profiling. Uses @mlc-ai/web-llm's OWN prebuilt
// catalog (weights hosted by MLC on HF CDN) — no custom Supabase bucket needed
// for v1. Real model ids, real vram figures, matching the source architecture
// doc's recommended rack (Qwen3.5 0.8B/2B/4B/9B, Hermes-2-Pro-Llama-3-8B).
// ─────────────────────────────────────────────────────────────────────────

import { modelSpec } from './modelspec.js';

// Curated subset of @mlc-ai/web-llm's prebuiltAppConfig.model_list — q4f16_1
// quantization (best size/quality tradeoff). vramRequiredMB is MLC's own
// measured figure for that build. Kept in sync manually; a future pass can
// derive this from `prebuiltAppConfig` directly at build time.
const RACK_MODELS = [
  { id: 'Qwen3.5-0.8B-q4f16_1-MLC', subtier: '0B', vram: 1630, params: '0.8B', role: 'fast — classify/extract/tag/titles' },
  { id: 'Qwen3.5-2B-q4f16_1-MLC', subtier: '0B', vram: 2245, params: '2B', role: 'fast — query rewrite, short summaries' },
  { id: 'Qwen3.5-4B-q4f16_1-MLC', subtier: '0C', vram: 3868, params: '4B', role: 'strong — RAG synthesis, drafts, JSON specs' },
  { id: 'Qwen3.5-9B-q4f16_1-MLC', subtier: '0C', vram: 6433, params: '9B', role: 'strong — briefs, architecture drafts, planning' },
  { id: 'Hermes-2-Pro-Llama-3-8B-q4f16_1-MLC', subtier: '0C', vram: 4976, params: '8B', role: 'strong — tool-calling, structured JSON' },
];

/** ModelSpec[] for the sovereign rack — Tier 0, browser execution, every dataClass. */
export const SOVEREIGN_MODELS = RACK_MODELS.map((m) =>
  modelSpec({
    id: m.id,
    name: `${m.id.split('-q4')[0]} (${m.params})`,
    provider: 'webllm',
    apiModel: m.id,
    costClass: 0,
    subtier: m.subtier,
    execution: 'browser',
    capabilities: { chat: true, json: true, jsonSchema: true, reasoning: m.subtier === '0C', code: /Coder|Qwen3\.5-(4|9)B/.test(m.id) || m.subtier === '0C' },
    dataClasses: ['public', 'internal', 'confidential', 'restricted'], // local never leaves the device
    contextWindow: 4096,
    vramRequiredMB: m.vram,
    priority: m.subtier === '0B' ? 10 : 20, // fast models preferred when both fit
  }).spec,
);

// ── device profiling ───────────────────────────────────────────────────────

/**
 * Probe WebGPU + estimate usable VRAM. Browser-only; returns a safe "no local
 * model" profile in Node/SSR/no-WebGPU so the router degrades to Tier 1+.
 * @returns {Promise<{webgpu:boolean, vramMB:number|null, adapterInfo:object|null}>}
 */
export async function detectDevice() {
  if (typeof navigator === 'undefined' || !navigator.gpu) return { webgpu: false, vramMB: null, adapterInfo: null };
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return { webgpu: false, vramMB: null, adapterInfo: null };
    // No direct VRAM query in WebGPU; maxBufferSize is the standard proxy MLC
    // itself uses to gate large-model eligibility.
    const maxBuf = adapter.limits?.maxBufferSize || adapter.limits?.maxStorageBufferBindingSize || 0;
    const vramMB = maxBuf ? Math.round(maxBuf / (1024 * 1024)) : null;
    const info = adapter.info || (adapter.requestAdapterInfo ? await adapter.requestAdapterInfo() : null);
    return { webgpu: true, vramMB, adapterInfo: info ? { vendor: info.vendor, architecture: info.architecture } : null };
  } catch {
    return { webgpu: false, vramMB: null, adapterInfo: null };
  }
}

/**
 * Pick the strongest sovereign model that fits the device, preferring cached
 * (already-downloaded) models to avoid a fresh multi-hundred-MB fetch.
 * @param {object[]} models  SOVEREIGN_MODELS (or a filtered subset)
 * @param {{webgpu:boolean, vramMB:number|null}} device
 * @param {(id:string)=>boolean} [isCached]
 */
export function pickSovereignModel(models, device, isCached) {
  if (!device.webgpu) return null;
  const fits = models.filter((m) => device.vramMB == null || m.vramRequiredMB <= device.vramMB);
  if (fits.length === 0) return null;
  const bySize = [...fits].sort((a, b) => b.vramRequiredMB - a.vramRequiredMB); // strongest first
  if (isCached) {
    const cached = bySize.find((m) => isCached(m.id));
    if (cached) return cached;
  }
  // nothing cached yet — recommend the smallest fast model to minimize first-run wait
  return [...fits].sort((a, b) => a.vramRequiredMB - b.vramRequiredMB)[0];
}

/** Cache check — wraps @mlc-ai/web-llm's hasModelInCache; false (not an error) if the dep isn't installed. */
export async function isModelCached(modelId) {
  try {
    const webllm = await import(/* @vite-ignore */ '@mlc-ai/' + 'web-llm');
    return await webllm.hasModelInCache(modelId);
  } catch {
    return false;
  }
}
