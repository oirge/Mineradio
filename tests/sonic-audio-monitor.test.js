'use strict';
// 音域监视器 (public/sonic-audio-monitor.js) 的守卫。
// 这一层逐行移植自上游 XxHuberrr/Mineradio 的 public/js/modules/03-beat/06-sonic-audio-monitor.js
// (GPL-3.0) 的计算路径, 视觉预设 7「音域回响」靠它拿八段 Hz + 真 kick 包络。
// 所以这里既钉住频段表 / 鼓点窗口这些上游常量, 也真跑一遍 step() 断言包络与衰减行为。

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

const monitorSource = readProjectFile('public/sonic-audio-monitor.js');
const presetSource = readProjectFile('public/sonic-topography-preset.js');
const indexHtml = readProjectFile('public/index.html');
const app = readProjectFile('public/app.js');

const BAND_KEYS = ['subBass', 'bass', 'lowMid', 'mid', 'highMid', 'presence', 'brilliance', 'air'];

/** 每个测试单独加载一份: 模块的 state 是模块级单例, 复用会串味。 */
function loadMonitor() {
  const sandbox = { Math, Number, String, Object, Array, Uint8Array, Float32Array, isFinite, console };
  sandbox.window = sandbox;
  vm.runInNewContext(monitorSource, sandbox);
  const mod = sandbox.MineradioSonicAudio;
  assert.ok(mod, '模块必须把自己挂到全局 MineradioSonicAudio');
  return { mod, sandbox };
}

/**
 * 造一份 analyser.getByteFrequencyData 风格的频谱: 只在给定 Hz 区间里填能量。
 * @param {Array<[number, number, number]>} peaks [起始 Hz, 结束 Hz, 0~255 幅度]
 */
function spectrum(peaks, opts) {
  opts = opts || {};
  const len = opts.len || 512;
  const sampleRate = opts.sampleRate || 44100;
  const fftSize = opts.fftSize || len * 2;
  const binHz = sampleRate / fftSize;
  const data = new Uint8Array(len);
  peaks.forEach(([startHz, endHz, amp]) => {
    const start = Math.max(0, Math.floor(startHz / binHz));
    const end = Math.min(len - 1, Math.ceil(endHz / binHz));
    for (let i = start; i <= end; i++) data[i] = Math.max(data[i], Math.round(amp));
  });
  return data;
}

/** 连着走 n 帧, 每帧 1/60 秒, 时间戳自己递增 (nowMs 认 opts.now)。 */
function run(mod, data, n, opts) {
  opts = opts || {};
  let frame = null;
  for (let i = 0; i < n; i++) {
    frame = mod.step(typeof data === 'function' ? data(i) : data, 1 / 60, Object.assign({
      playing: true,
      sampleRate: 44100,
      fftSize: 1024,
      now: (opts.startNow || 0) + i * (1000 / 60),
      currentTime: i / 60,
    }, opts.step));
  }
  return frame;
}

/** 跨 vm realm 的对象没法直接 deepEqual (原型不同一份), 统一走一次 JSON 回环。 */
function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test('模块只挂一个全局，导出面就是上游那套读写口', () => {
  const { mod, sandbox } = loadMonitor();
  assert.deepEqual(Object.keys(mod).sort(), ['BAND_EDGES', 'BASE_BINS', 'BEAT_WINDOWS', 'reset', 'settings', 'snapshot', 'step']);
  // 加载本身不许有副作用: 除了自己那一个全局, 不能往 window 上再塞东西。
  const own = Object.keys(sandbox).filter((k) => k !== 'window');
  assert.ok(own.includes('MineradioSonicAudio'));
  assert.equal(own.filter((k) => /^Mineradio/.test(k)).length, 1);
});

