// llm-proxy — the browser reaches free-tier LLMs THROUGH this, so the API key
// never ships in client JS. Operator-gated. OpenAI-compatible in and out, so the
// @arganta/ai edgeProxy provider talks to it exactly like any OpenAI endpoint.
//
// Deploy:  supabase functions deploy llm-proxy
// Secrets: supabase secrets set GEMINI_API_KEY=xxx   (and/or) GROQ_API_KEY=yyy
// Free keys: aistudio.google.com/apikey · console.groq.com/keys
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const OPERATOR = 'aldhyt.sukapradja@gmail.com'
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } })

// provider registry — first one with a key set wins (or body.provider forces it)
function pickProvider(force?: string) {
  const gem = Deno.env.get('GEMINI_API_KEY'), groq = Deno.env.get('GROQ_API_KEY')
  const reg: Record<string, any> = {
    gemini: gem && { url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', key: gem, model: 'gemini-2.0-flash' },
    groq: groq && { url: 'https://api.groq.com/openai/v1/chat/completions', key: groq, model: 'llama-3.3-70b-versatile' },
  }
  if (force && reg[force]) return { name: force, ...reg[force] }
  for (const name of ['gemini', 'groq']) if (reg[name]) return { name, ...reg[name] }
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } })
    const { data: { user } } = await asUser.auth.getUser()
    if (!user || (user.email || '').toLowerCase() !== OPERATOR) return json({ error: 'not authorized' }, 403)

    const { messages, json: wantJson, schema, tools, temperature = 0.6, seed, provider: force, model: modelOverride } = await req.json()
    const p = pickProvider(force)
    if (!p) return json({ error: 'No LLM key set. supabase secrets set GEMINI_API_KEY=… or GROQ_API_KEY=…' }, 400)

    const body: any = { model: modelOverride || p.model, messages, temperature }
    if (seed != null) body.seed = seed
    if (wantJson) body.response_format = schema ? { type: 'json_schema', json_schema: { name: 'out', schema } } : { type: 'json_object' }
    if (tools?.length) { body.tools = tools.map((t: any) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } })); body.tool_choice = 'auto' }

    const r = await fetch(p.url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p.key}` }, body: JSON.stringify(body) })
    if (!r.ok) return json({ error: `${p.name} ${r.status}: ${(await r.text()).slice(0, 300)}` }, 502)
    const d = await r.json()
    const msg = d.choices?.[0]?.message || {}
    const toolCalls = (msg.tool_calls || []).map((tc: any) => { try { return { id: tc.id, name: tc.function?.name, args: JSON.parse(tc.function?.arguments || '{}') } } catch { return { id: tc.id, name: tc.function?.name, args: {} } } })
    return json({ text: msg.content || '', toolCalls, provider: p.name, model: body.model })
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500)
  }
})
