'use strict';

// 本地曲库 SQLite 索引层。
// 目标：几万首歌启动时不再反序列化「一整包 JSON 快照 + 一整包索引对象」，
// 改成一次按 sort_index 的有序 SELECT 加逐行水合，并让重扫命中文件指纹时直接复用已解析元数据。
// 主键设计：路径（root_id + rel_path 唯一）与文件指纹（path_key|size|mtime）双索引；
// 指纹一致即视为同一份文件，时长 / 格式 / Artist / Album / Genre / Year 与封面、歌词缓存全部保留。
// node:sqlite 是 Node 22.5+ 内置模块，Electron 43 自带的 Node 24 已经带上，
// 所以这一层不引入任何原生依赖；模块缺失或建库失败时整层降级为不可用，调用方回落原 IndexedDB 路径。

const path = require('node:path');
const fs = require('node:fs');

const LOCAL_LIBRARY_DB_SCHEMA_VERSION = 1;
const LOCAL_LIBRARY_DB_FILE_NAME = 'library.db';
const LOCAL_LIBRARY_SYNC_BATCH_SIZE = 4000;
const LOCAL_LIBRARY_ASSET_MAX_RECORDS = 48000;
const LOCAL_LIBRARY_ASSET_MAX_BYTES = 256 * 1024 * 1024;
const LOCAL_LIBRARY_LYRIC_MAX_RECORDS = 48000;
const LOCAL_LIBRARY_CACHE_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;

let sqliteModuleCache = null;
let sqliteModuleLoaded = false;

/**
 * 懒加载 node:sqlite。旧 Node 或裁剪过的运行时没有该内置模块，这里只探测一次并缓存结果。
 * @returns {object|null} node:sqlite 模块，或不可用时的 null。
 */
function loadSqliteModule() {
  if (sqliteModuleLoaded) return sqliteModuleCache;
  sqliteModuleLoaded = true;
  try {
    const mod = require('node:sqlite');
    sqliteModuleCache = mod && typeof mod.DatabaseSync === 'function' ? mod : null;
  } catch (_e) {
    sqliteModuleCache = null;
  }
  return sqliteModuleCache;
}

/**
 * 当前运行时是否支持本地曲库 SQLite 索引。
 * @returns {boolean} 支持时返回 true。
 */
function isLocalLibraryStoreSupported() {
  return !!loadSqliteModule();
}

/**
 * 归一化为可写入 SQLite 的文本。node:sqlite 只接受 null/number/bigint/string/Uint8Array，undefined 会直接抛错。
 * @param {*} value 任意来源值。
 * @returns {string} 归一化文本。
 */
function toText(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'boolean') return value ? '1' : '';
  return String(value);
}

/**
 * 归一化为安全整数。超出 Number.MAX_SAFE_INTEGER 会让 node:sqlite 抛范围错误，这里提前夹紧。
 * @param {*} value 任意来源值。
 * @returns {number} 安全整数。
 */
function toInt(value) {
  const num = Math.trunc(Number(value));
  if (!Number.isFinite(num)) return 0;
  if (num > Number.MAX_SAFE_INTEGER) return Number.MAX_SAFE_INTEGER;
  if (num < -Number.MAX_SAFE_INTEGER) return -Number.MAX_SAFE_INTEGER;
  return num;
}

/**
 * 归一化为有限浮点数。
 * @param {*} value 任意来源值。
 * @returns {number} 有限浮点数。
 */
function toReal(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

/**
 * 归一化布尔为 0/1。SQLite 没有布尔类型，node:sqlite 也不接受 JS 布尔参数。
 * @param {*} value 任意来源值。
 * @returns {number} 0 或 1。
 */
function toFlag(value) {
  return value ? 1 : 0;
}

/**
 * 归一化路径键：统一分隔符并转小写，作为跨会话比对同一份文件的稳定键。
 * @param {*} value 任意路径。
 * @returns {string} 归一化路径键。
 */
function normalizeStorePathKey(value) {
  return toText(value).replace(/\\/g, '/').replace(/\/+/g, '/').trim().toLowerCase();
}

/**
 * 生成文件指纹。与渲染层 localLibraryFileSignatureFromSong 同构，保证两侧命中同一条记录。
 * @param {string} pathKey 归一化路径键。
 * @param {*} size 文件大小。
 * @param {*} mtime 修改时间毫秒。
 * @returns {string} 文件指纹。
 */
function makeStoreFingerprint(pathKey, size, mtime) {
  if (!pathKey) return '';
  return pathKey + '|' + toInt(size) + '|' + toInt(mtime);
}

/**
 * 拆解 data URL 为 MIME 与二进制内容，让封面以 BLOB 落盘而不是 base64 文本。
 * @param {string} dataUrl 形如 data:image/jpeg;base64,xxx 的字符串。
 * @returns {{mime:string, bytes:Uint8Array|null}} 拆解结果。
 */
function splitCoverDataUrl(dataUrl) {
  const text = toText(dataUrl);
  if (!text) return { mime: '', bytes: null };
  const match = /^data:([^;,]*)(;base64)?,/.exec(text);
  if (!match) return { mime: '', bytes: null };
  const payload = text.slice(match[0].length);
  try {
    if (match[2]) return { mime: match[1] || '', bytes: Buffer.from(payload, 'base64') };
    return { mime: match[1] || '', bytes: Buffer.from(decodeURIComponent(payload), 'binary') };
  } catch (_e) {
    return { mime: '', bytes: null };
  }
}

/**
 * 由 BLOB 还原 data URL，渲染层拿到的封面形状与旧 IndexedDB 记录完全一致。
 * @param {string} mime 图片 MIME。
 * @param {Uint8Array|Buffer|null} bytes 图片内容。
 * @returns {string} data URL 或空串。
 */
function joinCoverDataUrl(mime, bytes) {
  if (!bytes || !bytes.length) return '';
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes.buffer || bytes, bytes.byteOffset || 0, bytes.byteLength || bytes.length);
  return 'data:' + (toText(mime) || 'image/jpeg') + ';base64,' + buffer.toString('base64');
}

// 封面缓存列映射。字段名保持渲染层 localAssetCacheSnapshot 的原样，round-trip 后记录形状不变。
const ASSET_COLUMNS = [
  { name: 'name', field: 'name', kind: 'text' },
  { name: 'artist', field: 'artist', kind: 'text' },
  { name: 'album', field: 'album', kind: 'text' },
  { name: 'album_artist', field: 'albumArtist', kind: 'text' },
  { name: 'genre', field: 'genre', kind: 'text' },
  { name: 'year', field: 'year', kind: 'text' },
  { name: 'track_no', field: 'trackNumber', kind: 'text' },
  { name: 'duration', field: 'duration', kind: 'real' },
  { name: 'format', field: 'localFormat', kind: 'text' },
  { name: 'size', field: 'localFileSize', kind: 'int' },
  { name: 'mtime', field: 'localFileLastModified', kind: 'int' },
  { name: 'bitrate', field: 'localBitrateKbps', kind: 'int' },
  { name: 'path_key', field: 'localLibraryPathKey', kind: 'text' },
  { name: 'fingerprint', field: 'localLibraryFileSignature', kind: 'text' },
  { name: 'metadata_loaded', field: 'localMetadataLoaded', kind: 'flag' },
  { name: 'tag_schema', field: 'localMetadataTagSchema', kind: 'int' },
  { name: 'cover_file', field: 'localCoverFileName', kind: 'text' },
  { name: 'cover_loaded', field: 'localCoverLoaded', kind: 'flag' },
  { name: 'cover_light', field: 'localCoverLightScanned', kind: 'flag' },
  { name: 'cover_signature', field: 'localCoverFileSignature', kind: 'text' },
  { name: 'cover_source', field: 'localCoverSource', kind: 'text' },
  { name: 'schema_version', field: 'schema', kind: 'int' },
  { name: 'saved_at', field: 'savedAt', kind: 'int' },
];

