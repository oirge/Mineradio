'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { DesktopOverlayStateCache } = require('../desktop/desktop-overlay-state-cache');

/**
 * 模拟带固定 webContents 所有者和可移动边界的 BrowserWindow。
 */
class FakeWindow {
  /**
   * @param {object} sender 代表窗口 renderer 的 webContents 对象。
   */
  constructor(sender) {
    this.webContents = sender;
    this.bounds = { x: 100, y: 100, width: 900, height: 180 };
  }

  /** @returns {boolean} 假窗口始终有效。 */
  isDestroyed() { return false; }

  /** @returns {object} 当前窗口边界副本。 */
  getBounds() { return { ...this.bounds }; }

  /**
   * @param {object} bounds 新窗口边界。
   * @returns {void}
   */
  setBounds(bounds) { this.bounds = { ...bounds }; }
}

/**
 * 模拟 ipcMain.handle 注册表。
 */
class FakeIpcMain {
  /** 创建空处理器表。 */
  constructor() { this.handlers = new Map(); }

  /**
   * @param {string} channel IPC 通道名。
   * @param {Function} handler 处理函数。
   * @returns {void}
   */
  handle(channel, handler) { this.handlers.set(channel, handler); }
}

/**
 * 截取桌面歌词 IPC 权限判断与处理器注册区段。
 * @returns {string} 可在隔离 VM 中执行的主进程源码。
 */
function readDesktopLyricsIpcSource() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'main.js'), 'utf8');
  const start = source.indexOf('function isCurrentMainWindowSender(');
  const end = source.indexOf("ipcMain.handle('mineradio-wallpaper-set-enabled'", start + 1);
  assert.ok(start >= 0 && end > start, '未找到桌面歌词 IPC 所有权接缝');
  return source.slice(start, end);
}

/**
 * 按原始数值返回，满足移动处理器的范围接口。
 * @param {unknown} value 输入值。
 * @param {number} _min 未使用的最小值。
 * @param {number} _max 未使用的最大值。
 * @param {number} fallback 非数值回退值。
 * @returns {number} 归一后的数字。
 */
function clampNumber(value, _min, _max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(_min, Math.min(_max, number)) : fallback;
}

/**
 * 验证旧歌词 renderer 的迟到命令被忽略，而主 renderer 和当前歌词 renderer 仍保留各自权限。
 * @returns {Promise<void>}
 */
