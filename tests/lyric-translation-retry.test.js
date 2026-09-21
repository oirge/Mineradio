'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const root = path.join(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
const serverSource = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const appStart = appSource.indexOf('var LYRIC_LLM_TRANSLATE_STORE_KEY =');
const appEnd = appSource.indexOf('// ---- 多行舞台行池', appStart);
assert.ok(appStart > 0 && appEnd > appStart);
const clientCode = appSource.slice(appStart, appEnd);
const serverStart = serverSource.indexOf('const LYRIC_MYMEMORY_ENDPOINT =');
const serverEnd = serverSource.indexOf('// ====================================================================\n//  HTTP Server', serverStart);
assert.ok(serverStart > 0 && serverEnd > serverStart);
const serverCode = serverSource.slice(serverStart, serverEnd);
const reply = content => ({ ok: true, body: JSON.stringify({ choices: [{ message: { content } }] }) });
const failed = (status = 502, more = {}) => ({ ok: false, status, error: 'upstream_network_error', message: '连接上游服务失败', ...more });
async function settle() { for (let i = 0; i < 40; i++) await Promise.resolve(); }
function client(options = {}) {
  let sequence = 0;
  const timers = new Map();
  const requests = [];
  const chips = [];
  const saved = {};
  const scope = {
    console: { warn() {} }, AbortController,
    setTimeout: (fn, ms) => { const id = ++sequence; timers.set(id, { fn, ms }); return id; },
    clearTimeout: id => timers.delete(id),
    document: { getElementById: () => null },
    localStorage: { getItem: () => JSON.stringify(options.cache || {}) },
    setPersistentLocalStorageItem: (key, value) => { saved[key] = JSON.parse(value); },
    fx: { lyricTranslateTarget: '', lyricTranslationMode: 'on', lyricTranslateFallback: options.fallback ? 'mymemory' : 'off' },
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
    async fire(ms) {
      const entry = [...timers].find(([, value]) => value.ms === ms);
      assert.ok(entry, 'missing timer ' + ms + '; have ' + [...timers.values()].map(t => t.ms));
      timers.delete(entry[0]); entry[1].fn(); await settle();
    },
    async start() { scope.scheduleLyricLlmTranslation(); await this.fire(900); },
    async finish() { await this.fire(60); if ([...timers.values()].some(t => t.ms === 250)) await this.fire(250); }
  };
}
function server(options = {}) {
  const requests = [];
  const timers = new Map();
  let index = 0;
  const scope = {
    AbortController, Buffer, URL, Date,
    LYRIC_TRANSLATE_ENDPOINT: 'https://primary.invalid/v1/chat/completions',
    LYRIC_TRANSLATE_API_KEY: 'test-only-secret', LYRIC_TRANSLATE_MODEL: 'test-model',
    setTimeout: (fn, ms) => { const id = ++index; timers.set(id, { fn, ms }); return id; },
    clearTimeout: id => timers.delete(id), console: { warn() {} },
    readRequestBody: req => Promise.resolve(req.body),
    sendJSON: (res, data, status = 200) => { res.result = data; res.status = status; res.writableEnded = true; },
    fetch: async (url, opts) => {
      requests.push({ url: String(url), ...opts });
      if (options.fetch) return options.fetch(String(url), opts, requests.length);
      const output = options.reply || { responseStatus: 200, quotaFinished: false, mtLangSupported: null, responseData: { translatedText: 'The wind blows softly.' } };
      return { ok: true, status: 200, headers: { get: () => options.retryAfter || null }, text: async () => JSON.stringify(output) };
    }
  };
  vm.createContext(scope); vm.runInContext(serverCode, scope);
  return { scope, requests, timers, async call(body) {
    const req = { method: 'POST', body };
    const res = new EventEmitter(); res.destroyed = false; res.writableEnded = false;
    await scope.handleLyricTranslateRequest(req, res);
    return res;
  } };
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
  assert.ok(c.chips.some(v => v.startsWith('翻译完成 1/1')));
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
  assert.ok(c.chips.some(v => v.includes('1 行失败')));
  c.scope.retryLyricLlmTranslation(); await c.fire(0); assert.equal(c.requests.length, 4);
});

