'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const appSource = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
function block(start, end) {
  const from = appSource.indexOf(start);
  const to = appSource.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `Missing queue source: ${start}`);
  return appSource.slice(from, to);
}
const queueSource = block('function queueVisibleRows(', 'async function refreshUserPlaylists(');
const gateSource = block('function isPlaylistPanelVisibleForRender()', 'function safeSwitchPlaylistTab(');
const resumeSource = block('function resumeMainRenderLoop(', 'function syncMainRenderLoopPowerState(');

function harness({ count = 128, panelClass = 'show', mini = false } = {}) {
  const classes = new Set(panelClass ? [panelClass] : []);
  const frames = new Map();
  const calls = { key: 0, subtitle: 0, coverSignature: 0, coverSrc: 0, liked: 0, mini: 0, domWrites: 0 };
  let html = '';
  const list = {
    children: [],
    get innerHTML() { return html; },
    set innerHTML(value) { html = value; calls.domWrites++; },
  };
  const panel = { classList: { contains: name => classes.has(name) } };
  const noop = () => {};
  const context = vm.createContext({
    Math, console, folia: false, deep: false, document: {
      getElementById: id => id === 'playlist-panel' ? panel : id === 'queue-list' ? list : null,
    },
    queuePanelDirty: false, miniQueueOpen: mini, queueRenderSeq: 0,
    queuePanelPendingRender: { raf: 0, reason: '', opts: null },
    queuePanelLastDomSignature: '', miniQueueLastDomSignature: '', queueViewTab: 'queue', queueSnapshots: [],
    currentIdx: 0, playMode: 'loop', stopAfterCurrentTrack: false, LOCAL_ONLY_MODE: true,
    playQueue: Array.from({ length: count }, (_, index) => ({ id: String(index), type: 'local', name: `Track ${index}`, artist: 'Artist', album: 'Album' })),
    audio: { src: 'blob:playing-song', paused: false, currentTime: 37 },
    queueItemKey: song => { calls.key++; return song.id; },
    songDisplaySubtitle: song => { calls.subtitle++; return `${song.artist} / ${song.album}`; },
    songCoverSignature: song => { calls.coverSignature++; return `sig:${song.id}`; },
    songCoverSrc: song => { calls.coverSrc++; return `/cover/${song.id}`; },
    isSongLiked: () => { calls.liked++; return false; },
    songArtistText: song => song.artist, nextQueueIndexPreview: () => (context.currentIdx + 1) % count,
    bindQueueDragReorder: noop, bindQueuePanelExtras: noop, renderQueueNextUp: noop, renderQueueSnapshots: noop,
    updatePlayModeButtonRow: noop, updateStopAfterCurrentButton: noop, renderMiniQueuePanel: () => { calls.mini++; },
    escHtml: value => String(value || ''), heartIconSvg: () => '<heart>', playlistPlusIconSvg: () => '<plus>',
    animateVisiblePanelList: noop, scheduleNamedAnimationFrame: (key, callback) => frames.set(key, callback),
    mainRenderLoopSuspended: true, mainRenderFrameId: 0, prevTime: 0, renderPerfState: { lastRenderAt: 0 },
    performance: { now: () => 1000 }, window: {},
    isFoliaInterfaceActive: () => context.folia, isDeepBackgroundMode: () => context.deep,
    scheduleMainRenderFrame: () => { const scheduled = !context.mainRenderFrameId; context.mainRenderFrameId = 1; return scheduled; },
  });
  vm.runInContext(`${queueSource}\n${gateSource}\n${resumeSource}`, context);
  context.queuePanelLastDomSignature = context.queueVisibleDomSignature(count, false, context.queueVisibleRows(count));
  for (const key of Object.keys(calls)) calls[key] = 0;
  function flushFrame() {
    const callback = frames.get('queue-panel-render');
    assert.equal(typeof callback, 'function', 'Expected one deferred queue refresh');
    frames.delete('queue-panel-render');
    callback();
  }
  return { context, calls, classes, frames, list, flushFrame };
}

