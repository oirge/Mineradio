'use strict';
// 按歌落盘的 LLM 译文（叠加在 localStorage 全局缓存之上）在渲染层的行为：
// 本地歌重开后从 SQLite 曲库回填译文、不再打网络；新译文按歌落盘。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
const appStart = appSource.indexOf('var LYRIC_LLM_TRANSLATE_STORE_KEY =');
const appEnd = appSource.indexOf('// ---- 多行舞台行池', appStart);
assert.ok(appStart > 0 && appEnd > appStart);
const clientCode = appSource.slice(appStart, appEnd);
const reply = content => ({ ok: true, body: JSON.stringify({ choices: [{ message: { content } }] }) });
async function settle() { for (let i = 0; i < 80; i++) await Promise.resolve(); }

// 复刻 lyric-translation-retry.test.js 的 VM 装置，另外补上桌面 SQLite 曲库需要的全局：
// window.desktopWindow / currentLyricSong / localAssetCacheKey / read+putLocalLyricCacheRecords。
function client(options = {}) {
  let sequence = 0;
  const timers = new Map();
  const requests = [];
  const chips = [];
  const puts = [];
  const store = Object.assign(Object.create(null), options.store || {});
  const scope = {
    console: { warn() {} }, AbortController,
    setTimeout: (fn, ms) => { const id = ++sequence; timers.set(id, { fn, ms }); return id; },
    clearTimeout: id => timers.delete(id),
    document: { getElementById: () => null },
    localStorage: { getItem: () => JSON.stringify(options.cache || {}) },
    setPersistentLocalStorageItem: () => {},
    fx: { lyricTranslateTarget: '', lyricTranslationMode: 'on', lyricTranslateFallback: 'off' },
    lyricTranslationWanted: () => scope.fx.lyricTranslationMode === 'on',
    isNoLyricText: () => false,
    bumpStageLyricRows() {}, stageLyrics: {}, refreshCurrentLyricStyle() {}, showToast() {},
    lyricsLines: (options.lines || ['微风轻轻吹过']).map(text => ({ text })),
    window: { desktopWindow: { isDesktop: true } },
    currentLyricSong: () => options.song || { localKey: 'song-1' },
    localAssetCacheKey: song => (song && song.localKey) ? String(song.localKey) : '',
    readLocalLyricCacheRecords: async keys => {
      const out = {};
      (keys || []).forEach(k => { if (store[k]) out[k] = JSON.parse(JSON.stringify(store[k])); });
      return out;
    },
    putLocalLyricCacheRecord: async record => {
      puts.push(JSON.parse(JSON.stringify(record)));
      store[record.id] = JSON.parse(JSON.stringify(record));
      return true;
    },
    fetch: (url, opts) => {
      const request = { url, ...opts, data: JSON.parse(opts.body) };
      requests.push(request);
      const response = typeof options.reply === 'function' ? options.reply(request, requests.length) : options.reply || reply('1. A gentle breeze passes by.');
      return Promise.resolve({ status: response.status || 200, json: () => Promise.resolve(response) });
    }
  };
  vm.createContext(scope);
  vm.runInContext(clientCode, scope);
  scope.setLyricTranslateChip = text => chips.push(text);
  return {
    scope, timers, requests, chips, puts, store,
    async fire(ms) {
      const entry = [...timers].find(([, value]) => value.ms === ms);
      assert.ok(entry, 'missing timer ' + ms + '; have ' + [...timers.values()].map(t => t.ms));
      timers.delete(entry[0]); entry[1].fn(); await settle();
    },
    // 预加载门槛是异步的：首个 schedule 触发 DB 读回后 return，settle() 让它并回缓存再自调度。
    async schedule() { scope.scheduleLyricLlmTranslation(); await settle(); },
    async finish() { await this.fire(60); if ([...timers.values()].some(t => t.ms === 250)) await this.fire(250); await settle(); }
  };
}

