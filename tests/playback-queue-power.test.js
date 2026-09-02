'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const appSource = fs.readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
const cssSource = fs.readFileSync(path.join(ROOT, 'public', 'app.css'), 'utf8');
const preloadSource = fs.readFileSync(path.join(ROOT, 'desktop', 'preload.js'), 'utf8');

/**
 * 按起止标记截取源码片段。
 * @param {string} source 源文件内容。
 * @param {string} startMarker 起始标记。
 * @param {string} endMarker 结束标记。
 * @param {string} label 失败时的说明。
 * @returns {string} 截取到的源码。
 */
function slice(source, startMarker, endMarker, label) {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, '未找到起始标记：' + label);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(end > start, '未找到结束标记：' + label);
  return source.slice(start, end);
}

/** 跨 realm 的对象/数组要 JSON round-trip 才能参与 strict 断言。 */
function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

const QUEUE_POWER_SOURCE = slice(
  appSource,
  'function setPlayMode(mode, opts) {',
  "var controlGlassState = { key: '',",
  '强化队列实现'
);

/**
 * 建一个极简的假 DOM 节点，够队列代码读写 class / 属性 / innerHTML。
 * @param {string} id 节点 id。
 * @returns {object} 假节点。
 */
function createFakeNode(id) {
  const node = {
    id,
    innerHTML: '',
    title: '',
    attributes: {},
    classNames: new Set(),
    listeners: {},
    children: [],
    isConnected: true,
    classList: {
      add(...names) { names.forEach((n) => node.classNames.add(n)); },
      remove(...names) { names.forEach((n) => node.classNames.delete(n)); },
      contains(name) { return node.classNames.has(name); },
      toggle(name, on) {
        const next = on === undefined ? !node.classNames.has(name) : !!on;
        if (next) node.classNames.add(name);
        else node.classNames.delete(name);
        return next;
      },
    },
    setAttribute(name, value) { node.attributes[name] = String(value); },
    getAttribute(name) { return Object.prototype.hasOwnProperty.call(node.attributes, name) ? node.attributes[name] : null; },
    addEventListener(type, handler) {
      node.listeners[type] = node.listeners[type] || [];
      node.listeners[type].push(handler);
    },
    querySelectorAll() { return node.children; },
    closest(selector) { return selector.indexOf('[data-queue-index]') >= 0 && node.attributes['data-queue-index'] != null ? node : null; },
    getBoundingClientRect() { return { top: 0, height: 40 }; },
    fire(type, event) {
      (node.listeners[type] || []).forEach((handler) => handler(event));
    },
  };
  return node;
}

/**
 * 在隔离上下文里跑起强化队列的实现，返回上下文与观测数组。
 * @param {object=} options 初始状态。
 * @returns {object} 测试夹具。
 */
function loadQueueModule(options) {
  const opts = options || {};
  const toasts = [];
  const rendered = [];
  const shelfRebuilds = [];
  const played = [];
  const sessionSaves = [];
  const stored = {};
  const storage = Object.assign({}, opts.storage || {});
  const nodes = new Map();
  ['queue-mode-loop', 'queue-mode-shuffle', 'queue-mode-single', 'queue-stop-after-btn', 'queue-list', 'queue-next-up', 'queue-archive-list']
    .forEach((id) => nodes.set(id, createFakeNode(id)));

  const context = {
    console,
    playQueue: opts.playQueue || [],
    localLibrarySongs: opts.localLibrarySongs || [],
    currentIdx: opts.currentIdx === undefined ? -1 : opts.currentIdx,
    playMode: opts.playMode || 'loop',
    playing: true,
    audio: { currentTime: 12 },
    stopAfterCurrentTrack: !!opts.stopAfterCurrentTrack,
    queueDragState: null,
    queueSnapshots: [],
    QUEUE_SNAPSHOT_STORE_KEY: 'mineradio-queue-snapshots-v1',
    QUEUE_SNAPSHOT_LIMIT: opts.snapshotLimit || 12,
    QUEUE_SNAPSHOT_TRACK_LIMIT: opts.trackLimit || 3000,
    shuffledPlayQueueArrays: new WeakSet(),
    localStorage: {
      getItem: (key) => (Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null),
      setItem: (key, value) => { storage[key] = String(value); },
      removeItem: (key) => { delete storage[key]; },
    },
    setPersistentLocalStorageItem: (key, value) => { stored[key] = String(value); storage[key] = String(value); },
    showToast: (text) => toasts.push(String(text)),
    safeRenderQueuePanel: (reason) => rendered.push(String(reason)),
    safeShelfRebuild: (reason) => shelfRebuilds.push(String(reason)),
    savePlaybackSession: (force) => sessionSaves.push(!!force),
    markQueueContentChanged: () => {},
    playQueueAt: (idx) => played.push(idx),
    playModeLabel: (mode) => ({ loop: '顺序循环', shuffle: '随机播放', single: '单曲循环' }[mode] || '顺序循环'),
    updatePlayModeButton: () => { context.updatePlayModeButtonRow(); context.updateStopAfterCurrentButton(); },
    shufflePlayQueueOnce: (o) => { context.shuffleCalls.push(o && o.reason ? o.reason : ''); return true; },
    shuffleCalls: [],
    queueItemKey: (song) => (song && song.localKey ? String(song.localKey) : ''),
    songCoverSrc: () => '',
    songDisplaySubtitle: (song) => String((song && song.artist) || ''),
    escHtml: (value) => String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
    setPlayIcon: (p) => { context.playIcon = !!p; },
    hideLoading: () => {},
    forcePlaybackControlsInteractive: () => {},
    scheduleControlsHide: () => {},
    pushMiniPlayerState: () => {},
    syncPlaybackStateFromAudioEvent: (reason) => { context.syncReasons.push(String(reason)); },
    syncReasons: [],
    safePlaybackStep: (label, fn) => { try { fn(); } catch (e) { context.stepErrors.push(String(e)); } },
    stepErrors: [],
    updateCustomCoverButton: () => {},
    updateCustomLyricControls: () => {},
    updateEmptyHomeVisibility: () => {},
    document: {
      getElementById: (id) => nodes.get(id) || null,
    },
  };

  vm.runInNewContext(QUEUE_POWER_SOURCE, context);
  return { context, nodes, toasts, rendered, shelfRebuilds, played, sessionSaves, stored, storage };
}

