'use strict';
// Exercise the real progress-chip DOM updates and scheduling lifecycle together.
// APP_JS_PATH also allows the same regressions to run against an extracted app.asar.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const appPath = process.env.APP_JS_PATH || path.join(__dirname, '..', 'public', 'app.js');
const source = fs.readFileSync(appPath, 'utf8');
const start = source.indexOf('var LYRIC_LLM_TRANSLATE_STORE_KEY =');
const end = source.indexOf('// ---- 多行舞台行池', start);
assert.ok(start > 0 && end > start, 'translation subsystem must be present');
const code = source.slice(start, end);
const successful = { ok: true, translations: ['A gentle breeze passes by.'] };
async function settle() { for (let i = 0; i < 80; i++) await Promise.resolve(); }

function classList() {
  const values = new Set();
  return {
    add: (...names) => names.forEach(name => values.add(name)),
    remove: (...names) => names.forEach(name => values.delete(name)),
    contains: name => values.has(name),
    toggle(name, enabled) {
      const present = enabled === undefined ? !values.has(name) : !!enabled;
      if (present) values.add(name); else values.delete(name);
      return present;
    }
  };
}

function client(options = {}) {
  let now = 0;
  let sequence = 0;
  let resolveRequest;
  const timers = new Map();
  const requests = [];
  const chip = { classList: classList() };
  const label = { textContent: '' };
  const scope = {
    console: { warn() {} }, AbortController,
    setTimeout(fn, ms) {
      const id = ++sequence;
      timers.set(id, { fn, due: now + ms });
      return id;
    },
    clearTimeout: id => timers.delete(id),
    document: { getElementById: id => id === 'lyric-translate-chip' ? chip : id === 'lyric-translate-text' ? label : null },
    localStorage: { getItem: () => JSON.stringify(options.cache || {}) },
    setPersistentLocalStorageItem() {},
    fx: { lyricTranslateTarget: '', lyricTranslationMode: 'on', lyricTranslateFallback: 'off' },
    lyricTranslationWanted: () => scope.fx.lyricTranslationMode === 'on',
    isNoLyricText: text => text === '暂无歌词',
    bumpStageLyricRows() {}, stageLyrics: {}, refreshCurrentLyricStyle() {}, showToast() {},
    lyricsLines: options.lines || [{ text: '微风轻轻吹过' }],
    fetch(url, opts) {
      requests.push({ url, ...opts });
      if (options.deferred) return new Promise(resolve => { resolveRequest = resolve; });
      const data = options.reply || successful;
      return Promise.resolve({ status: data.status || 200, json: async () => data });
    }
  };
  vm.createContext(scope);
  vm.runInContext(code, scope, { filename: appPath });
  return {
    scope, timers, requests, chip, label,
    visible: () => chip.classList.contains('show'),
    async advance(ms) {
      const target = now + ms;
      while (true) {
        const entry = [...timers].filter(([, timer]) => timer.due <= target)
          .sort((a, b) => a[1].due - b[1].due || a[0] - b[0])[0];
        if (!entry) break;
        now = entry[1].due;
        timers.delete(entry[0]);
        entry[1].fn();
        await settle();
      }
      now = target;
      await settle();
    },
    async deliverLateReply() {
      assert.ok(resolveRequest, 'a request must already be in flight');
      resolveRequest({ status: 200, json: async () => successful });
      await settle();
    }
  };
}

for (const phase of ['scheduled', 'in-flight']) {
  for (const destination of ['embedded translation', 'cached translation', 'no lyrics']) {
    test(`${phase} translation disappears on switching to a song with ${destination}`, async () => {
      const key = 'English\u0000蓝色天空';
      const c = client({ deferred: true, cache: { [key]: 'Blue sky.' } });
      c.scope.scheduleLyricLlmTranslation();
      assert.equal(c.visible(), true);
      assert.equal(c.label.textContent, '翻译歌词 0/1');
      const scheduledCallback = c.timers.get(c.scope.lyricLlmTranslateState.timer).fn;
      const oldLine = c.scope.lyricsLines[0];
      if (phase === 'in-flight') await c.advance(900);
      const replacement = destination === 'no lyrics' ? [] : destination === 'embedded translation'
        ? [{ text: '蓝色天空', translation: 'Already translated.' }]
        : [{ text: '蓝色天空' }];
      c.scope.lyricsLines = replacement;
      c.scope.scheduleLyricLlmTranslation();
      assert.equal(c.visible(), false, 'the previous song must not leave 翻译歌词 0/1 visible');
      assert.equal(c.chip.classList.contains('done'), false);
      assert.equal(c.scope.lyricLlmTranslateState.running, false);
      assert.equal(c.scope.lyricLlmTranslateState.scheduled, false);
      assert.equal(c.timers.size, 0, 'switching must release debounce and request-deadline timers');
      if (phase === 'in-flight') {
        assert.equal(c.requests[0].signal.aborted, true);
        await c.deliverLateReply();
      }
      scheduledCallback(); // Even an already-dispatched old callback cannot revive the chip.
      await c.advance(60000);
      assert.equal(c.visible(), false);
      assert.equal(c.requests.length, phase === 'in-flight' ? 1 : 0, 'the translated destination needs no request');
      assert.equal(oldLine.translation, undefined, 'late data must not be accepted after cancellation');
      if (replacement.length) assert.equal(replacement[0].translation,
        destination === 'embedded translation' ? 'Already translated.' : 'Blue sky.');
    });
  }
}

