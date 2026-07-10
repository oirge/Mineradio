const { app, BrowserWindow, ipcMain, shell, screen, powerMonitor, globalShortcut, dialog, Tray, Menu } = require('electron');
const net = require('net');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const crypto = require('crypto');
const { execFile, spawn } = require('child_process');

let mainWindow = null;
let localServer = null;
let mainServerPort = 0;
let desktopLyricsWindow = null;
let desktopLyricsState = {};
let desktopLyricsUserBounds = null;
let desktopLyricsProgrammaticMove = false;
let desktopLyricsPointerCapture = false;
let desktopLyricsMouseIgnored = null;
let desktopLyricsLastStateSignature = '';
let desktopLyricsLastOpacity = null;
let desktopLyricsMousePoller = null;
let desktopLyricsMousePollerBuffer = '';
let desktopLyricsHotBounds = null;
let desktopLyricsLastMiddleAt = 0;
let wallpaperWindow = null;
let wallpaperState = {};
let miniPlayerWindow = null;
let miniPlayerEnabled = true;
let miniPlayerActive = false;
let miniPlayerUserBounds = null;
let miniPlayerUserMovePending = false;
let miniPlayerSavedBoundsSignature = '';
let miniPlayerLastSentState = null;
let miniPlayerRecoveryTimer = null;
let miniPlayerRecreateTimer = null;
const miniPlayerProgrammaticCloseWindows = new WeakSet();
let miniPlayerState = {
  title: 'Mineradio',
  artist: '',
  cover: '',
  playing: false,
  hasTrack: false,
  metaSignature: '',
};
let htmlFullscreenActive = false;
let windowFullscreenActive = false;
let mainWindowStateTimer = null;
let tray = null;
let closeToTrayEnabled = true;
let appQuitting = false;
const registeredGlobalHotkeys = new Map();
const authorizedLocalMusicRoots = new Set();

const WINDOWED_ASPECT = 16 / 9;
const WINDOWED_SCALE = 3 / 4;
const WINDOWED_MARGIN = 32;
const MIN_WINDOWED_WIDTH = 960;
const MIN_WINDOWED_HEIGHT = 540;
const MINI_PLAYER_WIDTH = 360;
const MINI_PLAYER_HEIGHT = 84;
const MINI_PLAYER_MARGIN = 14;
const MINI_PLAYER_RECOVERY_INTERVAL = 5000;
const APP_NAME = 'Mineradio';
const APP_USER_MODEL_ID = 'com.mineradio.desktop';
const APP_ICON_ICO = path.join(__dirname, '..', 'build', 'icon.ico');
const LOCAL_FILE_TOKEN = crypto.randomBytes(16).toString('hex');
const DESKTOP_SHELL_SETTINGS_FILE = 'desktop-shell-settings.json';
const DESKTOP_UI_STATE_FILE = 'desktop-ui-state.json';
const DESKTOP_UI_STATE_KEYS = new Set([
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
  'mineradio-user-fx-archives-v1',
  'mineradio-hotkey-settings-v1',
  'mineradio-visual-guide-seen-v2',
  'mineradio-upload-tip-seen',
]);

const CHROMIUM_PERFORMANCE_SWITCHES = [
  ['autoplay-policy', 'no-user-gesture-required'],
  ['ignore-gpu-blocklist'],
  ['enable-gpu-rasterization'],
  ['enable-oop-rasterization'],
  ['enable-zero-copy'],
  ['enable-accelerated-2d-canvas'],
  ['disable-background-timer-throttling'],
  ['disable-renderer-backgrounding'],
  ['disable-backgrounding-occluded-windows'],
  ['force_high_performance_gpu'],
  ['use-angle', 'd3d11'],
];
for (const [name, value] of CHROMIUM_PERFORMANCE_SWITCHES) {
  if (value == null) app.commandLine.appendSwitch(name);
  else app.commandLine.appendSwitch(name, value);
}
const gotSingleInstanceLock = app.requestSingleInstanceLock();

function findOpenPort(startPort) {
  return new Promise((resolve, reject) => {
    function tryPort(port) {
      const tester = net.createServer();

      tester.once('error', (err) => {
        if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
          tryPort(port + 1);
          return;
        }
        reject(err);
      });

      tester.once('listening', () => {
        tester.close(() => resolve(port));
      });

      tester.listen(port, '127.0.0.1');
    }

    tryPort(startPort);
  });
}

function waitForServer(server) {
  if (!server || server.listening) return Promise.resolve();

  return new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
}

const LOCAL_LIBRARY_EXTS = new Set(['.mp3', '.flac', '.lrc', '.txt', '.jpg', '.jpeg', '.png', '.webp']);
const LOCAL_LIBRARY_MIME = {
  '.mp3': 'audio/mpeg',
  '.flac': 'audio/flac',
  '.lrc': 'text/plain',
  '.txt': 'text/plain',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};
const LOCAL_LIBRARY_SCAN_STAT_CONCURRENCY = 24;
const LOCAL_LIBRARY_SCAN_VISIT_LIMIT = 60000;
const LOCAL_LIBRARY_INCREMENTAL_MAX_AGE_MS = 12 * 60 * 60 * 1000;

function localLibraryScanStatConcurrency(count) {
  count = Math.max(0, Number(count) || 0);
  if (count >= 24000) return 8;
  if (count >= 12000) return 10;
  if (count >= 5000) return 12;
  if (count >= 1200) return 16;
  return LOCAL_LIBRARY_SCAN_STAT_CONCURRENCY;
}

function yieldLocalLibraryScanTurn() {
  return new Promise((resolve) => setImmediate(resolve));
}

function normalizeLocalMusicRoot(folderPath) {
  const resolved = path.resolve(String(folderPath || ''));
  const stat = fs.statSync(resolved);
  if (!stat.isDirectory()) throw new Error('LOCAL_LIBRARY_NOT_DIRECTORY');
  return resolved;
}

function rememberLocalMusicRoot(folderPath) {
  const root = normalizeLocalMusicRoot(folderPath);
  authorizedLocalMusicRoots.add(root);
  return root;
}

function resolveAuthorizedLocalFile(filePath) {
  const target = path.resolve(String(filePath || ''));
  for (const root of authorizedLocalMusicRoots) {
    if (target === root || target.startsWith(root + path.sep)) return target;
  }
  throw new Error('LOCAL_FILE_NOT_AUTHORIZED');
}

function localLibraryRelativePath(root, relPath) {
  return path.join(path.basename(root), relPath).replace(/\\/g, '/');
}

function isPathInsideLocalLibraryRoot(root, absPath) {
  const rel = path.relative(root, absPath);
  return rel === '' || (!!rel && !rel.startsWith('..') && !path.isAbsolute(rel));
}

function normalizeLocalLibraryRelPath(relPath) {
  return String(relPath || '').replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+/g, '/');
}

function localLibraryRelPathFromRecord(root, record) {
  if (!record) return '';
  const fullPath = record.fullPath || record.filePath || record.path || record.localFilePathAbsolute || '';
  if (fullPath) {
    const abs = path.resolve(String(fullPath));
    if (isPathInsideLocalLibraryRoot(root, abs)) return normalizeLocalLibraryRelPath(path.relative(root, abs));
  }
  let rel = record.relativePath || record.webkitRelativePath || record.name || '';
  rel = normalizeLocalLibraryRelPath(rel);
  const rootBase = normalizeLocalLibraryRelPath(path.basename(root));
  if (rootBase && (rel === rootBase || rel.startsWith(rootBase + '/'))) rel = rel.slice(rootBase.length).replace(/^\/+/, '');
  if (!rel || rel.split('/').includes('..')) return '';
  return rel;
}

function localLibraryDirRelPath(relPath) {
  const dir = normalizeLocalLibraryRelPath(path.dirname(String(relPath || '')));
  return dir === '.' ? '' : dir;
}

function localFileProxyUrl(filePath) {
  if (!mainServerPort) return pathToFileURL(filePath).href;
  return `http://127.0.0.1:${mainServerPort}/api/local-file?token=${encodeURIComponent(LOCAL_FILE_TOKEN)}&path=${encodeURIComponent(filePath)}`;
}

function makeLocalLibraryFileRecord(root, item, stat) {
  const webkitRelativePath = localLibraryRelativePath(root, item.rel);
  return {
    ...(item.source || {}),
    fullPath: item.abs,
    filePath: item.abs,
    url: localFileProxyUrl(item.abs),
    name: item.entry.name,
    relativePath: webkitRelativePath,
    webkitRelativePath,
    size: stat.size,
    lastModified: Math.round(stat.mtimeMs),
    type: LOCAL_LIBRARY_MIME[item.ext] || '',
  };
}

function rehydrateLocalLibraryFileRecord(root, record, relPath) {
  const rel = normalizeLocalLibraryRelPath(relPath || localLibraryRelPathFromRecord(root, record));
  if (!rel) return null;
  const abs = path.resolve(root, rel);
  if (!isPathInsideLocalLibraryRoot(root, abs)) return null;
  const ext = path.extname(record && record.name || abs).toLowerCase();
  if (!LOCAL_LIBRARY_EXTS.has(ext)) return null;
  const webkitRelativePath = localLibraryRelativePath(root, rel);
  return {
    ...(record || {}),
    fullPath: abs,
    filePath: abs,
    url: localFileProxyUrl(abs),
    name: (record && record.name) || path.basename(abs),
    relativePath: webkitRelativePath,
    webkitRelativePath,
    size: Number(record && record.size) || 0,
    lastModified: Number(record && record.lastModified) || 0,
    type: (record && record.type) || LOCAL_LIBRARY_MIME[ext] || '',
  };
}

function makeLocalLibraryDirectoryRecord(root, relPath, stat) {
  const rel = normalizeLocalLibraryRelPath(relPath);
  return {
    fullPath: path.join(root, rel),
    relativePath: rel,
    lastModified: Math.round(stat.mtimeMs),
  };
}

/**
 * 并发执行本地库文件 stat。大曲库逐个 await 会把文件夹导入时间拉长，这里限制并发避免压满磁盘队列。
 * @param {string} root 已授权的本地曲库根目录。
 * @param {Array<{abs:string, rel:string, entry:{name:string}, ext:string, index:number, source?:object}>} items 待读取元数据的文件。
 * @returns {Promise<Array<object>>} 可直接返回给渲染层的文件描述。
 */
async function statLocalLibraryFiles(root, items) {
  const files = [];
  let cursor = 0;
  let processed = 0;
  let found = 0;
  /**
   * 消费共享游标读取文件元数据；共享游标只在当前事件循环同步递增，不会改变最终排序。
   * @returns {Promise<void>} 当前 worker 完成时 resolve。
   */
  async function worker() {
    while (cursor < items.length) {
      const item = items[cursor++];
      processed += 1;
      if (processed % 160 === 0) await yieldLocalLibraryScanTurn();
      let stat = null;
      try {
        stat = await fs.promises.stat(item.abs);
      } catch (_e) {
        continue;
      }
      if (!stat.isFile()) continue;
      files[item.index] = makeLocalLibraryFileRecord(root, item, stat);
      found += 1;
    }
  }
  const workerCount = Math.min(localLibraryScanStatConcurrency(items.length), Math.max(1, items.length));
  const workers = new Array(workerCount);
  for (let i = 0; i < workerCount; i += 1) workers[i] = worker();
  await Promise.all(workers);
  const compact = new Array(found);
  let write = 0;
  for (let i = 0; i < files.length; i += 1) {
    if (files[i]) compact[write++] = files[i];
  }
  return compact;
}

