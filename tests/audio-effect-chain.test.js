'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const CHAIN_ENGINE_ANCHOR = 'var AUDIO_CHAIN_BAND_FREQUENCIES';
const appSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

/**
 * 从 renderer 源码截取音效链（预设 → EQ → Preamp → Limiter → Spatial → Output）实现。
 * @returns {string} 可在隔离上下文执行的真实源码。
 */
function readAudioChainEngineSource() {
  const start = appSource.indexOf(CHAIN_ENGINE_ANCHOR);
  const end = appSource.indexOf('function applyVolumeToAudio(', start);
  assert.ok(start >= 0 && end > start, '未找到音效链实现');
  return appSource.slice(start, end);
}

/**
 * 创建音效链引擎的隔离执行环境。
 * @returns {object} 隔离上下文。
 */
function createAudioChainEngine() {
  const context = {
    JSON,
    Math,
    Number,
    Object,
    String,
    isFinite,
    console: { warn() {} },
    audioCtx: null,
    localStorage: {
      store: Object.create(null),
      getItem(key) { return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null; },
    },
    AUDIO_CHAIN_STORE_KEY: 'mineradio-audio-chain-v1',
    clampRange(value, min, max) { return Math.min(max, Math.max(min, value)); },
  };
  vm.runInNewContext(
    readAudioChainEngineSource()
      + '\nthis.presets = AUDIO_CHAIN_PRESETS;'
      + '\nthis.frequencies = AUDIO_CHAIN_BAND_FREQUENCIES;'
      + '\nthis.normalizeGains = normalizeAudioChainGains;'
      + '\nthis.presetById = audioChainPresetById;'
      + '\nthis.matchPreset = matchAudioChainPreset;'
      + '\nthis.normalizeSettings = normalizeAudioChainSettings;'
      + '\nthis.readSaved = readSavedAudioChainSettings;'
      + '\nthis.resolve = resolveAudioChainState;'
      + '\nthis.createChain = createAudioEffectChain;'
      + '\nthis.applyToNodes = applyAudioChainToNodes;'
      + '\nthis.profilePayload = audioChainProfilePayload;'
      + '\nthis.profileFileName = audioChainProfileFileName;'
      + '\nthis.importProfile = normalizeImportedAudioChainProfile;'
      + '\nthis.setSettings = function(next){ audioChainSettings = normalizeAudioChainSettings(next); };'
      + '\nthis.getSettings = function(){ return audioChainSettings; };'
      + '\nthis.setChain = function(next){ audioChain = next; };'
      + '\nthis.state = function(){ return audioChainActive; };',
    context,
  );
  return context;
}

/**
 * 造一个只记账的 AudioContext 桩，用来核对音效链的真实拓扑与初始中性值。
 * @returns {object} 上下文桩与连线记录。
 */
function createStubAudioContext() {
  const connections = [];
  let seq = 0;
  /**
   * 造一个可记账的 AudioParam 桩。
   * @returns {object} 参数桩。
   */
  function makeParam() {
    return {
      value: 0,
      cancelScheduledValues() {},
      setValueAtTime() {},
      linearRampToValueAtTime(next) { this.value = next; },
    };
  }
  /**
   * 造一个可记账的音频节点桩。
   * @param {string} kind 节点类型。
   * @returns {object} 节点桩。
   */
  function makeNode(kind) {
    const node = { kind, id: kind + '#' + (seq += 1) };
    node.connect = function (dest, out, input) {
      connections.push(node.id + '>' + dest.id + ':' + (out === undefined ? 0 : out) + '/' + (input === undefined ? 0 : input));
    };
    return node;
  }
  const ctx = {
    currentTime: 0,
    createBiquadFilter() {
      const node = makeNode('biquad');
      node.type = 'peaking';
      node.frequency = makeParam();
      node.Q = makeParam();
      node.gain = makeParam();
      return node;
    },
    createGain() {
      const node = makeNode('gain');
      node.gain = makeParam();
      return node;
    },
    createDynamicsCompressor() {
      const node = makeNode('compressor');
      node.threshold = makeParam();
      node.knee = makeParam();
      node.ratio = makeParam();
      node.attack = makeParam();
      node.release = makeParam();
      return node;
    },
    createChannelSplitter(count) {
      const node = makeNode('splitter');
      node.count = count;
      return node;
    },
    createChannelMerger(count) {
      const node = makeNode('merger');
      node.count = count;
      return node;
    },
  };
  return { ctx, connections };
}

