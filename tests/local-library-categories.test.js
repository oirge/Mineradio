'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function readAppSource() {
  return fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
}

function readFunctionBlock(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `未找到源码块: ${startMarker}`);
  return source.slice(start, end);
}

/**
 * 把智能分类那一段生产源码搬进隔离realm，附带一份可控的播放统计。
 * @param {Array<object>} songs 曲库歌曲。
 * @param {object} stats 播放统计 songs 映射。
 * @param {object} opts nameCompare 传 null 可模拟排序器还没定义的兜底路径。
 * @returns {object} vm 上下文。
 */
function createCategoryContext(songs = [], stats = {}, opts = {}) {
  const block = readFunctionBlock(
    readAppSource(),
    'function normalizeLocalPlaylistKind(kind)',
    'function localSongIndexByKey(songs, key)',
  );
  const listenStats = { songs: stats, updatedAt: 1 };
  const writes = [];
  const context = {
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
    writes,
  };
  // 生产环境里中文排序器声明在更靠后的位置，这里照样注入，让分组顺序跟真实界面一致。
  const nameCompare = Object.prototype.hasOwnProperty.call(opts, 'nameCompare')
    ? opts.nameCompare
    : new Intl.Collator('zh-Hans-CN', { numeric: true, sensitivity: 'base' }).compare;
  if (nameCompare) context.LOCAL_LIBRARY_NAME_COMPARE = nameCompare;
  vm.runInNewContext(`${block}\nthis.api = this;`, context);
  return context;
}

function song(localKey, fields = {}) {
  return Object.assign({ localKey, name: localKey, type: 'local' }, fields);
}

/**
 * vm realm 里造出来的数组原型不同，deepStrictEqual 会当成异类，这里换回宿主数组再比。
 * @param {Array<object>} list 分类结果。
 * @param {Function} read 取值函数，默认取 localKey。
 * @returns {Array<*>} 宿主数组。
 */
function pick(list, read = (item) => item.localKey) {
  return Array.from(list, read);
}

test('智能分类 kind 三层命名可通过归一化，非法值回落全部音乐', () => {
  const api = createCategoryContext();

  assert.equal(api.normalizeLocalPlaylistKind('library-cat:home'), 'library-cat:home');
  assert.equal(api.normalizeLocalPlaylistKind('library-cat:most-played'), 'library-cat:most-played');
  assert.equal(api.normalizeLocalPlaylistKind('library-group:albumArtist'), 'library-group:albumArtist');
  assert.equal(api.normalizeLocalPlaylistKind('library-value:genre:摇滚'), 'library-value:genre:摇滚');
  assert.equal(api.normalizeLocalPlaylistKind('library-cat:不存在'), 'library');
  assert.equal(api.normalizeLocalPlaylistKind('library-group:composer'), 'library');
  assert.equal(api.normalizeLocalPlaylistKind('library-value:genre:'), 'library');
  assert.equal(api.normalizeLocalPlaylistKind('library-value:'), 'library');
  assert.equal(api.normalizeLocalPlaylistKind('library-whatever'), 'library');
  // 老 kind 一个都不能被新前缀吃掉
  assert.equal(api.normalizeLocalPlaylistKind('library'), 'library');
  assert.equal(api.normalizeLocalPlaylistKind('special-liked'), 'special-liked');
  assert.equal(api.normalizeLocalPlaylistKind('local-playlist:abc'), 'local-playlist:abc');
});

test('分组值里带冒号也只在第一个冒号处切分', () => {
  const api = createCategoryContext();
  const parsed = api.parseLocalLibraryValueKind('library-value:album:LIVE: 2019 巡回');

  assert.equal(parsed.field, 'album');
  assert.equal(parsed.value, 'LIVE: 2019 巡回');
  assert.equal(api.localLibraryValueKind('album', 'LIVE: 2019 巡回'), 'library-value:album:LIVE: 2019 巡回');
  assert.equal(api.parseLocalLibraryValueKind('library-value:album:LIVE: 2019 巡回').value,
    api.localLibraryCategoryView('library-value:album:LIVE: 2019 巡回').value);
});

