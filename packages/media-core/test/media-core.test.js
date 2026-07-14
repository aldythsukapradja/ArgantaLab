import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generate, generateImage, MATURITY } from '../src/index.js';

const sameBytes = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

test('deterministic image runs in node and returns real PNG bytes + provenance', () => {
  const r = generate({ kind: 'image', spec: { prompt: 'arganta launch', width: 64, height: 64 } });
  assert.equal(r.status, 'succeeded');
  assert.equal(r.runtime, 'node');
  assert.equal(r.output.mime, 'image/png');
  assert.ok(r.output.bytes instanceof Uint8Array && r.output.bytes.length > 0);
  // valid PNG signature
  assert.deepEqual([...r.output.bytes.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
  // provenance is complete and free
  assert.equal(r.provenance.cost, 0);
  assert.equal(r.provenance.maturityStage, 0);
  assert.equal(r.provenance.maturityLabel, 'deterministic');
  assert.ok(r.provenance.checksum);
});

test('same spec is byte-identical (reproducible)', () => {
  const a = generateImage({ prompt: 'same', width: 48, height: 48 });
  const b = generateImage({ prompt: 'same', width: 48, height: 48 });
  assert.ok(sameBytes(a.bytes, b.bytes));
  assert.equal(a.seed, b.seed);
});

test('different prompt yields different bytes', () => {
  const a = generateImage({ prompt: 'one', width: 48, height: 48 });
  const b = generateImage({ prompt: 'two', width: 48, height: 48 });
  assert.ok(!sameBytes(a.bytes, b.bytes));
});

test('premium (stage 3) is blocked without approval', () => {
  const r = generate({ kind: 'image', maturityStage: MATURITY.PREMIUM });
  assert.equal(r.status, 'failed');
  assert.equal(r.error.code, 'approval_required');
  assert.equal(r.error.source, 'policy');
});

test('premium runs (deferred to MCP) once approved', () => {
  const r = generate({ kind: 'image', maturityStage: MATURITY.PREMIUM, approved: true });
  assert.equal(r.status, 'deferred');
  assert.equal(r.runtime, 'mcp');
  assert.equal(r.descriptor.tool, 'higgsfield.generate_image');
  assert.equal(r.provenance.estimated, true);
  assert.ok(r.provenance.cost > 0);
});

test('routing walks DOWN to cheapest capable stage (no silent escalation)', () => {
  // image only has stage 0 and stage 3; asking for 2 must downgrade to 0, not up to 3
  const r = generate({ kind: 'image', maturityStage: MATURITY.ECONOMICAL, spec: { width: 32, height: 32 } });
  assert.equal(r.status, 'succeeded');
  assert.equal(r.provenance.maturityStage, 0);
  assert.equal(r.downgraded, true);
  assert.equal(r.provenance.cost, 0);
});

test('music/video/voice defer to browser engines at stage 0 (free)', () => {
  for (const kind of ['music', 'video', 'voice', 'sfx']) {
    const r = generate({ kind, spec: { prompt: 'x' } });
    assert.equal(r.status, 'deferred', `${kind} should defer`);
    assert.equal(r.runtime, 'browser');
    assert.equal(r.provenance.cost, 0);
    assert.ok(r.descriptor.engine.startsWith('@arganta/'));
  }
});

test('unknown kind fails as validation error', () => {
  const r = generate({ kind: 'hologram' });
  assert.equal(r.status, 'failed');
  assert.equal(r.error.source, 'validation');
});
