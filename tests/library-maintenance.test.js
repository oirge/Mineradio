'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function readSource(name) {
  return fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
}

function readFunctionBlock(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `未找到源码块: ${startMarker}`);
  return source.slice(start, end);
}

/**
 * 把音乐库维护那一段生产源码搬进隔离 realm。维护代码和智能分类同处一个切片，
 * 跨切片的资产能力判定函数按需注入，未注入时生产代码里的 typeof 兜底必须自己顶住。
 * @param {Array<object>} songs 曲库歌曲。
 * @param {object} extra 额外注入的全局（资产能力判定、桌面 API、面板重绘等）。
 * @returns {object} vm 上下文。
 */
function createMaintenanceContext(songs = [], extra = {}) {
  const block = readFunctionBlock(
    readSource(path.join('public', 'app.js')),
    'function normalizeLocalPlaylistKind(kind)',
    'function localSongIndexByKey(songs, key)',
  );
  const listenStats = { songs: {}, updatedAt: 1 };
  const renders = [];
  const writes = [];
  const context = Object.assign({
    SPECIAL_LIKED_PLAYLIST_ID: 'special-liked',
    LOCAL_PLAYBACK_SOURCE_STORE_KEY: 'mineradio-local-playback-source-v1',
    localLibraryPlaylistSelection: 'library',
    localLibraryPlaybackSelection: 'library',
    localSearchPool: () => songs,
    getSpecialLikedSongs: () => [],
    ensureListenStatsState: () => listenStats,
    queueItemKey: (song) => (song && song.localKey ? `local:${song.localKey}` : ''),
    document: { getElementById: () => null },
    setPersistentLocalStorageItem: (key, value) => writes.push([key, value]),
    listenStats,
    renders,
    writes,
    renderLocalLibraryPlaylistPanel: (opts) => renders.push(opts || {}),
  }, extra);
  vm.runInNewContext(`${block}\nthis.api = this;`, context);
  return context;
}

function song(localKey, fields = {}) {
  return Object.assign({ localKey, name: localKey, type: 'local', localMetadataLoaded: true }, fields);
}

function pick(list, read = (item) => item.localKey) {
  return Array.from(list, read);
}

test('library-fix: kind 只认那五项，非法 id 回落全部音乐，老 kind 一个不受影响', () => {
  const api = createMaintenanceContext();

  assert.equal(api.normalizeLocalPlaylistKind('library-fix:duplicate'), 'library-fix:duplicate');
  assert.equal(api.normalizeLocalPlaylistKind('library-fix:missing'), 'library-fix:missing');
  assert.equal(api.normalizeLocalPlaylistKind('library-fix:no-cover'), 'library-fix:no-cover');
  assert.equal(api.normalizeLocalPlaylistKind('library-fix:no-lyric'), 'library-fix:no-lyric');
  assert.equal(api.normalizeLocalPlaylistKind('library-fix:tag-issue'), 'library-fix:tag-issue');
  assert.equal(api.normalizeLocalPlaylistKind('library-fix:不存在'), 'library');
  assert.equal(api.normalizeLocalPlaylistKind('library-fix:'), 'library');
  // 智能分类那三层与独立歌单一个都不能被新前缀吃掉
  assert.equal(api.normalizeLocalPlaylistKind('library-cat:home'), 'library-cat:home');
  assert.equal(api.normalizeLocalPlaylistKind('library-group:artist'), 'library-group:artist');
  assert.equal(api.normalizeLocalPlaylistKind('library-value:genre:摇滚'), 'library-value:genre:摇滚');
  assert.equal(api.normalizeLocalPlaylistKind('local-playlist:abc'), 'local-playlist:abc');
  assert.equal(api.normalizeLocalPlaylistKind('special-liked'), 'special-liked');

  const view = api.localLibraryCategoryView('library-fix:no-cover');
  assert.equal(view.mode, 'fix');
  assert.equal(view.id, 'no-cover');
  assert.equal(view.title, '无封面');
  assert.equal(view.parent, 'library-cat:home');
  assert.equal(api.localLibraryCategoryView('library-fix:nope'), null);
  // 维护项和智能分类同族，一律不写进播放来源持久键
  assert.equal(api.setLocalPlaybackPlaylistSelection('library-fix:missing'), 'library-fix:missing');
  assert.deepEqual(Array.from(api.writes), []);
});

test('维护 kind 走的是维护名单，不会串到智能分类那边', () => {
  const songs = [song('a.mp3', { localCoverLoaded: true, localLyricLoaded: true })];
  const api = createMaintenanceContext(songs);

  assert.deepEqual(pick(api.localLibraryCategoryKindSongs('library-fix:no-cover')), ['a.mp3']);
  assert.deepEqual(pick(api.localLibraryCategoryKindSongs('library-fix:no-lyric')), ['a.mp3']);
  assert.deepEqual(pick(api.localLibraryCategoryKindSongs('library-fix:duplicate')), []);
  // 目录层照旧不给歌
  assert.deepEqual(pick(api.localLibraryCategoryKindSongs('library-cat:home')), []);
  assert.equal(api.localLibraryMaintenanceKind('duplicate'), 'library-fix:duplicate');
});

