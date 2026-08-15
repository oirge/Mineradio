const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('miniPlayer', {
  command: (action) => ipcRenderer.invoke('mineradio-mini-player-command', String(action || '')),
  /**
   * 请求主进程按封面拖动偏移移动迷你播放器窗口。
   * @param {number} dx 水平位移。
   * @param {number} dy 垂直位移。
   * @param {boolean} commit 是否为拖动结束并保存最终坐标。
   * @returns {Promise<{ok:boolean,ignored?:boolean,error?:string}>} 主进程移动结果。
   */
  moveBy: (dx, dy, commit) => ipcRenderer.invoke(
    'mineradio-mini-player-move-by',
    Number(dx) || 0,
    Number(dy) || 0,
    commit === true,
  ),
  onState: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload || {});
    ipcRenderer.on('mineradio-mini-player-state', listener);
    return () => ipcRenderer.removeListener('mineradio-mini-player-state', listener);
  },
});
