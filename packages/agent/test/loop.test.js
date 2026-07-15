import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runAgentLoop, missionBudget, AUTONOMY, toOpenAITools, availableTools } from '../src/index.js';

// A scripted model: yields a queue of responses, one per callModel invocation.
const scriptModel = (responses) => {
  let i = 0;
  return async () => responses[Math.min(i++, responses.length - 1)];
};
const tools = toOpenAITools(availableTools());

test('answers directly when the model returns no tool calls', async () => {
  const out = await runAgentLoop({
    messages: [{ role: 'user', content: 'hi' }], tools,
    callModel: scriptModel([{ text: 'hello', provider: 'cloudflare-llama', costUsd: 0 }]),
    executeTool: async () => ({}),
  });
  assert.equal(out.stopReason, 'answered');
  assert.equal(out.text, 'hello');
});

test('calls a tool, reads the result, then answers — the core agentic step', async () => {
  const executed = [];
  const out = await runAgentLoop({
    messages: [{ role: 'user', content: 'make art' }], tools,
    callModel: scriptModel([
      { text: '', provider: 'cloudflare-llama', costUsd: 0, toolCalls: [{ id: 'c1', name: 'generate_image', args: { prompt: 'a fox' } }] },
      { text: 'here is your art', provider: 'cloudflare-llama', costUsd: 0 },
    ]),
    executeTool: async (name, args) => { executed.push([name, args]); return { assetId: 'a1', costUsd: 0 }; },
  });
  assert.equal(out.stopReason, 'answered');
  assert.equal(out.text, 'here is your art');
  assert.deepEqual(executed[0], ['generate_image', { prompt: 'a fox' }]);
  const toolTrail = out.trail.filter((t) => t.type === 'tool' && !t.blocked);
  assert.equal(toolTrail[0].name, 'generate_image');
});

test('honest degrade: a mock provider stops the loop with no-model, never fakes an answer', async () => {
  const out = await runAgentLoop({
    messages: [{ role: 'user', content: 'hi' }], tools,
    callModel: scriptModel([{ text: 'THIS SHOULD NOT SHOW', provider: 'mock' }]),
    executeTool: async () => ({}),
  });
  assert.equal(out.stopReason, 'no-model');
  assert.equal(out.text, '');
});

test('bounded: a model that always calls tools stops at max-steps, not forever', async () => {
  let calls = 0;
  const out = await runAgentLoop({
    messages: [{ role: 'user', content: 'loop' }], tools, maxSteps: 3,
    callModel: async () => { calls++; return { text: '', provider: 'cloudflare-llama', costUsd: 0, toolCalls: [{ id: `c${calls}`, name: 'check_quota', args: {} }] }; },
    executeTool: async () => ({ used: 1 }),
  });
  assert.equal(out.stopReason, 'max-steps');
  assert.equal(calls, 3);
});

test('budget: the loop stops when a tool call would bust the mission cost ceiling', async () => {
  const out = await runAgentLoop({
    messages: [{ role: 'user', content: 'spend' }], tools,
    budget: missionBudget({ maxTotalCalls: 1 }), // one model call allowed, the tool step busts it
    callModel: scriptModel([
      { text: '', provider: 'cloudflare-llama', costUsd: 0, toolCalls: [{ id: 'c1', name: 'generate_image', args: { prompt: 'x' } }] },
    ]),
    executeTool: async () => ({ costUsd: 0 }),
  });
  assert.equal(out.stopReason, 'budget');
});

test('headless autonomy: a non-autonomy-safe tool is blocked mid-loop and the model is told, not crashed', async () => {
  let executed = false;
  const out = await runAgentLoop({
    messages: [{ role: 'user', content: 'consult' }], tools: toOpenAITools(availableTools()),
    autonomyLevel: AUTONOMY.SCHEDULED,
    callModel: scriptModel([
      { text: '', provider: 'cloudflare-llama', costUsd: 0, toolCalls: [{ id: 'c1', name: 'consult_office', args: { office: 'treasury', question: 'runway?' } }] },
      { text: 'ok, flagged for you', provider: 'cloudflare-llama', costUsd: 0 },
    ]),
    executeTool: async () => { executed = true; return {}; },
  });
  assert.equal(executed, false); // the withheld tool never ran
  const blocked = out.trail.find((t) => t.type === 'tool' && t.blocked);
  assert.ok(blocked && blocked.needsApproval);
  assert.equal(out.stopReason, 'answered');
});

test('a thrown executor is caught, fed back as an error result, and does not kill the turn', async () => {
  const out = await runAgentLoop({
    messages: [{ role: 'user', content: 'x' }], tools,
    callModel: scriptModel([
      { text: '', provider: 'cloudflare-llama', costUsd: 0, toolCalls: [{ id: 'c1', name: 'check_ledger', args: {} }] },
      { text: 'recovered', provider: 'cloudflare-llama', costUsd: 0 },
    ]),
    executeTool: async () => { throw new Error('rpc down'); },
  });
  assert.equal(out.stopReason, 'answered');
  const t = out.trail.find((e) => e.type === 'tool' && e.name === 'check_ledger');
  assert.equal(t.ok, false);
});
