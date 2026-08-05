// Pure-logic tests for the energy agent Worker. `node --test test/*.test.js`.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_MESSAGES, allowedOrigins, asSseChunks, authFailureReason, corsHeaders, errorEnvelope,
  fromWorkersAi, isAuthed, isLocalhostOrigin, isRetryableStatus, isTrustedOrigin,
  pickProviders, toUpstreamBody, validateChatRequest,
} from '../router.js';

const req = (headers = {}) => ({ headers: { get: (k) => headers[k] ?? headers[k.toLowerCase()] ?? null } });

// ── CORS ─────────────────────────────────────────────────────────────────────
test('localhost is trusted at any port', () => {
  assert.ok(isLocalhostOrigin('http://localhost:5173'));
  assert.ok(isLocalhostOrigin('http://localhost:61234'));
  assert.ok(isLocalhostOrigin('http://127.0.0.1:4173'));
  assert.ok(!isLocalhostOrigin('https://evil.com'));
});

test('arganta, vercel and pages subdomains are trusted', () => {
  assert.ok(isTrustedOrigin('https://energy.arganta.app'));
  assert.ok(isTrustedOrigin('https://arganta.app'));
  assert.ok(isTrustedOrigin('https://preview-abc.vercel.app'));
  assert.ok(isTrustedOrigin('https://thing.pages.dev'));
});

test('lookalike domains are NOT trusted', () => {
  assert.ok(!isTrustedOrigin('https://arganta.app.evil.com'));
  assert.ok(!isTrustedOrigin('https://notarganta.app.co'));
  assert.ok(!isTrustedOrigin('http://arganta.app'), 'plain http must not pass');
});

test('an untrusted origin gets null, never a wildcard', () => {
  const headers = corsHeaders('https://evil.com', {});
  assert.equal(headers['Access-Control-Allow-Origin'], 'null');
  assert.notEqual(headers['Access-Control-Allow-Origin'], '*');
  assert.equal(headers.Vary, 'Origin');
});

test('ALLOWED_ORIGINS falls back to known origins when unset', () => {
  assert.ok(allowedOrigins({}).includes('https://energy.arganta.app'));
  assert.deepEqual(allowedOrigins({ ALLOWED_ORIGINS: 'https://a.com, https://b.com' }), ['https://a.com', 'https://b.com']);
});

// ── auth ─────────────────────────────────────────────────────────────────────
// The Worker holds a provider key and an AI binding. An unconfigured deploy must
// refuse everyone, not welcome everyone.
test('auth FAILS CLOSED when no token is configured', () => {
  assert.ok(!isAuthed(req(), {}));
  assert.ok(!isAuthed(req({ Authorization: 'Bearer anything' }), {}));
});

test('an unconfigured Worker says so, instead of a bare refusal', () => {
  assert.match(authFailureReason({}), /wrangler secret put AGENT_TOKEN/);
  assert.equal(authFailureReason({ AGENT_TOKEN: 'x' }), 'not authorized');
});

test('a configured token is enforced exactly', () => {
  const env = { AGENT_TOKEN: 'sekret' };
  assert.ok(isAuthed(req({ Authorization: 'Bearer sekret' }), env));
  assert.ok(!isAuthed(req({ Authorization: 'Bearer wrong' }), env));
  assert.ok(!isAuthed(req({ Authorization: 'sekret' }), env));
  assert.ok(!isAuthed(req(), env));
});

// ── validation ───────────────────────────────────────────────────────────────
test('a well-formed request is accepted and normalised', () => {
  const out = validateChatRequest({ messages: [{ role: 'user', content: 'kutei basin' }] });
  assert.ok(out.ok);
  assert.equal(out.value.stream, false);
  assert.equal(out.value.temperature, 0, 'routing is a deterministic task — default temp 0');
  assert.equal(out.value.tools, null);
});

test('malformed bodies are rejected, never forwarded', () => {
  for (const body of [null, 'nope', {}, { messages: [] }, { messages: 'x' }]) {
    assert.ok(!validateChatRequest(body).ok, JSON.stringify(body));
  }
});

test('unknown roles are rejected', () => {
  assert.ok(!validateChatRequest({ messages: [{ role: 'root', content: 'x' }] }).ok);
});

test('a tool message must carry its tool_call_id', () => {
  assert.ok(!validateChatRequest({ messages: [{ role: 'tool', content: '{}' }] }).ok);
  assert.ok(validateChatRequest({ messages: [{ role: 'tool', content: '{}', tool_call_id: 'call_1' }] }).ok);
});

test('an assistant turn may be empty when it only made tool calls', () => {
  assert.ok(validateChatRequest({ messages: [{ role: 'assistant', content: '', tool_calls: [] }] }).ok);
  assert.ok(!validateChatRequest({ messages: [{ role: 'user', content: '' }] }).ok);
});

test('oversized conversations are refused', () => {
  const many = Array.from({ length: MAX_MESSAGES + 1 }, () => ({ role: 'user', content: 'x' }));
  assert.ok(!validateChatRequest({ messages: many }).ok);
  assert.ok(!validateChatRequest({ messages: [{ role: 'user', content: 'x'.repeat(25000) }] }).ok);
});

test('tools must be OpenAI function specs', () => {
  const messages = [{ role: 'user', content: 'hi' }];
  assert.ok(!validateChatRequest({ messages, tools: 'x' }).ok);
  assert.ok(!validateChatRequest({ messages, tools: [{ type: 'magic' }] }).ok);
  assert.ok(validateChatRequest({ messages, tools: [{ type: 'function', function: { name: 'basin_dossier' } }] }).ok);
});

