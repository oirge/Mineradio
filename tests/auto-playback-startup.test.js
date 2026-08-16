'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');

/**
 * 把 vm 沙箱里创建的对象转成本 realm 的普通对象，供 deepEqual 比较原型一致的值。
 * @param {*} value 待转换的值。
 * @returns {*} 结构相同的本 realm 值。
 */
function plain(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

/**
 * 创建实现本测试所需 DOM 行为的轻量节点。
 * @param {string} id 节点标识。
 * @param {Record<string, string>=} attributes 初始属性。
 * @returns {object} 可读写属性和类名的假节点。
 */
function createNode(id, attributes) {
  const attrs = new Map(Object.entries(attributes || {}));
  const classNames = new Set();
  return {
    id,
    textContent: '',
    classNames,
    classList: {
      toggle(name, enabled) {
        if (enabled) classNames.add(name);
        else classNames.delete(name);
      },
      contains(name) { return classNames.has(name); },
    },
    setAttribute(name, value) { attrs.set(name, String(value)); },
    getAttribute(name) { return attrs.has(name) ? attrs.get(name) : null; },
  };
}

/**
 * 抽取 `public/app.js` 的自动播放接缝并注入可观测的运行环境。
 * @param {{mode?: string, queue?: Array<object>, currentIdx?: number, resume?: {idx:number,time:number}, playbackSelection?: string, audio?: object, random?: number, shuffled?: boolean}=} setup 初始状态。
 * @returns {{context: object, plays: Array<object>, toasts: string[], stored: Array<Array<string>>, shuffles: Array<object>, pickers: boolean[], modeButtons: Record<string, object>, sourceValue: object, hint: object}} 可驱动的测试环境。
 */
function loadAutoPlaybackHarness(setup) {
  setup = setup || {};
  const start = appSource.indexOf("var AUTO_PLAYBACK_MODES = ['off', 'continue', 'shuffle'];");
  const end = appSource.indexOf('function queueSong(song, opts) {', start);
  assert.ok(start >= 0 && end > start, '自动播放接缝缺失');

  const plays = [];
  const toasts = [];
  const stored = [];
  const shuffles = [];
  const pickers = [];
  const passives = [];
  const modeButtons = {
    off: createNode('off', { 'data-autoplay-mode': 'off' }),
    continue: createNode('continue', { 'data-autoplay-mode': 'continue' }),
    shuffle: createNode('shuffle', { 'data-autoplay-mode': 'shuffle' }),
  };
  const sourceValue = createNode('autoplay-source-value');
  const hint = createNode('autoplay-hint');
  const seg = createNode('autoplay-mode-seg');
  let segClickHandler = null;
  seg.addEventListener = (type, handler) => { if (type === 'click') segClickHandler = handler; };

  const math = Object.create(Math);
  math.random = () => (typeof setup.random === 'number' ? setup.random : 0);

  const queue = setup.queue || [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }];
  const shuffled = new WeakSet();
  if (setup.shuffled) shuffled.add(queue);

  const context = {
    AUTO_PLAYBACK_STORE_KEY: 'mineradio-auto-playback-v1',
    autoPlaybackMode: setup.mode || 'off',
    autoPlaybackRestoreHandled: false,
    playQueue: queue,
    currentIdx: typeof setup.currentIdx === 'number' ? setup.currentIdx : 0,
    playMode: setup.playMode || 'loop',
    playToggleBusy: true,
    pendingPlaybackSessionResume: setup.resume || { idx: -1, time: 0 },
    localLibraryPlaybackSelection: setup.playbackSelection || 'library',
    audio: setup.audio || { src: '', paused: true, ended: false },
    shuffledPlayQueueArrays: shuffled,
    localStorage: {
      getItem(key) { return key === 'mineradio-auto-playback-v1' ? (setup.savedMode || null) : null; },
    },
    document: {
      getElementById(id) {
        if (id === 'autoplay-mode-seg') return seg;
        if (id === 'autoplay-source-value') return sourceValue;
        if (id === 'autoplay-hint') return hint;
        return null;
      },
      querySelectorAll(selector) {
        assert.equal(selector, '#autoplay-mode-seg [data-autoplay-mode]');
        return [modeButtons.off, modeButtons.continue, modeButtons.shuffle];
      },
    },
    setPersistentLocalStorageItem(key, value) { stored.push([key, value]); },
    showToast(message) { toasts.push(message); },
    localPlaybackPlaylistSourceName(kind) { return kind === 'library' ? '全部音乐' : '我的歌单'; },
    clearLocalLibraryPassiveQueue() { passives.push(true); },
    forcePlaybackControlsInteractive() {},
    updatePlayModeButton() {},
    shufflePlayQueueOnce(opts) {
      shuffles.push(opts);
      context.shuffledPlayQueueArrays.add(context.playQueue);
      return true;
    },
    playQueueAt(index, opts) {
      plays.push({ index: index, manual: !!(opts && opts.manual), resumeAt: opts ? opts.resumeAt : undefined });
      return Promise.resolve();
    },
    setLocalPlaybackPlaylistPickerOpen(open) { pickers.push(open === true); },
    toggleFxPanel(force) { pickers.push(force); },
    console: { warn() {} },
    Math: math,
    Promise,
    WeakSet,
    Array,
  };

  vm.runInNewContext(appSource.slice(start, end), context);
  return {
    context,
    plays,
    toasts,
    stored,
    shuffles,
    pickers,
    passives,
    modeButtons,
    sourceValue,
    hint,
    clickMode(mode) { segClickHandler({ target: { closest() { return modeButtons[mode]; } }, preventDefault() {} }); },
  };
}

