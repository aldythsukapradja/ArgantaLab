// media-proxy — the browser reaches Sponsored/Economy MEDIA generators THROUGH
// this, so provider keys never ship in client JS. Operator-gated. The media twin
// of llm-proxy (docs/media-center/Compute-Substrate.md): returns the REAL
// upstream provider/model/cost/latency it used, tries a bounded cheaper fallback
// on a retryable failure, never a generic label.
//
// v1 = IMAGE + TTS. kind:'image' returns { imageBase64, ... }; kind:'tts'
// returns { audioBase64, ... } — both share provider/model/costClass/costUsd/
// latencyMs/fallbackFrom.
//
// Deploy:  supabase functions deploy media-proxy
// Secrets (Sponsored — Cloudflare Workers AI, free tier — covers BOTH image and
// tts, same account/token, nothing extra to set for TTS):
//   supabase secrets set CF_ACCOUNT_ID=xxxxx
//   supabase secrets set CF_API_TOKEN=xxxxx            (token with Workers AI Run)
//   → dash.cloudflare.com → AI → Workers AI (grab account id + create API token)
// Optional — for the Model Rack's neuron quota gauge ({action:'quota'}), the
// SAME token additionally needs "Account Analytics: Read" (a different scope
// than "Workers AI: Run" — generation keeps working without it, the gauge just
// reports insufficient_scope until you add it: My Profile → API Tokens → edit
// the token → add permission).
// Secrets (Economy — Modal, after `modal deploy modal/media_image.py`):
//   supabase secrets set MODAL_IMAGE_URL=https://<you>--arganta-media-image.modal.run
//   supabase secrets set MODAL_TOKEN=<the shared secret you set in the app>
//
// All routing/translation/pricing lives in router.js (pure, unit-tested under
// plain Node — see router.test.js) so this file stays a thin Deno shell.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  pickMediaCandidates, priceUsd,
  toCloudflareImageRequest, fromCloudflareImageResponse,
  toModalImageRequest, fromModalImageResponse, isRetryableStatus,
  toCloudflareTtsRequest, isBinaryAudioContentType,
  toNeuronQuotaQuery, fromNeuronQuotaResponse, FREE_NEURONS_PER_DAY,
} from './router.js'

// Deno's btoa() only accepts a string; for binary audio bytes we build that
// string in bounded chunks (String.fromCharCode(...bytes) blows the call stack
// on large arrays — Aura-1 clips can be a few hundred KB).
function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  return btoa(binary)
}

const OPERATOR = 'aldhyt.sukapradja@gmail.com'
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } })

function availableKeys(): Record<string, boolean> {
  const keys = ['CF_ACCOUNT_ID', 'CF_API_TOKEN', 'MODAL_IMAGE_URL', 'MODAL_TOKEN']
  return Object.fromEntries(keys.map((k) => [k, !!Deno.env.get(k)]))
}

