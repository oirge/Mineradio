'use strict';
// 整机备份（mineradio.backup）导出 / 导入守卫。
// 这个功能的全部价值在「换机能用」：备份里一旦存了绝对路径，新电脑上歌单、收藏和播放次数
// 会全体扑空——文件明明在，只是盘符换了。所以这里钉死三件事：
//   1. 备份体积可控：音频、封面缓存、临时文件一个都不许混进去；
//   2. 歌曲身份存的是 `{folder, rel}`，导入时按新根重算 localKey / pathKey / 引用键；
//   3. 导入是覆盖操作，必须两步确认，且四层链路（app → preload → main → store）一路对齐。

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
const htmlSource = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const preloadSource = fs.readFileSync(path.join(root, 'desktop', 'preload.js'), 'utf8');
const mainSource = fs.readFileSync(path.join(root, 'desktop', 'main.js'), 'utf8');

/**
 * 取出源码切片；标记漂了直接失败，避免测试悄悄跑在空字符串上。
 * @param {string} source 源码。
 * @param {string} startMarker 起点标记。
 * @param {string} endMarker 终点标记。
 * @param {string} label 失败信息用的名字。
 * @returns {string} 切片源码。
 */
function slice(source, startMarker, endMarker, label) {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, label + ' 切片起点缺失: ' + startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(end > start, label + ' 切片终点缺失: ' + endMarker);
  return source.slice(start, end);
}

/**
 * 把 vm 里创建的对象拷回本 realm，供 deepEqual 比较。
 * @param {*} value 待转换值。
 * @returns {*} 结构相同的本 realm 值。
 */
