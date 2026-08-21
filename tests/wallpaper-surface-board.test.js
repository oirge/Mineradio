'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const cssSource = fs.readFileSync(path.join(root, 'public', 'app.css'), 'utf8');
const effectSource = fs.readFileSync(path.join(root, 'public', 'wallpaper-effect.js'), 'utf8');
const overlaySource = fs.readFileSync(path.join(root, 'public', 'wallpaper.html'), 'utf8');

/**
 * 从 renderer 源码截取一个真实函数声明，供纯 Node VM 验证展示位置分流。
 * @param {string} source 完整 renderer 源码。
 * @param {string} name 目标函数名。
 * @param {string} nextName 紧随其后的函数名。
 * @returns {string} 目标函数源码。
 */
function extractRendererFunction(source, name, nextName) {
  const start = source.indexOf('function ' + name + '(');
  const end = source.indexOf('function ' + nextName + '(', start + 1);
  assert.ok(start >= 0 && end > start, '未找到 renderer 函数：' + name);
  return source.slice(start, end);
}

/**
 * 构造 applyWallpaperModeState 的最小运行环境。
 * @param {object} fx 壁纸相关 fx 状态。
 * @returns {object} VM 上下文与调用记录。
 */
function createApplyContext(fx) {
  const calls = { setWallpaperMode: [], boardSurface: [], boardPush: 0, desktopPush: 0, payloads: 0 };
  const context = {
    fx,
    console,
    performance: { now: () => 1000 },
    /** @returns {boolean} 测试环境不锁定壁纸模式。 */
    isDevelopmentLockedFx: () => false,
    /** @returns {void} 测试状态已归一化。 */
    normalizeDevelopmentLockedFxState: () => {},
    /** @returns {void} 测试不启动同步计时器。 */
    scheduleDesktopOverlaySync: () => {},
    /** @returns {object} 假桌面 API。 */
    getDesktopWindowApi: () => ({
      /**
       * 记录桌面壁纸层开关调用。
       * @param {boolean} enabled 是否启用。
       * @param {object} payload 状态载荷。
       * @returns {Promise<object>} 假 IPC 结果。
       */
      setWallpaperMode(enabled, payload) {
        calls.setWallpaperMode.push({ enabled, payload });
        return Promise.resolve({ ok: true });
      },
      /** @returns {Promise<object>} 假 IPC 结果。 */
      updateWallpaperMode() {
        calls.desktopPush += 1;
        return Promise.resolve({ ok: true });
      },
    }),
    /** @returns {object} 假壁纸载荷。 */
    wallpaperPayload() {
      calls.payloads += 1;
      return { enabled: true, cover: 'data:image/png;base64,' + 'A'.repeat(64) };
    },
    /**
     * 记录封面释放。
     * @param {object} payload 载荷。
     * @returns {void}
     */
    releaseWallpaperTransferFields(payload) {
      if (payload) payload.cover = '';
    },
    wallpaperPayloadCache: {},
    desktopOverlayPushState: { wallpaperAt: 88, lastWallpaperKey: '旧签名' },
    /**
     * 记录背景板挂载/释放请求。
     * @param {boolean} active 是否启用背景板。
     * @param {boolean} force 是否强制刷新。
     * @returns {void}
     */
    syncWallpaperBoardSurface(active, force) {
      calls.boardSurface.push({ active, force });
    },
    /** @returns {void} 记录背景板状态推送。 */
    pushWallpaperBoardState() {
      calls.boardPush += 1;
    },
    /** @returns {void} 记录桌面壁纸层增量状态推送。 */
    pushWallpaperState() {
      calls.desktopPush += 1;
    },
  };
  vm.runInNewContext(
    extractRendererFunction(appSource, 'applyWallpaperModeState', 'syncDesktopOverlayState')
      + '\nthis.applyState = applyWallpaperModeState;',
    context,
  );
  context.applyState(true);
  return { context, calls };
}

