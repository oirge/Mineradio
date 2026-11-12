'use strict';
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
const failed = (status = 502, more = {}) => ({ ok: false, status, error: 'upstream_network_error', message: '连接上游服务失败', ...more });
async function settle() { for (let i = 0; i < 40; i++) await Promise.resolve(); }
function client(options = {}) {
  let sequence = 0;
  const timers = new Map();
  const requests = [];
  const chips = [];
  const saved = {};
  let authorizedCalls = 0;
  const scope = {
    console: { warn() {} }, AbortController,
    setTimeout: (fn, ms) => { const id = ++sequence; timers.set(id, { fn, ms }); return id; },
    clearTimeout: id => timers.delete(id),
    document: { getElementById: () => null },
    localStorage: { getItem: () => JSON.stringify(options.cache || {}) },
    setPersistentLocalStorageItem: (key, value) => { saved[key] = JSON.parse(value); },
    fx: { lyricTranslateTarget: '', lyricTranslationMode: 'on', lyricTranslateFallback: options.legacyFallback || 'off' },
    isCustomTranslationReady: () => options.ready !== false,
    customTranslationRevision: () => options.revision || 0,
    mineradioAuthorizedFetch: (url, opts) => { authorizedCalls++; return scope.fetch(url, opts); },
    lyricTranslationWanted: () => scope.fx.lyricTranslationMode === 'on' || scope.fx.desktopLyricsTranslation === true,
    isNoLyricText: () => false,
    bumpStageLyricRows() {}, stageLyrics: {}, refreshCurrentLyricStyle() {}, showToast() {},
    lyricsLines: (options.lines || ['微风轻轻吹过']).map(text => ({ text })),
    fetch: (url, opts) => {
      const request = { url, ...opts, data: JSON.parse(opts.body) };
      requests.push(request);
      if (options.fetch) return options.fetch(request, requests.length);
      const response = typeof options.reply === 'function' ? options.reply(request, requests.length) : options.reply || reply('1. A gentle breeze passes by.');
      return Promise.resolve({ status: response.status || 200, json: () => Promise.resolve(response) });
    }
  };
  vm.createContext(scope);
  vm.runInContext(clientCode, scope);
  scope.setLyricTranslateChip = text => chips.push(text);
  return {
    scope, timers, requests, chips, saved,
    authorizedCalls: () => authorizedCalls,
    setRevision(value) { options.revision = value; },
    setReady(value) { options.ready = value; },
    async fire(ms) {
      const entry = [...timers].find(([, value]) => value.ms === ms);
      assert.ok(entry, 'missing timer ' + ms + '; have ' + [...timers.values()].map(t => t.ms));
      timers.delete(entry[0]); entry[1].fn(); await settle();
    },
    async start() { scope.scheduleLyricLlmTranslation(); await this.fire(900); },
    async finish() { await this.fire(60); if ([...timers.values()].some(t => t.ms === 250)) await this.fire(250); }
  };
}

test('empty legacy cache is removed without removing successful translations', async () => {
  const empty = 'English\0微风轻轻吹过';
  const keep = 'English\0蓝色天空';
  const c = client({ cache: { [empty]: '', [keep]: 'Blue sky.' } });
  await c.start();
  assert.equal(c.requests.length, 1);
  assert.equal(c.scope.readLyricLlmTranslateCache()[keep], 'Blue sky.');
  assert.equal(c.scope.readLyricLlmTranslateCache()[empty], 'A gentle breeze passes by.');
});

test('network failure retries after 2 and 5 seconds, then succeeds', async () => {
  const c = client({ reply: (_, n) => n < 3 ? failed() : reply('1. A gentle breeze passes by.') });
  await c.start(); await c.fire(2000); await c.fire(5000); await c.finish();
  assert.equal(c.requests.length, 3); assert.equal(c.scope.lyricsLines[0].translation, 'A gentle breeze passes by.');
  assert.equal(c.scope.lyricLlmTranslateState.running, false);
  assert.ok(c.chips.some(v => v != null && v.startsWith('翻译完成 1/1')));
});

test('raw fetch rejection is retryable', async () => {
  const c = client({ fetch: () => Promise.reject(new TypeError('Failed to fetch')) });
  await c.start(); await c.fire(2000); await c.fire(5000); await c.finish();
  assert.equal(c.requests.length, 3);
});

