// arganta-chat-brain — THE WALL (T1 · S0) + Sovereign image generation (T1 · S1).
//
// This is the ONLY door between the family app (Arganta Chat) and any generative
// backend. It is deliberately SEPARATE from HQ's llm-proxy/media-proxy, which are
// hard-gated to the founder's email. The separation is structural, not a prompt:
//
//   • Auth: a signed-in PARENT (kids hard-denied, same rule as arganta-publish).
//   • No service role. When this function grows DB tools (S3+), it will query with
//     the caller's own JWT so RLS on hq_*/vault/agent_runs is the real boundary.
//   • Tool ALLOWLIST (below). Nothing outside it exists — no vault search, no
//     hq_* RPC, no office tools, no arbitrary URL fetch. HQ data is unreachable
//     by construction, so a jailbroken prompt has nothing to reach.
//
// S1 implements one tool: generate_image. Sovereign first (ComfyUI on the
// founder's machine, reached via COMFYUI_URL — a tunnel in dev), then a sponsored
// fallback (Cloudflare Workers AI) so a DEPLOYED app still generates when the
// local box is unreachable. Never a silent fake: if both are down, it says so and
// the client keeps its labeled deterministic canvas card.
//
// Deploy:  supabase functions deploy arganta-chat-brain
// Secrets (all OPTIONAL — the function degrades honestly without them; these are
// the family app's OWN keys, separate from HQ so they revoke per-app):
//   supabase secrets set COMFYUI_URL=https://<your-tunnel>          (Sovereign)
//   supabase secrets set COMFYUI_WORKFLOW='<workflow json with __PROMPT__>'  (optional override)
//   supabase secrets set ARGANTA_CF_ACCOUNT_ID=xxxxx               (sponsored fallback)
//   supabase secrets set ARGANTA_CF_API_TOKEN=xxxxx                (Workers AI: Run)
//
// Actions (POST JSON, parent JWT required):
//   { action: 'health' }                        → which backends are configured (no secrets leaked)
//   { action: 'generate_image', prompt, size? } → { imageBase64, mime, provider, latencyMs } | { error }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } })
const KID_DOMAIN = '@kids.argantalab.app'

// The allowlist is the wall. When S3 lands, each entry gets a data-only handler
// that runs on the caller's JWT. For S1, only generate_image is live; the rest
// are declared so the contract is visible and code review can see the ceiling.
const TOOL_ALLOWLIST = ['generate_image', 'get_week', 'get_today', 'get_kid_reports', 'get_kid_dashboard', 'compose_win', 'add_event', 'add_routine', 'publish_post'] as const

const CF_IMAGE_MODEL = '@cf/black-forest-labs/flux-1-schnell'

// ── Sovereign: ComfyUI txt2img over its HTTP API (submit → poll → fetch) ──
// A minimal SD1.5 txt2img graph with a __PROMPT__ placeholder. Override with the
// COMFYUI_WORKFLOW secret to use YOUR exact working graph (paste it with
// __PROMPT__ where the positive prompt text goes) — so this never assumes your
// node layout or checkpoint.
const DEFAULT_WORKFLOW = {
  '3': { class_type: 'KSampler', inputs: { seed: 0, steps: 20, cfg: 7, sampler_name: 'euler', scheduler: 'normal', denoise: 1, model: ['4', 0], positive: ['6', 0], negative: ['7', 0], latent_image: ['5', 0] } },
  '4': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'v1-5-pruned-emaonly.safetensors' } },
  '5': { class_type: 'EmptyLatentImage', inputs: { width: 1024, height: 1024, batch_size: 1 } },
  '6': { class_type: 'CLIPTextEncode', inputs: { text: '__PROMPT__', clip: ['4', 1] } },
  '7': { class_type: 'CLIPTextEncode', inputs: { text: 'lowres, bad anatomy, text, watermark', clip: ['4', 1] } },
  '8': { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['4', 2] } },
  '9': { class_type: 'SaveImage', inputs: { filename_prefix: 'arganta', images: ['8', 0] } },
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''; const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
  return btoa(bin)
}