test('壁纸展示位置归一化到桌面壁纸层或播放器背景板', () => {
  const context = { };
  vm.runInNewContext(
    extractRendererFunction(appSource, 'normalizeWallpaperSurface', 'normalizeShelfCameraMode')
      + '\nthis.normalize = normalizeWallpaperSurface;',
    context,
  );
  assert.equal(context.normalize('board'), 'board');
  assert.equal(context.normalize('desktop'), 'desktop');
  assert.equal(context.normalize(''), 'desktop');
  assert.equal(context.normalize(null), 'desktop');
  assert.equal(context.normalize('BOARD'), 'desktop');
  assert.equal(context.normalize('随便填的值'), 'desktop');
});

test('选择播放器背景板时关闭桌面壁纸覆盖窗口并只画在窗口内', () => {
  const { calls } = createApplyContext({ wallpaperMode: true, wallpaperSurface: 'board' });
  assert.deepEqual(calls.boardSurface, [{ active: true, force: true }]);
  assert.equal(calls.boardPush, 1);
  assert.equal(calls.setWallpaperMode.length, 1);
  assert.equal(calls.setWallpaperMode[0].enabled, false);
  assert.deepEqual(Object.keys(calls.setWallpaperMode[0].payload), ['enabled']);
  assert.equal(calls.payloads, 0, '背景板模式不应构造桌面覆盖层载荷');
  assert.equal(calls.desktopPush, 0);
});

test('选择桌面壁纸层时释放背景板并走覆盖窗口 IPC', () => {
  const { context, calls } = createApplyContext({ wallpaperMode: true, wallpaperSurface: 'desktop' });
  assert.deepEqual(calls.boardSurface, [{ active: false, force: true }]);
  assert.equal(calls.boardPush, 0);
  assert.equal(calls.setWallpaperMode.length, 1);
  assert.equal(calls.setWallpaperMode[0].enabled, true);
  assert.equal(calls.setWallpaperMode[0].payload.cover, '', '发送后必须清掉复用载荷上的封面 data URL');
  assert.equal(calls.desktopPush, 1);
  assert.equal(context.desktopOverlayPushState.lastWallpaperKey.length > 0, true);
});

test('壁纸关闭时两个展示位置同时释放', () => {
  const { context, calls } = createApplyContext({ wallpaperMode: false, wallpaperSurface: 'board' });
  assert.deepEqual(calls.boardSurface, [{ active: false, force: true }]);
  assert.equal(calls.boardPush, 0);
  assert.equal(calls.payloads, 0);
  assert.equal(calls.setWallpaperMode[0].enabled, false);
  assert.equal(context.desktopOverlayPushState.wallpaperAt, 0);
  assert.equal(context.desktopOverlayPushState.lastWallpaperKey, '');
});

test('背景板模式不再向主进程推送壁纸状态', () => {
  const context = {
    fx: { wallpaperMode: true, wallpaperSurface: 'board' },
    console,
    performance: { now: () => 1000 },
    /** @returns {boolean} 测试环境不锁定壁纸模式。 */
    isDevelopmentLockedFx: () => false,
    updates: 0,
    /** @returns {object} 假桌面 API。 */
    getDesktopWindowApi() {
      return {
        /** @returns {Promise<object>} 假 IPC 结果。 */
        updateWallpaperMode: () => {
          context.updates += 1;
          return Promise.resolve({ ok: true });
        },
      };
    },
    /** @returns {object} 禁止在背景板模式下构造覆盖层载荷。 */
    wallpaperPayload() {
      throw new Error('背景板模式不应构造桌面覆盖层载荷');
    },
    /** @returns {void} 未使用。 */
    releaseWallpaperTransferFields() {},
    wallpaperPayloadCache: {},
    desktopOverlayPushState: { wallpaperAt: 0, lastWallpaperKey: '' },
  };
  vm.runInNewContext(
    extractRendererFunction(appSource, 'pushWallpaperState', 'applyWallpaperModeState')
      + '\nthis.pushState = pushWallpaperState;',
    context,
  );
  context.pushState(true);
  assert.equal(context.updates, 0);
});

