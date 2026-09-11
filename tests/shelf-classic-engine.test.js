'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'public', 'shelf-classic.js'), 'utf8');
const THREE = require(path.join(ROOT, 'public/vendor/three.r128.min.js'));

function makeCanvas() {
  const context = {
    draws: 0,
    clearRect() { this.draws += 1; },
    measureText: text => ({ width: String(text).length * 12 }),
    createLinearGradient: () => ({ addColorStop() {} }),
  };
  for (const method of ['beginPath', 'moveTo', 'arcTo', 'closePath', 'fill', 'stroke', 'save', 'restore', 'clip', 'drawImage', 'fillText', 'lineTo']) context[method] = () => {};
  return { __ctx: context, getContext: () => context };
}

function loadModule() {
  const win = {};
  const scheduled = new Map();
  let nextId = 0;
  const classes = new Set();
  const document = {
    body: { classList: { contains: name => classes.has(name), toggle: (name, on) => { if (on) classes.add(name); else classes.delete(name); } } },
    getElementById: () => null,
    createElement: () => makeCanvas(),
    addEventListener: () => {},
  };
  const sandbox = {
    window: win,
    document,
    performance: { now: () => 0 },
    innerWidth: 1280,
    innerHeight: 720,
    requestAnimationFrame: fn => { scheduled.set(++nextId, fn); return nextId; },
    cancelAnimationFrame: id => scheduled.delete(id),
    setTimeout,
    console,
    Image: function () {},
  };
  vm.runInNewContext(SRC, sandbox);
  return { sandbox, mod: win.MineradioShelfClassic, scheduled, classes };
}

function makeScene(log) {
  const scene = new THREE.Scene();
  const add = scene.add.bind(scene);
  const remove = scene.remove.bind(scene);
  scene.add = object => { log.adds.push(object); return add(object); };
  scene.remove = object => { log.removes.push(object); return remove(object); };
  return scene;
}

function makeContentManager(record) {
  return {
    isOpen: () => record.open,
    update: () => { record.updates += 1; },
    open: () => { record.open = true; record.opens += 1; },
    close: () => { record.open = false; },
    dispose: () => { record.disposed += 1; record.open = false; },
    refreshTheme: () => {},
  };
}

function makeDeps(overrides) {
  const base = {
    THREE: THREE,
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(60, 1, 0.1, 100),
    renderer: {},
    uniforms: { uTime: { value: 0 }, uPixel: { value: 1 }, uDotTex: null },
    particles: { rotation: { x: 0, y: 0, z: 0 } },
    pointerParallax: { x: 0, y: 0 },
    fx: {},
    playQueue: [],
    currentIdx: -1,
    playlistCoverCache: {},
    bass: 0,
    beatPulse: 0,
    playing: false,
    clampRange: (v, a, b) => Math.min(b, Math.max(a, v)),
    songCoverSrc: () => '',
    queueItemKey: () => '',
    requestPlaylistCover: () => {},
    readableInkForHex: () => '#000000',
    shelfAccentHex: () => '#ffffff',
    shelfAccentRgba: () => 'rgba(255,255,255,1)',
    shelfSettings: () => ({ size: 1, x: 0, y: 0, z: 0, angle: 0, opacity: 1, bgOpacity: 0.5, accent: '#ffffff' }),
    shelfAlwaysVisible: () => false,
    shouldUseWallpaperSafeShelfCamera: () => false,
    shouldUseSkullSafeShelfCamera: () => false,
    shouldUseShelfDynamicCamera: () => true,
    hasAnyPlatformLogin: () => false,
    userPlaylists: [],
    myPodcastCollections: [],
    playlistCatalogRevision: 0,
    pulseObjectValue: () => {},
    showToast: () => {},
    playShelfSelectTick: () => {},
    setFocusZone: () => {},
    setPeek: () => {},
    updateEmptyHomeVisibility: () => {},
    loadPlaylistIntoQueueById: () => {},
    playQueueAt: () => {},
    setShelfMode: () => {},
    togglePlaylistPanel: () => {},
    suppressBottomControlsForShelf: () => {},
    restoreBottomControlsAfterShelfExit: () => {},
    scheduleLyricLayoutSave: () => {},
    saveLyricLayout: () => {},
    setShelfHoverTabVisible: () => {},
    isFullscreenPlaylistQueueFocusLockedAtEdge: () => false,
    isPointerOverUi: () => false,
    visualGuideActive: false,
    emptyHomeActive: false,
    homeForcedOpen: false,
    getShelfItems: () => [],
    snapshotLive: () => ({}),
    pushShared: () => {},
    safeShelfCloseContent: () => {},
    makeContentListManager: () => makeContentManager({ open: false, updates: 0, opens: 0, disposed: 0 }),
  };
  return Object.assign(base, overrides || {});
}

