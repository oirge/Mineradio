'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/**
 * 从前端源码截取音频淡入淡出实现（含 clearAudioFadeTimers 与 fadeOutAndPauseAudio）。
 * @returns {string} 可在隔离上下文执行的淡出结算源码。
 */
function readPlaybackFadeSource() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  const start = source.indexOf('function clearAudioFadeTimers()');
  const end = source.indexOf('function applyVolumeToAudio(', start);
  assert.ok(start >= 0 && end > start, '未找到音频淡出结算实现');
  return source.slice(start, end);
}

/**
 * 构造运行淡出结算所需的隔离上下文，使用手动可控的定时器与音频桩。
 * @returns {{context:object, fireTimers:Function, pendingTimerCount:Function}} 上下文与定时器控制器。
 */
function createFadeContext() {
  const timers = new Map();
  let timerSeq = 0;

  /**
   * 注册一个手动触发的定时器，返回可用于清除的句柄。
   * @param {Function} fn 到点回调。
   * @returns {number} 定时器句柄。
   */
  function setTimeoutStub(fn) {
    const id = ++timerSeq;
    timers.set(id, fn);
    return id;
  }

  /**
   * 清除尚未触发的定时器。
   * @param {number} id 定时器句柄。
   * @returns {void}
   */
  function clearTimeoutStub(id) {
    timers.delete(id);
  }

  const audio = {
    paused: false,
    volume: 1,
    pauseCalls: 0,
    /**
     * 记录暂停调用次数，模拟音频元素暂停。
     * @returns {void}
     */
    pause() { this.pauseCalls += 1; this.paused = true; },
  };

  const context = {
    console: { warn() {}, log() {} },
    audio,
    gainNode: null,
    audioCtx: null,
    targetVolume: 0.8,
    audioFadeTimer: null,
    audioElementFadeFrame: 0,
    audioFadeSerial: 0,
    pendingFadeOutSettle: null,
    AUDIO_FADE_OUT_MS: 420,
    AUDIO_FADE_IN_MS: 460,
    AUDIO_SILENCE_GAIN: 0.0001,
    setTimeout: setTimeoutStub,
    clearTimeout: clearTimeoutStub,
    /**
     * 隔离环境不驱动真实动画帧，淡出走定时器路径即可覆盖被测契约。
     * @returns {number} 占位帧句柄。
     */
    requestAnimationFrame() { return 0; },
    cancelAnimationFrame() {},
    performance: { now() { return 0; } },
    /**
     * 数值区间夹取，复刻前端同名工具。
     * @param {number} value 原始值。
     * @param {number} min 下限。
     * @param {number} max 上限。
     * @returns {number} 夹取后的值。
     */
    clampRange(value, min, max) { return Math.max(min, Math.min(max, Number(value) || 0)); },
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(readPlaybackFadeSource(), context);

  /**
   * 触发全部已登记的定时器回调，模拟时间推进到淡出到点。
   * @returns {void}
   */
  function fireTimers() {
    const pending = Array.from(timers.entries());
    for (const [id, fn] of pending) {
      timers.delete(id);
      fn();
    }
  }

  /**
   * 返回当前尚未触发的定时器数量。
   * @returns {number} 未触发定时器数。
   */
  function pendingTimerCount() { return timers.size; }

  return { context, fireTimers, pendingTimerCount };
}

/**
 * 正常淡出到点：promise 结算为 true，音频被暂停。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testFadeOutCompletesToTrue() {
  const { context, fireTimers } = createFadeContext();
  const fadePromise = context.fadeOutAndPauseAudio();
  assert.equal(typeof context.pendingFadeOutSettle, 'function', '淡出进行中应登记兜底结算回调');
  fireTimers();
  const result = await fadePromise;
  assert.equal(result, true, '正常淡出到点应结算为 true');
  assert.equal(context.audio.pauseCalls, 1, '淡出到点应暂停音频');
  assert.equal(context.pendingFadeOutSettle, null, '结算后必须清空兜底回调');
  assert.equal(context.audioFadeTimer, null, '结算后必须清空淡出定时器');
}

/**
 * 淡出期间被外部清理（如切歌）：promise 必须结算为 false，而不是永久挂起。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testFadeOutInterruptedSettlesToFalse() {
  const { context } = createFadeContext();
  const fadePromise = context.fadeOutAndPauseAudio();
  assert.equal(typeof context.pendingFadeOutSettle, 'function', '淡出进行中应登记兜底结算回调');

  // 模拟切歌路径：清理淡出定时器。旧实现会在此静默吞掉唯一结算点导致 await 永挂。
  context.clearAudioFadeTimers();

  const settled = await Promise.race([
    fadePromise.then(value => ({ done: true, value })),
    new Promise(resolve => { context.setTimeout(() => resolve({ done: false }), 0); }),
  ]);
  assert.equal(settled.done, true, '淡出被打断后 promise 必须结算，不能永挂');
  assert.equal(settled.value, false, '被打断的淡出应结算为 false');
  assert.equal(context.audio.pauseCalls, 0, '被打断的淡出不应暂停音频');
  assert.equal(context.pendingFadeOutSettle, null, '结算后必须清空兜底回调');
}

/**
 * 结算只发生一次：先被打断结算 false 后，即便定时器仍到点也不得重复结算。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testFadeOutSettlesExactlyOnce() {
  const { context, fireTimers } = createFadeContext();
  let resolveCount = 0;
  const fadePromise = context.fadeOutAndPauseAudio().then(value => { resolveCount += 1; return value; });
  context.clearAudioFadeTimers();
  await fadePromise;
  fireTimers();
  await Promise.resolve();
  assert.equal(resolveCount, 1, '被打断后即使定时器到点也只能结算一次');
  assert.equal(context.audio.pauseCalls, 0, '被打断的淡出定时器不应再暂停音频');
}

test('正常淡出到点结算为 true 并暂停音频', testFadeOutCompletesToTrue);
test('淡出被切歌打断时结算为 false 而非永挂', testFadeOutInterruptedSettlesToFalse);
test('淡出被打断后即使定时器到点也只结算一次', testFadeOutSettlesExactlyOnce);
