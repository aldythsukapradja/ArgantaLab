// Pure-logic tests for the Arganta Core Content Engine — no network, no
// Cloudflare runtime (plain Node), same discipline as build-artifact-runtime.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  allowedOrigins, corsHeaders, isAuthed, parseGenerateBody, estimateNeurons, KINDS, TEXT_PRESETS,
} from '../router.js';
import {
  TEMPLATE_IDS, PALETTE_IDS, coerceCopy, extractJson, aspectFor, FORMAT_ASPECT,
} from '../schema.js';
import { copyMessages, imagePrompt, brandBlock, textMessages, cleanRewrite } from '../prompts.js';

// ── B3: the `text` kind (Post Studio's polish capsule) ──
test('text kind: accepts a line + preset, clamps length, defaults to polish', () => {
  assert.ok(KINDS.includes('text'));
  const r = parseGenerateBody({ kind: 'text', text: '  Octopuses have three hearts  ' });
  assert.equal(r.ok, true);
  assert.equal(r.req.text, 'Octopuses have three hearts');
  assert.equal(r.req.preset, 'polish');
  const long = parseGenerateBody({ kind: 'text', text: 'x'.repeat(900) });
  assert.equal(long.req.text.length, 400);
});

test('text kind: an empty line or unknown preset is a named error, not a default', () => {
  assert.equal(parseGenerateBody({ kind: 'text', text: '   ' }).code, 'no_text');
  const bad = parseGenerateBody({ kind: 'text', text: 'hi', preset: 'fancify' });
  assert.equal(bad.ok, false);
  assert.equal(bad.code, 'bad_preset');
  for (const p of TEXT_PRESETS) {
    assert.equal(parseGenerateBody({ kind: 'text', text: 'hi', preset: p }).ok, true);
  }
});

test('textMessages: sends the line as the user turn and demands one bare line', () => {
  const m = textMessages('Make this pop', 'punchier');
  assert.equal(m.length, 2);
  assert.equal(m[1].content, 'Make this pop');
  assert.match(m[0].content, /ONLY the rewritten line/);
  assert.match(m[0].content, /punchier/i);
});

// The whole point of cleanRewrite: a chatty small model must never land its
// preamble on the artwork, and a rewrite that balloons is refused outright.
test('cleanRewrite: strips chatter, quotes and numbering', () => {
  assert.equal(cleanRewrite('"Three hearts, one octopus"'), 'Three hearts, one octopus');
  assert.equal(cleanRewrite("Sure! Here's a polished version:\nThree hearts, one octopus"), 'Three hearts, one octopus');
  assert.equal(cleanRewrite('1. Three hearts, one octopus'), 'Three hearts, one octopus');
});

test('cleanRewrite: refuses a runaway rewrite rather than re-wrapping the design', () => {
  const original = 'Three hearts';
  assert.equal(cleanRewrite('x'.repeat(200), original), '');
  // short originals still get reasonable room (the 40-char floor)
  assert.equal(cleanRewrite('Three mighty hearts', original), 'Three mighty hearts');
  assert.equal(cleanRewrite('', original), '');
});

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
  assert.deepEqual(KINDS, ['copy', 'image', 'text']);
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

// ── BF-5: writing AS a brand ──────────────────────────────────
test('brandBlock: renders a full voice block into instructions', () => {
  const s = brandBlock({
    id: 'argantalab', name: 'ArgantaLab', lang: 'en', handle: '@argantalab',
    persona: {
      title: 'The Lab', speaksAs: 'The account speaks as The Lab.',
      adjectives: ['inventive', 'encouraging'], forbidden: ['corporate buzzwords', 'fake traction'],
    },
    tagline: 'Play. Learn. Build. Ship.',
    summary: 'the kid-powered creation studio inside Arganta',
    pillars: [{ id: 'build', label: 'Build the thing', description: 'process and prototypes' }],
    ctas: ['Enter the Lab', 'Ship your first game'],
    hashtags: { branded: ['#argantalab'], category: ['#kidscoding'], community: ['#buildinpublic'] },
    touchyRules: ['show one real kid creation'],
  });
  assert.match(s, /writing as ArgantaLab/);
  assert.match(s, /"The Lab"/);
  assert.match(s, /@argantalab/);
  assert.match(s, /Play\. Learn\. Build\. Ship\./);
  assert.match(s, /Voice: inventive, encouraging/);
  assert.match(s, /NEVER: corporate buzzwords; fake traction/);
  assert.match(s, /Build the thing \(process and prototypes\)/);
  assert.match(s, /Enter the Lab \/ Ship your first game/);
  assert.match(s, /#argantalab #kidscoding #buildinpublic/);
  assert.match(s, /Make it personal: show one real kid creation/);
});

test('brandBlock: a half-written brand shrinks the block instead of emitting empty headings', () => {
  const s = brandBlock({ id: 'kinetikcircle', name: 'KinetikCircle', persona: {}, pillars: [], ctas: [], hashtags: {} });
  assert.match(s, /writing as KinetikCircle/);
  assert.ok(!/Voice:/.test(s));
  assert.ok(!/NEVER:/.test(s));
  assert.ok(!/pillars/i.test(s));
  assert.ok(!/Make it personal/.test(s));
});

test('brandBlock: no brand → no block at all', () => {
  assert.equal(brandBlock(null), '');
  assert.equal(brandBlock({}), '');
});

test('brandBlock: a non-English brand demands its own language', () => {
  const s = brandBlock({ name: 'ArgantaLab', lang: 'id', persona: { title: 'The Lab' } });
  assert.match(s, /Bahasa Indonesia/);
  assert.ok(!/Bahasa/.test(brandBlock({ name: 'ArgantaLab', lang: 'en', persona: { title: 'The Lab' } })));
});

test('copyMessages: the brand voice reaches the system prompt', () => {
  const msgs = copyMessages('a build log', {
    brand: { name: 'ArgantaLab', handle: '@argantalab', persona: { title: 'The Lab', adjectives: ['inventive'] }, pillars: [], ctas: [], hashtags: {} },
  });
  assert.match(msgs[0].content, /writing as ArgantaLab/);
  assert.match(msgs[0].content, /The Lab/);
  assert.match(msgs[0].content, /Output ONLY a JSON object/);
});

test('imagePrompt: brand art direction replaces the generic house style', () => {
  const branded = imagePrompt('a glowing cube', { artDirection: 'Deep space-ink ground, one luminous subject, vast negative space.' });
  assert.match(branded, /Deep space-ink ground/);
  assert.ok(!/Editorial photography/.test(branded), 'brand art direction must win over the house default');
  assert.match(branded, /No text, no watermark, no letters\./);
  // ...and without one, the house style still applies
  assert.match(imagePrompt('a glowing cube', {}), /Editorial photography/);
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