function playlistItems(titles) {
  return titles.map((title, i) => ({
    type: 'playlist', key: 'pl:' + i, title: title, sub: (i + 1) + ' 首', cover: '',
    tag: '我的歌单', playlistId: 'local-playlist:' + i, contentSignature: 'sig:' + title,
  }));
}

function makeEngine(deps) {
  const { mod } = loadModule();
  const engine = mod.createClassicShelfEngine(deps);
  return { mod, engine };
}

// 主循环按 uTime.value 采样（0.8s），测试必须推进该时钟。
function tick(deps, engine, dt) {
  deps.uniforms.uTime.value += dt;
  engine.update(dt);
}

test('shelf-classic.js 是 IIFE，只暴露 window.MineradioShelfClassic 一个全局', () => {
  const { sandbox, mod } = loadModule();
  assert.ok(mod, '应挂到 window.MineradioShelfClassic');
  assert.equal(typeof mod.createClassicShelfEngine, 'function');
  const winKeys = Object.keys(sandbox.window);
  assert.deepEqual(winKeys, ['MineradioShelfClassic'], 'window 上不应有其他新增全局');
  const leaked = Object.keys(sandbox).filter(k => /^(shelf|make|tick|setShelf|isShelf|canUse|canShow|duration|CLASSIC_)/.test(k));
  assert.deepEqual(leaked, [], '不应有 shelf* 顶层变量泄漏到全局，实际: ' + leaked.join(','));
});

const EXPECTED_METHODS = [
  'setMode', 'getMode', 'update', 'onCoverChange', 'rebuild', 'refreshTheme',
  'raycastCards', 'pickCardAtScreen', 'next', 'prev', 'scrollBy', 'getCenterIdx',
  'getCardAt', 'getCards', 'playPlaylistAt', 'clearSelected', 'setSelected',
  'triggerAction', 'openContent', 'closeContent', 'hasOpenContent', 'getContentList',
  'getOpenContentIndex', 'canInteract',
];

test('createClassicShelfEngine 返回与现有 makeShelfManager 同构的 manager 接口', () => {
  const { mod } = loadModule();
  const engine = mod.createClassicShelfEngine(makeDeps());
  EXPECTED_METHODS.forEach(name => {
    assert.equal(typeof engine[name], 'function', 'engine 缺少方法 ' + name);
  });
  assert.equal(engine.getMode(), 'side', '初始模式应为 side');
});

test('原版几何/热区函数可直接调用并与上游常量一致', () => {
  const { mod } = loadModule();
  mod.createClassicShelfEngine(makeDeps());
  assert.equal(mod.isPortraitShelfViewport(), false, '1280x720 不是竖屏');
  assert.ok(mod.shelfHotZoneWidth() > 0);
  const layout = mod.shelfLayoutProfile();
  assert.ok(layout && layout.detail, 'shelfLayoutProfile 应返回含 detail 的对象');
  assert.equal(typeof layout.detail.openDuration, 'number', 'detail 应带上游的动画时长字段');
  assert.equal(typeof layout.detail.parallax, 'number');
  assert.equal(mod.isShelfClickZone({ clientX: 1279, clientY: 400 }), true);
  assert.equal(mod.isShelfClickZone({ clientX: 40, clientY: 400 }), false);
});

