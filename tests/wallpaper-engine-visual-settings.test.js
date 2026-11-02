'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { WallpaperEngineRuntime } = require('../desktop/wallpaper-engine-runtime');

// Exercise the real session and native helper protocol; no installed wallpaper is required.
function harness(ready = true) {
  const runtime = new WallpaperEngineRuntime({ desktopCapturer: {} });
  const writes = [];
  runtime.active = { sessionId: 'a'.repeat(24), dwmSurfaceReady: ready,
    dwmSurfaceProcess: { stdin: { write(value) { writes.push(value); } } } };
  return { runtime, writes };
}
test('WE visual settings are sent together to the active native surface', () => {
  const { runtime, writes } = harness();
  assert.equal(runtime.updateDwmVisualSettings('a'.repeat(24), { opacity: 0.7, positionX: -0.2, positionY: 0.3, scale: 1.3 }), true);
  assert.deepEqual(writes, ['V|179|-200000|300000|1300000\n']);
  assert.equal(runtime.active.dwmVisualOpacity, 0.7);
});
test('WE rejects stale-session changes without altering the current surface', () => {
  const { runtime, writes } = harness();
  assert.equal(runtime.updateDwmVisualSettings('b'.repeat(24), { opacity: 0.2 }), false);
  assert.equal(runtime.active.dwmVisualOpacity, undefined);
  assert.deepEqual(writes, []);
});
test('WE clamps picture settings and retains them before the surface is ready', () => {
  const { runtime, writes } = harness(false);
  assert.equal(runtime.updateDwmVisualSettings('a'.repeat(24), { opacity: 0.01, positionX: 2, positionY: -2, scale: 4 }), false);
  assert.equal(runtime.active.dwmVisualOpacity, 0.15);
  assert.equal(runtime.active.dwmVisualPositionX, 0.5);
  assert.equal(runtime.active.dwmVisualPositionY, -0.5);
  assert.equal(runtime.active.dwmVisualScale, 1.6);
  assert.deepEqual(writes, []);
});
test('WE tolerates a helper that has closed its input', () => {
  const { runtime } = harness();
  runtime.active.dwmSurfaceProcess.stdin.destroyed = true;
  assert.equal(runtime.updateDwmVisualSettings('a'.repeat(24), {}), false);
});
