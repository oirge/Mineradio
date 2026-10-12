'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { MiniPlayerStateCache } = require('../desktop/mini-player-state-cache');
const { beginMiniPlayerCoverDrag, updateMiniPlayerCoverDrag } = require('../desktop/mini-player-cover-drag');

/**
 * 读取主进程源码。
 * @returns {string} 完整 main.js 文本。
 */
function readMainSource() {
  return fs.readFileSync(path.join(__dirname, '..', 'desktop', 'main.js'), 'utf8');
}

/**
 * 按相邻函数名截取一个真实主进程函数。
 * @param {string} source 主进程源码。
 * @param {string} name 目标函数名。
 * @param {string} nextName 下一函数名。
 * @returns {string} 目标函数源码。
 */
function extractFunction(source, name, nextName) {
  const start = source.indexOf('function ' + name + '(');
  const end = source.indexOf('function ' + nextName + '(', start + 1);
  assert.ok(start >= 0 && end > start, '未找到主进程函数：' + name);
  return source.slice(start, end);
}

/**
 * 截取命名 IPC 处理函数到其注册语句之前。
 * @param {string} source 主进程源码。
 * @param {string} name 处理函数名。
 * @param {string} channel IPC 通道名。
 * @returns {string} 处理函数源码。
 */
function extractIpcHandler(source, name, channel) {
  const start = source.indexOf('function ' + name + '(');
  const end = source.indexOf("\nipcMain.handle('" + channel + "'", start + 1);
  assert.ok(start >= 0 && end > start, '未找到主进程 IPC 处理函数：' + name);
  return source.slice(start, end);
}

/** @returns {boolean} 假主窗口未被销毁。 */
function isWindowDestroyed() { return false; }

/** @returns {boolean} 假主窗口处于最小化状态。 */
function isWindowMinimized() { return true; }

/** @returns {boolean} 假主窗口当前不可见。 */
function isWindowVisible() { return false; }

/**
 * 验证锁屏/休眠暂停状态真正接入主进程显示门禁。
 * @returns {void}
 */
function testPausedRecoverySessionBlocksMiniPlayerVisibility() {
  const context = {
    miniPlayerRecoverySession: { paused: true },
    miniPlayerEnabled: true,
    miniPlayerActive: true,
    mainWindow: {
      isDestroyed: isWindowDestroyed,
      isMinimized: isWindowMinimized,
      isVisible: isWindowVisible,
    },
  };
  vm.runInNewContext(
    extractFunction(readMainSource(), 'shouldShowMiniPlayer', 'stopMiniPlayerRecoveryTimer')
      + '\nthis.shouldShow = shouldShowMiniPlayer;',
    context,
  );

  assert.equal(context.shouldShow(), false);
  context.miniPlayerRecoverySession.paused = false;
  assert.equal(context.shouldShow(), true);

  context.miniPlayerEnabled = false;
  assert.equal(context.shouldShow(), false);
}

/**
 * 验证暂停期间 renderer 故障不会排入 120ms 重载/重建任务。
 * @returns {void}
 */
function testPausedRecoverySessionBlocksCrashRecovery() {
  const win = {};
  const calls = { timers: 0 };

  /**
   * 记录不应创建的恢复定时器。
   * @returns {{unref: Function}} 假定时器句柄。
   */
  function setTimeoutStub() {
    calls.timers += 1;
    /** @returns {void} 假定时器无需解除事件循环引用。 */
    function unrefTimer() {}
    return { unref: unrefTimer };
  }

  const context = {
    appQuitting: false,
    miniPlayerRecoverySession: { paused: true },
    miniPlayerWindow: win,
    miniPlayerProgrammaticCloseWindows: new WeakSet(),
    miniPlayerRecreateTimer: null,
    setTimeout: setTimeoutStub,
    console,
  };
  vm.runInNewContext(
    extractFunction(readMainSource(), 'scheduleMiniPlayerWindowRecovery', 'handleMiniPlayerSystemSuspend')
      + '\nthis.scheduleRecovery = scheduleMiniPlayerWindowRecovery;',
    context,
  );

  context.scheduleRecovery(win, 'renderer-gone:crashed');
  assert.equal(calls.timers, 0);
  assert.equal(context.miniPlayerRecreateTimer, null);
}

