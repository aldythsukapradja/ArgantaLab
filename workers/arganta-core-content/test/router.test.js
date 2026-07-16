// Pure-logic tests for the Arganta Core Content Engine — no network, no
// Cloudflare runtime (plain Node), same discipline as build-artifact-runtime.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  allowedOrigins, corsHeaders, isAuthed, parseGenerateBody, estimateNeurons, KINDS,
} from '../router.js';
import {
  TEMPLATE_IDS, PALETTE_IDS, coerceCopy, extractJson, aspectFor, FORMAT_ASPECT,
} from '../schema.js';
import { copyMessages, imagePrompt } from '../prompts.js';

// ── vocab drift guards (mirrors postTemplates.ts / postEngine.ts) ──
test('vocabulary matches the app: 9 templates, 10 palettes, 6 formats', () => {
  assert.equal(TEMPLATE_IDS.length, 9);
  assert.equal(PALETTE_IDS.length, 10);
  assert.equal(Object.keys(FORMAT_ASPECT).length, 6);
  assert.ok(TEMPLATE_IDS.includes('hook') && TEMPLATE_IDS.includes('cta'));
});

test('aspectFor falls back to portrait for unknown formats', () => {
  assert.deepEqual(aspectFor('portrait'), { w: 816, h: 1024 });
  assert.deepEqual(aspectFor('nope'), { w: 816, h: 1024 });
});

// ── CORS ──
test('allowedOrigins: env override wins, else defaults', () => {
  assert.deepEqual(allowedOrigins({ ALLOWED_ORIGINS: 'https://a.com, https://b.com' }), ['https://a.com', 'https://b.com']);
  assert.ok(allowedOrigins({}).includes('http://localhost:5173'));
});

test('corsHeaders: echoes an allowed origin, nulls a foreign one', () => {
  const env = { ALLOWED_ORIGINS: 'https://hq.arganta.app' };
  assert.equal(corsHeaders('https://hq.arganta.app', env)['Access-Control-Allow-Origin'], 'https://hq.arganta.app');
  assert.equal(corsHeaders('https://evil.com', env)['Access-Control-Allow-Origin'], 'null');
});

test('corsHeaders: allows localhost (any port), *.arganta.app, vercel/pages previews', () => {
  const env = { ALLOWED_ORIGINS: 'https://hq.arganta.app' };
  for (const o of [
    'http://localhost:5178', 'http://localhost:5181', 'http://127.0.0.1:4173',
    'https://hq.arganta.app', 'https://circle.arganta.app', 'https://arganta.app',
    'https://circle-hq-abc123.vercel.app', 'https://my-hq.pages.dev',
  ]) {
    assert.equal(corsHeaders(o, env)['Access-Control-Allow-Origin'], o, o);
  }
  // lookalikes must NOT be echoed
  for (const bad of ['https://localhost.evil.com', 'https://arganta.app.evil.com', 'https://evilarganta.app', 'http://hq.arganta.app']) {
    assert.equal(corsHeaders(bad, env)['Access-Control-Allow-Origin'], 'null', bad);
  }
});

// ── auth ──
test('isAuthed: skipped without CORE_TOKEN, enforced with it', () => {
  const req = (h) => ({ headers: { get: () => h } });
  assert.equal(isAuthed(req('Bearer x'), {}), true); // unconfigured dev
  assert.equal(isAuthed(req('Bearer secret'), { CORE_TOKEN: 'secret' }), true);
  assert.equal(isAuthed(req('Bearer nope'), { CORE_TOKEN: 'secret' }), false);
  assert.equal(isAuthed(req(''), { CORE_TOKEN: 'secret' }), false);
});

// ── request validation ──
test('parseGenerateBody: rejects junk + bad kinds', () => {
  assert.equal(parseGenerateBody(null).ok, false);
  assert.equal(parseGenerateBody({ kind: 'video' }).ok, false);
  assert.deepEqual(KINDS, ['copy', 'image']);
});

