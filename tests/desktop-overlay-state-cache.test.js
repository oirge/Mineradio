'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { DesktopOverlayStateCache } = require('../desktop/desktop-overlay-state-cache');

/**
 * 验证关闭桌面歌词后释放节奏图，并拒绝禁用期间的后续补丁。
 * @returns {void}
 */
function testDisabledLyricsStateReleasesBeatMap() {
  const cache = new DesktopOverlayStateCache();
  const beatMap = {
    cameraBeats: new Array(4096).fill(1),
    pulseBeats: new Array(4096).fill(2),
  };

  cache.setEnabled(true, {
    text: '测试歌词',
    beatMap,
    beatMapKey: 'track-1',
  });
  assert.equal(cache.value.beatMap, beatMap);

  cache.setEnabled(false);

  assert.deepEqual(cache.value, { enabled: false });
  assert.equal(cache.apply({
    enabled: true,
    beatMap,
    beatMapKey: 'stale-track',
  }), false);
  assert.deepEqual(cache.value, { enabled: false });
}

/**
 * 验证关闭壁纸后释放封面 data URL，重新启用只持有新状态。
 * @returns {void}
 */
function testDisabledWallpaperStateReleasesCover() {
  const cache = new DesktopOverlayStateCache();
  const oldCover = 'data:image/png;base64,' + 'A'.repeat(256 * 1024);
  const newCover = 'data:image/png;base64,' + 'B'.repeat(128);

  cache.setEnabled(true, { cover: oldCover, title: '旧歌曲' });
  cache.setEnabled(false);

  assert.deepEqual(cache.value, { enabled: false });

  cache.setEnabled(true, { cover: newCover, title: '新歌曲' });

  assert.equal(cache.value.enabled, true);
  assert.equal(cache.value.cover, newCover);
  assert.equal(cache.value.title, '新歌曲');
  assert.notEqual(cache.value.cover, oldCover);
}

/**
 * 验证启用期间的增量补丁保留未变化字段，显式禁用补丁会立即清空状态。
 * @returns {void}
 */
function testEnabledOverlayMergesUntilDisabled() {
  const cache = new DesktopOverlayStateCache();
  cache.setEnabled(true, { title: '歌曲', playing: false });

  assert.equal(cache.apply({ playing: true }), true);
  assert.deepEqual(cache.value, {
    enabled: true,
    title: '歌曲',
    playing: true,
  });

  assert.equal(cache.apply({ enabled: false, title: '不得保留' }), false);
  assert.deepEqual(cache.value, { enabled: false });
}

test('关闭桌面歌词会释放节奏图并拒绝禁用态补丁', testDisabledLyricsStateReleasesBeatMap);
test('关闭壁纸会释放封面且重新启用只持有新状态', testDisabledWallpaperStateReleasesCover);
test('覆盖层仅在启用期间合并补丁', testEnabledOverlayMergesUntilDisabled);
