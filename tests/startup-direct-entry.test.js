'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const appCss = fs.readFileSync(path.join(root, 'public', 'app.css'), 'utf8');
const foliaCss = fs.readFileSync(path.join(root, 'public', 'folia-host.css'), 'utf8');

function extractFunction(name) {
  const start = appSource.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `Missing function ${name}`);
  const bodyStart = appSource.indexOf('{', start);
  let depth = 0;
  for (let i = bodyStart; i < appSource.length; i += 1) {
    if (appSource[i] === '{') depth += 1;
    else if (appSource[i] === '}') {
      depth -= 1;
      if (depth === 0) return appSource.slice(start, i + 1);
    }
  }
  throw new Error(`Unclosed function ${name}`);
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadStartupHarness(setup = {}) {
  const frames = [];
  const timers = [];
  const marks = [];
  const wallpaper = [];
  const restoreDelays = [];
  const homeUpdates = [];
  const guides = [];
  const listeners = new Map();
  const classes = new Set();
  let uploadTips = 0;
  let audioContexts = 0;
  let canvasAllocations = 0;

  function AudioContext() { audioContexts += 1; }

  const context = {
    document: {
      body: {
        classList: {
          add(name) { classes.add(name); },
          remove(name) { classes.delete(name); },
          contains(name) { return classes.has(name); }
        }
      },
      getElementById() { return null; },
      createElement(name) {
        if (name === 'canvas') canvasAllocations += 1;
        return { getContext() { canvasAllocations += 1; } };
      },
      addEventListener(type, callback) {
        assert.equal(listeners.has(type), false, `Duplicate ${type} listener`);
        listeners.set(type, callback);
      }
    },
    window: { AudioContext, webkitAudioContext: AudioContext },
    AudioContext,
    immersiveMode: false,
    playing: setup.playing === true,
    audio: { paused: setup.paused !== false },
    shelfPinnedOpen: false,
    shelfManager: { hasOpenContent() { return false; } },
    homeSuppressed: setup.homeSuppressed === true,
    homeForcedOpen: false,
    markAppPerf(name) { marks.push(name); },
    activateHomeWallpaperPreview(options) { wallpaper.push(plain(options)); },
    scheduleSavedLocalMusicFolderRestore(delay) { restoreDelays.push(delay); },
    updateEmptyHomeVisibility(options) {
      homeUpdates.push(plain(options));
      const results = setup.homeResults || [true];
      return results[Math.min(homeUpdates.length - 1, results.length - 1)];
    },
    shouldForceEmptyHome() { return setup.forceHome === true; },
    maybeRunStartupVisualGuide(source) {
      guides.push(['visual', source]);
      return setup.visualGuide === true;
    },
    hasAnyPlatformLogin() { return setup.loggedIn === true; },
    maybeRunStartupLoginGuide(source) { guides.push(['login', source]); },
    maybeShowUploadTipOnce() { uploadTips += 1; },
    requestAnimationFrame(callback) {
      frames.push(callback);
      return frames.length;
    },
    setTimeout(callback, delay) {
      timers.push({ callback, delay });
      return timers.length;
    }
  };

  const registration = appSource.match(/document\.addEventListener\('DOMContentLoaded', initializePlayerHome\);/);
  assert.ok(registration, 'Home initialization must be registered for DOMContentLoaded');
  vm.runInNewContext([
    extractFunction('shouldUseIdleWallpaperPreview'),
    extractFunction('initializePlayerHome'),
    registration[0]
  ].join('\n'), context);

  return {
    context, classes, frames, timers, marks, wallpaper, restoreDelays, homeUpdates, guides, listeners,
    get uploadTips() { return uploadTips; },
    get audioContexts() { return audioContexts; },
    get canvasAllocations() { return canvasAllocations; },
    start() { listeners.get('DOMContentLoaded')(); },
    nextFrame() {
      assert.ok(frames.length, 'Expected a queued animation frame');
      frames.shift()();
    }
  };
}

