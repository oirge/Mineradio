'use strict';
// 断点续播 / 单曲播放统计守卫。
// 这套东西最容易出的错不是「记不住位置」，而是「记错位置」：切歌那一瞬间把新歌的 0 秒写到旧歌头上，
// 或者把还没用上的断点抹掉，用户看到的都是「续播乱跳」。所以这里逐条钉死三道闸门
// （听够 15 秒 / 尾巴还剩 20 秒 / 最多 400 条）和起播秒数的取值优先级。

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
const htmlSource = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const cssSource = fs.readFileSync(path.join(root, 'public', 'app.css'), 'utf8');

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

const STORE_SOURCE = slice(
  appSource,
  'function formatListenDurationText(ms) {',
  'function fallbackHomeTiles() {',
  '听歌统计与断点存档',
);
const RESUME_SOURCE = slice(
  appSource,
  'function resolveLastPlaybackTarget() {',
  'function replayGainHintText() {',
  '继续上次播放',
);
const START_SOURCE = slice(
  appSource,
  'function resolveTrackStartSeconds(song, opts) {',
  'async function playLocalQueueItem(',
  '起播秒数与断点节流',
);
/**
 * 把 vm 里创建的对象拷回本 realm，供 deepEqual 比较。
 * @param {*} value 待转换值。
 * @returns {*} 结构相同的本 realm 值。
 */