test('年代从 year 抽四位数字归档到十年，未知年代垫底', () => {
  const api = createCategoryContext();

  assert.equal(api.localLibraryDecadeLabel('1998'), '1990年代');
  assert.equal(api.localLibraryDecadeLabel('2019-03-05'), '2010年代');
  assert.equal(api.localLibraryDecadeLabel(2000), '2000年代');
  assert.equal(api.localLibraryDecadeLabel(''), '未知年代');
  assert.equal(api.localLibraryDecadeLabel('未知'), '未知年代');
  assert.equal(api.localLibraryDecadeSortValue('未知年代'), -1);
  assert.ok(api.localLibraryDecadeSortValue('2010年代') > api.localLibraryDecadeSortValue('1990年代'));
});

test('五种分组按字段聚合计数，专辑艺术家缺失时回落到艺术家', () => {
  const api = createCategoryContext([
    song('a', { artist: '周杰伦', album: '叶惠美', genre: '流行', year: '2003' }),
    song('b', { artist: '周杰伦', album: '叶惠美', genre: '流行', year: '2003' }),
    song('c', { artist: '陈奕迅', albumArtist: '群星', album: '拼图', genre: '', year: '2011' }),
    song('d', {}),
  ]);

  const artists = api.localLibraryGroupEntries('artist');
  assert.deepEqual(pick(artists, (entry) => [entry.value, entry.count]),
    [['陈奕迅', 1], ['未知艺术家', 1], ['周杰伦', 2]]);

  const albumArtists = pick(api.localLibraryGroupEntries('albumArtist'), (entry) => entry.value);
  assert.ok(albumArtists.includes('群星'));
  assert.ok(albumArtists.includes('周杰伦'), '没有 albumArtist 的歌要回落到 artist');

  assert.deepEqual(pick(api.localLibraryGroupEntries('genre'), (entry) => entry.value).sort(),
    ['未知流派', '流行']);
  assert.deepEqual(pick(api.localLibraryGroupEntries('decade'), (entry) => entry.value),
    ['2010年代', '2000年代', '未知年代']);
  assert.equal(api.localLibraryGroupEntries('artist')[2].cover.localKey, 'a', '分组封面取该组第一首');
});

test('中文排序器还没定义时分组仍有稳定顺序，不靠它才排得出来', () => {
  const api = createCategoryContext([
    song('a', { artist: '周杰伦' }),
    song('b', { artist: '陈奕迅' }),
  ], {}, { nameCompare: null });

  assert.deepEqual(pick(api.localLibraryGroupEntries('artist'), (entry) => entry.value),
    ['周杰伦', '陈奕迅']);
});

test('分组里的某一项只筛出该组歌曲并缓存同一个数组', () => {
  const api = createCategoryContext([
    song('a', { artist: '周杰伦' }),
    song('b', { artist: '陈奕迅' }),
    song('c', { artist: '周杰伦' }),
  ]);

  const picked = api.localPlaylistSongs('library-value:artist:周杰伦');
  assert.deepEqual(pick(picked), ['a', 'c']);
  assert.strictEqual(api.localPlaylistSongs('library-value:artist:周杰伦'), picked, '同一项重复进出不重扫整库');
  assert.deepEqual(pick(api.localPlaylistSongs('library-value:artist:陈奕迅')), ['b']);
});

