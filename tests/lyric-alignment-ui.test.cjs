'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'lyric-alignment.js'), 'utf8');

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function settle() {
  for (let i = 0; i < 18; i++) await Promise.resolve();
}

function alignmentLine(text, options = {}) {
  let offset = 0;
  const start = options.start ?? 10;
  const words = Array.from(text).filter(char => /[\p{L}\p{N}]/u.test(char)).map((char, index) => {
    const c0 = text.indexOf(char, offset);
    offset = c0 + char.length;
    return { text: char, c0, c1: offset, start: start + index * 0.4,
      end: start + index * 0.4 + 0.2, reviewReasons: [] };
  });
  return { text, sourceIndex: options.sourceIndex ?? 0, start,
    end: words.length ? words[words.length - 1].end : start + 1,
    words, reviewReasons: [], ...options };
}

function record(text = '\u5feb\u5531', options = {}) {
  const lineOptions = options.line || {};
  return { ok: true, hit: true, matches: true, audio: { sha256: 'a'.repeat(64), size: 10 },
    lyricsHash: 'b'.repeat(64), revision: 'revision-1', savedAt: 1,
    alignment: { schemaVersion: 1, timeUnit: 'seconds', audioDuration: 30,
      corrected: false, engine: 'background-fixture', reviewCount: 0,
      lines: [alignmentLine(text, lineOptions)], ...(options.alignment || {}) } };
}

function recordForRows(rows) {
  const result = record();
  result.alignment.lines = rows.map((row, index) =>
    alignmentLine(row.text, { start: 10 + index * 4, sourceIndex: row.sourceIndex ?? index, ...row }));
  return result;
}

