'use strict';
// 最近播放记录清空守卫。
// 这里的关键不是「能不能清」，而是「别多清」：播放次数和累计时长是用户攒出来的资产，
// 一个隐私向的「清空最近播放」不该顺手把它们一起删掉。所以两档语义各自钉一条测试，
// 顺便盯住清空后那几个必须重画的视图——面板有 DOM 签名早退，忘了作废签名就会留着一屏旧数据。

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

/**
 * 把 vm 里创建的对象拷回本 realm，供 deepEqual 比较。
 * @param {*} value 待转换值。
 * @returns {*} 结构相同的本 realm 值。
 */
function plain(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

const STORE_SOURCE = slice(
  appSource,
  'function formatListenDurationText(ms) {',
  'function fallbackHomeTiles() {',
  '听歌统计与清空',
);
/**
 * 造一个够用的假节点。
 * @param {string} id 节点标识。
 * @returns {object} 假节点。
 */
function createFakeNode(id) {
  const classNames = new Set();
  return {
    id,
    textContent: '',
    focusCount: 0,
    classList: {
      add() { for (const name of arguments) classNames.add(name); },
      remove() { for (const name of arguments) classNames.delete(name); },
      contains(name) { return classNames.has(name); },
    },
    focus() { this.focusCount++; },
  };
}

/**
 * 在 vm 里跑起听歌统计与清空模块。
 * @param {object=} options 桩配置。
 * @returns {object} 上下文与各类调用记录。
 */
function loadClearModule(options) {
  const opts = options || {};
  const toasts = [];
  const calls = [];
  const timers = [];
  const nodes = new Map();
  ['listen-history-clear-modal', 'listen-history-clear-name', 'listen-history-clear-meta',
    'listen-history-clear-cancel'].forEach((id) => nodes.set(id, createFakeNode(id)));
  const listenStats = {
    history: opts.history ? JSON.parse(JSON.stringify(opts.history)) : [],
    songs: opts.songs ? JSON.parse(JSON.stringify(opts.songs)) : {},
    artists: opts.artists ? JSON.parse(JSON.stringify(opts.artists)) : {},
    updatedAt: 123,
  };
  const context = {
    console, JSON, Object, Array, String, Number, Math, Date, Boolean,
    SONG_RESUME_STORE_KEY: 'mineradio-song-resume-v1',
    setTimeout(fn, delay) { timers.push({ fn, delay }); return timers.length; },
    clearTimeout(id) { if (timers[id - 1]) timers[id - 1] = { fn() {}, delay: 0, cleared: true }; },
    localStorage: {
      store: Object.assign({}, opts.localStorage || {}),
      getItem(key) { return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null; },
      setItem(key, value) { this.store[key] = String(value); },
    },
    setPersistentLocalStorageItem() { calls.push('persist-resume'); },
    showToast(message) { toasts.push(String(message)); },
    queueItemKey(song) { return song ? String(song.key || song.path || song.name || '') : ''; },
    ensureListenStatsState() { return listenStats; },
    saveListenStatsState() { calls.push('save-listen-stats'); },
    formatProgramTime(sec) {
      const total = Math.max(0, Math.floor(Number(sec) || 0));
      return Math.floor(total / 60) + ':' + (total % 60 < 10 ? '0' : '') + (total % 60);
    },
    detailRow(label, value) { return '<div class="detail-row"><span>' + label + '</span><b>' + value + '</b></div>'; },
    openGsapModal(el) { calls.push('open:' + (el && el.id)); if (el) el.classList.add('show'); },
    closeGsapModal(el, after) {
      calls.push('close:' + (el && el.id));
      if (el) el.classList.remove('show');
      if (typeof after === 'function') after();
    },
    invalidateLocalLibraryCategoryIndex() { calls.push('invalidate-index'); },
    // 清空要同步到 SQLite 里的播放统计镜像，不然「全部清空」只清了 localStorage。
    // 这个标识声明在切片外，必须由 harness 供上，否则 ReferenceError 会被生产代码的
    // try/catch 吞掉，测试静默假通过。
    callLocalLibraryDb(method, payload) {
      calls.push('db:' + method + ':' + (payload && payload.scope));
      return opts.dbRejects ? Promise.reject(new Error('SQLITE_UNAVAILABLE')) : Promise.resolve({ ok: true, cleared: 3 });
    },
    renderLocalLibraryPlaylistPanel() { calls.push('render-panel'); },
    renderHomeDiscover() { calls.push('render-home'); },
    updateSongResumeControls() { calls.push('update-resume-controls'); },
    clearPlaybackSession() { calls.push('clear-session'); },
    playlistPanelLastDomSignature: 'stale-signature',
    pendingPlaybackSessionResume: { idx: 4, time: 88 },
    emptyHomeActive: opts.emptyHomeActive !== false,
    document: { getElementById(id) { return nodes.has(id) ? nodes.get(id) : null; } },
  };
  context.window = context;
  vm.runInNewContext(STORE_SOURCE, context, { filename: 'listen-history-clear.js' });
  (opts.resume || []).forEach((item) => {
    context.recordSongResumePosition({ key: item.key, name: item.key }, item.sec, item.dur || 600);
  });
  return { context, toasts, calls, timers, nodes, listenStats };
}
const SAMPLE = {
  history: [{ key: 'a', at: 100 }, { key: 'b', at: 90 }],
  songs: {
    a: { key: 'a', name: 'A', artist: '甲', plays: 7, listenMs: 900000, completed: 3, lastPlayedAt: 1700000000000 },
    b: { key: 'b', name: 'B', artist: '乙', plays: 2, listenMs: 120000, completed: 0, lastPlayedAt: 1600000000000 },
  },
  artists: { 甲: { name: '甲', plays: 7, listenMs: 900000, lastPlayedAt: 1700000000000 } },
  resume: [{ key: 'b', sec: 95 }],
};

test('累计播放时长的文案在秒 / 分 / 小时之间都说人话', () => {
  const format = loadClearModule().context.formatListenDurationText;
  assert.equal(format(0), '0 秒');
  assert.equal(format(-1), '0 秒');
  assert.equal(format(undefined), '0 秒');
  assert.equal(format(45000), '45 秒');
  assert.equal(format(180000), '3 分钟');
  assert.equal(format(200000), '3 分 20 秒');
  assert.equal(format(3600000), '1 小时');
  assert.equal(format(4380000), '1 小时 13 分钟');
});

test('最近播放时间跨天之后给绝对时间，别让用户自己算「几天前」', () => {
  const format = loadClearModule().context.formatListenTimeText;
  const now = Date.now();
  const pad = (n) => (n < 10 ? '0' : '') + n;
  const stamp = (d) => pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  assert.equal(format(0), '', '没听过就不该显示时间');
  assert.equal(format(now + 60000), '刚刚', '系统时钟往后跳过也不能显示负数');
  assert.equal(format(now - 30000), '刚刚');
  assert.equal(format(now - 5 * 60000), '5 分钟前');
  assert.equal(format(now - 2 * 3600000), '2 小时前');
  const threeDays = new Date(now - 3 * 86400000);
  assert.equal(format(threeDays.getTime()), '3 天前 · ' + stamp(threeDays));
  const lastYear = new Date(2001, 4, 6, 7, 8);
  assert.equal(format(lastYear.getTime()), '2001-' + stamp(lastYear));
});

test('列表摘要按分类换顺序，续播位置跟在后面', () => {
  const harness = loadClearModule(SAMPLE);
  const brief = harness.context.songListenStatBrief;
  const songA = { key: 'a', name: 'A' };
  assert.match(brief(songA, 'plays'), /^播放 7 次 · /, '按播放次数分类时次数排前面');
  assert.match(brief(songA, 'recent'), / · 播放 7 次$/, '按最近播放分类时时间排前面');
  assert.match(brief({ key: 'b', name: 'B' }, 'recent'), /续播 1:35$/);
  assert.equal(brief({ key: 'never', name: 'N' }, 'recent'), '', '没听过的歌不该多出一行空摘要');
});
test('歌曲详情里的播放统计段五项齐全', () => {
  const harness = loadClearModule(SAMPLE);
  const html = harness.context.songListenStatDetailHtml({ key: 'a', name: 'A' });
  assert.match(html, /<div class="detail-section-title">播放统计<\/div>/);
  for (const label of ['播放次数', '完整播放', '累计播放时长', '最近播放时间', '最后播放位置']) {
    assert.ok(html.includes('<span>' + label + '</span>'), '缺少统计项：' + label);
  }
  assert.ok(html.includes('<b>7 次</b>'));
  assert.ok(html.includes('<b>3 次</b>'));
  assert.ok(html.includes('<b>15 分钟</b>'));
  assert.ok(html.includes('<b>无断点</b>'), 'a 没有断点，这一格要说清是「无」而不是留空');
});

test('没听过的歌在详情里给空态，不摆一片假的 0', () => {
  const harness = loadClearModule(SAMPLE);
  const html = harness.context.songListenStatDetailHtml({ key: 'never', name: 'N' });
  assert.match(html, /<div class="detail-empty">/);
  assert.ok(!html.includes('detail-row'), '空态不该混进统计行');
  assert.match(html, /听过之后会显示播放次数和累计时长/);
});

test('只有断点没有统计的歌也走统计段，不该被判成空态', () => {
  const harness = loadClearModule({ resume: [{ key: 'x', sec: 42 }] });
  const html = harness.context.songListenStatDetailHtml({ key: 'x', name: 'X' });
  assert.ok(!html.includes('detail-empty'));
  assert.ok(html.includes('<b>0:42</b>'));
  assert.ok(html.includes('<b>暂无</b>'), '没有次数的那几格要显式写暂无');
});

test('清空前先数清有多少东西要清', () => {
  assert.deepEqual(plain(loadClearModule(SAMPLE).context.listenHistoryClearCounts()), { history: 2, songs: 2, resume: 1 });
  assert.deepEqual(plain(loadClearModule().context.listenHistoryClearCounts()), { history: 0, songs: 0, resume: 0 });
});

test('一条记录都没有时不弹确认框，只给一句提示', () => {
  const harness = loadClearModule();
  harness.context.openListenHistoryClearModal();
  assert.deepEqual(harness.toasts, ['还没有播放记录']);
  assert.equal(harness.calls.indexOf('open:listen-history-clear-modal'), -1);
});
test('确认框上写清了要清多少条，焦点默认落在取消上', () => {
  const harness = loadClearModule(SAMPLE);
  harness.context.openListenHistoryClearModal();
  assert.ok(harness.calls.indexOf('open:listen-history-clear-modal') >= 0);
  assert.equal(harness.nodes.get('listen-history-clear-name').textContent, '最近播放 · 2 首');
  assert.equal(harness.nodes.get('listen-history-clear-meta').textContent, '2 首歌有统计 · 1 个断点');
  const focusTimer = harness.timers.find((t) => t.delay === 120);
  assert.ok(focusTimer, '要等弹窗动画落地再抢焦点');
  focusTimer.fn();
  // 默认焦点给「取消」：这个框里有一个会连播放次数一起删的按钮，回车不能直接落在它上面。
  assert.equal(harness.nodes.get('listen-history-clear-cancel').focusCount, 1);
});

test('「只清最近播放」保住播放次数和累计时长', () => {
  const harness = loadClearModule(SAMPLE);
  harness.context.clearListenHistory('recent');
  const stats = plain(harness.listenStats);
  assert.deepEqual(stats.history, []);
  assert.equal(stats.songs.a.plays, 7, '播放次数是用户攒出来的资产，隐私向的清空不该动它');
  assert.equal(stats.songs.a.listenMs, 900000);
  assert.equal(stats.songs.a.completed, 3);
  assert.equal(stats.songs.a.lastPlayedAt, 0, '最近播放时间属于「最近播放」，要跟着清');
  assert.equal(stats.songs.b.lastPlayedAt, 0);
  assert.equal(stats.artists['甲'].plays, 7);
  assert.equal(stats.artists['甲'].lastPlayedAt, 0);
  assert.deepEqual(Object.keys(plain(harness.context.ensureSongResumeState().songs)), ['b'], '断点不是播放记录，只清最近播放时要留着');
  assert.equal(harness.calls.indexOf('clear-session'), -1, '会话记录还留着，用户还能「继续上次播放」');
  assert.deepEqual(plain(harness.context.pendingPlaybackSessionResume), { idx: 4, time: 88 });
  assert.deepEqual(harness.toasts, ['最近播放已清空']);
});

test('「全部清空」连次数、时长、断点和会话一起归零', () => {
  const harness = loadClearModule(SAMPLE);
  harness.context.clearListenHistory('all');
  const stats = plain(harness.listenStats);
  assert.deepEqual(stats.history, []);
  assert.deepEqual(stats.songs, {});
  assert.deepEqual(stats.artists, {});
  assert.deepEqual(plain(harness.context.ensureSongResumeState().songs), {});
  assert.ok(harness.calls.indexOf('clear-session') >= 0);
  assert.deepEqual(plain(harness.context.pendingPlaybackSessionResume), { idx: -1, time: 0 }, '会话清了还留着待恢复位置，下一次启动会跳回一首已经没有记录的歌');
  assert.deepEqual(harness.toasts, ['播放记录与统计已清空']);
});
test('清空后所有依赖播放记录的视图都被逼着重画', () => {
  const harness = loadClearModule(SAMPLE);
  harness.context.clearListenHistory('recent');
  assert.ok(harness.calls.indexOf('save-listen-stats') >= 0);
  assert.ok(harness.calls.indexOf('invalidate-index') >= 0, '分类索引不作废，最近播放分类还会按旧顺序排');
  // 面板有 DOM 签名早退，清空后行内容可能凑巧和旧签名一致，签名必须先作废。
  assert.equal(harness.context.playlistPanelLastDomSignature, '');
  assert.ok(harness.calls.indexOf('render-panel') >= 0);
  assert.ok(harness.calls.indexOf('update-resume-controls') >= 0);
  assert.ok(harness.calls.indexOf('render-home') >= 0, '空库首页上就摆着最近播放，清了必须跟着重画');
});

test('首页没在空库态时不白跑一次首页重画', () => {
  const harness = loadClearModule(Object.assign({ emptyHomeActive: false }, SAMPLE));
  harness.context.clearListenHistory('all');
  assert.equal(harness.calls.indexOf('render-home'), -1);
});

test('确认按钮先关框再清，清完不残留待确认档位', () => {
  const harness = loadClearModule(SAMPLE);
  harness.context.confirmListenHistoryClear('all');
  const closeAt = harness.calls.indexOf('close:listen-history-clear-modal');
  const renderAt = harness.calls.indexOf('render-panel');
  assert.ok(closeAt >= 0 && renderAt > closeAt, '先关框再清，否则关闭动画期间列表重排会跳一下');
  assert.equal(harness.context.pendingListenHistoryClearScope, '');
  assert.deepEqual(plain(harness.listenStats.songs), {});
});

test('传错档位一律按「只清最近播放」处理，不能误伤统计', () => {
  const harness = loadClearModule(SAMPLE);
  harness.context.confirmListenHistoryClear('everything');
  assert.equal(plain(harness.listenStats).songs.a.plays, 7);
  assert.deepEqual(harness.toasts, ['最近播放已清空']);
});

test('弹窗节点还没进 DOM 时关闭回调照样执行', () => {
  const harness = loadClearModule(SAMPLE);
  harness.nodes.delete('listen-history-clear-modal');
  let ran = 0;
  harness.context.closeListenHistoryClearModal(() => { ran++; });
  assert.equal(ran, 1);
});
test('清空入口只出现在最近播放 / 最常播放两个分类里', () => {
  const stat = slice(appSource, 'function localLibraryCategoryStatMode(view) {', 'function localPlaylistsDomSignature(', '统计分类判定');
  assert.match(stat, /if \(!view \|\| view\.mode !== 'category'\) return '';/);
  assert.match(stat, /'recent-played'\) return 'recent';/);
  assert.match(stat, /'most-played'\) return 'plays';/);
  // 按钮跟着 statMode 走：别的分类头上不该多出一个「清空记录」。
  assert.match(appSource, /\(statMode \? '<button class="fx-mini-btn ghost danger" type="button" data-clear-listen-history="1">清空记录<\/button>' : ''\)/);
});

