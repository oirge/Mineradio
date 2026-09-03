'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const APP_SOURCE = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
const APP_CSS = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.css'), 'utf8');

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
  'localLibrarySyncBadgeElement',
  'localLibrarySyncBadgeHoldingPeek',
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
    /**
     * 往注册表里摆一个带 id 的节点，但不塞进 body.children ——
     * 用来还原 index.html 里的 #search-area / #search-stack 这些静态结构。
     * @param {string} id 节点 id。
     * @returns {object} 节点桩。
     */
    mount(id) {
      const node = createElement('div');
      node.id = String(id);
      node.children = [];
      node.appendChild = function appendChild(child) {
        child.parentNode = node;
        node.children.push(child);
        if (child.id) registry.set(String(child.id), child);
        return child;
      };
      registry.set(String(id), node);
      return node;
    },
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
 * @param {object} [opts] 可选项。opts.searchDom 摆出顶部搜索区那套静态结构并接上
 *   setPeek 探针；opts.peeking 让搜索区一开始就是探出状态。
 * @returns {object} 沙箱上下文与观测记录。
 */
function createSandbox(opts) {
  const options = opts || {};
  const doc = createDocumentShim();
  const timers = createTimerShim();
  const covers = Object.create(null);
  const calls = { revokes: [], saves: 0, released: [], hydrated: [], invalidated: [], quality: [] };
  const peeks = [];
  const nodes = Object.create(null);
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
  if (options.searchDom) {
    // 还原 index.html 的顶部搜索区：#search-area 只有带上 .peek 才是可见的，
    // 指示器如今就挂在它里面的 #search-stack 下。
    nodes.area = doc.mount('search-area');
    nodes.stack = doc.mount('search-stack');
    nodes.input = doc.mount('search-input');
    nodes.results = doc.mount('search-results');
    if (options.peeking) nodes.area.classList.add('peek');
    context.setPeek = function setPeek(el, on, key) {
      peeks.push({ id: el ? String(el.id) : '', on: !!on, key: String(key) });
      // 沉浸模式下真实的 setPeek 会直接拒绝开搜索区，用这个开关还原「叫了但没开」。
      if (!el || !el.classList || options.peekRefused) return;
      if (on) el.classList.add('peek');
      else el.classList.remove('peek');
    };
  }
  vm.runInNewContext(`${PATH_KEY_SOURCE}\n${AUTO_SYNC_SOURCE}\n${EXPORTS}`, context);
  return { context, doc, timers, covers, calls, peeks, nodes };
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

test('reportLocalLibrarySyncedCount 报出数量并自动淡出（取不到搜索区时退回 body）', () => {
  const h = createSandbox();
  const text = h.context.reportLocalLibrarySyncedCount(12431);
  assert.equal(text, '已同步 12,431 首歌曲');
  const badge = h.doc.getElementById('local-sync-badge');
  assert.ok(badge);
  // 没有 #search-stack 就退回 body，被裁过的 DOM 里也还报得出来。
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

test('指示器挂进搜索框那一叠，位置和宽度跟着搜索框走', () => {
  const h = createSandbox({ searchDom: true });
  h.context.reportLocalLibrarySyncedCount(12431);
  const badge = h.doc.getElementById('local-sync-badge');
  assert.ok(badge);
  // 挂在 #search-stack 里，stage / simple / 桌面外壳各种模式变体全跟着搜索框走。
  assert.equal(badge.parentNode, h.nodes.stack);
  assert.equal(h.nodes.stack.children.length, 1);
  assert.equal(h.doc.body.children.length, 0);
  assert.equal(badge.textContent, '已同步 12,431 首歌曲');
  // 只建一次，重复上报不会往那一叠里再塞一个。
  h.context.reportLocalLibrarySyncedCount(7);
  assert.equal(h.nodes.stack.children.length, 1);
  assert.equal(h.context.localLibrarySyncBadgeElement(), badge);
});

test('指示器显示时把顶部搜索区按住，淡出后再放开', () => {
  const h = createSandbox({ searchDom: true });
  assert.equal(h.context.localLibrarySyncBadgeHoldingPeek(), false);
  h.context.reportLocalLibrarySyncedCount(12431);
  // 指示器现在挂在搜索区里面，搜索区没探出来就等于白报一场。
  assert.deepEqual(h.peeks, [{ id: 'search-area', on: true, key: 'search' }]);
  assert.equal(h.nodes.area.classList.contains('peek'), true);
  assert.equal(h.context.localLibrarySyncBadgeHoldingPeek(), true);
  assert.equal(h.timers.fire(4200), 1);
  assert.equal(h.doc.getElementById('local-sync-badge').classList.contains('show'), false);
  assert.deepEqual(h.peeks[1], { id: 'search-area', on: false, key: 'search' });
  assert.equal(h.peeks.length, 2);
  assert.equal(h.nodes.area.classList.contains('peek'), false);
  assert.equal(h.context.localLibrarySyncBadgeHoldingPeek(), false);
});

test('搜索区已经开着时既不接管也不替用户关掉', () => {
  const h = createSandbox({ searchDom: true, peeking: true });
  h.context.reportLocalLibrarySyncedCount(12431);
  // 用户自己划开的搜索区不归指示器管，免得几秒后当着人家的面收回去。
  assert.deepEqual(h.peeks, []);
  assert.equal(h.context.localLibrarySyncBadgeHoldingPeek(), false);
  assert.equal(h.timers.fire(4200), 1);
  assert.deepEqual(h.peeks, []);
  assert.equal(h.nodes.area.classList.contains('peek'), true);
});

test('输入框有焦点或结果列表开着时不收起搜索区', () => {
  const focused = createSandbox({ searchDom: true });
  focused.context.reportLocalLibrarySyncedCount(12431);
  assert.equal(focused.peeks.length, 1);
  focused.doc.activeElement = focused.nodes.input;
  assert.equal(focused.timers.fire(4200), 1);
  // 正在打字，收起搜索区等于把输入框从人手里抽走。
  assert.equal(focused.peeks.length, 1);
  assert.equal(focused.nodes.area.classList.contains('peek'), true);
  assert.equal(focused.context.localLibrarySyncBadgeHoldingPeek(), false);

  const listing = createSandbox({ searchDom: true });
  listing.context.reportLocalLibrarySyncedCount(12431);
  assert.equal(listing.peeks.length, 1);
  listing.nodes.results.classList.add('show');
  assert.equal(listing.timers.fire(4200), 1);
  assert.equal(listing.peeks.length, 1);
  assert.equal(listing.nodes.area.classList.contains('peek'), true);
});

test('鼠标还停在留住区、或空态首页常开时，放开按住状态也不收搜索区', () => {
  const hot = createSandbox({ searchDom: true });
  hot.context.reportLocalLibrarySyncedCount(12431);
  assert.equal(hot.peeks.length, 1);
  // 那条 mousemove 每次都会写这个标记；鼠标正停在顶部却收掉，下一次 mousemove 之前就一直是收着的。
  hot.context.localLibrarySyncBadgeSearchZoneHot = true;
  assert.equal(hot.timers.fire(4200), 1);
  assert.equal(hot.peeks.length, 1);
  assert.equal(hot.nodes.area.classList.contains('peek'), true);

  const home = createSandbox({ searchDom: true });
  home.context.reportLocalLibrarySyncedCount(12431);
  // 空态首页把搜索区当常开件，mousemove 自己也不会收，指示器更不该替它收。
  home.context.emptyHomeActive = true;
  assert.equal(home.timers.fire(4200), 1);
  assert.equal(home.peeks.length, 1);
  assert.equal(home.nodes.area.classList.contains('peek'), true);

  const tip = createSandbox({ searchDom: true });
  tip.doc.mount('upload-tip').classList.add('show');
  tip.context.reportLocalLibrarySyncedCount(12431);
  assert.equal(tip.peeks.length, 1);
  assert.equal(tip.timers.fire(4200), 1);
  assert.equal(tip.peeks.length, 1);
  assert.equal(tip.nodes.area.classList.contains('peek'), true);
});

test('setPeek 拒绝开搜索区时不记按住状态（沉浸模式）', () => {
  const h = createSandbox({ searchDom: true, peekRefused: true });
  h.context.reportLocalLibrarySyncedCount(12431);
  // 沉浸模式下搜索区一律不给开，那就不该记按住状态 —— 否则那几秒里 mousemove 的收起分支会被白白豁免。
  assert.deepEqual(h.peeks, [{ id: 'search-area', on: true, key: 'search' }]);
  assert.equal(h.nodes.area.classList.contains('peek'), false);
  assert.equal(h.context.localLibrarySyncBadgeHoldingPeek(), false);
  assert.equal(h.timers.fire(4200), 1);
  assert.equal(h.peeks.length, 1);
});

test('缺 setPeek 时指示器照样报得出来，不会去按搜索区', () => {
  const h = createSandbox();
  // 切片外的函数在 vm 里是裸标识符，必须 typeof 兜住，否则整条上报链当场 ReferenceError。
  assert.equal(h.context.reportLocalLibrarySyncedCount(3), '已同步 3 首歌曲');
  assert.equal(h.context.localLibrarySyncBadgeHoldingPeek(), false);
  assert.equal(h.timers.fire(4200), 1);
  assert.equal(h.doc.getElementById('local-sync-badge').classList.contains('show'), false);
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

/**
 * 取 app.css 里某条顶格选择器的声明块。按行首锚定，免得
 * `#search-area.stage-mode #search-stack{...}` 这种后代选择器抢先匹配上。
 * @param {string} selector 选择器原文。
 * @returns {string} 大括号里的声明串。
 */
function cssRule(selector) {
  const key = `\n${selector}{`;
  const at = APP_CSS.indexOf(key);
  assert.ok(at >= 0, `missing css rule: ${selector}`);
  const end = APP_CSS.indexOf('}', at);
  assert.ok(end > at, `unterminated css rule: ${selector}`);
  return APP_CSS.slice(at + key.length, end);
}

/**
 * 从声明块里读一个像素值。
 * @param {string} rule 声明串。
 * @param {string} prop 属性名。
 * @returns {number} 像素数。
 */
function cssPx(rule, prop) {
  const hit = new RegExp(`(?:^|;)${prop}:(\\d+(?:\\.\\d+)?)px`).exec(rule);
  assert.ok(hit, `missing ${prop} in rule: ${rule.slice(0, 60)}`);
  return Number(hit[1]);
}

test('指示器样式绝对定位在搜索框那一叠里，不留右下角的老坐标', () => {
  const stack = cssRule('#search-stack');
  // 绝对定位要有一个定过位的祖先，否则会一路飘到 body。
  assert.match(stack, /position:relative/);
  const badge = cssRule('#local-sync-badge');
  assert.match(badge, /position:absolute/);
  assert.match(badge, /right:0/);
  assert.doesNotMatch(badge, /position:fixed/);
  assert.doesNotMatch(badge, /bottom:/);
  assert.doesNotMatch(badge, /right:24px/);
  // 老的贴边坐标和跟着控制条抬高的补偿规则都得跟着位置一起清掉。
  assert.ok(!APP_CSS.includes('body.controls-visible #local-sync-badge'));
  assert.ok(!APP_CSS.includes('#local-sync-badge{position:fixed'));
});

test('指示器贴着搜索框那一叠的底边，压不到结果列表上', () => {
  const badge = cssRule('#local-sync-badge');
  const results = cssRule('#search-results');
  // 贴那一叠的底边：搜索框下面没东西时就在搜索框正下方，结果列表一开就顺到列表下面。
  assert.match(badge, /top:100%/);
  assert.match(badge, /right:0/);
  // 和结果列表用同一个间距，读起来才是一叠而不是两处。
  assert.equal(cssPx(badge, 'margin-top'), cssPx(results, 'margin-top'));
  // #search-mode-tabs 在 local-only 模式下是 display:none 的，按它的行高算死坐标会正好压在结果列表上。
  assert.doesNotMatch(badge, /(?:^|;)top:[\d.]+px/);
  assert.ok(APP_CSS.includes('body.local-only-mode #search-mode-tabs'));
  assert.equal(cssPx(badge, 'height'), 32);
  assert.match(badge, /max-width:100%/);
  assert.match(badge, /white-space:nowrap/);
  assert.match(badge, /text-overflow:ellipsis/);
  // 只读不点，别抢搜索框和结果列表的点击。
  assert.match(badge, /pointer-events:none/);
});

test('指示器配色走主题令牌，没主题时回落到黄金玻璃', () => {
  const badge = cssRule('#local-sync-badge');
  // 主题插件只有两条通道：--th-* 令牌，或者被主题 css 段点名。这里占的是令牌那条。
  assert.match(badge, /background:var\(--th-search-bg,var\(--th-chip-bg,var\(--saved-panel-glass-bg,/);
  assert.match(badge, /border:1px solid var\(--th-chip-border,transparent\)/);
  assert.match(badge, /box-shadow:var\(--th-row-shadow,var\(--saved-panel-glass-shadow\)\)/);
  assert.match(badge, /backdrop-filter:var\(--saved-panel-glass-filter,/);
  // 文字走 --th-text-strong，浅色主题（雪昼白那类）下也读得清；语义色只在圆点上。
  assert.match(badge, /color:var\(--th-text-strong,/);
  const dot = cssRule('#local-sync-badge::before');
  assert.match(dot, /background:rgba\(var\(--fc-accent-rgb\),/);
  // 玻璃 SVG 就绪时跟邻居升级到同一支滤镜，而不是退化成普通毛玻璃。
  const svg = cssRule('html.control-glass-svg-ok #local-sync-badge');
  assert.match(svg, /backdrop-filter:var\(--saved-panel-glass-svg-filter\)/);
  assert.match(svg, /-webkit-backdrop-filter:var\(--saved-panel-glass-svg-filter\)/);
  // 淡入淡出只动 opacity/transform，掉不到主线程上。
  assert.match(cssRule('#local-sync-badge.show'), /opacity:1/);
});

test('顶部搜索区的收起分支认指示器的按住状态', () => {
  // 鼠标一旦离开顶部 66px，这条分支就会把搜索区收回去 —— 指示器正挂在里面，必须让它豁免。
  assert.ok(APP_SOURCE.includes(
    "else if (saOn && !emptyHomeActive && !(typeof localLibrarySyncBadgeHoldingPeek === 'function' && localLibrarySyncBadgeHoldingPeek())) setPeek(sa, false, 'search');"
  ));
  // 切片外的 setPeek 在 vm 里是裸标识符，取用前必须 typeof 兜一层。
  assert.match(AUTO_SYNC_SOURCE, /typeof setPeek !== 'function'/);
  assert.match(AUTO_SYNC_SOURCE, /typeof emptyHomeActive !== 'undefined'/);
  assert.match(AUTO_SYNC_SOURCE, /getElementById\('search-stack'\)/);
  // 留住区标记由那条 mousemove 写入，写的和判的必须是同一个条件。
  assert.ok(APP_SOURCE.includes(
    'var searchPeekWanted = ey < 66 || inSearchPanel || searchFocused || uploadTipOpen;'
  ));
  assert.ok(APP_SOURCE.includes('localLibrarySyncBadgeSearchZoneHot = searchPeekWanted;'));
});
