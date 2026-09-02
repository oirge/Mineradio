'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const APP_SOURCE = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');

/**
 * 按字符串边界切出一段真实源码，保证测试跑的是线上那份实现。
 * @param {string} startMarker 起始标记。
 * @param {string} endMarker 结束标记。
 * @returns {string} 源码片段。
 */
function sliceSource(startMarker, endMarker) {
  const start = APP_SOURCE.indexOf(startMarker);
  assert.ok(start > 0, `missing start marker: ${startMarker}`);
  const end = APP_SOURCE.indexOf(endMarker, start);
  assert.ok(end > start, `missing end marker: ${endMarker}`);
  return APP_SOURCE.slice(start, end);
}

const PATH_KEY_SOURCE = sliceSource(
  'function normalizeLocalLibraryPathKey(value) {',
  'function localPathDir(file) {'
);
const AUTO_SYNC_SOURCE = sliceSource(
  'var LOCAL_LIBRARY_WATCH_SYNC_DELAY_MS = 700;',
  'function registerLocalLibraryWatchRoots(folderPath) {'
);
const EXPORTS = [
  'formatLocalLibrarySyncCount',
  'reportLocalLibrarySyncedCount',
  'localLibraryAutoSyncDiff',
  'adoptLocalLibraryAutoSyncSong',
  'applyLocalLibraryAutoSyncDiff',
  'localLibraryWatchRootMatches',
  'localLibraryPathKeyFromSong',
  'localLibraryFileSignatureFromSong',
].map((name) => `this.${name} = ${name};`).join('\n');
/**
 * 最小 DOM 桩。指示器是运行时懒建的，所以测试里只需要 body + getElementById。
 * @returns {object} document 桩。
 */
function createDocumentShim() {
  const registry = new Map();
  function createElement(tag) {
    const classes = new Set();
    const attrs = Object.create(null);
    return {
      tagName: String(tag).toUpperCase(),
      id: '',
      textContent: '',
      parentNode: null,
      classList: {
        add(name) { classes.add(String(name)); },
        remove(name) { classes.delete(String(name)); },
        contains(name) { return classes.has(String(name)); },
      },
      setAttribute(name, value) { attrs[String(name)] = String(value); },
      getAttribute(name) {
        const key = String(name);
        return Object.prototype.hasOwnProperty.call(attrs, key) ? attrs[key] : null;
      },
    };
  }
  const body = createElement('body');
  body.children = [];
  body.appendChild = function appendChild(node) {
    node.parentNode = body;
    body.children.push(node);
    if (node.id) registry.set(String(node.id), node);
    return node;
  };
  return {
    body,
    createElement,
    getElementById(id) { return registry.get(String(id)) || null; },
  };
}

/**
 * 可手动触发的 setTimeout 桩，用来把指示器的自动淡出验证开。
 * @returns {object} 定时器桩。
 */
function createTimerShim() {
  const store = new Map();
  let seq = 0;
  return {
    setTimeout(fn, delay) {
      const id = ++seq;
      store.set(id, { fn, delay: Number(delay) || 0 });
      return id;
    },
    clearTimeout(id) { store.delete(id); },
    fire(delay) {
      let count = 0;
      for (const [id, timer] of Array.from(store)) {
        if (timer.delay !== delay) continue;
        store.delete(id);
        count += 1;
        timer.fn();
      }
      return count;
    },
    size() { return store.size; },
  };
}
/**
 * 在 vm 里跑起真实的自动同步实现，外部依赖全部换成可观测的桩。
 * @returns {object} 沙箱上下文与观测记录。
 */