test('播放统计驱动最近播放、播放最多与未播放三个分类', () => {
  const api = createCategoryContext([
    song('a'),
    song('b'),
    song('c'),
    song('d'),
  ], {
    'local:a': { plays: 3, listenMs: 300, lastPlayedAt: 100 },
    'local:b': { plays: 9, listenMs: 900, lastPlayedAt: 50 },
    'local:c': { plays: 0, listenMs: 0, lastPlayedAt: 0 },
  });

  assert.deepEqual(pick(api.localLibraryCategorySongs('most-played')), ['b', 'a']);
  assert.deepEqual(pick(api.localLibraryCategorySongs('recent-played')), ['a', 'b']);
  assert.deepEqual(pick(api.localLibraryCategorySongs('never-played')), ['c', 'd']);
  assert.strictEqual(api.localLibraryCategorySongs('all'), api.localSearchPool(), '所有歌曲直接复用曲库数组');
});

test('播放次数相同时按累计时长再按最后播放时间排序', () => {
  const api = createCategoryContext([song('a'), song('b'), song('c')], {
    'local:a': { plays: 2, listenMs: 100, lastPlayedAt: 900 },
    'local:b': { plays: 2, listenMs: 800, lastPlayedAt: 10 },
    'local:c': { plays: 2, listenMs: 100, lastPlayedAt: 20 },
  });

  assert.deepEqual(pick(api.localLibraryCategorySongs('most-played')), ['b', 'a', 'c']);
});

test('最近添加按入库时间倒序，没盖过时间戳的回落文件修改时间', () => {
  const api = createCategoryContext([
    song('a', { localFileLastModified: 10 }),
    song('b', { localLibraryAddedAt: 900, localFileLastModified: 1 }),
    song('c', { localFileLastModified: 500 }),
  ]);

  assert.equal(api.localLibrarySongAddedAt({ localLibraryAddedAt: 7, localFileLastModified: 9 }), 7);
  assert.equal(api.localLibrarySongAddedAt({ localFileLastModified: 9 }), 9);
  assert.equal(api.localLibrarySongAddedAt(null), 0);
  assert.deepEqual(pick(api.localLibraryCategorySongs('recent-added')), ['b', 'c', 'a']);
});

test('最近添加封顶 200 首，不会退化成所有歌曲的副本', () => {
  const many = [];
  for (let i = 0; i < 260; i++) many.push(song(`k${i}`, { localFileLastModified: i }));
  const api = createCategoryContext(many);

  assert.equal(api.LOCAL_LIBRARY_RECENT_ADDED_LIMIT, 200);
  const recent = api.localLibraryCategorySongs('recent-added');
  assert.equal(recent.length, 200);
  assert.equal(recent[0].localKey, 'k259');
  assert.equal(recent[199].localKey, 'k60');
});

test('目录层 kind 不带歌曲，普通 library 仍原样交出曲库数组', () => {
  const songs = [song('a', { artist: '周杰伦' })];
  const api = createCategoryContext(songs);

  assert.deepEqual(pick(api.localPlaylistSongs('library-cat:home')), []);
  assert.deepEqual(pick(api.localPlaylistSongs('library-group:artist')), []);
  assert.strictEqual(api.localPlaylistSongs('library'), songs, '全部音乐必须保持同一个数组身份');
  assert.strictEqual(api.localPlaylistSongs('library-cat:all'), songs);
});

test('分类视图描述带上返回目标，形成音乐库→分组→歌曲三层', () => {
  const api = createCategoryContext([song('a', { artist: '周杰伦' })]);

  assert.equal(api.localLibraryCategoryView('library-cat:home').mode, 'home');
  assert.equal(api.localLibraryCategoryView('library-cat:home').parent, 'library');
  assert.equal(api.localLibraryCategoryView('library-cat:never-played').parent, 'library-cat:home');
  assert.equal(api.localLibraryCategoryView('library-group:artist').parent, 'library-cat:home');
  assert.equal(api.localLibraryCategoryView('library-value:artist:周杰伦').parent, 'library-group:artist');
  assert.equal(api.localLibraryCategoryView('library-value:artist:周杰伦').title, '周杰伦');
  assert.equal(api.localLibraryCategoryView('library-group:composer'), null);
  assert.equal(api.localLibraryCategoryTitle('library-cat:most-played'), '播放最多');
  assert.equal(api.localLibraryCategoryTitle('library'), '全部音乐');
});