/**
 * 验证禁用态状态缓存真正接入主进程 IPC，并且不会触发窗口发送。
 * @returns {void}
 */
function testDisabledStateCacheBlocksMainProcessPatch() {
  const sender = {};
  const stateCache = new MiniPlayerStateCache(false);
  const calls = { sends: 0 };

  /** @returns {void} 记录不应发生的迷你窗口状态发送。 */
  function sendMiniPlayerState() { calls.sends += 1; }

  const context = {
    mainWindow: {
      isDestroyed: isWindowDestroyed,
      webContents: sender,
    },
    miniPlayerStateCache: stateCache,
    sendMiniPlayerState,
  };
  vm.runInNewContext(
    extractIpcHandler(readMainSource(), 'handleMiniPlayerStateUpdate', 'mineradio-mini-player-update')
      + '\nthis.handleUpdate = handleMiniPlayerStateUpdate;',
    context,
  );

  const result = context.handleUpdate({ sender }, {
    title: '不应保留',
    cover: 'data:image/png;base64,' + 'A'.repeat(64 * 1024),
    hasTrack: true,
  });
  assert.equal(result.ok, true);
  assert.equal(result.ignored, true);
  assert.equal(stateCache.value.cover, '');
  assert.equal(calls.sends, 0);
}

/**
 * 验证销毁当前迷你窗口时同步释放主进程缓存中的封面状态。
 * @returns {void}
 */
function testDestroyingMiniPlayerWindowReleasesCachedState() {
  const calls = { destroys: 0 };
  const win = {
    /** @returns {boolean} 假窗口在销毁前仍有效。 */
    isDestroyed() { return false; },
    /** @returns {void} 记录主进程销毁窗口。 */
    destroy() { calls.destroys += 1; },
  };
  const stateCache = new MiniPlayerStateCache(true);
  stateCache.setResident(true);
  stateCache.apply({ cover: 'large-cover', hasTrack: true });
  const context = {
    miniPlayerRendererReloadWindows: new WeakSet(),
    miniPlayerWindow: win,
    miniPlayerUserMovePending: true,
    miniPlayerCoverDragSession: {},
    miniPlayerLastSentState: {},
    miniPlayerProgrammaticCloseWindows: new WeakSet(),
    miniPlayerStateCache: stateCache,
  };
  vm.runInNewContext(
    extractFunction(readMainSource(), 'destroyMiniPlayerWindowInstance', 'scheduleMiniPlayerWindowRecovery')
      + '\nthis.destroyMiniPlayer = destroyMiniPlayerWindowInstance;',
    context,
  );

  context.destroyMiniPlayer(win);

  assert.equal(calls.destroys, 1);
  assert.equal(context.miniPlayerWindow, null);
  assert.equal(stateCache.value.cover, '');
  assert.equal(stateCache.apply({ cover: 'late-cover', hasTrack: true }), false);
}

/**
 * 验证新迷你窗口取得所有权后才接收状态，且旧关闭事件不能释放替代窗口缓存。
 * @returns {void}
 */
