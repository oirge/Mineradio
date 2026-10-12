const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const main = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'main.js'), 'utf8');
function section(start, end) {
  const a = main.indexOf(start);
  const b = main.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `${start} source range`);
  return main.slice(a, b);
}

test('hidden QA requires the explicit flag and an isolated lyric-sync QA profile', () => {
  const source = section('const QA_HIDDEN =', 'const INSTANCE_APP_NAME =');
  for (const [flag, instanceId, primary, expected] of [
    ['1', 'lyric-sync-qa-check', false, true],
    [undefined, 'lyric-sync-qa-check', false, false],
    ['true', 'lyric-sync-qa-check', false, false],
    ['1', undefined, true, false],
    ['1', 'oirge', false, false],
    ['1', 'lyric-sync-qa-', false, false],
    ['1', 'lyric-sync-qa-check', true, false],
  ]) {
    const app = {};
    const listeners = new Map();
    app.on = (event, handler) => listeners.set(event, handler);
    const hidden = vm.runInNewContext(source + '\nQA_HIDDEN', {
      process: { env: { MINERADIO_QA_HIDDEN: flag, MINERADIO_INSTANCE_ID: instanceId } },
      INSTANCE_PROFILE: { primary }, INSTANCE_ID: instanceId, app,
    });
    assert.equal(hidden, expected);
    assert.equal(!!app.__mineradioQaHidden, expected);
    assert.equal(listeners.has('browser-window-created'), expected);
  }
});

test('QA audit records every window from its initial hidden creation', () => {
  const app = {}, listeners = new Map(), windowListeners = new Map();
  app.on = (event, handler) => listeners.set(event, handler);
  vm.runInNewContext(section('const QA_HIDDEN =', 'const INSTANCE_APP_NAME ='), {
    process: { env: { MINERADIO_QA_HIDDEN: '1', MINERADIO_INSTANCE_ID: 'lyric-sync-qa-check' } },
    INSTANCE_PROFILE: { primary: false }, INSTANCE_ID: 'lyric-sync-qa-check', app,
  });
  let visible = false;
  listeners.get('browser-window-created')(null, {
    id: 7, isVisible: () => visible, on: (event, handler) => windowListeners.set(event, handler),
  });
  assert.equal(app.__mineradioQaHidden.events[0].event, 'created');
  assert.equal(app.__mineradioQaHidden.events[0].visible, false);
  for (const event of ['show', 'focus', 'restore']) assert.ok(windowListeners.has(event));
  visible = true;
  windowListeners.get('show')();
  assert.equal(app.__mineradioQaHidden.events[1].visible, true, 'transient visibility remains detectable');
});

test('hidden QA blocks focus and restoration without changing normal player behavior', () => {
  const source = section('function focusMainWindow()', '/**\n * 读取桌面壳设置');
  for (const hidden of [true, false]) {
    const calls = [];
    const c = vm.createContext({
      QA_HIDDEN: hidden, miniPlayerActive: true, mainWindowIntentionalHide: true,
      mainWindow: { isDestroyed: () => false, isMinimized: () => true, isVisible: () => false,
        restore: () => calls.push('restore'), show: () => calls.push('show'), focus: () => calls.push('focus') },
      hideMiniPlayerWindow: () => calls.push('hide-mini'), sendWindowState: () => calls.push('state'),
    });
    vm.runInContext(source, c);
    assert.equal(c.focusMainWindow(), true);
    assert.deepEqual(calls, hidden ? [] : ['hide-mini', 'restore', 'show', 'focus', 'state']);
  }
});

test('hidden QA disables startup and fullscreen visibility recovery watchdogs', () => {
  let timers = 0, clears = 0, shows = 0;
  const c = vm.createContext({
    QA_HIDDEN: true, appQuitting: false, mainWindowIntentionalHide: false,
    clearMainWindowShowWatchdog: () => clears++,
    setTimeout: () => { timers++; return { unref() {} }; },
    setInterval: () => { timers++; return { unref() {} }; },
    clearInterval: () => {}, mainWindowFullscreenVisibilityTimer: null,
    mainWindowShowWatchdogTimer: null, MAIN_WINDOW_SHOW_WATCHDOG_MS: 6000,
    FULLSCREEN_VISIBILITY_CHECK_MS: 5000, sendWindowState: () => {},
    console,
  });
  vm.runInContext(
    section('function shouldRestoreUnexpectedFullscreenVisibility(', '// 主窗口绘制恢复。')
      + section('function armMainWindowShowWatchdog(', '/**\n * 强制主窗口重画'),
    c
  );
  const win = { isDestroyed: () => false, isFullScreen: () => true, isMinimized: () => false,
    isVisible: () => false, show: () => shows++, showInactive: () => shows++ };
  assert.equal(c.restoreUnexpectedFullscreenVisibility(win), false);
  c.armMainWindowShowWatchdog(win);
  assert.equal(clears, 1);
  assert.equal(timers, 0);
  assert.equal(shows, 0);
  c.QA_HIDDEN = false;
  assert.equal(c.restoreUnexpectedFullscreenVisibility(win), true);
  assert.equal(shows, 1);
  c.armMainWindowShowWatchdog(win);
  assert.equal(timers, 1);
});

test('hidden QA suppresses overlay creation and ready-to-show visibility', () => {
  const c = vm.createContext({ QA_HIDDEN: true });
  vm.runInContext(
    section('function createDesktopLyricsWindow(', '/**\n * 关闭桌面歌词窗口')
      + section('function createWallpaperWindow(', '/**\n * 关闭壁纸窗口')
      + section('function createMiniPlayerWindow()', '/**\n * 显示或恢复迷你播放器')
      + section('function shouldShowMiniPlayer()', 'function stopMiniPlayerRecoveryTimer()'),
    c
  );
  assert.equal(c.createDesktopLyricsWindow({ enabled: true }), null);
  assert.equal(c.createWallpaperWindow({ enabled: true }), null);
  assert.equal(c.createMiniPlayerWindow(), null);
  assert.equal(c.shouldShowMiniPlayer(), false);
  const startup = section('async function createWindow()', "if (process.platform === 'win32') app.setAppUserModelId");
  assert.match(startup, /mainWindow = new BrowserWindow\(\{[\s\S]*?show: false,/);
  const ready = section("mainWindow.once('ready-to-show'", "mainWindow.on('maximize'");
  assert.match(ready, /if \(!QA_HIDDEN\) mainWindow\.show\(\)/);
});