test('原版设置层 shelfDetailSettings/shelfSummonSettings 使用上游默认值', () => {
  const { mod } = loadModule();
  mod.createClassicShelfEngine(makeDeps());
  const detail = mod.detailSettings();
  assert.equal(detail.scale, 1.35, '默认详情页缩放取上游默认 1.35');
  assert.equal(detail.openDuration, 0.6);
  assert.equal(detail.closeDuration, 0.18);
  const summon = mod.summonSettings();
  assert.equal(summon.openDuration, 0.91, '默认唤出时长取上游默认 0.91');
  assert.equal(summon.closeDuration, 0.46);
  assert.equal(summon.slide, 1.9);
  assert.ok(Object.keys(mod.CLASSIC_FX_DEFAULTS).length >= 24, '原版参数默认值应覆盖全部滑条');
});

test('原版设置层尊重 fx 覆盖并夹取范围', () => {
  const { mod } = loadModule();
  mod.createClassicShelfEngine(makeDeps({ fx: { shelfDetailScale: 99, shelfSummonOpenDuration: 0.01 } }));
  assert.equal(mod.detailSettings().scale, 1.35, '超上限应夹到 1.35');
  assert.equal(mod.summonSettings().openDuration, 0.08, '超下限应夹到 0.08');
});

// ---- 真实 THREE：舞台模式建卡与取数 ----

test('舞台模式用宿主 getShelfItems 真建卡，卡数与内容一致', () => {
  const items = playlistItems(['特别喜欢', '我的歌单 A', '全部音乐']);
  const { engine } = makeEngine(makeDeps({ getShelfItems: () => items }));
  engine.setMode('stage');
  const cards = engine.getCards();
  assert.equal(cards.length, items.length, '应为每一项建一张卡');
  assert.equal(cards[0].item.title, '特别喜欢');
  assert.equal(cards[2].item.playlistId, 'local-playlist:2');
  assert.equal(cards[0].mesh.userData.action.kind, 'loadPlaylist');
  assert.equal(cards[0].mesh.userData.action.playlistId, 'local-playlist:0');
  assert.equal(engine.getMode(), 'stage');
  assert.equal(engine.canInteract(), true);
});

test('本地歌单新增/删除经签名在 0.8s 采样后重建卡片', () => {
  let items = playlistItems(['特别喜欢', '歌单 A']);
  const deps = makeDeps({
    getShelfItems: () => items,
    getShelfSignature: list => list.map(i => i.playlistId + '|' + i.title).join('~'),
  });
  const { engine } = makeEngine(deps);
  engine.setMode('stage');
  assert.equal(engine.getCards().length, 2);

  items = playlistItems(['特别喜欢', '歌单 A', '歌单 B']);
  tick(deps, engine, 0.016);                 // 未到 0.8s 采样点
  assert.equal(engine.getCards().length, 2, '未到采样点时不应重建');
  tick(deps, engine, 0.9);                   // 越过采样点
  assert.equal(engine.getCards().length, 3, '新增歌单应重建进卡片');
  assert.equal(engine.getCardAt(2).item.title, '歌单 B');

  items = playlistItems(['特别喜欢', '歌单 B']);
  tick(deps, engine, 1.1);
  assert.equal(engine.getCards().length, 2, '删除歌单应重建');
  assert.equal(engine.getCardAt(1).item.title, '歌单 B');
});

test('无宿主签名时按整份成员字段（含内容签名）识别变化', () => {
  let items = playlistItems(['特别喜欢', '歌单 A']);
  const deps = makeDeps({ getShelfItems: () => items });
  const { engine } = makeEngine(deps);
  engine.setMode('stage');
  assert.equal(engine.getCards().length, 2);
  // 仅成员内容变化（歌单内歌曲变了），title/playlistId 不变也应触发重建。
  items = playlistItems(['特别喜欢', '歌单 A']);
  items[1].contentSignature = 'sig:changed';
  items[1].sub = '9 首';
  tick(deps, engine, 0.9);
  assert.equal(engine.getCardAt(1).item.sub, '9 首', '内容签名变化后应取到新数据');
});