test('八段频段边界与六个鼓点窗口保持上游原值', () => {
  const { mod } = loadMonitor();
  assert.equal(mod.BASE_BINS, 512, '上游所有 bin 常量都是按 512 标定的');
  assert.deepEqual(plain(mod.BAND_EDGES), [
    ['subBass', 32, 58],
    ['bass', 58, 118],
    ['lowMid', 118, 260],
    ['mid', 260, 720],
    ['highMid', 720, 1800],
    ['presence', 1800, 4200],
    ['brilliance', 4200, 9000],
    ['air', 9000, 16000],
  ]);
  assert.deepEqual(plain(mod.BAND_EDGES).map((b) => b[0]), BAND_KEYS, '八段的名字要和预设 7 读的字段一一对上');
  assert.deepEqual(plain(mod.BEAT_WINDOWS), [
    { name: 'Deep', startHz: 36, endHz: 82, bias: 1.04 },
    { name: 'Club', startHz: 46, endHz: 118, bias: 1.22 },
    { name: 'Kick', startHz: 54, endHz: 142, bias: 1.16 },
    { name: 'Punch', startHz: 68, endHz: 156, bias: 1.02 },
    { name: 'Body', startHz: 86, endHz: 190, bias: 0.86 },
    { name: 'Wide', startHz: 38, endHz: 155, bias: 0.78 },
  ]);
});

test('缺省设置就是上游默认值，越界值按上游区间夹住', () => {
  const { mod } = loadMonitor();
  assert.deepEqual(plain(mod.settings()), {
    enabled: true, autoTrack: true, sensitivity: 100, bandStart: 1, bandEnd: 4, threshold: 32, pulseStrength: 62,
  });
  assert.deepEqual(plain(mod.settings({
    sonicAudioMonitorEnabled: false, sonicAudioAutoTrack: false,
    sonicAudioSensitivity: 999, sonicAudioThreshold: -50, sonicAudioPulseStrength: 1e9,
    sonicAudioBandStart: 9000, sonicAudioBandEnd: -1,
  })), {
    enabled: false, autoTrack: false, sensitivity: 100, bandStart: 510, bandEnd: 511, threshold: 0, pulseStrength: 100,
  });
  // bandEnd 至少比 bandStart 大 1, 否则频段宽度为 0, 触发器整段读不到东西。
  const narrow = mod.settings({ sonicAudioBandStart: 40, sonicAudioBandEnd: 40 });
  assert.equal(narrow.bandEnd, 41);
});

test('产出细粒度八段帧，低频输入只抬低段', () => {
  const { mod } = loadMonitor();
  // 40~140Hz 的持续低频: 典型的底鼓 + 贝斯区。
  const frame = run(mod, spectrum([[38, 145, 235]]), 40);
  assert.equal(frame.sonicDetailed, true, '预设 7 靠这个标记走细粒度分支');
  assert.equal(frame.sonicHzDetailed, true);
  BAND_KEYS.forEach((key) => {
    assert.equal(typeof frame[key], 'number', `${key} 必须是数字`);
    assert.ok(frame[key] >= 0 && frame[key] <= 1, `${key} 要归一到 0~1, 实际 ${frame[key]}`);
  });
  assert.ok(frame.subBass > 0.5, `低频塞满时 subBass 该被推起来, 实际 ${frame.subBass}`);
  assert.ok(frame.bass > 0.5);
  assert.ok(frame.mid < 0.05, '260Hz 以上没能量, 中段不该跟着涨');
  assert.ok(frame.air < 0.02);
  assert.ok(frame.warmth > frame.brightness, '低频占比高时 warmth 要压过 brightness');

  // 高频输入反过来: 只抬 brilliance / air。
  const high = loadMonitor().mod;
  const highFrame = run(high, spectrum([[6000, 15000, 235]]), 40);
  assert.ok(highFrame.brilliance > 0.5, `实际 ${highFrame.brilliance}`);
  assert.ok(highFrame.air > 0.4);
  assert.ok(highFrame.subBass < 0.02, '低段没能量就该躺平');
  assert.ok(highFrame.brightness > highFrame.warmth);
});