test('壁纸展示位置有分段控件、背景板画布和持久化 schema', () => {
  assert.match(indexSource, /<canvas id="wallpaper-board" aria-hidden="true"><\/canvas>/);
  assert.match(indexSource, /id="wallpaper-surface-seg"/);
  assert.match(indexSource, /data-wallpaper-surface="desktop"/);
  assert.match(indexSource, /data-wallpaper-surface="board"/);
  assert.match(indexSource, /<script src="wallpaper-effect\.js"><\/script>/);
  assert.doesNotMatch(
    indexSource,
    /id="t-wallpaperMode"[^>]*dev-locked/,
    '壁纸模式开关不应再被标记为开发中',
  );
  assert.match(cssSource, /#wallpaper-board\{position:fixed;inset:0;z-index:0;/);
  assert.match(cssSource, /body\.wallpaper-board-active #album-bg\{opacity:0!important\}/);
  // 背景板必须排在 #custom-bg 和 Wallpaper Engine 层之前，用户自选背景才能继续盖在上面。
  assert.ok(
    indexSource.indexOf('id="wallpaper-board"') < indexSource.indexOf('id="custom-bg"'),
    '壁纸背景板不能盖住用户自选背景',
  );
  assert.ok(
    indexSource.indexOf('id="wallpaper-board"') < indexSource.indexOf('id="wallpaper-engine-layer"'),
    '壁纸背景板不能盖住 Wallpaper Engine 壁纸',
  );
  assert.match(appSource, /var WALLPAPER_SURFACE_SCHEMA = 'wallpaper-surface-v1';/);
  assert.match(appSource, /wallpaperSchema: WALLPAPER_SURFACE_SCHEMA/);
  assert.match(appSource, /raw\.wallpaperSchema === WALLPAPER_SURFACE_SCHEMA/);
  assert.match(appSource, /wallpaperMode: wallpaperSchemaReady \? raw\.wallpaperMode === true : false/);
  assert.match(appSource, /setFxSectionBefore\('wallpaper-surface-seg', '壁纸展示位置'\)/);
  assert.match(appSource, /#wallpaper-surface-seg \[data-wallpaper-surface\]/);
});

test('两个展示位置共用同一份壁纸画面实现', () => {
  assert.match(effectSource, /global\.createMineradioWallpaperEffect = createMineradioWallpaperEffect;/);
  assert.match(effectSource, /return \{[\s\S]*applyState: applyState,[\s\S]*setPaused: setOverlayRenderPaused,[\s\S]*dispose: dispose/);
  assert.match(overlaySource, /<script src="wallpaper-effect\.js"><\/script>/);
  assert.match(overlaySource, /window\.createMineradioWallpaperEffect\(/);
  assert.match(appSource, /window\.createMineradioWallpaperEffect\(canvas\)/);
  assert.doesNotMatch(overlaySource, /function draw\(/, '覆盖层不应再保留一份重复的画面实现');
});

test('背景板释放后不残留画面实例与封面引用', () => {
  const releaseSource = extractRendererFunction(appSource, 'releaseWallpaperBoard', 'pushWallpaperBoardState');
  assert.match(releaseSource, /applyState\(\{ enabled: false, cover: '', playing: false \}\)/);
  assert.match(releaseSource, /\.dispose\(\)/);
  assert.match(releaseSource, /wallpaperBoardEffect = null/);
  assert.match(releaseSource, /classList\.remove\('mounted', 'active'\)/);
  assert.match(releaseSource, /classList\.remove\('wallpaper-board-active'\)/);
  const pushSource = extractRendererFunction(appSource, 'pushWallpaperBoardState', 'syncWallpaperBoardSurface');
  assert.match(pushSource, /releaseWallpaperTransferFields\(payload \|\| wallpaperPayloadCache\)/);
});