/** 造一批本地歌曲，带上重定位所需的标识字段。 */
function makeSongs(count) {
  const songs = [];
  for (let i = 0; i < count; i++) {
    songs.push({
      name: 'S' + i,
      artist: 'A' + i,
      localKey: 'k' + i,
      localLibraryPathKey: 'p' + i,
      localFile: { fake: true },
    });
  }
  return songs;
}

test('setPlayMode 直达三种模式，进入随机时洗牌一次', () => {
  const h = loadQueueModule({ playQueue: makeSongs(4), currentIdx: 0 });
  h.context.setPlayMode('single');
  assert.equal(h.context.playMode, 'single');
  assert.deepEqual(plain(h.context.shuffleCalls), []);
  h.context.setPlayMode('shuffle');
  assert.equal(h.context.playMode, 'shuffle');
  assert.deepEqual(plain(h.context.shuffleCalls), ['shuffle-mode']);
  // 重复点同一个模式不再洗牌，否则用户每点一次顺序都变。
  h.context.setPlayMode('shuffle');
  assert.deepEqual(plain(h.context.shuffleCalls), ['shuffle-mode']);
  h.context.setPlayMode('不存在');
  assert.equal(h.context.playMode, 'shuffle');
  assert.deepEqual(h.toasts, ['播放模式: 单曲循环', '播放模式: 随机播放', '播放模式: 随机播放']);
});

test('三个模式按钮的选中态互斥', () => {
  const h = loadQueueModule({ playQueue: makeSongs(2), currentIdx: 0 });
  h.context.setPlayMode('single');
  assert.equal(h.nodes.get('queue-mode-single').classNames.has('active'), true);
  assert.equal(h.nodes.get('queue-mode-single').getAttribute('aria-pressed'), 'true');
  assert.equal(h.nodes.get('queue-mode-loop').classNames.has('active'), false);
  assert.equal(h.nodes.get('queue-mode-shuffle').getAttribute('aria-pressed'), 'false');
  h.context.setPlayMode('loop');
  assert.equal(h.nodes.get('queue-mode-loop').classNames.has('active'), true);
  assert.equal(h.nodes.get('queue-mode-single').classNames.has('active'), false);
});

test('cyclePlayMode 依次走 loop → shuffle → single', () => {
  const h = loadQueueModule({ playQueue: makeSongs(3), currentIdx: 0 });
  const seen = [];
  for (let i = 0; i < 4; i++) { h.context.cyclePlayMode(); seen.push(h.context.playMode); }
  assert.deepEqual(seen, ['shuffle', 'single', 'loop', 'shuffle']);
});

test('播完即停是一次性开关，按钮态与提示都跟着走', () => {
  const h = loadQueueModule({ playQueue: makeSongs(3), currentIdx: 1 });
  const btn = h.nodes.get('queue-stop-after-btn');
  h.context.toggleStopAfterCurrent();
  assert.equal(h.context.stopAfterCurrentTrack, true);
  assert.equal(btn.classNames.has('active'), true);
  assert.equal(btn.getAttribute('aria-pressed'), 'true');
  assert.match(btn.title, /再点一下取消/);
  h.context.toggleStopAfterCurrent();
  assert.equal(h.context.stopAfterCurrentTrack, false);
  assert.equal(btn.classNames.has('active'), false);
  assert.deepEqual(h.toasts, ['本曲播完后停止', '已恢复连续播放']);
  // 状态没变时不重复触发队列重绘。
  const before = h.rendered.length;
  h.context.setStopAfterCurrent(false, { toast: false });
  assert.equal(h.rendered.length, before);
});

