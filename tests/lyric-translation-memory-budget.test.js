'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Exercise cache ownership independently of provider configuration and UI scheduling.
const source = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
const code = source.slice(source.indexOf('function readLyricLlmTranslateCache()'), source.indexOf('function lyricTranslateTargetValue()'));
const clone = value => JSON.parse(JSON.stringify(value));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
async function settle() { for (let i = 0; i < 32; i++) await Promise.resolve(); }
function translations(song, count) {
  const map = {};
  for (let i = 0; i < count; i++) map['English\0' + song + ':' + i] = 'Translated ' + song + ':' + i;
  return { id: song, localLyricText: 'Preserved original lyrics', localLyricTranslations: { v: 1, map } };
}
function cacheClient(options = {}) {
  let current = '', timerId = 0;
  const timers = new Map(), writes = [], reads = [], persisted = [], store = options.store || {};
  const scope = {
    console: { warn() {} },
    window: { desktopWindow: { isDesktop: true } },
    LYRIC_LLM_TRANSLATE_STORE_KEY: 'test-cache', LYRIC_LLM_TRANSLATE_LIMIT: 1200,
    lyricLlmTranslateState: { cache: null, cacheDirty: false }, localLibraryPersistentGeneration: 1,
    currentLyricSong: () => ({ localKey: current }), localAssetCacheKey: song => song?.localKey || '',
    localStorage: { getItem: () => JSON.stringify(options.cache || {}) },
    setPersistentLocalStorageItem: (key, text) => persisted.push(JSON.parse(text)),
    setTimeout: (fn, ms) => { const id = ++timerId; timers.set(id, { fn, ms }); return id; },
    clearTimeout: id => timers.delete(id),
    readLocalLyricCacheRecords: async keys => {
      reads.push(keys[0]);
      if (options.read) return options.read(keys, store);
      return store[keys[0]] ? { [keys[0]]: clone(store[keys[0]]) } : {};
    },
    putLocalLyricCacheRecord: async record => {
      const snapshot = clone(record);
      writes.push(snapshot);
      if (options.put) await options.put(record);
      store[record.id] = snapshot;
      return true;
    }
  };
  vm.runInNewContext(code, scope);
  return { scope, store, timers, writes, reads, persisted,
    setCurrent(key) { current = key; },
    async load(key) { current = key; await scope.loadSongLyricTranslations({ localKey: key }); },
    async fire() {
      const entry = timers.entries().next().value;
      assert.ok(entry, 'A pending write needs a timer');
      timers.delete(entry[0]); entry[1].fn(); await settle();
    },
    switchLibrary(key) { current = key; scope.localLibraryPersistentGeneration++; scope.trimSongLyricTranslationMemory(true); }
  };
}

test('SQLite hydration respects both memory budgets without rewriting localStorage', async () => {
  const store = {};
  for (let i = 0; i < 35; i++) store['song-' + i] = translations('song-' + i, 80);
  const c = cacheClient({ store });
  for (let i = 0; i < 35; i++) await c.load('song-' + i);
  assert.equal(Object.keys(c.scope.readLyricLlmTranslateCache()).length, 1200);
  assert.ok(Object.keys(c.scope.songLyricTranslationState.maps).length <= 24);
  assert.equal(c.persisted.length, 0, 'Disk-backed hydration needs no synchronous localStorage write');
  assert.equal(c.writes.length, 0, 'Eviction must not alter SQLite');
  assert.equal(Object.keys(store).length, 35);
  assert.equal(c.scope.songLyricTranslationState.loaded['song-0'], undefined);
  const readCount = c.reads.length;
  await c.load('song-0');
  assert.equal(c.reads.length, readCount + 1, 'Evicted songs restore on demand');
  assert.equal(c.scope.songLyricTranslationState.maps['song-0']['English\0song-0:0'], 'Translated song-0:0');
});

test('oversized saved global cache is repaired once and uses the existing persistence path', () => {
  const map = translations('saved', 1500).localLyricTranslations.map;
  const c = cacheClient({ cache: map });
  assert.equal(Object.keys(c.scope.readLyricLlmTranslateCache()).length, 1200);
  c.scope.readLyricLlmTranslateCache(); c.scope.persistLyricLlmTranslateCache();
  assert.equal(c.persisted.length, 1);
  assert.equal(Object.keys(c.persisted[0]).length, 1200);
});

test('LRU replay protects recently used songs and bounds total saved lines', async () => {
  const store = {};
  for (let i = 0; i < 15; i++) store['song-' + i] = translations('song-' + i, 200);
  const c = cacheClient({ store });
  for (let i = 0; i < 12; i++) await c.load('song-' + i);
  await c.load('song-0');
  await c.load('song-12');
  assert.ok(c.scope.songLyricTranslationState.maps['song-0']);
  assert.equal(c.scope.songLyricTranslationState.maps['song-1'], undefined);
  assert.equal(Object.values(c.scope.songLyricTranslationState.maps).reduce((sum, map) => sum + Object.keys(map).length, 0), 2400);
});

