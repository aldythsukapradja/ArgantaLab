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
      if (json) return { text: '{}', toolCalls: [], model: 'mock' }; // director/agent use their own local fallback when provider==='mock'
      return { text: `_(mock reply — connect WebLLM or a free key)_ You said: "${String(last).slice(0, 160)}"`, toolCalls: [], model: 'mock' };
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
      if (onToken && res.body) { const r = await readSSE(res, onToken); return { ...r, model: r.model || model }; }
      const d = await res.json();
      const msg = d.choices?.[0]?.message || {};
      // prefer the API's own echoed model (truthful — some gateways route to a
      // different concrete model than requested) over our requested `model`.
      return { text: msg.content || '', toolCalls: (msg.tool_calls || []).map(normalizeToolCall), model: d.model || model };
    },
  };
}

// The browser reaches Gemini/Groq/DeepSeek/Claude through our operator-gated
// Edge Function, so keys never ship in client JS. `invoke(body)` =
// supabase.functions.invoke. WS-3 upgrades the function itself to be a truthful
// gateway (real provider/model/usage/cost/health/quota returned, never a
// generic label) — this provider already threads whatever it returns through.
function edgeProxyProvider({ invoke }) {
  return {
    id: 'edgeProxy',
    async run({ messages, json, schema, tools, temperature = 0.6, seed, onToken, model }) {
      const { data, error } = await invoke({ messages, json, schema, tools, temperature, seed, model });
      if (error) throw new Error(error.message || String(error));
      if (data?.error) throw new Error(data.error);
      const out = { text: data?.text || '', toolCalls: data?.toolCalls || [], model: data?.model || model || null, actualProvider: data?.provider || null, costUsd: data?.costUsd, inputTokens: data?.inputTokens, outputTokens: data?.outputTokens, latencyMs: data?.latencyMs };
      if (onToken && out.text) chunkEmit(out.text, onToken); // proxy is non-streaming; simulate
      return out;
    },
  };
}

// In-browser, WebGPU, local Tier-0 inference (WS-1 Sovereign Rack). Weights come
// from @mlc-ai/web-llm's OWN prebuilt catalog (MLC-hosted on HF CDN) unless a
// custom `appConfig` is supplied. Dep is dynamically imported so the package
// builds without it; install to enable. See rack.js for the curated model list
// + device profiling that picks `modelId`.
function webllmProvider({ modelId: defaultModelId, appConfig, onProgress }) {
  let engineP = null;
  let loadedModelId = null;
  // ensure(model) — (re)loads the engine only when the requested model differs
  // from what's currently loaded, so registry-driven per-task model switching
  // (0.8B for a quick classify vs 9B for a brief) doesn't re-download needlessly
  // when consecutive calls agree, but DOES switch when the router asks for a
  // different sovereign model.
  const ensure = async (model) => {
    const want = model || defaultModelId;
    if (!want) throw new Error('webllm: no modelId configured or requested');
    if (loadedModelId !== want) engineP = null;
    if (!engineP) engineP = (async () => {
      // Non-static specifier so the bundler never tries to resolve it at build
      // time — WebLLM is an OPTIONAL dep, imported only when actually enabled.
      const spec = '@mlc-ai/' + 'web-llm';
      const webllm = await import(/* @vite-ignore */ spec);
      const cfg = appConfig || webllm.prebuiltAppConfig;
      const engine = await webllm.CreateMLCEngine(want, {
        appConfig: cfg,
        initProgressCallback: onProgress ? (p) => onProgress({ progress: p.progress, text: p.text, modelId: want }) : undefined,
      });
      loadedModelId = want;
      return engine;
    })();
    return engineP;
  };
  return {
    id: 'webllm', ensure,
    async run({ messages, json, tools, temperature = 0.6, seed, onToken, signal, model }) {
      const engine = await ensure(model);
      const usedModel = loadedModelId; // truthful: what actually loaded, not just what was requested
      const req = { messages, temperature, stream: !!onToken };
      if (seed != null) req.seed = seed;
      if (json) req.response_format = { type: 'json_object' };
      if (tools?.length) req.tools = tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));
      if (onToken) {
        let text = '';
        const stream = await engine.chat.completions.create(req);
        for await (const chunk of stream) { const d = chunk.choices?.[0]?.delta?.content || ''; if (d) { text += d; onToken(d); } if (signal?.aborted) break; }
        return { text, toolCalls: [], model: usedModel };
      }
      const d = await engine.chat.completions.create(req);
      const msg = d.choices?.[0]?.message || {};
      return { text: msg.content || '', toolCalls: (msg.tool_calls || []).map(normalizeToolCall), model: usedModel };
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
    // args.provider/args.model let a caller (e.g. the WS-2 registry-driven
    // intelligence facade) force an exact provider+model chosen by selectModel(),
    // bypassing the legacy tier map without breaking existing task-based callers.
    const providerId = args.provider || r.provider;
    const provider = providers[providerId] || providers.mock;
    const requestedModel = args.model || r.model;
    try {
      const out = await provider.run({ ...args, model: requestedModel });
      // truthful provenance: prefer what the provider says it ACTUALLY used
      // over what we merely requested — never collapse to a generic label.
      return { ...out, provider: provider.id, tier: r.tier, model: out.model || requestedModel || null };
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
    chat: (o) => call(o.task || 'reason', { messages: o.messages, temperature: o.temperature, seed: o.seed, provider: o.provider, model: o.model }),
    chatStream: (o, onToken) => call(o.task || 'brief', { messages: o.messages, temperature: o.temperature, seed: o.seed, onToken, provider: o.provider, model: o.model }),
    async chatJSON(o) {
      const out = await call(o.task || 'storyboard', { messages: o.messages, json: true, schema: o.schema, temperature: o.temperature ?? 0.5, seed: o.seed, provider: o.provider, model: o.model });
      return { ...out, json: extractJSON(out.text) };
    },
    chatTools: (o) => call(o.task || 'orchestrate', { messages: o.messages, tools: o.tools, temperature: o.temperature ?? 0.4, provider: o.provider, model: o.model }),
  };
}
