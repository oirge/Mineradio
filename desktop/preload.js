const { contextBridge, ipcRenderer } = require('electron');

const PERSISTENT_UI_STATE_KEYS = [
  'apex-player-volume',
  'mineradio-lyric-layout-v1',
  'mineradio-playback-quality-v1',
  'mineradio-diy-player-mode-v1',
  'mineradio-playlist-panel-pinned-v1',
  'mineradio-user-capsule-auto-hide-v1',
  'mineradio-fx-fab-auto-hide-v1',
  'mineradio-controls-auto-hide-v1',
  'mineradio-free-camera-v1',
  'mineradio-local-library-folder-v1',
  'mineradio-playback-session-v1',
  'mineradio-special-liked-playlist-v1',
  'mineradio-local-playlists-v1',
  'mineradio-local-playback-source-v1',
  'mineradio-user-fx-archives-v1',
  'mineradio-plugins-v1',
  'mineradio-hotkey-settings-v1',
  'mineradio-visual-guide-seen-v2',
  'mineradio-upload-tip-seen',
];

function restorePersistentUiState() {
  try {
    const values = ipcRenderer.sendSync('mineradio-ui-state-read-sync') || {};
    PERSISTENT_UI_STATE_KEYS.forEach((key) => {
      if (typeof values[key] !== 'string') return;
      if (window.localStorage.getItem(key) != null) return;
      window.localStorage.setItem(key, values[key]);
    });
  } catch (_e) {}
}

restorePersistentUiState();

