// arganta-publish — the browser reaches Buffer THROUGH this, so the Buffer/core
// token never ships in client JS. It authenticates the signed-in PARENT (kids are
// refused), then relays to the same core Worker routes HQ + the MCP use. It can
// only QUEUE a post for review in Buffer — never fire an immediate live publish.
//
// Deploy:  supabase functions deploy arganta-publish
// Secrets (the SAME core Worker + token the arganta-core MCP already uses):
//   supabase secrets set ARGANTA_CORE_URL=https://<your-core-worker>
//   supabase secrets set ARGANTA_CORE_TOKEN=<the worker bearer>
//
// Actions (POST JSON):
//   { action: 'channels' }                                  → { channels: [...] }
//   { action: 'publish', channelId, text, imageUrls, mode } → { postId, images, mode }
//     mode ∈ 'addToQueue' | 'shareNext' | 'shareNow'
//     'shareNow' publishes to the live account immediately (the founder's own
//     tool — the MCP blocks shareNow, this deliberately allows it because the
//     signed-in parent operates it directly with an in-app confirm). Kids can't
//     reach this at all.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } })

const KID_DOMAIN = '@kids.argantalab.app'
const MODES = new Set(['addToQueue', 'shareNext', 'shareNow'])

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405)

  const CORE_URL = (Deno.env.get('ARGANTA_CORE_URL') || Deno.env.get('CORE_URL') || '').replace(/\/+$/, '')
  const CORE_TOKEN = Deno.env.get('ARGANTA_CORE_TOKEN') || Deno.env.get('CORE_TOKEN')
  if (!CORE_URL) return json({ ok: false, error: 'ARGANTA_CORE_URL not configured' }, 500)

  // ── authenticate the caller as a parent ──
  const authHeader = req.headers.get('Authorization') || ''
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: userData, error: userErr } = await supabase.auth.getUser()
  const user = userData?.user
  if (userErr || !user) return json({ ok: false, error: 'Sign in required' }, 401)
  if ((user.email || '').toLowerCase().endsWith(KID_DOMAIN)) {
    return json({ ok: false, error: 'This action is for parents.' }, 403)
  }

  let body: any
  try { body = await req.json() } catch { return json({ ok: false, error: 'Bad JSON' }, 400) }
  const coreHeaders = { 'Content-Type': 'application/json', ...(CORE_TOKEN ? { Authorization: `Bearer ${CORE_TOKEN}` } : {}) }

  try {
    if (body.action === 'channels') {
      const r = await fetch(`${CORE_URL}/v1/buffer/channels`, { headers: coreHeaders })
      const data = await r.json().catch(() => null)
      if (!r.ok || !data || data.ok === false) return json({ ok: false, error: data?.error?.message || `Worker ${r.status}` }, 502)
      return json({ ok: true, channels: data.channels || [] })
    }

    if (body.action === 'publish') {
      const { channelId, text, imageUrls, mode } = body
      if (!channelId) return json({ ok: false, error: 'channelId required' }, 400)
      if (!Array.isArray(imageUrls) || imageUrls.length === 0) return json({ ok: false, error: 'imageUrls required' }, 400)
      const safeMode = MODES.has(mode) ? mode : 'addToQueue'
      const r = await fetch(`${CORE_URL}/v1/buffer/publish`, {
        method: 'POST', headers: coreHeaders,
        body: JSON.stringify({ channelId, text: text || '', imageUrls, mode: safeMode }),
      })
      const data = await r.json().catch(() => null)
      if (!r.ok || !data || data.ok === false) return json({ ok: false, error: data?.error?.message || `Worker ${r.status}` }, 502)
      return json({ ok: true, postId: data.postId, images: data.images, mode: data.mode })
    }

    return json({ ok: false, error: `Unknown action ${body.action}` }, 400)
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500)
  }
})