test('Folia hides every original queue presentation without changing panel or playback state', () => {
  for (const options of [{ panelClass: 'show' }, { panelClass: 'peek' }, { panelClass: 'pinned' }, { panelClass: '', mini: true }]) {
    const h = harness(options);
    const queue = h.context.playQueue;
    const audio = h.context.audio;
    assert.equal(h.context.isPlaylistPanelVisibleForRender(), true);
    h.context.folia = true;
    assert.equal(h.context.isPlaylistPanelVisibleForRender(), false);
    assert.equal(h.context.playQueue, queue);
    assert.equal(h.context.audio, audio);
    assert.equal(audio.currentTime, 37);
    assert.equal(audio.paused, false);
    assert.deepEqual([...h.classes], options.panelClass ? [options.panelClass] : []);
    h.context.folia = false;
    assert.equal(h.context.isPlaylistPanelVisibleForRender(), true);
  }
});

test('hidden Folia host never scans the 10,000-song queue, including forced deferred flushes', () => {
  const h = harness({ count: 10000 });
  h.context.folia = true;
  h.context.safeRenderQueuePanel('metadata-ready');
  h.context.safeRenderQueuePanel('cover-ready', { immediate: true });
  h.context.safeRenderQueuePanel('explicit-refresh', { immediate: true, deferWhenHidden: false });
  h.context.flushDeferredQueuePanel('late-panel-open');
  assert.equal(h.context.queuePanelDirty, true);
  assert.equal(h.frames.size, 0);
  assert.deepEqual(h.calls, { key: 0, subtitle: 0, coverSignature: 0, coverSrc: 0, liked: 0, mini: 0, domWrites: 0 });
});

test('a queue callback scheduled before switching to Folia defers at execution time', () => {
  const h = harness();
  h.context.safeRenderQueuePanel('pending-cover');
  assert.equal(h.frames.size, 1);
  h.context.folia = true;
  h.flushFrame();
  assert.equal(h.context.queuePanelDirty, true);
  assert.equal(h.calls.key, 0);
  assert.equal(h.calls.domWrites, 0);
});

test('returning to the original interface coalesces one current queue refresh', () => {
  const h = harness();
  h.context.folia = true;
  h.context.currentIdx = 2;
  h.context.safeRenderQueuePanel('folia-next-track');
  h.context.safeRenderQueuePanel('folia-cover-ready');
  assert.equal(h.context.queuePanelDirty, true);
  assert.equal(h.frames.size, 0);
  h.context.folia = false;
  h.context.resumeMainRenderLoop('folia-interface-return');
  h.context.resumeMainRenderLoop('viewport-recovery');
  assert.equal(h.frames.size, 1);
  h.flushFrame();
  assert.equal(h.context.queuePanelDirty, false);
  assert.equal(h.calls.key, 128);
  assert.equal(h.calls.domWrites, 1);
  assert.match(h.list.innerHTML, /class="queue-item now" draggable="true" data-queue-index="2"/);
  assert.equal(h.context.audio.currentTime, 37);
  assert.equal(h.context.audio.paused, false);
});

test('closed queues remain deferred after returning and refresh when opened', () => {
  const h = harness({ panelClass: '' });
  h.context.folia = true;
  h.context.safeRenderQueuePanel('folia-cover-ready');
  h.context.folia = false;
  h.context.resumeMainRenderLoop('folia-interface-return');
  assert.equal(h.frames.size, 0);
  assert.equal(h.context.queuePanelDirty, true);
  h.classes.add('show');
  h.context.flushDeferredQueuePanel('playlist-panel-open');
  h.flushFrame();
  assert.equal(h.calls.key, 128);
  assert.equal(h.context.queuePanelDirty, false);
});

test('a background interface return waits for foreground recovery before refreshing', () => {
  const h = harness();
  h.context.folia = true;
  h.context.safeRenderQueuePanel('folia-cover-ready');
  h.context.folia = false;
  h.context.deep = true;
  assert.equal(h.context.resumeMainRenderLoop('folia-interface-return'), false);
  assert.equal(h.frames.size, 0);
  h.context.deep = false;
  h.context.resumeMainRenderLoop('desktop-visible');
  h.flushFrame();
  assert.equal(h.calls.key, 128);
  assert.equal(h.context.queuePanelDirty, false);
});
