'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');

/**
 * 读取涟漪触发实现，验证九宫格去重不创建短命对象。
 * @returns {string} 涟漪触发源码。
 */
function readRippleSource() {
  const start = appSource.indexOf('function updateRipples(dt) {');
  const end = appSource.indexOf('// ============================================================\n//  封面 + 边缘', start);
  assert.ok(start >= 0 && end > start, '未找到涟漪更新实现');
  return appSource.slice(start, end);
}

test('涟漪九宫格去重使用位掩码而不是临时对象', () => {
  const source = readRippleSource();
  assert.match(source, /var usedMask = 0;/);
  assert.match(source, /usedMask & \(1 << idx\)/);
  assert.match(source, /usedMask \|= 1 << idx;/);
  assert.doesNotMatch(source, /var used = \{\};/);
});