async function collectLocalLibraryFolderEntries(root) {
  const files = [];
  const directories = [];
  const stack = [''];
  let visited = 0;
  let scannedDirs = 0;
  while (stack.length) {
    const relDir = stack.pop();
    const absDir = path.join(root, relDir);
    scannedDirs += 1;
    if (scannedDirs % 32 === 0) await yieldLocalLibraryScanTurn();
    let dirStat = null;
    try {
      dirStat = await fs.promises.stat(absDir);
    } catch (_e) {
      continue;
    }
    if (!dirStat.isDirectory()) continue;
    directories.push(makeLocalLibraryDirectoryRecord(root, relDir, dirStat));
    let entries = [];
    try {
      entries = await fs.promises.readdir(absDir, { withFileTypes: true });
    } catch (_e) {
      continue;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN', { numeric: true, sensitivity: 'base' }));
    for (const entry of entries) {
      visited += 1;
      if (visited % 360 === 0) await yieldLocalLibraryScanTurn();
      if (visited > LOCAL_LIBRARY_SCAN_VISIT_LIMIT) break;
      const rel = path.join(relDir, entry.name);
      const abs = path.join(root, rel);
      if (entry.isDirectory()) {
        stack.push(rel);
        continue;
      }
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!LOCAL_LIBRARY_EXTS.has(ext)) continue;
      files.push({ abs, rel, entry, ext, index: files.length });
    }
    if (visited > LOCAL_LIBRARY_SCAN_VISIT_LIMIT) break;
  }
  return { files, directories, truncated: visited > LOCAL_LIBRARY_SCAN_VISIT_LIMIT };
}

function normalizeLocalLibraryPreviousSnapshot(snapshot) {
  const source = Array.isArray(snapshot) ? { files: snapshot } : (snapshot || {});
  const files = Array.isArray(source.files) ? source.files : [];
  const directories = Array.isArray(source.directories) ? source.directories : [];
  return { files, directories, truncated: !!source.truncated, savedAt: Number(source.savedAt) || 0 };
}

function createPreviousLocalLibraryLookups(root, snapshot) {
  const previous = normalizeLocalLibraryPreviousSnapshot(snapshot);
  const filesByRel = new Map();
  const dirsByRel = new Map();
  for (const file of previous.files) {
    const rel = localLibraryRelPathFromRecord(root, file);
    if (rel && !filesByRel.has(rel)) filesByRel.set(rel, file);
  }
  for (const dir of previous.directories) {
    let rel = normalizeLocalLibraryRelPath(dir && dir.relativePath || '');
    const fullPath = dir && (dir.fullPath || dir.path);
    if (fullPath) {
      const abs = path.resolve(String(fullPath));
      if (isPathInsideLocalLibraryRoot(root, abs)) rel = normalizeLocalLibraryRelPath(path.relative(root, abs));
    }
    dirsByRel.set(rel, dir);
  }
  return { previous, filesByRel, dirsByRel };
}

async function scanLocalMusicFolderFull(folderPath) {
  const root = rememberLocalMusicRoot(folderPath);
  const listed = await collectLocalLibraryFolderEntries(root);
  return {
    ok: true,
    folderPath: root,
    files: await statLocalLibraryFiles(root, listed.files),
    directories: listed.directories,
    truncated: listed.truncated,
    scanMode: 'full',
  };
}

async function scanLocalMusicFolderIncremental(folderPath, previousSnapshot) {
  const root = rememberLocalMusicRoot(folderPath);
  const { previous, filesByRel, dirsByRel } = createPreviousLocalLibraryLookups(root, previousSnapshot);
  if (!previous.files.length || !previous.directories.length || previous.truncated) return scanLocalMusicFolderFull(root);
  if (previous.savedAt && Date.now() - previous.savedAt > LOCAL_LIBRARY_INCREMENTAL_MAX_AGE_MS) return scanLocalMusicFolderFull(root);

  const listed = await collectLocalLibraryFolderEntries(root);
  const changedDirs = new Set();
  for (const dir of listed.directories) {
    const rel = normalizeLocalLibraryRelPath(dir.relativePath);
    const prev = dirsByRel.get(rel);
    if (!prev || Number(prev.lastModified) !== Number(dir.lastModified)) changedDirs.add(rel);
  }

  const pending = [];
  const reusedByRel = new Map();
  for (const item of listed.files) {
    const rel = normalizeLocalLibraryRelPath(item.rel);
    const previousFile = filesByRel.get(rel);
    if (!previousFile || changedDirs.has(localLibraryDirRelPath(rel))) {
      pending.push({ ...item, index: pending.length, source: previousFile || {} });
      continue;
    }
    const reused = rehydrateLocalLibraryFileRecord(root, previousFile, rel);
    if (reused) reusedByRel.set(rel, reused);
    else pending.push({ ...item, index: pending.length, source: previousFile || {} });
  }

  const fresh = await statLocalLibraryFiles(root, pending);
  const freshByRel = new Map();
  for (const file of fresh) {
    const rel = localLibraryRelPathFromRecord(root, file);
    if (rel) freshByRel.set(rel, file);
  }

  const files = [];
  for (const item of listed.files) {
    const rel = normalizeLocalLibraryRelPath(item.rel);
    const file = freshByRel.get(rel) || reusedByRel.get(rel);
    if (file) files.push(file);
  }

  return {
    ok: true,
    folderPath: root,
    files,
    directories: listed.directories,
    truncated: listed.truncated,
    scanMode: 'incremental',
    reused: reusedByRel.size,
    refreshed: fresh.length,
  };
}

async function scanLocalMusicFolder(folderPath, options) {
  const snapshot = options && options.previousSnapshot;
  if (snapshot && Array.isArray(snapshot.files) && Array.isArray(snapshot.directories)) {
    return scanLocalMusicFolderIncremental(folderPath, snapshot);
  }
  return scanLocalMusicFolderFull(folderPath);
}

async function refreshLocalMusicFileEntries(folderPath, snapshotOrFiles) {
  const root = rememberLocalMusicRoot(folderPath);
  const snapshot = normalizeLocalLibraryPreviousSnapshot(snapshotOrFiles);
  const list = snapshot.files;
  const files = [];
  for (const file of list) {
    if (!file) continue;
    const record = rehydrateLocalLibraryFileRecord(root, file);
    if (record) files.push(record);
  }
  return {
    ok: true,
    folderPath: root,
    files,
    directories: snapshot.directories,
    snapshot: true,
    restoredFromSnapshot: true,
  };
}

async function readAuthorizedLocalFileRange(filePath, start, end) {
  const target = resolveAuthorizedLocalFile(filePath);
  const stat = await fs.promises.stat(target);
  if (!stat.isFile()) throw new Error('LOCAL_FILE_NOT_FOUND');
  const fileSize = stat.size;
  const from = Math.max(0, Math.min(fileSize, Number(start) || 0));
  const requestedEnd = end == null ? fileSize : Number(end);
  const to = Math.max(from, Math.min(fileSize, Number.isFinite(requestedEnd) ? requestedEnd : fileSize));
  const maxBytes = 64 * 1024 * 1024;
  const length = Math.min(maxBytes, to - from);
  const handle = await fs.promises.open(target, 'r');
  try {
    const buffer = Buffer.alloc(length);
    const result = await handle.read(buffer, 0, length, from);
    return { ok: true, size: fileSize, start: from, end: from + result.bytesRead, base64: buffer.subarray(0, result.bytesRead).toString('base64') };
  } finally {
    await handle.close();
  }
}

async function readAuthorizedLocalFileDataUrl(filePath) {
  const target = resolveAuthorizedLocalFile(filePath);
  const ext = path.extname(target).toLowerCase();
  const mime = LOCAL_LIBRARY_MIME[ext] || 'application/octet-stream';
  if (!mime.startsWith('image/')) throw new Error('LOCAL_FILE_NOT_IMAGE');
  const stat = await fs.promises.stat(target);
  if (!stat.isFile() || stat.size > 32 * 1024 * 1024) throw new Error('LOCAL_IMAGE_TOO_LARGE');
  const buffer = await fs.promises.readFile(target);
  return { ok: true, dataUrl: `data:${mime};base64,${buffer.toString('base64')}` };
}

function sendWindowState(win) {
  if (!win || win.isDestroyed()) return;
  win.webContents.send('desktop-window-state', getWindowState(win));
}

function sendGlobalHotkeyAction(action) {
  if (!mainWindow || mainWindow.isDestroyed() || !action) return;
  mainWindow.webContents.send('mineradio-global-hotkey', { action });
}

function unregisterMineradioGlobalHotkeys() {
  for (const accelerator of registeredGlobalHotkeys.keys()) {
    try { globalShortcut.unregister(accelerator); } catch (e) {}
  }
  registeredGlobalHotkeys.clear();
}

function configureMineradioGlobalHotkeys(bindings = []) {
  unregisterMineradioGlobalHotkeys();
  const results = [];
  const seen = new Set();
  for (const item of Array.isArray(bindings) ? bindings : []) {
    const action = item && String(item.action || '').trim();
    const accelerator = item && String(item.accelerator || '').trim();
    if (!action || !accelerator || seen.has(accelerator)) continue;
    seen.add(accelerator);
    let registered = false;
    try {
      registered = globalShortcut.register(accelerator, () => sendGlobalHotkeyAction(action));
    } catch (error) {
      registered = false;
    }
    if (registered) {
      registeredGlobalHotkeys.set(accelerator, action);
      results.push({ action, accelerator, ok: true });
    } else {
      results.push({
        action,
        accelerator,
        ok: false,
        conflict: {
          sourceName: '系统 / 其他软件',
          sourceIcon: 'warning',
          reason: '该组合键已被占用或被系统保留',
        },
      });
    }
  }
  return { ok: true, results };
}

function scheduleWindowStateSend(win, delay = 80) {
  if (!win || win.isDestroyed()) return;
  if (mainWindowStateTimer) clearTimeout(mainWindowStateTimer);
  mainWindowStateTimer = setTimeout(() => {
    mainWindowStateTimer = null;
    sendWindowState(win);
  }, delay);
}

function rectsOverlapOnY(a, b) {
  if (!a || !b) return false;
  const aTop = Number(a.y) || 0;
  const bTop = Number(b.y) || 0;
  const aBottom = aTop + (Number(a.height) || 0);
  const bBottom = bTop + (Number(b.height) || 0);
  return aBottom > bTop && bBottom > aTop;
}

