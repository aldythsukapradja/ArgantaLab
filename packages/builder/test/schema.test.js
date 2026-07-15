import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ARTIFACT_COLUMNS, VERSION_COLUMNS,
  artifactToRow, artifactFromRow, versionToRow, versionFromRow,
} from '../src/index.js';

test('artifact row mapping is lossless and produces EXACTLY the migration columns (B3 contract)', () => {
  const a = { id: 'a1', kind: 'website', title: 'T', description: 'D', html: '<html></html>', currentVersion: 3, templateId: 'company', brandKitId: 'b1', status: 'published', visibility: 'public', createdBy: 'u1', createdAt: '2026-07-15T00:00:00Z', updatedAt: '2026-07-15T01:00:00Z' };
  const row = artifactToRow(a);
  assert.deepEqual(Object.keys(row).sort(), [...ARTIFACT_COLUMNS].sort());
  const back = artifactFromRow(row);
  assert.equal(back.html, '<html></html>'); // current_html ↔ html
  assert.equal(back.currentVersion, 3);
  assert.equal(back.visibility, 'public');
});

test('version row mapping is lossless and produces EXACTLY the migration columns; run_id lineage survives', () => {
  const v = { id: 'v1', artifactId: 'a1', versionNumber: 2, html: '<html></html>', instruction: 'add a chart', templateId: null, componentIds: ['line-chart'], provider: 'cloudflare-llama', model: 'llama-3.3', costUsd: 0, validation: { ok: true }, runId: 'run_abc', createdAt: '2026-07-15T00:00:00Z' };
  const row = versionToRow(v);
  assert.deepEqual(Object.keys(row).sort(), [...VERSION_COLUMNS].sort());
  const back = versionFromRow(row);
  assert.equal(back.runId, 'run_abc'); // run_id ↔ runId (agent_runs lineage)
  assert.deepEqual(back.componentIds, ['line-chart']);
  assert.equal(back.validation.ok, true);
});

test('row mappers default sensibly for a fresh draft (no version yet)', () => {
  const row = artifactToRow({ id: 'a2', kind: 'application', createdBy: 'u1' });
  assert.equal(row.status, 'draft');
  assert.equal(row.visibility, 'private');
  assert.equal(row.current_version, 1);
});