test('清空按钮的点击先于「返回」被认出来，不会顺手退出分类', () => {
  const handler = slice(appSource, "var clearListen = e.target && e.target.closest", 'var libraryBack = e.target', '清空记录点击分支');
  assert.match(handler, /closest\('\[data-clear-listen-history\]'\)/);
  assert.match(handler, /e\.preventDefault\(\);\s*e\.stopPropagation\(\);\s*openListenHistoryClearModal\(\);\s*return;/);
});

test('确认框能点遮罩关，也能按 Esc 关', () => {
  assert.match(appSource, /\['listen-history-clear-modal', closeListenHistoryClearModal\],/);
  const escape = slice(appSource, "var listenClearModal = document.getElementById('listen-history-clear-modal');", 'if (immersiveMode)', 'Esc 关闭分支');
  assert.match(escape, /classList\.contains\('show'\)/);
  assert.match(escape, /closeListenHistoryClearModal\(\);/);
});

test('歌曲详情弹窗里真的插了播放统计段', () => {
  assert.match(appSource, /songListenStatDetailHtml\(song\) \+/);
});
test('确认框复用 .modal / .modal-btn 外壳，主题插件才能接得上', () => {
  const modal = slice(htmlSource, 'id="listen-history-clear-modal"', '<div id="local-beat-modal"', '清空确认框');
  assert.match(modal, /class="modal-mask"/);
  assert.match(modal, /class="modal playlist-delete-modal"/, '外壳照抄删除歌单框，主题的 !important 段就是按这些类名写的');
  assert.match(modal, /role="dialog" aria-modal="true" aria-labelledby="listen-history-clear-title"/);
  assert.match(modal, /id="listen-history-clear-name"/);
  assert.match(modal, /id="listen-history-clear-meta"/);
  assert.match(modal, /id="listen-history-clear-cancel" class="modal-btn" type="button" onclick="closeListenHistoryClearModal\(\)"/);
  assert.match(modal, /onclick="confirmListenHistoryClear\('recent'\)"/);
  assert.match(modal, /class="modal-btn danger" type="button" onclick="confirmListenHistoryClear\('all'\)"/);
  // 两档的区别必须写在框里，不然用户按哪个都像在赌。
  assert.match(modal, /播放次数与累计时长仍然保留/);
  assert.match(modal, /不会删除本地音乐文件/);
});

