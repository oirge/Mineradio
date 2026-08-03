'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/**
 * 从前端源码截取歌单封面请求及其缓存裁剪实现。
 * @returns {string} 可在隔离上下文执行的歌单封面缓存源码。
 */
function readPlaylistCoverCacheSource() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  const start = source.indexOf('function settlePlaylistCoverImage(');
  const end = source.indexOf('// ============================================================\n//  3D 卡片交互', start);
  assert.ok(start >= 0 && end > start, '未找到歌单封面缓存实现');
  return source.slice(start, end);
}

/**
 * 验证长期不完成的图片请求仍受硬上限约束，并释放被淘汰记录的异步引用。
 * @returns {void}
 */
function testLoadingPlaylistCoversRespectCacheLimit() {
  const images = [];
  const cache = {};

  /**
   * 创建永不自动完成的假图片，便于观察取消时的 handler 与地址释放。
   * @returns {object} 假图片实例。
   */
  function ImageStub() {
    const image = { onload: null, onerror: null, crossOrigin: '', src: '' };
    images.push(image);
    return image;
  }

  /** @returns {boolean} 测试地址需要普通图片加载。 */
  function isInlineCoverSrc() { return false; }

  /** @param {string} url 原封面地址。 @returns {string} 不改写测试地址。 */
  function coverProxySrc(url) { return String(url).startsWith('invalid-') ? '' : url; }

  /** @returns {object} 测试中没有需要保护的当前封面。 */
  function collectProtectedCoverUrls() { return Object.create(null); }

  /** @returns {number} 测试不执行异步 waiter 回调。 */
  function setTimeoutStub() { return 0; }

  const context = {
    playlistCoverCache: cache,
    playlistCoverCacheCount: 0,
    Image: ImageStub,
    isInlineCoverSrc,
    coverProxySrc,
    collectProtectedCoverUrls,
    setTimeout: setTimeoutStub,
  };
  vm.runInNewContext(
    readPlaylistCoverCacheSource() + '\nthis.requestCover = requestPlaylistCover;',
    context,
  );

  context.requestCover('cover-0', setTimeoutStub);
  const firstRecord = cache['cover-0'];
  for (let i = 1; i < 240; i += 1) context.requestCover('cover-' + i, setTimeoutStub);

  assert.ok(Object.keys(cache).length <= 196);
  assert.equal(context.playlistCoverCacheCount, Object.keys(cache).length);
  assert.equal(cache['cover-0'], undefined);
  assert.equal(firstRecord.waiters.length, 0);
  assert.equal(images[0].onload, null);
  assert.equal(images[0].onerror, null);
  assert.equal(images[0].src, '');

  context.requestCover('loaded-cover', setTimeoutStub);
  const loadedRecord = cache['loaded-cover'];
  const loadedImage = loadedRecord.img;
  loadedImage.onload();
  assert.equal(loadedRecord.img, loadedImage, '成功记录继续持有可复用图片');
  assert.equal(loadedImage.onload, null, '成功后不再保留加载闭包');
  assert.equal(loadedImage.onerror, null, '成功后不再保留失败闭包');

  context.requestCover('failed-cover', setTimeoutStub);
  const failedRecord = cache['failed-cover'];
  const failedImage = failedRecord.img;
  failedImage.src = 'failed-cover';
  failedImage.onerror();
  assert.equal(failedRecord.img, null, '失败记录不应继续持有无用图片对象');
  assert.equal(failedImage.onload, null, '失败后释放加载闭包');
  assert.equal(failedImage.onerror, null, '失败后释放失败闭包');
  assert.equal(failedImage.src, '', '失败后释放图片地址');

  context.requestCover('invalid-immediate', setTimeoutStub);
  const invalidRecord = cache['invalid-immediate'];
  const invalidImage = images[images.length - 1];
  assert.equal(invalidRecord.img, null, '无效地址分支不应保留空图片对象');
  assert.equal(invalidImage.onload, null);
  assert.equal(invalidImage.onerror, null);
  assert.equal(invalidImage.src, '');

  for (let i = 0; i < 240; i += 1) context.requestCover('invalid-' + i, setTimeoutStub);
  assert.ok(Object.keys(cache).length <= 196);
  assert.equal(context.playlistCoverCacheCount, Object.keys(cache).length);
}

test('未完成的歌单封面请求不会绕过缓存上限', testLoadingPlaylistCoversRespectCacheLimit);
