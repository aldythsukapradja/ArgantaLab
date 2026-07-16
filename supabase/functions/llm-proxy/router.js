// ─────────────────────────────────────────────────────────────────────────
// WS-3 · Truthful Provider Gateway — pure routing/pricing/translation logic
// (Sonnet). Deliberately dependency-free (no Deno.env, no fetch) so it can run
// under plain Node for tests; index.ts is the thin Deno wrapper that supplies
// real env + fetch. Mirrors @arganta/ai's costClass taxonomy (0 never reaches
// here — Sovereign stays on-device; this gateway only ever serves 1/2/3).
// ─────────────────────────────────────────────────────────────────────────

// One Anthropic key unlocks three costClass entries (Haiku=Economy,
// Sonnet/Opus=Frontier) — same key, different `model` per call. Gemini/Groq
// have no `pricing` (free-quota Sponsored tier) so their cost is always
// truthfully $0; DeepSeek/Anthropic carry real per-token pricing.
export const PROVIDER_CATALOG = [
  // Tier 1 — Sponsored (free quotas)
  // toolsCapable is an honest per-provider claim, not a proxy — see the
  // needsTools filter below. Gemini/Groq's OpenAI-compat endpoints do real
  // function-calling; Cloudflare's free Llama accepts a `tools` body without
  // erroring but is NOT reliable at it (confirmed live: it invents fake tool
  // names — 'greeting_response', 'generate_text' — that don't exist in the
  // request's own tools array, burning every step of the caller's loop
  // instead of either calling a real tool or answering in plain text). This
  // matches @arganta/ai/registry.js's client-side capabilities.tools:false
  // for cloudflare-llama-free — this flag is the server-side half of that
  // same honest claim, not a new opinion.
  // Groq is listed FIRST of the free Sponsored pool (so it's the default primary
  // when no exact model is requested): its free tier is far more generous and
  // its latency is ~15ms, whereas Gemini's free quota is tiny and 429s quickly
  // (confirmed live 2026-07-16). Both are genuine tool-callers. Gemini stays as
  // the automatic fallback (and vice-versa — pickCandidates keeps both).
  { name: 'groq', costClass: 1, shape: 'openai-compat', toolsCapable: true, envKey: 'GROQ_API_KEY', url: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile', pricing: null },
  // Same Groq key, the lighter 8B-Instant model — it has its OWN, much larger
  // free-tier daily token budget (~500k TPD vs the 70B's 100k), so it's the
  // fallback that keeps the chat alive after the 70B's daily tokens are spent
  // (confirmed live 2026-07-16: heavy testing exhausts 70B fast; each chat turn
  // ships ~3.5k tokens of tool schemas). Also a real tool-caller.
  { name: 'groq-8b', costClass: 1, shape: 'openai-compat', toolsCapable: true, envKey: 'GROQ_API_KEY', url: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.1-8b-instant', pricing: null },
  // model is `gemini-flash-latest` (a rolling Google alias to the current free
  // Flash), NOT the pinned `gemini-2.0-flash` — verified live 2026-07-15 that
  // this project's key returns HTTP 429 `free_tier_requests limit: 0` for
  // gemini-2.0-flash (that pin has no free quota here) while gemini-flash-latest
  // returns 200 and does real function-calling. The alias tracks whichever Flash
  // Google currently grants free quota, so it's more robust than a pin for a
  // free-tier Sponsored provider.
  { name: 'gemini', costClass: 1, shape: 'openai-compat', toolsCapable: true, envKey: 'GEMINI_API_KEY', url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', model: 'gemini-flash-latest', pricing: null },
  // Cloudflare Workers AI — account-scoped URL (no static `url`; resolveUrl()
  // builds it from CF_ACCOUNT_ID at call time). Same secrets media-proxy
  // already uses (project-level, shared across Edge Functions). Llama 3.1 8B
  // supports OpenAI-compat JSON Mode incl. json_schema — verified against
  // Cloudflare's docs, not assumed, since this router only ever claims real
  // capabilities. toolsCapable is deliberately absent/false (see above).
  { name: 'cloudflare-llama', costClass: 1, shape: 'openai-compat', toolsCapable: false, envKey: 'CF_API_TOKEN', accountEnvKey: 'CF_ACCOUNT_ID', url: null, model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', pricing: null },
  // Tier 2 — Economy (cheap paid)
  { name: 'deepseek', costClass: 2, shape: 'openai-compat', toolsCapable: false, envKey: 'DEEPSEEK_API_KEY', url: 'https://api.deepseek.com/chat/completions', model: 'deepseek-chat', pricing: { inputUsdPerMillion: 0.14, outputUsdPerMillion: 0.28 } },
  { name: 'anthropic-haiku', costClass: 2, shape: 'anthropic', envKey: 'ANTHROPIC_API_KEY', url: 'https://api.anthropic.com/v1/messages', model: 'claude-haiku-4-5', pricing: { inputUsdPerMillion: 1, outputUsdPerMillion: 5 } },
  // Tier 3 — Frontier (premium reasoning)
  { name: 'anthropic-sonnet', costClass: 3, shape: 'anthropic', envKey: 'ANTHROPIC_API_KEY', url: 'https://api.anthropic.com/v1/messages', model: 'claude-sonnet-5', pricing: { inputUsdPerMillion: 3, outputUsdPerMillion: 15 } },
  { name: 'anthropic-opus', costClass: 3, shape: 'anthropic', envKey: 'ANTHROPIC_API_KEY', url: 'https://api.anthropic.com/v1/messages', model: 'claude-opus-4-8', pricing: { inputUsdPerMillion: 15, outputUsdPerMillion: 75 } },
];

/** @param {object} entry @param {Record<string,unknown>} available  env-key presence map */
export const isAvailable = (entry, available) => !!available[entry.envKey] && (!entry.accountEnvKey || !!available[entry.accountEnvKey]);

/** Resolve the real fetch URL for an entry. Static `url` wins; account-scoped
 * entries (Cloudflare) build the URL from their account id at call time. */
export function resolveUrl(entry, accountId) {
  if (entry.url) return entry.url;
  if (entry.accountEnvKey) return `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`;
  return null;
}

/**
 * Candidate providers for this request, cheapest first.
 *   - `force` (exact provider NAME) wins outright.
 *   - `model` (exact upstream MODEL id, e.g. 'claude-sonnet-5') is honored when
 *     available — the client already made an informed choice via @arganta/ai's
 *     selectModel(), so the gateway resolves which catalog entry serves that
 *     specific model rather than re-deriving a tier pick independently. Falls
 *     through to cost-based selection if the requested model isn't available
 *     (e.g. its key isn't set) — the caller still gets an answer, just not
 *     the exact model it asked for (recorded truthfully either way).
 *   - `costClass` narrows to one tier; `needsTools` excludes anthropic-shape
 *     entries (tool-call translation isn't implemented yet — see
 *     fromAnthropicResponse) AND any entry not marked `toolsCapable` (an
 *     honest per-provider claim, not a shape proxy — Cloudflare's free Llama
 *     accepts a `tools` body without erroring but hallucinates fake tool
 *     names instead of calling a real one or answering in text; excluding it
 *     from tool-requiring requests means an unconfigured Gemini/Groq key
 *     correctly falls through to "no usable key" rather than a model that
 *     technically responds but can't be trusted with tools). Never returns
 *     more than 2 (bounded in-request fallback — no persistent health/
 *     circuit-breaker state yet).
 * @param {Record<string,unknown>} available
 * @param {{force?:string, model?:string, costClass?:number, needsTools?:boolean}} [opts]
 */
// Bounded in-request fallback depth. 3 (not 2) so a chosen model can fall
// through TWO exhausted free tiers to a third — e.g. Gemini (daily requests
// spent) → Groq 70B (daily tokens spent) → Groq 8B (its own larger budget) —
// which is exactly the multi-provider exhaustion a heavy free-tier day hits.
const MAX_CANDIDATES = 3;

export function pickCandidates(available, opts = {}) {
  let pool = PROVIDER_CATALOG.filter((e) => isAvailable(e, available));
  // needsTools applies BEFORE force/model resolve, not after — an anthropic-
  // shape entry can never legally serve a tool-calling request (no tool_use
  // translation exists), so it must be excluded from the pool those exact-match
  // branches search too. Skipping this for exact-model requests was a real bug:
  // a client-driven selectModel() model id would bypass the exclusion entirely
  // and Claude Haiku/Sonnet/Opus would silently receive a tools-array it can't
  // honor — the model then hallucinates fake tool-call-shaped text instead of
  // erroring, a truthfulness violation this router exists to prevent.
  if (opts.needsTools) pool = pool.filter((e) => e.shape !== 'anthropic' && e.toolsCapable);
  if (opts.force) {
    const forced = pool.find((e) => e.name === opts.force);
    return forced ? [forced] : [];
  }
  if (opts.model) {
    const byModel = pool.find((e) => e.model === opts.model);
    if (byModel) {
      // Honor the requested model FIRST, but KEEP the other same-pool providers
      // as fallbacks — otherwise a transient failure on the pinned model (e.g.
      // Gemini 429 when its tiny free quota is spent) dead-ends at 502→mock
      // ("no live model") instead of falling through to another provider.
      // `force` (not `model`) is the way to demand exactly one with no fallback.
      const rest = pool.filter((e) => e !== byModel).sort((a, b) => a.costClass - b.costClass);
      return [byModel, ...rest].slice(0, MAX_CANDIDATES);
    }
  }
  if (opts.costClass != null) pool = pool.filter((e) => e.costClass === opts.costClass);
  return [...pool].sort((a, b) => a.costClass - b.costClass).slice(0, MAX_CANDIDATES);
}

export const priceUsd = (entry, inputTokens = 0, outputTokens = 0) =>
  entry.pricing ? (inputTokens / 1e6) * entry.pricing.inputUsdPerMillion + (outputTokens / 1e6) * entry.pricing.outputUsdPerMillion : 0;

// A caller may hand us tools already in OpenAI "provider-shaped" form
// ({type:'function', function:{name,description,parameters}}) — that's exactly
// what @arganta/agent's toOpenAITools() produces and the agent loop's documented
// contract passes through — OR flat ({name,description,parameters}). Normalize to
// the flat inner fields so we can re-emit the canonical wrapped shape without
// double-wrapping (a pre-wrapped tool has no top-level `.name`, which used to
// produce function declarations with an empty name — Gemini 400s on that,
// Cloudflare silently hallucinated a fake name instead; both were this bug).
const toolFields = (t) => (t && t.function ? t.function : t) || {};

// ── OpenAI-compatible shape (Gemini/Groq/DeepSeek) ──────────────────────────
export function toOpenAICompatBody({ messages, model, temperature = 0.6, seed, json, schema, tools }) {
  const body = { model, messages, temperature, stream: false };
  if (seed != null) body.seed = seed;
  if (json) body.response_format = schema ? { type: 'json_schema', json_schema: { name: 'out', schema } } : { type: 'json_object' };
  if (tools?.length) { body.tools = tools.map((t) => { const f = toolFields(t); return { type: 'function', function: { name: f.name, description: f.description, parameters: f.parameters } }; }); body.tool_choice = 'auto'; }
  return body;
}
export function fromOpenAICompatResponse(d) {
  const msg = d.choices?.[0]?.message || {};
  const toolCalls = (msg.tool_calls || []).map((tc) => { try { return { id: tc.id, name: tc.function?.name, args: JSON.parse(tc.function?.arguments || '{}') }; } catch { return { id: tc.id, name: tc.function?.name, args: {} }; } });
  // Most OpenAI-compat providers (Gemini, Groq, DeepSeek) echo `content` as a
  // JSON-formatted STRING even in JSON mode, per the OpenAI spec. Cloudflare's
  // Workers AI JSON Mode instead returns an already-parsed object — normalize
  // it back to a string here so every downstream consumer (extractJSON, etc.)
  // can treat `text` uniformly regardless of provider quirks.
  const content = msg.content ?? '';
  const text = typeof content === 'string' ? content : JSON.stringify(content);
  return { text, toolCalls, inputTokens: d.usage?.prompt_tokens ?? 0, outputTokens: d.usage?.completion_tokens ?? 0 };
}

// ── Anthropic Messages API shape (structurally different from OpenAI) ──────
// system is a top-level field, not a message role; JSON mode has no native
// response_format, so a prefill trick (open the assistant turn with "{") is
// used instead — text/json only, no tool-call translation yet (excluded from
// candidates via `needsTools` above).
export function toAnthropicBody({ messages, model, temperature = 0.6, json, maxTokens = 2048 }) {
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n') || undefined;
  const rest = messages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));
  const body = { model, max_tokens: maxTokens, temperature, messages: json ? [...rest, { role: 'assistant', content: '{' }] : rest };
  if (system) body.system = system;
  return body;
}
export function fromAnthropicResponse(d, wasJsonPrefilled) {
  const text = (d.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
  return { text: wasJsonPrefilled ? '{' + text : text, toolCalls: [], inputTokens: d.usage?.input_tokens ?? 0, outputTokens: d.usage?.output_tokens ?? 0 };
}

/** True HTTP outcomes worth trying the next candidate for (rate limit / server error). */
export const isRetryableStatus = (status) => status === 429 || status >= 500;
