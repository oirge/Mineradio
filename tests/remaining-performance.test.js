'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Execute production helpers and workers; counters measure actual operations rather than elapsed CI time.
const read = name => fs.readFileSync(path.join(__dirname, '../public', name), 'utf8');
const host = read('folia-host.js');
const app = read('app.js');
function block(source, start, end) { return source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start))); }

test('a 10,000-song queue prepares only the requested 30-row window with absolute action indices', () => {
  let coverReads = 0;
  const context = vm.createContext({ playQueue: Array.from({ length: 10000 }, (_, index) => ({ type: 'local', name: 'Song ' + index, id: index })),
    currentIdx: 5001, nextQueueIndexPreview: () => 5002, queueItemKey: song => song.id, songArtistText: () => '',
    songDisplaySubtitle: () => '', songCoverSignature: () => '', songCoverSrc: () => { coverReads++; return ''; }, isSongLiked: () => false });
  vm.runInContext(block(app, 'function queueVisibleRows(', 'function renderWindowedQueue('), context);
  const rows = context.queueVisibleRows(5030, null, 5000);
  assert.equal(rows.length, 30); assert.equal(coverReads, 30);
  assert.equal(rows[0].index, 5000); assert.equal(rows[29].index, 5029);
  assert.equal(rows[1].current, true); assert.equal(rows[2].nextUp, true);
});

test('shrinking a windowed mini queue back to a prior small queue cannot reuse its obsolete DOM signature', () => {
  const list = { innerHTML: '', querySelector: () => null }, count = { textContent: '' };
  let large = true;
  const context = vm.createContext({ window: { MineradioWindowedList: {} },
    document: { getElementById: id => id === 'mini-queue-list' ? list : count }, playQueue: Array(200).fill({}),
    currentIdx: 0, miniQueueOpen: true, miniQueueLastDomSignature: 'small', miniQueueIncrementalState: {},
    renderWindowedQueue: () => large, queueVisibleRows: () => [], queueVisibleDomSignature: () => 'small',
    queueListApplyIncremental: () => false, queueItemsHtml: () => 'fresh-small-queue', queueListIncrementalState: () => ({}) });
  vm.runInContext(block(app, 'function renderMiniQueuePanel(', "document.addEventListener('click', function(e){"), context);
  context.renderMiniQueuePanel();
  assert.equal(context.miniQueueLastDomSignature, 'windowed');
  large = false; context.playQueue = [{}, {}]; context.renderMiniQueuePanel();
  assert.equal(list.innerHTML, 'fresh-small-queue');
});

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

test('windowed DOM reuses unchanged rows, keeps a distant drag source alive, repairs changed rows after dragend and cancels detached work', () => {
  const frames = new Map(); let frameId = 0, prepared = 0;
  const document = { createElement(tag) {
    if (tag !== 'template') return new Element();
    return { content: {}, set innerHTML(html) { const node = new Element(); node.html = html; this.content.firstElementChild = node; } };
  } };
  class Element {
    constructor() { this.ownerDocument = document; this.children = []; this.style = {}; this.attributes = {}; this.listeners = new Map(); this.isConnected = true; this.clientHeight = 600; this.clientTop = 0; this.scrollTop = 0; }
    get firstChild() { return this.children[0] || null; }
    get nextSibling() { return this.parent ? this.parent.children[this.parent.children.indexOf(this) + 1] || null : null; }
    setAttribute(key, value) { this.attributes[key] = value; }
    getAttribute(key) { return this.attributes[key]; }
    removeAttribute(key) { delete this.attributes[key]; }
    getClientRects() { return [this.getBoundingClientRect()]; }
    getBoundingClientRect() { return { top: 0, height: 27 }; }
    addEventListener(name, callback) { this.listeners.set(name, callback); }
    removeEventListener(name) { this.listeners.delete(name); }
    closest() { return this; }
    insertBefore(node, before) { if (node.parent) node.parent.removeChild(node); const index = before ? this.children.indexOf(before) : this.children.length; assert.ok(index >= 0); this.children.splice(index, 0, node); node.parent = this; }
    removeChild(node) { const index = this.children.indexOf(node); assert.ok(index >= 0); this.children.splice(index, 1); node.parent = null; }
  }
  const global = { requestAnimationFrame(callback) { const id = ++frameId; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); }, getComputedStyle: () => ({ rowGap: '6', marginTop: '0', marginBottom: '0', height: '54px', boxSizing: 'border-box' }) };
  vm.runInNewContext(read('windowed-list.js'), { window: global });
  const root = new Element(), list = global.MineradioWindowedList;
  const songs = Array.from({ length: 10000 }, (_, i) => 'Track ' + i);
  const options = { key: 'queue', count: songs.length, scroller: root, stride: 60,
    prepare(start, end) { prepared += end - start; return i => '<div>' + songs[i] + '</div>'; } };
  list.render(root, options);
  assert.ok(root.children.length < 30, 'ancestor collapse scale must not change the logical row height'); assert.ok(prepared < 30);
  const source = root.children.find(node => node.getAttribute('data-windowed-index') === '0');
  list.render(root, options);
  assert.equal(root.children[0], source, 'unchanged row nodes must retain focus and decoded covers');
  root.listeners.get('dragstart')({ target: source });
  list.reveal(root, 9999);
  assert.ok(root.children.includes(source)); assert.equal(source.style.position, 'fixed');
  assert.ok(root.children.some(node => node.getAttribute('data-windowed-index') === '9999'));
  songs[0] = 'Changed during drag';
  list.reveal(root, 0);
  root.listeners.get('dragend')();
  assert.equal(root.children[0].html, '<div>Changed during drag</div>');
  assert.notEqual(root.children[0], source, 'a retained drag source must not mark changed HTML as already painted');
  root.listeners.get('scroll')(); assert.equal(frames.size, 1);
  list.clear(root);
  assert.equal(frames.size, 0); assert.equal(root.listeners.size, 0);
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