test('分类面板签名跟着分类数量与播放统计一起变，避免早退分支吃掉重绘', () => {
  const api = createCategoryContext([song('a')], {});
  const home = api.localLibraryCategoryView('library-cat:home');
  const before = api.localLibraryCategoryDomSignature(home);

  api.listenStats.songs['local:a'] = { plays: 1, listenMs: 10, lastPlayedAt: 5 };
  api.listenStats.updatedAt = 2;
  api.invalidateLocalLibraryCategoryIndex();

  assert.notEqual(api.localLibraryCategoryDomSignature(home), before);
  assert.equal(api.localLibraryCategoryDomSignature(null), '');
  assert.match(api.localLibraryCategoryDomSignature(api.localLibraryCategoryView('library-group:artist')), /^group\|artist\|/);
});

test('播放统计更新后分类缓存失效并重新统计', () => {
  const api = createCategoryContext([song('a'), song('b')], {});

  assert.equal(api.localLibraryCategorySongs('never-played').length, 2);
  api.listenStats.songs['local:a'] = { plays: 4, listenMs: 40, lastPlayedAt: 40 };
  api.listenStats.updatedAt = 99;
  assert.deepEqual(pick(api.localLibraryCategorySongs('most-played')), ['a']);
  assert.deepEqual(pick(api.localLibraryCategorySongs('never-played')), ['b']);
});

test('智能分类只在内存里当播放来源，不写进持久键', () => {
  const api = createCategoryContext([song('a', { artist: '周杰伦' })]);

  assert.equal(api.setLocalPlaybackPlaylistSelection('library-value:artist:周杰伦'), 'library-value:artist:周杰伦');
  assert.deepEqual(api.writes, [], '动态分类不能落到播放来源持久键');
  assert.equal(api.setLocalPlaybackPlaylistSelection('special-liked'), 'special-liked');
  assert.deepEqual(api.writes, [['mineradio-local-playback-source-v1', 'special-liked']]);
});

test('曲库空时分类全部为空且不抛错', () => {
  const api = createCategoryContext([]);

  assert.deepEqual(pick(api.localLibraryGroupEntries('artist')), []);
  assert.deepEqual(pick(api.localLibraryCategorySongs('most-played')), []);
  assert.deepEqual(pick(api.localLibraryCategorySongs('recent-added')), []);
  assert.deepEqual(pick(api.localLibraryCategorySongs('never-played')), []);
  assert.deepEqual(pick(api.localLibraryValueSongs('artist', '周杰伦')), []);
});

test('入库时间只给相对已有索引才新增的歌盖章，首次导入不整库盖同一时刻', () => {
  const block = readFunctionBlock(
    readAppSource(),
    'var LOCAL_LIBRARY_ADDED_AT_STORE_KEY',
    'function localLibraryAssetStatus(',
  );
  const stored = new Map();
  const context = {
    localStorage: { getItem: (key) => (stored.has(key) ? stored.get(key) : null) },
    setPersistentLocalStorageItem: (key, value) => stored.set(key, value),
    localLibraryPathKeyFromSong: (item) => String((item && item.localPath) || ''),
  };
  vm.runInNewContext(`${block}\nthis.api = this;`, context);

  const firstImport = [
    { localPath: '/a.flac', localLibraryChangeState: 'new' },
    { localPath: '/b.flac', localLibraryChangeState: 'new' },
  ];
  assert.equal(context.noteLocalLibraryAddedAt(firstImport, { stats: { hasIndex: false } }), 0);
  assert.equal(firstImport[0].localLibraryAddedAt, undefined);
  assert.equal(stored.size, 0);

  const secondScan = [
    { localPath: '/a.flac', localLibraryChangeState: 'unchanged' },
    { localPath: '/c.flac', localLibraryChangeState: 'new' },
  ];
  assert.equal(context.noteLocalLibraryAddedAt(secondScan, { stats: { hasIndex: true } }), 1);
  assert.ok(secondScan[1].localLibraryAddedAt > 0);
  assert.equal(secondScan[0].localLibraryAddedAt, undefined, '老文件没有时间戳就继续靠 mtime 兜底');

  const saved = JSON.parse(stored.get('mineradio-local-added-at-v1'));
  assert.deepEqual(Object.keys(saved), ['/c.flac']);

  // 已存过的时间戳要原样回填，不能因为重扫就刷新成现在
  const again = [{ localPath: '/c.flac', localLibraryChangeState: 'new' }];
  assert.equal(context.noteLocalLibraryAddedAt(again, { stats: { hasIndex: true } }), 0);
  assert.equal(again[0].localLibraryAddedAt, saved['/c.flac']);
});

