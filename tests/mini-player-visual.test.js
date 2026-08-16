'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { MiniPlayerStateCache } = require('../desktop/mini-player-state-cache');

const root = path.join(__dirname, '..');

/**
 * 读取仓库内的测试目标文件。
 * @param {string} relativePath 相对于仓库根目录的文件路径。
 * @returns {string} 文件完整文本。
 */
function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

/**
 * 从源码中提取指定函数，确保测试运行真实实现。
 * @param {string} source 待检索的源码文本。
 * @param {string} name 函数名。
 * @returns {string} 完整函数源码。
 */
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

/**
 * 构造标准迷你播放器的无界面 DOM 与 IPC 测试环境。
 * @returns {{nodes:Record<string, object>, commands:string[], moves:Array<{dx:number,dy:number,commit:boolean}>, passthroughs:boolean[], document:object, applyState:Function, flushTimers:Function}} 可驱动的渲染器测试环境。
 */
function createMiniPlayerHarness() {
  const html = read('public/mini-player.html');
  const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
  const timers = new Map();
  const listeners = new Map();
  const commands = [];
  const moves = [];
  const passthroughs = [];
  let nextTimerId = 1;

  /**
   * 创建实现本测试所需 DOM 行为的轻量节点。
   * @param {string} id 节点标识。
   * @returns {object} 可注册和触发事件的假节点。
   */
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
      rect: { left: 0, top: 0, right: 0, bottom: 0 },
      blur() { node.focusWithin = false; },
      /** @returns {{left:number, top:number, right:number, bottom:number}} 当前假节点的视口矩形。 */
      getBoundingClientRect() { return node.rect; },
      /** @returns {void} 假节点不需要真实指针捕获。 */
      setPointerCapture() {},
      /** @returns {void} 假节点不需要真实指针捕获释放。 */
      releasePointerCapture() {},
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
    restore: createNode('restore'),
  };
  nodes['mini-shell'].setAttribute('data-collapsed', 'true');
  // 收回态标准窗口为 360 × 84，封面停在右端并留出 6px 窗体内边距。
  nodes['cover-wrap'].rect = { left: 300, top: 15, right: 354, bottom: 69 };

  const documentNode = createNode('document');
  let stateHandler = null;
  const context = {
    document: {
      body: createNode('body'),
      getElementById(id) { return nodes[id]; },
      addEventListener: documentNode.addEventListener,
    },
    window: {
      requestAnimationFrame(callback) { callback(); },
      miniPlayer: {
        command(action) {
          commands.push(action);
          return Promise.resolve({ ok: true });
        },
        moveBy(dx, dy, commit) {
          moves.push({ dx, dy, commit: commit === true });
          return Promise.resolve({ ok: true });
        },
        setPointerPassthrough(passthrough) {
          passthroughs.push(passthrough === true);
          return Promise.resolve({ ok: true });
        },
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
    commands,
    moves,
    passthroughs,
    document: documentNode,
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
  assert.match(html, /id="cover"[^>]+draggable="false"/);
  assert.match(html, /\.cover img \{[\s\S]*?-webkit-user-drag:\s*none;/);
  assert.match(html, /data-collapsed="true"/);
  assert.match(html, /data-glow="true"/);
  assert.match(html, /--mini-pulse/);
  assert.match(html, /var\(--mini-pulse\) \* 0\.085/);
  assert.match(html, /var\(--mini-pulse\) \* 0\.055/);
  assert.match(html, /0 0 calc\(6px \+ var\(--mini-pulse\) \* 9px\)/);
  assert.match(html, /\.mini-shell\[data-glow="false"\] \.cover \{ box-shadow:/);
  assert.doesNotMatch(html, /\.cover::after \{[\s\S]*?inset: -4px;/);
  assert.match(html, /setExpanded\(true\)/);
  assert.match(html, /prefers-reduced-motion/);
  assert.match(html, /coverWrap\.addEventListener\('mouseenter'/);
  assert.match(html, /coverWrap\.addEventListener\('focus'/);
  assert.match(html, /miniShell\.addEventListener\('focusout'/);
  assert.match(html, /aria-expanded/);
  assert.match(html, /data-hover-expand/);
  assert.doesNotMatch(html, /class="window-actions"/);
  assert.doesNotMatch(html, /id="collapse"/);
  assert.doesNotMatch(html, /disableAutomaticCollapse|disable-auto-collapse/);
  assert.match(html, /id="restore"[^>]+title="返回主界面"/);
  assert.match(html, /\.restore \{[\s\S]*?align-self: flex-start;[\s\S]*?margin: -1px -1px 0 0;/);
  assert.match(html, /id="desktop-lyrics"[^>]+title="开启桌面歌词"/);
  assert.match(html, /\.mini-shell\[data-collapsed="true"\]\s*\{[\s\S]*?-webkit-app-region:\s*no-drag;[\s\S]*?pointer-events:\s*none;/);
  assert.match(html, /\.mini-shell\[data-collapsed="true"\]\s+\.cover\s*\{[\s\S]*?pointer-events:\s*auto;[\s\S]*?-webkit-app-region:\s*no-drag;/);
  assert.match(html, /\.mini-shell\[data-expand-direction="left"\]\s+\.desktop-lyrics-toggle\s*\{[\s\S]*?left:\s*5px;[\s\S]*?right:\s*auto;/);
  // 桌面歌词按钮是 position:absolute，一旦落在 .transport 里，收回态那份 transform 会把 .transport 变成包含块，
  // 悬浮展开/收回过程中按钮会被拽到面板中央并被 overflow:hidden 裁切，所以必须挂在 .mini-shell 直属层。
  const transportBlock = html.slice(html.indexOf('<div class="transport">'), html.indexOf('id="restore"'));
  assert.ok(transportBlock.length > 0);
  assert.doesNotMatch(transportBlock.slice(0, transportBlock.indexOf('</div>')), /id="desktop-lyrics"/);
  assert.match(html, /<\/div>\s*(?:<!--[\s\S]*?-->\s*)?<button id="desktop-lyrics"/);
  assert.match(html, /\.mini-shell\[data-collapsed="true"\]\s+\.desktop-lyrics-toggle\s*\{[\s\S]*?opacity:\s*0;[\s\S]*?pointer-events:\s*none;/);
  assert.match(html, /\.desktop-lyrics-toggle \{[\s\S]*?transition:[^;]*opacity 190ms ease/);
  assert.match(
    html,
    /\.mini-shell\[data-expand-direction="left"\]\[data-collapsed="true"\] \.meta,\s*\.mini-shell\[data-expand-direction="left"\]\[data-collapsed="true"\] \.transport,\s*\.mini-shell\[data-expand-direction="left"\]\[data-collapsed="true"\] \.restore \{\s*transform: translateX\(-10px\) scale\(0\.94\);/,
  );
  assert.match(html, /document\.addEventListener\('mousemove', trackCoverHotRegion\)/);
  assert.match(html, /document\.addEventListener\('mouseleave', clearCoverHotRegion\)/);
  assert.match(html, /window\.miniPlayer\.setPointerPassthrough\(next\)/);
});

test('标准迷你播放器把低频脉冲映射为可见封面缩放和光晕', () => {
  const harness = createMiniPlayerHarness();
  const shell = harness.nodes['mini-shell'];

  harness.applyState({
    hasTrack: true,
    playing: true,
    pulse: 0.25,
    visual: { pulseEnabled: true, pulseStrength: 0.78, glowEnabled: true, hoverExpand: true, radius: 16 },
  });
  const visiblePulse = Number(shell.style.values['--mini-pulse']);
  assert.ok(visiblePulse > 0.25 * 0.78);
  assert.equal(shell.style.values['--mini-radius'], '16px');
  assert.equal(shell.getAttribute('data-glow'), 'true');

  harness.applyState({
    pulse: 0.9,
    visual: { pulseEnabled: true, pulseStrength: 0, glowEnabled: false, hoverExpand: true, radius: 16 },
  });
  assert.equal(shell.style.values['--mini-pulse'], '0.000');
  assert.equal(shell.getAttribute('data-glow'), 'false');
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

test('标准迷你播放器会根据主进程方向把完整面板翻到封面的左侧', () => {
  const html = read('public/mini-player.html');
  const harness = createMiniPlayerHarness();
  const shell = harness.nodes['mini-shell'];

  harness.applyState({ expandDirection: 'left' });

  assert.equal(shell.getAttribute('data-expand-direction'), 'left');
  assert.match(html, /data-expand-direction="left"[^}]*\{[^}]*flex-direction:\s*row-reverse/);
  assert.match(html, /\.mini-shell\[data-collapsed="true"\] \.cover \{[\s\S]*?margin:\s*0;/);
  assert.match(html, /data-expand-direction="left"\][^}]*\.restore \{[^}]*margin:\s*-1px 0 0 -1px;/);
});

test('歌曲封面拖动移动窗口，短按仍保持展开行为', () => {
  const harness = createMiniPlayerHarness();
  const shell = harness.nodes['mini-shell'];
  const coverWrap = harness.nodes['cover-wrap'];
  let prevented = 0;

  coverWrap.dispatch('pointerdown', {
    button: 0,
    pointerId: 7,
    screenX: 100,
    screenY: 100,
  });
  coverWrap.dispatch('pointermove', {
    pointerId: 7,
    screenX: 103,
    screenY: 102,
    preventDefault() { prevented += 1; },
  });
  assert.deepEqual(harness.moves, []);

  coverWrap.dispatch('pointermove', {
    pointerId: 7,
    screenX: 110,
    screenY: 106,
    preventDefault() { prevented += 1; },
  });
  coverWrap.dispatch('pointerup', { pointerId: 7 });
  assert.deepEqual(harness.moves, [
    { dx: 10, dy: 6, commit: false },
    { dx: 0, dy: 0, commit: true },
  ]);
  assert.equal(prevented, 1);

  coverWrap.dispatch('click', { preventDefault() { prevented += 1; } });
  assert.equal(shell.getAttribute('data-collapsed'), 'true');
  coverWrap.dispatch('click', { preventDefault() { prevented += 1; } });
  assert.equal(shell.getAttribute('data-collapsed'), 'false');
});

test('收回态把窗口鼠标事件交还桌面，指针回到封面热区立即恢复交互', () => {
  const harness = createMiniPlayerHarness();
  const shell = harness.nodes['mini-shell'];
  const coverWrap = harness.nodes['cover-wrap'];

  assert.equal(shell.getAttribute('data-collapsed'), 'true');
  assert.deepEqual(harness.passthroughs, [true]);

  // 收回后的空白区域不再参与命中：坐标落在完整面板旧位置也保持穿透。
  harness.document.dispatch('mousemove', { clientX: 40, clientY: 40 });
  assert.deepEqual(harness.passthroughs, [true]);
  assert.equal(shell.getAttribute('data-collapsed'), 'true');

  harness.document.dispatch('mousemove', { clientX: 320, clientY: 40 });
  assert.deepEqual(harness.passthroughs, [true, false]);
  assert.equal(shell.getAttribute('data-collapsed'), 'false');

  // 展开后整块面板都要参与命中，指针移到控制区不能重新穿透。
  shell.hover = true;
  harness.document.dispatch('mousemove', { clientX: 40, clientY: 40 });
  assert.deepEqual(harness.passthroughs, [true, false]);
  assert.equal(shell.getAttribute('data-collapsed'), 'false');

  shell.hover = false;
  coverWrap.hover = false;
  shell.dispatch('mouseleave');
  harness.flushTimers();
  assert.equal(shell.getAttribute('data-collapsed'), 'true');
  assert.deepEqual(harness.passthroughs, [true, false, true]);

  // 指针整体离开窗口后热区标记必须清零，收回态继续保持穿透。
  harness.document.dispatch('mouseleave', {});
  assert.deepEqual(harness.passthroughs, [true, false, true]);
});

test('封面拖动期间保持窗口交互，拖动结束后按热区恢复穿透', () => {
  const harness = createMiniPlayerHarness();
  const coverWrap = harness.nodes['cover-wrap'];

  harness.document.dispatch('mousemove', { clientX: 320, clientY: 40 });
  assert.deepEqual(harness.passthroughs, [true, false]);

  coverWrap.dispatch('pointerdown', { button: 0, pointerId: 3, screenX: 200, screenY: 200 });
  // 拖动时窗口跟随指针移动，热区坐标短暂失配也不能让出鼠标事件。
  harness.document.dispatch('mousemove', { clientX: 10, clientY: 10 });
  assert.deepEqual(harness.passthroughs, [true, false]);

  coverWrap.dispatch('pointerup', { pointerId: 3 });
  harness.flushTimers();
  assert.deepEqual(harness.passthroughs, [true, false, true]);
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

test('自动收回设置常驻样式选择区并支持双向持久化', () => {
  const index = read('public/index.html');
  const renderer = read('public/app.js');
  const main = read('desktop/main.js');
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
  context.toggle('hoverExpand');
  assert.equal(context.fx.miniPlayerHoverExpand, true);
  assert.deepEqual(calls, { controls: 2, saves: 2, pushes: 2 });
  assert.match(index, /id="fx-mini-player-settings"[\s\S]*?id="t-miniPlayer"[\s\S]*?id="mini-player-mode-seg"/);
  assert.match(index, /id="mini-player-mode-seg"[\s\S]*?id="t-miniPlayerHover"[^>]+toggleMiniPlayerVisual\('hoverExpand'\)/);
  assert.match(index, /mini-player-collapse-glyph"[^>]*>×<\/em><strong>自动收回<\/strong>/);
  assert.match(index, /id="mini-player-collapse-state">开启/);
  assert.match(index, /开启后移开鼠标会回到封面；关闭后保持完整迷你播放器/);
  assert.match(renderer, /var allowed = \{[^}]*mini:1/);
  assert.match(renderer, /id === 'fx-mini-player-settings'\) return 'mini'/);
  assert.ok(renderer.includes("['mini', '\\u8ff7\\u4f60']"));
  assert.match(renderer, /hoverButton\.setAttribute\('aria-pressed'/);
  assert.match(renderer, /hoverState\.textContent = hoverExpandEnabled \? '开启' : '关闭'/);
  assert.match(renderer, /miniPlayerHoverExpand:\s*raw\.miniPlayerHoverExpand !== false/);
  assert.match(renderer, /miniPlayerHoverExpand:\s*fx\.miniPlayerHoverExpand !== false/);
  assert.match(renderer, /hoverExpand:\s*fx\.miniPlayerHoverExpand !== false/);
  assert.doesNotMatch(main, /disable-auto-collapse/);
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
  assert.match(renderer, /Math\.abs\(state\.pulse - pulse\) >= 0\.012/);
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
