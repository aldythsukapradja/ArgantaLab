// comfyClient — the BROWSER's direct line to the local sovereign engines
// (R1 keystone, docs/media-center/Studio-Redesign-Spec.md). ComfyUI serves
// CORS `*`, so HQ calls 127.0.0.1:8188 straight from the page — no proxy, no
// server, no billing. The three graphs here are BYTE-FAITHFUL ports of the
// media-core adapters that were verified live on 2026-07-18, including the two
// gotchas that cost real debugging time:
//   • ACE-Step 1.5 AIO needs the 1.5 nodes (TextEncodeAceStepAudio1.5 +
//     ModelSamplingAuraFlow + EmptyAceStep1.5LatentAudio + VAEDecodeAudio),
//     NOT the classic ACE nodes — the classic graph fails with a tensor mismatch.
//   • Wan SaveVideo emits the MP4 under outputs.IMAGES (with an `animated`
//     flag), NOT video/gifs — the poll must check images or it hangs to timeout.
// Touch those two spots only with a re-verified graph.

const LS_URL = 'hq_comfy_url'
const DEFAULT_URL = 'http://127.0.0.1:8188'

export function comfyUrl(): string {
  try { return (localStorage.getItem(LS_URL) || DEFAULT_URL).replace(/\/+$/, '') } catch { return DEFAULT_URL }
}
export function setComfyUrl(url: string) {
  try { localStorage.setItem(LS_URL, url.replace(/\/+$/, '')) } catch { /* ignore */ }
}

export type EngineKind = 'image' | 'music' | 'video'
export interface EngineHealth { present: boolean; model?: string }
export interface ComfyHealth {
  up: boolean
  image: EngineHealth
  music: EngineHealth
  video: EngineHealth
  vramFreeGB?: number
  queueDepth?: number
  url: string
}

async function listModels(url: string, folder: string): Promise<string[]> {
  try { const r = await fetch(`${url}/models/${folder}`); return r.ok ? (await r.json() as string[]) : [] } catch { return [] }
}

/** One round-trip health probe. Cheap enough to poll on an interval; never throws. */
export async function comfyHealth(): Promise<ComfyHealth> {
  const url = comfyUrl()
  const base: ComfyHealth = { up: false, image: { present: false }, music: { present: false }, video: { present: false }, url }
  try {
    const statsRes = await fetch(`${url}/system_stats`, { signal: AbortSignal.timeout(4000) })
    if (!statsRes.ok) return base
    const stats: any = await statsRes.json().catch(() => null)
    const dev = stats?.devices?.[0]
    const vramFreeGB = dev?.vram_free ? dev.vram_free / 1073741824 : undefined

    const [ckpts, diffusion, encoders, vaes] = await Promise.all([
      listModels(url, 'checkpoints'), listModels(url, 'diffusion_models'),
      listModels(url, 'text_encoders'), listModels(url, 'vae'),
    ])
    let queueDepth: number | undefined
    try { const q: any = await (await fetch(`${url}/queue`)).json(); queueDepth = (q?.queue_running?.length || 0) + (q?.queue_pending?.length || 0) } catch { /* ignore */ }

    const zimg = diffusion.find((m) => /z_image/i.test(m)) || ckpts.find((m) => /v1-5|sd/i.test(m))
    const ace = ckpts.find((m) => /ace.?step/i.test(m))
    const wan = diffusion.find((m) => /wan.*ti2v.*5b/i.test(m)) || diffusion.find((m) => /wan.*5b/i.test(m))
    const umt5 = encoders.find((m) => /umt5/i.test(m))
    const wanVae = vaes.find((m) => /wan.*vae/i.test(m))

    return {
      up: true, url, vramFreeGB, queueDepth,
      image: { present: !!zimg, model: zimg },
      music: { present: !!ace, model: ace },
      video: { present: !!(wan && umt5 && wanVae), model: wan },
    }
  } catch { return base }
}

