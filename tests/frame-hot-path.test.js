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
  return fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
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
    '\nfunction updateStageLyrics3D(dt, frameShelfState) {'
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
  const updateSource = readSourceBetween(managerSource, '    update: function(dt, frameNow, frameShelfState) {', '\n    onCoverChange: function()');
  const placeCardSource = readSourceBetween(managerSource, 'function placeCard(', '\n\n  function setCardCenter');
  assert.match(updateSource, /var contentOpen = frameShelfState \? frameShelfState\.contentOpen : !!\(contentList && contentList\.isOpen\(\)\);/);
  assert.match(updateSource, /var alwaysVisible = frameShelfState \? frameShelfState\.alwaysVisible : shelfAlwaysVisible\(\);/);
  assert.match(updateSource, /var cueVis = appRevealed \? tickShelfHoverCue\(dt, frameNow\) : 0;/);
  assert.match(updateSource, /if \(!appRevealed \|\| \(!group\.visible && targetVis === 0\)\) return;/);
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
 * 验证主循环把已取得的时间戳传给需要时间节流的子系统，避免同一帧重复调用 performance.now()。
 * @returns {void}
 */
function testFrameTimestampForwarding() {
  const source = readRendererSource();
  const animateSource = readSourceBetween(source, 'function animate() {', "\nresumeMainRenderLoop('startup');");
  const hoverSource = readSourceBetween(source, 'function tickShelfHoverCue(', '\nfunction setShelfPinnedOpen');
  const homeWaveSource = readSourceBetween(source, 'function updateHomeAudioVisual(', '\nfunction setRange(');
  assert.match(animateSource, /var frameShelfState = refreshShelfRenderFrameState\(\);/);
  assert.match(animateSource, /shelfManager\.update\(dt, now, frameShelfState\);/);
  assert.match(animateSource, /var shelfDimTarget = shouldDimWallpaperForShelf\(frameShelfState\) \? 0\.48 : skullBackdropDim;/);
  assert.match(animateSource, /applySkullCameraPose\(dt, frameShelfState\);/);
  assert.match(animateSource, /updateSkullParticleLayer\(dt, frameShelfState\);/);
  assert.match(animateSource, /updateStageLyrics3D\(dt, frameShelfState\);/);
  assert.match(animateSource, /updateHomeAudioVisual\(dt, now\);/);
  assert.match(animateSource, /updateFreeCamera\(dt, now\);/);
  assert.match(animateSource, /tickGestureRotation\(dt, now\);/);
  assert.match(hoverSource, /function tickShelfHoverCue\(dt, frameNow\)/);
  assert.match(hoverSource, /var now = frameNow == null \? performance\.now\(\) : frameNow;/);
  assert.match(homeWaveSource, /function updateHomeAudioVisual\(dt, frameNow\)/);
  assert.match(homeWaveSource, /var nowMs = frameNow == null \? performance\.now\(\) : frameNow;/);
  assert.doesNotMatch(homeWaveSource, /uniforms && uniforms\.uTime \? uniforms\.uTime\.value : performance\.now\(\) \/ 1000/);
  const freeCameraSource = readSourceBetween(source, 'function updateFreeCamera(dt, frameNow) {', '\nfunction flushPersistentVisualState');
  const gestureSource = readSourceBetween(source, 'function tickGestureRotation(dt, frameNow) {', '\nfunction showGestureHUD');
  assert.match(freeCameraSource, /var now = frameNow == null \? performance\.now\(\) : frameNow;/);
  assert.match(gestureSource, /var now = frameNow == null \? performance\.now\(\) : frameNow;/);
  assert.doesNotMatch(freeCameraSource, /performance\.now\(\) - tw\.start/);
  assert.doesNotMatch(gestureSource, /performance\.now\(\) - handLmLastSeen/);
}

/**
 * 验证主渲染帧只读取一次歌单 getter，并让 Skull、歌词和歌单架消费同一份快照。
 * @returns {void}
 */
