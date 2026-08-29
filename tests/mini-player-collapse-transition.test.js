'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/**
 * 读取仓库内文件。
 * @param {string} relativePath 相对仓库根目录的路径。
 * @returns {string} 文件文本。
 */
function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/**
 * 按起止标记截取源码块。
 * @param {string} source 源码文本。
 * @param {string} startMarker 起始标记。
 * @param {string} endMarker 结束标记。
 * @returns {string} 源码块。
 */
function readFunctionBlock(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `未找到源码块: ${startMarker}`);
  return source.slice(start, end);
}

/**
 * 按相邻函数名截取一个主进程函数。
 * @param {string} source 主进程源码。
 * @param {string} name 目标函数名。
 * @param {string} nextName 下一函数名。
 * @returns {string} 目标函数源码。
 */
function extractFunction(source, name, nextName) {
  return readFunctionBlock(source, `function ${name}(`, `function ${nextName}(`);
}

/**
 * 构造收缩过渡的假 renderer 环境。
 * @param {{miniPlayer?: boolean, fullscreen?: boolean, reduced?: boolean, prepare?: Function}=} options 环境选项。
 * @returns {{context: object, classes: Set<string>, timers: Map<number, object>, vars: Map<string, string>, calls: object}} vm 上下文与观测集合。
 */