function harness() {
  const requests = [], applications = [], timers = new Map();
  const mediaCalls = { play: 0, pause: 0, seek: 0, openModal: 0, closeModal: 0 };
  let timerId = 0, current = null, position = 6.25;
  const media = {
    currentSrc: '', src: '', duration: 30, paused: false, ended: false, events: new Map(),
    addEventListener(name, listener) {
      if (!this.events.has(name)) this.events.set(name, []);
      this.events.get(name).push(listener);
    },
    play() { mediaCalls.play++; return Promise.resolve(); },
    pause() { mediaCalls.pause++; },
  };
  Object.defineProperty(media, 'currentTime', {
    get() { return position; },
    set(value) { mediaCalls.seek++; position = value; },
  });
  const global = {
    audio: media, location: { href: 'http://localhost/' }, trackSwitchToken: 0,
    lyricsLines: [], lyricsHasNativeKaraoke: false, lyricsTimingSource: 'lrc',
    currentLyricSong: () => current,
    applyLyricsState(lines, hasNativeKaraoke, timingSource) {
      this.lyricsLines = lines;
      this.lyricsHasNativeKaraoke = hasNativeKaraoke;
      this.lyricsTimingSource = timingSource;
      applications.push({ lines, hasNativeKaraoke, timingSource });
      // The real app synchronously sends this notification during every apply.
      this.MineradioLyricAlignment.onLyricsChanged();
    },
    openGsapModal() { mediaCalls.openModal++; },
    closeGsapModal() { mediaCalls.closeModal++; },
    setTimeout(callback, milliseconds) {
      const id = ++timerId;
      timers.set(id, { callback, milliseconds });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
    fetch(url, options) {
      const wait = deferred();
      requests.push({ url, body: JSON.parse(options.body), wait });
      return wait.promise;
    },
  };
  const document = {
    getElementById() { throw new Error('A background scheduler must not read UI elements.'); },
    createElement() { throw new Error('A background scheduler must not create UI elements.'); },
  };
  vm.runInNewContext(source, { window: global, document, URL });
  function select(name = 'song-A', text = '\u5feb\u5531', rows) {
    const file = `D:\\Music\\${name}.wav`;
    const proxy = 'http://localhost/api/local-file?path=' + encodeURIComponent(file) + '&token=test-only';
    current = { id: name, name, type: 'local', localPath: file, localFileUrl: proxy };
    global.trackSwitchToken++;
    global.lyricsLines = rows || [{ text, t: 9.5 }];
    global.lyricsHasNativeKaraoke = false;
    global.lyricsTimingSource = 'lrc';
    media.currentSrc = proxy;
    media.src = proxy;
    return file;
  }
  async function respond(index, result, ok = true) {
    assert.ok(requests[index], `request ${index} exists`);
    requests[index].wait.resolve({ ok, json: async () => result });
    await settle();
  }
  async function reject(index, message) {
    assert.ok(requests[index], `request ${index} exists`);
    requests[index].wait.reject(new Error(message));
    await settle();
  }
  async function fireTimer() {
    const entry = timers.entries().next();
    assert.equal(entry.done, false, 'a polling timer is scheduled');
    const [id, timer] = entry.value;
    timers.delete(id);
    timer.callback();
    await settle();
  }
  function emit(name) {
    for (const listener of media.events.get(name) || []) listener();
  }
  function assertQuiet() {
    assert.deepEqual(mediaCalls, { play: 0, pause: 0, seek: 0, openModal: 0, closeModal: 0 });
    assert.equal(media.currentTime, 6.25);
  }
  select();
  return { global, api: global.MineradioLyricAlignment, media, requests, applications,
    timers, select, respond, reject, fireTimer, emit, assertQuiet,
    deselect() { current = null; global.lyricsLines = []; } };
}

async function miss(h) {
  const pending = h.api.onLyricsChanged();
  const index = h.requests.length - 1;
  assert.equal(h.requests[index].body.action, 'lookup');
  await h.respond(index, { ok: true, hit: false });
  await pending;
  await settle();
  return h.requests.length - 1;
}

function actions(h) {
  return h.requests.map(request => request.body.action);
}

test('a cache miss automatically ensures and polls without UI or media mutations', async () => {
  const h = harness();
  assert.equal(h.api.start, undefined);
  assert.equal(h.api.openEditor, undefined);
  const ensureIndex = await miss(h);
  assert.deepEqual(actions(h), ['lookup', 'ensure']);
  assert.equal(h.requests[ensureIndex].body.language, 'Chinese');
  assert.equal(h.requests[ensureIndex].body.lyrics[0].hintStart, 9.5);
  await h.respond(ensureIndex, { ok: true, id: 'job-A', status: 'running', stage: 'align 1/2' });
  assert.equal(h.api.backgroundState().running, true);
  await h.fireTimer();
  assert.equal(h.requests[2].body.action, 'status');
  assert.equal(h.requests[2].body.id, 'job-A');
  await h.respond(2, { ok: true, id: 'job-A', status: 'complete', result: record() });
  assert.equal(h.applications.length, 1);
  assert.equal(h.applications[0].lines[0].words.length, 2);
  assert.equal(h.applications[0].timingSource, 'audio-aligned');
  assert.equal(h.api.backgroundState().running, false);
  assert.equal(h.timers.size, 0);
  assert.deepEqual(actions(h), ['lookup', 'ensure', 'status'], 'applying does not trigger another job');
  h.assertQuiet();
});

test('a matching cached result applies silently without ensure or polling', async () => {
  const h = harness();
  const pending = h.api.onLyricsChanged();
  await h.respond(0, record());
  await pending;
  assert.deepEqual(actions(h), ['lookup']);
  assert.equal(h.applications.length, 1);
  assert.equal(h.timers.size, 0);
  assert.equal(h.api.backgroundState().running, false);
  h.assertQuiet();
});

test('native timing skips lookup and a later native result cannot be replaced by a pending job', async () => {
  const h = harness();
  h.global.lyricsHasNativeKaraoke = true;
  h.global.lyricsTimingSource = 'local-qrc';
  await h.api.onLyricsChanged();
  assert.equal(h.requests.length, 0);
  h.global.lyricsHasNativeKaraoke = false;
  const ensureIndex = await miss(h);
  const nativeWords = [{ text: '\u5feb', t: 9.5, d: 0.12, c0: 0, c1: 1 }];
  h.global.lyricsLines = [{ text: '\u5feb\u5531', t: 9.5, words: nativeWords, source: 'local-qrc' }];
  h.global.lyricsHasNativeKaraoke = true;
  h.global.lyricsTimingSource = 'local-qrc';
  await h.api.onLyricsChanged();
  await h.respond(ensureIndex, { ok: true, status: 'complete', result: record() });
  assert.equal(h.applications.length, 0);
  assert.equal(h.global.lyricsLines[0].words, nativeWords);
  assert.equal(h.api.backgroundState().running, false);
  h.assertQuiet();
});

test('A running then B/C switched queues only the latest C, and cannot write A or B', async () => {
  const h = harness();
  const pathA = 'D:\\Music\\song-A.wav';
  const ensureA = await miss(h);
  await h.respond(ensureA, { ok: true, id: 'job-A', status: 'running' });
  const pathB = h.select('song-B', '\u4e59\u6b4c');
  await miss(h);
  const pathC = h.select('song-C', '\u4e19\u6b4c');
  await miss(h);
  assert.equal(h.api.backgroundState().pending, true);
  assert.equal(h.requests.filter(request => request.body.action === 'ensure').length, 1);
  await h.fireTimer();
  await h.respond(4, { ok: true, id: 'job-A', status: 'complete', result: record() });
  assert.deepEqual(h.requests.filter(request => request.body.action === 'ensure').map(request => request.body.path),
    [pathA, pathC]);
  assert.equal(h.requests.filter(request => request.body.action === 'ensure' && request.body.path === pathB).length, 0);
  await h.respond(5, { ok: true, id: 'job-C', status: 'complete', result: record('\u4e19\u6b4c') });
  assert.equal(h.applications.length, 1);
  assert.equal(h.applications[0].lines[0].text, '\u4e19\u6b4c');
  assert.equal(h.api.backgroundState().pending, false);
  assert.equal(h.api.backgroundState().running, false);
  h.assertQuiet();
});

test('late track lookup responses cannot queue old jobs after the final track has changed', async () => {
  const h = harness();
  const pendingA = h.api.onLyricsChanged();
  const pathB = h.select('song-B', '\u4e59\u6b4c');
  const pendingB = h.api.onLyricsChanged();
  await h.respond(0, { ok: true, hit: false });
  await pendingA;
  assert.deepEqual(actions(h), ['lookup', 'lookup']);
  await h.respond(1, { ok: true, hit: false });
  await pendingB;
  assert.equal(h.requests[2].body.action, 'ensure');
  assert.equal(h.requests[2].body.path, pathB);
  await h.respond(2, { ok: true, status: 'complete', result: record('\u4e59\u6b4c') });
  assert.equal(h.applications.length, 1);
  assert.equal(h.applications[0].lines[0].text, '\u4e59\u6b4c');
  h.assertQuiet();
});

test('changing lyric text invalidates an old lookup and starts only the new text', async () => {
  const h = harness();
  const first = h.api.onLyricsChanged();
  h.global.lyricsLines = [{ text: '\u65b0\u8bcd', t: 9.5 }];
  const second = h.api.onLyricsChanged();
  await h.respond(0, record());
  await first;
  assert.equal(h.applications.length, 0);
  await h.respond(1, { ok: true, hit: false });
  await second;
  assert.equal(h.requests[2].body.lyrics[0].text, '\u65b0\u8bcd');
  await h.respond(2, { ok: true, status: 'complete', result: record('\u65b0\u8bcd') });
  assert.equal(h.applications[0].lines[0].text, '\u65b0\u8bcd');
  h.assertQuiet();
});

test('changing only source anchors invalidates a pending job and queues corrected anchors', async () => {
  const h = harness();
  const firstEnsure = await miss(h);
  await h.respond(firstEnsure, { ok: true, id: 'old-anchor', status: 'running' });
  h.global.lyricsLines = [{ text: '\u5feb\u5531', t: 11 }];
  const anchorLookup = h.api.onLyricsChanged();
  assert.equal(h.requests.length, 3, 'anchor-only change performs a new lookup');
  await h.respond(2, { ok: true, hit: false });
  await anchorLookup;
  await h.fireTimer();
  await h.respond(3, { ok: true, id: 'old-anchor', status: 'complete', result: record() });
  assert.equal(h.applications.length, 0, 'old source anchors cannot replace newly edited anchors');
  assert.equal(h.requests[4].body.action, 'ensure');
  assert.equal(h.requests[4].body.lyrics[0].hintStart, 11);
  await h.respond(4, { ok: true, status: 'complete', result: record('\u5feb\u5531', { line: { hintStart: 11 } }) });
  assert.equal(h.applications.length, 1);
  assert.equal(h.applications[0].lines[0].alignmentHintStart, 11);
  h.assertQuiet();
});

test('an anchor-only change also prevents an old cached lookup from applying', async () => {
  const h = harness();
  const oldLookup = h.api.onLyricsChanged();
  h.global.lyricsLines = [{ text: '\u5feb\u5531', t: 11 }];
  const newLookup = h.api.onLyricsChanged();
  assert.equal(h.requests.length, 2);
  await h.respond(0, record());
  await oldLookup;
  assert.equal(h.applications.length, 0);
  await h.respond(1, record('\u5feb\u5531', { line: { hintStart: 11 } }));
  await newLookup;
  assert.equal(h.applications.length, 1);
  assert.equal(h.applications[0].lines[0].alignmentHintStart, 11);
  h.assertQuiet();
});

test('translation-only updates neither duplicate work nor replace the latest translation', async () => {
  const h = harness();
  h.global.lyricsLines[0].translation = 'old translation';
  const ensureIndex = await miss(h);
  h.global.lyricsLines[0].translation = 'latest translation';
  await h.api.onLyricsChanged();
  assert.deepEqual(actions(h), ['lookup', 'ensure']);
  const cached = record('\u5feb\u5531', { line: { translation: 'stale cached translation' } });
  await h.respond(ensureIndex, { ok: true, status: 'complete', result: cached });
  assert.equal(h.applications[0].lines[0].translation, 'latest translation');
  h.global.lyricsLines[0].translation = 'translation after applying';
  await h.api.onLyricsChanged();
  assert.deepEqual(actions(h), ['lookup', 'ensure']);
  assert.equal(h.global.lyricsLines[0].translation, 'translation after applying');
  h.assertQuiet();
});

test('duration mismatch never applies or retries the same context immediately', async () => {
  const h = harness();
  h.media.duration = 31;
  const ensureIndex = await miss(h);
  await h.respond(ensureIndex, { ok: true, status: 'complete', result: record() });
  assert.equal(h.applications.length, 0);
  assert.equal(h.api.backgroundState().running, false);
  assert.equal(h.timers.size, 0);
  await h.api.onLyricsChanged();
  assert.deepEqual(actions(h), ['lookup', 'ensure']);
  h.assertQuiet();
});

test('transient failures release the slot and retry at most after a background delay', async () => {
  const h = harness();
  const pending = h.api.onLyricsChanged();
  await h.reject(0, 'corrupt cache');
  await pending;
  assert.equal(h.requests[1].body.action, 'ensure');
  await h.reject(1, 'runtime unavailable');
  assert.equal(h.api.backgroundState().running, false);
  assert.match(h.api.backgroundState().lastError, /runtime unavailable/);
  assert.equal(h.timers.size, 1);
  assert.equal([...h.timers.values()][0].milliseconds, 30000);
  await h.api.onLyricsChanged();
  assert.deepEqual(actions(h), ['lookup', 'ensure']);
  h.emit('loadedmetadata');
  await h.respond(2, { ok: true, hit: false });
  assert.deepEqual(actions(h), ['lookup', 'ensure', 'lookup'], 'metadata refresh cannot immediately restart a failed attempt');
  h.select('song-B', '\u4e59\u6b4c');
  const newEnsure = await miss(h);
  await h.respond(newEnsure, { ok: true, status: 'complete', result: record('\u4e59\u6b4c') });
  await h.fireTimer();
  assert.equal(h.requests.filter(request => request.body.path === 'D:\\Music\\song-A.wav').length, 3,
    'a delayed retry cannot restart the former track');
  assert.equal(h.applications.length, 1);
  h.assertQuiet();
});

test('a transient same-track outage retries silently with a bounded backoff', async () => {
  const h = harness();
  const firstEnsure = await miss(h);
  await h.reject(firstEnsure, 'temporary network failure');
  assert.equal([...h.timers.values()][0].milliseconds, 30000);
  await h.fireTimer();
  assert.equal(h.requests[2].body.action, 'lookup');
  await h.respond(2, { ok: true, hit: false });
  assert.equal(h.requests[3].body.action, 'ensure');
  await h.reject(3, 'temporary network failure');
  assert.equal([...h.timers.values()][0].milliseconds, 60000);
  await h.fireTimer();
  await h.respond(4, { ok: true, hit: false });
  await h.reject(5, 'temporary network failure');
  assert.equal(h.timers.size, 0, 'a third failure must not schedule another retry');
  assert.deepEqual(actions(h), ['lookup', 'ensure', 'lookup', 'ensure', 'lookup', 'ensure']);
  h.assertQuiet();
});

test('a failed running job drains a newer pending job instead of starving it', async () => {
  const h = harness();
  const ensureA = await miss(h);
  await h.respond(ensureA, { ok: true, id: 'job-A', status: 'running' });
  h.select('song-B', '\u4e59\u6b4c');
  await miss(h);
  await h.fireTimer();
  await h.reject(3, 'status request failed');
  assert.equal(h.requests[4].body.action, 'ensure');
  assert.equal(h.requests[4].body.lyrics[0].text, '\u4e59\u6b4c');
  await h.respond(4, { ok: true, status: 'complete', result: record('\u4e59\u6b4c') });
  assert.equal(h.applications.length, 1);
  assert.equal(h.api.backgroundState().running, false);
  h.assertQuiet();
});

test('empty lyrics clear pending work without starting a stale queued song', async () => {
  const h = harness();
  const ensureA = await miss(h);
  await h.respond(ensureA, { ok: true, id: 'job-A', status: 'running' });
  h.select('song-B', '\u4e59\u6b4c');
  await miss(h);
  assert.equal(h.api.backgroundState().pending, true);
  h.global.lyricsLines = [];
  await h.api.onLyricsChanged();
  assert.equal(h.api.backgroundState().pending, false);
  await h.fireTimer();
  await h.respond(3, { ok: true, id: 'job-A', status: 'complete', result: record() });
  assert.equal(h.requests.filter(request => request.body.action === 'ensure').length, 1);
  assert.equal(h.applications.length, 0);
  h.assertQuiet();
});

test('emptied media invalidates pending lookup/queue state without touching playback', async () => {
  const h = harness();
  const ensureA = await miss(h);
  await h.respond(ensureA, { ok: true, id: 'job-A', status: 'running' });
  h.select('song-B', '\u4e59\u6b4c');
  await miss(h);
  assert.equal(h.api.backgroundState().pending, true);
  h.deselect();
  h.emit('emptied');
  assert.equal(h.api.backgroundState().pending, false);
  await h.fireTimer();
  await h.respond(3, { ok: true, id: 'job-A', status: 'complete', result: record() });
  assert.equal(h.applications.length, 0);
  assert.equal(h.requests.filter(request => request.body.action === 'ensure').length, 1);
  assert.equal(h.api.backgroundState().running, false);
  h.assertQuiet();
});

test('skipped ensure results settle silently without presenting fallback UI', async () => {
  const h = harness();
  const ensureIndex = await miss(h);
  await h.respond(ensureIndex, { ok: true, status: 'skipped', reason: 'NO_VALID_LYRIC_ANCHORS' });
  assert.equal(h.applications.length, 0);
  assert.equal(h.api.backgroundState().running, false);
  assert.equal(h.timers.size, 0);
  assert.equal(h.api.backgroundState().lastError, '');
  h.assertQuiet();
});

test('unknown word timings keep source sentence anchors and never invent word durations', async () => {
  for (const reason of ['null-time', 'missing-character', 'positive-but-review-flagged']) {
    const h = harness();
    h.global.lyricsLines = [{ text: '\u5feb\u5531', t: 9.5 }, { text: '\u4e0b\u4e00\u53e5', t: 13 }];
    const data = recordForRows([{ text: '\u5feb\u5531' }, { text: '\u4e0b\u4e00\u53e5' }]);
    const line = data.alignment.lines[0];
    if (reason === 'null-time') {
      line.words[0].start = null;
      line.words[0].end = null;
    } else if (reason === 'missing-character') {
      line.words.shift();
      line.reviewReasons = ['MISSING_CHARACTER'];
    } else {
      line.words[0].reviewReasons = ['long-note-check'];
      line.reviewReasons = ['character-correction-required'];
    }
    const pending = h.api.onLyricsChanged();
    await h.respond(0, data);
    await pending;
    const applied = h.applications[0].lines[0];
    assert.equal(applied.text, '\u5feb\u5531');
    assert.equal(applied.t, 9.5, reason);
    assert.equal(applied.duration, 3.5, reason);
    assert.equal(applied.words.length, 0, reason);
    assert.equal(applied.alignmentHintStart, 9.5);
    assert.equal(applied.alignmentHintEnd, 13);
    h.assertQuiet();
  }
});

test('protected corrected timing keeps current LRC anchors if the source anchors changed', async () => {
  const h = harness();
  h.global.lyricsLines = [{ text: '\u5feb\u5531', t: 11 }, { text: '\u4e0b\u4e00\u53e5', t: 16 }];
  const cached = recordForRows([
    { text: '\u5feb\u5531', hintStart: 9, hintEnd: 13 },
    { text: '\u4e0b\u4e00\u53e5', hintStart: 13 },
  ]);
  cached.alignment.corrected = true;
  cached.alignment.lines[0].start = cached.alignment.lines[0].end = null;
  for (const word of cached.alignment.lines[0].words) word.start = word.end = null;
  const pending = h.api.onLyricsChanged();
  await h.respond(0, { ...cached, matches: false });
  await pending;
  assert.equal(h.requests[1].body.action, 'ensure');
  await h.respond(1, { ok: true, status: 'complete', cached: true, result: cached });
  assert.equal(h.applications.length, 1);
  assert.equal(h.applications[0].lines[0].t, 11);
  assert.equal(h.applications[0].lines[0].duration, 5);
  assert.equal(h.applications[0].lines[0].alignmentHintStart, 11);
  assert.equal(h.applications[0].lines[0].alignmentHintEnd, 16);
  assert.equal(h.applications[0].lines[0].words.length, 0);
  h.assertQuiet();
});

test('applying predictions never feeds predicted starts back into later alignment anchors', async () => {
  const h = harness();
  h.global.lyricsLines = [{ text: '\u5feb\u5531', t: 9.5 }, { text: '\u4e0b\u4e00\u53e5', t: 13 }];
  const data = recordForRows([{ text: '\u5feb\u5531', hintStart: 9.5, hintEnd: 13 },
    { text: '\u4e0b\u4e00\u53e5', hintStart: 13 }]);
  const pending = h.api.onLyricsChanged();
  await h.respond(0, data);
  await pending;
  assert.equal(h.global.lyricsLines[0].t, 10);
  assert.equal(h.global.lyricsLines[0].alignmentHintStart, 9.5);
  h.emit('loadedmetadata');
  assert.equal(h.requests[1].body.action, 'lookup');
  assert.equal(h.requests[1].body.lyrics[0].hintStart, 9.5);
  assert.equal(h.requests[1].body.lyrics[0].hintEnd, 13);
  await h.respond(1, data);
  assert.equal(h.requests.filter(request => request.body.action === 'ensure').length, 0);
  h.assertQuiet();
});

test('unanchored text stays unanchored after predictions are applied', async () => {
  const h = harness();
  h.global.lyricsLines = [{ text: '\u5feb\u5531', untimed: true, t: 0 }];
  const pending = h.api.onLyricsChanged();
  await h.respond(0, record());
  await pending;
  h.emit('loadedmetadata');
  assert.equal('hintStart' in h.requests[1].body.lyrics[0], false);
  assert.equal('hintEnd' in h.requests[1].body.lyrics[0], false);
  await h.respond(1, record());
  h.assertQuiet();
});

test('untimed plaintext retains approximate display rows without passing them as acoustic anchors', async () => {
  const h = harness();
  h.global.lyricsLines = [
    { text: '第一句', t: 0, duration: 6, untimed: true, source: 'custom-text' },
    { text: '第二句', t: 6, duration: 6, untimed: true, source: 'custom-text' },
    { text: '第三句', t: 12, duration: 6, untimed: true, source: 'custom-text' },
  ];
  const cached = recordForRows(h.global.lyricsLines);
  for (const line of cached.alignment.lines) {
    line.start = line.end = null;
    line.reviewReasons = ['MISSING_ALIGNMENT'];
    for (const word of line.words) word.start = word.end = null;
  }
  const pending = h.api.onLyricsChanged();
  for (const row of h.requests[0].body.lyrics) {
    assert.equal('hintStart' in row, false, 'display-only time must not become an alignment anchor');
    assert.equal('hintEnd' in row, false);
  }
  await h.respond(0, cached);
  await pending;
  assert.deepEqual(h.applications[0].lines.map(line => line.t), [0, 6, 12]);
  assert.ok(h.applications[0].lines.every(line => line.untimed && line.words.length === 0));
  assert.deepEqual(h.applications[0].lines.map(line => line.text), ['第一句', '第二句', '第三句']);
  h.emit('loadedmetadata');
  assert.equal(h.requests[1].body.action, 'lookup');
  for (const [index, row] of h.requests[1].body.lyrics.entries()) {
    assert.equal(row.displayStart, index * 6);
    assert.equal(row.displayEnd, (index + 1) * 6);
    assert.equal('hintStart' in row, false);
    assert.equal('hintEnd' in row, false);
  }
  await h.respond(1, cached);
  assert.equal(h.applications.length, 2);
  assert.deepEqual(h.applications[1].lines.map(line => line.t), [0, 6, 12]);
  assert.deepEqual(h.applications[1].lines.map(line => line.duration), [6, 6, 6]);
  assert.ok(h.applications[1].lines.every(line => line.untimed && line.words.length === 0));
  assert.equal(h.requests.length, 2, 'cache reapplication does not enqueue a new alignment');
  h.assertQuiet();
});

test('filtered metadata and repeated text retain the correct original anchors and translations', async () => {
  const h = harness();
  h.global.lyricsLines = [
    { text: '\u5feb\u5531', t: 1, translation: 'first repeat' },
    { text: '\u6f14\u5531: \u6d4b\u8bd5', t: 3 },
    { text: '\u5feb\u5531', t: 9.5, translation: 'second repeat' },
    { text: '\u4e0b\u4e00\u53e5', t: 13, translation: 'next line' },
  ];
  const data = recordForRows([
    { text: '\u5feb\u5531', sourceIndex: 0 }, { text: '\u5feb\u5531', sourceIndex: 2 },
    { text: '\u4e0b\u4e00\u53e5', sourceIndex: 3 },
  ]);
  for (const line of data.alignment.lines) {
    line.start = line.end = null;
    for (const word of line.words) word.start = word.end = null;
  }
  const pending = h.api.onLyricsChanged();
  await h.respond(0, data);
  await pending;
  assert.equal(h.applications[0].lines[1].t, 9.5);
  assert.equal(h.applications[0].lines[1].duration, 3.5);
  assert.equal(h.applications[0].lines[1].translation, 'second repeat');
  assert.equal(h.applications[0].lines[0].translation, 'first repeat');
  h.assertQuiet();
});

test('UTF-16 supplemental Han and punctuation pass through without shifting glyph ranges', async () => {
  const h = harness();
  const text = '\u4f60\uff0c\u{20000}\u597d';
  h.global.lyricsLines = [{ text, t: 9.5 }];
  const pending = h.api.onLyricsChanged();
  await h.respond(0, record(text));
  await pending;
  const words = h.applications[0].lines[0].words;
  assert.deepEqual(Array.from(words, word => [word.text, word.c0, word.c1]),
    [['\u4f60', 0, 1], ['\u{20000}', 2, 4], ['\u597d', 4, 5]]);
  h.assertQuiet();
});
