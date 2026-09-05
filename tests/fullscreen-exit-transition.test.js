'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

function readSourceBlock(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `未找到源码块: ${startMarker}`);
  return source.slice(start, end);
}

/**
 * 用可控时钟跑真实的全屏过渡源码，模拟退出全屏时连发的 resize / 窗口状态信号。
 * @returns {{context: object, classes: Set<string>, timers: Map<number, object>, now: Function, at: Function}}
 */
function createTransitionHarness() {
  const classes = new Set();
  const timers = new Map();
  const clock = { now: 0 };
  let nextTimer = 1;
  const context = {
    Date: { now: () => clock.now },
    window: { matchMedia: () => ({ matches: false }) },
    document: {
      getElementById: () => ({ offsetWidth: 1280 }),
      body: {
        offsetWidth: 1280,
        classList: {
          add: (...names) => names.forEach((name) => classes.add(name)),
          remove: (...names) => names.forEach((name) => classes.delete(name)),
        },
      },
    },
    innerWidth: 3840,
    innerHeight: 2160,
    requestAnimationFrame: (callback) => callback(),
    setTimeout: (callback, delay) => {
      const id = nextTimer++;
      timers.set(id, { callback, due: clock.now + delay, delay });
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
    showToast: () => {},
    Math,
  };
  vm.runInNewContext(
    `${readSourceBlock(readProjectFile('public/app.js'), 'var fullscreenTransitionState = {', 'function isFullscreenUiActive()')}
    this.begin = beginFullscreenTransition;
    this.sync = scheduleFullscreenTransitionReveal;
    this.state = fullscreenTransitionState;
    this.ceiling = FULLSCREEN_TRANSITION_MAX_COVER_MS;`,
    context,
  );
  return {
    context,
    classes,
    timers,
    at: (ms) => { clock.now = ms; },
    fire: (id) => {
      const timer = timers.get(id);
      assert.ok(timer, `计时器 ${id} 不存在`);
      clock.now = timer.due;
      timers.delete(id);
      timer.callback();
    },
  };
}

test('退出全屏时连发的 resize/state 只能把回亮提前，不能把遮罩一路顺延', () => {
  const h = createTransitionHarness();

  h.at(0);
  assert.equal(h.context.begin(false, () => {}), true);
  assert.equal(h.classes.has('fullscreen-transition-exit'), true);
  assert.equal(h.classes.has('fullscreen-transition-covered'), true);

  // 遮罩铺好后才真正调用原生退出，动作前摇不超过 2 帧多一点。
  const actionTimer = h.context.state.actionTimer;
  assert.ok(h.timers.get(actionTimer).delay <= 120);
  h.fire(actionTimer);

  // leave-full-screen 的状态推送先到，此时窗口尺寸还没跳变。
  h.at(150);
  h.context.sync(false, 'state');
  const afterState = h.context.state.revealDue;
  assert.equal(afterState, 260);

  // 原生还原带来第一次 resize：尺寸已经跳完，回亮被提前。
  h.at(170);
  h.context.innerWidth = 1600;
  h.context.innerHeight = 900;
  h.context.sync(false, 'resize');
  assert.equal(h.context.state.revealDue, 220);
  const armedReveal = h.context.state.revealTimer;

  // 之后 setBounds 与重复状态推送仍会连发，但不允许再把遮罩往后推。
  h.at(210);
  h.context.sync(false, 'resize');
  h.at(230);
  h.context.sync(false, 'state');
  h.at(260);
  h.context.sync(false, 'resize');
  assert.equal(h.context.state.revealDue, 220);
  assert.equal(h.context.state.revealTimer, armedReveal, '回亮计时器不应被后来的信号重排');

  h.fire(armedReveal);
  assert.equal(h.classes.has('fullscreen-transition-covered'), false);
  assert.equal(h.classes.has('fullscreen-transition-revealing'), true);
});

test('resize 风暴抢不掉硬上限，遮罩时长有确定天花板', () => {
  const h = createTransitionHarness();

  h.at(0);
  h.context.begin(false, () => {});
  const actionTimer = h.context.state.actionTimer;
  h.fire(actionTimer);

  const deadlineTimer = h.context.state.deadlineTimer;
  assert.ok(deadlineTimer, '缺少独立的兜底计时器');
  assert.equal(h.timers.get(deadlineTimer).delay, h.context.ceiling);
  assert.ok(h.context.ceiling <= 360, '遮罩上限不应超过 360ms');
  const deadlineDue = h.timers.get(deadlineTimer).due;

  // 尺寸一直在跳，回亮信号反复到来，兜底计时器必须活着。
  for (let t = 130; t < deadlineDue; t += 20) {
    h.at(t);
    h.context.innerWidth = 1600 + (t % 3);
    h.context.sync(false, 'resize');
    assert.equal(h.context.state.deadlineTimer, deadlineTimer, `t=${t} 时兜底计时器被抢占`);
    assert.ok(h.timers.has(deadlineTimer), `t=${t} 时兜底计时器被清掉`);
  }
});

test('完全收不到任何回亮信号时，兜底计时器仍会揭开遮罩并收尾', () => {
  const h = createTransitionHarness();

  h.at(0);
  h.context.begin(false, () => {});
  h.fire(h.context.state.actionTimer);
  assert.equal(h.context.state.revealTimer, 0, '动作完成后不应再占用回亮计时器槽');

  h.fire(h.context.state.deadlineTimer);
  assert.equal(h.classes.has('fullscreen-transition-covered'), false);
  assert.equal(h.classes.has('fullscreen-transition-revealing'), true);

  h.fire(h.context.state.cleanupTimer);
  assert.equal(h.context.state.active, false);
  assert.equal(h.context.state.revealDue, 0);
  assert.equal(h.classes.has('fullscreen-transitioning'), false);
  assert.equal(h.classes.has('fullscreen-transition-exit'), false);
});

test('过渡不再对承载 WebGL 画布的窗口壳加 filter', () => {
  const css = readProjectFile('public/app.css');
  const shellRules = css.match(/^body\.fullscreen-transition[^\n]*#desktop-window-shell\{[^}]*\}$/gm) || [];
  assert.ok(shellRules.length >= 3, '缺少全屏过渡的窗口壳规则');
  shellRules.forEach((rule) => {
    assert.doesNotMatch(rule, /filter:/, '窗口壳过渡不能带 filter：会让整窗每帧重新合成');
    assert.doesNotMatch(rule, /will-change:[^;}]*filter/);
  });
  assert.match(css, /body\.fullscreen-transitioning #desktop-window-shell\{[^}]*will-change:transform\}/);
  assert.match(css, /#fullscreen-transition-layer\{[^}]*background:rgba\(0,0,0,\.62\)/);
  assert.match(
    css,
    /body\.fullscreen-transitioning\.fullscreen-transition-revealing #fullscreen-transition-layer\{transition:opacity \.2s/,
  );
});

test('全屏切换的补偿刷新会去重，避免反复重建渲染缓冲', () => {
  const app = readProjectFile('public/app.js');
  const block = readSourceBlock(app, 'function scheduleMainRendererViewportRefresh(', 'window.addEventListener(\'resize\'');
  assert.match(block, /clearTimeout\(mainRendererViewportRefreshTimers\.pop\(\)\)/);
  assert.match(block, /mainRendererViewportRefreshTimers\.push\(setTimeout\(/);
});

test('退出全屏只做一次窗口边界还原，并立刻把状态推给渲染层', () => {
  const main = readProjectFile('desktop/main.js');
  // 与上游 XxHuberrr/Mineradio 对齐：边界还原只由权威的 leave-full-screen 事件安排一次，
  // exitFullscreenToWindow 里不再挂 once('leave-full-screen') 和 500ms 兜底。
  const exitFullscreen = readSourceBlock(main, 'function exitFullscreenToWindow(', 'function toggleFullscreen(');
  assert.doesNotMatch(exitFullscreen, /once\('leave-full-screen'/);
  assert.doesNotMatch(exitFullscreen, /setTimeout/);
  assert.match(exitFullscreen, /setMainWindowFullscreenResizeGuard\(win, false\);\s*\n\s*win\.setFullScreen\(false\);/);

  const applyBounds = readSourceBlock(main, 'function applyWindowedBounds(', '/**');
  assert.match(applyBounds, /setMainWindowFullscreenResizeGuard\(win, false\);/);
  assert.match(applyBounds, /win\.setBounds\(getWindowedBounds\(win\), false\);/);
  assert.doesNotMatch(applyBounds, /const settled =/, '单航班还原之后不再需要 settled 短路');

  // 本仓库比上游多一层全屏遮罩，所以状态要立刻推给渲染层，不能等 50ms 后的边界还原顺带通知。
  const leaveFullscreen = readSourceBlock(main, "mainWindow.on('leave-full-screen'", '});');
  assert.match(leaveFullscreen, /sendWindowState\(mainWindow\);/);
  const leaveHtmlFullscreen = readSourceBlock(main, "mainWindow.on('leave-html-full-screen'", '});');
  assert.match(leaveHtmlFullscreen, /sendWindowState\(mainWindow\);/);
});

test('边界还原按上游无条件执行，并同步窗口状态', () => {
  const main = readProjectFile('desktop/main.js');
  const target = { x: 160, y: 90, width: 1600, height: 900 };
  const calls = { setBounds: 0, sendWindowState: 0, unmaximize: 0, guard: [] };
  const scope = {
    screen: { getDisplayMatching: () => ({ workArea: target }), getPrimaryDisplay: () => ({ workArea: target }) },
    windowedMinimumSize: () => ({ width: 960, height: 540 }),
    getWindowedBounds: () => ({ ...target }),
    setMainWindowFullscreenResizeGuard: (_win, fullscreen) => calls.guard.push(fullscreen),
    sendWindowState: () => { calls.sendWindowState += 1; },
  };
  vm.runInNewContext(
    `${readSourceBlock(main, 'function applyWindowedBounds(', '/**')}
    this.apply = applyWindowedBounds;`,
    scope,
  );

  const bounds = { ...target };
  const win = {
    isDestroyed: () => false,
    isMaximized: () => false,
    unmaximize: () => { calls.unmaximize += 1; },
    getBounds: () => ({ ...bounds }),
    setMinimumSize: () => {},
    setBounds: (next) => { calls.setBounds += 1; Object.assign(bounds, next); },
  };

  scope.apply(win);
  assert.equal(calls.setBounds, 1, '上游无条件还原边界');
  assert.equal(calls.sendWindowState, 1);
  assert.deepEqual(calls.guard, [false], '还原窗口态时必须放开尺寸锁');

  bounds.width = 1280;
  scope.apply(win);
  assert.equal(calls.setBounds, 2);
  assert.equal(calls.sendWindowState, 2);
});