test('自动播放模式归一化会拒绝未知值', () => {
  const harness = loadAutoPlaybackHarness();
  assert.equal(harness.context.normalizeAutoPlaybackMode('continue'), 'continue');
  assert.equal(harness.context.normalizeAutoPlaybackMode('shuffle'), 'shuffle');
  assert.equal(harness.context.normalizeAutoPlaybackMode(' shuffle '), 'shuffle');
  assert.equal(harness.context.normalizeAutoPlaybackMode('random'), 'off');
  assert.equal(harness.context.normalizeAutoPlaybackMode(null), 'off');
  assert.equal(harness.context.normalizeAutoPlaybackMode(undefined), 'off');
});

test('关闭自动播放时启动恢复不会出声', () => {
  const harness = loadAutoPlaybackHarness({ mode: 'off', resume: { idx: 0, time: 12 } });
  assert.equal(harness.context.startAutoPlayback('restore'), false);
  assert.deepEqual(harness.plays, []);
  assert.deepEqual(harness.toasts, []);
  // 关闭态必须保留恢复点，否则用户手动点播放就丢了上次进度。
  assert.deepEqual(plain(harness.context.pendingPlaybackSessionResume), { idx: 0, time: 12 });
});

test('继续播放模式接着上次的歌曲和进度起播', () => {
  const harness = loadAutoPlaybackHarness({
    mode: 'continue',
    currentIdx: 2,
    resume: { idx: 2, time: 41.5 },
  });

  assert.equal(harness.context.startAutoPlayback('restore'), true);
  assert.deepEqual(harness.plays, [{ index: 2, manual: true, resumeAt: 41.5 }]);
  assert.deepEqual(harness.toasts, ['已接着上次继续播放']);
  assert.deepEqual(plain(harness.context.pendingPlaybackSessionResume), { idx: -1, time: 0 });
  assert.equal(harness.context.playMode, 'loop');
  assert.deepEqual(plain(harness.shuffles), []);
  // 被动队列标记必须清掉，否则首次播放会被当成未确认队列。
  assert.deepEqual(harness.passives, [true]);
  assert.equal(harness.context.playToggleBusy, false);
});

