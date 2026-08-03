'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/**
 * 从前端源码截取本地封面缩略图并发缓存实现。
 * @returns {string} 可在隔离上下文执行的缩略图缓存源码。
 */
function readLocalCoverThumbPromiseSource() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  const start = source.indexOf('function localCoverThumbResultActiveCount(');
  const end = source.indexOf('/**\n * 为歌曲生成本地封面缩略图', start);
  assert.ok(start >= 0 && end > start, '未找到本地封面缩略图并发缓存实现');
  return source.slice(start, end);
}

/**
 * 从前端源码截取完整封面图片租约实现。
 * @returns {string} 可在隔离上下文执行的图片来源源码。
 */
function readLocalCoverImageSource() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  const start = source.indexOf('async function openLocalCoverImageSource(');
  const end = source.indexOf('function localCoverThumbCacheKey(', start);
  assert.ok(start >= 0 && end > start, '未找到本地封面图片租约实现');
  return source.slice(start, end);
}

/** 测试使用的最小 Blob 类型。 */
class TestBlob {}

/**
 * 创建可由测试精确完成的 Promise。
 * @returns {{promise:Promise<object>,resolve:Function}} 可控异步结果。
 */
function createDeferredImage() {
  let resolve;
  /**
   * 保存外部完成入口，便于测试精确控制异步顺序。
   * @param {Function} done Promise 完成函数。
   * @returns {void}
   */
  function captureResolve(done) { resolve = done; }
  const promise = new Promise(captureResolve);
  return { promise, resolve };
}

/**
 * 验证已被淘汰的旧任务完成时不能删除同键的新任务所有权。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testLateThumbnailPromiseCannotDeleteReplacement() {
  const loads = Object.create(null);
  const promiseCache = {};
  const pendingRequests = [];

  /**
   * 为每次图片解码请求保存独立可控结果，模拟旧请求被淘汰后同键重试。
   * @param {string} dataUrl 原始封面地址。
   * @returns {Promise<object>} 可控图片结果。
   */
  async function openLocalCoverImageSource(dataUrl) {
    const deferred = createDeferredImage();
    if (!loads[dataUrl]) loads[dataUrl] = [];
    loads[dataUrl].push(deferred);
    const image = await deferred.promise;
    /** @returns {void} 测试图片租约不需要真实释放资源。 */
    function releaseImage() {}
    return { image, release: releaseImage };
  }

  /** @returns {number} 测试环境没有运行时帧压力。 */
  function getRuntimeFramePressureLevel() { return 0; }

  /** @param {string} value 封面地址。 @returns {string} 直接使用地址作为测试缓存键。 */
  function localCoverThumbCacheKey(value) { return value; }

  /** @returns {number} 测试结果使用固定最小字节估算。 */
  function estimateDataUrlBytes() { return 1; }

  /** @returns {null} 测试故意停止在画布上下文创建处，使旧任务不写结果缓存。 */
  function getContext() { return null; }

  /** @returns {object} 返回最小画布桩。 */
  function createElement() {
    return { width: 0, height: 0, getContext };
  }

  /** @returns {void} 测试忽略预期内的缩略图告警。 */
  function ignoreWarning() {}

  const context = {
    localCoverThumbResultCache: {},
    localCoverThumbResultOrder: [],
    localCoverThumbResultOrderHead: 0,
    localCoverThumbResultBytes: 0,
    localCoverThumbPromiseCache: promiseCache,
    localCoverThumbPromiseOrder: [],
    localCoverThumbPromiseOrderHead: 0,
    localCoverThumbPromiseCount: 0,
    LOCAL_COVER_THUMB_RESULT_MAX_BYTES: 18 * 1024 * 1024,
    LOCAL_COVER_THUMB_MAX_SIZE: 512,
    LOCAL_COVER_THUMB_QUALITY: 0.82,
    Blob,
    getRuntimeFramePressureLevel,
    localCoverThumbCacheKey,
    estimateDataUrlBytes,
    openLocalCoverImageSource,
    document: { createElement },
    console: { warn: ignoreWarning },
  };
  vm.runInNewContext(
    readLocalCoverThumbPromiseSource()
      + '\nthis.createThumb = createLocalCoverThumbnailDataUrl;'
      + '\nthis.promiseActiveCount = localCoverThumbPromiseActiveCount;',
    context,
  );

  const firstKey = 'data:image/test;base64,cover-0';
  const firstCacheKey = firstKey + ':s512:q82';
  const firstRequest = context.createThumb(firstKey);
  pendingRequests.push(firstRequest);
  for (let i = 1; i < 25; i += 1) {
    pendingRequests.push(context.createThumb('data:image/test;base64,cover-' + i));
  }
  assert.equal(promiseCache[firstCacheKey], undefined, '最旧请求应先被并发缓存淘汰');

  const replacementRequest = context.createThumb(firstKey);
  pendingRequests.push(replacementRequest);
  const replacementOwner = promiseCache[firstCacheKey];
  assert.ok(replacementOwner, '同键重试应取得新的缓存所有权');

  loads[firstKey][0].resolve({ width: 1, height: 1 });
  await firstRequest;

  assert.equal(promiseCache[firstCacheKey], replacementOwner, '旧请求完成后必须保留替代请求槽位');
  // 只完成测试自己登记的请求，避免原型链字段改变异步任务数量。
  for (const key in loads) {
    if (!Object.prototype.hasOwnProperty.call(loads, key)) continue;
    for (const deferred of loads[key]) deferred.resolve({ width: 1, height: 1 });
  }
  await Promise.all(pendingRequests);

  assert.equal(context.promiseActiveCount(), 0, '全部任务完成后活跃 Promise 计数必须归零');
  assert.equal(context.localCoverThumbPromiseOrder.length, 0, '全部任务完成后不得保留过期顺序键');

  const hungKey = 'data:image/test;base64,hung-cover';
  const hungRequest = context.createThumb(hungKey);
  for (let i = 0; i < 100; i += 1) {
    const completedKey = 'data:image/test;base64,completed-' + i;
    const completedRequest = context.createThumb(completedKey);
    loads[completedKey][0].resolve({ width: 1, height: 1 });
    await completedRequest;
  }

  assert.equal(context.promiseActiveCount(), 1, '只有挂起任务应继续计入活跃数量');
  assert.ok(context.localCoverThumbPromiseOrder.length <= 64, '已完成尾部记录必须分批压缩，不能随长会话持续增长');

  loads[hungKey][0].resolve({ width: 1, height: 1 });
  await hungRequest;
  assert.equal(context.promiseActiveCount(), 0);
  assert.equal(context.localCoverThumbPromiseOrder.length, 0);
}