function testCreatingMiniPlayerWindowStartsFreshResidency() {
  const calls = { syncRequests: 0 };
  const stateCache = new MiniPlayerStateCache(true);
  const windowEvents = {};

  /** @returns {void} 假事件注册无需执行回调。 */
  function ignoreEventRegistration() {}

  /** @param {string} name 事件名。 @param {Function} handler 事件处理函数。 @returns {void} 保存窗口事件供生命周期断言调用。 */
  function registerWindowEvent(name, handler) { windowEvents[name] = handler; }

  /** @returns {void} 假加载失败处理无需执行。 */
  function ignoreLoadFailure() {}

  /** @returns {{catch: Function}} 提供与 BrowserWindow.loadURL 一致的最小返回值。 */
  function loadMiniPlayerPage() { return { catch: ignoreLoadFailure }; }

  const win = {
    isDestroyed: isWindowDestroyed,
    webContents: {
      setWindowOpenHandler: ignoreEventRegistration,
      on: ignoreEventRegistration,
    },
    once: ignoreEventRegistration,
    on: registerWindowEvent,
    loadURL: loadMiniPlayerPage,
  };

  /** @returns {object} 返回唯一的假迷你窗口。 */
  function BrowserWindowStub() { return win; }

  /** @returns {{x:number, y:number, width:number, height:number}} 返回固定窗口范围。 */
  function miniPlayerDefaultBounds() { return { x: 0, y: 0, width: 360, height: 84 }; }

  /** @param {object} bounds 原始范围。 @returns {object} 不需要校正的范围。 */
  function clampMiniPlayerBounds(bounds) { return bounds; }

  /** @returns {void} 记录主 renderer 完整状态同步请求。 */
  function requestMiniPlayerStateSync() { calls.syncRequests += 1; }

  /** @returns {string} 返回测试用迷你页面地址。 */
  function overlayUrl() { return 'file://mini-player.html'; }

  const context = {
    miniPlayerWindow: null,
    miniPlayerUserMovePending: false,
    miniPlayerCoverDragSession: null,
    miniPlayerCoverLayouts: new WeakMap(),
    miniPlayerMode: 'standard',
    miniPlayerUserBoundsByMode: { standard: null, compact: null },
    miniPlayerWindowModes: new WeakMap(),
    miniPlayerExpandDirections: new WeakMap(),
    miniPlayerStateCache: stateCache,
    miniPlayerRendererReloadWindows: new WeakSet(),
    miniPlayerProgrammaticCloseWindows: new WeakSet(),
    appQuitting: false,
    BrowserWindow: BrowserWindowStub,
    APP_ICON_ICO: '',
    path,
    __dirname: path.join(__dirname, '..', 'desktop'),
    clampMiniPlayerBounds,
    miniPlayerDefaultBounds,
    normalizeMiniPlayerMode(value) { return value === 'compact' ? 'compact' : 'standard'; },
    miniPlayerExpandDirectionForBounds() { return 'right'; },
    miniPlayerExpandDirectionFromBoundsState(bounds) {
      return bounds && (bounds.expandDirection === 'left' || bounds.expandDirection === 'right')
        ? bounds.expandDirection
        : 'right';
    },
    requestMiniPlayerStateSync,
    keepMiniPlayerOnTop: ignoreEventRegistration,
    beginMiniPlayerUserMove: ignoreEventRegistration,
    handleMiniPlayerMoved: ignoreEventRegistration,
    positionMiniPlayerWindow: ignoreEventRegistration,
    shouldShowMiniPlayer: isWindowDestroyed,
    sendMiniPlayerState: ignoreEventRegistration,
    scheduleMiniPlayerRecovery: ignoreEventRegistration,
    focusMainWindow: ignoreEventRegistration,
    installMiniPlayerNavigationGuard: ignoreEventRegistration,
    overlayUrl,
    console,
  };
  vm.runInNewContext(
    extractFunction(readMainSource(), 'createMiniPlayerWindow', 'showMiniPlayerWindow')
      + '\nthis.createMiniPlayer = createMiniPlayerWindow;',
    context,
  );

  assert.equal(context.createMiniPlayer(), win);
  assert.equal(calls.syncRequests, 1);
  assert.equal(stateCache.apply({ cover: 'fresh-cover', hasTrack: true }), true);
  assert.equal(stateCache.value.cover, 'fresh-cover');

  const replacementWindow = {};
  context.miniPlayerWindow = replacementWindow;
  windowEvents.closed();

  assert.equal(context.miniPlayerWindow, replacementWindow);
  assert.equal(stateCache.value.cover, 'fresh-cover');

  context.miniPlayerWindow = win;
  windowEvents.closed();

  assert.equal(context.miniPlayerWindow, null);
  assert.equal(stateCache.value.cover, '');
  assert.equal(stateCache.apply({ cover: 'late-cover', hasTrack: true }), false);
}