test('队列虚拟数组按 shelfItemAt 懒构造，不整表映射', () => {
  const queue = [
    { name: '歌一', artist: '甲' }, { name: '歌二', artist: '乙' }, { name: '歌三', artist: '丙' },
  ];
  let atCalls = 0;
  const { engine } = makeEngine(makeDeps({
    getShelfItems: () => ({ length: queue.length, queue: queue }),
    shelfItemAt: (items, index) => {
      atCalls += 1;
      const song = items.queue[index];
      if (!song) return null;
      return { type: 'queue', key: song.name, title: song.name, sub: song.artist, cover: '', tag: '#' + (index + 1), queueIndex: index };
    },
    queueItemKey: song => song && song.name,
  }));
  engine.setMode('stage');
  const cards = engine.getCards();
  assert.equal(cards.length, 3);
  assert.equal(cards[1].item.title, '歌二');
  assert.equal(cards[1].item.queueIndex, 1);
  assert.ok(atCalls <= 3, '只为可见窗口内的卡片构造项，实际 ' + atCalls);
});

test('宿主 getShelfItems 返回空数组是权威空，不回退旧队列', () => {
  const { engine } = makeEngine(makeDeps({
    getShelfItems: () => [],
    playQueue: [{ name: '不应出现', artist: 'x' }],
  }));
  engine.setMode('stage');
  assert.equal(engine.getCards().length, 0);
});

// ---- 每帧一次详情更新 / 状态同步 ----

test('详情打开时每帧只 update 一次（无重复调用）', () => {
  const record = { open: false, updates: 0, opens: 0, disposed: 0 };
  const items = playlistItems(['特别喜欢']);
  const { engine } = makeEngine(makeDeps({
    getShelfItems: () => items,
    makeContentListManager: () => makeContentManager(record),
  }));
  engine.setMode('stage');
  engine.openContent(0);
  assert.equal(record.opens, 1, 'openContent 应打开详情');
  assert.equal(engine.hasOpenContent(), true);
  const before = record.updates;
  for (let f = 0; f < 5; f += 1) engine.update(0.016);
  assert.equal(record.updates - before, 5, '每帧恰好一次详情 update');
});

test('状态通过 pushShared 即时回写，并复用同一载荷对象', () => {
  const pushes = [];
  const items = playlistItems(['特别喜欢']);
  const { engine, mod } = makeEngine(makeDeps({
    getShelfItems: () => items,
    pushShared: s => pushes.push(s),
  }));
  engine.setMode('stage');
  engine.openContent(0);
  const pinned = pushes[pushes.length - 1];
  assert.equal(pinned.pinnedOpen, true, '打开详情应即时回写 pinnedOpen');
  assert.equal(typeof pinned.visibility, 'number');
  assert.equal(typeof pinned.openAnimAt, 'number');

  mod.setShelfPinnedOpen(false, true, false);
  const last = pushes[pushes.length - 1];
  assert.equal(last.pinnedOpen, false);
  assert.equal(pushes[0], last, 'pushShared 应复用同一 scratch 载荷对象');
});

test('导出的几何/输入函数边界同步宿主实时状态', () => {
  let live = { pinnedOpen: false, visibility: 0, openAnimAt: -10 };
  const { mod } = loadModule();
  mod.createClassicShelfEngine(makeDeps({ snapshotLive: () => live }));
  assert.equal(mod.shelfAutoHiddenInputReady(), false, '未 pin 未 hover 时不应就绪');
  live = { pinnedOpen: true, visibility: 1, openAnimAt: 3 };
  assert.equal(mod.shelfAutoHiddenInputReady(), true, '宿主 pin 后应立即就绪');
  assert.equal(mod.shelfPreviewIsVisible(), true, '宿主 visibility 变化应被读到');
});