function createSandbox() {
  const doc = createDocumentShim();
  const timers = createTimerShim();
  const covers = Object.create(null);
  const calls = { revokes: [], saves: 0, released: [], hydrated: [], invalidated: [], quality: [] };
  const context = {
    console,
    Math, Number, String, Array, Object, Boolean, Date, JSON, Promise, Set, Map,
    document: doc,
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    localFileSize: (file) => Number(file && file.size) || 0,
    localFileLastModified: (file) => Number(file && file.lastModified) || 0,
    localFullPath: (file) => String((file && (file.fullPath || file.path)) || ''),
    localFilePath: (file) => String((file && file.path) || ''),
    songCustomCoverKey: (song) => (song && song.localKey ? `local:${song.localKey}` : ''),
    releaseLocalFullCoverData: (song) => { calls.released.push(song); },
    ensureCustomCoverMap: () => covers,
    saveCustomCoverMap: () => { calls.saves += 1; },
    hydrateCustomCover: (song) => { calls.hydrated.push(song); },
    invalidateSongCoverCache: (song) => { calls.invalidated.push(song); },
    updateLocalAudioQualityInfo: (song) => { calls.quality.push(song); },
    revokeDiscardedLocalSongObjectUrls: (list, lists) => { calls.revokes.push({ list, lists }); },
  };
  vm.runInNewContext(`${PATH_KEY_SOURCE}\n${AUTO_SYNC_SOURCE}\n${EXPORTS}`, context);
  return { context, doc, timers, covers, calls };
}

/**
 * 把 vm 里造出来的数组搬回当前 realm。跨 realm 的原型不同，严格 deepEqual 会直接判负。
 * @param {Array} list vm 内的数组。
 * @returns {Array} 当前 realm 的数组副本。
 */
function outer(list) {
  return Array.from(list || []);
}

/**
 * 造一首本地歌曲。localKey 里带着大小与修改时间，正是"改标签就换 key"的来源。
 * @param {string} name 文件名。
 * @param {number} size 文件大小。
 * @param {number} mtime 修改时间。
 * @param {object} [extra] 附加字段。
 * @returns {object} 歌曲对象。
 */
function makeSong(name, size, mtime, extra) {
  const abs = `D:/Music/${name}`;
  return Object.assign({
    type: 'local',
    name,
    artist: '未知艺术家',
    duration: 214,
    localPath: abs,
    localFilePathAbsolute: abs,
    localFileSize: size,
    localFileLastModified: mtime,
    localKey: `${abs}:${size}:${mtime}`,
    localUrl: `blob:${name}`,
    localCoverObjectUrl: '',
  }, extra || {});
}
test('formatLocalLibrarySyncCount 给曲库数量加千分位', () => {
  const h = createSandbox();
  const format = h.context.formatLocalLibrarySyncCount;
  assert.equal(format(0), '0');
  assert.equal(format(999), '999');
  assert.equal(format(1000), '1,000');
  assert.equal(format(12431), '12,431');
  assert.equal(format(1234567), '1,234,567');
  assert.equal(format('12431'), '12,431');
  assert.equal(format(12431.9), '12,431');
  assert.equal(format(-5), '0');
  assert.equal(format(NaN), '0');
  assert.equal(format(undefined), '0');
});

test('reportLocalLibrarySyncedCount 在右下角报出数量并自动淡出', () => {
  const h = createSandbox();
  const text = h.context.reportLocalLibrarySyncedCount(12431);
  assert.equal(text, '已同步 12,431 首歌曲');
  const badge = h.doc.getElementById('local-sync-badge');
  assert.ok(badge);
  // 懒建在 body 上，index.html 的静态结构一行都不用动。
  assert.equal(badge.parentNode, h.doc.body);
  assert.equal(badge.textContent, '已同步 12,431 首歌曲');
  assert.equal(badge.classList.contains('show'), true);
  assert.equal(badge.getAttribute('role'), 'status');
  assert.equal(badge.getAttribute('aria-live'), 'polite');
  h.context.reportLocalLibrarySyncedCount(1);
  assert.equal(h.doc.body.children.length, 1);
  assert.equal(badge.textContent, '已同步 1 首歌曲');
  // 后一次上报会顶掉前一次的淡出定时器，只剩一个在排队。
  assert.equal(h.timers.size(), 1);
  assert.equal(h.timers.fire(4200), 1);
  assert.equal(badge.classList.contains('show'), false);
});