// ── job execution ───────────────────────────────────────────────────────────

export interface RunOpts {
  onProgress?: (p: { pct?: number; note?: string; queuePos?: number }) => void
  signal?: AbortSignal
}
export interface RunResult { blob: Blob; mime: string; meta: Record<string, unknown> }

const clientId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : String(Math.random())

/** Queue a graph, stream progress over the ws, resolve when /history has the
 * output. `outputKey` is which output-node array holds the artifact
 * ('images' for image+video via SaveVideo, 'audio' for SaveAudioMP3). */
async function runGraph(graph: Record<string, unknown>, outputKey: 'images' | 'audio', opts: RunOpts): Promise<{ filename: string; subfolder: string; type: string }> {
  const url = comfyUrl()
  const res = await fetch(`${url}/prompt`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: graph, client_id: clientId }), signal: opts.signal,
  })
  const queued: any = await res.json().catch(() => null)
  const promptId = queued?.prompt_id
  if (!res.ok || !promptId) throw new Error(queued?.error?.message || `ComfyUI queue failed: HTTP ${res.status}`)

  // live progress over the ws (best-effort; polling is the source of truth)
  let ws: WebSocket | undefined
  try {
    ws = new WebSocket(`${url.replace(/^http/, 'ws')}/ws?clientId=${clientId}`)
    ws.onmessage = (ev) => {
      try {
        const m = JSON.parse(ev.data)
        if (m.type === 'progress' && m.data?.max) opts.onProgress?.({ pct: Math.round((m.data.value / m.data.max) * 100) })
        else if (m.type === 'executing' && m.data?.node) opts.onProgress?.({ note: 'rendering' })
      } catch { /* non-json binary preview frames — ignore */ }
    }
  } catch { /* ws optional */ }

  try {
    const deadline = Date.now() + 900_000
    while (Date.now() < deadline) {
      if (opts.signal?.aborted) throw new Error('cancelled')
      await new Promise((r) => setTimeout(r, 1500))
      const hist: any = await (await fetch(`${url}/history/${promptId}`)).json().catch(() => null)
      const entry = hist?.[promptId]
      if (!entry) {
        // still queued — surface position
        try { const q: any = await (await fetch(`${url}/queue`)).json(); const pos = q?.queue_pending?.findIndex((x: any) => x?.[1] === promptId); if (pos >= 0) opts.onProgress?.({ queuePos: pos + 1 }) } catch { /* ignore */ }
        continue
      }
      const outs = Object.values(entry.outputs || {}).flatMap((o: any) => o?.[outputKey] || [])
      if (outs.length) return outs[0]
      if (entry.status?.status_str === 'error') {
        const msg = entry.status.messages?.find((x: any) => x[0] === 'execution_error')
        throw new Error(msg ? String(msg[1].exception_message).slice(0, 200) : 'ComfyUI workflow error')
      }
    }
    throw new Error('ComfyUI timed out')
  } finally { ws?.close() }
}

async function fetchView(v: { filename: string; subfolder: string; type: string }): Promise<Blob> {
  const url = comfyUrl()
  const q = new URLSearchParams({ filename: v.filename, subfolder: v.subfolder || '', type: v.type || 'output' })
  const r = await fetch(`${url}/view?${q}`)
  if (!r.ok) throw new Error(`ComfyUI view failed: HTTP ${r.status}`)
  return r.blob()
}