/**
 * 验证标准迷你播放器靠近右侧时将完整面板切换为向左展开。
 * @returns {void}
 */
function testMiniPlayerExpansionDirectionFollowsNearbyScreenEdge() {
  const display = { workArea: { x: 0, y: 0, width: 1920, height: 1080 } };
  const explicitDirections = new WeakMap();
  const context = {
    miniPlayerExpandDirections: explicitDirections,
    miniPlayerDefaultBounds() { return { x: 0, y: 0, width: 360, height: 84 }; },
    screen: {
      /** @returns {object} 返回同一测试显示器。 */
      getDisplayMatching() { return display; },
      /** @returns {object} 返回同一测试显示器。 */
      getPrimaryDisplay() { return display; },
    },
  };
  vm.runInNewContext(
    extractFunction(readMainSource(), 'miniPlayerExpandDirectionForBounds', 'miniPlayerCoverDragWorkArea')
      + '\nthis.expandDirection = miniPlayerExpandDirectionForBounds;'
      + '\nthis.expandDirectionForWindow = miniPlayerExpandDirectionForWindow;',
    context,
  );

  assert.equal(context.expandDirection({ x: 42, y: 120, width: 360, height: 84 }), 'right');
  assert.equal(context.expandDirection({ x: 1518, y: 120, width: 360, height: 84 }), 'left');
  const win = {
    isDestroyed() { return false; },
    getBounds() { return { x: 1518, y: 120, width: 360, height: 84 }; },
  };
  assert.equal(context.expandDirectionForWindow(win), 'left');
  explicitDirections.set(win, 'right');
  assert.equal(context.expandDirectionForWindow(win), 'right');
}

/**
 * 验证封面拖动仅移动当前迷你窗口，拖动期间不写盘，结束时只保存一次。
 * @returns {void}
 */