test('exported setShelfPinnedOpen 立即影响导出输入判断', () => {
  const { mod } = loadModule();
  mod.createClassicShelfEngine(makeDeps());
  assert.equal(mod.shelfAutoHiddenInputReady(), false);
  mod.setShelfPinnedOpen(true, true, false);
  assert.equal(mod.shelfAutoHiddenInputReady(), true, 'pin 后输入应立即就绪');
  mod.setShelfPinnedOpen(false, true, false);
  assert.equal(mod.shelfAutoHiddenInputReady(), false);
});

// ---- 多帧动态位姿 ----

test('舞台卡片位姿按多帧更新：中心卡贴舞台中线、随视差旋转', () => {
  const items = playlistItems(['A', 'B', 'C', 'D', 'E']);
  let pointer = { x: 0, y: 0 };
  const { engine, mod } = makeEngine(makeDeps({
    getShelfItems: () => items,
    snapshotLive: () => ({ pointerParallax: pointer }),
    shelfSettings: () => ({ size: 1, x: 0, y: 0, z: 0, angle: 0, opacity: 1, bgOpacity: 0.5, accent: '#ffffff' }),
  }));
  engine.setMode('stage');
  assert.equal(engine.getCenterIdx(), 0);
  engine.update(0.016);
  const layout = mod.shelfLayoutProfile();
  const center = engine.getCardAt(0);
  assert.ok(Math.abs(center.mesh.position.y - layout.stageY) < 1e-6, '中心卡 y 应贴舞台基线');
  assert.ok(Math.abs(center.mesh.position.z - layout.stageZ) < 1e-6, '中心卡 z 应取 stageZ');
  const far = engine.getCardAt(2);
  assert.ok(far.mesh.position.z < center.mesh.position.z, '远端卡应更靠后');

  const rotBefore = center.mesh.rotation.y;
  pointer = { x: 0.8, y: 0 };
  engine.update(0.016);
  const rotAfter = center.mesh.rotation.y;
  assert.notEqual(rotBefore, rotAfter, '视差输入变化应改变卡片旋转');
  assert.ok(Math.abs(rotAfter - 0.8 * 0.050) < 1e-6, '中心卡旋转应等于视差系数');
});

// ---- 停用释放与迟到结果 ----

test('setMode off 立即释放卡片/连线/详情并清状态', () => {
  const log = { adds: [], removes: [] };
  const record = { open: false, updates: 0, opens: 0, disposed: 0 };
  const items = playlistItems(['A', 'B']);
  items[0].cover = 'cover:A';
  let coverCb = null;
  const { engine } = makeEngine(makeDeps({
    scene: makeScene(log),
    getShelfItems: () => items,
    makeContentListManager: () => makeContentManager(record),
    requestPlaylistCover: (url, cb) => { coverCb = cb; },
  }));
  engine.setMode('stage');
  const card = engine.getCardAt(0);
  assert.ok(card, '应有卡');
  const group = log.adds[0];
  engine.openContent(0);
  assert.equal(engine.hasOpenContent(), true);

  const drawsBefore = card.canvas.__ctx.draws;
  engine.setMode('off');

  assert.equal(engine.getMode(), 'off');
  assert.equal(engine.getCards().length, 0, '卡片应释放');
  assert.equal(record.disposed, 1, '详情应被 dispose 释放');
  assert.ok(!engine.hasOpenContent(), '详情应关闭');
  assert.equal(engine.canInteract(), false);
  assert.ok(log.removes.indexOf(group) !== -1, 'group 应从场景移除');

  // 迟到的封面回调用旧卡：必须安静失效，不得再绘制已释放的卡。
  if (coverCb) coverCb();
  assert.equal(card.canvas.__ctx.draws, drawsBefore, '停用后迟到封面回调不得重绘');
});

