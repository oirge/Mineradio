'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');

/**
 * 模拟桌面歌词鼠标轮询子进程，只记录 kill 调用且不启动系统进程。
 */
class FakeMousePoller extends EventEmitter {
  /**
   * 创建带 stdout 事件源的假子进程。
   */
  constructor() {
    super();
    this.stdout = new EventEmitter();
    this.killCount = 0;
  }

  /**
   * 记录停止请求，供所有权竞态断言使用。
   * @returns {boolean} 固定返回 true，模拟成功发送终止信号。
   */
  kill() {
    this.killCount += 1;
    return true;
  }
}

/**
 * 从主进程源码截取真实的轮询启动和停止函数，避免测试复制实现。
 * @returns {string} 可在隔离 VM 中执行的函数源码。
 */
function readPollerLifecycleSource() {
  const file = path.join(__dirname, '..', 'desktop', 'main.js');
  const source = fs.readFileSync(file, 'utf8');
  const start = source.indexOf('function startDesktopLyricsMousePoller()');
  const end = source.indexOf('function broadcastDesktopLyricsLockState()', start);
  assert.ok(start >= 0 && end > start, '未找到桌面歌词轮询生命周期函数');
  return source.slice(start, end);
}

/**
 * 创建隔离测试环境并注入假的 spawn，确保测试不启动 PowerShell。
 * @returns {{start: Function, stop: Function, pollers: FakeMousePoller[], outputChunks: string[]}} 生命周期入口、假进程与已消费输出。
 */
function createPollerHarness() {
  const pollers = [];
  const outputChunks = [];

  /**
   * 为每次启动返回新的假轮询进程。
   * @returns {FakeMousePoller} 新的假进程。
   */
  function spawnPoller() {
    const poller = new FakeMousePoller();
    pollers.push(poller);
    return poller;
  }

  /**
   * 记录真正通过所有权门禁的 stdout 数据。
   * @param {Buffer|string} chunk 假进程输出块。
   * @returns {void}
   */
  function recordPollerOutput(chunk) {
    outputChunks.push(String(chunk));
  }

  const context = {
    process: { platform: 'win32' },
    spawn: spawnPoller,
    consumeDesktopLyricsMousePollerOutput: recordPollerOutput,
    desktopLyricsMousePoller: null,
    desktopLyricsMousePollerBuffer: '',
  };
  vm.runInNewContext(
    readPollerLifecycleSource()
      + '\nthis.startPoller = startDesktopLyricsMousePoller;'
      + '\nthis.stopPoller = stopDesktopLyricsMousePoller;',
    context,
  );
  return {
    start: context.startPoller,
    stop: context.stopPoller,
    pollers,
    outputChunks,
  };
}

/**
 * 验证旧进程退出不能清空新进程所有权，否则新进程会变成无法停止的后台孤儿。
 * @returns {void}
 */
function testStaleExitDoesNotOrphanReplacement() {
  const harness = createPollerHarness();
  harness.start();
  const first = harness.pollers[0];
  harness.stop();
  harness.start();
  const second = harness.pollers[1];

  first.emit('exit', 0);
  harness.stop();

  assert.equal(first.killCount, 1);
  assert.equal(second.killCount, 1);
}

/**
 * 验证旧进程错误回调同样不能覆盖替代进程句柄。
 * @returns {void}
 */
function testStaleErrorDoesNotOrphanReplacement() {
  const harness = createPollerHarness();
  harness.start();
  const first = harness.pollers[0];
  harness.stop();
  harness.start();
  const second = harness.pollers[1];

  first.emit('error', new Error('旧进程延迟错误'));
  harness.stop();

  assert.equal(first.killCount, 1);
  assert.equal(second.killCount, 1);
}

/**
 * 验证旧进程停止后的迟到 stdout 不会污染新进程缓冲区或触发当前窗口中键动作。
 * @returns {void}
 */
function testStaleOutputDoesNotReachReplacementConsumer() {
  const harness = createPollerHarness();
  harness.start();
  const first = harness.pollers[0];
  harness.stop();
  harness.start();
  const second = harness.pollers[1];

  first.stdout.emit('data', Buffer.from('OLD\n'));
  second.stdout.emit('data', Buffer.from('CURRENT\n'));

  assert.deepEqual(harness.outputChunks, ['CURRENT\n']);
  harness.stop();
}

test('旧轮询进程退出不会让替代进程变成后台孤儿', testStaleExitDoesNotOrphanReplacement);
test('旧轮询进程错误不会让替代进程变成后台孤儿', testStaleErrorDoesNotOrphanReplacement);
test('旧轮询进程输出不会污染替代进程缓冲区', testStaleOutputDoesNotReachReplacementConsumer);
