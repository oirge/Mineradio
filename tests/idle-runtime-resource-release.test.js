'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');

function extractFunction(name) {
  const marker = `function ${name}(`;
  const start = appSource.indexOf(marker);
  assert.notEqual(start, -1, `缺少函数 ${name}`);
  const bodyStart = appSource.indexOf('{', start);
  let depth = 0;
  for (let i = bodyStart; i < appSource.length; i += 1) {
    if (appSource[i] === '{') depth += 1;
    else if (appSource[i] === '}') {
      depth -= 1;
      if (depth === 0) return appSource.slice(start, i + 1);
    }
  }
  throw new Error(`函数 ${name} 未闭合`);
}

test('关闭的空场背景不分配全屏 Canvas 或启动轮询', () => {
  const canvas = { width: 300, height: 150 };
  let activated = 0;
  const context = {
    idleGuideCanvas: null,
    IDLE_GUIDE_BACKGROUND_ENABLED: false,
    document: { getElementById() { return canvas; } },
    ensureIdleGuideCanvasActive() { activated += 1; }
  };
  vm.runInNewContext(`${extractFunction('initIdleGuideCanvas')}\ninitIdleGuideCanvas();`, context);
  assert.equal(canvas.width, 1);
  assert.equal(canvas.height, 1);
  assert.equal(activated, 0);
  assert.match(appSource, /if \(IDLE_GUIDE_BACKGROUND_ENABLED\) \{\s*ensureIdleGuideCanvasActive\(\);/);
});

test('空场 Canvas 释放完整 backing store 监听和调度所有权', () => {
  const cancelledFrames = [];
  const clearedTimers = [];
  const removed = [];
  const canvas = { width: 1600, height: 900 };
  const context = {
    idleGuideDelayTimer: 7,
    idleGuideFrameId: 9,
    idleGuideResizeBound: true,
    idleGuideCtx: { clearRect() {} },
    idleGuideW: 1600,
    idleGuideH: 900,
    idleGuideDpr: 1,
    idleGuideCanvasActive: true,
    idleGuideParticles: [1, 2, 3],
    idleGuideCanvas: canvas,
    clearTimeout(id) { clearedTimers.push(id); },
    cancelAnimationFrame(id) { cancelledFrames.push(id); },
    window: { removeEventListener(type, callback) { removed.push([type, callback]); } },
    resizeIdleGuideCanvas() {},
    resetIdleGuideTrails() {},
    setIdleGuideVisible() {}
  };
  vm.runInNewContext(`${extractFunction('releaseIdleGuideCanvasResources')}\nreleaseIdleGuideCanvasResources();`, context);
  assert.deepEqual(clearedTimers, [7]);
  assert.deepEqual(cancelledFrames, [9]);
  assert.equal(removed.length, 1);
  assert.equal(removed[0][0], 'resize');
  assert.equal(canvas.width, 1);
  assert.equal(canvas.height, 1);
  assert.equal(context.idleGuideParticles.length, 0);
  assert.equal(context.idleGuideCanvasActive, false);
  assert.equal(context.idleGuideCtx, null);
  assert.equal(context.idleGuideW, 0);
  assert.equal(context.idleGuideH, 0);
});

test('空场 Canvas RAF 调度保持单飞', () => {
  const requested = [];
  const context = {
    idleGuideCanvasActive: true,
    idleGuideCtx: {},
    idleGuideDelayTimer: null,
    idleGuideFrameId: 0,
    clearTimeout() {},
    setTimeout() { throw new Error('本测试不应进入延迟分支'); },
    requestAnimationFrame(callback) { requested.push(callback); return requested.length; },
    drawIdleGuideFrame() {}
  };
  vm.runInNewContext(extractFunction('scheduleIdleGuideFrame'), context);
  context.scheduleIdleGuideFrame(0);
  context.scheduleIdleGuideFrame(0);
  assert.equal(requested.length, 1);
  assert.equal(context.idleGuideFrameId, 1);
});

test('UI 提示音空闲后只释放当前 AudioContext 和 noise pool', () => {
  let closed = 0;
  const owned = { close() { closed += 1; return Promise.resolve(); } };
  const stale = { close() { throw new Error('旧 context 不得关闭新 context'); } };
  const context = {
    uiSfxCtx: owned,
    uiSfxNoiseBuffers: [1, 2, 3, 4, 5, 6],
    uiSfxNoiseCtx: owned,
    uiSfxNoiseSampleRate: 48000,
    uiSfxNoiseCursor: 4
  };
  vm.runInNewContext(extractFunction('releaseUiSfxContext'), context);
  assert.equal(context.releaseUiSfxContext(stale), false);
  assert.equal(closed, 0);
  assert.equal(context.releaseUiSfxContext(owned), true);
  assert.equal(closed, 1);
  assert.equal(context.uiSfxCtx, null);
  assert.equal(context.uiSfxNoiseBuffers, null);
  assert.equal(context.uiSfxNoiseCtx, null);
  assert.equal(context.uiSfxNoiseSampleRate, 0);
  assert.equal(context.uiSfxNoiseCursor, 0);
  assert.match(appSource, /scheduleUiSfxContextRelease\(ctx\);/);
  assert.match(appSource, /var UI_SFX_IDLE_RELEASE_MS = 5000;/);
});
