'use strict';

const fs = require('fs');
const path = require('path');

const SPECIAL_LIKED_PLAYLIST_KEY = 'mineradio-special-liked-playlist-v1';
const LOCAL_PLAYLISTS_KEY = 'mineradio-local-playlists-v1';
const PLAYBACK_SESSION_KEY = 'mineradio-playback-session-v1';
const STORAGE_MIGRATION_PATH = '/__mineradio_profile_state_migration__';
const LEVELDB_SCAN_FILE_LIMIT = 32 * 1024 * 1024;
const LEVELDB_SCAN_TOTAL_LIMIT = 64 * 1024 * 1024;

function readJsonFile(filePath, fallback) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) || fallback;
  } catch (_e) {
    return fallback;
  }
}

function readProfileUiState(userDataPath) {
  const data = readJsonFile(path.join(String(userDataPath || ''), 'desktop-ui-state.json'), null);
  return {
    values: data && data.values && typeof data.values === 'object' ? data.values : {},
    updatedAt: Number(data && data.updatedAt) || 0,
  };
}

function profileModifiedAt(userDataPath, sessionDataPath) {
  let modifiedAt = readProfileUiState(userDataPath).updatedAt;
  const candidates = [
    path.join(String(userDataPath || ''), 'desktop-ui-state.json'),
    path.join(String(sessionDataPath || ''), 'Local Storage', 'leveldb'),
    path.join(String(sessionDataPath || ''), 'IndexedDB'),
  ];
  for (const candidate of candidates) {
    try {
      const stat = fs.statSync(candidate);
      modifiedAt = Math.max(modifiedAt, Number(stat.mtimeMs) || 0);
      if (!stat.isDirectory()) continue;
      const entries = fs.readdirSync(candidate, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const childStat = fs.statSync(path.join(candidate, entry.name));
        modifiedAt = Math.max(modifiedAt, Number(childStat.mtimeMs) || 0);
      }
    } catch (_e) {}
  }
  return modifiedAt;
}

function normalizedProfilePath(value) {
  const raw = String(value || '');
  if (!raw) return '';
  try {
    return path.resolve(raw).toLowerCase();
  } catch (_e) {
    return '';
  }
}

function isProfileMigrationMarkerCurrent(marker, profiles) {
  if (!marker || marker.schema !== 2 || !marker.completedAt || !Array.isArray(marker.sources)) return false;
  const recordedSources = new Map();
  for (const source of marker.sources) {
    if (!source || typeof source !== 'object') continue;
    const identity = normalizedProfilePath(source.userDataPath);
    if (!identity) continue;
    recordedSources.set(identity, Number(source.modifiedAt) || 0);
  }
  for (const profile of profiles || []) {
    if (!profile || typeof profile !== 'object') return false;
    const identity = normalizedProfilePath(profile.userDataPath);
    if (!identity || !recordedSources.has(identity)) return false;
    const recordedModifiedAt = recordedSources.get(identity);
    const currentModifiedAt = profileModifiedAt(profile.userDataPath, profile.sessionDataPath);
    if (currentModifiedAt > recordedModifiedAt) return false;
  }
  return true;
}

function scanLocalStorageLevelDb(sessionDataPath, inspect) {
  const levelDbPath = path.join(String(sessionDataPath || ''), 'Local Storage', 'leveldb');
  try {
    const entries = fs.readdirSync(levelDbPath, { withFileTypes: true });
    let remainingBytes = LEVELDB_SCAN_TOTAL_LIMIT;
    for (const entry of entries) {
      if (!entry.isFile() || remainingBytes <= 0) continue;
      if (!/\.(?:log|ldb)$/i.test(entry.name) && !/^MANIFEST-/i.test(entry.name)) continue;
      const filePath = path.join(levelDbPath, entry.name);
      const stat = fs.statSync(filePath);
      if (stat.size <= 0 || stat.size > LEVELDB_SCAN_FILE_LIMIT) continue;
      const size = Math.min(stat.size, remainingBytes);
      const buffer = Buffer.allocUnsafe(size);
      const handle = fs.openSync(filePath, 'r');
      try {
        const read = fs.readSync(handle, buffer, 0, size, 0);
        inspect(buffer.toString('latin1', 0, read));
        remainingBytes -= read;
      } finally {
        fs.closeSync(handle);
      }
    }
  } catch (_e) {}
}

function discoverLocalStorageOrigins(sessionDataPath) {
  const origins = new Set();
  scanLocalStorageLevelDb(sessionDataPath, (text) => {
    const pattern = /https?:\/\/(?:127\.0\.0\.1|localhost):\d{1,5}/g;
    let match = pattern.exec(text);
    while (match) {
      try {
        const url = new URL(match[0]);
        const port = Number(url.port);
        if (port > 0 && port <= 65535) origins.add(url.origin);
      } catch (_e) {}
      match = pattern.exec(text);
    }
  });
  return Array.from(origins).sort();
}

