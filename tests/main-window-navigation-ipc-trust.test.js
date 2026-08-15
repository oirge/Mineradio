'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

/**
 * 读取主进程源码。
 * @returns {string} 完整 main.js 文本。
 */
function readMainSource() {
  return fs.readFileSync(path.join(__dirname, '..', 'desktop', 'main.js'), 'utf8');
}

const TRUSTED_MAIN_URL = 'http://127.0.0.1:3000/index.html';

/**
 * 截取可信主 frame 校验核心（URL 校验 / sender 校验 / 包装器 / 导航守卫 / 旧入口别名）。
 * @returns {string} 可在隔离 VM 中执行的信任核心源码。
 */
function extractTrustCore() {
  const source = readMainSource();
  const start = source.indexOf('function isCurrentMainWindowSender(');
  const end = source.indexOf('function isCurrentDesktopLyricsWindowSender(', start + 1);
  assert.ok(start >= 0 && end > start, '未找到可信主 frame 校验接缝');
  return source.slice(start, end);
}

/**
 * 截取主进程真实授权实现，保证测试与运行逻辑同源。
 * @returns {{normalizeLocalMusicRoot: Function, rememberLocalMusicRoot: Function, resolveAuthorizedLocalFile: Function, roots: Set<string>}}
 */
function loadAuthorizer() {
  const source = readMainSource();
  const start = source.indexOf('function normalizeLocalMusicRoot(');
  const end = source.indexOf('function localLibraryRelativePath(', start);
  assert.ok(start >= 0 && end > start, '未找到主进程授权解析实现');
  const roots = new Set();
  const ctx = { path, fs, authorizedLocalMusicRoots: roots };
  vm.runInNewContext(source.slice(start, end), ctx);
  return {
    normalizeLocalMusicRoot: ctx.normalizeLocalMusicRoot,
    rememberLocalMusicRoot: ctx.rememberLocalMusicRoot,
    resolveAuthorizedLocalFile: ctx.resolveAuthorizedLocalFile,
    roots,
  };
}

/**
 * 模拟 ipcMain 注册表。
 */
class FakeIpcMain {
  constructor() { this.handlers = new Map(); this.onHandlers = new Map(); }
  handle(channel, handler) { this.handlers.set(channel, handler); }
  on(channel, handler) { this.onHandlers.set(channel, handler); }
}

/**
 * 截取一个 ipcMain.handle 注册语句（到语句分号为止）。
 * @param {string} source 主进程源码。
 * @param {string} channel IPC 通道名。
 * @returns {string} 注册语句源码。
 */
function extractIpcRegistration(source, channel) {
  const start = source.indexOf("ipcMain.handle('" + channel + "'");
  assert.ok(start >= 0, '未找到通道注册：' + channel);
  const openParen = source.indexOf('(', start);
  let depth = 0;
  for (let i = openParen; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '(' || ch === '{') depth += 1;
    else if (ch === ')' || ch === '}') depth -= 1;
    else if (ch === ';' && depth === 0) return source.slice(start, i + 1);
  }
  throw new Error('注册语句不闭合：' + channel);
}

// ---------------------------------------------------------------------------
// 导航拦截
// ---------------------------------------------------------------------------

/**
 * 在隔离 VM 中装载信任核心。
 * @returns {object} 可调用的信任函数与共享上下文。
 */
function loadTrustCore() {
  const trustedSender = {
    getURL: () => TRUSTED_MAIN_URL,
    isDestroyed: () => false,
  };
  const mainWindow = { isDestroyed: () => false, webContents: trustedSender };
  const context = {
    mainWindow,
    mainServerPort: 3000,
    URL,
  };
  vm.runInNewContext(extractTrustCore(), context);
  return {
    isTrustedMainDocumentUrl: context.isTrustedMainDocumentUrl,
    isTrustedMainFrameSender: context.isTrustedMainFrameSender,
    trustedMainFrameHandler: context.trustedMainFrameHandler,
    installMainWindowNavigationGuard: context.installMainWindowNavigationGuard,
    isCurrentMainWindowSender: context.isCurrentMainWindowSender,
    trustedSender,
    mainWindow,
  };
}

/**
 * 验证可信主文档 URL 白名单：只放行当前本地服务 / 与 /index.html。
 * @returns {void}
 */
