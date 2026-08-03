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
  return fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
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
 * 验证音频分析的频谱累加和时域 RMS 与旧版逐样本算法数值等价。
 * @returns {void}
 */
function testAudioAnalysisAccumulationHotPath() {
  const source = readRendererSource();
  const analysisSource = readSourceBetween(source, 'var len = frequencyData.length;', '// 动态峰值跟踪');
  assert.match(source, /var AUDIO_FREQUENCY_SCALE = 1 \/ 255;/);
  assert.match(source, /rms \+= audioTimeDomainSquareLut\[timeDomainData\[j\]\];/);
  assert.doesNotMatch(analysisSource, /frequencyData\[i\] \/ 255/);
  assert.doesNotMatch(analysisSource, /var tv =/);

  function runOptimized(frequencyData, timeDomainData) {
    const audioTimeDomainSquareLut = new Float64Array(256);
    for (let i = 0; i < audioTimeDomainSquareLut.length; i += 1) {
      const centered = (i - 128) / 128;
      audioTimeDomainSquareLut[i] = centered * centered;
    }
    const context = {
      Math,
      frequencyData,
      timeDomainData,
      AUDIO_FREQUENCY_SCALE: 1 / 255,
      audioTimeDomainSquareLut,
    };
    vm.runInNewContext(`${analysisSource}\nthis.result = { bKick, voc, mInst, tHigh, rms };`, context);
    return context.result;
  }

  const frequencyData = new Uint8Array(1024);
  const timeDomainData = new Uint8Array(2048);
  for (let i = 0; i < frequencyData.length; i += 1) frequencyData[i] = (i * 37 + 19) & 255;
  for (let i = 0; i < timeDomainData.length; i += 1) timeDomainData[i] = (i * 53 + 7) & 255;

  let bKick = 0;
  let voc = 0;
  let mInst = 0;
  let tHigh = 0;
  for (let i = 0; i < 7; i += 1) bKick += frequencyData[i] / 255;
  for (let i = 7; i < 140; i += 1) voc += frequencyData[i] / 255;
  for (let i = 140; i < 280; i += 1) mInst += frequencyData[i] / 255;
  for (let i = 280; i < frequencyData.length; i += 1) tHigh += frequencyData[i] / 255;
  let rms = 0;
  for (let i = 0; i < timeDomainData.length; i += 1) {
    const centered = (timeDomainData[i] - 128) / 128;
    rms += centered * centered;
  }
  const expected = {
    bKick: bKick / 7,
    voc: voc / 133,
    mInst: mInst / 140,
    tHigh: tHigh / 744,
    rms: Math.sqrt(rms / timeDomainData.length),
  };
  const actual = runOptimized(frequencyData, timeDomainData);
  for (const key of Object.keys(expected)) {
    assert.ok(Math.abs(actual[key] - expected[key]) < 1e-12, `${key} 数值发生变化`);
  }
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
test('音频分析频谱累加和 RMS 热循环保持数值等价', testAudioAnalysisAccumulationHotPath);
test('空 Home 波形先节流再查询 DOM', testHomeWaveThrottleBeforeDomLookup);
