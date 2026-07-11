// createLLM(config) → one surface (chat / chatJSON / chatTools / chatStream) over
// four interchangeable providers. Every provider implements the same run() shape:
//   run({messages, json, schema, tools, temperature, seed, onToken, signal})
//     → { text, toolCalls? }
// The adapter picks a provider per task via router(), and NEVER hard-fails: a
// missing key/model/dep degrades to the deterministic mock so callers always get
// a usable answer (the whole app already follows this honest-fallback contract).
import { route } from './router.js';

// ---- JSON extraction (models wrap JSON in prose / fences) --------------------
export function extractJSON(text) {
  if (!text) return null;
  let s = String(text).trim().replace(/^```(?:json)?/i, '').replace(/```$/,'').trim();
  try { return JSON.parse(s); } catch { /* find first balanced object */ }
  const i = s.indexOf('{'); if (i < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; }
    else if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}') { if (--depth === 0) { try { return JSON.parse(s.slice(i, j + 1)); } catch { return null; } } }
  }
  return null;
}

// ---- providers --------------------------------------------------------------
function mockProvider() {
  return {
    id: 'mock',
    async run({ messages, json, tools }) {
      const last = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
      if (tools?.length) return { text: `_(mock)_ I'd call a tool here, but no live model is connected. Facts above stand on their own.`, toolCalls: [] };
      if (json) return { text: '{}', toolCalls: [] }; // director/agent use their own local fallback when provider==='mock'
      return { text: `_(mock reply — connect WebLLM or a free key)_ You said: "${String(last).slice(0, 160)}"`, toolCalls: [] };
    },
  };
}

