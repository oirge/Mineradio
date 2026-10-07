'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
const start = source.indexOf('function markQueueItemPlaybackFailed(idx) {');
const end = source.indexOf('function pauseCurrentAudioForTrackSwitch() {', start);
assert.ok(start >= 0 && end > start, '坏歌跳过实现接缝缺失');
const failureSource = source.slice(start, end);

function harness(queue) {
  const notices = [];
  const elements = {
    'source-fallback-notice': { classList: { add() {}, remove() {} } },
    'source-fallback-title': { textContent: '' },
    'source-fallback-body': { textContent: '' },
  };
  const context = {
    Date, Number, String, Set,
    document: { getElementById(id) { return elements[id] || null; } },
    setTimeout() { return 1; },
    clearTimeout() {},
    playQueue: queue,
    currentIdx: 0,
    trackSwitchToken: 1,
    sourceFallbackNoticeTimer: null,
    skipped: [],
    hideLoading() {},
    showSourceFallbackNotice(title, body) { notices.push({ title, body }); },
  };
  context.playQueueAt = function(index, opts) {
    context.currentIdx = index;
    context.trackSwitchToken += 1;
    context.skipped.push(index);
    return context.skipFailedQueueItem(index, context.trackSwitchToken, '本地音频损坏', opts);
  };
  vm.runInNewContext(failureSource + '\nthis.skipFailedQueueItem = skipFailedQueueItem; this.nextUnblockedQueueIndex = nextUnblockedQueueIndex;', context);
  return Object.assign(context, { elements, notices });
}

test('自动续播把整轮坏歌限制在最多尝试每首一次，不会循环重试', () => {
  const queue = [{ type: 'local', name: '坏 A' }, { type: 'local', name: '坏 B' }, { type: 'local', name: '坏 C' }];
  const h = harness(queue);
  h.skipFailedQueueItem(0, 1, '解码失败', { autoAdvance: true });
  assert.deepEqual(Array.from(h.skipped), [1, 2]);
  assert.equal(h.notices.at(-1).title, '队列暂时没有可播歌曲');
  assert.ok(queue.every((song) => song._lastPlaybackFailAt > 0));
});

test('十八秒内刚失败的文件暂时不重复尝试，但到期后可以重试', () => {
  const now = Date.now();
  const queue = [
    { type: 'local', name: '当前' },
    { type: 'local', name: '刚刚失败', _lastPlaybackFailAt: now },
    { type: 'local', name: '重新挂载后可重试', _lastPlaybackFailAt: now - 19000 },
  ];
  const h = harness(queue);
  const chain = { queue, attempted: new Set([queue[1]]), remaining: queue.length };
  assert.equal(h.nextUnblockedQueueIndex(0, chain), 2);
});

test('手动点播、系统拦截和 AbortError 不被自动跳过逻辑吞掉', () => {
  assert.match(failureSource, /if \(!opts\.manual && localPlaybackErrorCanSkip\(err, media\)\)/);
  assert.match(failureSource, /name === 'NotAllowedError' \|\| name === 'SecurityError' \|\| name === 'AbortError'/);
});
