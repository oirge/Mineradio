'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const APP_SOURCE = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
const INDEX_SOURCE = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const PRELOAD_SOURCE = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'preload.js'), 'utf8');
const MAIN_SOURCE = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'main.js'), 'utf8');

/**
 * 按源码边界切出一段真实实现。
 * @param {string} startMarker 起始标记。
 * @param {string} endMarker 结束标记。
 * @returns {string} 源码片段。
 */
function sliceSource(startMarker, endMarker) {
  const start = APP_SOURCE.indexOf(startMarker);
  assert.ok(start > 0, `missing start marker: ${startMarker}`);
  const end = APP_SOURCE.indexOf(endMarker, start);
  assert.ok(end > start, `missing end marker: ${endMarker}`);
  return APP_SOURCE.slice(start, end);
}

// 两个功能的完整实现块：从播放速度区块头到 clampRange 之外的第一段分节注释。
const RATE_SOURCE = sliceSource(
  '//  播放速度（倍速）',
  '//  睡眠定时'
);
const SLEEP_SOURCE = sliceSource(
  '//  睡眠定时',
  'function toggleVolumePanel(e) {'
);

/**
 * 造一个最小的假音频元素，记录 playbackRate 写入。
 * @returns {object} 元素桩。
 */
function createAudioStub() {
  return { playbackRate: 1 };
}

/**
 * 跑真实的倍速实现（含它依赖的 clampRange 与 normalize）。
 * @returns {{context:object, decks:object[], audio:object, toasts:string[]}} 沙箱与观测。
 */
