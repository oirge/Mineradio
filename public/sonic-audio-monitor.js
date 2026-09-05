/**
 * 音域监视器 (Sonic Audio Monitor) — 细粒度频段 / 底鼓包络分析。
 *
 * 逐行移植自上游 XxHuberrr/Mineradio 的
 * public/js/modules/03-beat/06-sonic-audio-monitor.js (GPL-3.0) 的计算路径,
 * 频段边界、跟随系数、阈值曲线、包络攻放全部保持上游原值。
 *
 * 为什么要有这一层: 视觉预设 7「音域回响」读的是 subBass/bass/lowMid/mid/highMid/
 * presence/brilliance/air 八段 + kickEnvelope 真包络。上游默认开着这个监视器,
 * 本仓库之前只喂 bass/mid/treble/beat/energy 五个粗值, 预设内部走 fallback 分支
 * 用三个粗值反推八段 —— 地形起伏与涟漪触发因此和原作对不上。
 *
 * 本机适配两处:
 *   1. 只搬计算路径, 上游的调试面板 (drawSonicAudioMonitorPanel 等) 没有一起搬,
 *      本仓库没有对应的控制台 UI, fx.sonicAudio* 缺省时按上游默认值走;
 *   2. 采样率 / fftSize 由调用方显式传入 (上游是读同作用域的 audioCtx / analyser 全局)。
 *
 * 产出的帧只喂给视觉预设 7, 不参与本仓库其它音频派生量 (smoothBass / cinema 等),
 * 避免改动无关视觉。
 */