function testShelfRenderFrameSnapshotGetterReuse() {
  const source = readRendererSource();
  const snapshotSource = readSourceBetween(source, 'function refreshShelfRenderFrameState() {', '\nfunction isPortraitShelfViewport');
  const animateSource = readSourceBetween(source, 'function animate() {', "\nresumeMainRenderLoop('startup');");
  const managerSource = readSourceBetween(source, 'function makeShelfManager() {', '\nshelfManager = makeShelfManager();');
  const managerUpdateSource = readSourceBetween(managerSource, '    update: function(dt, frameNow, frameShelfState) {', '\n    onCoverChange: function()');
  const skullCameraSource = readSourceBetween(source, 'function applySkullCameraPose(dt, frameShelfState) {', '\nfunction updateSkullParticleLayer');
  const skullParticleSource = readSourceBetween(source, 'function updateSkullParticleLayer(dt, frameShelfState) {', '\nvar BACK_COVER_COUNT = 3000;');
  const stageSource = readSourceBetween(source, 'function updateStageLyrics3D(dt, frameShelfState) {', '\nvar lyricWordProgressCursor =');

  assert.equal((snapshotSource.match(/manager\.getMode\(\)/g) || []).length, 1);
  assert.equal((snapshotSource.match(/manager\.hasOpenContent\(\)/g) || []).length, 1);
  assert.equal((snapshotSource.match(/shelfAlwaysVisible\(\)/g) || []).length, 1);
  assert.doesNotMatch(animateSource, /shelfManager\.getMode\(\)|shelfManager\.hasOpenContent\(\)|shelfAlwaysVisible\(\)/);
  assert.doesNotMatch(managerUpdateSource, /shelfManager\.getMode\(\)|shelfManager\.hasOpenContent\(\)/);
  assert.doesNotMatch(skullCameraSource, /shelfManager\.getMode\(\)|shelfManager\.hasOpenContent\(\)|shelfAlwaysVisible\(\)/);
  assert.doesNotMatch(skullParticleSource, /shelfManager\.getMode\(\)|shelfManager\.hasOpenContent\(\)|shelfAlwaysVisible\(\)/);
  assert.doesNotMatch(stageSource, /shelfManager\.getMode\(\)|shelfManager\.hasOpenContent\(\)|shelfAlwaysVisible\(\)/);
}

/**
 * 验证舞台歌词在同一帧只读取一次歌单状态，避免重复调用闭包 getter。
 * @returns {void}
 */
function testStageLyricsShelfStateReuse() {
  const source = readRendererSource();
  const stageSource = readSourceBetween(source, 'function updateStageLyrics3D(dt, frameShelfState) {', '\nvar lyricWordProgressCursor =');
  assert.match(stageSource, /frameShelfState = frameShelfState \|\| refreshShelfRenderFrameState\(\);/);
  assert.match(stageSource, /var shelfMode = frameShelfState\.mode;/);
  assert.match(stageSource, /var shelfDetailOpen = frameShelfState\.contentOpen;/);
  assert.match(stageSource, /var shelfAlwaysOn = frameShelfState\.alwaysVisible;/);
  assert.doesNotMatch(stageSource, /shelfManager\.getMode\(\)|shelfManager\.hasOpenContent\(\)|shelfAlwaysVisible\(\)/);
  assert.doesNotMatch(stageSource, /shouldAvoidStageLyricsForShelf\(\)|shouldDimWallpaperForShelf\(\)|shouldOffsetLyricsForShelfDetail\(\)/);
}

/**
 * 验证歌单架布局直接复用本帧已经计算的设置，避免每帧重复归一化同一组偏好。
 * @returns {void}
 */
