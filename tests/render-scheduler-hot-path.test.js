'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');

/**
 * 读取主渲染器的调度实现，验证空闲和交互态使用不同唤醒机制。
 * @returns {string} 主渲染器调度源码。
 */
function readMainSchedulerSource() {
  const source = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
  const start = source.indexOf('var mainRenderFrameId = 0;');
  const end = source.indexOf('function suspendMainRenderLoop', start);
  assert.ok(start >= 0 && end > start, '未找到主渲染器调度实现');
  return source.slice(start, end);
}

/**
 * 读取壁纸覆盖层源码，验证关闭态释放资源并降低唤醒频率。
 * @returns {string} 壁纸覆盖层源码。
 */
function readWallpaperSource() {
  return fs.readFileSync(path.join(root, 'public', 'wallpaper.html'), 'utf8');
}

/**
 * 读取性能采样函数，验证缓存回收检查只随秒级采样执行。
 * @returns {string} 性能采样源码。
 */
function readRenderPerfSource() {
  const source = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
  const start = source.indexOf('function sampleRenderPerf(now, dt) {');
  const end = source.indexOf('\nfunction consumeAudioAnalysisDelta', start);
  assert.ok(start >= 0 && end > start, '未找到性能采样实现');
  return source.slice(start, end);
}

/**
 * 读取主循环帧入口，验证同一帧只计算一次自适应目标帧率。
 * @returns {string} 主循环帧入口源码。
 */
function readAnimateSource() {
  const source = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
  const start = source.indexOf('function animate() {');
  const end = source.indexOf("\nresumeMainRenderLoop('startup');", start);
  assert.ok(start >= 0 && end > start, '未找到主循环实现');
  return source.slice(start, end);
}

test('主渲染器空闲态使用定时器，交互态切回 RAF', () => {
  const timers = [];
  const rafs = [];
  const context = {
    RENDER_IDLE_FPS: 30,
    isDeepBackgroundMode: () => false,
    getAdaptiveRenderFps: () => 30,
    setTimeout: (fn, delay) => {
      timers.push({ fn, delay });
      return timers.length;
    },
    clearTimeout: (id) => { timers[id - 1] = null; },
    requestAnimationFrame: (fn) => {
      rafs.push(fn);
      return 100 + rafs.length;
    },
    cancelAnimationFrame: () => {},
    animate: () => {}
  };
  vm.runInNewContext(`${readMainSchedulerSource()}\nthis.schedule = scheduleMainRenderFrame;`, context);

  assert.equal(context.schedule(), true);
  assert.equal(context.mainRenderScheduleKind, 'idle-timeout');
  assert.equal(timers.filter(Boolean).length, 1);
  assert.equal(timers[0].delay, 33);

  context.getAdaptiveRenderFps = () => 0;
  assert.equal(context.schedule(), true);
  assert.equal(context.mainRenderScheduleKind, 'raf');
  assert.equal(timers[0], null, '切回 RAF 前应取消尚未到期的空闲定时器');
  assert.equal(rafs.length, 1);
});

test('运行时缓存回收检查只在秒级性能采样时执行', () => {
  const source = readRenderPerfSource();
  assert.equal((source.match(/maybeTrimRuntimeCaches\(now\);/g) || []).length, 1);
  assert.match(source, /if \(now - renderPerfState\.lastSampleAt >= 1000\) \{[\s\S]*maybeTrimRuntimeCaches\(now\);/);
});

test('主循环复用当前帧自适应 FPS 和时间戳', () => {
  const source = readAnimateSource();
  assert.match(source, /var now = performance\.now\(\);\s*var frameFps = getAdaptiveRenderFps\(now\);/);
  assert.match(source, /scheduleMainRenderFrame\(frameFps\);/);
  assert.match(source, /shouldSkipAdaptiveRenderFrame\(now, frameFps\)/);
  assert.doesNotMatch(source, /scheduleMainRenderFrame\(\);/);
  assert.doesNotMatch(source, /shouldSkipAdaptiveRenderFrame\(now\);/);
});

test('壁纸覆盖层关闭时释放封面和粒子，并在未播放时限频', () => {
  const source = readWallpaperSource();
  assert.match(source, /var wallpaperDrawHandle = 0;/);
  assert.match(source, /var WALLPAPER_IDLE_FPS = 30;/);
  assert.match(source, /var WALLPAPER_DISABLED_DELAY = 1000;/);
  assert.match(source, /if \(!state\.enabled\) \{[\s\S]*state\.cover = '';[\s\S]*particles\.length = 0;/);
  assert.match(source, /if \(state\.enabled && state\.playing\) \{/);
  assert.match(source, /state\.enabled \? Math\.max\(16, Math\.round\(1000 \/ WALLPAPER_IDLE_FPS\)\) : WALLPAPER_DISABLED_DELAY/);
  assert.match(source, /if \(!state\.enabled\) \{[\s\S]*ctx\.clearRect\(0, 0, innerWidth, innerHeight\);[\s\S]*scheduleNextDraw\(\);/);
});
