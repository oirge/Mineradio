'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/**
 * 读取主渲染页面源码，供音频分析热路径契约检查使用。
 * @returns {string} 主渲染页面源码。
 */
function readRendererSource() {
  return fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
}

/**
 * 截取两个标记之间的源码，避免将页面其它状态机混入测试上下文。
 * @param {string} source 主渲染页面源码。
 * @param {string} startMarker 起始标记。
 * @param {string} endMarker 结束标记。
 * @returns {string} 目标源码片段。
 */
function readSourceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `未找到源码区段：${startMarker}`);
  return source.slice(start, end);
}

/**
 * 验证缓存频段边界与旧版按 Hz 换算的采样桶完全一致。
 * @returns {void}
 */
function testBeatBandRangeCache() {
  const source = readRendererSource();
  const stateSource = readSourceBetween(source, 'var beatBandRangeCache = {', 'var bass = 0');
  const helperSource = readSourceBetween(source, 'function beatBandRms(', 'function mixToward(');
  const context = {
    Math,
    isFinite,
    audioCtx: { sampleRate: 44100 },
    beatAnalyser: { fftSize: 2048 },
    beatFrequencyData: new Uint8Array(1024),
    BEAT_FFT_SIZE: 2048,
  };
  vm.runInNewContext(`${stateSource}\n${helperSource}\nthis.ranges = ensureBeatBandRanges();`, context);
  const expected = [
    [38, 74],
    [52, 165],
    [165, 420],
    [420, 2600],
    [1800, 9200],
  ].map(([hz0, hz1]) => {
    const binHz = 44100 / 2048;
    return [Math.max(1, Math.floor(hz0 / binHz)), Math.min(1023, Math.ceil(hz1 / binHz))];
  });
  const actual = [
    [context.ranges.subStart, context.ranges.subEnd],
    [context.ranges.kickStart, context.ranges.kickEnd],
    [context.ranges.bodyStart, context.ranges.bodyEnd],
    [context.ranges.vocalStart, context.ranges.vocalEnd],
    [context.ranges.snapStart, context.ranges.snapEnd],
  ];
  assert.deepEqual(actual, expected);
  const data = new Uint8Array(1024);
  for (let i = 0; i < data.length; i += 1) data[i] = (i * 37 + 19) & 255;
  for (let i = 0; i < expected.length; i += 1) {
    const [start, end] = expected[i];
    let sum = 0;
    for (let j = start; j <= end; j += 1) {
      const value = data[j] / 255;
      sum += value * value;
    }
    const legacy = Math.sqrt(sum / (end - start + 1));
    const cached = context.beatBandRms(data, actual[i][0], actual[i][1]);
    assert.ok(Math.abs(cached - legacy) < 1e-12, `频段 ${i} RMS 发生变化`);
  }
}

/**
 * 验证实时节拍引擎优先使用主分析器 RMS，且直接调用仍保留兼容回退。
 * @returns {void}
 */
function testRealtimeRmsReuse() {
  const source = readRendererSource();
  const engineSource = readSourceBetween(source, 'function processRealtimeBeatEngine(', 'function mergeRealtimeBeatCamera(');
  assert.match(engineSource, /function processRealtimeBeatEngine\(dt, rmsSample\)/);
  assert.match(engineSource, /var hasRmsSample = typeof rmsSample === 'number' && isFinite\(rmsSample\);/);
  assert.match(engineSource, /var rms = hasRmsSample \? rmsSample : 0;/);
  assert.equal((engineSource.match(/beatAnalyser\.getByteTimeDomainData\(beatTimeDomainData\)/g) || []).length, 1);
  assert.doesNotMatch(engineSource, /var phaseErr\s*=/);
  assert.match(source, /processRealtimeBeatEngine\(analysisDt, rms\)/);
}

/**
 * 验证空 Home 波形先执行时间节流，再查询 DOM 节点。
 * @returns {void}
 */
function testHomeWaveThrottleBeforeDomLookup() {
  const source = readRendererSource();
  const functionSource = readSourceBetween(source, 'function updateHomeAudioVisual(dt) {', 'function setRange(');
  assert.ok(functionSource.indexOf('var minGap =') < functionSource.indexOf("document.getElementById('home-wave-track')"));
  assert.match(functionSource, /if \(homeWaveTrackState\.lastAt && nowMs - homeWaveTrackState\.lastAt < minGap\) return;/);
}

test('实时节拍频段边界复用旧版采样桶', testBeatBandRangeCache);
test('实时节拍分析复用主分析器 RMS', testRealtimeRmsReuse);
test('空 Home 波形先节流再查询 DOM', testHomeWaveThrottleBeforeDomLookup);
