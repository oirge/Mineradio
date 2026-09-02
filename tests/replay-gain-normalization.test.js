'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const LIGHT_ENGINE_ANCHOR = 'var REPLAY_GAIN_PREAMP_MIN';
const appSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

/**
 * 从 renderer 源码截取音量均衡（ReplayGain）增益解析实现。
 * @returns {string} 可在隔离上下文执行的真实源码。
 */
function readReplayGainEngineSource() {
  const source = appSource;
  const start = source.indexOf(LIGHT_ENGINE_ANCHOR);
  const end = source.indexOf('function flushVolumePreference(', start);
  assert.ok(start >= 0 && end > start, '未找到音量均衡增益实现');
  return source.slice(start, end);
}

/**
 * 创建音量均衡引擎的隔离执行环境，并提供最小 GainNode 与 AudioContext 桩。
 * @returns {object} 隔离上下文、增益节点桩与调用记录。
 */
function createReplayGainEngine() {
  const ramps = [];
  const cacheWrites = [];
  const calls = { controlUpdates: 0, extractCount: 0 };
  const scanned = { tags: null };
  const gainParam = {
    value: 1,
    cancelScheduledValues() {},
    setValueAtTime() {},
    linearRampToValueAtTime(value, when) {
      ramps.push({ value, when });
      gainParam.value = value;
    },
  };
  const context = {
    JSON,
    Math,
    Number,
    Object,
    Promise,
    String,
    console: { warn() {} },
    audioCtx: { currentTime: 0 },
    replayGainNode: { gain: gainParam },
    currentLocalSong: null,
    trackSwitchToken: 0,
    isFinite,
    localStorage: {
      store: Object.create(null),
      getItem(key) { return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null; },
    },
    REPLAY_GAIN_STORE_KEY: 'mineradio-replay-gain-v1',
    clampRange(value, min, max) { return Math.min(max, Math.max(min, value)); },
    extractLocalMetadataTags() {
      calls.extractCount += 1;
      return Promise.resolve(scanned.tags || {});
    },
    scheduleLocalAssetCacheWrite(song) { cacheWrites.push(song); },
    isCurrentLocalQueueSong() { return true; },
    updateReplayGainControls() { calls.controlUpdates += 1; },
  };
  vm.runInNewContext(
    readReplayGainEngineSource()
      + '\nthis.resolve = resolveReplayGain;'
      + '\nthis.normalizeSettings = normalizeReplayGainSettings;'
      + '\nthis.readSaved = readSavedReplayGainSettings;'
      + '\nthis.setNodeGain = setReplayGainNodeGain;'
      + '\nthis.applyForSong = applyReplayGainForCurrentSong;'
      + '\nthis.prepare = prepareReplayGainForSong;'
      + '\nthis.ensure = ensureLocalReplayGainForSong;'
      + '\nthis.setSettings = function(next){ replayGainSettings = normalizeReplayGainSettings(next); };'
      + '\nthis.state = function(){ return replayGainActive; };',
    context,
  );
  return { context, gainParam, ramps, cacheWrites, calls, scanned };
}

/**
 * 把线性增益换算回 dB，便于断言。
 * @param {number} linear 线性增益。
 * @returns {number} 保留三位小数的 dB。
 */
function toDb(linear) {
  return Math.round(Math.log10(linear) * 20 * 1000) / 1000;
}

/**
 * 验证关闭开关时完全不改动电平。
 * @returns {void}
 */
function testDisabledKeepsOriginalLevel() {
  const engine = createReplayGainEngine();
  const result = engine.context.resolve({ resolved: 1, trackGainDb: -9, trackPeak: 0.5 }, { enabled: false });
  assert.deepEqual(Object.assign({}, result), {
    linear: 1, source: 'off', gainDb: 0, appliedDb: 0, clipped: false, peak: 0,
  });
}

/**
 * 验证没有标签的歌曲保持原始电平，而不是猜一个增益。
 * @returns {void}
 */
