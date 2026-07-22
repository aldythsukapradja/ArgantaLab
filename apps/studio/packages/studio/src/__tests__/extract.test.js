import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveTags, deriveOrientation, fnv1a, deriveRunMetadata } from '../extract.js';

test('deriveOrientation classifies by ratio', () => {
  assert.equal(deriveOrientation(1024, 1024), 'square');
  assert.equal(deriveOrientation(1920, 1080), 'landscape');
  assert.equal(deriveOrientation(1080, 1920), 'portrait');
  assert.equal(deriveOrientation(0, 0), 'square'); // guard
});

test('deriveTags extracts keyword buckets from the prompt', () => {
  const tags = deriveTags('a cinematic portrait of a woman in a neon city at dusk', { surface: 'image', provider: 'arganta' });
  assert.ok(tags.includes('people'));   // portrait/woman
  assert.ok(tags.includes('urban'));    // city
  assert.ok(tags.includes('cinematic'));
  assert.ok(tags.includes('futuristic')); // neon
  assert.ok(tags.includes('image'));    // surface
  assert.ok(tags.includes('arganta'));  // provider
});

test('deriveTags never invents tags for an unmatched prompt', () => {
  const tags = deriveTags('xyzzy plugh', { surface: 'image', provider: 'arganta' });
  // only surface + provider survive — no false keyword matches
  assert.deepEqual(tags.sort(), ['arganta', 'image']);
});

test('deriveTags deduplicates', () => {
  const tags = deriveTags('a product packshot of a product bottle', { surface: 'image', provider: 'arganta' });
  assert.equal(new Set(tags).size, tags.length);
});

test('fnv1a is deterministic and 8 hex chars', () => {
  const a = fnv1a('hello');
  const b = fnv1a('hello');
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]{8}$/);
  assert.notEqual(fnv1a('hello'), fnv1a('world'));
});

test('deriveRunMetadata bundles tags + orientation + checksum', () => {
  const meta = deriveRunMetadata({
    prompt: 'a mountain landscape', model: 'arganta-sovereign', seed: 42,
    surface: 'image', provider: 'arganta', width: 1920, height: 1080,
  });
  assert.ok(Array.isArray(meta.tags));
  assert.ok(meta.tags.includes('nature'));
  assert.match(meta.checksum, /^[0-9a-f]{8}$/);
});

test('deriveRunMetadata checksum changes with prompt but is stable per input', () => {
  const base = { model: 'm', seed: 1, surface: 'image', provider: 'arganta' };
  const a = deriveRunMetadata({ ...base, prompt: 'cat' });
  const a2 = deriveRunMetadata({ ...base, prompt: 'cat' });
  const b = deriveRunMetadata({ ...base, prompt: 'dog' });
  assert.equal(a.checksum, a2.checksum);
  assert.notEqual(a.checksum, b.checksum);
});
