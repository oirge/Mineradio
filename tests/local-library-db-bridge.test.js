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
 * 建立 SQLite 曲库桥接的 vm 上下文。
 * @param {object|null} desktopWindow 伪造的桌面壳桥接对象，null 表示纯浏览器环境。
 * @returns {object} vm 上下文。
 */
function createBridgeContext(desktopWindow) {
  const context = {
    Promise,
    Object,
    Array,
    String,
    Number,
    Math,
    Date,
    JSON,
    console: { warn: () => {} },
    localLibraryDbState: { probed: false, available: false, promise: null, status: null },
    localLibraryDbIndexDigests: {},
    localLibraryDbIndexDigestGeneration: 0,
    localLibraryPathKeyFromSong: (song) => String((song && song.localFilePathAbsolute) || '').replace(/\\/g, '/').toLowerCase(),
    songArtistText: (song) => String((song && song.artist) || ''),
  };
  context.window = desktopWindow ? { desktopWindow: desktopWindow } : {};
  vm.runInNewContext(
    slice('function localLibraryDbApi(', 'async function hydrateLocalLibraryPersistentState(')
      + '\nthis.api = { localLibraryDbApi, probeLocalLibraryDb, localLibraryDbActive, callLocalLibraryDb,'
      + ' localLibraryDbTextDigest, localLibraryDbIndexDigest, resetLocalLibraryDbIndexDigests,'
      + ' syncLocalLibraryDbPlayStat, syncLocalLibraryDbFavorite };'
      + '\n/** @returns {object} 返回摘要表。 */'
      + '\nthis.digests = function digests(){ return localLibraryDbIndexDigests; };'
      + '\n/** @returns {number} 返回摘要表代次。 */'
      + '\nthis.digestGeneration = function digestGeneration(){ return localLibraryDbIndexDigestGeneration; };',
    context,
  );
  return context;
}

/**
 * 建立可记录调用的伪桌面壳。
 * @param {object} options 行为开关。
 * @returns {object} 伪桥接对象与调用记录。
 */
function createFakeShell(options) {
  const opts = options || {};
  const calls = [];
  const shell = {
    isDesktop: true,
    /** @returns {Promise<object>} 返回存储状态。 */
    localLibraryDbStatus: async () => {
      calls.push({ method: 'localLibraryDbStatus', args: [] });
      if (opts.statusThrows) throw new Error('status failed');
      return opts.status === undefined ? { ok: true, available: true, files: 3 } : opts.status;
    },
  };
  for (const method of ['loadLocalLibraryDb', 'saveLocalLibraryDbIndex', 'readLocalLibraryDbAssets',
    'writeLocalLibraryDbAssets', 'bumpLocalLibraryDbPlayStat', 'setLocalLibraryDbFavorite', 'trimLocalLibraryDb']) {
    shell[method] = async (...args) => {
      calls.push({ method: method, args: args });
      if (opts.methodThrows) throw new Error('ipc failed');
      return opts.result === undefined ? { ok: true } : opts.result;
    };
  }
  return { shell: shell, calls: calls };
}

/**
 * 纯浏览器或旧壳环境下探测必须一次性 latch 成不可用，之后所有调用都不再过 IPC。
 * @returns {Promise<void>}
 */
async function testProbeLatchesUnavailableWithoutShell() {
  const noShell = createBridgeContext(null);
  assert.equal(noShell.api.localLibraryDbApi(), null);
  assert.equal(await noShell.api.probeLocalLibraryDb(), false);
  assert.equal(noShell.api.localLibraryDbActive(), false);
  assert.equal(noShell.localLibraryDbState.probed, true);
  assert.equal(await noShell.api.callLocalLibraryDb('loadLocalLibraryDb', 'D:\\Music'), null);

  // 旧桌面壳没有这条通道：isDesktop 为真但缺 localLibraryDbStatus，同样按不可用处理。
  const oldShell = createBridgeContext({ isDesktop: true });
  assert.equal(oldShell.api.localLibraryDbApi(), null);
  assert.equal(await oldShell.api.probeLocalLibraryDb(), false);
  assert.equal(oldShell.api.localLibraryDbActive(), false);
}

/**
 * 探测只走一次 IPC：并发调用共享同一个在途 promise，结论落定后直接复用。
 * @returns {Promise<void>}
 */