test('localLibraryWatchRootMatches 容忍大小写、分隔符和尾部斜杠', () => {
  const h = createSandbox();
  const matches = h.context.localLibraryWatchRootMatches;
  assert.equal(matches('D:\\Music', 'D:/Music'), true);
  assert.equal(matches('D:/Music/', 'D:/Music'), true);
  assert.equal(matches('d:/music', 'D:\\Music\\'), true);
  assert.equal(matches('D:/Music', 'D:/Music2'), false);
  assert.equal(matches('D:/Music', 'E:/Music'), false);
  assert.equal(matches('', ''), false);
  assert.equal(matches('D:/Music', ''), false);
});
test('localLibraryAutoSyncDiff 按路径认人、按签名判断是否被改过', () => {
  const h = createSandbox();
  const a = makeSong('a.flac', 100, 1);
  const b = makeSong('b.flac', 200, 2);
  const c = makeSong('c.flac', 300, 3);
  const next = [makeSong('a.flac', 100, 1), makeSong('b.flac', 250, 900), makeSong('d.flac', 400, 4)];
  const diff = h.context.localLibraryAutoSyncDiff([a, b, c], next);
  assert.equal(diff.total, 3);
  assert.equal(diff.unchanged, 1);
  assert.equal(diff.changed, 1);
  assert.equal(diff.added, 1);
  // 未变的那首继续用原对象，播放次数、收藏和歌单引用都挂在它身上。
  assert.equal(diff.plan[0].state, 'unchanged');
  assert.equal(diff.plan[0].song, a);
  assert.equal(diff.plan[0].next, null);
  // 改标签换封面只会落进 changed，不会被当成"删一首再加一首"。
  assert.equal(diff.plan[1].state, 'changed');
  assert.equal(diff.plan[1].song, b);
  assert.equal(diff.plan[1].next.localFileSize, 250);
  assert.equal(diff.plan[2].state, 'new');
  assert.equal(diff.plan[2].song, next[2]);
  assert.equal(diff.plan[2].next, null);
  assert.equal(diff.removed.length, 1);
  assert.equal(diff.removed[0].song, c);
  assert.equal(diff.removed[0].index, 2);
});

test('localLibraryAutoSyncDiff 的删除项按原始下标排好序', () => {
  const h = createSandbox();
  const songs = [makeSong('a.flac', 1, 1), makeSong('b.flac', 2, 2), makeSong('c.flac', 3, 3), makeSong('d.flac', 4, 4)];
  const diff = h.context.localLibraryAutoSyncDiff(songs, [makeSong('c.flac', 3, 3)]);
  assert.equal(diff.total, 1);
  assert.equal(diff.unchanged, 1);
  assert.deepEqual(outer(diff.removed).map((item) => item.index), [0, 1, 3]);
  assert.deepEqual(outer(diff.removed).map((item) => item.song.name), ['a.flac', 'b.flac', 'd.flac']);
});