async function callCandidate(entry: any, prompt: string, voice?: string) {
  const t0 = performance.now()
  if (entry.shape === 'cf-tts') {
    const req = toCloudflareTtsRequest({ accountId: Deno.env.get('CF_ACCOUNT_ID')!, model: entry.model, text: prompt, ...(voice ? { speaker: voice } : {}) })
    const r = await fetch(req.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${Deno.env.get('CF_API_TOKEN')}` },
      body: JSON.stringify(req.body),
    })
    const latencyMs = Math.round(performance.now() - t0)
    if (!r.ok) return { ok: false as const, status: r.status, latencyMs, errText: (await r.text()).slice(0, 300) }
    const ct = r.headers.get('content-type')
    if (!isBinaryAudioContentType(ct)) {
      // Defensive path — Aura-1 normally returns raw bytes, but if Cloudflare
      // ever wraps this model's output in JSON, don't silently mis-decode it.
      return { ok: false as const, status: 502, latencyMs, errText: `unexpected content-type from cloudflare-aura: ${ct}` }
    }
    const bytes = new Uint8Array(await r.arrayBuffer())
    if (!bytes.length) return { ok: false as const, status: 502, latencyMs, errText: 'cloudflare returned no audio' }
    return { ok: true as const, audioBase64: bytesToBase64(bytes), mime: 'audio/mpeg', latencyMs, costUsd: priceUsd(entry, prompt.length) }
  }
  if (entry.shape === 'cf-image') {
    const req = toCloudflareImageRequest({ accountId: Deno.env.get('CF_ACCOUNT_ID')!, model: entry.model, prompt })
    const r = await fetch(req.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${Deno.env.get('CF_API_TOKEN')}` },
      body: JSON.stringify(req.body),
    })
    const latencyMs = Math.round(performance.now() - t0)
    if (!r.ok) return { ok: false as const, status: r.status, latencyMs, errText: (await r.text()).slice(0, 300) }
    const parsed = fromCloudflareImageResponse(await r.json())
    if (!parsed) return { ok: false as const, status: 502, latencyMs, errText: 'cloudflare returned no image' }
    return { ok: true as const, ...parsed, latencyMs, costUsd: priceUsd(entry) }
  }
  if (entry.shape === 'modal-image') {
    const req = toModalImageRequest({ url: Deno.env.get('MODAL_IMAGE_URL')!, prompt })
    const r = await fetch(req.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${Deno.env.get('MODAL_TOKEN')}` },
      body: JSON.stringify(req.body),
    })
    const latencyMs = Math.round(performance.now() - t0)
    if (!r.ok) return { ok: false as const, status: r.status, latencyMs, errText: (await r.text()).slice(0, 300) }
    const parsed = fromModalImageResponse(await r.json())
    if (!parsed) return { ok: false as const, status: 502, latencyMs, errText: 'modal returned no image' }
    return { ok: true as const, ...parsed, latencyMs, costUsd: priceUsd(entry) }
  }
  return { ok: false as const, status: 500, latencyMs: 0, errText: `unknown shape ${entry.shape}` }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } })
    const { data: { user } } = await asUser.auth.getUser()
    if (!user || (user.email || '').toLowerCase() !== OPERATOR) return json({ error: 'not authorized' }, 403)

    const body = await req.json()

    // Neuron quota — a read-only sidecar action, not a generation request.
    // Requires "Account Analytics: Read" on CF_API_TOKEN — a DIFFERENT scope
    // than "Workers AI: Run" (used for actual generation), so this can 403
    // even when image/tts generation works fine. Honest fallback either way.
    if (body.action === 'quota') {
      const accountId = Deno.env.get('CF_ACCOUNT_ID')
      const token = Deno.env.get('CF_API_TOKEN')
      if (!accountId || !token) return json({ error: 'CF_ACCOUNT_ID/CF_API_TOKEN not set' }, 400)
      const date = new Date().toISOString().slice(0, 10)
      const q = toNeuronQuotaQuery({ accountId, date })
      const r = await fetch(q.url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(q.body) })
      const parsed = fromNeuronQuotaResponse(await r.json())
      // Always 200 here — this is a read/diagnostic action, not a generation
      // request, and supabase-js's functions.invoke() discards the response
      // body on non-2xx status (confirmed this session), which would hide
      // `error` from the caller. Error info travels in the body instead.
      return json({ ...parsed, freePerDay: FREE_NEURONS_PER_DAY, date })
    }

    const { kind = 'image', prompt, costClass, provider: force, voice } = body
    if (!prompt || typeof prompt !== 'string') return json({ error: 'prompt required' }, 400)

    const candidates = pickMediaCandidates(availableKeys(), { kind, costClass, force })
    if (candidates.length === 0) {
      return json({ error: 'No media provider key set for this tier. See supabase/functions/media-proxy/index.ts header for setup.' }, 400)
    }

    let lastErr = ''
    for (let i = 0; i < candidates.length; i++) {
      const entry = candidates[i]
      const res = await callCandidate(entry, prompt, voice)
      if (res.ok) {
        return json({
          ...(kind === 'tts' ? { audioBase64: (res as any).audioBase64 } : { imageBase64: (res as any).imageBase64 }),
          mime: res.mime,
          provider: entry.name, model: entry.model, costClass: entry.costClass,
          costUsd: res.costUsd, latencyMs: res.latencyMs,
          fallbackFrom: i > 0 ? candidates[0].costClass : null,
        })
      }
      lastErr = `${entry.name} ${res.status}: ${res.errText}`
      if (!isRetryableStatus(res.status) || i === candidates.length - 1) {
        return json({ error: lastErr, provider: entry.name }, 502)
      }
      // retryable — fall through to the next cheaper candidate
    }
    return json({ error: lastErr || 'all candidates failed' }, 502)
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500)
  }
})