/**
 * 验证同键结果更新不会重复占用顺序队列并误删最新缩略图。
 * @returns {void}
 */
function testThumbnailResultReplacementKeepsSingleOrderSlot() {
  const resultCache = {};

  /** @param {string} value 缩略图结果。 @returns {number} 使用字符串长度模拟缓存字节。 */
  function estimateDataUrlBytes(value) { return String(value || '').length; }

  const context = {
    localCoverThumbResultCache: resultCache,
    localCoverThumbResultOrder: [],
    localCoverThumbResultOrderHead: 0,
    localCoverThumbResultBytes: 0,
    localCoverThumbPromiseCache: {},
    localCoverThumbPromiseOrder: [],
    localCoverThumbPromiseOrderHead: 0,
    localCoverThumbPromiseCount: 0,
    LOCAL_COVER_THUMB_RESULT_MAX_BYTES: 18 * 1024 * 1024,
    estimateDataUrlBytes,
  };
  vm.runInNewContext(
    readLocalCoverThumbPromiseSource()
      + '\nthis.rememberResult = rememberLocalCoverThumbResult;'
      + '\nthis.trimResult = trimLocalCoverThumbResultCache;',
    context,
  );

  context.rememberResult('same', 'data:image/webp;base64,old');
  context.rememberResult('same', 'data:image/webp;base64,new');
  for (let i = 0; i < 7; i += 1) {
    context.rememberResult('other-' + i, 'data:image/webp;base64,' + i);
  }
  context.trimResult(8, 1024 * 1024);

  assert.equal(resultCache.same && resultCache.same.value, 'data:image/webp;base64,new');
  assert.equal(Object.keys(resultCache).length, 8, '八个唯一结果不应因重复顺序键被提前淘汰');
}

