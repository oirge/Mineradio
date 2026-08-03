'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const { DesktopOverlayStateCache } = require('../desktop/desktop-overlay-state-cache');

/**
 * 模拟覆盖层 BrowserWindow，允许测试精确控制迟到的 ready、load 和 closed 事件。
 */
class FakeOverlayWindow extends EventEmitter {
  /**
   * 创建未销毁且默认隐藏的假窗口。
   * @param {object} options BrowserWindow 构造参数。
   */
  constructor(options) {
    super();
    this.options = options;
    this.webContents = new EventEmitter();
    this.showCount = 0;
    this.closeCount = 0;
  }

  /** @returns {boolean} 测试窗口始终保持可触发事件。 */
  isDestroyed() { return false; }

  /** @returns {void} 忽略置顶参数。 */
  setAlwaysOnTop() {}

  /** @returns {void} 忽略工作区参数。 */
  setVisibleOnAllWorkspaces() {}

  /** @returns {void} 忽略鼠标穿透参数。 */
  setIgnoreMouseEvents() {}

  /** @returns {void} 记录窗口被显示的次数。 */
  showInactive() { this.showCount += 1; }

  /** @returns {void} 只记录关闭请求，closed 事件由测试稍后触发。 */
  close() { this.closeCount += 1; }

  /**
   * 模拟异步页面加载成功，但不自动触发 did-finish-load。
   * @returns {Promise<void>} 已完成的加载 Promise。
   */
  loadURL() { return Promise.resolve(); }
}

/**
 * 从主进程源码截取一个覆盖层创建/关闭区段。
 * @param {string} startName 起始函数名。
 * @param {string} endName 下一函数名。
 * @returns {string} 可在 VM 中执行的生产源码。
 */
function readLifecycleSource(startName, endName) {
  const source = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'main.js'), 'utf8');
  const start = source.indexOf('function ' + startName + '(');
  const end = source.indexOf('function ' + endName + '(', start + 1);
  assert.ok(start >= 0 && end > start, '未找到覆盖层生命周期区段：' + startName);
  return source.slice(start, end);
}

/**
 * 创建可由 new BrowserWindow 调用的假构造器，并记录全部实例。
 * @param {FakeOverlayWindow[]} windows 实例收集数组。
 * @returns {Function} BrowserWindow 假构造器。
 */
function createBrowserWindowConstructor(windows) {
  /**
   * 构造并登记一个假覆盖层窗口。
   * @param {object} options BrowserWindow 参数。
   * @returns {FakeOverlayWindow} 新窗口。
   */
  function BrowserWindow(options) {
    const win = new FakeOverlayWindow(options);
    windows.push(win);
    return win;
  }
  return BrowserWindow;
}

/**
 * 提供覆盖层生命周期不关心的无副作用依赖。
 * @returns {void}
 */
function noop() {}

/**
 * 原样返回数字或回退值，满足桌面歌词位置差值判断。
 * @param {unknown} value 输入值。
 * @param {number} _min 未使用的最小值。
 * @param {number} _max 未使用的最大值。
 * @param {number} fallback 非数值回退值。
 * @returns {number} 归一后的数值。
 */