test('重复检测按归一化的标题+艺术家分组，(Live) 后缀不剥，时长差得远的不算重复', () => {
  const songs = [
    song('a.flac', { name: '晴天 ', artist: '周杰伦', duration: 269 }),
    song('b.mp3', { name: '晴天', artist: '周杰伦 ', duration: 270 }),
    song('c.mp3', { name: '晴天 (Live)', artist: '周杰伦', duration: 269 }),
    song('d.mp3', { name: '晴天', artist: '周杰伦', duration: 411 }),
    song('e.mp3', { name: '不能说的秘密', artist: '周杰伦', duration: 260 }),
  ];
  const api = createMaintenanceContext(songs);

  // (Live) 归一化后仍是另一个标题，剥掉会把现场版和录音室版判成同一首
  assert.notEqual(api.localLibraryMaintenanceDuplicateKey(songs[0]), api.localLibraryMaintenanceDuplicateKey(songs[2]));
  assert.equal(api.localLibraryMaintenanceDuplicateKey(songs[0]), api.localLibraryMaintenanceDuplicateKey(songs[1]));
  // 标题+艺术家撞上之后时长差 141 秒的那首被摘掉，只剩真判不开的两首
  assert.deepEqual(pick(api.localLibraryMaintenanceSongs('duplicate')), ['a.flac', 'b.mp3']);
  assert.equal(api.localLibraryMaintenanceCount('duplicate'), 2);
});

test('重复检测：时长还没读出来时不摘，体积一样直接算重复', () => {
  const songs = [
    song('x1.mp3', { name: '同一首', artist: '某人' }),
    song('x2.mp3', { name: '同一首', artist: '某人' }),
    song('y1.mp3', { name: '另一首', artist: '某人', duration: 100, localFileSize: 4096 }),
    song('y2.mp3', { name: '另一首', artist: '某人', duration: 400, localFileSize: 4096 }),
  ];
  const api = createMaintenanceContext(songs);

  assert.deepEqual(pick(api.localLibraryMaintenanceSongs('duplicate')), ['x1.mp3', 'x2.mp3', 'y1.mp3', 'y2.mp3']);
});

test('标题空到连文件名都兜不出来的歌只记待扫描，不会挤成一大组重复', () => {
  const songs = [
    song('n1', { name: '', localPath: '' }),
    song('n2', { name: '', localPath: '' }),
    song('n3', { name: '', localFilePathAbsolute: ['D:', 'Music', '真名.mp3'].join(String.fromCharCode(92)) }),
  ];
  const api = createMaintenanceContext(songs);

  assert.equal(api.localLibraryMaintenanceDuplicateKey(songs[0]), '');
  assert.equal(api.localLibraryMaintenanceTitleText(songs[2]), '真名');
  assert.deepEqual(pick(api.localLibraryMaintenanceSongs('duplicate')), []);
  assert.equal(api.localLibraryMaintenanceUndetermined('duplicate'), 2);
});

test('无封面三态：同目录没图且格式读不出内嵌封面是零 I/O 定论，读完确认没有也算定论', () => {
  const songs = [
    song('has-thumb.mp3', { localCoverThumbDataUrl: 'data:image/png;base64,AA' }),
    song('has-file.mp3', { localCoverFile: { name: 'cover.jpg' } }),
    song('has-custom.mp3', { customCover: 'data:image/png;base64,BB' }),
    song('has-indexed.mp3', { localIndexedCoverStatus: 'ready' }),
    song('scanned-none.mp3', { localCoverLoaded: true }),
    song('indexed-none.mp3', { localIndexedCoverStatus: 'none' }),
    song('no-embed.mid', {}),
    song('pending.mp3', {}),
  ];
  const api = createMaintenanceContext(songs, {
    canReadEmbeddedCover: (s) => /\.(mp3|flac)$/i.test(String(s.localKey || '')),
  });

  assert.equal(api.localLibraryMaintenanceCoverState(songs[0]), 'has');
  assert.equal(api.localLibraryMaintenanceCoverState(songs[1]), 'has');
  assert.equal(api.localLibraryMaintenanceCoverState(songs[2]), 'has');
  assert.equal(api.localLibraryMaintenanceCoverState(songs[3]), 'has');
  // localCoverLoaded 为真时缩略图必然已经写进去了，没有就是读完确认没有
  assert.equal(api.localLibraryMaintenanceCoverState(songs[4]), 'none');
  assert.equal(api.localLibraryMaintenanceCoverState(songs[5]), 'none');
  // .mid 压根读不出内嵌封面，同目录也没图，零 I/O 就能定论
  assert.equal(api.localLibraryMaintenanceCoverState(songs[6]), 'none');
  assert.equal(api.localLibraryMaintenanceCoverState(songs[7]), 'unknown');

  assert.deepEqual(pick(api.localLibraryMaintenanceSongs('no-cover')), ['scanned-none.mp3', 'indexed-none.mp3', 'no-embed.mid']);
  assert.equal(api.localLibraryMaintenanceUndetermined('no-cover'), 1);
});