test('两档清空都同步到 SQLite 播放统计镜像，scope 跟着一起传下去', () => {
  // 统计有两份：localStorage 里那份是视图数据源，SQLite 那份是曲库镜像。
  // 只清前面一份的话，用户按了「全部清空」，本机数据库里还整整齐齐留着一份同样的记录。
  const recent = loadClearModule(SAMPLE);
  recent.context.clearListenHistory('recent');
  assert.ok(recent.calls.includes('db:clearLocalLibraryDbPlayStats:recent'));
  assert.equal(recent.calls.filter((c) => c.startsWith('db:')).length, 1, '一次清空只发一条，别在循环里逐首发');

  const all = loadClearModule(SAMPLE);
  all.context.clearListenHistory('all');
  assert.ok(all.calls.includes('db:clearLocalLibraryDbPlayStats:all'));

  // 未知 scope 一律当 recent，别让打错的字符串顺着传下去把次数清了。
  const weird = loadClearModule(SAMPLE);
  weird.context.clearListenHistory('everything');
  assert.ok(weird.calls.includes('db:clearLocalLibraryDbPlayStats:recent'));
});

test('SQLite 那边失败不影响本地清空，也不许把 rejection 漏出去', async () => {
  // 没装 better-sqlite3 或者数据库打不开是常态，清空是用户当场按下的操作，
  // 不能因为镜像写不动就整个失败，更不能留一个 unhandled rejection 把进程带崩。
  const harness = loadClearModule(Object.assign({ dbRejects: true }, SAMPLE));
  harness.context.clearListenHistory('all');
  assert.ok(harness.calls.includes('db:clearLocalLibraryDbPlayStats:all'));
  assert.ok(harness.calls.includes('save-listen-stats'), '本地那份照样落盘');
  assert.deepEqual(plain(harness.listenStats.history), []);
  assert.ok(harness.toasts.some((t) => t.includes('清空')));
  await new Promise((resolve) => setImmediate(resolve));
});

