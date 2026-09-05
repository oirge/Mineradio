'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

function readSourceBlock(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `未找到源码块: ${startMarker}`);
  return source.slice(start, end);
}

const app = readProjectFile('public/app.js');

/**
 * 用真实的音域回响源码建一个可控沙箱: 假 THREE 只统计纹理上传次数,
 * 频谱数组由测试直接喂, 于是可以断言历史行是否真的逐圈外移。
 * @returns {object}
 */
function createEchoHarness() {
  const uploads = { count: 0 };
  const frequencyData = new Uint8Array(1024);
  const context = {
    Math,
    frequencyData,
    AUDIO_FREQUENCY_SCALE: 1 / 255,
    clamp01: (v) => Math.max(0, Math.min(1, v)),
    fx: { preset: 7 },
    THREE: {
      LinearFilter: 'linear',
      ClampToEdgeWrapping: 'clamp',
      RGBAFormat: 'rgba',
      DataTexture: function (data, width, height, format) {
        this.image = { data: data, width: width, height: height };
        this.format = format;
        Object.defineProperty(this, 'needsUpdate', {
          set: () => { uploads.count += 1; },
          get: () => false,
        });
      },
    },
  };
  vm.runInNewContext(
    `${readSourceBlock(app, 'var SPECTRUM_ECHO_PRESET_INDEX = 7;', '// 封面纹理 + 边缘/深度纹理')}
    this.push = updateSpectrumEchoField;
    this.reset = resetSpectrumEchoField;
    this.bins = ensureSpectrumEchoBins;
    this.binStarts = spectrumEchoBinStarts;
    this.data = spectrumEchoData;
    this.bands = SPECTRUM_ECHO_BANDS;
    this.history = SPECTRUM_ECHO_HISTORY;
    this.interval = SPECTRUM_ECHO_PUSH_INTERVAL;`,
    context,
  );
  return { context, uploads, frequencyData, rowBytes: context.bands * 4 };
}

/**
 * 读某一行某一频段的通道值。
 * @returns {number}
 */
function sample(h, row, band, channel) {
  return h.context.data[row * h.rowBytes + band * 4 + channel];
}

test('音域回响登记为第 8 个视觉预设，并在预设面板里排到前面', () => {
  const meta = readSourceBlock(app, 'var presetMeta = [', 'var lyricColorPresets');
  const names = meta.match(/name: '([^']+)'/g).map((s) => s.slice(7, -1));
  assert.deepEqual(names, ['emily专辑封面', '滚筒', '星球', '虚空', '唱片', '星河', '安魂', '音域回响']);
  const icons = readSourceBlock(meta, 'var presetIcons = [', 'var presetDisplayOrder');
  assert.equal((icons.match(/<svg /g) || []).length, names.length, '每个预设都要有自己的图标');
  assert.match(meta, /\{ name: '音域回响', desc: '频谱回响 · 致敬 CmzYa' \}/);
  assert.match(meta, /var presetDisplayOrder = \[0, 7, 6, 5, 4, 2, 1, 3\]/);
  assert.match(app, /var SPECTRUM_ECHO_PRESET_INDEX = 7;/);
});

test('对数分桶单调递增、每段至少一个 bin，并一路铺到高频', () => {
  const h = createEchoHarness();
  h.context.bins(1024);
  const starts = h.context.binStarts;
  assert.equal(starts[0], 2, '跳过直流和最低两个 bin');
  for (let b = 1; b <= h.context.bands; b++) {
    assert.ok(starts[b] > starts[b - 1], `第 ${b} 段边界必须严格递增`);
  }
  assert.ok(starts[h.context.bands] >= 560, '最高段要覆盖到约 12kHz');
  assert.ok(starts[h.context.bands] <= 1024);
  // 低频段窄、高频段宽: 音域分辨率跟着人耳走。
  assert.ok(starts[8] - starts[0] < starts[h.context.bands] - starts[h.context.bands - 8]);
});

