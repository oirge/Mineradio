'use strict';

/**
 * 维护迷你播放器恢复任务的电源会话暂停状态。
 * 锁屏与休眠可能重叠，只有全部原因解除后才允许重新安排恢复。
 */
class MiniPlayerRecoverySession {
  /**
   * @param {{
   *   stopRecoveryTimer: () => void,
   *   stopRecreateTimer: () => void,
   *   scheduleRecovery: (delay: number) => void
   * }} callbacks 定时器取消与恢复调度入口。
   */
  constructor(callbacks) {
    this.pauseReasons = new Set();
    this.stopRecoveryTimer = callbacks.stopRecoveryTimer;
    this.stopRecreateTimer = callbacks.stopRecreateTimer;
    this.scheduleRecovery = callbacks.scheduleRecovery;
  }

  /**
   * 判断当前是否仍有锁屏或休眠原因阻止恢复。
   * @returns {boolean} 至少存在一个暂停原因时返回 true。
   */
  get paused() {
    return this.pauseReasons.size > 0;
  }

  /**
   * 暂停恢复并取消已经排队的周期恢复与崩溃重建任务。
   * @param {string} reason 稳定的暂停原因标识。
   * @returns {void}
   */
  pause(reason) {
    this.pauseReasons.add(reason);
    this.stopRecoveryTimer();
    this.stopRecreateTimer();
  }

  /**
   * 解除一个暂停原因；仅在最后一个原因解除后安排一次恢复。
   * @param {string} reason 与 pause 对应的暂停原因标识。
   * @param {number} delay 恢复调度延迟毫秒数。
   * @returns {boolean} 本次是否真正安排了恢复。
   */
  resume(reason, delay) {
    if (!this.pauseReasons.delete(reason) || this.paused) return false;
    this.scheduleRecovery(delay);
    return true;
  }
}

module.exports = { MiniPlayerRecoverySession };
