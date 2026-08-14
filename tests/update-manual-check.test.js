'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
const htmlSource = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const cssSource = fs.readFileSync(path.join(root, 'public', 'app.css'), 'utf8');

function loadUpdateCheckHarness() {
  const start = appSource.indexOf('function updateCheckFailureReason(data) {');
  const end = appSource.indexOf('function canRunUpdateIconBreathing() {', start);
  assert.ok(start >= 0 && end > start, '手动更新检测接缝缺失');

  const pending = [];
  const toasts = [];
  let apiCalls = 0;
  const state = {
    visible: true,
    checking: false,
    checkPromise: null,
    checkAnnounce: false,
    checkError: '',
    currentVersion: '1.4.8',
    version: '1.4.8',
    configured: true,
    preview: false,
    updateAvailable: false,
    releaseUrl: '',
    downloadUrl: '',
    patchAvailable: false,
    patchUrl: '',
    patchFallbackTried: false,
    hero: '',
    notes: [],
  };
  const context = {
    APP_VERSION: '1.4.8',
    updatePreviewState: state,
    Date,
    String,
    Array,
    apiJson(url, opts) {
      apiCalls++;
      return new Promise((resolve, reject) => pending.push({ url, opts, resolve, reject }));
    },
    renderUpdatePreviewPanel() {},
    setUpdatePreviewVisible(value) { state.visible = !!value; },
    stopUpdateIconBreathing() {},
    syncUpdatePreviewStateClass() {},
    syncUpdateIconBreathing() {},
    showToast(message) { toasts.push(message); },
  };
  vm.runInNewContext(appSource.slice(start, end), context);
  return { context, state, pending, toasts, getApiCalls: () => apiCalls };
}

test('更新入口常驻并提供独立检测按钮', () => {
  assert.match(htmlSource, /id="update-entry" class="update-entry available"[^>]+title="检测更新"/);
  assert.match(htmlSource, /id="update-check-btn"[\s\S]*?checkLatestUpdate\(\{ force: true, announce: true \}\)/);
  assert.match(cssSource, /\.update-check-btn\.checking svg\{animation:update-check-spin/);
  assert.match(appSource, /openUpdatePanel\(\)[\s\S]*?checkLatestUpdate\(\{ force: true, announce: true \}\)/);
});

test('标题栏更新按钮只做光效呼吸，不再上下漂移', () => {
  const start = appSource.indexOf('function setUpdatePreviewVisible(visible) {');
  const end = appSource.indexOf('function syncUpdateIconBreathing(delay) {', start);
  const alignmentSource = appSource.slice(start, end);

  assert.ok(start >= 0 && end > start, '更新按钮动画接缝缺失');
  assert.doesNotMatch(alignmentSource, /\by:\s*-/);
  assert.match(cssSource, /#desktop-titlebar #update-entry\{[^}]*align-self:center[^}]*transform-origin:50% 50%/);
});

test('标题栏更新圆环始终围绕 SVG 中心旋转', () => {
  assert.match(cssSource, /\.update-ring\{[^}]*transform-box:view-box[^}]*transform-origin:50% 50%/);
  assert.match(cssSource, /\.update-progress-ring\{[^}]*transform-box:view-box[^}]*transform-origin:50% 50%/);
  assert.doesNotMatch(cssSource, /\.update-(?:progress-)?ring\{[^}]*transform-origin:12px 12px/);
});

test('连续点击检测更新只发送一个在途请求', async () => {
  const harness = loadUpdateCheckHarness();
  const first = harness.context.checkLatestUpdate({ force: true, announce: true });
  const second = harness.context.checkLatestUpdate({ force: true, announce: true });

  assert.equal(harness.getApiCalls(), 1);
  assert.equal(harness.state.checking, true);
  assert.match(harness.pending[0].url, /^\/api\/update\/latest\?force=1&t=/);
  assert.equal(harness.pending[0].opts.timeoutMs, 20000);

  harness.pending[0].resolve({
    configured: true,
    preview: false,
    updateAvailable: false,
    currentVersion: '1.4.8',
    latestVersion: '1.4.8',
    release: { version: '1.4.8', notes: ['当前版本已是最新'] },
  });
  await Promise.all([first, second]);

  assert.equal(harness.state.checking, false);
  assert.equal(harness.state.checkPromise, null);
  assert.equal(harness.state.checkError, '');
  assert.deepEqual(harness.toasts, ['当前已是最新版本 v1.4.8']);
});

test('更新线路失败会给出可重试反馈', async () => {
  const harness = loadUpdateCheckHarness();
  const request = harness.context.checkLatestUpdate({ force: true, announce: true });
  harness.pending[0].resolve({
    configured: true,
    preview: false,
    updateAvailable: false,
    currentVersion: '1.4.8',
    latestVersion: '1.4.8',
    reason: 'UPDATE_ALL_LINES_FAILED',
    release: { version: '1.4.8' },
  });
  await request;

  assert.equal(harness.state.checkError, 'UPDATE_ALL_LINES_FAILED');
  assert.equal(harness.state.hero, '暂时无法完成更新检测。');
  assert.deepEqual(harness.toasts, ['检测更新失败，请检查网络或代理后重试']);
});
