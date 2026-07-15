import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MEDIA_CATALOG, pickMediaCandidates, priceUsd,
  toCloudflareImageRequest, fromCloudflareImageResponse,
  toModalImageRequest, fromModalImageResponse, isRetryableStatus,
  toCloudflareTtsRequest, isBinaryAudioContentType,
  toNeuronQuotaQuery, fromNeuronQuotaResponse, FREE_NEURONS_PER_DAY,
} from './router.js';

const CF = { CF_ACCOUNT_ID: 'acc', CF_API_TOKEN: 'tok' };
const MODAL = { MODAL_IMAGE_URL: 'https://x.modal.run', MODAL_TOKEN: 'mtok' };

test('no keys set → no candidates (caller degrades to Sovereign/deterministic)', () => {
  assert.deepEqual(pickMediaCandidates({}, { kind: 'image', costClass: 1 }), []);
});

test('a partial key set does NOT enable a provider (both CF keys required)', () => {
  assert.deepEqual(pickMediaCandidates({ CF_ACCOUNT_ID: 'acc' }, { kind: 'image', costClass: 1 }), []);
});

test('Sponsored (costClass 1) picks Cloudflare when its keys are set', () => {
  const c = pickMediaCandidates(CF, { kind: 'image', costClass: 1 });
  assert.equal(c[0].name, 'cloudflare-flux');
  assert.equal(c[0].costClass, 1);
});

test('Economy (costClass 2) picks Modal when its keys are set', () => {
  const c = pickMediaCandidates({ ...CF, ...MODAL }, { kind: 'image', costClass: 2 });
  assert.equal(c[0].name, 'modal-flux');
  assert.equal(c[0].costClass, 2);
});

test('Economy requested but only Cloudflare available → degrades DOWN to Sponsored, not failure', () => {
  const c = pickMediaCandidates(CF, { kind: 'image', costClass: 2 });
  assert.equal(c[0].name, 'cloudflare-flux'); // truthfully a tier-1 run; caller records the real tier
});

test('force picks the exact provider regardless of cost, or empty if unavailable', () => {
  assert.equal(pickMediaCandidates({ ...CF, ...MODAL }, { force: 'modal-flux' })[0].name, 'modal-flux');
  assert.deepEqual(pickMediaCandidates(CF, { force: 'modal-flux' }), []); // Modal keys not set
});

test('Cloudflare has no pricing → truthfully $0; Modal carries a per-gen estimate', () => {
  assert.equal(priceUsd(MEDIA_CATALOG.find((e) => e.name === 'cloudflare-flux')), 0);
  assert.ok(priceUsd(MEDIA_CATALOG.find((e) => e.name === 'modal-flux')) > 0);
});

test('Cloudflare request builds the account-scoped URL; response extracts base64 JPEG', () => {
  const req = toCloudflareImageRequest({ accountId: 'acc', model: '@cf/black-forest-labs/flux-1-schnell', prompt: 'a fox' });
  assert.match(req.url, /accounts\/acc\/ai\/run\/@cf\/black-forest-labs\/flux-1-schnell$/);
  assert.equal(req.body.prompt, 'a fox');
  const parsed = fromCloudflareImageResponse({ result: { image: 'BASE64DATA' }, success: true });
  assert.equal(parsed.imageBase64, 'BASE64DATA');
  assert.equal(parsed.mime, 'image/jpeg');
  assert.equal(fromCloudflareImageResponse({ success: false }), null);
});

test('Modal request targets the deployed endpoint URL; response extracts base64 PNG', () => {
  const req = toModalImageRequest({ url: 'https://x.modal.run', prompt: 'a fox' });
  assert.equal(req.url, 'https://x.modal.run');
  assert.equal(req.body.prompt, 'a fox');
  assert.equal(fromModalImageResponse({ image_base64: 'PNGDATA' }).imageBase64, 'PNGDATA');
  assert.equal(fromModalImageResponse({}), null);
});

test('Sponsored TTS picks Cloudflare Aura when its keys are set (same keys as image — nothing new to configure)', () => {
  const c = pickMediaCandidates(CF, { kind: 'tts', costClass: 1 });
  assert.equal(c[0].name, 'cloudflare-aura');
  assert.equal(c[0].model, '@cf/deepgram/aura-1');
});

