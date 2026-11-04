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
  onFinalize: callback => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('mineradio-video-export-finalize', listener);
    return () => ipcRenderer.removeListener('mineradio-video-export-finalize', listener);
  },
  readRecording: payload => ipcRenderer.invoke('mineradio-video-export-read-recording', payload),
  writeFinalized: payload => ipcRenderer.invoke('mineradio-video-export-write-finalized', payload),
  finalized: id => ipcRenderer.invoke('mineradio-video-export-finalized', { id }),
  encodingProgress: (id, progress) => ipcRenderer.send('mineradio-video-export-encoding-progress', { id, progress }),
  failed: message => ipcRenderer.send('mineradio-video-export-renderer-failed', String(message || '')),
});
