// Two free-tier image providers, one common shape. generate_image (tools.ts)
// tries them in order and falls back to the next on ANY failure — a quota
// error, a transient 5xx, a missing key — so "one ran out, use another" just
// works without trying to parse each provider's specific rate-limit response.

export interface ImageResult {
  bytes: Uint8Array
  mime: string
  provider: string
  model: string
}

export const FORMAT_ASPECT: Record<string, { w: number; h: number }> = {
  portrait: { w: 816, h: 1024 },
  square: { w: 1024, h: 1024 },
  story: { w: 576, h: 1024 },
  pin: { w: 680, h: 1024 },
  wide: { w: 1024, h: 576 },
  link: { w: 1024, h: 536 },
}

function b64ToBytes(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, 'base64'))
}

/** Same Worker HQ already runs (workers/arganta-core-content) — Stable
 * Diffusion XL Lightning on Cloudflare Workers AI, free up to ~10k neurons/day. */
export async function generateViaCloudflare(prompt: string, format: string): Promise<ImageResult> {
  const url = (process.env.ARGANTA_CORE_URL || '').replace(/\/+$/, '')
  const token = process.env.ARGANTA_CORE_TOKEN
  if (!url) throw new Error('ARGANTA_CORE_URL not set (tools/media-gen-mcp/.env)')

  const res = await fetch(`${url}/v1/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ kind: 'image', prompt, format }),
  })
  const data: any = await res.json().catch(() => null)
  if (!res.ok || !data || data.ok === false) {
    throw new Error((data && data.error && data.error.message) || `cloudflare HTTP ${res.status}`)
  }
  return {
    bytes: b64ToBytes(data.imageBase64),
    mime: data.mime || 'image/png',
    provider: 'cloudflare-workers-ai',
    model: data.provenance?.model || 'stable-diffusion-xl-lightning',
  }
}

/** Local ComfyUI — a portable server on 127.0.0.1:8188 (see tools/comfyui).
 * Zero marginal cost, runs on your RTX 3070 Ti. Only used when COMFY_URL is set
 * AND the server is up; any failure falls through to the next provider. */
export async function generateViaLocalComfy(prompt: string, format: string): Promise<ImageResult> {
  const base = (process.env.COMFY_URL || 'http://127.0.0.1:8188').replace(/\/+$/, '')
  const ckpt = process.env.COMFY_CKPT || 'v1-5-pruned-emaonly.safetensors'
  const { w, h } = FORMAT_ASPECT[format] || FORMAT_ASPECT.square

  // Auto-detect the best engine on this server. Z-Image Turbo (diffusion_models
  // + qwen text encoder) beats SD1.5 in quality and runs 8 steps, so prefer it
  // when installed; otherwise fall back to the classic checkpoint graph.
  const listModels = async (folder: string): Promise<string[]> => {
    try {
      const r = await fetch(`${base}/models/${folder}`)
      return r.ok ? await r.json() : []
    } catch {
      return []
    }
  }
  const [diffusion, encoders, vaes, checkpoints] = await Promise.all([
    listModels('diffusion_models'), listModels('text_encoders'), listModels('vae'), listModels('checkpoints'),
  ])
  const zImage = diffusion.find((m) => m.toLowerCase().includes('z_image'))
  const qwenClip = encoders.find((m) => m.toLowerCase().includes('qwen'))
  const zVae = vaes.find((m) => m === 'ae.safetensors') || vaes[0]

  let workflow: Record<string, unknown>
  let model: string
  if (zImage && qwenClip && zVae) {
    // Z-Image Turbo graph (mirrors ComfyUI's bundled image_z_image_turbo template):
    // native 1024-class resolution, 8 steps, cfg 1, zeroed negative conditioning.
    model = zImage
    workflow = {
      '1': { class_type: 'UNETLoader', inputs: { unet_name: zImage, weight_dtype: 'default' } },
      '2': { class_type: 'CLIPLoader', inputs: { clip_name: qwenClip, type: 'lumina2', device: 'default' } },
      '3': { class_type: 'VAELoader', inputs: { vae_name: zVae } },
      '4': { class_type: 'ModelSamplingAuraFlow', inputs: { shift: 3, model: ['1', 0] } },
      '5': { class_type: 'CLIPTextEncode', inputs: { text: prompt, clip: ['2', 0] } },
      '6': { class_type: 'ConditioningZeroOut', inputs: { conditioning: ['5', 0] } },
      '7': { class_type: 'EmptySD3LatentImage', inputs: { width: w, height: h, batch_size: 1 } },
      '8': { class_type: 'KSampler', inputs: { seed: Math.floor(Math.random() * 1e15), steps: 8, cfg: 1, sampler_name: 'res_multistep', scheduler: 'simple', denoise: 1, model: ['4', 0], positive: ['5', 0], negative: ['6', 0], latent_image: ['7', 0] } },
      '9': { class_type: 'VAEDecode', inputs: { samples: ['8', 0], vae: ['3', 0] } },
      '10': { class_type: 'SaveImage', inputs: { filename_prefix: 'arganta', images: ['9', 0] } },
    }
  } else {
    if (!checkpoints.includes(ckpt)) {
      throw new Error(`comfyui has neither a z_image model nor checkpoint "${ckpt}" (checkpoints: ${checkpoints.join(', ') || 'none'})`)
    }
    model = ckpt
    // SD1.5 is trained at 512; scale the chosen aspect down to keep 8GB VRAM happy.
    const scale = Math.min(1, 512 / Math.min(w, h))
    const width = Math.max(256, Math.round((w * scale) / 8) * 8)
    const height = Math.max(256, Math.round((h * scale) / 8) * 8)
    workflow = {
      '3': { class_type: 'KSampler', inputs: { seed: Math.floor(Math.random() * 1e15), steps: 20, cfg: 7, sampler_name: 'euler', scheduler: 'normal', denoise: 1, model: ['4', 0], positive: ['6', 0], negative: ['7', 0], latent_image: ['5', 0] } },
      '4': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: ckpt } },
      '5': { class_type: 'EmptyLatentImage', inputs: { width, height, batch_size: 1 } },
      '6': { class_type: 'CLIPTextEncode', inputs: { text: prompt, clip: ['4', 1] } },
      '7': { class_type: 'CLIPTextEncode', inputs: { text: 'lowres, bad anatomy, watermark, blurry', clip: ['4', 1] } },
      '8': { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['4', 2] } },
      '9': { class_type: 'SaveImage', inputs: { filename_prefix: 'arganta', images: ['8', 0] } },
    }
  }

  const queue = await fetch(`${base}/prompt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: workflow }) })
  const queued: any = await queue.json().catch(() => null)
  const promptId = queued?.prompt_id
  if (!queue.ok || !promptId) throw new Error(`comfyui queue failed: HTTP ${queue.status} ${queued?.error?.message || ''}`.trim())

  // Z-Image bf16 offloads on 8GB VRAM — first run includes a slow model load.
  const deadline = Date.now() + 300_000
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500))
    const hist = await fetch(`${base}/history/${promptId}`)
    const histData: any = await hist.json().catch(() => null)
    const entry = histData?.[promptId]
    if (!entry) continue
    const images = Object.values(entry.outputs || {}).flatMap((o: any) => o?.images || [])
    if (images.length) {
      const img: any = images[0]
      const q = new URLSearchParams({ filename: img.filename, subfolder: img.subfolder || '', type: img.type || 'output' })
      const view = await fetch(`${base}/view?${q}`)
      if (!view.ok) throw new Error(`comfyui view failed: HTTP ${view.status}`)
      const bytes = new Uint8Array(await view.arrayBuffer())
      return { bytes, mime: 'image/png', provider: 'local-comfyui', model }
    }
    if (entry.status?.status_str === 'error') throw new Error('comfyui reported a workflow error')
  }
  throw new Error('comfyui timed out after 120s')
}