test('频谱写进第 0 行后逐圈外移，形成真正的回响历史', () => {
  const h = createEchoHarness();
  h.frequencyData.fill(0);
  // 只在第 10 段所在的 bin 区间给一个尖峰。
  h.context.bins(h.frequencyData.length);
  const from = h.context.binStarts[10];
  const to = h.context.binStarts[11];
  for (let i = from; i < to; i++) h.frequencyData[i] = 255;

  h.context.push(true, 0.05, 0, 0.4);
  const spike = sample(h, 0, 10, 0);
  assert.ok(spike > 200, '当下这一行应记录到尖峰');
  assert.equal(sample(h, 0, 40, 0), 0, '没能量的频段保持为 0');

  // 之后不再有输入: 尖峰必须往外圈走, 而不是留在原地。
  h.frequencyData.fill(0);
  for (let step = 1; step <= 5; step++) {
    h.context.push(true, 0.05, 0, 0);
    assert.equal(sample(h, step, 10, 0), spike, `第 ${step} 次推进后尖峰应位于第 ${step} 行`);
    assert.equal(sample(h, 0, 10, 0), 0, '最新一行反映的是当下的静音');
  }
  assert.ok(sample(h, 5, 10, 1) > 0, '包络通道保留余韵');
});

test('推进节奏与帧率解耦，掉帧时最多补一行不做追赶', () => {
  const h = createEchoHarness();
  h.uploads.count = 0;
  for (let i = 0; i < 120; i++) h.context.push(true, 1 / 60, 0, 0);
  assert.ok(h.uploads.count >= 92 && h.uploads.count <= 100, `60fps 两秒应推进约 96 行, 实际 ${h.uploads.count}`);

  const slow = createEchoHarness();
  slow.uploads.count = 0;
  for (let i = 0; i < 30; i++) slow.context.push(true, 0.5, 0, 0);
  assert.equal(slow.uploads.count, 30, '半秒一帧也只补一行, 否则回响会突然抽一下');
});

test('其他预设完全不付代价，切换时历史被清空', () => {
  const h = createEchoHarness();
  h.frequencyData.fill(255);
  h.context.fx.preset = 0;
  h.uploads.count = 0;
  for (let i = 0; i < 60; i++) h.context.push(true, 0.05, 1, 1);
  assert.equal(h.uploads.count, 0, '非音域回响预设一次纹理都不该上传');
  assert.ok(h.context.data.every((v) => v === 0));

  h.context.fx.preset = 7;
  h.context.push(true, 0.05, 1, 1);
  assert.ok(sample(h, 0, 10, 0) > 0);
  h.context.reset();
  assert.ok(h.context.data.every((v) => v === 0), 'reset 后历史必须干净');

  assert.match(
    app,
    /if \(changed && \(p === SPECTRUM_ECHO_PRESET_INDEX \|\| prev === SPECTRUM_ECHO_PRESET_INDEX\)\) resetSpectrumEchoField\(\);/,
  );
});

test('暂停后回响向外排空而不是冻结在最后一帧', () => {
  const h = createEchoHarness();
  h.frequencyData.fill(220);
  // 先把整张历史铺满, 模拟一直在放歌。
  for (let i = 0; i < h.context.history + 6; i++) h.context.push(true, 0.05, 0.5, 0.6);
  assert.ok(sample(h, 0, 20, 0) > 0);
  assert.ok(sample(h, h.context.history - 1, 20, 0) > 0, '最外圈也应有回响');

  // 停播: 不再取样, 但历史仍要推进, 让旧回响一路走到外圈消失。
  const total = () => h.context.data.reduce((a, v) => a + v, 0);
  let prev = total();
  for (let step = 1; step <= h.context.history * 3; step++) {
    h.context.push(false, 0.05, 0, 0);
    const now = total();
    assert.ok(now < prev || now === 0, `第 ${step} 次推进后回响没有继续衰减`);
    if (step === h.context.history) {
      assert.ok(h.context.data.every((v, i) => i % 4 !== 0 || v === 0), '一圈之后幅度通道已完全走出画面');
      assert.ok(h.context.data.some((v) => v > 0), '包络余韵最后退场, 不是硬切');
    }
    prev = now;
  }
  assert.equal(prev, 0, '排空后整张历史应归零');
});

