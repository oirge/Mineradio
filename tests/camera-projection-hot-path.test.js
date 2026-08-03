'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/**
 * 读取主渲染页面中相机投影缓存实现，供纯 Node 回归测试使用。
 * @returns {string} 相机投影缓存源码。
 */
function readProjectionSource() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  const start = source.indexOf('var cameraProjectionSyncState = {');
  const end = source.indexOf('function applyFreeCameraToCamera() {', start);
  assert.ok(start >= 0 && end > start, '未找到相机投影缓存实现');
  return source.slice(start, end);
}

/**
 * 验证相机投影参数未变化时不会重复调用昂贵的矩阵重建。
 * @returns {void}
 */
function testProjectionMatrixReuse() {
  const calls = [];
  const context = {
    camera: {
      fov: 45,
      aspect: 1.6,
      near: 0.1,
      far: 100,
      zoom: 1,
      filmGauge: 35,
      filmOffset: 0,
      updateProjectionMatrix() { calls.push('update'); }
    },
    NaN
  };
  vm.runInNewContext(`${readProjectionSource()}\nthis.updateCameraProjectionIfNeeded(false);`, context);
  assert.equal(calls.length, 1, '首次同步必须建立投影矩阵');
  vm.runInNewContext('this.updateCameraProjectionIfNeeded(false);', context);
  assert.equal(calls.length, 1, '投影参数不变时不得重复建立矩阵');
  vm.runInNewContext('camera.fov = 45.0004; this.updateCameraProjectionIfNeeded(false);', context);
  assert.equal(calls.length, 1, '低于阈值的微小 fov 漂移不得重复建立矩阵');
  vm.runInNewContext('camera.fov = 45.2; this.updateCameraProjectionIfNeeded(false);', context);
  assert.equal(calls.length, 2, '超过阈值的 fov 变化必须刷新投影矩阵');
  vm.runInNewContext('camera.aspect = 1.8; this.updateCameraProjectionIfNeeded(false);', context);
  assert.equal(calls.length, 3, 'aspect 变化必须刷新投影矩阵');
  vm.runInNewContext('this.updateCameraProjectionIfNeeded(true);', context);
  assert.equal(calls.length, 4, '强制同步必须刷新投影矩阵');
}

test('相机投影矩阵复用稳定帧缓存', testProjectionMatrixReuse);
