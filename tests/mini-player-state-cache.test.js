'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { MiniPlayerStateCache } = require('../desktop/mini-player-state-cache');

/**
 * 验证功能开启但窗口未驻留时不接收歌曲和封面状态。
 * @returns {void}
 */
function testNonResidentCacheRejectsState() {
  const cache = new MiniPlayerStateCache(true);

  assert.equal(cache.apply({
    title: '不应驻留',
    cover: 'data:image/png;base64,' + 'A'.repeat(64 * 1024),
    hasTrack: true,
  }), false);
  assert.equal(cache.value.cover, '');
  assert.equal(cache.value.hasTrack, false);
}

/**
 * 验证关闭迷你播放器后释放封面，并持续拒绝禁用期间的新状态。
 * @returns {void}
 */
function testDisabledCacheReleasesAndRejectsState() {
  const cache = new MiniPlayerStateCache(true);
  const cover = 'data:image/png;base64,' + 'A'.repeat(64 * 1024);
  cache.setResident(true);

  assert.equal(cache.apply({
    title: '测试歌曲',
    artist: '测试歌手',
    cover,
    playing: true,
    hasTrack: true,
    metaSignature: 'track-1',
  }), true);
  assert.equal(cache.value.cover, cover);

  cache.setEnabled(false);

  assert.deepEqual(cache.value, {
    title: 'Mineradio',
    artist: '',
    cover: '',
    playing: false,
    hasTrack: false,
    desktopLyrics: false,
    metaSignature: '',
  });
  assert.equal(cache.apply({
    cover,
    hasTrack: true,
    metaSignature: 'track-2',
  }), false);
  assert.equal(cache.value.cover, '');
  assert.equal(cache.value.hasTrack, false);
}

/**
 * 验证重新启用后只接受新补丁，不复活禁用前已经释放的封面引用。
 * @returns {void}
 */
function testReenabledCacheRequiresFreshState() {
  const cache = new MiniPlayerStateCache(true);
  cache.setResident(true);
  cache.apply({ cover: 'old-cover', hasTrack: true, metaSignature: 'old' });
  cache.setEnabled(false);
  cache.setEnabled(true);

  assert.equal(cache.value.cover, '');
  assert.equal(cache.value.hasTrack, false);
  cache.setResident(true);
  assert.equal(cache.apply({
    title: '新歌曲',
    cover: 'new-cover',
    hasTrack: true,
    metaSignature: 'new',
  }), true);
  assert.equal(cache.value.title, '新歌曲');
  assert.equal(cache.value.cover, 'new-cover');
  assert.equal(cache.value.metaSignature, 'new');
}

test('无迷你窗口时不缓存歌曲和封面状态', testNonResidentCacheRejectsState);
test('禁用迷你播放器会释放并拒绝后续封面状态', testDisabledCacheReleasesAndRejectsState);
test('重新启用后需要新的完整状态补丁', testReenabledCacheRequiresFreshState);
