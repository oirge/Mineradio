const { app, BrowserWindow, ipcMain, shell, screen, powerMonitor, globalShortcut, dialog, Tray, Menu, protocol, session, desktopCapturer } = require('electron');
const net = require('net');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const crypto = require('crypto');
const { execFile, spawn } = require('child_process');
const { DesktopOverlayStateCache } = require('./desktop-overlay-state-cache');
const { MiniPlayerRecoverySession } = require('./mini-player-recovery-session');
const { MiniPlayerStateCache, miniPlayerThemeSignature } = require('./mini-player-state-cache');
const { launchUpdateInstaller } = require('./update-installer-launcher');
const { createWallpaperEngineBridge, registerWallpaperEngineScheme } = require('./wallpaper-engine-bridge');
const {
  resolveInstanceProfile,
  resolveLegacySharedProfile,
  discoverLegacyPathProfiles,
  resolvePreferredServerPort,
  resolveDesktopShortcutName,
} = require('./instance-isolation');
const {
  cleanupProfileSessionStaging,
  discoverLocalStorageOrigins,
  isProfileMigrationMarkerCurrent,
  mergePersistentUiValues,
  profileModifiedAt,
  readProfileUiState,
  readSessionLocalStorage,
  stageProfileSessionData,
  writeSessionLocalStorage,
} = require('./profile-state-migration');
registerWallpaperEngineScheme(protocol);

const APP_NAME = 'Mineradio';
const BASE_APP_USER_MODEL_ID = 'com.mineradio.desktop';
const PRIMARY_PROFILE_ID = 'oirge';
const APP_DATA_PATH = app.getPath('appData');
const INSTANCE_PROFILE = resolveInstanceProfile({
  instanceId: process.env.MINERADIO_INSTANCE_ID,
  execPath: process.execPath,
  appRoot: __dirname,
  appDataPath: APP_DATA_PATH,
  appName: APP_NAME,
  baseAppUserModelId: BASE_APP_USER_MODEL_ID,
  primaryProfileId: PRIMARY_PROFILE_ID,
  isPackaged: app.isPackaged,
});
const INSTANCE_ID = INSTANCE_PROFILE.instanceId;
const INSTANCE_APP_NAME = INSTANCE_PROFILE.appName;
const APP_USER_MODEL_ID = INSTANCE_PROFILE.appUserModelId;
const LEGACY_SHARED_PROFILE = INSTANCE_PROFILE.primary
  ? resolveLegacySharedProfile({
      appDataPath: APP_DATA_PATH,
      appName: APP_NAME,
    })
  : null;
const LEGACY_PATH_PROFILES = INSTANCE_PROFILE.primary
  ? discoverLegacyPathProfiles({ appDataPath: APP_DATA_PATH, appName: APP_NAME })
  : [];
const DESKTOP_SHORTCUT_NAME = resolveDesktopShortcutName({
  shortcutName: process.env.MINERADIO_SHORTCUT_NAME,
  execPath: process.execPath,
  defaultName: APP_NAME,
});

app.setName(INSTANCE_APP_NAME);
app.setPath('userData', INSTANCE_PROFILE.userDataPath);
app.setPath('sessionData', INSTANCE_PROFILE.sessionDataPath);

function resolveRuntimeAppRoots() {
  const sourceRoot = path.join(__dirname, '..');
  const unpacked = process.resourcesPath
    ? path.join(process.resourcesPath, 'app.asar.unpacked')
    : '';
  const asar = process.resourcesPath
    ? path.join(process.resourcesPath, 'app.asar')
    : '';
  const writableRoot = unpacked && fs.existsSync(path.join(unpacked, 'server.js'))
    ? unpacked
    : sourceRoot;
  const resourceRoot = [writableRoot, asar, sourceRoot]
    .find(root => root && fs.existsSync(path.join(root, 'public', 'index.html')))
    || writableRoot;
  return { writableRoot, resourceRoot };
}
const { writableRoot: APP_ROOT, resourceRoot: RESOURCE_ROOT } = resolveRuntimeAppRoots();
const wallpaperEngineNativeTempPath = path.join(app.getPath('userData'), 'native');
fs.mkdirSync(wallpaperEngineNativeTempPath, { recursive: true });
const wallpaperEngineBridge = createWallpaperEngineBridge({
  getMainWindow: () => mainWindow,
  getMainServerPort: () => mainServerPort,
  isAppQuitting: () => appQuitting,
  isWindowFullscreen: () => windowFullscreenActive,
  isHtmlFullscreen: () => htmlFullscreenActive,
  userDataPath: app.getPath('userData'),
  nativeTempPath: wallpaperEngineNativeTempPath,
  desktopCapturer,
});
wallpaperEngineBridge.registerIpc();


let mainWindow = null;
let mainWindowLifecycleStarted = false;
let mainWindowMoveActive = false;
let mainWindowMoveReleaseTimer = null;
let localServer = null;
let mainServerPort = 0;
let desktopLyricsWindow = null;
const desktopLyricsStateCache = new DesktopOverlayStateCache();
let desktopLyricsUserBounds = null;
let desktopLyricsSavedBoundsSignature = '';
let desktopLyricsProgrammaticMove = false;
let desktopLyricsPointerCapture = false;
let desktopLyricsMouseIgnored = null;
let desktopLyricsMouseForwarded = null;
let desktopLyricsLastStateSignature = '';
let desktopLyricsLastOpacity = null;
let desktopLyricsMousePoller = null;
let desktopLyricsMousePollerBuffer = '';
let desktopLyricsHotBounds = null;
let desktopLyricsLastMiddleAt = 0;
let desktopLyricsWindowGeometrySignature = '';
const DESKTOP_LYRICS_SIZE_MIN = 0.20;
const DESKTOP_LYRICS_SIZE_MAX = 1.55;
const DESKTOP_LYRICS_GLOW_MIN = 0;
const DESKTOP_LYRICS_GLOW_MAX = 0.85;
const MAIN_WINDOW_MOVE_RELEASE_DELAY_MS = 160;
const WM_ENTERSIZEMOVE = 0x0231;
const WM_EXITSIZEMOVE = 0x0232;
let wallpaperWindow = null;
const wallpaperStateCache = new DesktopOverlayStateCache();
let miniPlayerWindow = null;
let miniPlayerEnabled = true;
let miniPlayerActive = false;
let miniPlayerMode = 'standard';
let miniPlayerUserMovePending = false;
let miniPlayerPointerPassthrough = false;
let miniPlayerLastSentState = null;
let miniPlayerRecoveryTimer = null;
let miniPlayerRecreateTimer = null;
// 主窗口开始收缩动画时预热的迷你窗口。最小化真正落地前它只是隐藏的已加载窗口，
// 主窗口最终没有最小化时必须由 discardMiniPlayerPrewarm() 丢弃，不为不可见窗口常驻内存。
let miniPlayerPrewarmWindow = null;
let miniPlayerPrewarmTimer = null;
const miniPlayerUserBoundsByMode = { standard: null, compact: null };
const miniPlayerSavedBoundsSignatures = { standard: '', compact: '' };
const miniPlayerProgrammaticCloseWindows = new WeakSet();
const miniPlayerRendererReloadWindows = new WeakSet();
const miniPlayerWindowModes = new WeakMap();
const miniPlayerRecoverySession = new MiniPlayerRecoverySession({
  stopRecoveryTimer: stopMiniPlayerRecoveryTimer,
  stopRecreateTimer: stopMiniPlayerRecreateTimer,
  scheduleRecovery: scheduleMiniPlayerRecovery,
});
const miniPlayerStateCache = new MiniPlayerStateCache(miniPlayerEnabled);
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
const COMPACT_MINI_PLAYER_WIDTH = 268;
const COMPACT_MINI_PLAYER_HEIGHT = 58;
const MINI_PLAYER_MARGIN = 14;
const MINI_PLAYER_RECOVERY_INTERVAL = 5000;
// 预热窗口最长等待主窗口最小化的时间。收缩动画只有 260ms 左右，
// 2600ms 足够覆盖慢机器上的最小化落地，超时仍未进入迷你模式就丢弃预热窗口。
const MINI_PLAYER_PREWARM_TTL = 2600;
const APP_ICON_ICO = path.join(RESOURCE_ROOT, 'build', 'icon.ico');
const LOCAL_FILE_TOKEN = crypto.randomBytes(16).toString('hex');
const DESKTOP_SHELL_SETTINGS_FILE = 'desktop-shell-settings.json';
const DESKTOP_UI_STATE_FILE = 'desktop-ui-state.json';
const PROFILE_STATE_MIGRATION_FILE = 'profile-state-migration-v2.json';
const UI_STATE_ORIGIN_MARKER_FILE = 'ui-state-origin-marker.json';
const PROFILE_STATE_MIGRATION_STAGING_ROOT = path.join(
  app.getPath('temp'),
  'Mineradio-profile-migration-staging',
  INSTANCE_ID,
);
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
  'mineradio-special-liked-playlist-v1',
  'mineradio-local-playlists-v1',
  'mineradio-local-playback-source-v1',
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

const LOCAL_LIBRARY_EXTS = new Set([
  '.mp3', '.mp2', '.flac', '.m4a', '.m4b', '.wav', '.ogg', '.oga', '.aac', '.opus', '.webm', '.weba', '.aif', '.aiff', '.aifc',
  '.lrc', '.txt', '.srt', '.vtt', '.ass', '.yrc',
  '.jpg', '.jpeg', '.jpe', '.jfif', '.png', '.webp', '.avif', '.gif', '.bmp', '.svg',
]);
const LOCAL_LIBRARY_MIME = {
  '.mp3': 'audio/mpeg',
  '.mp2': 'audio/mpeg',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.m4b': 'audio/mp4',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.aac': 'audio/aac',
  '.opus': 'audio/ogg',
  '.webm': 'audio/webm',
  '.weba': 'audio/webm',
  '.aif': 'audio/x-aiff',
  '.aiff': 'audio/x-aiff',
  '.aifc': 'audio/x-aiff',
  '.lrc': 'text/plain',
  '.txt': 'text/plain',
  '.srt': 'application/x-subrip',
  '.vtt': 'text/vtt',
  '.ass': 'text/x-ssa',
  '.yrc': 'text/plain',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.jpe': 'image/jpeg',
  '.jfif': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
};
const LOCAL_LIBRARY_SCAN_STAT_CONCURRENCY = 24;
const LOCAL_LIBRARY_SCAN_VISIT_LIMIT = 60000;
const LOCAL_LIBRARY_INCREMENTAL_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const LOCAL_LIBRARY_NAME_COMPARE = new Intl.Collator('zh-Hans-CN', { numeric: true, sensitivity: 'base' }).compare;

function compareLocalLibraryEntries(a, b) {
  return LOCAL_LIBRARY_NAME_COMPARE(a.name, b.name);
}

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
    entries.sort(compareLocalLibraryEntries);
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
  // 本次遍历若已达访问上限，listed.files/listed.directories 与磁盘现状不一致；此时增量合并会把缺失项误判为删除。
  // 与 previous.truncated 分支同源处理：改用全量语义返回已遍历结果，避免残缺增量覆盖当前会话与持久快照。
  if (listed.truncated) {
    return {
      ok: true,
      folderPath: root,
      files: await statLocalLibraryFiles(root, listed.files),
      directories: listed.directories,
      truncated: true,
      scanMode: 'full',
    };
  }
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

