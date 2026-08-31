'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');

/**
 * 读取迷你播放器页面源码。
 * @param {string} fileName 页面文件名。
 * @returns {string} 页面完整文本。
 */
function readMiniPage(fileName) {
  return fs.readFileSync(path.join(root, 'public', fileName), 'utf8');
}

/**
 * 构造标准迷你播放器的轻量 DOM/IPC 环境。
 * @param {{pointerResults?: Array<unknown>}=} options IPC 结果队列；缺省均视为成功。
 * @returns {{nodes: Record<string, object>, document: object, applyState: Function, sync: Function, flushMicrotasks: Function, pointerCalls: boolean[], coverAssignments: string[]}} 可驱动页面脚本的测试环境。
 */
function createStandardHarness(options = {}) {
  const html = readMiniPage('mini-player.html');
  const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
  const listeners = new Map();
  const timers = new Map();
  const pointerResults = Array.isArray(options.pointerResults) ? options.pointerResults.slice() : [];
  const pointerCalls = [];
  const coverAssignments = [];
  let nextTimerId = 1;
  let stateHandler = null;

  /**
   * 创建具备页面脚本所需行为的假节点。
   * @param {string} id 节点标识。
   * @returns {object} 假 DOM 节点。
   */
  function createNode(id) {
    const attributes = new Map();
    const classNames = new Set();
    let srcValue = '';
    const node = {
      id,
      style: {
        values: {},
        setProperty(name, value) { this.values[name] = String(value); },
        removeProperty(name) { delete this.values[name]; },
      },
      classList: {
        add(name) { classNames.add(name); },
        remove(name) { classNames.delete(name); },
        toggle(name, enabled) {
          if (enabled) classNames.add(name);
          else classNames.delete(name);
        },
        contains(name) { return classNames.has(name); },
      },
      textContent: '',
      title: '',
      disabled: false,
      hover: false,
      focusWithin: false,
      rect: { left: 300, top: 15, right: 354, bottom: 69 },
      blur() { node.focusWithin = false; },
      getBoundingClientRect() { return node.rect; },
      setPointerCapture() {},
      releasePointerCapture() {},
      addEventListener(type, handler) {
        const handlers = listeners.get(node) || {};
        (handlers[type] || (handlers[type] = [])).push(handler);
        listeners.set(node, handlers);
      },
      dispatch(type, event = {}) {
        const handlers = listeners.get(node) || {};
        const payload = Object.assign({ target: node }, event);
        for (const handler of handlers[type] || []) handler(payload);
      },
      setAttribute(name, value) {
        attributes.set(name, String(value));
        if (name === 'src') srcValue = String(value);
      },
      getAttribute(name) { return attributes.has(name) ? attributes.get(name) : null; },
      removeAttribute(name) {
        attributes.delete(name);
        if (name === 'src') srcValue = '';
      },
      matches(selector) {
        if (selector === ':hover') return node.hover;
        if (selector === ':focus-within') return node.focusWithin;
        return false;
      },
      closest(selector) {
        return selector === 'button' && node.id !== 'mini-shell' ? node : null;
      },
    };
    Object.defineProperty(node, 'src', {
      configurable: true,
      get() { return srcValue; },
      set(value) {
        srcValue = String(value);
        attributes.set('src', srcValue);
        coverAssignments.push(srcValue);
      },
    });
    return node;
  }

  const nodes = {
    'mini-shell': createNode('mini-shell'),
    'cover-wrap': createNode('cover-wrap'),
    cover: createNode('cover'),
    title: createNode('title'),
    artist: createNode('artist'),
    previous: createNode('previous'),
    play: createNode('play'),
    next: createNode('next'),
    'desktop-lyrics': createNode('desktop-lyrics'),
    restore: createNode('restore'),
  };
  nodes['mini-shell'].setAttribute('data-collapsed', 'true');
  const documentNode = createNode('document');
  const documentElement = createNode('documentElement');

  /**
   * 返回本次穿透请求的预设结果，未提供时按成功处理。
   * @param {boolean} value 请求的穿透值。
   * @returns {Promise<unknown>} 主进程模拟结果。
   */
  function setPointerPassthrough(value) {
    pointerCalls.push(value === true);
    const result = pointerResults.length ? pointerResults.shift() : { ok: true };
    if (result instanceof Error) return Promise.reject(result);
    return Promise.resolve(result);
  }

  const context = {
    Math,
    Number,
    String,
    Object,
    Promise,
    isFinite,
    document: {
      body: createNode('body'),
      documentElement,
      visibilityState: 'visible',
      getElementById(id) { return nodes[id]; },
      addEventListener: documentNode.addEventListener,
    },
    window: {
      requestAnimationFrame(callback) { callback(); },
      matchMedia() { return { matches: false }; },
      miniPlayer: {
        command() { return Promise.resolve({ ok: true }); },
        moveBy() { return Promise.resolve({ ok: true }); },
        setPointerPassthrough,
        onState(callback) { stateHandler = callback; },
      },
    },
    setTimeout(callback) {
      const id = nextTimerId++;
      timers.set(id, callback);
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
  };

  vm.runInNewContext(script, context);
  vm.runInNewContext(
    'this.__syncPointerPassthrough = syncPointerPassthrough;',
    context,
  );

  return {
    nodes,
    document: documentNode,
    applyState(patch) { stateHandler(patch); },
    sync() { context.__syncPointerPassthrough(); },
    pointerCalls,
    coverAssignments,
    flushTimers() {
      const pending = [...timers.values()];
      timers.clear();
      for (const callback of pending) callback();
    },
    async flushMicrotasks() {
      for (let index = 0; index < 8; index += 1) await Promise.resolve();
    },
  };
}

test('穿透 IPC 返回 ok:false 后保留旧缓存并允许下一次同步重试', async () => {
  const harness = createStandardHarness({ pointerResults: [{ ok: true }, { ok: false }, { ok: true }] });
  await harness.flushMicrotasks();

  harness.document.dispatch('mousemove', { clientX: 320, clientY: 40 });
  await harness.flushMicrotasks();
  assert.deepEqual(harness.pointerCalls, [true, false]);

  harness.sync();
  await harness.flushMicrotasks();
  assert.deepEqual(harness.pointerCalls, [true, false, false]);

  harness.sync();
  await harness.flushMicrotasks();
  assert.deepEqual(harness.pointerCalls, [true, false, false]);
});

test('穿透 IPC reject 后保留旧缓存并允许下一次同步重试', async () => {
  const harness = createStandardHarness({
    pointerResults: [{ ok: true }, new Error('simulated failure'), { ok: true }],
  });
  await harness.flushMicrotasks();

  harness.document.dispatch('mousemove', { clientX: 320, clientY: 40 });
  await harness.flushMicrotasks();
  assert.deepEqual(harness.pointerCalls, [true, false]);

  harness.sync();
  await harness.flushMicrotasks();
  assert.deepEqual(harness.pointerCalls, [true, false, false]);

  harness.sync();
  await harness.flushMicrotasks();
  assert.deepEqual(harness.pointerCalls, [true, false, false]);
});

test('失败封面不会被每次 pulse 补丁重新赋 src，只有封面地址变化后才重试', async () => {
  const harness = createStandardHarness();
  await harness.flushMicrotasks();

  harness.applyState({ hasTrack: true, cover: 'cover-bad' });
  assert.deepEqual(harness.coverAssignments, ['cover-bad']);
  harness.nodes.cover.dispatch('error');

  harness.applyState({ pulse: 0.25 });
  harness.applyState({ pulse: 0.5 });
  assert.deepEqual(harness.coverAssignments, ['cover-bad']);

  harness.applyState({ cover: 'cover-good' });
  assert.deepEqual(harness.coverAssignments, ['cover-bad', 'cover-good']);
});

test('无歌曲时封面入口不声明 aria-hidden，仍保留键盘焦点入口', () => {
  const html = readMiniPage('mini-player.html');
  const harness = createStandardHarness();
  harness.applyState({ hasTrack: false });
  assert.equal(harness.nodes['cover-wrap'].getAttribute('aria-hidden'), null);
  assert.match(html, /id="cover-wrap" role="button" tabindex="0"/);
  assert.doesNotMatch(html, /coverWrap\.setAttribute\('aria-hidden'/);
});

test('标准与极简桌面歌词按钮使用主题变量并扩展隐形命中区', () => {
  for (const fileName of ['mini-player.html', 'mini-player-compact.html']) {
    const html = readMiniPage(fileName);
    assert.match(html, /\.desktop-lyrics-toggle:hover:not\(:disabled\)[\s\S]*?color:\s*var\(--th-mini-btn-hover-text,\s*#dffffa\)/);
    assert.match(html, /\.desktop-lyrics-toggle\.active[\s\S]*?color:\s*var\(--th-mini-play-text,\s*#a9fff2\)/);
    assert.match(html, /\.desktop-lyrics-toggle::before[\s\S]*?position:\s*absolute[\s\S]*?top:\s*-4px[\s\S]*?left:\s*-4px[\s\S]*?pointer-events:\s*auto/);
    assert.match(html, /\.restore::before[\s\S]*?position:\s*absolute[\s\S]*?top:\s*-4px[\s\S]*?left:\s*-4px[\s\S]*?pointer-events:\s*auto/);
  }
});

test('固定 360x84 窗口下最大光晕超出可用边距，裁切是几何约束而非可无副作用修复', () => {
  const html = readMiniPage('mini-player.html');
  const windowWidth = 360;
  const windowHeight = 84;
  const bodyPadding = 6;
  const coverSize = 54;
  const maxScale = 1 + 0.195;
  const coverCenterX = windowWidth - bodyPadding - coverSize / 2;
  const coverCenterY = windowHeight / 2;
  const scaledHalf = coverSize * maxScale / 2;
  const edgeMargins = [
    coverCenterX - scaledHalf,
    windowWidth - (coverCenterX + scaledHalf),
    coverCenterY - scaledHalf,
    windowHeight - (coverCenterY + scaledHalf),
  ];
  const maxShadowRadius = 12 + 18;

  assert.match(html, /0 0 calc\(12px \+ var\(--mini-glow\) \* 18px\)/);
  assert.ok(Math.min(...edgeMargins) < maxShadowRadius);
  assert.deepEqual(edgeMargins.map((value) => Number(value.toFixed(3))), [294.735, 0.735, 9.735, 9.735]);
});