// 歌词缓存列映射，与渲染层 localLyricCacheSnapshot 一一对应。
const LYRIC_COLUMNS = [
  { name: 'lyric_text', field: 'localLyricText', kind: 'text' },
  { name: 'loaded', field: 'localLyricLoaded', kind: 'flag' },
  { name: 'light', field: 'localLyricLightScanned', kind: 'flag' },
  { name: 'file_name', field: 'localLyricFileName', kind: 'text' },
  { name: 'tag_name', field: 'localLyricTagName', kind: 'text' },
  { name: 'file_signature', field: 'localLyricFileSignature', kind: 'text' },
  { name: 'source', field: 'localLyricSource', kind: 'text' },
  { name: 'schema_version', field: 'schema', kind: 'int' },
  { name: 'saved_at', field: 'savedAt', kind: 'int' },
];

// 除列映射外还需原样保留的字段；其余未知字段统一进 extra JSON，避免将来加字段时静默丢数据。
const ASSET_RESERVED_FIELDS = new Set(['id', 'localCoverThumbDataUrl', 'localCoverDataUrl']);
const LYRIC_RESERVED_FIELDS = new Set(['id', 'localLibraryPathKey', 'localLibraryFileSignature']);

/**
 * 按列类型返回 SQLite 声明与默认值。
 * @param {string} kind 列类型标记。
 * @returns {string} 形如 "TEXT NOT NULL DEFAULT ''" 的声明片段。
 */
function columnDeclaration(kind) {
  if (kind === 'real') return "REAL NOT NULL DEFAULT 0";
  if (kind === 'int' || kind === 'flag') return "INTEGER NOT NULL DEFAULT 0";
  return "TEXT NOT NULL DEFAULT ''";
}

/**
 * 按列类型归一化写入参数。
 * @param {string} kind 列类型标记。
 * @param {*} value 记录中的原始值。
 * @returns {string|number} 可直接绑定的参数。
 */
function columnValue(kind, value) {
  if (kind === 'real') return toReal(value);
  if (kind === 'int') return toInt(value);
  if (kind === 'flag') return toFlag(value);
  return toText(value);
}

/**
 * 生成缓存表 DDL。列映射驱动，避免二十多个字段手写三遍导致列序错位。
 * @param {string} table 表名。
 * @param {Array<object>} columns 列映射。
 * @param {Array<string>} extras 额外列声明。
 * @returns {string} CREATE TABLE 语句。
 */
function buildCacheTableDdl(table, columns, extras) {
  const parts = ['song_key TEXT PRIMARY KEY'];
  for (const column of columns) parts.push(column.name + ' ' + columnDeclaration(column.kind));
  for (const extra of extras || []) parts.push(extra);
  return 'CREATE TABLE IF NOT EXISTS ' + table + ' (' + parts.join(', ') + ')';
}

/**
 * 生成缓存表 upsert 语句。
 * @param {string} table 表名。
 * @param {Array<object>} columns 列映射。
 * @param {Array<string>} extras 额外列名。
 * @returns {string} INSERT ... ON CONFLICT 语句。
 */
function buildCacheUpsertSql(table, columns, extras) {
  const names = ['song_key'].concat(columns.map((column) => column.name), extras || []);
  const assignments = names.slice(1).map((name) => name + '=excluded.' + name);
  return 'INSERT INTO ' + table + ' (' + names.join(', ') + ') VALUES (' + names.map(() => '?').join(', ') + ') '
    + 'ON CONFLICT(song_key) DO UPDATE SET ' + assignments.join(', ');
}

// 曲库索引可复用的元数据列。指纹一致时保留，指纹变化时整组清空，避免旧标签套到新文件上。
const FILE_INDEX_COLUMNS = [
  { name: 'title', field: 'name', kind: 'text' },
  { name: 'artist', field: 'artist', kind: 'text' },
  { name: 'album', field: 'album', kind: 'text' },
  { name: 'album_artist', field: 'albumArtist', kind: 'text' },
  { name: 'genre', field: 'genre', kind: 'text' },
  { name: 'year', field: 'year', kind: 'text' },
  { name: 'track_no', field: 'trackNumber', kind: 'text' },
  { name: 'duration', field: 'duration', kind: 'real' },
  { name: 'format', field: 'localFormat', kind: 'text' },
  { name: 'bitrate', field: 'localBitrateKbps', kind: 'int' },
  { name: 'metadata_loaded', field: 'localMetadataLoaded', kind: 'flag' },
  { name: 'tag_schema', field: 'localMetadataTagSchema', kind: 'int' },
  { name: 'cover_status', field: 'coverStatus', kind: 'text' },
  { name: 'cover_source', field: 'coverSource', kind: 'text' },
  { name: 'cover_file', field: 'coverFileName', kind: 'text' },
  { name: 'cover_signature', field: 'coverFileSignature', kind: 'text' },
  { name: 'lyric_status', field: 'lyricStatus', kind: 'text' },
  { name: 'lyric_source', field: 'lyricSource', kind: 'text' },
  { name: 'lyric_file', field: 'lyricFileName', kind: 'text' },
  { name: 'lyric_tag', field: 'lyricTagName', kind: 'text' },
  { name: 'lyric_signature', field: 'lyricFileSignature', kind: 'text' },
  { name: 'index_updated_at', field: 'updatedAt', kind: 'int' },
];

const SCHEMA_STATEMENTS = [
  "CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '')",
  'CREATE TABLE IF NOT EXISTS roots ('
    + 'id INTEGER PRIMARY KEY AUTOINCREMENT, '
    + 'folder_path TEXT NOT NULL UNIQUE, '
    + "path_key TEXT NOT NULL DEFAULT '', "
    + "signature TEXT NOT NULL DEFAULT '', "
    + "scan_mode TEXT NOT NULL DEFAULT '', "
    + 'truncated INTEGER NOT NULL DEFAULT 0, '
    + 'file_count INTEGER NOT NULL DEFAULT 0, '
    + 'audio_count INTEGER NOT NULL DEFAULT 0, '
    + 'dir_count INTEGER NOT NULL DEFAULT 0, '
    + 'saved_at INTEGER NOT NULL DEFAULT 0, '
    + 'index_saved_at INTEGER NOT NULL DEFAULT 0)',
  'CREATE TABLE IF NOT EXISTS dirs ('
    + 'root_id INTEGER NOT NULL, '
    + 'rel_path TEXT NOT NULL, '
    + 'mtime INTEGER NOT NULL DEFAULT 0, '
    + 'sort_index INTEGER NOT NULL DEFAULT 0, '
    + 'PRIMARY KEY (root_id, rel_path))',
];

