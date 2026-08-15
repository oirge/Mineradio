'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');

const root = path.join(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function extractCreateWindow(source) {
  const start = source.indexOf('async function createWindow()');
  const end = source.indexOf("\nif (process.platform === 'win32')", start + 1);
  assert.ok(start >= 0 && end > start, '未找到 createWindow 生命周期');
  return source.slice(start, end);
}

function extractAttachWindow(source) {
  const start = source.indexOf('function attachWindow(win) {');
  const end = source.indexOf('\n\n  async function installProtocol', start + 1);
  assert.ok(start >= 0 && end > start, '未找到 attachWindow 生命周期');
  return source.slice(start, end);
}

class FakeWindow extends EventEmitter {
  constructor() {
    super();
    this.destroyed = false;
  }

  isDestroyed() {
    return this.destroyed;
  }
}

test('主窗口创建路径集中挂载 Wallpaper Engine hook', () => {
  const source = read('desktop/main.js');
  const createWindow = extractCreateWindow(source);
  const attachCall = 'wallpaperEngineBridge.attachWindow(mainWindow);';

  assert.equal((createWindow.match(/wallpaperEngineBridge\.attachWindow\(mainWindow\);/g) || []).length, 1);
  assert.ok(createWindow.indexOf(attachCall) < createWindow.indexOf('await mainWindow.loadURL('));
  for (const eventName of [
    'minimize', 'hide', 'restore', 'show', 'move', 'resize',
    'enter-full-screen', 'leave-full-screen', 'enter-html-full-screen',
    'leave-html-full-screen', 'close', 'closed',
  ]) {
    assert.match(createWindow, new RegExp(`mainWindow\\.on\\('${eventName}'`), '主窗口重建必须重新注册 ' + eventName + ' 事件');
  }

  const readyStart = source.indexOf("app.whenReady().then(async () => {");
  const activateStart = source.indexOf("\n  app.on('activate'", readyStart + 1);
  assert.ok(readyStart >= 0 && activateStart > readyStart, '未找到主窗口初始化块');
  assert.doesNotMatch(source.slice(readyStart, activateStart), /wallpaperEngineBridge\.attachWindow\(mainWindow\);/);
});

test('旧主窗口关闭后新窗口重新挂载全部 Wallpaper Engine 窗口 hook', () => {
  const calls = {
    suspend: [],
    resume: [],
    bounds: [],
    stopped: [],
    timers: [],
  };
  const context = {
    windowHooksInstalled: false,
    attachedWindow: null,
    suspendForHiddenHost(win, reason) { calls.suspend.push([win, reason]); },
    resumeForVisibleHost(win, reason) { calls.resume.push([win, reason]); },
    scheduleHostBoundsRestart(win, reason) { calls.bounds.push([win, reason]); },
    stopRuntimeForRenderer(reason) { calls.stopped.push(reason); },
    setTimeout(callback, delay) {
      calls.timers.push(delay);
      callback();
      return { unref() {} };
    },
  };
  vm.runInNewContext(
    extractAttachWindow(read('desktop/wallpaper-engine-bridge.js'))
      + '\nthis.attachWindow = attachWindow;',
    context,
  );

  const first = new FakeWindow();
  const second = new FakeWindow();
  context.attachWindow(first);

  first.emit('minimize');
  first.emit('hide');
  first.emit('restore');
  first.emit('show');
  first.emit('move');
  first.emit('resize');
  first.emit('enter-full-screen');
  first.emit('leave-full-screen');
  first.emit('enter-html-full-screen');
  first.emit('leave-html-full-screen');
  first.emit('closed');

  assert.deepEqual(calls.suspend.map(([, reason]) => reason), ['minimize', 'hide']);
  assert.deepEqual(calls.resume.map(([, reason]) => reason), ['restore', 'show']);
  assert.deepEqual(calls.bounds.map(([, reason]) => reason), [
    'move', 'resize', 'enter-full-screen', 'leave-full-screen',
    'enter-html-full-screen', 'leave-html-full-screen',
  ]);
  assert.deepEqual(calls.stopped, ['window-closed']);

  context.attachWindow(second);
  second.emit('minimize');
  second.emit('hide');
  second.emit('restore');
  second.emit('show');
  second.emit('move');
  second.emit('resize');
  second.emit('enter-full-screen');
  second.emit('leave-full-screen');
  second.emit('enter-html-full-screen');
  second.emit('leave-html-full-screen');
  second.emit('closed');

  assert.deepEqual(calls.suspend.slice(2).map(([, reason]) => reason), ['minimize', 'hide']);
  assert.deepEqual(calls.resume.slice(2).map(([, reason]) => reason), ['restore', 'show']);
  assert.deepEqual(calls.bounds.slice(6).map(([, reason]) => reason), [
    'move', 'resize', 'enter-full-screen', 'leave-full-screen',
    'enter-html-full-screen', 'leave-html-full-screen',
  ]);
  assert.deepEqual(calls.stopped, ['window-closed', 'window-closed']);
  assert.deepEqual(calls.timers, [40, 40, 40, 40]);
});