test('localLibraryAutoSyncDiff 对空输入和重复路径都不炸', () => {
  const h = createSandbox();
  const empty = h.context.localLibraryAutoSyncDiff(null, null);
  assert.equal(empty.total, 0);
  assert.deepEqual(outer(empty.plan), []);
  assert.deepEqual(outer(empty.removed), []);
  const a = makeSong('a.flac', 100, 1);
  // 同一路径出现两次时只认第一条，第二条按新增处理，不会把同一个对象接管两遍。
  const dup = h.context.localLibraryAutoSyncDiff([a], [makeSong('a.flac', 100, 1), makeSong('a.flac', 100, 1)]);
  assert.equal(dup.unchanged, 1);
  assert.equal(dup.added, 1);
  assert.equal(dup.plan[0].song, a);
  assert.equal(dup.plan[1].state, 'new');
});
test('applyLocalLibraryAutoSyncDiff 就地改数组，保住数组身份', () => {
  const h = createSandbox();
  const a = makeSong('a.flac', 100, 1);
  const gone = makeSong('gone.flac', 300, 3);
  const songs = [a, gone];
  const fresh = makeSong('new.flac', 500, 5);
  const diff = h.context.localLibraryAutoSyncDiff(songs, [makeSong('a.flac', 100, 1), fresh]);
  const applied = h.context.applyLocalLibraryAutoSyncDiff(songs, diff, [], []);
  assert.equal(applied.ok, true);
  assert.equal(applied.added, 1);
  assert.equal(applied.removed, 1);
  assert.equal(applied.kept, 0);
  assert.equal(applied.total, 2);
  // playQueue === localLibrarySongs 是同一个数组，只能就地改，不能换新数组。
  assert.equal(songs.length, 2);
  assert.equal(songs[0], a);
  assert.equal(songs[1], fresh);
  assert.deepEqual(outer(applied.fresh), [fresh]);
  assert.equal(h.calls.revokes.length, 1);
  assert.deepEqual(outer(h.calls.revokes[0].list), [gone]);
});

test('applyLocalLibraryAutoSyncDiff 不移除正在播放的那一首', () => {
  const h = createSandbox();
  const a = makeSong('a.flac', 100, 1);
  const playing = makeSong('playing.flac', 200, 2);
  const gone = makeSong('gone.flac', 300, 3);
  const songs = [a, playing, gone];
  const diff = h.context.localLibraryAutoSyncDiff(songs, [makeSong('a.flac', 100, 1)]);
  assert.equal(diff.removed.length, 2);
  const applied = h.context.applyLocalLibraryAutoSyncDiff(songs, diff, [playing], []);
  assert.equal(applied.kept, 1);
  assert.equal(applied.removed, 1);
  // 文件被删也先留在原位，等下次重启收尾，中途不断音。
  assert.deepEqual(songs, [a, playing]);
  assert.equal(songs.indexOf(playing), 1);
  assert.deepEqual(outer(h.calls.revokes[0].list), [gone]);
});

test('接管时回收旧 Object URL，但正在播放的那首除外', () => {
  const h = createSandbox();
  const playing = makeSong('playing.flac', 200, 2, { localUrl: 'blob:playing' });
  const other = makeSong('other.flac', 300, 3, { localUrl: 'blob:other' });
  const songs = [playing, other];
  const diff = h.context.localLibraryAutoSyncDiff(songs, [
    makeSong('playing.flac', 200, 99),
    makeSong('other.flac', 300, 99),
  ]);
  assert.equal(diff.changed, 2);
  const applied = h.context.applyLocalLibraryAutoSyncDiff(songs, diff, [playing], []);
  assert.equal(applied.changed, 2);
  assert.equal(applied.removed, 0);
  assert.equal(h.calls.revokes.length, 1);
  // audio.src 还指着播放中那首的 blob，撤销就等于当场断音。
  assert.equal(h.calls.revokes[0].list.length, 1);
  assert.equal(h.calls.revokes[0].list[0].localUrl, 'blob:other');
  assert.deepEqual(outer(applied.fresh), [playing, other]);
});
test('有在途解析任务时推迟接管，留到下一轮同步', () => {
  const h = createSandbox();
  const busy = makeSong('busy.flac', 100, 1, { localCoverPromise: {} });
  const songs = [busy];
  const diff = h.context.localLibraryAutoSyncDiff(songs, [makeSong('busy.flac', 100, 77)]);
  assert.equal(diff.changed, 1);
  const applied = h.context.applyLocalLibraryAutoSyncDiff(songs, diff, [], []);
  assert.equal(applied.changed, 0);
  assert.equal(applied.deferred, 1);
  // 字段一个都没动，否则签名会先对上，旧任务的过期结果就永远写不回去了。
  assert.equal(busy.localFileLastModified, 1);
  assert.equal(songs[0], busy);
  assert.deepEqual(outer(applied.fresh), []);
  assert.equal(h.calls.revokes.length, 0);
});