export interface AudioResult {
  bytes: Uint8Array
  mime: string
  provider: string
  model: string
  seconds: number
}

/** Local ComfyUI ACE-Step 1.5 (music). Zero marginal cost on your GPU. Only used
 * when COMFY_URL is set AND the ACE-Step checkpoint is present; any failure is
 * surfaced so the tool can report it (there is no cloud music fallback — the
 * sovereign-only mandate keeps music fully local). Graph UNVERIFIED 2026-07-17
 * (authored to live node signatures; needs a live run after ComfyUI restart). */
export async function generateMusicViaLocalComfy(tags: string, seconds: number, lyrics = ''): Promise<AudioResult> {
  const b = (process.env.COMFY_URL || 'http://127.0.0.1:8188').replace(/\/+$/, '')
  const secs = Math.max(4, Math.min(240, seconds || 30))
  const seed = Math.floor(Math.random() * 1e15)

  const list = async (folder: string): Promise<string[]> => {
    try { const r = await fetch(`${b}/models/${folder}`); return r.ok ? (await r.json() as string[]) : [] } catch { return [] }
  }
  const checkpoints = await list('checkpoints')
  const ckpt = checkpoints.find((m) => /ace.?step.*aio/i.test(m)) || checkpoints.find((m) => /ace.?step/i.test(m))
  if (!ckpt) throw new Error('comfyui has no ACE-Step checkpoint (run tools/comfyui/download-media-models.ps1, then restart ComfyUI)')

  const graph: Record<string, unknown> = {
    '1': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: ckpt } },
    '2': { class_type: 'TextEncodeAceStepAudio', inputs: { clip: ['1', 1], tags, lyrics, lyrics_strength: 1 } },
    '3': { class_type: 'TextEncodeAceStepAudio', inputs: { clip: ['1', 1], tags: '', lyrics: '', lyrics_strength: 1 } },
    '4': { class_type: 'EmptyAceStepLatentAudio', inputs: { seconds: secs, batch_size: 1 } },
    '5': { class_type: 'KSampler', inputs: { model: ['1', 0], seed, steps: 12, cfg: 3, sampler_name: 'euler', scheduler: 'simple', denoise: 1, positive: ['2', 0], negative: ['3', 0], latent_image: ['4', 0] } },
    '6': { class_type: 'VAEDecode', inputs: { samples: ['5', 0], vae: ['1', 2] } },
    '7': { class_type: 'SaveAudio', inputs: { audio: ['6', 0], filename_prefix: 'arganta_music' } },
  }
  const queue = await fetch(`${b}/prompt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: graph }) })
  const queued: any = await queue.json().catch(() => null)
  const promptId = queued?.prompt_id
  if (!queue.ok || !promptId) throw new Error(`comfyui music queue failed: HTTP ${queue.status} ${queued?.error?.message || ''}`.trim())

  const deadline = Date.now() + 300_000
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000))
    const hist = await fetch(`${b}/history/${promptId}`)
    const histData: any = await hist.json().catch(() => null)
    const entry = histData?.[promptId]
    if (!entry) continue
    const audios = Object.values(entry.outputs || {}).flatMap((o: any) => o?.audio || [])
    if (audios.length) {
      const a: any = audios[0]
      const q = new URLSearchParams({ filename: a.filename, subfolder: a.subfolder || '', type: a.type || 'output' })
      const view = await fetch(`${b}/view?${q}`)
      if (!view.ok) throw new Error(`comfyui music view failed: HTTP ${view.status}`)
      const bytes = new Uint8Array(await view.arrayBuffer())
      const mime = /\.mp3$/i.test(a.filename) ? 'audio/mpeg' : 'audio/flac'
      return { bytes, mime, provider: 'local-comfyui-acestep', model: ckpt, seconds: secs }
    }
    if (entry.status?.status_str === 'error') throw new Error('comfyui reported an ACE-Step workflow error')
  }
  throw new Error('comfyui music timed out after 300s')
}

/** Modal FLUX.1-schnell — your owned serverless GPU (L40S 48GB), reached THROUGH
 * the deployed media-proxy Edge Function so no token ships client-side here.
 * Only used when MEDIA_PROXY_URL + SUPABASE_ANON_KEY are set. */
export async function generateViaModal(prompt: string, format: string): Promise<ImageResult> {
  const url = (process.env.MEDIA_PROXY_URL || '').replace(/\/+$/, '')
  const anon = process.env.SUPABASE_ANON_KEY
  if (!url) throw new Error('MEDIA_PROXY_URL not set (tools/media-gen-mcp/.env)')
  const { w, h } = FORMAT_ASPECT[format] || FORMAT_ASPECT.square
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(anon ? { Authorization: `Bearer ${anon}`, apikey: anon } : {}) },
    body: JSON.stringify({ kind: 'image', prompt, tier: 'economy', width: w, height: h }),
  })
  const data: any = await res.json().catch(() => null)
  if (!res.ok || !data?.imageBase64) throw new Error((data && data.error) || `media-proxy HTTP ${res.status}`)
  return { bytes: b64ToBytes(data.imageBase64), mime: data.mime || 'image/png', provider: data.provider || 'modal-flux', model: data.model || 'FLUX.1-schnell' }
}

/** Leonardo.ai — cloud.leonardo.ai. Free plan refreshes ~150 tokens/day.
 * Generation is async: kick off a job, then poll until it completes. */
export async function generateViaLeonardo(prompt: string, format: string): Promise<ImageResult> {
  const key = process.env.LEONARDO_API_KEY
  if (!key) throw new Error('LEONARDO_API_KEY not set (tools/media-gen-mcp/.env)')
  const { w, h } = FORMAT_ASPECT[format] || FORMAT_ASPECT.square
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }

  const start = await fetch('https://cloud.leonardo.ai/api/rest/v1/generations', {
    method: 'POST',
    headers,
    body: JSON.stringify({ prompt, width: w, height: h, num_images: 1 }),
  })
  const startData: any = await start.json().catch(() => null)
  const generationId = startData?.sdGenerationJob?.generationId
  if (!start.ok || !generationId) {
    throw new Error(startData?.error || `leonardo HTTP ${start.status} (no generationId)`)
  }

  // Poll — Leonardo has no webhook here, so short-interval polling is the
  // documented pattern for a synchronous-feeling result.
  const deadline = Date.now() + 90_000
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000))
    const poll = await fetch(`https://cloud.leonardo.ai/api/rest/v1/generations/${generationId}`, { headers })
    const pollData: any = await poll.json().catch(() => null)
    const gen = pollData?.generations_by_pk
    if (gen?.status === 'COMPLETE') {
      const imgUrl = gen.generated_images?.[0]?.url
      if (!imgUrl) throw new Error('leonardo job completed with no image url')
      const imgRes = await fetch(imgUrl)
      if (!imgRes.ok) throw new Error(`leonardo image fetch HTTP ${imgRes.status}`)
      const mime = imgRes.headers.get('content-type') || 'image/png'
      const bytes = new Uint8Array(await imgRes.arrayBuffer())
      return { bytes, mime, provider: 'leonardo-ai', model: gen.modelId || 'leonardo-default' }
    }
    if (gen?.status === 'FAILED') throw new Error('leonardo generation job failed')
  }
  throw new Error('leonardo generation timed out after 90s')
}