// ── IMAGE (z-image turbo, verified) ──────────────────────────────────────────
export async function comfyImage(spec: { prompt: string; width?: number; height?: number; seed?: number }, opts: RunOpts = {}): Promise<RunResult> {
  const url = comfyUrl()
  const width = Math.max(256, Math.min(2048, spec.width || 1024))
  const height = Math.max(256, Math.min(2048, spec.height || 1024))
  const seed = spec.seed ?? Math.floor(Math.random() * 1e15)
  const [diffusion, encoders, vaes] = await Promise.all([listModels(url, 'diffusion_models'), listModels(url, 'text_encoders'), listModels(url, 'vae')])
  const zImage = diffusion.find((m) => /z_image/i.test(m))
  const qwenClip = encoders.find((m) => /qwen/i.test(m))
  const zVae = vaes.find((m) => m === 'ae.safetensors') || vaes[0]
  if (!zImage || !qwenClip || !zVae) throw new Error('ComfyUI has no z-image engine (diffusion_models/z_image + qwen encoder + ae vae)')
  const graph = {
    '1': { class_type: 'UNETLoader', inputs: { unet_name: zImage, weight_dtype: 'default' } },
    '2': { class_type: 'CLIPLoader', inputs: { clip_name: qwenClip, type: 'lumina2', device: 'default' } },
    '3': { class_type: 'VAELoader', inputs: { vae_name: zVae } },
    '4': { class_type: 'ModelSamplingAuraFlow', inputs: { shift: 3, model: ['1', 0] } },
    '5': { class_type: 'CLIPTextEncode', inputs: { text: spec.prompt, clip: ['2', 0] } },
    '6': { class_type: 'ConditioningZeroOut', inputs: { conditioning: ['5', 0] } },
    '7': { class_type: 'EmptySD3LatentImage', inputs: { width, height, batch_size: 1 } },
    '8': { class_type: 'KSampler', inputs: { seed, steps: 8, cfg: 1, sampler_name: 'res_multistep', scheduler: 'simple', denoise: 1, model: ['4', 0], positive: ['5', 0], negative: ['6', 0], latent_image: ['7', 0] } },
    '9': { class_type: 'VAEDecode', inputs: { samples: ['8', 0], vae: ['3', 0] } },
    '10': { class_type: 'SaveImage', inputs: { filename_prefix: 'arganta', images: ['9', 0] } },
  }
  const out = await runGraph(graph, 'images', opts)
  const blob = await fetchView(out)
  return { blob, mime: 'image/png', meta: { width, height, model: zImage, engine: 'comfyui', seed } }
}

// ── MUSIC (ACE-Step 1.5 AIO, verified — 1.5 nodes required) ──────────────────
export async function comfyMusic(spec: { tags: string; lyrics?: string; seconds?: number; bpm?: number; keyscale?: string; seed?: number }, opts: RunOpts = {}): Promise<RunResult> {
  const url = comfyUrl()
  const seconds = Math.max(4, Math.min(240, spec.seconds || 30))
  const seed = spec.seed ?? Math.floor(Math.random() * 1e15)
  const bpm = Math.max(10, Math.min(300, spec.bpm || 120))
  const keyscale = spec.keyscale || 'C major'
  const ckpts = await listModels(url, 'checkpoints')
  const ckpt = ckpts.find((m) => /ace.?step.*aio/i.test(m)) || ckpts.find((m) => /ace.?step/i.test(m))
  if (!ckpt) throw new Error('ComfyUI has no ACE-Step checkpoint (run tools/comfyui/download-media-models.ps1)')
  const graph = {
    '97': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: ckpt } },
    '78': { class_type: 'ModelSamplingAuraFlow', inputs: { shift: 3, model: ['97', 0] } },
    '94': { class_type: 'TextEncodeAceStepAudio1.5', inputs: { clip: ['97', 1], tags: spec.tags, lyrics: spec.lyrics || '', seed, bpm, duration: seconds, timesignature: '4', language: 'en', keyscale, generate_audio_codes: true, cfg_scale: 2.0, temperature: 0.85, top_p: 0.9, top_k: 0, min_p: 0.0 } },
    '47': { class_type: 'ConditioningZeroOut', inputs: { conditioning: ['94', 0] } },
    '98': { class_type: 'EmptyAceStep1.5LatentAudio', inputs: { seconds, batch_size: 1 } },
    '3': { class_type: 'KSampler', inputs: { model: ['78', 0], seed, steps: 8, cfg: 1, sampler_name: 'euler', scheduler: 'simple', denoise: 1, positive: ['94', 0], negative: ['47', 0], latent_image: ['98', 0] } },
    '18': { class_type: 'VAEDecodeAudio', inputs: { samples: ['3', 0], vae: ['97', 2] } },
    '104': { class_type: 'SaveAudioMP3', inputs: { audio: ['18', 0], filename_prefix: 'arganta_music', quality: 'V0' } },
  }
  const out = await runGraph(graph, 'audio', opts)
  const blob = await fetchView(out)
  return { blob, mime: 'audio/mpeg', meta: { seconds, tags: spec.tags, bpm, keyscale, model: ckpt, engine: 'comfyui-acestep', seed } }
}

