'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Run the production gesture module with a camera boundary; the actual pose/action logic is unchanged.
function harness() {
  const calls = [], cameras = [];
  const canvas = { width: 0, height: 0, style: {}, classList: { toggle() {}, remove() {} }, getContext: () => ({ setTransform() {}, clearRect() {} }) };
  const context = { console: { warn() {} }, performance: { now: () => context.now }, now: 1000,
    setTimeout, clearTimeout, innerWidth: 1440, innerHeight: 900, devicePixelRatio: 1,
    window: { addEventListener() {} }, document: { hidden: false, addEventListener() {}, activeElement: null,
      body: { classList: { contains: () => false }, appendChild() {} },
      querySelector: () => null, querySelectorAll: () => [],
      createElement: () => ({ style: {}, remove() {} }),
      getElementById: id => id === 'hand-canvas' ? canvas : { textContent: '', style: {}, classList: { add() {}, remove() {}, toggle() {} } } },
    fx: { cam: 'gesture', gesturePlayerActions: true, gestureHandOverlay: true, gestureSensitivity: 'balanced', performanceQuality: 'eco', particleLyrics: true },
    uniforms: { uHandActive: { value: 0 }, uGestureGrip: { value: 0 } },
    targetVolume: 0.4, showToast() {}, saveLyricLayout() {}, loadScriptOnce: async () => {},
    togglePlay: () => calls.push('play'), toggleLikeCurrent: () => calls.push('like'),
    setParticleLyricsSilently: value => { context.fx.particleLyrics = value; calls.push('lyrics'); },
    nextTrack: () => calls.push('next'), prevTrack: () => calls.push('previous'),
    setVolume: value => calls.push(value),
    Hands: function () { this.setOptions = () => {}; this.onResults = () => {}; this.send = async () => {}; this.close = () => {}; },
    Camera: function (_video, options) { cameras.push(options); this.start = async () => {}; this.stop = () => {}; },
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/gesture-controls.js'), 'utf8'), context);
  context.showGestureHUD = () => {};
  context.gestureActive = true;
  return { context, calls, cameras };
}
function landmarks(fingers, thumb = false) {
  const points = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.65, z: 0 }));
  for (let finger = 0; finger < 4; finger++) {
    const mcp = 5 + finger * 4, x = 0.42 + finger * 0.06;
    points[mcp] = { x, y: 0.65 }; points[mcp + 1] = { x, y: 0.5 };
    points[mcp + 3] = { x, y: fingers.includes(finger) ? 0.25 : 0.66 };
  }
  points[4] = { x: 0.5, y: thumb ? 0.25 : 0.64 };
  return points;
}
test('real landmark poses distinguish play, like, lyrics and volume', () => {
  const { context: g } = harness();
  for (const [fingers, thumb, expected] of [[[0, 1], false, 'play'], [[], true, 'like'], [[0, 1, 2], false, 'lyrics'], [[0], false, 'volume']]) {
    const lm = landmarks(fingers, thumb), palm = g.palmCenter(lm);
    assert.equal(g.classifyGesturePlayerPose(lm, palm, g.gestureLandmarkDistance(lm[4], lm[8])), expected);
  }
});
test('held poses fire once, respect cooldown and route to the actual player actions', () => {
  const { context: g, calls } = harness();
  for (const [i, fingers, thumb, expected] of [[0, [0, 1], false, 'play'], [1, [], true, 'like'], [2, [0, 1, 2], false, 'lyrics']]) {
    const lm = landmarks(fingers, thumb), palm = g.palmCenter(lm), t = 1000 + i * 4000;
    g.resetGesturePlayerActionState(false);
    for (const offset of [0, 639, 640, 2000]) g.updateGesturePlayerActions(lm, palm, 0.5, 0.2, false, false, t + offset);
    assert.equal(calls.filter(action => action === expected).length, 1);
  }
  assert.equal(g.fx.particleLyrics, false);
});
test('horizontal swipes change tracks while vertical movement does not', () => {
  const { context: g, calls } = harness();
  const profile = g.gestureSensitivityProfile();
  g.updateGestureSwipeAction({ x: 0.6, y: 0.4 }, 0.9, 1000, profile);
  g.updateGestureSwipeAction({ x: 0.2, y: 0.4 }, 0.9, 1200, profile);
  assert.deepEqual(calls, ['next']);
  g.resetGesturePlayerActionState(false);
  g.updateGestureSwipeAction({ x: 0.4, y: 0.4 }, 0.9, 3000, profile);
  g.updateGestureSwipeAction({ x: 0.8, y: 0.7 }, 0.9, 3200, profile);
  assert.deepEqual(calls, ['next']);
  g.resetGesturePlayerActionState(false);
  g.updateGestureSwipeAction({ x: 0.2, y: 0.4 }, 0.9, 5000, profile);
  g.updateGestureSwipeAction({ x: 0.6, y: 0.4 }, 0.9, 5200, profile);
  assert.deepEqual(calls, ['next', 'previous']);
});
test('volume arms after holding, clamps and throttles continuous movement', () => {
  const { context: g, calls } = harness();
  const lm = landmarks([0]);
  const origin = g.palmCenter(lm);
  const move = (y, at) => g.updateGesturePlayerActions(
    lm.map(point => ({ ...point, y: point.y + y - origin.y })),
    { x: origin.x, y }, 0.5, 0.2, false, false, at);
  move(0.6, 1000);
  move(0.6, 1470);
  move(0.4, 1500);
  assert.deepEqual(calls, [0.4]);
  move(0.0, 1600);
  assert.deepEqual(calls, [0.4, 1]);
});
test('typing and open dialogs suppress player gestures', () => {
  const { context: g } = harness();
  g.document.activeElement = { tagName: 'INPUT' };
  assert.equal(g.gesturePlayerActionsAllowed(), false);
  g.document.activeElement = null;
  g.document.querySelector = () => ({});
  assert.equal(g.gesturePlayerActionsAllowed(), false);
});
test('inference does not reenter and a rejected frame leaves the next frame usable', async () => {
  const { context: g, cameras } = harness();
  g.gestureActive = false;
  assert.equal(await g.startGestureControl(), true);
  let release, sends = 0;
  g.gestureHands.send = () => { sends++; return new Promise(resolve => { release = resolve; }); };
  const pending = cameras[0].onFrame();
  await cameras[0].onFrame();
  assert.equal(sends, 1);
  release(); await pending;
  g.now += 100;
  g.gestureHands.send = async () => { throw new Error('frame'); };
  await cameras[0].onFrame();
  assert.equal(g.gestureInferenceBusy, false);
  g.now += 100;
  g.gestureHands.send = async () => { sends++; };
  await cameras[0].onFrame();
  assert.equal(sends, 2);
  g.stopGestureControl();
});