function testMissingTagKeepsOriginalLevel() {
  const engine = createReplayGainEngine();
  const noInfo = engine.context.resolve(null, { enabled: true });
  assert.equal(noInfo.linear, 1);
  assert.equal(noInfo.source, 'none');

  const peakOnly = engine.context.resolve({ resolved: 1, trackPeak: 0.4 }, { enabled: true });
  assert.equal(peakOnly.linear, 1);
  assert.equal(peakOnly.source, 'none');
}

/**
 * 验证整轨增益按 dB 转线性，并叠加 Preamp。
 * @returns {void}
 */
function testTrackGainWithPreamp() {
  const engine = createReplayGainEngine();
  const plain = engine.context.resolve({ resolved: 1, trackGainDb: -6 }, { enabled: true, mode: 'track' });
  assert.equal(plain.source, 'track');
  assert.equal(toDb(plain.linear), -6);

  const preamped = engine.context.resolve(
    { resolved: 1, trackGainDb: -6 },
    { enabled: true, mode: 'track', preampDb: 2.5 },
  );
  assert.equal(toDb(preamped.linear), -3.5);
  assert.equal(preamped.appliedDb, -3.5);
}

/**
 * 验证 Preamp 会被夹在 ±12 dB 且按 0.1 dB 取整。
 * @returns {void}
 */
function testPreampClamping() {
  const engine = createReplayGainEngine();
  assert.equal(engine.context.normalizeSettings({ preampDb: 40 }).preampDb, 12);
  assert.equal(engine.context.normalizeSettings({ preampDb: -40 }).preampDb, -12);
  assert.equal(engine.context.normalizeSettings({ preampDb: 3.46 }).preampDb, 3.5);
  assert.equal(engine.context.normalizeSettings({ preampDb: 'x' }).preampDb, 0);
  assert.equal(engine.context.normalizeSettings(null).clipGuard, true, '防削波默认开启');
  assert.equal(engine.context.normalizeSettings({ mode: '整轨' }).mode, 'track');
}

/**
 * 验证防削波按峰值封顶：提升后会削波时退回到刚好不削波的增益。
 * @returns {void}
 */
function testClipGuardCapsGain() {
  const engine = createReplayGainEngine();
  const info = { resolved: 1, trackGainDb: 6, trackPeak: 0.9 };

  const guarded = engine.context.resolve(info, { enabled: true, clipGuard: true, mode: 'track' });
  assert.equal(guarded.clipped, true);
  // 1/0.9 是刚好不削波的上限，约 +0.915 dB。
  assert.equal(Math.round(guarded.linear * 1000000) / 1000000, Math.round((1 / 0.9) * 1000000) / 1000000);

  const unguarded = engine.context.resolve(info, { enabled: true, clipGuard: false, mode: 'track' });
  assert.equal(unguarded.clipped, false);
  assert.equal(toDb(unguarded.linear), 6);
}

/**
 * 验证没有峰值标签时防削波不做额外衰减，与 foobar2000 行为一致。
 * @returns {void}
 */
function testClipGuardWithoutPeakDoesNotAttenuate() {
  const engine = createReplayGainEngine();
  const result = engine.context.resolve(
    { resolved: 1, trackGainDb: 4 },
    { enabled: true, clipGuard: true, mode: 'track' },
  );
  assert.equal(result.clipped, false);
  assert.equal(toDb(result.linear), 4);
  assert.equal(result.peak, 0);
}

/**
 * 验证整轨与整专辑增益在缺失时互相回退，峰值也跟着回退。
 * @returns {void}
 */
function testAlbumTrackFallback() {
  const engine = createReplayGainEngine();

  const albumMode = engine.context.resolve(
    { resolved: 1, albumGainDb: -4, albumPeak: 0.8, trackGainDb: -9, trackPeak: 0.99 },
    { enabled: true, mode: 'album' },
  );
  assert.equal(albumMode.source, 'album');
  assert.equal(albumMode.gainDb, -4);
  assert.equal(albumMode.peak, 0.8);

  const albumMissing = engine.context.resolve(
    { resolved: 1, trackGainDb: -9, trackPeak: 0.99 },
    { enabled: true, mode: 'album' },
  );
  assert.equal(albumMissing.source, 'track', '整专辑增益缺失时回退整轨，而不是放弃均衡');
  assert.equal(albumMissing.gainDb, -9);

  const trackMissing = engine.context.resolve(
    { resolved: 1, albumGainDb: -4, albumPeak: 0.8 },
    { enabled: true, mode: 'track' },
  );
  assert.equal(trackMissing.source, 'album', '整轨增益缺失时回退整专辑');
  assert.equal(trackMissing.gainDb, -4);

  const peakFallback = engine.context.resolve(
    { resolved: 1, albumGainDb: 8, trackPeak: 0.5 },
    { enabled: true, mode: 'album', clipGuard: true },
  );
  assert.equal(peakFallback.peak, 0.5, '整专辑峰值缺失时用整轨峰值防削波');
  assert.equal(peakFallback.clipped, true);
  assert.equal(peakFallback.linear, 2);
}