test('stopPlaybackAfterCurrentTrack 停在本曲并复位开关', () => {
  const h = loadQueueModule({ playQueue: makeSongs(3), currentIdx: 1, stopAfterCurrentTrack: true });
  h.context.stopPlaybackAfterCurrentTrack();
  assert.equal(h.context.stopAfterCurrentTrack, false);
  assert.equal(h.context.playing, false);
  assert.equal(h.context.playIcon, false);
  assert.equal(h.context.audio.currentTime, 0);
  assert.deepEqual(plain(h.context.syncReasons), ['stop-after-current']);
  assert.deepEqual(plain(h.context.stepErrors), []);
  assert.deepEqual(h.toasts, ['本曲已播完，已停止']);
});

test('nextQueueIndexPreview 覆盖三种模式与播完即停', () => {
  const h = loadQueueModule({ playQueue: makeSongs(3), currentIdx: 1 });
  assert.equal(h.context.nextQueueIndexPreview(), 2);
  h.context.currentIdx = 2;
  assert.equal(h.context.nextQueueIndexPreview(), 0);
  h.context.currentIdx = -1;
  assert.equal(h.context.nextQueueIndexPreview(), 0);
  h.context.currentIdx = 1;
  h.context.playMode = 'single';
  assert.equal(h.context.nextQueueIndexPreview(), 1);
  h.context.playMode = 'loop';
  h.context.stopAfterCurrentTrack = true;
  assert.equal(h.context.nextQueueIndexPreview(), -1);
  h.context.stopAfterCurrentTrack = false;
  h.context.playQueue = [];
  assert.equal(h.context.nextQueueIndexPreview(), -1);
});

test('moveQueueItem 重排后当前播放仍指向同一首', () => {
  const songs = makeSongs(5);
  const h = loadQueueModule({ playQueue: songs, currentIdx: 3 });
  const current = songs[3];
  assert.equal(h.context.moveQueueItem(0, 4), true);
  assert.equal(h.context.playQueue[h.context.currentIdx], current);
  assert.deepEqual(h.context.playQueue.map((s) => s.name), ['S1', 'S2', 'S3', 'S4', 'S0']);
  assert.equal(h.context.moveQueueItem(2, 2), false);
  assert.equal(h.context.moveQueueItem(-1, 0), false);
  assert.equal(h.context.moveQueueItem(0, 99), true);
  assert.equal(h.context.playQueue[h.context.currentIdx], current);
  assert.ok(h.rendered.indexOf('reorder-queue') >= 0);
  assert.ok(h.shelfRebuilds.indexOf('reorder-queue') >= 0);
});

test('拖动落点在原位之后时先补偿一格再移动', () => {
  const songs = makeSongs(4);
  const h = loadQueueModule({ playQueue: songs, currentIdx: 0 });
  h.context.bindQueueDragReorder();
  const list = h.nodes.get('queue-list');
  const from = createFakeNode('row0');
  from.setAttribute('data-queue-index', '0');
  const over = createFakeNode('row2');
  over.setAttribute('data-queue-index', '2');
  list.children = [from, over];

  const dt = { types: [], setData() {}, effectAllowed: '', dropEffect: '' };
  list.fire('dragstart', { target: from, dataTransfer: dt });
  assert.deepEqual(plain(h.context.queueDragState), { from: 0, to: 0 });
  assert.equal(from.classNames.has('dragging'), true);
  assert.equal(dt.effectAllowed, 'move');

  // 落在第 2 行下半部分 → 插到它后面，即 to = 3。
  list.fire('dragover', { target: over, dataTransfer: dt, clientY: 30, preventDefault() {}, stopPropagation() {} });
  assert.equal(h.context.queueDragState.to, 3);
  assert.equal(over.classNames.has('drop-after'), true);
  assert.equal(over.classNames.has('drop-before'), false);

  list.fire('drop', { target: over, dataTransfer: dt, preventDefault() {}, stopPropagation() {} });
  assert.equal(h.context.queueDragState, null);
  assert.deepEqual(h.context.playQueue.map((s) => s.name), ['S1', 'S2', 'S0', 'S3']);
  assert.equal(from.classNames.has('dragging'), false);
});

test('落点在上半部分插到该行之前', () => {
  const h = loadQueueModule({ playQueue: makeSongs(4), currentIdx: 0 });
  h.context.bindQueueDragReorder();
  const list = h.nodes.get('queue-list');
  const from = createFakeNode('row3');
  from.setAttribute('data-queue-index', '3');
  const over = createFakeNode('row1');
  over.setAttribute('data-queue-index', '1');
  list.children = [from, over];
  const dt = { types: [], setData() {}, effectAllowed: '', dropEffect: '' };
  list.fire('dragstart', { target: from, dataTransfer: dt });
  list.fire('dragover', { target: over, dataTransfer: dt, clientY: 5, preventDefault() {}, stopPropagation() {} });
  assert.equal(h.context.queueDragState.to, 1);
  assert.equal(over.classNames.has('drop-before'), true);
  list.fire('drop', { target: over, dataTransfer: dt, preventDefault() {}, stopPropagation() {} });
  assert.deepEqual(h.context.playQueue.map((s) => s.name), ['S0', 'S3', 'S1', 'S2']);
});

