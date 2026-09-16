'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/**
 * 读取主渲染器的自适应帧率实现，供空闲降频契约测试使用。
 * @returns {string} 主渲染器源码。
 */
function readRenderSource() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  const start = source.indexOf('function isContinuousPlaybackRenderActive()');
  const end = source.indexOf('function shouldSkipAdaptiveRenderFrame', start);
  assert.ok(start >= 0 && end > start, '未找到自适应帧率实现');
  return source.slice(start, end);
}

/**
 * 在受控音频、交互、压力和画质档位状态下执行自适应帧率函数，验证空闲和播放阶段的降频契约。
 * @param {object} options 测试状态。
 * @returns {number} 当前目标帧率。
 */
function runAdaptiveFps(options) {
  const context = {
    audio: options.audio,
    RENDER_DPR_CAP: 1.35,
    RENDER_PIXEL_BUDGET: 5200000,
    RENDER_MIN_DPR: 0.72,
    RENDER_VISIBLE_VSYNC: true,
    RENDER_IDLE_FPS: 30,
    RENDER_IDLE_FPS_ECO: 24,
    RENDER_PLAYBACK_FPS_CAP: 60,
    RENDER_PLAYBACK_FPS_CAP_ECO: 48,
    fx: { performanceQuality: options.quality || '' },
    normalizePerformanceQuality: v => (/^(eco|balanced|high|ultra)$/.test(String(v || '')) ? v : 'high'),
    isDeepBackgroundMode: () => !!options.deep,
    getRuntimeFramePressureLevel: () => options.pressure || 0,
    isRenderInteractionActive: () => !!options.interaction,
    Math,
  };
  vm.runInNewContext(`${readRenderSource()}\nthis.fps = getAdaptiveRenderFps();`, context);
  return context.fps;
}

test('可见空闲场景将主 3D 渲染限制为 30 FPS，节能档进一步降到 24 FPS', () => {
  assert.equal(runAdaptiveFps({ audio: { src: '', paused: true, ended: false } }), 30);
  assert.equal(runAdaptiveFps({ audio: { src: '', paused: true, ended: false }, quality: 'eco' }), 24);
});

test('稳定播放按画质档位限帧，交互期间保持显示器刷新率', () => {
  assert.equal(runAdaptiveFps({ audio: { src: 'music.mp3', paused: false, ended: false } }), 60);
  assert.equal(runAdaptiveFps({ audio: { src: 'music.mp3', paused: false, ended: false }, quality: 'eco' }), 48);
  assert.equal(runAdaptiveFps({ audio: { src: 'music.mp3', paused: false, ended: false }, quality: 'balanced' }), 60);
  assert.equal(runAdaptiveFps({ audio: { src: 'music.mp3', paused: false, ended: false }, quality: 'ultra' }), 0);
  assert.equal(runAdaptiveFps({ audio: { src: '', paused: true, ended: false }, interaction: true }), 0);
});

test('后台和帧压力量级继续沿用原有降载策略', () => {
  assert.equal(runAdaptiveFps({ audio: { src: '', paused: true, ended: false }, deep: true }), 1);
  assert.equal(runAdaptiveFps({ audio: { src: '', paused: true, ended: false }, pressure: 2 }), 48);
  assert.equal(runAdaptiveFps({ audio: { src: '', paused: true, ended: false }, pressure: 2, interaction: true }), 60);
});
