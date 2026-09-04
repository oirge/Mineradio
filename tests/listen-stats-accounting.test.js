'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SOURCE = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');

/**
 * 按函数名截取真实源码片段，测试不复制生产实现。
 * @param {string} startMarker 起始标记。
 * @param {string} endMarker 结束标记。
 * @returns {string} 源码片段。
 */
function slice(startMarker, endMarker) {
  const start = SOURCE.indexOf(startMarker);
  const end = SOURCE.indexOf(endMarker, start + 1);
  assert.ok(start >= 0 && end > start, '未找到接缝: ' + startMarker);
  return SOURCE.slice(start, end);
}

/**
 * 建立听歌会话计时与结算的 vm 上下文，播放器与统计存储全部伪造。
 * @param {object} options duration 为伪造的音频时长（NaN 表示还没解析出时长）。
 * @returns {object} vm 上下文。
 */
function createListenContext(options) {
  const opts = options || {};
  const context = {
    Math,
    JSON,
    Promise,
    isFinite,
    console: { warn: () => {} },
    audio: { duration: opts.duration, currentTime: 0, paused: false },
    listenSession: null,
    activePlaybackContext: null,
    listenStatsState: { history: [], songs: {}, artists: {}, updatedAt: 0 },
    emptyHomeActive: false,
    now: 1700000000000,
    saveCount: 0,
    dbPlayStats: [],
  };
  context.Date = { now: () => context.now };
  context.currentCoverSong = () => context.playing || null;
  context.queueItemKey = (song) => String((song && song.key) || '');
  context.listenSongSnapshot = (song) => ({
    key: context.queueItemKey(song), id: '', mid: '', mediaMid: '', type: 'local', sourceKey: 'local',
    name: (song && song.name) || '未知歌曲', artist: (song && song.artist) || '歌手', cover: '', source: '本地',
    provider: 'local', duration: 0, localKey: (song && song.localKey) || 'lk', pathKey: 'pk',
  });
  return finishListenContext(context);
}

/**
 * 补齐统计存储桩并把真实源码跑进上下文。
 * @param {object} context 已备好播放器桩的上下文。
 * @returns {object} vm 上下文。
 */
function finishListenContext(context) {
  context.ensureListenStatsState = () => context.listenStatsState;
  context.compactListenStatsHistory = (record, history, limit) => [record].concat(history || []).slice(0, limit);
  context.visitListenArtistNames = (text, fn) => { if (text) fn(String(text)); };
  context.saveListenStatsState = () => { context.saveCount += 1; };
  context.syncLocalLibraryDbPlayStat = (snap, payload) => { context.dbPlayStats.push({ snap, payload }); };
  context.renderHomeDiscover = () => {};
  vm.runInNewContext(
    slice('var LISTEN_TICK_CATCHUP_MAX_MS = ', '\nvar appPerfMarks')
      + '\n' + slice('function beginListenSession(', 'function mostPlayedSong(')
      + '\nthis.api = { beginListenSession, updateListenStatsTick, finalizeListenSession };'
      + '\n/** @returns {object|null} 返回当前听歌会话。 */'
      + '\nthis.session = function(){ return listenSession; };'
      + '\nthis.catchupMax = LISTEN_TICK_CATCHUP_MAX_MS;',
    context,
  );
  return context;
}

/**
 * 从头开始一场听歌会话。
 * @param {object} context vm 上下文。
 * @param {string} key 队列键。
 * @returns {void}
 */
function startSession(context, key) {
  context.playing = { key: key, name: key.toUpperCase(), localKey: key };
  context.api.beginListenSession(context.playing, null);
}

/**
 * 模拟连续播放：按固定步长同步推进墙钟与音频时间并发 tick。
 * @param {object} context vm 上下文。
 * @param {number} totalMs 播放总时长。
 * @param {number} stepMs 每次 tick 的间隔。
 * @returns {void}
 */
function playFor(context, totalMs, stepMs) {
  for (let elapsed = 0; elapsed < totalMs; elapsed += stepMs) {
    context.now += stepMs;
    context.audio.currentTime += stepMs / 1000;
    context.api.updateListenStatsTick(false);
  }
}

