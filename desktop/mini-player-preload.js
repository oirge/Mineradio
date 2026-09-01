const { contextBridge, ipcRenderer } = require('electron');

/**
 * 判断当前 preload 所属文档是否为本地迷你播放器页面。
 * 只允许主进程当前端口上的两份迷你页面，避免同窗导航到外部文档后继续获得特权桥。
 * @returns {boolean} 当前文档可信时返回 true。
 */
function isTrustedMiniPlayerDocument() {
  try {
    const href = window && window.location && typeof window.location.href === 'string'
      ? window.location.href
      : '';
    const parsed = new URL(href);
    if (parsed.protocol !== 'http:' || parsed.hostname !== '127.0.0.1') return false;
    const expectedPort = Number(
      typeof process !== 'undefined' && process.env && process.env.PORT
        ? process.env.PORT
        : 3000,
    );
    if (!expectedPort || Number(parsed.port || 0) !== expectedPort) return false;
    return parsed.pathname === '/mini-player.html' || parsed.pathname === '/mini-player-compact.html';
  } catch (_error) {
    return false;
  }
}

if (isTrustedMiniPlayerDocument()) contextBridge.exposeInMainWorld('miniPlayer', {
  command: (action) => ipcRenderer.invoke('mineradio-mini-player-command', String(action || '')),
  /**
   * 请求主进程按封面拖动偏移移动迷你播放器窗口。
   * @param {number} dx 水平位移。
   * @param {number} dy 垂直位移。
   * @param {boolean} commit 是否为拖动结束并保存最终坐标。
   * @param {{generation:number,anchor?:{x:number,y:number},layout?:'collapsed'|'expanded'}=} dragMeta
   *   renderer 生成的拖动代际、首帧锚点和布局状态。
   * @returns {Promise<{ok:boolean,ignored?:boolean,error?:string}>} 主进程移动结果。
   */
  moveBy: (dx, dy, commit, dragMeta) => ipcRenderer.invoke(
    'mineradio-mini-player-move-by',
    Number(dx) || 0,
    Number(dy) || 0,
    commit === true,
    dragMeta,
  ),
  /**
   * 请求主进程按迷你外壳空白区的拖动偏移移动窗口；不进入封面拖动代际会话。
   * @param {number} dx 水平位移。
   * @param {number} dy 垂直位移。
   * @param {boolean} commit 是否为拖动结束并保存最终坐标。
   * @param {'collapsed'|'expanded'} layout 当前页面布局状态。
   * @returns {Promise<{ok:boolean,ignored?:boolean,error?:string}>} 主进程移动结果。
   */
  moveWindowBy: (dx, dy, commit, layout) => ipcRenderer.invoke(
    'mineradio-mini-player-window-move-by',
    Number(dx) || 0,
    Number(dy) || 0,
    commit === true,
    layout === 'collapsed' ? 'collapsed' : 'expanded',
  ),
  /**
   * 同步确认窗口命中状态；收回态封面刚被命中时，右键不能等待异步 IPC 回执。
   * @param {boolean} passthrough 是否让出窗口鼠标事件。
   * @returns {{ok:boolean,ignored?:boolean,error?:string}} 主进程处理结果。
   */
  setPointerPassthroughSync: (passthrough) => ipcRenderer.sendSync(
    'mineradio-mini-player-set-pointer-passthrough-sync',
    passthrough === true,
  ),
  /**
   * 请求主进程在收回态让出窗口鼠标事件，只保留封面热区参与命中。
   * @param {boolean} passthrough 是否让出窗口鼠标事件。
   * @returns {Promise<{ok:boolean,ignored?:boolean,error?:string}>} 主进程处理结果。
   */
  setPointerPassthrough: (passthrough) => ipcRenderer.invoke(
    'mineradio-mini-player-set-pointer-passthrough',
    passthrough === true,
  ),
  onState: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload || {});
    ipcRenderer.on('mineradio-mini-player-state', listener);
    return () => ipcRenderer.removeListener('mineradio-mini-player-state', listener);
  },
});
