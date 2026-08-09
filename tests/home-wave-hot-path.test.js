'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function readSource() {
  return fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
}

function readSourceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `未找到源码区段：${startMarker}`);
  return source.slice(start, end);
}

function createWave() {
  const wave = {
    children: [],
    _innerHTML: '',
    get innerHTML() {
      return this._innerHTML;
    },
    set innerHTML(value) {
      this._innerHTML = value;
      this.children = Array.from({ length: 24 }, () => ({ style: {} }));
    },
  };
  return wave;
}

test('Home 空库波形缓存频谱桶索引，不在每次刷新重复幂运算', () => {
  const source = readSource();
  const helperSource = readSourceBetween(
    source,
    'function ensureHomeWaveTrackBinIndices(',
    'function updateHomeAudioVisual('
  );
  const updateSource = readSourceBetween(
    source,
    'function updateHomeAudioVisual(',
    'function setRange('
  );

  assert.match(helperSource, /frequencyLength/);
  assert.match(helperSource, /Math\.pow\(ratio, 1\.2\)/);
  assert.doesNotMatch(updateSource, /Math\.pow\(ratio, 1\.2\)/);
  assert.match(updateSource, /ensureHomeWaveTrackBinIndices\(dataLength, bars\.length\)/);

  const wave = createWave();
  let now = 100;
  let performanceNowCalls = 0;
  const context = {
    Array,
    Math,
    performance: { now: () => { performanceNowCalls += 1; return now; } },
    document: { getElementById: () => wave },
    emptyHomeActive: true,
    frequencyData: Uint8Array.from({ length: 8 }, (_, index) => index * 20),
    uniforms: { uTime: { value: 2 } },
    smoothBass: 0,
    smoothMid: 0,
    beatPulse: 0,
    clampRange: (value, min, max) => Math.max(min, Math.min(max, value)),
  };
  vm.runInNewContext(
    `var homeWaveTrackState = { bars: 0, smooth: [], frequencyLength: -1, binIndices: [] };\n` +
      `${readSourceBetween(source, 'function ensureHomeWaveTrackBars(', 'function ensureHomeWaveTrackBinIndices(')}\n` +
      `${helperSource}\n${updateSource}\n` +
      `this.state = homeWaveTrackState; this.update = updateHomeAudioVisual;`,
    context
  );

  context.update(0.016, now);
  assert.equal(performanceNowCalls, 0, '主循环传入时间戳时不得重复读取 performance.now()');
  const firstIndices = context.state.binIndices;
  assert.equal(firstIndices.length, 24);
  assert.equal(firstIndices[0], 0);
  assert.equal(firstIndices[23], 7);
  assert.equal(wave.children.length, 24);

  now = 200;
  context.frequencyData[7] = 255;
  context.update(0.016, now);
  assert.strictEqual(context.state.binIndices, firstIndices);

  now = 300;
  context.frequencyData = new Uint8Array(16);
  context.update(0.016, now);
  assert.notStrictEqual(context.state.binIndices, firstIndices);
  assert.equal(context.state.binIndices[23], 15);
});
