'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { MiniPlayerRecoverySession } = require('../desktop/mini-player-recovery-session');

/**
 * 创建恢复暂停状态机测试夹具，并记录所有定时器副作用。
 * @returns {{session: MiniPlayerRecoverySession, calls: string[]}} 状态机和副作用调用记录。
 */
function createRecoverySessionHarness() {
  const calls = [];

  /**
   * 记录周期恢复定时器取消动作。
   * @returns {void}
   */
  function stopRecoveryTimer() {
    calls.push('stop-recovery');
  }

  /**
   * 记录崩溃重建定时器取消动作。
   * @returns {void}
   */
  function stopRecreateTimer() {
    calls.push('stop-recreate');
  }

  /**
   * 记录所有暂停原因解除后的恢复调度。
   * @param {number} delay 恢复延迟毫秒数。
   * @returns {void}
   */
  function scheduleRecovery(delay) {
    calls.push('schedule:' + delay);
  }

  return {
    session: new MiniPlayerRecoverySession({
      stopRecoveryTimer,
      stopRecreateTimer,
      scheduleRecovery,
    }),
    calls,
  };
}

/**
 * 验证锁屏会同时取消两类恢复任务，并阻止新的恢复调度。
 * @returns {void}
 */
function testPauseCancelsAllRecoveryWork() {
  const { session, calls } = createRecoverySessionHarness();

  session.pause('screen');

  assert.equal(session.paused, true);
  assert.deepEqual(calls, ['stop-recovery', 'stop-recreate']);
}

/**
 * 验证锁屏和休眠重叠时，必须等两个原因都解除后才恢复一次。
 * @returns {void}
 */
function testOverlappingPauseReasonsResumeOnce() {
  const { session, calls } = createRecoverySessionHarness();

  session.pause('screen');
  session.pause('suspend');
  session.resume('suspend', 180);

  assert.equal(session.paused, true);
  assert.deepEqual(calls, [
    'stop-recovery',
    'stop-recreate',
    'stop-recovery',
    'stop-recreate',
  ]);

  session.resume('screen', 180);

  assert.equal(session.paused, false);
  assert.deepEqual(calls, [
    'stop-recovery',
    'stop-recreate',
    'stop-recovery',
    'stop-recreate',
    'schedule:180',
  ]);
}

test('锁屏暂停会取消全部迷你播放器恢复任务', testPauseCancelsAllRecoveryWork);
test('重叠的锁屏和休眠原因全部解除后只恢复一次', testOverlappingPauseReasonsResumeOnce);