function testTrustedMainDocumentUrl() {
  const { isTrustedMainDocumentUrl } = loadTrustCore();

  for (const url of [
    'http://127.0.0.1:3000/',
    'http://127.0.0.1:3000/index.html',
    'http://127.0.0.1:3000/index.html?refresh=1',
    'http://127.0.0.1:3000/index.html#section',
    'http://127.0.0.1:3000/index.html/',
  ]) {
    assert.equal(isTrustedMainDocumentUrl(url), true, '应放行可信主文档：' + url);
  }

  for (const url of [
    'https://127.0.0.1:3000/index.html',
    'http://localhost:3000/index.html',
    'http://0.0.0.0:3000/index.html',
    'http://127.0.0.1:3001/index.html',
    'http://127.0.0.1:3000/other.html',
    'http://127.0.0.1:3000/index2.html',
    'http://127.0.0.1:3000/index.html/../evil.html',
    'https://evil.example.com/x',
    'file:///C:/Users/Administrator/Desktop/Mineradio-main/public/index.html',
    'javascript:alert(1)',
    '',
    null,
  ]) {
    assert.equal(isTrustedMainDocumentUrl(url), false, '应拦截外部/非可信 URL：' + url);
  }
}

/**
 * 模拟带事件监听的 webContents，捕获导航事件并记录 preventDefault。
 * @returns {{on: Function, listeners: object}} 假 webContents。
 */
function makeFakeWebContents() {
  const listeners = {};
  return {
    on(name, handler) { listeners[name] = handler; },
    listeners,
  };
}

/**
 * 触发导航事件并返回是否被拦截。
 * @param {object} webContents 假 webContents。
 * @param {string} eventName 事件名。
 * @param {string} url 目标 URL。
 * @param {object} options 额外事件参数。
 * @returns {boolean} 导航被拦截时返回 true。
 */
function navigate(webContents, eventName, url, options = {}) {
  let prevented = false;
  const event = {
    preventDefault() { prevented = true; },
  };
  const handler = webContents.listeners[eventName];
  assert.equal(typeof handler, 'function', '导航守卫未安装：' + eventName);
  if (eventName === 'will-navigate') {
    handler(event, { url, isMainFrame: options.isMainFrame !== false }, url, false, options.isMainFrame !== false);
  } else {
    handler(event, {
      url,
      isMainFrame: options.isMainFrame !== false,
      frame: options.frame || null,
    });
  }
  return prevented;
}

/**
 * 验证主窗口导航守卫：外部页面、错误端口、其它路径与一切子 frame 导航都被拦截。
 * @returns {void}
 */
function testNavigationGuard() {
  const { installMainWindowNavigationGuard } = loadTrustCore();
  const win = { webContents: makeFakeWebContents() };
  installMainWindowNavigationGuard(win);

  assert.equal(navigate(win.webContents, 'will-navigate', 'http://127.0.0.1:3000/'), false);
  assert.equal(navigate(win.webContents, 'will-navigate', 'http://127.0.0.1:3000/index.html'), false);
  assert.equal(navigate(win.webContents, 'will-navigate', 'https://evil.example.com/'), true);
  assert.equal(navigate(win.webContents, 'will-navigate', 'http://127.0.0.1:3000/other.html'), true);
  assert.equal(navigate(win.webContents, 'will-navigate', 'http://127.0.0.1:9999/index.html'), true);
  assert.equal(navigate(win.webContents, 'will-navigate', 'http://localhost:3000/index.html'), true);

  assert.equal(navigate(win.webContents, 'will-frame-navigate', 'http://127.0.0.1:3000/index.html', { isMainFrame: true }), false);
  assert.equal(navigate(win.webContents, 'will-frame-navigate', 'https://evil.example.com/', { isMainFrame: true }), true);
  assert.equal(
    navigate(win.webContents, 'will-frame-navigate', 'http://127.0.0.1:3000/index.html', {
      isMainFrame: false,
      frame: { parent: {} },
    }),
    true,
    '非可信子 frame 即使指向本地页面也必须拦截',
  );
  assert.equal(
    navigate(win.webContents, 'will-frame-navigate', 'https://evil.example.com/', {
      isMainFrame: false,
      frame: { parent: {} },
    }),
    true,
  );
}

