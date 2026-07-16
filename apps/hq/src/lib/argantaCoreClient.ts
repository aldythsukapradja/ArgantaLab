// Arganta Core — the app-side client for the Content Engine Cloudflare Worker
// (workers/arganta-core-content, contract in docs/arganta-core/Content-Engine-
// Contract.md). Worker-first, honest fallback: any failure returns null so the
// caller degrades to ai.chatJSON → localPost and NEVER hard-fails. Every real
// call is logged through logAgentRun so the Model Rack stays truthful.
//
// Config (all optional — absent = "not wired", client no-ops to null):
//   VITE_ARGANTA_CORE_URL    e.g. https://core.arganta.app
//   VITE_ARGANTA_CORE_TOKEN  the shared bearer (matches the Worker's CORE_TOKEN)

import { runRecord } from '@arganta/ai'
import { logAgentRun } from './ai'

const BASE = (import.meta.env.VITE_ARGANTA_CORE_URL as string || '').replace(/\/+$/, '')
const TOKEN = (import.meta.env.VITE_ARGANTA_CORE_TOKEN as string) || ''

export const coreEnabled = !!BASE

export interface CoreProvenance {
  provider: string; model: string; latencyMs: number; neurons: number; estimated: boolean
}
export interface CoreCopy {
  palette?: string
  slides: { template: string; headline?: string; body?: string; emoji?: string; badge?: string; source?: string; imagePrompt?: string }[]
  caption: string
  hashtags: string
}
export interface CopyResult { copy: CoreCopy; usable: boolean; provenance: CoreProvenance }
export interface ImageResult { blob: Blob; width: number; height: number; provenance: CoreProvenance }

export interface CopyContext {
  format?: string; palette?: string; platform?: string
  brand?: { name?: string; handle?: string }
  wantImages?: boolean
  slideCount?: number
  existingSlides?: { template: string; headline?: string; body?: string }[]
}

async function post(body: unknown): Promise<any | null> {
  if (!BASE) return null
  try {
    const res = await fetch(`${BASE}/v1/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}) },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data || data.ok === false) {
      console.warn('[arganta-core]', (data && data.error && data.error.message) || `status ${res.status}`)
      return null
    }
    return data
  } catch (e) {
    console.warn('[arganta-core] threw', (e as Error)?.message)
    return null
  }
}

// Emits a genuine ledger row (docs/media-core/Compute-Substrate.md's WS-D
// contract, same runRecord() every media-core/intelligence run uses) — the
// Model Rack's normalizer expects actualProvider/actualCostClass/status
// exactly, so Arganta Core runs show REAL provider/model/latency, never a
// generic "content" label. domain 'media' matches other Worker-backed
// generations (mediaGateway); Cloudflare Workers AI = costClass 1 (Sponsored).
function log(kind: 'copy' | 'image', prov: CoreProvenance | undefined, ok: boolean) {
  if (!prov) return
  void logAgentRun(runRecord({
    domain: 'media', task: `arganta-core:${kind}`,
    requestedCostClass: 1, actualCostClass: 1,
    requestedProvider: 'cloudflare-workers-ai', actualProvider: prov.provider,
    requestedModel: prov.model, actualModel: prov.model,
    latencyMs: prov.latencyMs, status: ok ? 'succeeded' : 'failed',
    validationResult: { passed: ok, notes: prov.estimated ? ['cost/neurons are estimated, not measured'] : [] },
  }))
}

/** Generate carousel copy. Returns null on any failure (caller falls back). */
export async function generateCopy(brief: string, context: CopyContext = {}): Promise<CopyResult | null> {
  const data = await post({ kind: 'copy', brief, context })
  if (!data || !data.copy) return null
  log('copy', data.provenance, !!data.usable)
  return { copy: data.copy as CoreCopy, usable: !!data.usable, provenance: data.provenance }
}

function b64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

export interface CoreQuota { freePerDay: number; estimated: boolean; note?: string; textModel?: string; imageModel?: string }

/** Pretty short model label, e.g. "@cf/meta/llama-3.1-8b-instruct-fp8" → "Llama 3.1 8B". */
export function prettyModel(m?: string): string {
  if (!m) return 'Cloudflare'
  const leaf = m.replace(/^@cf\//, '').split('/').pop() || m
  const mm = leaf.match(/llama-?([\d.]+)-?(\d+b)/i)
  if (mm) return `Llama ${mm[1]} ${mm[2].toUpperCase()}`
  return leaf.replace(/-(instruct|fp8|fp16|fast|lightning|base|1\.0).*$/i, '').replace(/-/g, ' ')
}

/** Arganta Core's neuron quota (S5) — always resolves, never throws. Static
 * free-tier figure when the Worker is unreachable/unconfigured (see mirrorwed
 * discipline in mediaGateway.getNeuronQuota). */
export async function getCoreQuota(): Promise<CoreQuota> {
  const fallback: CoreQuota = { freePerDay: 10000, estimated: true, note: 'Arganta Core not configured' }
  if (!BASE) return fallback
  try {
    const res = await fetch(`${BASE}/v1/quota`, { headers: TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {} })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data) return fallback
    return { freePerDay: data.freePerDay ?? 10000, estimated: !!data.estimated, note: data.note, textModel: data.textModel, imageModel: data.imageModel }
  } catch { return fallback }
}

/** File extension for a generated image's real mime — the Worker sniffs actual
 * magic bytes rather than trusting a model's documented (sometimes wrong)
 * contentType, so this must NOT assume .png. */
export function extForImageMime(mime: string): string {
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/webp') return 'webp'
  return 'png'
}

/** Generate one still. Returns null on any failure. */
export async function generateImage(o: { prompt: string; format?: string; palette?: string }): Promise<ImageResult | null> {
  const data = await post({ kind: 'image', prompt: o.prompt, format: o.format, context: { palette: o.palette } })
  if (!data || !data.imageBase64) return null
  log('image', data.provenance, true)
  return {
    blob: b64ToBlob(data.imageBase64, data.mime || 'image/png'),
    width: data.width, height: data.height, provenance: data.provenance,
  }
}
