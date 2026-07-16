import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MOUNT_MODES, resolveMountMode, coversAppChrome, Z_LAYERS, MOBILE_MAX_WIDTH,
} from '../src/index.js';

test('mobile ALWAYS resolves to fullscreen, overriding any requested mode (the founder rule)', () => {
  assert.equal(resolveMountMode({ viewportWidth: 375, requested: MOUNT_MODES.PANEL }), MOUNT_MODES.FULLSCREEN);
  assert.equal(resolveMountMode({ viewportWidth: MOBILE_MAX_WIDTH, requested: MOUNT_MODES.INLINE }), MOUNT_MODES.FULLSCREEN);
});

test('the tablet band (641–980) is fullscreen too — matches the ≤980 app dock (2026-07-16 correction)', () => {
  // regression: at 900px the Core used to mount INLINE with the dock visible;
  // the breakpoint now tracks the app's mobile nav so fullscreen covers the dock.
  assert.equal(MOBILE_MAX_WIDTH, 980);
  assert.equal(resolveMountMode({ viewportWidth: 900, requested: MOUNT_MODES.INLINE }), MOUNT_MODES.FULLSCREEN);
  assert.equal(resolveMountMode({ viewportWidth: 980 }), MOUNT_MODES.FULLSCREEN);
});

test('desktop honors the requested mode, defaulting to inline', () => {
  assert.equal(resolveMountMode({ viewportWidth: 1280, requested: MOUNT_MODES.PANEL }), MOUNT_MODES.PANEL);
  assert.equal(resolveMountMode({ viewportWidth: 1280 }), MOUNT_MODES.INLINE);
  assert.equal(resolveMountMode({ viewportWidth: 1280, requested: 'garbage' }), MOUNT_MODES.INLINE);
  assert.equal(resolveMountMode({ viewportWidth: 1000 }), MOUNT_MODES.INLINE); // just above the band
});

test('fullscreen covers app chrome; a panel does not', () => {
  assert.equal(coversAppChrome(MOUNT_MODES.FULLSCREEN), true);
  assert.equal(coversAppChrome(MOUNT_MODES.PANEL), false);
});

test('the stacking contract puts fullscreen Core above the nav and the copilot', () => {
  assert.ok(Z_LAYERS.CORE_FULLSCREEN > Z_LAYERS.COPILOT);
  assert.ok(Z_LAYERS.COPILOT > Z_LAYERS.APP_NAV);
});
