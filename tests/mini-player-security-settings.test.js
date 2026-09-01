'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const TRUSTED_STANDARD_URL = 'http://127.0.0.1:3000/mini-player.html';
const TRUSTED_COMPACT_URL = 'http://127.0.0.1:3000/mini-player-compact.html';

/**
 * 读取主进程源码。
 * @returns {string} 完整 main.js 文本。
 */
function readMainSource() {
  return fs.readFileSync(path.join(__dirname, '..', 'desktop', 'main.js'), 'utf8');
}

/**
 * 按两个函数名截取主进程真实实现。
 * @param {string} startName 起始函数名。
 * @param {string} endName 结束边界函数名。
 * @returns {string} 可在 VM 中执行的源码片段。
 */
function extractFunctionRange(startName, endName) {
  const source = readMainSource();
  const start = source.indexOf(`function ${startName}(`);
  const end = source.indexOf(`function ${endName}(`, start + 1);
  assert.ok(start >= 0 && end > start, `未找到主进程函数范围：${startName}`);
  return source.slice(start, end);
}

/**
 * 创建带事件记录的假 webContents。
 * @param {string} url 当前主文档地址。
 * @returns {{on:Function,getURL:Function,isDestroyed:Function,listeners:object}} 假 webContents。
 */
function createWebContents(url) {
  const listeners = {};
  return {
    listeners,
    on(name, handler) { listeners[name] = handler; },
    getURL() { return url; },
    isDestroyed() { return false; },
  };
}

/**
 * 装载迷你窗口 URL、sender 与导航信任核心。
 * @returns {object} 可信校验函数和假窗口。
 */
function loadMiniPlayerTrustCore() {
  const sender = createWebContents(TRUSTED_STANDARD_URL);
  const miniPlayerWindow = {
    isDestroyed() { return false; },
    webContents: sender,
  };
  const context = {
    URL,
    mainServerPort: 3000,
    miniPlayerWindow,
    miniPlayerWindowModes: new WeakMap([[miniPlayerWindow, 'standard']]),
    normalizeMiniPlayerMode(value) { return value === 'compact' ? 'compact' : 'standard'; },
    miniPlayerModeForWindow(win) { return context.miniPlayerWindowModes.get(win) || 'standard'; },
  };
  vm.runInNewContext(
    extractFunctionRange('isTrustedMiniPlayerDocumentUrl', 'showMiniPlayerContextMenu'),
    context,
  );
  return { ...context, sender, miniPlayerWindow };
}

/**
 * 触发导航守卫并返回事件是否被阻止。
 * @param {object} contents 假 webContents。
 * @param {string} eventName Electron 导航事件名。
 * @param {string} url 目标地址。
 * @param {boolean} isMainFrame 是否为主 frame。
 * @returns {boolean} 调用了 preventDefault 时返回 true。
 */
function navigate(contents, eventName, url, isMainFrame = true) {
  let prevented = false;
  const event = { preventDefault() { prevented = true; } };
  const handler = contents.listeners[eventName];
  assert.equal(typeof handler, 'function', `未安装导航监听：${eventName}`);
  if (eventName === 'will-navigate') {
    handler(event, { url, isMainFrame }, url, false, isMainFrame);
  } else if (eventName === 'will-redirect') {
    handler(event, { url, isMainFrame }, url, false, isMainFrame);
  } else {
    handler(event, { url, isMainFrame, frame: isMainFrame ? null : { parent: {} } });
  }
  return prevented;
}

/**
 * 验证迷你窗口只信任当前模式对应的本地页面，外部文档与子 frame 均无 IPC 权限。
 * @returns {void}
 */
function testMiniPlayerTrustBoundary() {
  const core = loadMiniPlayerTrustCore();
  assert.equal(core.isTrustedMiniPlayerDocumentUrl(TRUSTED_STANDARD_URL, 'standard'), true);
  assert.equal(core.isTrustedMiniPlayerDocumentUrl(TRUSTED_COMPACT_URL, 'compact'), true);

  for (const url of [
    'https://evil.example.com/',
    'http://127.0.0.1:3001/mini-player.html',
    'http://localhost:3000/mini-player.html',
    'http://127.0.0.1:3000/index.html',
    TRUSTED_COMPACT_URL,
  ]) {
    assert.equal(core.isTrustedMiniPlayerDocumentUrl(url, 'standard'), false, `标准模式必须拒绝：${url}`);
  }

  const trustedEvent = {
    sender: core.sender,
    senderFrame: { parent: null, url: TRUSTED_STANDARD_URL },
  };
  assert.equal(core.isTrustedMiniPlayerFrameSender(trustedEvent), true);
  assert.equal(core.isTrustedMiniPlayerFrameSender({
    sender: core.sender,
    senderFrame: { parent: null, url: 'https://evil.example.com/' },
  }), false);
  assert.equal(core.isTrustedMiniPlayerFrameSender({
    sender: core.sender,
    senderFrame: { parent: {}, url: TRUSTED_STANDARD_URL },
  }), false);
  assert.equal(core.isTrustedMiniPlayerFrameSender({ sender: core.sender }), false);
  assert.equal(core.isTrustedMiniPlayerFrameSender({ sender: createWebContents(TRUSTED_STANDARD_URL) }), false);
}