function copyProfileStorageEntry(sourceRoot, targetRoot, name) {
  const source = path.join(sourceRoot, name);
  if (!fs.existsSync(source)) return false;
  const target = path.join(targetRoot, name);
  const stat = fs.lstatSync(source);
  if (stat.isSymbolicLink()) return false;
  if (stat.isDirectory()) {
    fs.cpSync(source, target, {
      recursive: true,
      force: true,
      dereference: false,
      filter: (sourcePath) => {
        try { return !fs.lstatSync(sourcePath).isSymbolicLink(); }
        catch (_e) { return false; }
      },
    });
    return true;
  }
  if (!stat.isFile()) return false;
  fs.copyFileSync(source, target);
  return true;
}

function stageProfileSessionData(sourceSessionDataPath, stagingRoot, instanceId) {
  const sourceRoot = path.resolve(String(sourceSessionDataPath || ''));
  const targetRoot = path.resolve(String(stagingRoot || ''));
  if (!sourceRoot || !targetRoot || sourceRoot === targetRoot) throw new Error('PROFILE_MIGRATION_STAGE_PATH_INVALID');
  fs.mkdirSync(targetRoot, { recursive: true });
  const safeId = String(instanceId || 'profile').replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 48) || 'profile';
  const stagedPath = fs.mkdtempSync(path.join(targetRoot, `${safeId}-`));
  if (!copyProfileStorageEntry(sourceRoot, stagedPath, 'Local Storage')) {
    throw new Error('PROFILE_MIGRATION_LOCAL_STORAGE_MISSING');
  }
  copyProfileStorageEntry(sourceRoot, stagedPath, 'Local State');
  copyProfileStorageEntry(sourceRoot, stagedPath, 'Preferences');
  return stagedPath;
}

function cleanupProfileSessionStaging(stagingRoot) {
  const targetRoot = path.resolve(String(stagingRoot || ''));
  if (!targetRoot || !fs.existsSync(targetRoot)) return 0;
  let removed = 0;
  for (const entry of fs.readdirSync(targetRoot, { withFileTypes: true })) {
    const target = path.resolve(targetRoot, entry.name);
    if (path.dirname(target).toLowerCase() !== targetRoot.toLowerCase()) continue;
    try {
      fs.rmSync(target, { recursive: true, force: true });
      removed++;
    } catch (_e) {}
  }
  return removed;
}

function normalizedRef(value) {
  const source = typeof value === 'string' ? { key: value } : value;
  if (!source || typeof source !== 'object') return null;
  const key = String(source.key || '').trim();
  const normalizedPath = String(source.path || '').replace(/\\/g, '/').toLowerCase();
  if (!key && !normalizedPath) return null;
  return {
    key,
    path: normalizedPath,
    name: String(source.name || ''),
    artist: String(source.artist || ''),
  };
}

function mergeSongRefs(primary, secondary) {
  const result = [];
  const seen = new Set();
  for (const list of [primary, secondary]) {
    const source = Array.isArray(list) ? list : [];
    for (const value of source) {
      const ref = normalizedRef(value);
      if (!ref) continue;
      const identity = ref.key || ref.path;
      if (seen.has(identity)) continue;
      seen.add(identity);
      result.push(ref);
    }
  }
  return result;
}

