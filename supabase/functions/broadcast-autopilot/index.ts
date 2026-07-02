// ============================================================
//  BROADCAST AUTOPILOT — the automated content engine.
//
//  Generates a batch of "Discover" posts with an LLM and drip-schedules
//  them into kinetik_broadcast (status='scheduled'). The existing
//  hq_broadcast_publish_due() cron then publishes one per its due time.
//  Idempotent: dedupes on external_key so retries never double-post.
//
//  Triggers:
//   • cron (weekly refill): header  x-autopilot-secret: <AUTOPILOT_SECRET>
//   • HQ "Generate now" button: authenticated OPERATOR JWT (Authorization)
//
//  Secrets (supabase secrets set …):
//   ANTHROPIC_API_KEY, AUTOPILOT_SECRET   (SUPABASE_URL / SERVICE_ROLE / ANON
//   are injected automatically in the Functions runtime)
//
//  Deploy: supabase functions deploy broadcast-autopilot
//  Schedule (weekly refill) with pg_cron + pg_net, or the Supabase Cron UI.
// ============================================================
import { createClient } from 'npm:@supabase/supabase-js@2'

const FORMATS = ['fact', 'did_you_know', 'top10', 'tip', 'quote', 'story', 'on_this_day', 'this_or_that', 'mind_blown', 'by_numbers', 'challenge']
const THEMES = ['family', 'kids', 'parenting', 'friends', 'funfacts', 'wellbeing', 'history', 'nature', 'space', 'animals', 'science', 'food', 'sports', 'world']
const ACCENT: Record<string, string> = {
  family: '#F43F5E', kids: '#FBBF24', parenting: '#34D399', friends: '#22D3EE', funfacts: '#8B5CF6',
  wellbeing: '#10B981', history: '#A16207', nature: '#0EA5E9', space: '#6366F1', animals: '#F97316',
  science: '#14B8A6', food: '#DB2777', sports: '#84CC16', world: '#0891B2',
}
const PROMPT_VERSION = 'ap-v1'

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } })
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, Math.round(v || 0)))

/** Extract the first JSON array from a (possibly chatty) LLM reply. */
function parseArray(text: string): any[] {
  const s = text.indexOf('['), e = text.lastIndexOf(']')
  if (s < 0 || e <= s) return []
  try { const v = JSON.parse(text.slice(s, e + 1)); return Array.isArray(v) ? v : [] } catch { return [] }
}
async function keyOf(title: string, body: string): Promise<string> {
  const data = new TextEncoder().encode(`${title}|${body}`.toLowerCase().trim())
  const digest = await crypto.subtle.digest('SHA-256', data)
  return 'ap_' + Array.from(new Uint8Array(digest)).slice(0, 10).map(b => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
  const URL = Deno.env.get('SUPABASE_URL')!
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const ANON = Deno.env.get('SUPABASE_ANON_KEY')!

  // ── auth: cron secret OR an authenticated HQ operator ──
  let allowed = false
  const secret = req.headers.get('x-autopilot-secret')
  const authz = req.headers.get('Authorization') ?? ''
  if (Deno.env.get('AUTOPILOT_SECRET') && secret && secret === Deno.env.get('AUTOPILOT_SECRET')) {
    allowed = true
  } else if (authz.startsWith('Bearer ')) {
    const asUser = createClient(URL, ANON, { global: { headers: { Authorization: authz } } })
    const { data } = await asUser.rpc('hq_is_operator')
    allowed = data === true
  }
  if (!allowed) return json({ error: 'unauthorized' }, 401)

  const body = await req.json().catch(() => ({} as any))
  const count = clamp(body.count ?? 14, 1, 40)
  const gapHours = clamp(body.gapHours ?? 24, 1, 168)
  const status = body.status === 'draft' ? 'draft' : 'scheduled'
  const themeHint = Array.isArray(body.themes) && body.themes.length ? body.themes.join(', ') : 'a wide mix of all themes'

  // ── generate ──
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY not set' }, 500)
  const system =
    `You are "KinetikCircle", a warm, kid-safe family content creator that fills a family app's Discover feed.\n` +
    `Return ONLY a JSON array of ${count} original posts — no prose, no markdown. Each object:\n` +
    `{ "format": one of [${FORMATS.join(', ')}], "theme": one of [${THEMES.join(', ')}], ` +
    `"emoji": one leading emoji, "title": punchy headline <60 chars, "body": 2–4 warm sentences, "source": optional attribution }\n` +
    `Rules: original (inspired-by, never copied), wholesome, screenshot-worthy, one surprising idea each. ` +
    `No medical/financial advice. Vary formats & themes (${themeHint}). For top10 put each item on its own line.`

  let text = '[]'
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'claude-opus-4-8', max_tokens: 3000, system, messages: [{ role: 'user', content: `Generate the ${count} posts now.` }] }),
    })
    const j = await r.json()
    if (!r.ok) return json({ error: 'llm', detail: j?.error?.message ?? r.statusText }, 502)
    text = j?.content?.[0]?.text ?? '[]'
  } catch (e) { return json({ error: 'llm-fetch', detail: String(e) }, 502) }

  const posts = parseArray(text)
  if (!posts.length) return json({ error: 'no-posts', preview: text.slice(0, 200) }, 422)

  // ── schedule tail: drip after the current queue ──
  const supa = createClient(URL, SRK)
  const { data: tailRow } = await supa.from('kinetik_broadcast')
    .select('publish_at').eq('status', 'scheduled').not('publish_at', 'is', null)
    .order('publish_at', { ascending: false }).limit(1).maybeSingle()
  let tail = tailRow?.publish_at ? new Date(tailRow.publish_at) : new Date()
  if (tail.getTime() < Date.now()) tail = new Date()

  const batchId = crypto.randomUUID()
  let inserted = 0, skipped = 0, i = 0
  for (const p of posts) {
    const title = String(p?.title ?? '').trim()
    if (!title) { skipped++; continue }
    const theme = THEMES.includes(p.theme) ? p.theme : 'funfacts'
    const format = FORMATS.includes(p.format) ? p.format : 'fact'
    i++
    const publish_at = status === 'scheduled' ? new Date(tail.getTime() + i * gapHours * 3600_000).toISOString() : null
    const { error } = await supa.from('kinetik_broadcast').insert({
      external_key: await keyOf(title, String(p?.body ?? '')),
      batch_id: batchId, origin: 'llm', prompt_version: PROMPT_VERSION,
      format, theme, title, body: p?.body ?? null,
      media_kind: 'none', media_url: null, source: p?.source ?? null,
      emoji: p?.emoji ?? null, accent: ACCENT[theme], audience: 'circle',
      status, publish_at,
    })
    if (error) skipped++   // unique(external_key) conflict = already have it → skip
    else inserted++
  }

  return json({ inserted, skipped, batch_id: batchId, status, gapHours })
})