test('重建替换卡片后，旧卡的迟到封面回调不作用新卡', () => {
  const cbs = [];
  let items = playlistItems(['A', 'B']);
  items[0].cover = 'cover:A';
  items[1].cover = 'cover:B';
  const { engine } = makeEngine(makeDeps({
    getShelfItems: () => items,
    requestPlaylistCover: (url, cb) => cbs.push(cb),
  }));
  engine.setMode('stage');
  const card = engine.getCardAt(0);
  assert.ok(cbs.length >= 1, '建卡时应请求封面');
  const staleCb = cbs[0];

  // 整表替换触发 rebuild：同一窗口内的卡会被 rebind（binding 递增），旧回调随绑定失效。
  items = playlistItems(['B', 'C']);
  items[0].cover = 'cover:B';
  engine.rebuild();
  assert.equal(engine.getCardAt(0).item.title, 'B', '重建后卡应绑定新数据');
  const drawsAfterRebuild = card.canvas.__ctx.draws;
  staleCb();
  assert.equal(card.canvas.__ctx.draws, drawsAfterRebuild, '旧绑定回调不得再重绘');
});

test('重入 createClassicShelfEngine 会停用旧实例，旧入口不再操作新宿主', () => {
  const log = { adds: [], removes: [] };
  const items = playlistItems(['A']);
  const { mod, engine: first } = makeEngine(makeDeps({ scene: makeScene(log), getShelfItems: () => items }));
  first.setMode('stage');
  assert.equal(first.getMode(), 'stage');

  const pushes = [];
  const second = mod.createClassicShelfEngine(makeDeps({
    getShelfItems: () => playlistItems(['X']),
    pushShared: s => pushes.push(s),
  }));
  // 旧实例在重新注入后完全惰性：getter 返回 undefined，也不会把新宿主状态改坏。
  assert.equal(first.getMode(), undefined, '旧实例应惰性化');
  first.setMode('stage');
  second.setMode('stage');
  assert.equal(second.getMode(), 'stage');
  assert.equal(second.getCards().length, 1);
  assert.equal(second.getCardAt(0).item.title, 'X');
  assert.equal(pushes[pushes.length - 1].pinnedOpen, false, '旧实例不应污染新宿主共享状态');
});

// ---- 上游一级卡片运动公式严格等价 ----

function extractStageBranch() {
  const start = SRC.indexOf('// 舞台 PSP: 水平展开 + center 突出, dock 在底部');
  const end = SRC.indexOf('function setCardCenter(');
  assert.ok(start !== -1 && end > start, '应能定位舞台分支');
  return { stage: SRC.slice(start, end), place: SRC.slice(SRC.indexOf('function placeCard('), end) };
}