function getDisplayState(win) {
  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  const display = win && !win.isDestroyed()
    ? screen.getDisplayMatching(win.getBounds())
    : primary;
  const bounds = display && display.bounds ? display.bounds : primary.bounds;
  const displayId = display && display.id;
  const primaryId = primary && primary.id;
  const edgeTolerance = 2;
  const hasDisplayOnLeft = displays.some((candidate) => {
    if (!candidate || candidate.id === displayId || !candidate.bounds) return false;
    return rectsOverlapOnY(bounds, candidate.bounds)
      && Math.abs((candidate.bounds.x + candidate.bounds.width) - bounds.x) <= edgeTolerance;
  });
  const hasDisplayOnRight = displays.some((candidate) => {
    if (!candidate || candidate.id === displayId || !candidate.bounds) return false;
    return rectsOverlapOnY(bounds, candidate.bounds)
      && Math.abs((bounds.x + bounds.width) - candidate.bounds.x) <= edgeTolerance;
  });
  return {
    displayId,
    primaryDisplayId: primaryId,
    isPrimaryDisplay: !!(display && primary && display.id === primary.id),
    hasDisplayOnLeft,
    hasDisplayOnRight,
    displayBounds: bounds ? {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    } : null,
  };
}

function getWindowState(win) {
  if (!win || win.isDestroyed()) return {
    isMaximized: false,
    isNativeFullScreen: false,
    isHtmlFullScreen: false,
    isWindowFullScreen: false,
    isFullScreen: false,
    isMinimized: false,
    isVisible: false,
    isFocused: false,
    isPrimaryDisplay: true,
    hasDisplayOnLeft: false,
    hasDisplayOnRight: false,
    displayBounds: null,
  };
  return {
    isMaximized: win.isMaximized(),
    isNativeFullScreen: win.isFullScreen(),
    isHtmlFullScreen: htmlFullscreenActive,
    isWindowFullScreen: windowFullscreenActive,
    isFullScreen: win.isFullScreen() || htmlFullscreenActive || windowFullscreenActive,
    isMinimized: win.isMinimized(),
    isVisible: win.isVisible(),
    isFocused: win.isFocused(),
    ...getDisplayState(win),
  };
}

function getSenderWindow(event) {
  return BrowserWindow.fromWebContents(event.sender);
}

function focusMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  miniPlayerActive = false;
  hideMiniPlayerWindow();
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.focus();
  sendWindowState(mainWindow);
  return true;
}

/**
 * 读取桌面壳设置文件。托盘关闭策略需要早于前端加载生效，所以放在主进程持久化。
 * @returns {{closeToTray?: boolean, miniPlayer?: boolean, miniPlayerBounds?: {x:number, y:number}}} 已保存的桌面壳设置。
 */
function readDesktopShellSettings() {
  try {
    const file = path.join(app.getPath('userData'), DESKTOP_SHELL_SETTINGS_FILE);
    if (!fs.existsSync(file)) return {};
    return JSON.parse(fs.readFileSync(file, 'utf8')) || {};
  } catch (_e) {
    return {};
  }
}

/**
 * 写入桌面壳设置文件。该文件只保存主进程必须提前知道的窗口行为。
 * @param {{closeToTray?: boolean, miniPlayer?: boolean, miniPlayerBounds?: {x:number, y:number}}} patch 要覆盖的设置字段。
 * @returns {{closeToTray?: boolean, miniPlayer?: boolean, miniPlayerBounds?: {x:number, y:number}}} 写入后的完整设置。
 */
function writeDesktopShellSettings(patch) {
  const file = path.join(app.getPath('userData'), DESKTOP_SHELL_SETTINGS_FILE);
  const next = { ...readDesktopShellSettings(), ...(patch || {}) };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

function desktopUiStatePath() {
  return path.join(app.getPath('userData'), DESKTOP_UI_STATE_FILE);
}

function readDesktopUiState() {
  try {
    const file = desktopUiStatePath();
    if (!fs.existsSync(file)) return { schema: 1, values: {}, updatedAt: 0 };
    const data = JSON.parse(fs.readFileSync(file, 'utf8')) || {};
    return {
      schema: 1,
      values: data.values && typeof data.values === 'object' ? data.values : {},
      updatedAt: Number(data.updatedAt) || 0,
    };
  } catch (_e) {
    return { schema: 1, values: {}, updatedAt: 0 };
  }
}

function writeDesktopUiStatePatch(patch) {
  const current = readDesktopUiState();
  const values = { ...(current.values || {}) };
  const source = patch || {};
  for (const key in source) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
    const value = source[key];
    if (!DESKTOP_UI_STATE_KEYS.has(key)) continue;
    if (value == null) {
      delete values[key];
      continue;
    }
    const text = String(value);
    if (text.length > 2 * 1024 * 1024) continue;
    values[key] = text;
  }
  const next = { schema: 1, updatedAt: Date.now(), values };
  const file = desktopUiStatePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

/**
 * 应用已保存的桌面壳设置，确保关闭按钮行为在窗口创建前就确定。
 * @returns {void}
 */
function applySavedDesktopShellSettings() {
  const saved = readDesktopShellSettings();
  if (typeof saved.closeToTray === 'boolean') closeToTrayEnabled = saved.closeToTray;
  if (typeof saved.miniPlayer === 'boolean') miniPlayerEnabled = saved.miniPlayer;
  const restoredBounds = savedMiniPlayerBounds(saved.miniPlayerBounds);
  if (restoredBounds) {
    miniPlayerUserBounds = restoredBounds;
    miniPlayerSavedBoundsSignature = miniPlayerBoundsSignature(saved.miniPlayerBounds);
    if (miniPlayerBoundsSignature(restoredBounds) !== miniPlayerSavedBoundsSignature) persistMiniPlayerUserBounds(restoredBounds);
  }
}

/**
 * 读取 Windows 开机启动状态；开发环境和正式包都走 Electron 登录项接口。
 * @returns {boolean} 当前账号登录后是否自动启动 Mineradio。
 */
function isStartupEnabled() {
  if (process.platform !== 'win32') return false;
  try {
    return !!app.getLoginItemSettings().openAtLogin;
  } catch (_e) {
    return false;
  }
}

/**
 * 设置 Windows 开机启动。失败时直接抛错，由 IPC 返回明确错误。
 * @param {boolean} enabled 是否开启开机启动。
 * @returns {{ok:boolean, enabled:boolean}} 设置后的真实状态。
 */
function setStartupEnabled(enabled) {
  if (process.platform !== 'win32') return { ok: false, enabled: false, unsupported: true };
  app.setLoginItemSettings({
    openAtLogin: !!enabled,
    path: process.execPath,
    args: [],
  });
  return { ok: true, enabled: isStartupEnabled() };
}

/**
 * 根据当前状态重建托盘菜单，确保菜单勾选态和真实设置一致。
 * @returns {void}
 */
function refreshTrayMenu() {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '显示 Mineradio', click: focusMainWindow },
    {
      label: '关闭按钮最小化到托盘',
      type: 'checkbox',
      checked: closeToTrayEnabled,
      click: (item) => {
        closeToTrayEnabled = !!item.checked;
        writeDesktopShellSettings({ closeToTray: closeToTrayEnabled });
        refreshTrayMenu();
      },
    },
    {
      label: '最小化时显示迷你播放器',
      type: 'checkbox',
      checked: miniPlayerEnabled,
      click: (item) => setMiniPlayerEnabled(item.checked),
    },
    {
      label: '开机自动启动',
      type: 'checkbox',
      checked: isStartupEnabled(),
      click: (item) => {
        const result = setStartupEnabled(item.checked);
        if (!result.ok) item.checked = false;
        refreshTrayMenu();
      },
    },
    { type: 'separator' },
    {
      label: '退出 Mineradio',
      click: () => {
        appQuitting = true;
        app.quit();
      },
    },
  ]));
}

/**
 * 创建系统托盘入口。托盘用于恢复窗口、切换关闭到托盘和开机启动。
 * @returns {void}
 */
function createTray() {
  if (tray || process.platform !== 'win32') return;
  const icon = fs.existsSync(APP_ICON_ICO) ? APP_ICON_ICO : process.execPath;
  tray = new Tray(icon);
  tray.setToolTip(APP_NAME);
  tray.on('click', focusMainWindow);
  tray.on('double-click', focusMainWindow);
  refreshTrayMenu();
}

function getUpdateDownloadDir() {
  return path.join(app.getPath('userData'), 'updates');
}

function shouldEnsureDesktopShortcut() {
  if (process.platform !== 'win32') return false;
  if (process.env.MINERADIO_NO_DESKTOP_SHORTCUT === '1') return false;
  return app.isPackaged || process.env.MINERADIO_CREATE_DESKTOP_SHORTCUT === '1';
}

function ensureDesktopShortcut() {
  if (!shouldEnsureDesktopShortcut()) return { ok: false, skipped: true };
  try {
    const shortcutPath = path.join(app.getPath('desktop'), `${APP_NAME}.lnk`);
    const target = process.execPath;
    const shortcut = {
      target,
      cwd: path.dirname(target),
      args: '',
      description: 'Mineradio desktop music player',
      icon: fs.existsSync(APP_ICON_ICO) ? APP_ICON_ICO : target,
      iconIndex: 0,
      appUserModelId: APP_USER_MODEL_ID,
    };

    if (fs.existsSync(shortcutPath) && shell.readShortcutLink) {
      try {
        const existing = shell.readShortcutLink(shortcutPath);
        if (existing && path.resolve(existing.target || '') === path.resolve(target) && String(existing.args || '') === '') {
          return { ok: true, path: shortcutPath, existing: true };
        }
      } catch (_) {}
      shell.writeShortcutLink(shortcutPath, 'replace', shortcut);
    } else {
      shell.writeShortcutLink(shortcutPath, 'create', shortcut);
    }
    return { ok: true, path: shortcutPath, created: true };
  } catch (e) {
    console.warn('Desktop shortcut creation skipped:', e.message);
    return { ok: false, error: e.message || 'DESKTOP_SHORTCUT_FAILED' };
  }
}

function getWindowedBounds(win) {
  const display = win && !win.isDestroyed()
    ? screen.getDisplayMatching(win.getBounds())
    : screen.getPrimaryDisplay();
  const area = display.workArea;
  const basis = display.bounds || area;
  const maxWidth = Math.max(640, area.width - WINDOWED_MARGIN);
  const maxHeight = Math.max(360, area.height - WINDOWED_MARGIN);

  let width = Math.round(basis.width * WINDOWED_SCALE);
  let height = Math.round(width / WINDOWED_ASPECT);
  const scaledHeight = Math.round(basis.height * WINDOWED_SCALE);

  if (height > scaledHeight) {
    height = scaledHeight;
    width = Math.round(height * WINDOWED_ASPECT);
  }

  if (width < MIN_WINDOWED_WIDTH && maxWidth >= MIN_WINDOWED_WIDTH && maxHeight >= MIN_WINDOWED_HEIGHT) {
    width = MIN_WINDOWED_WIDTH;
    height = MIN_WINDOWED_HEIGHT;
  }

  if (width > maxWidth) {
    width = maxWidth;
    height = Math.round(width / WINDOWED_ASPECT);
  }
  if (height > maxHeight) {
    height = maxHeight;
    width = Math.round(height * WINDOWED_ASPECT);
  }

  width = Math.round(width);
  height = Math.round(height);

  return {
    x: Math.round(area.x + (area.width - width) / 2),
    y: Math.round(area.y + (area.height - height) / 2),
    width,
    height,
  };
}

