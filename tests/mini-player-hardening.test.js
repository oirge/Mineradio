'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { MiniPlayerStateCache, normalizeMiniPlayerThemeVars } = require('../desktop/mini-player-state-cache');

const root = path.join(__dirname, '..');

/**
 * 读取迷你播放器相关源码，供白盒回归测试复用真实实现。
 * @param {string} relativePath 相对仓库根目录的路径。
 * @returns {string} 文件源码。
 */
function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

/**
 * 从源码中截取一个完整的函数定义。
 * @param {string} source 源码文本。
 * @param {string} name 函数名。
 * @returns {string} 函数源码。
 */
function extractFunction(source, name) {
  const start = source.indexOf('function ' + name + '(');
  assert.ok(start >= 0, '未找到函数：' + name);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error('函数未闭合：' + name);
}

/**
 * 验证极简模式和两种效果均无效时不会启动隐藏频谱采样。
 * @returns {void}
 */
function testCompactMiniPulseGate() {
  const source = read('public/app.js');
  const gate = extractFunction(source, 'miniPlayerPulsePipelineActive');
  const context = {
    desktopShellSettings: { miniPlayerMode: 'compact' },
    fx: {
      miniPlayerPulseEnabled: true,
      miniPlayerPulseStrength: 1,
      miniPlayerGlowEnabled: true,
      miniPlayerGlowStrength: 1,
    },
  };
  vm.runInNewContext(gate + '\nthis.active = miniPlayerPulsePipelineActive;', context);
  assert.equal(context.active(), false);

  context.desktopShellSettings.miniPlayerMode = 'standard';
  context.fx.miniPlayerPulseEnabled = false;
  context.fx.miniPlayerGlowEnabled = false;
  assert.equal(context.active(), false);

  context.fx.miniPlayerGlowEnabled = true;
  context.fx.miniPlayerGlowStrength = 0;
  assert.equal(context.active(), false);

  context.fx.miniPlayerGlowStrength = 0.25;
  assert.equal(context.active(), true);
}

/**
 * 验证过期的定时器回调也不能在效果关闭时读取分析器或发送脉冲状态。
 * @returns {void}
 */
function testDisabledMiniPulseTimerDoesNotSampleOrPush() {
  const source = read('public/app.js');
  const gate = extractFunction(source, 'miniPlayerPulsePipelineActive');
  const timer = extractFunction(source, 'runMiniPlayerPulseTimer');
  let analyserCalls = 0;
  let pushCalls = 0;
  let timeoutCalls = 0;
  const context = {
    desktopShellSettings: { miniPlayerMode: 'standard' },
    fx: {
      miniPlayerPulseEnabled: false,
      miniPlayerPulseStrength: 0,
      miniPlayerGlowEnabled: false,
      miniPlayerGlowStrength: 0,
    },
    miniPlayerPulseTimer: 99,
    miniPlayerPulseSample: 0.8,
    miniPlayerPulseBaseline: 0.7,
    miniPlayerPulseTimerActive: () => true,
    miniPlayerPulsePipelineActive: undefined,
    analyser: { getByteFrequencyData() { analyserCalls += 1; } },
    frequencyData: new Uint8Array(96),
    audioCtx: { state: 'running' },
    pushMiniPlayerState() { pushCalls += 1; },
    setTimeout() { timeoutCalls += 1; return 1; },
    clearTimeout() {},
    Math,
    Number,
    Uint8Array,
    isFinite,
    clampRange(value, min, max) { return Math.max(min, Math.min(max, value)); },
  };
  vm.runInNewContext(gate + '\n' + timer + '\nthis.run = runMiniPlayerPulseTimer;', context);
  context.run();
  assert.equal(analyserCalls, 0);
  assert.equal(pushCalls, 0);
  assert.equal(timeoutCalls, 0);
  assert.equal(context.miniPlayerPulseSample, 0, '失效管线应立即丢掉旧采样，避免恢复时闪回旧律动');
}

/**
 * 验证极简模式的 renderer 补丁不包含完整封面或脉冲字段。
 * @returns {Promise<void>}
 */