test('底鼓起拍打出真包络，能越过预设 7 的 0.58 触发线', () => {
  const { mod } = loadMonitor();
  const kick = spectrum([[38, 150, 250]]);
  const quiet = spectrum([[38, 150, 26]]);
  // 先垫两秒安静的低频底噪, 让自适应噪声底收敛 —— 这一步就是上游用来
  // 把持续低频垫音减掉、只留真起拍的机制。
  run(mod, quiet, 120);
  const before = mod.snapshot().frame.kickEnvelope || 0;
  assert.ok(before < 0.2, `持续垫音不该被当成一直在踩鼓, 实际 ${before}`);

  // 再来一串 每 12 帧一次 的鼓点。
  let peak = 0;
  for (let i = 0; i < 150; i++) {
    const f = mod.step(i % 12 < 2 ? kick : quiet, 1 / 60, {
      playing: true, sampleRate: 44100, fftSize: 1024, now: 2000 + i * (1000 / 60), currentTime: 2 + i / 60,
    });
    peak = Math.max(peak, f.kickEnvelope);
  }
  assert.ok(peak > 0.58, `包络峰值要能打穿预设 7 的涟漪阈值 0.58, 实际 ${peak}`);
  assert.ok(peak <= 1, '包络上限是 1');
  // beat 与 kickEnvelope 是同一个值 —— 预设 7 两个字段都读, 不能各走一路。
  const last = mod.snapshot().frame;
  assert.equal(last.beat, last.kickEnvelope);

  // 外部 beat 只做下限, 不会把包络压低。
  const boosted = mod.step(quiet, 1 / 60, {
    playing: true, sampleRate: 44100, fftSize: 1024, now: 6000, currentTime: 6, beat: 0.91,
  });
  assert.ok(Math.abs(boosted.kickEnvelope - 0.91) < 1e-9);
});

test('自动跟踪会自己挑鼓点窗口，关掉就一直用默认窗口', () => {
  const { mod } = loadMonitor();
  // 46~118Hz 的窗口 (Club) 权重最高, 能量正好落在那儿。
  run(mod, (i) => (i % 10 < 2 ? spectrum([[48, 112, 250]]) : spectrum([[48, 112, 20]])), 90);
  const snap = mod.snapshot();
  assert.ok(snap.autoWindowIndex >= 0 && snap.autoWindowIndex < mod.BEAT_WINDOWS.length);
  assert.ok(snap.autoBandEnd > snap.autoBandStart, '跟踪出来的 bin 区间不能是空的');
  assert.equal(snap.baseBins, 512);
  assert.equal(snap.sampleRate, 44100);
  assert.equal(snap.fftSize, 1024);
  assert.equal(snap.rawLength, 512);

  const fixed = loadMonitor().mod;
  run(fixed, spectrum([[48, 112, 250]]), 90, { step: { fx: { sonicAudioAutoTrack: false } } });
  assert.equal(fixed.snapshot().autoWindowIndex, 1, '关掉跟踪就停在上游默认的 Club 窗口');
});

test('停播不硬切成静音，而是按上游的指数衰减收回去', () => {
  const { mod } = loadMonitor();
  run(mod, spectrum([[38, 150, 250]]), 60);
  const hot = mod.snapshot().frame.subBass;
  assert.ok(hot > 0.5);

  const first = mod.step(null, 1 / 60, { playing: false });
  assert.ok(first.subBass < hot, '停播第一帧就该开始往下收');
  assert.ok(first.subBass > 0, '但不能一步归零, 否则地形会啪一下塌下去');
  let prev = first.subBass;
  for (let i = 0; i < 10; i++) {
    const f = mod.step(null, 1 / 60, { playing: false });
    assert.ok(f.subBass <= prev, '衰减必须单调');
    prev = f.subBass;
  }
  for (let i = 0; i < 200; i++) mod.step(null, 1 / 60, { playing: false });
  const cold = mod.snapshot().frame;
  // 每帧乘 0.08^dt (60fps 下约 0.959), 三秒多把 0.9 收到千分之一以下。
  ['subBass', 'bass', 'mid', 'air', 'kickEnvelope', 'beat', 'energy'].forEach((key) => {
    assert.ok(cold[key] < 0.001, `${key} 停播久了要收回 0 附近, 实际 ${cold[key]}`);
  });

  // 一帧都没喂过就停播: 只能返回 null, 不许伪造一帧假数据。
  assert.equal(loadMonitor().mod.step(null, 1 / 60, { playing: false }), null);
});

