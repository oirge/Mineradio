const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('miniPlayer', {
  command: (action) => ipcRenderer.invoke('mineradio-mini-player-command', String(action || '')),
  onState: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload || {});
    ipcRenderer.on('mineradio-mini-player-state', listener);
    return () => ipcRenderer.removeListener('mineradio-mini-player-state', listener);
  },
});