test('canReadEmbeddedCover 没注入时 typeof 兜底顶住，拿不准的一律记待扫描', () => {
  const songs = [song('unknown.xyz', {})];
  const api = createMaintenanceContext(songs);

  assert.equal(api.localLibraryMaintenanceCoverState(songs[0]), 'unknown');
  assert.deepEqual(pick(api.localLibraryMaintenanceSongs('no-cover')), []);
  assert.equal(api.localLibraryMaintenanceUndetermined('no-cover'), 1);
});

test('无歌词三态：读完确认没有排在「同目录有歌词文件」前面，空歌词文件照样算没歌词', () => {
  const songs = [
    song('text.mp3', { localLyricText: '[00:00.00]词' }),
    song('tag.mp3', { localLyricTagName: 'LYRICS' }),
    song('indexed.mp3', { localIndexedLyricStatus: 'ready' }),
    song('custom.mp3', {}),
    song('empty-file.mp3', { localLyricLoaded: true, localLyricFile: { name: 'empty-file.lrc' } }),
    song('file-only.mp3', { localLyricFile: { name: 'file-only.lrc' } }),
    song('indexed-none.mp3', { localIndexedLyricStatus: 'none' }),
    song('no-embed.m4a', {}),
    song('pending.mp3', {}),
    song('blank-text.mp3', { localLyricText: '   ' }),
  ];
  const api = createMaintenanceContext(songs, {
    canReadEmbeddedLyrics: (s) => /\.(mp3|flac)$/i.test(String(s.localKey || '')),
    hasCustomLyricForSong: (s) => String(s.localKey || '') === 'custom.mp3',
  });

  assert.equal(api.localLibraryMaintenanceLyricState(songs[0]), 'has');
  assert.equal(api.localLibraryMaintenanceLyricState(songs[1]), 'has');
  assert.equal(api.localLibraryMaintenanceLyricState(songs[2]), 'has');
  assert.equal(api.localLibraryMaintenanceLyricState(songs[3]), 'has');
  // 同目录明明有 .lrc，但读完是空的 / 解密失败，结论必须是没歌词
  assert.equal(api.localLibraryMaintenanceLyricState(songs[4]), 'none');
  assert.equal(api.localLibraryMaintenanceLyricState(songs[5]), 'has');
  assert.equal(api.localLibraryMaintenanceLyricState(songs[6]), 'none');
  assert.equal(api.localLibraryMaintenanceLyricState(songs[7]), 'none');
  assert.equal(api.localLibraryMaintenanceLyricState(songs[8]), 'unknown');
  // 纯空白的歌词文本不算有歌词
  assert.equal(api.localLibraryMaintenanceLyricState(songs[9]), 'unknown');

  assert.deepEqual(pick(api.localLibraryMaintenanceSongs('no-lyric')), ['empty-file.mp3', 'indexed-none.mp3', 'no-embed.m4a']);
  assert.equal(api.localLibraryMaintenanceUndetermined('no-lyric'), 2);
});

test('标签异常：标签没读出来只记待扫描，年份和音轨号只在填了值时才校验', () => {
  const songs = [
    song('pending.mp3', { localMetadataLoaded: false, name: '', artist: '', album: '' }),
    song('ok.mp3', { name: '标题', artist: '艺术家', album: '专辑', duration: 200, year: '2011', trackNumber: '3/12' }),
    song('lost.mp3', { name: '  ', artist: '', album: '', duration: 0 }),
    song('bad-year.mp3', { name: '标题', artist: '人', album: '碟', duration: 10, year: '不知道' }),
    song('bad-track.mp3', { name: '标题', artist: '人', album: '碟', duration: 10, trackNumber: 'A-1' }),
    song('blank-extra.mp3', { name: '标题', artist: '人', album: '碟', duration: 10, year: '', trackNumber: '' }),
  ];
  const api = createMaintenanceContext(songs);

  // 整库刚导入时标签全是空的，把它们全算成异常没有任何意义
  assert.equal(api.localLibraryMaintenanceTagFlags(songs[0]), null);
  assert.deepEqual(Array.from(api.localLibraryMaintenanceTagFlags(songs[1])), []);
  assert.deepEqual(Array.from(api.localLibraryMaintenanceTagFlags(songs[2])), ['无标题', '无艺术家', '无专辑', '时长未知']);
  assert.deepEqual(Array.from(api.localLibraryMaintenanceTagFlags(songs[3])), ['年份异常']);
  assert.deepEqual(Array.from(api.localLibraryMaintenanceTagFlags(songs[4])), ['音轨号异常']);
  // 年份 / 音轨号本来就没填的不算异常，只有填了又不像才算
  assert.deepEqual(Array.from(api.localLibraryMaintenanceTagFlags(songs[5])), []);

  assert.deepEqual(pick(api.localLibraryMaintenanceSongs('tag-issue')), ['lost.mp3', 'bad-year.mp3', 'bad-track.mp3']);
  assert.equal(api.localLibraryMaintenanceUndetermined('tag-issue'), 1);
});