test('接管迁移自定义封面、清掉派生缓存，标签字段如实回落', () => {
  const h = createSandbox();
  const song = makeSong('a.flac', 100, 1, {
    album: '旧专辑', albumArtist: '旧艺术家', genre: 'Rock', trackNumber: '3', year: '2001',
    localCoverThumbDataUrl: 'data:thumb', localCoverLoaded: true, localCoverLightScanned: true,
    localLyricText: '旧歌词', localLyricLoaded: true, localMetadataLoaded: true,
    localMetadataTagSchema: 3, localLibraryIndexApplied: true, localIndexedCoverStatus: 'ok',
    customCover: 'data:thumb',
  });
  const oldKey = `local:${song.localKey}`;
  h.covers[oldKey] = 'data:user-picked-cover';
  assert.equal(h.context.adoptLocalLibraryAutoSyncSong(song, makeSong('a.flac', 100, 77), null), true);
  const newKey = `local:${song.localKey}`;
  assert.notEqual(newKey, oldKey);
  // localKey 里带着修改时间，不迁移用户手挑的封面就会因为一次改标签变成孤儿。
  assert.equal(h.covers[newKey], 'data:user-picked-cover');
  assert.equal(h.covers[oldKey], undefined);
  assert.equal(h.calls.saves, 1);
  assert.equal(song.customCover, undefined);
  assert.equal(song.localFileLastModified, 77);
  assert.equal(song.localUrl, '');
  assert.equal(song.localCoverThumbDataUrl, '');
  assert.equal(song.localCoverLoaded, false);
  assert.equal(song.localCoverLightScanned, false);
  assert.equal(song.localLyricText, '');
  assert.equal(song.localLyricLoaded, false);
  assert.equal(song.localMetadataLoaded, false);
  assert.equal(song.localMetadataTagSchema, 0);
  assert.equal(song.localIndexedCoverStatus, '');
  assert.equal(song.localLibraryIndexApplied, false);
  assert.equal(song.localLibraryChangeState, 'modified');
  // 标签被删掉时要如实回落到文件名，不能留着上一版的旧专辑。
  assert.equal(song.album, '');
  assert.equal(song.albumArtist, '');
  assert.equal(song.genre, '');
  assert.equal(song.trackNumber, '');
  assert.equal(song.year, '');
  // duration 故意保留，避免刷新瞬间跳成 0:00。
  assert.equal(song.duration, 214);
  assert.equal(h.calls.released.length, 1);
  assert.equal(h.calls.hydrated.length, 1);
  assert.equal(h.calls.invalidated.length, 1);
  assert.equal(h.calls.quality.length, 1);
});

test('接管把旧 Object URL 收进待回收清单', () => {
  const h = createSandbox();
  const song = makeSong('a.flac', 100, 1, { localUrl: 'blob:old', localCoverObjectUrl: 'blob:cover' });
  const stale = [];
  assert.equal(h.context.adoptLocalLibraryAutoSyncSong(song, makeSong('a.flac', 100, 77), stale), true);
  assert.deepEqual(stale.map((item) => Object.assign({}, item)), [{ localUrl: 'blob:old', localCoverObjectUrl: 'blob:cover' }]);
  // 清掉 localUrl，ensureLocalSongUrl 才会重新取，而不是继续播旧 blob。
  assert.equal(song.localUrl, '');
  assert.equal(song.localCoverObjectUrl, '');
  assert.equal(h.context.adoptLocalLibraryAutoSyncSong(null, null, stale), false);
});
