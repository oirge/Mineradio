'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/**
 * 从前端源码截取自定义背景 IndexedDB 读写实现（含 open/put/get）。
 * @returns {string} 可在隔离上下文执行的自定义背景缓存源码。
 */
function readCustomBackgroundIdbSource() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  const start = source.indexOf('function openCustomBackgroundDb()');
  const end = source.indexOf('function openLocalAssetCacheDb()', start);
  assert.ok(start >= 0 && end > start, '未找到自定义背景 IndexedDB 实现');
  return source.slice(start, end);
}

/**
 * 构造一个可精确触发 complete / error / abort 的最小 IndexedDB 事务桩。
 * @param {('complete'|'error'|'abort')} outcome 事务最终结局。
 * @param {*} storedValue get 请求返回的记录。
 * @returns {object} 事务桩，暴露 fire() 以驱动终止事件。
 */
function createTransactionStub(outcome, storedValue) {
  const requests = [];
  const tx = {
    oncomplete: null,
    onerror: null,
    onabort: null,
    // 真实 IndexedDB 在显式 abort 时 tx.error 常为 null，使代码走到默认 aborted 错误分支。
    error: outcome === 'error' ? new Error('stub tx error') : null,
    /**
     * 返回对象存储桩，记录 put 并让 get 产出预置结果。
     * @returns {object} 对象存储桩。
     */
    objectStore() {
      return {
        /**
         * 记录写入请求（无需真实持久化）。
         * @returns {object} 请求桩。
         */
        put() { const req = {}; requests.push(req); return req; },
        /**
         * 产出可被 onsuccess 消费的读取请求。
         * @returns {object} 请求桩。
         */
        get() { const req = { onsuccess: null, onerror: null, result: storedValue }; requests.push(req); return req; },
      };
    },
  };

  /**
   * 按事务结局驱动请求与事务事件，模拟浏览器异步回调。
   * @returns {void}
   */
  tx.fire = function fire() {
    if (outcome === 'complete') {
      for (const req of requests) {
        if (typeof req.onsuccess === 'function') req.onsuccess({ target: req });
      }
      if (typeof tx.oncomplete === 'function') tx.oncomplete();
    } else if (outcome === 'error') {
      if (typeof tx.onerror === 'function') tx.onerror();
    } else if (outcome === 'abort') {
      // 关键路径：abort 只触发 onabort，不触发 onsuccess/oncomplete/onerror。
      if (typeof tx.onabort === 'function') tx.onabort();
    }
  };
  return tx;
}

/**
 * 构造运行自定义背景 IndexedDB 代码所需的隔离上下文与可控 DB 桩。
 * @param {('complete'|'error'|'abort')} outcome 事务最终结局。
 * @param {*} storedValue get 请求返回的记录。
 * @returns {{context:object, getTx:Function, closed:Function}} 上下文与检查器。
 */
function createCustomBgContext(outcome, storedValue) {
  let lastTx = null;
  let closeCalls = 0;
  const db = {
    /**
     * 返回本轮事务桩并保留引用供测试驱动。
     * @returns {object} 事务桩。
     */
    transaction() { lastTx = createTransactionStub(outcome, storedValue); return lastTx; },
    /**
     * 记录连接关闭次数，验证 abort 分支不泄漏连接。
     * @returns {void}
     */
    close() { closeCalls += 1; },
  };
  const indexedDB = {
    /**
     * 立即完成 open 请求，返回预置 DB 桩。
     * @returns {object} open 请求桩。
     */
    open() {
      const req = { onupgradeneeded: null, onsuccess: null, onerror: null, result: db };
      queueMicrotask(() => { if (typeof req.onsuccess === 'function') req.onsuccess(); });
      return req;
    },
  };
  const context = {
    window: { indexedDB },
    indexedDB,
    Date: { now() { return 0; } },
    queueMicrotask,
    // 提取片段引用了定义在其上方的常量，隔离上下文需显式提供。
    CUSTOM_BG_DB_NAME: 'mineradio-custom-background-v1',
    CUSTOM_BG_STORE: 'media',
  };
  vm.createContext(context);
  vm.runInContext(readCustomBackgroundIdbSource(), context);
  return {
    context,
    /**
     * 获取最近一次创建的事务桩。
     * @returns {object|null} 事务桩。
     */
    async getTx() {
      for (let i = 0; i < 1000 && !lastTx; i++) await Promise.resolve();
      return lastTx;
    },
    /**
     * 返回连接关闭次数。
     * @returns {number} close 调用次数。
     */
    closed() { return closeCalls; },
  };
}

/**
 * put 事务被 abort 时必须 reject 且关闭连接，而不是永久挂起。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testPutRejectsOnAbort() {
  const harness = createCustomBgContext('abort');
  const promise = harness.context.putCustomBackgroundBlob('bg', {}, {});
  await Promise.resolve();
  await Promise.resolve();
  (await harness.getTx()).fire();
  await assert.rejects(promise, /put aborted/, 'put 事务 abort 必须 reject');
  assert.equal(harness.closed(), 1, 'put 事务 abort 必须关闭连接');
}

/**
 * get 事务被 abort 时必须 reject 且关闭连接，而不是永久挂起。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testGetRejectsOnAbort() {
  const harness = createCustomBgContext('abort');
  const promise = harness.context.getCustomBackgroundBlob('bg');
  await Promise.resolve();
  await Promise.resolve();
  (await harness.getTx()).fire();
  await assert.rejects(promise, /get aborted/, 'get 事务 abort 必须 reject');
  assert.equal(harness.closed(), 1, 'get 事务 abort 必须关闭连接');
}

/**
 * 正常 complete 路径仍然按记录内容 resolve。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testGetResolvesOnComplete() {
  const harness = createCustomBgContext('complete', { id: 'bg', blob: { size: 3 } });
  const promise = harness.context.getCustomBackgroundBlob('bg');
  await Promise.resolve();
  await Promise.resolve();
  (await harness.getTx()).fire();
  const value = await promise;
  assert.deepEqual(value, { size: 3 }, 'complete 路径应返回记录中的 blob');
  assert.equal(harness.closed(), 1, 'complete 路径应关闭连接');
}

test('自定义背景 put 事务 abort 时 reject 而非永挂', testPutRejectsOnAbort);
test('自定义背景 get 事务 abort 时 reject 而非永挂', testGetRejectsOnAbort);
test('自定义背景 get 事务 complete 时正确 resolve', testGetResolvesOnComplete);