test('local song replay backfills translations from the per-song SQLite store without any network', async () => {
  const key = 'English\u0000微风轻轻吹过';
  const c = client({
    song: { localKey: 'song-1' },
    store: { 'song-1': { id: 'song-1', localLyricText: 'lrc', localLyricTranslations: { v: 1, map: { [key]: 'A gentle breeze passes by.' } } } }
  });
  await c.schedule();
  assert.equal(c.requests.length, 0, '老歌重播不得再打 /api/lyric-translate');
  assert.equal(c.timers.size, 0, '命中缓存后不应留下网络防抖定时器');
  assert.equal(c.scope.lyricsLines[0].translation, 'A gentle breeze passes by.');
  assert.equal(c.scope.lyricsLines[0].translationSource, 'llm');
  assert.equal(c.scope.readLyricLlmTranslateCache()[key], 'A gentle breeze passes by.');
});

test('translating a local song persists localLyricTranslations to the per-song store', async () => {
  const key = 'English\u0000微风轻轻吹过';
  const c = client({ song: { localKey: 'song-2' }, store: {} });
  await c.schedule();      // 预加载没命中 → 自调度建 pending，排下 900ms 网络防抖
  await c.fire(900);       // 发起翻译 → accept 记入按歌载荷
  await c.finish();        // finish 冲写按歌记录
  assert.equal(c.scope.lyricsLines[0].translation, 'A gentle breeze passes by.');
  const rec = c.store['song-2'];
  assert.ok(rec && rec.localLyricTranslations, '译好的本地歌必须落盘按歌译文');
  assert.equal(rec.localLyricTranslations.v, 1);
  assert.equal(rec.localLyricTranslations.map[key], 'A gentle breeze passes by.');
});

test('write path read-merges so it never clobbers existing lyric text or prior translations', async () => {
  const prior = 'English\u0000旧的一行';
  const fresh = 'English\u0000微风轻轻吹过';
  const c = client({
    song: { localKey: 'song-3' },
    store: { 'song-3': { id: 'song-3', localLyricText: '正文不能丢', localLyricTranslations: { v: 1, map: { [prior]: 'An old line.' } } } }
  });
  await c.schedule();      // 预加载并回既有译文
  await c.fire(900);
  await c.finish();
  const rec = c.store['song-3'];
  assert.equal(rec.localLyricText, '正文不能丢', '写按歌译文时先读回整条记录，不能覆盖正文');
  assert.equal(rec.localLyricTranslations.map[prior], 'An old line.', '既有译文必须保留');
  assert.equal(rec.localLyricTranslations.map[fresh], 'A gentle breeze passes by.', '新译文并入同一张表');
});

test('non-desktop (no window.desktopWindow) keeps the original synchronous path untouched', async () => {
  const key = 'English\u0000微风轻轻吹过';
  const c = client({ store: {} });
  c.scope.window = undefined;   // 浏览器/测试环境：门槛应关闭，绝不触碰 DB
  await c.schedule();
  // 没有预加载门槛拦截，直接进入原有网络流程（排下 900ms 防抖）。
  assert.ok([...c.timers.values()].some(t => t.ms === 900), '非桌面环境应走原同步调度');
  await c.fire(900);
  await c.finish();
  assert.equal(c.scope.lyricsLines[0].translation, 'A gentle breeze passes by.');
  assert.equal(c.puts.length, 0, '非桌面环境不得写 SQLite 曲库');
  assert.equal(c.scope.readLyricLlmTranslateCache()[key], 'A gentle breeze passes by.');
});

test('source wires the per-song translation cache into schedule / run / persist paths', () => {
  assert.ok(/function loadSongLyricTranslations\(/.test(appSource));
  assert.ok(/function recordSongLyricTranslation\(/.test(appSource));
  assert.ok(/function flushSongLyricTranslations\(/.test(appSource));
  assert.ok(appSource.includes('loadSongLyricTranslations(dbSong).then'));
  assert.ok(appSource.includes('flushSongLyricTranslations();'));
  // 门槛必须以桌面 DB 为条件，浏览器/测试（无 window）走原路径。
  assert.ok(appSource.includes("typeof window !== 'undefined'"));
});