/**
 * 验证缩略图成功、无画布上下文和绘制异常三条路径都会释放完整图片租约。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testThumbnailAlwaysReleasesImageLease() {
  const modes = ['success', 'no-context', 'draw-error'];
  for (const mode of modes) {
    let releases = 0;

    /** @returns {number} 测试环境没有运行时帧压力。 */
    function getRuntimeFramePressureLevel() { return 0; }

    /** @param {string} value 封面地址。 @returns {string} 直接使用地址作为缓存键。 */
    function localCoverThumbCacheKey(value) { return value; }

    /** @returns {number} 测试结果使用固定最小字节估算。 */
    function estimateDataUrlBytes() { return 1; }

    /** @returns {void} 记录完整图片租约释放次数。 */
    function releaseImageLease() { releases += 1; }

    /** @returns {Promise<object>} 返回固定可绘制图片和显式释放函数。 */
    function openLocalCoverImageSource() {
      return Promise.resolve({ image: { width: 2, height: 2 }, release: releaseImageLease });
    }

    /** @returns {void} 成功模式记录绘制；异常模式抛出固定错误。 */
    function drawImage() {
      if (mode === 'draw-error') throw new Error('draw failed');
    }

    /** @returns {object|null} 按测试模式返回画布上下文。 */
    function getContext() {
      if (mode === 'no-context') return null;
      return { imageSmoothingEnabled: false, imageSmoothingQuality: '', drawImage };
    }

    /** @returns {string} 返回固定 WebP 缩略图。 */
    function toDataURL() { return 'data:image/webp;base64,thumb'; }

    /** @returns {object} 返回最小画布桩。 */
    function createElement() {
      return { width: 0, height: 0, getContext, toDataURL };
    }

    /** @returns {void} 测试忽略预期内的绘制异常告警。 */
    function ignoreWarning() {}

    const context = {
      Blob,
      Error,
      LOCAL_COVER_THUMB_RESULT_MAX_BYTES: 18 * 1024 * 1024,
      LOCAL_COVER_THUMB_MAX_SIZE: 512,
      LOCAL_COVER_THUMB_QUALITY: 0.82,
      console: { warn: ignoreWarning },
      document: { createElement },
      estimateDataUrlBytes,
      getRuntimeFramePressureLevel,
      localCoverThumbCacheKey,
      localCoverThumbPromiseCache: {},
      localCoverThumbPromiseCount: 0,
      localCoverThumbPromiseOrder: [],
      localCoverThumbPromiseOrderHead: 0,
      localCoverThumbResultBytes: 0,
      localCoverThumbResultCache: {},
      localCoverThumbResultOrder: [],
      localCoverThumbResultOrderHead: 0,
      openLocalCoverImageSource,
    };
    vm.runInNewContext(
      readLocalCoverThumbPromiseSource() + '\nthis.createThumb = createLocalCoverThumbnailDataUrl;',
      context,
    );

    const result = await context.createThumb('data:image/png;base64,' + mode);
    assert.equal(result, mode === 'success' ? 'data:image/webp;base64,thumb' : '');
    assert.equal(releases, 1, mode + ' 路径必须释放一次完整图片租约');
  }
}

/**
 * 验证真实 Blob 分支把 ImageBitmap.close 暴露为租约释放动作。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testBlobImageLeaseClosesBitmap() {
  let closes = 0;
  const bitmap = {
    /** @returns {void} 记录 ImageBitmap 显式关闭次数。 */
    close() { closes += 1; },
  };

  /** @returns {Promise<object>} 返回可观察关闭动作的 ImageBitmap 桩。 */
  function createImageBitmap() { return Promise.resolve(bitmap); }

  const context = { Blob: TestBlob, createImageBitmap };
  vm.runInNewContext(readLocalCoverImageSource() + '\nthis.openSource = openLocalCoverImageSource;', context);

  const lease = await context.openSource(new TestBlob());
  assert.equal(lease.image, bitmap);
  assert.equal(closes, 0);
  lease.release();
  assert.equal(closes, 1);
}

test('迟到的缩略图任务不能删除同键替代 Promise', testLateThumbnailPromiseCannotDeleteReplacement);
test('同键缩略图结果只占用一个顺序槽位', testThumbnailResultReplacementKeepsSingleOrderSlot);
test('缩略图所有完成路径都释放完整图片租约', testThumbnailAlwaysReleasesImageLease);
test('Blob 图片租约显式关闭 ImageBitmap', testBlobImageLeaseClosesBitmap);