test('舞台一级卡片运动公式与上游常量严格一致（不含 side 专用 summon 系数）', () => {
  const { stage } = extractStageBranch();
  // 上游 stage 分支字面量逐条锁定。
  assert.match(stage, /delta \* layout\.stageXStep/, '水平步进');
  assert.match(stage, /paneEaseS \* paneSwitchDir \* 0\.80/, '切 pane 位移');
  assert.match(stage, /pzStage -= paneEaseS \* 0\.28/, '切 pane 景深');
  assert.match(stage, /parX \* 0\.110 \* parWeight/, '视差 X');
  assert.match(stage, /parY \* 0\.060 \* parWeight/, '视差 Y');
  assert.match(stage, /\(parY \* 0\.040 - parX \* 0\.035\) \* parWeight/, '视差 Z');
  assert.match(stage, /pulse \* 0\.060/, '律动缩放');
  assert.match(stage, /-delta \* 0\.22 \+ parX \* 0\.050 \* parWeight/, 'Y 旋转');
  assert.match(stage, /0\.10 - absD \* 0\.04 - parY \* 0\.028 \* parWeight/, 'X 旋转');
  assert.match(stage, /absD \* 0\.22/, '远端缩小步进');
  assert.match(stage, /opS \* \(shelfVisibility/, '舞台透明度');
  assert.doesNotMatch(stage, /summon/, '舞台分支不得引入 side 专用 summon 系数');
});

test('side 分支保留上游 summon/揭示/抬升公式', () => {
  const { place } = extractStageBranch();
  assert.match(place, /summon\.stagger/, 'side 揭示错峰');
  assert.match(place, /summon\.slide/, 'side 入场滑动');
  assert.match(place, /summon\.scale/, 'side 入场缩放');
  assert.match(place, /summon\.parallax/, 'side 视差');
  assert.match(place, /revealRaw/, 'side 揭示曲线');
  assert.match(place, /card\.floatMix/, 'side 选中抬升');
});

// ---- 静态分派约束（app.js / index.html） ----
const APP_SOURCE = fs.readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8');
const HTML_SOURCE = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');

test('舞台档用原版引擎、侧栏档用现有引擎（引擎由模式决定）', () => {
  assert.match(APP_SOURCE, /function shelfEngineIsClassic\(\)\s*\{[\s\S]*?shelfModeValue\(\) === 'stage'/, 'classic 引擎应由 stage 模式决定');
  assert.match(APP_SOURCE, /function applyShelfEngineForMode\(mode\)/, '应有按模式换引擎的函数');
  assert.match(APP_SOURCE, /var wantClassic = \(mode === 'stage'\)/, '只有 stage 才用原版引擎');
  assert.match(APP_SOURCE, /function setShelfMode\(m\)\s*\{[\s\S]*?applyShelfEngineForMode\(m\)/, 'setShelfMode 应按模式换引擎');
});

test('独立的实现开关已移除（不再有 fx.shelfEngine / 实现分段）', () => {
  assert.ok(!/normalizeShelfEngine/.test(APP_SOURCE), '不应残留 normalizeShelfEngine');
  assert.ok(!/shelfEngine:/.test(APP_SOURCE), 'fxDefaults 不应有 shelfEngine 开关');
  assert.ok(!/id="shelf-engine-seg"/.test(HTML_SOURCE), '不应有独立的实现分段');
});

test('音量弹层不放歌单架切换，主界面底部有侧栏/舞台按钮', () => {
  assert.ok(!/id="main-shelf-engine-seg"/.test(HTML_SOURCE), '音量弹层不应有歌单架实现切换');
  assert.match(HTML_SOURCE, /id="shelf-view-btn"[^>]*onclick="toggleShelfStageMode\(\)"/, '主界面底部应有侧栏/舞台按钮');
  assert.match(APP_SOURCE, /function toggleShelfStageMode\(\)/);
});

test('原版参数分组只在舞台档显示', () => {
  assert.match(APP_SOURCE, /function updateShelfClassicParamsVisibility\(\)[\s\S]*?shelf-classic-params[\s\S]*?shelfEngineIsClassic\(\)/, '参数组可见性应绑定 classic（即舞台）');
  assert.match(HTML_SOURCE, /id="shelf-classic-params" style="display:none"/, '原版参数组默认隐藏');
});

test('宿主数据契约与模块接口一致（本地歌单 id 原样透传、提供签名与虚拟读取）', () => {
  assert.match(APP_SOURCE, /function shelfClassicSignature\(items\)/, '宿主应提供本地数据签名');
  assert.match(APP_SOURCE, /function shelfClassicItemAt\(items, index\)/, '宿主应提供虚拟项读取');
  assert.match(APP_SOURCE, /playlistId: SPECIAL_LIKED_PLAYLIST_ID/, '特别喜欢应传常量 id');
  assert.match(APP_SOURCE, /playlistId: 'library'/, '全部音乐应传 library');
  assert.match(APP_SOURCE, /getShelfItems: shelfClassicItems, shelfItemAt: shelfClassicItemAt, getShelfSignature: shelfClassicSignature/, '引擎接线应包含取数/虚拟读取/签名');
  assert.match(APP_SOURCE, /snapshotLive: shelfClassicLive, pushShared: shelfClassicPushShared/, '引擎接线应包含双向状态');
  assert.match(APP_SOURCE, /safeShelfCloseContent: safeShelfCloseContent/, '详情关闭回调应直连宿主实现');
});