for (const lines of [[], [{ text: '已有译文', translation: 'Already translated.' }], [{ text: '暂无歌词', fallback: true }]]) {
  test(`idle scheduling clears stale busy UI with ${lines.length ? lines[0].text : 'empty lyrics'}`, () => {
    const c = client({ lines });
    c.scope.scheduleLyricLlmTranslation();
    // Same array and settings: no cancellation branch will rescue this stale UI.
    c.scope.setLyricTranslateChip('翻译歌词 0/1');
    assert.equal(c.visible(), true);
    c.scope.scheduleLyricLlmTranslation();
    assert.equal(c.visible(), false);
    assert.equal(c.requests.length, 0);
    assert.equal(c.timers.size, 0);
  });
}

test('direct cancellation hides active progress without requiring another schedule call', async () => {
  const c = client({ deferred: true });
  c.scope.scheduleLyricLlmTranslation();
  await c.advance(900);
  c.scope.cancelLyricLlmTranslation();
  assert.equal(c.visible(), false);
  assert.equal(c.requests[0].signal.aborted, true);
  assert.equal(c.timers.size, 0);
  await c.deliverLateReply();
  assert.equal(c.visible(), false);
  assert.equal(c.scope.lyricsLines[0].translation, undefined);
});

test('successful completion stays visible for two seconds across empty rescheduling', async () => {
  const c = client();
  c.scope.scheduleLyricLlmTranslation();
  await c.advance(960);
  assert.equal(c.scope.lyricsLines[0].translation, successful.translations[0]);
  assert.equal(c.label.textContent, '翻译完成 1/1');
  assert.equal(c.chip.classList.contains('done'), true);
  const hideTimer = c.scope.lyricTranslateChipHideTimer;
  for (let i = 0; i < 5; i++) c.scope.scheduleLyricLlmTranslation();
  await c.advance(250); // The real completion callback also schedules again here.
  assert.equal(c.scope.lyricTranslateChipHideTimer, hideTimer, 'rescheduling must not shorten or restart the completion window');
  await c.advance(1749);
  assert.equal(c.visible(), true);
  await c.advance(1);
  assert.equal(c.visible(), false);
  assert.equal(c.chip.classList.contains('done'), false);
  assert.equal(c.timers.size, 0);
  assert.equal(c.requests.length, 1);
});

test('failed completion stays visible for ten seconds without a render-triggered request loop', async () => {
  const c = client({ reply: { ok: false, status: 401, retryable: false, message: 'Synthetic authentication failure' } });
  c.scope.scheduleLyricLlmTranslation();
  await c.advance(960);
  assert.match(c.label.textContent, /1 行失败/);
  assert.equal(c.chip.classList.contains('done'), false);
  const hideTimer = c.scope.lyricTranslateChipHideTimer;
  for (let i = 0; i < 5; i++) c.scope.scheduleLyricLlmTranslation();
  await c.advance(250);
  assert.equal(c.scope.lyricTranslateChipHideTimer, hideTimer);
  await c.advance(9749);
  assert.equal(c.visible(), true);
  await c.advance(1);
  assert.equal(c.visible(), false);
  assert.equal(c.requests.length, 1);
  assert.equal(c.timers.size, 0);
});

test('cancellation clears the completion hide timer before a new translation begins', async () => {
  const c = client({ deferred: true });
  c.scope.scheduleLyricLlmTranslation();
  await c.advance(900);
  await c.deliverLateReply();
  await c.advance(60);
  assert.equal(c.chip.classList.contains('done'), true);
  c.scope.cancelLyricLlmTranslation();
  assert.equal(c.visible(), false);
  assert.equal(c.scope.lyricTranslateChipHideTimer, 0);
  assert.equal(c.timers.size, 0);
  c.scope.lyricsLines = [{ text: '新的一行' }];
  c.scope.scheduleLyricLlmTranslation();
  await c.advance(2000);
  assert.equal(c.visible(), true, 'the old completion deadline must not hide the new request');
  assert.equal(c.label.textContent, '翻译歌词 0/1');
});
