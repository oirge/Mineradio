'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/**
 * 截取生产歌词解析器的真实实现。
 * @returns {string} 可在隔离上下文执行的解析源码。
 */
function readLyricParserSource() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  const start = source.indexOf('function lyricTagTimeToSeconds(');
  const end = source.indexOf('function parseYrcText(', start);
  assert.ok(start >= 0 && end > start, '未找到 LRC 歌词解析实现');
  return source.slice(start, end);
}

/**
 * 创建只包含歌词解析依赖的测试上下文。
 * @returns {{parseLyricText:(text:string)=>Array<object>,lyricLinesHaveWordTiming:(lines:Array<object>)=>boolean}} 生产解析入口。
 */
function createLyricParser() {
  /** @returns {boolean} 测试歌词均不是无歌词占位。 */
  function isNoLyricText(text) { return !String(text || '').trim(); }

  const context = { Array, Math, Number, Object, String, isFinite, isNoLyricText };
  vm.runInNewContext(
    readLyricParserSource()
      + '\nthis.parseLyricText = parseLyricText;'
      + '\nthis.lyricLinesHaveWordTiming = lyricLinesHaveWordTiming;',
    context,
  );
  return context;
}

/** @returns {void} 验证 Enhanced LRC 被转换成正文和现有逐字结构。 */
function testEnhancedLrcWordTiming() {
  const parser = createLyricParser();
  const lines = parser.parseLyricText(
    '[00:01.00]<00:01.00>我<00:01.00>爱<00:01.20>你<00:01.50>\n'
      + '[00:02.00]<00:02.00>Hello <00:02.40>world<00:03.00>',
  );

  assert.equal(lines.length, 2);
  assert.equal(lines[0].text, '我爱你');
  assert.equal(lines[0].source, 'lrc-word');
  assert.equal(lines[0].charCount, 3);
  assert.equal(lines[0].words.length, 2);
  assert.deepEqual(Array.from(lines[0].words, word => word.text), ['我爱', '你']);
  assert.deepEqual(Array.from(lines[0].words, word => word.c0), [0, 2]);
  assert.deepEqual(Array.from(lines[0].words, word => word.c1), [2, 3]);
  assert.deepEqual(Array.from(lines[0].words, word => Math.round(word.t * 1000)), [1000, 1200]);
  assert.deepEqual(Array.from(lines[0].words, word => Math.round(word.d * 1000)), [200, 300]);
  assert.equal(lines[1].text, 'Hello world');
  assert.equal(lines[1].words[0].text, 'Hello ');
  assert.equal(lines[1].words[1].text, 'world');
  assert.equal(parser.lyricLinesHaveWordTiming(lines), true);
  assert.ok(lines.every(line => !/[<>]/.test(line.text)), '尖括号时间标签不得进入显示正文');
}

/** @returns {void} 验证普通 LRC、双语合并和多行时间戳语义保持不变。 */
function testPlainAndBilingualLrcCompatibility() {
  const parser = createLyricParser();
  const plain = parser.parseLyricText('[00:01.00]普通歌词\n[00:02.00]下一行');
  assert.equal(plain.length, 2);
  assert.equal(plain[0].text, '普通歌词');
  assert.equal(plain[0].source, 'lrc');
  assert.equal(plain[0].words, undefined);

  const bilingual = parser.parseLyricText('[00:01.00]中文\n[00:01.00]English');
  assert.equal(bilingual.length, 1);
  assert.equal(bilingual[0].text, '中文\nEnglish');
  assert.equal(bilingual[0].source, 'lrc-bilingual');
  assert.equal(bilingual[0].words, undefined);

  const repeatedTime = parser.parseLyricText('[00:01.00][00:03.00]<00:01.00>同<00:01.20>步<00:01.40>');
  assert.equal(repeatedTime.length, 2);
  assert.equal(repeatedTime[1].t, 3);
  assert.equal(repeatedTime[1].words[0].t, 3);
  assert.equal(repeatedTime[1].words[1].t, 3.2);
}

test('Enhanced LRC 转换为干净正文和逐字时间轴', testEnhancedLrcWordTiming);
test('普通 LRC、双语和多行时间戳保持兼容', testPlainAndBilingualLrcCompatibility);
