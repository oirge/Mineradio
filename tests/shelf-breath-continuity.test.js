'use strict';
// D2 顺滑过渡：3D 歌单架「悬停预览 → 点击可用」时，悬停呼吸/浮动强度缓动淡出，不再瞬间归零，
// 消除手感跳变。此处锁定接线（不改为硬布尔切换），具体手感在桌面版确认。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const shelfSrc = fs.readFileSync(path.join(__dirname, '..', 'public', 'shelf-classic.js'), 'utf8');

test('悬停呼吸强度走缓动系数而非布尔瞬停', () => {
  assert.match(shelfSrc, /var hoverBreath = shelfVisibility \* shelfBreathLevel;/, 'hoverBreath 由缓动的 shelfBreathLevel 调制');
  assert.doesNotMatch(shelfSrc, /hoverBreath = \(!shelfPinnedOpen && !detailOpenSide\) \? shelfVisibility : 0;/, '旧的布尔硬切应已移除');
});

test('钉开/详情打开时呼吸强度缓动淡出（而非瞬间归零）', () => {
  assert.match(shelfSrc, /shelfBreathTarget = \(shelfPinnedOpen \|\| \(contentList && contentList\.isOpen\(\)\)\) \? 0 : 1;/);
  assert.match(shelfSrc, /shelfBreathLevel \+= \(shelfBreathTarget - shelfBreathLevel\) \* durationEaseFactor\(/);
});
