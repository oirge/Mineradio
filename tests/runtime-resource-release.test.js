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

test('直接启动不再分配启动页 Canvas WebGL 和 resize 工作', () => {
  assert.doesNotMatch(appSource, /\b(?:splashCanvas|splashCtx|splashGl|splashGlProgram|splashGlBuffer|splashGlUniforms|splashResizeHandler)\b/);
  assert.doesNotMatch(appSource, /\b(?:splashDust|splashStreaks|splashShards|splashPixelRatio|splashAnimating)\b/);
  assert.doesNotMatch(appSource, /\b(?:initMineradioSplashWebgl|initMineradioSplashCanvas|releaseMineradioSplashResources|drawMineradioSplash)\b/);
  assert.doesNotMatch(extractFunction('initializePlayerHome'), /getContext|createElement|addEventListener\('resize'/);
});

test('直接启动不再创建独立音效 AudioContext 或解锁监听', () => {
  assert.doesNotMatch(appSource, /\b(?:splashAudioCtx|splashAudioCloseTimer|splashSoundPlayed|splashSoundFallbackArmed)\b/);
  assert.doesNotMatch(appSource, /\b(?:playMineradioIntroSound|armSplashSoundFallback)\b/);
  assert.doesNotMatch(appSource, /\b(?:splashTimer|splashAutoEnterTimer|splashReadyToEnter|markSplashReadyToEnter|dismissSplash)\b/);
  assert.doesNotMatch(extractFunction('initializePlayerHome'), /AudioContext|pointerdown|keydown/);
});

test('记住 Folia 启动时不创建主场景 WebGL 和贴图，切回后只初始化一次', () => {
  const allocations = [];
  const sizes = [];
  const canvas = { style: {} };
  const mounted = [];
  const shelfModes = [];
  const dotTexture = {};
  let textureAllocations = 0;
  const context = vm.createContext({
    document: {
      documentElement: { classList: { contains: name => name === 'folia-mode-preload' } },
      createElement: tag => { assert.equal(tag, 'canvas'); return canvas; },
      getElementById: id => { assert.equal(id, 'canvas-container'); return { appendChild: child => mounted.push(child) }; },
    },
    THREE: { WebGLRenderer: function (options) {
      allocations.push(options);
      this.domElement = options.canvas;
      this.setClearColor = (color, alpha) => assert.deepEqual([color, alpha], [0, 0]);
    } },
    makeDotTexture: () => { textureAllocations++; return dotTexture; },
    deferredShelfSceneMode: 'stage',
    shelfManager: { setMode: mode => shelfModes.push(mode) },
    resizeMainSceneRenderer: () => sizes.push('initial-viewport'),
  });
  const init = appSource.indexOf("var mainSceneCanvas = document.createElement('canvas');");
  const end = appSource.indexOf('function isMainSceneHiddenByFolia()', init);
  assert.ok(init >= 0 && end > init);
  vm.runInContext([appSource.slice(init, end), extractFunction('isMainSceneHiddenByFolia'), extractFunction('ensureMainSceneRenderer')].join('\n'), context);
  assert.deepEqual(mounted, [canvas]);
  assert.equal(context.renderer, null);
  assert.equal(allocations.length, 0);
  assert.equal(context.particleDotUniform.value, null);
  assert.equal(textureAllocations, 0);
  assert.deepEqual(shelfModes, []);
  context.isFoliaInterfaceActive = () => true;
  assert.equal(context.isMainSceneHiddenByFolia(), true);
  context.isFoliaInterfaceActive = () => false;
  assert.equal(context.isMainSceneHiddenByFolia(), false);
  context.ensureMainSceneRenderer();
  context.ensureMainSceneRenderer();
  assert.equal(context.renderer.domElement, canvas);
  assert.equal(allocations.length, 1);
  assert.equal(context.particleDotUniform.value, dotTexture);
  assert.equal(textureAllocations, 1);
  assert.deepEqual(shelfModes, ['stage']);
  assert.equal(context.deferredShelfSceneMode, null);
  assert.deepEqual(sizes, ['initial-viewport']);
});

test('深后台取消主 3D RAF 并由恢复入口单次重启', () => {
  const schedulerSource = extractFunction('scheduleMainRenderFrame');
  const animationRequests = schedulerSource.match(/requestAnimationFrame\(function\(\)\s*\{/g) || [];
  assert.equal(animationRequests.length, 1, '主 3D RAF 只能由 scheduleMainRenderFrame 调度');
  assert.match(appSource, /function scheduleMainRenderFrame\([^)]*\)[\s\S]*mainRenderFrameId = requestAnimationFrame\(function\(\)\s*\{/);
  assert.match(appSource, /function scheduleMainRenderFrame\([^)]*\)[\s\S]*mainRenderFrameId = setTimeout\(function\(\)/);
  assert.match(appSource, /function suspendMainRenderLoop\(reason\)[\s\S]*cancelMainRenderFrame\(\);/);
  assert.match(extractFunction('animate'), /if \(isDeepBackgroundMode\(\)\) \{\s*suspendMainRenderLoop\('deep-background-frame'\);\s*return;/);
  assert.match(appSource, /function recoverVisualsAfterBackground\(reason\) \{\s*resumeMainRenderLoop\(reason \|\| 'restore'\);/);
  assert.match(appSource, /resumeMainRenderLoop\('startup'\);/);
  assert.match(appSource, /function scheduleDesktopOverlaySync\(/, '桌面覆盖层继续保留独立调度器');

  let deep = false;
  let folia = false;
  const requested = [];
  const cancelled = [];
  const context = {
    mainRenderFrameId: 0,
    mainRenderScheduleKind: '',
    mainRenderLoopSuspended: false,
    mainRenderStartupReady: false,
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
    document: { documentElement: { classList: { contains: name => name === 'folia-mode-preload' } } },
    performance: { now() { return 1234; } },
    window: {},
    clearTimeout() {}
  };
  vm.runInNewContext([
    extractFunction('isMainSceneHiddenByFolia'),
    extractFunction('cancelMainRenderFrame'),
    extractFunction('mainRenderScheduleKindForState'),
    extractFunction('scheduleMainRenderFrame'),
    extractFunction('suspendMainRenderLoop'),
    extractFunction('resumeMainRenderLoop'),
    extractFunction('syncMainRenderLoopPowerState')
  ].join('\n'), context);

  assert.equal(context.resumeMainRenderLoop('test-start'), false);
  assert.equal(requested.length, 0);
  context.isFoliaInterfaceActive = () => folia;
  assert.equal(context.resumeMainRenderLoop('test-before-home'), false);
  assert.equal(context.scheduleMainRenderFrame(), false);
  assert.equal(requested.length, 0, '首页就绪前不能排队编译 GPU 着色器');
  context.mainRenderStartupReady = true;
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
  folia = true;
  context.syncMainRenderLoopPowerState('folia-interface');
  assert.equal(context.mainRenderLoopSuspended, true);
  assert.deepEqual(cancelled, [1, 2]);
  assert.equal(context.resumeMainRenderLoop('background-recovery'), false);
  assert.equal(context.scheduleMainRenderFrame(), false);
  assert.equal(requested.length, 2, 'Folia 显示期间宿主可视化不得被恢复入口唤醒');
  folia = false;
  context.syncMainRenderLoopPowerState('mineradio-interface');
  assert.equal(requested.length, 3);
  assert.equal(context.mainRenderLoopSuspended, false);
});
