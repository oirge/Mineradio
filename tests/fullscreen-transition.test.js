'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

function readFunctionBlock(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `未找到源码块: ${startMarker}`);
  return source.slice(start, end);
}

test('全屏切换使用遮罩和视口稳定回亮信号', () => {
  const app = readProjectFile('public/app.js');
  const css = readProjectFile('public/app.css');
  const html = readProjectFile('public/index.html');
  const toggle = readFunctionBlock(app, 'function toggleFullscreen()', 'var desktopShellSettings');

  assert.match(html, /id="fullscreen-transition-layer"/);
  assert.match(css, /body\.fullscreen-transition-covered #fullscreen-transition-layer\{opacity:1\}/);
  assert.match(css, /fullscreen-transition-enter[^}]*transition:none[^}]*will-change:auto/);
  assert.doesNotMatch(css, /fullscreen-transition-enter[^}]*scale\(/, '进入全屏不再缩放承载 WebGL 的窗口壳');
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)/);
  assert.match(toggle, /beginFullscreenTransition\(!isFullscreenUiActive\(\)/);
  assert.match(app, /scheduleFullscreenTransitionReveal\(isFullScreen, 'state'\)/);
  assert.match(app, /scheduleFullscreenTransitionReveal\(isFullscreen, 'resize'\)/);
});

