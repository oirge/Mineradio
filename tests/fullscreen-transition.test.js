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

test('全屏切换使用遮罩、缩放和视口稳定回亮信号', () => {
  const app = readProjectFile('public/app.js');
  const css = readProjectFile('public/app.css');
  const html = readProjectFile('public/index.html');
  const toggle = readFunctionBlock(app, 'function toggleFullscreen()', 'var desktopShellSettings');

  assert.match(html, /id="fullscreen-transition-layer"/);
  assert.match(css, /body\.fullscreen-transition-covered #fullscreen-transition-layer\{opacity:1\}/);
  assert.match(css, /fullscreen-transition-enter[^}]*scale\(\.988\)/);
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
    `${transitionSource}\nthis.begin = beginFullscreenTransition; this.sync = scheduleFullscreenTransitionReveal; this.state = fullscreenTransitionState;`,
    context,
  );

  assert.equal(context.begin(true, () => { actionCalls += 1; }), true);
  assert.equal(classes.has('fullscreen-transitioning'), true);
  assert.equal(classes.has('fullscreen-transition-enter'), true);
  assert.equal(classes.has('fullscreen-transition-covered'), true);

  const actionTimer = context.state.actionTimer;
  timers.get(actionTimer)();
  timers.delete(actionTimer);
  assert.equal(actionCalls, 1);

  context.innerWidth = 1920;
  context.innerHeight = 1080;
  context.sync(true, 'resize');
  const revealTimer = context.state.revealTimer;
  timers.get(revealTimer)();
  timers.delete(revealTimer);
  assert.equal(classes.has('fullscreen-transition-covered'), false);
  assert.equal(classes.has('fullscreen-transition-revealing'), true);

  const cleanupTimer = context.state.cleanupTimer;
  timers.get(cleanupTimer)();
  assert.equal(context.state.active, false);
  assert.equal(classes.has('fullscreen-transitioning'), false);
  assert.equal(classes.has('fullscreen-transition-enter'), false);
});
