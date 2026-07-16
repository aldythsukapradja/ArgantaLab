// Pure-logic tests for the Buffer proxy (BF1) — no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  gqlStr, channelsQuery, accountOrgsQuery, extractOrgs, extractChannels, createPostMutation,
  extractPostResult, parsePublishBody, ALLOWED_MODES, DEFAULT_MODE,
} from '../buffer.js';

test('gqlStr: produces an injection-safe GraphQL string literal', () => {
  assert.equal(gqlStr('hi'), '"hi"');
  assert.equal(gqlStr('he said "hi"\nbye'), '"he said \\"hi\\"\\nbye"');
  assert.equal(gqlStr(null), '""');
});

test('createPostMutation: inlines mode as a bare enum, encodes text + urls', () => {
  const m = createPostMutation({ channelId: 'ch1', text: 'a "b"', imageUrls: ['https://x/a.png', 'https://x/b.png'], mode: 'addToQueue' });
  assert.match(m, /mode: addToQueue/);            // bare enum, not quoted
  assert.match(m, /channelId: "ch1"/);
  assert.match(m, /text: "a \\"b\\""/);           // caption safely escaped
  assert.match(m, /image: \{ url: "https:\/\/x\/a\.png" \}/);
  assert.match(m, /image: \{ url: "https:\/\/x\/b\.png" \}/);
});

// Live Buffer rejected posts with no metadata: "Instagram posts require a
// type (post, story, or reel)". Then rejected type `carousel` too ("Instagram
// does not support the 'carousel' post type") even though it's in the PostType
// enum — a multi-image carousel is just type `post` with multiple assets.
test('createPostMutation: attaches Instagram metadata (type + shouldShareToFeed), inferred from shape', () => {
  const single = createPostMutation({ channelId: 'ch1', text: 'x', imageUrls: ['https://x/a.png'], mode: 'addToQueue' });
  assert.match(single, /metadata: \{ instagram: \{ type: post, shouldShareToFeed: true \} \}/);

  // multi-image = STILL type post (Instagram rejects `carousel`, live-confirmed)
  const carousel = createPostMutation({ channelId: 'ch1', text: 'x', imageUrls: ['https://x/a.png', 'https://x/b.png'], mode: 'addToQueue' });
  assert.match(carousel, /type: post/);
  assert.doesNotMatch(carousel, /type: carousel/);

  const video = createPostMutation({ channelId: 'ch1', text: 'x', videoUrl: 'https://x/v.mp4', mode: 'addToQueue' });
  assert.match(video, /type: reel/);

  // non-Instagram channel: no metadata block forced on it
  const other = createPostMutation({ channelId: 'ch1', text: 'x', imageUrls: ['https://x/a.png'], mode: 'addToQueue', channelService: 'linkedin' });
  assert.doesNotMatch(other, /metadata:/);
});

test('extractOrgs: pulls account organizations', () => {
  assert.deepEqual(extractOrgs({ data: { account: { organizations: [{ id: 'o1', name: 'Org' }] } } }), [{ id: 'o1', name: 'Org' }]);
  assert.deepEqual(extractOrgs({}), []);
});

test('channelsQuery: embeds the organizationId', () => {
  assert.match(channelsQuery('o1'), /organizationId: "o1"/);
  assert.match(accountOrgsQuery(), /organizations/);
});

test('extractChannels: maps fields + drops disconnected', () => {
  const out = extractChannels({ data: { channels: [
    { id: '1', displayName: 'argantalab', service: 'instagram', type: 'business', isDisconnected: false },
    { id: '2', name: 'dead', service: 'instagram', isDisconnected: true },
  ] } });
  assert.deepEqual(out, [{ id: '1', name: 'argantalab', service: 'instagram', type: 'business' }]);
  assert.deepEqual(extractChannels({}), []);
});

