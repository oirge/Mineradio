'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  cleanupProfileSessionStaging,
  discoverLocalStorageOrigins,
  mergePersistentUiValues,
  profileModifiedAt,
  readProfileUiState,
  stageProfileSessionData,
} = require('../desktop/profile-state-migration');

function parse(value) {
  return JSON.parse(value || '[]');
}

test('端口 origin 可从 Chromium Local Storage 文件发现并去重', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mineradio-origin-'));
  try {
    const leveldb = path.join(temp, 'Local Storage', 'leveldb');
    fs.mkdirSync(leveldb, { recursive: true });
    fs.writeFileSync(path.join(leveldb, '000001.log'), '\u0000_http://127.0.0.1:3000\u0000http://localhost:3001/path', 'latin1');
    fs.writeFileSync(path.join(leveldb, '000002.ldb'), 'http://127.0.0.1:3000', 'latin1');

    assert.deepEqual(discoverLocalStorageOrigins(temp), [
      'http://127.0.0.1:3000',
      'http://localhost:3001',
    ]);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('旧 profile Local Storage 先复制到临时目录再由 Electron 读取', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mineradio-stage-'));
  try {
    const source = path.join(temp, 'source');
    const staging = path.join(temp, 'staging');
    fs.mkdirSync(path.join(source, 'Local Storage', 'leveldb'), { recursive: true });
    fs.writeFileSync(path.join(source, 'Local Storage', 'leveldb', '000001.log'), 'playlist-data', 'utf8');
    fs.writeFileSync(path.join(source, 'Local State'), '{}', 'utf8');
    fs.writeFileSync(path.join(source, 'Preferences'), '{}', 'utf8');

    const staged = stageProfileSessionData(source, staging, 'path-test');
    assert.notEqual(staged, source);
    assert.equal(fs.readFileSync(path.join(staged, 'Local Storage', 'leveldb', '000001.log'), 'utf8'), 'playlist-data');
    assert.equal(cleanupProfileSessionStaging(staging), 1);
    assert.equal(fs.readdirSync(staging).length, 0);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('特别喜欢与独立歌单跨 profile 合并时不丢歌曲', () => {
  const base = {
    'mineradio-special-liked-playlist-v1': JSON.stringify([
      { key: 'local-key:a', path: 'd:/music/a.flac', name: 'A' },
    ]),
    'mineradio-local-playlists-v1': JSON.stringify([
      {
        id: 'local-playlist:drive',
        name: '开车',
        createdAt: 10,
        updatedAt: 20,
        songRefs: [{ key: 'local-key:a', path: 'd:/music/a.flac' }],
      },
    ]),
  };
  const candidate = {
    'mineradio-special-liked-playlist-v1': JSON.stringify([
      { key: 'local-key:b', path: 'd:/music/b.flac', name: 'B' },
      { key: 'local-key:a', path: 'd:/music/a.flac', name: 'A' },
    ]),
    'mineradio-local-playlists-v1': JSON.stringify([
      {
        id: 'local-playlist:drive',
        name: '夜路',
        createdAt: 10,
        updatedAt: 40,
        songRefs: [{ key: 'local-key:b', path: 'd:/music/b.flac' }],
      },
      {
        id: 'focus',
        name: '专注',
        createdAt: 30,
        updatedAt: 30,
        songRefs: [{ key: 'local-key:c', path: 'd:/music/c.flac' }],
      },
    ]),
  };

  const merged = mergePersistentUiValues(base, candidate, { preferCandidate: true });
  const liked = parse(merged['mineradio-special-liked-playlist-v1']);
  const playlists = parse(merged['mineradio-local-playlists-v1']);

  assert.deepEqual(liked.map(item => item.key), ['local-key:b', 'local-key:a']);
  assert.equal(playlists.length, 2);
  assert.equal(playlists[0].id, 'local-playlist:drive');
  assert.equal(playlists[0].name, '夜路');
  assert.deepEqual(playlists[0].songRefs.map(item => item.key), ['local-key:b', 'local-key:a']);
  assert.equal(playlists[1].id, 'local-playlist:focus');
});

test('播放会话始终选 savedAt 更新的一份', () => {
  const older = JSON.stringify({ songKey: 'a', savedAt: 100 });
  const newer = JSON.stringify({ songKey: 'b', savedAt: 200 });

  assert.equal(
    mergePersistentUiValues({ 'mineradio-playback-session-v1': newer }, { 'mineradio-playback-session-v1': older }, { preferCandidate: true })['mineradio-playback-session-v1'],
    newer,
  );
  assert.equal(
    mergePersistentUiValues({ 'mineradio-playback-session-v1': older }, { 'mineradio-playback-session-v1': newer }, { preferCandidate: false })['mineradio-playback-session-v1'],
    newer,
  );
});

test('普通设置按 profile 新旧优先级合并', () => {
  const base = { volume: '0.2', folder: 'D:/old' };
  const candidate = { volume: '0.8', mode: 'playlist' };

  assert.deepEqual(mergePersistentUiValues(base, candidate, { preferCandidate: false }), {
    volume: '0.2',
    folder: 'D:/old',
    mode: 'playlist',
  });
  assert.deepEqual(mergePersistentUiValues(base, candidate, { preferCandidate: true }), {
    volume: '0.8',
    folder: 'D:/old',
    mode: 'playlist',
  });
});

test('JSON 状态与 profile 修改时间可作为迁移回退依据', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mineradio-profile-'));
  try {
    const uiFile = path.join(temp, 'desktop-ui-state.json');
    fs.writeFileSync(uiFile, JSON.stringify({ updatedAt: 1234, values: { folder: 'D:/Music' } }), 'utf8');
    const state = readProfileUiState(temp);

    assert.deepEqual(state, { updatedAt: 1234, values: { folder: 'D:/Music' } });
    assert.ok(profileModifiedAt(temp, temp) >= 1234);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('空的新 profile 不得以目录时间压过旧用户状态', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'main.js'), 'utf8');
  assert.match(main, /modifiedAt: Object\.keys\(values\)\.length \? modifiedAt : 0/);
});

test('主进程与 preload 对歌单状态使用同一持久化白名单', () => {
  const root = path.join(__dirname, '..');
  const main = fs.readFileSync(path.join(root, 'desktop', 'main.js'), 'utf8');
  const preload = fs.readFileSync(path.join(root, 'desktop', 'preload.js'), 'utf8');
  for (const key of [
    'mineradio-special-liked-playlist-v1',
    'mineradio-local-playlists-v1',
    'mineradio-local-playback-source-v1',
  ]) {
    assert.match(main, new RegExp(`'${key}'`));
    assert.match(preload, new RegExp(`'${key}'`));
  }
  assert.match(main, /await migratePrimaryProfileState\(port\)/);
});

test('迁移稳态必须跳过隐藏窗口读写，端口变化或旧档待迁移才走完整路径', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'main.js'), 'utf8');
  const fnStart = main.indexOf('async function migratePrimaryProfileState(port)');
  assert.ok(fnStart >= 0, 'migratePrimaryProfileState 必须存在');
  const fnEnd = main.indexOf('\nasync function ', fnStart + 1);
  const fn = main.slice(fnStart, fnEnd > 0 ? fnEnd : undefined);

  // 稳态短路必须先于隐藏窗口的 localStorage 读取。
  const skipAt = fn.indexOf('readLastMigratedUiStateOrigin() === currentOrigin');
  const readAt = fn.indexOf('readProfilePersistentValues(INSTANCE_PROFILE');
  assert.ok(skipAt > 0, '必须有稳态 origin 短路判断');
  assert.ok(readAt > skipAt, '稳态短路必须发生在 readProfilePersistentValues 之前');
  assert.match(fn, /!legacyProfiles\.length && readLastMigratedUiStateOrigin\(\) === currentOrigin/,
    '旧档迁移待办时不得短路，必须走完整迁移');

  // 完整迁移收尾必须记录 origin 标记，供下次启动进入稳态。
  assert.match(fn, /writeLastMigratedUiStateOrigin\(currentOrigin\)/);

  // 短路不得在记录标记之前生效（首次运行必须走一次完整路径建立标记）。
  const markerWriteAt = fn.indexOf('function writeLastMigratedUiStateOrigin');
  assert.equal(markerWriteAt, -1, '标记读写辅助函数必须定义在 migratePrimaryProfileState 之外');
});
