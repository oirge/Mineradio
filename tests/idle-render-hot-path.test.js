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
 * 在受控音频、交互和压力状态下执行自适应帧率函数，验证空闲场景不再跟随高刷空转。
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
    isDeepBackgroundMode: () => !!options.deep,
    getRuntimeFramePressureLevel: () => options.pressure || 0,
    isRenderInteractionActive: () => !!options.interaction,
    Math,
  };
  vm.runInNewContext(`${readRenderSource()}\nthis.fps = getAdaptiveRenderFps();`, context);
  return context.fps;
}

test('可见空闲场景将主 3D 渲染限制为 30 FPS', () => {
  assert.equal(runAdaptiveFps({ audio: { src: '', paused: true, ended: false } }), 30);
});

test('播放或交互期间保持显示器刷新率', () => {
  assert.equal(runAdaptiveFps({ audio: { src: 'music.mp3', paused: false, ended: false } }), 0);
  assert.equal(runAdaptiveFps({ audio: { src: '', paused: true, ended: false }, interaction: true }), 0);
});

test('后台和帧压力量级继续沿用原有降载策略', () => {
  assert.equal(runAdaptiveFps({ audio: { src: '', paused: true, ended: false }, deep: true }), 1);
  assert.equal(runAdaptiveFps({ audio: { src: '', paused: true, ended: false }, pressure: 2 }), 48);
  assert.equal(runAdaptiveFps({ audio: { src: '', paused: true, ended: false }, pressure: 2, interaction: true }), 60);
});