test('extractPostResult: success, MutationError, transport errors', () => {
  assert.deepEqual(extractPostResult({ data: { createPost: { post: { id: 'p1' } } } }), { ok: true, postId: 'p1' });
  assert.deepEqual(extractPostResult({ data: { createPost: { message: 'bad channel' } } }), { ok: false, message: 'bad channel' });
  assert.deepEqual(extractPostResult({ errors: [{ message: 'unauthorized' }] }), { ok: false, message: 'unauthorized' });
  assert.equal(extractPostResult({}).ok, false);
});

test('parsePublishBody: requires channel + >=1 valid url, caps at 10', () => {
  assert.equal(parsePublishBody(null).ok, false);
  assert.equal(parsePublishBody({ imageUrls: ['https://x/a.png'] }).ok, false);           // no channel
  assert.equal(parsePublishBody({ channelId: 'c' }).ok, false);                            // no images
  assert.equal(parsePublishBody({ channelId: 'c', imageUrls: ['not-a-url'] }).ok, false);  // bad url filtered → empty
  assert.equal(parsePublishBody({ channelId: 'c', imageUrls: Array(11).fill('https://x/a.png') }).ok, false); // >10
  const ok = parsePublishBody({ channelId: 'c', imageUrls: ['https://x/a.png', 'ftp://no'], text: 'hi' });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.req.imageUrls, ['https://x/a.png']);   // non-http filtered out
  assert.equal(ok.req.text, 'hi');
  assert.equal(ok.req.channelService, 'instagram');          // defaults to instagram
  assert.equal(parsePublishBody({ channelId: 'c', imageUrls: ['https://x/a.png'], channelService: 'linkedin' }).req.channelService, 'linkedin');
});

test('parsePublishBody: mode defaults + allowlist', () => {
  assert.equal(parsePublishBody({ channelId: 'c', imageUrls: ['https://x/a.png'] }).req.mode, DEFAULT_MODE);
  assert.equal(parsePublishBody({ channelId: 'c', imageUrls: ['https://x/a.png'], mode: 'nuke' }).req.mode, DEFAULT_MODE);
  assert.deepEqual([...ALLOWED_MODES], ['addToQueue', 'shareNext', 'shareNow']);
  assert.equal(parsePublishBody({ channelId: 'c', imageUrls: ['https://x/a.png'], mode: 'shareNow' }).req.mode, 'shareNow');
});

// ── BF3: video asset support ──
test('parsePublishBody: videoUrl path (with optional thumbnail), takes priority over imageUrls', () => {
  const bad = parsePublishBody({ channelId: 'c', videoUrl: 'not-a-url' });
  assert.equal(bad.ok, false);
  const ok = parsePublishBody({ channelId: 'c', videoUrl: 'https://x/v.mp4', thumbnailUrl: 'https://x/poster.jpg', text: 'reel' });
  assert.equal(ok.ok, true);
  assert.equal(ok.req.videoUrl, 'https://x/v.mp4');
  assert.equal(ok.req.thumbnailUrl, 'https://x/poster.jpg');
  assert.equal(ok.req.imageUrls, undefined);
  // videoUrl present + imageUrls also present → video wins, imageUrls ignored
  const both = parsePublishBody({ channelId: 'c', videoUrl: 'https://x/v.mp4', imageUrls: ['https://x/a.png'] });
  assert.equal(both.req.videoUrl, 'https://x/v.mp4');
  assert.equal(both.req.imageUrls, undefined);
});

test('createPostMutation: video asset (with + without thumbnail), never both media kinds', () => {
  const m1 = createPostMutation({ channelId: 'ch1', text: 'hi', videoUrl: 'https://x/v.mp4', mode: 'addToQueue' });
  assert.match(m1, /video: \{ url: "https:\/\/x\/v\.mp4" \}/);
  assert.doesNotMatch(m1, /image:/);
  const m2 = createPostMutation({ channelId: 'ch1', text: 'hi', videoUrl: 'https://x/v.mp4', thumbnailUrl: 'https://x/p.jpg', mode: 'addToQueue' });
  assert.match(m2, /video: \{ url: "https:\/\/x\/v\.mp4", thumbnailUrl: "https:\/\/x\/p\.jpg" \}/);
});