/**
 * 时长未知的文件（APE/DSF 虚拟 WAV、元数据未解析）也必须累计收听时长，
 * 否则结算门里「无时长看 30 秒」那条兜底永远走不到。
 * @returns {void}
 */
function testDurationlessFileAccumulates() {
  const context = createListenContext({ duration: NaN });
  startSession(context, 'local:a');
  playFor(context, 31000, 1000);
  assert.ok(context.session().listenMs >= 30000, '无时长文件必须能累计 listenMs');
  context.api.finalizeListenSession(false);
  const stat = context.listenStatsState.songs['local:a'];
  assert.ok(stat, '无时长文件听满 30 秒必须记一次播放');
  assert.equal(stat.plays, 1);
  assert.equal(context.saveCount, 1);
  assert.equal(context.dbPlayStats.length, 1);
  assert.equal(context.dbPlayStats[0].payload.completed, false);

  // 同一首没听够 30 秒仍然不记账，兜底只是兜底，不是放行。
  const shortListen = createListenContext({ duration: NaN });
  startSession(shortListen, 'local:a2');
  playFor(shortListen, 12000, 1000);
  shortListen.api.finalizeListenSession(false);
  assert.equal(shortListen.listenStatsState.songs['local:a2'], undefined, '无时长文件只听 12 秒不该记账');
}

/**
 * 有时长文件的三条结算门（听完 / 45 秒 / 一半进度）按设计保持不变。
 * @returns {void}
 */
function testDurationGatesUnchanged() {
  const skipped = createListenContext({ duration: 300 });
  startSession(skipped, 'local:b');
  playFor(skipped, 10000, 1000);
  skipped.api.finalizeListenSession(false);
  assert.equal(skipped.listenStatsState.songs['local:b'], undefined, '只听 10 秒的跳过不该记一次播放');

  const halfway = createListenContext({ duration: 60 });
  startSession(halfway, 'local:c');
  playFor(halfway, 30000, 1000);
  assert.ok(halfway.session().listenMs < 45000);
  halfway.api.finalizeListenSession(false);
  assert.ok(halfway.listenStatsState.songs['local:c'], '听过一半必须记一次播放');

  const longTrack = createListenContext({ duration: 3600 });
  startSession(longTrack, 'local:d');
  playFor(longTrack, 46000, 1000);
  assert.ok(longTrack.session().maxProgress < 0.5);
  longTrack.api.finalizeListenSession(false);
  assert.ok(longTrack.listenStatsState.songs['local:d'], '长曲听满 45 秒必须记一次播放');
}

/**
 * 最小化期间不发 tick，回到前台要按音频与墙钟的同步推进量整段补回；
 * 拖动进度条只推进音频时间，不能记成收听；补账要有上限。
 * @returns {void}
 */
function testBackgroundCatchUpAndSeekRejection() {
  const background = createListenContext({ duration: 600 });
  startSession(background, 'local:e');
  playFor(background, 2000, 1000);
  const before = background.session().listenMs;
  background.now += 180000;
  background.audio.currentTime += 180;
  background.api.updateListenStatsTick(false);
  assert.ok(background.session().listenMs - before >= 179000, '回到前台必须补回最小化期间的真实收听');
  assert.ok(background.session().listenMs - before <= 180000, '补账不能超过真实经过的时间');

  const seek = createListenContext({ duration: 600 });
  startSession(seek, 'local:f');
  seek.now += 1000;
  seek.audio.currentTime += 60;
  seek.api.updateListenStatsTick(false);
  assert.equal(seek.session().listenMs, 1000, '拖进度条只能记真实经过的时间');

  const stalled = createListenContext({ duration: 600 });
  startSession(stalled, 'local:g');
  stalled.now += 30000;
  stalled.api.updateListenStatsTick(false);
  assert.equal(stalled.session().listenMs, 0, '音频没往前走就不算听过');

  const huge = createListenContext({ duration: 600 });
  startSession(huge, 'local:h');
  huge.now += 7200000;
  huge.audio.currentTime += 7200;
  huge.api.updateListenStatsTick(false);
  assert.equal(huge.session().listenMs, huge.catchupMax, '异常大的空档必须按上限收口');
}

