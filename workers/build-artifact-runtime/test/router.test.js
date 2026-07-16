// B5 · pure-logic tests for the public artifact runtime's router — no
// network, no Cloudflare runtime needed (plain Node), same discipline as
// llm-proxy/media-proxy's router.test.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute, buildCsp, assertCspHostsCoverApprovedHosts, CSP_HOST_CATEGORIES } from '../src/router.js';
import { APPROVED_HOSTS } from '../../../packages/builder/src/validate.js';

test('parseRoute: /a/:slug -> application, /w/:slug -> website', () => {
  assert.deepEqual(parseRoute('/a/my-app'), { kind: 'application', slug: 'my-app' });
  assert.deepEqual(parseRoute('/w/my-site'), { kind: 'website', slug: 'my-site' });
  assert.deepEqual(parseRoute('/w/my-site/'), { kind: 'website', slug: 'my-site' }); // trailing slash tolerated
});

test('GB-2 parseRoute: /g/:slug -> game', () => {
  assert.deepEqual(parseRoute('/g/snake'), { kind: 'game', slug: 'snake' });
  assert.deepEqual(parseRoute('/g/snake/'), { kind: 'game', slug: 'snake' });
  // the kind must be the CANONICAL one @arganta/builder validates against —
  // a served game is re-validated with { kind: row.kind } (index.js).
  assert.equal(parseRoute('/g/snake').kind, 'game');
});

test('parseRoute: rejects anything that is not /a/:slug, /w/:slug or /g/:slug', () => {
  assert.equal(parseRoute('/'), null);
  assert.equal(parseRoute('/favicon.ico'), null);
  assert.equal(parseRoute('/api/whatever'), null);
  assert.equal(parseRoute('/a/'), null); // empty slug
  assert.equal(parseRoute('/a/one/two'), null); // extra path segment
  assert.equal(parseRoute('/g/'), null); // empty game slug
  assert.equal(parseRoute('/x/anything'), null); // unknown prefix
});

test('parseRoute: rejects malformed slugs (matches _artifact_slugify output shape only)', () => {
  assert.equal(parseRoute('/a/Has-Upper'), null);
  assert.equal(parseRoute('/a/has_underscore'), null);
  assert.equal(parseRoute('/a/-leading-dash'), null);
  assert.equal(parseRoute('/a/trailing-dash-'), null);
  assert.equal(parseRoute('/a/has space'), null);
  assert.equal(parseRoute('/a/../../etc/passwd'), null);
});

test('buildCsp matches ADR-0006 Decision 3 verbatim', () => {
  const csp = buildCsp();
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /script-src 'self' 'unsafe-inline' cdn\.jsdelivr\.net unpkg\.com cdnjs\.cloudflare\.com/);
  assert.match(csp, /style-src 'self' 'unsafe-inline' fonts\.googleapis\.com/);
  assert.match(csp, /font-src fonts\.gstatic\.com/);
  assert.match(csp, /img-src 'self' data:/);
  assert.match(csp, /connect-src 'none'/);
  assert.match(csp, /form-action 'self'/);
  assert.match(csp, /base-uri 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
});

test('CSP host categories exactly cover validate.js\'s APPROVED_HOSTS — the drift guard', () => {
  const result = assertCspHostsCoverApprovedHosts();
  assert.deepEqual(result.missing, [], `APPROVED_HOSTS has a host with no CSP category: ${result.missing}`);
  assert.deepEqual(result.extra, [], `CSP categorizes a host validate.js does not approve: ${result.extra}`);
  assert.equal(result.ok, true);
});

test('every APPROVED_HOSTS entry appears in exactly one CSP_HOST_CATEGORIES bucket', () => {
  APPROVED_HOSTS.forEach((host) => {
    const buckets = Object.values(CSP_HOST_CATEGORIES).filter((list) => list.includes(host));
    assert.equal(buckets.length, 1, `${host} should be in exactly one CSP category, found in ${buckets.length}`);
  });
});
