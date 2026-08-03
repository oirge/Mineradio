'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/**
 * 从前端源码截取歌词快照、兜底和激活状态的真实实现。
 * @returns {string} 可在隔离上下文执行的歌词状态源码。
 */
function readLyricsStateSource() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  const currentSongStart = source.indexOf('function currentLyricSong()');
  const currentSongEnd = source.indexOf('function getCustomLyricEntry(', currentSongStart);
  const stateStart = source.indexOf('function cloneLyricLine(');
  const stateEnd = source.indexOf('function parseCustomLyricText(', stateStart);
  const fallbackStart = source.indexOf('function currentLyricFallbackText()');
  const fallbackEnd = source.indexOf('function lyricTagTimeToSeconds(', fallbackStart);
  assert.ok(currentSongStart >= 0 && currentSongEnd > currentSongStart, '未找到当前歌词歌曲实现');
  assert.ok(stateStart >= 0 && stateEnd > stateStart, '未找到歌词状态实现');
  assert.ok(fallbackStart >= 0 && fallbackEnd > fallbackStart, '未找到歌词兜底实现');
  return source.slice(currentSongStart, currentSongEnd)
    + source.slice(fallbackStart, fallbackEnd)
    + source.slice(stateStart, stateEnd);
}

/**
 * 创建歌词状态测试上下文；渲染副作用只计数，不启动浏览器或视觉系统。
 * @returns {object} 可观察原快照与当前激活态的 VM 上下文。
 */
function createLyricsStateContext() {
  const calls = { renders: 0, controls: 0 };

  /** @returns {void} 记录一次歌词渲染请求。 */
  function renderLyrics() { calls.renders += 1; }

  /** @returns {void} 记录一次歌词来源控件刷新。 */
  function updateCustomLyricControls() { calls.controls += 1; }

  const context = {
    currentIdx: 0,
    playQueue: [{ name: '测试歌曲', artist: '测试歌手' }],
    currentLocalSong: null,
    originalLyricsState: { lines: [], hasNativeKaraoke: false, timingSource: 'none' },
    lyricsLines: [],
    lyricsHasNativeKaraoke: false,
    lyricsTimingSource: 'none',
    lyricSourceMode: 'custom',
    renderLyrics,
    updateCustomLyricControls,
    calls,
  };
  vm.runInNewContext(
    readLyricsStateSource()
      + '\nthis.setOriginal = setOriginalLyricsState;'
      + '\nthis.applyOriginal = applyOriginalLyricsState;',
    context,
  );
  return context;
}

/**
 * 验证原歌词输入被隔离一次，但激活和反复切回时复用同一不可变对象图。
 * @returns {void}
 */
function testOriginalLyricsSnapshotIsSharedWhileActive() {
  const context = createLyricsStateContext();
  const inputWord = { text: '测', t: 1, d: 0.4, c0: 0, c1: 1 };
  const inputLine = {
    t: 1,
    duration: 2,
    text: '测试',
    words: [inputWord],
    charCount: 2,
    source: 'yrc-word',
  };

  context.setOriginal([inputLine], true, 'yrc-word');
  const snapshot = context.originalLyricsState.lines;
  assert.notEqual(snapshot[0], inputLine);
  assert.notEqual(snapshot[0].words[0], inputWord);

  context.applyOriginal();
  assert.equal(context.lyricsLines, snapshot);
  assert.equal(context.lyricsLines[0], snapshot[0]);
  assert.equal(context.lyricsLines[0].words[0], snapshot[0].words[0]);
  assert.equal(context.lyricsHasNativeKaraoke, true);
  assert.equal(context.lyricsTimingSource, 'yrc-word');
  assert.equal(context.lyricSourceMode, 'original');

  context.lyricsLines = [{ t: 0, text: '自定义歌词', source: 'custom-text' }];
  context.lyricSourceMode = 'custom';
  context.applyOriginal();

  assert.equal(context.lyricsLines, snapshot);
  assert.equal(context.calls.renders, 2);
  assert.equal(context.calls.controls, 2);
}

test('原歌词激活和切回时只驻留一套行与逐字对象图', testOriginalLyricsSnapshotIsSharedWhileActive);
