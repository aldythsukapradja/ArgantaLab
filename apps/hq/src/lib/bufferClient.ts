// Buffer publishing client (BF2). Talks to the SAME Cloudflare Worker as
// argantaCoreClient (the Buffer routes live there), so it reuses the same URL +
// CORE_TOKEN. The Buffer API token itself never reaches the browser — it's a
// Worker secret; this client only ever sends { channelId, text, imageUrls }.
//
// Honest failures: every call resolves to a typed result or throws with the
// REAL Buffer/Worker message, never a fabricated success.

import { runRecord } from '@arganta/ai'
import { logAgentRun } from './ai'

const BASE = (import.meta.env.VITE_ARGANTA_CORE_URL as string || '').replace(/\/+$/, '')
const TOKEN = (import.meta.env.VITE_ARGANTA_CORE_TOKEN as string) || ''

/** Buffer is reachable only when the Worker is configured — same gate as coreEnabled. */
export const bufferEnabled = !!BASE

export interface BufferChannel { id: string; name: string; service: string; type?: string | null; organizationId?: string }
export type BufferMode = 'addToQueue' | 'shareNext' | 'shareNow'
export interface BufferPublishResult { postId: string; mode: BufferMode; images: number; video: boolean }

const authHeaders = (): Record<string, string> => (TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {})

/** List the connected Buffer channels (Instagram, etc.). Returns [] on any
 * failure so a picker can render an empty state instead of crashing. */
export async function listBufferChannels(): Promise<BufferChannel[]> {
  if (!BASE) return []
  try {
    const res = await fetch(`${BASE}/v1/buffer/channels`, { headers: authHeaders() })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data || data.ok === false) {
      console.warn('[buffer] channels', (data && data.error && data.error.message) || `status ${res.status}`)
      return []
    }
    return (data.channels || []) as BufferChannel[]
  } catch (e) {
    console.warn('[buffer] channels threw', (e as Error)?.message)
    return []
  }
}

/**
 * Publish images to a Buffer channel. `mode` defaults to addToQueue (the queue
 * is the human review step). Throws with the real reason on failure so the UI
 * shows it — this is a real outward-facing write.
 */
export async function publishToBuffer(o: {
  channelId: string; text: string; imageUrls: string[]; mode?: BufferMode; channelService?: string
}): Promise<BufferPublishResult> {
  if (!BASE) throw new Error('Buffer isn’t configured (set VITE_ARGANTA_CORE_URL).')
  if (!o.channelId) throw new Error('Pick a Buffer channel first.')
  if (!o.imageUrls.length) throw new Error('No images to publish.')

  const started = Date.now()
  const res = await fetch(`${BASE}/v1/buffer/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ channelId: o.channelId, text: o.text, imageUrls: o.imageUrls, mode: o.mode || 'addToQueue', channelService: o.channelService }),
  })
  const data = await res.json().catch(() => null)
  const ok = res.ok && data && data.ok !== false

  // ledger row — domain 'social', so the Model Rack shows real Buffer publishes
  void logAgentRun(runRecord({
    domain: 'social', task: `buffer:${o.mode || 'addToQueue'}`,
    requestedProvider: 'buffer', actualProvider: 'buffer',
    latencyMs: Date.now() - started, status: ok ? 'succeeded' : 'failed',
    validationResult: { passed: ok, notes: [`${o.imageUrls.length} image(s)`] },
  }))

  if (!ok) throw new Error((data && data.error && data.error.message) || `Buffer publish failed (status ${res.status})`)
  return { postId: data.postId, mode: data.mode, images: data.images, video: !!data.video }
}

/**
 * Publish a single video (reel) to a Buffer channel — `videoUrl` must be a
 * public URL (Instagram fetches it directly), `thumbnailUrl` optional (a
 * poster frame). Same honest-failure discipline as publishToBuffer.
 */
export async function publishVideoToBuffer(o: {
  channelId: string; text: string; videoUrl: string; thumbnailUrl?: string; mode?: BufferMode; channelService?: string
}): Promise<BufferPublishResult> {
  if (!BASE) throw new Error('Buffer isn’t configured (set VITE_ARGANTA_CORE_URL).')
  if (!o.channelId) throw new Error('Pick a Buffer channel first.')
  if (!o.videoUrl) throw new Error('No video to publish — export first.')

  const started = Date.now()
  const res = await fetch(`${BASE}/v1/buffer/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ channelId: o.channelId, text: o.text, videoUrl: o.videoUrl, thumbnailUrl: o.thumbnailUrl, mode: o.mode || 'addToQueue', channelService: o.channelService }),
  })
  const data = await res.json().catch(() => null)
  const ok = res.ok && data && data.ok !== false

  void logAgentRun(runRecord({
    domain: 'social', task: `buffer:${o.mode || 'addToQueue'}:video`,
    requestedProvider: 'buffer', actualProvider: 'buffer',
    latencyMs: Date.now() - started, status: ok ? 'succeeded' : 'failed',
    validationResult: { passed: ok, notes: ['1 video'] },
  }))

  if (!ok) throw new Error((data && data.error && data.error.message) || `Buffer publish failed (status ${res.status})`)
  return { postId: data.postId, mode: data.mode, images: 0, video: true }
}