async function testProbeRunsOnce() {
  const fake = createFakeShell({});
  const context = createBridgeContext(fake.shell);
  const [a, b] = await Promise.all([context.api.probeLocalLibraryDb(), context.api.probeLocalLibraryDb()]);
  assert.equal(a, true);
  assert.equal(b, true);
  assert.equal(await context.api.probeLocalLibraryDb(), true);
  assert.equal(fake.calls.filter((call) => call.method === 'localLibraryDbStatus').length, 1);
  assert.equal(context.api.localLibraryDbActive(), true);
  assert.equal(context.localLibraryDbState.status.files, 3);
  assert.equal(context.localLibraryDbState.promise, null);
}

/**
 * 主进程回报存储不可用时 latch 成不可用；瞬时异常只让本次调用回落，不永久关掉 SQLite 路径。
 * @returns {Promise<void>}
 */
async function testUnavailableLatchAndTransientError() {
  const unavailable = createFakeShell({ result: { ok: false, error: 'LOCAL_LIBRARY_DB_UNAVAILABLE' } });
  const context = createBridgeContext(unavailable.shell);
  assert.equal(await context.api.callLocalLibraryDb('readLocalLibraryDbAssets', ['k']), null);
  assert.equal(context.api.localLibraryDbActive(), false);
  assert.equal(await context.api.callLocalLibraryDb('readLocalLibraryDbAssets', ['k']), null);
  // latch 之后不再重复过 IPC。
  assert.equal(unavailable.calls.filter((call) => call.method === 'readLocalLibraryDbAssets').length, 1);

  const throwing = createFakeShell({ methodThrows: true });
  const context2 = createBridgeContext(throwing.shell);
  assert.equal(await context2.api.callLocalLibraryDb('readLocalLibraryDbAssets', ['k']), null);
  assert.equal(context2.api.localLibraryDbActive(), true, '单次 IPC 异常不能永久关闭 SQLite 路径');

  const badStatus = createBridgeContext(createFakeShell({ statusThrows: true }).shell);
  assert.equal(await badStatus.api.probeLocalLibraryDb(), false);
  assert.equal(badStatus.api.localLibraryDbActive(), false);

  const notAvailable = createBridgeContext(createFakeShell({ status: { ok: true, available: false } }).shell);
  assert.equal(await notAvailable.api.probeLocalLibraryDb(), false);
}

/**
 * 参数个数必须原样转发：loadLocalLibraryDb 是双参、readAssets 单参、status 无参。
 * @returns {Promise<void>}
 */
async function testForwardsArgumentArity() {
  const fake = createFakeShell({});
  const context = createBridgeContext(fake.shell);
  await context.api.callLocalLibraryDb('loadLocalLibraryDb', 'D:\\Music', { index: true });
  await context.api.callLocalLibraryDb('readLocalLibraryDbAssets', ['a', 'b']);
  await context.api.callLocalLibraryDb('trimLocalLibraryDb');
  const calls = fake.calls.filter((call) => call.method !== 'localLibraryDbStatus');
  assert.deepEqual(calls[0], { method: 'loadLocalLibraryDb', args: ['D:\\Music', { index: true }] });
  assert.deepEqual(calls[1], { method: 'readLocalLibraryDbAssets', args: [['a', 'b']] });
  assert.deepEqual(calls[2], { method: 'trimLocalLibraryDb', args: [] });
  // 壳里没有这个方法时直接返回 null，不该抛异常也不该多走一次探测。
  assert.equal(await context.api.callLocalLibraryDb('methodThatDoesNotExist', 1), null);
}

/**
 * 行摘要覆盖会变的字段并对未变行保持稳定；代次变化才丢弃摘要表。
 * @returns {void}
 */