function plain(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

const BACKUP_SOURCE = slice(
  appSource,
  'var MINERADIO_BACKUP_VERSION = 2;',
  'function openPluginManager() {',
  '整机备份',
);

const LIBRARY_ROOT = 'D:\\Music';
const PLAYER_KEYS = {
  VOLUME_STORE_KEY: 'apex-player-volume',
  PLAYBACK_QUALITY_STORE_KEY: 'mineradio-playback-quality-v1',
  DIY_MODE_STORE_KEY: 'mineradio-diy-player-mode-v1',
  PLAYLIST_PANEL_PIN_STORE_KEY: 'mineradio-playlist-panel-pinned-v1',
  USER_CAPSULE_AUTO_HIDE_STORE_KEY: 'mineradio-user-capsule-auto-hide-v1',
  FX_FAB_AUTO_HIDE_STORE_KEY: 'mineradio-fx-fab-auto-hide-v1',
  CONTROLS_AUTO_HIDE_STORE_KEY: 'mineradio-controls-auto-hide-v1',
  FREE_CAMERA_STORE_KEY: 'mineradio-free-camera-v1',
  AUTO_PLAYBACK_STORE_KEY: 'mineradio-auto-playback-v1',
  REPLAY_GAIN_STORE_KEY: 'mineradio-replay-gain-v1',
  GAPLESS_STORE_KEY: 'mineradio-gapless-v1',
  HOTKEY_SETTINGS_STORE_KEY: 'mineradio-hotkey-settings-v1',
  UPDATE_ROUTE_STORE_KEY: 'mineradio-update-route-v1',
  VISUAL_GUIDE_SEEN_STORE_KEY: 'mineradio-visual-guide-seen-v2',
  UPLOAD_TIP_STORE_KEY: 'mineradio-upload-tip-seen',
  LOCAL_PLAYBACK_SOURCE_STORE_KEY: 'mineradio-local-playback-source-v1',
};

/**
 * 造一首假的本地歌曲，字段与曲库扫描后的形态对齐。
 * @param {string} abs 绝对路径。
 * @param {object} extra 覆盖字段。
 * @returns {object} 歌曲对象。
 */
function makeSong(abs, extra) {
  const size = (extra && extra.size) || 1000;
  const mtime = (extra && extra.mtime) || 111;
  return Object.assign({
    type: 'local',
    localFilePathAbsolute: abs,
    localPath: abs,
    localKey: abs + ':' + size + ':' + mtime,
    localFileSize: size,
    localFileLastModified: mtime,
    name: 'A',
    artist: '甲',
    album: '专辑',
    duration: 200,
    localFormat: 'mp3',
    localBitrateKbps: 320,
  }, extra || {});
}

/**
 * 在 vm 里跑起整机备份模块。
 * @param {object=} options 桩配置。
 * @returns {object} 上下文与各类调用记录。
 */
function loadBackupModule(options) {
  const opts = options || {};
  const toasts = [];
  const calls = [];
  const timers = [];
  const exported = [];
  const dbCalls = [];
  const store = Object.assign({}, opts.localStorage || {});
  const userState = Object.assign({}, opts.userState || {});
  const addedAt = Object.assign({}, opts.addedAt || {});
  const written = { playlists: null, favorites: null, folder: '', addedAtSaved: 0, flushed: 0 };
  const listenStats = {
    history: opts.history ? JSON.parse(JSON.stringify(opts.history)) : [],
    songs: opts.songs ? JSON.parse(JSON.stringify(opts.songs)) : {},
    artists: opts.artists ? JSON.parse(JSON.stringify(opts.artists)) : {},
    updatedAt: 4200,
  };
  const api = {
    exportBackupFile(payload) {
      calls.push('export:' + (payload && payload.defaultName));
      exported.push(payload);
      return Promise.resolve(opts.exportResult || { ok: true, filePath: 'C:/tmp/mineradio.backup' });
    },
    importBackupFile() {
      calls.push('import-dialog');
      return Promise.resolve(opts.importResult || { ok: true, text: String(opts.importText || '') });
    },
    readLocalLibraryDbStats() {
      calls.push('read-stats');
      return Promise.resolve({ ok: true, stats: opts.dbStats || {} });
    },
    refreshLocalMusicFiles(folder) {
      calls.push('probe:' + folder);
      if (opts.folderMissing) return Promise.resolve({ ok: false, error: 'LOCAL_LIBRARY_NOT_DIRECTORY' });
      return Promise.resolve({ ok: true, folderPath: String(folder), files: [] });
    },
    chooseLocalMusicFolder() {
      calls.push('choose-folder');
      if (!opts.pickedFolder) return Promise.resolve({ ok: false, canceled: true });
      return Promise.resolve({ ok: true, folderPath: opts.pickedFolder, files: [] });
    },
    bumpLocalLibraryDbPlayStat(payload) {
      dbCalls.push({ method: 'bump', payload: JSON.parse(JSON.stringify(payload)) });
      return Promise.resolve({ ok: true });
    },
    setLocalLibraryDbFavorite(payload) {
      dbCalls.push({ method: 'favorite', payload: JSON.parse(JSON.stringify(payload)) });
      return Promise.resolve({ ok: true });
    },
    restartApp() { calls.push('restart'); return Promise.resolve({ ok: true }); },
  };
  if (opts.noDesktop) Object.keys(api).forEach((key) => { delete api[key]; });
  const context = {
    console: { warn() {}, error() {}, log() {} },
    JSON, Object, Array, String, Number, Math, Date, Boolean, Promise, RegExp, Error,
    APP_VERSION: opts.appVersion || '9.9.9',
    localLibrarySongs: opts.library ? opts.library.slice() : [],
    LYRIC_LAYOUT_STORE_KEY: 'mineradio-lyric-layout-v1',
    AUDIO_CHAIN_STORE_KEY: 'mineradio-audio-chain-v1',
    LOCAL_LIBRARY_SNAPSHOT_STORE_KEY: 'mineradio-local-library-snapshot-v1',
    LOCAL_LIBRARY_INDEX_STORE_KEY: 'mineradio-local-library-index-v1',
    PLAYBACK_SESSION_STORE_KEY: 'mineradio-playback-session-v1',
    SONG_RESUME_STORE_KEY: 'mineradio-song-resume-v1',
    QUEUE_SNAPSHOT_STORE_KEY: 'mineradio-queue-snapshots-v1',
    USER_FX_ARCHIVE_STORE_KEY: 'mineradio-user-fx-archives-v1',
    HOME_LISTEN_STATS_KEY: 'mineradio-listen-stats-v1',
    LOCAL_USER_STATE_LISTEN_STATS: 'listen-stats',
    LOCAL_USER_STATE_FX_ARCHIVES: 'user-fx-archives',
  };
  Object.assign(context, PLAYER_KEYS);
  // 这三个键推导函数照抄 app.js 本体：备份的换机重算全靠它们，抄错了测试就没意义。
  Object.assign(context, {
    normalizeLocalLibraryPathKey(value) {
      return String(value || '').replace(/\\/g, '/').replace(/\/+/g, '/').trim().toLowerCase();
    },
    localLibraryPathKeyFromSong(song) {
      if (!song) return '';
      return context.normalizeLocalLibraryPathKey(song.localFilePathAbsolute || song.localPath || song.name || '');
    },
    specialLikedSongKey(song) {
      if (!song) return '';
      if (song.localKey) return 'local-key:' + String(song.localKey);
      const raw = String(song.localFilePathAbsolute || song.localPath || '').replace(/\\/g, '/').toLowerCase();
      if (raw) return 'local-path:' + raw;
      return 'local-meta:' + String(song.name || '') + '|' + String(song.artist || '');
    },
    localStorage: {
      getItem(key) {
        return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
      },
      setItem(key, value) { store[key] = String(value); },
      removeItem(key) { delete store[key]; },
    },
    setPersistentLocalStorageItem(key, value) { store[key] = String(value); },
    removePersistentLocalStorageItem(key) { delete store[key]; },
    flushPersistentUiStateBackup() { written.flushed += 1; },
    showToast(message) { toasts.push(String(message)); },
    getDesktopWindowApi() { return Object.keys(api).length ? api : null; },
    setTimeout(fn, ms) { timers.push({ fn, ms }); return timers.length; },
    location: { reload() { calls.push('reload'); } },
  });
  Object.assign(context, {
    savedLocalLibraryFolderPath() { return opts.folder === undefined ? LIBRARY_ROOT : opts.folder; },
    saveLocalLibraryFolderPath(value) { written.folder = String(value || ''); },
    readLocalPlaylists() { return JSON.parse(JSON.stringify(opts.playlists || [])); },
    writeLocalPlaylists(list) { written.playlists = plain(list); },
    readSpecialLikedSongRefs() { return JSON.parse(JSON.stringify(opts.favorites || [])); },
    writeSpecialLikedSongRefs(list) { written.favorites = plain(list); },
    ensureLocalLibraryAddedAtMap() { return addedAt; },
    saveLocalLibraryAddedAtMap() { written.addedAtSaved += 1; },
    ensureListenStatsState() { return listenStats; },
    createEmptyListenStatsState() { return { history: [], songs: {}, artists: {}, updatedAt: 0 }; },
    readLocalUserStateRecord(id) {
      calls.push('read-user-state:' + id);
      if (!Object.prototype.hasOwnProperty.call(userState, id)) return Promise.resolve(null);
      return Promise.resolve({ value: userState[id] });
    },
    writeLocalUserStateRecord(id, value) {
      calls.push('write-user-state:' + id);
      userState[id] = plain(value);
      return Promise.resolve({ ok: true });
    },
    normalizeUserFxArchives(value) { return Array.isArray(value) ? plain(value) : []; },
    readUserFxArchives() { return opts.legacyArchives || []; },
  });
  // 浏览器兜底路径（没有桌面壳时）用到的最小 DOM 桩。
  Object.assign(context, {
    Blob: function Blob(parts, meta) { this.parts = parts; this.type = (meta && meta.type) || ''; },
    URL: {
      createObjectURL(blob) { calls.push('object-url:' + (blob && blob.type)); return 'blob:mineradio'; },
      revokeObjectURL(url) { calls.push('revoke:' + url); },
    },
    document: {
      createElement(tag) {
        const node = { tagName: String(tag), click() { calls.push('click:' + node.tagName + ':' + (node.download || node.type || '')); } };
        return node;
      },
    },
  });
  context.window = context;
  vm.runInNewContext(BACKUP_SOURCE, context, { filename: 'mineradio-backup.js' });
  return { context, opts, toasts, calls, timers, exported, dbCalls, store, userState, addedAt, written, listenStats, api };
}

const SONG_A_ABS = LIBRARY_ROOT + '\\Rock\\a.mp3';
const SONG_B_ABS = LIBRARY_ROOT + '\\Pop\\b.flac';
const NEW_ROOT = 'E:\\新盘\\音乐';

/**
 * 造一份「有歌单、有收藏、有播放统计、有听歌历史」的导出现场。
 * @param {object=} extra 额外覆盖。
 * @returns {object} loadBackupModule 的配置。
 */
function exportFixture(extra) {
  const songA = makeSong(SONG_A_ABS, { name: '甲歌', artist: '甲', album: '专辑甲', size: 111, mtime: 222 });
  const songB = makeSong(SONG_B_ABS, { name: '乙歌', artist: '乙', album: '专辑乙', size: 333, mtime: 444, localFormat: 'flac' });
  const keyA = 'local-key:' + songA.localKey;
  const keyB = 'local-key:' + songB.localKey;
  const statA = 'local:' + songA.localKey;
  const dbStats = {};
  dbStats[songA.localKey] = { plays: 7, listenMs: 120000, completed: 3, lastPlayedAt: 990, favorite: false, favoriteAt: 0 };
  dbStats[songB.localKey] = { plays: 2, listenMs: 50000, completed: 1, lastPlayedAt: 0, favorite: true, favoriteAt: 880 };
  const songs = {};
  songs[statA] = {
    key: statA, name: '甲歌', artist: '甲', source: 'local',
    cover: 'data:image/png;base64,AAAACOVER', plays: 7, listenMs: 120000, completed: 3, lastPlayedAt: 990,
  };
  return Object.assign({
    library: [songA, songB],
    folder: LIBRARY_ROOT,
    dbStats,
    playlists: [{
      id: 'p1', name: '通勤', createdAt: 10, updatedAt: 20,
      songRefs: [{ key: keyA, path: songA.localPath.replace(/\\/g, '/').toLowerCase(), name: '甲歌', artist: '甲' }],
    }],
    favorites: [{ key: keyB, path: songB.localPath.replace(/\\/g, '/').toLowerCase(), name: '乙歌', artist: '乙' }],
    history: [{
      key: statA, type: 'local', sourceKey: '', name: '甲歌', artist: '甲',
      cover: 'data:image/png;base64,AAAACOVER', source: 'local', playedAt: 555, listenMs: 60000, completed: true,
    }],
    songs,
    artists: { 甲: { name: '甲', plays: 7, listenMs: 120000, lastPlayedAt: 990 } },
    addedAt: { 'd:/music/rock/a.mp3': 4321 },
    localStorage: {
      'apex-player-volume': '0.42',
      'mineradio-gapless-v1': '1',
      'mineradio-plugins-v1': '[{"id":"neon"}]',
      'mineradio-lyric-layout-v1': '{"scale":1.2}',
      'mineradio-audio-chain-v1': '{"bass":3}',
      'mineradio-local-library-snapshot-v1': '{"files":[{"path":"D:/Music/Rock/a.mp3"}]}',
      'mineradio-queue-snapshots-v1': '[{"name":"临时队列"}]',
    },
  }, extra || {});
}

/**
 * 收集对象树里出现过的所有键名。
 * @param {*} node 任意值。
 * @param {Set<string>=} into 收集容器。
 * @returns {Set<string>} 键名集合。
 */
function collectKeys(node, into) {
  const bag = into || new Set();
  if (!node || typeof node !== 'object') return bag;
  if (Array.isArray(node)) {
    node.forEach((item) => collectKeys(item, bag));
    return bag;
  }
  Object.keys(node).forEach((key) => {
    bag.add(key);
    collectKeys(node[key], bag);
  });
  return bag;
}

test('导出结构只有 version / meta / database / config / paths 五段', async () => {
  const mod = loadBackupModule(exportFixture());
  const payload = plain(await mod.context.collectMineradioBackupPayload());
  assert.equal(payload.version, 2);
  assert.deepEqual(Object.keys(payload), ['version', 'meta', 'database', 'config', 'paths']);
  assert.deepEqual(Object.keys(payload.database), ['songs', 'playlists', 'favorites', 'history']);
  assert.deepEqual(Object.keys(payload.config), ['theme', 'eq', 'player']);
  assert.deepEqual(Object.keys(payload.paths), ['musicFolders']);
  assert.deepEqual(payload.paths.musicFolders, [LIBRARY_ROOT]);
  assert.equal(payload.meta.app, 'Mineradio');
  assert.equal(payload.meta.appVersion, '9.9.9');
  assert.deepEqual(payload.meta.counts, { songs: 2, playlists: 1, favorites: 1, history: 1 });
  assert.deepEqual(payload.config.theme.plugins, [{ id: 'neon' }]);
  assert.deepEqual(payload.config.theme.lyricLayout, { scale: 1.2 });
  assert.deepEqual(payload.config.eq.audioChain, { bass: 3 });
  assert.ok(mod.calls.includes('read-stats'), '导出要向 SQLite 取播放统计');
});

test('歌曲身份存 {folder, rel}，绝对路径与 localKey 一律不落盘', async () => {
  const mod = loadBackupModule(exportFixture());
  const payload = plain(await mod.context.collectMineradioBackupPayload());
  const first = payload.database.songs[0];
  assert.equal(first.folder, 0);
  assert.equal(first.rel, 'Rock/a.mp3');
  assert.equal(first.size, 111);
  assert.equal(first.mtime, 222);
  assert.equal(first.name, '甲歌');
  assert.equal(first.album, '专辑甲');
  assert.equal(first.addedAt, 4321);
  assert.equal(first.plays, 7);
  assert.equal(first.listenMs, 120000);
  assert.equal(first.lastPlayedAt, 990);
  assert.equal(first.favorite, false);
  ['localKey', 'localPath', 'localFilePathAbsolute', 'abs', 'path'].forEach((key) => {
    assert.ok(!Object.prototype.hasOwnProperty.call(first, key), '不该出现的字段: ' + key);
  });
  const second = payload.database.songs[1];
  assert.equal(second.rel, 'Pop/b.flac');
  assert.equal(second.format, 'flac');
  assert.equal(second.favorite, true);
  assert.equal(second.favoriteAt, 880);
  // 歌单 / 收藏 / 历史全部换成同一套可搬运坐标。
  assert.deepEqual(payload.database.playlists[0], {
    id: 'p1',
    name: '通勤',
    createdAt: 10,
    updatedAt: 20,
    songRefs: [{ folder: 0, rel: 'Rock/a.mp3', size: 111, mtime: 222, name: '甲歌', artist: '甲' }],
  });
  assert.deepEqual(payload.database.favorites, [
    { folder: 0, rel: 'Pop/b.flac', size: 333, mtime: 444, name: '乙歌', artist: '乙' },
  ]);
  assert.equal(payload.database.history.records[0].rel, 'Rock/a.mp3');
  assert.ok(!Object.prototype.hasOwnProperty.call(payload.database.history.records[0], 'key'));
  assert.equal(payload.database.history.songs[0].rel, 'Rock/a.mp3');
  assert.deepEqual(payload.database.history.artists, [
    { name: '甲', plays: 7, listenMs: 120000, lastPlayedAt: 990 },
  ]);
});

test('默认不备份音频 / 大封面缓存 / 临时文件', async () => {
  const mod = loadBackupModule(exportFixture());
  const payload = plain(await mod.context.collectMineradioBackupPayload());
  const text = JSON.stringify(payload);
  assert.ok(!text.includes('data:image'), '封面 dataURL 不该进备份');
  assert.ok(!text.includes('data:audio'), '音频 dataURL 不该进备份');
  assert.ok(!text.includes('base64'), 'base64 载荷不该进备份');
  assert.ok(!text.includes('.mp3:'), 'localKey 形态的绝对路径不该进备份');
  const keys = collectKeys(payload);
  ['cover', 'coverUrl', 'artwork', 'picture', 'dataUrl', 'blob', 'bytes', 'buffer', 'beatMap', 'lyrics', 'localFile']
    .forEach((key) => { assert.ok(!keys.has(key), '不该备份的字段: ' + key); });
  // 临时文件：曲库快照 / 曲库索引 / 队列快照 / 播放会话 / 续播位置一个都不进 config.player。
  assert.deepEqual(Object.keys(payload.config.player).sort(), ['apex-player-volume', 'mineradio-gapless-v1']);
  [
    'mineradio-local-library-snapshot-v1',
    'mineradio-local-library-index-v1',
    'mineradio-queue-snapshots-v1',
    'mineradio-playback-session-v1',
    'mineradio-song-resume-v1',
  ].forEach((key) => { assert.ok(!text.includes(key), '临时文件键不该进备份: ' + key); });
  assert.ok(!text.includes('临时队列'), '队列快照内容不该进备份');
  // 两首歌的备份必须停在几 KB：体积一失控就说明混进了缓存。
  assert.ok(text.length < 4096, '备份体积异常: ' + text.length);
});

test('导出的 mineradio.backup 走 .backup 通道，桌面壳缺席时退回浏览器下载', async () => {
  const mod = loadBackupModule(exportFixture());
  await mod.context.exportMineradioBackup();
  assert.deepEqual(mod.calls.filter((item) => item.indexOf('export:') === 0), ['export:mineradio.backup']);
  assert.equal(mod.exported[0].defaultName, 'mineradio.backup');
  assert.deepEqual(JSON.parse(mod.exported[0].text).meta.counts.songs, 2);
  assert.deepEqual(mod.toasts, ['备份已导出：2 首 / 1 歌单 / 1 收藏']);
  const web = loadBackupModule(exportFixture({ noDesktop: true }));
  await web.context.exportMineradioBackup();
  assert.ok(web.calls.includes('object-url:application/json;charset=utf-8'));
  assert.ok(web.calls.includes('click:a:mineradio.backup'));
  assert.deepEqual(web.toasts, ['备份已导出：2 首 / 1 歌单 / 1 收藏']);
});

/**
 * 先跑一遍真实导出，拿到备份文本供导入用例往回灌。
 * @returns {Promise<string>} 备份 JSON 文本。
 */
async function makeBackupText() {
  const mod = loadBackupModule(exportFixture());
  return JSON.stringify(await mod.context.collectMineradioBackupPayload());
}

const NEW_A_ABS = NEW_ROOT + '\\Rock\\a.mp3';
const NEW_B_ABS = NEW_ROOT + '\\Pop\\b.flac';
const NEW_A_PATH_KEY = 'e:/新盘/音乐/rock/a.mp3';
const NEW_B_PATH_KEY = 'e:/新盘/音乐/pop/b.flac';

test('新电脑导入：原文件夹不在就让用户重选，歌单与收藏按新根重算身份', async () => {
  const text = await makeBackupText();
  const mod = loadBackupModule({ folder: '', folderMissing: true, pickedFolder: NEW_ROOT });
  const ok = await mod.context.applyMineradioBackup(mod.context.parseMineradioBackupText(text));
  assert.equal(ok, true);
  assert.ok(mod.calls.includes('probe:' + LIBRARY_ROOT), '先按备份里的路径探一次');
  assert.ok(mod.calls.includes('choose-folder'), '探不到才弹选择框');
  assert.ok(mod.toasts.some((item) => item.includes('请重新选择')));
  assert.equal(mod.written.folder, NEW_ROOT);
  assert.deepEqual(mod.written.playlists, [{
    id: 'p1',
    name: '通勤',
    createdAt: 10,
    updatedAt: 20,
    songRefs: [{ key: 'local-key:' + NEW_A_ABS + ':111:222', path: NEW_A_PATH_KEY, name: '甲歌', artist: '甲' }],
  }]);
  assert.deepEqual(mod.written.favorites, [
    { key: 'local-key:' + NEW_B_ABS + ':333:444', path: NEW_B_PATH_KEY, name: '乙歌', artist: '乙' },
  ]);
  // 入库时间按新 pathKey 回填。
  assert.equal(mod.addedAt[NEW_A_PATH_KEY], 4321);
  assert.equal(mod.written.addedAtSaved, 1);
  assert.equal(mod.written.flushed, 1);
  assert.ok(mod.toasts.some((item) => item.includes('备份已导入：2 首 / 1 歌单 / 1 收藏 / 2 条统计')));
  // 覆盖式导入以重启收尾。
  assert.equal(mod.timers.length, 1);
  mod.timers[0].fn();
  assert.ok(mod.calls.includes('restart'));
});

test('同机导入：路径还在就不打扰用户，localKey 原样复原', async () => {
  const text = await makeBackupText();
  const mod = loadBackupModule({});
  const ok = await mod.context.applyMineradioBackup(mod.context.parseMineradioBackupText(text));
  assert.equal(ok, true);
  assert.ok(!mod.calls.includes('choose-folder'), '同机导入不该弹选择框');
  assert.equal(mod.written.folder, LIBRARY_ROOT);
  assert.equal(mod.written.playlists[0].songRefs[0].key, 'local-key:' + SONG_A_ABS + ':111:222');
  assert.equal(mod.written.playlists[0].songRefs[0].path, 'd:/music/rock/a.mp3');
  assert.equal(mod.written.favorites[0].key, 'local-key:' + SONG_B_ABS + ':333:444');
  assert.equal(mod.addedAt['d:/music/rock/a.mp3'], 4321);
});

test('用户在重选文件夹时取消：什么都不写，也不重启', async () => {
  const text = await makeBackupText();
  const mod = loadBackupModule({ folder: '', folderMissing: true, pickedFolder: '' });
  const ok = await mod.context.applyMineradioBackup(mod.context.parseMineradioBackupText(text));
  assert.equal(ok, false);
  assert.equal(mod.written.playlists, null);
  assert.equal(mod.written.favorites, null);
  assert.equal(mod.written.folder, '');
  assert.equal(mod.written.addedAtSaved, 0);
  assert.equal(mod.written.flushed, 0);
  assert.deepEqual(mod.dbCalls, []);
  assert.equal(mod.timers.length, 0);
  assert.ok(mod.toasts.includes('已取消导入'));
});

test('播放次数与收藏落回 SQLite：lastPlayedAt 为 0 的行垫 1ms，别冒充刚听过', async () => {
  const text = await makeBackupText();
  const mod = loadBackupModule({ folder: '', folderMissing: true, pickedFolder: NEW_ROOT });
  await mod.context.applyMineradioBackup(mod.context.parseMineradioBackupText(text));
  assert.deepEqual(mod.dbCalls.map((item) => item.method), ['bump', 'bump', 'favorite']);
  assert.deepEqual(mod.dbCalls[0].payload, {
    key: NEW_A_ABS + ':111:222',
    pathKey: NEW_A_PATH_KEY,
    plays: 7,
    listenMs: 120000,
    completed: 3,
    lastPlayedAt: 990,
    name: '甲歌',
    artist: '甲',
  });
  assert.equal(mod.dbCalls[1].payload.key, NEW_B_ABS + ':333:444');
  assert.equal(mod.dbCalls[1].payload.plays, 2);
  assert.equal(mod.dbCalls[1].payload.lastPlayedAt, 1);
  assert.deepEqual(mod.dbCalls[2].payload, {
    key: NEW_B_ABS + ':333:444',
    pathKey: NEW_B_PATH_KEY,
    favorite: 1,
    name: '乙歌',
    artist: '乙',
  });
});

test('听歌历史按新根重挂，封面一律清空不占体积', async () => {
  const text = await makeBackupText();
  const mod = loadBackupModule({
    folder: '',
    folderMissing: true,
    pickedFolder: NEW_ROOT,
    localStorage: { 'mineradio-listen-stats-v1': '{"history":[{"key":"local:D:\\\\Music\\\\Rock\\\\a.mp3:111:222"}]}' },
  });
  await mod.context.applyMineradioBackup(mod.context.parseMineradioBackupText(text));
  const state = mod.userState['listen-stats'];
  assert.ok(state, '听歌统计要写进 IndexedDB 用户态');
  assert.equal(state.history.length, 1);
  assert.equal(state.history[0].key, 'local:' + NEW_A_ABS + ':111:222');
  assert.equal(state.history[0].name, '甲歌');
  assert.equal(state.history[0].listenMs, 60000);
  assert.equal(state.history[0].completed, true);
  assert.equal(state.history[0].cover, '');
  assert.deepEqual(Object.keys(state.songs), ['local:' + NEW_A_ABS + ':111:222']);
  assert.equal(state.songs['local:' + NEW_A_ABS + ':111:222'].cover, '');
  assert.equal(state.songs['local:' + NEW_A_ABS + ':111:222'].plays, 7);
  assert.deepEqual(state.artists, { 甲: { name: '甲', plays: 7, listenMs: 120000, lastPlayedAt: 990 } });
  // 旧的 localStorage 镜像必须让位给刚写进去的用户态，否则启动时会被旧数据顶回去。
  assert.equal(mod.store['mineradio-listen-stats-v1'], undefined);
});

test('临时文件在导入时被抹掉：曲库快照 / 索引 / 队列 / 会话 / 续播', async () => {
  const text = await makeBackupText();
  const mod = loadBackupModule({
    localStorage: {
      'mineradio-local-library-snapshot-v1': '{"files":[]}',
      'mineradio-local-library-index-v1': '{"index":[]}',
      'mineradio-queue-snapshots-v1': '[]',
      'mineradio-playback-session-v1': '{"song":"旧机器"}',
      'mineradio-song-resume-v1': '{"pos":42}',
      'mineradio-user-fx-archives-v1': '[{"name":"旧档"}]',
    },
    userState: { 'user-fx-archives': [{ name: '备份档' }] },
  });
  await mod.context.applyMineradioBackup(mod.context.parseMineradioBackupText(text));
  [
    'mineradio-local-library-snapshot-v1',
    'mineradio-local-library-index-v1',
    'mineradio-queue-snapshots-v1',
    'mineradio-playback-session-v1',
    'mineradio-song-resume-v1',
  ].forEach((key) => { assert.equal(mod.store[key], undefined, '临时文件没清掉: ' + key); });
});

test('音效档案随备份走 IndexedDB 用户态，旧 localStorage 档案让位', async () => {
  const src = loadBackupModule(exportFixture({ userState: { 'user-fx-archives': [{ name: '夜间' }] } }));
  const text = JSON.stringify(await src.context.collectMineradioBackupPayload());
  assert.deepEqual(JSON.parse(text).config.eq.archives, [{ name: '夜间' }]);
  const mod = loadBackupModule({ localStorage: { 'mineradio-user-fx-archives-v1': '[{"name":"旧档"}]' } });
  await mod.context.applyMineradioBackup(mod.context.parseMineradioBackupText(text));
  assert.ok(mod.calls.includes('write-user-state:user-fx-archives'));
  assert.deepEqual(mod.userState['user-fx-archives'], [{ name: '夜间' }]);
  assert.equal(mod.store['mineradio-user-fx-archives-v1'], undefined);
  // 用户态里没有时回落到旧 localStorage 档案，老用户的备份不能是空的。
  const legacy = loadBackupModule(exportFixture({ legacyArchives: [{ name: '旧档' }] }));
  const payload = plain(await legacy.context.collectMineradioBackupPayload());
  assert.deepEqual(payload.config.eq.archives, [{ name: '旧档' }]);
});

test('版本闸门：只认 version 2，杂物一律拒收', () => {
  const mod = loadBackupModule({});
  ['', 'not json', '[]', 'null', '"text"', '{}', '{"version":1,"database":{}}', '{"version":3}']
    .forEach((text) => { assert.equal(mod.context.parseMineradioBackupText(text), null, '不该收下: ' + text); });
  const parsed = plain(mod.context.parseMineradioBackupText('{"version":2}'));
  assert.equal(parsed.version, 2);
  assert.deepEqual(parsed.database, {
    songs: [], playlists: [], favorites: [], history: { updatedAt: 0, records: [], songs: [], artists: [] },
  });
  assert.deepEqual(parsed.config, { theme: {}, eq: {}, player: {} });
  assert.deepEqual(parsed.paths, { musicFolders: [] });
  // 路径段被污染成别的类型时退化成空数组，而不是抛出去。
  const dirty = plain(mod.context.parseMineradioBackupText('{"version":2,"paths":{"musicFolders":["  ",""," D:\\\\Music "]},"config":{"player":[]}}'));
  assert.deepEqual(dirty.paths.musicFolders, ['D:\\Music']);
  assert.deepEqual(dirty.config.player, {});
});

test('config.player 只认白名单键，备份文件塞不进任意 localStorage 键', async () => {
  const mod = loadBackupModule({});
  // 手写 JSON：JSON.parse 会把 __proto__ 变成真正的自有键，正好用来验白名单挡不挡得住。
  const payload = mod.context.parseMineradioBackupText('{"version":2,"config":{"player":{'
    + '"apex-player-volume":"0.9","mineradio-gapless-v1":"1","mineradio-hotkey-settings-v1":null,'
    + '"mineradio-evil-key":"boom","__proto__":{"polluted":true}}}}');
  await mod.context.applyMineradioBackup(payload);
  assert.deepEqual(Object.keys(mod.store).sort(), ['apex-player-volume', 'mineradio-gapless-v1']);
  assert.equal(mod.store['apex-player-volume'], '0.9');
  assert.equal(mod.store['mineradio-gapless-v1'], '1');
  assert.equal(mod.store['mineradio-hotkey-settings-v1'], undefined, 'null 值不该写成字符串 null');
  assert.equal(mod.store['mineradio-evil-key'], undefined, '白名单外的键必须被丢掉');
  assert.equal({}.polluted, undefined, '原型没被污染');
});

test('白名单与 app.js 里的持久化键常量一一对应', () => {
  const mod = loadBackupModule({});
  const list = plain(mod.context.MINERADIO_BACKUP_PLAYER_KEYS);
  assert.equal(list.length, 16);
  assert.deepEqual(list.slice().sort(), Object.values(PLAYER_KEYS).sort());
  Object.keys(PLAYER_KEYS).forEach((name) => {
    assert.match(appSource, new RegExp('var ' + name + " = '" + PLAYER_KEYS[name] + "';"), name + ' 常量值漂了');
  });
});

test('导入按钮两步确认：第一次只提示，第二次才真的读文件', async () => {
  const mod = loadBackupModule({ importResult: { ok: false, canceled: true } });
  mod.context.importMineradioBackupFromDialog();
  assert.deepEqual(mod.calls, [], '第一次点击不许碰文件对话框');
  assert.ok(mod.toasts[0].includes('再点一次「导入备份」确认'));
  mod.context.importMineradioBackupFromDialog();
  await new Promise((resolve) => { setImmediate(resolve); });
  assert.deepEqual(mod.calls, ['import-dialog']);
  assert.equal(mod.context.mineradioBackupImportPending, null, '流程收尾要清掉在途标记');
  assert.equal(mod.written.folder, '', '用户取消选文件时什么都不该写');
  // 武装窗口过期后回到「只提示」，避免搁置几小时后误触直接覆盖。
  mod.calls.length = 0;
  mod.toasts.length = 0;
  mod.context.mineradioBackupImportArmedAt = Date.now() - 20000;
  mod.context.importMineradioBackupFromDialog();
  assert.deepEqual(mod.calls, []);
  assert.ok(mod.toasts[0].includes('再点一次'));
  assert.match(BACKUP_SOURCE, /var MINERADIO_BACKUP_IMPORT_ARM_MS = 12000;/);
});

test('读不到备份文本时给提示，用户取消则安静退出', async () => {
  const canceled = loadBackupModule({ importResult: { ok: false, canceled: true } });
  await canceled.context.runMineradioBackupImport();
  assert.deepEqual(canceled.toasts, []);
  const broken = loadBackupModule({ importResult: { ok: false, error: 'BACKUP_FILE_TOO_LARGE' } });
  await broken.context.runMineradioBackupImport();
  assert.deepEqual(broken.toasts, ['备份文件读取失败']);
  const stale = loadBackupModule({ importResult: { ok: true, text: '{"version":1}' } });
  await stale.context.runMineradioBackupImport();
  assert.deepEqual(stale.toasts, ['不是可识别的 mineradio.backup（需要 version 2）']);
  assert.deepEqual(stale.written.playlists, null);
});

test('四层链路对齐：app.js → preload.js → main.js', () => {
  assert.match(BACKUP_SOURCE, /api\.exportBackupFile\(\{ defaultName: MINERADIO_BACKUP_FILE_NAME, text: text \}\)/);
  assert.match(BACKUP_SOURCE, /api\.importBackupFile\(\)/);
  assert.match(preloadSource, /exportBackupFile: \(payload\) => ipcRenderer\.invoke\('mineradio-export-backup-file', payload \|\| \{\}\)/);
  assert.match(preloadSource, /importBackupFile: \(\) => ipcRenderer\.invoke\('mineradio-import-backup-file'\)/);
  assert.match(mainSource, /ipcMain\.handle\('mineradio-export-backup-file', trustedMainFrameHandler\(/);
  assert.match(mainSource, /ipcMain\.handle\('mineradio-import-backup-file', trustedMainFrameHandler\(/);
  // 备份走自己的 .backup 通道，不许蹭只认 .json 的音效档案 / 插件导入。
  const exportHandler = slice(
    mainSource,
    "ipcMain.handle('mineradio-export-backup-file'",
    "ipcMain.handle('mineradio-import-backup-file'",
    '导出备份主进程',
  );
  assert.match(exportHandler, /extensions: \['backup'\]/);
  assert.match(exportHandler, /endsWith\('\.backup'\)/);
  assert.match(exportHandler, /fs\.writeFileSync\(result\.filePath, text, 'utf8'\)/);
  const importHandler = slice(
    mainSource,
    "ipcMain.handle('mineradio-import-backup-file'",
    "ipcMain.handle('mineradio-export-json-file'",
    '导入备份主进程',
  );
  assert.match(importHandler, /extensions: \['backup'\]/);
  assert.match(importHandler, /stat\.size > 64 \* 1024 \* 1024/);
  assert.match(importHandler, /return \{ ok: true, filePath, text \}/);
});

test('音效面板里的备份折叠面板挂着导出 / 导入两个按钮', () => {
  const fold = slice(htmlSource, 'id="fx-backup-fold"', 'id="fx-advanced"', '备份折叠面板');
  assert.match(fold, /onclick="exportMineradioBackup\(\)"/);
  assert.match(fold, /onclick="importMineradioBackupFromDialog\(\)"/);
  assert.match(fold, /mineradio\.backup/);
  assert.match(fold, /整机备份/);
  assert.ok(fold.includes('音频文件、封面缓存和临时文件都不进去'), '面板要说清默认不备份什么');
  assert.ok(fold.includes('重选'), '面板要提前说明换机路径可能要重选');
  // 排在插件折叠面板之后、高级设置之前，跟其它 fx-fold 共用同一套样式。
  assert.ok(htmlSource.indexOf('id="fx-plugin-fold"') < htmlSource.indexOf('id="fx-backup-fold"'));
  assert.match(fold, /class="fx-fold-body"/);
  assert.match(fold, /class="fx-mini-btn ghost"/);
});