SCHEMA_STATEMENTS.push('CREATE TABLE IF NOT EXISTS files ('
  + 'id INTEGER PRIMARY KEY AUTOINCREMENT, '
  + 'root_id INTEGER NOT NULL, '
  + 'rel_path TEXT NOT NULL, '
  + "path_key TEXT NOT NULL DEFAULT '', "
  + "fingerprint TEXT NOT NULL DEFAULT '', "
  + "song_key TEXT NOT NULL DEFAULT '', "
  + "name TEXT NOT NULL DEFAULT '', "
  + "ext TEXT NOT NULL DEFAULT '', "
  + "mime TEXT NOT NULL DEFAULT '', "
  + 'is_audio INTEGER NOT NULL DEFAULT 0, '
  + 'size INTEGER NOT NULL DEFAULT 0, '
  + 'mtime INTEGER NOT NULL DEFAULT 0, '
  + 'sort_index INTEGER NOT NULL DEFAULT 0, '
  + 'seen_at INTEGER NOT NULL DEFAULT 0, '
  + FILE_INDEX_COLUMNS.map((column) => column.name + ' ' + columnDeclaration(column.kind)).join(', ')
  + ', UNIQUE(root_id, rel_path))');

SCHEMA_STATEMENTS.push('CREATE TABLE IF NOT EXISTS song_stats ('
  + 'song_key TEXT PRIMARY KEY, '
  + "path_key TEXT NOT NULL DEFAULT '', "
  + 'play_count INTEGER NOT NULL DEFAULT 0, '
  + 'listen_ms INTEGER NOT NULL DEFAULT 0, '
  + 'completed INTEGER NOT NULL DEFAULT 0, '
  + 'last_played_at INTEGER NOT NULL DEFAULT 0, '
  + 'favorite INTEGER NOT NULL DEFAULT 0, '
  + 'favorite_at INTEGER NOT NULL DEFAULT 0, '
  + "name TEXT NOT NULL DEFAULT '', "
  + "artist TEXT NOT NULL DEFAULT '', "
  + 'updated_at INTEGER NOT NULL DEFAULT 0)');

SCHEMA_STATEMENTS.push(buildCacheTableDdl('assets', ASSET_COLUMNS, [
  "cover_mime TEXT NOT NULL DEFAULT ''",
  'cover_data BLOB',
  'cover_bytes INTEGER NOT NULL DEFAULT 0',
  "extra TEXT NOT NULL DEFAULT ''",
]));
SCHEMA_STATEMENTS.push(buildCacheTableDdl('lyrics', LYRIC_COLUMNS, [
  "path_key TEXT NOT NULL DEFAULT ''",
  "fingerprint TEXT NOT NULL DEFAULT ''",
  'bytes INTEGER NOT NULL DEFAULT 0',
  "extra TEXT NOT NULL DEFAULT ''",
]));

const INDEX_STATEMENTS = [
  'CREATE INDEX IF NOT EXISTS idx_files_root_sort ON files(root_id, sort_index)',
  // 索引回写按「根 + song_key」或「根 + 指纹」定位。单列索引在 `root_id=? AND song_key=?` 下会被
  // 规划器让给 idx_files_root_sort 的 root_id 前缀，退化成整根扫描（实测两万首要 295s），必须用组合索引。
  'CREATE INDEX IF NOT EXISTS idx_files_root_song ON files(root_id, song_key)',
  'CREATE INDEX IF NOT EXISTS idx_files_root_fingerprint ON files(root_id, fingerprint)',
  'DROP INDEX IF EXISTS idx_files_song_key',
  'DROP INDEX IF EXISTS idx_files_fingerprint',
  // seen_at 每次同步都会重写，而清理用的是 `seen_at<>?`（不可走索引），留着只是给每行加一次索引写。
  'DROP INDEX IF EXISTS idx_files_seen',
  'CREATE INDEX IF NOT EXISTS idx_files_path_key ON files(path_key)',
  'CREATE INDEX IF NOT EXISTS idx_files_artist ON files(root_id, artist)',
  'CREATE INDEX IF NOT EXISTS idx_files_album ON files(root_id, album)',
  'CREATE INDEX IF NOT EXISTS idx_files_genre ON files(root_id, genre)',
  'CREATE INDEX IF NOT EXISTS idx_stats_path_key ON song_stats(path_key)',
  'CREATE INDEX IF NOT EXISTS idx_stats_last_played ON song_stats(last_played_at)',
  'CREATE INDEX IF NOT EXISTS idx_stats_favorite ON song_stats(favorite, last_played_at)',
  'CREATE INDEX IF NOT EXISTS idx_assets_saved ON assets(saved_at)',
  'CREATE INDEX IF NOT EXISTS idx_assets_path_key ON assets(path_key)',
  'CREATE INDEX IF NOT EXISTS idx_lyrics_saved ON lyrics(saved_at)',
  'CREATE INDEX IF NOT EXISTS idx_lyrics_path_key ON lyrics(path_key)',
];

const FILE_UPSERT_SQL = (() => {
  const base = ['root_id', 'rel_path', 'path_key', 'fingerprint', 'song_key', 'name', 'ext', 'mime', 'is_audio', 'size', 'mtime', 'sort_index', 'seen_at'];
  const keep = FILE_INDEX_COLUMNS.map((column) => column.name + '=CASE WHEN files.fingerprint=excluded.fingerprint THEN files.'
    + column.name + ' ELSE ' + (column.kind === 'text' ? "''" : '0') + ' END');
  // 指纹是「路径|大小|修改时间」，所以同一条 rel_path 指纹不变即同一份文件：保留已解析元数据，这正是快速启动的来源。
  return 'INSERT INTO files (' + base.join(', ') + ') VALUES (' + base.map(() => '?').join(', ') + ') '
    + 'ON CONFLICT(root_id, rel_path) DO UPDATE SET '
    + ['path_key=excluded.path_key', 'song_key=excluded.song_key', 'name=excluded.name', 'ext=excluded.ext',
      'mime=excluded.mime', 'is_audio=excluded.is_audio', 'size=excluded.size', 'mtime=excluded.mtime',
      'sort_index=excluded.sort_index', 'seen_at=excluded.seen_at'].concat(keep, ['fingerprint=excluded.fingerprint']).join(', ');
})();

// 定位条件拆成两条独立语句：`song_key=? OR fingerprint=?` 写在一句里会让 SQLite 放弃
// idx_files_song_key / idx_files_fingerprint 改走整表扫描，几万首歌时每条索引记录都要扫一遍全表。
const FILE_INDEX_UPDATE_SET_SQL = 'UPDATE files SET song_key=?, '
  + FILE_INDEX_COLUMNS.map((column) => column.name + '=?').join(', ');