function testIndexDigestAndGenerationReset() {
  const context = createBridgeContext(createFakeShell({}).shell);
  const record = {
    key: 'song-a',
    fileSignature: 'd:/music/a.mp3|1024|1700000000000',
    pathKey: 'd:/music/a.mp3',
    size: 1024,
    mtime: 1700000000000,
    name: '歌名',
    artist: '歌手',
    album: '专辑',
    genre: '摇滚',
    year: '2001',
    duration: 213.5,
    localFormat: 'mp3',
    localMetadataLoaded: true,
    localMetadataTagSchema: 3,
    coverStatus: 'ready',
    lyricStatus: 'ready',
  };
  const digest = context.api.localLibraryDbIndexDigest(record);
  assert.match(digest, /^[0-9a-f]{1,8}$/);
  assert.equal(context.api.localLibraryDbIndexDigest(Object.assign({}, record)), digest);
  assert.notEqual(context.api.localLibraryDbIndexDigest(Object.assign({}, record, { genre: '民谣' })), digest);
  assert.notEqual(context.api.localLibraryDbIndexDigest(Object.assign({}, record, { coverStatus: 'pending' })), digest);
  assert.notEqual(context.api.localLibraryDbIndexDigest(Object.assign({}, record, { mtime: 1800000000000 })), digest);
  // 只改不进摘要的字段（路径原文）不该触发重写。
  assert.equal(context.api.localLibraryDbIndexDigest(Object.assign({}, record, { path: 'other.mp3' })), digest);
  assert.equal(context.api.localLibraryDbIndexDigest(null), '');

  context.digests()['song-a'] = digest;
  context.api.resetLocalLibraryDbIndexDigests(0);
  assert.equal(context.digests()['song-a'], digest, '同一代次不该清空摘要表');
  context.api.resetLocalLibraryDbIndexDigests(2);
  assert.equal(Object.keys(context.digests()).length, 0, 'A→B→A 换库必须丢弃旧摘要');
  assert.equal(context.digestGeneration(), 2);
}

/**
 * 播放结算只对本地曲目发 song_key（localKey），不是队列键 local:xxx。
 * @returns {Promise<void>}
 */
async function testPlayStatPayload() {
  const fake = createFakeShell({});
  const context = createBridgeContext(fake.shell);
  const snap = {
    key: 'local:D:\\Music\\A.mp3:1024:1700000000000',
    type: 'local',
    localKey: 'D:\\Music\\A.mp3:1024:1700000000000',
    pathKey: 'd:/music/a.mp3',
    name: '歌名',
    artist: '歌手',
  };
  context.api.syncLocalLibraryDbPlayStat(snap, { listenMs: 45678.6, completed: true, playedAt: 1700000000123 });
  await context.api.probeLocalLibraryDb();
  const bump = fake.calls.filter((call) => call.method === 'bumpLocalLibraryDbPlayStat');
  assert.equal(bump.length, 1);
  // 载荷对象在 vm realm 里创建，原型不同，拷回本 realm 再比结构。
  assert.deepEqual(Object.assign({}, bump[0].args[0]), {
    key: 'D:\\Music\\A.mp3:1024:1700000000000',
    pathKey: 'd:/music/a.mp3',
    plays: 1,
    listenMs: 45679,
    completed: 1,
    lastPlayedAt: 1700000000123,
    name: '歌名',
    artist: '歌手',
  });
  assert.notEqual(bump[0].args[0].key, snap.key, 'song_key 不能带 local: 前缀');

  // 在线曲目、缺 localKey 的本地曲目、空快照都不该发 IPC。
  context.api.syncLocalLibraryDbPlayStat({ type: 'song', localKey: 'x' }, {});
  context.api.syncLocalLibraryDbPlayStat({ type: 'local', localKey: '' }, {});
  context.api.syncLocalLibraryDbPlayStat(null, null);
  await context.api.probeLocalLibraryDb();
  assert.equal(fake.calls.filter((call) => call.method === 'bumpLocalLibraryDbPlayStat').length, 1);

  const partial = createFakeShell({});
  const context2 = createBridgeContext(partial.shell);
  context2.api.syncLocalLibraryDbPlayStat({ type: 'local', localKey: 'k' }, { listenMs: -5, completed: false });
  await context2.api.probeLocalLibraryDb();
  const payload = partial.calls.filter((call) => call.method === 'bumpLocalLibraryDbPlayStat')[0].args[0];
  assert.equal(payload.listenMs, 0, '负数时长必须夹到 0');
  assert.equal(payload.completed, 0);
  assert.ok(payload.lastPlayedAt > 0, '缺结算时间时回落当前时间');
}

/**
 * 收藏状态两个方向都要落库，且只针对本地曲目。
 * @returns {Promise<void>}
 */