test('startup markup and styles have no splash overlay or startup-only hiding', () => {
  assert.doesNotMatch(indexSource, /id=["']splash(?:-[^"']*)?["']/);
  assert.doesNotMatch(indexSource, /<body[^>]*\b(?:splash-active|startup-active)\b/);
  assert.doesNotMatch(appCss, /#splash\b|\.splash-active\b|\.splash-revealing\b|@keyframes\s+splash/);
  assert.doesNotMatch(appSource, /classList\.add\(['"](?:splash-active|startup-active)['"]\)/);
});

test('initial HTML reveals the local import Home and hides login before vendor scripts run', () => {
  const htmlTag = indexSource.match(/<html\b[^>]*>/i)[0];
  const bodyTag = indexSource.match(/<body\b[^>]*>/i)[0];
  assert.match(htmlTag, /\bclass="[^"]*\blocal-only-mode\b[^"]*"/);
  assert.match(bodyTag, /\bclass="[^"]*\blocal-only-mode\b[^"]*"/);
  assert.match(bodyTag, /\bclass="[^"]*\bempty-home-active\b[^"]*"/);
  assert.match(indexSource, /id="empty-home"[\s\S]*class="home-local-action"/);
  assert.match(appCss, /body\.empty-home-active #empty-home\{opacity:1;pointer-events:auto;/);
  assert.match(appCss, /body\.local-only-mode #user-btn,[\s\S]*?display:none!important/);
  assert.match(appCss, /html\.local-only-mode #empty-home \.empty-home-shell/);
});

test('only the saved Folia interface is preloaded without writing preferences', () => {
  const bootstrap = indexSource.match(/<head>[\s\S]*?<script>([\s\S]*?)<\/script>/)[1];
  for (const setup of [
    { mode: null }, { mode: 'mineradio' }, { mode: 'invalid' },
    { mode: 'folia' }, { mode: 'folia', diy: true },
    { mode: 'folia', deniedKey: 'mineradio-diy-player-mode-v1' },
    { mode: 'folia', deniedKey: 'mineradio-player-interface-v1' }
  ]) {
    const classes = new Set();
    const context = {
      document: { documentElement: { classList: { add(name) { classes.add(name); } } } },
      localStorage: {
        getItem(key) {
          if (key === setup.deniedKey) throw new Error('Storage unavailable');
          return key === 'mineradio-player-interface-v1' ? setup.mode : setup.diy ? '1' : null;
        },
        setItem() { assert.fail('First paint must not write preferences'); }
      }
    };
    assert.doesNotThrow(() => vm.runInNewContext(bootstrap, context));
    assert.equal(classes.has('folia-mode-preload'),
      setup.mode === 'folia' && setup.deniedKey !== 'mineradio-player-interface-v1');
    assert.equal(classes.has('simple-mode-preload'), setup.diy !== true);
  }
  assert.match(foliaCss, /html\.folia-mode-preload #folia-interface\[hidden\]\{display:block!important\}/);
  assert.match(foliaCss, /html\.folia-mode-preload #desktop-window-shell>:not\(#folia-interface\):not\(#desktop-titlebar\):not\(#fullscreen-diy-zone\):not\(#update-modal\),\s*body\.folia-interface-active[^{}]*\{visibility:hidden!important;pointer-events:none!important\}/);
});

test('DOMContentLoaded directly reveals Home without a splash node, click or animation timer', () => {
  const harness = loadStartupHarness();
  assert.deepEqual([...harness.listeners.keys()], ['DOMContentLoaded']);

  harness.start();

  assert.deepEqual(harness.marks, ['dom-content-loaded', 'home-revealed']);
  assert.deepEqual(harness.wallpaper, [{ instant: true }]);
  assert.deepEqual(harness.restoreDelays, [420]);
  assert.deepEqual(harness.homeUpdates, [{ forceLoad: true }]);
  assert.equal(harness.frames.length, 1);
  assert.deepEqual(harness.timers, []);
  assert.equal(harness.classes.has('splash-active'), false);
  assert.equal(harness.audioContexts, 0);
  assert.equal(harness.canvasAllocations, 0);
});

test('instant startup wallpaper stays fully visible after an earlier reveal tween', () => {
  const harness = loadStartupHarness();
  const frames = new Map();
  let now = 1000;
  let nextFrameId = 0;
  Object.assign(harness.context, {
    alphaTween: null,
    uniforms: { uAlpha: { value: 0 }, uFloatAlpha: { value: 0.4 } },
    floatGroup: null,
    performance: { now() { return now; } },
    requestAnimationFrame(callback) {
      nextFrameId += 1;
      frames.set(nextFrameId, callback);
      return nextFrameId;
    },
    cancelAnimationFrame(id) { frames.delete(id); }
  });
  vm.runInNewContext([
    extractFunction('tweenParticleAlpha'),
    extractFunction('ensureHomeWallpaperParticles'),
    extractFunction('activateHomeWallpaperPreview')
  ].join('\n'), harness.context);

  harness.context.activateHomeWallpaperPreview();
  assert.equal(frames.size, 1, 'The ordinary Home path has queued its reveal tween');
  assert.equal(harness.context.uniforms.uAlpha.value, 0);
  harness.start();
  assert.equal(harness.context.uniforms.uAlpha.value, 0.96);

  now += 16;
  const callbacks = [...frames.values()];
  frames.clear();
  for (const callback of callbacks) callback(now);
  assert.equal(harness.context.uniforms.uAlpha.value, 0.96, 'An old reveal frame must not dim the instant startup wallpaper');
});

test('direct entry respects active playback while still scheduling local library restore', () => {
  for (const setup of [{ playing: true }, { paused: false }]) {
    const harness = loadStartupHarness({ ...setup, homeResults: [false] });
    harness.start();
    assert.deepEqual(harness.wallpaper, []);
    assert.deepEqual(harness.restoreDelays, [420]);
    assert.deepEqual(harness.marks, ['dom-content-loaded', 'home-revealed']);
    assert.deepEqual(harness.homeUpdates, [{ forceLoad: true }]);
    assert.equal(harness.context.homeForcedOpen, false);
  }
});

test('real Home predicates preserve playback, immersive mode and focused shelf content at startup', () => {
  for (const setup of [
    { playing: true },
    { audio: { src: 'blob:playing', paused: false }, localLibraryPassiveQueue: true, playQueue: [{}], currentIdx: 0 },
    { immersiveMode: true },
    { shelfPinnedOpen: true },
    { shelfManager: { hasOpenContent() { return true; } } }
  ]) {
    const harness = loadStartupHarness();
    Object.assign(harness.context, {
      localLibraryPassiveQueue: false, playQueue: [], currentIdx: -1
    }, setup);
    vm.runInNewContext([
      extractFunction('shouldShowEmptyHome'),
      extractFunction('shouldForceEmptyHome')
    ].join('\n'), harness.context);
    harness.context.updateEmptyHomeVisibility = options => {
      harness.homeUpdates.push(plain(options));
      return harness.context.shouldShowEmptyHome();
    };
    harness.start();
    assert.equal(harness.context.shouldShowEmptyHome(), false);
    assert.equal(harness.context.shouldForceEmptyHome(), false);
    assert.equal(harness.context.homeForcedOpen, false);
    assert.deepEqual(harness.homeUpdates, [{ forceLoad: true }]);
    assert.deepEqual(harness.restoreDelays, [420]);
  }
});

test('existing library restore scheduling stays single-flight without a splash retry', () => {
  const timers = [];
  let restores = 0;
  const context = {
    LOCAL_ONLY_MODE: true,
    localLibraryRestoreScheduled: false,
    localLibraryRestoreStarted: false,
    document: { body: { classList: { contains() { return false; } } } },
    setTimeout(callback, delay) { timers.push({ callback, delay }); },
    restoreSavedLocalMusicFolder() {
      restores += 1;
      return Promise.resolve(true);
    },
    console
  };
  vm.runInNewContext(extractFunction('scheduleSavedLocalMusicFolderRestore'), context);
  context.scheduleSavedLocalMusicFolderRestore(700);
  context.scheduleSavedLocalMusicFolderRestore(420);
  assert.deepEqual(timers.map(({ delay }) => delay), [700]);

  timers[0].callback();
  assert.equal(restores, 1);
  assert.equal(context.localLibraryRestoreScheduled, false);
  assert.equal(context.localLibraryRestoreStarted, true);
  context.scheduleSavedLocalMusicFolderRestore(420);
  assert.equal(timers.length, 1);
  assert.equal(restores, 1);
});

test('Home visibility is corrected synchronously and guides wait for the next frame', () => {
  const harness = loadStartupHarness();
  harness.start();

  assert.deepEqual(harness.homeUpdates, [{ forceLoad: true }]);
  assert.equal(harness.context.homeForcedOpen, false);
  assert.deepEqual(harness.guides, []);

  harness.nextFrame();
  assert.deepEqual(harness.guides, [['visual', 'startup'], ['login', 'startup']]);
  assert.deepEqual(harness.timers.map(({ delay }) => delay), [5200]);
  assert.equal(harness.frames.length, 0);
  assert.equal(harness.uploadTips, 0);
  harness.timers[0].callback();
  assert.equal(harness.uploadTips, 1);
});

test('suppressed empty Home is forced open before startup guides run', () => {
  const harness = loadStartupHarness({
    homeSuppressed: true,
    homeResults: [false, true],
    forceHome: true
  });
  harness.start();

  assert.equal(harness.context.homeSuppressed, false);
  assert.equal(harness.context.homeForcedOpen, true);
  assert.deepEqual(harness.homeUpdates, [{ forceLoad: true }, { forceLoad: true }]);
  harness.nextFrame();
  assert.deepEqual(harness.timers.map(({ delay }) => delay), [5200]);
});

test('visual guide retains priority and login fallback respects Home visibility', () => {
  for (const setup of [
    { visualGuide: true, expected: ['visual'] },
    { loggedIn: true, expected: ['visual'] },
    { loggedIn: true, homeResults: [false], expected: ['visual', 'login'] }
  ]) {
    const harness = loadStartupHarness(setup);
    harness.start();
    harness.nextFrame();
    assert.deepEqual(harness.guides.map(([kind]) => kind), setup.expected);
    assert.ok(harness.guides.every(([, source]) => source === 'startup'));
    assert.deepEqual(harness.timers.map(({ delay }) => delay), [5200]);
  }
});

test('reduced-motion preference skips login guide particles', () => {
  let frames = 0;
  let completed = 0;
  const context = {
    window: { matchMedia() { return { matches: true }; } },
    document: {
      getElementById() {
        return { getContext() { throw new Error('reduced motion must not create a canvas context'); } };
      },
      body: { classList: { add() {}, remove() {} } }
    },
    setTimeout(callback, delay) {
      assert.equal(delay, 120);
      callback();
    },
    requestAnimationFrame() { frames += 1; },
    cancelAnimationFrame() {}
  };
  vm.runInNewContext(extractFunction('runLoginGuideParticles'), context);
  context.runLoginGuideParticles(() => { completed += 1; });
  assert.equal(frames, 0);
  assert.equal(completed, 1);
});
