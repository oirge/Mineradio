'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');

function loadNavigationHarness(queue) {
  const start = appSource.indexOf('var PLAYBACK_HISTORY_LIMIT = 96;');
  const end = appSource.indexOf('function shuffleQueue() {', start);
  assert.ok(start >= 0 && end > start, '播放历史导航接缝缺失');

  const played = [];
  const toasts = [];
  const math = Object.create(Math);
  math.random = () => 0;
  const context = {
    playQueue: queue,
    currentIdx: 0,
    playMode: 'shuffle',
    playToggleBusy: false,
    forcePlaybackControlsInteractive() {},
    queueItemKey(song) { return song && song.name ? `song:${song.name}` : ''; },
    showToast(message) { toasts.push(message); },
    playQueueAt(index) {
      played.push(index);
      context.commitPlaybackHistory(context.playQueue[index]);
      return Promise.resolve();
    },
    Math: math,
    Promise,
    WeakMap,
  };
  vm.runInNewContext(appSource.slice(start, end), context);
  return { context, played, toasts };
}

test('随机模式上一首沿真实播放历史返回', () => {
  const queue = [{ name: 'A' }, { name: 'B' }, { name: 'C' }];
  const harness = loadNavigationHarness(queue);
  harness.context.commitPlaybackHistory(queue[0]);
  harness.context.nextTrack();
  harness.context.nextTrack();
  harness.context.prevTrack();
  harness.context.prevTrack();
  assert.deepEqual(harness.played, [1, 0, 1, 0]);
  assert.equal(harness.context.currentIdx, 0);
});

test('随机模式后退后按下一首会先沿历史前进', () => {
  const queue = [{ name: 'A' }, { name: 'B' }, { name: 'C' }];
  const harness = loadNavigationHarness(queue);
  for (let i = 0; i < queue.length; i += 1) {
    harness.context.currentIdx = i;
    harness.context.commitPlaybackHistory(queue[i]);
  }
  harness.context.prevTrack();
  harness.context.nextTrack();
  assert.deepEqual(harness.played, [1, 2]);
  assert.equal(harness.context.currentIdx, 2);
});

test('队列重排或克隆替换后仍按轻量历史定位上一首', () => {
  const a = { name: 'A' };
  const b = { name: 'B' };
  const c = { name: 'C' };
  const queue = [a, b, c];
  const harness = loadNavigationHarness(queue);
  harness.context.commitPlaybackHistory(a);
  harness.context.commitPlaybackHistory(b);
  harness.context.commitPlaybackHistory(c);
  harness.context.playQueue = [{ name: 'C' }, { name: 'A' }, { name: 'B' }];
  harness.context.currentIdx = 0;
  harness.context.prevTrack();
  assert.deepEqual(harness.played, [2]);
  assert.equal(harness.context.currentIdx, 2);
});

test('没有更早记录时不随机切歌', () => {
  const queue = [{ name: 'A' }, { name: 'B' }];
  const harness = loadNavigationHarness(queue);
  harness.context.commitPlaybackHistory(queue[0]);
  harness.context.prevTrack();
  assert.deepEqual(harness.played, []);
  assert.deepEqual(harness.toasts, ['没有更早的播放记录']);
  assert.equal(harness.context.currentIdx, 0);
});

test('播放历史有固定上限且不直接持有歌曲对象', () => {
  const queue = Array.from({ length: 120 }, (_, index) => ({ name: String(index) }));
  const harness = loadNavigationHarness(queue);
  for (const song of queue) harness.context.commitPlaybackHistory(song);
  assert.equal(harness.context.playbackHistoryIds.length, 96);
  assert.ok(harness.context.playbackHistoryIds.every((id) => typeof id === 'number'));
  assert.ok(harness.context.playbackHistoryKeys.every((key) => typeof key === 'string'));
  assert.equal(harness.context.playbackHistoryCursor, 95);
});

test('播放成功后才写入历史且清空队列会释放历史', () => {
  assert.match(appSource, /if \(!playbackStarted\) \{[\s\S]*?return;[\s\S]*?\}\s*commitPlaybackHistory\(song\);/);
  assert.match(appSource, /function clearQueue\(\) \{[\s\S]*?resetPlaybackHistory\(\);/);
});