function testMiniPlayerCoverMoveIpcMovesCurrentWindow() {
  const calls = { persists: 0, sends: 0 };
  let bounds = { x: 1560, y: 240, width: 360, height: 84 };
  const sender = {};
  const primaryDisplay = { workArea: { x: 0, y: 0, width: 1920, height: 1080 } };
  const secondaryDisplay = { workArea: { x: 1920, y: 0, width: 1920, height: 1080 } };
  const win = {
    /** @returns {boolean} 假迷你窗口仍有效。 */
    isDestroyed() { return false; },
    webContents: sender,
    /** @returns {{x:number,y:number,width:number,height:number}} 返回当前假窗口边界。 */
    getBounds() { return bounds; },
    /** @param {{x:number,y:number,width:number,height:number}} next 下一窗口边界。 @returns {void} 保存模拟移动结果。 */
    setBounds(next) { bounds = next; },
  };

  /** @param {unknown} value 原始数值。 @param {number} min 最小值。 @param {number} max 最大值。 @param {number} fallback 无效值回退。 @returns {number} 已夹紧的数值。 */
  function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(min, Math.min(max, number));
  }

  /** @returns {'standard'} 当前测试窗口固定为标准样式。 */
  function miniPlayerModeForWindow() { return 'standard'; }

  /** @returns {void} 记录坐标持久化。 */
  function persistMiniPlayerUserBounds() { calls.persists += 1; }

  /** @returns {void} 记录状态同步。 */
  function sendMiniPlayerState() { calls.sends += 1; }

  const context = {
    miniPlayerWindow: win,
    miniPlayerUserMovePending: true,
    miniPlayerCoverDragSession: null,
    miniPlayerCoverLayouts: new WeakMap(),
    miniPlayerCoverDragGeneration: 0,
    miniPlayerDisplayTopologyDirty: false,
    miniPlayerUserBoundsByMode: { standard: null, compact: null },
    miniPlayerExpandDirections: new WeakMap([[win, 'left']]),
    MINI_PLAYER_COVER_SIZE: 54,
    screen: {
      /** @param {{x:number,width:number}} rect 期望封面矩形。 @returns {object} 封面大部分所在显示器。 */
      getDisplayMatching(rect) { return rect.x + rect.width / 2 >= 1920 ? secondaryDisplay : primaryDisplay; },
      /** @returns {Array<object>} 返回相邻的两块测试显示器。 */
      getAllDisplays() { return [primaryDisplay, secondaryDisplay]; },
      /** @returns {object} 返回主显示器。 */
      getPrimaryDisplay() { return primaryDisplay; },
    },
    beginMiniPlayerCoverDrag,
    clampNumber,
    updateMiniPlayerCoverDrag,
    miniPlayerModeForWindow,
    miniPlayerExpandDirectionForWindow() { return context.miniPlayerExpandDirections.get(win) || 'right'; },
    isTrustedMiniPlayerFrameSender(event) { return !!event && event.sender === sender; },
    persistMiniPlayerUserBounds,
    sendMiniPlayerState,
  };
  vm.runInNewContext(
    extractFunction(readMainSource(), 'normalizeMiniPlayerCoverDragMeta', 'miniPlayerBoundsSignature')
      + extractFunction(readMainSource(), 'miniPlayerCoverDragWorkArea', 'advanceMiniPlayerCoverDragGeneration')
      + extractIpcHandler(readMainSource(), 'handleMiniPlayerMoveBy', 'mineradio-mini-player-move-by')
      + '\nthis.moveBy = handleMiniPlayerMoveBy;',
    context,
  );

  const dragMeta = { generation: 1, layout: 'collapsed' };
  assert.equal(context.moveBy({ sender }, 24, 0, false, dragMeta).ok, true);
  assert.deepEqual(bounds, { x: 1584, y: 240, width: 360, height: 84 });
  assert.equal(context.miniPlayerUserMovePending, false);
  assert.deepEqual(
    JSON.parse(JSON.stringify(context.miniPlayerUserBoundsByMode.standard)),
    { ...bounds, expandDirection: 'left' },
  );
  assert.deepEqual(calls, { persists: 0, sends: 1 });

  assert.equal(context.moveBy({ sender }, 18, 0, false, dragMeta).ok, true);
  assert.deepEqual(bounds, { x: 1894, y: 240, width: 360, height: 84 });
  assert.equal(context.miniPlayerExpandDirections.get(win), 'right');
  assert.deepEqual(
    JSON.parse(JSON.stringify(context.miniPlayerUserBoundsByMode.standard)),
    { ...bounds, expandDirection: 'right' },
  );
  assert.deepEqual(calls, { persists: 0, sends: 2 });

  assert.equal(context.moveBy({ sender }, 0, 0, true, dragMeta).ok, true);
  assert.equal(context.miniPlayerCoverDragSession, null);
  assert.deepEqual(calls, { persists: 1, sends: 3 });
  assert.equal(context.moveBy({ sender: {} }, 20, 20).ignored, true);
  assert.deepEqual(calls, { persists: 1, sends: 3 });
}

/**
 * 验证收回态鼠标穿透只由当前迷你窗口驱动，且重复上报不重复设置窗口。
 * @returns {void}
 */
function testMiniPlayerPointerPassthroughGate() {
  const calls = [];
  const sender = {};
  const win = {
    /** @returns {boolean} 假迷你窗口仍有效。 */
    isDestroyed() { return false; },
    webContents: sender,
    /** @param {boolean} ignore 是否让出鼠标事件。 @param {{forward?:boolean}=} options 转发选项。 @returns {void} 记录窗口命中设置。 */
    setIgnoreMouseEvents(ignore, options) { calls.push({ ignore, forward: options ? options.forward === true : false }); },
  };
  const context = {
    miniPlayerWindow: win,
    miniPlayerPointerPassthrough: false,
    isTrustedMiniPlayerFrameSender(event) { return !!event && event.sender === sender; },
    miniPlayerModeForWindow() { return 'standard'; },
  };
  vm.runInNewContext(
    extractIpcHandler(readMainSource(), 'handleMiniPlayerPointerPassthrough', 'mineradio-mini-player-set-pointer-passthrough')
      + '\nthis.setPassthrough = handleMiniPlayerPointerPassthrough;'
      + '\nthis.readPassthrough = function(){ return miniPlayerPointerPassthrough; };',
    context,
  );

  assert.equal(context.setPassthrough({ sender }, true).ok, true);
  assert.deepEqual(calls, [{ ignore: true, forward: true }]);
  assert.equal(context.readPassthrough(), true);

  assert.equal(context.setPassthrough({ sender }, true).ignored, true);
  assert.deepEqual(calls, [{ ignore: true, forward: true }]);

  assert.equal(context.setPassthrough({ sender }, false).ok, true);
  assert.deepEqual(calls, [{ ignore: true, forward: true }, { ignore: false, forward: false }]);
  assert.equal(context.readPassthrough(), false);

  assert.equal(context.setPassthrough({ sender: {} }, true).ignored, true);
  assert.equal(calls.length, 2);
  assert.equal(context.readPassthrough(), false);
}