/**
 * 验证设置存档缺失或损坏时回落默认值，并按范围归一化。
 * @returns {void}
 */
function testSavedSettingsFallBackToDefaults() {
  const engine = createReplayGainEngine();
  const defaults = { enabled: false, mode: 'track', preampDb: 0, clipGuard: true };
  assert.deepEqual(Object.assign({}, engine.context.readSaved()), defaults);

  engine.context.localStorage.store['mineradio-replay-gain-v1'] = '{坏了';
  assert.deepEqual(Object.assign({}, engine.context.readSaved()), defaults, '存档损坏时必须回落默认值而不是抛错');

  engine.context.localStorage.store['mineradio-replay-gain-v1'] = JSON.stringify({
    enabled: true, mode: 'album', preampDb: 99, clipGuard: false,
  });
  assert.deepEqual(Object.assign({}, engine.context.readSaved()), {
    enabled: true, mode: 'album', preampDb: 12, clipGuard: false,
  });
}

/**
 * 验证增益写入节点时用短斜坡，并夹在安全范围内。
 * @returns {void}
 */
function testNodeGainRampAndClamp() {
  const engine = createReplayGainEngine();

  engine.context.setNodeGain(0.5, true);
  assert.equal(engine.gainParam.value, 0.5);
  assert.equal(engine.ramps.length, 0, '立即生效不应排斜坡');

  engine.context.setNodeGain(0.25);
  assert.equal(engine.ramps.length, 1);
  assert.equal(engine.ramps[0].value, 0.25);
  assert.equal(engine.ramps[0].when, 0.08, '切换设置时用 80 ms 斜坡避免爆音');

  engine.context.setNodeGain(99, true);
  assert.equal(engine.gainParam.value, 4, '增益上限封顶，开关不能变成放大器');
  engine.context.setNodeGain(0.0001, true);
  assert.equal(engine.gainParam.value, 0.05, '增益下限封底，坏标签不能把歌压成静音');
}

/**
 * 让微任务队列跑空，等待惰性标签补齐链路完成。
 * @returns {Promise<void>} 队列跑空的 Promise。
 */
async function flushMicrotasks() {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
}

/**
 * 验证应用增益会同时写入增益节点与全局状态，并在无歌曲时回到原始电平。
 * @returns {void}
 */
function testApplyForSongUpdatesNodeAndState() {
  const engine = createReplayGainEngine();
  engine.context.setSettings({ enabled: true, mode: 'track' });

  const applied = engine.context.applyForSong(
    { localReplayGain: { resolved: 1, trackGainDb: -6, trackPeak: 0.5 } },
    { immediate: true },
  );
  assert.equal(applied.source, 'track');
  assert.equal(toDb(engine.gainParam.value), -6);
  assert.equal(engine.context.state().source, 'track', '解析结果要落到全局状态供界面读取');

  engine.context.applyForSong(null, { immediate: true });
  assert.equal(engine.gainParam.value, 1, '换到无标签歌曲时不能残留上一首的增益');
  assert.equal(engine.context.state().source, 'none');
}