test('a current song larger than the budget keeps all its translations while inactive maps leave', async () => {
  const c = cacheClient({ store: { old: translations('old', 20), long: translations('long', 3000) } });
  await c.load('old'); await c.load('long');
  assert.deepEqual(Object.keys(c.scope.songLyricTranslationState.maps), ['long']);
  assert.equal(Object.keys(c.scope.songLyricTranslationState.maps.long).length, 3000);
  assert.equal(Object.keys(c.scope.readLyricLlmTranslateCache()).length, 1200);
});

test('library changes retain pending and in-flight writes then release them after successful settlement', async () => {
  const put = deferred();
  const c = cacheClient({ put: () => put.promise });
  c.setCurrent('old');
  c.scope.recordSongLyricTranslation({ localKey: 'old' }, 'English\0old', 'Saved translation');
  c.switchLibrary('new');
  assert.ok(c.scope.songLyricTranslationState.maps.old, 'Pending data survives switching libraries');
  c.scope.flushSongLyricTranslations(); await settle();
  c.scope.trimSongLyricTranslationMemory(true);
  assert.ok(c.scope.songLyricTranslationState.writing.old);
  assert.ok(c.scope.songLyricTranslationState.maps.old, 'In-flight write retains ownership');
  put.resolve(); await settle();
  assert.equal(c.store.old.localLyricTranslations.map['English\0old'], 'Saved translation');
  assert.equal(c.scope.songLyricTranslationState.maps.old, undefined);
  assert.equal(Object.keys(c.scope.songLyricTranslationState.writing).length, 0);
});

test('failed writes exhaust a finite budget and release stale protection without a retry loop', async () => {
  const c = cacheClient({ put: async () => { throw new Error('disk full'); } });
  c.setCurrent('old');
  c.scope.recordSongLyricTranslation({ localKey: 'old' }, 'English\0old', 'Pending translation');
  c.switchLibrary('new');
  for (let i = 0; i < 6; i++) await c.fire();
  assert.equal(c.writes.length, 6, 'One initial write plus five retries');
  assert.equal(c.timers.size, 0);
  assert.equal(c.scope.songLyricTranslationState.maps.old, undefined);
});

test('new translations arriving during a write remain pending and serialize after their owner', async () => {
  const firstPut = deferred(); let puts = 0;
  const c = cacheClient({ put: () => ++puts === 1 ? firstPut.promise : Promise.resolve() });
  c.setCurrent('song');
  c.scope.recordSongLyricTranslation({ localKey: 'song' }, 'English\0first', 'First translation');
  c.scope.flushSongLyricTranslations(); await settle();
  c.scope.recordSongLyricTranslation({ localKey: 'song' }, 'English\0second', 'Second translation');
  c.scope.flushSongLyricTranslations(); await settle();
  assert.equal(c.writes.length, 1, 'The second batch waits for the current writer');
  assert.ok(c.scope.songLyricTranslationState.pending.song);
  firstPut.resolve(); await settle();
  assert.equal(c.store.song.localLyricTranslations.map['English\0second'], undefined);
  await c.fire();
  assert.equal(c.writes.length, 2);
  assert.equal(c.store.song.localLyricTranslations.map['English\0first'], 'First translation');
  assert.equal(c.store.song.localLyricTranslations.map['English\0second'], 'Second translation');
});

test('a late A-to-B-to-A read cannot overwrite its replacement or backfill stale global entries', async () => {
  const oldRead = deferred(); let attempts = 0;
  const c = cacheClient({ read: async keys => {
    attempts++;
    if (attempts === 1) return oldRead.promise;
    return { [keys[0]]: translations('new-A', 1) };
  } });
  c.setCurrent('A');
  const first = c.scope.loadSongLyricTranslations({ localKey: 'A' });
  c.switchLibrary('B'); c.switchLibrary('A');
  await c.load('A');
  oldRead.resolve({ A: translations('old-A', 1) }); await first;
  assert.equal(c.scope.songLyricTranslationState.maps.A['English\0old-A:0'], undefined);
  assert.equal(c.scope.readLyricLlmTranslateCache()['English\0old-A:0'], undefined);
  assert.equal(c.scope.songLyricTranslationState.maps.A['English\0new-A:0'], 'Translated new-A:0');
});

test('a late same-library read for another song leaves the new song cache untouched', async () => {
  const read = deferred();
  const c = cacheClient({ read: () => read.promise });
  c.setCurrent('old');
  const first = c.scope.loadSongLyricTranslations({ localKey: 'old' });
  c.setCurrent('new');
  read.resolve({ old: translations('old', 1) }); await first;
  assert.equal(c.scope.songLyricTranslationState.maps.old, undefined);
  assert.equal(c.scope.readLyricLlmTranslateCache()['English\0old:0'], undefined);
});