test('retry exhaustion stops without persisted failure or a render-triggered loop', async () => {
  const c = client({ reply: failed() });
  await c.start(); await c.fire(2000); await c.fire(5000); await c.finish();
  for (let i = 0; i < 10; i++) c.scope.scheduleLyricLlmTranslation();
  assert.equal(c.requests.length, 3); assert.equal(c.timers.size, 0);
  assert.equal(Object.keys(c.scope.readLyricLlmTranslateCache()).length, 0);
  assert.ok(c.chips.some(v => v != null && v.includes('1 行失败')));
  c.scope.retryLyricLlmTranslation(); await c.fire(0); assert.equal(c.requests.length, 4);
});

test('invalid response language is retried, never cached as empty or reported complete', async () => {
  const c = client({ reply: reply('1. 微风轻轻吹过') });
  await c.start(); await c.fire(2000); await c.fire(5000); await c.finish();
  assert.equal(c.requests.length, 3); assert.equal(Object.keys(c.scope.readLyricLlmTranslateCache()).length, 0);
  assert.equal(c.chips.some(v => v != null && v.startsWith('翻译完成')), false);
});

test('partial result retries only missing numbered lines without shifting translations', async () => {
  const c = client({ lines: ['第一行', '第二行', '第三行'], reply: (_, n) => n === 1 ? reply('1. First line.\n3. Third line.') : reply('1. Second line.') });
  await c.start();
  assert.equal(c.scope.lyricsLines[0].translation, 'First line.');
  assert.equal(c.scope.lyricsLines[1].translation, undefined);
  assert.equal(c.scope.lyricsLines[2].translation, 'Third line.');
  await c.fire(2000); await c.finish();
  assert.ok(c.requests[1].data.messages[1].content.includes('第二行'));
  assert.ok(!c.requests[1].data.messages[1].content.includes('第三行'));
  assert.equal(c.scope.lyricLlmTranslateState.done, 3);
});

test('duplicate lyrics make one request item and update every matching line', async () => {
  const c = client({ lines: ['微风轻轻吹过', '微风轻轻吹过'] });
  await c.start(); await c.finish();
  assert.equal(c.scope.lyricLlmTranslateState.total, 1);
  assert.ok(c.scope.lyricsLines.every(line => line.translation === 'A gentle breeze passes by.'));
});

test('song changes abort old work and late replies cannot populate the new song', async () => {
  let resolve;
  const c = client({ fetch: () => new Promise(r => { resolve = r; }) });
  await c.start(); const oldLine = c.scope.lyricsLines[0];
  c.scope.lyricsLines = [{ text: '新的一首歌' }]; c.scope.scheduleLyricLlmTranslation();
  assert.equal(c.requests[0].signal.aborted, true);
  resolve({ json: async () => reply('1. A stale translation.') }); await settle();
  assert.equal(oldLine.translation, undefined); assert.equal(c.scope.lyricsLines[0].translation, undefined);
  assert.equal(Object.keys(c.scope.readLyricLlmTranslateCache()).length, 0);
  await c.fire(900); assert.equal(c.requests.length, 2);
});

test('target changes cancel old requests and reject old replies', async () => {
  let resolve;
  const c = client({ fetch: () => new Promise(r => { resolve = r; }) });
  await c.start(); c.scope.fx.lyricTranslateTarget = 'Japanese'; c.scope.scheduleLyricLlmTranslation();
  resolve({ json: async () => reply('1. Old English translation.') }); await settle();
  assert.equal(c.scope.lyricsLines[0].translation, undefined);
  assert.equal(c.requests[0].signal.aborted, true);
});

test('turning translation off cancels backoff', async () => {
  const c = client({ reply: failed() }); await c.start();
  c.scope.fx.lyricTranslationMode = 'off'; c.scope.scheduleLyricLlmTranslation();
  assert.equal(c.timers.size, 0); assert.equal(c.scope.lyricLlmTranslateState.running, false);
});

test('authentication errors do not repeatedly retry', async () => {
  const c = client({ reply: failed(401, { retryable: false }) }); await c.start(); await c.finish();
  assert.equal(c.requests.length, 1);
});

