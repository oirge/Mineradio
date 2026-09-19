'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const APP_SOURCE = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
const INDEX_SOURCE = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

/**
 * 按源码边界切出一段真实实现，防止测试跑的是复制版而不是线上代码。
 * @param {string} startMarker 起始标记。
 * @param {string} endMarker 结束标记。
 * @returns {string} 源码片段。
 */
function sliceSource(startMarker, endMarker) {
  const start = APP_SOURCE.indexOf(startMarker);
  assert.ok(start > 0, `missing start marker: ${startMarker}`);
  const end = APP_SOURCE.indexOf(endMarker, start);
  assert.ok(end > start, `missing end marker: ${endMarker}`);
  return APP_SOURCE.slice(start, end);
}

// 归一化 + 读取（含常量），从常量声明切到下一个偏好读取函数之前。
const HELPER_SOURCE = sliceSource(
  'var VOLUME_WHEEL_STEP_DEFAULT = 0.05;',
  'function readDiyModePreference() {'
);
// 步进设置 / 滚轮调整的完整实现块。
const STEP_SOURCE = sliceSource(
  '// ---- 滚轮音量步进（可自定义）----',
  '// ---- 滚轮音量步进结束 ----'
);

/**
 * 造一个跑真实滚轮步进实现的沙箱。
 * @param {object=} opts 初始化项：initTarget 初始音量、storeStep 预置存档步进（字符串）。
 * @returns {object} 沙箱句柄。
 */
function createSandbox(opts) {
  opts = opts || {};
  const store = Object.create(null);
  if (opts.storeStep != null) store['mineradio-volume-wheel-step-v1'] = String(opts.storeStep);
  const toasts = [];
  const setVolumeCalls = [];
  const localStorageStub = {
    getItem(key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
    setItem(key, value) { store[key] = String(value); },
    removeItem(key) { delete store[key]; },
  };
  const context = {
    console,
    JSON, Object, Array, String, Number, Math, Boolean, isFinite, parseFloat,
    localStorage: localStorageStub,
    setPersistentLocalStorageItem(key, value) { localStorageStub.setItem(key, value); },
    showToast(msg) { toasts.push(String(msg)); },
    clampRange(v, min, max) { return Math.max(min, Math.min(max, v)); },
    document: { getElementById() { return null; }, activeElement: null },
    VOLUME_WHEEL_STEP_STORE_KEY: 'mineradio-volume-wheel-step-v1',
  };
  const initTarget = typeof opts.initTarget === 'number' ? opts.initTarget : 0.5;
  vm.runInNewContext(`${HELPER_SOURCE}
var volumeWheelStep = readVolumeWheelStep();
var targetVolume = ${initTarget};
${STEP_SOURCE}
function setVolume(value, silent){ setVolumeCalls.push({ value: value, silent: silent }); targetVolume = value; }
this.normalizeVolumeWheelStep = normalizeVolumeWheelStep;
this.readVolumeWheelStep = readVolumeWheelStep;
this.setVolumeWheelStep = setVolumeWheelStep;
this.adjustVolumeByWheel = adjustVolumeByWheel;`, Object.assign(context, { setVolumeCalls }));
  return { context, store, toasts, setVolumeCalls };
}

test('步进归一化：越界夹紧、脏值回落默认、量化到 1%', () => {
  const h = createSandbox();
  assert.equal(h.context.normalizeVolumeWheelStep(0.05), 0.05);
  assert.equal(h.context.normalizeVolumeWheelStep(0.1), 0.1);
  assert.equal(h.context.normalizeVolumeWheelStep(0.9), 0.5, '超过 50% 夹到 0.5');
  assert.equal(h.context.normalizeVolumeWheelStep(0.001), 0.01, '低于 1% 夹到 0.01');
  assert.equal(h.context.normalizeVolumeWheelStep(0.123), 0.12, '量化到 1% 粒度');
  assert.equal(h.context.normalizeVolumeWheelStep(0), 0.05, '0 回落默认');
  assert.equal(h.context.normalizeVolumeWheelStep('abc'), 0.05, '脏值回落默认');
  assert.equal(h.context.normalizeVolumeWheelStep(null), 0.05);
});

test('读取存档：合法值读回，脏值回落默认', () => {
  assert.equal(createSandbox({ storeStep: '0.2' }).context.readVolumeWheelStep(), 0.2);
  assert.equal(createSandbox({ storeStep: 'oops' }).context.readVolumeWheelStep(), 0.05);
  assert.equal(createSandbox().context.readVolumeWheelStep(), 0.05, '无存档回落默认');
});

test('设置步进落盘到独立键，重启可读回', () => {
  const h = createSandbox();
  h.context.setVolumeWheelStep(0.1, { force: true });
  assert.equal(h.store['mineradio-volume-wheel-step-v1'], '0.1');
  assert.equal(h.context.readVolumeWheelStep(), 0.1);
});

test('设置步进可弹提示，按百分比展示', () => {
  const h = createSandbox();
  h.context.setVolumeWheelStep(0.15, { toast: true });
  assert.deepEqual(h.toasts, ['滚轮步进 15%']);
});

test('滚轮向上增音量、向下减音量，幅度为当前步进', () => {
  const h = createSandbox({ initTarget: 0.5, storeStep: '0.1' });
  h.context.adjustVolumeByWheel(-120); // 向上滚
  assert.equal(h.setVolumeCalls[0].value, 0.6);
  assert.equal(h.setVolumeCalls[0].silent, false, '滚轮调整要给反馈');
  h.context.adjustVolumeByWheel(120); // 向下滚
  assert.equal(h.setVolumeCalls[1].value, 0.5);
});

test('滚轮在边界夹紧到 0~1，零增量不动', () => {
  const top = createSandbox({ initTarget: 0.97, storeStep: '0.1' });
  top.context.adjustVolumeByWheel(-1);
  assert.equal(top.setVolumeCalls[0].value, 1, '上限夹到 1');
  const bottom = createSandbox({ initTarget: 0.05, storeStep: '0.1' });
  bottom.context.adjustVolumeByWheel(1);
  assert.equal(bottom.setVolumeCalls[0].value, 0, '下限夹到 0');
  const idle = createSandbox({ initTarget: 0.5 });
  idle.context.adjustVolumeByWheel(0);
  assert.equal(idle.setVolumeCalls.length, 0, 'deltaY 为 0 不调整');
});

test('步进调整后再滚轮，用的是新步进', () => {
  const h = createSandbox({ initTarget: 0.5 });
  h.context.setVolumeWheelStep(0.2, {});
  h.context.adjustVolumeByWheel(-1);
  assert.equal(h.setVolumeCalls[0].value, 0.7, '滚轮读的是刚改的步进');
});

test('音量弹层里挂了滚轮步进输入框', () => {
  assert.ok(/id="volume-wheel-step"/.test(INDEX_SOURCE), 'index.html 应有步进输入框');
  assert.ok(/class="vol-wheel-step"/.test(INDEX_SOURCE), '应有步进容器供滚轮判定放行');
});