test('parseGenerateBody: copy needs a brief', () => {
  assert.equal(parseGenerateBody({ kind: 'copy' }).ok, false);
  assert.equal(parseGenerateBody({ kind: 'copy', brief: '   ' }).ok, false);
  const r = parseGenerateBody({ kind: 'copy', brief: 'ocean animals', context: { format: 'square' } });
  assert.equal(r.ok, true);
  assert.equal(r.req.brief, 'ocean animals');
  assert.equal(r.req.context.format, 'square');
});

test('parseGenerateBody: image needs a prompt + resolves aspect', () => {
  assert.equal(parseGenerateBody({ kind: 'image' }).ok, false);
  const r = parseGenerateBody({ kind: 'image', prompt: 'a whale', format: 'story' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.req.aspect, { w: 576, h: 1024 });
  // unknown format falls back to portrait
  assert.deepEqual(parseGenerateBody({ kind: 'image', prompt: 'x', format: 'zzz' }).req.aspect, { w: 816, h: 1024 });
});

// ── coerceCopy (mirrors coercePost clamping) ──
test('coerceCopy: keeps only known templates, clamps, caps at 8', () => {
  const out = coerceCopy({
    palette: 'ocean',
    slides: [
      { template: 'hook', headline: 'x'.repeat(200) },
      { template: 'nope', headline: 'dropped' },
      { template: 'fact', body: 'y', imagePrompt: 'a fish' },
    ],
    caption: 'hi',
    hashtags: '#a #b',
  });
  assert.equal(out.palette, 'ocean');
  assert.equal(out.slides.length, 2);
  assert.equal(out.slides[0].headline.length, 140);
  assert.equal(out.slides[1].imagePrompt, 'a fish');
  assert.equal(out.caption, 'hi');
});

test('coerceCopy: never throws on garbage', () => {
  assert.deepEqual(coerceCopy(undefined).slides, []);
  assert.deepEqual(coerceCopy('nope').slides, []);
  assert.equal(coerceCopy({ palette: 'notreal' }).palette, undefined);
});

// ── extractJson ──
test('extractJson: pulls object out of fenced / prose replies', () => {
  assert.deepEqual(extractJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(extractJson('sure! {"a":2} done'), { a: 2 });
  assert.equal(extractJson('no json here'), null);
});

// ── prompts ──
test('copyMessages: system prompt carries brand + toggles image briefs', () => {
  const withImg = copyMessages('cats', { brand: { name: 'KinetikCircle', handle: '@kc' } });
  assert.ok(withImg[0].content.includes('KinetikCircle'));
  assert.ok(withImg[0].content.includes('imagePrompt'));
  const noImg = copyMessages('cats', { wantImages: false });
  assert.ok(!noImg[0].content.includes('imagePrompt'));
  assert.equal(withImg[3].content, 'cats');
});

test('copyMessages: threads format + palette + revise context', () => {
  const msgs = copyMessages('cats', {
    format: 'square', palette: 'ocean', platform: 'tiktok',
    existingSlides: [{ template: 'hook', headline: 'Old hook', body: 'old body' }],
  });
  assert.ok(msgs[0].content.includes('square format'));
  assert.ok(msgs[0].content.includes('"ocean" palette'));
  assert.ok(msgs[0].content.includes('tiktok caption'));
  // revise context is appended to the final user turn, not the system prompt
  assert.ok(msgs[3].content.includes('Old hook'));
  assert.ok(msgs[3].content.startsWith('cats'));
});

test('imagePrompt: strips text requests, pins no-text style', () => {
  const p = imagePrompt('a poster with the words hello');
  assert.ok(!/\bwords\b/i.test(p.replace(/no text.*/i, '')));
  assert.ok(/no text/i.test(p));
});

test('estimateNeurons: image flat, copy from tokens', () => {
  assert.equal(estimateNeurons('image'), 1);
  assert.equal(estimateNeurons('copy', { promptTokens: 500, completionTokens: 700 }), 1);
  assert.equal(estimateNeurons('copy', {}), 1);
});
