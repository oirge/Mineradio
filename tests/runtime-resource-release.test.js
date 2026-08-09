'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');

function extractFunction(name) {
  const marker = `function ${name}(`;
  const start = appSource.indexOf(marker);
  assert.notEqual(start, -1, `缺少函数 ${name}`);
  const bodyStart = appSource.indexOf('{', start);
  let depth = 0;
  for (let i = bodyStart; i < appSource.length; i += 1) {
    if (appSource[i] === '{') depth += 1;
    else if (appSource[i] === '}') {
      depth -= 1;
      if (depth === 0) return appSource.slice(start, i + 1);
    }
  }
  throw new Error(`函数 ${name} 未闭合`);
}

test('启动页退出后释放 Canvas WebGL 和不可见 resize 工作', () => {
  assert.match(appSource, /function releaseMineradioSplashResources\(\)/);
  assert.match(appSource, /window\.removeEventListener\('resize', splashResizeHandler\)/);
  assert.match(appSource, /splashGl\.deleteBuffer\(splashGlBuffer\)/);
  assert.match(appSource, /splashGl\.deleteProgram\(splashGlProgram\)/);
  assert.match(appSource, /getExtension\('WEBGL_lose_context'\)/);
  assert.match(appSource, /splashDust\.length = 0;/);
  assert.match(appSource, /splashStreaks\.length = 0;/);
  assert.match(appSource, /splashShards\.length = 0;/);
  assert.match(appSource, /splashCanvas\.width = 1;[\s\S]*splashCanvas\.height = 1;/);
  assert.match(appSource, /splashAnimating = false;\s*releaseMineradioSplashResources\(\);/);

  const removed = [];
  const deleted = [];
  const canvas = { width: 1920, height: 1080 };
  let lost = false;
  const context = {
    window: {
      removeEventListener(type, handler) { removed.push([type, handler]); }
    },
    splashResizeHandler() {},
    splashGlBuffer: { id: 'buffer' },
    splashGlProgram: { id: 'program' },
    splashGlUniforms: { id: 'uniforms' },
    splashGl: {
      deleteBuffer(value) { deleted.push(['buffer', value]); },
      deleteProgram(value) { deleted.push(['program', value]); },
      getExtension(name) {
        assert.equal(name, 'WEBGL_lose_context');
        return { loseContext() { lost = true; } };
      }
    },
    splashCtx: { id: '2d' },
    splashDust: [1, 2],
    splashStreaks: [1],
    splashShards: [1, 2, 3],
    splashW: 1920,
    splashH: 1080,
    splashPixelRatio: 1.36,
    splashCanvas: canvas
  };
  vm.runInNewContext(`${extractFunction('releaseMineradioSplashResources')}\nreleaseMineradioSplashResources();`, context);

  assert.equal(removed.length, 1);
  assert.equal(removed[0][0], 'resize');
  assert.deepEqual(deleted.map((entry) => entry[0]), ['buffer', 'program']);
  assert.equal(lost, true);
  assert.equal(canvas.width, 1);
  assert.equal(canvas.height, 1);
  assert.equal(context.splashDust.length, 0);
  assert.equal(context.splashStreaks.length, 0);
  assert.equal(context.splashShards.length, 0);
  assert.equal(context.splashCanvas, null);
  assert.equal(context.splashGl, null);
});

test('启动音效结束后关闭独立 AudioContext', () => {
  assert.match(appSource, /splashAudioCloseTimer = setTimeout\(function\(\)\{/);
  assert.match(appSource, /if \(splashAudioCtx !== ctx\) return;\s*splashAudioCtx = null;/);
  assert.match(appSource, /var closed = ctx\.close && ctx\.close\(\);/);
  assert.match(appSource, /\}, 5600\);/);
});

test('深后台取消主 3D RAF 并由恢复入口单次重启', () => {
  const schedulerSource = extractFunction('scheduleMainRenderFrame');
  const animationRequests = schedulerSource.match(/requestAnimationFrame\(function\(\)\s*\{/g) || [];
  assert.equal(animationRequests.length, 1, '主 3D RAF 只能由 scheduleMainRenderFrame 调度');
  assert.match(appSource, /function scheduleMainRenderFrame\([^)]*\)[\s\S]*mainRenderFrameId = requestAnimationFrame\(function\(\)\s*\{/);
  assert.match(appSource, /function scheduleMainRenderFrame\([^)]*\)[\s\S]*mainRenderFrameId = setTimeout\(function\(\)/);
  assert.match(appSource, /function suspendMainRenderLoop\(reason\)[\s\S]*cancelMainRenderFrame\(\);/);
  assert.match(appSource, /function animate\(\) \{\s*mainRenderFrameId = 0;\s*mainRenderScheduleKind = '';\s*if \(isDeepBackgroundMode\(\)\) \{\s*suspendMainRenderLoop\('deep-background-frame'\);\s*return;/);
  assert.match(appSource, /function recoverVisualsAfterBackground\(reason\) \{\s*resumeMainRenderLoop\(reason \|\| 'restore'\);/);
  assert.match(appSource, /resumeMainRenderLoop\('startup'\);/);
  assert.match(appSource, /function scheduleDesktopOverlaySync\(/, '桌面覆盖层继续保留独立调度器');

  let deep = false;
  const requested = [];
  const cancelled = [];
  const context = {
    mainRenderFrameId: 0,
    mainRenderScheduleKind: '',
    mainRenderLoopSuspended: false,
    renderPerfState: { mode: 'vsync', lastRenderAt: 55 },
    prevTime: 0,
    RENDER_IDLE_FPS: 30,
    getAdaptiveRenderFps() { return 0; },
    animate() {},
    requestAnimationFrame(callback) {
      requested.push(callback);
      return requested.length;
    },
    cancelAnimationFrame(id) { cancelled.push(id); },
    isDeepBackgroundMode() { return deep; },
    performance: { now() { return 1234; } },
    window: {},
    clearTimeout() {}
  };
  vm.runInNewContext([
    extractFunction('cancelMainRenderFrame'),
    extractFunction('mainRenderScheduleKindForState'),
    extractFunction('scheduleMainRenderFrame'),
    extractFunction('suspendMainRenderLoop'),
    extractFunction('resumeMainRenderLoop'),
    extractFunction('syncMainRenderLoopPowerState')
  ].join('\n'), context);

  assert.equal(context.resumeMainRenderLoop('test-start'), true);
  assert.equal(requested.length, 1);
  assert.equal(context.resumeMainRenderLoop('duplicate'), false);
  assert.equal(requested.length, 1, '已有 RAF 时不得重复排队');
  deep = true;
  context.syncMainRenderLoopPowerState('test-hidden');
  assert.deepEqual(cancelled, [1]);
  assert.equal(context.mainRenderFrameId, 0);
  assert.equal(context.mainRenderLoopSuspended, true);
  assert.equal(context.renderPerfState.mode, 'suspended');
  deep = false;
  context.syncMainRenderLoopPowerState('test-visible');
  assert.equal(requested.length, 2);
  assert.equal(context.mainRenderLoopSuspended, false);
  assert.equal(context.prevTime, 1234);
});