async function generateViaComfy(base: string, prompt: string): Promise<{ imageBase64: string; mime: string } | { error: string }> {
  let workflow: unknown
  try {
    const override = Deno.env.get('COMFYUI_WORKFLOW')
    workflow = override ? JSON.parse(override) : DEFAULT_WORKFLOW
  } catch { return { error: 'COMFYUI_WORKFLOW is not valid JSON' } }
  // inject the prompt (string-replace the placeholder anywhere in the graph)
  const graph = JSON.parse(JSON.stringify(workflow).replaceAll('__PROMPT__', prompt.replace(/"/g, '\\"')))

  const clientId = crypto.randomUUID()
  const sub = await fetch(`${base}/prompt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: graph, client_id: clientId }) })
  if (!sub.ok) return { error: `comfy /prompt ${sub.status}: ${(await sub.text()).slice(0, 200)}` }
  const { prompt_id } = await sub.json().catch(() => ({})) as { prompt_id?: string }
  if (!prompt_id) return { error: 'comfy returned no prompt_id' }

  // poll history (ComfyUI has no push here; bounded wait)
  const deadline = Date.now() + 90_000
  let outputs: any = null
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 1500))
    const h = await fetch(`${base}/history/${prompt_id}`)
    if (!h.ok) continue
    const hist = await h.json().catch(() => ({})) as Record<string, any>
    const entry = hist[prompt_id]
    if (entry?.outputs) { outputs = entry.outputs; break }
  }
  if (!outputs) return { error: 'comfy timed out (90s) — is the workflow valid and the model loaded?' }

  const imgNode = Object.values(outputs).find((o: any) => Array.isArray(o?.images) && o.images.length) as any
  const img = imgNode?.images?.[0]
  if (!img) return { error: 'comfy produced no image (check the SaveImage node)' }

  const view = await fetch(`${base}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder || '')}&type=${encodeURIComponent(img.type || 'output')}`)
  if (!view.ok) return { error: `comfy /view ${view.status}` }
  const bytes = new Uint8Array(await view.arrayBuffer())
  if (!bytes.length) return { error: 'comfy returned empty image bytes' }
  return { imageBase64: bytesToBase64(bytes), mime: img.filename?.endsWith('.jpg') ? 'image/jpeg' : 'image/png' }
}

async function generateViaCloudflare(prompt: string): Promise<{ imageBase64: string; mime: string } | { error: string }> {
  // Prefer the family app's OWN keys (per-app revocation); fall back to the
  // project's existing shared Cloudflare Workers AI keys so image generation
  // works out of the box. The CF key only grants image-gen quota — it never
  // touches HQ data (that wall is the JWT + RLS + allowlist, not this key).
  const acct = Deno.env.get('ARGANTA_CF_ACCOUNT_ID') || Deno.env.get('CF_ACCOUNT_ID')
  const token = Deno.env.get('ARGANTA_CF_API_TOKEN') || Deno.env.get('CF_API_TOKEN')
  if (!acct || !token) return { error: 'no Cloudflare fallback configured' }
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${acct}/ai/run/${CF_IMAGE_MODEL}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ prompt, steps: 4 }),
  })
  if (!r.ok) return { error: `cloudflare ${r.status}: ${(await r.text()).slice(0, 200)}` }
  const j = await r.json().catch(() => ({})) as any
  const b64 = j?.result?.image
  return b64 ? { imageBase64: b64, mime: 'image/jpeg' } : { error: 'cloudflare returned no image' }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405)

  // ── the wall's front door: a signed-in parent, verified per-request ──
  const asUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
  })
  const { data: { user }, error: authErr } = await asUser.auth.getUser()
  if (authErr || !user) return json({ ok: false, error: 'Sign in required' }, 401)
  if ((user.email || '').toLowerCase().endsWith(KID_DOMAIN)) return json({ ok: false, error: 'This app is for parents.' }, 403)

  let body: any
  try { body = await req.json() } catch { return json({ ok: false, error: 'Bad JSON' }, 400) }

  if (body.action === 'health') {
    return json({
      ok: true,
      sovereign: !!Deno.env.get('COMFYUI_URL'),
      fallback: !!((Deno.env.get('ARGANTA_CF_ACCOUNT_ID') || Deno.env.get('CF_ACCOUNT_ID')) && (Deno.env.get('ARGANTA_CF_API_TOKEN') || Deno.env.get('CF_API_TOKEN'))),
      tools: TOOL_ALLOWLIST,
    })
  }

  if (body.action === 'generate_image') {
    const prompt = String(body.prompt || '').slice(0, 1500)
    if (!prompt.trim()) return json({ ok: false, error: 'prompt required' }, 400)
    const t0 = performance.now()

    const comfyBase = (Deno.env.get('COMFYUI_URL') || '').replace(/\/+$/, '')
    if (comfyBase) {
      const c = await generateViaComfy(comfyBase, prompt)
      if ('imageBase64' in c) return json({ ok: true, ...c, provider: 'comfyui', latencyMs: Math.round(performance.now() - t0) })
      // fall through to sponsored fallback, remembering why Sovereign failed
      const cf = await generateViaCloudflare(prompt)
      if ('imageBase64' in cf) return json({ ok: true, ...cf, provider: 'cloudflare', sovereignError: c.error, latencyMs: Math.round(performance.now() - t0) })
      return json({ ok: false, error: `Sovereign: ${c.error} · Fallback: ${cf.error}` }, 502)
    }

    const cf = await generateViaCloudflare(prompt)
    if ('imageBase64' in cf) return json({ ok: true, ...cf, provider: 'cloudflare', latencyMs: Math.round(performance.now() - t0) })
    return json({ ok: false, error: cf.error }, 502)
  }

  // Anything not on the allowlist is not merely refused — it does not exist.
  return json({ ok: false, error: `Unknown or not-yet-wired action: ${body.action}` }, 400)
})