async function testFavoritePayload() {
  const fake = createFakeShell({});
  const context = createBridgeContext(fake.shell);
  const song = {
    type: 'local',
    localKey: 'D:\\Music\\A.mp3:1024:1700000000000',
    localFilePathAbsolute: 'D:\\Music\\A.mp3',
    name: '歌名',
    artist: '歌手',
  };
  context.api.syncLocalLibraryDbFavorite(song, true);
  context.api.syncLocalLibraryDbFavorite(song, false);
  context.api.syncLocalLibraryDbFavorite({ type: 'song', localKey: 'x' }, true);
  context.api.syncLocalLibraryDbFavorite({ type: 'local' }, true);
  context.api.syncLocalLibraryDbFavorite(null, true);
  await context.api.probeLocalLibraryDb();
  const calls = fake.calls.filter((call) => call.method === 'setLocalLibraryDbFavorite');
  assert.equal(calls.length, 2);
  assert.deepEqual(Object.assign({}, calls[0].args[0]), {
    key: 'D:\\Music\\A.mp3:1024:1700000000000',
    pathKey: 'd:/music/a.mp3',
    favorite: 1,
    name: '歌名',
    artist: '歌手',
  });
  assert.equal(calls[1].args[0].favorite, 0);
}

/**
 * 播放统计与收藏在纯浏览器环境下必须彻底静默，不能因为缺桥接而抛错打断结算与点赞。
 * @returns {Promise<void>}
 */
async function testStatHooksStayQuietWithoutShell() {
  const context = createBridgeContext(null);
  context.api.syncLocalLibraryDbPlayStat({ type: 'local', localKey: 'k' }, { listenMs: 1 });
  context.api.syncLocalLibraryDbFavorite({ type: 'local', localKey: 'k' }, true);
  assert.equal(await context.api.probeLocalLibraryDb(), false);
}

/**
 * 渲染层的调用点必须真的接上：listenSongSnapshot 带 localKey/pathKey，
 * finalizeListenSession 在有效结算里落库，toggleSpecialLikedSong 两个方向都同步。
 * @returns {void}
 */
function testRendererCallSitesWired() {
  const snapshot = slice('function listenSongSnapshot(', 'function beginListenSession(');
  assert.match(snapshot, /localKey: song\.type === 'local' \? String\(song\.localKey \|\| ''\) : ''/);
  assert.match(snapshot, /pathKey: song\.type === 'local' \? localLibraryPathKeyFromSong\(song\) : ''/);

  const finalize = slice('function finalizeListenSession(', 'function mostPlayedSong(');
  assert.match(finalize, /syncLocalLibraryDbPlayStat\(snap, \{ listenMs: record\.listenMs, completed: !!completed, playedAt: now \}\)/);
  // 结算门在前：无效收听不该记一次播放。
  assert.ok(finalize.indexOf('if (!effective) return;') < finalize.indexOf('syncLocalLibraryDbPlayStat('));

  const toggle = slice('function toggleSpecialLikedSong(', 'function isSongLiked(');
  assert.match(toggle, /syncLocalLibraryDbFavorite\(song, false\)/);
  assert.match(toggle, /syncLocalLibraryDbFavorite\(song, true\)/);

  const lyricSnapshot = slice('function localLyricCacheSnapshot(', '\nfunction ');
  assert.match(lyricSnapshot, /localLibraryPathKey: localLibraryPathKeyFromSong\(song\)/);
  assert.match(lyricSnapshot, /localLibraryFileSignature: localLibraryFileSignatureFromSong\(song\)/);
}

test('无桌面壳或旧壳时探测一次性降级', testProbeLatchesUnavailableWithoutShell);
test('SQLite 曲库探测只走一次 IPC', testProbeRunsOnce);
test('存储不可用才 latch 降级而瞬时异常只回落本次', testUnavailableLatchAndTransientError);
test('桥接调用原样转发参数个数', testForwardsArgumentArity);
test('索引行摘要稳定且换库丢弃摘要表', testIndexDigestAndGenerationReset);
test('播放结算按 localKey 落库且过滤非本地曲目', testPlayStatPayload);
test('收藏状态两个方向都落库', testFavoritePayload);
test('缺桥接时播放统计与收藏静默跳过', testStatHooksStayQuietWithoutShell);
test('渲染层调用点已接上 SQLite 播放统计与收藏', testRendererCallSitesWired);