test('着色器为预设 7 单独分支，星河/安魂被收进 uPreset<6.5', () => {
  const vs = readSourceBlock(app, 'var vs = `', '// ----- 片元 Shader -----');
  assert.match(vs, /else if \(uPreset < 6\.5\) \{/);
  assert.match(vs, /Preset 7: SPECTRUM ECHO/);
  assert.match(vs, /uniform sampler2D uCoverTex, uPrevCoverTex, uEdgeTex, uRippleTex, uSpectrumTex;/);
  // 半径采样历史纹理 = 音域沿半径回响, 这是这个预设的立身之本。
  assert.match(vs, /texture2D\(uSpectrumTex, vec2\(clamp\(bandN, 0\.004, 0\.996\), clamp\(age \+ rowJitter, 0\.0, 1\.0\)\)\)/);
  assert.match(vs, /float age = lane \/ 0\.86;/);
  // 亮度与点径的 6.5 分支必须排在 4.5 之前, 否则会被星河那一支吃掉。
  const bright = readSourceBlock(vs, 'vBright = 0.82 + maxRippleAmp', 'vRipple = clamp(');
  assert.ok(bright.indexOf('uPreset > 6.5') < bright.indexOf('uPreset > 4.5'));
  const size = readSourceBlock(vs, 'float sz = clamp(depthSize * audioBoost', 'gl_PointSize = sz');
  assert.ok(size.indexOf('uPreset > 6.5') < size.indexOf('uPreset > 4.5'));
  // 唱片专属的高分辨率抑制不能溢到预设 7。
  assert.match(vs, /float vinylHiResGuard = smoothstep\(1\.08, 1\.55, uCoverRes\) \* step\(3\.5, uPreset\) \* \(1\.0 - step\(4\.5, uPreset\)\);/);
  assert.equal(uniformDeclared(app, 'uSpectrumTex'), true);
});

/**
 * 确认 uniform 表里真的挂上了这张纹理, 否则着色器拿到的是默认 0 号纹理单元。
 * @returns {boolean}
 */
function uniformDeclared(source, name) {
  const block = readSourceBlock(source, 'var uniforms = {', 'installRenderPowerHooks();');
  return new RegExp(`${name}:\\s*\\{ value: spectrumEchoTex \\}`).test(block);
}

test('相机基线与软转场覆盖预设 7', () => {
  const setPreset = readSourceBlock(app, 'function setPreset(p, opts) {', 'function syncFxUniforms()');
  assert.match(setPreset, /else if \(p === 7\) \{ orbit\.userRadius = 8\.6;/);
  const trigger = readSourceBlock(app, 'function isSoftFlowPreset(', 'function tickPresetTransition()');
  assert.match(trigger, /return preset === 5 \|\| preset === SPECTRUM_ECHO_PRESET_INDEX;/);
  assert.match(trigger, /var softFlow = isSoftFlowPreset\(toPreset\);/);
  assert.match(trigger, /presetTransition\.duration = softFlow \? 0\.30 : 0\.24;/);
  const tick = readSourceBlock(app, 'function tickPresetTransition()', 'function setPreset(p, opts)');
  assert.match(tick, /var softFlow = isSoftFlowPreset\(presetTransition\.to\);/);
  assert.doesNotMatch(app, /wallpaperFlow/);
});

test('回响更新挂在音频 uniform 之后，没有挤进单次扫描热循环', () => {
  const animate = readSourceBlock(app, 'function animate() {', "resumeMainRenderLoop('startup');");
  assert.match(
    animate,
    /uniforms\.uEnergy\.value = audioEnergy;\s*\n\s*updateSpectrumEchoField\(shouldAnalyzeAudio && analysisDt > 0, dt, beatPulse, audioEnergy\);/,
  );
  const analysis = readSourceBlock(app, 'var len = frequencyData.length;', '// 动态峰值跟踪');
  assert.equal((analysis.match(/for \(var i = 0; i < len; i\+\+\)/g) || []).length, 1);
  assert.doesNotMatch(analysis, /updateSpectrumEchoField|spectrumEcho/);
  assert.match(app, /function clamp01\(v\) \{ return Math\.max\(0, Math\.min\(1, v\)\); \}/);
});