// OpenAI-compatible HTTP (Groq, OpenRouter, Ollama, Gemini via its OpenAI-compat
// endpoint, or your own llm-proxy exposed as a URL).
function openaiCompatProvider({ baseUrl, apiKey, model, headers }) {
  return {
    id: 'openaiCompat',
    async run({ messages, json, schema, tools, temperature = 0.6, seed, onToken, signal }) {
      const body = { model, messages, temperature, stream: !!onToken };
      if (seed != null) body.seed = seed;
      if (json) body.response_format = schema ? { type: 'json_schema', json_schema: { name: 'out', schema } } : { type: 'json_object' };
      if (tools?.length) { body.tools = tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } })); body.tool_choice = 'auto'; }
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST', signal,
        headers: { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}), ...headers },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 200)}`);
      if (onToken && res.body) return await readSSE(res, onToken);
      const d = await res.json();
      const msg = d.choices?.[0]?.message || {};
      return { text: msg.content || '', toolCalls: (msg.tool_calls || []).map(normalizeToolCall) };
    },
  };
}

// The browser reaches Gemini/Groq through our operator-gated Edge Function, so
// the key never ships in client JS. `invoke(body)` = supabase.functions.invoke.
function edgeProxyProvider({ invoke }) {
  return {
    id: 'edgeProxy',
    async run({ messages, json, schema, tools, temperature = 0.6, seed, onToken }) {
      const { data, error } = await invoke({ messages, json, schema, tools, temperature, seed });
      if (error) throw new Error(error.message || String(error));
      if (data?.error) throw new Error(data.error);
      const out = { text: data?.text || '', toolCalls: data?.toolCalls || [] };
      if (onToken && out.text) chunkEmit(out.text, onToken); // proxy is non-streaming; simulate
      return out;
    },
  };
}

// In-browser, WebGPU, weights from your Supabase bucket. Dep (@mlc-ai/web-llm) is
// dynamically imported so the package builds without it; install to enable.
function webllmProvider({ modelId, appConfig }) {
  let engineP = null;
  const ensure = async () => {
    if (!engineP) engineP = (async () => {
      // Non-static specifier so the bundler never tries to resolve it at build
      // time — WebLLM is an OPTIONAL dep, imported only when actually enabled.
      const spec = '@mlc-ai/' + 'web-llm';
      const webllm = await import(/* @vite-ignore */ spec);
      return webllm.CreateMLCEngine(modelId, { appConfig });
    })();
    return engineP;
  };
  return {
    id: 'webllm', ensure,
    async run({ messages, json, tools, temperature = 0.6, seed, onToken, signal }) {
      const engine = await ensure();
      const req = { messages, temperature, stream: !!onToken };
      if (seed != null) req.seed = seed;
      if (json) req.response_format = { type: 'json_object' };
      if (tools?.length) req.tools = tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));
      if (onToken) {
        let text = '';
        const stream = await engine.chat.completions.create(req);
        for await (const chunk of stream) { const d = chunk.choices?.[0]?.delta?.content || ''; if (d) { text += d; onToken(d); } if (signal?.aborted) break; }
        return { text, toolCalls: [] };
      }
      const d = await engine.chat.completions.create(req);
      const msg = d.choices?.[0]?.message || {};
      return { text: msg.content || '', toolCalls: (msg.tool_calls || []).map(normalizeToolCall) };
    },
  };
}

// ---- helpers ----
function normalizeToolCall(tc) { try { return { id: tc.id, name: tc.function?.name, args: JSON.parse(tc.function?.arguments || '{}') }; } catch { return { id: tc?.id, name: tc?.function?.name, args: {} }; } }
async function readSSE(res, onToken) {
  const reader = res.body.getReader(), dec = new TextDecoder(); let buf = '', text = '';
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n'); buf = lines.pop() || '';
    for (const ln of lines) {
      const m = ln.trim(); if (!m.startsWith('data:')) continue;
      const payload = m.slice(5).trim(); if (payload === '[DONE]') continue;
      try { const j = JSON.parse(payload); const d = j.choices?.[0]?.delta?.content || ''; if (d) { text += d; onToken(d); } } catch { /* keep-alive */ }
    }
  }
  return { text, toolCalls: [] };
}
function chunkEmit(text, onToken) { for (let i = 0; i < text.length; i += 4) onToken(text.slice(i, i + 4)); }

// ---- factory ----------------------------------------------------------------
export function createLLM(config = {}) {
  const providers = {};
  providers.mock = mockProvider();
  if (config.openaiCompat) providers.openaiCompat = openaiCompatProvider(config.openaiCompat);
  if (config.edgeProxy) providers.edgeProxy = edgeProxyProvider(config.edgeProxy);
  if (config.webllm) providers.webllm = webllmProvider(config.webllm);
  const available = { mock: true, openaiCompat: !!providers.openaiCompat, edgeProxy: !!providers.edgeProxy, webllm: !!providers.webllm };
  const cfg = { ...config, available };

  async function call(task, args) {
    const r = route(task, cfg);
    const provider = providers[r.provider] || providers.mock;
    try {
      const out = await provider.run({ ...args, model: r.model });
      return { ...out, provider: provider.id, tier: r.tier };
    } catch (e) {
      if (provider.id !== 'mock') { // degrade to mock rather than throw
        const out = await providers.mock.run(args);
        return { ...out, provider: 'mock', tier: r.tier, error: String(e?.message || e) };
      }
      throw e;
    }
  }

  return {
    info: () => ({ available, providers: Object.keys(providers) }),
    chat: (o) => call(o.task || 'reason', { messages: o.messages, temperature: o.temperature, seed: o.seed }),
    chatStream: (o, onToken) => call(o.task || 'brief', { messages: o.messages, temperature: o.temperature, seed: o.seed, onToken }),
    async chatJSON(o) {
      const out = await call(o.task || 'storyboard', { messages: o.messages, json: true, schema: o.schema, temperature: o.temperature ?? 0.5, seed: o.seed });
      return { ...out, json: extractJSON(out.text) };
    },
    chatTools: (o) => call(o.task || 'orchestrate', { messages: o.messages, tools: o.tools, temperature: o.temperature ?? 0.4 }),
  };
}