test('dragend 清掉过程状态，非队列项的 dragstart 不进入拖动', () => {
  const h = loadQueueModule({ playQueue: makeSongs(3), currentIdx: 0 });
  h.context.bindQueueDragReorder();
  const list = h.nodes.get('queue-list');
  const outside = createFakeNode('outside');
  list.fire('dragstart', { target: outside, dataTransfer: { types: [], setData() {} } });
  assert.equal(h.context.queueDragState, null);
  const row = createFakeNode('row1');
  row.setAttribute('data-queue-index', '1');
  list.children = [row];
  list.fire('dragstart', { target: row, dataTransfer: { types: [], setData() {} } });
  assert.ok(h.context.queueDragState);
  list.fire('dragend', {});
  assert.equal(h.context.queueDragState, null);
  assert.equal(row.classNames.has('dragging'), false);
});

test('dragEventHasFiles 只认真的文件拖入', () => {
  const h = loadQueueModule();
  assert.equal(h.context.dragEventHasFiles({ dataTransfer: { types: ['Files'] } }), true);
  assert.equal(h.context.dragEventHasFiles({ dataTransfer: { types: ['text/x-mineradio-queue'] } }), false);
  assert.equal(h.context.dragEventHasFiles({ dataTransfer: {} }), false);
  assert.equal(h.context.dragEventHasFiles({}), false);
  assert.equal(h.context.dragEventHasFiles(null), false);
});

