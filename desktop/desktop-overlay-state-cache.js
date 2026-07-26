'use strict';

/**
 * 创建不持有歌词、节奏图或封面引用的桌面覆盖层关闭状态。
 * @returns {{enabled:boolean}} 最小关闭状态。
 */
function createDisabledOverlayState() {
  return { enabled: false };
}

/**
 * 管理桌面歌词或壁纸状态的生命周期所有权。
 * 覆盖层关闭时替换整个状态对象，避免已销毁窗口的重载数据继续驻留主进程。
 */
class DesktopOverlayStateCache {
  /**
   * 创建默认关闭且不持有重载数据的状态缓存。
   */
  constructor() {
    this.enabled = false;
    this.value = createDisabledOverlayState();
  }

  /**
   * 切换覆盖层状态；关闭时释放全部载荷，开启时接受调用方提供的当前快照。
   * @param {boolean} enabled 覆盖层是否启用。
   * @param {unknown} payload 开启时的完整或增量状态。
   * @returns {object} 切换后的状态对象。
   */
  setEnabled(enabled, payload) {
    if (!enabled) {
      this.enabled = false;
      this.value = createDisabledOverlayState();
      return this.value;
    }
    const source = payload && typeof payload === 'object' ? payload : {};
    const base = this.enabled ? this.value : {};
    this.enabled = true;
    this.value = { ...base, ...source, enabled: true };
    return this.value;
  }

  /**
   * 仅在覆盖层启用时合并增量补丁；显式关闭补丁会立即释放现有载荷。
   * @param {unknown} payload renderer 发送的覆盖层状态补丁。
   * @returns {boolean} 是否接受并合并了补丁。
   */
  apply(payload) {
    const source = payload && typeof payload === 'object' ? payload : {};
    if (source.enabled === false) {
      this.setEnabled(false);
      return false;
    }
    if (!this.enabled) return false;
    this.value = { ...this.value, ...source, enabled: true };
    return true;
  }
}

module.exports = { DesktopOverlayStateCache };