test('四个桶一趟遍历喂满并按签名缓存，曲库没变不重算，资产纪元一加就重算', () => {
  const songs = [song('a.mp3', { localCoverLoaded: true, localLyricLoaded: true })];
  const api = createMaintenanceContext(songs);

  const first = api.localLibraryMaintenanceStore();
  assert.equal(api.localLibraryMaintenanceStore(), first);
  assert.equal(first.lists, api.localLibraryMaintenanceStore().lists);
  const firstLists = first.lists;

  // 资产结论变了但 localKey 没变，光靠「长度 + 首尾键」认不出来，必须靠纪元号
  api.noteLocalLibraryMaintenanceAssetChange();
  assert.notEqual(api.localLibraryMaintenanceStore().lists, firstLists);

  const cachedLists = api.localLibraryMaintenanceStore().lists;
  api.invalidateLocalLibraryMaintenanceIndex();
  assert.notEqual(api.localLibraryMaintenanceStore().lists, cachedLists);
  // 曲库任何变动都会经过这个入口，维护缓存跟着一起清
  const beforeInvalidate = api.localLibraryMaintenanceStore().lists;
  api.invalidateLocalLibraryCategoryIndex();
  assert.notEqual(api.localLibraryMaintenanceStore().lists, beforeInvalidate);
});

test('library-fix:constructor 这种 kind 取不到 Object.prototype 上的东西', () => {
  const api = createMaintenanceContext([song('constructor.mp3', { localCoverLoaded: true })]);

  assert.equal(api.normalizeLocalPlaylistKind('library-fix:constructor'), 'library');
  assert.equal(api.localLibraryCategoryView('library-fix:constructor'), null);
  assert.equal(api.localLibraryMaintenanceDefById('constructor'), null);
  assert.equal(api.localLibraryMaintenanceDefById('toString'), null);
  assert.deepEqual(pick(api.localLibraryMaintenanceSongs('constructor')), []);
  assert.equal(api.localLibraryMaintenanceCount('hasOwnProperty'), 0);
  assert.equal(api.localLibraryMaintenanceUndetermined('constructor'), 0);
  // 桶表自己也验自有属性，换成普通对象照样不漏
  assert.equal(api.localLibraryMaintenanceBucket({}, 'constructor'), null);
  assert.equal(api.localLibraryMaintenanceBucket(null, 'duplicate'), null);
  assert.deepEqual(Array.from(api.localLibraryMaintenanceBucket({ duplicate: [1] }, 'duplicate')), [1]);
});

test('失效文件：没探测过名单就是空的，探测完只挑 missing，blocked 不算文件被删', async () => {
  const songs = [
    song('gone.mp3', { localFilePathAbsolute: 'D:/Music/gone.mp3' }),
    song('here.mp3', { localFilePathAbsolute: 'D:/Music/here.mp3' }),
    song('outside.mp3', { localFilePathAbsolute: 'E:/Other/outside.mp3' }),
    song('nopath.mp3', { localFilePathAbsolute: '', localPath: '' }),
  ];
  const asked = [];
  const api = createMaintenanceContext(songs, {
    desktopLocalMusicApi: () => ({
      probeLocalMusicFiles: async (paths) => {
        asked.push(paths.slice());
        return { ok: true, checked: paths.length, states: paths.map((p) => (
          p.indexOf('gone') >= 0 ? 'missing' : (p.indexOf('outside') >= 0 ? 'blocked' : 'ok')
        )) };
      },
    }),
    savedLocalLibraryFolderPath: () => 'D:/Music',
  });

  // 探测前不许凭空报「失效」，而且整库都算待扫描
  assert.deepEqual(pick(api.localLibraryMaintenanceSongs('missing')), []);
  assert.equal(api.localLibraryMaintenanceUndetermined('missing'), 4);

  assert.equal(await api.scanLocalLibraryMissingFiles({ force: true }), true);
  // 没有路径的那首压根不问磁盘
  assert.deepEqual(asked.map((batch) => batch.length), [3]);
  assert.equal(api.localLibraryMaintenanceProbe.state, 'ready');
  assert.equal(api.localLibraryMaintenanceProbe.checked, 3);
  assert.equal(api.localLibraryMaintenanceProbe.folderPath, 'D:/Music');
  // blocked 是授权失败，不是文件被删，绝不能混进失效名单
  assert.deepEqual(pick(api.localLibraryMaintenanceSongs('missing')), ['gone.mp3']);
  assert.equal(api.localLibraryMaintenanceUndetermined('missing'), 0);
});

