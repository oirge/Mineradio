'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { MiniPlayerStateCache } = require('../desktop/mini-player-state-cache');

const root = path.join(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function extractFunction(source, name) {
  const start = source.indexOf('function ' + name + '(');
  assert.ok(start >= 0, '未找到函数：' + name);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error('函数未闭合：' + name);
}

function createMiniPlayerHarness() {
  const html = read('public/mini-player.html');
  const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
  const timers = new Map();
  const listeners = new Map();
  let nextTimerId = 1;

  function createNode(id) {
    const attributes = new Map();
    const classNames = new Set();
    const node = {
      id,
      style: {
        values: {},
        setProperty(name, value) { this.values[name] = value; },
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
      src: '',
      blur() { node.focusWithin = false; },
      addEventListener(type, handler) {
        const handlers = listeners.get(node) || {};
        (handlers[type] || (handlers[type] = [])).push(handler);
        listeners.set(node, handlers);
      },
      dispatch(type, event) {
        const handlers = listeners.get(node) || {};
        for (const handler of handlers[type] || []) handler(event || { target: node });
      },
      setAttribute(name, value) { attributes.set(name, String(value)); },
      getAttribute(name) { return attributes.has(name) ? attributes.get(name) : null; },
      removeAttribute(name) { attributes.delete(name); },
      matches(selector) {
        if (selector === ':hover') return node.hover;
        if (selector === ':focus-within') return node.focusWithin;
        return false;
      },
    };
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
    collapse: createNode('collapse'),
    restore: createNode('restore'),
  };
  nodes['mini-shell'].setAttribute('data-collapsed', 'true');

  let stateHandler = null;
  const context = {
    document: {
      body: createNode('body'),
      getElementById(id) { return nodes[id]; },
    },
    window: {
      requestAnimationFrame(callback) { callback(); },
      miniPlayer: {
        command() { return Promise.resolve({ ok: true }); },
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

  return {
    nodes,
    applyState(patch) { stateHandler(patch); },
    flushTimers() {
      const pending = [...timers.values()];
      timers.clear();
      for (const callback of pending) callback();
    },
  };
}

test('标准迷你播放器包含封面胶囊态和悬停展开动画契约', () => {
  const html = read('public/mini-player.html');

  assert.match(html, /id="cover-wrap" role="button" tabindex="0"/);
  assert.match(html, /data-collapsed="true"/);
  assert.match(html, /data-glow="true"/);
  assert.match(html, /--mini-pulse/);
  assert.match(html, /setExpanded\(true\)/);
  assert.match(html, /prefers-reduced-motion/);
  assert.match(html, /coverWrap\.addEventListener\('mouseenter'/);
  assert.match(html, /coverWrap\.addEventListener\('focus'/);
  assert.match(html, /miniShell\.addEventListener\('focusout'/);
  assert.match(html, /aria-expanded/);
  assert.match(html, /data-hover-expand/);
  assert.match(html, /class="window-actions"/);
  assert.match(html, /id="collapse"[^>]+title="收起完整控制栏"[^>]+aria-label="收起完整控制栏"/);
  assert.match(html, /data-hover-expand="false"\] \.collapse \{ visibility: hidden; pointer-events: none; \}/);
});

test('悬停展开开关控制初始态、悬停态和键盘聚焦态', () => {
  const harness = createMiniPlayerHarness();
  const shell = harness.nodes['mini-shell'];
  const coverWrap = harness.nodes['cover-wrap'];

  assert.equal(shell.getAttribute('data-collapsed'), 'true');
  assert.equal(coverWrap.getAttribute('aria-expanded'), 'false');

  coverWrap.hover = true;
  coverWrap.dispatch('mouseenter');
  assert.equal(shell.getAttribute('data-collapsed'), 'false');
  assert.equal(coverWrap.getAttribute('aria-expanded'), 'true');

  coverWrap.hover = false;
  shell.hover = false;
  shell.dispatch('mouseleave');
  harness.flushTimers();
  assert.equal(shell.getAttribute('data-collapsed'), 'true');

  shell.focusWithin = true;
  coverWrap.dispatch('focus');
  assert.equal(shell.getAttribute('data-collapsed'), 'false');

  shell.focusWithin = false;
  shell.dispatch('focusout');
  harness.flushTimers();
  assert.equal(shell.getAttribute('data-collapsed'), 'true');
});

test('关闭悬停展开后始终保持完整迷你播放器', () => {
  const harness = createMiniPlayerHarness();
  const shell = harness.nodes['mini-shell'];
  const coverWrap = harness.nodes['cover-wrap'];

  harness.applyState({ visual: { pulseEnabled: true, pulseStrength: 0.78, glowEnabled: true, hoverExpand: false, radius: 12 } });
  assert.equal(shell.getAttribute('data-hover-expand'), 'false');
  assert.equal(shell.getAttribute('data-collapsed'), 'false');
  assert.equal(coverWrap.getAttribute('aria-label'), '完整迷你播放器');

  shell.hover = false;
  coverWrap.hover = false;
  shell.dispatch('mouseleave');
  shell.dispatch('focusout');
  harness.flushTimers();
  assert.equal(shell.getAttribute('data-collapsed'), 'false');

  harness.applyState({ visual: { pulseEnabled: true, pulseStrength: 0.78, glowEnabled: true, hoverExpand: true, radius: 12 } });
  assert.equal(shell.getAttribute('data-hover-expand'), 'true');
  assert.equal(shell.getAttribute('data-collapsed'), 'true');
});

test('标准迷你播放器收起按钮只折叠悬停展开的完整控制栏', () => {
  const harness = createMiniPlayerHarness();
  const shell = harness.nodes['mini-shell'];
  const coverWrap = harness.nodes['cover-wrap'];
  const collapseButton = harness.nodes.collapse;

  coverWrap.hover = true;
  coverWrap.dispatch('mouseenter');
  assert.equal(shell.getAttribute('data-collapsed'), 'false');

  coverWrap.hover = false;
  collapseButton.focusWithin = true;
  collapseButton.dispatch('click');
  assert.equal(shell.getAttribute('data-collapsed'), 'true');
  assert.equal(coverWrap.getAttribute('aria-expanded'), 'false');

  harness.applyState({ visual: { pulseEnabled: true, pulseStrength: 0.78, glowEnabled: true, hoverExpand: false, radius: 12 } });
  collapseButton.dispatch('click');
  assert.equal(shell.getAttribute('data-collapsed'), 'false');
});

test('悬停展开设置独立持久化并立即同步到迷你窗口', () => {
  const index = read('public/index.html');
  const renderer = read('public/app.js');
  const calls = { controls: 0, saves: 0, pushes: 0 };
  const context = {
    fx: { miniPlayerHoverExpand: true },
    applyMiniPlayerVisualControls() { calls.controls += 1; },
    saveLyricLayout() { calls.saves += 1; },
    pushMiniPlayerState(force) { if (force === true) calls.pushes += 1; },
  };

  vm.runInNewContext(
    extractFunction(renderer, 'toggleMiniPlayerVisual') + '\nthis.toggle = toggleMiniPlayerVisual;',
    context,
  );
  context.toggle('hoverExpand');

  assert.equal(context.fx.miniPlayerHoverExpand, false);
  assert.deepEqual(calls, { controls: 1, saves: 1, pushes: 1 });
  assert.match(index, /id="t-miniPlayerHover"[^>]+toggleMiniPlayerVisual\('hoverExpand'\)/);
  assert.match(index, /鼠标悬停或键盘聚焦/);
  assert.match(index, /关闭后始终显示完整面板/);
  assert.match(renderer, /miniPlayerHoverExpand:\s*raw\.miniPlayerHoverExpand !== false/);
  assert.match(renderer, /miniPlayerHoverExpand:\s*fx\.miniPlayerHoverExpand !== false/);
  assert.match(renderer, /hoverExpand:\s*fx\.miniPlayerHoverExpand !== false/);
});

test('极简迷你播放器继续保持无封面结构', () => {
  const html = read('public/mini-player-compact.html');

  assert.doesNotMatch(html, /id="cover-wrap"/);
  assert.doesNotMatch(html, /class="cover"/);
  assert.doesNotMatch(html, /id="collapse"/);
});

test('迷你播放器律动通过低频采样和增量状态同步', () => {
  const renderer = read('public/app.js');
  const main = read('desktop/main.js');

  assert.match(renderer, /miniPlayerPulseTimer/);
  assert.match(renderer, /setTimeout\(runMiniPlayerPulseTimer, 80\)/);
  assert.match(renderer, /Math\.abs\(state\.pulse - pulse\) >= 0\.035/);
  assert.match(renderer, /miniPlayerPulseStrength/);
  assert.match(main, /next\.pulse !== previous\.pulse/);
  assert.match(main, /next\.visualSignature !== previous\.visualSignature/);
});

test('迷你播放器视觉配置会被边界校正并持久化到状态缓存', () => {
  const cache = new MiniPlayerStateCache(true);
  cache.setResident(true);

  assert.equal(cache.apply({
    pulse: 4,
    visual: {
      pulseEnabled: false,
      pulseStrength: 4,
      glowEnabled: false,
      hoverExpand: false,
      radius: 100,
    },
  }), true);

  assert.equal(cache.value.pulse, 1);
  assert.deepEqual(cache.value.visual, {
    pulseEnabled: false,
    pulseStrength: 1.5,
    glowEnabled: false,
    hoverExpand: false,
    radius: 22,
  });
});