contextBridge.exposeInMainWorld('desktopWindow', {
  isDesktop: true,
  minimize: () => ipcRenderer.invoke('desktop-window-minimize'),
  toggleMaximize: () => ipcRenderer.invoke('desktop-window-toggle-maximize'),
  toggleFullscreen: () => ipcRenderer.invoke('desktop-window-toggle-fullscreen'),
  exitFullscreenWindowed: () => ipcRenderer.invoke('desktop-window-exit-fullscreen-windowed'),
  getState: () => ipcRenderer.invoke('desktop-window-get-state'),
  close: () => ipcRenderer.invoke('desktop-window-close'),
  getTraySettings: () => ipcRenderer.invoke('mineradio-tray-get-settings'),
  setCloseToTray: (enabled) => ipcRenderer.invoke('mineradio-tray-set-close-to-tray', !!enabled),
  setMiniPlayerEnabled: (enabled) => ipcRenderer.invoke('mineradio-mini-player-set-enabled', !!enabled),
  setMiniPlayerMode: (mode) => ipcRenderer.invoke('mineradio-mini-player-set-mode', String(mode || '')),
  prepareMiniPlayerTransition: () => ipcRenderer.invoke('mineradio-mini-player-prepare-transition'),
  updateMiniPlayer: (payload) => ipcRenderer.invoke('mineradio-mini-player-update', payload || {}),
  setStartupEnabled: (enabled) => ipcRenderer.invoke('mineradio-startup-set-enabled', !!enabled),
  openUpdateInstaller: (filePath) => ipcRenderer.invoke('mineradio-open-update-installer', filePath),
  restartApp: () => ipcRenderer.invoke('mineradio-restart-app'),
  configureGlobalHotkeys: (bindings) => ipcRenderer.invoke('mineradio-hotkeys-configure-global', bindings || []),
  exportJsonFile: (payload) => ipcRenderer.invoke('mineradio-export-json-file', payload || {}),
  importJsonFile: () => ipcRenderer.invoke('mineradio-import-json-file'),
  importPluginFile: () => ipcRenderer.invoke('mineradio-import-plugin-file'),
  backupUiState: (patch) => ipcRenderer.invoke('mineradio-ui-state-write', patch || {}),
  chooseLocalMusicFolder: () => ipcRenderer.invoke('mineradio-local-music-choose-folder'),
  scanLocalMusicFolder: (folderPath, options) => ipcRenderer.invoke('mineradio-local-music-scan-folder', folderPath, options || {}),
  refreshLocalMusicFiles: (folderPath, files) => ipcRenderer.invoke('mineradio-local-music-refresh-entries', folderPath, files || []),
  readLocalFileRange: (filePath, start, end) => ipcRenderer.invoke('mineradio-local-file-read-range', filePath, start, end),
  readLocalFileDataUrl: (filePath) => ipcRenderer.invoke('mineradio-local-file-read-data-url', filePath),
  onGlobalHotkey: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload || {});
    ipcRenderer.on('mineradio-global-hotkey', listener);
    return () => ipcRenderer.removeListener('mineradio-global-hotkey', listener);
  },
  onMiniPlayerCommand: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload || {});
    ipcRenderer.on('mineradio-mini-player-command', listener);
    return () => ipcRenderer.removeListener('mineradio-mini-player-command', listener);
  },
  /**
   * 订阅托盘或迷你播放器原生菜单修改后的真实桌面壳设置。
   * @param {Function} callback 接收设置快照的回调。
   * @returns {Function} 解除当前监听的函数。
   */
  onDesktopShellSettingsChanged: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload || {});
    ipcRenderer.on('mineradio-desktop-shell-settings-changed', listener);
    return () => ipcRenderer.removeListener('mineradio-desktop-shell-settings-changed', listener);
  },
  setDesktopLyricsEnabled: (enabled, payload) => ipcRenderer.invoke('mineradio-desktop-lyrics-set-enabled', !!enabled, payload || {}),
  updateDesktopLyrics: (payload) => ipcRenderer.invoke('mineradio-desktop-lyrics-update', payload || {}),
  onDesktopLyricsLockState: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload || {});
    ipcRenderer.on('mineradio-desktop-lyrics-lock-state', listener);
    return () => ipcRenderer.removeListener('mineradio-desktop-lyrics-lock-state', listener);
  },
  onDesktopLyricsEnabledState: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload || {});
    ipcRenderer.on('mineradio-desktop-lyrics-enabled-state', listener);
    return () => ipcRenderer.removeListener('mineradio-desktop-lyrics-enabled-state', listener);
  },
  onDesktopLyricsSizeRequest: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload || {});
    ipcRenderer.on('mineradio-desktop-lyrics-size-request', listener);
    return () => ipcRenderer.removeListener('mineradio-desktop-lyrics-size-request', listener);
  },
  onDesktopLyricsStableRequest: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload || {});
    ipcRenderer.on('mineradio-desktop-lyrics-stable-request', listener);
    return () => ipcRenderer.removeListener('mineradio-desktop-lyrics-stable-request', listener);
  },
  onDesktopLyricsGlowStrengthRequest: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload || {});
    ipcRenderer.on('mineradio-desktop-lyrics-glow-strength-request', listener);
    return () => ipcRenderer.removeListener('mineradio-desktop-lyrics-glow-strength-request', listener);
  },
  setWallpaperMode: (enabled, payload) => ipcRenderer.invoke('mineradio-wallpaper-set-enabled', !!enabled, payload || {}),
  updateWallpaperMode: (payload) => ipcRenderer.invoke('mineradio-wallpaper-update', payload || {}),
  listWallpaperEngineProjects: (payload) => ipcRenderer.invoke('mineradio-wallpaper-engine-list', payload || {}),
  getWallpaperEngineProjectDetails: (id) => ipcRenderer.invoke('mineradio-wallpaper-engine-project-details', String(id || '')),
  openWallpaperEngineProjectDetails: (id, target) => ipcRenderer.invoke('mineradio-wallpaper-engine-open-project-details', {
    id: String(id || ''),
    target: String(target || ''),
  }),
  chooseWallpaperEngineDirectory: () => ipcRenderer.invoke('mineradio-wallpaper-engine-choose-directory'),
  chooseWallpaperEngineProjectFile: () => ipcRenderer.invoke('mineradio-wallpaper-engine-choose-project-file'),
  removeWallpaperEngineDirectory: (rootId) => ipcRenderer.invoke('mineradio-wallpaper-engine-remove-directory', String(rootId || '')),
  getWallpaperEngineRuntimeStatus: (payload) => ipcRenderer.invoke('mineradio-wallpaper-engine-runtime-status', payload || {}),
  startWallpaperEngineScene: (payload) => ipcRenderer.invoke('mineradio-wallpaper-engine-start-scene', payload || {}),
  reportWallpaperEngineCaptureResult: (payload) => ipcRenderer.invoke('mineradio-wallpaper-engine-capture-result', payload || {}),
  prepareWallpaperEngineGlassCapture: (payload) => ipcRenderer.invoke('mineradio-wallpaper-engine-prepare-glass-capture', payload || {}),
  activateWallpaperEngineDwmSurface: (payload) => ipcRenderer.invoke('mineradio-wallpaper-engine-activate-dwm-surface', payload || {}),
  updateWallpaperEngineGlassSurface: (payload) => ipcRenderer.send('mineradio-wallpaper-engine-glass-surface', payload || {}),
  reportWallpaperEnginePointerActivity: (payload) => ipcRenderer.send('mineradio-wallpaper-engine-pointer-activity', payload || {}),
  stopWallpaperEngineScene: (payload) => ipcRenderer.invoke('mineradio-wallpaper-engine-stop-scene', payload || {}),
  onWallpaperEngineHostBoundsChanged: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload || {});
    ipcRenderer.on('mineradio-wallpaper-engine-host-bounds-changed', listener);
    return () => ipcRenderer.removeListener('mineradio-wallpaper-engine-host-bounds-changed', listener);
  },
  onStateChange: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('desktop-window-state', listener);
    return () => ipcRenderer.removeListener('desktop-window-state', listener);
  },
});

window.addEventListener('DOMContentLoaded', () => {
  document.documentElement.classList.add('desktop-shell-root');
  document.body.classList.add('desktop-shell');
});
