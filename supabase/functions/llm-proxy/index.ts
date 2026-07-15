// llm-proxy — the browser reaches Sponsored/Economy/Frontier LLMs THROUGH this,
// so API keys never ship in client JS. Operator-gated. WS-3: rewritten as a
// TRUTHFUL gateway (docs/media-center/Intelligence-Router.md) — returns the
// REAL upstream provider/model/tokens/cost/latency it used, never a generic
// label, and tries a bounded fallback chain (cheapest-first, up to 2
// candidates) on a retryable failure instead of just erroring out.
//
// Deploy:  supabase functions deploy llm-proxy
// Secrets: supabase secrets set GEMINI_API_KEY=xxx
//          supabase secrets set GROQ_API_KEY=xxx
//          supabase secrets set CF_ACCOUNT_ID=xxx / CF_API_TOKEN=xxx   (Sponsored — same
//            secrets media-proxy uses; project-level, shared across Edge Functions)
//          supabase secrets set DEEPSEEK_API_KEY=xxx      (Economy)
//          supabase secrets set ANTHROPIC_API_KEY=xxx     (Economy Haiku + Frontier Sonnet/Opus)
// Free keys: aistudio.google.com/apikey · console.groq.com/keys · dash.cloudflare.com (Workers AI)
//
// All routing/pricing/translation logic lives in router.js (pure, unit-tested
// under plain Node — see router.test.js) so this file stays a thin Deno shell.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  pickCandidates, priceUsd, toOpenAICompatBody, fromOpenAICompatResponse,
  toAnthropicBody, fromAnthropicResponse, isRetryableStatus, resolveUrl,
} from './router.js'

const OPERATOR = 'aldhyt.sukapradja@gmail.com'
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } })

function availableKeys(): Record<string, boolean> {
  const keys = ['GEMINI_API_KEY', 'GROQ_API_KEY', 'DEEPSEEK_API_KEY', 'ANTHROPIC_API_KEY', 'CF_API_TOKEN', 'CF_ACCOUNT_ID']
  return Object.fromEntries(keys.map((k) => [k, !!Deno.env.get(k)]))
}

async function callCandidate(entry: any, req: { messages: any[]; json?: boolean; schema?: unknown; tools?: unknown[]; temperature?: number; seed?: number; model?: string }) {
  const key = Deno.env.get(entry.envKey)!
  const model = req.model && req.model === entry.model ? req.model : entry.model
  const t0 = performance.now()

  if (entry.shape === 'anthropic') {
    const body = toAnthropicBody({ messages: req.messages, model, temperature: req.temperature, json: req.json })
    const r = await fetch(entry.url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' }, body: JSON.stringify(body) })
    const latencyMs = Math.round(performance.now() - t0)
    if (!r.ok) return { ok: false as const, status: r.status, latencyMs, errText: (await r.text()).slice(0, 300) }
    const d = await r.json()
    const out = fromAnthropicResponse(d, !!req.json)
    return { ok: true as const, ...out, latencyMs, costUsd: priceUsd(entry, out.inputTokens, out.outputTokens) }
  }

  const body = toOpenAICompatBody({ messages: req.messages, model, temperature: req.temperature, seed: req.seed, json: req.json, schema: req.schema, tools: req.tools })
  const url = resolveUrl(entry, Deno.env.get('CF_ACCOUNT_ID'))
  const r = await fetch(url!, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify(body) })
  const latencyMs = Math.round(performance.now() - t0)
  if (!r.ok) return { ok: false as const, status: r.status, latencyMs, errText: (await r.text()).slice(0, 300) }
  const d = await r.json()
  const out = fromOpenAICompatResponse(d)
  return { ok: true as const, ...out, latencyMs, costUsd: priceUsd(entry, out.inputTokens, out.outputTokens) }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } })
    const { data: { user } } = await asUser.auth.getUser()
    if (!user || (user.email || '').toLowerCase() !== OPERATOR) return json({ error: 'not authorized' }, 403)

    const { messages, json: wantJson, schema, tools, temperature = 0.6, seed, provider: force, model, costClass } = await req.json()
    const candidates = pickCandidates(availableKeys(), { force, model, costClass, needsTools: !!tools?.length })
    if (candidates.length === 0) {
      return json({ error: 'No usable LLM key set for this request. supabase secrets set GEMINI_API_KEY=… (free) or DEEPSEEK_API_KEY=…/ANTHROPIC_API_KEY=… (paid).' }, 400)
    }

    let lastErr = ''
    for (let i = 0; i < candidates.length; i++) {
      const entry = candidates[i]
      const res = await callCandidate(entry, { messages, json: wantJson, schema, tools, temperature, seed, model })
      if (res.ok) {
        return json({
          text: res.text, toolCalls: (res as any).toolCalls || [],
          provider: entry.name, model, // model requested; entry.model is what was actually sent if it differed
          actualModel: entry.model, costClass: entry.costClass,
          inputTokens: res.inputTokens, outputTokens: res.outputTokens,
          costUsd: res.costUsd, latencyMs: res.latencyMs, fallbackFrom: i > 0 ? candidates[0].costClass : null,
        })
      }
      lastErr = `${entry.name} ${res.status}: ${res.errText}`
      if (!isRetryableStatus(res.status) || i === candidates.length - 1) {
        return json({ error: lastErr, provider: entry.name }, 502)
      }
      // retryable (429/5xx) — fall through to the next cheapest candidate
    }
    return json({ error: lastErr || 'all candidates failed' }, 502)
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500)
  }
})
