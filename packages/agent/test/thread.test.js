import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MESSAGE_ROLES, BLOCK_KINDS, isMediaBlock, makeBlock, validateMessage,
  messageToRow, messageFromRow, MESSAGE_COLUMNS,
} from '../src/index.js';

test('roles and block kinds are the frozen canonical sets', () => {
  assert.deepEqual(MESSAGE_ROLES, ['user', 'assistant', 'tool', 'system']);
  assert.ok(BLOCK_KINDS.includes('image') && BLOCK_KINDS.includes('tool-trail') && BLOCK_KINDS.includes('delegation'));
  assert.equal(isMediaBlock('image'), true);
  assert.equal(isMediaBlock('tool-trail'), false);
});

test('makeBlock keeps only the contract fields for each kind', () => {
  const img = makeBlock('image', { assetId: 'a1', path: 'a1.jpg', provider: 'cloudflare-flux', costUsd: 0, junk: 'x' });
  assert.equal(img.assetId, 'a1');
  assert.equal(img.junk, undefined); // unknown field dropped — block is the contract
  const trail = makeBlock('tool-trail', { tool: 'generate_image', latencyMs: 4100, ok: true });
  assert.equal(trail.tool, 'generate_image');
  assert.equal(trail.latencyMs, 4100);
  assert.throws(() => makeBlock('nonsense'), /unknown block kind/);
});

test('validateMessage requires a real role and either text or blocks', () => {
  assert.equal(validateMessage({ role: 'user', content: 'hi' }).ok, true);
  assert.equal(validateMessage({ role: 'assistant', blocks: [makeBlock('text', { text: 'x' })] }).ok, true);
  assert.equal(validateMessage({ role: 'nope', content: 'hi' }).ok, false);
  assert.equal(validateMessage({ role: 'user' }).ok, false); // empty
  assert.equal(validateMessage({ role: 'assistant', blocks: [{ kind: 'bogus' }] }).ok, false);
});

test('row mapping is a lossless camelCase↔snake_case round trip', () => {
  const m = { id: 'm1', threadId: 't1', role: 'assistant', content: 'done', blocks: [makeBlock('text', { text: 'done' })], toolCalls: [{ name: 'x' }], runId: 'r1', createdAt: '2026-07-15T00:00:00Z' };
  const row = messageToRow(m);
  assert.deepEqual(Object.keys(row).sort(), [...MESSAGE_COLUMNS].sort()); // migration contract
  const back = messageFromRow(row);
  assert.equal(back.threadId, 't1');
  assert.equal(back.runId, 'r1');
  assert.equal(back.role, 'assistant');
});
