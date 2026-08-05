// Arganta Energy Agent — pure request logic (plain-Node testable).
//
// CORS, auth, request validation, provider selection and the error envelope live
// here so `node --test test/router.test.js` can exercise them without a runtime.
// All network and AI-binding calls live in src/index.js. Same split as
// arganta-core-content and build-artifact-runtime: router.js pure, index.js runtime.

// ── CORS ─────────────────────────────────────────────────────────────────────
// Lifted verbatim from workers/arganta-core-content/router.js. The real security
// boundary is the AGENT_TOKEN bearer; CORS only gates browser origins.

const DEFAULT_ORIGINS = [
  'https://energy.arganta.app',
  'http://localhost:5173',
  'http://localhost:4173',
];

export function allowedOrigins(env) {
  const raw = (env && env.ALLOWED_ORIGINS) || '';
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return list.length ? list : DEFAULT_ORIGINS;
}

export function isLocalhostOrigin(origin) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin || '');
}

export function isTrustedOrigin(origin) {
  return isLocalhostOrigin(origin)
    || /^https:\/\/([a-z0-9-]+\.)*arganta\.app$/i.test(origin || '')
    || /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin || '')
    || /^https:\/\/[a-z0-9-]+\.pages\.dev$/i.test(origin || '');
}

export function corsHeaders(origin, env) {
  const ok = origin && (isTrustedOrigin(origin) || allowedOrigins(env).includes(origin));
  return {
    'Access-Control-Allow-Origin': ok ? origin : 'null',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

/**
 * True when the request carries the shared bearer.
 *
 * FAILS CLOSED. An unset AGENT_TOKEN denies everything rather than waving
 * everyone through — this Worker holds a provider key and an AI binding, so an
 * unconfigured deploy that answered anonymously would be an open invitation to
 * spend someone else's quota. `wrangler dev` stays frictionless via `.dev.vars`
 * (see .dev.vars.example), which is the standard local-secret mechanism.
 */
export function isAuthed(request, env) {
  // Secret values supplied non-interactively on Windows can retain a terminal
  // newline. Treat surrounding transport whitespace as encoding noise while
  // preserving an exact comparison for the token itself.
  const token = typeof (env && env.AGENT_TOKEN) === 'string' ? env.AGENT_TOKEN.trim() : '';
  if (!token) return false;
  const header = request.headers.get('Authorization') || '';
  const m = header.match(/^Bearer\s+(.+)$/i);
  return !!m && m[1] === token;
}

/** Distinguishes "you sent the wrong token" from "this Worker has no token yet",
 *  so a fresh deploy tells the operator what to do instead of just refusing. */
export function authFailureReason(env) {
  return env && env.AGENT_TOKEN
    ? 'not authorized'
    : 'this Worker has no AGENT_TOKEN configured yet — run `wrangler secret put AGENT_TOKEN`';
}

// ── request validation ───────────────────────────────────────────────────────

export const MAX_MESSAGES = 40;
export const MAX_CHARS = 24000;
export const MAX_TOOLS = 64;

/**
 * Validate an OpenAI-shaped chat request. Returns { ok: true, value } or
 * { ok: false, status, error }. Deliberately strict: this Worker holds a
 * provider key, so a malformed body is rejected rather than forwarded.
 */
export function validateChatRequest(body) {
  if (!body || typeof body !== 'object') return bad('body must be a JSON object');
  const { messages, tools, stream, temperature, tool_choice: toolChoice } = body;

  if (!Array.isArray(messages) || messages.length === 0) return bad('messages must be a non-empty array');
  if (messages.length > MAX_MESSAGES) return bad(`messages must not exceed ${MAX_MESSAGES} entries`);

  let chars = 0;
  for (const message of messages) {
    if (!message || typeof message !== 'object') return bad('each message must be an object');
    const role = message.role;
    if (!['system', 'user', 'assistant', 'tool'].includes(role)) return bad(`unknown role "${role}"`);
    if (role === 'tool' && !message.tool_call_id) return bad('tool messages need tool_call_id');
    const content = typeof message.content === 'string' ? message.content : '';
    chars += content.length;
    // An assistant turn may legitimately carry no content when it only made tool calls.
    if (!content && role !== 'assistant') return bad(`empty content on a ${role} message`);
  }
  if (chars > MAX_CHARS) return bad(`conversation exceeds ${MAX_CHARS} characters`);

  if (tools !== undefined) {
    if (!Array.isArray(tools)) return bad('tools must be an array');
    if (tools.length > MAX_TOOLS) return bad(`tools must not exceed ${MAX_TOOLS} entries`);
    for (const tool of tools) {
      if (!tool || tool.type !== 'function' || !tool.function?.name) return bad('each tool must be {type:"function",function:{name}}');
    }
  }
  if (temperature !== undefined && (typeof temperature !== 'number' || temperature < 0 || temperature > 2)) {
    return bad('temperature must be a number between 0 and 2');
  }

  return {
    ok: true,
    value: {
      messages,
      tools: tools ?? null,
      toolChoice: toolChoice ?? (tools ? 'auto' : undefined),
      stream: stream === true,
      temperature: typeof temperature === 'number' ? temperature : 0,
    },
  };
}

function bad(error, status = 400) { return { ok: false, status, error }; }

/** One error shape for every failure path, so the client never has to guess. */
export function errorEnvelope(message, status, extra = {}) {
  return {
    error: { message, type: status >= 500 ? 'upstream_error' : 'invalid_request', code: status },
    ...extra,
  };
}

// ── provider selection ───────────────────────────────────────────────────────

/**
 * Cheapest-capable-first, mirroring the llm-proxy catalogue's ordering.
 *
 * groq is listed first because it is free-tier AND tool-capable — the deciding
 * property here, since an agent that cannot call a tool is useless. Workers AI
 * is the always-available fallback; its tool support is weaker, so a turn that
 * needs tools and lands there may come back without a tool call, at which point
 * the client falls back to its own deterministic grammar rather than guessing.
 */
export function pickProviders(env, { needsTools = false } = {}) {
  const out = [];
  if (env && env.GROQ_API_KEY) {
    out.push({ name: 'groq', model: (env.GROQ_MODEL || 'llama-3.3-70b-versatile'), toolsCapable: true });
  }
  if (env && env.AI) {
    out.push({ name: 'workers-ai', model: (env.CF_MODEL || '@cf/meta/llama-3.1-8b-instruct-fp8'), toolsCapable: false });
  }
  // Never drop the only provider just because tools are weak there — a text
  // answer plus a client-side fallback beats no answer at all.
  if (needsTools && out.some((p) => p.toolsCapable)) {
    return [...out.filter((p) => p.toolsCapable), ...out.filter((p) => !p.toolsCapable)];
  }
  return out;
}

export const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

/** Build the upstream body for an OpenAI-compatible provider. */
export function toUpstreamBody(request, provider, env) {
  const body = {
    model: provider.model,
    messages: request.messages,
    temperature: request.temperature,
    max_tokens: Number(env?.MAX_TOKENS ?? 1024) || 1024,
    stream: request.stream,
  };
  if (request.tools && provider.toolsCapable) {
    body.tools = request.tools;
    body.tool_choice = request.toolChoice;
  }
  return body;
}

export function isRetryableStatus(status) {
  return status === 429 || status >= 500;
}

/** Normalise a Workers AI response into the OpenAI choice shape. */
export function fromWorkersAi(result, model) {
  const text = typeof result === 'string' ? result : (result?.response ?? '');
  const toolCalls = Array.isArray(result?.tool_calls)
    ? result.tool_calls.map((call, i) => ({
      id: call.id || `call_${i}`,
      type: 'function',
      function: {
        name: call.name ?? call.function?.name,
        arguments: typeof call.arguments === 'string' ? call.arguments : JSON.stringify(call.arguments ?? call.function?.arguments ?? {}),
      },
    }))
    : [];
  return {
    id: 'energy-agent',
    object: 'chat.completion',
    model,
    choices: [{
      index: 0,
      message: { role: 'assistant', content: text, ...(toolCalls.length ? { tool_calls: toolCalls } : {}) },
      finish_reason: toolCalls.length ? 'tool_calls' : 'stop',
    }],
  };
}

/** Wrap a plain string as a single SSE completion, for providers that cannot stream. */
export function asSseChunks(text, model) {
  const chunk = (delta, finish = null) => `data: ${JSON.stringify({
    id: 'energy-agent', object: 'chat.completion.chunk', model,
    choices: [{ index: 0, delta, finish_reason: finish }],
  })}\n\n`;
  return [chunk({ role: 'assistant', content: text }), chunk({}, 'stop'), 'data: [DONE]\n\n'];
}
