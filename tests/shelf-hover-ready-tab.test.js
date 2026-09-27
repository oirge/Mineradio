'use strict';
// 侧栏 3D 歌单架交互：自动隐藏靠边悬停淡入唤出（不拽镜头）、右键底部按钮出歌单架专用控制浮层。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');

function readFunctionFrom(contents, name) {
  const start = contents.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `missing ${name}`);
  const braceStart = contents.indexOf('{', start);
  let depth = 0;
  for (let i = braceStart; i < contents.length; i += 1) {
    if (contents[i] === '{') depth += 1;
    if (contents[i] === '}') {
      depth -= 1;
      if (depth === 0) return contents.slice(start, i + 1);
    }
  }
  throw new Error(`unterminated ${name}`);
}

test('歌单架快捷浮层借用 #fx-stage-fold 原节点并可还原（不复制、不产生重复 id）', () => {
  const open = readFunctionFrom(appSource, 'openShelfQuickPanel');
  const close = readFunctionFrom(appSource, 'closeShelfQuickPanel');
  assert.match(open, /getElementById\('fx-stage-fold'\)/);
  assert.match(open, /shelfFoldOrigParent = fold\.parentNode;/);
  assert.match(open, /appendChild\(fold\)/);
  assert.doesNotMatch(open, /cloneNode/);
  assert.match(close, /insertBefore\(fold, shelfFoldOrigNext\)/);
  assert.match(close, /shelfFoldOrigParent\.appendChild\(fold\)/);
});

test('浮层不依赖 DIY 玩家模式：openShelfQuickPanel 不触碰 diyPlayerMode/toggleFxPanel', () => {
  const open = readFunctionFrom(appSource, 'openShelfQuickPanel');
  assert.doesNotMatch(open, /diyPlayerMode/);
  assert.doesNotMatch(open, /toggleFxPanel/);
});

test('右键底部「3D 歌单架」按钮切换歌单架快捷浮层（左键仍切侧栏/舞台）', () => {
  assert.match(appSource, /shelfViewBtn\.addEventListener\('contextmenu', function\(ev\)\{[\s\S]*?ev\.preventDefault\(\);[\s\S]*?toggleShelfQuickPanel\(shelfViewBtn\);/);
});

test('打开视觉控制台前先归还借走的歌单架分组', () => {
  const fn = readFunctionFrom(appSource, 'toggleFxPanel');
  assert.match(fn, /shelfQuickPanelOpen\)\s*closeShelfQuickPanel\(\);/);
});

test('主场景右键仍是原有「钉开/收起歌单架」行为（未被改动）', () => {
  const start = appSource.indexOf("renderer.domElement.addEventListener('contextmenu', function(e){");
  const end = appSource.indexOf('// 滚轮', start);
  assert.ok(start >= 0 && end > start, 'missing scene contextmenu handler');
  const handler = appSource.slice(start, end);
  assert.match(handler, /setShelfPinnedOpen\(!shelfPinnedOpen, true\);/);
});

test('已移除「点击打开歌单」就绪提示牌：不再有 tab DOM 与 shelfReadyToClick', () => {
  assert.doesNotMatch(appSource, /shelf-hover-tab/);
  assert.doesNotMatch(appSource, /function setShelfHoverTabVisible\(/);
  assert.doesNotMatch(appSource, /function shelfReadyToClick\(/);
  assert.doesNotMatch(appSource, /点击打开歌单/);
});

test('自动隐藏侧栏靠边悬停可唤出：canShowShelfHoverCueAt 不再要求视觉引导态', () => {
  const fn = readFunctionFrom(appSource, 'canShowShelfHoverCueAt');
  assert.doesNotMatch(fn, /if \(!shelfHoverCue\.guide\) return false;/);
  // 仍保留右侧热区/预览区判定作为唤出条件。
  assert.match(fn, /isShelfClickZone\(e\)/);
});

function runFollow(opts) {
  const o = opts || {};
  const context = {
    shelfManager: {
      getMode: () => (o.mode === undefined ? 'side' : o.mode),
      hasOpenContent: () => !!o.contentOpen,
    },
    shelfPinnedOpen: !!o.pinned,
    shelfAlwaysVisible: () => !!o.alwaysVisible,
    isPointerOverUi: () => !!o.overUi,
    shelfPreviewIsVisible: () => o.previewVisible !== false,
    pointerCardHit: () => (o.cardHit ? { card: { index: 0 } } : null),
    raycasterFromPointerEvent: () => ({}),
    e: o.noEvent ? null : { clientX: 10, clientY: 10 },
  };
  vm.runInNewContext(
    `${readFunctionFrom(appSource, 'shelfSideWantsCameraFollow')}\nthis.result = shelfSideWantsCameraFollow(e);`,
    context,
  );
  return context.result;
}

test('镜头跟随只在真正命中卡片时触发：自动隐藏靠边淡入不拽镜头', () => {
  assert.equal(runFollow({ cardHit: false }), false);      // 靠边淡入、未命中卡片 → 不跟随
  assert.equal(runFollow({ cardHit: true }), true);         // 命中卡片 → 跟随
  assert.equal(runFollow({ pinned: true, cardHit: false }), true);   // 固定展开 → 跟随
  assert.equal(runFollow({ contentOpen: true, cardHit: false }), true); // 详情页 → 跟随
  assert.equal(runFollow({ overUi: true, cardHit: true }), false);   // 指针在 UI 上 → 不跟随
  assert.equal(runFollow({ mode: 'stage', cardHit: true }), false);  // 非 side → 不由此判定
});

test('mousemove 用 shelfSideWantsCameraFollow 决定歌单架镜头跟随（两条分支）', () => {
  const wired = appSource.match(/shelfSideWantsCameraFollow\(e\)/g) || [];
  assert.ok(wired.length >= 2, '沉浸与常规两条分支都应改用命中判定驱动镜头跟随');
});
