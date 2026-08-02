'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

/**
 * 读取主渲染页面源码，供帧级热点契约检查使用。
 * @returns {string} 主渲染页面源码。
 */
function readRendererSource() {
  return fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
}

/**
 * 截取指定标记之间的函数源码，避免把无关页面脚本纳入断言。
 * @param {string} source 主渲染页面源码。
 * @param {string} startMarker 起始标记。
 * @param {string} endMarker 结束标记。
 * @returns {string} 截取到的函数源码。
 */
function readSourceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `未找到源码区段：${startMarker}`);
  return source.slice(start, end);
}

/**
 * 验证歌词光粒循环复用帧级稳定值，避免每个粒子重复读取同一状态。
 * @returns {void}
 */
function testLyricParticleFrameCache() {
  const source = readSourceBetween(
    readRendererSource(),
    'function tickStageLyricMesh(mesh, isCurrent) {',
    '\n\nfunction updateStageLyrics3D(dt) {'
  );
  const loopStart = source.indexOf('for (var si = 0; si < particleCount; si++) {');
  const loopEnd = source.indexOf('\n        }\n        pos.needsUpdate', loopStart);
  assert.ok(loopStart >= 0 && loopEnd > loopStart, '未找到歌词光粒循环');
  const loop = source.slice(loopStart, loopEnd);
  assert.match(source, /var lyricParticlesEnabled = !!fx\.lyricGlowParticles;/);
  assert.match(source, /var particleBeat = lyricParticlesEnabled \? stageLyrics\.beatGlow : 0;/);
  assert.match(source, /var particleDrift = lyricParticlesEnabled \? 1 : 0\.30;/);
  assert.doesNotMatch(loop, /fx\.lyricGlowParticles/);
  assert.doesNotMatch(loop, /arr\.length\s*\/\s*3/);
}

/**
 * 验证歌单架每帧只读取一次内容打开状态和常驻状态。
 * @returns {void}
 */
function testShelfFrameStateCache() {
  const source = readRendererSource();
  const managerSource = readSourceBetween(source, 'function makeShelfManager() {', '\nshelfManager = makeShelfManager();');
  const updateSource = readSourceBetween(managerSource, '    update: function(dt) {', '\n    onCoverChange: function()');
  const placeCardSource = readSourceBetween(managerSource, 'function placeCard(', '\n\n  function setCardCenter');
  assert.match(updateSource, /var contentOpen = !!\(contentList && contentList\.isOpen\(\)\);/);
  assert.match(updateSource, /var alwaysVisible = shelfAlwaysVisible\(\);/);
  assert.equal((updateSource.match(/contentList\.isOpen\(\)/g) || []).length, 1);
  assert.equal((updateSource.match(/shelfAlwaysVisible\(\)/g) || []).length, 1);
  assert.match(placeCardSource, /frameContentOpen, frameAlwaysVisible/);
  assert.match(placeCardSource, /var detailOpenSide = frameContentOpen;/);
  assert.match(placeCardSource, /var passiveAlways = frameAlwaysVisible/);
  assert.match(placeCardSource, /var disabledStage = frameContentOpen;/);
  assert.doesNotMatch(placeCardSource, /contentList\.isOpen\(\)/);
  assert.doesNotMatch(placeCardSource, /shelfAlwaysVisible\(\)/);
  assert.match(updateSource, /placeCard\(cards\[i\], i, cards\.length, mode, frameLayout, frameShelfLook, cardFramePose, contentOpen, alwaysVisible\);/);
}

/**
 * 验证歌单架布局直接复用本帧已经计算的设置，避免每帧重复归一化同一组偏好。
 * @returns {void}
 */
function testShelfFrameSettingsReuse() {
  const source = readRendererSource();
  const managerSource = readSourceBetween(source, 'function makeShelfManager() {', '\nshelfManager = makeShelfManager();');
  const updateSource = readSourceBetween(managerSource, '    update: function(dt) {', '\n    onCoverChange: function()');
  const layoutSource = readSourceBetween(source, 'function shelfLayoutProfile(', '\nfunction shelfHotZoneWidth()');
  assert.match(layoutSource, /function shelfLayoutProfile\(shelfCtl\)/);
  assert.match(layoutSource, /shelfCtl = shelfCtl \|\| shelfSettings\(\);/);
  assert.match(updateSource, /var frameShelfLook = shelfSettings\(\);\s*var frameLayout = shelfLayoutProfile\(frameShelfLook\);/);
  assert.doesNotMatch(updateSource, /var frameLayout = shelfLayoutProfile\(\);\s*var frameShelfLook = shelfSettings\(\);/);
}

/**
 * 验证歌单详情复用管理器已经生成的帧级布局与外观快照，避免每个可见行重复归一化设置。
 * @returns {void}
 */