test('恢复点对不上当前歌曲时继续播放从头开始', () => {
  const harness = loadAutoPlaybackHarness({
    mode: 'continue',
    currentIdx: 1,
    resume: { idx: 3, time: 88 },
  });

  assert.equal(harness.context.startAutoPlayback('restore'), true);
  assert.deepEqual(harness.plays, [{ index: 1, manual: true, resumeAt: 0 }]);
  assert.deepEqual(plain(harness.context.pendingPlaybackSessionResume), { idx: 3, time: 88 });
});

test('随机播放模式切到随机模式、洗牌一次并随机挑一首从头播放', () => {
  const harness = loadAutoPlaybackHarness({
    mode: 'shuffle',
    currentIdx: 2,
    resume: { idx: 2, time: 30 },
    random: 0.5,
  });

  assert.equal(harness.context.startAutoPlayback('restore'), true);
  assert.equal(harness.context.playMode, 'shuffle');
  assert.deepEqual(plain(harness.shuffles), [{ toast: false, reason: 'auto-playback-shuffle' }]);
  assert.deepEqual(harness.plays, [{ index: 2, manual: true, resumeAt: 0 }]);
  assert.deepEqual(harness.toasts, ['自动随机播放已开始']);
  // 随机播放不接进度，恢复点必须清掉，避免随机到的歌从别人的时间点开始。
  assert.deepEqual(plain(harness.context.pendingPlaybackSessionResume), { idx: -1, time: 0 });
});

test('已经固定乱序的队列不会被自动播放再洗一次', () => {
  const harness = loadAutoPlaybackHarness({ mode: 'shuffle', playMode: 'shuffle', shuffled: true, random: 0 });
  assert.equal(harness.context.startAutoPlayback('restore'), true);
  assert.deepEqual(plain(harness.shuffles), []);
  assert.deepEqual(harness.plays, [{ index: 0, manual: true, resumeAt: 0 }]);
});

test('启动恢复只触发一次自动播放，后台重复扫描不会打断', () => {
  const harness = loadAutoPlaybackHarness({ mode: 'continue' });
  assert.equal(harness.context.startAutoPlayback('restore'), true);
  assert.equal(harness.context.startAutoPlayback('restore'), false);
  assert.equal(harness.plays.length, 1);
});

test('正在出声时自动播放不抢当前播放', () => {
  const harness = loadAutoPlaybackHarness({
    mode: 'shuffle',
    audio: { src: 'blob:song', paused: false, ended: false },
  });
  assert.equal(harness.context.startAutoPlayback('restore'), false);
  assert.deepEqual(harness.plays, []);
});

test('空队列时自动播放安全退出且不占用启动名额', () => {
  const harness = loadAutoPlaybackHarness({ mode: 'shuffle', queue: [], currentIdx: -1 });
  assert.equal(harness.context.startAutoPlayback('restore'), false);
  assert.equal(harness.context.autoPlaybackRestoreHandled, false);
  assert.deepEqual(harness.plays, []);
});

test('切换开关会落盘、刷新控件并立即起播一次', () => {
  const harness = loadAutoPlaybackHarness({ mode: 'off', currentIdx: 1, resume: { idx: 1, time: 9 } });

  assert.equal(harness.context.setAutoPlaybackMode('continue'), 'continue');
  assert.deepEqual(harness.stored, [['mineradio-auto-playback-v1', 'continue']]);
  assert.deepEqual(harness.toasts, ['自动播放: 继续播放']);
  assert.deepEqual(harness.plays, [{ index: 1, manual: true, resumeAt: 9 }]);
  assert.equal(harness.modeButtons.continue.getAttribute('aria-pressed'), 'true');
  assert.equal(harness.modeButtons.continue.classList.contains('active'), true);
  assert.equal(harness.modeButtons.off.getAttribute('aria-pressed'), 'false');
  assert.equal(harness.modeButtons.off.classList.contains('active'), false);
  assert.equal(harness.hint.textContent, '启动后自动接着上次的歌曲和进度继续播放。');

  // 重复点同一个模式既不重复落盘也不重复起播。
  assert.equal(harness.context.setAutoPlaybackMode('continue'), 'continue');
  assert.equal(harness.stored.length, 1);
  assert.equal(harness.plays.length, 1);

  assert.equal(harness.context.setAutoPlaybackMode('off'), 'off');
  assert.deepEqual(harness.stored[1], ['mineradio-auto-playback-v1', 'off']);
  assert.equal(harness.plays.length, 1);
  assert.equal(harness.modeButtons.off.classList.contains('active'), true);
});

