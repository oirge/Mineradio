'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');

function loadUpdateIconHarness() {
  const start = appSource.indexOf('function canRunUpdateIconBreathing() {');
  const end = appSource.indexOf('function updatePreviewContentSignature() {', start);
  assert.ok(start >= 0 && end > start, '更新入口动画生命周期接缝缺失');

  const ring = {};
  const entry = { querySelector(selector) { return selector === '.update-ring' ? ring : null; } };
  const timers = [];
  const calls = { kill: [], set: [], to: [] };
  let deepBackground = false;
  const state = {
    visible: true,
    updateAvailable: false,
    iconBreathing: false,
    iconBreathingTimer: null,
  };
  const context = {
    updatePreviewState: state,
    document: {
      hidden: false,
      getElementById(id) { return id === 'update-entry' ? entry : null; },
    },
    window: {
      gsap: {
        killTweensOf(target, props) { calls.kill.push({ target, props }); },
        set(target, vars) { calls.set.push({ target, vars }); },
        to(target, vars) { calls.to.push({ target, vars }); },
      },
    },
    isDeepBackgroundMode() { return deepBackground; },
    setTimeout(fn, delay) {
      const timer = { fn, delay, cleared: false };
      timers.push(timer);
      return timer;
    },
    clearTimeout(timer) { if (timer) timer.cleared = true; },
    Math,
    Number,
  };
  vm.runInNewContext(appSource.slice(start, end), context);
  return { context, state, timers, calls, setDeepBackground(value) { deepBackground = !!value; } };
}

test('没有可用更新时不启动永久 GSAP 呼吸动画', () => {
  const harness = loadUpdateIconHarness();
  harness.context.syncUpdateIconBreathing(760);
  assert.equal(harness.timers.length, 0);
  assert.equal(harness.calls.to.length, 0);
  assert.equal(harness.state.iconBreathing, false);
});

test('更新入口只在前台可见时持有动画并在后台释放', () => {
  const harness = loadUpdateIconHarness();
  harness.state.updateAvailable = true;
  harness.context.syncUpdateIconBreathing(180);
  assert.equal(harness.timers.length, 1);
  assert.equal(harness.timers[0].delay, 180);

  harness.timers[0].fn();
  assert.equal(harness.state.iconBreathing, true);
  assert.equal(harness.calls.to.length, 2);
  assert.equal(harness.calls.to[0].vars.repeat, -1);
  assert.equal(harness.calls.to[1].vars.repeat, -1);

  harness.context.document.hidden = true;
  harness.setDeepBackground(true);
  harness.context.syncUpdateIconBreathing(0);
  assert.equal(harness.state.iconBreathing, false);
  assert.ok(harness.calls.kill.some((call) => call.props === 'y,boxShadow'));
  assert.ok(harness.calls.kill.some((call) => call.props === 'rotate'));
});

test('预览进度定时器在关闭面板和进入后台时显式释放', () => {
  assert.match(appSource, /function closeUpdatePanel\(\) \{[\s\S]*?stopUpdatePreviewSimulation\(true\);/);
  assert.match(appSource, /if \(sleeping && updatePreviewState\.timer\) \{[\s\S]*?stopUpdatePreviewSimulation\(true\);/);
  assert.match(appSource, /function stopUpdatePreviewSimulation\(resetState\) \{[\s\S]*?clearInterval\(updatePreviewState\.timer\);[\s\S]*?updatePreviewState\.timer = null;/);
});