function createRateSandbox() {
  const decks = [{ el: createAudioStub() }, { el: createAudioStub() }];
  const toasts = [];
  const store = Object.create(null);
  const localStorageStub = {
    getItem(key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
    setItem(key, value) { store[key] = String(value); },
    removeItem(key) { delete store[key]; },
  };
  const context = {
    console,
    JSON, Object, Array, String, Number, Math, Boolean, isFinite,
    audioDeckList: decks,
    audio: decks[0].el,
    localStorage: localStorageStub,
    setPersistentLocalStorageItem(key, value) { localStorageStub.setItem(key, value); },
    document: { querySelectorAll() { return []; }, getElementById() { return null; } },
    showToast(msg) { toasts.push(String(msg)); },
    updateSystemMediaSessionPosition() {},
    clampRange(v, min, max) { return Math.max(min, Math.min(max, v)); },
    PLAYBACK_RATE_STORE_KEY: 'mineradio-playback-rate-v1',
  };
  vm.runInNewContext(`${RATE_SOURCE}
this.normalizePlaybackRateValue = normalizePlaybackRateValue;
this.readSavedPlaybackRate = readSavedPlaybackRate;
this.formatPlaybackRateLabel = formatPlaybackRateLabel;
this.applyPlaybackRateToDecks = applyPlaybackRateToDecks;
this.setPlaybackRate = setPlaybackRate;`, context);
  return { context, store, decks, audio: decks[0].el, toasts };
}

test('倍速归一化只认档位，脏值回落 1.0', () => {
  const h = createRateSandbox();
  assert.equal(h.context.normalizePlaybackRateValue(1.5), 1.5);
  assert.equal(h.context.normalizePlaybackRateValue('2'), 2);
  assert.equal(h.context.normalizePlaybackRateValue('1.25'), 1.25);
  assert.equal(h.context.normalizePlaybackRateValue('abc'), 1);
  assert.equal(h.context.normalizePlaybackRateValue(null), 1);
  assert.equal(h.context.normalizePlaybackRateValue(99), 2, '超出上限夹到 2.0');
  assert.equal(h.context.normalizePlaybackRateValue(0.01), 0.5, '低于下限夹到 0.5');
});

test('设速度写进两个 deck 的元素，双 deck 不会一个快一个慢', () => {
  const h = createRateSandbox();
  h.context.setPlaybackRate(1.5, { toast: false });
  assert.equal(h.decks[0].el.playbackRate, 1.5);
  assert.equal(h.decks[1].el.playbackRate, 1.5, '闲置 deck 也要写，交叉接管时才不会回到 1×');
  h.context.setPlaybackRate(0.75, { toast: false });
  assert.equal(h.decks[0].el.playbackRate, 0.75);
  assert.equal(h.decks[1].el.playbackRate, 0.75);
});

test('倍速落盘到独立键，重启可读回', () => {
  const h = createRateSandbox();
  h.context.setPlaybackRate(2, { toast: false });
  assert.equal(h.store['mineradio-playback-rate-v1'], JSON.stringify({ rate: 2 }));
  assert.equal(h.context.readSavedPlaybackRate(), 2);
});

test('倍速展示文本：整数不带小数点，半档保留', () => {
  const h = createRateSandbox();
  assert.equal(h.context.formatPlaybackRateLabel(1), '1×');
  assert.equal(h.context.formatPlaybackRateLabel(1.5), '1.5×');
  assert.equal(h.context.formatPlaybackRateLabel(0.75), '0.75×');
  assert.equal(h.context.formatPlaybackRateLabel(2), '2×');
});

test('睡眠定时模式归一化：off / track / 15 / 30 / 60', () => {
  const h = createSleepSandbox();
  assert.equal(h.context.normalizeSleepTimerMode('off'), 'off');
  assert.equal(h.context.normalizeSleepTimerMode('track'), 'track');
  assert.equal(h.context.normalizeSleepTimerMode('15'), '15');
  assert.equal(h.context.normalizeSleepTimerMode(30), '30');
  assert.equal(h.context.normalizeSleepTimerMode('60'), '60');
  assert.equal(h.context.normalizeSleepTimerMode('7'), 'off', '非档位回落关闭');
  assert.equal(h.context.normalizeSleepTimerMode(''), 'off');
});

test('睡眠定时分钟档排一个定时器，到点淡出暂停并清回关闭', async () => {
  const h = createSleepSandbox();
  h.context.setSleepTimerMode('15', { toast: false });
  assert.equal(h.timers.size(), 1, '分钟档应排一个 setTimeout');
  const stored = JSON.parse(h.store['mineradio-sleep-timer-v1']);
  assert.equal(stored.mode, '15');
  // 触发到点：应调用淡出暂停，并把模式清回 off。
  h.timers.fire();
  for (let i = 0; i < 6; i += 1) await Promise.resolve();
  assert.equal(h.calls.fades, 1, '到点要走 fadeOutAndPauseAudio');
  assert.equal(h.context.sleepTimerState.mode, 'off');
  assert.equal(JSON.parse(h.store['mineradio-sleep-timer-v1']).mode, 'off');
});

test('播完本曲模式不排定时器，曲终时结算并返回 true', () => {
  const h = createSleepSandbox();
  h.context.setSleepTimerMode('track', { toast: false });
  assert.equal(h.timers.size(), 0, '播完本曲模式不排墙钟定时器');
  assert.equal(h.context.settleSleepTimerOnTrackEnded(), true);
  assert.equal(h.context.sleepTimerState.mode, 'off');
  // 已经结算过，再问一次应为 false，避免重复停。
  assert.equal(h.context.settleSleepTimerOnTrackEnded(), false);
});

test('关闭睡眠定时会清掉在跑的定时器', () => {
  const h = createSleepSandbox();
  h.context.setSleepTimerMode('30', { toast: false });
  assert.equal(h.timers.size(), 1);
  h.context.setSleepTimerMode('off', { toast: false });
  assert.equal(h.timers.size(), 0, '关闭要清掉倒计时');
  assert.equal(h.context.sleepTimerState.dueAt, 0);
});

/**
 * 跑真实的睡眠定时实现。
 * @returns {object} 沙箱与观测。
 */
function createSleepSandbox() {
  const toasts = [];
  const calls = { fades: 0 };
  const store = Object.create(null);
  const localStorageStub = {
    getItem(key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
    setItem(key, value) { store[key] = String(value); },
    removeItem(key) { delete store[key]; },
  };
  const timers = (function createTimerStore() {
    const map = new Map();
    let seq = 0;
    return {
      setTimeout(fn, ms) { const id = ++seq; map.set(id, { fn, ms: Number(ms) || 0 }); return id; },
      clearTimeout(id) { map.delete(id); },
      size() { return map.size; },
      fire() { for (const [id, t] of Array.from(map)) { map.delete(id); t.fn(); } },
    };
  })();
  const context = {
    console,
    JSON, Object, Array, String, Number, Math, Boolean, Date, isFinite,
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    sleepTimerState: { mode: 'off', dueAt: 0, timer: null, fading: false },
    localStorage: localStorageStub,
    setPersistentLocalStorageItem(key, value) { localStorageStub.setItem(key, value); },
    document: { querySelectorAll() { return []; }, getElementById() { return null; } },
    showToast(msg) { toasts.push(String(msg)); },
    fadeOutAndPauseAudio() { calls.fades += 1; return Promise.resolve(true); },
    clampRange(v, min, max) { return Math.max(min, Math.min(max, v)); },
    SLEEP_TIMER_STORE_KEY: 'mineradio-sleep-timer-v1',
    SLEEP_TIMER_MINUTE_OPTIONS: [15, 30, 60],
  };
  vm.runInNewContext(`${SLEEP_SOURCE}
this.normalizeSleepTimerMode = normalizeSleepTimerMode;
this.readSavedSleepTimerMode = readSavedSleepTimerMode;
this.armSleepTimer = armSleepTimer;
this.setSleepTimerMode = setSleepTimerMode;
this.cancelSleepTimer = cancelSleepTimer;
this.settleSleepTimerOnTrackEnded = settleSleepTimerOnTrackEnded;
this.fireSleepTimer = fireSleepTimer;`, context);
  return { context, timers, calls, toasts, store };
}

test('设置面板有两个折叠区、分段档位与提示位', () => {
  assert.match(INDEX_SOURCE, /id="fx-playbackrate-fold"[\s\S]*?data-playback-rate="2"/);
  assert.match(INDEX_SOURCE, /id="fx-sleep-fold"[\s\S]*?data-sleep-mode="track"/);
  assert.match(INDEX_SOURCE, /id="playback-rate-hint"/);
  assert.match(INDEX_SOURCE, /id="sleep-timer-hint"/);
});

test('两个功能都归到高级页并在强制展开清单里', () => {
  assert.match(APP_SOURCE, /id === 'fx-playbackrate-fold' \|\| id === 'fx-sleep-fold'/);
  assert.match(APP_SOURCE, /'fx-gapless-fold','fx-playbackrate-fold','fx-sleep-fold','fx-volume-fold'/);
});

test('两个功能的初始化接在曲库恢复之后，不打断既有启动链', () => {
  assert.match(APP_SOURCE, /if \(LOCAL_ONLY_MODE\) scheduleSavedLocalMusicFolderRestore\(700\);\s*initPlaybackRateControls\(\);\s*initSleepTimerControls\(\);/);
});

test('倍速在切歌装载后补写，且记忆在独立键里', () => {
  assert.match(APP_SOURCE, /if \(typeof applyPlaybackRateToDecks === 'function'\) applyPlaybackRateToDecks\(\);/);
  assert.match(APP_SOURCE, /var PLAYBACK_RATE_STORE_KEY = 'mineradio-playback-rate-v1';/);
  assert.match(APP_SOURCE, /PERSISTENT_UI_STATE_KEYS[\s\S]*?PLAYBACK_RATE_STORE_KEY,/);
  assert.match(APP_SOURCE, /PERSISTENT_UI_STATE_KEYS[\s\S]*?SLEEP_TIMER_STORE_KEY,/);
  assert.ok(PRELOAD_SOURCE.includes("'mineradio-playback-rate-v1'"), 'preload 要镜像倍速键');
  assert.ok(PRELOAD_SOURCE.includes("'mineradio-sleep-timer-v1'"), 'preload 要镜像睡眠键');
  assert.ok(MAIN_SOURCE.includes("'mineradio-playback-rate-v1'"), '主进程要镜像倍速键');
  assert.ok(MAIN_SOURCE.includes("'mineradio-sleep-timer-v1'"), '主进程要镜像睡眠键');
  // 两个设置都不许被当成视觉预设参数。
  assert.ok(!/fx\.playbackRate/.test(APP_SOURCE), '倍速不能写进视觉预设 fx');
  assert.ok(!/fx\.sleepTimer/.test(APP_SOURCE), '睡眠定时不能写进视觉预设 fx');
});

test('"播完本曲"睡眠定时挂在 onended，优先于续播', () => {
  assert.match(APP_SOURCE, /if \(typeof settleSleepTimerOnTrackEnded === 'function' && settleSleepTimerOnTrackEnded\(\)\) \{\s*stopPlaybackAfterCurrentTrack\(\);/);
});

test('主界面音量弹层内嵌倍速、睡眠快捷项与无缝/均衡开关', () => {
  // 音量弹层里直接有速度 / 睡眠两组分段与两个开关。
  assert.match(INDEX_SOURCE, /id="volume-control"[\s\S]*?id="volume-slider"[\s\S]*?id="main-rate-seg"[\s\S]*?data-main-rate="2"/);
  assert.match(INDEX_SOURCE, /id="main-sleep-seg"[\s\S]*?data-main-sleep="track"/);
  assert.match(INDEX_SOURCE, /id="main-gapless-btn"[\s\S]*?onclick="toggleGaplessSetting\(\)"/);
  assert.match(INDEX_SOURCE, /id="main-replaygain-btn"[\s\S]*?toggleReplayGainSetting\('enabled'\)/);
  // 画质不放在主界面弹层里，仍只在 DIY 高级面板的 #performance-quality-seg。
  assert.ok(!/main-quality-seg/.test(INDEX_SOURCE), '画质不应出现在音量弹层');
  assert.ok(!/data-main-quality/.test(INDEX_SOURCE), '画质快捷按钮应已移除');
  assert.match(INDEX_SOURCE, /id="performance-quality-seg"/);
});

test('主界面快捷控件改的是唯一设置状态，并与设置面板互相回填', () => {
  assert.match(APP_SOURCE, /function updateMainQuickControls\(\) \{/);
  assert.match(APP_SOURCE, /function bindMainQuickControls\(\) \{/);
  // 点击委托：速度走 setPlaybackRate、睡眠走 setSleepTimerMode。
  assert.match(APP_SOURCE, /if \(rateBtn\) \{ setPlaybackRate\(rateBtn\.getAttribute\('data-main-rate'\)\); return; \}/);
  assert.match(APP_SOURCE, /if \(sleepBtn\) \{ setSleepTimerMode\(sleepBtn\.getAttribute\('data-main-sleep'\)\); return; \}/);
  // 画质已从主界面移除，不应再有对应的委托分支。
  assert.ok(!/data-main-quality/.test(APP_SOURCE), '主界面不应残留画质快速项逻辑');
  // 各设置的回填函数都要顺带刷新主界面快捷项，否则两边会不同步。
  assert.match(APP_SOURCE, /hint\.textContent = gaplessHintText\(\);\s*if \(typeof updateMainQuickControls === 'function'\) updateMainQuickControls\(\);/);
  assert.match(APP_SOURCE, /if \(typeof updateMainQuickControls === 'function'\) updateMainQuickControls\(\);\s*\}\s*\/\*\*\s*\n \* 落盘音量均衡设置/);
  // 启动时绑定一次。
  assert.match(APP_SOURCE, /initPlaybackRateControls\(\);\s*initSleepTimerControls\(\);\s*bindMainQuickControls\(\);/);
});