function testShelfContentFrameSnapshotReuse() {
  const source = readRendererSource();
  const managerSource = readSourceBetween(source, 'function makeShelfManager() {', '\nshelfManager = makeShelfManager();');
  const contentSource = readSourceBetween(source, 'function makeContentListManager() {', '\nfunction compactCount');
  const updateSource = readSourceBetween(contentSource, '    update: function(dt, frameLayout, frameShelfLook) {', '\n    next: function()');
  const placeSource = readSourceBetween(contentSource, '  function place(', '\n\n  function disposeRowList');
  assert.match(managerSource, /contentList\.update\(dt, frameLayout, frameShelfLook\);/);
  assert.match(contentSource, /function detailLayout\(shelfCtl\)/);
  assert.match(updateSource, /var shelfLook = frameShelfLook \|\| shelfSettings\(\);/);
  assert.match(updateSource, /var layout = frameLayout \|\| detailLayout\(shelfLook\);/);
  assert.match(updateSource, /place\(rows\[i\], i, layout, shelfLook\);/);
  assert.match(placeSource, /function place\(row, i, layout, shelfLook\)/);
  assert.doesNotMatch(placeSource, /detailLayout\(\)|shelfSettings\(\)/);
}

/**
 * 验证卡片纹理签名和绘制复用同一帧外观快照，避免可见卡片重复解析颜色与透明度。
 * @returns {void}
 */
function testShelfCardFrameSnapshotReuse() {
  const source = readRendererSource();
  const managerSource = readSourceBetween(source, 'function makeShelfManager() {', '\nshelfManager = makeShelfManager();');
  const signatureSource = readSourceBetween(managerSource, 'function cardDrawSignature(', '\n\n  /**\n   * 绘制歌单架卡片纹理');
  const drawSource = readSourceBetween(managerSource, 'function drawCard(', '\n\n  function buildOneCard');
  const placeSource = readSourceBetween(managerSource, 'function placeCard(', '\n\n  function setCardCenter');
  const updateSource = readSourceBetween(managerSource, '    update: function(dt) {', '\n    onCoverChange: function()');

  assert.match(signatureSource, /function cardDrawSignature\(card, item, frameShelfLook\)/);
  assert.match(signatureSource, /var shelfLook = frameShelfLook \|\| shelfSettings\(\);/);
  assert.match(signatureSource, /shelfLook\.accent \+ '\\|' \+\s*shelfLook\.bgOpacity/);
  assert.match(drawSource, /function drawCard\(card, item, frameShelfLook\)/);
  assert.match(drawSource, /var shelfLook = frameShelfLook \|\| shelfSettings\(\);/);
  assert.match(drawSource, /cardDrawSignature\(card, item, shelfLook\)/);
  assert.doesNotMatch(drawSource, /shelfAccentHex\(\)/);
  assert.match(placeSource, /drawCard\(card, card\.item, shelfLook\);/);
  assert.match(placeSource, /setCardCenter\(card, absD < 0\.5, shelfLook\);/);
  assert.match(updateSource, /drawCard\(c, c\.item, frameShelfLook\);/);
}

/**
 * 验证 Home 刷新把同一轮已计算的本地歌曲池和听歌统计传给卡片渲染，避免重复扫描。
 * @returns {void}
 */
function testHomeRenderSnapshotReuse() {
  const source = readRendererSource();
  const tileSource = readSourceBetween(source, 'function renderHomeTiles(', '\nfunction renderHomeDiscover()');
  const discoverSource = readSourceBetween(source, 'function renderHomeDiscover()', '\nasync function loadHomeDiscover');
  assert.match(tileSource, /function renderHomeTiles\(localPool, summary\)/);
  assert.doesNotMatch(tileSource, /localSearchPool\(\)/);
  assert.doesNotMatch(tileSource, /homeListenSummary\(\)/);
  assert.equal((discoverSource.match(/localSearchPool\(\)/g) || []).length, 1);
  assert.equal((discoverSource.match(/homeListenSummary\(\)/g) || []).length, 1);
  assert.match(discoverSource, /renderHomeTiles\(localSongs, localSummary\);/);
}

test('歌词光粒循环复用帧级状态', testLyricParticleFrameCache);
test('歌单架更新复用帧级可见状态', testShelfFrameStateCache);
test('歌单架布局复用帧级设置快照', testShelfFrameSettingsReuse);
test('歌单详情复用帧级布局与外观快照', testShelfContentFrameSnapshotReuse);
test('歌单卡片绘制复用帧级外观快照', testShelfCardFrameSnapshotReuse);
test('Home 刷新复用本地歌曲池与听歌统计快照', testHomeRenderSnapshotReuse);