// ---------------------------------------------------------------------------
// 非法 sender
// ---------------------------------------------------------------------------

/**
 * 验证统一可信主 frame IPC 校验：身份、frame 归属与文档 URL 任一不满足即拒绝。
 * @returns {void}
 */
function testTrustedMainFrameSender() {
  const core = loadTrustCore();
  const { trustedSender, mainWindow } = core;
  const trustedFrameEvent = {
    sender: trustedSender,
    senderFrame: { parent: null, url: TRUSTED_MAIN_URL },
  };
  const trustedUrlFallbackEvent = { sender: trustedSender };
  const attackerSender = { getURL: () => 'https://evil.example.com/', isDestroyed: () => false };

  assert.equal(core.isTrustedMainFrameSender(null), false);
  assert.equal(core.isTrustedMainFrameSender({}), false);
  assert.equal(core.isTrustedMainFrameSender({ sender: null }), false);
  assert.equal(core.isTrustedMainFrameSender(trustedFrameEvent), true);
  assert.equal(core.isTrustedMainFrameSender(trustedUrlFallbackEvent), true);

  assert.equal(
    core.isTrustedMainFrameSender({ sender: attackerSender }),
    false,
    '已导航到外部页面的主窗口 sender 必须拒绝',
  );
  assert.equal(
    core.isTrustedMainFrameSender({
      sender: trustedSender,
      senderFrame: { parent: null, url: 'https://evil.example.com/' },
    }),
    false,
    '主 frame 文档不是可信地址时必须拒绝',
  );
  assert.equal(
    core.isTrustedMainFrameSender({
      sender: trustedSender,
      senderFrame: { parent: {} },
    }),
    false,
    '子 frame 发起的高权限调用必须拒绝',
  );
  assert.equal(
    core.isTrustedMainFrameSender({ sender: { getURL: () => TRUSTED_MAIN_URL } }),
    false,
    '非当前主窗口 webContents 必须拒绝',
  );
  assert.equal(
    core.isTrustedMainFrameSender({
      sender: {
        getURL: () => TRUSTED_MAIN_URL,
        isDestroyed: () => true,
      },
    }),
    false,
    '已销毁的 webContents 必须拒绝',
  );

  let invoked = 0;
  const wrapped = core.trustedMainFrameHandler(() => {
    invoked += 1;
    return { ok: true };
  });
  const forbidden = wrapped({ sender: attackerSender });
  assert.equal(forbidden.ok, false);
  assert.equal(forbidden.error, 'IPC_FORBIDDEN');
  assert.equal(invoked, 0, '非法 sender 不得进入业务处理');
  assert.equal(wrapped(trustedFrameEvent).ok, true);
  assert.equal(invoked, 1);

  assert.equal(core.isCurrentMainWindowSender(trustedFrameEvent), true);
  assert.equal(core.isCurrentMainWindowSender({ sender: attackerSender }), false);
  assert.equal(mainWindow.webContents, trustedSender);
}

// ---------------------------------------------------------------------------
// 任意目录扩权 / 文件读取
// ---------------------------------------------------------------------------

/**
 * 装载真实本地曲库扫描/刷新/读取 IPC 处理器（含可信主 frame 前置门）。
 * @returns {object} 处理器与共享状态。
 */