const FILE_INDEX_UPDATE_BY_SONG_SQL = FILE_INDEX_UPDATE_SET_SQL + ' WHERE root_id=? AND song_key=?';
const FILE_INDEX_UPDATE_BY_FINGERPRINT_SQL = FILE_INDEX_UPDATE_SET_SQL + ' WHERE root_id=? AND fingerprint=?';

const FILE_SELECT_SQL = 'SELECT rel_path, path_key, fingerprint, song_key, name, ext, mime, is_audio, size, mtime, '
  + FILE_INDEX_COLUMNS.map((column) => column.name).join(', ')
  + ' FROM files WHERE root_id=? ORDER BY sort_index ASC, id ASC';

/**
 * 让出一次事件循环。大曲库同步分批提交，批间让出避免主进程长时间不响应 IPC。
 * @returns {Promise<void>} 下一轮 tick。
 */
function yieldStoreTurn() {
  return new Promise((resolve) => setImmediate(resolve));
}

/**
 * 创建本地曲库 SQLite 存储。任何一步失败都只把本层标成不可用，绝不向上抛。
 * @param {{filePath?:string, directory?:string}} options 数据库位置。
 * @returns {object} 存储句柄。
 */
function createLocalLibraryStore(options) {
  const opts = options || {};
  const sqlite = loadSqliteModule();
  const dbPath = toText(opts.filePath) || path.join(toText(opts.directory) || process.cwd(), LOCAL_LIBRARY_DB_FILE_NAME);
  const statementCache = new Map();
  let db = null;
  let openError = sqlite ? '' : 'SQLITE_UNAVAILABLE';
  let closed = false;

  /**
   * 打开并迁移数据库。首次调用建表建索引，之后只复用同一连接。
   * @returns {object|null} 数据库连接，或不可用时的 null。
   */
  function ensureOpen() {
    if (db || closed || !sqlite) return db;
    try {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
      const handle = new sqlite.DatabaseSync(dbPath);
      handle.exec('PRAGMA journal_mode = WAL');
      handle.exec('PRAGMA synchronous = NORMAL');
      handle.exec('PRAGMA temp_store = MEMORY');
      const version = toInt((handle.prepare('PRAGMA user_version').get() || {}).user_version);
      for (const statement of SCHEMA_STATEMENTS) handle.exec(statement);
      for (const statement of INDEX_STATEMENTS) handle.exec(statement);
      if (version !== LOCAL_LIBRARY_DB_SCHEMA_VERSION) handle.exec('PRAGMA user_version = ' + LOCAL_LIBRARY_DB_SCHEMA_VERSION);
      db = handle;
      openError = '';
    } catch (e) {
      db = null;
      openError = (e && e.code) || (e && e.message) || 'SQLITE_OPEN_FAILED';
    }
    return db;
  }

  /**
   * 取缓存的 prepared statement。曲库同步会重复执行同一条语句几万次，每次重新 prepare 会白烧 CPU。
   * @param {string} sql SQL 语句。
   * @returns {object|null} StatementSync，或不可用时的 null。
   */
  function prepare(sql) {
    const handle = ensureOpen();
    if (!handle) return null;
    let statement = statementCache.get(sql);
    if (!statement) {
      statement = handle.prepare(sql);
      statementCache.set(sql, statement);
    }
    return statement;
  }

  /**
   * 在事务中执行一段写入；失败回滚并返回 null，不让半写状态留在库里。
   * @param {Function} run 事务体。
   * @returns {*} 事务体返回值，或失败时的 null。
   */
  function inTransaction(run) {
    const handle = ensureOpen();
    if (!handle) return null;
    handle.exec('BEGIN IMMEDIATE');
    try {
      const result = run(handle);
      handle.exec('COMMIT');
      return result;
    } catch (e) {
      try { handle.exec('ROLLBACK'); } catch (_e) {}
      openError = (e && e.message) || 'SQLITE_WRITE_FAILED';
      return null;
    }
  }

  /**
   * 关闭连接并清空 statement 缓存，退出前调用避免 WAL 残留。
   * @returns {void}
   */
  function close() {
    closed = true;
    statementCache.clear();
    if (!db) return;
    try { db.close(); } catch (_e) {}
    db = null;
  }

  /**
   * 读取曲库根记录行。
   * @param {string} folderPath 曲库根路径。
   * @returns {object|null} roots 表行。
   */
  function findRootRow(folderPath) {
    const statement = prepare('SELECT id, folder_path, path_key, signature, scan_mode, truncated, file_count, audio_count, dir_count, saved_at, index_saved_at FROM roots WHERE folder_path=?');
    if (!statement) return null;
    return statement.get(toText(folderPath)) || null;
  }

  /**
   * 取或建曲库根记录，返回其自增 id。
   * @param {string} folderPath 曲库根路径。
   * @returns {number} rootId，失败时为 0。
   */
  function ensureRootId(folderPath) {
    const existing = findRootRow(folderPath);
    if (existing) return toInt(existing.id);
    const insert = prepare('INSERT INTO roots (folder_path, path_key, saved_at) VALUES (?, ?, ?) ON CONFLICT(folder_path) DO NOTHING');
    if (!insert) return 0;
    try {
      insert.run(toText(folderPath), normalizeStorePathKey(folderPath), Date.now());
    } catch (e) {
      openError = (e && e.message) || 'LOCAL_LIBRARY_DB_ROOT_FAILED';
      return 0;
    }
    const row = findRootRow(folderPath);
    return row ? toInt(row.id) : 0;
  }

  /**
   * 写入目录 mtime 表。目录没有可复用的解析结果，整根重写比逐条比对更简单也更快。
   * @param {number} rootId 曲库根 id。
   * @param {Array<object>} directories 目录条目。
   * @returns {number} 写入条数。
   */
  function replaceDirectories(rootId, directories) {
    const result = inTransaction(() => {
      const remove = prepare('DELETE FROM dirs WHERE root_id=?');
      const insert = prepare('INSERT INTO dirs (root_id, rel_path, mtime, sort_index) VALUES (?, ?, ?, ?) '
        + 'ON CONFLICT(root_id, rel_path) DO UPDATE SET mtime=excluded.mtime, sort_index=excluded.sort_index');
      if (!remove || !insert) return 0;
      remove.run(rootId);
      let count = 0;
      for (let i = 0; i < directories.length; i += 1) {
        const dir = directories[i];
        if (!dir) continue;
        insert.run(rootId, toText(dir.rel), toInt(dir.mtime), i);
        count += 1;
      }
      return count;
    });
    return toInt(result);
  }

  /**
   * 同步一次扫描结果。分批提交并在批间让出事件循环，几万条写入不会卡住主进程 IPC。
   * 指纹未变的行保留已解析元数据；未被本次扫描标记的行按删除清理（截断扫描不清理，避免把没遍历到的文件当成删除）。
   * @param {object} payload 归一化后的扫描结果。
   * @returns {Promise<object>} 同步统计。
   */
  async function syncRoot(payload) {
    const input = payload || {};
    const folderPath = toText(input.folderPath);
    if (!folderPath) return { ok: false, error: 'LOCAL_LIBRARY_DB_ROOT_REQUIRED' };
    if (!ensureOpen()) return { ok: false, error: openError || 'SQLITE_UNAVAILABLE' };
    const files = Array.isArray(input.files) ? input.files : [];
    const directories = Array.isArray(input.directories) ? input.directories : [];
    const truncated = !!input.truncated;
    const savedAt = Date.now();
    const rootId = ensureRootId(folderPath);
    if (!rootId) return { ok: false, error: openError || 'LOCAL_LIBRARY_DB_ROOT_FAILED' };
    let stored = 0;
    let audio = 0;
    let totalSize = 0;
    let maxMtime = 0;
    for (let start = 0; start < files.length; start += LOCAL_LIBRARY_SYNC_BATCH_SIZE) {
      const end = Math.min(files.length, start + LOCAL_LIBRARY_SYNC_BATCH_SIZE);
      const written = inTransaction(() => {
        const upsert = prepare(FILE_UPSERT_SQL);
        if (!upsert) return null;
        let count = 0;
        for (let i = start; i < end; i += 1) {
          const entry = files[i];
          if (!entry) continue;
          const rel = toText(entry.rel);
          if (!rel) continue;
          const pathKey = normalizeStorePathKey(entry.pathKey || rel);
          const size = toInt(entry.size);
          const mtime = toInt(entry.mtime);
          upsert.run(rootId, rel, pathKey, makeStoreFingerprint(pathKey, size, mtime), toText(entry.songKey),
            toText(entry.name), toText(entry.ext), toText(entry.mime), toFlag(entry.isAudio), size, mtime, i, savedAt);
          count += 1;
          if (entry.isAudio) audio += 1;
          totalSize += size;
          if (mtime > maxMtime) maxMtime = mtime;
        }
        return count;
      });
      if (written == null) return { ok: false, error: openError || 'LOCAL_LIBRARY_DB_SYNC_FAILED' };
      stored += written;
      if (end < files.length) await yieldStoreTurn();
    }

    const dirCount = replaceDirectories(rootId, directories);
    let removed = 0;
    if (!truncated && stored) {
      const pruned = inTransaction(() => {
        const remove = prepare('DELETE FROM files WHERE root_id=? AND seen_at<>?');
        return remove ? toInt(remove.run(rootId, savedAt).changes) : 0;
      });
      removed = toInt(pruned);
    }
    const signature = stored + '|' + audio + '|' + totalSize + '|' + maxMtime;
    inTransaction(() => {
      const update = prepare('UPDATE roots SET path_key=?, signature=?, scan_mode=?, truncated=?, file_count=?, audio_count=?, dir_count=?, saved_at=? WHERE id=?');
      if (update) {
        update.run(normalizeStorePathKey(folderPath), signature, toText(input.scanMode), toFlag(truncated),
          stored, audio, dirCount, savedAt, rootId);
      }
      return true;
    });
    return {
      ok: true,
      rootId: rootId,
      folderPath: folderPath,
      total: stored,
      audio: audio,
      directories: dirCount,
      removed: removed,
      truncated: truncated,
      signature: signature,
      savedAt: savedAt,
    };
  }

  /**
   * 读取整根曲库。按 sort_index 有序返回原始行，调用方一次遍历即可同时组出快照与索引。
   * @param {string} folderPath 曲库根路径。
   * @returns {object} 曲库行与根信息。
   */
  function loadRoot(folderPath) {
    if (!ensureOpen()) return { ok: false, error: openError || 'SQLITE_UNAVAILABLE' };
    const row = findRootRow(folderPath);
    if (!row) return { ok: false, error: 'LOCAL_LIBRARY_DB_ROOT_MISSING' };
    const rootId = toInt(row.id);
    const select = prepare(FILE_SELECT_SQL);
    const dirSelect = prepare('SELECT rel_path, mtime FROM dirs WHERE root_id=? ORDER BY sort_index ASC');
    if (!select || !dirSelect) return { ok: false, error: openError || 'SQLITE_UNAVAILABLE' };
    return {
      ok: true,
      rootId: rootId,
      folderPath: toText(row.folder_path),
      savedAt: toInt(row.saved_at),
      indexSavedAt: toInt(row.index_saved_at),
      scanSignature: toText(row.signature),
      scanMode: toText(row.scan_mode),
      truncated: !!toInt(row.truncated),
      fileCount: toInt(row.file_count),
      audioCount: toInt(row.audio_count),
      files: select.all(rootId) || [],
      directories: dirSelect.all(rootId) || [],
    };
  }

  /**
   * 落盘曲库索引记录。渲染层只推送变化过的记录，这里按 song_key 或指纹定位单行更新，
   * 不再像旧路径那样每次改一首歌就把整包索引 JSON 重写一遍。
   * @param {string} folderPath 曲库根路径。
   * @param {Array<object>} records 渲染层索引记录。
   * @returns {object} 写入统计。
   */
  function saveIndexRecords(folderPath, records) {
    const list = Array.isArray(records) ? records : [];
    if (!list.length) return { ok: true, saved: 0, missed: 0 };
    if (!ensureOpen()) return { ok: false, error: openError || 'SQLITE_UNAVAILABLE' };
    const rootId = ensureRootId(folderPath);
    if (!rootId) return { ok: false, error: openError || 'LOCAL_LIBRARY_DB_ROOT_FAILED' };
    const savedAt = Date.now();
    let missed = 0;
    const saved = inTransaction(() => {
      const bySong = prepare(FILE_INDEX_UPDATE_BY_SONG_SQL);
      const byFingerprint = prepare(FILE_INDEX_UPDATE_BY_FINGERPRINT_SQL);
      const touch = prepare('UPDATE roots SET index_saved_at=? WHERE id=?');
      if (!bySong || !byFingerprint || !touch) return null;
      let count = 0;
      for (const record of list) {
        if (!record) continue;
        const songKey = toText(record.key);
        const pathKey = normalizeStorePathKey(record.pathKey || record.fullPath || record.path);
        const fingerprint = toText(record.fileSignature) || makeStoreFingerprint(pathKey, record.size, record.mtime);
        if (!songKey && !fingerprint) continue;
        const params = [songKey];
        for (const column of FILE_INDEX_COLUMNS) params.push(columnValue(column.kind, record[column.field]));
        let changed = 0;
        if (songKey) changed = toInt(bySong.run(...params, rootId, songKey).changes);
        if (!changed && fingerprint) changed = toInt(byFingerprint.run(...params, rootId, fingerprint).changes);
        if (changed) count += 1;
        else missed += 1;
      }
      touch.run(savedAt, rootId);
      return count;
    });
    if (saved == null) return { ok: false, error: openError || 'LOCAL_LIBRARY_DB_INDEX_FAILED' };
    return { ok: true, saved: saved, missed: missed, savedAt: savedAt };
  }

  /**
   * 清空一个曲库根的全部行；换库或用户主动清理时调用。
   * @param {string} folderPath 曲库根路径。
   * @returns {object} 清理结果。
   */
  function clearRoot(folderPath) {
    if (!ensureOpen()) return { ok: false, error: openError || 'SQLITE_UNAVAILABLE' };
    const row = findRootRow(folderPath);
    if (!row) return { ok: true, removed: 0 };
    const rootId = toInt(row.id);
    const removed = inTransaction(() => {
      const files = prepare('DELETE FROM files WHERE root_id=?');
      const dirs = prepare('DELETE FROM dirs WHERE root_id=?');
      const root = prepare('DELETE FROM roots WHERE id=?');
      if (!files || !dirs || !root) return null;
      const count = toInt(files.run(rootId).changes);
      dirs.run(rootId);
      root.run(rootId);
      return count;
    });
    if (removed == null) return { ok: false, error: openError || 'LOCAL_LIBRARY_DB_CLEAR_FAILED' };
    return { ok: true, removed: removed };
  }

  /**
   * 读取封面缓存记录。逐键走主键点查，语句只 prepare 一次，读取批量大小不会撑大语句缓存。
   * @param {Array<string>} keys 歌曲缓存键。
   * @returns {object} 以缓存键为索引的记录表。
   */
  function readAssetRecords(keys) {
    if (!ensureOpen()) return { ok: false, error: openError || 'SQLITE_UNAVAILABLE' };
    const statement = prepare('SELECT song_key, ' + ASSET_COLUMNS.map((column) => column.name).join(', ')
      + ', cover_mime, cover_data, extra FROM assets WHERE song_key=?');
    if (!statement) return { ok: false, error: openError || 'SQLITE_UNAVAILABLE' };
    const records = {};
    for (const rawKey of keys || []) {
      const key = toText(rawKey);
      if (!key || records[key]) continue;
      const row = statement.get(key);
      if (!row) continue;
      const record = { id: key };
      for (const column of ASSET_COLUMNS) record[column.field] = recordValueFromColumn(column, row[column.name]);
      record.localCoverThumbDataUrl = joinCoverDataUrl(row.cover_mime, row.cover_data);
      record.localCoverDataUrl = '';
      mergeExtraFields(record, row.extra);
      records[key] = record;
    }
    return { ok: true, records: records };
  }

  /**
   * 写入封面缓存记录。封面以 BLOB 落盘，不再按 base64 文本存，磁盘占用少三分之一。
   * @param {object} record 渲染层资产缓存记录。
   * @returns {object} 写入结果。
   */
  function writeAssetRecord(record) {
    const songKey = record ? toText(record.id) : '';
    if (!songKey) return { ok: false, error: 'LOCAL_LIBRARY_DB_KEY_REQUIRED' };
    if (!ensureOpen()) return { ok: false, error: openError || 'SQLITE_UNAVAILABLE' };
    const cover = splitCoverDataUrl(record.localCoverThumbDataUrl);
    const params = [songKey];
    for (const column of ASSET_COLUMNS) params.push(columnValue(column.kind, record[column.field]));
    params.push(toText(cover.mime), cover.bytes && cover.bytes.length ? cover.bytes : null,
      cover.bytes ? cover.bytes.length : 0, collectExtraFields(record, ASSET_COLUMNS, ASSET_RESERVED_FIELDS));
    const done = inTransaction(() => {
      const upsert = prepare(ASSET_UPSERT_SQL);
      if (!upsert) return null;
      upsert.run(...params);
      return true;
    });
    if (!done) return { ok: false, error: openError || 'LOCAL_LIBRARY_DB_ASSET_FAILED' };
    return { ok: true };
  }

  /**
   * 读取歌词缓存记录。
   * @param {Array<string>} keys 歌曲缓存键。
   * @returns {object} 以缓存键为索引的歌词记录表。
   */
  function readLyricRecords(keys) {
    if (!ensureOpen()) return { ok: false, error: openError || 'SQLITE_UNAVAILABLE' };
    const statement = prepare('SELECT song_key, ' + LYRIC_COLUMNS.map((column) => column.name).join(', ')
      + ', extra FROM lyrics WHERE song_key=?');
    if (!statement) return { ok: false, error: openError || 'SQLITE_UNAVAILABLE' };
    const records = {};
    for (const rawKey of keys || []) {
      const key = toText(rawKey);
      if (!key || records[key]) continue;
      const row = statement.get(key);
      if (!row) continue;
      const record = { id: key };
      for (const column of LYRIC_COLUMNS) record[column.field] = recordValueFromColumn(column, row[column.name]);
      mergeExtraFields(record, row.extra);
      records[key] = record;
    }
    return { ok: true, records: records };
  }

  /**
   * 写入歌词缓存记录。
   * @param {object} record 渲染层歌词缓存记录。
   * @returns {object} 写入结果。
   */
  function writeLyricRecord(record) {
    const songKey = record ? toText(record.id) : '';
    if (!songKey) return { ok: false, error: 'LOCAL_LIBRARY_DB_KEY_REQUIRED' };
    if (!ensureOpen()) return { ok: false, error: openError || 'SQLITE_UNAVAILABLE' };
    const text = toText(record.localLyricText);
    const params = [songKey];
    for (const column of LYRIC_COLUMNS) params.push(columnValue(column.kind, record[column.field]));
    params.push(normalizeStorePathKey(record.localLibraryPathKey), toText(record.localLibraryFileSignature),
      Buffer.byteLength(text, 'utf8'), collectExtraFields(record, LYRIC_COLUMNS, LYRIC_RESERVED_FIELDS));
    const done = inTransaction(() => {
      const upsert = prepare(LYRIC_UPSERT_SQL);
      if (!upsert) return null;
      upsert.run(...params);
      return true;
    });
    if (!done) return { ok: false, error: openError || 'LOCAL_LIBRARY_DB_LYRIC_FAILED' };
    return { ok: true };
  }

  /**
   * 累加播放次数与最近播放时间。播放统计按 song_key 独立存活，重扫或换库都不清零。
   * @param {object} payload 播放结算负载。
   * @returns {object} 累加后的统计行。
   */
  function bumpPlayStat(payload) {
    const input = payload || {};
    const songKey = toText(input.key);
    if (!songKey) return { ok: false, error: 'LOCAL_LIBRARY_DB_KEY_REQUIRED' };
    if (!ensureOpen()) return { ok: false, error: openError || 'SQLITE_UNAVAILABLE' };
    const plays = Math.max(0, toInt(input.plays));
    const listenMs = Math.max(0, toInt(input.listenMs));
    const completed = Math.max(0, toInt(input.completed));
    const lastPlayedAt = toInt(input.lastPlayedAt) || Date.now();
    const done = inTransaction(() => {
      const upsert = prepare('INSERT INTO song_stats (song_key, path_key, play_count, listen_ms, completed, last_played_at, name, artist, updated_at) '
        + 'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(song_key) DO UPDATE SET '
        + 'path_key=CASE WHEN excluded.path_key<>\'\' THEN excluded.path_key ELSE song_stats.path_key END, '
        + 'play_count=song_stats.play_count+excluded.play_count, '
        + 'listen_ms=song_stats.listen_ms+excluded.listen_ms, '
        + 'completed=song_stats.completed+excluded.completed, '
        + 'last_played_at=MAX(song_stats.last_played_at, excluded.last_played_at), '
        + 'name=CASE WHEN excluded.name<>\'\' THEN excluded.name ELSE song_stats.name END, '
        + 'artist=CASE WHEN excluded.artist<>\'\' THEN excluded.artist ELSE song_stats.artist END, '
        + 'updated_at=excluded.updated_at');
      if (!upsert) return null;
      upsert.run(songKey, normalizeStorePathKey(input.pathKey), plays, listenMs, completed, lastPlayedAt,
        toText(input.name), toText(input.artist), Date.now());
      return true;
    });
    if (!done) return { ok: false, error: openError || 'LOCAL_LIBRARY_DB_STAT_FAILED' };
    return { ok: true, stat: readSongStat(songKey) };
  }

  /**
   * 写入收藏状态。
   * @param {object} payload 收藏负载。
   * @returns {object} 写入后的统计行。
   */
  function setFavorite(payload) {
    const input = payload || {};
    const songKey = toText(input.key);
    if (!songKey) return { ok: false, error: 'LOCAL_LIBRARY_DB_KEY_REQUIRED' };
    if (!ensureOpen()) return { ok: false, error: openError || 'SQLITE_UNAVAILABLE' };
    const favorite = toFlag(input.favorite);
    const now = Date.now();
    const done = inTransaction(() => {
      const upsert = prepare('INSERT INTO song_stats (song_key, path_key, favorite, favorite_at, name, artist, updated_at) '
        + 'VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(song_key) DO UPDATE SET '
        + 'path_key=CASE WHEN excluded.path_key<>\'\' THEN excluded.path_key ELSE song_stats.path_key END, '
        + 'favorite=excluded.favorite, favorite_at=excluded.favorite_at, '
        + 'name=CASE WHEN excluded.name<>\'\' THEN excluded.name ELSE song_stats.name END, '
        + 'artist=CASE WHEN excluded.artist<>\'\' THEN excluded.artist ELSE song_stats.artist END, '
        + 'updated_at=excluded.updated_at');
      if (!upsert) return null;
      upsert.run(songKey, normalizeStorePathKey(input.pathKey), favorite, favorite ? now : 0,
        toText(input.name), toText(input.artist), now);
      return true;
    });
    if (!done) return { ok: false, error: openError || 'LOCAL_LIBRARY_DB_STAT_FAILED' };
    return { ok: true, stat: readSongStat(songKey) };
  }

  /**
   * 读取单曲播放统计。
   * @param {string} songKey 歌曲键。
   * @returns {object|null} 统计快照。
   */
  function readSongStat(songKey) {
    const statement = prepare('SELECT song_key, path_key, play_count, listen_ms, completed, last_played_at, favorite, favorite_at, name, artist, updated_at FROM song_stats WHERE song_key=?');
    if (!statement) return null;
    const row = statement.get(toText(songKey));
    if (!row) return null;
    return {
      key: toText(row.song_key),
      pathKey: toText(row.path_key),
      plays: toInt(row.play_count),
      listenMs: toInt(row.listen_ms),
      completed: toInt(row.completed),
      lastPlayedAt: toInt(row.last_played_at),
      favorite: !!toInt(row.favorite),
      favoriteAt: toInt(row.favorite_at),
      name: toText(row.name),
      artist: toText(row.artist),
      updatedAt: toInt(row.updated_at),
    };
  }

  /**
   * 批量读取播放统计。启动恢复时一次性取回播放次数 / 最近播放 / 收藏状态。
   * @param {{keys?:Array<string>, limit?:number}} payload 读取范围。
   * @returns {object} 统计表。
   */
  function readStats(payload) {
    if (!ensureOpen()) return { ok: false, error: openError || 'SQLITE_UNAVAILABLE' };
    const input = payload || {};
    const keys = Array.isArray(input.keys) ? input.keys : null;
    const stats = {};
    if (keys) {
      for (const key of keys) {
        const stat = readSongStat(key);
        if (stat) stats[stat.key] = stat;
      }
      return { ok: true, stats: stats };
    }
    const limit = Math.max(1, Math.min(200000, toInt(input.limit) || 100000));
    const statement = prepare('SELECT song_key, path_key, play_count, listen_ms, completed, last_played_at, favorite, favorite_at, name, artist, updated_at '
      + 'FROM song_stats ORDER BY last_played_at DESC LIMIT ?');
    if (!statement) return { ok: false, error: openError || 'SQLITE_UNAVAILABLE' };
    for (const row of statement.all(limit) || []) {
      stats[toText(row.song_key)] = {
        key: toText(row.song_key),
        pathKey: toText(row.path_key),
        plays: toInt(row.play_count),
        listenMs: toInt(row.listen_ms),
        completed: toInt(row.completed),
        lastPlayedAt: toInt(row.last_played_at),
        favorite: !!toInt(row.favorite),
        favoriteAt: toInt(row.favorite_at),
        name: toText(row.name),
        artist: toText(row.artist),
        updatedAt: toInt(row.updated_at),
      };
    }
    return { ok: true, stats: stats };
  }

  /**
   * 回收封面与歌词缓存。受保护键先把 saved_at 顶到当前时间，随后按 LRU 删除，
   * 因此正在播放的曲目不会被自己触发的这次回收清掉。
   * @param {object} payload 回收上限。
   * @returns {object} 回收统计。
   */
  function trim(payload) {
    const input = payload || {};
    if (!ensureOpen()) return { ok: false, error: openError || 'SQLITE_UNAVAILABLE' };
    const now = Date.now();
    const maxAge = Math.max(0, toInt(input.maxAgeMs) || LOCAL_LIBRARY_CACHE_MAX_AGE_MS);
    const assetMaxRecords = Math.max(1, toInt(input.assetMaxRecords) || LOCAL_LIBRARY_ASSET_MAX_RECORDS);
    const assetMaxBytes = Math.max(1, toInt(input.assetMaxBytes) || LOCAL_LIBRARY_ASSET_MAX_BYTES);
    const lyricMaxRecords = Math.max(1, toInt(input.lyricMaxRecords) || LOCAL_LIBRARY_LYRIC_MAX_RECORDS);
    const protectedKeys = Array.isArray(input.protectedKeys) ? input.protectedKeys : [];
    const result = inTransaction(() => {
      const touchAsset = prepare('UPDATE assets SET saved_at=? WHERE song_key=?');
      const touchLyric = prepare('UPDATE lyrics SET saved_at=? WHERE song_key=?');
      if (!touchAsset || !touchLyric) return null;
      for (const rawKey of protectedKeys) {
        const key = toText(rawKey);
        if (!key) continue;
        touchAsset.run(now, key);
        touchLyric.run(now, key);
      }
      let assets = 0;
      let lyrics = 0;
      const expire = now - maxAge;
      assets += toInt(prepare('DELETE FROM assets WHERE saved_at>0 AND saved_at<?').run(expire).changes);
      lyrics += toInt(prepare('DELETE FROM lyrics WHERE saved_at>0 AND saved_at<?').run(expire).changes);
      assets += toInt(prepare('DELETE FROM assets WHERE song_key IN (SELECT song_key FROM assets ORDER BY saved_at DESC, song_key DESC LIMIT -1 OFFSET ?)')
        .run(assetMaxRecords).changes);
      lyrics += toInt(prepare('DELETE FROM lyrics WHERE song_key IN (SELECT song_key FROM lyrics ORDER BY saved_at DESC, song_key DESC LIMIT -1 OFFSET ?)')
        .run(lyricMaxRecords).changes);
      assets += toInt(prepare('DELETE FROM assets WHERE song_key IN (SELECT song_key FROM (SELECT song_key, '
        + 'SUM(cover_bytes) OVER (ORDER BY saved_at DESC, song_key DESC) AS running FROM assets) WHERE running>?)')
        .run(assetMaxBytes).changes);
      return { assets: assets, lyrics: lyrics };
    });
    if (!result) return { ok: false, error: openError || 'LOCAL_LIBRARY_DB_TRIM_FAILED' };
    return { ok: true, removedAssets: result.assets, removedLyrics: result.lyrics };
  }

  /**
   * 汇报存储状态。渲染层据此决定走 SQLite 还是回落 IndexedDB。
   * @returns {object} 状态快照。
   */
  function getStatus() {
    if (!sqlite) return { ok: false, available: false, supported: false, error: 'SQLITE_UNAVAILABLE', filePath: dbPath };
    if (!ensureOpen()) return { ok: false, available: false, supported: true, error: openError || 'SQLITE_OPEN_FAILED', filePath: dbPath };
    let bytes = 0;
    try {
      bytes = fs.statSync(dbPath).size;
    } catch (_e) {
      bytes = 0;
    }
    /**
     * 取单表行数。
     * @param {string} table 表名。
     * @returns {number} 行数。
     */
    function countOf(table) {
      const statement = prepare('SELECT COUNT(*) AS total FROM ' + table);
      return statement ? toInt((statement.get() || {}).total) : 0;
    }
    return {
      ok: true,
      available: true,
      supported: true,
      filePath: dbPath,
      schema: LOCAL_LIBRARY_DB_SCHEMA_VERSION,
      bytes: bytes,
      roots: countOf('roots'),
      files: countOf('files'),
      assets: countOf('assets'),
      lyrics: countOf('lyrics'),
      stats: countOf('song_stats'),
    };
  }

  return {
    filePath: dbPath,
    isAvailable: () => !!ensureOpen(),
    getStatus: getStatus,
    syncRoot: syncRoot,
    loadRoot: loadRoot,
    saveIndexRecords: saveIndexRecords,
    clearRoot: clearRoot,
    readAssetRecords: readAssetRecords,
    writeAssetRecord: writeAssetRecord,
    readLyricRecords: readLyricRecords,
    writeLyricRecord: writeLyricRecord,
    bumpPlayStat: bumpPlayStat,
    setFavorite: setFavorite,
    readStats: readStats,
    trim: trim,
    close: close,
  };
}