test('invalid response language is retried, never cached as empty or reported complete', async () => {
  const c = client({ reply: reply('1. 微风轻轻吹过') });
  await c.start(); await c.fire(2000); await c.fire(5000); await c.finish();
  assert.equal(c.requests.length, 3); assert.equal(Object.keys(c.scope.readLyricLlmTranslateCache()).length, 0);
  assert.equal(c.chips.some(v => v.startsWith('翻译完成')), false);
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

test('fallback is off by default and requires an explicit enabled setting', async () => {
  const c = client({ reply: failed() }); await c.start(); await c.fire(2000); await c.fire(5000); await c.finish();
  assert.ok(c.requests.every(request => !request.data.provider));
});

test('enabled fallback is reached after primary retries and receives only pending lines', async () => {
  const c = client({ fallback: true, reply: req => req.data.provider === 'mymemory' ? { ok: true, translations: ['The wind blows softly.'], errors: [] } : failed() });
  await c.start(); await c.fire(2000); await c.fire(5000); await c.finish();
  assert.equal(c.requests.length, 4);
  assert.equal(c.requests[3].data.fallbackConsent, true);
  assert.equal(c.requests[3].data.lines[0].text, '微风轻轻吹过');
  assert.equal(c.scope.lyricsLines[0].translation, 'The wind blows softly.');
});

test('failed primary is bypassed for remaining batches after fallback succeeds', async () => {
  const c = client({ fallback: true, lines: Array.from({length:7}, (_, i) => '中文测试第' + i + '行'), reply: req => req.data.provider === 'mymemory' ? { ok: true, translations: req.data.lines.map(() => 'Translated line.'), errors: [] } : failed() });
  await c.start(); await c.fire(2000); await c.fire(5000); await c.fire(60); await c.finish();
  assert.equal(c.requests.filter(r => !r.data.provider).length, 3);
  assert.equal(c.requests.filter(r => r.data.provider === 'mymemory').length, 2);
});

test('client timeout is longer than the server deadline', async () => {
  const c = client({ fetch: (_, n) => n === 1 ? new Promise(() => {}) : Promise.reject(new Error('not used')) });
  await c.start(); assert.ok([...c.timers.values()].some(t => t.ms === 50000));
});

test('free fallback consent is validated by the server before network access', async () => {
  const s = server(); const res = await s.call({ provider: 'mymemory', lines: [{ text: '微风轻轻吹过', target: 'English' }] });
  assert.equal(res.status, 403); assert.equal(s.requests.length, 0);
});

test('MyMemory uses UTF-8 query encoding, mt=1, and no primary credentials', async () => {
  const s = server({ retryAfter: '74000' });
  const res = await s.call({ provider: 'mymemory', fallbackConsent: true, lines: [{ text: '微风轻轻吹过', target: 'English' }] });
  assert.equal(res.result.translations[0], 'The wind blows softly.');
  const url = new URL(s.requests[0].url);
  assert.equal(url.searchParams.get('q'), '微风轻轻吹过');
  assert.equal(url.searchParams.get('langpair'), 'zh-CN|en'); assert.equal(url.searchParams.get('mt'), '1');
  assert.equal(s.requests[0].headers.Authorization, undefined);
  assert.equal(vm.runInContext('lyricMyMemoryBlockedUntil', s.scope), 0);
});

test('HTTP 200 with embedded MyMemory error is not treated as translation', async () => {
  const s = server({ reply: { responseStatus: '403', responseDetails: 'INVALID SOURCE LANGUAGE', responseData: { translatedText: 'INVALID SOURCE LANGUAGE' } } });
  const res = await s.call({ provider:'mymemory', fallbackConsent:true, lines:[{text:'微风轻轻吹过',target:'English'}] });
  assert.equal(res.result.translations[0], ''); assert.equal(res.result.errors[0].code, 'MYMEMORY_REQUEST_FAILED');
});

test('quota exhaustion cools down MyMemory and prevents further requests', async () => {
  const s = server({ reply: { responseStatus: 429, quotaFinished: true, responseDetails:'quota exceeded' }, retryAfter: '60' });
  const body = { provider:'mymemory', fallbackConsent:true, lines:[{text:'微风轻轻吹过',target:'English'}] };
  await s.call(body); const res = await s.call(body);
  assert.equal(s.requests.length, 1); assert.equal(res.result.errors[0].code, 'MYMEMORY_QUOTA_EXCEEDED');
});

test('500-byte limit is UTF-8 bytes and unsupported scripts are not guessed as English', async () => {
  const s = server();
  await s.call({provider:'mymemory',fallbackConsent:true,lines:[{text:'中'.repeat(167),target:'English'}]});
  await s.call({provider:'mymemory',fallbackConsent:true,lines:[{text:'こんにちは世界',target:'English'}]});
  await s.call({provider:'mymemory',fallbackConsent:true,lines:[{text:'Bonjour tout le monde',target:'Simplified Chinese'}]});
  assert.equal(s.requests.length, 0);
});

test('successful empty MyMemory body is a recoverable error, never a cached translation', async () => {
  const s = server({ fetch: async () => ({ok:true,status:200,headers:{get:()=>null},text:async()=>''}) });
  const res=await s.call({provider:'mymemory',fallbackConsent:true,lines:[{text:'微风轻轻吹过',target:'English'}]});
  assert.equal(res.result.translations[0], ''); assert.equal(res.result.errors[0].code, 'MYMEMORY_INVALID_RESPONSE');
});

test('upstream detailed error and Retry-After reach the client without exposing credentials', async () => {
  const s = server({ fetch: async () => ({ok:false,status:502,headers:{get:()=> '5'},text:async()=>JSON.stringify({error:{code:'upstream_network_error',message:'连接上游服务失败 test-only-secret'}})}) });
  const res=await s.call({messages:[{role:'user',content:'Synthetic diagnostic text.'}]});
  assert.equal(res.status,502); assert.equal(res.result.code,'upstream_network_error');
  assert.equal(res.result.retryable,true); assert.equal(res.result.retryAfterMs,5000);
  assert.ok(res.result.message.includes('连接上游服务失败')); assert.ok(!res.result.message.includes('test-only-secret'));
});

test('client disconnect aborts the upstream request and does not write a response', async () => {
  let signal;
  const s=server({fetch: async (_,opts)=>new Promise((resolve,reject)=>{signal=opts.signal;signal.addEventListener('abort',()=>reject(Object.assign(new Error('aborted'),{name:'AbortError'})),{once:true});})});
  const req={method:'POST',body:{messages:[{role:'user',content:'Synthetic text.'}]}};
  const res=new EventEmitter();res.destroyed=false;res.writableEnded=false;
  const work=s.scope.handleLyricTranslateRequest(req,res);await settle();
  res.destroyed=true;res.emit('close');await work;
  assert.equal(signal.aborted,true);assert.equal(res.result,undefined);assert.equal(s.timers.size,0);
});

test('server primary payload disables streaming and keeps a 45-second deadline', async () => {
  let release;
  const s=server({fetch:async(_,opts)=>new Promise(resolve=>{release=()=>resolve({ok:true,status:200,headers:{get:()=>null},text:async()=>JSON.stringify({choices:[{message:{content:'1. Hello.'}}]})});})});
  const work=s.call({messages:[{role:'user',content:'Synthetic text.'}]});await settle();
  assert.ok([...s.timers.values()].some(t=>t.ms===45000));assert.equal(JSON.parse(s.requests[0].body).stream,false);
  release();await work;assert.equal(s.timers.size,0);
});

test('patch integrates cancellation and persistent fallback configuration into the real app', () => {
  const app=appSource;
  assert.ok(app.includes("function setLyricTranslateTarget(value) {\n  cancelLyricLlmTranslation();"));
  assert.ok(app.includes("function setLyricTranslationMode(mode) {\n  cancelLyricLlmTranslation();"));
  assert.equal((app.match(/lyricTranslateFallback: 'off'/g)||[]).length,2);
  assert.ok(app.includes("if (key === 'desktopLyricsTranslation') scheduleLyricLlmTranslation();"));
  assert.ok(!app.includes('LYRIC_LLM_TRANSLATE_MISS_MS'));
});