function createCollapseContext(options) {
  const opts = options || {};
  const classes = new Set(['desktop-shell']);
  const timers = new Map();
  const vars = new Map();
  const calls = { minimize: 0, prepare: 0 };
  let nextTimer = 1;
  const context = {
    window: {
      matchMedia: () => ({ matches: opts.reduced === true }),
      desktopWindow: {
        isDesktop: true,
        minimize: () => { calls.minimize += 1; return Promise.resolve({ ok: true }); },
        prepareMiniPlayerTransition: () => {
          calls.prepare += 1;
          if (typeof opts.prepare === 'function') return opts.prepare();
          return Promise.resolve({ ok: true, prepared: true, origin: { x: 0.94, y: 0.97 } });
        },
      },
    },
    document: {
      documentElement: { style: { setProperty: (name, value) => vars.set(name, value) } },
      body: {
        offsetWidth: 1280,
        classList: {
          add: (...names) => names.forEach((name) => classes.add(name)),
          remove: (...names) => names.forEach((name) => classes.delete(name)),
          contains: (name) => classes.has(name),
        },
      },
    },
    desktopShellSettings: { miniPlayer: opts.miniPlayer !== false },
    fullscreenTransitionState: { active: false },
    isFullscreenUiActive: () => opts.fullscreen === true,
    setTimeout: (callback, delay) => {
      const id = nextTimer++;
      timers.set(id, { callback, delay });
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
    Math,
    isFinite,
  };
  vm.runInNewContext(
    readFunctionBlock(readProjectFile('public/app.js'), 'var miniCollapseState = {', 'function handleDesktopMiniPlayerCommand(')
      + '\nthis.collapse = collapseToMiniPlayer; this.state = miniCollapseState;'
      + '\nthis.arm = armMiniCollapsePrewarm; this.cancel = cancelMiniCollapsePrewarm;',
    context,
  );
  return { context, classes, timers, vars, calls };
}

test('最小化按钮走收缩过渡，且过渡样式只作用于桌面外壳', () => {
  const app = readProjectFile('public/app.js');
  const css = readProjectFile('public/app.css');
  const preload = readProjectFile('desktop/preload.js');
  const main = readProjectFile('desktop/main.js');

  assert.match(app, /if \(action === 'minimize'\) collapseToMiniPlayer\(\);/);
  assert.doesNotMatch(app, /if \(action === 'minimize'\) api\.minimize\(\);/);
  assert.match(app, /if \(btn\.getAttribute\('data-window-action'\) !== 'minimize'\) return;/);
  assert.match(app, /btn\.addEventListener\('pointerenter', armMiniCollapsePrewarm\);/);
  assert.match(app, /btn\.addEventListener\('pointerleave', cancelMiniCollapsePrewarm\);/);
  assert.match(css, /body\.mini-collapsing #desktop-window-shell\{transform-origin:var\(--mini-collapse-x,92%\) var\(--mini-collapse-y,96%\)/);
  assert.match(css, /body\.mini-collapsing\.mini-collapse-run #desktop-window-shell\{transform:translateZ\(0\) scale\(\.86\)/);
  assert.match(css, /body\.mini-collapse-reset #desktop-window-shell\{transition:none!important/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{body\.mini-collapsing #desktop-window-shell\{transition-duration:\.06s!important\}\}/);
  assert.match(preload, /prepareMiniPlayerTransition: \(\) => ipcRenderer\.invoke\('mineradio-mini-player-prepare-transition'\)/);
  assert.match(main, /ipcMain\.handle\('mineradio-mini-player-prepare-transition', trustedMainFrameHandler/);
});

test('迷你播放器两套外壳都在窗口显示且状态就绪后才淡入', () => {
  ['public/mini-player.html', 'public/mini-player-compact.html'].forEach((file) => {
    const html = readProjectFile(file);
    assert.match(html, /<body data-playing="false" data-enter="pending">/, file);
    assert.match(html, /body\[data-enter="pending"\] \.mini-shell \{ opacity: 0; \}/, file);
    assert.match(html, /@keyframes mini-shell-enter/, file);
    assert.match(html, /document\.addEventListener\('visibilitychange', runMiniEnterAnimation\);/, file);
    assert.match(html, /function runMiniEnterAnimation\(\)[\s\S]*?if \(document\.visibilityState === 'hidden'\) return;/, file);
    assert.match(html, /window\.miniPlayer\.onState\(receiveState\)/, file);
    // 兜底必须无条件清掉 pending，任何等待条件都不能让外壳长期不可见。
    assert.match(html, /if \(miniEnterDone\) return;\s*miniEnterDone = true;\s*document\.body\.removeAttribute\('data-enter'\);/, file);
  });
});

test('收缩过渡先预热迷你窗口，收缩到位后才交给系统最小化', async () => {
  const env = createCollapseContext();

  env.context.collapse();
  assert.equal(env.calls.prepare, 1);
  assert.equal(env.classes.has('mini-collapsing'), true);
  assert.equal(env.classes.has('mini-collapse-run'), true);
  assert.equal(env.calls.minimize, 0, '收缩动画期间不能提前最小化');

  await Promise.resolve();
  await Promise.resolve();
  assert.equal(env.vars.get('--mini-collapse-x'), '94.00%');
  assert.equal(env.vars.get('--mini-collapse-y'), '97.00%');

  const actionTimer = env.timers.get(env.context.state.actionTimer);
  assert.equal(actionTimer.delay, 150);
  actionTimer.callback();
  assert.equal(env.calls.minimize, 1);

  const resetTimer = env.timers.get(env.context.state.resetTimer);
  assert.equal(resetTimer.delay, 260);
  resetTimer.callback();
  assert.equal(env.context.state.active, false);
  assert.equal(env.classes.has('mini-collapsing'), false);
  assert.equal(env.classes.has('mini-collapse-run'), false);
  assert.equal(env.classes.has('mini-collapse-reset'), false, '复位类必须同帧摘掉，不留在下一次恢复上');
});

test('悬停最小化按钮就提前预热，短暂划过不建窗口', async () => {
  const env = createCollapseContext();

  env.context.arm();
  assert.equal(env.calls.prepare, 0, '悬停当帧不能立刻建窗口');
  const dwellId = env.context.state.prewarmTimer;
  assert.equal(env.timers.get(dwellId).delay, 90);

  env.context.cancel();
  assert.equal(env.context.state.prewarmTimer, 0);
  assert.equal(env.timers.has(dwellId), false, '划过按钮必须撤掉预热排期');
  assert.equal(env.calls.prepare, 0);

  env.context.arm();
  env.timers.get(env.context.state.prewarmTimer).callback();
  assert.equal(env.calls.prepare, 1);
  assert.equal(env.context.state.prewarmTimer, 0);

  // 悬停预热已经把动画原点算好，点击时不必等 IPC 回包。
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(env.vars.get('--mini-collapse-x'), '94.00%');
  assert.equal(env.vars.get('--mini-collapse-y'), '97.00%');

  env.context.arm();
  env.timers.get(env.context.state.prewarmTimer).callback();
  assert.equal(env.calls.prepare, 1, '节流窗口内重复悬停不重复请求预热');

  env.context.collapse();
  assert.equal(env.calls.prepare, 2, '点击必须补一次预热，悬停建的窗口可能已被 TTL 回收');
  assert.equal(env.context.state.prewarmTimer, 0, '进入收缩后不留悬停排期');
});

test('降低动效偏好把收缩过渡压到最短，且过渡期间不重复触发', () => {
  const env = createCollapseContext({ reduced: true });

  env.context.collapse();
  const firstToken = env.context.state.token;
  env.context.collapse();
  assert.equal(env.context.state.token, firstToken, '过渡进行中不能重入');
  assert.equal(env.calls.prepare, 1);
  assert.equal(env.timers.get(env.context.state.actionTimer).delay, 20);
  env.timers.get(env.context.state.actionTimer).callback();
  assert.equal(env.timers.get(env.context.state.resetTimer).delay, 60);
});

test('迷你播放器关闭或全屏时保持原生最小化，不做任何视觉改动', () => {
  const disabled = createCollapseContext({ miniPlayer: false });
  disabled.context.collapse();
  assert.equal(disabled.calls.minimize, 1);
  assert.equal(disabled.calls.prepare, 0);
  assert.equal(disabled.classes.has('mini-collapsing'), false);
  assert.equal(disabled.context.state.active, false);
  disabled.context.arm();
  assert.equal(disabled.context.state.prewarmTimer, 0, '功能关闭时悬停也不预热');

  const fullscreen = createCollapseContext({ fullscreen: true });
  fullscreen.context.collapse();
  assert.equal(fullscreen.calls.minimize, 1);
  assert.equal(fullscreen.classes.has('mini-collapsing'), false);
  fullscreen.context.arm();
  assert.equal(fullscreen.context.state.prewarmTimer, 0, '全屏时悬停也不预热');
});

test('预热 IPC 抛错不会卡住收缩过渡', () => {
  const env = createCollapseContext({ prepare: () => { throw new Error('IPC_DOWN'); } });
  env.context.collapse();
  assert.equal(env.classes.has('mini-collapse-run'), true);
  env.timers.get(env.context.state.actionTimer).callback();
  assert.equal(env.calls.minimize, 1);
});

test('收缩原点按迷你窗口中心归一化，异常主窗口尺寸退回默认原点', () => {
  const main = readProjectFile('desktop/main.js');
  const context = {
    miniPlayerMode: 'standard',
    miniPlayerUserBoundsByMode: { standard: { x: 1546, y: 906, width: 360, height: 84 }, compact: null },
    mainWindow: {
      isDestroyed: () => false,
      getBounds: () => ({ x: 0, y: 0, width: 1920, height: 1080 }),
    },
    normalizeMiniPlayerMode: (value) => (value === 'compact' ? 'compact' : 'standard'),
    clampMiniPlayerBounds: (bounds) => bounds,
    miniPlayerDefaultBounds: () => ({ x: 1546, y: 906, width: 360, height: 84 }),
  };
  vm.runInNewContext(
    extractFunction(main, 'clampNumber', 'desktopLyricsDefaultBounds')
      + extractFunction(main, 'miniPlayerTransitionOrigin', 'discardMiniPlayerPrewarm')
      + '\nthis.origin = miniPlayerTransitionOrigin;',
    context,
  );

  // vm 里造出来的对象跨 realm，原型不同，只能逐字段比较。
  const origin = context.origin();
  assert.equal(origin.x, 0.899);
  assert.equal(origin.y, 0.878);

  context.mainWindow.getBounds = () => ({ x: 0, y: 0, width: 0, height: 0 });
  assert.equal(context.origin(), null);

  context.mainWindow = null;
  assert.equal(context.origin(), null);
});

/**
 * 构造主进程预热的假环境。
 * @param {object=} overrides 需要覆盖的上下文字段。
 * @returns {{context: object, calls: object}} vm 上下文与观测集合。
 */
function createPrewarmContext(overrides) {
  const calls = { created: 0, timers: 0, cleared: 0 };
  const context = Object.assign({
    MINI_PLAYER_PREWARM_TTL: 2600,
    miniPlayerMode: 'standard',
    miniPlayerEnabled: true,
    miniPlayerRecoverySession: { paused: false },
    miniPlayerWindow: null,
    miniPlayerPrewarmWindow: null,
    miniPlayerPrewarmTimer: null,
    mainWindow: {
      isDestroyed: () => false,
      isMinimized: () => false,
      isVisible: () => true,
    },
    normalizeMiniPlayerMode: (value) => (value === 'compact' ? 'compact' : 'standard'),
    miniPlayerTransitionOrigin: () => ({ x: 0.9, y: 0.88 }),
    createMiniPlayerWindow: () => {
      calls.created += 1;
      const win = { isDestroyed: () => false, isVisible: () => false };
      context.miniPlayerWindow = win;
      return win;
    },
    stopMiniPlayerPrewarmTimer: () => { calls.cleared += 1; context.miniPlayerPrewarmTimer = null; },
    discardMiniPlayerPrewarm: () => {},
    setTimeout: () => { calls.timers += 1; return { unref: () => {} }; },
  }, overrides || {});
  vm.runInNewContext(
    extractFunction(readProjectFile('desktop/main.js'), 'prepareMiniPlayerTransition', 'requestMiniPlayerStateSync')
      + '\nthis.prepare = prepareMiniPlayerTransition;',
    context,
  );
  return { context, calls };
}

test('预热在主窗口仍可见时建好迷你窗口，并挂上丢弃计时器', () => {
  const env = createPrewarmContext();
  const result = env.context.prepare();

  assert.equal(result.ok, true);
  assert.equal(result.prepared, true);
  assert.equal(result.enabled, true);
  assert.equal(result.mode, 'standard');
  assert.deepEqual(result.origin, { x: 0.9, y: 0.88 });
  assert.equal(env.calls.created, 1);
  assert.equal(env.calls.timers, 1, '必须挂上预热丢弃计时器');
  assert.equal(env.context.miniPlayerPrewarmWindow, env.context.miniPlayerWindow);
});

test('功能关闭、锁屏暂停或已进入迷你模式时不预热窗口但仍回传原点', () => {
  const disabled = createPrewarmContext({ miniPlayerEnabled: false });
  const disabledResult = disabled.context.prepare();
  assert.equal(disabledResult.prepared, false);
  assert.equal(disabledResult.enabled, false);
  assert.deepEqual(disabledResult.origin, { x: 0.9, y: 0.88 });
  assert.equal(disabled.calls.created, 0);
  assert.equal(disabled.calls.timers, 0);

  const paused = createPrewarmContext({ miniPlayerRecoverySession: { paused: true } });
  assert.equal(paused.context.prepare().prepared, false);
  assert.equal(paused.calls.created, 0);

  const minimized = createPrewarmContext({
    mainWindow: { isDestroyed: () => false, isMinimized: () => true, isVisible: () => true },
  });
  assert.equal(minimized.context.prepare().prepared, false);
  assert.equal(minimized.calls.created, 0, '已经在迷你模式时窗口归正常生命周期，不能再挂预热');

  const gone = createPrewarmContext({ mainWindow: null });
  const goneResult = gone.context.prepare();
  assert.equal(goneResult.ok, false);
  assert.equal(goneResult.error, 'MAIN_WINDOW_UNAVAILABLE');
  assert.equal(goneResult.origin, null);
});

test('已显示的迷你窗口不会被重新标记为预热窗口', () => {
  const visible = { isDestroyed: () => false, isVisible: () => true };
  const env = createPrewarmContext({ miniPlayerWindow: visible });
  const result = env.context.prepare();

  assert.equal(result.prepared, false);
  assert.equal(env.calls.created, 0);
  assert.equal(env.context.miniPlayerPrewarmWindow, null);
  assert.equal(env.calls.timers, 0);
});

/**
 * 构造预热丢弃的假环境。
 * @param {object=} overrides 需要覆盖的上下文字段。
 * @returns {{context: object, calls: object}} vm 上下文与观测集合。
 */
function createDiscardContext(overrides) {
  const calls = { closed: 0 };
  const context = Object.assign({
    miniPlayerPrewarmWindow: null,
    miniPlayerWindow: null,
    shouldShowMiniPlayer: () => false,
    stopMiniPlayerPrewarmTimer: () => {},
    closeMiniPlayerWindow: () => { calls.closed += 1; },
  }, overrides || {});
  vm.runInNewContext(
    extractFunction(readProjectFile('desktop/main.js'), 'discardMiniPlayerPrewarm', 'prepareMiniPlayerTransition')
      + '\nthis.discard = discardMiniPlayerPrewarm;',
    context,
  );
  return { context, calls };
}

test('主窗口最终没有最小化时丢弃预热窗口，不为不可见窗口常驻内存', () => {
  const win = { isDestroyed: () => false, isVisible: () => false };
  const env = createDiscardContext({ miniPlayerPrewarmWindow: win, miniPlayerWindow: win });

  env.context.discard();
  assert.equal(env.calls.closed, 1);
  assert.equal(env.context.miniPlayerPrewarmWindow, null);

  env.context.discard();
  assert.equal(env.calls.closed, 1, '重复丢弃必须幂等');
});

test('已进入迷你模式或窗口已显示时丢弃不误关正在服务的窗口', () => {
  const win = { isDestroyed: () => false, isVisible: () => false };
  const serving = createDiscardContext({
    miniPlayerPrewarmWindow: win,
    miniPlayerWindow: win,
    shouldShowMiniPlayer: () => true,
  });
  serving.context.discard();
  assert.equal(serving.calls.closed, 0);

  const shown = createDiscardContext({
    miniPlayerPrewarmWindow: { isDestroyed: () => false, isVisible: () => true },
  });
  shown.context.miniPlayerWindow = shown.context.miniPlayerPrewarmWindow;
  shown.context.discard();
  assert.equal(shown.calls.closed, 0);

  const replaced = createDiscardContext({
    miniPlayerPrewarmWindow: win,
    miniPlayerWindow: { isDestroyed: () => false, isVisible: () => false },
  });
  replaced.context.discard();
  assert.equal(replaced.calls.closed, 0, '旧预热窗口不得关闭替代窗口');
});

test('显示迷你窗口和关闭迷你窗口都会解除预热标记', () => {
  const main = readProjectFile('desktop/main.js');

  assert.match(
    main,
    /function showMiniPlayerWindow\(\)[\s\S]*?stopMiniPlayerPrewarmTimer\(\);\s*miniPlayerPrewarmWindow = null;/,
  );
  assert.match(
    main,
    /function closeMiniPlayerWindow\(\)[\s\S]*?stopMiniPlayerPrewarmTimer\(\);\s*miniPlayerPrewarmWindow = null;/,
  );
});
