'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const THREE = require('../public/vendor/three.r128.min.js');
const SOURCE = fs.readFileSync(path.join(__dirname, '../public/shelf-classic.js'), 'utf8');

function makeCanvas() {
  const ctx = { operations: [], measureText: text => ({ width: String(text).length * 12 }) };
  ctx.clearRect = (...args) => { ctx.operations = [['clearRect', ...args]]; };
  ctx.createLinearGradient = () => {
    const gradient = { stops: [] };
    gradient.addColorStop = (offset, color) => gradient.stops.push([offset, color]);
    return gradient;
  };
  for (const method of ['beginPath', 'moveTo', 'arcTo', 'closePath', 'fill', 'stroke', 'save', 'restore', 'clip', 'drawImage', 'fillText', 'lineTo']) {
    ctx[method] = (...args) => ctx.operations.push([method, ...args, ctx.fillStyle, ctx.strokeStyle, ctx.lineWidth, ctx.font, ctx.shadowColor, ctx.shadowBlur]);
  }
  return { getContext: () => ctx, __ctx: ctx };
}

function makeHarness(source = SOURCE) {
  const counters = { settings: 0, accent: 0, content: 0, clock: 0, position: 0, scale: 0, color: 0, rotation: 0 };
  const state = {
    now: 10000,
    items: Array.from({ length: 13 }, (_, index) => ({ type: 'playlist', key: 'pl:' + index, playlistId: 'pl:' + index, title: 'Song ' + index, sub: '3 首', tag: '收藏', cover: '' })),
    look: { size: 1, x: 0, y: 0, z: 0, angle: 0, opacity: 1, bgOpacity: 0.5, accent: '#ffffff' },
    contentOpen: false, always: false, skull: false, wallpaper: false, shared: {},
    live: { playQueue: [], currentIdx: -1, bass: 0, beatPulse: 0, playing: false, pointerParallax: { x: 0, y: 0 }, fx: {} }
  };
  const win = {};
  const deps = {
    THREE, scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(60, 1, 0.1, 100), renderer: {},
    uniforms: { uTime: { value: 10 }, uPixel: { value: 1 }, uDotTex: null },
    particles: { rotation: { x: 0, y: 0, z: 0 } }, pointerParallax: state.live.pointerParallax,
    fx: state.live.fx, playQueue: [], currentIdx: -1, playlistCoverCache: {}, bass: 0, beatPulse: 0, playing: false,
    clampRange: (value, min, max) => Math.min(max, Math.max(min, value)),
    songCoverSrc: () => '', queueItemKey: song => song.key || '', requestPlaylistCover: () => {}, readableInkForHex: () => '#000000',
    shelfAccentHex: () => { counters.accent++; return state.look.accent; },
    shelfAccentRgba: (alpha, fallback, accent) => {
      const value = accent || deps.shelfAccentHex();
      return 'rgba(' + parseInt(value.slice(1, 3), 16) + ',' + parseInt(value.slice(3, 5), 16) + ',' + parseInt(value.slice(5, 7), 16) + ',' + alpha + ')';
    },
    shelfSettings: () => { counters.settings++; return state.look; },
    shelfAlwaysVisible: () => state.always,
    shouldUseWallpaperSafeShelfCamera: () => state.wallpaper,
    shouldUseSkullSafeShelfCamera: () => state.skull,
    shouldUseShelfDynamicCamera: () => true,
    snapshotLive: () => state.live,
    pushShared: value => Object.assign(state.shared, value),
    getShelfItems: () => state.items,
    makeContentListManager: () => ({
      isOpen: () => { counters.content++; return state.contentOpen; },
      update() {}, open: () => { state.contentOpen = true; }, close: () => { state.contentOpen = false; },
      dispose: () => { state.contentOpen = false; }, refreshTheme() {}
    })
  };
  for (const name of ['compactCount', 'pulseObjectValue', 'showToast', 'playShelfSelectTick', 'setFocusZone', 'setPeek', 'updateEmptyHomeVisibility', 'loadPlaylistIntoQueueById', 'playQueueAt', 'setShelfMode', 'togglePlaylistPanel', 'suppressBottomControlsForShelf', 'restoreBottomControlsAfterShelfExit', 'scheduleLyricLayoutSave', 'saveLyricLayout', 'setShelfHoverTabVisible', 'safeShelfCloseContent']) deps[name] = () => {};
  deps.isFullscreenPlaylistQueueFocusLockedAtEdge = deps.isPointerOverUi = deps.hasAnyPlatformLogin = () => false;
  const sandbox = {
    window: win, innerWidth: 1280, innerHeight: 720, console, Image: function () {},
    document: { body: { classList: { contains: () => false } }, getElementById: () => null, createElement: makeCanvas, addEventListener() {} },
    performance: { now: () => { counters.clock++; return state.now; } },
    requestAnimationFrame: () => 1, cancelAnimationFrame() {}, setTimeout: () => 1
  };
  vm.runInNewContext(source, sandbox);
  const mod = win.MineradioShelfClassic;
  const engine = mod.createClassicShelfEngine(deps);
  engine.setMode('stage');
  function instrument() {
    for (const card of engine.getCards()) {
      if (card.__instrumented) continue;
      card.__instrumented = true;
      for (const [object, method, counter] of [[card.mesh.position, 'set', 'position'], [card.mesh.scale, 'setScalar', 'scale'], [card.mesh.material.color, 'setScalar', 'color']]) {
        const original = object[method];
        object[method] = function (...args) { counters[counter]++; return original.apply(this, args); };
      }
      const original = card.mesh.rotation._onChangeCallback;
      card.mesh.rotation._onChangeCallback = function () { counters.rotation++; return original.call(this); };
    }
  }
  function tick(dt = 1 / 60, withSnapshot = false) {
    instrument();
    state.now += dt * 1000;
    deps.uniforms.uTime.value += dt;
    engine.update(dt, state.now, withSnapshot ? { contentOpen: state.contentOpen, alwaysVisible: state.always } : undefined);
  }
  function resetCounters() { for (const name of Object.keys(counters)) counters[name] = 0; }
  return { state, deps, sandbox, mod, engine, counters, tick, resetCounters };
}

