import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  modelSpec, selectModel, escalationLadder, nextCostClass,
  allowedCostClasses, isRouteAllowed, budgetGuard, missionBudget, requiresApproval,
  sovereignCompletionRate, capoEconomics, runRecord, COST_CLASS,
} from '../src/index.js';

// a tiny registry spanning all four tiers
const REG = [
  modelSpec({ id: 'qwen4b', provider: 'webllm', costClass: 0, subtier: '0C', execution: 'browser', capabilities: { chat: 1, json: 1, jsonSchema: 1, reasoning: 1, code: 1 }, dataClasses: ['public', 'internal', 'confidential', 'restricted'], vramRequiredMB: 3500 }).spec,
  modelSpec({ id: 'gemini-free', provider: 'gemini', costClass: 1, execution: 'external-api', capabilities: { chat: 1, json: 1, jsonSchema: 1, tools: 1, reasoning: 1 }, dataClasses: ['public', 'internal'] }).spec,
  modelSpec({ id: 'deepseek', provider: 'deepseek', costClass: 2, execution: 'external-api', capabilities: { chat: 1, json: 1, reasoning: 1, code: 1 }, dataClasses: ['public', 'internal'], pricing: { inputUsdPerMillion: 0.14, outputUsdPerMillion: 0.28 } }).spec,
  modelSpec({ id: 'claude', provider: 'anthropic', costClass: 3, execution: 'external-api', capabilities: { chat: 1, json: 1, jsonSchema: 1, tools: 1, reasoning: 1, code: 1 }, dataClasses: ['public', 'internal'], pricing: { inputUsdPerMillion: 3, outputUsdPerMillion: 15 } }).spec,
];

test('cheapest capable wins: public classify → Tier 0 local', () => {
  const { model } = selectModel(REG, { task: 'classify', dataClass: 'public', runtime: { webgpu: true, vramMB: 8000 } });
  assert.equal(model.costClass, COST_CLASS.SOVEREIGN);
  assert.equal(model.id, 'qwen4b');
});

test('restricted data → local only, never external-api', () => {
  const { model } = selectModel(REG, { task: 'summarize', dataClass: 'restricted', runtime: { webgpu: true, vramMB: 8000 } });
  assert.equal(model.execution, 'browser'); // local
  assert.equal(model.costClass, 0);
  // and the governance predicate blocks any external model on restricted data
  assert.equal(isRouteAllowed(REG.find(m => m.id === 'claude'), 'restricted'), false);
});

test('confidential data → Tier 0 unless enterprise-approved', () => {
  assert.deepEqual([...allowedCostClasses('confidential')], [0]);
  assert.ok(allowedCostClasses('confidential', { enterprisePaidApproved: true }).has(2));
});

test('high-risk task enforces a paid floor: legal-review min = Frontier', () => {
  const ladder = escalationLadder('legal-review');
  assert.deepEqual(ladder, [3, 'human']);
  // restricted registry (no frontier for this data) → no model, must escalate to human
  const { model } = selectModel(REG, { task: 'legal-review', dataClass: 'public' });
  assert.equal(model.costClass, 3);
});

test('escalation walks up within the band, then human', () => {
  assert.equal(nextCostClass(0, 'analyze'), 1);
  assert.equal(nextCostClass(3, 'analyze'), null); // capped at max
  assert.equal(nextCostClass(1, 'classify'), null); // classify max = 1
});

test('budget guard blocks over-budget frontier calls', () => {
  const b = missionBudget({ maxCostUsd: 0.5, maxFrontierCalls: 0 });
  const running = { costUsd: 0, frontierCalls: 0, totalCalls: 0, tokens: 0 };
  const r = budgetGuard(b, running, { costClass: 3, costUsd: 0.2, tokens: 1000 });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'maxFrontierCalls');
});

test('approval required for frontier + restricted + high-risk', () => {
  assert.equal(requiresApproval({ costClass: 3, dataClass: 'public', task: 'brief' }).required, true);
  assert.equal(requiresApproval({ costClass: 0, dataClass: 'restricted', task: 'summarize' }).required, true);
  assert.equal(requiresApproval({ costClass: 0, dataClass: 'public', task: 'summarize' }).required, false);
});

test('metering: sovereign completion rate + CAPO economics', () => {
  const runs = [
    runRecord({ actualCostClass: 0, status: 'succeeded', validationResult: { passed: true } }),
    runRecord({ actualCostClass: 0, status: 'succeeded', validationResult: { passed: true } }),
    runRecord({ actualCostClass: 2, status: 'succeeded', costUsd: 0.01, fallbackFrom: 0 }),
    runRecord({ actualCostClass: 3, status: 'succeeded', costUsd: 0.2 }),
  ];
  const scr = sovereignCompletionRate(runs);
  assert.equal(scr.rate, 0.5);
  const capo = capoEconomics(runs);
  assert.equal(capo.mix.sovereign, 2);
  assert.ok(Math.abs(capo.costUsd - 0.21) < 1e-9);
  assert.equal(capo.escalationRate, 0.25);
});