// ── VIDEO (Wan 2.2 TI2V-5B, verified — output under images key) ───────────────
export async function comfyVideo(spec: { prompt: string; negative?: string; width?: number; height?: number; frames?: number; fps?: number; seed?: number }, opts: RunOpts = {}): Promise<RunResult> {
  const url = comfyUrl()
  const grid = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(n / 16) * 16))
  const width = grid(spec.width || 384, 256, 1280)
  const height = grid(spec.height || 384, 256, 1280)
  const length = Math.max(9, Math.min(121, spec.frames || 25))
  const fps = Math.max(8, Math.min(30, spec.fps || 24))
  const seed = spec.seed ?? Math.floor(Math.random() * 1e15)
  const negative = spec.negative || 'static, blurry, low quality, watermark, distorted'
  const [diffusion, encoders, vaes] = await Promise.all([listModels(url, 'diffusion_models'), listModels(url, 'text_encoders'), listModels(url, 'vae')])
  const unet = diffusion.find((m) => /wan.*ti2v.*5b/i.test(m)) || diffusion.find((m) => /wan.*5b/i.test(m))
  const clipName = encoders.find((m) => /umt5/i.test(m))
  const vae = vaes.find((m) => /wan.*vae/i.test(m))
  if (!unet || !clipName || !vae) throw new Error('ComfyUI missing Wan 2.2 5B files (run tools/comfyui/download-media-models.ps1)')
  const graph = {
    '37': { class_type: 'UNETLoader', inputs: { unet_name: unet, weight_dtype: 'default' } },
    '38': { class_type: 'CLIPLoader', inputs: { clip_name: clipName, type: 'wan', device: 'default' } },
    '39': { class_type: 'VAELoader', inputs: { vae_name: vae } },
    '48': { class_type: 'ModelSamplingSD3', inputs: { shift: 8, model: ['37', 0] } },
    '6': { class_type: 'CLIPTextEncode', inputs: { clip: ['38', 0], text: spec.prompt } },
    '7': { class_type: 'CLIPTextEncode', inputs: { clip: ['38', 0], text: negative } },
    '55': { class_type: 'Wan22ImageToVideoLatent', inputs: { vae: ['39', 0], width, height, length, batch_size: 1 } },
    '3': { class_type: 'KSampler', inputs: { model: ['48', 0], seed, steps: 20, cfg: 5, sampler_name: 'uni_pc', scheduler: 'simple', denoise: 1, positive: ['6', 0], negative: ['7', 0], latent_image: ['55', 0] } },
    '8': { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['39', 0] } },
    '57': { class_type: 'CreateVideo', inputs: { images: ['8', 0], fps } },
    '58': { class_type: 'SaveVideo', inputs: { video: ['57', 0], filename_prefix: 'arganta_video', format: 'auto', codec: 'auto' } },
  }
  const out = await runGraph(graph, 'images', opts) // ← Wan SaveVideo outputs under `images`
  const blob = await fetchView(out)
  return { blob, mime: 'video/mp4', meta: { width, height, frames: length, fps, model: unet, engine: 'comfyui-wan22', seed } }
}