test('清空同步走的是 clearLocalLibraryDbPlayStats，链路一路对齐到 store', () => {
  // 四段链路各改一处名字就会静默断掉：渲染层 catch 掉、preload 没这个方法就返回 null。
  assert.match(appSource, /callLocalLibraryDb\('clearLocalLibraryDbPlayStats', \{ scope: scope === 'all' \? 'all' : 'recent' \}\)/);
  const preloadSource = fs.readFileSync(path.join(root, 'desktop', 'preload.js'), 'utf8');
  assert.match(preloadSource, /clearLocalLibraryDbPlayStats: \(payload\) => ipcRenderer\.invoke\('mineradio-local-library-db-clear-play', payload \|\| \{\}\)/);
  const mainSource = fs.readFileSync(path.join(root, 'desktop', 'main.js'), 'utf8');
  assert.match(mainSource, /ipcMain\.handle\('mineradio-local-library-db-clear-play', trustedMainFrameHandler\(\(_event, payload\) => withLocalLibraryStore\(\(store\) => store\.clearPlayStats\(payload \|\| \{\}\)\)\)\)/);
  const storeSource = fs.readFileSync(path.join(root, 'desktop', 'local-library-store.js'), 'utf8');
  assert.match(storeSource, /clearPlayStats: clearPlayStats,/, '没挂到导出上，主进程那边 store.clearPlayStats 就是 undefined');
});

test('危险按钮的配色带 !important，压得住主题兼容层', () => {
  // app.css 里的兼容层对 .modal-btn 打了 !important，新规则不带就会被它盖掉。
  const danger = slice(cssSource, '#listen-history-clear-modal .modal-btn.danger{', '}', '清空框危险按钮');
  assert.match(danger, /background:linear-gradient\([^;]*\)!important/);
  assert.match(danger, /border-color:[^;]*!important/);
  assert.match(danger, /box-shadow:[^;]*!important/);
  const hover = slice(cssSource, '#listen-history-clear-modal .modal-btn.danger:hover{', '}', '清空框危险按钮悬停');
  assert.match(hover, /background:linear-gradient\([^;]*\)!important/);
  // 删除歌单那条规则必须还是独立选择器，别为了少写几行就和这条并到一起。
  assert.ok(cssSource.includes('#local-playlist-delete-confirm.modal-btn.danger{'));
});