function loadLocalFileIpc() {
  const auth = loadAuthorizer();
  const trustedSender = {
    getURL: () => TRUSTED_MAIN_URL,
    isDestroyed: () => false,
  };
  const mainWindow = { isDestroyed: () => false, webContents: trustedSender };
  const ipcMain = new FakeIpcMain();
  const calls = { scans: 0, refreshes: 0, ranges: 0, dataUrls: 0 };

  const context = {
    ipcMain,
    mainWindow,
    mainServerPort: 3000,
    URL,
    rememberLocalMusicRoot: auth.rememberLocalMusicRoot,
    resolveAuthorizedLocalFile: auth.resolveAuthorizedLocalFile,
    normalizeLocalMusicRoot: auth.normalizeLocalMusicRoot,
    getSenderWindow() { return null; },
    dialog: {},
    async scanLocalMusicFolder(folderPath) {
      calls.scans += 1;
      const root = auth.rememberLocalMusicRoot(folderPath);
      return { ok: true, folderPath: root, files: [], directories: [], truncated: false };
    },
    async refreshLocalMusicFileEntries(folderPath) {
      calls.refreshes += 1;
      const root = auth.rememberLocalMusicRoot(folderPath);
      return { ok: true, folderPath: root, files: [], directories: [], snapshot: true };
    },
    async readAuthorizedLocalFileRange(filePath) {
      calls.ranges += 1;
      const target = auth.resolveAuthorizedLocalFile(filePath);
      return { ok: true, target };
    },
    async readAuthorizedLocalFileDataUrl(filePath) {
      calls.dataUrls += 1;
      const target = auth.resolveAuthorizedLocalFile(filePath);
      return { ok: true, target };
    },
  };

  const source = extractTrustCore()
    + '\n' + extractIpcRegistration(readMainSource(), 'mineradio-local-music-scan-folder')
    + '\n' + extractIpcRegistration(readMainSource(), 'mineradio-local-music-refresh-entries')
    + '\n' + extractIpcRegistration(readMainSource(), 'mineradio-local-file-read-range')
    + '\n' + extractIpcRegistration(readMainSource(), 'mineradio-local-file-read-data-url');
  vm.runInNewContext(source, context);

  return {
    handlers: {
      scan: ipcMain.handlers.get('mineradio-local-music-scan-folder'),
      refresh: ipcMain.handlers.get('mineradio-local-music-refresh-entries'),
      readRange: ipcMain.handlers.get('mineradio-local-file-read-range'),
      readDataUrl: ipcMain.handlers.get('mineradio-local-file-read-data-url'),
    },
    auth,
    calls,
    trustedEvent: { sender: trustedSender, senderFrame: { parent: null, url: TRUSTED_MAIN_URL } },
    attackerEvent: { sender: { getURL: () => 'https://evil.example.com/' } },
  };
}

/**
 * 验证非法 sender 不能扫描/刷新/读取，也不能扩大本地文件授权范围。
 * @returns {Promise<void>}
 */
async function testUntrustedSenderCannotExpandAuthorization() {
  const ipc = loadLocalFileIpc();
  const attacker = ipc.attackerEvent;

  function assertForbidden(result) {
    assert.equal(result.ok, false);
    assert.equal(result.error, 'IPC_FORBIDDEN');
  }
  assertForbidden(await ipc.handlers.scan(attacker, 'C:\\anywhere', {}));
  assertForbidden(await ipc.handlers.refresh(attacker, 'C:\\anywhere', []));
  assertForbidden(await ipc.handlers.readRange(attacker, 'C:\\anywhere\\song.mp3', 0, 100));
  assertForbidden(await ipc.handlers.readDataUrl(attacker, 'C:\\anywhere\\cover.jpg'));

  assert.equal(ipc.auth.roots.size, 0, '非法 sender 不得扩大授权根目录');
  assert.equal(ipc.calls.scans, 0);
  assert.equal(ipc.calls.refreshes, 0);
  assert.equal(ipc.calls.ranges, 0);
  assert.equal(ipc.calls.dataUrls, 0);
}

/**
 * 验证可信主 frame 扫描才可授权根目录，读取仍受授权边界约束。
 * @returns {Promise<void>}
 */