test('tool_choice defaults to auto only when tools are present', () => {
  const messages = [{ role: 'user', content: 'hi' }];
  assert.equal(validateChatRequest({ messages }).value.toolChoice, undefined);
  assert.equal(validateChatRequest({ messages, tools: [{ type: 'function', function: { name: 'x' } }] }).value.toolChoice, 'auto');
});

test('temperature is range-checked', () => {
  const messages = [{ role: 'user', content: 'hi' }];
  assert.ok(!validateChatRequest({ messages, temperature: 9 }).ok);
  assert.ok(!validateChatRequest({ messages, temperature: -1 }).ok);
  assert.equal(validateChatRequest({ messages, temperature: 0.4 }).value.temperature, 0.4);
});

// ── provider selection ───────────────────────────────────────────────────────
test('no configuration means no providers', () => {
  assert.deepEqual(pickProviders({}), []);
});

test('groq leads when its key is set, because it is the tool-capable one', () => {
  const providers = pickProviders({ GROQ_API_KEY: 'k', AI: {} }, { needsTools: true });
  assert.equal(providers[0].name, 'groq');
  assert.equal(providers[0].toolsCapable, true);
  assert.equal(providers[1].name, 'workers-ai');
});

test('Workers AI alone is still offered — a text answer beats no answer', () => {
  const providers = pickProviders({ AI: {} }, { needsTools: true });
  assert.equal(providers.length, 1);
  assert.equal(providers[0].name, 'workers-ai');
});

test('models are overridable without a code change', () => {
  const providers = pickProviders({ GROQ_API_KEY: 'k', GROQ_MODEL: 'llama-3.1-8b-instant' });
  assert.equal(providers[0].model, 'llama-3.1-8b-instant');
});

test('429 and 5xx retry; 4xx do not', () => {
  assert.ok(isRetryableStatus(429));
  assert.ok(isRetryableStatus(503));
  assert.ok(!isRetryableStatus(400));
  assert.ok(!isRetryableStatus(401));
});

// ── upstream body ────────────────────────────────────────────────────────────
test('tools are only forwarded to a tool-capable provider', () => {
  const chat = { messages: [{ role: 'user', content: 'x' }], tools: [{ type: 'function', function: { name: 'f' } }], toolChoice: 'auto', temperature: 0, stream: false };
  const groq = toUpstreamBody(chat, { model: 'm', toolsCapable: true }, {});
  assert.ok(groq.tools);
  assert.equal(groq.tool_choice, 'auto');
  const cf = toUpstreamBody(chat, { model: 'm', toolsCapable: false }, {});
  assert.equal(cf.tools, undefined);
});

test('MAX_TOKENS is honoured and has a sane default', () => {
  const chat = { messages: [], temperature: 0, stream: false, tools: null };
  assert.equal(toUpstreamBody(chat, { model: 'm' }, {}).max_tokens, 1024);
  assert.equal(toUpstreamBody(chat, { model: 'm' }, { MAX_TOKENS: '256' }).max_tokens, 256);
  assert.equal(toUpstreamBody(chat, { model: 'm' }, { MAX_TOKENS: 'junk' }).max_tokens, 1024);
});

// ── Workers AI normalisation ─────────────────────────────────────────────────
test('a Workers AI text reply becomes an OpenAI choice', () => {
  const out = fromWorkersAi({ response: 'hello' }, 'cf-model');
  assert.equal(out.choices[0].message.content, 'hello');
  assert.equal(out.choices[0].finish_reason, 'stop');
});

test('Workers AI tool calls are normalised to the OpenAI shape', () => {
  const out = fromWorkersAi({ response: '', tool_calls: [{ name: 'basin_dossier', arguments: { query: 'kutei' } }] }, 'cf');
  const call = out.choices[0].message.tool_calls[0];
  assert.equal(call.type, 'function');
  assert.equal(call.function.name, 'basin_dossier');
  assert.equal(typeof call.function.arguments, 'string', 'arguments must be a JSON STRING, as OpenAI specifies');
  assert.deepEqual(JSON.parse(call.function.arguments), { query: 'kutei' });
  assert.equal(out.choices[0].finish_reason, 'tool_calls');
});

test('a bare string reply is handled', () => {
  assert.equal(fromWorkersAi('plain', 'cf').choices[0].message.content, 'plain');
});

// ── SSE shim ─────────────────────────────────────────────────────────────────
test('a non-streaming provider is wrapped as valid SSE so the client has one parser', () => {
  const chunks = asSseChunks('hi', 'cf');
  assert.ok(chunks.every((c) => c.startsWith('data: ')));
  assert.equal(chunks.at(-1), 'data: [DONE]\n\n');
  const first = JSON.parse(chunks[0].slice(6));
  assert.equal(first.choices[0].delta.content, 'hi');
  assert.equal(first.object, 'chat.completion.chunk');
  assert.equal(JSON.parse(chunks[1].slice(6)).choices[0].finish_reason, 'stop');
});

// ── errors ───────────────────────────────────────────────────────────────────
test('error envelopes are uniform', () => {
  const e = errorEnvelope('boom', 502);
  assert.equal(e.error.message, 'boom');
  assert.equal(e.error.code, 502);
  assert.equal(e.error.type, 'upstream_error');
  assert.equal(errorEnvelope('bad', 400).error.type, 'invalid_request');
});