function applyWindowedBounds(win) {
  if (!win || win.isDestroyed()) return;
  if (win.isMaximized()) win.unmaximize();
  win.setMinimumSize(MIN_WINDOWED_WIDTH, MIN_WINDOWED_HEIGHT);
  win.setBounds(getWindowedBounds(win), false);
  sendWindowState(win);
}

function exitFullscreenToWindow(win) {
  if (!win || win.isDestroyed()) return;
  windowFullscreenActive = false;

  if (!win.isFullScreen()) {
    applyWindowedBounds(win);
    return;
  }

  let applied = false;
  const applyOnce = () => {
    if (applied || !win || win.isDestroyed() || win.isFullScreen()) return;
    applied = true;
    applyWindowedBounds(win);
  };

  win.once('leave-full-screen', () => setTimeout(applyOnce, 50));
  win.setFullScreen(false);
  setTimeout(applyOnce, 500);
}

function toggleFullscreen(win) {
  if (!win || win.isDestroyed()) return;
  if (win.isFullScreen() || windowFullscreenActive) {
    exitFullscreenToWindow(win);
    return;
  }
  windowFullscreenActive = true;
  win.setFullScreen(true);
  sendWindowState(win);
}

function overlayUrl(page) {
  const port = mainServerPort || process.env.PORT || 3000;
  return `http://127.0.0.1:${port}/${page}`;
}

/**
 * 打开 Mineradio 官方 GitHub 链接，避免渲染层触发本机协议或任意外部站点。
 * @param {string} rawUrl 渲染层请求打开的外部链接。
 * @returns {void}
 */
function openAllowedExternalUrl(rawUrl) {
  try {
    const parsed = new URL(String(rawUrl || ''));
    const host = parsed.hostname.toLowerCase();
    if (parsed.protocol !== 'https:' || (host !== 'github.com' && host !== 'www.github.com')) return;
    if (!/^\/oirge\/Mineradio(?:\/|$)/i.test(parsed.pathname)) return;
    shell.openExternal(parsed.toString()).catch((error) => console.warn('Open external URL failed:', error.message));
  } catch (_) {}
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function desktopLyricsDefaultBounds(payload = desktopLyricsState) {
  const display = desktopLyricsUserBounds
    ? screen.getDisplayMatching(desktopLyricsUserBounds)
    : screen.getPrimaryDisplay();
  const bounds = display.bounds;
  const yRatio = clampNumber(payload.y, 0.08, 0.92, 0.76);
  const width = Math.round(Math.min(Math.max(880, bounds.width * 0.72), bounds.width - 96));
  const height = Math.round(Math.min(Math.max(340, bounds.height * 0.38), 560, bounds.height - 96));
  return {
    x: Math.round(bounds.x + (bounds.width - width) / 2),
    y: Math.round(bounds.y + bounds.height * yRatio - height / 2),
    width,
    height,
  };
}

function constrainDesktopLyricsBounds(bounds) {
  const display = screen.getDisplayMatching(bounds);
  const area = display.bounds;
  const next = {
    ...bounds,
    width: Math.round(Math.min(Math.max(320, bounds.width), area.width)),
    height: Math.round(Math.min(Math.max(180, bounds.height), area.height)),
  };
  const maxX = area.x + Math.max(0, area.width - next.width);
  const maxY = area.y + Math.max(0, area.height - next.height);
  next.x = Math.round(clampNumber(next.x, area.x, maxX, area.x));
  next.y = Math.round(clampNumber(next.y, area.y, maxY, area.y));
  return next;
}

function setDesktopLyricsBounds(bounds) {
  if (!desktopLyricsWindow || desktopLyricsWindow.isDestroyed()) return;
  const nextBounds = constrainDesktopLyricsBounds(bounds);
  const currentBounds = desktopLyricsWindow.getBounds();
  if (
    currentBounds.x === nextBounds.x
    && currentBounds.y === nextBounds.y
    && currentBounds.width === nextBounds.width
    && currentBounds.height === nextBounds.height
  ) {
    return;
  }
  desktopLyricsProgrammaticMove = true;
  desktopLyricsWindow.setBounds(nextBounds, false);
  setTimeout(() => {
    desktopLyricsProgrammaticMove = false;
  }, 120);
}

function rememberDesktopLyricsBounds() {
  if (!desktopLyricsWindow || desktopLyricsWindow.isDestroyed() || desktopLyricsProgrammaticMove) return;
  desktopLyricsUserBounds = desktopLyricsWindow.getBounds();
}

function applyDesktopLyricsMouseBehavior() {
  if (!desktopLyricsWindow || desktopLyricsWindow.isDestroyed()) return;
  const locked = desktopLyricsState.clickThrough !== false;
  const shouldIgnore = locked || !desktopLyricsPointerCapture;
  if (desktopLyricsMouseIgnored === shouldIgnore) return;
  desktopLyricsMouseIgnored = shouldIgnore;
  desktopLyricsWindow.setIgnoreMouseEvents(shouldIgnore, { forward: true });
}

function desktopLyricsHotBoundsOnScreen() {
  if (!desktopLyricsWindow || desktopLyricsWindow.isDestroyed()) return null;
  const winBounds = desktopLyricsWindow.getBounds();
  const rel = desktopLyricsHotBounds;
  if (!rel) return winBounds;
  return {
    x: winBounds.x + rel.left,
    y: winBounds.y + rel.top,
    width: Math.max(1, rel.right - rel.left),
    height: Math.max(1, rel.bottom - rel.top),
  };
}

function pointInBounds(point, bounds) {
  if (!point || !bounds) return false;
  return point.x >= bounds.x
    && point.x <= bounds.x + bounds.width
    && point.y >= bounds.y
    && point.y <= bounds.y + bounds.height;
}

function handleDesktopLyricsGlobalMiddleClick() {
  if (!desktopLyricsWindow || desktopLyricsWindow.isDestroyed()) return;
  if (!desktopLyricsState.enabled) return;
  const now = Date.now();
  if (now - desktopLyricsLastMiddleAt < 260) return;
  const point = screen.getCursorScreenPoint();
  if (!pointInBounds(point, desktopLyricsHotBoundsOnScreen())) return;
  desktopLyricsLastMiddleAt = now;
  const nextLocked = desktopLyricsState.clickThrough === false;
  desktopLyricsState = { ...desktopLyricsState, clickThrough: nextLocked };
  desktopLyricsPointerCapture = !nextLocked;
  applyDesktopLyricsMouseBehavior();
  broadcastDesktopLyricsLockState();
}

function consumeDesktopLyricsMousePollerOutput(chunk) {
  desktopLyricsMousePollerBuffer += chunk.toString('utf8');
  let lineStart = 0;
  for (let i = 0; i < desktopLyricsMousePollerBuffer.length; i += 1) {
    if (desktopLyricsMousePollerBuffer.charCodeAt(i) !== 10) continue;
    let lineEnd = i;
    if (lineEnd > lineStart && desktopLyricsMousePollerBuffer.charCodeAt(lineEnd - 1) === 13) lineEnd -= 1;
    if (desktopLyricsMousePollerBuffer.slice(lineStart, lineEnd).trim() === 'MMB') {
      handleDesktopLyricsGlobalMiddleClick();
    }
    lineStart = i + 1;
  }
  desktopLyricsMousePollerBuffer = lineStart > 0 ? desktopLyricsMousePollerBuffer.slice(lineStart) : desktopLyricsMousePollerBuffer;
}

function startDesktopLyricsMousePoller() {
  if (process.platform !== 'win32' || desktopLyricsMousePoller) return;
  const script = `
$ErrorActionPreference = "SilentlyContinue"
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class MineradioMousePoll {
  [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int vKey);
}
"@
$prev = $false
while ($true) {
  $down = (([MineradioMousePoll]::GetAsyncKeyState(4) -band 0x8000) -ne 0)
  if ($down -and -not $prev) {
    [Console]::Out.WriteLine("MMB")
    [Console]::Out.Flush()
  }
  $prev = $down
  Start-Sleep -Milliseconds 24
}
`;
  try {
    desktopLyricsMousePoller = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    desktopLyricsMousePoller.stdout.on('data', consumeDesktopLyricsMousePollerOutput);
    desktopLyricsMousePoller.on('exit', () => {
      desktopLyricsMousePoller = null;
      desktopLyricsMousePollerBuffer = '';
    });
    desktopLyricsMousePoller.on('error', () => {
      desktopLyricsMousePoller = null;
      desktopLyricsMousePollerBuffer = '';
    });
  } catch (e) {
    desktopLyricsMousePoller = null;
    desktopLyricsMousePollerBuffer = '';
  }
}

function stopDesktopLyricsMousePoller() {
  if (!desktopLyricsMousePoller) return;
  try {
    desktopLyricsMousePoller.kill();
  } catch (e) {}
  desktopLyricsMousePoller = null;
  desktopLyricsMousePollerBuffer = '';
}

function broadcastDesktopLyricsLockState() {
  const locked = desktopLyricsState.clickThrough !== false;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('mineradio-desktop-lyrics-lock-state', { locked });
  }
  sendDesktopLyricsState();
}

function broadcastDesktopLyricsEnabledState(enabled) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('mineradio-desktop-lyrics-enabled-state', { enabled: !!enabled });
  }
}

function positionDesktopLyricsWindow(payload = desktopLyricsState, options = {}) {
  if (!desktopLyricsWindow || desktopLyricsWindow.isDestroyed()) return;
  const shouldUseManualBounds = desktopLyricsUserBounds && !options.force;
  setDesktopLyricsBounds(shouldUseManualBounds ? desktopLyricsUserBounds : desktopLyricsDefaultBounds(payload));
  setDesktopLyricsOpacity(payload.opacity);
}

function roundedStateValue(value, scale = 1000) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * scale) : 0;
}

