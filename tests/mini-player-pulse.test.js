'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');

/**
 * 读取主渲染器源码。
 * @returns {string} 完整 app.js 文本。
 */
function readRendererSource() {
  return fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
}

/**
 * 从主渲染器源码中提取一个真实函数定义。
 * @param {string} source 主渲染器源码。
 * @param {string} name 函数名。
 * @returns {string} 完整函数源码。
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
 * 构造隐藏播放态的迷你播放器脉冲分析环境。
 * @param {Array<Uint8Array>} frames 按顺序返回的频谱帧。
 * @param {Array<Uint8Array>=} beatFrames 可选的低平滑节拍频谱帧。
 * @returns {{context:object,run:Function}} 可重复驱动的分析环境。
 */
function createPulseHarness(frames, beatFrames) {
  const source = readRendererSource();
  const queue = frames.slice();
  const beatQueue = (beatFrames || []).slice();
  const hasBeatFrames = Array.isArray(beatFrames) && beatFrames.length > 0;
  const pushed = [];
  const frequencyData = new Uint8Array(96);
  const beatFrequencyData = new Uint8Array(1024);
  const context = {
    Math,
    Number,
    Uint8Array,
    isFinite,
    audioCtx: { state: 'running' },
    analyser: {
      /** @param {Uint8Array} target 供分析器填充的频谱数组。 @returns {void} 写入下一帧测试数据。 */
      getByteFrequencyData(target) {
        const frame = queue.shift() || frames[frames.length - 1];
        for (let index = 0; index < target.length; index += 1) target[index] = frame[index] || 0;
      },
    },
    beatAnalyser: hasBeatFrames ? {
      /** @param {Uint8Array} target 供节拍分析器填充的频谱数组。 @returns {void} 写入下一帧测试数据。 */
      getByteFrequencyData(target) {
        const frame = beatQueue.shift() || beatFrames[beatFrames.length - 1];
        for (let index = 0; index < target.length; index += 1) target[index] = frame[index] || 0;
      },
    } : null,
    frequencyData,
    beatFrequencyData,
    miniPlayerPulseSample: 0,
    miniPlayerPulseBaseline: 0,
    miniPlayerPulseTimer: 0,
    miniPlayerPulseTimerActive: () => true,
    pushMiniPlayerState: () => pushed.push(context.miniPlayerPulseSample),
    setTimeout: () => 1,
    clearTimeout: () => {},
    clampRange(value, min, max) { return Math.max(min, Math.min(max, value)); },
  };
  vm.runInNewContext(
    extractFunction(source, 'runMiniPlayerPulseTimer')
      + '\nthis.runPulse = function(){ runMiniPlayerPulseTimer(); return miniPlayerPulseSample; };',
    context,
  );
  return {
    context,
    run: context.runPulse,
    pushed,
  };
}

/**
 * 验证隐藏窗口会唤醒被挂起的 AudioContext，确保频谱采样不是永久零值。
 * @returns {void}
 */
function testSuspendedAudioContextIsResumedForMiniPlayerPulse() {
  let resumeCalls = 0;
  const context = {
    audioCtx: { state: 'suspended' },
    analyser: {
      /** @param {Uint8Array} target 供分析器填充的频谱数组。 @returns {void} 写入静态测试频谱。 */
      getByteFrequencyData(target) { target.fill(160); },
    },
    frequencyData: new Uint8Array(96),
    miniPlayerPulseSample: 0,
    miniPlayerPulseBaseline: 0,
    miniPlayerPulseTimer: 0,
    miniPlayerPulseTimerActive: () => true,
    resumeAudioAnalysis() {
      resumeCalls += 1;
      return Promise.resolve();
    },
    pushMiniPlayerState() {},
    setTimeout: () => 1,
    clearTimeout() {},
    clampRange(value, min, max) { return Math.max(min, Math.min(max, value)); },
    Math,
    Number,
    Uint8Array,
    isFinite,
  };
  const source = readRendererSource();
  vm.runInNewContext(
    extractFunction(source, 'runMiniPlayerPulseTimer')
      + '\nthis.runPulse = runMiniPlayerPulseTimer;',
    context,
  );
  context.runPulse();
  assert.equal(resumeCalls, 1);
}

/**
 * 验证高能量底噪不会把封面律动永久压在同一个满值，突发峰值必须产生可见峰谷。
 * @returns {void}
 */
function testMiniPlayerPulseKeepsBeatContrastAboveSteadyEnergy() {
  const steady = new Uint8Array(96).fill(200);
  const beat = new Uint8Array(96).fill(200);
  for (let index = 0; index < 10; index += 1) beat[index] = 255;
  const harness = createPulseHarness([
    ...Array.from({ length: 18 }, () => steady),
    beat,
  ]);

  let steadyPulse = 0;
  for (let index = 0; index < 18; index += 1) steadyPulse = harness.run();
  const beatPulse = harness.run();

  assert.ok(steadyPulse < 0.9, '稳态高能量不应直接饱和到 1');
  assert.ok(beatPulse - steadyPulse >= 0.08, `峰值帧应产生明显律动峰值 steady=${steadyPulse} beat=${beatPulse}`);
}

test('挂起的音频上下文必须进入迷你律动恢复路径', testSuspendedAudioContextIsResumedForMiniPlayerPulse);
test('迷你播放器律动保留稳态与峰值之间的对比', testMiniPlayerPulseKeepsBeatContrastAboveSteadyEnergy);

test('低平滑分析器无数据时回退到已接入输出链路的频谱', () => {
  const mainFrame = new Uint8Array(96).fill(180);
  const emptyBeatFrame = new Uint8Array(1024);
  const harness = createPulseHarness([mainFrame], [emptyBeatFrame]);

  harness.run();

  assert.ok(harness.context.miniPlayerPulseSample > 0, '主分析器有音频数据时不能被空的节拍分析器覆盖为零');
});

test('低平滑分析器有有效频谱时继续优先用于律动', () => {
  const mainFrame = new Uint8Array(96);
  const beatFrame = new Uint8Array(1024).fill(210);
  const harness = createPulseHarness([mainFrame], [beatFrame]);

  harness.run();

  assert.ok(harness.context.miniPlayerPulseSample > 0, '有效的节拍频谱必须进入迷你律动采样');
});

test('文档隐藏时即使窗口状态 IPC 尚未到达也会启动迷你律动采样', () => {
  const context = {
    window: { desktopWindow: { isDesktop: true } },
    document: { hidden: true },
    desktopRuntimeState: { minimized: false, visible: true },
    desktopShellSettings: { miniPlayer: true },
    audio: { src: 'blob:test', paused: false, ended: false },
  };
  vm.runInNewContext(
    extractFunction(readRendererSource(), 'miniPlayerPulseTimerActive')
      + '\nthis.isActive = miniPlayerPulseTimerActive;',
    context,
  );

  assert.equal(context.isActive(), true);
});
