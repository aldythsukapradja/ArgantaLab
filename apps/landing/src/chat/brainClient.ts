// Client seam to the walled arganta-chat-brain edge function (T1 · S0/S1). The
// family app never talks to HQ's llm-proxy/media-proxy — only to this door,
// carrying the parent's own access token. S1 exposes image generation
// (Sovereign ComfyUI → Cloudflare fallback); more tools arrive with S3.
import { supabase, cloudEnabled } from '../lib/supabase'

const FN = 'arganta-chat-brain'

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(FN, { body })
  if (error) {
    const res: Response | undefined = (error as any).context
    if (res && typeof res.json === 'function') {
      try { const j = await res.json(); if (j?.error) throw new Error(j.error) } catch (e) { if (e instanceof Error && !/json/i.test(e.message)) throw e }
    }
    throw new Error(error.message)
  }
  if (data && (data as any).ok === false) throw new Error((data as any).error || 'Request failed')
  return data as T
}

export interface BrainHealth { sovereign: boolean; fallback: boolean; tools: string[] }
export async function brainHealth(): Promise<BrainHealth | null> {
  if (!cloudEnabled) return null
  try { return await invoke<BrainHealth>({ action: 'health' }) } catch { return null }
}

export interface GeneratedImage { blob: Blob; provider: string }

/** Generate an image through the Sovereign-first pipeline. Returns null when no
 * backend is configured/reachable, so the caller keeps its deterministic
 * fallback (never a silent fake). */
export async function generateImage(prompt: string): Promise<GeneratedImage | null> {
  if (!cloudEnabled) return null
  try {
    const r = await invoke<{ imageBase64: string; mime: string; provider: string }>({ action: 'generate_image', prompt })
    const bytes = Uint8Array.from(atob(r.imageBase64), c => c.charCodeAt(0))
    return { blob: new Blob([bytes], { type: r.mime || 'image/png' }), provider: r.provider }
  } catch {
    return null
  }
}
