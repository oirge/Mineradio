'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/**
 * 截取主进程命名 IPC 处理函数，确保测试执行真实调用顺序。
 * @param {string} source 完整主进程源码。
 * @param {string} functionName 目标函数名。
 * @param {string} registrationChannel 紧随函数后的 IPC 通道名。
 * @returns {string} 目标处理函数源码。
 */
function extractMainHandler(source, functionName, registrationChannel) {
  const start = source.indexOf('async function ' + functionName + '(');
  const end = source.indexOf("\nipcMain.handle('" + registrationChannel + "'", start + 1);
  assert.ok(start >= 0 && end > start, '未找到主进程处理函数：' + functionName);
  return source.slice(start, end);
}

/** @returns {void} 测试不需要执行窗口定位或状态发送。 */
function noop() {}

/**
 * 验证桌面歌词补丁仍由窗口更新入口比较旧值，从而触发位置和透明度副作用。
 * @returns {Promise<void>}
 */
async function testDesktopLyricsPatchReachesWindowUpdater() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'main.js'), 'utf8');
  const patch = { enabled: true, y: 0.41, opacity: 0.63 };
  const calls = { payload: null };

  /**
   * 模拟旧处理顺序中的缓存写入；返回 true 允许继续更新窗口。
   * @returns {boolean} 始终接受补丁。
   */
  function apply() {
    return true;
  }

  /**
   * 记录窗口更新入口实际收到的补丁。
   * @param {object} payload 主进程应转交的原始补丁。
   * @returns {object} 假窗口对象。
   */
  function createDesktopLyricsWindow(payload) {
    calls.payload = payload;
    return {};
  }

  /** @returns {boolean} 该测试把调用视为当前主 renderer。 */
  function isCurrentMainWindowSender() { return true; }

  const context = {
    desktopLyricsStateCache: { enabled: true, apply },
    createDesktopLyricsWindow,
    isCurrentMainWindowSender,
    sendDesktopLyricsState: noop,
  };
  vm.runInNewContext(
    extractMainHandler(source, 'handleDesktopLyricsStateUpdate', 'mineradio-desktop-lyrics-update')
      + '\nthis.handle = handleDesktopLyricsStateUpdate;',
    context,
  );

  const result = await context.handle(null, patch);
  assert.equal(result.ok, true);
  assert.equal(calls.payload, patch);
}

/**
 * 验证壁纸补丁直接交给窗口更新入口，避免先合并再空补丁重复分配和发送。
 * @returns {Promise<void>}
 */
async function testWallpaperPatchReachesWindowUpdater() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'main.js'), 'utf8');
  const patch = { enabled: true, opacity: 0.72, cover: 'data:image/png;base64,AAAA' };
  const calls = { payload: null };

  /**
   * 模拟旧处理顺序中的缓存写入；返回 true 允许继续更新窗口。
   * @returns {boolean} 始终接受补丁。
   */
  function apply() {
    return true;
  }

  /**
   * 记录壁纸窗口更新入口实际收到的补丁。
   * @param {object} payload 主进程应转交的原始补丁。
   * @returns {object} 假窗口对象。
   */
  function createWallpaperWindow(payload) {
    calls.payload = payload;
    return {};
  }

  const context = {
    wallpaperStateCache: { enabled: true, apply },
    createWallpaperWindow,
    positionWallpaperWindow: noop,
    sendWallpaperState: noop,
    wallpaperWindow: null,
  };
  vm.runInNewContext(
    extractMainHandler(source, 'handleWallpaperStateUpdate', 'mineradio-wallpaper-update')
      + '\nthis.handle = handleWallpaperStateUpdate;',
    context,
  );

  const result = await context.handle(null, patch);
  assert.equal(result.ok, true);
  assert.equal(calls.payload, patch);
}

test('桌面歌词更新补丁保留位置和透明度副作用', testDesktopLyricsPatchReachesWindowUpdater);
test('壁纸更新补丁直接交给窗口生命周期入口', testWallpaperPatchReachesWindowUpdater);
