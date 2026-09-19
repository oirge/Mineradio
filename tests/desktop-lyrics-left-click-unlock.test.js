'use strict';
// 桌面歌词「左键单击命中热区 → 解锁并唤出控制栏」：
// 主进程全局左键轮询命中判定（仅解锁、热区门控、去抖），以及 renderer 收到解锁跳变后立即弹控制栏。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const mainJs = fs.readFileSync(path.join(ROOT, 'desktop', 'main.js'), 'utf8');
const desktopLyricsHtml = fs.readFileSync(path.join(ROOT, 'public', 'desktop-lyrics.html'), 'utf8');

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

/**
 * 在隔离 VM 里跑真实的 handleDesktopLyricsGlobalLeftClick，用可控依赖桩记录副作用。
 * @param {object} opts 场景开关：是否启用、当前是否锁定、光标是否命中热区、上次左键时间。
 * @returns {{applied: object[], mouseBehaviorCalls: number, broadcasts: number, pointerCapture: boolean, lastLeftAt: number}} 观察到的副作用。
 */
function runLeftClick(opts) {
  const o = opts || {};
  const applied = [];
  const context = {
    desktopLyricsWindow: { isDestroyed: () => false },
    desktopLyricsStateCache: {
      enabled: o.enabled !== false,
      value: { clickThrough: o.locked === false ? false : true },
      apply(patch) { applied.push(patch); Object.assign(this.value, patch); },
    },
    desktopLyricsPointerCapture: false,
    desktopLyricsLastLeftAt: o.lastLeftAt || 0,
    Date: { now: () => (o.now != null ? o.now : 100000) },
    screen: { getCursorScreenPoint: () => ({ x: 10, y: 10 }) },
    desktopLyricsHotBoundsOnScreen: () => (o.hasBounds === false ? null : { x: 0, y: 0, width: 100, height: 100 }),
    pointInBounds: (pt, b) => (o.inside === false ? false : !!(pt && b)),
    applyDesktopLyricsMouseBehavior() { context.__mouseBehaviorCalls += 1; },
    broadcastDesktopLyricsLockState() { context.__broadcasts += 1; },
    __mouseBehaviorCalls: 0,
    __broadcasts: 0,
  };
  vm.runInNewContext(
    readFunctionFrom(mainJs, 'handleDesktopLyricsGlobalLeftClick')
      + '\nthis.run = handleDesktopLyricsGlobalLeftClick;'
      + '\nthis.run();'
      + '\nthis.__pointerCapture = desktopLyricsPointerCapture;'
      + '\nthis.__lastLeftAt = desktopLyricsLastLeftAt;',
    context,
  );
  return {
    applied,
    mouseBehaviorCalls: context.__mouseBehaviorCalls,
    broadcasts: context.__broadcasts,
    pointerCapture: context.__pointerCapture,
    lastLeftAt: context.__lastLeftAt,
  };
}

test('锁定+命中热区：左键解锁（clickThrough=false）并抓指针、刷新鼠标行为、广播', () => {
  const r = runLeftClick({ locked: true, inside: true });
  assert.equal(r.applied.length, 1);
  assert.equal(r.applied[0].clickThrough, false);
  assert.equal(r.pointerCapture, true);
  assert.equal(r.mouseBehaviorCalls, 1);
  assert.equal(r.broadcasts, 1);
  assert.equal(r.lastLeftAt, 100000);
});

test('已解锁：左键不介入（归 renderer 处理拖动/按钮，不再切换）', () => {
  const r = runLeftClick({ locked: false, inside: true });
  assert.equal(r.applied.length, 0);
  assert.equal(r.mouseBehaviorCalls, 0);
  assert.equal(r.broadcasts, 0);
});

test('热区外：左键放行，不解锁（不影响正常使用电脑）', () => {
  const r = runLeftClick({ locked: true, inside: false });
  assert.equal(r.applied.length, 0);
  assert.equal(r.broadcasts, 0);
});

test('无热区（歌词未定位）：左键不解锁', () => {
  const r = runLeftClick({ locked: true, hasBounds: false });
  assert.equal(r.applied.length, 0);
});

test('桌面歌词未启用：左键不解锁', () => {
  const r = runLeftClick({ enabled: false, locked: true, inside: true });
  assert.equal(r.applied.length, 0);
});

test('260ms 去抖：距上次左键过近直接忽略', () => {
  const r = runLeftClick({ locked: true, inside: true, now: 100100, lastLeftAt: 100000 });
  assert.equal(r.applied.length, 0);
  assert.equal(r.broadcasts, 0);
});

test('轮询消费把 LMB 路由到左键处理、MMB 路由到中键处理', () => {
  const consumer = readFunctionFrom(mainJs, 'consumeDesktopLyricsMousePollerOutput');
  assert.match(consumer, /=== 'LMB'/);
  assert.match(consumer, /handleDesktopLyricsGlobalLeftClick\(\)/);
  assert.match(consumer, /=== 'MMB'/);
  assert.match(consumer, /handleDesktopLyricsGlobalMiddleClick\(\)/);
});

test('PowerShell 轮询同时监听左键(VK 1)与中键(VK 4)，各自 down 沿去重发信', () => {
  const starter = readFunctionFrom(mainJs, 'startDesktopLyricsMousePoller');
  assert.match(starter, /GetAsyncKeyState\(1\)/);
  assert.match(starter, /GetAsyncKeyState\(4\)/);
  assert.match(starter, /WriteLine\("LMB"\)/);
  assert.match(starter, /WriteLine\("MMB"\)/);
  // 左右两键各自独立的上一帧状态，避免相互吞沿
  assert.match(starter, /\$prevLeft/);
  assert.match(starter, /\$prevMid/);
});

test('renderer：从锁定跳到解锁时立即唤出控制栏（无需等 1.5s 悬停）', () => {
  const applyState = readFunctionFrom(desktopLyricsHtml, 'applyState');
  assert.match(applyState, /var wasLockedBeforeApply = isLocked\(\);/);
  assert.match(applyState, /if \(state\.enabled && wasLockedBeforeApply && !isLocked\(\)\) \{\s*setHintVisible\(true\);/);
});