function testShelfFrameSettingsReuse() {
  const source = readRendererSource();
  const managerSource = readSourceBetween(source, 'function makeShelfManager() {', '\nshelfManager = makeShelfManager();');
  const updateSource = readSourceBetween(managerSource, '    update: function(dt, frameNow, frameShelfState) {', '\n    onCoverChange: function()');
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
  const panelSource = readSourceBetween(contentSource, '  function drawPanel(', '\n\n  function disposePanelObject');
  const rowSource = readSourceBetween(contentSource, '  function drawRow(', '\n\n  /**\n   * 仅在详情行位置目标');
  const syncSource = readSourceBetween(contentSource, '  function syncRenderedRows(', '\n\n  return {');
  const placeSource = readSourceBetween(contentSource, '  function place(', '\n\n  function disposeRowList');
  assert.match(managerSource, /contentList\.update\(dt, frameLayout, frameShelfLook\);/);
  assert.match(contentSource, /function detailLayout\(shelfCtl\)/);
  assert.match(updateSource, /var shelfLook = frameShelfLook \|\| shelfSettings\(\);/);
  assert.match(updateSource, /var layout = frameLayout \|\| detailLayout\(shelfLook\);/);
  assert.match(updateSource, /place\(rows\[i\], i, layout, shelfLook\);/);
  assert.match(placeSource, /function place\(row, i, layout, shelfLook\)/);
  assert.doesNotMatch(placeSource, /detailLayout\(\)|shelfSettings\(\)/);
  assert.match(panelSource, /function drawPanel\(frameShelfLook\)/);
  assert.match(panelSource, /var shelfLook = frameShelfLook \|\| shelfSettings\(\);/);
  assert.match(rowSource, /function drawRow\(row, song, isCenter, frameShelfLook\)/);
  assert.match(rowSource, /var shelfLook = frameShelfLook \|\| shelfSettings\(\);/);
  assert.match(rowSource, /shelfLook\.accent/);
  assert.match(syncSource, /function syncRenderedRows\(force, frameShelfLook\)/);
  assert.match(syncSource, /var shelfLook = frameShelfLook \|\| shelfSettings\(\);/);
  assert.match(syncSource, /drawPanelIfNeeded\(force \|\| refreshLoading, nowT, shelfLook\);/);
  assert.match(syncSource, /drawRow\(row, row\.song, isCenter, shelfLook\);/);
  assert.match(updateSource, /syncRenderedRows\(false, shelfLook\);/);
  assert.match(updateSource, /drawRow\(rows\[i\], rows\[i\]\.song, isC, shelfLook\);/);
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
  const updateSource = readSourceBetween(managerSource, '    update: function(dt, frameNow, frameShelfState) {', '\n    onCoverChange: function()');

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
 * 验证歌单架卡片稳定属性只在目标值变化时写入，避免每帧触发 Three.js 对象更新。
 * @returns {void}
 */
function testShelfCardPropertyWriteCache() {
  const source = readRendererSource();
  const managerSource = readSourceBetween(source, 'function makeShelfManager() {', '\nshelfManager = makeShelfManager();');
  const placeCardSource = readSourceBetween(managerSource, 'function placeCard(', '\n\n  function setCardCenter');

  assert.match(managerSource, /function setShelfCardPosition\(card, x, y, z\)/);
  assert.match(managerSource, /function setShelfCardScale\(card, scale\)/);
  assert.match(managerSource, /function setShelfCardOpacity\(card, opacity\)/);
  assert.match(managerSource, /function setShelfCardColor\(card, tone\)/);
  assert.match(managerSource, /function setShelfCardRotation\(card, x, y, z\)/);
  assert.match(managerSource, /var nextZ = z == null \? card\.mesh\.rotation\.z : z;/);
  assert.match(managerSource, /function setShelfCardCameraPose\(card, quaternion, rx, ry\)/);
  assert.doesNotMatch(placeCardSource, /card\.mesh\.position\.set\(/);
  assert.doesNotMatch(placeCardSource, /card\.mesh\.scale\.setScalar\(/);
  assert.doesNotMatch(placeCardSource, /card\.mesh\.material\.opacity\s*=/);
  assert.doesNotMatch(placeCardSource, /card\.mesh\.material\.color\.setScalar\(/);
  assert.doesNotMatch(placeCardSource, /card\.mesh\.rotation\.[xyz]\s*=/);
}

/**
 * 验证歌单详情行稳定属性只在目标值变化时写入，避免每帧重复触发 Three.js 对象更新。
 * @returns {void}
 */
function testShelfContentRowPropertyWriteCache() {
  const source = readRendererSource();
  const contentSource = readSourceBetween(source, 'function makeContentListManager() {', '\nfunction compactCount');
  const placeSource = readSourceBetween(contentSource, '  function place(', '\n\n  function disposeRowList');

  assert.match(contentSource, /function setContentRowPosition\(row, x, y, z\)/);
  assert.match(contentSource, /function setContentRowScale\(row, scale\)/);
  assert.match(contentSource, /function setContentRowOpacity\(row, opacity\)/);
  assert.match(contentSource, /function setContentRowVisibility\(row, visible\)/);
  assert.match(contentSource, /function setContentRowRenderOrder\(row, renderOrder\)/);
  assert.match(contentSource, /function setContentRowRotation\(row, x, y\)/);
  assert.doesNotMatch(placeSource, /row\.mesh\.position\.set\(/);
  assert.doesNotMatch(placeSource, /row\.mesh\.scale\.setScalar\(/);
  assert.doesNotMatch(placeSource, /row\.mesh\.material\.opacity\s*=/);
  assert.doesNotMatch(placeSource, /row\.mesh\.visible\s*=/);
  assert.doesNotMatch(placeSource, /row\.mesh\.renderOrder\s*=/);
  assert.doesNotMatch(placeSource, /row\.mesh\.rotation\.[xy]\s*=/);
}

/**
 * 验证歌单详情组和面板的稳定属性只在目标值变化时写入，减少持续渲染期间的状态更新。
 * @returns {void}
 */
function testShelfContentGroupPropertyWriteCache() {
  const source = readRendererSource();
  const contentSource = readSourceBetween(source, 'function makeContentListManager() {', '\nfunction compactCount');
  const updateSource = readSourceBetween(contentSource, '    update: function(dt, frameLayout, frameShelfLook) {', '\n    next: function()');

  assert.match(contentSource, /function setContentGroupPosition\(x, y, z\)/);
  assert.match(contentSource, /function setContentGroupScale\(scale\)/);
  assert.match(contentSource, /function setContentGroupRotation\(x, y, z\)/);
  assert.match(contentSource, /function setContentPanelOpacity\(targetPanel, opacity\)/);
  assert.doesNotMatch(updateSource, /group\.position\.set\(/);
  assert.doesNotMatch(updateSource, /group\.scale\.setScalar\(/);
  assert.doesNotMatch(updateSource, /group\.rotation\.[xyz]\s*\+=/);
  assert.doesNotMatch(updateSource, /panel\.mesh\.material\.opacity\s*=/);
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

/**
 * 验证歌词特效关闭且没有残留网格时不重复进入清理路径。
 * @returns {void}
 */
function testLyricsParticleIdleShortCircuit() {
  const source = readRendererSource();
  const tickSource = readSourceBetween(source, 'function tickLyricsParticles() {', '\n\nfunction disposeLyricsParticles()');
  assert.match(tickSource, /if \(!fx\.particleLyrics\) \{\s*if \(!stageLyrics\.current && !stageLyrics\.currentText && \(!stageLyrics\.outgoing \|\| !stageLyrics\.outgoing\.length\)\) return;/);
}

/**
 * 验证暂停状态下没有残留镜头冲击时不重复衰减和清空事件队列。
 * @returns {void}
 */
function testBeatCameraPausedIdleShortCircuit() {
  const source = readRendererSource();
  const cameraSource = readSourceBetween(source, 'function updateBeatCamera(dt) {', '\n\nfunction unlockCenteredView()');
  assert.match(cameraSource, /if \(!audio \|\| audio\.paused\) \{[\s\S]*if \(!beatCam\.events\.length && Math\.abs\(beatCam\.punch\) < 0\.0001/);
}

/**
 * 验证歌词镜头边界计算不在每帧创建临时闭包。
 * @returns {void}
 */
function testLyricBoundsAvoidsFrameClosure() {
  const source = readRendererSource();
  const boundsSource = readSourceBetween(source, 'function getStageLyricLockBounds()', 'function lyricCameraLockFit(');
  assert.doesNotMatch(boundsSource, /function take\(/);
  assert.match(boundsSource, /stageLyrics\.current/);
  assert.match(boundsSource, /for \(var i = 0; i < stageLyrics\.outgoing\.length; i\+\+\)/);
}

test('歌词光粒循环复用帧级状态', testLyricParticleFrameCache);
test('歌单架更新复用帧级可见状态', testShelfFrameStateCache);
test('主循环时间戳复用到 hover 和 Home 波形', testFrameTimestampForwarding);
test('歌单渲染帧快照只读取一次 getter', testShelfRenderFrameSnapshotGetterReuse);
test('舞台歌词复用歌单状态快照', testStageLyricsShelfStateReuse);
test('歌单架布局复用帧级设置快照', testShelfFrameSettingsReuse);
test('歌单详情复用帧级布局与外观快照', testShelfContentFrameSnapshotReuse);
test('歌单卡片绘制复用帧级外观快照', testShelfCardFrameSnapshotReuse);
test('歌单卡片属性写入复用稳定值缓存', testShelfCardPropertyWriteCache);
test('歌单详情行属性写入复用稳定值缓存', testShelfContentRowPropertyWriteCache);
test('歌单详情组属性写入复用稳定值缓存', testShelfContentGroupPropertyWriteCache);
test('Home 刷新复用本地歌曲池与听歌统计快照', testHomeRenderSnapshotReuse);
test('歌词特效空闲帧提前结束清理路径', testLyricsParticleIdleShortCircuit);
test('暂停镜头无残留事件时提前结束', testBeatCameraPausedIdleShortCircuit);
test('歌词镜头边界计算不创建帧级闭包', testLyricBoundsAvoidsFrameClosure);