/**
 * 验证迷你窗口导航守卫拒绝同窗外跳与所有子 frame 导航。
 * @returns {void}
 */
function testMiniPlayerNavigationGuard() {
  const core = loadMiniPlayerTrustCore();
  const contents = createWebContents(TRUSTED_STANDARD_URL);
  const win = { webContents: contents };
  core.installMiniPlayerNavigationGuard(win, 'standard');

  assert.equal(navigate(contents, 'will-navigate', TRUSTED_STANDARD_URL), false);
  assert.equal(navigate(contents, 'will-navigate', 'https://evil.example.com/'), true);
  assert.equal(navigate(contents, 'will-navigate', TRUSTED_COMPACT_URL), true);
  assert.equal(navigate(contents, 'will-redirect', TRUSTED_STANDARD_URL), false);
  assert.equal(navigate(contents, 'will-redirect', 'https://evil.example.com/'), true);
  assert.equal(navigate(contents, 'will-frame-navigate', TRUSTED_STANDARD_URL), false);
  assert.equal(navigate(contents, 'will-frame-navigate', TRUSTED_STANDARD_URL, false), true);
}

/**
 * 验证窗口工厂与迷你播放器特权 IPC 都接入同一可信文档门禁。
 * @returns {void}
 */
function testMiniPlayerSecurityWiring() {
  const main = readMainSource();
  const createStart = main.indexOf('function createMiniPlayerWindow()');
  const createEnd = main.indexOf('function showMiniPlayerWindow()', createStart + 1);
  assert.ok(createStart >= 0 && createEnd > createStart, '未找到迷你窗口工厂');
  const createSource = main.slice(createStart, createEnd);
  assert.match(createSource, /setWindowOpenHandler[\s\S]*?installMiniPlayerNavigationGuard\(win, mode\)/);
  assert.match(createSource, /did-finish-load[\s\S]*?isTrustedMiniPlayerDocumentUrl\(win\.webContents\.getURL\(\), mode\)/);
  assert.match(createSource, /context-menu', \(event, params\)[\s\S]*?handleMiniPlayerRendererContextMenu\(win, mode, event, params\)/);
  const showStart = main.indexOf('function showMiniPlayerWindow()');
  const showEnd = main.indexOf('function hideMiniPlayerWindow()', showStart + 1);
  assert.ok(showStart >= 0 && showEnd > showStart, '未找到迷你播放器显示函数');
  assert.match(main.slice(showStart, showEnd), /isLoadingMainFrame\(\)[\s\S]*?isTrustedMiniPlayerDocumentUrl\(win\.webContents\.getURL\(\), miniPlayerModeForWindow\(win\)\)[\s\S]*?destroyMiniPlayerWindowInstance\(win\)/);

  for (const name of ['handleMiniPlayerMoveBy', 'handleMiniPlayerPointerPassthrough']) {
    const start = main.indexOf(`function ${name}(`);
    const end = main.indexOf('\nipcMain.handle(', start + 1);
    assert.ok(start >= 0 && end > start, `未找到迷你 IPC：${name}`);
    assert.match(main.slice(start, end), /isTrustedMiniPlayerFrameSender\(event\)/, `${name} 必须校验可信 frame`);
  }
  assert.match(
    main,
    /ipcMain\.handle\('mineradio-mini-player-command',[\s\S]*?if \(!isTrustedMiniPlayerFrameSender\(event\)\)/,
  );
}

/**
 * 在指定页面地址下执行迷你 preload，检查特权桥是否被暴露。
 * @param {string} href 页面地址。
 * @param {number} port 主进程为本次窗口选择的本地服务端口。
 * @returns {object|null} 暴露到页面的 miniPlayer API。
 */
function loadMiniPlayerPreload(href, port = 3000) {
  let exposed = null;
  const contextBridge = {
    exposeInMainWorld(name, value) {
      if (name === 'miniPlayer') exposed = value;
    },
  };
  const ipcRenderer = {
    invoke() { return Promise.resolve({ ok: true }); },
    on() {},
    removeListener() {},
  };
  const context = {
    URL,
    process: { env: { PORT: String(port) } },
    window: { location: new URL(href) },
    require(name) {
      assert.equal(name, 'electron');
      return { contextBridge, ipcRenderer };
    },
  };
  const source = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'mini-player-preload.js'), 'utf8');
  vm.runInNewContext(source, context);
  return exposed;
}

/**
 * 验证 preload 在外部页面不创建特权 API，本地两套迷你页面仍可正常使用。
 * @returns {void}
 */