test('失效文件：每批 400 条切开问，进度一批一批刷，已有结论不重复跑', async () => {
  const songs = [];
  for (let i = 0; i < 900; i++) songs.push(song('s' + i + '.mp3', { localFilePathAbsolute: 'D:/M/s' + i + '.mp3' }));
  const asked = [];
  const api = createMaintenanceContext(songs, {
    desktopLocalMusicApi: () => ({
      probeLocalMusicFiles: async (paths) => {
        asked.push(paths.length);
        return { ok: true, states: paths.map(() => 'ok') };
      },
    }),
  });

  assert.equal(await api.scanLocalLibraryMissingFiles({ force: true }), true);
  assert.deepEqual(asked, [400, 400, 100]);
  // 开跑刷一次 + 每批刷一次 + 收尾刷一次
  assert.equal(api.renders.length, 5);
  assert.deepEqual(Array.from(api.renders, (opts) => opts.animate), [false, false, false, false, false]);
  assert.equal(api.localLibraryMaintenanceProbe.total, 900);
  assert.equal(api.localLibraryMaintenanceProbe.checked, 900);

  // 已经有结论了，不带 force 不再问磁盘
  assert.equal(await api.scanLocalLibraryMissingFiles(), true);
  assert.deepEqual(asked, [400, 400, 100]);
  // 正在跑的时候再点也不并发第二遍
  api.localLibraryMaintenanceProbe.state = 'running';
  assert.equal(await api.scanLocalLibraryMissingFiles({ force: true }), false);
  assert.deepEqual(asked, [400, 400, 100]);
});

test('失效文件：探测失败留下原因且名单不受污染，不支持的环境直接说清楚', async () => {
  const songs = [song('a.mp3', { localFilePathAbsolute: 'D:/M/a.mp3' })];

  const boom = createMaintenanceContext(songs, {
    desktopLocalMusicApi: () => ({ probeLocalMusicFiles: async () => { throw new Error('IPC_DEAD'); } }),
  });
  assert.equal(await boom.scanLocalLibraryMissingFiles({ force: true }), false);
  assert.equal(boom.localLibraryMaintenanceProbe.state, 'failed');
  assert.equal(boom.localLibraryMaintenanceProbe.error, 'IPC_DEAD');
  assert.deepEqual(pick(boom.localLibraryMaintenanceSongs('missing')), []);

  // 回来的状态数量对不上就整批作废，绝不按位置错配
  const short = createMaintenanceContext(songs, {
    desktopLocalMusicApi: () => ({ probeLocalMusicFiles: async () => ({ ok: true, states: [] }) }),
  });
  assert.equal(await short.scanLocalLibraryMissingFiles({ force: true }), false);
  assert.equal(short.localLibraryMaintenanceProbe.error, 'PROBE_STATES_MISMATCH');

  const web = createMaintenanceContext(songs);
  assert.equal(await web.scanLocalLibraryMissingFiles({ force: true }), false);
  assert.equal(web.localLibraryMaintenanceProbe.state, 'failed');
  assert.equal(web.localLibraryMaintenanceProbe.error, '当前环境不支持磁盘检测');
  assert.equal(web.renders.length, 1);
});

test('卡片副标题把待扫描数量说明白，失效文件那张按探测状态换话术', async () => {
  const songs = [
    song('a.mp3', { localCoverLoaded: true, localLyricLoaded: true, localFilePathAbsolute: 'D:/M/a.mp3' }),
    song('b.xyz', { localFilePathAbsolute: 'D:/M/b.xyz' }),
  ];
  const api = createMaintenanceContext(songs, {
    desktopLocalMusicApi: () => ({
      probeLocalMusicFiles: async (paths) => ({ ok: true, states: paths.map(() => 'missing') }),
    }),
  });
  const def = (id) => api.localLibraryMaintenanceDefById(id);

  assert.equal(api.localLibraryMaintenanceCardSub(def('no-cover')), '1 首 · 1 首待扫描 · 内嵌封面与同目录封面都没有');
  assert.equal(api.localLibraryMaintenanceCardSub(def('duplicate')), '0 首 · 同一首歌导入了多份');
  assert.equal(api.localLibraryMaintenanceCardSub(null), '');

  assert.equal(api.localLibraryMaintenanceCardSub(def('missing')), '点击开始检测 · 曲库里还在、磁盘上没了');
  api.localLibraryMaintenanceProbe.state = 'running';
  api.localLibraryMaintenanceProbe.checked = 1;
  api.localLibraryMaintenanceProbe.total = 2;
  assert.equal(api.localLibraryMaintenanceCardSub(def('missing')), '正在检测 1 / 2 · 曲库里还在、磁盘上没了');
  api.localLibraryMaintenanceProbe.state = 'failed';
  api.localLibraryMaintenanceProbe.error = '权限不够';
  assert.equal(api.localLibraryMaintenanceCardSub(def('missing')), '检测失败 · 权限不够');

  api.resetLocalLibraryMaintenanceProbe();
  assert.equal(api.localLibraryMaintenanceProbe.state, '');
  assert.equal(api.localLibraryMaintenanceProbe.keys, null);
  assert.equal(api.localLibraryMaintenanceCardSub(def('missing')), '点击开始检测 · 曲库里还在、磁盘上没了');

  await api.scanLocalLibraryMissingFiles({ force: true });
  assert.equal(api.localLibraryMaintenanceCardSub(def('missing')), '2 首 · 已检测 2 首');
});

