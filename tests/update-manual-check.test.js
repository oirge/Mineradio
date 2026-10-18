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
const foliaCssSource = fs.readFileSync(path.join(root, 'public', 'folia-host.css'), 'utf8');

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
  assert.match(htmlSource, /id="folia-switch-btn"[^>]*>Folia<\/button>\s*<button id="folia-update-btn"[^>]+onclick="openUpdatePanel\(\)"[^>]*>\s*<svg[\s\S]*?<path d="M12 16\.5V7\.5"><\/path>\s*<path d="M8\.7 10\.7 12 7\.4l3\.3 3\.3"><\/path>\s*<\/svg>\s*<\/button>\s*<button id="folia-import-files"/);
  assert.match(htmlSource, /id="update-check-btn"[\s\S]*?checkLatestUpdate\(\{ force: true, announce: true \}\)/);
  assert.match(cssSource, /\.update-check-btn\.checking svg\{animation:update-check-spin/);
  assert.match(appSource, /openUpdatePanel\(\)[\s\S]*?checkLatestUpdate\(\{ force: true, announce: true \}\)/);
  assert.match(appSource, /function syncUpdatePreviewStateClass\(\)[\s\S]*?var foliaEntry = document\.getElementById\('folia-update-btn'\);[\s\S]*?foliaEntry\.title = isChecking \? '正在检测更新…'/);
  assert.match(appSource, /function openUpdatePanel\(\)[\s\S]*?var activeEntry = document\.body\.classList\.contains\('folia-interface-active'\) \? foliaEntry : entry;[\s\S]*?window\.gsap\.fromTo\(activeEntry/);
  assert.match(cssSource, /#folia-update-btn\{display:none;width:30px;height:30px;flex:0 0 auto;place-items:center;padding:0;/);
  assert.match(cssSource, /body\.folia-interface-active #folia-update-btn\{display:grid\}/);
  assert.match(cssSource, /body\.folia-interface-active #folia-update-btn\[hidden\]\{display:none!important\}/);
  assert.match(foliaCssSource, /body\.folia-interface-active #desktop-window-shell>:not\(#folia-interface\):not\(#desktop-titlebar\):not\(#fullscreen-diy-zone\):not\(#update-modal\)/);
  assert.match(foliaCssSource, /body\.folia-interface-active #update-modal\.modal-mask\{z-index:2147483000\}/);
});

test('标题栏更新按钮只做光效呼吸，不再上下漂移', () => {
  const start = appSource.indexOf('function setUpdatePreviewVisible(visible) {');
  const end = appSource.indexOf('function syncUpdateIconBreathing(delay) {', start);
  const alignmentSource = appSource.slice(start, end);

  assert.ok(start >= 0 && end > start, '更新按钮动画接缝缺失');
  assert.doesNotMatch(alignmentSource, /\by:\s*-/);
  assert.match(cssSource, /#desktop-titlebar #update-entry\{[^}]*align-self:center[^}]*transform-origin:50% 50%/);
});

test('标题栏更新圆环只移动描边，不再变换 SVG 几何轴心', () => {
  assert.match(htmlSource, /id="update-progress-ring"[^>]*transform="rotate\(-90 12 12\)"/);
  assert.match(cssSource, /\.update-ring\{[^}]*stroke-dashoffset:0[^}]*transform:none/);
  assert.match(cssSource, /\.update-progress-ring\{[^}]*stroke-dashoffset:55\.29/);
  assert.match(cssSource, /\.update-entry\.checking \.update-ring\{animation:update-ring-dash-flow/);
  assert.match(cssSource, /@keyframes update-ring-dash-flow\{from\{stroke-dashoffset:0\}to\{stroke-dashoffset:-66\}\}/);
  const breathingStart = appSource.indexOf('function stopUpdateIconBreathing(resetVisual) {');
  const breathingEnd = appSource.indexOf('function syncUpdateIconBreathing(delay) {', breathingStart);
  assert.ok(breathingStart >= 0 && breathingEnd > breathingStart, '更新圆环动画接缝缺失');
  const breathingSource = appSource.slice(breathingStart, breathingEnd);
  assert.match(breathingSource, /strokeDashoffset:\s*-5/);
  assert.doesNotMatch(breathingSource, /ring[\s\S]*\brotate:/);
  assert.doesNotMatch(cssSource, /\.update-(?:progress-)?ring\{[^}]*transform-(?:box|origin):/);
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