async function testCompactPushOmitsCoverAndPulse() {
  const source = read('public/app.js');
  const push = extractFunction(source, 'pushMiniPlayerState');
  const calls = [];
  const context = {
    window: {
      desktopWindow: {
        isDesktop: true,
        updateMiniPlayer(patch) {
          calls.push(patch);
          return Promise.resolve({ ok: true });
        },
      },
      MineradioPlugins: { themeVars() { return {}; } },
    },
    desktopShellSettings: { miniPlayer: true, miniPlayerMode: 'compact' },
    desktopSongMetaCache: {},
    playQueue: [{ name: '测试歌曲', artist: '测试歌手', cover: 'data:image/png;base64,' + 'A'.repeat(1024) }],
    currentIdx: 0,
    audio: { src: 'blob:test', paused: false, ended: false },
    playing: true,
    fx: { desktopLyrics: false, miniPlayerPulseEnabled: true, miniPlayerPulseStrength: 1, miniPlayerGlowEnabled: true, miniPlayerGlowStrength: 1, miniPlayerHoverExpand: true, miniPlayerRadius: 12 },
    fxDefaults: { miniPlayerPulseStrength: 1, miniPlayerGlowStrength: 1, miniPlayerRadius: 12 },
    MINI_PLAYER_EFFECT_STRENGTH_MAX: 3,
    performance: { now() { return 1000; } },
    getDesktopWindowApi() { return context.window.desktopWindow; },
    currentDesktopSongMeta() {
      return { title: '测试歌曲', artist: '测试歌手', cover: 'data:image/png;base64,' + 'A'.repeat(1024), _signature: 'cover-signature' };
    },
    miniPlayerSongMetaWithoutCover() {
      return { title: '测试歌曲', artist: '测试歌手', cover: '', _signature: '测试歌曲|测试歌手' };
    },
    miniPlayerThemePayload() { return { vars: {}, signature: '' }; },
    miniPlayerVisualPayload() { return { pulseEnabled: true, pulseStrength: 1, glowEnabled: true, glowStrength: 1, hoverExpand: true, radius: 12 }; },
    miniPlayerPulseValue() { return 0.75; },
    miniPlayerPulsePipelineActive() { return false; },
    normalizeDesktopMiniPlayerMode(value) { return value === 'compact' ? 'compact' : 'standard'; },
    isDevelopmentLockedFx() { return false; },
    invalidateMiniPlayerSyncPatch() {},
    JSON,
    Math,
    Number,
    Object,
    String,
    Promise,
    clampRange(value, min, max) { return Math.max(min, Math.min(max, value)); },
    miniPlayerSyncState: null,
    miniPlayerPulseLastAt: 0,
    stopMiniPlayerPulseTimer() {},
  };
  vm.runInNewContext(push + '\nthis.push = pushMiniPlayerState;', context);
  context.push(true);
  await Promise.resolve();
  assert.equal(calls.length, 1);
  assert.equal(Object.prototype.hasOwnProperty.call(calls[0], 'cover'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(calls[0], 'pulse'), false);
  assert.equal(calls[0].miniPlayerMode, 'compact');
}

test('极简模式或两种迷你效果均关闭时禁止脉冲采样', testCompactMiniPulseGate);
test('效果关闭后的迟到脉冲定时器不读取分析器也不发 IPC', testDisabledMiniPulseTimerDoesNotSampleOrPush);
test('极简模式状态补丁不上传完整封面和脉冲值', testCompactPushOmitsCoverAndPulse);

test('极简模式补丁会清掉缓存中的旧封面，并阻止迟到封面重新驻留', () => {
  const cache = new MiniPlayerStateCache(true);
  cache.setResident(true);
  assert.equal(cache.apply({ miniPlayerMode: 'standard', cover: 'old-cover', hasTrack: true }), true);
  assert.equal(cache.value.cover, 'old-cover');

  assert.equal(cache.apply({ miniPlayerMode: 'compact', cover: 'late-cover', hasTrack: true }), true);
  assert.equal(cache.value.cover, '');
  assert.equal(cache.apply({ cover: 'stale-cover' }), true);
  assert.equal(cache.value.cover, '', '模式已是极简时，迟到补丁不能重新写入封面');

  assert.equal(cache.apply({ miniPlayerMode: 'standard', cover: 'fresh-cover' }), true);
  assert.equal(cache.value.cover, 'fresh-cover');
});

test('大主题变量缓存优先保留全部合法 --th-mini-* 变量', () => {
  const source = {};
  for (let index = 0; index < 100; index += 1) source['--th-ordinary-' + index] = 'red';
  const miniNames = [];
  for (let index = 0; index < 20; index += 1) {
    const name = '--th-mini-custom-' + index;
    miniNames.push(name);
    source[name] = 'blue';
  }
  const result = normalizeMiniPlayerThemeVars(source);
  assert.equal(miniNames.every((name) => Object.prototype.hasOwnProperty.call(result, name)), true);
  assert.equal(Object.keys(result).length, 84, '64 个普通变量之外还应保留 20 个迷你变量');
});

test('主界面订阅桌面壳设置变化时只接受 ok=true 且不弹提示', () => {
  const source = read('public/app.js');
  assert.match(source, /onDesktopShellSettingsChanged/);
  assert.match(source, /payload && payload\.ok === true[\s\S]{0,180}applyDesktopShellSettings\(payload\)/);
  const handlerBlock = source.slice(source.indexOf('onDesktopShellSettingsChanged'), source.indexOf('onDesktopLyricsEnabledState', source.indexOf('onDesktopShellSettingsChanged')));
  assert.doesNotMatch(handlerBlock, /showToast\(/);
});

/**
 * 构造一个只控制回包时序的插件运行时，用来复现脚本主题迟到覆盖。
 * @returns {{plugins: object, requests: Array, callbacks: Array, styleNodes: Array}} 测试句柄。
 */
function createThemeRaceHarness() {
  const manifestSource = read('public/plugin-manifest.js');
  const runtimeSource = read('public/plugin-runtime.js');
  const requests = [];
  const callbacks = [];
  const styleNodes = [];
  const storage = new Map();
  function ControlledWorker() {
    this.onmessage = null;
    this.onerror = null;
    this.terminate = () => {};
  }
  ControlledWorker.prototype.postMessage = function postMessage(message) {
    if (message.type === 'plugin-boot') {
      this.onmessage({ data: { type: 'plugin-ready', hooks: ['theme'] } });
      return;
    }
    if (message.type === 'plugin-invoke') requests.push({ worker: this, message });
  };
  const context = vm.createContext({
    console: { log() {}, warn() {}, error() {} },
    Promise,
    JSON,
    Object,
    Array,
    Number,
    String,
    Date,
    Math,
    setTimeout,
    clearTimeout,
    Worker: ControlledWorker,
    document: {
      head: { appendChild(node) { styleNodes.push(node); } },
      createElement() { return { id: '', textContent: '' }; },
      getElementById(id) { return styleNodes.find((node) => node.id === id) || null; },
    },
    localStorage: {
      getItem(key) { return storage.has(key) ? storage.get(key) : null; },
      setItem(key, value) { storage.set(key, String(value)); },
      removeItem(key) { storage.delete(key); },
    },
  });
  vm.runInContext(manifestSource, context, { filename: 'plugin-manifest.js' });
  vm.runInContext(runtimeSource, context, { filename: 'plugin-runtime.js' });
  context.MineradioPlugins.init({ themeApplied(vars) { callbacks.push(Object.assign({}, vars)); } });
  return { plugins: context.MineradioPlugins, requests, callbacks, styleNodes };
}

/**
 * 等待受控 worker 收到指定数量的主题调用。
 * @param {Array} requests 受控调用数组。
 * @param {number} count 目标数量。
 * @returns {Promise<void>} 数量达到后的异步结果。
 */
async function waitForThemeRequests(requests, count) {
  for (let attempt = 0; attempt < 20 && requests.length < count; attempt += 1) await Promise.resolve();
  assert.ok(requests.length >= count, '主题调用未达到预期数量');
}

test('脚本主题新一轮完成后，旧一轮迟到回包不能覆盖最终变量', async () => {
  const harness = createThemeRaceHarness();
  const script = [
    '/**',
    ' * @id race.theme',
    ' * @name 竞态主题',
    ' * @kind theme',
    ' * @version 1.0.0',
    ' */',
    'mineradio.on("theme", function(){ return { vars: { "--th-panel-bg": "old" } }; });',
  ].join('\n');
  assert.equal(harness.plugins.install('race.js', script).ok, true);
  await waitForThemeRequests(harness.requests, 1);
  const newer = harness.plugins.applyThemes();
  await waitForThemeRequests(harness.requests, 2);

  const newerRequest = harness.requests[1];
  newerRequest.worker.onmessage({ data: {
    type: 'plugin-result',
    callId: newerRequest.message.callId,
    ok: true,
    value: { vars: { '--th-panel-bg': 'new' } },
  } });
  await newer;

  const oldRequest = harness.requests[0];
  oldRequest.worker.onmessage({ data: {
    type: 'plugin-result',
    callId: oldRequest.message.callId,
    ok: true,
    value: { vars: { '--th-panel-bg': 'old' } },
  } });
  await Promise.resolve();

  assert.equal(Object.assign({}, harness.plugins.themeVars())['--th-panel-bg'], 'new');
  assert.match(harness.styleNodes[0].textContent, /--th-panel-bg:new/);
  assert.equal(harness.callbacks[harness.callbacks.length - 1]['--th-panel-bg'], 'new');
  assert.equal(harness.callbacks.some((vars) => vars['--th-panel-bg'] === 'old'), false, '旧代不能触发最终同步回调');
});