function desktopLyricsStateSignature(state) {
  const payload = state || {};
  const motion = payload.motion || {};
  const playback = payload.playback || {};
  const colors = payload.colors || {};
  return [
    payload.enabled ? 1 : 0,
    payload.text || '',
    roundedStateValue(payload.progress, 1000),
    roundedStateValue(payload.progressSpan, 100),
    payload.title || '',
    payload.artist || '',
    payload.playing ? 1 : 0,
    roundedStateValue(payload.size, 100),
    roundedStateValue(payload.opacity, 100),
    roundedStateValue(payload.y, 1000),
    payload.clickThrough === false ? 0 : 1,
    payload.lyricGlowParticles ? 1 : 0,
    payload.cinema === false ? 0 : 1,
    payload.highlightFollow ? 1 : 0,
    payload.frameRate || 0,
    payload.fontFamily || '',
    payload.fontWeight || '',
    roundedStateValue(payload.letterSpacing, 1000),
    roundedStateValue(payload.lineHeight, 100),
    payload.rows || '',
    payload.align || '',
    roundedStateValue(payload.lyricScale, 100),
    roundedStateValue(payload.feather, 1000),
    payload.beatMapKey || '',
    Object.prototype.hasOwnProperty.call(payload, 'beatMap') ? 'map' : 'nomap',
    colors.primary || '',
    colors.secondary || '',
    colors.highlight || '',
    colors.glow || '',
    motion.lyricGlow ? 1 : 0,
    motion.lyricGlowBeat ? 1 : 0,
    roundedStateValue(motion.lyricGlowStrength, 100),
    roundedStateValue(motion.highBloom, 100),
    roundedStateValue(motion.beatGlow, 100),
    roundedStateValue(motion.beatPulse, 100),
    roundedStateValue(motion.bass, 100),
    roundedStateValue(playback.time, 4),
    roundedStateValue(playback.duration, 10),
    roundedStateValue(playback.rate, 100),
  ].join('|');
}

function setDesktopLyricsOpacity(value) {
  if (!desktopLyricsWindow || desktopLyricsWindow.isDestroyed() || typeof desktopLyricsWindow.setOpacity !== 'function') return;
  const nextOpacity = clampNumber(value, 0.28, 1, 0.92);
  if (desktopLyricsLastOpacity != null && Math.abs(desktopLyricsLastOpacity - nextOpacity) <= 0.001) return;
  desktopLyricsLastOpacity = nextOpacity;
  desktopLyricsWindow.setOpacity(nextOpacity);
}

function sendDesktopLyricsState(force = false) {
  if (!desktopLyricsWindow || desktopLyricsWindow.isDestroyed()) return;
  const signature = desktopLyricsStateSignature(desktopLyricsState);
  if (!force && signature === desktopLyricsLastStateSignature) return;
  desktopLyricsLastStateSignature = signature;
  desktopLyricsWindow.webContents.send('mineradio-desktop-lyrics-state', desktopLyricsState);
}

function createDesktopLyricsWindow(payload = {}) {
  const previousY = desktopLyricsState.y;
  const previousOpacity = desktopLyricsState.opacity;
  desktopLyricsState = { ...desktopLyricsState, ...payload, enabled: true };
  const hasY = Object.prototype.hasOwnProperty.call(payload || {}, 'y');
  const nextY = clampNumber(desktopLyricsState.y, 0.08, 0.92, 0.76);
  const yChanged = hasY && Number.isFinite(Number(previousY)) && Math.abs(nextY - clampNumber(previousY, 0.08, 0.92, 0.76)) > 0.001;
  const opacityChanged = Object.prototype.hasOwnProperty.call(payload || {}, 'opacity')
    && Math.abs(clampNumber(desktopLyricsState.opacity, 0.28, 1, 0.92) - clampNumber(previousOpacity, 0.28, 1, 0.92)) > 0.001;
  if (yChanged) desktopLyricsUserBounds = null;
  if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
    if (yChanged) {
      positionDesktopLyricsWindow(desktopLyricsState, { force: yChanged });
    } else if (opacityChanged) {
      setDesktopLyricsOpacity(desktopLyricsState.opacity);
    }
    applyDesktopLyricsMouseBehavior();
    sendDesktopLyricsState();
    return desktopLyricsWindow;
  }

  desktopLyricsWindow = new BrowserWindow({
    width: 920,
    height: 190,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    movable: true,
    focusable: false,
    skipTaskbar: true,
    show: false,
    title: 'Mineradio Desktop Lyrics',
    webPreferences: {
      preload: path.join(__dirname, 'overlay-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });
  try {
    desktopLyricsWindow.setAlwaysOnTop(true, 'screen-saver');
    desktopLyricsWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  } catch (e) {
    console.warn('Desktop lyrics topmost setup skipped:', e.message);
  }
  startDesktopLyricsMousePoller();
  applyDesktopLyricsMouseBehavior();
  positionDesktopLyricsWindow(desktopLyricsState, { force: yChanged || !desktopLyricsUserBounds });
  desktopLyricsWindow.once('ready-to-show', () => {
    if (!desktopLyricsWindow || desktopLyricsWindow.isDestroyed()) return;
    desktopLyricsWindow.showInactive();
    sendDesktopLyricsState(true);
  });
  desktopLyricsWindow.webContents.once('did-finish-load', () => sendDesktopLyricsState(true));
  desktopLyricsWindow.on('closed', () => {
    desktopLyricsWindow = null;
    desktopLyricsMouseIgnored = null;
    desktopLyricsLastStateSignature = '';
    desktopLyricsLastOpacity = null;
  });
  desktopLyricsWindow.on('moved', rememberDesktopLyricsBounds);
  desktopLyricsWindow.loadURL(overlayUrl('desktop-lyrics.html')).catch((e) => console.warn('Desktop lyrics load failed:', e.message));
  return desktopLyricsWindow;
}

function closeDesktopLyricsWindow() {
  desktopLyricsState = { ...desktopLyricsState, enabled: false };
  desktopLyricsPointerCapture = false;
  desktopLyricsMouseIgnored = null;
  desktopLyricsLastStateSignature = '';
  desktopLyricsLastOpacity = null;
  desktopLyricsHotBounds = null;
  stopDesktopLyricsMousePoller();
  if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
    sendDesktopLyricsState();
    desktopLyricsWindow.close();
  }
  desktopLyricsWindow = null;
  broadcastDesktopLyricsEnabledState(false);
}

function nativeWindowHandleDecimal(win) {
  const handle = win.getNativeWindowHandle();
  if (process.arch === 'x64') return handle.readBigUInt64LE(0).toString();
  return String(handle.readUInt32LE(0));
}

function attachWallpaperToWorkerW(win) {
  if (process.platform !== 'win32' || !win || win.isDestroyed()) return;
  const hwnd = nativeWindowHandleDecimal(win);
  const script = `
$ErrorActionPreference = "Stop"
if (-not ("MineradioNativeWin" -as [type])) {
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class MineradioNativeWin {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll", SetLastError=true)] public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
  [DllImport("user32.dll", SetLastError=true)] public static extern IntPtr FindWindowEx(IntPtr parent, IntPtr childAfter, string className, string windowName);
  [DllImport("user32.dll", SetLastError=true)] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
  [DllImport("user32.dll", SetLastError=true)] public static extern IntPtr SetParent(IntPtr hWndChild, IntPtr hWndNewParent);
  [DllImport("user32.dll", SetLastError=true)] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
  [DllImport("user32.dll", SetLastError=true)] public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam, uint fuFlags, uint uTimeout, out IntPtr lpdwResult);
}
"@
}
$progman = [MineradioNativeWin]::FindWindow("Progman", $null)
$result = [IntPtr]::Zero
[MineradioNativeWin]::SendMessageTimeout($progman, 0x052C, [IntPtr]::Zero, [IntPtr]::Zero, 0, 1000, [ref]$result) | Out-Null
$script:workerw = [IntPtr]::Zero
$enum = [MineradioNativeWin+EnumWindowsProc]{
  param([IntPtr]$top, [IntPtr]$param)
  $shell = [MineradioNativeWin]::FindWindowEx($top, [IntPtr]::Zero, "SHELLDLL_DefView", $null)
  if ($shell -ne [IntPtr]::Zero) {
    $script:workerw = [MineradioNativeWin]::FindWindowEx([IntPtr]::Zero, $top, "WorkerW", $null)
  }
  return $true
}
[MineradioNativeWin]::EnumWindows($enum, [IntPtr]::Zero) | Out-Null
if ($script:workerw -eq [IntPtr]::Zero) { $script:workerw = $progman }
$target = [IntPtr]::new([Int64]${hwnd})
[MineradioNativeWin]::SetParent($target, $script:workerw) | Out-Null
[MineradioNativeWin]::SetWindowPos($target, [IntPtr]::Zero, 0, 0, 0, 0, 0x0013) | Out-Null
`;
  execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
    windowsHide: true,
    timeout: 5000,
  }, (error) => {
    if (error) console.warn('Wallpaper WorkerW attach failed:', error.message);
  });
}

function positionWallpaperWindow() {
  if (!wallpaperWindow || wallpaperWindow.isDestroyed()) return;
  const bounds = screen.getPrimaryDisplay().bounds;
  wallpaperWindow.setBounds(bounds, false);
}

function sendWallpaperState() {
  if (!wallpaperWindow || wallpaperWindow.isDestroyed()) return;
  wallpaperWindow.webContents.send('mineradio-wallpaper-state', wallpaperState);
}

