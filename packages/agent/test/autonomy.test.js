import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  autonomyGate, isAuthorizedInvocation, AUTH_MODES, AUTONOMY, missionBudget, toolByName,
} from '../src/index.js';

const img = toolByName('generate_image');       // sponsored, autonomy-safe, no side-effect
const office = toolByName('consult_office');     // economy, NOT autonomy-safe
const analyze = toolByName('analyze');           // confidential, cost 0

test('on-demand (human present): a safe sponsored tool just runs', () => {
  const g = autonomyGate({ tool: img, autonomyLevel: AUTONOMY.ON_DEMAND });
  assert.equal(g.allowed, true);
  assert.equal(g.needsApproval, false);
});

test('headless mission: a non-autonomy-safe tool is withheld for a human, not run', () => {
  const g = autonomyGate({ tool: office, autonomyLevel: AUTONOMY.SCHEDULED });
  assert.equal(g.allowed, false);
  assert.equal(g.needsApproval, true);
  assert.match(g.reason, /not-autonomy-safe/);
});

test('a standing grant lets a headless mission run an otherwise-withheld tool', () => {
  const g = autonomyGate({ tool: office, autonomyLevel: AUTONOMY.AUTOPILOT, granted: true });
  assert.equal(g.allowed, true);
});

test('budget ceiling refuses outright (hard breach, no approval path)', () => {
  const g = autonomyGate({ tool: img, budget: missionBudget({ maxTotalCalls: 0 }) });
  assert.equal(g.allowed, false);
  assert.match(g.reason, /^budget:/);
});

test('confidential analyze at Tier 0 is allowed (stays local); it would break only if external', () => {
  const g = autonomyGate({ tool: analyze, autonomyLevel: AUTONOMY.ON_DEMAND });
  assert.equal(g.allowed, true); // costClass 0 = on-device, governance satisfied
});

test('invocation auth: operator path needs a JWT; internal path needs the secret AND real autonomy', () => {
  assert.equal(isAuthorizedInvocation({ mode: AUTH_MODES.OPERATOR, hasOperatorJwt: true }).ok, true);
  assert.equal(isAuthorizedInvocation({ mode: AUTH_MODES.OPERATOR, hasOperatorJwt: false }).ok, false);

  // the ADR-0004 headless path
  assert.equal(isAuthorizedInvocation({ mode: AUTH_MODES.INTERNAL, hasInternalSecret: true, autonomyLevel: AUTONOMY.SCHEDULED }).ok, true);
  assert.equal(isAuthorizedInvocation({ mode: AUTH_MODES.INTERNAL, hasInternalSecret: false, autonomyLevel: AUTONOMY.SCHEDULED }).ok, false);
  // an on-demand call must NOT use the headless secret path
  assert.equal(isAuthorizedInvocation({ mode: AUTH_MODES.INTERNAL, hasInternalSecret: true, autonomyLevel: AUTONOMY.ON_DEMAND }).ok, false);
  assert.equal(isAuthorizedInvocation({ mode: 'anything-else' }).ok, false);
});
