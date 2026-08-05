// Arganta Energy Agent — runtime. Network + AI-binding calls only; all pure
// logic lives in ../router.js.
//
// Routes:
//   GET  /v1/health              which providers are configured
//   POST /v1/chat/completions    OpenAI-compatible, streaming or not
//
// The system prompt is the grounding guard: the model is told, explicitly, that
// it may not state a petroleum fact of its own. Its ONLY job is to choose a tool.
// The tool runs in the browser against local JSON and produces the card the user
// actually reads. That is why this Worker never needs — and never receives — a
// single field, well or basin record.

import {
  GROQ_URL, asSseChunks, authFailureReason, corsHeaders, errorEnvelope, fromWorkersAi,
  isAuthed, isRetryableStatus, pickProviders, toUpstreamBody, validateChatRequest,
} from '../router.js';

const json = (body, status, headers) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
});

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin');
    const cors = corsHeaders(origin, env);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);

    if (url.pathname === '/v1/health' && request.method === 'GET') {
      const providers = pickProviders(env, { needsTools: true });
      return json({
        ok: providers.length > 0,
        // Names and capabilities only — never whether a key "looks" valid, which
        // would turn this into an oracle for guessing secrets.
        providers: providers.map((p) => ({ name: p.name, model: p.model, toolsCapable: p.toolsCapable })),
        authRequired: !!env.AGENT_TOKEN,
      }, providers.length ? 200 : 503, cors);
    }

    if (url.pathname !== '/v1/chat/completions') {
      return json(errorEnvelope('not found', 404), 404, cors);
    }
    if (request.method !== 'POST') {
      return json(errorEnvelope('method not allowed', 405), 405, cors);
    }
    if (!isAuthed(request, env)) {
      return json(errorEnvelope(authFailureReason(env), 401), 401, cors);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json(errorEnvelope('body is not valid JSON', 400), 400, cors);
    }

    const parsed = validateChatRequest(body);
    if (!parsed.ok) return json(errorEnvelope(parsed.error, parsed.status), parsed.status, cors);
    const chat = parsed.value;

    const providers = pickProviders(env, { needsTools: !!chat.tools });
    if (!providers.length) {
      // 503, not 500: nothing is broken, nothing is configured. The client reads
      // this and falls back to its deterministic grammar with a visible badge.
      return json(errorEnvelope('no LLM provider configured on this Worker', 503), 503, cors);
    }

    const messages = withSystemPrompt(chat.messages);
    let lastError = 'no provider attempted';

    for (const provider of providers) {
      try {
        if (provider.name === 'groq') {
          const upstream = await fetch(GROQ_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${env.GROQ_API_KEY}`,
            },
            body: JSON.stringify(toUpstreamBody({ ...chat, messages }, provider, env)),
            signal: AbortSignal.timeout(45_000),
          });

          if (!upstream.ok) {
            lastError = `groq ${upstream.status}`;
            if (isRetryableStatus(upstream.status)) continue;
            // A non-retryable upstream error (bad key, bad request) still falls
            // through to the next provider — the user gets an answer either way.
            continue;
          }

          if (chat.stream) {
            return new Response(upstream.body, {
              status: 200,
              headers: {
                ...cors,
                'Content-Type': 'text/event-stream; charset=utf-8',
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive',
                'X-Agent-Provider': provider.name,
              },
            });
          }
          const payload = await upstream.json();
          return json(payload, 200, { ...cors, 'X-Agent-Provider': provider.name });
        }

        if (provider.name === 'workers-ai') {
          const input = { messages, max_tokens: Number(env.MAX_TOKENS ?? 1024) || 1024 };
          if (chat.tools) input.tools = chat.tools;
          const result = await env.AI.run(provider.model, input);
          const payload = fromWorkersAi(result, provider.model);
          const providerHeaders = {
            ...cors,
            'X-Agent-Provider': provider.name,
            // Status only—never upstream response text or credentials. This makes
            // an otherwise invisible fallback diagnosable from the client console.
            ...(lastError !== 'no provider attempted' ? { 'X-Agent-Fallback': lastError } : {}),
          };
          if (!chat.stream) return json(payload, 200, providerHeaders);

          // Workers AI is not streamed here — emit the completed text as a
          // single well-formed SSE burst so the client has ONE parser path.
          const text = payload.choices[0].message.content;
          const stream = new ReadableStream({
            start(controller) {
              const encoder = new TextEncoder();
              for (const chunk of asSseChunks(text, provider.model)) controller.enqueue(encoder.encode(chunk));
              controller.close();
            },
          });
          return new Response(stream, {
            status: 200,
            headers: {
              ...cors,
              'Content-Type': 'text/event-stream; charset=utf-8',
              'Cache-Control': 'no-cache',
              ...providerHeaders,
            },
          });
        }
      } catch (error) {
        lastError = `${provider.name}: ${error?.message ?? 'threw'}`;
      }
    }

    return json(errorEnvelope(`all providers failed (${lastError})`, 502), 502, cors);
  },
};

// ── the grounding guard ──────────────────────────────────────────────────────

const SYSTEM_PROMPT = [
  'You are the ArgantaEnergy agent. You route a petroleum geoscientist\'s question to exactly one tool.',
  '',
  'ABSOLUTE RULES:',
  '1. You have NO petroleum knowledge of your own in this conversation. You have never seen the data.',
  '2. NEVER state a fact about a basin, field, well, country or volume. Not a number, not a date, not an operator, not a location. If you catch yourself about to, call a tool instead.',
  '3. Your reply is either a tool call, or one short sentence asking which entity the user means.',
  '4. Do not invent entity names. Pass the user\'s own words through as the query argument and let the tool resolve them — the tool has a spelling-correction and disambiguation ladder, you do not.',
  '5. If no tool fits, say so plainly in one sentence. Do not improvise an answer.',
  '',
  'The tool result is rendered directly to the user as a data card with source badges. You are not summarising it and you must not restate its numbers.',
].join('\n');

/** Prepend the guard, replacing any client-supplied system turn. The client
 *  cannot weaken these rules, and neither can anything in the page. */
function withSystemPrompt(messages) {
  return [{ role: 'system', content: SYSTEM_PROMPT }, ...messages.filter((m) => m.role !== 'system')];
}