function parseArrayValue(value) {
  try {
    const parsed = JSON.parse(String(value || '[]'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (_e) {
    return [];
  }
}

function mergeSpecialLikedValues(baseValue, candidateValue, preferCandidate) {
  const base = parseArrayValue(baseValue);
  const candidate = parseArrayValue(candidateValue);
  return JSON.stringify(preferCandidate
    ? mergeSongRefs(candidate, base)
    : mergeSongRefs(base, candidate));
}

function normalizePlaylist(value) {
  if (!value || typeof value !== 'object') return null;
  const rawId = String(value.id || '').trim();
  const name = String(value.name || '').trim().slice(0, 40);
  if (!rawId || !name) return null;
  return {
    id: rawId.indexOf('local-playlist:') === 0 ? rawId : `local-playlist:${rawId}`,
    name,
    createdAt: Number(value.createdAt) || Date.now(),
    updatedAt: Number(value.updatedAt) || Number(value.createdAt) || Date.now(),
    songRefs: mergeSongRefs(value.songRefs, []),
  };
}

function mergeLocalPlaylistValues(baseValue, candidateValue, preferCandidate) {
  const base = parseArrayValue(baseValue).map(normalizePlaylist).filter(Boolean);
  const candidate = parseArrayValue(candidateValue).map(normalizePlaylist).filter(Boolean);
  const ordered = preferCandidate ? [candidate, base] : [base, candidate];
  const byId = new Map();
  const order = [];
  for (const list of ordered) {
    for (const playlist of list) {
      const existing = byId.get(playlist.id);
      if (!existing) {
        byId.set(playlist.id, playlist);
        order.push(playlist.id);
        continue;
      }
      const newer = playlist.updatedAt > existing.updatedAt ? playlist : existing;
      const older = newer === playlist ? existing : playlist;
      byId.set(playlist.id, {
        id: newer.id,
        name: newer.name,
        createdAt: Math.min(newer.createdAt, older.createdAt),
        updatedAt: Math.max(newer.updatedAt, older.updatedAt),
        songRefs: mergeSongRefs(existing.songRefs, playlist.songRefs),
      });
    }
  }
  return JSON.stringify(order.map(id => byId.get(id)).filter(Boolean));
}

function playbackSessionSavedAt(value) {
  try {
    const parsed = JSON.parse(String(value || 'null'));
    return Number(parsed && parsed.savedAt) || 0;
  } catch (_e) {
    return 0;
  }
}

function mergePersistentUiValues(baseValues, candidateValues, options) {
  const preferCandidate = !!(options && options.preferCandidate);
  const result = { ...(baseValues || {}) };
  const candidate = candidateValues || {};
  for (const key in candidate) {
    if (!Object.prototype.hasOwnProperty.call(candidate, key)) continue;
    const value = candidate[key];
    if (typeof value !== 'string') continue;
    if (key === SPECIAL_LIKED_PLAYLIST_KEY) {
      result[key] = mergeSpecialLikedValues(result[key], value, preferCandidate);
      continue;
    }
    if (key === LOCAL_PLAYLISTS_KEY) {
      result[key] = mergeLocalPlaylistValues(result[key], value, preferCandidate);
      continue;
    }
    if (key === PLAYBACK_SESSION_KEY) {
      if (result[key] == null || playbackSessionSavedAt(value) >= playbackSessionSavedAt(result[key])) result[key] = value;
      continue;
    }
    if (result[key] == null || preferCandidate) result[key] = value;
  }
  return result;
}

function storageProbeHtml() {
  return '<!doctype html><html><head><meta charset="utf-8"><title>Mineradio profile migration</title></head><body></body></html>';
}

async function withStorageProbe(options, callback) {
  const input = options || {};
  const ses = input.session;
  const BrowserWindow = input.BrowserWindow;
  if (!ses || !ses.protocol || !BrowserWindow) throw new Error('PROFILE_MIGRATION_SESSION_UNAVAILABLE');
  if (ses.protocol.isProtocolIntercepted('http')) throw new Error('PROFILE_MIGRATION_HTTP_INTERCEPTED');
  const installed = ses.protocol.interceptStringProtocol('http', (request, done) => {
    try {
      const url = new URL(request.url);
      if ((url.hostname === '127.0.0.1' || url.hostname === 'localhost') && url.pathname === STORAGE_MIGRATION_PATH) {
        done({ data: storageProbeHtml(), mimeType: 'text/html', charset: 'utf-8' });
        return;
      }
    } catch (_e) {}
    done({ statusCode: 404, data: 'Not found', mimeType: 'text/plain', charset: 'utf-8' });
  });
  if (!installed) throw new Error('PROFILE_MIGRATION_INTERCEPT_FAILED');

  const win = new BrowserWindow({
    show: false,
    width: 320,
    height: 180,
    webPreferences: {
      session: ses,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: true,
    },
  });
  try {
    return await callback(win);
  } finally {
    if (!win.isDestroyed()) win.destroy();
    try { ses.protocol.uninterceptProtocol('http'); } catch (_e) {}
  }
}

async function readSessionLocalStorage(options) {
  const input = options || {};
  const keys = Array.isArray(input.keys) ? input.keys.map(String) : [];
  const origins = Array.isArray(input.origins) ? input.origins : [];
  const collected = [];
  if (!keys.length || !origins.length) return collected;
  return withStorageProbe(input, async (win) => {
    for (const origin of origins) {
      try {
        await win.loadURL(`${origin}${STORAGE_MIGRATION_PATH}`);
        const values = await win.webContents.executeJavaScript(`(() => {
          const keys = ${JSON.stringify(keys)};
          const values = {};
          for (const key of keys) {
            const value = localStorage.getItem(key);
            if (value != null) values[key] = value;
          }
          return values;
        })()`, true);
        collected.push({ origin, values: values && typeof values === 'object' ? values : {} });
      } catch (_e) {}
    }
    return collected;
  });
}

async function writeSessionLocalStorage(options) {
  const input = options || {};
  const origin = String(input.origin || '');
  const values = input.values && typeof input.values === 'object' ? input.values : {};
  if (!origin) return false;
  return withStorageProbe(input, async (win) => {
    await win.loadURL(`${origin}${STORAGE_MIGRATION_PATH}`);
    await win.webContents.executeJavaScript(`(() => {
      const values = ${JSON.stringify(values)};
      for (const key in values) {
        if (!Object.prototype.hasOwnProperty.call(values, key)) continue;
        if (typeof values[key] === 'string') localStorage.setItem(key, values[key]);
      }
      return true;
    })()`, true);
    if (input.session && typeof input.session.flushStorageData === 'function') input.session.flushStorageData();
    return true;
  });
}

module.exports = {
  cleanupProfileSessionStaging,
  discoverLocalStorageOrigins,
  isProfileMigrationMarkerCurrent,
  mergePersistentUiValues,
  profileModifiedAt,
  readProfileUiState,
  readSessionLocalStorage,
  stageProfileSessionData,
  writeSessionLocalStorage,
};