(function (global) {
  'use strict';

  var BASE_BINS = 512;
  var MAX_BAND_START = BASE_BINS - 2;
  var MAX_BAND_END = BASE_BINS;
  var DEFAULT_SAMPLE_RATE = 44100;

  var BAND_EDGES = [
    ['subBass', 32, 58],
    ['bass', 58, 118],
    ['lowMid', 118, 260],
    ['mid', 260, 720],
    ['highMid', 720, 1800],
    ['presence', 1800, 4200],
    ['brilliance', 4200, 9000],
    ['air', 9000, 16000]
  ];

  var BEAT_WINDOWS = [
    { name: 'Deep', startHz: 36, endHz: 82, bias: 1.04 },
    { name: 'Club', startHz: 46, endHz: 118, bias: 1.22 },
    { name: 'Kick', startHz: 54, endHz: 142, bias: 1.16 },
    { name: 'Punch', startHz: 68, endHz: 156, bias: 1.02 },
    { name: 'Body', startHz: 86, endHz: 190, bias: 0.86 },
    { name: 'Wide', startHz: 38, endHz: 155, bias: 0.78 }
  ];

  function createBeatState() {
    return {
      activeWindowIndex: 1,
      windowScores: new Array(BEAT_WINDOWS.length).fill(0),
      previousWindowLevels: new Array(BEAT_WINDOWS.length).fill(0),
      fluxHistory: new Array(90).fill(0),
      fluxHistoryIndex: 0,
      smoothedFlux: 0,
      previousSmoothedFlux: 0,
      cooldownRemaining: 0
    };
  }

  function createTriggerState() {
    return {
      smoothedFlux: 0,
      previousSmoothedFlux: 0,
      history: new Array(40).fill(0),
      historyIndex: 0,
      beatHold: 0,
      cooldownRemaining: 0,
      lastEnergy: 0,
      lastThreshold: 0,
      pulse: 0
    };
  }

  var state = {
    raw: new Uint8Array(BASE_BINS),
    prev: new Float32Array(BASE_BINS),
    smooth: {},
    beat: null,
    kick: { noiseFloor: 0, kickLevel: 0, kickOnset: 0, kickEnvelope: 0 },
    trigger: createTriggerState(),
    autoTrack: {
      frames: [],
      lastAt: 0,
      start: 1,
      end: 2,
      windowIndex: 1,
      hzStart: 52,
      hzEnd: 165,
      sensitivity: 0.85
    },
    meta: null,
    frame: null,
    lastOnsetAt: 0,
    lastAudioTime: 0
  };

  function clamp(value, min, max) {
    value = Number(value);
    if (!isFinite(value)) value = min;
    return Math.max(min, Math.min(max, value));
  }

  function clamp01(value) {
    return clamp(value, 0, 1);
  }

  function blendForRate(rate, dt) {
    return clamp(1 - Math.exp(-Math.max(0, rate) * Math.max(0, dt || 0)), 0, 1);
  }

  function scaleBin(baseBin, len) {
    len = Math.max(1, Math.round(Number(len) || 1));
    return Math.max(0, Math.min(len - 1, Math.round((Number(baseBin) || 0) * len / BASE_BINS)));
  }

  function nowMs(opts) {
    if (opts && isFinite(Number(opts.now))) return Number(opts.now);
    if (typeof performance !== 'undefined' && performance && typeof performance.now === 'function') return performance.now();
    return 0;
  }

  /** 采样率 / fftSize 优先取调用方传入值, 缺省时退回同名全局与 44.1k。 */
  function resolveAnalysisMeta(data, opts) {
    opts = opts || {};
    var len = Math.max(1, data && data.length ? data.length : BASE_BINS);
    var sampleRate = Number(opts.sampleRate)
      || (global.audioCtx && Number(global.audioCtx.sampleRate))
      || DEFAULT_SAMPLE_RATE;
    var fftSize = Number(opts.fftSize)
      || (global.analyser && Number(global.analyser.fftSize))
      || len * 2;
    if (!isFinite(sampleRate) || sampleRate < 8000) sampleRate = DEFAULT_SAMPLE_RATE;
    if (!isFinite(fftSize) || fftSize < len * 2) fftSize = len * 2;
    return {
      len: len,
      sampleRate: sampleRate,
      fftSize: fftSize,
      nyquist: sampleRate / 2,
      binHz: sampleRate / fftSize
    };
  }

  function hzToBin(meta, hz, mode) {
    meta = meta || resolveAnalysisMeta(null, null);
    var raw = (Number(hz) || 0) / Math.max(0.001, meta.binHz || 1);
    var bin = mode === 'ceil' ? Math.ceil(raw) : (mode === 'floor' ? Math.floor(raw) : Math.round(raw));
    return Math.max(1, Math.min(Math.max(1, meta.len - 1), bin));
  }

  function hzToBase(meta, hz) {
    meta = meta || resolveAnalysisMeta(null, null);
    var base = (Number(hz) || 0) / Math.max(1, meta.nyquist || DEFAULT_SAMPLE_RATE / 2) * BASE_BINS;
    return Math.round(clamp(base, 0, MAX_BAND_END));
  }

  function baseRangeToHz(meta, baseStart, baseEnd) {
    meta = meta || resolveAnalysisMeta(null, null);
    var nyquist = Math.max(1, meta.nyquist || DEFAULT_SAMPLE_RATE / 2);
    var startHz = clamp(baseStart, 0, MAX_BAND_END) / BASE_BINS * nyquist;
    var endHz = clamp(baseEnd, 0, MAX_BAND_END) / BASE_BINS * nyquist;
    return { startHz: Math.min(startHz, endHz), endHz: Math.max(startHz, endHz) };
  }

  /** 频段能量取 RMS (先平方再开方), 可选中心加权凸显频段核心。 */
  function hzRangeAverage(data, meta, hzStart, hzEnd, weighted) {
    if (!data || !data.length) return 0;
    meta = meta || resolveAnalysisMeta(data, null);
    var start = hzToBin(meta, Math.min(hzStart, hzEnd), 'floor');
    var end = hzToBin(meta, Math.max(hzStart, hzEnd), 'ceil');
    if (end < start) {
      var tmp = start;
      start = end;
      end = tmp;
    }
    var sum = 0;
    var total = 0;
    var center = (start + end) / 2;
    var half = Math.max(1, (end - start + 1) / 2);
    for (var i = start; i <= end; i++) {
      var weight = 1;
      if (weighted) {
        var distance = Math.abs(i - center);
        weight = 0.38 + 0.62 * (1 - Math.min(1, distance / half));
      }
      var v = (data[i] || 0) / 255;
      sum += v * v * weight;
      total += weight;
    }
    return total > 0 ? Math.sqrt(sum / total) : 0;
  }

  /** 上升快、下落慢的单极跟随; 攻放速率以 1/s 为单位, 与帧率解耦。 */
  function followValue(previous, next, attackRate, releaseRate, dt) {
    previous = Number(previous) || 0;
    next = clamp01(next);
    var rate = next > previous ? attackRate : releaseRate;
    return previous + (next - previous) * blendForRate(rate, dt || 1 / 60);
  }

  function computeHzBands(data, meta) {
    var values = {};
    var energySum = 0;
    for (var b = 0; b < BAND_EDGES.length; b++) {
      var band = BAND_EDGES[b];
      var value = hzRangeAverage(data, meta, band[1], band[2], false);
      values[band[0]] = value;
      energySum += value;
    }
    values.kickSub = hzRangeAverage(data, meta, 38, 78, true);
    values.kickCore = hzRangeAverage(data, meta, 52, 165, true);
    values.kickPunch = hzRangeAverage(data, meta, 72, 190, true);
    values.kickWide = hzRangeAverage(data, meta, 38, 220, true);
    values.body = hzRangeAverage(data, meta, 165, 420, true);
    values.vocal = hzRangeAverage(data, meta, 420, 2600, false);
    values.snap = hzRangeAverage(data, meta, 1800, 9200, false);
    values.lowDrive = clamp01(values.kickCore * 0.86 + values.kickSub * 0.42 + values.body * 0.10);
    values.lowDominance = values.lowDrive / Math.max(0.001, values.vocal * 0.72 + values.body * 0.34 + values.snap * 0.12);
    values.energy = clamp01((energySum / BAND_EDGES.length) * 0.82 + values.lowDrive * 0.18);
    return values;
  }

  function ensureBuffers(len) {
    len = Math.max(1, Math.round(Number(len) || 512));
    if (!state.raw || state.raw.length !== len) {
      state.raw = new Uint8Array(len);
      state.prev = new Float32Array(len);
    }
  }

  /** 拖动进度 / 切歌后清掉瞬态, 否则旧的通量历史会压住新曲子的起拍。 */
  function resetTransientState(meta) {
    state.beat = createBeatState();
    state.kick = { noiseFloor: 0, kickLevel: 0, kickOnset: 0, kickEnvelope: 0 };
    state.trigger = createTriggerState();
    state.autoTrack.frames = [];
    state.autoTrack.lastAt = 0;
    state.autoTrack.windowIndex = 1;
    state.autoTrack.hzStart = 46;
    state.autoTrack.hzEnd = 118;
    if (meta) {
      state.autoTrack.start = hzToBase(meta, 46);
      state.autoTrack.end = hzToBase(meta, 118);
    } else {
      state.autoTrack.start = 1;
      state.autoTrack.end = 3;
    }
  }

  /** fx 里没有这些键时按上游默认值走 (监视器开、自动跟踪开、灵敏度 100)。 */
  function normalizeSettings(sourceFx) {
    var f = sourceFx || {};
    var start = Math.round(clamp(f.sonicAudioBandStart == null ? 1 : f.sonicAudioBandStart, 0, MAX_BAND_START));
    var end = Math.round(clamp(f.sonicAudioBandEnd == null ? 4 : f.sonicAudioBandEnd, 2, MAX_BAND_END));
    if (end < start + 1) end = Math.min(MAX_BAND_END, start + 1);
    return {
      enabled: f.sonicAudioMonitorEnabled !== false,
      autoTrack: f.sonicAudioAutoTrack !== false,
      sensitivity: Math.round(clamp(f.sonicAudioSensitivity == null ? 100 : f.sonicAudioSensitivity, 0, 100)),
      bandStart: start,
      bandEnd: end,
      threshold: Math.round(clamp(f.sonicAudioThreshold == null ? 32 : f.sonicAudioThreshold, 0, 100)),
      pulseStrength: Math.round(clamp(f.sonicAudioPulseStrength == null ? 62 : f.sonicAudioPulseStrength, 0, 100))
    };
  }

  /** 灵敏度 0~100 在 严格 / 常规 / 灵敏 三档之间双段插值。 */
  function beatParams(sensitivity) {
    sensitivity = clamp(sensitivity, 0, 100);
    var lower = sensitivity <= 50 ? sensitivity / 50 : 1;
    var upper = sensitivity > 50 ? (sensitivity - 50) / 50 : 0;
    var strict = { thresholdStdDevGain: 2.6, thresholdFloor: 0.05, minTriggerFlux: 0.07 };
    var normal = { thresholdStdDevGain: 1.8, thresholdFloor: 0.028, minTriggerFlux: 0.045 };
    var sensitive = { thresholdStdDevGain: 1.1, thresholdFloor: 0.016, minTriggerFlux: 0.025 };
    var mid = {
      thresholdStdDevGain: strict.thresholdStdDevGain + (normal.thresholdStdDevGain - strict.thresholdStdDevGain) * lower,
      thresholdFloor: strict.thresholdFloor + (normal.thresholdFloor - strict.thresholdFloor) * lower,
      minTriggerFlux: strict.minTriggerFlux + (normal.minTriggerFlux - strict.minTriggerFlux) * lower
    };
    return {
      thresholdStdDevGain: mid.thresholdStdDevGain + (sensitive.thresholdStdDevGain - mid.thresholdStdDevGain) * upper,
      thresholdFloor: mid.thresholdFloor + (sensitive.thresholdFloor - mid.thresholdFloor) * upper,
      minTriggerFlux: mid.minTriggerFlux + (sensitive.minTriggerFlux - mid.minTriggerFlux) * upper
    };
  }

  function fluxStats(history) {
    var sum = 0;
    var i;
    for (i = 0; i < history.length; i++) sum += history[i] || 0;
    var avg = sum / Math.max(1, history.length);
    var variance = 0;
    for (i = 0; i < history.length; i++) variance += Math.pow((history[i] || 0) - avg, 2);
    variance /= Math.max(1, history.length);
    return { avg: avg, stdDev: Math.sqrt(variance) };
  }

  /**
   * 底鼓包络: 先用自适应噪声底把持续的低频垫音减掉, 再按 攻 42 / 放 11.5 跟随。
   * 起拍时目标至少 0.48, 保证预设 7 的 kickEnvelope > 0.58 阈值能被真正打穿。
   */
  function stepKickEnvelope(rawKickLevel, onset, dt) {
    var k = state.kick;
    var safeRaw = clamp01(rawKickLevel);
    var floorRate = safeRaw > k.noiseFloor ? 1.15 : 0.35;
    var noiseFloor = k.noiseFloor + (safeRaw - k.noiseFloor) * blendForRate(floorRate, dt);
    var kickLevel = clamp01(safeRaw - noiseFloor - 0.025);
    var breathTarget = Math.min(0.11, kickLevel * 0.18);
    var onsetTarget = onset ? Math.max(0.48, kickLevel * 0.95) : 0;
    var targetEnvelope = Math.max(breathTarget, onsetTarget);
    var envelopeRate = targetEnvelope > k.kickEnvelope ? 42 : 11.5;
    var kickEnvelope = Math.max(breathTarget, k.kickEnvelope + (targetEnvelope - k.kickEnvelope) * blendForRate(envelopeRate, dt));
    state.kick = {
      noiseFloor: noiseFloor,
      kickLevel: kickLevel,
      kickOnset: onset ? 1 : 0,
      kickEnvelope: clamp01(kickEnvelope)
    };
    return state.kick;
  }

  /** 六个候选低频窗各自算通量, 谁涨得猛就切过去; 人声 / 军鼓占优时闸门关掉。 */
  function stepBeatDetector(data, dt, settings, meta, bands) {
    if (!state.beat) state.beat = createBeatState();
    var s = state.beat;
    var params = beatParams(settings.sensitivity);
    var windowLevels = BEAT_WINDOWS.map(function (win) {
      return hzRangeAverage(data, meta, win.startHz, win.endHz, true);
    });
    var nextScores = s.windowScores.map(function (score, index) {
      var fluxValue = Math.max(0, windowLevels[index] - (s.previousWindowLevels[index] || 0));
      var win = BEAT_WINDOWS[index];
      var dominanceBoost = clamp((bands && bands.lowDominance) || 0, 0.65, 2.25) / 2.25;
      return score * 0.945 + fluxValue * (win.bias || 1) * (0.70 + dominanceBoost * 0.70);
    });
    var activeWindowIndex = settings.autoTrack && state.autoTrack.windowIndex != null
      ? state.autoTrack.windowIndex
      : (s.activeWindowIndex || 0);
    for (var i = 0; i < nextScores.length; i++) {
      if (nextScores[i] > nextScores[activeWindowIndex] * 1.10) activeWindowIndex = i;
    }
    var rawFlux = Math.max(0, windowLevels[activeWindowIndex] - (s.previousWindowLevels[activeWindowIndex] || 0));
    var smoothedFlux = s.smoothedFlux + (rawFlux - s.smoothedFlux) * 0.46;
    var stats = fluxStats(s.fluxHistory);
    var threshold = Math.max(params.thresholdFloor, stats.avg + stats.stdDev * params.thresholdStdDevGain);
    var cooldownRemaining = Math.max(0, s.cooldownRemaining - Math.max(0, dt || 0));
    var lowDominance = (bands && bands.lowDominance) || 0;
    var lowGate = (bands && bands.lowDrive) || windowLevels[activeWindowIndex] || 0;
    var vocalMask = bands ? (bands.vocal * 0.62 + bands.snap * 0.16) : 0;
    var drumGate = lowGate > 0.045 && (lowDominance > 0.78 || lowGate > vocalMask * 1.04 || ((bands && bands.kickSub) || 0) > 0.085);
    var instantRise = rawFlux > threshold && rawFlux >= params.minTriggerFlux;
    var peakConfirm = s.previousSmoothedFlux > threshold && s.previousSmoothedFlux >= smoothedFlux && s.previousSmoothedFlux >= params.minTriggerFlux * 0.86;
    var onset = cooldownRemaining <= 0 && drumGate && (instantRise || peakConfirm);
    var displayedFlux = instantRise ? rawFlux : (onset ? Math.max(s.previousSmoothedFlux, smoothedFlux) : smoothedFlux);
    var nextHistory = s.fluxHistory.slice();
    nextHistory[s.fluxHistoryIndex] = smoothedFlux;
    var nextHistoryIndex = (s.fluxHistoryIndex + 1) % nextHistory.length;
    var kickLevel = Math.max(windowLevels[activeWindowIndex], (bands && bands.lowDrive) || 0);
    var kick = stepKickEnvelope(kickLevel, onset, dt || 1 / 60);
    s.activeWindowIndex = activeWindowIndex;
    s.windowScores = nextScores;
    s.previousWindowLevels = windowLevels;
    s.fluxHistory = nextHistory;
    s.fluxHistoryIndex = nextHistoryIndex;
    s.smoothedFlux = smoothedFlux;
    s.previousSmoothedFlux = smoothedFlux;
    s.cooldownRemaining = onset ? 0.12 : cooldownRemaining;
    if (onset) state.lastOnsetAt = state.frameNow || 0;
    var activeWindow = BEAT_WINDOWS[activeWindowIndex];
    return {
      kickLevel: kick.kickLevel,
      kickFlux: displayedFlux,
      kickThreshold: threshold,
      kickOnset: onset ? 1 : 0,
      kickEnvelope: kick.kickEnvelope,
      kickConfidence: clamp(displayedFlux / Math.max(0.001, threshold * 1.85), 0, 1),
      kickLowDominance: clamp(lowDominance / 1.8, 0, 1),
      kickWindowName: activeWindow.name,
      kickWindowStart: hzToBase(meta, activeWindow.startHz),
      kickWindowEnd: hzToBase(meta, activeWindow.endHz),
      kickHzStart: activeWindow.startHz,
      kickHzEnd: activeWindow.endHz
    };
  }

  /**
   * 每 360ms 回看一段 1.45s 的历史, 给六个低频窗打分挑出这首歌的鼓点窗口。
   * 宽窗与高频掩蔽都要扣分, 否则贝斯垫音容易被当成底鼓。
   */
  function trackAutoPulse(data, now, meta, bands) {
    var tracker = state.autoTrack;
    var levels = BEAT_WINDOWS.map(function (win) {
      return hzRangeAverage(data, meta, win.startHz, win.endHz, true);
    });
    tracker.frames.push({
      time: now,
      levels: levels,
      lowDominance: (bands && bands.lowDominance) || 0,
      body: (bands && bands.body) || 0,
      vocal: (bands && bands.vocal) || 0,
      snap: (bands && bands.snap) || 0
    });
    while (tracker.frames.length && now - tracker.frames[0].time > 1450) tracker.frames.shift();
    if (now - tracker.lastAt <= 360 || tracker.frames.length < 8) return;
    tracker.lastAt = now;
    var scores = new Array(BEAT_WINDOWS.length);
    for (var b = 0; b < scores.length; b++) scores[b] = { index: b, avg: 0, max: 0, score: 0 };
    for (var f = 1; f < tracker.frames.length; f++) {
      var cur = tracker.frames[f];
      var prev = tracker.frames[f - 1];
      var highMask = cur.vocal * 0.58 + cur.snap * 0.22 + cur.body * 0.18;
      var dominance = clamp(cur.lowDominance, 0.65, 2.20) / 2.20;
      for (var k = 0; k < scores.length; k++) {
        var diff = Math.max(0, cur.levels[k] - prev.levels[k]);
        var win = BEAT_WINDOWS[k];
        var width = Math.max(1, win.endHz - win.startHz);
        var widthPenalty = clamp(Math.sqrt(82 / width), 0.68, 1.16);
        var bodyPenalty = win.endHz > 160 ? 1 / (1 + cur.body * 0.42 + highMask * 0.22) : 1;
        var weighted = diff * (win.bias || 1) * widthPenalty * bodyPenalty * (0.72 + dominance * 0.60) / (1 + highMask * 0.78);
        scores[k].avg += weighted;
        scores[k].max = Math.max(scores[k].max, weighted);
      }
    }
    scores.forEach(function (item) {
      item.avg /= Math.max(1, tracker.frames.length - 1);
      item.score = item.max * 0.70 + item.avg * 0.30;
    });
    scores.sort(function (a, b2) {
      if (Math.abs(b2.score - a.score) > 0.003) return b2.score - a.score;
      var aw = BEAT_WINDOWS[a.index];
      var bw = BEAT_WINDOWS[b2.index];
      return (aw.endHz - bw.endHz) || ((aw.endHz - aw.startHz) - (bw.endHz - bw.startHz));
    });
    if (!scores.length || scores[0].score < 0.010) return;
    var best = BEAT_WINDOWS[scores[0].index];
    tracker.windowIndex = scores[0].index;
    tracker.hzStart = best.startHz;
    tracker.hzEnd = best.endHz;
    tracker.start = Math.round(clamp(hzToBase(meta, best.startHz), 0, MAX_BAND_START));
    tracker.end = Math.round(clamp(hzToBase(meta, best.endHz), tracker.start + 1, MAX_BAND_END));
    tracker.sensitivity = clamp(0.72 + Math.min(0.24, scores[0].score * 2.8), 0.72, 0.96);
  }

  /** 选定频段的脉冲: 自动跟踪时跟着鼓点窗口走, 手动时按 fx 里的阈值直接比。 */
  function evaluateSelectedTrigger(data, settings, dt, meta, beatData) {
    var trigger = state.trigger;
    var start = settings.autoTrack ? state.autoTrack.start : settings.bandStart;
    var end = settings.autoTrack ? state.autoTrack.end : settings.bandEnd;
    start = Math.round(clamp(start, 0, MAX_BAND_START));
    end = Math.round(clamp(end, start + 1, MAX_BAND_END));
    var manualHz = baseRangeToHz(meta, start, end);
    var hzStart = settings.autoTrack ? state.autoTrack.hzStart : manualHz.startHz;
    var hzEnd = settings.autoTrack ? state.autoTrack.hzEnd : manualHz.endHz;
    var energy = settings.autoTrack && beatData ? beatData.kickLevel : hzRangeAverage(data, meta, hzStart, hzEnd, false);
    var startBin = hzToBin(meta, hzStart, 'floor');
    var endBin = hzToBin(meta, hzEnd, 'ceil');
    var flux = 0;
    var count = 0;
    for (var i = Math.min(startBin, endBin); i <= Math.max(startBin, endBin); i++) {
      var val = (data[i] || 0) / 255;
      var diff = val - (state.prev[i] || 0);
      if (diff > 0.01) flux += diff;
      count++;
    }
    flux /= Math.max(1, count);
    var triggered = false;
    var strength = 0;
    var adaptiveThreshold = 0;
    if (settings.autoTrack) {
      flux = Math.max(flux, beatData ? beatData.kickFlux * 0.72 : 0);
      trigger.smoothedFlux += (flux - trigger.smoothedFlux) * 0.48;
      trigger.history[trigger.historyIndex] = trigger.smoothedFlux;
      trigger.historyIndex = (trigger.historyIndex + 1) % trigger.history.length;
      var stats = fluxStats(trigger.history);
      var thresholdMultiplier = Math.max(0.1, 5.0 - state.autoTrack.sensitivity * 4.0);
      adaptiveThreshold = Math.max(0.01, stats.avg + stats.stdDev * thresholdMultiplier);
      var isPeak = (beatData && beatData.kickOnset > 0) || (flux > adaptiveThreshold && flux > trigger.previousSmoothedFlux * 1.04);
      if (trigger.beatHold > 0) trigger.beatHold--;
      else if (isPeak) {
        triggered = true;
        trigger.beatHold = Math.max(3, Math.round(8 + (1 - settings.pulseStrength / 100) * 10));
        strength = clamp01(Math.max(flux * 24, (beatData ? beatData.kickConfidence : 0) * 0.68 + energy * 0.32) * (settings.pulseStrength / 100));
      }
      trigger.lastEnergy = Math.max(energy, trigger.smoothedFlux * 8);
      trigger.lastThreshold = adaptiveThreshold * 8;
      trigger.previousSmoothedFlux = trigger.smoothedFlux;
    } else {
      trigger.cooldownRemaining = Math.max(0, trigger.cooldownRemaining - Math.max(0, dt || 0));
      var threshold = settings.threshold / 100;
      if (trigger.cooldownRemaining <= 0 && energy > threshold) {
        triggered = true;
        trigger.cooldownRemaining = 0.18;
        strength = clamp01((energy - threshold) / Math.max(0.05, 1 - threshold) + settings.pulseStrength / 220);
      }
      trigger.lastEnergy = energy;
      trigger.lastThreshold = threshold;
    }
    trigger.pulse = Math.max(trigger.pulse * Math.pow(0.10, Math.max(0.001, dt || 1 / 60)), triggered ? strength : 0);
    return {
      triggerBandStart: start,
      triggerBandEnd: end,
      triggerHzStart: hzStart,
      triggerHzEnd: hzEnd,
      triggerEnergy: trigger.lastEnergy,
      triggerThreshold: trigger.lastThreshold,
      triggerPulse: trigger.pulse,
      triggerOnset: triggered ? 1 : 0
    };
  }

  function copyRawAndPrevious(data) {
    ensureBuffers(data.length);
    state.raw.set(data);
  }

  function commitPrevious(data) {
    for (var i = 0; i < data.length; i++) state.prev[i] = (data[i] || 0) / 255;
  }

  /** 暂停 / 无音频时让上一帧按 0.08^dt 衰减, 地形平滑落下去而不是瞬间归零。 */
  function decayFrame(dt) {
    var frame = state.frame;
    var decay = Math.pow(0.08, Math.max(0.001, dt || 1 / 60));
    if (!frame) return null;
    [
      'subBass', 'bass', 'lowMid', 'mid', 'highMid', 'presence', 'brilliance', 'air',
      'body', 'vocal', 'snap', 'lowDrive', 'treble', 'energy', 'kickEnvelope', 'kickLevel',
      'kickFlux', 'kickOnset', 'kickConfidence', 'kickLowDominance', 'triggerEnergy', 'triggerPulse', 'beat'
    ].forEach(function (key) {
      frame[key] = clamp01((Number(frame[key]) || 0) * decay);
    });
    state.trigger.pulse = frame.triggerPulse || 0;
    return frame;
  }

  /**
   * 走一帧分析。
   * @param {Uint8Array} rawData analyser.getByteFrequencyData 的结果
   * @param {number} dt 音频步进秒数
   * @param {object} opts { fx, playing, beat, sampleRate, fftSize, currentTime, now }
   * @returns {object|null} 细粒度帧 (sonicDetailed: true), 没有可用数据时返回衰减帧或 null
   */
  function step(rawData, dt, opts) {
    opts = opts || {};
    var settings = normalizeSettings(opts.fx);
    var playing = opts.playing !== false && rawData && rawData.length && settings.enabled;
    if (!playing) return decayFrame(dt);
    var data = rawData;
    var meta = resolveAnalysisMeta(data, opts);
    state.meta = meta;
    state.frameNow = nowMs(opts);
    ensureBuffers(data.length);
    var currentTime = Number(opts.currentTime);
    if (isFinite(currentTime)) {
      if (state.lastAudioTime > 0 && currentTime + 0.30 < state.lastAudioTime) {
        resetTransientState(meta);
        if (state.prev && state.prev.fill) state.prev.fill(0);
        state.smooth = {};
      }
      state.lastAudioTime = currentTime;
    }
    copyRawAndPrevious(data);
    var now = state.frameNow;
    var values = computeHzBands(data, meta);
    if (settings.autoTrack) trackAutoPulse(data, now, meta, values);
    var lowSum = values.subBass + values.bass + values.lowMid + values.mid * 0.42;
    var midSum = values.mid * 0.58 + values.highMid + values.presence * 0.26;
    var highSum = values.presence * 0.74 + values.brilliance + values.air;
    var totalTone = Math.max(0.001, lowSum + midSum + highSum);
    var legacyMid = clamp01(values.mid * 0.58 + values.highMid * 0.42);
    var legacyTreble = clamp01(values.presence * 0.42 + values.brilliance * 0.38 + values.air * 0.20);
    var energy = values.energy;
    var warmth = lowSum / totalTone;
    var brightness = highSum / totalTone;
    var smooth = state.smooth;
    Object.keys(values).forEach(function (key) {
      smooth[key] = followValue(smooth[key], values[key], 34, 10, dt || 1 / 60);
    });
    smooth.bass = (smooth.bass || 0);
    smooth.treble = followValue(smooth.treble, legacyTreble, 30, 9, dt || 1 / 60);
    smooth.energy = followValue(smooth.energy, energy, 28, 8, dt || 1 / 60);
    var beatData = stepBeatDetector(data, dt || 1 / 60, settings, meta, values);
    var triggerData = evaluateSelectedTrigger(data, settings, dt || 1 / 60, meta, beatData);
    commitPrevious(data);
    var kickEnvelope = clamp01(Math.max(beatData.kickEnvelope, triggerData.triggerPulse, Number(opts.beat) || 0));
    var frame = Object.assign({
      sonicDetailed: true,
      sonicHzDetailed: true,
      bass: smooth.bass || values.bass,
      mid: smooth.mid || values.mid,
      treble: smooth.treble || legacyTreble,
      energy: smooth.energy || energy,
      beat: kickEnvelope,
      warmth: warmth,
      brightness: brightness,
      sharpness: clamp01(brightness * 0.42 + values.snap * 0.14 + beatData.kickOnset * 0.28),
      smoothness: clamp01(1 - legacyTreble * 0.32 + legacyMid * 0.12),
      density: clamp01(0.40 + legacyTreble * 0.24 + values.vocal * 0.12 + kickEnvelope * 0.16)
    }, smooth, beatData, triggerData);
    frame.kickEnvelope = kickEnvelope;
    state.frame = frame;
    return frame;
  }

  function snapshot() {
    var frame = state.frame || {};
    return {
      frame: Object.assign({}, frame),
      rawLength: state.raw ? state.raw.length : 0,
      baseBins: BASE_BINS,
      sampleRate: state.meta ? state.meta.sampleRate : 0,
      fftSize: state.meta ? state.meta.fftSize : 0,
      autoBandStart: state.autoTrack.start,
      autoBandEnd: state.autoTrack.end,
      autoWindowIndex: state.autoTrack.windowIndex,
      lastOnsetAt: state.lastOnsetAt || 0
    };
  }

  /** 切歌 / 停播时清干净, 下一首不会继承上一首的鼓点窗口与通量历史。 */
  function reset() {
    resetTransientState(state.meta);
    if (state.prev && state.prev.fill) state.prev.fill(0);
    state.smooth = {};
    state.frame = null;
    state.lastAudioTime = 0;
    state.lastOnsetAt = 0;
  }

  global.MineradioSonicAudio = {
    BAND_EDGES: BAND_EDGES,
    BEAT_WINDOWS: BEAT_WINDOWS,
    BASE_BINS: BASE_BINS,
    step: step,
    reset: reset,
    snapshot: snapshot,
    settings: normalizeSettings
  };
})(typeof window !== 'undefined' ? window : globalThis);
