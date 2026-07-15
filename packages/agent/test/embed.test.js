import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MOUNT_MODES, resolveMountMode, coversAppChrome, Z_LAYERS, MOBILE_MAX_WIDTH,
} from '../src/index.js';

test('mobile ALWAYS resolves to fullscreen, overriding any requested mode (the founder rule)', () => {
  assert.equal(resolveMountMode({ viewportWidth: 375, requested: MOUNT_MODES.PANEL }), MOUNT_MODES.FULLSCREEN);
  assert.equal(resolveMountMode({ viewportWidth: MOBILE_MAX_WIDTH, requested: MOUNT_MODES.INLINE }), MOUNT_MODES.FULLSCREEN);
});

test('desktop honors the requested mode, defaulting to inline', () => {
  assert.equal(resolveMountMode({ viewportWidth: 1280, requested: MOUNT_MODES.PANEL }), MOUNT_MODES.PANEL);
  assert.equal(resolveMountMode({ viewportWidth: 1280 }), MOUNT_MODES.INLINE);
  assert.equal(resolveMountMode({ viewportWidth: 1280, requested: 'garbage' }), MOUNT_MODES.INLINE);
});

test('fullscreen covers app chrome; a panel does not', () => {
  assert.equal(coversAppChrome(MOUNT_MODES.FULLSCREEN), true);
  assert.equal(coversAppChrome(MOUNT_MODES.PANEL), false);
});

test('the stacking contract puts fullscreen Core above the nav and the copilot', () => {
  assert.ok(Z_LAYERS.CORE_FULLSCREEN > Z_LAYERS.COPILOT);
  assert.ok(Z_LAYERS.COPILOT > Z_LAYERS.APP_NAV);
});
