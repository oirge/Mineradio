'use strict';

/**
 * 为透明歌词窗口提供独立于首帧事件的显示与有限加载恢复。
 * 每个实例独占定时器；旧窗口、关闭状态和退出中的应用不得被迟到回调唤醒。
 * @param {Electron.BrowserWindow} win 歌词窗口。
 * @param {{isCurrent:Function,syncState:Function,url:string,log?:Function,now?:Function}} options 生命周期接缝。
 * @returns {{load:Function,show:Function,dispose:Function}} 加载、重画和释放入口。
 */
function createDesktopLyricsRecovery(win, options) {
  const contents = win.webContents;
  const log = options.log || console.warn;
  const now = options.now || Date.now;
  let disposed = false;
  let showTimer = null;
  let retryTimer = null;
  let visibilityTimer = null;
  let unresponsiveTimer = null;
  let retryReason = '';
  let loadGeneration = 0;
  let healthySince = null;
  let attempts = 0;
  const isCurrent = () => !disposed && !win.isDestroyed()
    && !contents.isDestroyed() && options.isCurrent();

  /** @returns {void} 清理该窗口自己的首帧看门狗。 */
  function clearShowTimer() {
    if (showTimer) clearTimeout(showTimer);
    showTimer = null;
  }

  /** @returns {boolean} 不抢焦点地显示并重画，重发最新而非创建时的歌词状态。 */
  function show() {
    if (!isCurrent()) return false;
    clearShowTimer();
    try {
      if (win.isMinimized()) win.restore();
      if (!win.isAlwaysOnTop()) win.setAlwaysOnTop(true, 'screen-saver');
      if (!win.isVisible()) win.showInactive();
      win.moveTop();
      contents.invalidate();
      options.syncState();
      return true;
    } catch (error) {
      log('Desktop lyrics reveal failed:', error.message);
      return false;
    }
  }

  /** @returns {void} 只在原生可见性失常时补救，正常窗口没有常驻重画轮询。 */
  function scheduleVisibilityRecovery() {
    if (!isCurrent() || visibilityTimer) return;
    visibilityTimer = setTimeout(() => {
      visibilityTimer = null;
      if (!isCurrent()) return;
      if (win.isMinimized() || !win.isVisible() || !win.isAlwaysOnTop()) show();
    }, 120);
    if (visibilityTimer.unref) visibilityTimer.unref();
  }

  /** @returns {void} 清除本次无响应宽限期。 */
  function clearUnresponsiveTimer() {
    if (unresponsiveTimer) clearTimeout(unresponsiveTimer);
    unresponsiveTimer = null;
  }

  /** @returns {void} 仅连续健康一分钟重置预算，不能用 load -> crash 循环刷额度。 */
  function resetBudgetAfterStableLoad() {
    if (healthySince !== null && now() - healthySince >= 60000) attempts = 0;
    healthySince = null;
  }

  /** @returns {void} ready-to-show 丢失或首帧卡住时也不能永久保持 show:false。 */
  function armShowTimer() {
    clearShowTimer();
    if (!isCurrent()) return;
    showTimer = setTimeout(show, 2000);
    if (showTimer.unref) showTimer.unref();
  }

  /** @returns {void} 失败事件和 loadURL Promise 共用同一个有限重试入口。 */
  function recover(reason) {
    if (!isCurrent()) return;
    clearUnresponsiveTimer();
    if (retryTimer) {
      // 无响应等待中再发生崩溃，迟到的 responsive 不能取消真正的故障恢复。
      if (reason !== 'unresponsive') retryReason = reason;
      return;
    }
    resetBudgetAfterStableLoad();
    if (attempts >= 3) {
      log('Desktop lyrics recovery limit reached:', reason);
      return;
    }
    attempts += 1;
    retryReason = reason;
    log('Desktop lyrics recovering:', reason);
    retryTimer = setTimeout(() => {
      retryTimer = null;
      retryReason = '';
      if (isCurrent()) load();
    }, Math.min(2000, 200 * Math.pow(2, attempts - 1)));
    if (retryTimer.unref) retryTimer.unref();
  }

  /** @returns {void} 每次重新加载均补上显示看门狗，不依赖一次性的 ready 事件。 */
  function load() {
    if (!isCurrent()) return;
    const generation = ++loadGeneration;
    healthySince = null;
    armShowTimer();
    try {
      win.loadURL(options.url).catch(error => {
        if (generation !== loadGeneration) return;
        if (error.code !== 'ERR_ABORTED' && error.errno !== -3) recover(error.message);
      });
    } catch (error) {
      recover(error.message);
    }
  }

  /** @returns {void} 每次 load（包括崩溃恢复）完成都显示并补发完整状态。 */
  function loaded() {
    if (!isCurrent()) return;
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
    retryReason = '';
    clearUnresponsiveTimer();
    healthySince = now();
    show();
    // 不在 did-finish-load 清 attempts：连续 load -> crash 不得变成无限重载。
  }

  /** @returns {void} 短暂繁忙先等五秒；持续无响应共用有限重载预算。 */
  function unresponsive() {
    if (!isCurrent() || unresponsiveTimer || retryTimer) return;
    resetBudgetAfterStableLoad();
    unresponsiveTimer = setTimeout(() => {
      unresponsiveTimer = null;
      recover('unresponsive');
    }, 5000);
    if (unresponsiveTimer.unref) unresponsiveTimer.unref();
  }

  /** @returns {void} 页面自行恢复后取消尚未开始的无响应重载，不取消真正崩溃重试。 */
  function responsive() {
    if (!isCurrent()) return;
    clearUnresponsiveTimer();
    if (retryTimer && retryReason === 'unresponsive') {
      clearTimeout(retryTimer);
      retryTimer = null;
      retryReason = '';
    }
    healthySince = now();
  }

  /** @returns {void} 关闭后清掉全部定时器，即使旧窗口仍收到事件也不再行动。 */
  function dispose() {
    disposed = true;
    clearShowTimer();
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
    if (visibilityTimer) clearTimeout(visibilityTimer);
    visibilityTimer = null;
    clearUnresponsiveTimer();
  }

  win.once('ready-to-show', show);
  win.on('hide', scheduleVisibilityRecovery);
  win.on('minimize', scheduleVisibilityRecovery);
  win.on('always-on-top-changed', (_event, onTop) => {
    if (!onTop) scheduleVisibilityRecovery();
  });
  win.on('unresponsive', unresponsive);
  win.on('responsive', responsive);
  contents.on('did-start-loading', armShowTimer);
  contents.on('did-finish-load', loaded);
  contents.on('did-fail-load', (_event, code, description, _url, isMainFrame) => {
    if (code !== -3 && isMainFrame !== false) recover(description || String(code));
  });
  contents.on('render-process-gone', (_event, details) => recover(details.reason));
  win.once('closed', dispose);
  return { load, show, dispose };
}

module.exports = { createDesktopLyricsRecovery };
