'use strict';

/**
 * 为透明歌词窗口提供独立于首帧事件的显示与有限加载恢复。
 * 每个实例独占定时器；旧窗口、关闭状态和退出中的应用不得被迟到回调唤醒。
 * @param {Electron.BrowserWindow} win 歌词窗口。
 * @param {{isCurrent:Function,syncState:Function,url:string,log?:Function}} options 生命周期接缝。
 * @returns {{load:Function,show:Function,dispose:Function}} 加载、重画和释放入口。
 */
function createDesktopLyricsRecovery(win, options) {
  const contents = win.webContents;
  const log = options.log || console.warn;
  let disposed = false;
  let showTimer = null;
  let retryTimer = null;
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
      if (!win.isAlwaysOnTop()) win.setAlwaysOnTop(true, 'screen-saver');
      if (!win.isVisible()) win.showInactive();
      contents.invalidate();
      options.syncState();
      return true;
    } catch (error) {
      log('Desktop lyrics reveal failed:', error.message);
      return false;
    }
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
    if (!isCurrent() || retryTimer) return;
    if (attempts >= 3) {
      log('Desktop lyrics recovery limit reached:', reason);
      return;
    }
    attempts += 1;
    log('Desktop lyrics recovering:', reason);
    retryTimer = setTimeout(() => {
      retryTimer = null;
      if (isCurrent()) load();
    }, Math.min(2000, 200 * Math.pow(2, attempts - 1)));
    if (retryTimer.unref) retryTimer.unref();
  }

  /** @returns {void} 每次重新加载均补上显示看门狗，不依赖一次性的 ready 事件。 */
  function load() {
    if (!isCurrent()) return;
    armShowTimer();
    try {
      win.loadURL(options.url).catch(error => {
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
    show();
    // 不在 did-finish-load 清 attempts：连续 load -> crash 不得变成无限重载。
  }

  /** @returns {void} 关闭后清掉全部定时器，即使旧窗口仍收到事件也不再行动。 */
  function dispose() {
    disposed = true;
    clearShowTimer();
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
  }

  win.once('ready-to-show', show);
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