test('监控新增逐首盖章，落盘留到同步收尾一次写完', () => {
  const block = readFunctionBlock(
    readAppSource(),
    'var LOCAL_LIBRARY_ADDED_AT_STORE_KEY',
    'function localLibraryAssetStatus(',
  );
  const stored = new Map();
  const context = {
    localStorage: { getItem: () => null },
    setPersistentLocalStorageItem: (key, value) => stored.set(key, value),
    localLibraryPathKeyFromSong: (item) => String((item && item.localPath) || ''),
  };
  vm.runInNewContext(`${block}\nthis.api = this;`, context);

  const fresh = { localPath: '/watched.flac' };
  assert.equal(context.stampLocalLibraryAddedAtSong(fresh), 1);
  assert.ok(fresh.localLibraryAddedAt > 0);
  assert.equal(stored.size, 0, '盖章阶段不写盘');
  assert.equal(context.flushLocalLibraryAddedAtMap(), true);
  assert.deepEqual(Object.keys(JSON.parse(stored.get('mineradio-local-added-at-v1'))), ['/watched.flac']);
  assert.equal(context.flushLocalLibraryAddedAtMap(), false, '没有新增就不重复写盘');
  assert.equal(context.stampLocalLibraryAddedAtSong({}), 0);
});

test('入库时间表按时间从新到旧裁到上限', () => {
  const block = readFunctionBlock(
    readAppSource(),
    'var LOCAL_LIBRARY_ADDED_AT_STORE_KEY',
    'function localLibraryAssetStatus(',
  );
  const payload = {};
  for (let i = 0; i < 4200; i++) payload[`/song-${i}.flac`] = i + 1;
  const stored = new Map([['mineradio-local-added-at-v1', JSON.stringify(payload)]]);
  const context = {
    localStorage: { getItem: (key) => (stored.has(key) ? stored.get(key) : null) },
    setPersistentLocalStorageItem: (key, value) => stored.set(key, value),
    localLibraryPathKeyFromSong: (item) => String((item && item.localPath) || ''),
  };
  vm.runInNewContext(`${block}\nthis.api = this;`, context);

  assert.equal(context.LOCAL_LIBRARY_ADDED_AT_LIMIT, 4000);
  assert.equal(context.saveLocalLibraryAddedAtMap(), 4000);
  const saved = JSON.parse(stored.get('mineradio-local-added-at-v1'));
  assert.equal(Object.keys(saved).length, 4000);
  assert.equal(saved['/song-4199.flac'], 4200);
  assert.equal(saved['/song-0.flac'], undefined, '最老的记录先被裁掉');
});