function visualState(harness) {
  return JSON.parse(JSON.stringify({
    shared: harness.state.shared,
    cards: harness.engine.getCards().map(card => ({
      index: card.index, visible: card.mesh.visible, order: card.mesh.renderOrder,
      position: card.mesh.position.toArray(), rotation: card.mesh.rotation.toArray(), quaternion: card.mesh.quaternion.toArray(),
      scale: card.mesh.scale.toArray(), color: card.mesh.material.color.toArray(), opacity: card.mesh.material.opacity,
      drawKey: card.drawKey, drawing: card.canvas.__ctx.operations
    }))
  }));
}

function stableWorkload(harness) {
  harness.engine.openContent(0);
  for (let i = 0; i < 120; i++) harness.tick();
  harness.resetCounters();
  for (let i = 0; i < 600; i++) harness.tick();
  return { ...harness.counters };
}

test('原版舞台稳定 600 帧不重复调用卡片位置、缩放、颜色与旋转 setter', () => {
  const h = makeHarness();
  const result = stableWorkload(h);
  assert.equal(h.engine.getCards().length, 11);
  assert.equal(h.engine.getCards().filter(card => card.mesh.visible).length, 6);
  assert.deepEqual(result, { settings: 600, accent: 0, content: 600, clock: 0, position: 0, scale: 0, color: 0, rotation: 0 });
});

test('帧快照传入时不再读取详情 getter，重建与纹理都使用当前外观', () => {
  const h = makeHarness();
  h.engine.openContent(0);
  h.state.look = { ...h.state.look, bgOpacity: 0.73, accent: '#aabbcc' };
  h.state.items[6].title = '新标题';
  h.resetCounters();
  h.tick(0.81, true);
  assert.equal(h.counters.content, 0);
  assert.equal(h.counters.settings, 1);
  assert.equal(h.counters.accent, 0);
  for (const card of h.engine.getCards()) {
    assert.equal(JSON.parse(card.drawKey).at(-1), 0.73);
    assert.equal(JSON.parse(card.drawKey).at(-2), '#aabbcc');
  }
  h.state.look.bgOpacity = 0.31;
  h.state.look.accent = '#112233';
  h.engine.refreshTheme();
  assert.equal(JSON.parse(h.engine.getCardAt(0).drawKey).at(-1), 0.31, '非帧主题入口应读取最新设置');
});