test('监视器被关掉时不产帧，app.js 那边就退回粗粒度壳', () => {
  const { mod } = loadMonitor();
  const off = mod.step(spectrum([[38, 150, 250]]), 1 / 60, {
    playing: true, sampleRate: 44100, fftSize: 1024, now: 0, fx: { sonicAudioMonitorEnabled: false },
  });
  assert.equal(off, null, '关掉就当没有这一层');
  // app.js 侧: 拿不到帧就用 sonicTopographyCoarseAudio, 而且开关也要在 app.js 里被尊重。
  assert.match(app, /if \(fx\.sonicAudioMonitorEnabled !== false\) sonicAudioFrame = sonicMonitorFrame;/);
  assert.match(app, /sonicTopographyCtx\.audio = sonicAudioFrame \|\| sonicTopographyCoarseAudio;/);
});

test('拖进度 / 切歌会清掉瞬态，下一首不继承上一首的噪声底', () => {
  const { mod } = loadMonitor();
  const loud = spectrum([[38, 150, 250]]);
  // 两秒持续的响低频: 自适应噪声底会追上来, 于是这段"垫音"不再被当成一直在踩鼓。
  for (let i = 0; i < 120; i++) {
    mod.step(loud, 1 / 60, {
      playing: true, sampleRate: 44100, fftSize: 1024, now: i * (1000 / 60), currentTime: 10 + i / 60,
    });
  }
  assert.ok(mod.snapshot().frame.kickFlux != null, '细粒度帧要带鼓点通量');
  const settled = mod.step(loud, 1 / 60, {
    playing: true, sampleRate: 44100, fftSize: 1024, now: 2100, currentTime: 12.1,
  });
  assert.ok(settled.kickEnvelope < 0.2, `噪声底追上来后同一份垫音不该再算成鼓点, 实际 ${settled.kickEnvelope}`);

  // currentTime 往回跳超过 0.30s = 拖动进度或换歌: 噪声底 / 通量历史 / 鼓点窗口全部清零,
  // 所以同一份频谱重新被当成一次全新的起拍 —— 这正是上游的行为, 新曲子的第一拍不会被旧底噪压住。
  const afterSeek = mod.step(loud, 1 / 60, {
    playing: true, sampleRate: 44100, fftSize: 1024, now: 2200, currentTime: 0.2,
  });
  assert.ok(afterSeek.kickEnvelope > settled.kickEnvelope + 0.3, `拖完要重新起拍, 实际 ${afterSeek.kickEnvelope}`);

  // 往前跳 (或正常播放) 不算倒退, 不该清场。
  const forward = loadMonitor().mod;
  for (let i = 0; i < 120; i++) {
    forward.step(loud, 1 / 60, {
      playing: true, sampleRate: 44100, fftSize: 1024, now: i * (1000 / 60), currentTime: 10 + i / 60,
    });
  }
  const jumped = forward.step(loud, 1 / 60, {
    playing: true, sampleRate: 44100, fftSize: 1024, now: 2200, currentTime: 60,
  });
  assert.ok(jumped.kickEnvelope < 0.2, `往前跳不该清瞬态, 实际 ${jumped.kickEnvelope}`);

  // reset() 是切歌时的显式清场: 帧直接作废。
  mod.reset();
  assert.deepEqual(plain(mod.snapshot().frame), {});
  assert.equal(mod.snapshot().lastOnsetAt, 0);
});