test('曲库面板把音乐库交给外层 tab，根视图不再重复入口，分类视图自带返回与播放全部', () => {
  const source = readAppSource();
  const renderer = readFunctionBlock(
    source,
    'function localLibraryPlaylistPanelItemCount()',
    'function toggleLocalLibraryLike(index)',
  );

  // 音乐库已经提到 tab 栏，根视图恢复成 特别喜欢 → 独立歌单 → 全部音乐
  assert.doesNotMatch(renderer, /LOCAL_LIBRARY_CATEGORY_HOME_KIND, '≡', '音乐库'/);
  assert.ok(renderer.indexOf('data-special-liked-playlist') < renderer.indexOf('独立歌单 · '));
  assert.ok(renderer.indexOf('独立歌单 · ') < renderer.indexOf('全部音乐 · '));
  // 分类首页的标题由 tab 承担，这一层只铺入口，不再画一遍 view-head
  assert.match(renderer, /if \(selectedCategory\.mode === 'home'\) \{\s*\n\s*html \+= localLibraryCategoryHomeCardsHtml\(\);/);
  // 分类视图复用既有玻璃样式类，不引入新 CSS
  assert.match(renderer, /class="local-playlist-view-head"/);
  assert.match(renderer, /class="local-playlist-view-actions"/);
  assert.match(renderer, /data-library-back="/);
  assert.match(renderer, /data-selected-playlist-play="1">播放全部/);
  // 目录层不铺歌，也不该弹"还没有本地音乐"
  assert.match(renderer, /if \(!songs\.length && !categoryDirectory\)/);
  // 分组卡片走面板懒加载额度
  assert.match(renderer, /data-pl-load-more="1">加载更多 ' \+ visible \+ '\/' \+ entries\.length/);
  assert.match(renderer, /localLibraryCategoryDomSignature\(selectedCategory\)/);
});

test('音乐库是与当前队列 / 歌单并排的第三个 tab，共用同一个列表容器', () => {
  const source = readAppSource();
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

  // tab 顺序必须是 当前队列 → 歌单 → 音乐库
  const tabQueue = html.indexOf('id="tab-queue"');
  const tabPl = html.indexOf('id="tab-pl"');
  const tabLibrary = html.indexOf('id="tab-library"');
  assert.ok(tabQueue > 0, '当前队列 tab 必须还在');
  assert.ok(tabPl > tabQueue, '歌单排在当前队列之后');
  assert.ok(tabLibrary > tabPl, '音乐库排在歌单之后');
  assert.match(html, /id="tab-library"[^>]*onclick="switchPlaylistTab\('library'\)"[^>]*>音乐库<\/button>/);
  // 工具条共用，所以要能按 tab 换说明并藏掉「新建」
  assert.match(html, /id="pl-pane-chip"/);
  assert.match(html, /id="pl-pane-create-btn"/);

  const tabSwitch = readFunctionBlock(source, 'function switchPlaylistTab(tab)', 'function setMiniQueueOpen(open)');
  // 两个 tab 共用一份选中状态：切过去摆到分类首页，切回来退到全部音乐
  assert.match(tabSwitch, /tab === 'library' && !isLocalLibraryCategoryKind\(localLibraryPlaylistSelection\)/);
  assert.match(tabSwitch, /localLibraryPlaylistSelection = LOCAL_LIBRARY_CATEGORY_HOME_KIND/);
  assert.match(tabSwitch, /tab === 'playlists' && isLocalLibraryCategoryKind\(localLibraryPlaylistSelection\)/);
  assert.match(tabSwitch, /getElementById\('pl-pane'\)\.style\.display = isPlaylistListTab\(tab\)/);
  assert.match(tabSwitch, /applyPlaylistPaneToolbarMode\(tab\)/);
  // 选中分类后 tab 必须落到音乐库，否则会被 switchPlaylistTab 当成歌单又退回去
  assert.match(source, /safeSwitchPlaylistTab\(isLocalLibraryCategoryKind\(nextSelection\) \? 'library' : 'playlists', 'local-playlist-select'\)/);
  // 凡是「面板正在铺卡片」的判断都得把音乐库算进来，否则曲库变化时这一页不刷新
  assert.match(source, /function isPlaylistListTab\(tab\) \{/);
  const strayTabChecks = source.split('\n').filter(
    (line) => line.includes("queueViewTab === 'playlists'") && !line.includes('typeof isPlaylistListTab'),
  );
  assert.deepEqual(strayTabChecks, [], '面板铺卡片的判断要统一走 isPlaylistListTab，只有 vm 切片守卫允许留回落');
});

/**
 * 把真实的 tab 切换代码搬进隔离 realm，配一份够用的假 DOM，直接看行为而不是看正则。
 * @param {string} selection 初始选中的播放列表 kind。
 * @param {string} tab 初始 tab。
 * @returns {object} vm 上下文，els 里是每个假节点的最终状态。
 */
function createTabContext(selection = 'library', tab = 'queue') {
  const block = readFunctionBlock(
    readAppSource(),
    'function normalizePlaylistPanelTab(tab)',
    'function setMiniQueueOpen(open)',
  );
  const els = {};
  function fakeEl(id) {
    const node = {
      id,
      active: false,
      style: { display: '' },
      textContent: '',
      classList: { toggle: (name, on) => { if (name === 'active') node.active = !!on; } },
    };
    els[id] = node;
    return node;
  }
  ['tab-queue', 'tab-pl', 'tab-library', 'queue-pane', 'pl-pane', 'pl-list', 'queue-list', 'playlist-panel',
    'pl-pane-chip', 'pl-pane-create-btn'].forEach(fakeEl);
  const renders = [];
  const context = {
    LOCAL_ONLY_MODE: true,
    queueViewTab: tab,
    localLibraryPlaylistSelection: selection,
    LOCAL_LIBRARY_CATEGORY_HOME_KIND: 'library-cat:home',
    isLocalLibraryCategoryKind: (kind) => String(kind || '').indexOf('library-') === 0,
    resetPlaylistPanelRenderLimit: () => { renders.push('reset'); },
    refreshUserPlaylists: () => { renders.push('render'); },
    animateVisiblePanelList: () => {},
    safeShelfRebuild: () => {},
    document: { getElementById: (id) => els[id] || null },
    els,
    renders,
  };
  vm.runInNewContext(`${block}\nthis.switchTab = switchPlaylistTab;\nthis.isListTab = isPlaylistListTab;`, context);
  return context;
}

test('切到音乐库 tab 会把选中项摆到分类首页，切回歌单则退回全部音乐', () => {
  const ctx = createTabContext('library', 'queue');

  ctx.switchTab('library');
  assert.equal(ctx.queueViewTab, 'library');
  assert.equal(ctx.localLibraryPlaylistSelection, 'library-cat:home', '音乐库 tab 必须落在分类首页');
  assert.equal(ctx.els['tab-library'].active, true);
  assert.equal(ctx.els['tab-pl'].active, false);
  assert.equal(ctx.els['tab-queue'].active, false);
  assert.equal(ctx.els['pl-pane'].style.display, '', '音乐库和歌单共用同一个 pane');
  assert.equal(ctx.els['queue-pane'].style.display, 'none');
  assert.equal(ctx.els['pl-pane-chip'].textContent, '音乐库智能分类');
  assert.equal(ctx.els['pl-pane-create-btn'].style.display, 'none', '音乐库那一页没有「新建歌单」');
  assert.ok(ctx.renders.includes('render'), '切过去要重绘一次');

  ctx.switchTab('playlists');
  assert.equal(ctx.localLibraryPlaylistSelection, 'library', '切回歌单要退回全部音乐，不能留在分类里');
  assert.equal(ctx.els['tab-pl'].active, true);
  assert.equal(ctx.els['tab-library'].active, false);
  assert.equal(ctx.els['pl-pane'].style.display, '');
  assert.equal(ctx.els['pl-pane-chip'].textContent, '本地音乐与独立歌单');
  assert.equal(ctx.els['pl-pane-create-btn'].style.display, '');
});

test('从分组或某位艺术家切走再回来不会串页，队列 tab 不动选中项', () => {
  // 停在 library-value 层时切到队列，选中项要原样保留，回来还在音乐库
  const deep = createTabContext('library-value:artist:周杰伦', 'library');
  deep.switchTab('queue');
  assert.equal(deep.queueViewTab, 'queue');
  assert.equal(deep.localLibraryPlaylistSelection, 'library-value:artist:周杰伦', '切到队列不该动分类选中项');
  assert.equal(deep.els['pl-pane'].style.display, 'none');
  deep.switchTab('library');
  assert.equal(deep.localLibraryPlaylistSelection, 'library-value:artist:周杰伦', '回到音乐库应停在原来那一层');

  // 反过来，停在独立歌单时切到音乐库不能把歌单当成分类
  const custom = createTabContext('local-playlist:abc', 'playlists');
  custom.switchTab('library');
  assert.equal(custom.localLibraryPlaylistSelection, 'library-cat:home');
  custom.switchTab('playlists');
  assert.equal(custom.localLibraryPlaylistSelection, 'library', '分类退场后回落全部音乐');

  // 特别喜欢是歌单侧的选中项，切到歌单 tab 不该被动过
  const liked = createTabContext('special-liked', 'playlists');
  liked.switchTab('playlists');
  assert.equal(liked.localLibraryPlaylistSelection, 'special-liked');

  // podcasts 在本地模式下并到歌单，仍要按歌单那一侧处理
  const podcast = createTabContext('library-group:genre', 'library');
  podcast.switchTab('podcasts');
  assert.equal(podcast.queueViewTab, 'playlists');
  assert.equal(podcast.localLibraryPlaylistSelection, 'library');

  assert.equal(podcast.isListTab('library'), true);
  assert.equal(podcast.isListTab('playlists'), true);
  assert.equal(podcast.isListTab('queue'), false);
});

test('分类点击钩子排在通用歌单卡兜底之前', () => {
  const source = readAppSource();
  const handler = readFunctionBlock(
    source,
    "document.getElementById('pl-list').addEventListener('click'",
    'function renderMyPodcastRadioItems(',
  );

  const kindPlay = handler.indexOf('data-library-kind-play');
  const kindCard = handler.indexOf("closest('[data-library-kind]')");
  const back = handler.indexOf('data-library-back');
  const fallback = handler.indexOf("closest('.pl-card')");

  assert.ok(kindPlay > 0 && kindCard > 0 && back > 0 && fallback > 0);
  assert.ok(kindPlay < kindCard, '播放按钮要先于整卡导航命中');
  assert.ok(kindCard < fallback, '分类卡必须挡在 openPlaylistPanelDetail 兜底之前');
  assert.ok(back < fallback);
  assert.match(handler, /var libraryKind = libraryKindCard\.getAttribute\('data-library-kind'\);\n\s*selectLocalPlaylist\(libraryKind\);/);
  assert.match(handler, /playLocalLibrarySong\(0, libraryKindPlay\.getAttribute\('data-library-kind-play'\)\)/);
});

test('入库时间在导入与监控两条路径上都会盖章，且不动 SQLite 曲库表', () => {
  const source = readAppSource();
  const store = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'local-library-store.js'), 'utf8');

  assert.match(source, /var librarySync = syncLocalLibraryIndexWithSongs\(libraryFolderPath, songs\);\n  noteLocalLibraryAddedAt\(songs, librarySync\);/);
  assert.match(source, /typeof stampLocalLibraryAddedAtSong === 'function'\) stampLocalLibraryAddedAtSong\(step\.song\)/);
  assert.match(source, /typeof flushLocalLibraryAddedAtMap === 'function'\) flushLocalLibraryAddedAtMap\(\)/);
  assert.doesNotMatch(store, /added_at/, '曲库表没有迁移通道，入库时间不能塞进 SQLite');
  assert.doesNotMatch(source, /localLibraryAddedAt:/, '索引记录字段表不接受额外字段，别往里塞');
});