/**
 * 按链路上真实写入的增益值，逐样本模拟末端的中/侧矩阵。
 * @param {object} chain 链路节点集合。
 * @param {number} left 左声道样本。
 * @param {number} right 右声道样本。
 * @returns {Array<number>} 输出的左右声道样本。
 */
function simulateSpatial(chain, left, right) {
  const spatial = chain.spatial;
  const mid = (left + right) * spatial.mid.gain.value;
  const side = (left + right * spatial.sideInvert.gain.value) * spatial.side.gain.value;
  const widened = side * spatial.width.gain.value;
  return [mid + widened, mid + widened * spatial.widthInvert.gain.value];
}

/**
 * 验证关闭音效链时整条链退回完全透明的中性值。
 * @returns {void}
 */
function testDisabledChainIsTransparent() {
  const engine = createAudioChainEngine();
  const state = engine.resolve({
    enabled: false,
    gains: [8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
    preampDb: 6,
    spatialEnabled: true,
    widthRatio: 2,
  });
  assert.equal(state.enabled, false);
  assert.deepEqual(Array.from(state.gains), [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(state.preampLinear, 1);
  assert.equal(state.totalPreampDb, 0);
  assert.equal(state.limiter.ratio, 1);
  assert.equal(state.limiter.thresholdDb, 0);
  assert.equal(state.width, 1);
}

/**
 * 验证预设表齐全，且每条曲线都能反推回自己。
 * @returns {void}
 */
function testPresetTableAndMatch() {
  const engine = createAudioChainEngine();
  const presets = Array.from(engine.presets);
  assert.deepEqual(presets.map((preset) => preset.id), ['normal', 'rock', 'pop', 'classical', 'jazz', 'bass', 'vocal', 'custom']);
  assert.deepEqual(presets.map((preset) => preset.label), ['Normal', 'Rock', 'Pop', 'Classical', 'Jazz', 'Bass Boost', 'Vocal', '自定义']);
  assert.equal(engine.presetById('custom').gains, null, '自定义没有固定曲线');
  presets.forEach((preset) => {
    if (!preset.gains) return;
    assert.equal(Array.from(preset.gains).length, 10, preset.id + ' 必须给满 10 段');
    assert.equal(engine.matchPreset(preset.gains), preset.id, preset.id + ' 曲线要能反推回自己');
  });
  assert.deepEqual(Array.from(engine.presetById('normal').gains), [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(engine.matchPreset([1, 0, 0, 0, 0, 0, 0, 0, 0, 0]), 'custom');
  assert.equal(engine.matchPreset(null), 'normal', '空曲线等于全 0，就是 Normal');
}

/**
 * 验证频段增益按 ±12 dB 夹紧、按 0.5 dB 取整并补齐到 10 段。
 * @returns {void}
 */
function testBandGainNormalization() {
  const engine = createAudioChainEngine();
  assert.deepEqual(
    Array.from(engine.normalizeGains([99, -99, 1.24, 1.26, 'x', null, undefined, NaN, 3, 4, 5, 6])),
    [12, -12, 1, 1.5, 0, 0, 0, 0, 3, 4],
  );
  assert.equal(Array.from(engine.normalizeGains([])).length, 10, '不足 10 段要补 0');
  assert.deepEqual(Array.from(engine.normalizeGains(null)), [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(Array.from(engine.normalizeGains('nope')), [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
}

/**
 * 验证自动预增益按最大提升量反向留余量，并夹在总量下限内。
 * @returns {void}
 */
function testAutoPreampHeadroom() {
  const engine = createAudioChainEngine();
  const bass = engine.presetById('bass').gains;

  const auto = engine.resolve({ enabled: true, gains: bass, preampDb: 0, autoPreamp: true });
  assert.equal(auto.maxBoostDb, 8);
  assert.equal(auto.autoPreampDb, -8);
  assert.equal(auto.totalPreampDb, -8);
  assert.ok(Math.abs(auto.preampLinear - Math.pow(10, -8 / 20)) < 1e-12);

  const manual = engine.resolve({ enabled: true, gains: bass, preampDb: 0, autoPreamp: false });
  assert.equal(manual.autoPreampDb, 0);
  assert.equal(manual.preampLinear, 1, '关掉自动留余量就按用户给的预增益走');

  const stacked = engine.resolve({ enabled: true, gains: bass, preampDb: 3, autoPreamp: true });
  assert.equal(stacked.totalPreampDb, -5, '用户预增益与自动余量相加');

  const cutOnly = engine.resolve({
    enabled: true, gains: [-12, -12, -12, -12, -12, -12, -12, -12, -12, -12], preampDb: 6, autoPreamp: true,
  });
  assert.equal(cutOnly.maxBoostDb, 0, '只有衰减时不需要额外留余量');
  assert.equal(cutOnly.totalPreampDb, 6);

  const floored = engine.resolve({
    enabled: true, gains: [12, 0, 0, 0, 0, 0, 0, 0, 0, 0], preampDb: -12, autoPreamp: true,
  });
  assert.equal(floored.totalPreampDb, -24, '总预增益封在 -24 dB，不能把歌压成静音');
}

/**
 * 验证限幅与声场的开关语义：关掉时靠中性值旁通，而不是改接线。
 * @returns {void}
 */
function testLimiterAndSpatialResolve() {
  const engine = createAudioChainEngine();

  const on = engine.resolve({
    enabled: true, limiterEnabled: true, limiterThresholdDb: -3, spatialEnabled: true, widthRatio: 1.6,
  });
  assert.equal(on.limiter.enabled, true);
  assert.equal(on.limiter.ratio, 20);
  assert.equal(on.limiter.thresholdDb, -3);
  assert.equal(on.width, 1.6);

  const off = engine.resolve({
    enabled: true, limiterEnabled: false, limiterThresholdDb: -3, spatialEnabled: false, widthRatio: 1.6,
  });
  assert.equal(off.limiter.ratio, 1, '限幅关闭靠 ratio=1 旁通');
  assert.equal(off.limiter.thresholdDb, 0);
  assert.equal(off.width, 1, '声场关闭时宽度必须回到 1');

  const clamped = engine.normalizeSettings({ limiterThresholdDb: -99, widthRatio: 9, preampDb: 40 });
  assert.equal(clamped.limiterThresholdDb, -12);
  assert.equal(clamped.widthRatio, 2);
  assert.equal(clamped.preampDb, 12);

  const defaults = engine.normalizeSettings(null);
  assert.equal(defaults.enabled, false, '默认不改声音');
  assert.equal(defaults.autoPreamp, true);
  assert.equal(defaults.limiterEnabled, true);
  assert.equal(defaults.limiterThresholdDb, -1);
  assert.equal(defaults.spatialEnabled, false);
  assert.equal(defaults.widthRatio, 1);
  assert.equal(defaults.preampDb, 0);
  assert.deepEqual(Array.from(defaults.gains), [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
}

/**
 * 验证设置存档缺失或损坏时回落默认值。
 * @returns {void}
 */
function testSavedSettingsFallBackToDefaults() {
  const engine = createAudioChainEngine();
  assert.equal(engine.readSaved().enabled, false);

  engine.localStorage.store['mineradio-audio-chain-v1'] = '{坏了';
  assert.equal(engine.readSaved().enabled, false, '存档损坏时必须回落默认值而不是抛错');
  assert.equal(engine.readSaved().limiterThresholdDb, -1);

  engine.localStorage.store['mineradio-audio-chain-v1'] = JSON.stringify({
    enabled: true, gains: [3, 0, 0, 0, 0, 0, 0, 0, 0, 0], preampDb: -2, spatialEnabled: true, widthRatio: 1.5,
  });
  const saved = engine.readSaved();
  assert.equal(saved.enabled, true);
  assert.equal(saved.preampDb, -2);
  assert.equal(saved.widthRatio, 1.5);
  assert.deepEqual(Array.from(saved.gains), [3, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
}

/**
 * 验证链路拓扑与初始中性值：预设 → EQ → Preamp → Limiter → Spatial → Output。
 * @returns {void}
 */
function testChainGraphTopology() {
  const engine = createAudioChainEngine();
  const stub = createStubAudioContext();
  const chain = engine.createChain(stub.ctx);
  const bands = Array.from(chain.bands);
  const spatial = chain.spatial;

  assert.equal(bands.length, 10);
  assert.equal(chain.input, bands[0], '入口是第一段 EQ');
  assert.equal(chain.output, spatial.merger, '出口是声场合并器');
  assert.deepEqual(
    bands.map((band) => band.type),
    ['lowshelf', 'peaking', 'peaking', 'peaking', 'peaking', 'peaking', 'peaking', 'peaking', 'peaking', 'highshelf'],
  );
  assert.deepEqual(
    bands.map((band) => band.frequency.value),
    [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000],
  );
  bands.forEach((band) => {
    assert.equal(band.gain.value, 0, '每段初始必须是 0 dB');
    assert.equal(band.Q.value, band.type === 'peaking' ? 1 : 0, '只有 peaking 段需要设 Q');
  });

  const expected = [];
  for (let i = 0; i < 9; i += 1) expected.push(bands[i].id + '>' + bands[i + 1].id + ':0/0');
  expected.push(bands[9].id + '>' + chain.preamp.id + ':0/0');
  expected.push(chain.preamp.id + '>' + chain.limiter.id + ':0/0');
  expected.push(chain.limiter.id + '>' + spatial.splitter.id + ':0/0');
  expected.push(spatial.splitter.id + '>' + spatial.mid.id + ':0/0');
  expected.push(spatial.splitter.id + '>' + spatial.mid.id + ':1/0');
  expected.push(spatial.splitter.id + '>' + spatial.side.id + ':0/0');
  expected.push(spatial.splitter.id + '>' + spatial.sideInvert.id + ':1/0');
  expected.push(spatial.sideInvert.id + '>' + spatial.side.id + ':0/0');
  expected.push(spatial.side.id + '>' + spatial.width.id + ':0/0');
  expected.push(spatial.width.id + '>' + spatial.widthInvert.id + ':0/0');
  expected.push(spatial.mid.id + '>' + spatial.merger.id + ':0/0');
  expected.push(spatial.mid.id + '>' + spatial.merger.id + ':0/1');
  expected.push(spatial.width.id + '>' + spatial.merger.id + ':0/0');
  expected.push(spatial.widthInvert.id + '>' + spatial.merger.id + ':0/1');
  assert.deepEqual(stub.connections, expected, '接线顺序与去向必须完全对得上');

  assert.equal(chain.preamp.gain.value, 1, '预增益初始 1 倍');
  assert.equal(chain.limiter.ratio.value, 1, '默认 ratio=1，压缩曲线退化成直线等于旁通');
  assert.equal(chain.limiter.threshold.value, 0);
  assert.equal(chain.limiter.knee.value, 0);
  assert.equal(spatial.mid.gain.value, 0.5);
  assert.equal(spatial.side.gain.value, 0.5);
  assert.equal(spatial.sideInvert.gain.value, -1);
  assert.equal(spatial.width.gain.value, 1);
  assert.equal(spatial.widthInvert.gain.value, -1);
  assert.equal(spatial.splitter.count, 2);
  assert.equal(spatial.merger.count, 2);
  assert.equal(engine.createChain(null), null, '没有音频上下文时不建链');
}

/**
 * 用链路上真实写入的增益逐样本验证中/侧矩阵：宽度 1 原样、0 单声道、2 加宽。
 * @returns {void}
 */
function testMidSideMatrixMath() {
  const engine = createAudioChainEngine();
  const stub = createStubAudioContext();
  const chain = engine.createChain(stub.ctx);
  engine.setChain(chain);
  const samples = [[1, -0.5], [0.25, 0.25], [-0.75, 0.5], [0.4, 0]];

  engine.setSettings({ enabled: true, spatialEnabled: false, widthRatio: 2 });
  engine.applyToNodes(true);
  samples.forEach(function (pair) {
    const out = simulateSpatial(chain, pair[0], pair[1]);
    assert.ok(Math.abs(out[0] - pair[0]) < 1e-12, '声场关闭必须逐样本还原左声道');
    assert.ok(Math.abs(out[1] - pair[1]) < 1e-12, '声场关闭必须逐样本还原右声道');
  });

  engine.setSettings({ enabled: true, spatialEnabled: true, widthRatio: 0 });
  engine.applyToNodes(true);
  samples.forEach(function (pair) {
    const mono = (pair[0] + pair[1]) / 2;
    const out = simulateSpatial(chain, pair[0], pair[1]);
    assert.ok(Math.abs(out[0] - mono) < 1e-12, '宽度 0 时并成单声道');
    assert.ok(Math.abs(out[1] - mono) < 1e-12, '宽度 0 时两声道相同');
  });

  engine.setSettings({ enabled: true, spatialEnabled: true, widthRatio: 2 });
  engine.applyToNodes(true);
  samples.forEach(function (pair) {
    const side = (pair[0] - pair[1]) / 2;
    const out = simulateSpatial(chain, pair[0], pair[1]);
    assert.ok(Math.abs(out[0] - (pair[0] + side)) < 1e-12, '宽度 2 时侧信号再加一份');
    assert.ok(Math.abs(out[1] - (pair[1] - side)) < 1e-12, '宽度 2 时右声道对称减去');
  });
}

/**
 * 验证应用设置会写满每一级，并在关闭时把整条链推回中性。
 * @returns {void}
 */
function testApplyWritesEveryStage() {
  const engine = createAudioChainEngine();
  const stub = createStubAudioContext();
  const chain = engine.createChain(stub.ctx);
  engine.setChain(chain);
  const rock = Array.from(engine.presetById('rock').gains);

  engine.setSettings({
    enabled: true, gains: rock, preampDb: 0, autoPreamp: true,
    limiterEnabled: true, limiterThresholdDb: -2, spatialEnabled: true, widthRatio: 1.5,
  });
  const state = engine.applyToNodes(true);
  assert.deepEqual(Array.from(chain.bands).map((band) => band.gain.value), rock);
  assert.equal(state.maxBoostDb, 5);
  assert.ok(Math.abs(chain.preamp.gain.value - Math.pow(10, -5 / 20)) < 1e-12);
  assert.equal(chain.limiter.threshold.value, -2);
  assert.equal(chain.limiter.ratio.value, 20);
  assert.equal(chain.spatial.width.gain.value, 1.5);
  assert.equal(chain.spatial.widthInvert.gain.value, -1, 'widthInvert 恒为 -1，否则宽度会被乘两次');

  // 没有 immediate 时走短斜坡，最终值仍要落到目标上。
  engine.audioCtx = { currentTime: 0 };
  const vocal = Array.from(engine.presetById('vocal').gains);
  engine.setSettings({ enabled: true, gains: vocal, autoPreamp: false });
  engine.applyToNodes();
  assert.deepEqual(Array.from(chain.bands).map((band) => band.gain.value), vocal);
  assert.equal(engine.state().preset, 'vocal', '解析结果要落到全局状态供界面读取');

  engine.setSettings({
    enabled: false, gains: rock, preampDb: 6,
    limiterEnabled: true, limiterThresholdDb: -2, spatialEnabled: true, widthRatio: 1.5,
  });
  engine.applyToNodes(true);
  assert.deepEqual(Array.from(chain.bands).map((band) => band.gain.value), [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(chain.preamp.gain.value, 1);
  assert.equal(chain.limiter.ratio.value, 1);
  assert.equal(chain.limiter.threshold.value, 0);
  assert.equal(chain.spatial.width.gain.value, 1);
  assert.equal(engine.state().enabled, false);
  assert.equal(engine.state().preset, 'rock', '关闭时仍记着曲线属于哪个预设，重新打开就回来');
}

/**
 * 验证导出的 .eq.json 走一圈 JSON 后能原样导回来。
 * @returns {void}
 */
function testProfileRoundTrip() {
  const engine = createAudioChainEngine();
  const jazz = Array.from(engine.presetById('jazz').gains);
  engine.setSettings({
    enabled: true, gains: jazz, preampDb: -1.5, autoPreamp: false,
    limiterEnabled: true, limiterThresholdDb: -4, spatialEnabled: true, widthRatio: 1.35,
    profileName: '我的 Jazz',
  });

  const payload = engine.profilePayload('我的 Jazz');
  assert.equal(payload.format, 'mineradio.eq');
  assert.equal(payload.version, 1);
  assert.equal(payload.name, '我的 Jazz');
  assert.equal(payload.eqEnabled, true);
  assert.deepEqual(Array.from(payload.bands).map((band) => band.frequency), Array.from(engine.frequencies));
  assert.deepEqual(Array.from(payload.bands).map((band) => band.gain), jazz);
  assert.equal(payload.preamp, -1.5);
  assert.equal(payload.autoPreamp, false);
  assert.deepEqual(Object.assign({}, payload.limiter), { enabled: true, thresholdDb: -4 });
  assert.deepEqual(Object.assign({}, payload.spatial), { enabled: true, width: 1.35 });

  const back = engine.importProfile(JSON.parse(JSON.stringify(payload)));
  assert.deepEqual(Object.assign({}, back), Object.assign({}, engine.getSettings()));
  assert.equal(back.profileName, '我的 Jazz', '档案名要跟着文件走');
}

/**
 * 验证不认识的文件一律拒绝，绝不拿别人的配置去改声音。
 * @returns {void}
 */
function testProfileRejectsForeignFiles() {
  const engine = createAudioChainEngine();
  assert.equal(engine.importProfile(null), null);
  assert.equal(engine.importProfile('文本'), null);
  assert.equal(engine.importProfile({ bands: [1, 2, 3] }), null, '缺 format 一律拒绝');
  assert.equal(engine.importProfile({ format: 'other.eq', bands: [1] }), null);
  assert.equal(engine.importProfile({ format: 'mineradio.eq' }), null, '没有频段就不是有效档案');
  assert.equal(engine.importProfile({ format: 'mineradio.eq', bands: [] }), null);
  assert.equal(engine.importProfile({ format: 'mineradio.eq', bands: [{ frequency: 'x', gain: 'y' }] }), null);
}

/**
 * 验证纯数组曲线与带频率的曲线都能读，频率按最接近的频段归位。
 * @returns {void}
 */
function testProfileAcceptsPlainAndNearestFrequency() {
  const engine = createAudioChainEngine();

  const plainList = engine.importProfile({ format: 'mineradio.eq', bands: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] });
  assert.deepEqual(Array.from(plainList.gains), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

  const nearest = engine.importProfile({
    format: 'mineradio.eq',
    bands: [{ frequency: 30, gain: 6 }, { frequency: 3500, gain: -4 }, { frequency: 20000, gain: 2 }],
  });
  assert.deepEqual(Array.from(nearest.gains), [6, 0, 0, 0, 0, 0, 0, -4, 0, 2], '30 Hz 归到 31 Hz、3.5 kHz 归到 4 kHz、20 kHz 归到 16 kHz');

  const short = engine.importProfile({ format: 'mineradio.eq', bands: [1, 2] });
  assert.deepEqual(Array.from(short.gains), [1, 2, 0, 0, 0, 0, 0, 0, 0, 0], '缺的频段补 0，不要整条拒绝');

  const bare = engine.importProfile({ format: 'mineradio.eq', bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] });
  assert.equal(bare.enabled, true, '导入档案默认就是要开着用');
  assert.equal(bare.limiterEnabled, true, '缺 limiter 字段时回落默认');
  assert.equal(bare.limiterThresholdDb, -1);
  assert.equal(bare.spatialEnabled, false);
  assert.equal(bare.widthRatio, 1);
}

/**
 * 验证导出文件名过滤非法字符并统一带上 .eq.json 后缀。
 * @returns {void}
 */
function testProfileFileName() {
  const engine = createAudioChainEngine();
  assert.equal(engine.profileFileName('我的 Jazz'), '我的 Jazz.eq.json');
  assert.equal(engine.profileFileName('a/b\\c:d*e?f"g<h>i|j'), 'abcdefghij.eq.json');
  assert.equal(engine.profileFileName('Bass Boost'), 'Bass Boost.eq.json');
  assert.equal(engine.profileFileName(''), 'mineradio.eq.json');
  assert.equal(engine.profileFileName(null), 'mineradio.eq.json');
  assert.equal(engine.profileFileName('   '), 'mineradio.eq.json');
  assert.equal(engine.profileFileName('/////'), 'mineradio.eq.json');
}

/**
 * 验证音频链路、存档键与界面入口都按设计接好，避免后续改动悄悄绕开音效链。
 * @returns {void}
 */
function testSourceWiring() {
  // 音效链整段挂在均衡增益之后、gainNode 之前：音量与淡入淡出继续由 gainNode 独占。
  assert.match(appSource, /audioChain = createAudioEffectChain\(audioCtx\);/);
  assert.match(appSource, /replayGainNode\.connect\(audioChain\.input\);/);
  assert.match(appSource, /audioChain\.output\.connect\(gainNode\);/);
  assert.match(appSource, /gainNode\.connect\(audioCtx\.destination\);/);
  // 音频节点重建后要用已算好的参数补位，避免刚起播那一下漏掉音效链。
  assert.match(appSource, /applyAudioChainToNodes\(true\);/);

  // 设置跟音量均衡一样走独立存档键，不混进视觉预设 fx。
  assert.match(appSource, /var AUDIO_CHAIN_STORE_KEY = 'mineradio-audio-chain-v1';/);
  assert.match(appSource, /PERSISTENT_UI_STATE_KEYS[\s\S]*?AUDIO_CHAIN_STORE_KEY,/);
  assert.ok(!/fx\.audioChain|fx\.eqEnabled|fx\.eqGains/.test(appSource), '音效链设置不能写进视觉预设 fx');
  assert.ok(!/\['eq-/.test(appSource), '音效链滑杆不能挂进 fx 滑杆白名单');

  // 启动链路与折叠归位都要接上音效链。
  assert.match(appSource, /initReplayGainControls\(\);\s*initAudioChainControls\(\);/);
  assert.match(appSource, /id === 'fx-volume-fold' \|\| id === 'fx-eq-fold'/);

  assert.match(indexSource, /id="fx-eq-fold"[\s\S]*?id="t-audioChain"[\s\S]*?id="t-audioChainAutoPreamp"[\s\S]*?id="t-audioChainLimiter"[\s\S]*?id="t-audioChainSpatial"/);
  assert.match(indexSource, /onclick="toggleAudioChainSetting\('enabled'\)"/);
  ['normal', 'rock', 'pop', 'classical', 'jazz', 'bass', 'vocal', 'custom'].forEach((id) => {
    assert.match(indexSource, new RegExp('data-eq-preset="' + id + '"'), id + ' 预设按钮要在面板上');
  });
  for (let i = 0; i < 10; i += 1) {
    assert.match(
      indexSource,
      new RegExp('id="eq-band-' + i + '" data-eq-band="' + i + '" type="range" min="-12" max="12" step="0\\.5"'),
      '第 ' + i + ' 段滑杆要按 ±12 dB / 0.5 dB 步进接好',
    );
  }
  assert.match(indexSource, /id="eq-preamp" type="range" min="-12" max="12" step="0\.5"/);
  assert.match(indexSource, /id="eq-limiter-threshold" type="range" min="-12" max="0" step="0\.5"/);
  assert.match(indexSource, /id="eq-spatial-width" type="range" min="0" max="2" step="0\.05"/);
  assert.match(indexSource, /onclick="exportAudioChainProfile\(\)"/);
  assert.match(indexSource, /onclick="importAudioChainProfileFromDialog\(\)"/);
  assert.match(indexSource, /id="eq-profile-name"/);
  assert.match(indexSource, /id="eq-hint"/);
}

test('关闭音效链时整条链保持中性', testDisabledChainIsTransparent);
test('预设表齐全且每条曲线能反推回自己', testPresetTableAndMatch);
test('频段增益夹在 ±12 dB 并按 0.5 dB 取整', testBandGainNormalization);
test('自动预增益按最大提升量留余量', testAutoPreampHeadroom);
test('限幅与声场关闭时靠中性值旁通', testLimiterAndSpatialResolve);
test('设置存档损坏时回落默认值', testSavedSettingsFallBackToDefaults);
test('链路拓扑与初始中性值按设计接好', testChainGraphTopology);
test('中/侧矩阵在宽度 1 时逐样本原样输出', testMidSideMatrixMath);
test('应用设置会写满每一级参数', testApplyWritesEveryStage);
test('导出的 .eq.json 能原样导回来', testProfileRoundTrip);
test('不认识的档案文件一律拒绝', testProfileRejectsForeignFiles);
test('纯数组与带频率的曲线都能导入', testProfileAcceptsPlainAndNearestFrequency);
test('导出文件名过滤非法字符', testProfileFileName);
test('音效链链路、存档键与界面入口按设计接好', testSourceWiring);