/**
 * 暂停期间不能累计收听时长，恢复后也不能把暂停的那段补回来。
 * @returns {void}
 */
function testPausedDoesNotAccumulate() {
  const context = createListenContext({ duration: 300 });
  startSession(context, 'local:i');
  context.audio.paused = true;
  // 暂停时 currentTime 不动，只有墙钟在走。
  context.now += 60000;
  context.api.updateListenStatsTick(false);
  assert.equal(context.session().listenMs, 0, '暂停期间不该计入收听');
  context.audio.paused = false;
  playFor(context, 3000, 1000);
  assert.equal(context.session().listenMs, 3000, '恢复播放后只记恢复之后的时间，暂停的 60 秒不能补回来');
}

/**
 * 关窗口 / 刷新时先结算当前会话，最后把防抖待写队列冲掉；缺任一函数时静默跳过。
 * @returns {void}
 */
function testUnloadSettlesListenSession() {
  const calls = [];
  const context = {
    console: { warn: () => {} },
    finalizeListenSession: (completed) => { calls.push('finalize:' + completed); },
    saveLyricLayout: () => { calls.push('saveLyricLayout'); },
    saveFreeCameraState: () => { calls.push('saveFreeCameraState'); },
    flushVolumePreference: () => { calls.push('flushVolumePreference'); },
    savePlaybackSession: (immediate) => { calls.push('savePlaybackSession:' + immediate); },
    flushPersistentUiStateBackup: () => { calls.push('flushPersistentUiStateBackup'); },
    flushLocalUserStateWrites: () => { calls.push('flushLocalUserStateWrites'); },
  };
  vm.runInNewContext(
    slice('function flushPersistentVisualState() {', "window.addEventListener('beforeunload'")
      + '\nthis.run = flushPersistentVisualState;',
    context,
  );
  context.run();
  assert.equal(calls[0], 'finalize:false', '关窗口必须先结算当前听歌会话，否则退出前那一首漏账');
  assert.equal(calls[calls.length - 1], 'flushLocalUserStateWrites', '结算产生的写入必须在卸载前冲掉');
  assert.ok(calls.indexOf('savePlaybackSession:true') > 0);
  assert.ok(calls.indexOf('finalize:false') < calls.indexOf('flushLocalUserStateWrites'));

  // 结算抛错不能连带吞掉后面的持久化。
  const throwing = Object.assign({}, context, {
    /** @returns {void} 模拟结算抛错。 */
    finalizeListenSession() { throw new Error('boom'); },
  });
  calls.length = 0;
  vm.runInNewContext(
    slice('function flushPersistentVisualState() {', "window.addEventListener('beforeunload'")
      + '\nthis.run = flushPersistentVisualState;',
    throwing,
  );
  assert.doesNotThrow(() => throwing.run());
  assert.equal(calls[calls.length - 1], 'flushLocalUserStateWrites', '结算抛错后仍要冲掉待写队列');
  assert.ok(calls.indexOf('savePlaybackSession:true') >= 0);

  // 精简环境（缺全部依赖）里必须彻底静默。
  const bare = { console: { warn: () => {} } };
  vm.runInNewContext(
    slice('function flushPersistentVisualState() {', "window.addEventListener('beforeunload'")
      + '\nthis.run = flushPersistentVisualState;',
    bare,
  );
  assert.doesNotThrow(() => bare.run());
}

/**
 * 状态写入是 120ms 防抖，卸载时定时器不会再触发，
 * 冲队列必须当场发起写入并取消定时器，且不会写第二遍。
 * @returns {Promise<void>}
 */
