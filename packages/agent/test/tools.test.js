import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TOOL_SPECS, toolByName, availableTools, toOpenAITools, toAnthropicTools,
} from '../src/index.js';

test('every tool spec carries the full governance contract', () => {
  for (const t of TOOL_SPECS) {
    assert.equal(typeof t.name, 'string');
    assert.ok(t.params && t.params.type === 'object', `${t.name} params`);
    assert.ok(t.costClass >= 0 && t.costClass <= 3, `${t.name} costClass`);
    assert.ok(['public', 'internal', 'confidential', 'restricted'].includes(t.dataClass), `${t.name} dataClass`);
    assert.equal(typeof t.sideEffect, 'boolean');
    assert.equal(typeof t.autonomySafe, 'boolean');
  }
});

test('analyze is confidential (real revenue data never leaves the device)', () => {
  assert.equal(toolByName('analyze').dataClass, 'confidential');
});

test('consult_office is NOT autonomy-safe (a human should see a delegation)', () => {
  assert.equal(toolByName('consult_office').autonomySafe, false);
});

test('availableTools filters by cost ceiling and hides non-autonomy-safe tools from headless missions', () => {
  const sponsoredOnly = availableTools(TOOL_SPECS, { maxCostClass: 1 });
  assert.ok(sponsoredOnly.every((t) => t.costClass <= 1));
  assert.ok(sponsoredOnly.some((t) => t.name === 'generate_image'));

  const autonomous = availableTools(TOOL_SPECS, { autonomous: true });
  assert.ok(autonomous.every((t) => t.autonomySafe));
  assert.ok(!autonomous.some((t) => t.name === 'consult_office')); // not offered to a headless run
});

test('provider translators emit valid OpenAI + Anthropic tool shapes and drop governance metadata', () => {
  const oa = toOpenAITools([toolByName('generate_image')]);
  assert.equal(oa[0].type, 'function');
  assert.equal(oa[0].function.name, 'generate_image');
  assert.equal(oa[0].function.costClass, undefined); // metadata not leaked to the model
  const an = toAnthropicTools([toolByName('generate_image')]);
  assert.equal(an[0].name, 'generate_image');
  assert.ok(an[0].input_schema.properties.prompt);
});