function testMiniPlayerPreloadDocumentGate() {
  assert.ok(loadMiniPlayerPreload(TRUSTED_STANDARD_URL));
  assert.ok(loadMiniPlayerPreload(TRUSTED_COMPACT_URL));
  assert.ok(loadMiniPlayerPreload('http://127.0.0.1:34567/mini-player.html', 34567));
  for (const href of [
    'https://evil.example.com/',
    'http://127.0.0.1:3001/mini-player.html',
    'http://127.0.0.1:3000/index.html',
    'http://localhost:3000/mini-player.html',
    'file:///C:/mini-player.html',
  ]) {
    assert.equal(loadMiniPlayerPreload(href), null, `非可信迷你文档不得暴露 API：${href}`);
  }
}

/**
 * 装载桌面 preload 并返回暴露 API 与 IPC 监听记录。
 * @returns {{api:object,listeners:Map<string,Function>,removed:Array<object>}} preload 测试结果。
 */
function loadDesktopPreload() {
  let api = null;
  const listeners = new Map();
  const removed = [];
  const contextBridge = {
    exposeInMainWorld(name, value) {
      if (name === 'desktopWindow') api = value;
    },
  };
  const ipcRenderer = {
    sendSync() { return {}; },
    invoke() { return Promise.resolve({ ok: true }); },
    on(channel, listener) { listeners.set(channel, listener); },
    removeListener(channel, listener) { removed.push({ channel, listener }); },
  };
  const context = {
    window: {
      localStorage: {
        getItem() { return null; },
        setItem() {},
      },
      addEventListener() {},
    },
    require(name) {
      assert.equal(name, 'electron');
      return { contextBridge, ipcRenderer };
    },
  };
  const source = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'preload.js'), 'utf8');
  vm.runInNewContext(source, context);
  return { api, listeners, removed };
}

/**
 * 验证主 renderer 能订阅原生菜单设置变化，并可解除监听。
 * @returns {void}
 */
function testDesktopSettingsChangedPreloadBridge() {
  const preload = loadDesktopPreload();
  const received = [];
  const unsubscribe = preload.api.onDesktopShellSettingsChanged((payload) => received.push(payload));
  const channel = 'mineradio-desktop-shell-settings-changed';
  const listener = preload.listeners.get(channel);
  assert.equal(typeof listener, 'function');

  listener({}, { ok: true, miniPlayerMode: 'compact' });
  assert.deepEqual(received, [{ ok: true, miniPlayerMode: 'compact' }]);
  unsubscribe();
  assert.equal(preload.removed.length, 1);
  assert.equal(preload.removed[0].channel, channel);
  assert.equal(preload.removed[0].listener, listener);
}

/**
 * 验证主进程生成一次真实设置快照并只向当前健康主窗口广播。
 * @returns {void}
 */
function testDesktopSettingsSnapshotBroadcast() {
  const sends = [];
  let startupReads = 0;
  const webContents = {
    isDestroyed() { return false; },
    send(channel, payload) { sends.push({ channel, payload }); },
  };
  const context = {
    closeToTrayEnabled: false,
    miniPlayerEnabled: true,
    miniPlayerMode: 'compact',
    mainWindow: { isDestroyed() { return false; }, webContents },
    isStartupEnabled() { startupReads += 1; return true; },
  };
  vm.runInNewContext(
    extractFunctionRange('desktopShellSettingsSnapshot', 'buildAppContextMenuTemplate'),
    context,
  );

  const payload = context.broadcastDesktopShellSettingsChanged();
  assert.deepEqual(JSON.parse(JSON.stringify(payload)), {
    ok: true,
    closeToTray: false,
    miniPlayer: true,
    miniPlayerEnabled: true,
    miniPlayerMode: 'compact',
    startup: true,
    startupEnabled: true,
  });
  assert.equal(startupReads, 1);
  assert.equal(sends.length, 1);
  assert.equal(sends[0].channel, 'mineradio-desktop-shell-settings-changed');
}

/**
 * 验证所有可由原生菜单修改的桌面设置都会在落盘后广播给主 renderer。
 * @returns {void}
 */
function testNativeMenuSettingsBroadcastWiring() {
  const main = readMainSource();
  for (const name of ['setCloseToTrayEnabled', 'setMiniPlayerEnabled', 'setMiniPlayerMode', 'setStartupEnabled']) {
    const start = main.indexOf(`function ${name}(`);
    const end = main.indexOf('\nfunction ', start + 1);
    assert.ok(start >= 0 && end > start, `未找到设置函数：${name}`);
    assert.match(main.slice(start, end), /broadcastDesktopShellSettingsChanged\(\)/, `${name} 必须广播真实设置`);
  }
}

test('迷你窗口 IPC 只信任当前模式本地文档', testMiniPlayerTrustBoundary);
test('迷你窗口阻止同窗外部导航与子 frame', testMiniPlayerNavigationGuard);
test('迷你窗口工厂与特权 IPC 全部接入安全门', testMiniPlayerSecurityWiring);
test('迷你 preload 不向外部文档暴露特权 API', testMiniPlayerPreloadDocumentGate);
test('桌面 preload 暴露原生设置变化订阅', testDesktopSettingsChangedPreloadBridge);
test('主进程广播单一真实桌面设置快照', testDesktopSettingsSnapshotBroadcast);
test('原生菜单设置入口全部广播主 renderer', testNativeMenuSettingsBroadcastWiring);