async function testPendingStateWritesFlushOnUnload() {
  const timers = [];
  const writes = [];
  const context = {
    Object,
    String,
    JSON,
    Promise,
    console: { warn: () => {} },
    localUserStateWriteTimers: Object.create(null),
    localUserStateWriteTokens: Object.create(null),
    localUserStatePendingWrites: Object.create(null),
    localStorage: { setItem: () => {} },
    removeLegacyLocalUserState: (key) => { writes.push({ removedLegacy: key }); },
    backupPersistentUiState: () => {},
    setTimeout: (fn) => { timers.push(fn); return timers.length; },
    clearTimeout: (id) => { if (id) timers[id - 1] = null; },
    writeLocalUserStateRecord: (id, value) => { writes.push({ id: id, value: value }); return Promise.resolve(true); },
  };
  vm.runInNewContext(
    slice('function runLocalUserStateWrite(', 'function hydrateLocalUserStateRecord(')
      + '\nthis.api = { scheduleLocalUserStateWrite, flushLocalUserStateWrites };'
      + '\n/** @returns {object} 返回待写队列。 */'
      + '\nthis.pending = function(){ return localUserStatePendingWrites; };',
    context,
  );
  context.api.scheduleLocalUserStateWrite('listen-stats', { plays: 1 }, 'mineradio-listen-stats-v1');
  assert.equal(writes.length, 0, '防抖窗口内不该立刻落盘');
  assert.equal(Object.keys(context.pending()).length, 1);

  context.api.flushLocalUserStateWrites();
  assert.deepEqual(writes.filter((item) => item.id).map((item) => item.id), ['listen-stats']);
  assert.equal(timers[0], null, '冲队列必须取消尚未到点的定时器');
  assert.equal(Object.keys(context.pending()).length, 0);

  context.api.flushLocalUserStateWrites();
  assert.equal(writes.filter((item) => item.id).length, 1, '重复冲队列不该写第二遍');
  await Promise.resolve();
  await Promise.resolve();
  assert.ok(writes.some((item) => item.removedLegacy === 'mineradio-listen-stats-v1'), '写成功后仍要清掉 legacy 键');
}

/**
 * 源码级钉子：结算门的三个阈值按设计不动，计时不再被 audio.duration 卡死，
 * 卸载路径确实接上了结算与冲队列。
 * @returns {void}
 */
function testSourcePinsForListenGates() {
  const tick = slice('function updateListenStatsTick(force) {', 'function finalizeListenSession(');
  assert.doesNotMatch(tick, /!audio\.duration \|\| audio\.paused/, '不能再用 audio.duration 卡住无时长文件的计时');
  assert.match(tick, /if \(!audio \|\| audio\.paused\) return;/);
  assert.match(tick, /LISTEN_TICK_CATCHUP_MAX_MS/, '最小化空档要按上限补账');
  assert.match(tick, /Math\.min\(deltaByAudio, deltaByWall \|\| deltaByAudio\)/, '补账基数仍取两个时钟的小值');

  const finalize = slice('function finalizeListenSession(', 'function mostPlayedSong(');
  assert.match(finalize, /session\.listenMs >= 45000/, '45 秒门槛按设计保留');
  assert.match(finalize, /session\.maxProgress >= 0\.5/, '一半进度门槛按设计保留');
  assert.match(finalize, /session\.listenMs >= 30000/, '无时长文件的 30 秒兜底按设计保留');
  assert.ok(finalize.indexOf('if (!effective) return;') < finalize.indexOf('syncLocalLibraryDbPlayStat('));

  const flush = slice('function flushPersistentVisualState() {', "window.addEventListener('beforeunload'");
  assert.match(flush, /finalizeListenSession\(false\)/);
  assert.match(flush, /flushLocalUserStateWrites\(\)/);
  assert.ok(flush.indexOf('finalizeListenSession(false)') < flush.indexOf('flushLocalUserStateWrites()'));
  assert.match(SOURCE, /window\.addEventListener\('beforeunload', flushPersistentVisualState\);/);
  assert.match(SOURCE, /window\.addEventListener\('pagehide', flushPersistentVisualState\);/);
}

test('无时长文件也能累计收听并走到 30 秒兜底', testDurationlessFileAccumulates);
test('有时长文件的结算门槛保持不变', testDurationGatesUnchanged);
test('最小化空档整段补回而拖动进度条不算收听', testBackgroundCatchUpAndSeekRejection);
test('暂停期间不累计收听时长', testPausedDoesNotAccumulate);
test('关窗口时先结算听歌会话再冲掉待写队列', testUnloadSettlesListenSession);
test('防抖状态写入可在卸载前立即冲掉', testPendingStateWritesFlushOnUnload);
test('结算门阈值与卸载接线的源码钉子', testSourcePinsForListenGates);
