'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// This paint-only surface receives no filesystem, desktop, library or playback privileges.
contextBridge.exposeInMainWorld('mineradioVideoExport', {
  getInitial: () => ipcRenderer.invoke('mineradio-video-export-initial'),
  onUpdate: callback => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('mineradio-video-export-update', listener);
    return () => ipcRenderer.removeListener('mineradio-video-export-update', listener);
  },
  ready: () => ipcRenderer.invoke('mineradio-video-export-ready'),
  failed: message => ipcRenderer.send('mineradio-video-export-renderer-failed', String(message || '')),
});