/**
 * 验证切歌时先按原始电平播放，标签补齐后再平滑重新应用并写回缓存。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testPrepareFillsMissingTagLater() {
  const engine = createReplayGainEngine();
  engine.context.setSettings({ enabled: true, mode: 'track' });
  engine.scanned.tags = { replayGain: { resolved: 1, trackGainDb: -8 } };

  const song = { type: 'local', name: 'x.flac', localFile: { name: 'x.flac' } };
  engine.context.prepare(song, 0);
  assert.equal(engine.gainParam.value, 1, '标签没解析出来前保持原始电平，不猜增益');
  assert.equal(engine.ramps.length, 0, '切歌时立即生效，不排斜坡');

  await engine.context.ensure(song);
  await flushMicrotasks();
  assert.equal(song.localReplayGain.trackGainDb, -8);
  assert.equal(toDb(engine.gainParam.value), -8, '标签补齐后应重新应用增益');
  assert.equal(engine.ramps.length, 1, '补齐后用斜坡过渡，避免播放中电平突跳');
  assert.equal(engine.cacheWrites.length, 1, '解析出的增益要写回缓存，避免每次播放重复扫描');
  assert.equal(engine.calls.extractCount, 1, '同一首歌只扫描一次');
  assert.ok(engine.calls.controlUpdates >= 1, '补齐后要刷新界面上的实际增益显示');
}

/**
 * 验证音频链路、存档键与界面入口都按设计接好，避免后续改动悄悄绕开均衡节点。
 * @returns {void}
 */
function testSourceWiring() {
  // 均衡增益挂在 analyser 之后、gainNode 之前：可视化仍取原始电平，音量与淡入淡出继续由 gainNode 独占。
  assert.match(appSource, /source\.connect\(analyser\);/);
  assert.match(appSource, /analyser\.connect\(replayGainNode\);/);
  assert.match(appSource, /replayGainNode\.connect\(gainNode\);/);
  assert.match(appSource, /gainNode\.connect\(audioCtx\.destination\);/);
  // 音频节点重建后要用已算好的增益补位，避免刚起播那一下漏掉均衡。
  assert.match(appSource, /setReplayGainNodeGain\(replayGainActive\.linear, true\);/);

  // 设置跟自动播放一样走独立存档键，不混进视觉预设 fx。
  assert.match(appSource, /var REPLAY_GAIN_STORE_KEY = 'mineradio-replay-gain-v1';/);
  assert.match(appSource, /PERSISTENT_UI_STATE_KEYS[\s\S]*?REPLAY_GAIN_STORE_KEY,/);
  assert.ok(!/fx\.replayGain/.test(appSource), '音量均衡设置不能写进视觉预设 fx');

  // 切歌与启动两条链路都要接上均衡。
  assert.match(appSource, /schedulePlaybackMetadataRefresh\(song\);\s*prepareReplayGainForSong\(song, token\);/);
  assert.match(appSource, /initAutoPlaybackControls\(\);\s*initReplayGainControls\(\);/);

  assert.match(indexSource, /id="fx-volume-fold"[\s\S]*?id="t-replayGain"[\s\S]*?id="t-replayGainClipGuard"/);
  assert.match(indexSource, /onclick="toggleReplayGainSetting\('enabled'\)"/);
  assert.match(indexSource, /data-replaygain-mode="track"[\s\S]*?data-replaygain-mode="album"/);
  assert.match(indexSource, /id="rg-preamp" type="range" min="-12" max="12"/);
  assert.match(indexSource, /id="replaygain-hint"/);
}

test('关闭音量均衡时保持原始电平', testDisabledKeepsOriginalLevel);
test('没有标签时保持原始电平', testMissingTagKeepsOriginalLevel);
test('整轨增益按 dB 转线性并叠加 Preamp', testTrackGainWithPreamp);
test('Preamp 夹在 ±12 dB 并按 0.1 dB 取整', testPreampClamping);
test('防削波按峰值封顶', testClipGuardCapsGain);
test('没有峰值标签时防削波不额外衰减', testClipGuardWithoutPeakDoesNotAttenuate);
test('整轨与整专辑增益互相回退', testAlbumTrackFallback);
test('设置存档损坏时回落默认值', testSavedSettingsFallBackToDefaults);
test('增益节点按短斜坡生效并夹在安全范围', testNodeGainRampAndClamp);
test('应用增益同时更新节点与全局状态', testApplyForSongUpdatesNodeAndState);
test('切歌后补齐标签会重新应用增益', testPrepareFillsMissingTagLater);
test('均衡节点、存档键与界面入口按设计接好', testSourceWiring);