function plain(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

/**
 * 造一个够用的假节点：断点面板只读写 class / 属性 / textContent。
 * @param {string} id 节点标识。
 * @returns {object} 假节点。
 */
function createFakeNode(id) {
  const classNames = new Set();
  const attrs = new Map();
  return {
    id,
    textContent: '',
    focusCount: 0,
    classNames,
    classList: {
      add() { for (const name of arguments) classNames.add(name); },
      remove() { for (const name of arguments) classNames.delete(name); },
      toggle(name, on) { if (on) classNames.add(name); else classNames.delete(name); },
      contains(name) { return classNames.has(name); },
    },
    setAttribute(name, value) { attrs.set(name, String(value)); },
    getAttribute(name) { return attrs.has(name) ? attrs.get(name) : null; },
    focus() { this.focusCount++; },
  };
}

/**
 * 在 vm 里跑起断点续播模块：统计表、播放会话、音频元素全是可观测的桩。
 * @param {object=} options 桩配置。
 * @returns {object} 上下文与各类调用记录。
 */
function loadResumeModule(options) {
  const opts = options || {};
  const stored = [];
  const toasts = [];
  const played = [];
  const timers = [];
  const rendered = [];
  const nodes = new Map();
  ['t-songResume', 'song-resume-value', 'song-resume-hint', 'listen-history-clear-modal',
    'listen-history-clear-name', 'listen-history-clear-meta', 'listen-history-clear-cancel',
  ].forEach((id) => nodes.set(id, createFakeNode(id)));
  const listenStats = {
    history: opts.history ? JSON.parse(JSON.stringify(opts.history)) : [],
    songs: opts.songs ? JSON.parse(JSON.stringify(opts.songs)) : {},
    artists: opts.artists ? JSON.parse(JSON.stringify(opts.artists)) : {},
    updatedAt: 0,
  };
  const audio = opts.audio === null ? null : Object.assign({ src: 'file://a.mp3', ended: false }, opts.audio || {});
  const context = {
    console, JSON, Object, Array, String, Number, Math, Date, Boolean, Promise, Infinity, isNaN,
    // 存档键声明在 app.js 顶部的持久化白名单里，切片不到，这里按真实取值补上（下面有一条测试盯着它别漂）。
    SONG_RESUME_STORE_KEY: 'mineradio-song-resume-v1',
    setTimeout(fn, delay) { timers.push({ fn, delay }); return timers.length; },
    clearTimeout(id) { if (timers[id - 1]) timers[id - 1] = { fn() {}, delay: 0, cleared: true }; },
    localStorage: {
      store: Object.assign({}, opts.localStorage || {}),
      getItem(key) { return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null; },
      setItem(key, value) { this.store[key] = String(value); },
    },
    setPersistentLocalStorageItem(key, value) { stored.push({ key, value }); },
    showToast(message) { toasts.push(String(message)); },
    queueItemKey(song) { return song ? String(song.key || song.path || song.name || '') : ''; },
    ensureListenStatsState() { return listenStats; },
    saveListenStatsState() { listenStats.updatedAt = 1; rendered.push('save-listen-stats'); },
    formatProgramTime(sec) {
      const total = Math.max(0, Math.floor(Number(sec) || 0));
      return Math.floor(total / 60) + ':' + (total % 60 < 10 ? '0' : '') + (total % 60);
    },
    detailRow(label, value) { return '<div class="detail-row">' + label + '=' + value + '</div>'; },
    openGsapModal(el) { rendered.push('open:' + (el && el.id)); if (el) el.classList.add('show'); },
    closeGsapModal(el, after) {
      rendered.push('close:' + (el && el.id));
      if (el) el.classList.remove('show');
      if (typeof after === 'function') after();
    },
    invalidateLocalLibraryCategoryIndex() { rendered.push('invalidate-index'); },
    renderLocalLibraryPlaylistPanel() { rendered.push('render-panel'); },
    renderHomeDiscover() { rendered.push('render-home'); },
    clearLocalLibraryPassiveQueue() { rendered.push('clear-passive'); },
    forcePlaybackControlsInteractive() { rendered.push('force-interactive'); },
    clearPlaybackSession() { rendered.push('clear-session'); },
    readPlaybackSession() { return opts.session || null; },
    findPlaybackSessionIndex(queue, session) {
      if (!session || !session.songKey) return -1;
      for (let i = 0; i < queue.length; i++) {
        if (context.queueItemKey(queue[i]) === session.songKey) return i;
      }
      return -1;
    },
    getPlaybackCurrentSeconds() { return Number(opts.currentSeconds) || 0; },
    getPlaybackDurationSeconds() { return Number(opts.durationSeconds) || 0; },
    playQueueAt(idx, playOpts) { played.push({ idx, opts: playOpts }); return Promise.resolve(); },
    playlistPanelLastDomSignature: 'stale-signature',
    pendingPlaybackSessionResume: opts.pending || { idx: -1, time: 0 },
    playQueue: opts.queue || [],
    currentLocalSong: opts.currentLocalSong || null,
    playToggleBusy: true,
    emptyHomeActive: !!opts.emptyHomeActive,
    audio,
    document: {
      getElementById(id) { return nodes.has(id) ? nodes.get(id) : null; },
    },
  };
  context.window = context;
  vm.runInNewContext(STORE_SOURCE + '\n' + RESUME_SOURCE + '\n' + START_SOURCE, context, { filename: 'song-resume.js' });
  return { context, stored, toasts, played, timers, rendered, nodes, listenStats };
}

/**
 * 把断点存档里的秒数摊平成 `key -> sec`，方便直接比对。
 * @param {object} harness 模块上下文。
 * @returns {Record<string, number>} 断点表。
 */
function resumeMap(harness) {
  const songs = harness.context.ensureSongResumeState().songs;
  const out = {};
  Object.keys(songs).forEach((key) => { out[key] = songs[key].sec; });
  return out;
}
test('只有「听够 15 秒、尾巴还剩 20 秒」的位置才会记成断点', () => {
  const harness = loadResumeModule();
  const record = harness.context.recordSongResumePosition;
  record({ key: 'a', name: 'A' }, 14.4, 300);
  assert.deepEqual(resumeMap(harness), {}, '不到 15 秒是噪声，记下来只会让下次莫名从中间开始');
  record({ key: 'a', name: 'A' }, 62.34, 300);
  assert.deepEqual(resumeMap(harness), { a: 62.3 }, '秒数保留一位小数就够，别把浮点尾巴写进存档');
  record({ key: 'b', name: 'B' }, 190, 200);
  assert.equal(Object.prototype.hasOwnProperty.call(resumeMap(harness), 'b'), false, '尾巴不足 20 秒等于听完，不该留断点');
  record({ key: 'c', name: 'C' }, 40, 0);
  assert.equal(resumeMap(harness).c, 40, '时长还没解析出来时不能因此拒记，否则流式解码的歌永远记不上断点');
});

test('从「听了一半」退回 15 秒以内会把旧断点删掉', () => {
  const harness = loadResumeModule();
  const record = harness.context.recordSongResumePosition;
  record({ key: 'a', name: 'A' }, 90, 300);
  assert.deepEqual(resumeMap(harness), { a: 90 });
  record({ key: 'a', name: 'A' }, 3, 300);
  assert.deepEqual(resumeMap(harness), {}, '用户自己拖回开头就是不想续播了');
});

test('听完一首会清掉它的断点，而且立刻落盘', () => {
  const harness = loadResumeModule();
  harness.context.recordSongResumePosition({ key: 'a', name: 'A' }, 90, 300);
  const before = harness.stored.length;
  harness.context.clearSongResumePosition({ key: 'a', name: 'A' });
  assert.deepEqual(resumeMap(harness), {});
  assert.ok(harness.stored.length > before, '清断点必须 force 落盘，否则进程被杀就留着一个假断点');
});

test('断点最多留 400 条，超了按最后记录时间淘汰最旧的', () => {
  const harness = loadResumeModule();
  const record = harness.context.recordSongResumePosition;
  const state = harness.context.ensureSongResumeState();
  for (let i = 0; i < 400; i++) record({ key: 'song-' + i, name: 'S' + i }, 60, 300);
  assert.equal(Object.keys(state.songs).length, 400);
  // 时间戳按写入顺序拉开，保证「最旧」是确定的那一条，而不是同一毫秒里的随便一条。
  Object.keys(state.songs).forEach((key, idx) => { state.songs[key].at = 1000 + idx; });
  record({ key: 'song-new', name: '新歌' }, 60, 300);
  const keys = Object.keys(state.songs);
  assert.equal(keys.length, 400, '上限必须是硬的，否则几万首的库会把 localStorage 撑爆');
  assert.equal(keys.indexOf('song-0'), -1, '最旧的一条必须被淘汰');
  assert.ok(keys.indexOf('song-new') >= 0);
  assert.ok(keys.indexOf('song-399') >= 0);
});
test('读存档时丢掉不足 15 秒的脏数据，enabled 缺省算开启', () => {
  const harness = loadResumeModule({
    localStorage: {
      'mineradio-song-resume-v1': JSON.stringify({
        schema: 1,
        songs: { good: { sec: 88.5, dur: 300, at: 7, name: '好' }, bad: { sec: 4, dur: 300 }, junk: 3 },
      }),
    },
  });
  const state = harness.context.ensureSongResumeState();
  assert.equal(state.enabled, true, '老存档没有 enabled 字段，不能当成关闭');
  assert.deepEqual(Object.keys(state.songs), ['good']);
  assert.equal(state.songs.good.sec, 88.5);
  assert.equal(state.songs.good.name, '好');
});

test('存档坏了不炸，直接退回空存档', () => {
  const harness = loadResumeModule({ localStorage: { 'mineradio-song-resume-v1': '{不是 json' } });
  const state = harness.context.ensureSongResumeState();
  assert.equal(state.enabled, true);
  assert.deepEqual(plain(state.songs), {});
});

test('普通写入合到一个延迟里，force 才立刻落盘', () => {
  const harness = loadResumeModule();
  harness.context.recordSongResumePosition({ key: 'a', name: 'A' }, 90, 300);
  harness.context.recordSongResumePosition({ key: 'b', name: 'B' }, 90, 300);
  assert.equal(harness.stored.length, 0, '进度回调每 2.2 秒来一次，不能每次都砸 localStorage');
  assert.equal(harness.timers.filter((t) => !t.cleared).length, 1, '多次写入只排一个定时器');
  assert.equal(harness.timers[0].delay, 1200);
  harness.timers[0].fn();
  assert.equal(harness.stored.length, 1);
  assert.equal(harness.stored[0].key, 'mineradio-song-resume-v1');
  const saved = JSON.parse(harness.stored[0].value);
  assert.deepEqual(Object.keys(saved.songs).sort(), ['a', 'b']);
});

test('关掉断点续播后不再读断点，起播秒数回到 0', () => {
  const harness = loadResumeModule();
  const song = { key: 'a', name: 'A' };
  harness.context.recordSongResumePosition(song, 90, 300);
  assert.equal(harness.context.songResumeSeconds(song), 90);
  assert.equal(harness.context.songResumePositionText(song), '1:30');
  harness.context.setSongResumeEnabled(false);
  assert.equal(harness.context.resolveTrackStartSeconds(song, {}), 0);
  assert.equal(harness.context.songResumeSeconds(song), 90, '关开关只是不用断点，不该把用户攒的位置删掉');
  assert.ok(harness.toasts.indexOf('断点续播已关闭') >= 0);
});
test('起播秒数优先级：显式 resumeAt > 单曲循环归零 > 自己的断点', () => {
  const harness = loadResumeModule();
  const song = { key: 'a', name: 'A' };
  harness.context.recordSongResumePosition(song, 90, 300);
  assert.equal(harness.context.resolveTrackStartSeconds(song, { resumeAt: 12 }), 12, '启动恢复和「继续上次播放」传的位置最权威');
  assert.equal(harness.context.resolveTrackStartSeconds(song, { resumeAt: 12, autoRepeat: true }), 12);
  assert.equal(harness.context.resolveTrackStartSeconds(song, { autoRepeat: true }), 0, '单曲循环必须从头，否则一首歌卡在断点上原地打转');
  assert.equal(harness.context.resolveTrackStartSeconds(song, {}), 90);
  assert.equal(harness.context.resolveTrackStartSeconds(song), 90, 'opts 缺省也要能走到断点');
  assert.equal(harness.context.resolveTrackStartSeconds({ key: 'never', name: 'N' }, {}), 0);
});

test('节流记位置只认音频元素当前装着的那首歌', () => {
  const playing = { key: 'playing', name: '正在播' };
  const harness = loadResumeModule({ currentLocalSong: playing, currentSeconds: 77, durationSeconds: 300 });
  harness.context.recordSongResumeTick();
  assert.deepEqual(resumeMap(harness), { playing: 77 });
  // playQueue[currentIdx] 在 playQueueAt 里会先于 audio.src 变更，用它记位置就会把新歌的进度写到旧歌头上。
  harness.context.currentLocalSong = null;
  harness.context.recordSongResumeTick();
  assert.deepEqual(resumeMap(harness), { playing: 77 }, '没有当前歌就什么都别记');
});

test('切歌后 seek 还没生效的 0 秒窗口不能抹掉断点', () => {
  const song = { key: 'a', name: 'A' };
  const harness = loadResumeModule({ currentLocalSong: song, currentSeconds: 0.4, durationSeconds: 300 });
  harness.context.recordSongResumePosition(song, 90, 300);
  harness.context.recordSongResumeTick();
  assert.deepEqual(resumeMap(harness), { a: 90 }, '起播瞬间还是 0 秒，这时候记位置等于把还没用上的断点删了');
});

test('停播、没有音频源、或者已经播完都不记位置', () => {
  const song = { key: 'a', name: 'A' };
  const noSrc = loadResumeModule({ currentLocalSong: song, currentSeconds: 77, durationSeconds: 300, audio: { src: '' } });
  noSrc.context.recordSongResumeTick();
  assert.deepEqual(resumeMap(noSrc), {});
  const ended = loadResumeModule({ currentLocalSong: song, currentSeconds: 299, durationSeconds: 300, audio: { ended: true } });
  ended.context.recordSongResumeTick();
  assert.deepEqual(resumeMap(ended), {});
  const off = loadResumeModule({ currentLocalSong: song, currentSeconds: 77, durationSeconds: 300 });
  off.context.setSongResumeEnabled(false, { silent: true });
  off.context.recordSongResumeTick();
  assert.deepEqual(resumeMap(off), {}, '开关关着就一条都不该记');
});
const QUEUE = [{ key: 'a', name: 'A' }, { key: 'b', name: 'B' }, { key: 'c', name: 'C' }, { key: 'd', name: 'D' }];

test('「继续上次播放」优先级：待恢复会话 > 磁盘会话 > 最近播放', () => {
  const pending = loadResumeModule({
    queue: QUEUE,
    pending: { idx: 2, time: 33 },
    session: { songKey: 'a', currentTime: 5 },
    history: [{ key: 'd' }],
  });
  assert.deepEqual(plain(pending.context.resolveLastPlaybackTarget()), { idx: 2, time: 33, from: 'pending' });

  const session = loadResumeModule({
    queue: QUEUE,
    session: { songKey: 'c', currentTime: 44.6 },
    history: [{ key: 'd' }],
  });
  assert.deepEqual(plain(session.context.resolveLastPlaybackTarget()), { idx: 2, time: 44.6, from: 'session' });

  const history = loadResumeModule({ queue: QUEUE, history: [{ key: 'd' }, { key: 'b' }] });
  history.context.recordSongResumePosition(QUEUE[3], 120, 300);
  assert.deepEqual(plain(history.context.resolveLastPlaybackTarget()), { idx: 3, time: 120, from: 'history' });
});

test('待恢复索引越界时退回磁盘会话，两者都不在队列里就看最近播放', () => {
  const harness = loadResumeModule({
    queue: QUEUE,
    pending: { idx: 99, time: 33 },
    session: { songKey: 'not-in-queue', currentTime: 44 },
    history: [{ key: 'gone' }, { key: 'b' }],
  });
  assert.deepEqual(plain(harness.context.resolveLastPlaybackTarget()), { idx: 1, time: 0, from: 'history' });
});

test('队列空、或者最近播放里的歌都不在队列里，就没有可继续的目标', () => {
  assert.equal(loadResumeModule({ queue: [], history: [{ key: 'a' }] }).context.resolveLastPlaybackTarget(), null);
  assert.equal(loadResumeModule({ queue: QUEUE }).context.resolveLastPlaybackTarget(), null);
  assert.equal(loadResumeModule({ queue: QUEUE, history: [{ key: 'gone' }] }).context.resolveLastPlaybackTarget(), null);
  assert.equal(loadResumeModule({ queue: QUEUE, history: [{}, { key: '' }] }).context.resolveLastPlaybackTarget(), null);
});

test('最近播放里越靠前的那首赢，扫队列只走一遍也要拿到最靠前的记录', () => {
  // 队列顺序（b 在前）和最近播放顺序（d 在前）故意相反：先命中的不能直接算赢。
  const harness = loadResumeModule({ queue: QUEUE, history: [{ key: 'd' }, { key: 'b' }, { key: 'd' }] });
  const target = harness.context.resolveLastPlaybackTarget();
  assert.equal(target.idx, 3);
  assert.equal(target.from, 'history');
});
test('「继续上次播放」直接带着位置起播，并且解掉切歌互斥锁', () => {
  const harness = loadResumeModule({ queue: QUEUE, pending: { idx: 2, time: 33 } });
  assert.equal(harness.context.resumeLastPlayback('panel'), true);
  assert.deepEqual(plain(harness.played), [{ idx: 2, opts: { manual: true, resumeAt: 33 } }]);
  assert.deepEqual(plain(harness.context.pendingPlaybackSessionResume), { idx: -1, time: 0 }, '用掉的待恢复位置要清掉，否则下一次还会跳回这里');
  assert.equal(harness.context.playToggleBusy, false, '卡住的 playToggleBusy 会让按钮点不动');
  assert.ok(harness.rendered.indexOf('clear-passive') >= 0, '要先清掉被动队列，否则续播会被本地曲库的临时队列顶掉');
  assert.equal(harness.toasts[0], '继续播放：C · 0:33');
});

test('不足 1 秒的位置不在提示里报时间', () => {
  const harness = loadResumeModule({ queue: QUEUE, pending: { idx: 0, time: 0 } });
  assert.equal(harness.context.resumeLastPlayback('hotkey'), true);
  assert.equal(harness.toasts[0], '继续播放：A');
});

test('没有播放记录时「继续上次播放」只提示，不乱播一首', () => {
  const empty = loadResumeModule({ queue: [] });
  assert.equal(empty.context.resumeLastPlayback('panel'), false);
  assert.deepEqual(empty.played, []);
  assert.equal(empty.toasts[0], '先导入本地音乐再继续播放');

  const noRecord = loadResumeModule({ queue: QUEUE });
  assert.equal(noRecord.context.resumeLastPlayback('panel'), false);
  assert.deepEqual(noRecord.played, []);
  assert.equal(noRecord.toasts[0], '还没有可以继续的播放记录');
});

test('面板上的断点开关、断点数量和说明文案跟着状态走', () => {
  const harness = loadResumeModule();
  harness.context.initSongResumeControls();
  const toggle = harness.nodes.get('t-songResume');
  assert.equal(toggle.classList.contains('on'), true);
  assert.equal(toggle.getAttribute('aria-pressed'), 'true');
  assert.equal(harness.nodes.get('song-resume-value').textContent, '暂无断点');
  assert.match(harness.nodes.get('song-resume-hint').textContent, /下次播到同一首会自动从断点接上/);

  harness.context.recordSongResumePosition({ key: 'a', name: 'A' }, 90, 300);
  harness.context.recordSongResumePosition({ key: 'b', name: 'B' }, 90, 300);
  harness.context.updateSongResumeControls();
  assert.equal(harness.nodes.get('song-resume-value').textContent, '2 个断点');

  harness.context.toggleSongResumeSetting();
  assert.equal(toggle.classList.contains('on'), false);
  assert.equal(toggle.getAttribute('aria-pressed'), 'false');
  assert.match(harness.nodes.get('song-resume-hint').textContent, /每首歌都从头开始播放/);
});
test('起播路径真的走 resolveTrackStartSeconds，而不是只看 opts.resumeAt', () => {
  assert.match(appSource, /scheduleAudioResumePosition\(audio, resolveTrackStartSeconds\(song, opts\), token\);/);
});

test('位置在三个关键时刻被定住：节流、切歌前、播完清掉', () => {
  // 节流：和会话记录共用一条 2.2 秒的节流，位置够准又不会一直砸存储。
  assert.match(appSource, /function writePlaybackSession\(\)\s*\{[\s\S]{0,240}?recordSongResumeTick\(\);/);
  // 切歌前：这一步之后 currentIdx 就变了，再记就记到新歌头上。
  assert.match(
    appSource,
    /safePlaybackStep\('song-resume-record', recordSongResumeTick\);[\s\S]{0,200}?currentIdx = idx;/,
    '记断点必须排在 currentIdx = idx 之前',
  );
  // 播完清掉：不清的话重播一首听完的歌会直接跳到中间。
  assert.match(appSource, /finalizeListenSession\(true\);\s*clearSongResumePosition\(song\);/);
});

test('断点续播开关在启动时同步一次 UI', () => {
  assert.match(appSource, /initSongResumeControls\(\);\s*initAutoPlaybackControls\(\);/);
});

test('断点存档进了三份持久化白名单，卸载重装不会丢位置', () => {
  const mainSource = fs.readFileSync(path.join(root, 'desktop', 'main.js'), 'utf8');
  const preloadSource = fs.readFileSync(path.join(root, 'desktop', 'preload.js'), 'utf8');
  for (const [label, source] of [['主进程', mainSource], ['preload', preloadSource], ['渲染层', appSource]]) {
    assert.ok(source.includes('mineradio-song-resume-v1'), label + ' 缺少断点存档键');
  }
  assert.match(mainSource, /'mineradio-playback-session-v1',\s*'mineradio-song-resume-v1',/);
  assert.match(preloadSource, /'mineradio-playback-session-v1',\s*'mineradio-song-resume-v1',/);
  // 上面 vm 里的桩直接写死了这个键，取值漂了就得同步改测试。
  assert.match(appSource, /var SONG_RESUME_STORE_KEY = 'mineradio-song-resume-v1';/);
});

test('「继续上次播放」既有面板按钮也能绑热键', () => {
  assert.match(htmlSource, /onclick="resumeLastPlayback\('panel'\)"/);
  assert.match(appSource, /\{ key:'resumeLastPlayback', label:'继续上次播放'/);
  // 新动作默认不占键：默认值里塞一个键就可能和用户现有的绑定撞车。
  assert.match(appSource, /\{ key:'resumeLastPlayback', label:'继续上次播放', category:'播放', local:'', global:'' \}/);
  assert.match(appSource, /if \(actionKey === 'resumeLastPlayback'\) \{\s*if \(typeof resumeLastPlayback === 'function'\) return resumeLastPlayback\('hotkey'\);/);
});
test('断点续播那一段 UI 挂在播放折叠里，说明写清了两道闸门', () => {
  const fold = slice(htmlSource, 'id="fx-playback-fold"', '</section>', '播放折叠');
  assert.ok(fold.includes('<div class="fx-section-label">断点续播</div>'));
  assert.match(fold, /id="t-songResume" onclick="toggleSongResumeSetting\(\)"/);
  assert.ok(fold.includes('id="song-resume-value"'));
  assert.ok(fold.includes('id="song-resume-hint"'));
  // 15 秒和 20 秒这两个门槛必须写在界面上，否则用户只会觉得「有时候记有时候不记」。
  assert.match(fold, /15 秒以上/);
  assert.match(fold, /20 秒以上/);
});

test('列表行的统计摘要复用 .pl-sub，颜色只走强调色变量', () => {
  // 主题只能改 --th-* 与主题白名单里的类名；写死 rgba(0,245,212) 会让所有主题都失效。
  const rule = slice(cssSource, '.pl-sub.pl-listen-stat{', '\n', '统计摘要样式');
  assert.match(rule, /color:rgba\(var\(--fc-accent-rgb\)/);
  assert.ok(!/rgba\(0, ?245, ?212/.test(rule), '强调色必须走 --fc-accent-rgb，不能写死青色');
  assert.match(rule, /font-variant-numeric:tabular-nums/, '数字要等宽，否则每行的时间会左右跳');
});
