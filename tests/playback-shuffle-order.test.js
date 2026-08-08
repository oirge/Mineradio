'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');

function loadShuffleHarness(queue, currentIdx = 0) {
  const start = appSource.indexOf('var shuffledPlayQueueArrays = new WeakSet();');
  const end = appSource.indexOf('function clearQueue() {', start);
  assert.ok(start >= 0 && end > start, '固定乱序队列接缝缺失');

  const played = [];
  const rendered = [];
  const shelf = [];
  const toasts = [];
  const math = Object.create(Math);
  math.random = () => 0;
  const context = {
    playQueue: queue,
    currentIdx,
    playToggleBusy: false,
    miniQueueOpen: false,
    markQueueContentChanged() {},
    safeRenderQueuePanel(reason) { rendered.push(reason); },
    safeShelfRebuild(reason) { shelf.push(reason); },
    showToast(message) { toasts.push(message); },
    forcePlaybackControlsInteractive() {},
    playQueueAt(index) { played.push(context.playQueue[index].name); return Promise.resolve(); },
    Math: math,
    Promise,
    WeakSet,
    Array,
  };
  vm.runInNewContext(appSource.slice(start, end), context);
  return { context, played, rendered, shelf, toasts };
}

test('进入随机模式只洗牌一次并保持当前歌曲不跳', () => {
  const queue = [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }];
  const currentSong = queue[1];
  const harness = loadShuffleHarness(queue, 1);
  assert.equal(harness.context.shufflePlayQueueOnce({ toast: false, reason: 'shuffle-mode' }), true);
  assert.notDeepEqual(harness.context.playQueue.map((song) => song.name), ['A', 'B', 'C', 'D']);
  assert.equal(harness.context.playQueue[harness.context.currentIdx], currentSong);
  assert.equal(harness.context.shuffledPlayQueueArrays.has(harness.context.playQueue), true);
  assert.deepEqual(harness.rendered, ['shuffle-mode']);
  assert.deepEqual(harness.toasts, []);
});

test('随机模式上一首和下一首沿固定乱序队列往返', () => {
  const queue = [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }];
  const harness = loadShuffleHarness(queue, 0);
  harness.context.shufflePlayQueueOnce({ toast: false });
  const order = harness.context.playQueue.map((song) => song.name);
  const start = harness.context.currentIdx;

  harness.context.nextTrack();
  harness.context.nextTrack();
  harness.context.prevTrack();
  harness.context.prevTrack();

  assert.deepEqual(harness.played, [
    order[(start + 1) % order.length],
    order[(start + 2) % order.length],
    order[(start + 1) % order.length],
    order[start],
  ]);
  assert.equal(harness.context.currentIdx, start);
});

test('手动随机队列也保持正在播放的歌曲身份', () => {
  const queue = [{ name: 'A' }, { name: 'B' }, { name: 'C' }];
  const currentSong = queue[2];
  const harness = loadShuffleHarness(queue, 2);
  harness.context.shuffleQueue();
  assert.equal(harness.context.playQueue[harness.context.currentIdx], currentSong);
  assert.deepEqual(harness.toasts, ['队列已随机']);
});

test('固定乱序状态使用 WeakSet 不保留已替换队列', () => {
  assert.match(appSource, /var shuffledPlayQueueArrays = new WeakSet\(\);/);
  assert.doesNotMatch(appSource, /PLAYBACK_HISTORY_LIMIT|playbackHistoryIds|commitPlaybackHistory/);
});

test('切换随机模式和恢复随机会话都会洗牌一次', () => {
  assert.match(appSource, /playMode = modes\[\(idx \+ 1\) % modes\.length\];\s+if \(playMode === 'shuffle'\) shufflePlayQueueOnce/);
  assert.match(appSource, /playMode = \/\^\(loop\|shuffle\|single\)\$\/[\s\S]*?if \(playMode === 'shuffle'\) \{\s*shufflePlayQueueOnce/);
});

test('随机模式遇到新队列时在播放前完成一次洗牌', () => {
  assert.match(appSource, /if \(playMode === 'shuffle' && !shuffledPlayQueueArrays\.has\(playQueue\)\) \{\s*currentIdx = idx;\s*shufflePlayQueueOnce/);
});
