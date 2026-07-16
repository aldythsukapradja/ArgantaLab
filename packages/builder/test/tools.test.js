import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUILDER_TOOL_SPECS, builderToolByName } from '../src/index.js';

// The ToolSpec shape @arganta/agent's registry requires. Asserted inline (not
// via a cross-package import) so this runs under node --test without needing
// the new package symlinked — the shape IS the contract either way.
const REQUIRED_FIELDS = ['name', 'title', 'description', 'params', 'backing', 'costClass', 'dataClass', 'sideEffect', 'autonomySafe'];

test('every builder tool spec conforms to the @arganta/agent ToolSpec shape', () => {
  for (const t of BUILDER_TOOL_SPECS) {
    for (const f of REQUIRED_FIELDS) assert.ok(f in t, `${t.name} missing ${f}`);
    assert.equal(t.backing, 'builder');
    assert.ok(t.params && t.params.type === 'object', `${t.name} params must be a JSON-Schema object`);
    assert.ok(t.costClass >= 0 && t.costClass <= 3);
    assert.ok(['public', 'internal', 'confidential', 'restricted'].includes(t.dataClass));
    assert.equal(typeof t.sideEffect, 'boolean');
    assert.equal(typeof t.autonomySafe, 'boolean');
  }
});

test('publish_artifact is the ONLY side-effecting builder tool, and it is NOT autonomy-safe (ADR-0005)', () => {
  const sideEffecting = BUILDER_TOOL_SPECS.filter((t) => t.sideEffect);
  assert.equal(sideEffecting.length, 1);
  assert.equal(sideEffecting[0].name, 'publish_artifact');
  assert.equal(sideEffecting[0].autonomySafe, false); // a headless mission can never publish founder HTML to the internet
});

test('create/revise are autonomy-safe (non-publishing drafts) but publish/restore governance holds', () => {
  assert.equal(builderToolByName('create_website').autonomySafe, true);
  assert.equal(builderToolByName('create_application').autonomySafe, true);
  assert.equal(builderToolByName('create_game').autonomySafe, true);
  assert.equal(builderToolByName('revise_artifact').autonomySafe, true);
  assert.equal(builderToolByName('publish_artifact').autonomySafe, false);
});

test('GB-1: create_game matches its create_* siblings exactly — a real generation, draft-only', () => {
  const game = builderToolByName('create_game');
  const app = builderToolByName('create_application');
  assert.ok(game, 'create_game must exist');
  assert.equal(game.costClass, app.costClass);   // real AI generation, same tier
  assert.equal(game.dataClass, app.dataClass);
  assert.equal(game.sideEffect, false);          // never reaches the outside world
  assert.deepEqual(game.params.required, ['brief']);
});

test('deterministic tools (validate/save/restore/insert/apply) are costClass 0', () => {
  for (const name of ['validate_artifact', 'save_version', 'restore_version', 'insert_component', 'apply_brand']) {
    assert.equal(builderToolByName(name).costClass, 0, name);
  }
});
