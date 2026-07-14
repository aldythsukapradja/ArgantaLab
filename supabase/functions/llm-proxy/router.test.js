import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pickCandidates, priceUsd, toOpenAICompatBody, fromOpenAICompatResponse,
  toAnthropicBody, fromAnthropicResponse, isRetryableStatus, PROVIDER_CATALOG,
} from './router.js';

test('no keys set → no candidates (degrades to mock upstream, never throws)', () => {
  assert.deepEqual(pickCandidates({}), []);
});

test('cheapest tier wins by default: Sponsored before Economy before Frontier', () => {
  const available = { GEMINI_API_KEY: 'x', DEEPSEEK_API_KEY: 'y', ANTHROPIC_API_KEY: 'z' };
  const cands = pickCandidates(available);
  assert.equal(cands[0].costClass, 1); // gemini/groq
  assert.ok(cands.every((c, i) => i === 0 || c.costClass >= cands[i - 1].costClass));
});

test('force picks the exact provider regardless of cost, or empty if unavailable', () => {
  const available = { GEMINI_API_KEY: 'x', ANTHROPIC_API_KEY: 'z' };
  assert.equal(pickCandidates(available, { force: 'anthropic-sonnet' })[0].name, 'anthropic-sonnet');
  assert.deepEqual(pickCandidates(available, { force: 'deepseek' }), []); // no DEEPSEEK_API_KEY
});

test('an exact model request (from selectModel picking a specific ModelSpec) is honored over cost-based selection', () => {
  const available = { GEMINI_API_KEY: 'x', ANTHROPIC_API_KEY: 'z' };
  const cands = pickCandidates(available, { model: 'claude-opus-4-8' });
  assert.equal(cands.length, 1);
  assert.equal(cands[0].name, 'anthropic-opus');
});

test('an exact model request that is unavailable falls through to cost-based selection instead of failing', () => {
  const available = { GEMINI_API_KEY: 'x' }; // no ANTHROPIC_API_KEY
  const cands = pickCandidates(available, { model: 'claude-opus-4-8' });
  assert.ok(cands.length > 0);
  assert.equal(cands[0].name, 'gemini'); // the only thing actually available
});

test('costClass filter narrows to exactly that tier', () => {
  const available = { GEMINI_API_KEY: 'x', DEEPSEEK_API_KEY: 'y', ANTHROPIC_API_KEY: 'z' };
  const frontier = pickCandidates(available, { costClass: 3 });
  assert.ok(frontier.length > 0 && frontier.every((c) => c.costClass === 3));
});

test('needsTools excludes anthropic-shape candidates (tool translation not implemented)', () => {
  const available = { ANTHROPIC_API_KEY: 'z' };
  assert.deepEqual(pickCandidates(available, { needsTools: true, force: undefined }), []);
  assert.equal(pickCandidates(available, { needsTools: false }).length > 0, true);
});

test('never returns more than 2 candidates (bounded in-request fallback)', () => {
  const allKeys = Object.fromEntries(PROVIDER_CATALOG.map((e) => [e.envKey, 'x']));
  assert.ok(pickCandidates(allKeys).length <= 2);
});

test('free-tier providers (no pricing) always truthfully cost $0', () => {
  const gemini = PROVIDER_CATALOG.find((e) => e.name === 'gemini');
  assert.equal(priceUsd(gemini, 1_000_000, 1_000_000), 0);
});

test('priced providers compute real per-token cost', () => {
  const deepseek = PROVIDER_CATALOG.find((e) => e.name === 'deepseek');
  const cost = priceUsd(deepseek, 1_000_000, 1_000_000);
  assert.ok(Math.abs(cost - 0.42) < 1e-9); // 0.14 in + 0.28 out per the catalog
});

test('OpenAI-compat round trip extracts text + real token usage', () => {
  const body = toOpenAICompatBody({ messages: [{ role: 'user', content: 'hi' }], model: 'x', json: true, schema: { type: 'object' } });
  assert.equal(body.response_format.type, 'json_schema');
  const out = fromOpenAICompatResponse({ choices: [{ message: { content: 'hello' } }], usage: { prompt_tokens: 10, completion_tokens: 5 } });
  assert.equal(out.text, 'hello');
  assert.equal(out.inputTokens, 10);
  assert.equal(out.outputTokens, 5);
});

test('Anthropic system message is lifted out of the array into a top-level field', () => {
  const body = toAnthropicBody({ messages: [{ role: 'system', content: 'be terse' }, { role: 'user', content: 'hi' }], model: 'x' });
  assert.equal(body.system, 'be terse');
  assert.equal(body.messages.length, 1);
  assert.equal(body.messages[0].role, 'user');
});

test('Anthropic JSON mode uses the assistant-prefill trick, and the response reattaches the opening brace', () => {
  const body = toAnthropicBody({ messages: [{ role: 'user', content: 'give me json' }], model: 'x', json: true });
  assert.equal(body.messages.at(-1).content, '{');
  const out = fromAnthropicResponse({ content: [{ type: 'text', text: '"a":1}' }], usage: { input_tokens: 3, output_tokens: 2 } }, true);
  assert.equal(out.text, '{"a":1}');
  assert.equal(JSON.parse(out.text).a, 1);
});

test('retryable status classification: 429 and 5xx move to the next candidate, 4xx does not', () => {
  assert.equal(isRetryableStatus(429), true);
  assert.equal(isRetryableStatus(500), true);
  assert.equal(isRetryableStatus(503), true);
  assert.equal(isRetryableStatus(401), false);
  assert.equal(isRetryableStatus(400), false);
});