function createWallpaperWindow(payload = {}) {
  wallpaperState = { ...wallpaperState, ...payload, enabled: true };
  if (wallpaperWindow && !wallpaperWindow.isDestroyed()) {
    positionWallpaperWindow();
    sendWallpaperState();
    return wallpaperWindow;
  }
  const bounds = screen.getPrimaryDisplay().bounds;
  wallpaperWindow = new BrowserWindow({
    ...bounds,
    frame: false,
    transparent: false,
    backgroundColor: '#050608',
    hasShadow: false,
    resizable: false,
    movable: false,
    focusable: false,
    skipTaskbar: true,
    show: false,
    title: 'Mineradio Wallpaper',
    webPreferences: {
      preload: path.join(__dirname, 'overlay-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });
  wallpaperWindow.setIgnoreMouseEvents(true, { forward: true });
  wallpaperWindow.once('ready-to-show', () => {
    if (!wallpaperWindow || wallpaperWindow.isDestroyed()) return;
    positionWallpaperWindow();
    wallpaperWindow.showInactive();
    attachWallpaperToWorkerW(wallpaperWindow);
    sendWallpaperState();
  });
  wallpaperWindow.webContents.once('did-finish-load', sendWallpaperState);
  wallpaperWindow.on('closed', () => {
    wallpaperWindow = null;
  });
  wallpaperWindow.loadURL(overlayUrl('wallpaper.html')).catch((e) => console.warn('Wallpaper load failed:', e.message));
  return wallpaperWindow;
}

function closeWallpaperWindow() {
  wallpaperState = { ...wallpaperState, enabled: false };
  if (wallpaperWindow && !wallpaperWindow.isDestroyed()) {
    sendWallpaperState();
    wallpaperWindow.close();
  }
  wallpaperWindow = null;
}

function miniPlayerDefaultBounds() {
  const referenceBounds = mainWindow && !mainWindow.isDestroyed()
    ? mainWindow.getBounds()
    : screen.getPrimaryDisplay().bounds;
  const display = screen.getDisplayMatching(referenceBounds) || screen.getPrimaryDisplay();
  const workArea = display.workArea;
  return {
    x: workArea.x + workArea.width - MINI_PLAYER_WIDTH - MINI_PLAYER_MARGIN,
    y: workArea.y + workArea.height - MINI_PLAYER_HEIGHT - MINI_PLAYER_MARGIN,
    width: MINI_PLAYER_WIDTH,
    height: MINI_PLAYER_HEIGHT,
  };
}

function clampMiniPlayerBounds(bounds) {
  const source = bounds || miniPlayerDefaultBounds();
  const display = screen.getDisplayMatching(source) || screen.getPrimaryDisplay();
  const workArea = display.workArea;
  return {
    x: Math.round(Math.max(workArea.x, Math.min(source.x, workArea.x + workArea.width - MINI_PLAYER_WIDTH))),
    y: Math.round(Math.max(workArea.y, Math.min(source.y, workArea.y + workArea.height - MINI_PLAYER_HEIGHT))),
    width: MINI_PLAYER_WIDTH,
    height: MINI_PLAYER_HEIGHT,
  };
}

/**
 * 生成迷你播放器坐标签名，用于区分用户拖动、程序校正和重复持久化。
 * @param {{x:number, y:number}} bounds 窗口坐标。
 * @returns {string} 取整后的坐标签名。
 */
function miniPlayerBoundsSignature(bounds) {
  if (!bounds) return '';
  return `${Math.round(bounds.x)}|${Math.round(bounds.y)}`;
}

/**
 * 读取并校正已保存的迷你播放器坐标。非法设置直接忽略，不改变当前默认定位。
 * @param {unknown} value 设置文件中的坐标值。
 * @returns {{x:number, y:number, width:number, height:number}|null} 当前显示器内的固定尺寸坐标。
 */
function savedMiniPlayerBounds(value) {
  if (!value || typeof value !== 'object') return null;
  if (typeof value.x !== 'number' || !Number.isFinite(value.x)) return null;
  if (typeof value.y !== 'number' || !Number.isFinite(value.y)) return null;
  return clampMiniPlayerBounds({ x: value.x, y: value.y, width: MINI_PLAYER_WIDTH, height: MINI_PLAYER_HEIGHT });
}

/**
 * 保存用户迷你播放器坐标。同一位置只写入一次，避免拖动结束或系统事件重复落盘。
 * @param {{x:number, y:number, width?:number, height?:number}} bounds 用户或系统校正后的坐标。
 * @returns {{x:number, y:number, width:number, height:number}} 实际保存的工作区内坐标。
 */
function persistMiniPlayerUserBounds(bounds) {
  const nextBounds = clampMiniPlayerBounds(bounds);
  const signature = miniPlayerBoundsSignature(nextBounds);
  miniPlayerUserBounds = nextBounds;
  if (signature === miniPlayerSavedBoundsSignature) return nextBounds;
  writeDesktopShellSettings({ miniPlayerBounds: { x: nextBounds.x, y: nextBounds.y } });
  miniPlayerSavedBoundsSignature = signature;
  return nextBounds;
}

/**
 * 标记用户开始手动拖动迷你播放器。Electron 的 will-move 不会由 setBounds 触发。
 * @param {BrowserWindow} win 即将被用户手动移动的迷你播放器窗口。
 * @returns {void}
 * @see https://www.electronjs.org/docs/latest/api/browser-window#event-will-move-macos-windows
 */
function beginMiniPlayerUserMove(win) {
  if (miniPlayerWindow !== win || win.isDestroyed()) return;
  miniPlayerUserMovePending = true;
}

/**
 * 在用户拖动结束后保存坐标。没有 will-move 标记的程序移动事件直接忽略。
 * @param {BrowserWindow} win 触发移动完成事件的迷你播放器窗口。
 * @returns {void}
 */
function handleMiniPlayerMoved(win) {
  if (miniPlayerWindow !== win || win.isDestroyed() || !miniPlayerUserMovePending) return;
  miniPlayerUserMovePending = false;
  persistMiniPlayerUserBounds(win.getBounds());
}

/**
 * 把迷你播放器放回默认或用户坐标。程序定位前清除未完成的用户拖动标记。
 * @returns {void}
 */
function positionMiniPlayerWindow() {
  if (!miniPlayerWindow || miniPlayerWindow.isDestroyed()) return;
  const nextBounds = clampMiniPlayerBounds(miniPlayerUserBounds || miniPlayerDefaultBounds());
  miniPlayerUserMovePending = false;
  miniPlayerWindow.setBounds(nextBounds, false);
  if (miniPlayerUserBounds) persistMiniPlayerUserBounds(nextBounds);
}

function applyMiniPlayerStatePatch(payload) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const next = { ...miniPlayerState };
  if (Object.prototype.hasOwnProperty.call(source, 'title')) next.title = String(source.title || 'Mineradio').slice(0, 260);
  if (Object.prototype.hasOwnProperty.call(source, 'artist')) next.artist = String(source.artist || '').slice(0, 320);
  if (Object.prototype.hasOwnProperty.call(source, 'cover')) {
    const cover = String(source.cover || '');
    next.cover = cover.length <= 8 * 1024 * 1024 ? cover : '';
  }
  if (Object.prototype.hasOwnProperty.call(source, 'playing')) next.playing = !!source.playing;
  if (Object.prototype.hasOwnProperty.call(source, 'hasTrack')) next.hasTrack = !!source.hasTrack;
  if (Object.prototype.hasOwnProperty.call(source, 'metaSignature')) next.metaSignature = String(source.metaSignature || '').slice(0, 240);
  miniPlayerState = next;
  return next;
}

function sendMiniPlayerState(force = false) {
  const win = miniPlayerWindow;
  if (!win || win.isDestroyed() || win.webContents.isDestroyed()) return;
  const next = {
    title: miniPlayerState.title || 'Mineradio',
    artist: miniPlayerState.artist || '',
    cover: miniPlayerState.cover || '',
    playing: !!miniPlayerState.playing,
    hasTrack: !!miniPlayerState.hasTrack,
    metaSignature: miniPlayerState.metaSignature || '',
  };
  const previous = miniPlayerLastSentState;
  const patch = {};
  let changed = false;
  const metadataChanged = force || !previous
    || next.metaSignature !== previous.metaSignature
    || next.title !== previous.title
    || next.artist !== previous.artist
    || next.cover !== previous.cover;
  if (metadataChanged) {
    patch.title = next.title;
    patch.artist = next.artist;
    patch.cover = next.cover;
    changed = true;
  }
  if (force || !previous || next.playing !== previous.playing) {
    patch.playing = next.playing;
    changed = true;
  }
  if (force || !previous || next.hasTrack !== previous.hasTrack) {
    patch.hasTrack = next.hasTrack;
    changed = true;
  }
  if (!changed) return;
  try {
    win.webContents.send('mineradio-mini-player-state', patch);
    miniPlayerLastSentState = next;
  } catch (e) {
    console.warn('Mini player state sync failed:', e.message);
    scheduleMiniPlayerWindowRecovery(win, 'state-sync-failed');
  }
}

function shouldShowMiniPlayer() {
  return !!(
    miniPlayerEnabled
    && miniPlayerActive
    && mainWindow
    && !mainWindow.isDestroyed()
    && (mainWindow.isMinimized() || !mainWindow.isVisible())
  );
}

function stopMiniPlayerRecoveryTimer() {
  if (!miniPlayerRecoveryTimer) return;
  clearTimeout(miniPlayerRecoveryTimer);
  miniPlayerRecoveryTimer = null;
}

function stopMiniPlayerRecreateTimer() {
  if (!miniPlayerRecreateTimer) return;
  clearTimeout(miniPlayerRecreateTimer);
  miniPlayerRecreateTimer = null;
}

function scheduleMiniPlayerRecovery(delay = MINI_PLAYER_RECOVERY_INTERVAL) {
  stopMiniPlayerRecoveryTimer();
  if (!shouldShowMiniPlayer()) return;
  miniPlayerRecoveryTimer = setTimeout(() => {
    miniPlayerRecoveryTimer = null;
    if (shouldShowMiniPlayer()) showMiniPlayerWindow();
  }, Math.max(0, Number(delay) || 0));
  if (typeof miniPlayerRecoveryTimer.unref === 'function') miniPlayerRecoveryTimer.unref();
}

/**
 * 恢复迷你播放器的置顶层级。健康窗口只刷新 Z 序，避免恢复轮询重复写原生置顶状态。
 * @param {BrowserWindow} win 当前迷你播放器窗口。
 * @returns {void}
 */
function keepMiniPlayerOnTop(win) {
  if (!win || win.isDestroyed()) return;
  try {
    if (!win.isAlwaysOnTop()) win.setAlwaysOnTop(true, 'screen-saver');
    if (win.isVisible()) win.moveTop();
  } catch (e) {
    console.warn('Mini player topmost recovery skipped:', e.message);
  }
}

function destroyMiniPlayerWindowInstance(win) {
  if (!win) return;
  if (miniPlayerWindow === win) {
    miniPlayerWindow = null;
    miniPlayerUserMovePending = false;
  }
  miniPlayerLastSentState = null;
  if (win.isDestroyed()) return;
  miniPlayerProgrammaticCloseWindows.add(win);
  win.destroy();
}

function scheduleMiniPlayerWindowRecovery(win, reason) {
  if (appQuitting || !win || miniPlayerWindow !== win || miniPlayerProgrammaticCloseWindows.has(win)) return;
  if (miniPlayerRecreateTimer) return;
  console.warn(`Mini player recovery scheduled: ${reason || 'unknown'}`);
  miniPlayerRecreateTimer = setTimeout(() => {
    miniPlayerRecreateTimer = null;
    if (miniPlayerWindow !== win || win.isDestroyed()) {
      if (shouldShowMiniPlayer()) showMiniPlayerWindow();
      return;
    }
    const contents = win.webContents;
    const rendererGone = String(reason || '').startsWith('renderer-gone:');
    if (!contents.isDestroyed() && (rendererGone || contents.isCrashed())) {
      try {
        contents.reload();
        scheduleMiniPlayerRecovery(800);
        return;
      } catch (e) {
        console.warn('Mini player renderer reload failed:', e.message);
      }
    }
    destroyMiniPlayerWindowInstance(win);
    if (shouldShowMiniPlayer()) showMiniPlayerWindow();
  }, 120);
  if (typeof miniPlayerRecreateTimer.unref === 'function') miniPlayerRecreateTimer.unref();
}

function createMiniPlayerWindow() {
  if (miniPlayerWindow && !miniPlayerWindow.isDestroyed()) return miniPlayerWindow;
  miniPlayerWindow = null;
  miniPlayerUserMovePending = false;
  const bounds = clampMiniPlayerBounds(miniPlayerUserBounds || miniPlayerDefaultBounds());
  const win = new BrowserWindow({
    ...bounds,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    movable: true,
    focusable: true,
    skipTaskbar: true,
    show: false,
    autoHideMenuBar: true,
    title: 'Mineradio Mini Player',
    icon: APP_ICON_ICO,
    webPreferences: {
      preload: path.join(__dirname, 'mini-player-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  miniPlayerWindow = win;
  keepMiniPlayerOnTop(win);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.once('ready-to-show', () => {
    if (miniPlayerWindow !== win || win.isDestroyed() || !shouldShowMiniPlayer()) return;
    positionMiniPlayerWindow();
    if (win.isMinimized()) win.restore();
    win.showInactive();
    keepMiniPlayerOnTop(win);
    sendMiniPlayerState(true);
    scheduleMiniPlayerRecovery();
  });
  win.webContents.on('did-finish-load', () => {
    if (miniPlayerWindow !== win) return;
    miniPlayerLastSentState = null;
    if (shouldShowMiniPlayer()) showMiniPlayerWindow();
    else sendMiniPlayerState(true);
  });
  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, _url, isMainFrame) => {
    if (isMainFrame === false || errorCode === -3) return;
    scheduleMiniPlayerWindowRecovery(win, `load-failed:${errorCode}:${errorDescription}`);
  });
  win.webContents.on('render-process-gone', (_event, details) => {
    scheduleMiniPlayerWindowRecovery(win, `renderer-gone:${details && details.reason || 'unknown'}`);
  });
  win.on('will-move', beginMiniPlayerUserMove.bind(null, win));
  win.on('moved', handleMiniPlayerMoved.bind(null, win));
  win.on('show', () => {
    if (miniPlayerWindow !== win || !shouldShowMiniPlayer()) return;
    keepMiniPlayerOnTop(win);
    scheduleMiniPlayerRecovery();
  });
  win.on('hide', () => {
    if (miniPlayerWindow === win && shouldShowMiniPlayer()) scheduleMiniPlayerRecovery(0);
  });
  win.on('minimize', () => {
    if (miniPlayerWindow === win && shouldShowMiniPlayer()) scheduleMiniPlayerRecovery(0);
  });
  win.on('always-on-top-changed', (_event, isAlwaysOnTop) => {
    if (!isAlwaysOnTop && miniPlayerWindow === win && shouldShowMiniPlayer()) scheduleMiniPlayerRecovery(0);
  });
  win.on('close', (event) => {
    if (appQuitting || miniPlayerProgrammaticCloseWindows.has(win)) return;
    event.preventDefault();
    focusMainWindow();
  });
  win.on('closed', () => {
    const wasCurrent = miniPlayerWindow === win;
    if (wasCurrent) {
      miniPlayerWindow = null;
      miniPlayerUserMovePending = false;
      miniPlayerLastSentState = null;
    }
    if (wasCurrent && !appQuitting && !miniPlayerProgrammaticCloseWindows.has(win) && shouldShowMiniPlayer()) {
      scheduleMiniPlayerRecovery(120);
    }
  });
  win.loadURL(overlayUrl('mini-player.html')).catch((e) => {
    console.warn('Mini player load failed:', e.message);
    scheduleMiniPlayerWindowRecovery(win, 'load-rejected');
  });
  return win;
}

/**
 * 显示或恢复迷你播放器。已健康显示时只校正层级，不重复触发显示和状态同步。
 * @returns {void}
 */
function showMiniPlayerWindow() {
  if (!shouldShowMiniPlayer()) {
    stopMiniPlayerRecoveryTimer();
    return;
  }
  const win = createMiniPlayerWindow();
  scheduleMiniPlayerRecovery();
  if (!win || win.isDestroyed() || win.webContents.isDestroyed()) return;
  if (win.webContents.isCrashed()) {
    scheduleMiniPlayerWindowRecovery(win, 'guard-detected-crash');
    return;
  }
  if (win.webContents.isLoadingMainFrame()) return;
  const wasVisible = win.isVisible();
  const wasMinimized = win.isMinimized();
  if (wasMinimized) win.restore();
  if (!wasVisible || wasMinimized) {
    positionMiniPlayerWindow();
    win.showInactive();
  }
  keepMiniPlayerOnTop(win);
  if (!wasVisible || wasMinimized) sendMiniPlayerState(true);
}

function hideMiniPlayerWindow() {
  stopMiniPlayerRecoveryTimer();
  stopMiniPlayerRecreateTimer();
  if (miniPlayerWindow && !miniPlayerWindow.isDestroyed() && miniPlayerWindow.isVisible()) miniPlayerWindow.hide();
}

function closeMiniPlayerWindow() {
  stopMiniPlayerRecoveryTimer();
  stopMiniPlayerRecreateTimer();
  const win = miniPlayerWindow;
  if (win) destroyMiniPlayerWindowInstance(win);
  miniPlayerLastSentState = null;
}

function setMiniPlayerEnabled(enabled) {
  miniPlayerEnabled = !!enabled;
  writeDesktopShellSettings({ miniPlayer: miniPlayerEnabled });
  if (miniPlayerEnabled) {
    if (mainWindow && !mainWindow.isDestroyed() && (mainWindow.isMinimized() || !mainWindow.isVisible())) miniPlayerActive = true;
    showMiniPlayerWindow();
  } else {
    miniPlayerActive = false;
    closeMiniPlayerWindow();
  }
  refreshTrayMenu();
  return { ok: true, miniPlayerEnabled };
}

function closeOverlayWindows() {
  miniPlayerActive = false;
  closeDesktopLyricsWindow();
  closeWallpaperWindow();
  closeMiniPlayerWindow();
}

ipcMain.handle('desktop-window-minimize', (event) => {
  getSenderWindow(event)?.minimize();
});

ipcMain.handle('desktop-window-toggle-maximize', (event) => {
  toggleFullscreen(getSenderWindow(event));
});

ipcMain.handle('desktop-window-toggle-fullscreen', (event) => {
  toggleFullscreen(getSenderWindow(event));
});

ipcMain.handle('desktop-window-exit-fullscreen-windowed', (event) => {
  exitFullscreenToWindow(getSenderWindow(event));
});

ipcMain.handle('desktop-window-get-state', (event) => {
  return getWindowState(getSenderWindow(event));
});

ipcMain.handle('desktop-window-close', (event) => {
  getSenderWindow(event)?.close();
});

ipcMain.handle('mineradio-tray-get-settings', () => {
  return {
    ok: true,
    closeToTray: closeToTrayEnabled,
    miniPlayer: miniPlayerEnabled,
    miniPlayerEnabled,
    startup: isStartupEnabled(),
    startupEnabled: isStartupEnabled(),
  };
});

ipcMain.handle('mineradio-tray-set-close-to-tray', (_event, enabled) => {
  closeToTrayEnabled = !!enabled;
  writeDesktopShellSettings({ closeToTray: closeToTrayEnabled });
  refreshTrayMenu();
  return { ok: true, closeToTray: closeToTrayEnabled };
});

ipcMain.handle('mineradio-startup-set-enabled', (_event, enabled) => {
  const result = setStartupEnabled(!!enabled);
  refreshTrayMenu();
  return result;
});

ipcMain.handle('mineradio-mini-player-set-enabled', (_event, enabled) => {
  return setMiniPlayerEnabled(enabled);
});

ipcMain.handle('mineradio-mini-player-update', (event, payload) => {
  if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) {
    return { ok: false, error: 'MINI_PLAYER_INVALID_SENDER' };
  }
  applyMiniPlayerStatePatch(payload);
  sendMiniPlayerState();
  return { ok: true };
});

ipcMain.handle('mineradio-mini-player-command', (event, action) => {
  if (!miniPlayerWindow || miniPlayerWindow.isDestroyed() || event.sender !== miniPlayerWindow.webContents) {
    return { ok: false, error: 'MINI_PLAYER_INVALID_SENDER' };
  }
  const command = String(action || '');
  if (command === 'restore') return { ok: focusMainWindow() };
  if (!['toggle-play', 'previous', 'next'].includes(command)) return { ok: false, error: 'MINI_PLAYER_INVALID_COMMAND' };
  if (!mainWindow || mainWindow.isDestroyed()) return { ok: false, error: 'MAIN_WINDOW_UNAVAILABLE' };
  mainWindow.webContents.send('mineradio-mini-player-command', { action: command });
  return { ok: true };
});

ipcMain.handle('mineradio-hotkeys-configure-global', (_event, bindings) => {
  return configureMineradioGlobalHotkeys(bindings);
});

ipcMain.handle('mineradio-export-json-file', async (event, payload = {}) => {
  try {
    const owner = getSenderWindow(event);
    const defaultName = String(payload.defaultName || 'mineradio-export.json').replace(/[\\/:*?"<>|]+/g, '-');
    const result = await dialog.showSaveDialog(owner, {
      title: '导出 Mineradio 存档',
      defaultPath: defaultName.toLowerCase().endsWith('.json') ? defaultName : `${defaultName}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return { ok: false, canceled: true };
    const text = typeof payload.text === 'string' ? payload.text : JSON.stringify(payload.data || {}, null, 2);
    fs.writeFileSync(result.filePath, text, 'utf8');
    return { ok: true, filePath: result.filePath };
  } catch (e) {
    return { ok: false, error: e.message || 'EXPORT_FAILED' };
  }
});

ipcMain.handle('mineradio-import-json-file', async (event) => {
  try {
    const owner = getSenderWindow(event);
    const result = await dialog.showOpenDialog(owner, {
      title: '导入 Mineradio 存档',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePaths || !result.filePaths[0]) return { ok: false, canceled: true };
    const filePath = result.filePaths[0];
    const text = fs.readFileSync(filePath, 'utf8');
    return { ok: true, filePath, text };
  } catch (e) {
    return { ok: false, error: e.message || 'IMPORT_FAILED' };
  }
});

ipcMain.on('mineradio-ui-state-read-sync', (event) => {
  event.returnValue = readDesktopUiState().values || {};
});

ipcMain.handle('mineradio-ui-state-write', async (_event, patch) => {
  try {
    const state = writeDesktopUiStatePatch(patch || {});
    return { ok: true, updatedAt: state.updatedAt };
  } catch (e) {
    return { ok: false, error: e.message || 'UI_STATE_WRITE_FAILED' };
  }
});

ipcMain.handle('mineradio-local-music-choose-folder', async (event) => {
  try {
    const owner = getSenderWindow(event);
    const result = await dialog.showOpenDialog(owner, {
      title: '选择本地音乐文件夹',
      properties: ['openDirectory'],
    });
    if (result.canceled || !result.filePaths || !result.filePaths[0]) return { ok: false, canceled: true };
    return scanLocalMusicFolder(result.filePaths[0]);
  } catch (e) {
    return { ok: false, error: e.message || 'LOCAL_LIBRARY_CHOOSE_FAILED' };
  }
});

ipcMain.handle('mineradio-local-music-scan-folder', async (_event, folderPath, options) => {
  try {
    if (!folderPath) return { ok: false, error: 'LOCAL_LIBRARY_PATH_EMPTY' };
    return await scanLocalMusicFolder(folderPath, options || {});
  } catch (e) {
    return { ok: false, error: e.message || 'LOCAL_LIBRARY_SCAN_FAILED' };
  }
});

ipcMain.handle('mineradio-local-music-refresh-entries', async (_event, folderPath, files) => {
  try {
    if (!folderPath) return { ok: false, error: 'LOCAL_LIBRARY_PATH_EMPTY' };
    return await refreshLocalMusicFileEntries(folderPath, files);
  } catch (e) {
    return { ok: false, error: e.message || 'LOCAL_LIBRARY_REFRESH_FAILED' };
  }
});

ipcMain.handle('mineradio-local-file-read-range', async (_event, filePath, start, end) => {
  try {
    return await readAuthorizedLocalFileRange(filePath, start, end);
  } catch (e) {
    return { ok: false, error: e.message || 'LOCAL_FILE_READ_FAILED' };
  }
});

ipcMain.handle('mineradio-local-file-read-data-url', async (_event, filePath) => {
  try {
    return await readAuthorizedLocalFileDataUrl(filePath);
  } catch (e) {
    return { ok: false, error: e.message || 'LOCAL_FILE_READ_FAILED' };
  }
});

ipcMain.handle('mineradio-open-update-installer', async (_event, filePath) => {
  try {
    const target = path.resolve(String(filePath || ''));
    const updateDir = path.resolve(getUpdateDownloadDir());
    if (!target || !target.startsWith(updateDir + path.sep)) {
      return { ok: false, error: 'INVALID_UPDATE_PATH' };
    }
    if (!fs.existsSync(target)) return { ok: false, error: 'UPDATE_FILE_MISSING' };
    const error = await shell.openPath(target);
    return error ? { ok: false, error } : { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'OPEN_UPDATE_FAILED' };
  }
});

ipcMain.handle('mineradio-restart-app', async () => {
  try {
    app.relaunch();
    app.exit(0);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'RESTART_FAILED' };
  }
});

ipcMain.handle('mineradio-desktop-lyrics-set-enabled', async (_event, enabled, payload) => {
  try {
    if (enabled) {
      createDesktopLyricsWindow(payload || {});
      broadcastDesktopLyricsEnabledState(true);
    } else {
      closeDesktopLyricsWindow();
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'DESKTOP_LYRICS_FAILED' };
  }
});

ipcMain.handle('mineradio-desktop-lyrics-update', async (_event, payload) => {
  try {
    const nextState = { ...desktopLyricsState, ...(payload || {}) };
    if (nextState.enabled) {
      createDesktopLyricsWindow(payload || {});
    } else if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
      desktopLyricsState = nextState;
      sendDesktopLyricsState();
    } else {
      desktopLyricsState = nextState;
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'DESKTOP_LYRICS_UPDATE_FAILED' };
  }
});

ipcMain.handle('mineradio-desktop-lyrics-set-dragging', async () => {
  return { ok: true };
});

ipcMain.handle('mineradio-desktop-lyrics-set-pointer-capture', async (_event, active) => {
  try {
    desktopLyricsPointerCapture = !!active;
    applyDesktopLyricsMouseBehavior();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'DESKTOP_LYRICS_POINTER_FAILED' };
  }
});

ipcMain.handle('mineradio-desktop-lyrics-set-hot-bounds', async (_event, bounds) => {
  try {
    const left = clampNumber(bounds && bounds.left, -2000, 4000, 0);
    const top = clampNumber(bounds && bounds.top, -2000, 4000, 0);
    const right = clampNumber(bounds && bounds.right, left + 1, 6000, left + 1);
    const bottom = clampNumber(bounds && bounds.bottom, top + 1, 6000, top + 1);
    desktopLyricsHotBounds = { left, top, right, bottom };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'DESKTOP_LYRICS_HOT_BOUNDS_FAILED' };
  }
});

ipcMain.handle('mineradio-desktop-lyrics-set-lock-state', async (_event, locked) => {
  try {
    desktopLyricsState = { ...desktopLyricsState, clickThrough: !!locked };
    if (desktopLyricsState.clickThrough !== false) desktopLyricsPointerCapture = false;
    applyDesktopLyricsMouseBehavior();
    broadcastDesktopLyricsLockState();
    return { ok: true, locked: desktopLyricsState.clickThrough !== false };
  } catch (e) {
    return { ok: false, error: e.message || 'DESKTOP_LYRICS_LOCK_FAILED' };
  }
});

ipcMain.handle('mineradio-desktop-lyrics-move-by', async (_event, dx, dy) => {
  try {
    if (!desktopLyricsWindow || desktopLyricsWindow.isDestroyed()) return { ok: false, error: 'NO_DESKTOP_LYRICS_WINDOW' };
    if (desktopLyricsState.clickThrough !== false) return { ok: false, error: 'DESKTOP_LYRICS_LOCKED' };
    const bounds = desktopLyricsWindow.getBounds();
    const next = {
      ...bounds,
      x: Math.round(bounds.x + clampNumber(dx, -160, 160, 0)),
      y: Math.round(bounds.y + clampNumber(dy, -160, 160, 0)),
    };
    desktopLyricsWindow.setBounds(next, false);
    desktopLyricsUserBounds = desktopLyricsWindow.getBounds();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'DESKTOP_LYRICS_MOVE_FAILED' };
  }
});

ipcMain.handle('mineradio-wallpaper-set-enabled', async (_event, enabled, payload) => {
  try {
    if (enabled) createWallpaperWindow(payload || {});
    else closeWallpaperWindow();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'WALLPAPER_FAILED' };
  }
});

ipcMain.handle('mineradio-wallpaper-update', async (_event, payload) => {
  try {
    wallpaperState = { ...wallpaperState, ...(payload || {}) };
    if (wallpaperState.enabled) {
      createWallpaperWindow(wallpaperState);
      if (wallpaperWindow && !wallpaperWindow.isDestroyed()) {
        positionWallpaperWindow();
        sendWallpaperState();
      }
    } else if (wallpaperWindow && !wallpaperWindow.isDestroyed()) {
      sendWallpaperState();
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'WALLPAPER_UPDATE_FAILED' };
  }
});

async function createWindow() {
  htmlFullscreenActive = false;
  windowFullscreenActive = false;
  const port = await findOpenPort(3000);
  mainServerPort = port;

  process.env.HOST = '127.0.0.1';
  process.env.PORT = String(port);
  process.env.MINERADIO_UPDATE_DIR = getUpdateDownloadDir();
  process.env.MINERADIO_LOCAL_FILE_TOKEN = LOCAL_FILE_TOKEN;

  localServer = require(path.join(__dirname, '..', 'server.js'));
  await waitForServer(localServer);

  const initialBounds = getWindowedBounds();

  mainWindow = new BrowserWindow({
    ...initialBounds,
    minWidth: 960,
    minHeight: 540,
    show: false,
    frame: false,
    fullscreen: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: true,
    autoHideMenuBar: true,
    title: APP_NAME,
    icon: APP_ICON_ICO,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openAllowedExternalUrl(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.once('did-finish-load', () => {
    sendWindowState(mainWindow);
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && (input.key === 'Escape' || input.code === 'Escape') && mainWindow.isFullScreen()) {
      event.preventDefault();
      exitFullscreenToWindow(mainWindow);
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    sendWindowState(mainWindow);
  });

  mainWindow.on('maximize', () => sendWindowState(mainWindow));
  mainWindow.on('unmaximize', () => sendWindowState(mainWindow));
  mainWindow.on('minimize', () => {
    miniPlayerActive = true;
    sendWindowState(mainWindow);
    showMiniPlayerWindow();
  });
  mainWindow.on('restore', () => {
    miniPlayerActive = false;
    hideMiniPlayerWindow();
    sendWindowState(mainWindow);
  });
  mainWindow.on('show', () => {
    if (!mainWindow.isMinimized()) {
      miniPlayerActive = false;
      hideMiniPlayerWindow();
    }
    sendWindowState(mainWindow);
  });
  mainWindow.on('hide', () => {
    if (miniPlayerActive) showMiniPlayerWindow();
    else hideMiniPlayerWindow();
    sendWindowState(mainWindow);
  });
  mainWindow.on('focus', () => sendWindowState(mainWindow));
  mainWindow.on('blur', () => sendWindowState(mainWindow));
  mainWindow.on('move', () => scheduleWindowStateSend(mainWindow));
  mainWindow.on('resize', () => scheduleWindowStateSend(mainWindow));
  mainWindow.on('close', (event) => {
    if (!appQuitting && (closeToTrayEnabled || miniPlayerEnabled)) {
      event.preventDefault();
      miniPlayerActive = miniPlayerEnabled;
      mainWindow.hide();
      if (miniPlayerActive) showMiniPlayerWindow();
      sendWindowState(mainWindow);
    }
  });
  mainWindow.on('closed', () => {
    if (mainWindowStateTimer) {
      clearTimeout(mainWindowStateTimer);
      mainWindowStateTimer = null;
    }
    closeOverlayWindows();
    miniPlayerActive = false;
    mainWindow = null;
  });
  mainWindow.on('enter-full-screen', () => {
    windowFullscreenActive = true;
    sendWindowState(mainWindow);
  });
  mainWindow.on('leave-full-screen', () => {
    windowFullscreenActive = false;
    setTimeout(() => applyWindowedBounds(mainWindow), 50);
  });
  mainWindow.on('enter-html-full-screen', () => {
    htmlFullscreenActive = true;
    sendWindowState(mainWindow);
  });
  mainWindow.on('leave-html-full-screen', () => {
    htmlFullscreenActive = false;
    setTimeout(() => applyWindowedBounds(mainWindow), 50);
  });

  await mainWindow.loadURL(`http://127.0.0.1:${port}`);
}

app.setName(APP_NAME);
if (process.platform === 'win32') app.setAppUserModelId(APP_USER_MODEL_ID);

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!focusMainWindow()) {
      app.whenReady().then(() => createWindow()).catch((e) => console.error('Second instance window restore failed:', e));
    }
  });

  app.whenReady().then(async () => {
    applySavedDesktopShellSettings();
    screen.on('display-metrics-changed', () => {
      positionDesktopLyricsWindow();
      positionWallpaperWindow();
      positionMiniPlayerWindow();
      scheduleMiniPlayerRecovery(80);
      scheduleWindowStateSend(mainWindow);
    });
    screen.on('display-added', () => {
      positionMiniPlayerWindow();
      scheduleMiniPlayerRecovery(80);
      scheduleWindowStateSend(mainWindow);
    });
    screen.on('display-removed', () => {
      positionMiniPlayerWindow();
      scheduleMiniPlayerRecovery(80);
      scheduleWindowStateSend(mainWindow);
    });
    powerMonitor.on('resume', () => scheduleMiniPlayerRecovery(180));
    powerMonitor.on('unlock-screen', () => scheduleMiniPlayerRecovery(180));
    await createWindow();
    createTray();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else focusMainWindow();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin' && (appQuitting || !closeToTrayEnabled)) app.quit();
  });

  app.on('before-quit', () => {
    appQuitting = true;
    unregisterMineradioGlobalHotkeys();
    closeOverlayWindows();
    if (localServer && localServer.close) localServer.close();
  });
}
