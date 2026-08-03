'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/**
 * 从 renderer 源码截取一个真实函数声明，供纯 Node VM 验证禁用态门禁。
 * @param {string} source 完整 HTML 源码。
 * @param {string} name 目标函数名。
 * @param {string} nextName 紧随其后的函数名。
 * @returns {string} 目标函数源码。
 */
function extractRendererFunction(source, name, nextName) {
  const start = source.indexOf('function ' + name + '(');
  const end = source.indexOf('function ' + nextName + '(', start + 1);
  assert.ok(start >= 0 && end > start, '未找到 renderer 函数：' + name);
  return source.slice(start, end);
}

/**
 * 创建返回可捕获 Promise 的空异步结果，避免测试产生未处理拒绝。
 * @returns {Promise<object>} 已完成的假 IPC 结果。
 */
function resolvedIpcResult() {
  return Promise.resolve({ ok: true });
}

/** @returns {boolean} 测试环境不锁定桌面覆盖层功能。 */
function isDevelopmentLockedFx() { return false; }

/** @returns {void} 测试状态已经归一化，无需额外处理。 */
function normalizeDevelopmentLockedFxState() {}

/** @returns {string} 返回固定桌面歌词载荷签名。 */
function desktopLyricsPayloadSignature() { return 'signature'; }

/** @returns {number} 返回固定桌面歌词发送间隔。 */
function desktopLyricsPushInterval() { return 8; }

/** @returns {number} 返回固定性能时间。 */
function currentTestTime() { return 1000; }

/** @returns {void} 测试不启动覆盖层同步计时器。 */
function scheduleDesktopOverlaySync() {}

/**
 * 验证桌面歌词关闭时不构造节奏图载荷，也不发送 update IPC。
 * @returns {void}
 */
function testDisabledDesktopLyricsSkipsHeavyPayload() {
  const file = path.join(__dirname, '..', 'public', 'app.js');
  const source = fs.readFileSync(file, 'utf8');
  const calls = { builds: 0, updates: 0, enabledPayload: null };

  /**
   * 记录主进程启用开关收到的最小载荷。
   * @param {boolean} enabled 是否启用。
   * @param {object} payload 状态载荷。
   * @returns {Promise<object>} 假 IPC 结果。
   */
  function setDesktopLyricsEnabled(enabled, payload) {
    calls.enabledPayload = { enabled, payload };
    return resolvedIpcResult();
  }

  /**
   * 记录不应在禁用态发生的状态更新。
   * @returns {Promise<object>} 假 IPC 结果。
   */
  function updateDesktopLyrics() {
    calls.updates += 1;
    return resolvedIpcResult();
  }

  /**
   * 返回桌面 API 假对象。
   * @returns {object} 假桌面 API。
   */
  function getDesktopWindowApi() {
    return { setDesktopLyricsEnabled, updateDesktopLyrics };
  }

  /**
   * 记录重载荷构造；禁用态不应调用本函数。
   * @returns {object} 带大节奏图标记的假载荷。
   */
  function buildDesktopLyricsPayload() {
    calls.builds += 1;
    return { enabled: false, beatMap: new Array(2048).fill(1) };
  }

  const context = {
    fx: { desktopLyrics: false },
    isDevelopmentLockedFx,
    getDesktopWindowApi,
    normalizeDevelopmentLockedFxState,
    desktopLyricsPayload: buildDesktopLyricsPayload,
    desktopLyricsPayloadSignature,
    desktopLyricsPushInterval,
    desktopOverlayPushState: {
      lyricsAt: 77,
      lastLyricsKey: '旧歌词签名'.repeat(256),
      lastLyricsBeatKey: '旧节奏图签名',
    },
    desktopLyricSnapshotState: { lines: new Array(2048).fill('旧歌词'), idx: 64 },
    performance: { now: currentTestTime },
    scheduleDesktopOverlaySync,
    console,
  };
  vm.runInNewContext(
    extractRendererFunction(source, 'pushDesktopLyricsState', 'applyDesktopLyricsState')
      + extractRendererFunction(source, 'applyDesktopLyricsState', 'pushWallpaperState')
      + '\nthis.pushState = pushDesktopLyricsState; this.applyState = applyDesktopLyricsState;',
    context,
  );

  context.pushState(true);
  context.applyState(true);

  assert.equal(calls.builds, 0);
  assert.equal(calls.updates, 0);
  assert.equal(calls.enabledPayload.enabled, false);
  assert.equal(calls.enabledPayload.payload.enabled, false);
  assert.deepEqual(Object.keys(calls.enabledPayload.payload), ['enabled']);
  assert.equal(context.desktopOverlayPushState.lyricsAt, 0);
  assert.equal(context.desktopOverlayPushState.lastLyricsKey, '');
  assert.equal(context.desktopOverlayPushState.lastLyricsBeatKey, '');
  assert.equal(context.desktopLyricSnapshotState.lines, null);
  assert.equal(context.desktopLyricSnapshotState.idx, -1);
}