test('下一首预览渲染正常曲目、单曲循环与播完即停三种形态', () => {
  const h = loadQueueModule({ playQueue: makeSongs(3), currentIdx: 0 });
  const host = h.nodes.get('queue-next-up');
  h.context.renderQueueNextUp();
  assert.equal(host.classNames.has('show'), true);
  assert.match(host.innerHTML, /data-queue-next-up="1"/);
  assert.match(host.innerHTML, /下一首/);
  assert.match(host.innerHTML, /S1/);
  assert.match(host.innerHTML, /#2<\/span>/);

  h.context.playMode = 'single';
  h.context.renderQueueNextUp();
  assert.match(host.innerHTML, /单曲循环/);
  assert.match(host.innerHTML, /data-queue-next-up="0"/);

  h.context.playMode = 'loop';
  h.context.stopAfterCurrentTrack = true;
  h.context.renderQueueNextUp();
  assert.match(host.innerHTML, /queue-next-up-stop/);
  assert.doesNotMatch(host.innerHTML, /data-queue-next-up/);

  h.context.playQueue = [];
  h.context.renderQueueNextUp();
  assert.equal(host.innerHTML, '');
  assert.equal(host.classNames.has('show'), false);
});

test('点下一首预览直接跳到那一首', () => {
  const h = loadQueueModule({ playQueue: makeSongs(3), currentIdx: 0 });
  h.context.bindQueuePanelExtras();
  const host = h.nodes.get('queue-next-up');
  const row = createFakeNode('nextup');
  row.setAttribute('data-queue-next-up', '1');
  row.closest = (sel) => (sel.indexOf('data-queue-next-up') >= 0 ? row : null);
  host.fire('click', { target: row, preventDefault() {}, stopPropagation() {} });
  assert.deepEqual(h.played, [1]);
  // 越界索引不触发播放。
  row.setAttribute('data-queue-next-up', '99');
  host.fire('click', { target: row, preventDefault() {}, stopPropagation() {} });
  assert.deepEqual(h.played, [1]);
});

test('保存队列只落精简标识，不写封面和文件句柄', () => {
  const h = loadQueueModule({ playQueue: makeSongs(3), currentIdx: 1, playMode: 'shuffle' });
  const snap = h.context.saveQueueSnapshot('我的存档');
  assert.equal(snap.name, '我的存档');
  assert.equal(snap.playMode, 'shuffle');
  assert.equal(snap.currentIdx, 1);
  assert.equal(snap.total, 3);
  assert.deepEqual(plain(snap.tracks), [
    { key: 'k0', localKey: 'k0', pathKey: 'p0', name: 'S0', artist: 'A0' },
    { key: 'k1', localKey: 'k1', pathKey: 'p1', name: 'S1', artist: 'A1' },
    { key: 'k2', localKey: 'k2', pathKey: 'p2', name: 'S2', artist: 'A2' },
  ]);
  const raw = h.stored['mineradio-queue-snapshots-v1'];
  assert.ok(raw);
  assert.doesNotMatch(raw, /localFile|cover|lyric/i);
  assert.equal(JSON.parse(raw).schema, 1);
  assert.deepEqual(h.toasts, ['已保存队列存档 · 3 首']);
});

test('空队列不允许保存', () => {
  const h = loadQueueModule({ playQueue: [], currentIdx: -1 });
  assert.equal(h.context.saveQueueSnapshot(''), null);
  assert.deepEqual(h.toasts, ['队列为空，没有可保存的内容']);
  assert.equal(h.stored['mineradio-queue-snapshots-v1'], undefined);
});

test('单份存档超过曲目上限时截断并提示', () => {
  const h = loadQueueModule({ playQueue: makeSongs(5), currentIdx: 0, trackLimit: 2 });
  const snap = h.context.saveQueueSnapshot('');
  assert.equal(snap.tracks.length, 2);
  assert.equal(snap.total, 5);
  assert.deepEqual(h.toasts, ['已保存队列存档（只存前 2 首）']);
});

test('存档份数超过上限时丢掉最旧的一份', () => {
  const h = loadQueueModule({ playQueue: makeSongs(2), currentIdx: 0, snapshotLimit: 2 });
  h.context.saveQueueSnapshot('一');
  h.context.saveQueueSnapshot('二');
  h.context.saveQueueSnapshot('三');
  assert.deepEqual(h.context.queueSnapshots.map((s) => s.name), ['三', '二']);
  assert.deepEqual(JSON.parse(h.stored['mineradio-queue-snapshots-v1']).items.map((s) => s.name), ['三', '二']);
});

test('默认存档名带上当前歌曲和曲目数', () => {
  const h = loadQueueModule({ playQueue: makeSongs(4), currentIdx: 2 });
  assert.match(h.context.defaultQueueSnapshotName(), /^S2 等 4 首 · \d+\/\d+ \d{2}:\d{2}$/);
  h.context.currentIdx = -1;
  assert.match(h.context.defaultQueueSnapshotName(), /^队列 4 首 · \d+\/\d+ \d{2}:\d{2}$/);
});

test('readQueueSnapshots 拒绝坏数据', () => {
  const good = JSON.stringify({ schema: 1, items: [{ id: 'a', tracks: [] }, { id: '', tracks: [] }, { id: 'b' }] });
  const h = loadQueueModule({ storage: { 'mineradio-queue-snapshots-v1': good } });
  assert.deepEqual(plain(h.context.readQueueSnapshots().map((s) => s.id)), ['a']);
  const bad = loadQueueModule({ storage: { 'mineradio-queue-snapshots-v1': '{broken' } });
  assert.deepEqual(plain(bad.context.readQueueSnapshots()), []);
  const wrongSchema = loadQueueModule({ storage: { 'mineradio-queue-snapshots-v1': JSON.stringify({ schema: 9, items: [{ id: 'a', tracks: [] }] }) } });
  assert.deepEqual(plain(wrongSchema.context.readQueueSnapshots()), []);
});

test('删除存档落盘并提示，删不存在的返回 false', () => {
  const h = loadQueueModule({ playQueue: makeSongs(2), currentIdx: 0 });
  const snap = h.context.saveQueueSnapshot('待删');
  assert.equal(h.context.deleteQueueSnapshot('不存在'), false);
  assert.equal(h.context.deleteQueueSnapshot(snap.id), true);
  assert.deepEqual(plain(h.context.queueSnapshots), []);
  assert.deepEqual(JSON.parse(h.stored['mineradio-queue-snapshots-v1']).items, []);
  assert.equal(h.toasts[h.toasts.length - 1], '已删除队列存档');
});

test('恢复存档按 localKey 命中，不打断正在播放的那一首', () => {
  const library = makeSongs(4);
  const h = loadQueueModule({ playQueue: [library[2]], currentIdx: 0, localLibrarySongs: library });
  h.context.queueSnapshots = [{
    id: 'q1',
    name: '存档',
    savedAt: Date.now(),
    playMode: 'loop',
    currentIdx: 0,
    total: 3,
    tracks: [
      { key: 'k0', localKey: 'k0', pathKey: 'p0', name: 'S0', artist: 'A0' },
      { key: 'k1', localKey: 'k1', pathKey: 'p1', name: 'S1', artist: 'A1' },
      { key: 'k2', localKey: 'k2', pathKey: 'p2', name: 'S2', artist: 'A2' },
    ],
  }];
  assert.equal(h.context.restoreQueueSnapshot('q1'), true);
  assert.deepEqual(plain(h.context.playQueue.map((s) => s.name)), ['S0', 'S1', 'S2']);
  // 原来在播 S2，恢复后 currentIdx 要跟着 S2 走，而不是回到存档里记的 0。
  assert.equal(h.context.currentIdx, 2);
  assert.equal(h.context.playQueue[h.context.currentIdx], library[2]);
  assert.deepEqual(h.played, []);
  assert.equal(h.toasts[h.toasts.length - 1], '已恢复队列 · 3 首');
  assert.ok(h.rendered.indexOf('restore-queue-snapshot') >= 0);
  assert.ok(h.shelfRebuilds.indexOf('restore-queue-snapshot') >= 0);
});

test('曲库重扫后 localKey 变了也能按路径键和曲名回落', () => {
  const library = makeSongs(3);
  library[0].localKey = 'k0-new';
  library[1].localKey = 'k1-new';
  library[1].localLibraryPathKey = 'p1-new';
  const h = loadQueueModule({ playQueue: [], currentIdx: -1, localLibrarySongs: library });
  h.context.queueSnapshots = [{
    id: 'q2', name: '旧存档', savedAt: 1, playMode: 'loop', currentIdx: 1, total: 4,
    tracks: [
      { key: 'k0', localKey: 'k0', pathKey: 'p0', name: 'S0', artist: 'A0' },
      { key: 'k1', localKey: 'k1', pathKey: 'p1', name: 'S1', artist: 'A1' },
      { key: 'k2', localKey: 'k2', pathKey: 'p2', name: 'S2', artist: 'A2' },
      { key: 'kX', localKey: 'kX', pathKey: 'pX', name: '已删除的歌', artist: '无' },
    ],
  }];
  assert.equal(h.context.restoreQueueSnapshot('q2'), true);
  // S0 靠路径键命中、S1 靠曲名+歌手命中、S2 靠 localKey 命中，第四首整曲缺失。
  assert.deepEqual(plain(h.context.playQueue.map((s) => s.name)), ['S0', 'S1', 'S2']);
  assert.equal(h.context.currentIdx, 1);
  assert.equal(h.toasts[h.toasts.length - 1], '已恢复队列 · 3 首（1 首不在当前曲库）');
});

test('恢复随机存档时把新队列标成已洗过，避免再洗一次', () => {
  const library = makeSongs(3);
  const h = loadQueueModule({ playQueue: [], currentIdx: -1, localLibrarySongs: library, playMode: 'loop' });
  h.context.queueSnapshots = [{
    id: 'q3', name: '随机存档', savedAt: 1, playMode: 'shuffle', currentIdx: 0, total: 3,
    tracks: library.map((s) => ({ key: s.localKey, localKey: s.localKey, pathKey: s.localLibraryPathKey, name: s.name, artist: s.artist })),
  }];
  assert.equal(h.context.restoreQueueSnapshot('q3'), true);
  assert.equal(h.context.playMode, 'shuffle');
  assert.equal(h.context.shuffledPlayQueueArrays.has(h.context.playQueue), true);
  assert.deepEqual(plain(h.context.shuffleCalls), []);
});

test('恢复存档会关掉播完即停', () => {
  const library = makeSongs(2);
  const h = loadQueueModule({ playQueue: [], currentIdx: -1, localLibrarySongs: library, stopAfterCurrentTrack: true });
  h.context.queueSnapshots = [{
    id: 'q4', name: '存档', savedAt: 1, playMode: 'loop', currentIdx: 0, total: 2,
    tracks: library.map((s) => ({ key: s.localKey, localKey: s.localKey, pathKey: s.localLibraryPathKey, name: s.name, artist: s.artist })),
  }];
  h.context.restoreQueueSnapshot('q4');
  assert.equal(h.context.stopAfterCurrentTrack, false);
});

test('存档整份失效或不存在时不动现有队列', () => {
  const current = makeSongs(2);
  const h = loadQueueModule({ playQueue: current, currentIdx: 1, localLibrarySongs: [] });
  h.context.queueSnapshots = [{
    id: 'q5', name: '全丢了', savedAt: 1, playMode: 'loop', currentIdx: 0, total: 1,
    tracks: [{ key: 'zz', localKey: 'zz', pathKey: 'zz', name: '没有的歌', artist: '没有的人' }],
  }];
  assert.equal(h.context.restoreQueueSnapshot('q5'), false);
  assert.equal(h.context.playQueue, current);
  assert.equal(h.context.currentIdx, 1);
  assert.equal(h.toasts[h.toasts.length - 1], '存档里的歌曲都不在当前曲库里');
  assert.equal(h.context.restoreQueueSnapshot('不存在的 id'), false);
  assert.equal(h.toasts[h.toasts.length - 1], '这份队列存档已经不在了');
});

test('存档列表渲染出恢复与删除入口，空态给提示', () => {
  const h = loadQueueModule({ playQueue: makeSongs(2), currentIdx: 0 });
  const host = h.nodes.get('queue-archive-list');
  h.context.renderQueueSnapshots();
  assert.match(host.innerHTML, /queue-archive-empty/);
  const snap = h.context.saveQueueSnapshot('存档甲');
  assert.match(host.innerHTML, new RegExp('data-queue-snapshot-restore="' + snap.id + '"'));
  assert.match(host.innerHTML, new RegExp('data-queue-snapshot-delete="' + snap.id + '"'));
  assert.match(host.innerHTML, /存档甲/);
  assert.match(host.innerHTML, /2 首 · 顺序循环 · \d+\/\d+ \d{2}:\d{2}/);
  // 名字里的尖括号必须转义，别让存档名把面板 HTML 撑开。
  h.context.saveQueueSnapshot('<img src=x>');
  assert.match(host.innerHTML, /&lt;img src=x&gt;/);
  assert.doesNotMatch(host.innerHTML, /<img src=x>/);
});

test('截断过的存档在列表里标出原始曲目数', () => {
  const h = loadQueueModule({ playQueue: makeSongs(5), currentIdx: 0, trackLimit: 2 });
  h.context.saveQueueSnapshot('截断');
  assert.match(h.nodes.get('queue-archive-list').innerHTML, /2 首（原 5 首）/);
});

test('存档列表的点击委托区分恢复和删除', () => {
  const library = makeSongs(2);
  const h = loadQueueModule({ playQueue: library, currentIdx: 0, localLibrarySongs: library });
  h.context.bindQueuePanelExtras();
  const snap = h.context.saveQueueSnapshot('存档');
  const host = h.nodes.get('queue-archive-list');

  const restoreBtn = createFakeNode('restore');
  restoreBtn.closest = (sel) => (sel.indexOf('data-queue-snapshot-restore') >= 0 ? restoreBtn : null);
  restoreBtn.setAttribute('data-queue-snapshot-restore', snap.id);
  host.fire('click', { target: restoreBtn, preventDefault() {}, stopPropagation() {} });
  assert.equal(h.toasts[h.toasts.length - 1], '已恢复队列 · 2 首');

  const delBtn = createFakeNode('del');
  delBtn.closest = (sel) => (sel.indexOf('data-queue-snapshot-delete') >= 0 ? delBtn : null);
  delBtn.setAttribute('data-queue-snapshot-delete', snap.id);
  host.fire('click', { target: delBtn, preventDefault() {}, stopPropagation() {} });
  assert.equal(h.toasts[h.toasts.length - 1], '已删除队列存档');
  assert.equal(h.context.queueSnapshots.length, 0);
});

test('队列面板的按钮和容器都在 index.html 里', () => {
  ['queue-mode-loop', 'queue-mode-single', 'queue-mode-shuffle', 'queue-stop-after-btn', 'queue-next-up', 'queue-archive-list']
    .forEach((id) => assert.match(indexSource, new RegExp('id="' + id + '"'), '缺少节点 ' + id));
  assert.match(indexSource, /onclick="setPlayMode\('loop'\)"/);
  assert.match(indexSource, /onclick="setPlayMode\('single'\)"/);
  assert.match(indexSource, /onclick="setPlayMode\('shuffle'\)"/);
  assert.match(indexSource, /onclick="toggleStopAfterCurrent\(\)"/);
  assert.match(indexSource, /onclick="saveCurrentQueueSnapshot\(\)"/);
  assert.match(indexSource, /onclick="clearQueue\(\)"/);
});

test('新增队列样式全部落在 app.css 里', () => {
  ['.queue-mode-row', '.queue-mode-btn', '.queue-next-up', '.queue-next-up-row', '.queue-next-up-stop',
   '.qi-drag', '.queue-item.dragging', '.queue-item.drop-before', '.queue-item.drop-after', '.queue-item.next-up',
   '.queue-archive', '.queue-archive-list', '.queue-archive-empty', '.queue-archive-main', '.queue-archive-del']
    .forEach((sel) => assert.ok(cssSource.indexOf(sel) >= 0, '缺少样式 ' + sel));
});

test('队列样式跟着主题令牌和强调色走，不写死青色', () => {
  const block = slice(cssSource, '.queue-chip{', '.pl-card{', '队列样式');
  // 写死 rgba(0,245,212,...) 的话，用户自己调的强调色和主题插件都带不动这一块。
  assert.doesNotMatch(block, /rgba\(0,\s*245,\s*212/);
  assert.match(block, /rgba\(var\(--fc-accent-rgb\),/);
  ['--th-chip-bg', '--th-chip-border', '--th-chip-hover-bg', '--th-row-bg', '--th-row-border', '--th-text-strong', '--th-text-dim', '--th-hairline-soft']
    .forEach((token) => assert.ok(block.includes(token), '队列样式缺少主题令牌 ' + token));
  // 拖动落点提示必须压过主题兼容层给 .queue-item 的 !important box-shadow，否则开主题就看不见落点。
  assert.match(block, /\.queue-item\.drop-before\{box-shadow:inset 0 2px 0 0 rgba\(var\(--fc-accent-rgb\),\.72\)!important\}/);
  assert.match(block, /\.queue-item\.drop-after\{box-shadow:inset 0 -2px 0 0 rgba\(var\(--fc-accent-rgb\),\.72\)!important\}/);
  assert.match(block, /\.queue-item\.dragging\{[^}]*border-color:rgba\(var\(--fc-accent-rgb\),\.28\)!important\}/);
});

test('播完即停挂在 onended 上，队列内拖动不再亮文件遮罩', () => {
  assert.match(appSource, /audio\.onended = function\(\)\{[\s\S]{0,200}?if \(stopAfterCurrentTrack\) \{\s*stopPlaybackAfterCurrentTrack\(\);\s*return;/);
  assert.match(appSource, /dragenter[\s\S]{0,80}?if \(queueDragState \|\| !dragEventHasFiles\(e\)\) return;/);
  assert.match(appSource, /dragleave[\s\S]{0,80}?if \(queueDragState \|\| !dragEventHasFiles\(e\)\) return;/);
  assert.match(appSource, /'drop', function\(e\)\{[\s\S]{0,120}?if \(queueDragState\) return;/);
});

test('队列存档键进入持久化白名单，重装不丢', () => {
  assert.match(appSource, /var QUEUE_SNAPSHOT_STORE_KEY = 'mineradio-queue-snapshots-v1';/);
  assert.match(appSource, /PERSISTENT_UI_STATE_KEYS = \[[\s\S]*?QUEUE_SNAPSHOT_STORE_KEY,[\s\S]*?\];/);
  assert.match(preloadSource, /'mineradio-queue-snapshots-v1',/);
  // 声明必须在白名单数组之前，否则数组求值时拿到 undefined。
  assert.ok(appSource.indexOf("var QUEUE_SNAPSHOT_STORE_KEY = 'mineradio-queue-snapshots-v1';") < appSource.indexOf('PERSISTENT_UI_STATE_KEYS = ['));
});

test('队列为空但有存档时不再被踢去歌单页', () => {
  const hits = appSource.match(/queueViewTab === 'queue' && !queueSnapshots\.length\) switchPlaylistTab\('playlists'\)/g) || [];
  assert.equal(hits.length, 2);
});

test('启动时读回存档并刷新队列面板控件', () => {
  assert.match(appSource, /queueSnapshots = readQueueSnapshots\(\);\s*bindQueueDragReorder\(\);\s*bindQueuePanelExtras\(\);\s*renderQueueSnapshots\(\);\s*updateStopAfterCurrentButton\(\);\s*updatePlayModeButtonRow\(\);/);
});

const REMOVE_FROM_QUEUE_SOURCE = slice(
  appSource,
  'function removeFromQueue(idx) {',
  'function playModeLabel(mode) {',
  '从队列移除实现'
);

/**
 * 单独跑 removeFromQueue，观察队列与当前下标的联动。
 * @param {Array<object>} queue 初始队列。
 * @param {number} currentIdx 初始当前下标。
 * @returns {object} 测试夹具。
 */
function loadRemoveModule(queue, currentIdx) {
  const rendered = [];
  const context = {
    playQueue: queue,
    currentIdx,
    markQueueContentChanged: () => {},
    savePlaybackSession: () => {},
    safeRenderQueuePanel: (reason) => rendered.push(String(reason)),
    safeShelfRebuild: () => {},
    updateCustomCoverButton: () => {},
    updateCustomLyricControls: () => {},
    updateEmptyHomeVisibility: () => {},
  };
  vm.runInNewContext(REMOVE_FROM_QUEUE_SOURCE, context);
  return { context, rendered };
}

test('从队列移除时当前播放指针跟着搬，不错位到别的歌', () => {
  const queue = makeSongs(5);
  const playing = queue[3];
  const h = loadRemoveModule(queue, 3);

  // 删当前歌曲之前的条目：下标前移一格，指向的还是同一首。
  h.context.removeFromQueue(1);
  assert.equal(h.context.currentIdx, 2);
  assert.equal(h.context.playQueue[h.context.currentIdx], playing);

  // 删当前歌曲之后的条目：下标不动。
  h.context.removeFromQueue(3);
  assert.equal(h.context.currentIdx, 2);
  assert.equal(h.context.playQueue[h.context.currentIdx], playing);
  assert.deepEqual(plain(h.context.playQueue.map((s) => s.name)), ['S0', 'S2', 'S3']);

  // 删掉的正好是末尾的当前歌曲：下标夹回最后一首，不越界。
  h.context.removeFromQueue(2);
  assert.equal(h.context.currentIdx, 1);
  assert.equal(h.context.playQueue.length, 2);
  assert.deepEqual(h.rendered, ['remove-queue-item', 'remove-queue-item', 'remove-queue-item']);
});

test('从队列移除越界下标是空操作', () => {
  const h = loadRemoveModule(makeSongs(2), 0);
  h.context.removeFromQueue(-1);
  h.context.removeFromQueue(2);
  assert.equal(h.context.playQueue.length, 2);
  assert.deepEqual(h.rendered, []);
});