test('全屏过渡先遮住原生尺寸跳变，再平滑回亮并清理状态', () => {
  const app = readProjectFile('public/app.js');
  const transitionSource = readFunctionBlock(
    app,
    'var fullscreenTransitionState = {',
    'function isFullscreenUiActive()',
  );
  const classes = new Set();
  const timers = new Map();
  let nextTimer = 1;
  let actionCalls = 0;
  const context = {
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
    innerWidth: 1280,
    innerHeight: 720,
    requestAnimationFrame: (callback) => callback(),
    setTimeout: (callback, delay) => {
      const id = nextTimer++;
      timers.set(id, { callback, delay });
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
    showToast: () => {},
    refreshMainRendererViewport: () => {},
    Math,
  };

  vm.runInNewContext(
    `${transitionSource}\nthis.begin = beginFullscreenTransition; this.sync = scheduleFullscreenTransitionReveal; this.state = fullscreenTransitionState;`,
    context,
  );

  assert.equal(context.begin(true, () => { actionCalls += 1; }), true);
  assert.equal(classes.has('fullscreen-transitioning'), true);
  assert.equal(classes.has('fullscreen-transition-enter'), true);
  assert.equal(classes.has('fullscreen-transition-covered'), true);

  const actionTimer = context.state.actionTimer;
  assert.ok(timers.get(actionTimer).delay <= 60, '进入全屏的动作前摇不能超过一帧太多');
  timers.get(actionTimer).callback();
  timers.delete(actionTimer);
  assert.equal(actionCalls, 1);

  context.innerWidth = 1920;
  context.innerHeight = 1080;
  context.sync(true, 'resize');
  const revealTimer = context.state.revealTimer;
  timers.get(revealTimer).callback();
  timers.delete(revealTimer);
  assert.equal(classes.has('fullscreen-transition-covered'), false);
  assert.equal(classes.has('fullscreen-transition-revealing'), true);

  const cleanupTimer = context.state.cleanupTimer;
  timers.get(cleanupTimer).callback();
  assert.equal(context.state.active, false);
  assert.equal(classes.has('fullscreen-transitioning'), false);
  assert.equal(classes.has('fullscreen-transition-enter'), false);
});

test('退出全屏的后续边界还原会重排回亮，避免二次缩放露出', () => {
  const app = readProjectFile('public/app.js');
  const transitionSource = readFunctionBlock(
    app,
    'var fullscreenTransitionState = {',
    'function isFullscreenUiActive()',
  );
  const classes = new Set();
  const timers = new Map();
  const clock = { now: 0 };
  let nextTimer = 1;
  const context = {
    window: { matchMedia: () => ({ matches: false }) },
    Date: { now: () => clock.now },
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
    innerWidth: 1920,
    innerHeight: 1080,
    requestAnimationFrame: (callback) => callback(),
    setTimeout: (callback, delay) => {
      const id = nextTimer++;
      timers.set(id, { callback, delay });
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
    showToast: () => {},
    refreshMainRendererViewport: () => {},
    Math,
  };

  vm.runInNewContext(
    `${transitionSource}\nthis.begin = beginFullscreenTransition; this.sync = scheduleFullscreenTransitionReveal; this.state = fullscreenTransitionState;`,
    context,
  );
  context.begin(false, () => {});
  context.fire = (id) => {
    const timer = timers.get(id);
    timers.delete(id);
    clock.now += timer.delay;
    timer.callback();
  };

  context.fire(context.state.actionTimer);
  context.sync(false, 'state');
  const firstReveal = context.state.revealTimer;
  assert.ok(firstReveal);

  // 主进程 leave-full-screen 后 50ms 才 setBounds；这个迟到的 resize 必须重排回亮。
  clock.now += 50;
  context.innerWidth = 1280;
  context.innerHeight = 720;
  context.sync(false, 'resize');
  assert.notEqual(context.state.revealTimer, firstReveal);
  assert.equal(timers.has(firstReveal), false);
});

test('全屏遮罩期间的布局与玻璃贴图工作会延后到回亮前一次执行', () => {
  const app = readProjectFile('public/app.js');
  const transitionSource = readFunctionBlock(
    app,
    'var fullscreenTransitionState = {',
    'function isFullscreenUiActive()',
  );
  const classes = new Set();
  const timers = new Map();
  const calls = [];
  let nextTimer = 1;
  const context = {
    window: { matchMedia: () => ({ matches: false }) },
    Date: { now: () => 0 },
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
    innerWidth: 1280,
    innerHeight: 720,
    layoutFullscreenDiyZone: () => calls.push('diy'),
    repositionFxFloatingPanels: () => calls.push('panels'),
    resizeHandCanvas: () => calls.push('hand'),
    updateControlGlassDisplacementMap: () => calls.push('control-glass'),
    updateSearchBoxGlassDisplacementMap: () => calls.push('search-glass'),
    updateSearchPillGlassDisplacementMap: () => calls.push('pill-glass'),
    refreshMainRendererViewport: () => calls.push('viewport'),
    scheduleMainRendererViewportRefresh: (reason, immediate) => {
      assert.equal(reason, 'fullscreen-transition-reveal');
      assert.equal(immediate, true);
      calls.push('viewport');
    },
    requestAnimationFrame: (callback) => callback(),
    setTimeout: (callback) => {
      const id = nextTimer++;
      timers.set(id, callback);
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
    showToast: () => {},
    Math,
  };

  vm.runInNewContext(
    `${transitionSource}\nthis.begin = beginFullscreenTransition; this.state = fullscreenTransitionState; this.reveal = revealFullscreenTransition;`,
    context,
  );
  context.begin(true, () => {});
  context.state.deferredWork = {
    diyZone: true,
    floatingPanels: true,
    handCanvas: true,
    glassMap: true,
  };
  context.reveal(context.state.token);

  assert.deepEqual(calls, [
    'diy',
    'panels',
    'hand',
    'control-glass',
    'search-glass',
    'pill-glass',
    'viewport',
  ]);
  assert.equal(context.state.deferredWork, null);
  assert.equal(context.state.flushingWork, false);
});

test('全屏抑制逻辑在启动早期状态未初始化时必须安静放行', () => {
  const app = readProjectFile('public/app.js');
  const transitionSource = readFunctionBlock(
    app,
    'var fullscreenTransitionState = {',
    'function isFullscreenUiActive()',
  );
  const context = {
    window: {},
    document: { body: { classList: new Set() } },
    requestAnimationFrame: (callback) => callback(),
    Math,
  };

  vm.runInNewContext(
    `${transitionSource}
    this.covered = isFullscreenTransitionCovered;
    this.defer = deferFullscreenTransitionWork;
    this.flush = flushFullscreenTransitionDeferredWork;
    fullscreenTransitionState = undefined;`,
    context,
  );

  assert.equal(context.covered(), false);
  assert.doesNotThrow(() => context.defer('diyZone'));
  assert.doesNotThrow(() => context.flush());
});
