// mediaGateway — the app-side entry to the media compute substrate (M3,
// docs/media-center/Compute-Substrate.md). Calls the operator-gated media-proxy
// Edge Function, which routes to Cloudflare (Sponsored) / Modal (Economy) and
// returns real image bytes + truthful provenance. Keeps @arganta/media-core
// pure (it stays the Stage-0 deterministic engine); network lives here, exactly
// like intelligence/ai.ts is the app-side of @arganta/ai.
//
// Honest fallback: if the gateway is unreachable, unconfigured, or errors, this
// returns null — the caller (Media Center) then falls back to the deterministic
// Stage-0 image and records the REAL (downgraded) tier. Never fabricates a
// premium result.

import { supabase, cloudEnabled } from './supabase'

export interface GatewayImage {
  bytes: Uint8Array
  mime: string
  provider: string
  model: string
  costClass: number
  costUsd: number
  latencyMs: number
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/**
 * Generate an image at a given costClass (1 = Sponsored/Cloudflare, 2 =
 * Economy/Modal). Returns null on any failure so the caller degrades honestly.
 * Only works against a real Supabase project with the media-proxy function
 * deployed + provider secrets set — no-ops (returns null) offline.
 */
export async function generateImageViaGateway(o: { prompt: string; costClass: number }): Promise<GatewayImage | null> {
  if (!cloudEnabled) return null
  try {
    const { data, error } = await supabase.functions.invoke('media-proxy', {
      body: { kind: 'image', prompt: o.prompt, costClass: o.costClass },
    })
    if (error) { console.warn('[media-proxy]', error.message); return null }
    if (!data || data.error || !data.imageBase64) { if (data?.error) console.warn('[media-proxy]', data.error); return null }
    return {
      bytes: b64ToBytes(data.imageBase64),
      mime: data.mime || 'image/png',
      provider: data.provider || 'unknown',
      model: data.model || 'unknown',
      costClass: data.costClass ?? o.costClass,
      costUsd: data.costUsd ?? 0,
      latencyMs: data.latencyMs ?? 0,
    }
  } catch (e) {
    console.warn('[media-proxy] threw', (e as Error)?.message)
    return null
  }
}

export interface NeuronQuota {
  neuronsUsedToday?: number
  byModel?: { modelId: string; requests: number; neurons: number }[]
  freePerDay: number
  date?: string
  error?: 'insufficient_scope' | 'no_data' | string // insufficient_scope = CF_API_TOKEN needs "Account Analytics: Read"
}

/** Model Rack's neuron gauge. Always resolves (never throws) — an unreachable
 * gateway or missing scope comes back as `{error, freePerDay}`, not a crash. */
export async function getNeuronQuota(): Promise<NeuronQuota> {
  const fallback: NeuronQuota = { freePerDay: 10000, error: 'unreachable' }
  if (!cloudEnabled) return fallback
  try {
    const { data, error } = await supabase.functions.invoke('media-proxy', { body: { action: 'quota' } })
    if (error || !data) return fallback
    return data as NeuronQuota
  } catch {
    return fallback
  }
}

export interface GatewayEmbedding {
  embedding: number[]
  dims: number
  provider: string
  model: string
  costUsd: number
  latencyMs: number
}

/**
 * Embed text at Sponsored (costClass 1, Cloudflare bge-base-en-v1.5, 768-dim,
 * $0). Feeds memory_chunk (pgvector) for search_vault / Vault + thread recall.
 * Returns null on any failure — the caller skips storing/searching that chunk
 * rather than inserting a fabricated or zero vector.
 */
export async function embedTextViaGateway(o: { text: string }): Promise<GatewayEmbedding | null> {
  if (!cloudEnabled) return null
  try {
    const { data, error } = await supabase.functions.invoke('media-proxy', {
      body: { kind: 'embed', prompt: o.text, costClass: 1 },
    })
    if (error) { console.warn('[media-proxy]', error.message); return null }
    if (!data || data.error || !Array.isArray(data.embedding)) { if (data?.error) console.warn('[media-proxy]', data.error); return null }
    return {
      embedding: data.embedding,
      dims: data.dims ?? data.embedding.length,
      provider: data.provider || 'unknown',
      model: data.model || 'unknown',
      costUsd: data.costUsd ?? 0,
      latencyMs: data.latencyMs ?? 0,
    }
  } catch (e) {
    console.warn('[media-proxy] threw', (e as Error)?.message)
    return null
  }
}

export interface GatewayAudio {
  bytes: Uint8Array
  mime: string
  provider: string
  model: string
  costClass: number
  costUsd: number
  latencyMs: number
}

/**
 * Synthesize speech at Sponsored (costClass 1, Cloudflare Aura-1). `voice` is
 * the raw Aura speaker id (e.g. 'orion'/'asteria') — the JM/KF persona mapping
 * lives in tts.ts, same layer that already owns the browser-tier voice
 * mapping. Returns null on any failure so the caller (tts.ts) degrades to its
 * `deferred` descriptor rather than fabricating audio.
 */
export async function generateSpeechViaGateway(o: { text: string; voice: string }): Promise<GatewayAudio | null> {
  if (!cloudEnabled) return null
  try {
    const { data, error } = await supabase.functions.invoke('media-proxy', {
      body: { kind: 'tts', prompt: o.text, costClass: 1, voice: o.voice },
    })
    if (error) { console.warn('[media-proxy]', error.message); return null }
    if (!data || data.error || !data.audioBase64) { if (data?.error) console.warn('[media-proxy]', data.error); return null }
    return {
      bytes: b64ToBytes(data.audioBase64),
      mime: data.mime || 'audio/mpeg',
      provider: data.provider || 'unknown',
      model: data.model || 'unknown',
      costClass: data.costClass ?? 1,
      costUsd: data.costUsd ?? 0,
      latencyMs: data.latencyMs ?? 0,
    }
  } catch (e) {
    console.warn('[media-proxy] threw', (e as Error)?.message)
    return null
  }
}