test('image and tts candidates never mix — kind filters the pool', () => {
  const c = pickMediaCandidates({ ...CF, ...MODAL }, { kind: 'tts' });
  assert.ok(c.every((e) => e.kind === 'tts'));
});

test('per-character pricing scales with text length; image per-gen pricing ignores units', () => {
  const aura = MEDIA_CATALOG.find((e) => e.name === 'cloudflare-aura');
  assert.equal(priceUsd(aura, 1000), 0.015);
  assert.equal(priceUsd(aura, 0), 0);
  const modal = MEDIA_CATALOG.find((e) => e.name === 'modal-flux');
  assert.equal(priceUsd(modal, 999999), priceUsd(modal, 0)); // perGenUsd is flat, not per-unit
});

test('Cloudflare TTS request builds the account-scoped URL with text/speaker/encoding, defaulting speaker to orion', () => {
  const req = toCloudflareTtsRequest({ accountId: 'acc', model: '@cf/deepgram/aura-1', text: 'hello' });
  assert.match(req.url, /accounts\/acc\/ai\/run\/@cf\/deepgram\/aura-1$/);
  assert.equal(req.body.text, 'hello');
  assert.equal(req.body.speaker, 'orion');
  assert.equal(req.body.encoding, 'mp3');
  const withVoice = toCloudflareTtsRequest({ accountId: 'acc', model: 'x', text: 'hi', speaker: 'asteria' });
  assert.equal(withVoice.body.speaker, 'asteria');
});

test('isBinaryAudioContentType: audio/JSON-less content types are binary; an explicit JSON envelope is not', () => {
  assert.equal(isBinaryAudioContentType('audio/mpeg'), true);
  assert.equal(isBinaryAudioContentType('application/octet-stream'), true);
  assert.equal(isBinaryAudioContentType('application/json'), false);
  assert.equal(isBinaryAudioContentType('application/json; charset=utf-8'), false);
  assert.equal(isBinaryAudioContentType(null), false);
});

test('neuron quota query targets the GraphQL Analytics endpoint with the right variables', () => {
  const q = toNeuronQuotaQuery({ accountId: 'acc', date: '2026-07-15' });
  assert.equal(q.url, 'https://api.cloudflare.com/client/v4/graphql');
  assert.equal(q.body.variables.accountTag, 'acc');
  assert.equal(q.body.variables.date, '2026-07-15');
  assert.match(q.body.query, /aiInferenceAdaptiveGroups/);
});

test('neuron quota response: an authz error (token missing Analytics:Read) is reported honestly, not as zero usage', () => {
  // exact shape captured live against the real account — the token has Workers
  // AI:Run but not Account Analytics:Read, so this is the REAL error, not a guess.
  const real = { data: null, errors: [{ message: 'not authorized for that account', extensions: { code: 'authz' } }] };
  assert.deepEqual(fromNeuronQuotaResponse(real), { error: 'insufficient_scope' });
});

test('neuron quota response: sums totalNeurons across models and sorts heaviest-first', () => {
  const json = {
    data: { viewer: { accounts: [{ aiInferenceAdaptiveGroups: [
      { count: 3, sum: { totalNeurons: 96 }, dimensions: { modelId: '@cf/black-forest-labs/flux-1-schnell' } },
      { count: 12, sum: { totalNeurons: 340 }, dimensions: { modelId: '@cf/meta/llama-3.3-70b-instruct-fp8-fast' } },
    ] }] } },
  };
  const out = fromNeuronQuotaResponse(json);
  assert.equal(out.neuronsUsedToday, 436);
  assert.equal(out.byModel[0].modelId, '@cf/meta/llama-3.3-70b-instruct-fp8-fast'); // heaviest first
  assert.equal(out.byModel[1].requests, 3);
});

test('free daily allocation is the published 10,000 neurons — not invented', () => {
  assert.equal(FREE_NEURONS_PER_DAY, 10000);
});

test('retryable status: 429 and 5xx move to the next candidate, 4xx does not', () => {
  assert.equal(isRetryableStatus(429), true);
  assert.equal(isRetryableStatus(503), true);
  assert.equal(isRetryableStatus(400), false);
  assert.equal(isRetryableStatus(401), false);
});