/**
 * 验证极简迷你播放器拒绝穿透请求，并清理旧标准模式残留的窗口穿透状态。
 * @returns {void}
 */
function testCompactMiniPlayerPointerPassthroughGate() {
  const calls = [];
  const sender = {};
  const win = {
    /** @returns {boolean} 假迷你窗口仍有效。 */
    isDestroyed() { return false; },
    webContents: sender,
    /** @param {boolean} ignore 是否让出鼠标事件。 @returns {void} 记录窗口命中设置。 */
    setIgnoreMouseEvents(ignore) { calls.push(ignore); },
  };
  const context = {
    miniPlayerWindow: win,
    miniPlayerPointerPassthrough: true,
    isTrustedMiniPlayerFrameSender(event) { return !!event && event.sender === sender; },
    miniPlayerModeForWindow() { return 'compact'; },
  };
  vm.runInNewContext(
    extractIpcHandler(readMainSource(), 'handleMiniPlayerPointerPassthrough', 'mineradio-mini-player-set-pointer-passthrough')
      + '\nthis.setPassthrough = handleMiniPlayerPointerPassthrough;'
      + '\nthis.readPassthrough = function(){ return miniPlayerPointerPassthrough; };',
    context,
  );

  const result = context.setPassthrough({ sender }, true);
  assert.equal(result.ok, true);
  assert.equal(result.ignored, true);
  assert.deepEqual(calls, [false]);
  assert.equal(context.readPassthrough(), false);

  const secondResult = context.setPassthrough({ sender }, false);
  assert.equal(secondResult.ok, true);
  assert.equal(secondResult.ignored, true);
  assert.deepEqual(calls, [false]);
}

/**
 * 验证实测展开态锚点进入主进程后不跳位，旧代际的迟到 commit 不能清掉新会话。
 * @returns {void}
 */