const ASSET_UPSERT_SQL = buildCacheUpsertSql('assets', ASSET_COLUMNS, ['cover_mime', 'cover_data', 'cover_bytes', 'extra']);
const LYRIC_UPSERT_SQL = buildCacheUpsertSql('lyrics', LYRIC_COLUMNS, ['path_key', 'fingerprint', 'bytes', 'extra']);

/**
 * 按列类型把 SQLite 值还原成渲染层记录里的原始类型。
 * @param {object} column 列映射。
 * @param {*} value 数据库值。
 * @returns {string|number|boolean} 记录字段值。
 */
function recordValueFromColumn(column, value) {
  if (column.kind === 'flag') return !!toInt(value);
  if (column.kind === 'real') return toReal(value);
  if (column.kind === 'int') return toInt(value);
  return toText(value);
}

/**
 * 收集列映射之外的字段。将来渲染层给缓存记录加字段时不会静默丢失，round-trip 仍然无损。
 * @param {object} record 渲染层记录。
 * @param {Array<object>} columns 列映射。
 * @param {Set<string>} reserved 已单独处理的字段。
 * @returns {string} extra JSON，无额外字段时为空串。
 */
function collectExtraFields(record, columns, reserved) {
  const known = new Set(reserved);
  for (const column of columns) known.add(column.field);
  let extra = null;
  for (const key of Object.keys(record || {})) {
    if (known.has(key)) continue;
    const value = record[key];
    if (value === undefined || typeof value === 'function') continue;
    if (!extra) extra = {};
    extra[key] = value;
  }
  if (!extra) return '';
  try {
    return JSON.stringify(extra);
  } catch (_e) {
    return '';
  }
}