test('面板签名把现算数字和探测状态整份折进去，早退分支吃不掉重绘', async () => {
  const songs = [song('a.mp3', { localCoverLoaded: true, localFilePathAbsolute: 'D:/M/a.mp3' })];
  const api = createMaintenanceContext(songs, {
    desktopLocalMusicApi: () => ({
      probeLocalMusicFiles: async (paths) => ({ ok: true, states: paths.map(() => 'missing') }),
    }),
  });

  const before = api.localLibraryMaintenanceStateSignature();
  assert.equal(before, api.localLibraryMaintenanceStateSignature());
  // 五项里失效文件单独用探测状态那一段，其余四项都是「命中数/待扫描数」
  assert.equal(before.split(',').length, 5);
  assert.equal(api.localLibraryCategoryDomSignature(api.localLibraryCategoryView('library-fix:no-cover')),
    'fix|library-fix:no-cover|' + before);

  await api.scanLocalLibraryMissingFiles({ force: true });
  const after = api.localLibraryMaintenanceStateSignature();
  assert.notEqual(after, before);
  assert.ok(after.indexOf('ready/1/1/1') >= 0);
  assert.ok(api.localLibraryCategoryDomSignature(api.localLibraryCategoryView('library-cat:home')).indexOf(after) > 0);
});

/**
 * 维护卡片的 HTML 由另一段渲染源码拼出来，把两段一起搬进同一个 realm，
 * 这样卡片上的数字就是维护模型现算出来的真值，而不是测试自己捏的字符串。
 * @param {Array<object>} songs 曲库歌曲。
 * @param {object} extra 额外注入的全局。
 * @returns {object} vm 上下文。
 */
function createHomeCardsContext(songs = [], extra = {}) {
  const source = readSource(path.join('public', 'app.js'));
  const model = readFunctionBlock(source, 'function normalizeLocalPlaylistKind(kind)', 'function localSongIndexByKey(songs, key)');
  const render = readFunctionBlock(source, 'function localLibraryCategoryHeadHtml(view, count)', '/* 分组项也走面板的懒加载额度');
  const context = Object.assign({
    SPECIAL_LIKED_PLAYLIST_ID: 'special-liked',
    LOCAL_PLAYBACK_SOURCE_STORE_KEY: 'mineradio-local-playback-source-v1',
    localLibraryPlaylistSelection: 'library',
    localSearchPool: () => songs,
    getSpecialLikedSongs: () => [],
    ensureListenStatsState: () => ({ songs: {}, updatedAt: 1 }),
    queueItemKey: (s) => (s && s.localKey ? `local:${s.localKey}` : ''),
    document: { getElementById: () => null },
    escHtml: (value) => String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
    songCoverSrc: () => 'cover.png',
    localLibraryCategoryStatMode: () => '',
  }, extra);
  vm.runInNewContext(`${model}\n${render}\nthis.api = this;`, context);
  return context;
}

test('音乐库首页第三段就是维护那五张卡，失效文件不给 ▶ 也不给「播放全部」', () => {
  const api = createHomeCardsContext([song('a.mp3', { localCoverLoaded: true })]);
  const html = api.localLibraryCategoryHomeCardsHtml();

  assert.ok(html.indexOf('<div class="pl-section-label">音乐库维护 · 5</div>') > 0);
  assert.ok(html.indexOf('音乐库维护') > html.indexOf('分组浏览'));
  ['duplicate', 'missing', 'no-cover', 'no-lyric', 'tag-issue'].forEach((id) => {
    assert.ok(html.indexOf(`data-library-kind="library-fix:${id}"`) > 0, id);
  });
  // 维护卡片不贴封面：卡片说的是「缺什么」，贴第一首的封面只会误导
  const fixSlice = html.slice(html.indexOf('音乐库维护 · 5'));
  assert.equal(fixSlice.indexOf('<img '), -1);
  assert.ok(fixSlice.indexOf('data-library-kind-play="library-fix:no-cover"') > 0);
  assert.equal(fixSlice.indexOf('data-library-kind-play="library-fix:missing"'), -1);
  // 卡片上的数字是维护模型现算的，不是写死的
  assert.ok(fixSlice.indexOf('1 首 · 内嵌封面与同目录封面都没有') > 0);
});