function testMiniPlayerCoverDragGenerationAndAnchor() {
  const persists = [];
  let bounds = { x: 680, y: 240, width: 360, height: 84 };
  const sender = {};
  const display = { workArea: { x: 0, y: 0, width: 1920, height: 1080 } };
  const win = {
    isDestroyed() { return false; },
    webContents: sender,
    getBounds() { return bounds; },
    setBounds(next) { bounds = next; },
  };
  const context = {
    miniPlayerWindow: win,
    miniPlayerUserMovePending: true,
    miniPlayerCoverDragSession: null,
    miniPlayerCoverLayouts: new WeakMap(),
    miniPlayerCoverDragGeneration: 0,
    miniPlayerDisplayTopologyDirty: false,
    miniPlayerUserBoundsByMode: { standard: null, compact: null },
    miniPlayerExpandDirections: new WeakMap([[win, 'right']]),
    MINI_PLAYER_COVER_SIZE: 54,
    screen: {
      getDisplayMatching() { return display; },
      getAllDisplays() { return [display]; },
      getPrimaryDisplay() { return display; },
    },
    beginMiniPlayerCoverDrag,
    clampNumber(value, min, max, fallback) {
      const number = Number(value);
      return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
    },
    updateMiniPlayerCoverDrag,
    miniPlayerModeForWindow() { return 'standard'; },
    miniPlayerExpandDirectionForWindow() { return 'right'; },
    isTrustedMiniPlayerFrameSender(event) { return !!event && event.sender === sender; },
    persistMiniPlayerUserBounds(value) { persists.push(JSON.parse(JSON.stringify(value))); },
    sendMiniPlayerState() {},
  };
  vm.runInNewContext(
    extractFunction(readMainSource(), 'normalizeMiniPlayerCoverDragMeta', 'miniPlayerBoundsSignature')
      + extractFunction(readMainSource(), 'miniPlayerCoverDragWorkArea', 'advanceMiniPlayerCoverDragGeneration')
      + extractIpcHandler(readMainSource(), 'handleMiniPlayerMoveBy', 'mineradio-mini-player-move-by')
      + '\nthis.moveBy = handleMiniPlayerMoveBy;',
    context,
  );

  const firstMeta = { generation: 1, anchor: { x: 694, y: 255 }, layout: 'expanded' };
  assert.equal(context.moveBy({ sender }, 12, 6, false, firstMeta).ok, true);
  assert.deepEqual(bounds, { x: 692, y: 246, width: 360, height: 84 });
  assert.equal(context.miniPlayerCoverDragSession.generation, 1);

  const secondMeta = { generation: 2, anchor: { x: 706, y: 261 }, layout: 'expanded' };
  assert.equal(context.moveBy({ sender }, 5, 0, false, secondMeta).ok, true);
  assert.deepEqual(bounds, { x: 697, y: 246, width: 360, height: 84 });
  assert.equal(context.miniPlayerCoverDragSession.generation, 2);

  const staleCommit = context.moveBy({ sender }, 0, 0, true, firstMeta);
  assert.equal(staleCommit.ok, true);
  assert.equal(staleCommit.ignored, true);
  assert.equal(context.miniPlayerCoverDragSession.generation, 2);
  assert.equal(persists.length, 0);

  assert.equal(context.moveBy({ sender }, 0, 0, true, secondMeta).ok, true);
  assert.equal(context.miniPlayerCoverDragSession, null);
  assert.deepEqual(persists, [{ x: 697, y: 246, width: 360, height: 84, expandDirection: 'right' }]);
}

/**
 * 验证窗口原生 setBounds 失败时会话立即失效，后续请求不会沿着未落地坐标继续。
 * @returns {void}
 */
function testMiniPlayerCoverDragSetBoundsFailureClearsSession() {
  let bounds = { x: 680, y: 240, width: 360, height: 84 };
  const sender = {};
  const display = { workArea: { x: 0, y: 0, width: 1920, height: 1080 } };
  let shouldFail = true;
  const win = {
    isDestroyed() { return false; },
    webContents: sender,
    getBounds() { return bounds; },
    setBounds(next) {
      if (shouldFail) {
        shouldFail = false;
        throw new Error('simulated setBounds failure');
      }
      bounds = next;
    },
  };
  const context = {
    miniPlayerWindow: win,
    miniPlayerUserMovePending: false,
    miniPlayerCoverDragSession: null,
    miniPlayerCoverDragGeneration: 0,
    miniPlayerUserBoundsByMode: { standard: null, compact: null },
    miniPlayerExpandDirections: new WeakMap([[win, 'right']]),
    miniPlayerCoverLayouts: new WeakMap(),
    MINI_PLAYER_COVER_SIZE: 54,
    screen: {
      getDisplayMatching() { return display; },
      getAllDisplays() { return [display]; },
      getPrimaryDisplay() { return display; },
    },
    beginMiniPlayerCoverDrag,
    clampNumber(value, min, max, fallback) {
      const number = Number(value);
      return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
    },
    updateMiniPlayerCoverDrag,
    miniPlayerModeForWindow() { return 'standard'; },
    miniPlayerExpandDirectionForWindow() { return 'right'; },
    isTrustedMiniPlayerFrameSender(event) { return !!event && event.sender === sender; },
    persistMiniPlayerUserBounds() {},
    sendMiniPlayerState() {},
  };
  vm.runInNewContext(
    extractFunction(readMainSource(), 'normalizeMiniPlayerCoverDragMeta', 'miniPlayerBoundsSignature')
      + extractFunction(readMainSource(), 'miniPlayerCoverDragWorkArea', 'advanceMiniPlayerCoverDragGeneration')
      + extractIpcHandler(readMainSource(), 'handleMiniPlayerMoveBy', 'mineradio-mini-player-move-by')
      + '\nthis.moveBy = handleMiniPlayerMoveBy;',
    context,
  );

  const failed = context.moveBy({ sender }, 10, 0, false, {
    generation: 1,
    anchor: { x: 694, y: 255 },
    layout: 'expanded',
  });
  assert.equal(failed.ok, false);
  assert.equal(context.miniPlayerCoverDragSession, null);
  assert.deepEqual(bounds, { x: 680, y: 240, width: 360, height: 84 });
}