function clampNumber(value, _min, _max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

/**
 * 生成不访问文件系统的假覆盖层地址。
 * @param {string} fileName 页面文件名。
 * @returns {string} 假地址。
 */
function overlayUrl(fileName) { return fileName; }

/**
 * 验证旧桌面歌词窗口的迟到事件不能显示、发送或清空替代窗口。
 * @returns {void}
 */
function testDesktopLyricsWindowOwnership() {
  const windows = [];
  const calls = { sends: 0 };

  /** @returns {void} 记录状态发送次数。 */
  function sendDesktopLyricsState() { calls.sends += 1; }

  const context = {
    BrowserWindow: createBrowserWindowConstructor(windows),
    desktopLyricsStateCache: new DesktopOverlayStateCache(),
    desktopLyricsWindow: null,
    desktopLyricsUserBounds: null,
    desktopLyricsMouseIgnored: null,
    desktopLyricsLastStateSignature: '',
    desktopLyricsLastOpacity: null,
    desktopLyricsHotBounds: null,
    desktopLyricsPointerCapture: false,
    path,
    __dirname: path.join(__dirname, '..', 'desktop'),
    clampNumber,
    startDesktopLyricsMousePoller: noop,
    stopDesktopLyricsMousePoller: noop,
    applyDesktopLyricsMouseBehavior: noop,
    positionDesktopLyricsWindow: noop,
    setDesktopLyricsOpacity: noop,
    sendDesktopLyricsWindowGeometry: noop,
    sendDesktopLyricsState,
    broadcastDesktopLyricsEnabledState: noop,
    rememberDesktopLyricsBounds: noop,
    overlayUrl,
    console,
  };
  vm.runInNewContext(
    readLifecycleSource('createDesktopLyricsWindow', 'nativeWindowHandleDecimal')
      + '\nthis.createWindow = createDesktopLyricsWindow;'
      + '\nthis.closeWindow = closeDesktopLyricsWindow;'
      + '\n/** @returns {object|null} 返回当前桌面歌词窗口。 */'
      + '\nthis.currentWindow = function currentWindow(){ return desktopLyricsWindow; };',
    context,
  );

  const first = context.createWindow({ enabled: true });
  context.closeWindow();
  const second = context.createWindow({ enabled: true });
  const sendBaseline = calls.sends;

  first.emit('ready-to-show');
  first.webContents.emit('did-finish-load');
  first.emit('closed');

  assert.equal(second.showCount, 0);
  assert.equal(calls.sends, sendBaseline);
  assert.equal(context.currentWindow(), second);
}

/**
 * 验证旧壁纸窗口的迟到事件不能显示、挂载、发送或清空替代窗口。
 * @returns {void}
 */
function testWallpaperWindowOwnership() {
  const windows = [];
  const calls = { sends: 0, attaches: 0 };

  /** @returns {void} 记录状态发送次数。 */
  function sendWallpaperState() { calls.sends += 1; }

  /** @returns {void} 记录 WorkerW 挂载次数。 */
  function attachWallpaperToWorkerW() { calls.attaches += 1; }

  /** @returns {object} 返回固定主显示器工作区。 */
  function getPrimaryDisplay() { return { bounds: { x: 0, y: 0, width: 1920, height: 1080 } }; }

  const context = {
    BrowserWindow: createBrowserWindowConstructor(windows),
    wallpaperStateCache: new DesktopOverlayStateCache(),
    wallpaperWindow: null,
    screen: { getPrimaryDisplay },
    path,
    __dirname: path.join(__dirname, '..', 'desktop'),
    positionWallpaperWindow: noop,
    sendWallpaperState,
    attachWallpaperToWorkerW,
    overlayUrl,
    console,
  };
  vm.runInNewContext(
    readLifecycleSource('createWallpaperWindow', 'miniPlayerDefaultBounds')
      + '\nthis.createWindow = createWallpaperWindow;'
      + '\nthis.closeWindow = closeWallpaperWindow;'
      + '\n/** @returns {object|null} 返回当前壁纸窗口。 */'
      + '\nthis.currentWindow = function currentWindow(){ return wallpaperWindow; };',
    context,
  );

  const first = context.createWindow({ enabled: true });
  context.closeWindow();
  const second = context.createWindow({ enabled: true });
  const sendBaseline = calls.sends;
  const attachBaseline = calls.attaches;

  first.emit('ready-to-show');
  first.webContents.emit('did-finish-load');
  first.emit('closed');

  assert.equal(second.showCount, 0);
  assert.equal(calls.sends, sendBaseline);
  assert.equal(calls.attaches, attachBaseline);
  assert.equal(context.currentWindow(), second);
}

test('旧桌面歌词窗口事件不覆盖替代窗口所有权', testDesktopLyricsWindowOwnership);
test('旧壁纸窗口事件不覆盖替代窗口所有权', testWallpaperWindowOwnership);