async function testDesktopLyricsIpcSenderOwnership() {
  const mainSender = {};
  const currentSender = {};
  const staleSender = {};
  const mainWindow = new FakeWindow(mainSender);
  const desktopLyricsWindow = new FakeWindow(currentSender);
  const ipcMain = new FakeIpcMain();
  const stateCache = new DesktopOverlayStateCache();
  stateCache.setEnabled(true, { clickThrough: false });
  const calls = { closes: 0, creates: [], sizeRequests: [], sizeStates: [] };

  /** @returns {void} 记录允许执行的关闭。 */
  function closeDesktopLyricsWindow() { calls.closes += 1; }

  /**
   * @param {object} payload 主 renderer 提供的状态补丁。
   * @returns {FakeWindow} 当前歌词窗口。
   */
  function createDesktopLyricsWindow(payload) {
    calls.creates.push(payload);
    return desktopLyricsWindow;
  }

  /** @returns {void} 测试不需要真实鼠标行为。 */
  function noop() {}

  /** @param {number} size 记录转发给主 renderer 的字号请求。 */
  function sendDesktopLyricsSizeRequest(size) {
    calls.sizeRequests.push(size);
    return true;
  }

  /** @param {number} size 记录发回歌词 renderer 的轻量字号状态。 */
  function sendDesktopLyricsSizeState(size) {
    calls.sizeStates.push(size);
  }

  const context = {
    ipcMain,
    mainWindow,
    desktopLyricsWindow,
    desktopLyricsStateCache: stateCache,
    desktopLyricsPointerCapture: false,
    desktopLyricsHotBounds: null,
    desktopLyricsUserBounds: null,
    createDesktopLyricsWindow,
    closeDesktopLyricsWindow,
    broadcastDesktopLyricsEnabledState: noop,
    sendDesktopLyricsState: noop,
    applyDesktopLyricsMouseBehavior: noop,
    broadcastDesktopLyricsLockState: noop,
    sendDesktopLyricsSizeRequest,
    sendDesktopLyricsSizeState,
    clampNumber,
    DESKTOP_LYRICS_SIZE_MIN: 0.20,
    DESKTOP_LYRICS_SIZE_MAX: 1.55,
  };
  vm.runInNewContext(readDesktopLyricsIpcSource(), context);

  const setEnabled = ipcMain.handlers.get('mineradio-desktop-lyrics-set-enabled');
  const update = ipcMain.handlers.get('mineradio-desktop-lyrics-update');
  const setPointer = ipcMain.handlers.get('mineradio-desktop-lyrics-set-pointer-capture');
  const setHotBounds = ipcMain.handlers.get('mineradio-desktop-lyrics-set-hot-bounds');
  const setLock = ipcMain.handlers.get('mineradio-desktop-lyrics-set-lock-state');
  const setSize = ipcMain.handlers.get('mineradio-desktop-lyrics-set-size');
  const move = ipcMain.handlers.get('mineradio-desktop-lyrics-move-by');

  assert.equal((await setEnabled({ sender: staleSender }, false, {})).ignored, true);
  assert.equal((await update({ sender: staleSender }, { opacity: 0.4 })).ignored, true);
  assert.equal((await setPointer({ sender: staleSender }, true)).ignored, true);
  assert.equal((await setHotBounds({ sender: staleSender }, { left: 1, top: 2, right: 3, bottom: 4 })).ignored, true);
  assert.equal((await setLock({ sender: staleSender }, true)).ignored, true);
  assert.equal((await setSize({ sender: staleSender }, 1.2)).ignored, true);
  assert.equal((await move({ sender: staleSender }, 80, 60)).ignored, true);
  assert.equal(calls.closes, 0);
  assert.equal(calls.creates.length, 0);
  assert.equal(context.desktopLyricsPointerCapture, false);
  assert.equal(context.desktopLyricsHotBounds, null);
  assert.deepEqual(calls.sizeRequests, []);
  assert.deepEqual(calls.sizeStates, []);
  assert.deepEqual(desktopLyricsWindow.bounds, { x: 100, y: 100, width: 900, height: 180 });
  assert.equal(stateCache.value.clickThrough, false);

  assert.equal((await setPointer({ sender: currentSender }, true)).ok, true);
  assert.equal(context.desktopLyricsPointerCapture, true);
  assert.equal((await setSize({ sender: currentSender }, 9)).size, 1.55);
  assert.deepEqual(calls.sizeRequests, [1.55]);
  assert.deepEqual(calls.sizeStates, [1.55]);
  assert.equal(stateCache.value.size, 1.55);
  assert.equal((await setSize({ sender: currentSender }, -9)).size, 0.20);
  assert.deepEqual(calls.sizeRequests, [1.55, 0.20]);
  assert.deepEqual(calls.sizeStates, [1.55, 0.20]);
  assert.equal(stateCache.value.size, 0.20);
  stateCache.apply({ clickThrough: true });
  assert.equal((await setSize({ sender: currentSender }, 1.1)).error, 'DESKTOP_LYRICS_LOCKED');
  assert.deepEqual(calls.sizeRequests, [1.55, 0.20]);
  assert.deepEqual(calls.sizeStates, [1.55, 0.20]);
  stateCache.apply({ clickThrough: false });
  assert.equal((await update({ sender: mainSender }, { opacity: 0.6 })).ok, true);
  assert.equal(calls.creates.length, 1);
  assert.equal((await setEnabled({ sender: currentSender }, false, {})).ok, true);
  assert.equal(calls.closes, 1);
}

test('旧桌面歌词 renderer 命令不能控制替代窗口', testDesktopLyricsIpcSenderOwnership);
/**
 * 截取 releaseOwnedDesktopLyricsWindow 函数体。该函数是歌词窗口 closed 事件的唯一释放口，
 * 覆盖渲染进程崩溃等不走 closeDesktopLyricsWindow 的意外关闭路径。
 * @returns {string} releaseOwnedDesktopLyricsWindow 的函数体源码。
 */
function readReleaseOwnedDesktopLyricsWindowBody() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'main.js'), 'utf8');
  const start = source.indexOf('function releaseOwnedDesktopLyricsWindow()');
  assert.ok(start >= 0, '未找到 releaseOwnedDesktopLyricsWindow 定义');
  const braceStart = source.indexOf('{', start);
  assert.ok(braceStart > start, '未找到函数体起始花括号');
  let depth = 0;
  for (let i = braceStart; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(braceStart, i + 1);
    }
  }
  throw new Error('releaseOwnedDesktopLyricsWindow 函数体花括号不平衡');
}

/**
 * 验证歌词窗口意外关闭（包括渲染进程崩溃）时同步终止中键轮询子进程，
 * 避免孤儿 PowerShell 进程持续空转。
 * @returns {void}
 */
function testReleaseStopsMousePoller() {
  const body = readReleaseOwnedDesktopLyricsWindowBody();
  assert.match(
    body,
    /stopDesktopLyricsMousePoller\(\)/,
    'releaseOwnedDesktopLyricsWindow 必须在意外关闭时停止中键轮询子进程',
  );
}

test('歌词窗口意外关闭时终止中键轮询子进程', testReleaseStopsMousePoller);