/**
 * 分块读取已授权本地文件范围并编码，避免完整范围 Buffer 与 base64 大字符串同时驻留。
 * @param {string} filePath 已授权文件路径。
 * @param {number} start 起始字节偏移。
 * @param {number|null} end 结束字节偏移，不含该位置。
 * @returns {Promise<object>} 文件大小、实际范围和 base64 分块。
 */
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
  if (!length) return { ok: true, size: fileSize, start: from, end: from, byteLength: 0, base64Chunks: [] };
  const handle = await fs.promises.open(target, 'r');
  try {
    const chunkSize = 768 * 1024;
    const buffer = Buffer.allocUnsafe(Math.min(chunkSize, length));
    const base64Chunks = [];
    let bytesReadTotal = 0;
    // 文件读取允许短读；每轮沿实际字节数推进，直到范围结束或底层明确返回 EOF。
    while (bytesReadTotal < length) {
      const requestLength = Math.min(buffer.length, length - bytesReadTotal);
      const result = await handle.read(buffer, 0, requestLength, from + bytesReadTotal);
      const bytesRead = result && result.bytesRead || 0;
      if (!bytesRead) break;
      base64Chunks.push(buffer.subarray(0, bytesRead).toString('base64'));
      bytesReadTotal += bytesRead;
    }
    return {
      ok: true,
      size: fileSize,
      start: from,
      end: from + bytesReadTotal,
      byteLength: bytesReadTotal,
      base64Chunks,
    };
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
 * @returns {{closeToTray?: boolean, miniPlayer?: boolean, miniPlayerMode?: string, miniPlayerBounds?: {x:number, y:number}, miniPlayerCompactBounds?: {x:number, y:number}}} 已保存的桌面壳设置。
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
 * @param {{closeToTray?: boolean, miniPlayer?: boolean, miniPlayerMode?: string, miniPlayerBounds?: {x:number, y:number}, miniPlayerCompactBounds?: {x:number, y:number}}} patch 要覆盖的设置字段。
 * @returns {{closeToTray?: boolean, miniPlayer?: boolean, miniPlayerMode?: string, miniPlayerBounds?: {x:number, y:number}, miniPlayerCompactBounds?: {x:number, y:number}}} 写入后的完整设置。
 */
function writeDesktopShellSettings(patch) {
  const file = path.join(app.getPath('userData'), DESKTOP_SHELL_SETTINGS_FILE);
  const next = { ...readDesktopShellSettings(), ...(patch || {}) };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

function readDesktopShellSettingsFrom(userDataPath) {
  try {
    const file = path.join(String(userDataPath || ''), DESKTOP_SHELL_SETTINGS_FILE);
    if (!fs.existsSync(file)) return {};
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch (_e) {
    return {};
  }
}

function desktopShellSettingsModifiedAt(userDataPath) {
  try {
    return Number(fs.statSync(path.join(String(userDataPath || ''), DESKTOP_SHELL_SETTINGS_FILE)).mtimeMs) || 0;
  } catch (_e) {
    return 0;
  }
}

function profileStateMigrationPath() {
  return path.join(app.getPath('userData'), PROFILE_STATE_MIGRATION_FILE);
}

function uiStateOriginMarkerPath() {
  return path.join(app.getPath('userData'), UI_STATE_ORIGIN_MARKER_FILE);
}

/**
 * 读取上次完整迁移写入 localStorage 的 origin。
 * @returns {string} origin 字符串，无标记时返回空串。
 */
function readLastMigratedUiStateOrigin() {
  try {
    const raw = JSON.parse(fs.readFileSync(uiStateOriginMarkerPath(), 'utf8'));
    return typeof raw.origin === 'string' ? raw.origin : '';
  } catch (_e) {
    return '';
  }
}

/**
 * 记录本次完整迁移的目标 origin，供下次启动判断稳态跳过。
 * @param {string} origin 本地服务 origin。
 * @returns {void}
 */
function writeLastMigratedUiStateOrigin(origin) {
  try {
    const file = uiStateOriginMarkerPath();
    const tempFile = `${file}.tmp`;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(tempFile, JSON.stringify({ schema: 1, origin: String(origin || ''), at: Date.now() }, null, 2), 'utf8');
    fs.renameSync(tempFile, file);
  } catch (_e) {}
}

function hasCompletedLegacyProfileMigration() {
  try {
    const data = JSON.parse(fs.readFileSync(profileStateMigrationPath(), 'utf8'));
    return isProfileMigrationMarkerCurrent(data, legacyProfilesForMigration());
  } catch (_e) {
    return false;
  }
}

function writeLegacyProfileMigrationMarker(profiles) {
  const file = profileStateMigrationPath();
  const tempFile = `${file}.tmp`;
  const sources = [];
  for (const profile of profiles || []) {
    sources.push({
      instanceId: String(profile.instanceId || ''),
      userDataPath: String(profile.userDataPath || ''),
      modifiedAt: profileModifiedAt(profile.userDataPath, profile.sessionDataPath),
    });
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(tempFile, JSON.stringify({ schema: 2, completedAt: Date.now(), sources }, null, 2), 'utf8');
  fs.renameSync(tempFile, file);
}

function legacyProfilesForMigration() {
  if (!INSTANCE_PROFILE.primary) return [];
  const result = [];
  const seen = new Set([path.resolve(INSTANCE_PROFILE.userDataPath).toLowerCase()]);
  for (const profile of [LEGACY_SHARED_PROFILE].concat(LEGACY_PATH_PROFILES)) {
    if (!profile || !profile.userDataPath || !profile.sessionDataPath) continue;
    const identity = path.resolve(profile.userDataPath).toLowerCase();
    if (seen.has(identity)) continue;
    seen.add(identity);
    if (!fs.existsSync(profile.userDataPath) || !fs.existsSync(profile.sessionDataPath)) continue;
    result.push(profile);
  }
  return result;
}

function migratePrimaryDesktopShellSettings() {
  if (hasCompletedLegacyProfileMigration()) return false;
  const profiles = legacyProfilesForMigration();
  if (!profiles.length) return false;
  let merged = readDesktopShellSettings();
  let selectedModifiedAt = desktopShellSettingsModifiedAt(INSTANCE_PROFILE.userDataPath);
  let changed = false;
  for (const profile of profiles) {
    const source = readDesktopShellSettingsFrom(profile.userDataPath);
    if (!Object.keys(source).length) continue;
    const sourceModifiedAt = desktopShellSettingsModifiedAt(profile.userDataPath);
    merged = sourceModifiedAt >= selectedModifiedAt ? { ...merged, ...source } : { ...source, ...merged };
    selectedModifiedAt = Math.max(selectedModifiedAt, sourceModifiedAt);
    changed = true;
  }
  if (changed) writeDesktopShellSettings(merged);
  return changed;
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

function orderedProfileOrigins(origins, preferredOrigin) {
  const preferred = String(preferredOrigin || '');
  const result = [];
  const seen = new Set();
  if (preferred) {
    result.push(preferred);
    seen.add(preferred);
  }
  const source = Array.isArray(origins) ? origins : [];
  for (const origin of source) {
    const value = String(origin || '');
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function mergeProfileStorageRecords(records) {
  let values = {};
  const source = Array.isArray(records) ? records : [];
  for (const record of source) {
    values = mergePersistentUiValues(values, record && record.values, { preferCandidate: false });
  }
  return values;
}

async function readProfilePersistentValues(profile, profileSession, preferredOrigin, storageSessionDataPath) {
  if (!profile || !profileSession) return { values: {}, modifiedAt: 0, storageReadOk: false };
  const modifiedAt = profileModifiedAt(profile.userDataPath, profile.sessionDataPath);
  const storagePath = storageSessionDataPath || profile.sessionDataPath;
  const persistentKeys = Array.from(DESKTOP_UI_STATE_KEYS);
  const origins = orderedProfileOrigins(discoverLocalStorageOrigins(storagePath), preferredOrigin);
  let values = {};
  let storageReadOk = true;
  if (origins.length) {
    const records = await readSessionLocalStorage({
      session: profileSession,
      BrowserWindow,
      origins,
      keys: persistentKeys,
    });
    storageReadOk = records.length === origins.length;
    values = mergeProfileStorageRecords(records);
  }
  const uiState = readProfileUiState(profile.userDataPath);
  values = mergePersistentUiValues(values, uiState.values, { preferCandidate: true });
  return {
    values,
    modifiedAt: Object.keys(values).length ? modifiedAt : 0,
    storageReadOk,
  };
}

async function migratePrimaryProfileState(port) {
  if (!INSTANCE_PROFILE.primary) return { ok: true, skipped: true };
  const currentOrigin = `http://127.0.0.1:${Number(port) || 3000}`;
  // 稳态（旧档迁移已完成、本地服务端口没变）下，下面的「读出 localStorage 再原样写回」
  // 是纯空转，却要各开一个隐藏窗口做导航。跳过它们；渲染层 preload 的
  // restorePersistentUiState 本来就会用 desktop-ui-state.json 兜底补齐缺失键。
  const legacyProfiles = hasCompletedLegacyProfileMigration() ? [] : legacyProfilesForMigration();
  if (!legacyProfiles.length && readLastMigratedUiStateOrigin() === currentOrigin) {
    return { ok: true, skipped: true, migrated: false };
  }
  const destination = await readProfilePersistentValues(INSTANCE_PROFILE, session.defaultSession, currentOrigin);
  let mergedValues = destination.values;
  let selectedModifiedAt = destination.modifiedAt;
  let legacyStorageReadOk = true;
  for (const legacyProfile of legacyProfiles) {
    try {
      const stagedSessionDataPath = stageProfileSessionData(
        legacyProfile.sessionDataPath,
        PROFILE_STATE_MIGRATION_STAGING_ROOT,
        legacyProfile.instanceId,
      );
      const sourceSession = session.fromPath(stagedSessionDataPath);
      const source = await readProfilePersistentValues(
        legacyProfile,
        sourceSession,
        'http://127.0.0.1:3000',
        stagedSessionDataPath,
      );
      legacyStorageReadOk = legacyStorageReadOk && source.storageReadOk;
      mergedValues = mergePersistentUiValues(mergedValues, source.values, {
        preferCandidate: source.modifiedAt >= selectedModifiedAt,
      });
      selectedModifiedAt = Math.max(selectedModifiedAt, source.modifiedAt);
    } catch (e) {
      console.warn('Legacy profile storage migration unavailable:', e.message);
      legacyStorageReadOk = false;
      const sourceUiState = readProfileUiState(legacyProfile.userDataPath);
      const sourceModifiedAt = profileModifiedAt(legacyProfile.userDataPath, legacyProfile.sessionDataPath);
      mergedValues = mergePersistentUiValues(mergedValues, sourceUiState.values, {
        preferCandidate: sourceModifiedAt >= selectedModifiedAt,
      });
      selectedModifiedAt = Math.max(selectedModifiedAt, sourceModifiedAt);
    }
  }

  if (Object.keys(mergedValues).length) {
    await writeSessionLocalStorage({
      session: session.defaultSession,
      BrowserWindow,
      origin: currentOrigin,
      values: mergedValues,
    });
    writeDesktopUiStatePatch(mergedValues);
  }
  if (legacyProfiles.length && legacyStorageReadOk) writeLegacyProfileMigrationMarker(legacyProfiles);
  writeLastMigratedUiStateOrigin(currentOrigin);
  return {
    ok: true,
    migrated: legacyProfiles.length > 0,
    legacyStorageReadOk,
    destinationModifiedAt: destination.modifiedAt,
  };
}

/**
 * 应用已保存的桌面壳设置，确保关闭按钮行为在窗口创建前就确定。
 * @returns {void}
 */
function applySavedDesktopShellSettings() {
  const saved = readDesktopShellSettings();
  if (typeof saved.closeToTray === 'boolean') closeToTrayEnabled = saved.closeToTray;
  if (typeof saved.miniPlayer === 'boolean') miniPlayerEnabled = saved.miniPlayer;
  const restoredDesktopLyricsBounds = savedDesktopLyricsBounds(saved.desktopLyricsBounds);
  if (restoredDesktopLyricsBounds) {
    desktopLyricsUserBounds = restoredDesktopLyricsBounds;
    desktopLyricsSavedBoundsSignature = desktopLyricsBoundsSignature(restoredDesktopLyricsBounds);
  }
  miniPlayerStateCache.setEnabled(miniPlayerEnabled);
  miniPlayerMode = normalizeMiniPlayerMode(saved.miniPlayerMode);
  const savedBoundsByMode = {
    standard: saved.miniPlayerBounds,
    compact: saved.miniPlayerCompactBounds,
  };
  for (const mode of ['standard', 'compact']) {
    const restoredBounds = savedMiniPlayerBounds(savedBoundsByMode[mode], mode);
    if (!restoredBounds) continue;
    miniPlayerUserBoundsByMode[mode] = restoredBounds;
    miniPlayerSavedBoundsSignatures[mode] = miniPlayerBoundsSignature(savedBoundsByMode[mode]);
    if (miniPlayerBoundsSignature(restoredBounds) !== miniPlayerSavedBoundsSignatures[mode]) persistMiniPlayerUserBounds(restoredBounds, mode);
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
 * 构建应用统一的原生右键菜单模板。托盘图标和迷你播放器（标准 / 极简两套外壳）共用同一份，
 * 迷你播放器右键的项目、顺序、勾选态和行为必须与任务栏托盘右键完全一致，且每一项都可点。
 * @returns {Array<object>} `Menu.buildFromTemplate()` 的模板。
 */
function buildAppContextMenuTemplate() {
  return [
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
      label: '迷你播放器样式',
      submenu: [
        {
          label: '标准（带封面）',
          type: 'radio',
          checked: miniPlayerMode === 'standard',
          click: () => setMiniPlayerMode('standard'),
        },
        {
          label: '极简（无封面）',
          type: 'radio',
          checked: miniPlayerMode === 'compact',
          click: () => setMiniPlayerMode('compact'),
        },
      ],
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
  ];
}

/**
 * 根据当前状态重建托盘菜单，确保菜单勾选态和真实设置一致。
 * @returns {void}
 */
function refreshTrayMenu() {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate(buildAppContextMenuTemplate()));
}

/**
 * 创建系统托盘入口。托盘用于恢复窗口、切换关闭到托盘和开机启动。
 * @returns {void}
 */
function createTray() {
  if (tray || process.platform !== 'win32') return;
  try {
    const icon = fs.existsSync(APP_ICON_ICO) ? APP_ICON_ICO : process.execPath;
    const nextTray = new Tray(icon);
    nextTray.setToolTip(APP_NAME);
    nextTray.on('click', focusMainWindow);
    nextTray.on('double-click', focusMainWindow);
    tray = nextTray;
    refreshTrayMenu();
  } catch (e) {
    tray = null;
    console.warn('System tray unavailable:', e.message);
  }
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
    const shortcutPath = path.join(app.getPath('desktop'), `${DESKTOP_SHORTCUT_NAME}.lnk`);
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

function displayWorkArea(display) {
  const source = display && (display.workArea || display.bounds);
  if (!source) return { x: 0, y: 0, width: 1280, height: 720 };
  return {
    x: Number(source.x) || 0,
    y: Number(source.y) || 0,
    width: Math.max(1, Number(source.width) || 1),
    height: Math.max(1, Number(source.height) || 1),
  };
}

/**
 * 判断窗口边界是否在当前显示器区域内保留了足够的可见面积。
 * 用户拖动结束时允许窗口部分留在工作区外（贴边、跨屏、任务栏遮挡），
 * 只有几乎完全不可见时才需要把窗口夹回可见区域。
 * @param {{x:number,y:number,width:number,height:number}} bounds 窗口边界。
 * @param {{x:number,y:number,width:number,height:number}} area 显示器可见区域。
 * @returns {boolean} 是否仍有可交互的可见面积。
 */
function boundsHasReachableArea(bounds, area) {
  if (!bounds || !area) return false;
  const left = Number(bounds.x);
  const top = Number(bounds.y);
  const width = Number(bounds.width);
  const height = Number(bounds.height);
  if (!Number.isFinite(left) || !Number.isFinite(top) || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return false;
  const visibleWidth = Math.max(0, Math.min(left + width, area.x + area.width) - Math.max(left, area.x));
  const visibleHeight = Math.max(0, Math.min(top + height, area.y + area.height) - Math.max(top, area.y));
  return visibleWidth >= Math.min(width, 160) && visibleHeight >= Math.min(height, 96);
}

function windowedMinimumSize(display) {
  const area = displayWorkArea(display);
  return {
    width: Math.max(480, Math.min(MIN_WINDOWED_WIDTH, Math.floor(area.width - WINDOWED_MARGIN))),
    height: Math.max(270, Math.min(MIN_WINDOWED_HEIGHT, Math.floor(area.height - WINDOWED_MARGIN))),
  };
}

function getWindowedBounds(win) {
  const display = win && !win.isDestroyed()
    ? screen.getDisplayMatching(win.getBounds())
    : screen.getPrimaryDisplay();
  const area = displayWorkArea(display);
  const minimum = windowedMinimumSize(display);
  const maxWidth = Math.max(minimum.width, Math.floor(area.width - WINDOWED_MARGIN));
  const maxHeight = Math.max(minimum.height, Math.floor(area.height - WINDOWED_MARGIN));

  let width = Math.round(area.width * WINDOWED_SCALE);
  let height = Math.round(width / WINDOWED_ASPECT);
  const scaledHeight = Math.round(area.height * WINDOWED_SCALE);

  if (height > scaledHeight) {
    height = scaledHeight;
    width = Math.round(height * WINDOWED_ASPECT);
  }

  if (width < minimum.width && maxWidth >= minimum.width && maxHeight >= minimum.height) {
    width = minimum.width;
    height = minimum.height;
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
  const display = screen.getDisplayMatching(win.getBounds()) || screen.getPrimaryDisplay();
  const minimum = windowedMinimumSize(display);
  win.setMinimumSize(minimum.width, minimum.height);
  win.setBounds(getWindowedBounds(win), false);
  sendWindowState(win);
}

/**
 * 将普通主窗口限制在当前显示器工作区内，但不干预正在切换或已经进入的全屏窗口。
 * Windows 的透明无边框窗口在 Electron 43 中可能已经覆盖显示器，isFullScreen() 仍返回 false，
 * 因此必须同时使用应用维护的窗口全屏和 HTML 全屏状态，避免 move 事件把窗口重新缩回工作区。
 * @param {Electron.BrowserWindow} win 当前主窗口。
 * @returns {void}
 * @see https://www.electronjs.org/docs/latest/api/browser-window#winsetfullscreenflag
 */
function keepMainWindowInsideDisplay(win, options = {}) {
  if (!win || win.isDestroyed() || win.isFullScreen()
    || windowFullscreenActive || htmlFullscreenActive || win.isMaximized()) return;
  const display = screen.getDisplayMatching(win.getBounds()) || screen.getPrimaryDisplay();
  const area = displayWorkArea(display);
  const minimum = windowedMinimumSize(display);
  win.setMinimumSize(minimum.width, minimum.height);
  const bounds = win.getBounds();
  const needsSizeCorrection = bounds.width > area.width || bounds.height > area.height;
  const needsPositionCorrection = bounds.x < area.x
    || bounds.y < area.y
    || bounds.x + bounds.width > area.x + area.width
    || bounds.y + bounds.height > area.y + area.height;
  if (!needsSizeCorrection && !needsPositionCorrection) return;
  // 用户拖动结束时保留贴边、跨屏或任务栏遮挡的释放位置，不再在松手瞬间夹回导致跳位；
  // 仅当窗口在当前工作区几乎完全不可见时才夹回位置；显示器参数变化仍走全量纠偏。
  if (needsPositionCorrection && !needsSizeCorrection && options.allowPartial === true
    && boundsHasReachableArea(bounds, area)) return;

  const nextBounds = needsSizeCorrection ? getWindowedBounds(win) : { ...bounds };
  const maxX = Math.max(area.x, area.x + area.width - nextBounds.width);
  const maxY = Math.max(area.y, area.y + area.height - nextBounds.height);
  nextBounds.x = Math.round(Math.min(Math.max(bounds.x, area.x), maxX));
  nextBounds.y = Math.round(Math.min(Math.max(bounds.y, area.y), maxY));

  if (nextBounds.x !== bounds.x || nextBounds.y !== bounds.y
    || nextBounds.width !== bounds.width || nextBounds.height !== bounds.height) {
    win.setBounds(nextBounds, false);
  }
}

/**
 * 退出主窗口全屏并恢复居中的普通窗口尺寸。
 * @param {Electron.BrowserWindow} win 当前主窗口。
 * @returns {void}
 */
function exitFullscreenToWindow(win) {
  if (!win || win.isDestroyed()) return;
  const wasFullscreen = win.isFullScreen() || windowFullscreenActive;
  windowFullscreenActive = false;

  if (!wasFullscreen) {
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

/**
 * 在原生全屏与普通窗口之间切换主窗口。
 * @param {Electron.BrowserWindow} win 当前主窗口。
 * @returns {void}
 */
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

/**
 * 判断主进程是否应接管 Esc 并退出窗口全屏。
 * HTML 全屏必须交给 Chromium 退出，否则 Windows 上可能只恢复窗口边界而留下 DOM 全屏状态。
 * @param {Electron.Input} input 当前键盘输入。
 * @param {Electron.BrowserWindow} win 当前主窗口。
 * @returns {boolean} 是否应阻止默认输入并退出窗口全屏。
 * @see https://github.com/electron/electron/blob/v43.4.0/shell/browser/api/electron_api_web_contents.cc#L4610-L4662
 */
function shouldExitWindowFullscreenFromInput(input, win) {
  return input.type === 'keyDown'
    && (input.key === 'Escape' || input.code === 'Escape')
    && !htmlFullscreenActive
    && (win.isFullScreen() || windowFullscreenActive);
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

/**
 * 根据歌词纵向偏好计算桌面歌词默认边界。
 * @param {object} payload 当前桌面歌词状态。
 * @returns {{x:number,y:number,width:number,height:number}} 当前显示器内的窗口边界。
 */
function desktopLyricsDefaultBounds(payload = desktopLyricsStateCache.value) {
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

function desktopLyricsBoundsSignature(bounds) {
  if (!bounds) return '';
  return `${Math.round(bounds.x)}|${Math.round(bounds.y)}|${Math.round(bounds.width)}|${Math.round(bounds.height)}`;
}

function desktopLyricsBoundsHasReachableArea(bounds, area) {
  return boundsHasReachableArea(bounds, area);
}

function savedDesktopLyricsBounds(value) {
  if (!value || typeof value !== 'object') return null;
  if (!Number.isFinite(Number(value.x)) || !Number.isFinite(Number(value.y))) return null;
  const fallback = desktopLyricsDefaultBounds();
  return constrainDesktopLyricsBounds({
    x: Number(value.x),
    y: Number(value.y),
    width: Number.isFinite(Number(value.width)) ? Number(value.width) : fallback.width,
    height: Number.isFinite(Number(value.height)) ? Number(value.height) : fallback.height,
  }, { allowPartial: true });
}

function constrainDesktopLyricsBounds(bounds, options = {}) {
  const display = screen.getDisplayMatching(bounds);
  const area = display.bounds;
  const next = {
    ...bounds,
    width: Math.round(Math.min(Math.max(320, bounds.width), area.width)),
    height: Math.round(Math.min(Math.max(180, bounds.height), area.height)),
  };
  if (options.allowPartial === true && desktopLyricsBoundsHasReachableArea(next, area)) {
    next.x = Math.round(next.x);
    next.y = Math.round(next.y);
    return next;
  }
  const maxX = area.x + Math.max(0, area.width - next.width);
  const maxY = area.y + Math.max(0, area.height - next.height);
  next.x = Math.round(clampNumber(next.x, area.x, maxX, area.x));
  next.y = Math.round(clampNumber(next.y, area.y, maxY, area.y));
  return next;
}

function setDesktopLyricsBounds(bounds, options = {}) {
  if (!desktopLyricsWindow || desktopLyricsWindow.isDestroyed()) return;
  const nextBounds = constrainDesktopLyricsBounds(bounds, options);
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

/**
 * 清除手动桌面歌词坐标，避免旧 bounds 在重启后覆盖新的纵向比例偏好。
 * @returns {void}
 */
function clearDesktopLyricsUserBounds() {
  const shouldPersist = desktopLyricsUserBounds !== null || desktopLyricsSavedBoundsSignature !== '';
  desktopLyricsUserBounds = null;
  desktopLyricsSavedBoundsSignature = '';
  if (shouldPersist) writeDesktopShellSettings({ desktopLyricsBounds: null });
}

/**
 * 保存桌面歌词用户坐标；force 用于拖动结束或退出时绕过短暂的程序定位保护。
 * @param {{force?: boolean}=} options 保存选项。
 * @returns {void}
 */
function rememberDesktopLyricsBounds(options = {}) {
  if (!desktopLyricsWindow || desktopLyricsWindow.isDestroyed()) return;
  if (desktopLyricsProgrammaticMove && options.force !== true) return;
  desktopLyricsUserBounds = constrainDesktopLyricsBounds(desktopLyricsWindow.getBounds(), { allowPartial: true });
  const signature = desktopLyricsBoundsSignature(desktopLyricsUserBounds);
  if (signature === desktopLyricsSavedBoundsSignature) return;
  writeDesktopShellSettings({
    desktopLyricsBounds: {
      x: desktopLyricsUserBounds.x,
      y: desktopLyricsUserBounds.y,
      width: desktopLyricsUserBounds.width,
      height: desktopLyricsUserBounds.height,
    },
  });
  desktopLyricsSavedBoundsSignature = signature;
}

/**
 * 按锁定态和指针捕获态更新桌面歌词鼠标穿透行为。
 * @returns {void}
 */
function applyDesktopLyricsMouseBehavior() {
  if (!desktopLyricsWindow || desktopLyricsWindow.isDestroyed()) return;
  const locked = desktopLyricsStateCache.value.clickThrough !== false;
  const shouldIgnore = mainWindowMoveActive || locked || !desktopLyricsPointerCapture;
  const shouldForward = shouldIgnore && !mainWindowMoveActive;
  if (desktopLyricsMouseIgnored === shouldIgnore
    && desktopLyricsMouseForwarded === shouldForward) return;
  desktopLyricsMouseIgnored = shouldIgnore;
  desktopLyricsMouseForwarded = shouldForward;
  if (shouldIgnore) {
    desktopLyricsWindow.setIgnoreMouseEvents(true, { forward: shouldForward });
  } else {
    desktopLyricsWindow.setIgnoreMouseEvents(false);
  }
}

function clearMainWindowMoveReleaseTimer() {
  if (!mainWindowMoveReleaseTimer) return;
  clearTimeout(mainWindowMoveReleaseTimer);
  mainWindowMoveReleaseTimer = null;
}

function beginMainWindowUserMove() {
  clearMainWindowMoveReleaseTimer();
  desktopLyricsPointerCapture = false;
  if (mainWindowMoveActive) {
    applyDesktopLyricsMouseBehavior();
    return;
  }
  mainWindowMoveActive = true;
  applyDesktopLyricsMouseBehavior();
}

function scheduleMainWindowMoveRelease() {
  if (!mainWindowMoveActive) return;
  clearMainWindowMoveReleaseTimer();
  mainWindowMoveReleaseTimer = setTimeout(() => {
    mainWindowMoveReleaseTimer = null;
    if (!mainWindowMoveActive) return;
    mainWindowMoveActive = false;
    applyDesktopLyricsMouseBehavior();
  }, MAIN_WINDOW_MOVE_RELEASE_DELAY_MS);
}

function resetMainWindowMoveState() {
  clearMainWindowMoveReleaseTimer();
  if (!mainWindowMoveActive) return;
  mainWindowMoveActive = false;
  applyDesktopLyricsMouseBehavior();
}

/**
 * 使用 Windows 原生移动循环作为桌面歌词穿透的最早信号。
 * Electron 的 will-move 在透明无边框窗口上可能晚于系统进入拖动循环，
 * 指针经过置顶歌词窗口时仍可能被抢走；原生消息能在跨窗口前先禁用歌词命中。
 * @param {Electron.BrowserWindow} win 主窗口。
 * @returns {void}
 */
function installMainWindowNativeMoveGuard(win) {
  if (process.platform !== 'win32' || !win || win.isDestroyed()
    || typeof win.hookWindowMessage !== 'function') return;
  try {
    win.hookWindowMessage(WM_ENTERSIZEMOVE, () => {
      if (mainWindow !== win || win.isDestroyed()) return;
      beginMainWindowUserMove();
    });
    win.hookWindowMessage(WM_EXITSIZEMOVE, () => {
      if (mainWindow !== win || win.isDestroyed()) return;
      scheduleMainWindowMoveRelease();
      scheduleWindowStateSend(win);
    });
  } catch (error) {
    console.warn('Main window native move guard unavailable:', error.message);
  }
}

function desktopLyricsHotBoundsOnScreen() {
  if (!desktopLyricsWindow || desktopLyricsWindow.isDestroyed()) return null;
  const winBounds = desktopLyricsWindow.getBounds();
  const rel = desktopLyricsHotBounds;
  if (!rel) return null;
  return {
    x: winBounds.x + rel.left,
    y: winBounds.y + rel.top,
    width: Math.max(1, rel.right - rel.left),
    height: Math.max(1, rel.bottom - rel.top),
  };
}

/**
 * 计算桌面歌词窗口相对当前显示器的物理裁切量。
 * renderer 只能看到窗口内部坐标，窗口如果被拖到屏幕顶部之外，必须把这段裁切量告知 renderer。
 * @returns {{windowY:number,screenTop:number,topInset:number,bottomInset:number}|null} 窗口几何信息。
 */
function desktopLyricsWindowGeometry() {
  if (!desktopLyricsWindow || desktopLyricsWindow.isDestroyed()) return null;
  const bounds = desktopLyricsWindow.getBounds();
  let display = null;
  try {
    display = screen.getDisplayMatching(bounds);
  } catch (_error) {}
  const displayBounds = display && display.bounds ? display.bounds : null;
  const windowY = Number.isFinite(Number(bounds.y)) ? Number(bounds.y) : 0;
  const windowHeight = Number.isFinite(Number(bounds.height)) ? Number(bounds.height) : 0;
  const screenTop = displayBounds && Number.isFinite(Number(displayBounds.y))
    ? Number(displayBounds.y)
    : 0;
  const screenHeight = displayBounds && Number.isFinite(Number(displayBounds.height))
    ? Number(displayBounds.height)
    : 0;
  return {
    windowY: Math.round(windowY),
    screenTop: Math.round(screenTop),
    topInset: Math.max(0, Math.round(screenTop - windowY)),
    bottomInset: Math.max(0, Math.round(windowY + windowHeight - (screenTop + screenHeight))),
  };
}

/**
 * 只向桌面歌词 renderer 发送轻量窗口几何，不混入带 beatMap 的完整歌词状态。
 * @param {boolean} force 是否忽略签名判重。
 * @returns {void}
 */
function sendDesktopLyricsWindowGeometry(force = false) {
  if (!desktopLyricsWindow || desktopLyricsWindow.isDestroyed()) return;
  const geometry = desktopLyricsWindowGeometry();
  if (!geometry) return;
  const signature = [
    geometry.windowY,
    geometry.screenTop,
    geometry.topInset,
    geometry.bottomInset,
  ].join('|');
  if (!force && signature === desktopLyricsWindowGeometrySignature) return;
  desktopLyricsWindowGeometrySignature = signature;
  desktopLyricsWindow.webContents.send('mineradio-desktop-lyrics-window-geometry', geometry);
}

function pointInBounds(point, bounds) {
  if (!point || !bounds) return false;
  return point.x >= bounds.x
    && point.x <= bounds.x + bounds.width
    && point.y >= bounds.y
    && point.y <= bounds.y + bounds.height;
}

/**
 * 处理中键轮询命中，仅在歌词热区内切换锁定状态。
 * @returns {void}
 */
function handleDesktopLyricsGlobalMiddleClick() {
  if (!desktopLyricsWindow || desktopLyricsWindow.isDestroyed()) return;
  if (!desktopLyricsStateCache.enabled) return;
  const now = Date.now();
  if (now - desktopLyricsLastMiddleAt < 260) return;
  const point = screen.getCursorScreenPoint();
  if (!pointInBounds(point, desktopLyricsHotBoundsOnScreen())) return;
  desktopLyricsLastMiddleAt = now;
  const nextLocked = desktopLyricsStateCache.value.clickThrough === false;
  desktopLyricsStateCache.apply({ clickThrough: nextLocked });
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

/**
 * 启动桌面歌词中键轮询，并确保旧进程的结束事件不能覆盖新进程所有权。
 * @returns {void}
 */
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
    const poller = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    desktopLyricsMousePoller = poller;

    /**
     * 只消费当前进程的输出；已停止进程的迟到数据不得污染替代进程的共享缓冲区。
     * @param {Buffer|string} chunk PowerShell stdout 数据块。
     * @returns {void}
     */
    function consumeOwnedPollerOutput(chunk) {
      if (desktopLyricsMousePoller !== poller) return;
      consumeDesktopLyricsMousePollerOutput(chunk);
    }

    poller.stdout.on('data', consumeOwnedPollerOutput);

    /**
     * 仅释放触发事件的当前进程；旧进程延迟结束时不得清空替代进程句柄。
     * @returns {void}
     */
    function releaseOwnedPoller() {
      if (desktopLyricsMousePoller !== poller) return;
      desktopLyricsMousePoller = null;
      desktopLyricsMousePollerBuffer = '';
    }

    poller.on('exit', releaseOwnedPoller);
    poller.on('error', releaseOwnedPoller);
  } catch (e) {
    desktopLyricsMousePoller = null;
    desktopLyricsMousePollerBuffer = '';
  }
}

/**
 * 停止当前桌面歌词中键轮询；先移交所有权，再终止子进程以隔离延迟事件。
 * @returns {void}
 */
function stopDesktopLyricsMousePoller() {
  if (!desktopLyricsMousePoller) return;
  const poller = desktopLyricsMousePoller;
  desktopLyricsMousePoller = null;
  desktopLyricsMousePollerBuffer = '';
  try {
    poller.kill();
  } catch (e) {}
}

/**
 * 向主 renderer 和歌词窗口广播当前锁定状态。
 * @returns {void}
 */
function broadcastDesktopLyricsLockState() {
  const locked = desktopLyricsStateCache.value.clickThrough !== false;
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

function sendDesktopLyricsSizeRequest(size) {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  if (typeof mainWindow.webContents.isLoadingMainFrame === 'function' && mainWindow.webContents.isLoadingMainFrame()) return false;
  mainWindow.webContents.send('mineradio-desktop-lyrics-size-request', { size });
  return true;
}

function sendDesktopLyricsSizeState(size) {
  if (!desktopLyricsWindow || desktopLyricsWindow.isDestroyed()) return;
  desktopLyricsLastStateSignature = desktopLyricsStateSignature(desktopLyricsStateCache.value);
  desktopLyricsWindow.webContents.send('mineradio-desktop-lyrics-state', { size });
}

/**
 * 应用桌面歌词位置与透明度；已有手动位置默认优先。
 * @param {object} payload 当前桌面歌词状态。
 * @param {{force?:boolean}} options 是否忽略手动位置并强制按比例定位。
 * @returns {void}
 */
function positionDesktopLyricsWindow(payload = desktopLyricsStateCache.value, options = {}) {
  if (!desktopLyricsWindow || desktopLyricsWindow.isDestroyed()) return;
  const shouldUseManualBounds = desktopLyricsUserBounds && !options.force;
  setDesktopLyricsBounds(
    shouldUseManualBounds ? desktopLyricsUserBounds : desktopLyricsDefaultBounds(payload),
    { allowPartial: !!shouldUseManualBounds },
  );
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
    payload.stable ? 1 : 0,
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

/**
 * 将当前歌词状态增量发送到桌面歌词 renderer。
 * @param {boolean} force 是否忽略签名判重。
 * @returns {void}
 */
function sendDesktopLyricsState(force = false) {
  if (!desktopLyricsWindow || desktopLyricsWindow.isDestroyed()) return;
  const state = desktopLyricsStateCache.value;
  const signature = desktopLyricsStateSignature(state);
  if (!force && signature === desktopLyricsLastStateSignature) return;
  desktopLyricsLastStateSignature = signature;
  desktopLyricsWindow.webContents.send('mineradio-desktop-lyrics-state', state);
}

/**
 * 启用或更新桌面歌词窗口，并把当前完整状态交给生命周期缓存。
 * @param {object} payload renderer 提供的当前歌词状态。
 * @returns {Electron.BrowserWindow} 桌面歌词窗口。
 */
function createDesktopLyricsWindow(payload = {}) {
  const previousState = desktopLyricsStateCache.value;
  const previousY = previousState.y;
  const previousOpacity = previousState.opacity;
  const state = desktopLyricsStateCache.setEnabled(true, payload);
  const hasY = Object.prototype.hasOwnProperty.call(payload || {}, 'y');
  const nextY = clampNumber(state.y, 0.08, 0.92, 0.76);
  const yChanged = hasY && Number.isFinite(Number(previousY)) && Math.abs(nextY - clampNumber(previousY, 0.08, 0.92, 0.76)) > 0.001;
  const opacityChanged = Object.prototype.hasOwnProperty.call(payload || {}, 'opacity')
    && Math.abs(clampNumber(state.opacity, 0.28, 1, 0.92) - clampNumber(previousOpacity, 0.28, 1, 0.92)) > 0.001;
  // 首次启动时 renderer 会重新发送保存的 y 偏好；它不应覆盖已经从磁盘恢复的手动窗口坐标。
  // 只有现存窗口收到用户的 y 调整时，才清除手动 bounds 并切回比例定位。
  const resetManualBounds = yChanged && desktopLyricsWindow && !desktopLyricsWindow.isDestroyed();
  if (resetManualBounds) clearDesktopLyricsUserBounds();
  if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
    if (resetManualBounds) {
      positionDesktopLyricsWindow(state, { force: true });
    } else if (opacityChanged) {
      setDesktopLyricsOpacity(state.opacity);
    }
    applyDesktopLyricsMouseBehavior();
    sendDesktopLyricsState();
    return desktopLyricsWindow;
  }

  const win = new BrowserWindow({
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
      backgroundThrottling: true,
    },
  });
  desktopLyricsWindow = win;
  desktopLyricsWindowGeometrySignature = '';
  desktopLyricsHotBounds = null;
  try {
    win.setAlwaysOnTop(true, 'screen-saver');
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  } catch (e) {
    console.warn('Desktop lyrics topmost setup skipped:', e.message);
  }
  startDesktopLyricsMousePoller();
  applyDesktopLyricsMouseBehavior();
  positionDesktopLyricsWindow(state, { force: !!resetManualBounds || !desktopLyricsUserBounds });

  /**
   * 仅显示仍持有全局槽位的歌词窗口，隔离旧实例迟到的 ready 事件。
   * @returns {void}
   */
  function showOwnedDesktopLyricsWindow() {
    if (desktopLyricsWindow !== win || win.isDestroyed()) return;
    win.showInactive();
    sendDesktopLyricsWindowGeometry(true);
    sendDesktopLyricsState(true);
  }

  /**
   * 页面加载完成后只为当前歌词窗口发送状态。
   * @returns {void}
   */
  function sendOwnedDesktopLyricsState() {
    if (desktopLyricsWindow !== win || win.isDestroyed()) return;
    sendDesktopLyricsWindowGeometry(true);
    sendDesktopLyricsState(true);
  }

  /**
   * 仅由当前歌词窗口释放全局句柄，旧实例关闭不能覆盖替代窗口。
   * 窗口崩溃或被意外关闭时同步终止中键轮询子进程，避免孤儿 PowerShell 进程残留空转。
   * @returns {void}
   */
  function releaseOwnedDesktopLyricsWindow() {
    if (desktopLyricsWindow !== win) return;
    desktopLyricsWindow = null;
    stopDesktopLyricsMousePoller();
    desktopLyricsMouseIgnored = null;
    desktopLyricsMouseForwarded = null;
    desktopLyricsLastStateSignature = '';
    desktopLyricsLastOpacity = null;
    desktopLyricsHotBounds = null;
    desktopLyricsWindowGeometrySignature = '';
  }

  function resetOwnedDesktopLyricsHotBounds() {
    if (desktopLyricsWindow !== win) return;
    desktopLyricsHotBounds = null;
  }

  /**
   * 只记录当前歌词窗口的用户移动结果。
   * @returns {void}
   */
  function rememberOwnedDesktopLyricsBounds() {
    if (desktopLyricsWindow !== win) return;
    rememberDesktopLyricsBounds();
  }

  /**
   * 记录桌面歌词页面加载失败原因。
   * @param {Error} error 加载错误。
   * @returns {void}
   */
  function reportDesktopLyricsLoadFailure(error) {
    console.warn('Desktop lyrics load failed:', error.message);
  }

  win.once('ready-to-show', showOwnedDesktopLyricsWindow);
  win.webContents.on('did-start-loading', resetOwnedDesktopLyricsHotBounds);
  win.webContents.once('did-finish-load', sendOwnedDesktopLyricsState);
  win.on('close', rememberOwnedDesktopLyricsBounds);
  win.on('closed', releaseOwnedDesktopLyricsWindow);
  win.on('moved', () => {
    sendDesktopLyricsWindowGeometry();
    rememberOwnedDesktopLyricsBounds();
  });
  win.loadURL(overlayUrl('desktop-lyrics.html')).catch(reportDesktopLyricsLoadFailure);
  return win;
}

/**
 * 关闭桌面歌词窗口和轮询进程，并释放歌词及节奏图状态。
 * @param {{broadcast?: boolean}=} options 是否向主 renderer 广播关闭状态。
 * @returns {void}
 */
function closeDesktopLyricsWindow(options = {}) {
  const broadcast = options.broadcast !== false;
  desktopLyricsStateCache.setEnabled(false);
  desktopLyricsPointerCapture = false;
  desktopLyricsMouseIgnored = null;
  desktopLyricsMouseForwarded = null;
  desktopLyricsLastStateSignature = '';
  desktopLyricsLastOpacity = null;
  desktopLyricsHotBounds = null;
  desktopLyricsWindowGeometrySignature = '';
  stopDesktopLyricsMousePoller();
  if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
    rememberDesktopLyricsBounds({ force: true });
    sendDesktopLyricsState();
    desktopLyricsWindow.close();
  }
  desktopLyricsWindow = null;
  if (broadcast) broadcastDesktopLyricsEnabledState(false);
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

/**
 * 将当前壁纸状态发送到壁纸 renderer。
 * @returns {void}
 */
function sendWallpaperState() {
  if (!wallpaperWindow || wallpaperWindow.isDestroyed()) return;
  wallpaperWindow.webContents.send('mineradio-wallpaper-state', wallpaperStateCache.value);
}

/**
 * 启用或更新壁纸窗口，并缓存当前完整壁纸状态。
 * @param {object} payload renderer 提供的当前壁纸状态。
 * @returns {Electron.BrowserWindow} 壁纸窗口。
 */
function createWallpaperWindow(payload = {}) {
  wallpaperStateCache.setEnabled(true, payload);
  if (wallpaperWindow && !wallpaperWindow.isDestroyed()) {
    positionWallpaperWindow();
    sendWallpaperState();
    return wallpaperWindow;
  }
  const bounds = screen.getPrimaryDisplay().bounds;
  const win = new BrowserWindow({
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
      backgroundThrottling: true,
    },
  });
  wallpaperWindow = win;
  win.setIgnoreMouseEvents(true, { forward: true });

  /**
   * 仅显示并挂载仍持有全局槽位的壁纸窗口。
   * @returns {void}
   */
  function showOwnedWallpaperWindow() {
    if (wallpaperWindow !== win || win.isDestroyed()) return;
    positionWallpaperWindow();
    win.showInactive();
    attachWallpaperToWorkerW(win);
    sendWallpaperState();
  }

  /**
   * 页面加载完成后只为当前壁纸窗口发送状态。
   * @returns {void}
   */
  function sendOwnedWallpaperState() {
    if (wallpaperWindow !== win || win.isDestroyed()) return;
    sendWallpaperState();
  }

  /**
   * 仅由当前壁纸窗口释放全局句柄，旧实例关闭不能覆盖替代窗口。
   * @returns {void}
   */
  function releaseOwnedWallpaperWindow() {
    if (wallpaperWindow !== win) return;
    wallpaperWindow = null;
  }

  /**
   * 记录壁纸页面加载失败原因。
   * @param {Error} error 加载错误。
   * @returns {void}
   */
  function reportWallpaperLoadFailure(error) {
    console.warn('Wallpaper load failed:', error.message);
  }

  win.once('ready-to-show', showOwnedWallpaperWindow);
  win.webContents.once('did-finish-load', sendOwnedWallpaperState);
  win.on('closed', releaseOwnedWallpaperWindow);
  win.loadURL(overlayUrl('wallpaper.html')).catch(reportWallpaperLoadFailure);
  return win;
}

/**
 * 关闭壁纸窗口并释放封面等重载荷状态。
 * @returns {void}
 */
function closeWallpaperWindow() {
  wallpaperStateCache.setEnabled(false);
  if (wallpaperWindow && !wallpaperWindow.isDestroyed()) {
    sendWallpaperState();
    wallpaperWindow.close();
  }
  wallpaperWindow = null;
}

function normalizeMiniPlayerMode(value) {
  return value === 'compact' ? 'compact' : 'standard';
}

function miniPlayerSize(mode) {
  return normalizeMiniPlayerMode(mode) === 'compact'
    ? { width: COMPACT_MINI_PLAYER_WIDTH, height: COMPACT_MINI_PLAYER_HEIGHT }
    : { width: MINI_PLAYER_WIDTH, height: MINI_PLAYER_HEIGHT };
}

function miniPlayerModeForWindow(win) {
  return normalizeMiniPlayerMode(win ? miniPlayerWindowModes.get(win) : miniPlayerMode);
}

function miniPlayerDefaultBounds(mode) {
  const size = miniPlayerSize(mode);
  const referenceBounds = mainWindow && !mainWindow.isDestroyed()
    ? mainWindow.getBounds()
    : screen.getPrimaryDisplay().bounds;
  const display = screen.getDisplayMatching(referenceBounds) || screen.getPrimaryDisplay();
  const workArea = display.workArea;
  return {
    x: workArea.x + workArea.width - size.width - MINI_PLAYER_MARGIN,
    y: workArea.y + workArea.height - size.height - MINI_PLAYER_MARGIN,
    width: size.width,
    height: size.height,
  };
}

function clampMiniPlayerBounds(bounds, mode) {
  const size = miniPlayerSize(mode);
  const source = bounds || miniPlayerDefaultBounds(mode);
  const display = screen.getDisplayMatching(source) || screen.getPrimaryDisplay();
  const workArea = display.workArea;
  return {
    x: Math.round(Math.max(workArea.x, Math.min(source.x, workArea.x + workArea.width - size.width))),
    y: Math.round(Math.max(workArea.y, Math.min(source.y, workArea.y + workArea.height - size.height))),
    width: size.width,
    height: size.height,
  };
}

/**
 * 根据迷你窗口距离显示器左右工作区边缘的空间决定展开方向。
 * 右侧可用空间更少时返回 left，让完整控制栏向封面左侧展开；其余位置保持向右展开。
 * @param {{x:number,y:number,width:number,height:number}} bounds 当前迷你窗口边界。
 * @returns {'left'|'right'} 标准迷你播放器的展开方向。
 */
function miniPlayerExpandDirectionForBounds(bounds) {
  const source = bounds || miniPlayerDefaultBounds('standard');
  const display = screen.getDisplayMatching(source) || screen.getPrimaryDisplay();
  const workArea = display && display.workArea ? display.workArea : { x: 0, width: 0 };
  const width = Number.isFinite(Number(source.width)) ? Number(source.width) : MINI_PLAYER_WIDTH;
  const leftSpace = Number(source.x) - Number(workArea.x || 0);
  const rightSpace = Number(workArea.x || 0) + Number(workArea.width || 0) - (Number(source.x) + width);
  return rightSpace < leftSpace ? 'left' : 'right';
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
 * @param {'standard'|'compact'} mode 迷你播放器样式。
 * @returns {{x:number, y:number, width:number, height:number}|null} 当前显示器内的固定尺寸坐标。
 */
function savedMiniPlayerBounds(value, mode) {
  if (!value || typeof value !== 'object') return null;
  if (typeof value.x !== 'number' || !Number.isFinite(value.x)) return null;
  if (typeof value.y !== 'number' || !Number.isFinite(value.y)) return null;
  const size = miniPlayerSize(mode);
  return clampMiniPlayerBounds({ x: value.x, y: value.y, ...size }, mode);
}

/**
 * 保存用户迷你播放器坐标。同一位置只写入一次，避免拖动结束或系统事件重复落盘。
 * @param {{x:number, y:number, width?:number, height?:number}} bounds 用户或系统校正后的坐标。
 * @param {'standard'|'compact'} mode 迷你播放器样式。
 * @returns {{x:number, y:number, width:number, height:number}} 实际保存的工作区内坐标。
 */
function persistMiniPlayerUserBounds(bounds, mode) {
  const normalizedMode = normalizeMiniPlayerMode(mode);
  const nextBounds = clampMiniPlayerBounds(bounds, normalizedMode);
  const signature = miniPlayerBoundsSignature(nextBounds);
  miniPlayerUserBoundsByMode[normalizedMode] = nextBounds;
  if (signature === miniPlayerSavedBoundsSignatures[normalizedMode]) return nextBounds;
  const settingKey = normalizedMode === 'compact' ? 'miniPlayerCompactBounds' : 'miniPlayerBounds';
  writeDesktopShellSettings({ [settingKey]: { x: nextBounds.x, y: nextBounds.y } });
  miniPlayerSavedBoundsSignatures[normalizedMode] = signature;
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
  persistMiniPlayerUserBounds(win.getBounds(), miniPlayerModeForWindow(win));
  sendMiniPlayerState();
}

/**
 * 把迷你播放器放回默认或用户坐标。程序定位前清除未完成的用户拖动标记。
 * @returns {void}
 */
function positionMiniPlayerWindow() {
  if (!miniPlayerWindow || miniPlayerWindow.isDestroyed()) return;
  const mode = miniPlayerModeForWindow(miniPlayerWindow);
  const nextBounds = clampMiniPlayerBounds(miniPlayerUserBoundsByMode[mode] || miniPlayerDefaultBounds(mode), mode);
  miniPlayerUserMovePending = false;
  miniPlayerWindow.setBounds(nextBounds, false);
  if (miniPlayerUserBoundsByMode[mode]) persistMiniPlayerUserBounds(nextBounds, mode);
  sendMiniPlayerState();
}

/**
 * 把主进程缓存的迷你播放器状态按字段增量发送给迷你 renderer。
 * @param {boolean} force 是否忽略上次发送快照并发送完整状态。
 * @returns {void}
 */
function sendMiniPlayerState(force = false) {
  const win = miniPlayerWindow;
  if (!win || win.isDestroyed() || win.webContents.isDestroyed()) return;
  const includeCover = miniPlayerModeForWindow(win) === 'standard';
  const state = miniPlayerStateCache.value;
  const visual = state.visual || {};
  const visualSignature = JSON.stringify(visual);
  const themeVars = state.themeVars || {};
  const next = {
    themeVars,
    themeSignature: miniPlayerThemeSignature(themeVars),
    title: state.title || 'Mineradio',
    artist: state.artist || '',
    playing: !!state.playing,
    hasTrack: !!state.hasTrack,
    desktopLyrics: state.desktopLyrics === true,
    metaSignature: state.metaSignature || '',
  };
  if (includeCover) {
    next.cover = state.cover || '';
    next.pulse = Number.isFinite(state.pulse) ? state.pulse : 0;
    next.visual = visual;
    next.visualSignature = visualSignature;
    next.expandDirection = miniPlayerExpandDirectionForBounds(win.getBounds());
  }
  const previous = miniPlayerLastSentState;
  const patch = {};
  let changed = false;
  const metadataChanged = force || !previous
    || next.metaSignature !== previous.metaSignature
    || next.title !== previous.title
    || next.artist !== previous.artist
    || (includeCover && next.cover !== previous.cover);
  if (metadataChanged) {
    patch.title = next.title;
    patch.artist = next.artist;
    if (includeCover) patch.cover = next.cover;
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
  if (force || !previous || next.desktopLyrics !== previous.desktopLyrics) {
    patch.desktopLyrics = next.desktopLyrics;
    changed = true;
  }
  // 主题变量整表发：迷你窗口拿到的是最终值，自己不需要知道哪个插件在生效。
  if (force || !previous || next.themeSignature !== previous.themeSignature) {
    patch.themeVars = next.themeVars;
    changed = true;
  }
  if (includeCover && (force || !previous || next.pulse !== previous.pulse)) {
    patch.pulse = next.pulse;
    changed = true;
  }
  if (includeCover && (force || !previous || next.visualSignature !== previous.visualSignature)) {
    patch.visual = next.visual;
    changed = true;
  }
  if (includeCover && (force || !previous || next.expandDirection !== previous.expandDirection)) {
    patch.expandDirection = next.expandDirection;
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

/**
 * 判断当前会话是否允许显示迷你播放器；锁屏或休眠期间必须保持关闭。
 * @returns {boolean} 功能启用、主窗口隐藏且恢复会话未暂停时返回 true。
 */
function shouldShowMiniPlayer() {
  return !!(
    !miniPlayerRecoverySession.paused
    && miniPlayerEnabled
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

function stopMiniPlayerPrewarmTimer() {
  if (!miniPlayerPrewarmTimer) return;
  clearTimeout(miniPlayerPrewarmTimer);
  miniPlayerPrewarmTimer = null;
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

/**
 * 销毁指定迷你窗口，并在其仍是当前所有者时释放主进程状态缓存。
 * @param {Electron.BrowserWindow} win 待销毁的迷你播放器窗口。
 * @returns {void}
 */
function destroyMiniPlayerWindowInstance(win) {
  if (!win) return;
  miniPlayerRendererReloadWindows.delete(win);
  if (miniPlayerWindow === win) {
    miniPlayerWindow = null;
    miniPlayerUserMovePending = false;
    miniPlayerPointerPassthrough = false;
    miniPlayerStateCache.setResident(false);
  }
  miniPlayerLastSentState = null;
  if (win.isDestroyed()) return;
  miniPlayerProgrammaticCloseWindows.add(win);
  win.destroy();
}

/**
 * 安排指定迷你窗口的 renderer 恢复；暂停会话和失去所有权的旧窗口直接忽略。
 * @param {Electron.BrowserWindow} win 触发故障的迷你播放器窗口。
 * @param {string} reason 恢复原因或 renderer 故障标识。
 * @returns {void}
 */
function scheduleMiniPlayerWindowRecovery(win, reason) {
  if (appQuitting || miniPlayerRecoverySession.paused || !win || miniPlayerWindow !== win || miniPlayerProgrammaticCloseWindows.has(win)) return;
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
    if (!contents.isDestroyed() && (rendererGone || contents.isCrashed()) && !miniPlayerRendererReloadWindows.has(win)) {
      try {
        miniPlayerRendererReloadWindows.add(win);
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

/**
 * 在迷你播放器上弹出与任务栏托盘完全一致的原生右键菜单：显示播放器、关闭到托盘、迷你播放器开关与样式、
 * 开机自启、退出，每一项都可点。标准和极简两套外壳共用这一份，菜单弹在鼠标当前位置。
 * @param {Electron.BrowserWindow} win 当前迷你播放器窗口。
 * @returns {void}
 */
function showMiniPlayerContextMenu(win) {
  if (!win || win.isDestroyed() || miniPlayerWindow !== win) return;
  Menu.buildFromTemplate(buildAppContextMenuTemplate()).popup({ window: win });
}

/**
 * 在系统休眠期间暂停迷你播放器恢复，避免后台重载或重建 renderer。
 * @returns {void}
 */
function handleMiniPlayerSystemSuspend() {
  miniPlayerRecoverySession.pause('suspend');
}

/**
 * 系统唤醒后解除休眠原因；若屏幕仍锁定则继续保持暂停。
 * @returns {void}
 */
function handleMiniPlayerSystemResume() {
  miniPlayerRecoverySession.resume('suspend', 180);
}

/**
 * 屏幕锁定时暂停迷你播放器恢复，避免锁屏会话继续占用资源。
 * @returns {void}
 */
function handleMiniPlayerScreenLock() {
  miniPlayerRecoverySession.pause('screen');
}

/**
 * 屏幕解锁后解除锁屏原因；若系统仍处于休眠原因则不提前恢复。
 * @returns {void}
 */
function handleMiniPlayerScreenUnlock() {
  miniPlayerRecoverySession.resume('screen', 180);
}

/**
 * 创建当前迷你播放器窗口，并建立只属于该窗口生命周期的状态缓存驻留。
 * @returns {Electron.BrowserWindow} 当前可复用或新创建的迷你播放器窗口。
 */
function createMiniPlayerWindow() {
  if (miniPlayerWindow && !miniPlayerWindow.isDestroyed()) return miniPlayerWindow;
  miniPlayerWindow = null;
  miniPlayerUserMovePending = false;
  // 新窗口默认参与命中，穿透缓存必须重置，否则新 renderer 的首次上报会被当成重复请求丢掉。
  miniPlayerPointerPassthrough = false;
  miniPlayerStateCache.setResident(false);
  const mode = normalizeMiniPlayerMode(miniPlayerMode);
  const bounds = clampMiniPlayerBounds(miniPlayerUserBoundsByMode[mode] || miniPlayerDefaultBounds(mode), mode);
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
  miniPlayerWindowModes.set(win, mode);
  miniPlayerStateCache.setResident(true);
  requestMiniPlayerStateSync();
  keepMiniPlayerOnTop(win);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('context-menu', (event) => {
    event.preventDefault();
    showMiniPlayerContextMenu(win);
  });
  // Windows 上 `-webkit-app-region: drag` 区域的右键被系统当成非客户区处理，弹出的是几乎全灰的窗口
  // 系统菜单（迷你窗口不可缩放/最小化/最大化，只剩「关闭」能点），renderer 连 contextmenu 都收不到。
  // 拦掉它换成同一份应用菜单，迷你播放器整个窗口任意位置右键才都可点。两套外壳的 .mini-shell 都是拖拽区，
  // 所以标准和极简都靠这一条兜住。
  win.on('system-context-menu', (event) => {
    event.preventDefault();
    showMiniPlayerContextMenu(win);
  });
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
    miniPlayerRendererReloadWindows.delete(win);
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
  /**
   * 在当前窗口意外关闭时释放其状态所有权；旧窗口迟到事件不得清理替代窗口缓存。
   * @returns {void}
   */
  win.on('closed', () => {
    const wasCurrent = miniPlayerWindow === win;
    if (wasCurrent) {
      miniPlayerWindow = null;
      miniPlayerUserMovePending = false;
      miniPlayerPointerPassthrough = false;
      miniPlayerLastSentState = null;
      miniPlayerStateCache.setResident(false);
    }
    if (wasCurrent && !appQuitting && !miniPlayerProgrammaticCloseWindows.has(win) && shouldShowMiniPlayer()) {
      scheduleMiniPlayerRecovery(120);
    }
  });
  const page = mode === 'compact' ? 'mini-player-compact.html' : 'mini-player.html';
  win.loadURL(overlayUrl(page)).catch((e) => {
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
  // 已经进入迷你模式，预热窗口转为正常生命周期，不能再被丢弃计时器回收。
  stopMiniPlayerPrewarmTimer();
  miniPlayerPrewarmWindow = null;
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

/**
 * 在主窗口恢复后释放迷你播放器。隐藏 BrowserWindow 仍会保留独立渲染进程，
 * 下次进入迷你模式时按当前主进程状态重新创建即可，不需要为不可见窗口常驻内存。
 * @returns {void}
 */
function hideMiniPlayerWindow() {
  closeMiniPlayerWindow();
}

function closeMiniPlayerWindow() {
  stopMiniPlayerRecoveryTimer();
  stopMiniPlayerRecreateTimer();
  stopMiniPlayerPrewarmTimer();
  miniPlayerPrewarmWindow = null;
  const win = miniPlayerWindow;
  if (win) destroyMiniPlayerWindowInstance(win);
  miniPlayerLastSentState = null;
}

/**
 * 计算迷你窗口中心相对主窗口内容区的归一化坐标，供主 renderer 作为收缩动画原点。
 * 越界坐标按 -0.6 ~ 1.6 收敛，异常主窗口尺寸直接返回 null 让 renderer 用默认原点。
 * @returns {{x:number,y:number}|null} 归一化收缩原点。
 */
function miniPlayerTransitionOrigin() {
  if (!mainWindow || mainWindow.isDestroyed()) return null;
  const mode = normalizeMiniPlayerMode(miniPlayerMode);
  const target = clampMiniPlayerBounds(miniPlayerUserBoundsByMode[mode] || miniPlayerDefaultBounds(mode), mode);
  const main = mainWindow.getBounds();
  if (!main || !(Number(main.width) > 0) || !(Number(main.height) > 0)) return null;
  const centerX = Number(target.x) + Number(target.width) / 2;
  const centerY = Number(target.y) + Number(target.height) / 2;
  return {
    x: Math.round(clampNumber((centerX - Number(main.x)) / Number(main.width), -0.6, 1.6, 0.5) * 1000) / 1000,
    y: Math.round(clampNumber((centerY - Number(main.y)) / Number(main.height), -0.6, 1.6, 0.5) * 1000) / 1000,
  };
}

/**
 * 丢弃未被使用的预热窗口。主窗口最终没有进入迷你模式时必须释放，
 * 已经进入迷你模式或窗口已经显示时保持原生命周期，不误关正在服务的窗口。
 * @returns {void}
 */
function discardMiniPlayerPrewarm() {
  stopMiniPlayerPrewarmTimer();
  const win = miniPlayerPrewarmWindow;
  miniPlayerPrewarmWindow = null;
  if (!win || win.isDestroyed()) return;
  if (miniPlayerWindow !== win) return;
  if (shouldShowMiniPlayer() || win.isVisible()) return;
  closeMiniPlayerWindow();
}

/**
 * 主窗口开始收缩动画时预热迷你窗口，让最小化落地时首帧已经就绪，消除冷启动空白间隙。
 * 同时回传收缩动画原点，使主界面朝迷你播放器实际所在的角落收拢。
 * @returns {{ok:boolean,prepared:boolean,enabled:boolean,mode:string,origin:({x:number,y:number}|null),error?:string}} 预热结果与动画原点。
 */
function prepareMiniPlayerTransition() {
  const mode = normalizeMiniPlayerMode(miniPlayerMode);
  if (!mainWindow || mainWindow.isDestroyed()) {
    return { ok: false, prepared: false, enabled: !!miniPlayerEnabled, mode, origin: null, error: 'MAIN_WINDOW_UNAVAILABLE' };
  }
  const result = { ok: true, prepared: false, enabled: !!miniPlayerEnabled, mode, origin: miniPlayerTransitionOrigin() };
  if (!miniPlayerEnabled || miniPlayerRecoverySession.paused) return result;
  // 主窗口已经隐藏或最小化时迷你窗口归正常生命周期管理，不能再挂预热丢弃计时器。
  if (mainWindow.isMinimized() || !mainWindow.isVisible()) return result;
  const existing = miniPlayerWindow && !miniPlayerWindow.isDestroyed() ? miniPlayerWindow : null;
  if (existing && existing.isVisible()) return result;
  const win = existing || createMiniPlayerWindow();
  if (!win || win.isDestroyed()) return result;
  miniPlayerPrewarmWindow = win;
  result.prepared = true;
  stopMiniPlayerPrewarmTimer();
  miniPlayerPrewarmTimer = setTimeout(discardMiniPlayerPrewarm, MINI_PLAYER_PREWARM_TTL);
  if (typeof miniPlayerPrewarmTimer.unref === 'function') miniPlayerPrewarmTimer.unref();
  return result;
}

/**
 * 要求主 renderer 重新发送当前完整歌曲状态。
 * 重新启用功能时主进程缓存为空，必须显式补齐而不能等待下一次播放事件。
 * @returns {void}
 */
function requestMiniPlayerStateSync() {
  if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) return;
  mainWindow.webContents.send('mineradio-mini-player-command', { action: 'sync-state' });
}

/**
 * 切换迷你播放器功能并同步持久化、内存状态和窗口生命周期。
 * @param {boolean} enabled 是否启用迷你播放器。
 * @returns {{ok:boolean, miniPlayerEnabled:boolean}} 主进程确认后的开关状态。
 */
function setMiniPlayerEnabled(enabled) {
  miniPlayerEnabled = !!enabled;
  miniPlayerStateCache.setEnabled(miniPlayerEnabled);
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

function setMiniPlayerMode(mode) {
  const nextMode = normalizeMiniPlayerMode(mode);
  const changed = nextMode !== miniPlayerMode;
  miniPlayerMode = nextMode;
  writeDesktopShellSettings({ miniPlayerMode });
  if (changed) {
    closeMiniPlayerWindow();
    if (shouldShowMiniPlayer()) showMiniPlayerWindow();
  }
  refreshTrayMenu();
  return { ok: true, miniPlayerMode };
}

function closeOverlayWindows() {
  miniPlayerActive = false;
  closeDesktopLyricsWindow({ broadcast: false });
  closeWallpaperWindow();
  closeMiniPlayerWindow();
}

ipcMain.handle('desktop-window-minimize', trustedMainFrameHandler((event) => {
  getSenderWindow(event)?.minimize();
}));

ipcMain.handle('desktop-window-toggle-maximize', trustedMainFrameHandler((event) => {
  toggleFullscreen(getSenderWindow(event));
}));

ipcMain.handle('desktop-window-toggle-fullscreen', trustedMainFrameHandler((event) => {
  toggleFullscreen(getSenderWindow(event));
}));

ipcMain.handle('desktop-window-exit-fullscreen-windowed', trustedMainFrameHandler((event) => {
  exitFullscreenToWindow(getSenderWindow(event));
}));

ipcMain.handle('desktop-window-get-state', trustedMainFrameHandler((event) => {
  return getWindowState(getSenderWindow(event));
}));

ipcMain.handle('desktop-window-close', trustedMainFrameHandler((event) => {
  getSenderWindow(event)?.close();
}));

ipcMain.handle('mineradio-tray-get-settings', trustedMainFrameHandler(() => {
  return {
    ok: true,
    closeToTray: closeToTrayEnabled,
    miniPlayer: miniPlayerEnabled,
    miniPlayerEnabled,
    miniPlayerMode,
    startup: isStartupEnabled(),
    startupEnabled: isStartupEnabled(),
  };
}));

ipcMain.handle('mineradio-tray-set-close-to-tray', trustedMainFrameHandler((_event, enabled) => {
  closeToTrayEnabled = !!enabled;
  writeDesktopShellSettings({ closeToTray: closeToTrayEnabled });
  refreshTrayMenu();
  return { ok: true, closeToTray: closeToTrayEnabled };
}));

ipcMain.handle('mineradio-startup-set-enabled', trustedMainFrameHandler((_event, enabled) => {
  const result = setStartupEnabled(!!enabled);
  refreshTrayMenu();
  return result;
}));

ipcMain.handle('mineradio-mini-player-set-enabled', trustedMainFrameHandler((_event, enabled) => {
  return setMiniPlayerEnabled(enabled);
}));

ipcMain.handle('mineradio-mini-player-set-mode', trustedMainFrameHandler((_event, mode) => {
  return setMiniPlayerMode(mode);
}));

ipcMain.handle('mineradio-mini-player-prepare-transition', trustedMainFrameHandler(() => {
  return prepareMiniPlayerTransition();
}));

/**
 * 接收主 renderer 的迷你播放器状态补丁；禁用期间确认但不保留补丁。
 * @param {Electron.IpcMainInvokeEvent} event IPC 调用事件。
 * @param {unknown} payload 增量状态补丁。
 * @returns {{ok:boolean, ignored?:boolean, error?:string}} 补丁处理结果。
 */
function handleMiniPlayerStateUpdate(event, payload) {
  if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) {
    return { ok: false, error: 'MINI_PLAYER_INVALID_SENDER' };
  }
  if (!miniPlayerStateCache.apply(payload)) return { ok: true, ignored: true };
  sendMiniPlayerState();
  return { ok: true };
}

ipcMain.handle('mineradio-mini-player-update', trustedMainFrameHandler(handleMiniPlayerStateUpdate));

/**
 * 按标准迷你播放器封面的拖动偏移移动当前窗口，并同步内存坐标与展开方向。
 * 只有当前迷你播放器 renderer 可以调用，旧窗口或伪造 sender 直接忽略。
 * @param {Electron.IpcMainInvokeEvent} event IPC 调用事件。
 * @param {number} dx 水平位移，单次限制在 160 像素内。
 * @param {number} dy 垂直位移，单次限制在 160 像素内。
 * @param {boolean} commit 是否为拖动结束；只在结束时把内存坐标写入设置文件。
 * @returns {{ok:boolean,ignored?:boolean,error?:string}} 移动结果。
 */
function handleMiniPlayerMoveBy(event, dx, dy, commit) {
  if (!event || !miniPlayerWindow || miniPlayerWindow.isDestroyed() || event.sender !== miniPlayerWindow.webContents) {
    return { ok: true, ignored: true };
  }
  try {
    const mode = miniPlayerModeForWindow(miniPlayerWindow);
    const bounds = miniPlayerWindow.getBounds();
    const next = clampMiniPlayerBounds({
      ...bounds,
      x: Math.round(bounds.x + clampNumber(dx, -160, 160, 0)),
      y: Math.round(bounds.y + clampNumber(dy, -160, 160, 0)),
    }, mode);
    miniPlayerUserMovePending = false;
    if (next.x !== bounds.x || next.y !== bounds.y) miniPlayerWindow.setBounds(next, false);
    miniPlayerUserBoundsByMode[mode] = next;
    if (commit === true) persistMiniPlayerUserBounds(next, mode);
    sendMiniPlayerState();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'MINI_PLAYER_MOVE_FAILED' };
  }
}

ipcMain.handle('mineradio-mini-player-move-by', handleMiniPlayerMoveBy);

/**
 * 按标准迷你播放器收回态让出窗口鼠标事件。收回后窗口仍是固定的 360 × 84 透明窗口，
 * 只有封面热区需要参与命中；其余透明区域必须交还桌面，不能吞掉点击或被误拖动。
 * 只有当前迷你播放器 renderer 可以调用，旧窗口或伪造 sender 直接忽略。
 * @param {Electron.IpcMainInvokeEvent} event IPC 调用事件。
 * @param {boolean} passthrough 是否让出窗口鼠标事件。
 * @returns {{ok:boolean,ignored?:boolean,error?:string}} 穿透设置结果。
 */
function handleMiniPlayerPointerPassthrough(event, passthrough) {
  if (!event || !miniPlayerWindow || miniPlayerWindow.isDestroyed() || event.sender !== miniPlayerWindow.webContents) {
    return { ok: true, ignored: true };
  }
  const next = passthrough === true;
  if (miniPlayerPointerPassthrough === next) return { ok: true, ignored: true };
  try {
    // forward 保留鼠标移动转发，穿透期间 renderer 仍能靠转发坐标发现指针回到封面热区。
    if (next) miniPlayerWindow.setIgnoreMouseEvents(true, { forward: true });
    else miniPlayerWindow.setIgnoreMouseEvents(false);
    miniPlayerPointerPassthrough = next;
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'MINI_PLAYER_PASSTHROUGH_FAILED' };
  }
}

ipcMain.handle('mineradio-mini-player-set-pointer-passthrough', handleMiniPlayerPointerPassthrough);

ipcMain.handle('mineradio-mini-player-command', (event, action) => {
  if (!miniPlayerWindow || miniPlayerWindow.isDestroyed() || event.sender !== miniPlayerWindow.webContents) {
    return { ok: false, error: 'MINI_PLAYER_INVALID_SENDER' };
  }
  const command = String(action || '');
  if (command === 'restore') return { ok: focusMainWindow() };
  if (!['toggle-play', 'previous', 'next', 'toggle-desktop-lyrics'].includes(command)) return { ok: false, error: 'MINI_PLAYER_INVALID_COMMAND' };
  if (!mainWindow || mainWindow.isDestroyed()) return { ok: false, error: 'MAIN_WINDOW_UNAVAILABLE' };
  mainWindow.webContents.send('mineradio-mini-player-command', { action: command });
  return { ok: true };
});

ipcMain.handle('mineradio-hotkeys-configure-global', trustedMainFrameHandler((_event, bindings) => {
  return configureMineradioGlobalHotkeys(bindings);
}));

ipcMain.handle('mineradio-export-json-file', trustedMainFrameHandler(async (event, payload = {}) => {
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
}));

/**
 * 导入 Mineradio 存档 JSON 文本。与本地文件/图片/请求体等读取路径一致，先校验大小上限，
 * 避免用户误选超大文件时 readFileSync 一次性读入内存拖垮主进程。
 * @param {Electron.IpcMainInvokeEvent} event IPC 调用事件，用于定位对话框宿主窗口。
 * @returns {Promise<{ok:boolean, filePath?:string, text?:string, canceled?:boolean, error?:string}>} 导入结果。
 */
ipcMain.handle('mineradio-import-json-file', trustedMainFrameHandler(async (event) => {
  try {
    const owner = getSenderWindow(event);
    const result = await dialog.showOpenDialog(owner, {
      title: '导入 Mineradio 存档',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePaths || !result.filePaths[0]) return { ok: false, canceled: true };
    const filePath = result.filePaths[0];
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return { ok: false, error: 'IMPORT_NOT_A_FILE' };
    if (stat.size > 16 * 1024 * 1024) return { ok: false, error: 'IMPORT_FILE_TOO_LARGE' };
    const text = fs.readFileSync(filePath, 'utf8');
    return { ok: true, filePath, text };
  } catch (e) {
    return { ok: false, error: e.message || 'IMPORT_FAILED' };
  }
}));

/**
 * 导入插件包文件（`.js` 头注释清单包或 `.json` 声明式主题包）。
 * 和存档导入一样先卡大小，避免误选超大文件时 readFileSync 拖垮主进程；
 * 真正的清单校验在渲染进程的 plugin-manifest 里做，这里只负责把文本取回来。
 * @param {Electron.IpcMainInvokeEvent} event IPC 调用事件，用于定位对话框宿主窗口。
 * @returns {Promise<{ok:boolean, fileName?:string, text?:string, canceled?:boolean, error?:string}>} 导入结果。
 */
ipcMain.handle('mineradio-import-plugin-file', trustedMainFrameHandler(async (event) => {
  try {
    const owner = getSenderWindow(event);
    const result = await dialog.showOpenDialog(owner, {
      title: '导入 Mineradio 插件',
      properties: ['openFile'],
      filters: [
        { name: 'Mineradio 插件', extensions: ['js', 'json'] },
        { name: '所有文件', extensions: ['*'] },
      ],
    });
    if (result.canceled || !result.filePaths || !result.filePaths[0]) return { ok: false, canceled: true };
    const filePath = result.filePaths[0];
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return { ok: false, error: 'IMPORT_NOT_A_FILE' };
    if (stat.size > 2 * 1024 * 1024) return { ok: false, error: 'PLUGIN_TOO_LARGE' };
    const text = fs.readFileSync(filePath, 'utf8');
    return { ok: true, fileName: path.basename(filePath), text };
  } catch (e) {
    return { ok: false, error: e.message || 'IMPORT_FAILED' };
  }
}));

ipcMain.on('mineradio-ui-state-read-sync', (event) => {
  if (!isTrustedMainFrameSender(event)) {
    event.returnValue = {};
    return;
  }
  event.returnValue = readDesktopUiState().values || {};
});

ipcMain.handle('mineradio-ui-state-write', trustedMainFrameHandler(async (_event, patch) => {
  try {
    const state = writeDesktopUiStatePatch(patch || {});
    return { ok: true, updatedAt: state.updatedAt };
  } catch (e) {
    return { ok: false, error: e.message || 'UI_STATE_WRITE_FAILED' };
  }
}));

ipcMain.handle('mineradio-local-music-choose-folder', trustedMainFrameHandler(async (event) => {
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
}));

ipcMain.handle('mineradio-local-music-scan-folder', trustedMainFrameHandler(async (_event, folderPath, options) => {
  try {
    if (!folderPath) return { ok: false, error: 'LOCAL_LIBRARY_PATH_EMPTY' };
    return await scanLocalMusicFolder(folderPath, options || {});
  } catch (e) {
    return { ok: false, error: e.message || 'LOCAL_LIBRARY_SCAN_FAILED' };
  }
}));

ipcMain.handle('mineradio-local-music-refresh-entries', trustedMainFrameHandler(async (_event, folderPath, files) => {
  try {
    if (!folderPath) return { ok: false, error: 'LOCAL_LIBRARY_PATH_EMPTY' };
    return await refreshLocalMusicFileEntries(folderPath, files);
  } catch (e) {
    return { ok: false, error: e.message || 'LOCAL_LIBRARY_REFRESH_FAILED' };
  }
}));

ipcMain.handle('mineradio-local-file-read-range', trustedMainFrameHandler(async (_event, filePath, start, end) => {
  try {
    return await readAuthorizedLocalFileRange(filePath, start, end);
  } catch (e) {
    return { ok: false, error: e.message || 'LOCAL_FILE_READ_FAILED' };
  }
}));

ipcMain.handle('mineradio-local-file-read-data-url', trustedMainFrameHandler(async (_event, filePath) => {
  try {
    return await readAuthorizedLocalFileDataUrl(filePath);
  } catch (e) {
    return { ok: false, error: e.message || 'LOCAL_FILE_READ_FAILED' };
  }
}));

ipcMain.handle('mineradio-open-update-installer', trustedMainFrameHandler(async (_event, filePath) => {
  try {
    const target = path.resolve(String(filePath || ''));
    const updateDir = path.resolve(getUpdateDownloadDir());
    if (!target || !target.startsWith(updateDir + path.sep)) {
      return { ok: false, error: 'INVALID_UPDATE_PATH' };
    }
    if (!fs.existsSync(target)) return { ok: false, error: 'UPDATE_FILE_MISSING' };
    await launchUpdateInstaller(target);
    appQuitting = true;
    app.quit();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'OPEN_UPDATE_FAILED' };
  }
}));

ipcMain.handle('mineradio-restart-app', trustedMainFrameHandler(async () => {
  try {
    closeOverlayWindows();
    app.relaunch();
    app.exit(0);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'RESTART_FAILED' };
  }
}));

/**
 * 判断 IPC 是否来自当前可信主 frame，阻止覆盖层与外部导航页面伪造状态更新。
 * @param {Electron.IpcMainInvokeEvent} event IPC 调用事件。
 * @returns {boolean} sender 属于当前可信主 frame 时返回 true。
 */
function isCurrentMainWindowSender(event) {
  return isTrustedMainFrameSender(event);
}

/**
 * 可信主文档 URL：仅放行当前 127.0.0.1 本地服务的 / 或 /index.html。
 * 主窗口导航与高权限 IPC 共用这一信任边界，外部页面、错误端口与其它路径一律拒绝。
 * @param {string} value 待校验的 URL。
 * @returns {boolean} 属于可信主文档时返回 true。
 */
function isTrustedMainDocumentUrl(value) {
  try {
    const parsed = new URL(String(value || ''));
    if (parsed.protocol !== 'http:') return false;
    if (parsed.hostname !== '127.0.0.1') return false;
    const expectedPort = Number(mainServerPort || 3000);
    if (!expectedPort || Number(parsed.port || 0) !== expectedPort) return false;
    const pathname = String(parsed.pathname || '/').replace(/\/+$/, '') || '/';
    return pathname === '/' || pathname === '/index.html';
  } catch (_e) {
    return false;
  }
}

/**
 * 统一可信主 frame IPC 校验：sender 必须是当前主窗口 webContents 的主 frame，
 * 且当前文档只能是可信主文档（127.0.0.1 本地服务的 / 或 /index.html）。
 * 所有高权限 IPC handler 必须先过这一道门，防止主窗口被导航到外部页面后继续调用特权 API。
 * @param {Electron.IpcMainInvokeEvent} event IPC 调用事件。
 * @returns {boolean} 来自可信主 frame 时返回 true。
 */
function isTrustedMainFrameSender(event) {
  try {
    if (!event || !event.sender || !mainWindow || mainWindow.isDestroyed()) return false;
    if (event.sender !== mainWindow.webContents) return false;
    if (typeof event.sender.isDestroyed === 'function' && event.sender.isDestroyed()) return false;
    const frame = event.senderFrame || null;
    if (frame) {
      if (frame.parent) return false;
      if (typeof frame.url === 'string' && !isTrustedMainDocumentUrl(frame.url)) return false;
      return true;
    }
    const url = typeof event.sender.getURL === 'function' ? event.sender.getURL() : '';
    return isTrustedMainDocumentUrl(url);
  } catch (_e) {
    return false;
  }
}

/**
 * 高权限 IPC 包装器：先过可信主 frame 门，未过直接拒绝。
 * @param {Function} handler 业务处理函数。
 * @returns {Function} 带可信主 frame 校验的 IPC handler。
 */
function trustedMainFrameHandler(handler) {
  return (event, ...args) => {
    if (!isTrustedMainFrameSender(event)) return { ok: false, error: 'IPC_FORBIDDEN' };
    return handler(event, ...args);
  };
}

/**
 * 安装主窗口导航守卫：主 frame 只允许停留在当前 127.0.0.1 服务的 / 或 /index.html，
 * 其余主 frame 导航与一切子 frame 导航一律拦截，配合可信主 frame IPC 校验形成完整信任边界。
 * @param {Electron.BrowserWindow} win 主窗口。
 * @returns {void}
 */
function installMainWindowNavigationGuard(win) {
  if (!win || !win.webContents || typeof win.webContents.on !== 'function') return;
  win.webContents.on('will-navigate', (event, details, _url, _isInPlace, isMainFrame) => {
    const url = details && typeof details === 'object' ? details.url : String(details || '');
    const fromMainFrame = details && typeof details === 'object' && 'isMainFrame' in details
      ? details.isMainFrame
      : isMainFrame !== false;
    if (fromMainFrame && isTrustedMainDocumentUrl(url)) return;
    event.preventDefault();
  });
  win.webContents.on('will-frame-navigate', (event, details) => {
    const url = details && typeof details === 'object' ? details.url : String(details || '');
    const frame = details && typeof details === 'object' ? (details.frame || null) : null;
    if (frame && typeof frame.parent !== 'undefined' && frame.parent) {
      event.preventDefault();
      return;
    }
    if (details && typeof details === 'object' && details.isMainFrame === true && isTrustedMainDocumentUrl(url)) return;
    event.preventDefault();
  });
}


/**
 * 判断 IPC 是否来自当前桌面歌词 renderer，旧窗口迟到命令必须被拒绝。
 * @param {Electron.IpcMainInvokeEvent} event IPC 调用事件。
 * @returns {boolean} sender 属于当前桌面歌词窗口时返回 true。
 */
function isCurrentDesktopLyricsWindowSender(event) {
  return !!(event && desktopLyricsWindow && !desktopLyricsWindow.isDestroyed() && event.sender === desktopLyricsWindow.webContents);
}

/**
 * 切换桌面歌词功能；启用仅允许主 renderer，关闭同时允许当前歌词窗口。
 * @param {Electron.IpcMainInvokeEvent} event IPC 调用事件。
 * @param {boolean} enabled 是否启用桌面歌词。
 * @param {unknown} payload 启用时的完整歌词状态。
 * @returns {Promise<{ok:boolean,ignored?:boolean,error?:string}>} 开关处理结果。
 */
async function handleDesktopLyricsEnabledState(event, enabled, payload) {
  try {
    const fromMainWindow = isCurrentMainWindowSender(event);
    const fromLyricsWindow = isCurrentDesktopLyricsWindowSender(event);
    if ((enabled && !fromMainWindow) || (!enabled && !fromMainWindow && !fromLyricsWindow)) {
      return { ok: true, ignored: true };
    }
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
}

ipcMain.handle('mineradio-desktop-lyrics-set-enabled', handleDesktopLyricsEnabledState);

/**
 * 接收桌面歌词状态；窗口关闭后确认但拒绝重载荷补丁。
 * @param {Electron.IpcMainInvokeEvent} event IPC 调用事件。
 * @param {unknown} payload 桌面歌词状态补丁。
 * @returns {Promise<{ok:boolean,ignored?:boolean,error?:string}>} 主进程处理结果。
 */
async function handleDesktopLyricsStateUpdate(event, payload) {
  try {
    if (!isCurrentMainWindowSender(event)) return { ok: true, ignored: true };
    if (payload && payload.enabled === false) {
      desktopLyricsStateCache.setEnabled(false);
      sendDesktopLyricsState();
      return { ok: true, ignored: true };
    }
    if (!desktopLyricsStateCache.enabled) return { ok: true, ignored: true };
    createDesktopLyricsWindow(payload || {});
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'DESKTOP_LYRICS_UPDATE_FAILED' };
  }
}

ipcMain.handle('mineradio-desktop-lyrics-update', handleDesktopLyricsStateUpdate);

/**
 * 确认当前歌词窗口的拖动状态通知；实际移动由相对位移通道完成。
 * @param {Electron.IpcMainInvokeEvent} event IPC 调用事件。
 * @returns {Promise<{ok:boolean,ignored?:boolean}>} sender 校验结果。
 */
async function handleDesktopLyricsDragging(event) {
  if (!isCurrentDesktopLyricsWindowSender(event)) return { ok: true, ignored: true };
  return { ok: true };
}

ipcMain.handle('mineradio-desktop-lyrics-set-dragging', handleDesktopLyricsDragging);

/**
 * 更新当前歌词窗口的指针捕获状态。
 * @param {Electron.IpcMainInvokeEvent} event IPC 调用事件。
 * @param {boolean} active 是否正在捕获指针。
 * @returns {Promise<{ok:boolean,ignored?:boolean,error?:string}>} 更新结果。
 */
async function handleDesktopLyricsPointerCapture(event, active) {
  try {
    if (!isCurrentDesktopLyricsWindowSender(event)) return { ok: true, ignored: true };
    desktopLyricsPointerCapture = mainWindowMoveActive ? false : !!active;
    applyDesktopLyricsMouseBehavior();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'DESKTOP_LYRICS_POINTER_FAILED' };
  }
}

ipcMain.handle('mineradio-desktop-lyrics-set-pointer-capture', handleDesktopLyricsPointerCapture);

/**
 * 更新当前歌词窗口可响应中键的热区边界。
 * @param {Electron.IpcMainInvokeEvent} event IPC 调用事件。
 * @param {object} bounds renderer 提供的相对边界。
 * @returns {Promise<{ok:boolean,ignored?:boolean,error?:string}>} 更新结果。
 */
async function handleDesktopLyricsHotBounds(event, bounds) {
  try {
    if (!isCurrentDesktopLyricsWindowSender(event)) return { ok: true, ignored: true };
    const left = clampNumber(bounds && bounds.left, -2000, 4000, 0);
    const top = clampNumber(bounds && bounds.top, -2000, 4000, 0);
    const right = clampNumber(bounds && bounds.right, left + 1, 6000, left + 1);
    const bottom = clampNumber(bounds && bounds.bottom, top + 1, 6000, top + 1);
    desktopLyricsHotBounds = { left, top, right, bottom };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'DESKTOP_LYRICS_HOT_BOUNDS_FAILED' };
  }
}

ipcMain.handle('mineradio-desktop-lyrics-set-hot-bounds', handleDesktopLyricsHotBounds);

/**
 * 更新桌面歌词锁定态并同步鼠标穿透行为。
 * @param {Electron.IpcMainInvokeEvent} event IPC 调用事件。
 * @param {boolean} locked 是否锁定并穿透鼠标。
 * @returns {Promise<{ok:boolean,locked?:boolean,ignored?:boolean,error?:string}>} 锁定结果。
 */
async function handleDesktopLyricsLockState(event, locked) {
  try {
    if (!isCurrentDesktopLyricsWindowSender(event)) return { ok: true, ignored: true };
    desktopLyricsStateCache.apply({ clickThrough: !!locked });
    if (desktopLyricsStateCache.value.clickThrough !== false) desktopLyricsPointerCapture = false;
    applyDesktopLyricsMouseBehavior();
    broadcastDesktopLyricsLockState();
    return { ok: true, locked: desktopLyricsStateCache.value.clickThrough !== false };
  } catch (e) {
    return { ok: false, error: e.message || 'DESKTOP_LYRICS_LOCK_FAILED' };
  }
}

ipcMain.handle('mineradio-desktop-lyrics-set-lock-state', handleDesktopLyricsLockState);

async function handleDesktopLyricsStableState(event, stable) {
  try {
    if (!isCurrentDesktopLyricsWindowSender(event)) return { ok: true, ignored: true };
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) {
      return { ok: false, error: 'MAIN_RENDERER_UNAVAILABLE' };
    }
    mainWindow.webContents.send('mineradio-desktop-lyrics-stable-request', { stable: !!stable });
    return { ok: true, stable: !!stable };
  } catch (e) {
    return { ok: false, error: e.message || 'DESKTOP_LYRICS_STABLE_FAILED' };
  }
}

ipcMain.handle('mineradio-desktop-lyrics-set-stable-state', handleDesktopLyricsStableState);

/**
 * 将桌面歌词工具栏的播放命令转发给主 renderer，避免覆盖层维护第二套播放逻辑。
 * @param {Electron.IpcMainInvokeEvent} event IPC 调用事件。
 * @param {string} action 播放命令。
 * @returns {Promise<{ok:boolean,ignored?:boolean,error?:string}>} 转发结果。
 */
async function handleDesktopLyricsPlaybackCommand(event, action) {
  try {
    if (!isCurrentDesktopLyricsWindowSender(event)) return { ok: true, ignored: true };
    const command = String(action || '');
    if (!['toggle-play', 'previous', 'next'].includes(command)) {
      return { ok: false, error: 'DESKTOP_LYRICS_INVALID_PLAYBACK_COMMAND' };
    }
    if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents
      || (typeof mainWindow.webContents.isDestroyed === 'function' && mainWindow.webContents.isDestroyed())) {
      return { ok: false, error: 'MAIN_WINDOW_UNAVAILABLE' };
    }
    mainWindow.webContents.send('mineradio-mini-player-command', { action: command });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'DESKTOP_LYRICS_PLAYBACK_FAILED' };
  }
}

ipcMain.handle('mineradio-desktop-lyrics-playback-command', handleDesktopLyricsPlaybackCommand);

async function handleDesktopLyricsGlowStrengthRequest(event, strength) {
  try {
    if (!isCurrentDesktopLyricsWindowSender(event)) return { ok: true, ignored: true };
    if (!desktopLyricsStateCache.enabled) return { ok: false, error: 'DESKTOP_LYRICS_DISABLED' };
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) {
      return { ok: false, error: 'MAIN_RENDERER_UNAVAILABLE' };
    }
    const nextStrength = clampNumber(strength, DESKTOP_LYRICS_GLOW_MIN, DESKTOP_LYRICS_GLOW_MAX, 0.35);
    mainWindow.webContents.send('mineradio-desktop-lyrics-glow-strength-request', { strength: nextStrength });
    return { ok: true, strength: nextStrength };
  } catch (e) {
    return { ok: false, error: e.message || 'DESKTOP_LYRICS_GLOW_STRENGTH_FAILED' };
  }
}

ipcMain.handle('mineradio-desktop-lyrics-set-glow-strength', handleDesktopLyricsGlowStrengthRequest);

/**
 * 请求主 renderer 持久化桌面歌词字号；覆盖层只负责交互，不成为第二套设置真源。
 * @param {Electron.IpcMainInvokeEvent} event IPC 调用事件。
 * @param {number} size 目标字号倍率。
 * @returns {Promise<{ok:boolean,size?:number,ignored?:boolean,error?:string}>} 请求结果。
 */
async function handleDesktopLyricsSizeRequest(event, size) {
  try {
    if (!isCurrentDesktopLyricsWindowSender(event)) return { ok: true, ignored: true };
    if (!desktopLyricsStateCache.enabled) return { ok: false, error: 'DESKTOP_LYRICS_DISABLED' };
    if (desktopLyricsStateCache.value.clickThrough !== false) return { ok: false, error: 'DESKTOP_LYRICS_LOCKED' };
    const currentSize = clampNumber(desktopLyricsStateCache.value.size, DESKTOP_LYRICS_SIZE_MIN, DESKTOP_LYRICS_SIZE_MAX, 1);
    const nextSize = clampNumber(size, DESKTOP_LYRICS_SIZE_MIN, DESKTOP_LYRICS_SIZE_MAX, currentSize);
    if (!sendDesktopLyricsSizeRequest(nextSize)) return { ok: false, error: 'NO_MAIN_RENDERER' };
    desktopLyricsStateCache.apply({ size: nextSize });
    sendDesktopLyricsSizeState(nextSize);
    return { ok: true, size: nextSize };
  } catch (e) {
    return { ok: false, error: e.message || 'DESKTOP_LYRICS_SIZE_FAILED' };
  }
}

ipcMain.handle('mineradio-desktop-lyrics-set-size', handleDesktopLyricsSizeRequest);

/**
 * 在解锁状态下按相对像素移动桌面歌词窗口。
 * @param {Electron.IpcMainInvokeEvent} event IPC 调用事件。
 * @param {number} dx 水平位移。
 * @param {number} dy 垂直位移。
 * @returns {Promise<{ok:boolean,ignored?:boolean,error?:string}>} 移动结果。
 */
async function handleDesktopLyricsMoveBy(event, dx, dy) {
  try {
    if (!isCurrentDesktopLyricsWindowSender(event)) return { ok: true, ignored: true };
    if (!desktopLyricsWindow || desktopLyricsWindow.isDestroyed()) return { ok: false, error: 'NO_DESKTOP_LYRICS_WINDOW' };
    if (desktopLyricsStateCache.value.clickThrough !== false) return { ok: false, error: 'DESKTOP_LYRICS_LOCKED' };
    const bounds = desktopLyricsWindow.getBounds();
    const next = {
      ...bounds,
      x: Math.round(bounds.x + clampNumber(dx, -160, 160, 0)),
      y: Math.round(bounds.y + clampNumber(dy, -160, 160, 0)),
    };
    desktopLyricsWindow.setBounds(next, false);
    sendDesktopLyricsWindowGeometry(true);
    rememberDesktopLyricsBounds({ force: true });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'DESKTOP_LYRICS_MOVE_FAILED' };
  }
}

ipcMain.handle('mineradio-desktop-lyrics-move-by', handleDesktopLyricsMoveBy);

ipcMain.handle('mineradio-wallpaper-set-enabled', trustedMainFrameHandler(async (_event, enabled, payload) => {
  try {
    if (enabled) createWallpaperWindow(payload || {});
    else closeWallpaperWindow();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'WALLPAPER_FAILED' };
  }
}));

/**
 * 接收壁纸状态；窗口关闭后确认但拒绝封面等重载荷补丁。
 * @param {Electron.IpcMainInvokeEvent} _event IPC 调用事件。
 * @param {unknown} payload 壁纸状态补丁。
 * @returns {Promise<{ok:boolean,ignored?:boolean,error?:string}>} 主进程处理结果。
 */
async function handleWallpaperStateUpdate(_event, payload) {
  try {
    if (payload && payload.enabled === false) {
      wallpaperStateCache.setEnabled(false);
      sendWallpaperState();
      return { ok: true, ignored: true };
    }
    if (!wallpaperStateCache.enabled) return { ok: true, ignored: true };
    createWallpaperWindow(payload || {});
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'WALLPAPER_UPDATE_FAILED' };
  }
}

ipcMain.handle('mineradio-wallpaper-update', trustedMainFrameHandler(handleWallpaperStateUpdate));

async function createWindow() {
  htmlFullscreenActive = false;
  windowFullscreenActive = false;
  const preferredPort = resolvePreferredServerPort({
    instanceId: INSTANCE_ID,
    port: process.env.MINERADIO_PORT,
  });
  const port = await findOpenPort(preferredPort);
  mainServerPort = port;

  process.env.HOST = '127.0.0.1';
  process.env.PORT = String(port);
  process.env.MINERADIO_UPDATE_DIR = getUpdateDownloadDir();
  process.env.MINERADIO_LOCAL_FILE_TOKEN = LOCAL_FILE_TOKEN;

  // 本地服务加载失败时必须显式报出来。这里 throw 会被 createWindow 的调用方吞成
  // 未处理的 Promise rejection：进程还活着，但窗口和本地服务都没有，用户看到的就是
  // 「双击了没反应」。v1.7.0 就是这么炸的：新增的 server.js 同级模块没进打包白名单。
  try {
    localServer = require(path.join(APP_ROOT, 'server.js'));
  } catch (e) {
    const detail = (e && e.stack) || String(e);
    console.error('[Mineradio] 本地服务加载失败:', detail);
    try { dialog.showErrorBox('Mineradio 启动失败', '本地服务加载失败，安装包可能不完整。\n\n' + detail); } catch (_) {}
    app.quit();
    return;
  }
  // 注入授权校验：让 HTTP 本地文件代理复用与 IPC 相同的授权根目录约束，堵住越权读取任意文件。
  localServer.setLocalFileAuthorizer(resolveAuthorizedLocalFile);
  await waitForServer(localServer);
  try {
    await migratePrimaryProfileState(port);
  } catch (e) {
    console.warn('Profile state migration unavailable:', e.message);
  }

  const initialDisplay = screen.getPrimaryDisplay();
  const initialMinimum = windowedMinimumSize(initialDisplay);
  const initialBounds = getWindowedBounds();

  mainWindow = new BrowserWindow({
    ...initialBounds,
    minWidth: initialMinimum.width,
    minHeight: initialMinimum.height,
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
  mainWindowLifecycleStarted = true;

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openAllowedExternalUrl(url);
    return { action: 'deny' };
  });

  installMainWindowNavigationGuard(mainWindow);
  installMainWindowNativeMoveGuard(mainWindow);

  mainWindow.webContents.once('did-finish-load', () => {
    sendWindowState(mainWindow);
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (shouldExitWindowFullscreenFromInput(input, mainWindow)) {
      event.preventDefault();
      exitFullscreenToWindow(mainWindow);
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    sendWindowState(mainWindow);
  });

  mainWindow.on('maximize', () => {
    scheduleMainWindowMoveRelease();
    sendWindowState(mainWindow);
  });
  mainWindow.on('unmaximize', () => sendWindowState(mainWindow));
  mainWindow.on('minimize', () => {
    resetMainWindowMoveState();
    miniPlayerActive = !!miniPlayerEnabled;
    sendWindowState(mainWindow);
    if (miniPlayerActive) showMiniPlayerWindow();
    else hideMiniPlayerWindow();
  });
  mainWindow.on('restore', () => {
    resetMainWindowMoveState();
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
    resetMainWindowMoveState();
    if (miniPlayerActive && miniPlayerEnabled) showMiniPlayerWindow();
    else hideMiniPlayerWindow();
    sendWindowState(mainWindow);
  });
  mainWindow.on('focus', () => sendWindowState(mainWindow));
  mainWindow.on('blur', () => sendWindowState(mainWindow));
  mainWindow.on('will-move', () => {
    beginMainWindowUserMove();
  });
  mainWindow.on('move', () => {
    beginMainWindowUserMove();
    scheduleWindowStateSend(mainWindow);
  });
  mainWindow.on('moved', () => {
    scheduleMainWindowMoveRelease();
    scheduleWindowStateSend(mainWindow);
  });
  mainWindow.on('resize', () => scheduleWindowStateSend(mainWindow));
  mainWindow.on('close', (event) => {
    resetMainWindowMoveState();
    const canKeepRunning = !appQuitting && closeToTrayEnabled && !!tray;
    if (canKeepRunning) {
      event.preventDefault();
      miniPlayerActive = !!miniPlayerEnabled;
      mainWindow.hide();
      if (miniPlayerActive) showMiniPlayerWindow();
      sendWindowState(mainWindow);
      return;
    }
    miniPlayerActive = false;
    hideMiniPlayerWindow();
  });
  mainWindow.on('closed', () => {
    resetMainWindowMoveState();
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

  wallpaperEngineBridge.attachWindow(mainWindow);
  await mainWindow.loadURL(`http://127.0.0.1:${port}`);
}

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
    cleanupProfileSessionStaging(PROFILE_STATE_MIGRATION_STAGING_ROOT);
    migratePrimaryDesktopShellSettings();
    applySavedDesktopShellSettings();
    wallpaperEngineBridge.configureSessionPermissions();
    await wallpaperEngineBridge.installProtocol(protocol);
    screen.on('display-metrics-changed', () => {
      keepMainWindowInsideDisplay(mainWindow);
      positionDesktopLyricsWindow();
      sendDesktopLyricsWindowGeometry(true);
      positionWallpaperWindow();
      positionMiniPlayerWindow();
      scheduleMiniPlayerRecovery(80);
      scheduleWindowStateSend(mainWindow);
    });
    screen.on('display-added', () => {
      keepMainWindowInsideDisplay(mainWindow);
      sendDesktopLyricsWindowGeometry(true);
      positionMiniPlayerWindow();
      scheduleMiniPlayerRecovery(80);
      scheduleWindowStateSend(mainWindow);
    });
    screen.on('display-removed', () => {
      keepMainWindowInsideDisplay(mainWindow);
      sendDesktopLyricsWindowGeometry(true);
      positionMiniPlayerWindow();
      scheduleMiniPlayerRecovery(80);
      scheduleWindowStateSend(mainWindow);
    });
    powerMonitor.on('suspend', handleMiniPlayerSystemSuspend);
    powerMonitor.on('lock-screen', handleMiniPlayerScreenLock);
    powerMonitor.on('resume', handleMiniPlayerSystemResume);
    powerMonitor.on('unlock-screen', handleMiniPlayerScreenUnlock);
    createTray();
    await createWindow();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else focusMainWindow();
  });

  app.on('window-all-closed', () => {
    if (!mainWindowLifecycleStarted) return;
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('before-quit', () => {
    appQuitting = true;
    unregisterMineradioGlobalHotkeys();
    closeOverlayWindows();
    wallpaperEngineBridge.dispose();
    if (localServer && localServer.close) localServer.close();
  });
}
