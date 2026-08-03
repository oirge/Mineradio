'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/**
 * 从前端源码截取封面上传与 data URL 应用的真实实现。
 * @returns {string} 可在隔离上下文执行的封面上传源码。
 */
function readCoverUploadSource() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  const applyStart = source.indexOf('function applyCoverDataUrl(');
  const applyEnd = source.indexOf('function commitCustomCoverCanvas(', applyStart);
  const loadStart = source.indexOf('function loadCoverFromFile(');
  const loadEnd = source.indexOf('function bindCoverCropModal(', loadStart);
  assert.ok(applyStart >= 0 && applyEnd > applyStart, '未找到 applyCoverDataUrl 实现');
  assert.ok(loadStart >= 0 && loadEnd > loadStart, '未找到 loadCoverFromFile 实现');
  return source.slice(applyStart, applyEnd) + source.slice(loadStart, loadEnd);
}

/**
 * 构造可控的假 Image：按 shouldFail 决定异步触发 onload 或 onerror。
 * @param {boolean} shouldFail 是否模拟解码失败。
 * @returns {Function} 可用于隔离上下文的 Image 构造器。
 */
function makeFakeImage(shouldFail) {
  return function FakeImage() {
    const self = this;
    self.onload = null;
    self.onerror = null;
    self.naturalWidth = 512;
    self.naturalHeight = 512;
    Object.defineProperty(self, 'src', {
      set() {
        queueMicrotask(function () {
          if (shouldFail) {
            if (typeof self.onerror === 'function') self.onerror();
          } else if (typeof self.onload === 'function') {
            self.onload();
          }
        });
      },
    });
  };
}

/**
 * 构造假 FileReader：readAsDataURL 后异步触发 onload 并回填结果。
 * @returns {Function} 可用于隔离上下文的 FileReader 构造器。
 */
function makeFakeFileReader() {
  return function FakeFileReader() {
    const self = this;
    self.onload = null;
    self.onerror = null;
    self.readAsDataURL = function () {
      queueMicrotask(function () {
        if (typeof self.onload === 'function') self.onload({ target: { result: 'data:image/png;base64,AAAA' } });
      });
    };
  };
}

/**
 * 在隔离上下文加载封面上传实现，并记录关键副作用。
 * @param {boolean} imageShouldFail 假 Image 是否模拟解码失败。
 * @returns {object} 加载出的函数与副作用计数器。
 */
function loadContext(imageShouldFail) {
  const calls = { toasts: [], applyCanvas: 0, commitCanvas: 0, cropModal: 0 };
  const context = {
    Image: makeFakeImage(imageShouldFail),
    FileReader: makeFakeFileReader(),
    console: { warn() {} },
    showToast(msg) { calls.toasts.push(msg); },
    coverApplyStillCurrent() { return true; },
    makeSquareCoverCanvas() { return {}; },
    setAlbumBackground() {},
    applyCoverCanvas() { calls.applyCanvas += 1; },
    commitCustomCoverCanvas() { calls.commitCanvas += 1; },
    openCoverCropModal() { calls.cropModal += 1; },
    coverTextureSizeForResolution() { return 512; },
    fx: { coverResolution: 1 },
    Object,
  };
  vm.runInNewContext(
    readCoverUploadSource()
      + '\nthis.applyCoverDataUrl = applyCoverDataUrl;'
      + '\nthis.loadCoverFromFile = loadCoverFromFile;',
    context,
  );
  return { context, calls };
}

/** @returns {Promise<void>} 让微任务队列排空。 */
function flush() { return new Promise(function (resolve) { setTimeout(resolve, 0); }); }

/**
 * 验证损坏的封面文件会提示失败且不会提交任何画布。
 * @returns {Promise<void>}
 */
async function testLoadCoverFromFileReportsDecodeFailure() {
  const { context, calls } = loadContext(true);
  context.loadCoverFromFile({ name: 'broken.png' }, {});
  await flush();
  assert.equal(calls.commitCanvas, 0);
  assert.equal(calls.cropModal, 0);
  assert.deepEqual(calls.toasts, ['封面图片读取失败']);
}

/**
 * 验证正常方形封面文件会直接提交画布且不提示错误。
 * @returns {Promise<void>}
 */
async function testLoadCoverFromFileCommitsSquareImage() {
  const { context, calls } = loadContext(false);
  context.loadCoverFromFile({ name: 'ok.png' }, {});
  await flush();
  assert.equal(calls.commitCanvas, 1);
  assert.equal(calls.toasts.length, 0);
}

/**
 * 验证损坏的 data URL 不会应用封面画布，但保持静默不破坏现状。
 * @returns {Promise<void>}
 */
async function testApplyCoverDataUrlSkipsBrokenData() {
  const { context, calls } = loadContext(true);
  context.applyCoverDataUrl('data:image/png;base64,BROKEN', {});
  await flush();
  assert.equal(calls.applyCanvas, 0);
  assert.equal(calls.toasts.length, 0);
}

/**
 * 验证有效的 data URL 会应用封面画布。
 * @returns {Promise<void>}
 */
async function testApplyCoverDataUrlAppliesValidData() {
  const { context, calls } = loadContext(false);
  context.applyCoverDataUrl('data:image/png;base64,AAAA', {});
  await flush();
  assert.equal(calls.applyCanvas, 1);
}

test('损坏封面文件上传时提示失败且不提交画布', testLoadCoverFromFileReportsDecodeFailure);
test('正常方形封面文件上传时直接提交画布', testLoadCoverFromFileCommitsSquareImage);
test('损坏的封面 data URL 静默跳过且不应用画布', testApplyCoverDataUrlSkipsBrokenData);
test('有效的封面 data URL 正常应用画布', testApplyCoverDataUrlAppliesValidData);