/**
 * 验证壁纸关闭时不解析封面载荷，也不发送 update IPC。
 * @returns {void}
 */
function testDisabledWallpaperSkipsHeavyPayload() {
  const file = path.join(__dirname, '..', 'public', 'app.js');
  const source = fs.readFileSync(file, 'utf8');
  const calls = { builds: 0, updates: 0, enabledPayload: null };

  /**
   * 记录壁纸启用开关收到的最小载荷。
   * @param {boolean} enabled 是否启用。
   * @param {object} payload 状态载荷。
   * @returns {Promise<object>} 假 IPC 结果。
   */
  function setWallpaperMode(enabled, payload) {
    calls.enabledPayload = { enabled, payload };
    return resolvedIpcResult();
  }

  /**
   * 记录不应在禁用态发生的壁纸更新。
   * @returns {Promise<object>} 假 IPC 结果。
   */
  function updateWallpaperMode() {
    calls.updates += 1;
    return resolvedIpcResult();
  }

  /**
   * 返回壁纸 API 假对象。
   * @returns {object} 假桌面 API。
   */
  function getDesktopWindowApi() {
    return { setWallpaperMode, updateWallpaperMode };
  }

  /**
   * 记录封面载荷构造；禁用态不应调用本函数。
   * @returns {object} 带大封面标记的假载荷。
   */
  function buildWallpaperPayload() {
    calls.builds += 1;
    return { enabled: false, cover: 'data:image/png;base64,' + 'A'.repeat(1024) };
  }

  const context = {
    fx: { wallpaperMode: false },
    isDevelopmentLockedFx,
    getDesktopWindowApi,
    normalizeDevelopmentLockedFxState,
    wallpaperPayload: buildWallpaperPayload,
    desktopOverlayPushState: {
      wallpaperAt: 88,
      lastWallpaperKey: 'data:image/png;base64,' + 'A'.repeat(128 * 1024),
    },
    performance: { now: currentTestTime },
    scheduleDesktopOverlaySync,
    console,
  };
  vm.runInNewContext(
    extractRendererFunction(source, 'pushWallpaperState', 'applyWallpaperModeState')
      + extractRendererFunction(source, 'applyWallpaperModeState', 'syncDesktopOverlayState')
      + '\nthis.pushState = pushWallpaperState; this.applyState = applyWallpaperModeState;',
    context,
  );

  context.pushState(true);
  context.applyState(true);

  assert.equal(calls.builds, 0);
  assert.equal(calls.updates, 0);
  assert.equal(calls.enabledPayload.enabled, false);
  assert.equal(calls.enabledPayload.payload.enabled, false);
  assert.deepEqual(Object.keys(calls.enabledPayload.payload), ['enabled']);
  assert.equal(context.desktopOverlayPushState.wallpaperAt, 0);
  assert.equal(context.desktopOverlayPushState.lastWallpaperKey, '');
}

test('禁用桌面歌词不构造节奏图或发送状态 IPC', testDisabledDesktopLyricsSkipsHeavyPayload);
test('禁用壁纸不构造封面或发送状态 IPC', testDisabledWallpaperSkipsHeavyPayload);