test('维护视图的抬头：失效文件换成「重新检测」，其余四项照常「播放全部」', () => {
  const api = createHomeCardsContext([song('a.mp3', { localCoverLoaded: true })]);

  const missingHead = api.localLibraryCategoryHeadHtml(api.localLibraryCategoryView('library-fix:missing'), 0);
  assert.ok(missingHead.indexOf('data-library-fix-rescan="1">重新检测') > 0);
  // 文件已经不在了，播放全部只会一路报错
  assert.equal(missingHead.indexOf('data-selected-playlist-play'), -1);
  assert.ok(missingHead.indexOf('data-library-back="library-cat:home"') > 0);

  const coverHead = api.localLibraryCategoryHeadHtml(api.localLibraryCategoryView('library-fix:no-cover'), 1);
  assert.ok(coverHead.indexOf('data-selected-playlist-play="1">播放全部') > 0);
  assert.equal(coverHead.indexOf('data-library-fix-rescan'), -1);
  assert.ok(coverHead.indexOf('1 首 · 内嵌封面与同目录封面都没有') > 0);
  // 老的智能分类抬头一个字都不受影响
  const catHead = api.localLibraryCategoryHeadHtml(api.localLibraryCategoryView('library-cat:recent-added'), 3);
  assert.ok(catHead.indexOf('data-selected-playlist-play="1">播放全部') > 0);
  assert.equal(catHead.indexOf('data-library-fix-rescan'), -1);
});

test('首页副标题的入口数把维护那五项算进去了', () => {
  const api = createMaintenanceContext();
  const home = api.localLibraryCategoryView('library-cat:home');
  const total = api.LOCAL_LIBRARY_CATEGORY_DEFS.length + api.LOCAL_LIBRARY_GROUP_DEFS.length + 5;

  assert.equal(api.LOCAL_LIBRARY_MAINTENANCE_DEFS.length, 5);
  assert.equal(home.subtitle, '智能分类 · ' + total + ' 个入口');
});

test('渲染层的空态对维护视图说人话，没探测过和查出来是空的分得开', () => {
  const source = readSource(path.join('public', 'app.js'));
  const block = readFunctionBlock(source, 'function renderLocalLibraryPlaylistPanel(opts)', 'function toggleLocalLibraryLike(index)');

  assert.ok(block.indexOf("selectedCategory && selectedCategory.mode === 'fix'") > 0);
  assert.ok(block.indexOf("maintenancePending ? '还没有检测过磁盘'") > 0);
  assert.ok(block.indexOf("maintenanceView ? '没有查出需要处理的歌曲'") > 0);
  assert.ok(block.indexOf('localLibraryMaintenanceCardSub(selectedCategory.def)') > 0);
});

test('点维护卡片才第一次探测磁盘，「重新检测」永远强制重跑', () => {
  const source = readSource(path.join('public', 'app.js'));

  assert.ok(source.indexOf("closest('[data-library-fix-rescan]')") > 0);
  const rescan = source.slice(source.indexOf('var libraryFixRescan'));
  assert.ok(rescan.indexOf('scanLocalLibraryMissingFiles({ force: true })') > 0);
  // 点进失效文件那张卡才探测，别的 kind 一律不碰磁盘
  const card = source.slice(source.indexOf("var libraryKind = libraryKindCard.getAttribute('data-library-kind')"));
  assert.ok(card.indexOf('localLibraryMaintenanceKind(LOCAL_LIBRARY_MAINTENANCE_MISSING_ID)') > 0);
  assert.ok(card.indexOf("localLibraryMaintenanceProbe.state === ''") > 0);
  assert.ok(card.indexOf("localLibraryMaintenanceProbe.state === 'failed'") > 0);
});

/**
 * 把主进程那个路径探测函数搬进隔离 realm：fs 与授权解析全部注入假实现，
 * 测的是「只回状态码、blocked 与 missing 分得开、上限截断如实上报」这几条。
 * @param {object} extra 注入的全局。
 * @returns {object} vm 上下文。
 */
