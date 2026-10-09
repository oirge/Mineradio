'use strict';
// Home/视觉引导覆盖层开启时，后方 3D 歌单架不得接受交互（镜头跟随、卡片悬停、滚轮、点击），
// 否则会出现「点击穿透到后方歌单架」。门槛加在 shelf-classic.js 的 canInteract 上，与 canShowShelfHoverCueAt 一致。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const shelfSrc = fs.readFileSync(path.join(__dirname, '..', 'public', 'shelf-classic.js'), 'utf8');

/** @returns {string} canInteract 方法体源码（花括号内）。 */
function extractCanInteractBody() {
  const marker = 'canInteract: function () {';
  const start = shelfSrc.indexOf(marker);
  assert.ok(start >= 0, 'missing canInteract');
  const braceStart = start + marker.length - 1;
  let depth = 0;
  for (let i = braceStart; i < shelfSrc.length; i += 1) {
    if (shelfSrc[i] === '{') depth += 1;
    else if (shelfSrc[i] === '}') { depth -= 1; if (depth === 0) return shelfSrc.slice(braceStart + 1, i); }
  }
  throw new Error('unterminated canInteract');
}

const canInteractBody = extractCanInteractBody();

/**
 * 用真实源码体构造 canInteract，并注入可控的闭包状态。
 * @param {object} state 覆盖的状态字段。
 * @returns {() => boolean} 调用后返回 canInteract 结果。
 */
function makeCanInteract(state) {
  const fn = new Function(
    'mode', 'allItems', 'visualGuideActive', 'emptyHomeActive', 'homeForcedOpen',
    canInteractBody,
  );
  return () => fn(
    state.mode === undefined ? 'side' : state.mode,
    state.allItems === undefined ? [{}, {}] : state.allItems,
    !!state.visualGuideActive, !!state.emptyHomeActive, !!state.homeForcedOpen,
  );
}

test('canInteract 源码带 Home/视觉引导门槛，防止交互穿透到后方歌单架', () => {
  assert.match(
    shelfSrc,
    /canInteract: function \(\) \{[\s\S]{0,260}visualGuideActive \|\| emptyHomeActive \|\| homeForcedOpen[\s\S]{0,40}return false;/,
  );
});

test('有卡片且非 off 可交互；Home/视觉引导/强制 Home 打开时一律不可交互', () => {
  assert.equal(makeCanInteract({})(), true, '正常侧栏有卡片 → 可交互');
  assert.equal(makeCanInteract({ emptyHomeActive: true })(), false, 'Home 覆盖层开启 → 不可交互');
  assert.equal(makeCanInteract({ visualGuideActive: true })(), false, '视觉引导态 → 不可交互');
  assert.equal(makeCanInteract({ homeForcedOpen: true })(), false, '强制 Home 打开 → 不可交互');
  assert.equal(makeCanInteract({ mode: 'off' })(), false, 'off 模式 → 不可交互');
  assert.equal(makeCanInteract({ allItems: [] })(), false, '无卡片 → 不可交互');
});