test('Retry-After is honored only within the bounded automatic retry policy', async () => {
  const c = client({ reply: failed(429, { retryAfterMs: 11000 }) }); await c.start();
  assert.ok([...c.timers.values()].some(t => t.ms === 11000));
  const long = client({ reply: failed(429, { retryAfterMs: 86400000 }) }); await long.start(); await long.finish();
  assert.equal(long.requests.length, 1); assert.equal(long.timers.size, 0);
});

test('client timeout is longer than the server deadline', async () => {
  const c = client({ fetch: (_, n) => n === 1 ? new Promise(() => {}) : Promise.reject(new Error('not used')) });
  await c.start(); assert.ok([...c.timers.values()].some(t => t.ms === 50000));
});

test('patch integrates translation cancellation into the real app', () => {
  const app=appSource;
  assert.ok(app.includes("function setLyricTranslateTarget(value) {\n  cancelLyricLlmTranslation();"));
  assert.ok(app.includes("function setLyricTranslationMode(mode) {\n  cancelLyricLlmTranslation();"));
  assert.ok(app.includes("if (key === 'desktopLyricsTranslation') scheduleLyricLlmTranslation();"));
  assert.ok(!app.includes('LYRIC_LLM_TRANSLATE_MISS_MS'));
});


test('no configured source or missing source helper causes no request or network timer', async () => {
  for (const missing of [false, true]) {
    const c = client({ ready: false });
    if (missing) delete c.scope.isCustomTranslationReady;
    c.scope.scheduleLyricLlmTranslation(); await settle();
    assert.equal(c.requests.length, 0); assert.equal(c.authorizedCalls(), 0); assert.equal(c.timers.size, 0);
  }
});
test('successful cached translations remain available without a custom source', async () => {
  const key = 'English\0微风轻轻吹过';
  const c = client({ ready: false, cache: { [key]: 'A gentle breeze passes by.' } });
  c.scope.scheduleLyricLlmTranslation(); await settle();
  assert.equal(c.scope.lyricsLines[0].translation, 'A gentle breeze passes by.');
  assert.equal(c.requests.length, 0); assert.equal(c.timers.size, 0);
});
test('source revision changes cancel stale work before it can update lyrics or caches', async () => {
  let release;
  const c = client({ revision: 1, fetch: () => new Promise(resolve => { release = resolve; }) });
  await c.start(); const original = c.scope.lyricsLines[0];
  c.setRevision(2); c.scope.scheduleLyricLlmTranslation();
  assert.equal(c.requests[0].signal.aborted, true);
  release({ json: async () => reply('1. A stale source translation.') }); await settle();
  assert.equal(original.translation, undefined);
  assert.equal(Object.keys(c.scope.readLyricLlmTranslateCache()).length, 0);
  await c.fire(900); assert.equal(c.requests.length, 2); assert.equal(c.scope.lyricLlmTranslateState.configRevision, 2);
});
test('legacy bundled fallback preferences never cause a fallback request', async () => {
  const c = client({ legacyFallback: 'mymemory', reply: failed(401, { retryable: false }) });
  await c.start(); await c.finish();
  assert.equal(c.scope.lyricTranslateFallbackEnabled(), false); assert.equal(c.requests.length, 1);
  assert.equal(c.requests[0].data.provider, undefined); assert.equal(c.authorizedCalls(), 1);
});
test('configured translation requests use the authorized fetch wrapper and not a built-in source', async () => {
  const c = client(); await c.start(); await c.finish();
  assert.equal(c.authorizedCalls(), 1); assert.equal(c.requests[0].url, '/api/lyric-translate'); assert.equal(c.requests[0].method, 'POST');
  assert.equal(c.requests[0].data.endpoint, undefined); assert.equal(c.requests[0].data.apiKey, undefined); assert.equal(c.requests[0].data.model, undefined);
});
test('backend NOT_CONFIGURED stops automatic retries when the renderer has stale settings', async () => {
  const c = client({ reply: failed(400, { code: 'NOT_CONFIGURED', retryable: false }) });
  await c.start(); await c.finish();
  assert.equal(c.requests.length, 1); assert.equal(c.timers.size, 0);
});