/**
 * 验证迷你播放器穿透通道在 preload 暴露，并随窗口生命周期重置缓存。
 * @returns {void}
 */
function testMiniPlayerPointerPassthroughWiring() {
  const preload = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'mini-player-preload.js'), 'utf8');
  const main = readMainSource();

  assert.match(preload, /setPointerPassthrough:[\s\S]*?'mineradio-mini-player-set-pointer-passthrough'/);
  assert.match(preload, /setPointerPassthroughSync:[\s\S]*?ipcRenderer\.sendSync\([\s\S]*?'mineradio-mini-player-set-pointer-passthrough-sync'/);
  assert.match(main, /ipcMain\.on\('mineradio-mini-player-set-pointer-passthrough-sync',[\s\S]*?event\.returnValue = handleMiniPlayerPointerPassthrough\(event, passthrough\)/);
  assert.match(main, /function createMiniPlayerWindow\(\)[\s\S]*?miniPlayerPointerPassthrough = false;/);
  assert.match(main, /function destroyMiniPlayerWindowInstance\(win\)[\s\S]*?miniPlayerPointerPassthrough = false;/);
  assert.match(main, /const topologyAnchor = \{[\s\S]*?session\.coverX[\s\S]*?session\.coverY[\s\S]*?session\.layout[\s\S]*?reconcileMiniPlayerAfterDisplayTopology\(topologyAnchor\)/);
  assert.match(main, /function advanceMiniPlayerCoverDragGeneration\(\)[\s\S]*?miniPlayerUserMovePending = false;/);
}

test('暂停会话接入迷你播放器显示门禁', testPausedRecoverySessionBlocksMiniPlayerVisibility);
test('暂停会话阻止迷你 renderer 崩溃恢复任务', testPausedRecoverySessionBlocksCrashRecovery);
test('禁用状态缓存接入迷你播放器主进程 IPC', testDisabledStateCacheBlocksMainProcessPatch);
test('销毁迷你窗口同步释放主进程封面缓存', testDestroyingMiniPlayerWindowReleasesCachedState);
test('创建迷你窗口后补齐状态且旧关闭事件不越权', testCreatingMiniPlayerWindowStartsFreshResidency);
test('标准迷你播放器按临近屏幕边缘切换展开方向', testMiniPlayerExpansionDirectionFollowsNearbyScreenEdge);
test('封面拖动 IPC 仅在结束时保存当前窗口坐标', testMiniPlayerCoverMoveIpcMovesCurrentWindow);
test('收回态鼠标穿透 IPC 只服务当前迷你窗口', testMiniPlayerPointerPassthroughGate);
test('极简迷你播放器拒绝鼠标穿透并恢复旧状态', testCompactMiniPlayerPointerPassthroughGate);
test('封面拖动代际与展开态锚点互不串线', testMiniPlayerCoverDragGenerationAndAnchor);
test('封面拖动 setBounds 失败会清理会话', testMiniPlayerCoverDragSetBoundsFailureClearsSession);
test('鼠标穿透通道在 preload 暴露并随窗口生命周期重置', testMiniPlayerPointerPassthroughWiring);