test('采样率 / fftSize 由调用方注入，换设备也按 Hz 对齐频段', () => {
  const { mod } = loadMonitor();
  // 48kHz + fftSize 4096 (1024 bin): 同样的 Hz 区间落在完全不同的 bin 上。
  const data = spectrum([[38, 150, 250]], { len: 1024, sampleRate: 48000, fftSize: 4096 });
  let frame = null;
  for (let i = 0; i < 40; i++) {
    frame = mod.step(data, 1 / 60, {
      playing: true, sampleRate: 48000, fftSize: 4096, now: i * (1000 / 60), currentTime: i / 60,
    });
  }
  assert.ok(frame.subBass > 0.5, `按 Hz 换算才找得到这段能量, 实际 ${frame.subBass}`);
  assert.ok(frame.air < 0.02);
  const snap = mod.snapshot();
  assert.equal(snap.sampleRate, 48000);
  assert.equal(snap.fftSize, 4096);
  assert.equal(snap.rawLength, 1024, '缓冲区跟着 bin 数重建');

  // 传不合法的采样率就退回 44.1k, 不能算出 NaN 频段。
  const bad = loadMonitor().mod;
  const badFrame = bad.step(spectrum([[38, 150, 250]]), 1 / 60, {
    playing: true, sampleRate: 12, fftSize: 0, now: 0, currentTime: 0,
  });
  assert.equal(bad.snapshot().sampleRate, 44100);
  BAND_KEYS.forEach((key) => assert.ok(Number.isFinite(badFrame[key]), `${key} 不能是 NaN`));
});

test('帧的字段面覆盖预设 7 读的全部量，且先于两个预设加载', () => {
  const { mod } = loadMonitor();
  const frame = run(mod, spectrum([[38, 9000, 200]]), 30);
  // 预设 7 的 readMineradioAudio 细粒度分支读这些字段。
  BAND_KEYS.concat(['treble', 'energy', 'kickEnvelope', 'sharpness', 'smoothness', 'density']).forEach((key) => {
    assert.ok(Number.isFinite(frame[key]), `帧里缺 ${key}, 预设 7 会退回粗粒度反推`);
  });
  assert.match(presetSource, /if \(raw\.sonicDetailed \|\| raw\.subBass != null/, '预设 7 靠 sonicDetailed 分流');

  const scripts = indexHtml.match(/<script src="[^"]+"><\/script>/g) || [];
  const monitorAt = scripts.indexOf('<script src="sonic-audio-monitor.js"></script>');
  const topographyAt = scripts.indexOf('<script src="sonic-topography-preset.js"></script>');
  const workshopAt = scripts.indexOf('<script src="sonic-workshop-preset.js"></script>');
  const appAt = scripts.indexOf('<script src="app.js"></script>');
  assert.ok(monitorAt >= 0, 'index.html 必须加载 sonic-audio-monitor.js');
  assert.ok(monitorAt < topographyAt && monitorAt < workshopAt && monitorAt < appAt, '监视器要先注册全局');
  // 缺脚本 (例如插件裁剪过 public) 时安静跳过, 不能让主循环炸掉。
  assert.match(app, /function sonicAudioMonitorModule\(\) \{\s*\n\s*return \(typeof MineradioSonicAudio !== 'undefined' && MineradioSonicAudio\) \? MineradioSonicAudio : null;/);
});

test('移植出处必须写清楚：上游仓库、原模块路径、许可', () => {
  const header = monitorSource.slice(0, monitorSource.indexOf('(function (global)'));
  assert.match(header, /XxHuberrr\/Mineradio/);
  assert.match(header, /03-beat\/06-sonic-audio-monitor\.js/, '留下上游模块路径, 以后对账好找');
  assert.match(header, /GPL-3\.0/);
  assert.doesNotMatch(header, /原创|不是移植/);

  const notice = readProjectFile('NOTICE.md');
  assert.match(notice, /XxHuberrr\/Mineradio/);
});
