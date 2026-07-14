import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rollupBenchmarks, qualityPerDollar } from '../src/index.js';

const run = (o) => ({ actualModel: 'qwen-4b', status: 'succeeded', latencyMs: 100, costUsd: 0, createdAt: '2026-07-14T00:00:00Z', ...o });

test('below minSamples, a model produces no entry (avoids overfitting on a couple of runs)', () => {
  const rollup = rollupBenchmarks([run(), run()], { minSamples: 3 });
  assert.deepEqual(rollup, {});
});

test('rejected runs (no route taken) are excluded entirely', () => {
  const rollup = rollupBenchmarks([run({ status: 'rejected' }), run({ status: 'rejected' }), run({ status: 'rejected' })], { minSamples: 3 });
  assert.deepEqual(rollup, {});
});

test('with no validation data, score falls back to plain success rate — never a fabricated constant', () => {
  const runs = [run({ status: 'succeeded' }), run({ status: 'succeeded' }), run({ status: 'failed' }), run({ status: 'succeeded' })];
  const rollup = rollupBenchmarks(runs, { minSamples: 3 });
  assert.equal(rollup['qwen-4b'].score, 75); // 3/4 succeeded
  assert.equal(rollup['qwen-4b'].schemaPassRate, null);
});

test('when validation data exists, score reflects real schema+grounding pass rates, not just success/fail', () => {
  const runs = [
    run({ validationResult: { passed: true, schema: true, grounding: true } }),
    run({ validationResult: { passed: true, schema: true, grounding: false } }),
    run({ validationResult: { passed: false, schema: false, grounding: null } }),
  ];
  const rollup = rollupBenchmarks(runs, { minSamples: 3 });
  const b = rollup['qwen-4b'];
  assert.ok(Math.abs(b.schemaPassRate - 2 / 3) < 1e-9);
  assert.ok(Math.abs(b.groundingPassRate - 0.5) < 1e-9);
  assert.equal(b.hallucinationRate, 0.5);
});

test('averages latency and cost correctly, tracks the most recent run timestamp', () => {
  const runs = [
    run({ latencyMs: 100, costUsd: 0.01, createdAt: '2026-07-14T00:00:00Z' }),
    run({ latencyMs: 300, costUsd: 0.03, createdAt: '2026-07-14T02:00:00Z' }),
    run({ latencyMs: 200, costUsd: 0.02, createdAt: '2026-07-14T01:00:00Z' }),
  ];
  const rollup = rollupBenchmarks(runs, { minSamples: 3 });
  const b = rollup['qwen-4b'];
  assert.equal(b.averageLatencyMs, 200);
  assert.ok(Math.abs(b.averageCostUsd - 0.02) < 1e-9);
  assert.equal(b.testedAt, '2026-07-14T02:00:00Z');
});

test('media-core runs (no actualModel) fall back to provider as the grouping key, so non-LLM domains still roll up', () => {
  const runs = [
    { actualProvider: 'deterministic-image', status: 'succeeded', latencyMs: 5, costUsd: 0, createdAt: '2026-07-14T00:00:00Z' },
    { actualProvider: 'deterministic-image', status: 'succeeded', latencyMs: 5, costUsd: 0, createdAt: '2026-07-14T00:00:00Z' },
    { actualProvider: 'deterministic-image', status: 'succeeded', latencyMs: 5, costUsd: 0, createdAt: '2026-07-14T00:00:00Z' },
  ];
  const rollup = rollupBenchmarks(runs, { minSamples: 3 });
  assert.equal(rollup['deterministic-image'].score, 100);
  assert.equal(rollup['deterministic-image'].n, 3);
});

test('accepts snake_case rows directly (Supabase RPC shape) with no mapping needed', () => {
  const runs = [
    { actual_model: 'claude-sonnet-5', status: 'succeeded', latency_ms: 500, cost_usd: 0.01, created_at: '2026-07-14T00:00:00Z' },
    { actual_model: 'claude-sonnet-5', status: 'succeeded', latency_ms: 500, cost_usd: 0.01, created_at: '2026-07-14T00:00:00Z' },
    { actual_model: 'claude-sonnet-5', status: 'succeeded', latency_ms: 500, cost_usd: 0.01, created_at: '2026-07-14T00:00:00Z' },
  ];
  const rollup = rollupBenchmarks(runs, { minSamples: 3 });
  assert.ok(rollup['claude-sonnet-5']);
  assert.equal(rollup['claude-sonnet-5'].score, 100);
});

test('qualityPerDollar ranks free/cheap high-quality models above expensive ones', () => {
  const rollup = {
    free: { score: 80, averageCostUsd: 0, averageLatencyMs: 100, n: 5 },
    pricey: { score: 90, averageCostUsd: 0.05, averageLatencyMs: 100, n: 5 },
  };
  const ranked = qualityPerDollar(rollup);
  assert.equal(ranked[0].model, 'free'); // $0 cost → Infinity quality-per-dollar
});