test('分段按钮点击走同一条切换通道', () => {
  const harness = loadAutoPlaybackHarness({ savedMode: 'shuffle', random: 0 });
  harness.context.initAutoPlaybackControls();
  assert.equal(harness.context.autoPlaybackMode, 'shuffle');
  assert.equal(harness.modeButtons.shuffle.classList.contains('active'), true);
  assert.equal(harness.sourceValue.textContent, '全部音乐');

  harness.clickMode('off');
  assert.equal(harness.context.autoPlaybackMode, 'off');
  assert.deepEqual(harness.stored[harness.stored.length - 1], ['mineradio-auto-playback-v1', 'off']);
});

test('自动播放歌单展示当前播放歌单并复用底部选择器', () => {
  const harness = loadAutoPlaybackHarness({ playbackSelection: 'local-playlist:abc' });
  harness.context.updateAutoPlaybackControls();
  assert.equal(harness.sourceValue.textContent, '我的歌单');

  harness.context.openAutoPlaybackPlaylistPicker();
  // 视觉控制台会挡住底部控制栏，必须先收起面板再展开选择器。
  assert.deepEqual(harness.pickers, [false, true]);
});

test('自动播放开关常驻 DIY 高级页并接在启动恢复链路上', () => {
  assert.match(indexSource, /id="fx-playback-fold"[\s\S]*?id="autoplay-mode-seg"/);
  assert.match(indexSource, /data-autoplay-mode="off"[\s\S]*?data-autoplay-mode="continue"[\s\S]*?data-autoplay-mode="shuffle"/);
  assert.match(indexSource, /id="autoplay-source-value"/);
  assert.match(indexSource, /id="autoplay-hint"/);
  assert.match(indexSource, /onclick="openAutoPlaybackPlaylistPicker\(\)"/);

  assert.match(appSource, /var AUTO_PLAYBACK_STORE_KEY = 'mineradio-auto-playback-v1';/);
  assert.match(appSource, /PERSISTENT_UI_STATE_KEYS[\s\S]*?AUTO_PLAYBACK_STORE_KEY,/);
  assert.match(appSource, /id === 'fx-advanced' \|\| id === 'fx-playback-fold'/);
  assert.match(appSource, /'fx-stage-fold','fx-playback-fold','fx-advanced'/);
  assert.match(appSource, /initAutoPlaybackControls\(\);\s*if \(LOCAL_ONLY_MODE\) scheduleSavedLocalMusicFolderRestore\(700\);/);

  // 启动恢复的两条出口都要接上自动播放，否则被动队列分支永远不出声。
  assert.match(
    appSource,
    /safeRenderQueuePanel\('playback-session-restore', \{ scrollCurrent: true \}\);\s*startAutoPlayback\('restore'\);/,
  );
  assert.match(
    appSource,
    /if \(opts\.autoPlay === false\) \{\s*forcePlaybackControlsInteractive\(\);\s*startAutoPlayback\('restore'\);/,
  );
  // 自动播放接管起播时由它自己提示，避免和“已恢复上次播放位置”撞车。
  assert.match(appSource, /if \(normalizeAutoPlaybackMode\(autoPlaybackMode\) === 'off'\) showToast\('已恢复上次播放位置'\);/);
  // 切换播放歌单后设置区的歌单名称要跟着变。
  assert.match(
    appSource,
    /updateLocalPlaybackPlaylistSourceButton\(\);\s*if \(typeof updateAutoPlaybackControls === 'function'\) updateAutoPlaybackControls\(\);/,
  );
});
