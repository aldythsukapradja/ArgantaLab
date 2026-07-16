import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pickCandidates, priceUsd, toOpenAICompatBody, fromOpenAICompatResponse,
  toAnthropicBody, fromAnthropicResponse, isRetryableStatus, resolveUrl, PROVIDER_CATALOG,
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

test('an exact model request (from selectModel picking a specific ModelSpec) is honored FIRST but keeps a fallback', () => {
  const available = { GEMINI_API_KEY: 'x', ANTHROPIC_API_KEY: 'z' };
  const cands = pickCandidates(available, { model: 'claude-opus-4-8' });
  assert.equal(cands[0].name, 'anthropic-opus'); // requested model wins first slot
  assert.ok(cands.length >= 1 && cands.length <= 2); // but a same-pool fallback may ride along
});

test('an exact model request keeps a real fallback so a 429 on the pinned model degrades to the other provider, not to mock (the Gemini-quota-exhausted case)', () => {
  const available = { GEMINI_API_KEY: 'x', GROQ_API_KEY: 'y' };
  const cands = pickCandidates(available, { model: 'gemini-flash-latest', needsTools: true });
  assert.equal(cands.length, 2);
  assert.equal(cands[0].name, 'gemini'); // requested first
  assert.equal(cands[1].name, 'groq');   // fallback present — this is what was missing
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

test('needsTools excludes anthropic-shape candidates even for an EXACT model/force request (regression: a client-driven selectModel() model id must not bypass the exclusion — Claude has no tool_use translation and would silently hallucinate fake tool calls instead of erroring)', () => {
  const available = { ANTHROPIC_API_KEY: 'z', GEMINI_API_KEY: 'x' };
  // exact MODEL request for an anthropic-shape model, tools required: falls
  // through to cost-based selection among the tools-capable pool (same honest-
  // degrade behavior as "exact model unavailable"), never silently uses Claude.
  const byModel = pickCandidates(available, { model: 'claude-haiku-4-5', needsTools: true });
  assert.equal(byModel.length, 1);
  assert.equal(byModel[0].name, 'gemini');
  // exact provider FORCE for an anthropic-shape entry, tools required: force
  // has no fallback path, so this must come back empty, not silently ignore needsTools.
  assert.deepEqual(pickCandidates(available, { force: 'anthropic-haiku', needsTools: true }), []);
  // without needsTools, both exact-match paths still work exactly as before
  assert.equal(pickCandidates(available, { model: 'claude-haiku-4-5' })[0].name, 'anthropic-haiku');
  assert.equal(pickCandidates(available, { force: 'anthropic-haiku' })[0].name, 'anthropic-haiku');
});

test('needsTools excludes cloudflare-llama (live-confirmed unreliable at real tool-calling, not just anthropic-shaped): only CF configured + tools required -> empty, degrades honestly to "no usable key" rather than a model that hallucinates fake tool names', () => {
  const available = { CF_API_TOKEN: 'x', CF_ACCOUNT_ID: 'y' };
  assert.deepEqual(pickCandidates(available, { needsTools: true }), []);
  // without needsTools, cloudflare-llama is still a perfectly valid plain-chat candidate
  assert.equal(pickCandidates(available, { needsTools: false })[0]?.name, 'cloudflare-llama');
});

test('needsTools + only-cloudflare-configured EXACT model/force request also comes back empty, not silently using cloudflare-llama (the actual production bug this fix closes)', () => {
  const available = { CF_API_TOKEN: 'x', CF_ACCOUNT_ID: 'y' };
  // client asked selectModel() for gemini (the honest tools-capable pick) but
  // only Cloudflare is configured server-side — must NOT silently fall back
  // to a model that can't be trusted with tools.
  assert.deepEqual(pickCandidates(available, { model: 'gemini-flash-latest', needsTools: true }), []);
  assert.deepEqual(pickCandidates(available, { force: 'cloudflare-llama', needsTools: true }), []);
});

test('toolsCapable is an honest claim matching @arganta/ai/registry.js\'s client-side capabilities.tools for every free/cheap entry', () => {
  const byName = Object.fromEntries(PROVIDER_CATALOG.map((e) => [e.name, e]));
  assert.equal(byName.gemini.toolsCapable, true);
  assert.equal(byName.groq.toolsCapable, true);
  assert.equal(!!byName['cloudflare-llama'].toolsCapable, false);
  assert.equal(!!byName.deepseek.toolsCapable, false);
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

test('toOpenAICompatBody accepts BOTH flat tools and already-wrapped OpenAI tools without double-wrapping (regression: @arganta/agent toOpenAITools() sends {type,function:{name}} — reading t.name on that yields undefined, so Gemini got an empty function name and 400d the whole request)', () => {
  const flat = toOpenAICompatBody({ messages: [], model: 'm', tools: [{ name: 'generate_image', description: 'd', parameters: { type: 'object', properties: {} } }] });
  const wrapped = toOpenAICompatBody({ messages: [], model: 'm', tools: [{ type: 'function', function: { name: 'generate_image', description: 'd', parameters: { type: 'object', properties: {} } } }] });
  // both must yield a real, non-empty function name — the exact failure Gemini rejected
  assert.equal(flat.tools[0].function.name, 'generate_image');
  assert.equal(wrapped.tools[0].function.name, 'generate_image');
  assert.equal(flat.tools[0].function.description, 'd');
  assert.equal(wrapped.tools[0].function.description, 'd');
  assert.deepEqual(wrapped.tools[0].function.parameters, { type: 'object', properties: {} });
  // never double-wraps: the inner function object has no nested `.function`
  assert.equal(wrapped.tools[0].function.function, undefined);
});

test('OpenAI-compat: a provider that returns already-parsed JSON content (Cloudflare quirk) is normalized back to a string', () => {
  const out = fromOpenAICompatResponse({ choices: [{ message: { content: { headline: 'Hi', features: ['a'] } } }], usage: {} });
  assert.equal(typeof out.text, 'string');
  assert.deepEqual(JSON.parse(out.text), { headline: 'Hi', features: ['a'] });
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

test('Cloudflare needs BOTH its token and account id — a partial key set does not enable it', () => {
  assert.deepEqual(pickCandidates({ CF_API_TOKEN: 'x' }, { force: 'cloudflare-llama' }), []);
  const both = pickCandidates({ CF_API_TOKEN: 'x', CF_ACCOUNT_ID: 'acc' }, { force: 'cloudflare-llama' });
  assert.equal(both[0]?.name, 'cloudflare-llama');
});

test('Cloudflare joins the Sponsored pool once both keys are set, alongside gemini/groq', () => {
  const available = { GEMINI_API_KEY: 'x', CF_API_TOKEN: 'y', CF_ACCOUNT_ID: 'acc' };
  const cands = pickCandidates(available, { costClass: 1 });
  assert.ok(cands.some((c) => c.name === 'cloudflare-llama'));
});

test('resolveUrl: static-url entries win outright; account-scoped entries build the URL from the account id', () => {
  const gemini = PROVIDER_CATALOG.find((e) => e.name === 'gemini');
  assert.equal(resolveUrl(gemini, 'ignored'), gemini.url);
  const cf = PROVIDER_CATALOG.find((e) => e.name === 'cloudflare-llama');
  assert.equal(resolveUrl(cf, 'acc123'), 'https://api.cloudflare.com/client/v4/accounts/acc123/ai/v1/chat/completions');
});

test('retryable status classification: 429 and 5xx move to the next candidate, 4xx does not', () => {
  assert.equal(isRetryableStatus(429), true);
  assert.equal(isRetryableStatus(500), true);
  assert.equal(isRetryableStatus(503), true);
  assert.equal(isRetryableStatus(401), false);
  assert.equal(isRetryableStatus(400), false);
});