function createProbeContext(extra = {}) {
  const block = readFunctionBlock(
    readSource(path.join('desktop', 'main.js')),
    'async function probeAuthorizedLocalFiles(paths)',
    'async function refreshLocalMusicFileEntries(folderPath, snapshotOrFiles)',
  );
  const context = Object.assign({
    LOCAL_LIBRARY_PROBE_MAX: 2000,
    LOCAL_LIBRARY_PROBE_CONCURRENCY: 8,
  }, extra);
  vm.runInNewContext(`${block}\nthis.api = this;`, context);
  return context;
}

test('主进程探测只回状态码：文件在 ok、没了 missing、越权 blocked，目录不算文件', async () => {
  const statted = [];
  const api = createProbeContext({
    resolveAuthorizedLocalFile: (p) => {
      if (String(p).indexOf('D:/Music/') !== 0) throw new Error('LOCAL_FILE_NOT_AUTHORIZED');
      return String(p);
    },
    fs: {
      promises: {
        stat: async (p) => {
          statted.push(p);
          if (p.indexOf('gone') >= 0) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
          return { isFile: () => p.indexOf('dir') < 0 };
        },
      },
    },
  });

  const res = await api.probeAuthorizedLocalFiles([
    'D:/Music/here.mp3', 'D:/Music/gone.mp3', 'E:/Other/outside.mp3', 'D:/Music/dir',
  ]);
  assert.equal(res.ok, true);
  assert.equal(res.checked, 4);
  assert.equal(res.truncated, false);
  // 顺序必须和入参一一对齐，错位会把「还在」的歌报成失效
  assert.deepEqual(Array.from(res.states), ['ok', 'missing', 'blocked', 'missing']);
  // 越权路径压根不该走到 stat
  assert.equal(statted.indexOf('E:/Other/outside.mp3'), -1);
  // 只回状态码，一个字节文件内容都不回
  assert.deepEqual(Object.keys(res).sort(), ['checked', 'ok', 'states', 'truncated']);
});

test('主进程探测：超上限截断如实上报，空数组不起 worker，并发不超过设定宽度', async () => {
  let live = 0;
  let peak = 0;
  const api = createProbeContext({
    LOCAL_LIBRARY_PROBE_MAX: 5,
    LOCAL_LIBRARY_PROBE_CONCURRENCY: 3,
    resolveAuthorizedLocalFile: (p) => String(p),
    fs: {
      promises: {
        stat: async () => {
          live++;
          peak = Math.max(peak, live);
          await new Promise((resolve) => setTimeout(resolve, 1));
          live--;
          return { isFile: () => true };
        },
      },
    },
  });

  const many = [];
  for (let i = 0; i < 12; i++) many.push('D:/M/' + i + '.mp3');
  const res = await api.probeAuthorizedLocalFiles(many);
  // 截断了就说截断了，不能悄悄少查 7 条还说全查过
  assert.equal(res.truncated, true);
  assert.equal(res.checked, 5);
  assert.equal(res.states.length, 5);
  assert.ok(peak <= 3, `并发峰值 ${peak}`);

  const empty = await api.probeAuthorizedLocalFiles([]);
  assert.equal(empty.checked, 0);
  assert.equal(empty.truncated, false);
  assert.deepEqual(Array.from(empty.states), []);
  // 非数组进来也不能炸
  assert.equal((await api.probeAuthorizedLocalFiles(null)).checked, 0);
});

test('探测 IPC 走可信主框架校验，preload 只暴露路径不暴露内容', () => {
  const main = readSource(path.join('desktop', 'main.js'));
  const preload = readSource(path.join('desktop', 'preload.js'));

  const handler = main.slice(main.indexOf("ipcMain.handle('mineradio-local-music-probe-entries'"));
  assert.ok(handler.indexOf('trustedMainFrameHandler') > 0 && handler.indexOf('trustedMainFrameHandler') < 60);
  assert.ok(handler.indexOf('probeAuthorizedLocalFiles(paths)') > 0);
  // 失败也只回错误码，绝不回文件内容
  assert.ok(handler.slice(0, 400).indexOf('LOCAL_LIBRARY_PROBE_FAILED') > 0);
  assert.ok(main.indexOf('const LOCAL_LIBRARY_PROBE_MAX = 2000;') > 0);
  assert.ok(main.indexOf('const LOCAL_LIBRARY_PROBE_CONCURRENCY = 8;') > 0);
  // 授权解析必须在 stat 之前，越权路径记 blocked 而不是 missing
  const probe = main.slice(main.indexOf('async function probeAuthorizedLocalFiles(paths)'));
  assert.ok(probe.indexOf('resolveAuthorizedLocalFile') < probe.indexOf('fs.promises.stat'));
  assert.ok(probe.indexOf("states[index] = 'blocked'") > 0);

  assert.ok(preload.indexOf("probeLocalMusicFiles: (paths) => ipcRenderer.invoke('mineradio-local-music-probe-entries'") > 0);
  assert.ok(preload.indexOf('Array.isArray(paths) ? paths : []') > 0);
});