/**
 * 把 extra JSON 合并回记录；已由列还原的字段不被覆盖。
 * @param {object} record 目标记录。
 * @param {string} extra extra JSON。
 * @returns {void}
 */
function mergeExtraFields(record, extra) {
  const text = toText(extra);
  if (!text) return;
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object') return;
    for (const key of Object.keys(parsed)) {
      if (record[key] === undefined) record[key] = parsed[key];
    }
  } catch (_e) {}
}

/**
 * 由 files 表行组出渲染层曲库索引记录的元数据部分；路径与键由调用方补齐。
 * @param {object} row files 表行。
 * @returns {object} 索引记录草稿。
 */
function buildIndexRecordFromFileRow(row) {
  const record = { schemaVersion: 2 };
  // 身份字段必须一起回吐：渲染层 localLibraryRecordFileSignature / localLibraryRecordPathKey
  // 依赖 key、pathKey、fileSignature、size、mtime 来按路径命中记录，缺一个就退化成整库重解析。
  record.key = toText(row && row.song_key);
  record.pathKey = toText(row && row.path_key);
  record.fileSignature = toText(row && row.fingerprint);
  record.size = toInt(row && row.size);
  record.mtime = toInt(row && row.mtime);
  for (const column of FILE_INDEX_COLUMNS) record[column.field] = recordValueFromColumn(column, row ? row[column.name] : null);
  return record;
}

module.exports = {
  LOCAL_LIBRARY_DB_FILE_NAME,
  LOCAL_LIBRARY_DB_SCHEMA_VERSION,
  ASSET_COLUMNS,
  LYRIC_COLUMNS,
  FILE_INDEX_COLUMNS,
  isLocalLibraryStoreSupported,
  createLocalLibraryStore,
  buildIndexRecordFromFileRow,
  normalizeStorePathKey,
  makeStoreFingerprint,
  splitCoverDataUrl,
  joinCoverDataUrl,
};
