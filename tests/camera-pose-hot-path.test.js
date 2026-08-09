'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');

/**
 * 读取相机姿态缓存实现，验证稳定帧不会重复提交相同的观察姿态。
 * @returns {string} 相机姿态缓存源码。
 */
function readCameraPoseSource() {
  const start = appSource.indexOf('var cameraPoseSyncState = {');
  const end = appSource.indexOf('function applyFreeCameraToCamera()', start);
  assert.ok(start >= 0 && end > start, '未找到相机姿态缓存实现');
  return appSource.slice(start, end);
}

/**
 * 读取歌单架 hover 调度实现，验证每帧复用固定指针对象。
 * @returns {string} hover 调度源码。
 */
function readShelfHoverSource() {
  const start = appSource.indexOf('var shelfHoverCue = {');
  const end = appSource.indexOf('function setShelfPinnedOpen', start);
  assert.ok(start >= 0 && end > start, '未找到歌单架 hover 调度实现');
  return appSource.slice(start, end);
}

test('稳定相机姿态跳过重复提交，并支持阈值变化和显式失效', () => {
  const context = { NaN };
  vm.runInNewContext(`${readCameraPoseSource()}
    this.refresh = cameraPoseNeedsRefresh;
    this.invalidate = invalidateCameraPoseSyncState;`, context);

  assert.equal(context.refresh(1, 2, 3, 4, 5, 6, 0.1), true);
  assert.equal(context.refresh(1, 2, 3, 4, 5, 6, 0.1), false);
  assert.equal(context.refresh(1.00001, 2, 3, 4, 5, 6, 0.1), false);
  assert.equal(context.refresh(1.0002, 2, 3, 4, 5, 6, 0.1), true);
  assert.equal(context.refresh(1.0002, 2, 3, 4, 5, 6, 0.1002), true);
  context.invalidate();
  assert.equal(context.refresh(1.0002, 2, 3, 4, 5, 6, 0.1002), true);
});

test('相机更新使用姿态缓存，hover 更新不创建临时指针对象', () => {
  const updateStart = appSource.indexOf('function updateCamera() {');
  const updateEnd = appSource.indexOf('// 焦点跟拍', updateStart);
  assert.ok(updateStart >= 0 && updateEnd > updateStart, '未找到相机更新函数');
  const updateSource = appSource.slice(updateStart, updateEnd);
  assert.match(updateSource, /cameraPoseNeedsRefresh\(/);
  assert.match(updateSource, /if \(cameraPoseNeedsRefresh\([\s\S]*camera\.lookAt\(orbit\.lookAt\)/);

  const hoverSource = readShelfHoverSource();
  assert.match(hoverSource, /var shelfHoverPointerScratch = \{ clientX: 0, clientY: 0 \};/);
  assert.match(hoverSource, /shelfHoverPointerScratch\.clientX = shelfHoverCue\.x;/);
  assert.match(hoverSource, /canShowShelfHoverCueAt\(shelfHoverPointerScratch\)/);
  assert.doesNotMatch(hoverSource, /var heldPointer = \{ clientX: shelfHoverCue\.x, clientY: shelfHoverCue\.y \};/);
});
