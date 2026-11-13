'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Execute production helpers and workers; counters measure actual operations rather than elapsed CI time.
const read = name => fs.readFileSync(path.join(__dirname, '../public', name), 'utf8');
const host = read('folia-host.js');
function block(source, start, end) { return source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start))); }

test('10,000-row lyric signatures scan once across 75 unchanged checks and invalidate for translation, source and track changes', () => {
  let visits = 0;
  const lines = Array.from({ length: 10000 }, (_, index) => new Proxy({ t: index * 4, text: 'Line ' + index, words: [] }, {
    get(object, key) { if (key === 't') visits++; return object[key]; }
  }));
  const context = vm.createContext({ global: { lyricsLines: lines, lyricRowTranslationRevision: 0 },
    lyricsSignatureCache: null, currentSong: () => context.song, trackId: song => song.id, song: { id: 'first' } });
  vm.runInContext(block(host, 'function lyricsSignature()', 'function post('), context);
  const first = context.lyricsSignature();
  for (let check = 0; check < 75; check++) assert.equal(context.lyricsSignature(), first);
  assert.equal(visits, 10000);
  lines[0].translation = '译文'; context.global.lyricRowTranslationRevision++;
  assert.notEqual(context.lyricsSignature(), first);
  assert.equal(visits, 20000);
  const translated = context.lyricsSignature();
  context.song = { id: 'second' };
  assert.notEqual(context.lyricsSignature(), translated);
  context.global.lyricsLines = [{ t: 0, text: 'Replacement' }];
  assert.notEqual(context.lyricsSignature(), translated);
  delete context.global.lyricRowTranslationRevision;
  const legacy = context.lyricsSignature();
  context.global.lyricsLines[0].text = 'Legacy in-place edit';
  assert.notEqual(context.lyricsSignature(), legacy);
});

test('Folia search normalizes unchanged fields once and sees live in-place metadata edits', () => {
  const context = vm.createContext({ trackSearchFields: new WeakMap() });
  vm.runInContext('var normalizations = 0; var originalLower = String.prototype.toLocaleLowerCase; String.prototype.toLocaleLowerCase = function(){ normalizations++; return originalLower.call(this); };'
    + block(host, 'function trackSearchText(', 'function pageTracks('), context);
  const songs = Array.from({ length: 10000 }, (_, index) => ({ name: 'Track ' + index, artist: 'Artist', album: 'Album' }));
  for (let query = 0; query < 10; query++) for (const song of songs) context.trackSearchText(song);
  assert.equal(context.normalizations, 10000, 'ten new queries must reuse normalized song text');
  songs[9999].name = 'New Title';
  assert.match(context.trackSearchText(songs[9999]), /new title/);
  assert.equal(context.normalizations, 10001);
  songs[9999].artist = 'Changed Artist'; songs[9999].album = 'Changed Album';
  assert.match(context.trackSearchText(songs[9999]), /changed artist\nchanged album/);
  assert.equal(context.normalizations, 10002);
});

test('window ranges remain bounded at the start, middle and end without truncating the last item', () => {
  const context = { window: {} };
  vm.runInNewContext(read('windowed-list.js'), context);
  const range = context.window.MineradioWindowedList.range;
  for (const top of [0, 64 * 5000, 64 * 10000, 1e12]) {
    const result = range(10000, top, 640, 64);
    assert.ok(result.end - result.start <= 25);
    assert.ok(result.start >= 0 && result.end <= 10000);
  }
  assert.equal(range(10000, 0, 640, 64).start, 0);
  assert.equal(range(10000, 64 * 10000, 640, 64).end, 10000);
});

function workerClient() {
  const instances = [], timers = new Map(); let serial = 0;
  class Worker {
    constructor() { this.sent = []; instances.push(this); }
    postMessage(job) { this.sent.push(job); }
    terminate() { this.terminated = true; }
  }
  const global = { Worker, OffscreenCanvas: function () {}, URL, location: { href: 'http://localhost/index.html' },
    addEventListener() {}, setTimeout(fn, delay) { const id = ++serial; timers.set(id, { fn, delay }); return id; },
    clearTimeout(id) { timers.delete(id); } };
  vm.runInNewContext(read('cover-thumbnail.js'), { window: global, URL });
  return { api: global.MineradioCoverThumbnail, instances, timers };
}
const options = { maxSide: 224, quality: 0.82, smoothing: 'high' };
test('thumbnail worker serializes decodes, handles fallback, and ignores stale-worker errors after idle restart', async () => {
  const h = workerClient();
  const first = h.api.generate({ size: 1024 }, options), second = h.api.generate({ size: 2048 }, options);
  const worker = h.instances[0];
  assert.equal(worker.sent.length, 1);
  worker.onmessage({ data: { id: worker.sent[0].id, value: 'data:image/webp;base64,A' } });
  assert.equal(await first, 'data:image/webp;base64,A');
  assert.equal(worker.sent.length, 2);
  worker.onmessage({ data: { id: worker.sent[1].id, fallback: true } });
  assert.equal(await second, null);
  const idle = [...h.timers.values()].find(timer => timer.delay === 30000); idle.fn();
  assert.equal(worker.terminated, true);
  const third = h.api.generate({ size: 512 }, options), replacement = h.instances[1];
  worker.onerror();
  assert.notEqual(replacement.terminated, true);
  replacement.onmessage({ data: { id: replacement.sent[0].id, value: 'new' } });
  assert.equal(await third, 'new');
});

test('thumbnail timeout settles active and waiting requests and retains the main-thread fallback', async () => {
  const h = workerClient();
  const first = h.api.generate({ size: 1024 }, options), second = h.api.generate({ size: 1024 }, options);
  [...h.timers.values()].find(timer => timer.delay === 45000).fn();
  assert.equal(await first, null); assert.equal(await second, null);
  assert.equal(h.instances[0].terminated, true);
  assert.equal(await h.api.generate({ size: 1024 }, options), null);
});

test('worker thumbnail encoding preserves aspect ratio, quality and smoothing and closes the decoded bitmap on success or failure', async () => {
  for (const fail of [false, true]) {
    let closed = 0, canvas, message, drawing;
    const bitmap = { width: 3000, height: 2000, close() { closed++; } };
    class OffscreenCanvas {
      constructor(width, height) { this.width = width; this.height = height; canvas = this; }
      getContext(type, settings) { assert.equal(settings.alpha, false); drawing = { drawImage() {} }; return drawing; }
      async convertToBlob(settings) { assert.equal(settings.type, 'image/webp'); assert.equal(settings.quality, 0.82); if (fail) throw Error('encode failure'); return { type: settings.type }; }
    }
    const self = { postMessage(value) { message = value; } };
    vm.runInNewContext(read('cover-thumbnail-worker.js'), { self, createImageBitmap: async () => bitmap,
      OffscreenCanvas, FileReaderSync: class { readAsDataURL() { return 'data:image/webp;base64,A'; } } });
    await self.onmessage({ data: { id: 7, source: { size: 12 }, ...options } });
    assert.equal(canvas.width, 224); assert.equal(canvas.height, 149);
    assert.equal(drawing.imageSmoothingQuality, 'high'); assert.equal(closed, 1);
    if (fail) assert.equal(message.fallback, true);
    else assert.equal(message.value, 'data:image/webp;base64,A');
  }
});