test('指针、律动、详情开关和外部姿态写入后稳定值比较即时补正', () => {
  const h = makeHarness();
  stableWorkload(h);
  const card = h.engine.getCardAt(0);
  h.state.live.pointerParallax = { x: 0.8, y: -0.6 };
  h.tick();
  assert.ok(Math.abs(card.mesh.rotation.y - 0.8 * 0.050) < 1e-12);
  assert.ok(Math.abs(card.mesh.rotation.x - (0.10 + 0.6 * 0.028)) < 1e-12);
  card.fxPulse = 0.5;
  h.tick();
  assert.ok(Math.abs(card.mesh.scale.x - 1.2 * 1.03) < 1e-12);
  h.engine.closeContent();
  h.tick();
  assert.equal(card.mesh.material.color.r, 1, '详情淡化颜色应恢复');
  const targetPosition = card.mesh.position.clone();
  const targetRotation = card.mesh.rotation.clone();
  card.mesh.position.set(99, 99, 99);
  card.mesh.scale.setScalar(99);
  card.mesh.material.color.setScalar(0);
  card.mesh.rotation.set(0.8, 0.4, 0.3);
  h.tick();
  assert.deepEqual(card.mesh.position.toArray(), targetPosition.toArray());
  assert.equal(card.mesh.rotation.x, targetRotation.x);
  assert.equal(card.mesh.rotation.y, targetRotation.y);
  assert.equal(card.mesh.rotation.z, 0.3, '普通姿态必须保留外部滚转');
  assert.equal(card.mesh.material.color.r, 1);
  assert.ok(Math.abs(card.mesh.scale.x - 1.2 * 1.03) < 1e-12);
});

test('原版侧栏相机四元数退出后更新欧拉姿态并保持滚转', () => {
  const h = makeHarness();
  h.state.always = true;
  h.state.skull = true;
  h.deps.camera.rotation.set(0.2, 0.3, 0.4);
  h.engine.setMode('side');
  h.tick();
  const card = h.engine.getCardAt(0);
  const roll = card.mesh.rotation.z;
  h.state.skull = false;
  h.tick();
  assert.equal(card.mesh.rotation.z, roll);
  assert.ok(Math.abs(card.mesh.rotation.x) < 1e-12);
  h.state.always = false;
  for (let i = 0; i < 180; i++) h.tick();
  assert.equal(h.state.shared.visibility, 0, '自动隐藏淡出仍完成');
  h.engine.setMode('off');
  h.resetCounters();
  h.tick();
  assert.equal(h.counters.settings, 0, '停用实例不再读取外观');
});

// 可选复现实验直接加载旧生产模块，不在测试中复制旧实现或模拟它的工作量。
if (process.env.MINERADIO_CLASSIC_BASELINE) {
  test('原版舞台生产模块基线对照：工作量下降且绘制与动画结果等价', t => {
    const old = makeHarness(fs.readFileSync(process.env.MINERADIO_CLASSIC_BASELINE, 'utf8'));
    const next = makeHarness();
    const before = stableWorkload(old);
    const after = stableWorkload(next);
    assert.deepEqual(visualState(next), visualState(old));
    assert.ok(before.position >= 3600 && before.scale >= 3600 && before.color >= 3600 && before.rotation >= 7200);
    assert.ok(before.content > after.content);
    for (let frame = 0; frame < 300; frame++) {
      for (const h of [old, next]) {
        h.state.live.pointerParallax = { x: Math.sin(frame * 0.1) * 0.7, y: Math.cos(frame * 0.1) * 0.6 };
        h.state.live.bass = (frame % 17) / 17;
        const card = h.engine.getCardAt(0);
        if (card) card.fxPulse = (frame % 11) / 11;
        if (frame === 20) h.engine.closeContent();
        if (frame === 60) h.engine.openContent(1);
        if (frame === 90) h.engine.scrollBy(3);
        if (frame === 120) { h.state.look.bgOpacity = 0.7; h.state.look.accent = '#aabbcc'; h.engine.refreshTheme(); }
        if (frame === 150) { h.state.items[6].title = '替换歌曲'; h.engine.rebuild(); }
        if (frame === 180) { h.state.always = true; h.state.skull = true; h.deps.camera.rotation.set(0.2, 0.3, 0.4); h.engine.setMode('side'); }
        if (frame === 220) h.state.skull = false;
        if (frame === 260) h.state.always = false;
        if (frame === 280) h.engine.setMode('off');
        h.tick();
      }
      assert.deepEqual(visualState(next), visualState(old), 'frame ' + frame);
    }
    t.diagnostic(JSON.stringify({ frames: 600, renderedCards: 11, visibleCards: 6, before, after }));
  });
}
