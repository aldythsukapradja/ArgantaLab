import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MEDIA_CATALOG, pickMediaCandidates, priceUsd,
  toCloudflareImageRequest, fromCloudflareImageResponse,
  toModalImageRequest, fromModalImageResponse, isRetryableStatus,
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

test('retryable status: 429 and 5xx move to the next candidate, 4xx does not', () => {
  assert.equal(isRetryableStatus(429), true);
  assert.equal(isRetryableStatus(503), true);
  assert.equal(isRetryableStatus(400), false);
  assert.equal(isRetryableStatus(401), false);
});