async function testTrustedScanAuthorizesAndReadStaysBounded() {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mnr-ipc-trust-'));
  try {
    const root = path.join(workDir, 'library');
    fs.mkdirSync(root, { recursive: true });
    const insideFile = path.join(root, 'song.mp3');
    fs.writeFileSync(insideFile, 'AUDIO');
    const secretFile = path.join(workDir, 'secret.txt');
    fs.writeFileSync(secretFile, 'SECRET');
    const ipc = loadLocalFileIpc();

    const scan = await ipc.handlers.scan(ipc.trustedEvent, root, {});
    assert.equal(scan.ok, true);
    assert.equal(ipc.auth.roots.has(root), true, '可信主 frame 扫描应完成授权');

    const inside = await ipc.handlers.readRange(ipc.trustedEvent, insideFile, 0, 5);
    assert.equal(inside.ok, true);
    assert.equal(inside.target, insideFile);

    const outside = await ipc.handlers.readRange(ipc.trustedEvent, secretFile, 0, 5);
    assert.equal(outside.ok, false);
    assert.equal(outside.error, 'LOCAL_FILE_NOT_AUTHORIZED');

    const dataUrlOutside = await ipc.handlers.readDataUrl(ipc.trustedEvent, secretFile);
    assert.equal(dataUrlOutside.ok, false);
    assert.equal(dataUrlOutside.error, 'LOCAL_FILE_NOT_AUTHORIZED');

    const traversal = path.join(root, '..', 'secret.txt');
    const traversed = await ipc.handlers.readRange(ipc.trustedEvent, traversal, 0, 5);
    assert.equal(traversed.ok, false);
    assert.equal(traversed.error, 'LOCAL_FILE_NOT_AUTHORIZED');
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

/**
 * 验证重启后由可信主 frame 重新恢复已导入曲库：刷新/扫描重新授权，读文件恢复可用。
 * @returns {Promise<void>}
 */
async function testRestartRestoreReauthorizesSavedLibrary() {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mnr-ipc-restore-'));
  try {
    const root = path.join(workDir, 'library');
    fs.mkdirSync(root, { recursive: true });
    const songFile = path.join(root, 'song.flac');
    fs.writeFileSync(songFile, 'FLAC-BYTES');

    // 首次启动：可信主 frame 导入并授权。
    const first = loadLocalFileIpc();
    const scan = await first.handlers.scan(first.trustedEvent, root, {});
    assert.equal(scan.ok, true);
    assert.equal(first.auth.roots.has(root), true);

    // 模拟重启：授权集合回到空（主进程只维护内存授权），渲染层用已保存路径恢复。
    const second = loadLocalFileIpc();
    assert.equal(second.auth.roots.size, 0, '重启后授权集合应为空');
    const restored = await second.handlers.refresh(second.trustedEvent, root, []);
    assert.equal(restored.ok, true, '可信主 frame 应能恢复已导入曲库');
    assert.equal(second.auth.roots.has(root), true, '恢复后根目录重新进入授权集合');

    const read = await second.handlers.readRange(second.trustedEvent, songFile, 0, 4);
    assert.equal(read.ok, true);
    assert.equal(read.target, songFile);
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// 接线回归：高权限 IPC 全部过可信主 frame 门
// ---------------------------------------------------------------------------

/**
 * 解析所有 ipcMain.handle 注册通道。
 * @param {string} source 主进程源码。
 * @returns {string[]} 通道名列表。
 */
function listHandleChannels(source) {
  const channels = [];
  const regex = /ipcMain\.handle\('([^']+)'/g;
  let match = null;
  while ((match = regex.exec(source)) !== null) channels.push(match[1]);
  return channels;
}

/**
 * 验证高权限 IPC 接线：受保护通道必须经 trustedMainFrameHandler 包装，
 * 新增未包装的高权限 handler 会被直接拦截在回归测试里。
 * @returns {void}
 */
function testHighPrivilegeIpcWiring() {
  const source = readMainSource();

  const gatedChannels = [
    'desktop-window-minimize',
    'desktop-window-toggle-maximize',
    'desktop-window-toggle-fullscreen',
    'desktop-window-exit-fullscreen-windowed',
    'desktop-window-get-state',
    'desktop-window-close',
    'mineradio-tray-get-settings',
    'mineradio-tray-set-close-to-tray',
    'mineradio-startup-set-enabled',
    'mineradio-mini-player-set-enabled',
    'mineradio-mini-player-set-mode',
    'mineradio-mini-player-update',
    'mineradio-hotkeys-configure-global',
    'mineradio-export-json-file',
    'mineradio-import-json-file',
    'mineradio-ui-state-write',
    'mineradio-local-music-choose-folder',
    'mineradio-local-music-scan-folder',
    'mineradio-local-music-refresh-entries',
    'mineradio-local-file-read-range',
    'mineradio-local-file-read-data-url',
    'mineradio-open-update-installer',
    'mineradio-restart-app',
    'mineradio-wallpaper-set-enabled',
    'mineradio-wallpaper-update',
  ];

  // 允许保持独立 sender 语义的通道：桌面歌词覆盖层与迷你播放器窗口自己持有的通道。
  const overlayOwnedChannels = new Set([
    'mineradio-desktop-lyrics-move-by',
    'mineradio-desktop-lyrics-playback-command',
    'mineradio-desktop-lyrics-set-dragging',
    'mineradio-desktop-lyrics-set-glow-strength',
    'mineradio-desktop-lyrics-set-hot-bounds',
    'mineradio-desktop-lyrics-set-lock-state',
    'mineradio-desktop-lyrics-set-pointer-capture',
    'mineradio-desktop-lyrics-set-size',
    'mineradio-desktop-lyrics-set-stable-state',
    'mineradio-mini-player-command',
  ]);

  // 双 sender 通道：主 renderer 分支必须走统一可信主 frame 校验。
  const dualSenderChannels = new Map([
    ['mineradio-desktop-lyrics-set-enabled', 'handleDesktopLyricsEnabledState'],
    ['mineradio-desktop-lyrics-update', 'handleDesktopLyricsStateUpdate'],
  ]);

  for (const channel of gatedChannels) {
    const registration = extractIpcRegistration(source, channel);
    assert.match(
      registration,
      /ipcMain\.handle\('([^']+)',\s*trustedMainFrameHandler\(/,
      '高权限通道必须经 trustedMainFrameHandler 包装：' + channel,
    );
  }

  const allChannels = listHandleChannels(source);
  for (const channel of allChannels) {
    if (overlayOwnedChannels.has(channel) || dualSenderChannels.has(channel)) continue;
    const registration = extractIpcRegistration(source, channel);
    assert.match(
      registration,
      /trustedMainFrameHandler\(/,
      '未在允许清单中的高权限通道必须经 trustedMainFrameHandler 包装：' + channel,
    );
  }

  for (const [channel, handlerName] of dualSenderChannels) {
    const handlerStart = source.indexOf('function ' + handlerName + '(');
    const handlerEnd = source.indexOf('ipcMain.handle(\'' + channel + '\'', handlerStart);
    assert.ok(handlerStart >= 0 && handlerEnd > handlerStart, '未找到双 sender 处理器：' + handlerName);
    const handlerSource = source.slice(handlerStart, handlerEnd);
    assert.match(handlerSource, /isCurrentMainWindowSender\(/, '双 sender 处理器主分支必须走主窗口校验：' + handlerName);
  }

  const mainSenderStart = source.indexOf('function isCurrentMainWindowSender(');
  const mainSenderEnd = source.indexOf('function isCurrentDesktopLyricsWindowSender(', mainSenderStart);
  assert.ok(mainSenderStart >= 0 && mainSenderEnd > mainSenderStart, '未找到 isCurrentMainWindowSender');
  const mainSenderSource = source.slice(mainSenderStart, mainSenderEnd);
  assert.match(mainSenderSource, /isTrustedMainFrameSender\(/, 'isCurrentMainWindowSender 必须委托统一可信校验');

  const readSyncStart = source.indexOf("ipcMain.on('mineradio-ui-state-read-sync'");
  const readSyncEnd = source.indexOf('\n});', readSyncStart) + 4;
  assert.ok(readSyncStart >= 0, '未找到同步读取处理器');
  assert.match(source.slice(readSyncStart, readSyncEnd), /isTrustedMainFrameSender\(/, '同步状态读取必须过可信主 frame 门');

  assert.match(source, /installMainWindowNavigationGuard\(mainWindow\)/, '主窗口必须安装导航守卫');
}

test('可信主文档 URL 只放行本地服务 / 与 /index.html', testTrustedMainDocumentUrl);
test('主窗口导航守卫拦截外部页面与非法 frame', testNavigationGuard);
test('统一可信主 frame 校验拒绝非法 sender', testTrustedMainFrameSender);
test('非法 sender 不能扩大本地文件授权范围', testUntrustedSenderCannotExpandAuthorization);
test('可信主 frame 扫描授权后读取仍受根目录边界约束', testTrustedScanAuthorizesAndReadStaysBounded);
test('重启后可信主 frame 恢复已导入曲库授权', testRestartRestoreReauthorizesSavedLibrary);
test('高权限 IPC 全部经可信主 frame 包装且新增未包装通道被拦截', testHighPrivilegeIpcWiring);
