'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
const mainSource = fs.readFileSync(path.join(root, 'desktop', 'main.js'), 'utf8');
const cssSource = fs.readFileSync(path.join(root, 'public', 'app.css'), 'utf8');
const preloadSource = fs.readFileSync(path.join(root, 'desktop', 'preload.js'), 'utf8');

/**
 * 取出源码切片；标记漂了直接失败，避免测试悄悄跑在空字符串上。
 * @param {string} source 源码。
 * @param {string} startMarker 起点标记。
 * @param {string} endMarker 终点标记。
 * @param {string} label 失败信息用的名字。
 * @returns {string} 切片源码。
 */
function slice(source, startMarker, endMarker, label) {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, label + ' 切片起点缺失: ' + startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(end > start, label + ' 切片终点缺失: ' + endMarker);
  return source.slice(start, end);
}

/**
 * 把 vm 里创建的对象拷回本 realm，供 deepEqual 比较。
 * @param {*} value 待转换值。
 * @returns {*} 结构相同的本 realm 值。
 */
function plain(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

/**
 * 创建满足热键面板读写需求的假节点。
 * @param {string} id 节点标识。
 * @param {Record<string,string>=} attributes 初始属性。
 * @returns {object} 假节点。
 */
function createFakeNode(id, attributes) {
  const attrs = new Map(Object.entries(attributes || {}));
  const classNames = new Set();
  return {
    id,
    textContent: '',
    innerHTML: '',
    classNames,
    classList: {
      add() { for (const name of arguments) classNames.add(name); },
      remove() { for (const name of arguments) classNames.delete(name); },
      toggle(name, on) { if (on) classNames.add(name); else classNames.delete(name); },
      contains(name) { return classNames.has(name); },
    },
    setAttribute(name, value) { attrs.set(name, String(value)); },
    getAttribute(name) { return attrs.has(name) ? attrs.get(name) : null; },
    appendChild(child) { return child; },
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };
}

const HOTKEY_TABLES_SOURCE = slice(appSource, 'var HOTKEY_ACTIONS = [', 'var hotkeyCaptureState = null;', '热键常量表');
const HOTKEY_IMPL_SOURCE = slice(appSource, 'function getHotkeyDefaults() {', 'function bindFxPanel() {', '热键实现');

/**
 * 在 vm 里跑起渲染层热键模块，挂上可观测的假 DOM 与假桌面 API。
 * @param {{storedSettings?:string,desktop?:boolean,registerResults?:Function}=} options 桩配置。
 * @returns {object} 上下文与各类调用记录。
 */
function loadHotkeyModule(options) {
  const opts = options || {};
  const stored = [];
  const toasts = [];
  const invoked = [];
  const configured = [];
  const timers = [];
  const nodes = new Map();
  const modal = createFakeNode('hotkey-modal');
  const scopeButtons = [
    createFakeNode('scope-local', { 'data-hotkey-scope': 'local' }),
    createFakeNode('scope-global', { 'data-hotkey-scope': 'global' }),
  ];
  modal.querySelectorAll = (selector) => (selector === '[data-hotkey-scope]' ? scopeButtons : []);
  nodes.set('hotkey-modal', modal);
  nodes.set('hotkey-local-section', createFakeNode('hotkey-local-section'));
  nodes.set('hotkey-global-section', createFakeNode('hotkey-global-section'));
  nodes.set('hotkey-capture-tip', createFakeNode('hotkey-capture-tip'));
  let captureHandler = null;

  const desktopApi = {
    minimize() { invoked.push('minimize'); },
    onGlobalHotkey() {},
    configureGlobalHotkeys(bindings) {
      const list = plain(bindings) || [];
      configured.push(list);
      const custom = opts.registerResults ? opts.registerResults(list) : null;
      return Promise.resolve({
        ok: true,
        results: custom || list.map((item) => ({ action: item.action, accelerator: item.accelerator, ok: true })),
      });
    },
  };

  const context = {
    console, JSON, Math, Object, Array, String, Number, Boolean, Promise, RegExp, Date,
    HOTKEY_SETTINGS_STORE_KEY: 'mineradio-hotkeys',
    hotkeySettings: null,
    hotkeyGlobalStatus: {},
    hotkeyCaptureState: null,
    hotkeyCaptureNotice: '',
    freeCamera: null,
    localStorage: { getItem: () => (opts.storedSettings == null ? null : opts.storedSettings), setItem() {} },
    setPersistentLocalStorageItem(key, value) { stored.push({ key, value }); },
    showToast(message) { toasts.push(String(message)); },
    setTimeout(fn, delay) { timers.push({ fn, delay }); return timers.length; },
    isTypingTarget: () => false,
    escHtml(value) {
      return String(value == null ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },
    togglePlay() { invoked.push('togglePlay'); },
    prevTrack() { invoked.push('prevTrack'); },
    nextTrack() { invoked.push('nextTrack'); },
    adjustVolumeByKeyboard(delta) { invoked.push('volume:' + delta); },
    toggleMute() { invoked.push('toggleMute'); },
    toggleFullscreen() { invoked.push('toggleFullscreen'); },
    toggleFx() { invoked.push('toggleFx'); },
    getDesktopWindowApi: () => (opts.desktop === false ? null : desktopApi),
    document: {
      body: createFakeNode('body'),
      getElementById: (id) => (nodes.has(id) ? nodes.get(id) : null),
      createElement: (tag) => createFakeNode('created-' + tag),
      addEventListener(type, handler) { if (type === 'keydown') captureHandler = handler; },
    },
  };
  vm.runInNewContext(HOTKEY_TABLES_SOURCE + '\n' + HOTKEY_IMPL_SOURCE, context, { filename: 'app.hotkeys.js' });
  context.hotkeySettings = context.readHotkeySettings();

  return {
    context, modal, nodes, stored, toasts, invoked, configured, timers,
    tip: nodes.get('hotkey-capture-tip'),
    /**
     * 触发一次捕获阶段 keydown。
     * @param {object} init 事件字段。
     * @returns {object} 被触发的假事件。
     */
    press(init) {
      assert.ok(captureHandler, 'keydown 捕获监听未注册');
      const event = {
        code: '', key: '', ctrlKey: false, altKey: false, shiftKey: false, metaKey: false,
        defaultPrevented: false, propagationStopped: false,
        preventDefault() { this.defaultPrevented = true; },
        stopPropagation() { this.propagationStopped = true; },
      };
      Object.assign(event, init || {});
      captureHandler(event);
      return event;
    },
    /** 跑掉排队中的定时器。 @returns {void} */
    flush() {
      const pending = timers.splice(0, timers.length);
      pending.forEach((timer) => timer.fn());
    },
  };
}

const MAIN_HOTKEY_SOURCE = slice(
  mainSource,
  'const MAIN_PROCESS_HOTKEY_ACTIONS = new Set(',
  'function scheduleWindowStateSend(',
  '主进程全局热键',
);

/**
 * 在 vm 里跑起主进程热键模块，globalShortcut 与主窗口都是假的。
 * @param {{occupied?:string[],throwing?:string[],visible?:boolean,minimized?:boolean,noWindow?:boolean}=} options 桩配置。
 * @returns {object} 上下文与调用记录。
 */
function loadMainHotkeyModule(options) {
  const opts = options || {};
  const occupied = new Set(opts.occupied || []);
  const throwing = new Set(opts.throwing || []);
  const registered = [];
  const unregistered = [];
  const sent = [];
  const windowCalls = [];
  const handlers = new Map();
  const mainWindow = {
    isDestroyed: () => false,
    isVisible: () => opts.visible !== false,
    isMinimized: () => !!opts.minimized,
    minimize() { windowCalls.push('minimize'); },
    webContents: { send(channel, payload) { sent.push({ channel, payload: plain(payload) }); } },
  };
  const context = {
    console, JSON, Object, Array, String, Set, Map,
    mainWindow: opts.noWindow ? null : mainWindow,
    registeredGlobalHotkeys: new Map(),
    focusMainWindow() { windowCalls.push('focus'); return true; },
    globalShortcut: {
      register(accelerator, handler) {
        registered.push(accelerator);
        if (throwing.has(accelerator)) throw new Error('bad accelerator');
        if (occupied.has(accelerator)) return false;
        handlers.set(accelerator, handler);
        return true;
      },
      unregister(accelerator) { unregistered.push(accelerator); },
    },
  };
  vm.runInNewContext(MAIN_HOTKEY_SOURCE, context, { filename: 'main.hotkeys.js' });
  return { context, registered, unregistered, sent, windowCalls, handlers };
}

test('全局热键默认值就是 Ctrl+Alt+方向键那一组', () => {
  const harness = loadHotkeyModule();
  const defaults = plain(harness.context.getHotkeyDefaults());
  assert.equal(defaults.global.prevTrack, 'Ctrl+Alt+ArrowLeft');
  assert.equal(defaults.global.nextTrack, 'Ctrl+Alt+ArrowRight');
  assert.equal(defaults.global.volumeUp, 'Ctrl+Alt+ArrowUp');
  assert.equal(defaults.global.volumeDown, 'Ctrl+Alt+ArrowDown');
  assert.equal(defaults.global.togglePlay, 'Ctrl+Alt+Space');
  assert.equal(defaults.global.toggleMute, 'Ctrl+Alt+KeyM');
  // 音量占了上下键，播放/暂停只能留在 Space，否则 Ctrl+Alt+ArrowDown 会一键双绑。
  assert.notEqual(defaults.global.togglePlay, defaults.global.volumeDown);
  const globals = Object.keys(defaults.global).map((key) => defaults.global[key]).filter(Boolean);
  assert.equal(new Set(globals).size, globals.length, '默认全局热键不能互相撞键');
});

test('组合键翻译成 Electron 加速键，认不出的按键整条作废', () => {
  const toAccel = loadHotkeyModule().context.hotkeyToAccelerator;
  const cases = [
    ['Ctrl+Alt+ArrowLeft', 'Control+Alt+Left'],
    ['Ctrl+Alt+ArrowRight', 'Control+Alt+Right'],
    ['Ctrl+Alt+ArrowUp', 'Control+Alt+Up'],
    ['Ctrl+Alt+ArrowDown', 'Control+Alt+Down'],
    ['Ctrl+Alt+Space', 'Control+Alt+Space'],
    ['Ctrl+Alt+KeyM', 'Control+Alt+M'],
    ['Ctrl+Shift+Digit7', 'Control+Shift+7'],
    ['Meta+KeyK', 'Super+K'],
    ['Ctrl+Alt+Shift+Meta+KeyZ', 'Control+Alt+Shift+Super+Z'],
    ['Ctrl+Alt+Numpad5', 'Control+Alt+num5'],
    ['Ctrl+Alt+NumpadAdd', 'Control+Alt+numadd'],
    ['Ctrl+Alt+NumpadDecimal', 'Control+Alt+numdec'],
    ['Ctrl+Alt+NumpadEnter', 'Control+Alt+Enter'],
    ['Ctrl+Alt+Comma', 'Control+Alt+,'],
    ['Ctrl+Alt+Minus', 'Control+Alt+-'],
    ['Ctrl+Alt+Equal', 'Control+Alt+='],
    ['Ctrl+Alt+Slash', 'Control+Alt+/'],
    ['Ctrl+Alt+Escape', 'Control+Alt+Escape'],
    ['Ctrl+Alt+F13', 'Control+Alt+F13'],
    ['MediaTrackNext', 'MediaNextTrack'],
    ['MediaTrackPrevious', 'MediaPreviousTrack'],
    ['AudioVolumeMute', 'VolumeMute'],
  ];
  for (const [hotkey, accelerator] of cases) {
    assert.equal(toAccel(hotkey), accelerator, hotkey + ' 应翻译成 ' + accelerator);
  }
  // 翻不出来的一律空串：宁可本地拒掉，也别送假冲突给用户。
  for (const bad of ['', 'Ctrl+Alt+Lang1', 'Ctrl+Alt+F25', 'Ctrl+Alt+IntlBackslash', 'Hyper+KeyA', 'Ctrl+Alt+ControlLeft']) {
    assert.equal(toAccel(bad), '', bad + ' 应翻译失败');
  }
});

test('组合键展示文本对每个按键都有人话', () => {
  const format = loadHotkeyModule().context.formatHotkey;
  assert.equal(format(''), '未设置');
  assert.equal(format('Ctrl+Alt+ArrowLeft'), 'Ctrl + Alt + Left');
  assert.equal(format('Ctrl+Alt+Space'), 'Ctrl + Alt + Space');
  assert.equal(format('Meta+Numpad3'), 'Win + Num3');
  assert.equal(format('Ctrl+Alt+Comma'), 'Ctrl + Alt + ,');
  assert.equal(format('Ctrl+Alt+Minus'), 'Ctrl + Alt + -');
  assert.equal(format('Ctrl+Alt+NumpadAdd'), 'Ctrl + Alt + Num +');
  assert.equal(format('Escape'), 'Esc');
  assert.equal(format('MediaPlayPause'), '媒体播放键');
  assert.equal(format('Alt+KeyL'), 'Alt + L');
});

test('全局热键必须带 Ctrl/Alt/Win，专用媒体键除外', () => {
  const reject = loadHotkeyModule().context.globalHotkeyRejectReason;
  assert.equal(reject('Ctrl+Alt+ArrowLeft'), '');
  assert.equal(reject('Alt+KeyL'), '');
  assert.equal(reject('Meta+KeyK'), '');
  assert.equal(reject(''), '', '空绑定表示不注册，不算拒绝');
  // 裸键注册成全局热键会在所有软件里抢走这个键。
  assert.match(reject('Space'), /Ctrl/);
  assert.match(reject('KeyM'), /Ctrl/);
  assert.match(reject('Shift+KeyA'), /Ctrl/);
  assert.match(reject('F5'), /Ctrl/);
  // 专用媒体键本来就只干这件事，裸键可以放行。
  assert.equal(reject('MediaPlayPause'), '');
  assert.equal(reject('MediaTrackNext'), '');
  assert.equal(reject('AudioVolumeMute'), '');
  // 认不出的按键给的是另一套原因，别混成「缺修饰键」。
  assert.match(reject('Ctrl+Alt+Lang1'), /不能注册成全局热键/);
});

test('setHotkeyBinding 挡下不合法的全局热键，本地作用域不受影响', () => {
  const harness = loadHotkeyModule();
  const ctx = harness.context;
  assert.equal(ctx.setHotkeyBinding('togglePlay', 'global', 'Space'), false);
  assert.equal(plain(ctx.hotkeySettings).global.togglePlay, 'Ctrl+Alt+Space', '被拒绝时不该改写原绑定');
  assert.equal(harness.stored.length, 0, '被拒绝时不该落盘');
  assert.equal(harness.configured.length, 0, '被拒绝时不该发去主进程注册');

  assert.equal(ctx.setHotkeyBinding('togglePlay', 'local', 'Space'), true);
  assert.equal(plain(ctx.hotkeySettings).local.togglePlay, 'Space');
  assert.equal(harness.stored.length, 1);
  assert.equal(harness.stored[0].key, 'mineradio-hotkeys');
  assert.equal(harness.configured.length, 0, '改本地热键不用重注册全局热键');

  assert.equal(ctx.setHotkeyBinding('togglePlay', 'global', 'Ctrl+Alt+KeyJ'), true);
  assert.equal(plain(ctx.hotkeySettings).global.togglePlay, 'Ctrl+Alt+KeyJ');
  assert.equal(harness.configured.length, 1, '改全局热键要立刻重注册');
});

test('录入裸键全局热键时保留录入态并说明原因，再按一组就能生效', () => {
  const harness = loadHotkeyModule();
  const ctx = harness.context;
  ctx.startHotkeyCapture('nextTrack', 'global');
  assert.ok(ctx.hotkeyCaptureState, '录入态应已建立');

  const first = harness.press({ code: 'Space' });
  assert.equal(first.defaultPrevented, true);
  assert.ok(ctx.hotkeyCaptureState, '被拒后录入态要留着，用户可以直接再按一组');
  assert.match(ctx.hotkeyCaptureNotice, /Space/);
  assert.match(ctx.hotkeyCaptureNotice, /Ctrl/);
  assert.equal(harness.modal.classList.contains('warn'), true);
  assert.match(harness.tip.textContent, /Ctrl/);
  assert.equal(plain(ctx.hotkeySettings).global.nextTrack, 'Ctrl+Alt+ArrowRight', '被拒时不改绑定');

  harness.press({ code: 'KeyN', ctrlKey: true, altKey: true });
  assert.equal(ctx.hotkeyCaptureState, null, '录入成功后应退出录入态');
  assert.equal(ctx.hotkeyCaptureNotice, '');
  assert.equal(plain(ctx.hotkeySettings).global.nextTrack, 'Ctrl+Alt+KeyN');
});

test('不带修饰键的 Backspace 清空绑定，带修饰键的 Delete 仍能录进去', () => {
  const harness = loadHotkeyModule();
  const ctx = harness.context;
  ctx.startHotkeyCapture('toggleFullscreen', 'local');
  harness.press({ code: 'Backspace' });
  assert.equal(plain(ctx.hotkeySettings).local.toggleFullscreen, '');
  assert.equal(ctx.hotkeyCaptureState, null);

  ctx.startHotkeyCapture('toggleMainWindow', 'global');
  harness.press({ code: 'Delete', ctrlKey: true, altKey: true });
  assert.equal(plain(ctx.hotkeySettings).global.toggleMainWindow, 'Ctrl+Alt+Delete');
  assert.equal(ctx.hotkeyCaptureState, null);

  ctx.startHotkeyCapture('togglePlay', 'local');
  const escaped = harness.press({ code: 'Escape' });
  assert.equal(escaped.defaultPrevented, true);
  assert.equal(ctx.hotkeyCaptureState, null, 'Esc 取消录入');
  assert.equal(plain(ctx.hotkeySettings).local.togglePlay, 'Space', 'Esc 不该改绑定');
});

test('registerGlobalHotkeys 只把能翻译、合法、不重复的组合送去注册', async () => {
  const harness = loadHotkeyModule({
    storedSettings: JSON.stringify({
      global: {
        togglePlay: 'Ctrl+Alt+Space',
        prevTrack: 'Ctrl+Alt+ArrowLeft',
        nextTrack: 'Ctrl+Alt+ArrowLeft', // 与上一首撞键，两条都要跳过
        volumeUp: 'Ctrl+Alt+Lang1',      // 翻不出加速键
        volumeDown: 'ArrowDown',         // 裸键，不能当全局热键
        toggleMute: '',                  // 未设置
        toggleFullscreen: '',
        toggleDesktopLyrics: '',
        toggleMainWindow: 'Ctrl+Alt+KeyH',
      },
    }),
  });
  await harness.context.registerGlobalHotkeys();
  assert.equal(harness.configured.length, 1);
  assert.deepEqual(harness.configured[0], [
    { action: 'togglePlay', accelerator: 'Control+Alt+Space' },
    { action: 'toggleMainWindow', accelerator: 'Control+Alt+H' },
  ]);
});

test('没有桌面 API 时不注册全局热键也不报错', async () => {
  const harness = loadHotkeyModule({ desktop: false });
  await harness.context.registerGlobalHotkeys();
  assert.equal(harness.configured.length, 0);
  assert.deepEqual(plain(harness.context.hotkeyGlobalStatus), {});
});

test('全局热键被占用时提示一次，面板开着时不提示', async () => {
  const harness = loadHotkeyModule({
    registerResults: (bindings) => bindings.map((item) => ({
      action: item.action,
      accelerator: item.accelerator,
      ok: item.action !== 'prevTrack',
      conflict: item.action === 'prevTrack'
        ? { kind: 'occupied', sourceName: '系统 / 其他软件', reason: '该组合键已被占用或被系统保留' }
        : undefined,
    })),
  });
  await harness.context.registerGlobalHotkeys();
  assert.deepEqual(plain(harness.context.failedGlobalHotkeyActions()), ['prevTrack']);
  harness.flush();
  assert.equal(harness.toasts.length, 1);
  assert.match(harness.toasts[0], /上一首/);
  assert.match(harness.toasts[0], /占用/);

  // 同一次会话里不要反复弹。
  await harness.context.registerGlobalHotkeys();
  harness.flush();
  assert.equal(harness.toasts.length, 1);

  // 面板开着时行内状态已经写清楚了，不再叠提示。
  const opened = loadHotkeyModule({
    registerResults: (bindings) => bindings.map((item) => ({ action: item.action, accelerator: item.accelerator, ok: false })),
  });
  opened.modal.classList.add('show');
  await opened.context.registerGlobalHotkeys();
  opened.flush();
  assert.equal(opened.toasts.length, 0);
});

test('注册失败的组合在面板里给出原因，不合法的组合直接标成不能用', async () => {
  const harness = loadHotkeyModule({
    registerResults: (bindings) => bindings.map((item) => ({
      action: item.action,
      accelerator: item.accelerator,
      ok: false,
      conflict: { kind: 'unsupported', sourceName: '不支持该组合键', reason: '这个按键无法注册成系统级全局热键，请换一组' },
    })),
  });
  await harness.context.registerGlobalHotkeys();
  const markup = harness.context.hotkeyStatusMarkup('global', 'togglePlay', 'Ctrl+Alt+Space');
  assert.match(markup, /hotkey-status conflict/);
  assert.match(markup, /不支持该组合键/);
  assert.match(markup, /title="这个按键无法注册成系统级全局热键，请换一组"/);

  const rejected = harness.context.hotkeyStatusMarkup('global', 'togglePlay', 'Space');
  assert.match(rejected, /不能作为全局热键/);
  assert.match(rejected, /title="/);

  // 本地作用域不做系统级校验，裸键照样可用。
  assert.match(harness.context.hotkeyStatusMarkup('local', 'togglePlay', 'Space'), /hotkey-status ok/);
  assert.match(harness.context.hotkeyStatusMarkup('global', 'togglePlay', ''), /未设置/);
});

test('executeHotkeyAction 覆盖到全部动作，全局触发的窗口开关交给主进程', () => {
  const harness = loadHotkeyModule();
  const ctx = harness.context;
  ['togglePlay', 'prevTrack', 'nextTrack', 'volumeUp', 'volumeDown', 'toggleMute', 'toggleFullscreen', 'toggleDesktopLyrics']
    .forEach((action) => ctx.executeHotkeyAction(action, 'global'));
  assert.deepEqual(harness.invoked, [
    'togglePlay', 'prevTrack', 'nextTrack', 'volume:0.05', 'volume:-0.05',
    'toggleMute', 'toggleFullscreen', 'toggleFx',
  ]);

  harness.invoked.length = 0;
  // 主进程已经收起/唤回窗口了，渲染层再 minimize 一次会把状态弹回去。
  ctx.executeHotkeyAction('toggleMainWindow', 'global');
  assert.deepEqual(harness.invoked, []);
  ctx.executeHotkeyAction('toggleMainWindow', 'local');
  assert.deepEqual(harness.invoked, ['minimize']);
});

test('主进程只认 Electron 支持的加速键写法', () => {
  const supported = loadMainHotkeyModule().context.isSupportedAccelerator;
  const good = [
    'Control+Alt+Left', 'Control+Alt+Right', 'Control+Alt+Up', 'Control+Alt+Down',
    'Control+Alt+Space', 'Control+Alt+M', 'Control+Shift+7', 'Super+K',
    'Control+Alt+Shift+Super+Z', 'Control+Alt+num5', 'Control+Alt+numadd',
    'Control+Alt+numdec', 'Control+Alt+Enter', 'Control+Alt+,', 'Control+Alt+-',
    'Control+Alt+/', 'Control+Alt+Escape', 'Control+Alt+F13', 'CommandOrControl+Alt+P',
    'MediaNextTrack', 'MediaPreviousTrack', 'VolumeMute', 'F5',
  ];
  for (const accelerator of good) assert.equal(supported(accelerator), true, accelerator + ' 应被接受');
  const bad = [
    '', '+', 'Control+', '+Left', 'Control++Left', 'Control+Alt+Lang1',
    'Control+Alt+F25', 'Hyper+A', 'Control+Alt+ArrowLeft', 'Left+Control',
    'Control+Alt+num10', 'Control+Alt+MediaNext',
  ];
  for (const accelerator of bad) assert.equal(supported(accelerator), false, accelerator + ' 应被拒绝');
});

test('configureMineradioGlobalHotkeys 先撤旧键，再逐条注册并去重', () => {
  const harness = loadMainHotkeyModule();
  const first = plain(harness.context.configureMineradioGlobalHotkeys([
    { action: 'prevTrack', accelerator: 'Control+Alt+Left' },
    { action: 'nextTrack', accelerator: 'Control+Alt+Right' },
  ]));
  assert.equal(first.ok, true);
  assert.deepEqual(first.results.map((item) => item.ok), [true, true]);
  assert.deepEqual(harness.registered, ['Control+Alt+Left', 'Control+Alt+Right']);
  assert.deepEqual(harness.unregistered, []);

  // 第二次配置必须先把上一轮注册的键还给系统，否则改键后旧键还在。
  const second = plain(harness.context.configureMineradioGlobalHotkeys([
    { action: 'prevTrack', accelerator: 'Control+Alt+,' },
    { action: 'nextTrack', accelerator: 'Control+Alt+,' },
    { action: 'togglePlay', accelerator: '' },
    { action: '', accelerator: 'Control+Alt+Space' },
  ]));
  assert.deepEqual(harness.unregistered, ['Control+Alt+Left', 'Control+Alt+Right']);
  assert.deepEqual(harness.registered.slice(2), ['Control+Alt+,'], '同一个加速键只注册一次');
  assert.deepEqual(second.results.map((item) => item.action), ['prevTrack']);
});

test('不支持的加速键报「不支持」，被占用的报「已占用」，两者不能混', () => {
  const harness = loadMainHotkeyModule({ occupied: ['Control+Alt+Left'], throwing: ['Control+Alt+Up'] });
  const res = plain(harness.context.configureMineradioGlobalHotkeys([
    { action: 'prevTrack', accelerator: 'Control+Alt+Left' },
    { action: 'nextTrack', accelerator: 'Control+Alt+ArrowRight' },
    { action: 'volumeUp', accelerator: 'Control+Alt+Up' },
    { action: 'togglePlay', accelerator: 'Control+Alt+Space' },
  ]));
  const byAction = {};
  res.results.forEach((item) => { byAction[item.action] = item; });
  assert.equal(byAction.prevTrack.ok, false);
  assert.equal(byAction.prevTrack.conflict.kind, 'occupied');
  assert.match(byAction.prevTrack.conflict.reason, /占用/);
  // 翻译不出来的写法不该谎报成「被别的软件占了」。
  assert.equal(byAction.nextTrack.ok, false);
  assert.equal(byAction.nextTrack.conflict.kind, 'unsupported');
  assert.equal(harness.registered.includes('Control+Alt+ArrowRight'), false, '不支持的加速键不该送进 register');
  // register 抛异常也要当注册失败，不能让整条配置炸掉。
  assert.equal(byAction.volumeUp.ok, false);
  assert.equal(byAction.volumeUp.conflict.kind, 'occupied');
  assert.equal(byAction.togglePlay.ok, true);
});

test('窗口开关由主进程直接执行，其余动作才发给渲染层', () => {
  const visible = loadMainHotkeyModule({ visible: true });
  visible.context.sendGlobalHotkeyAction('toggleMainWindow');
  assert.deepEqual(visible.windowCalls, ['minimize']);
  assert.deepEqual(visible.sent, [], '窗口动作不该再往渲染层发一遍');

  const minimized = loadMainHotkeyModule({ visible: true, minimized: true });
  minimized.context.sendGlobalHotkeyAction('toggleMainWindow');
  assert.deepEqual(minimized.windowCalls, ['focus']);

  const hidden = loadMainHotkeyModule({ visible: false });
  hidden.context.sendGlobalHotkeyAction('toggleMainWindow');
  assert.deepEqual(hidden.windowCalls, ['focus']);

  const playback = loadMainHotkeyModule();
  playback.context.sendGlobalHotkeyAction('nextTrack');
  assert.deepEqual(playback.sent, [{ channel: 'mineradio-global-hotkey', payload: { action: 'nextTrack' } }]);
  assert.deepEqual(playback.windowCalls, []);

  // 没有主窗口时静默返回，不能抛。
  const noWindow = loadMainHotkeyModule({ noWindow: true });
  noWindow.context.sendGlobalHotkeyAction('nextTrack');
  noWindow.context.sendGlobalHotkeyAction('toggleMainWindow');
  noWindow.context.sendGlobalHotkeyAction('');
  assert.deepEqual(noWindow.sent, []);
});

test('注册成功的加速键按下时会触发对应动作', () => {
  const harness = loadMainHotkeyModule();
  harness.context.configureMineradioGlobalHotkeys([
    { action: 'nextTrack', accelerator: 'Control+Alt+Right' },
    { action: 'toggleMainWindow', accelerator: 'Control+Alt+H' },
  ]);
  harness.handlers.get('Control+Alt+Right')();
  assert.deepEqual(harness.sent, [{ channel: 'mineradio-global-hotkey', payload: { action: 'nextTrack' } }]);
  harness.handlers.get('Control+Alt+H')();
  assert.deepEqual(harness.windowCalls, ['minimize']);
});

test('退出前撤销全局热键，接线与样式都在位', () => {
  const harness = loadMainHotkeyModule();
  harness.context.configureMineradioGlobalHotkeys([{ action: 'nextTrack', accelerator: 'Control+Alt+Right' }]);
  harness.context.unregisterMineradioGlobalHotkeys();
  assert.deepEqual(harness.unregistered, ['Control+Alt+Right']);
  assert.equal(harness.context.registeredGlobalHotkeys.size, 0);

  assert.match(mainSource, /app\.on\('before-quit'[\s\S]{0,400}unregisterMineradioGlobalHotkeys\(\)/);
  assert.match(mainSource, /ipcMain\.handle\('mineradio-hotkeys-configure-global',\s*trustedMainFrameHandler\(/);
  assert.match(preloadSource, /configureGlobalHotkeys:/);
  assert.match(preloadSource, /onGlobalHotkey:/);
  assert.match(preloadSource, /mineradio-global-hotkey/);
  assert.match(appSource, /function bindHotkeySettings\(\)[\s\S]{0,600}registerGlobalHotkeys\(\)/);
  assert.match(cssSource, /\.hotkey-modal\.warn \.hotkey-capture-tip\{/);
});

test('热键面板复用播放器的弹窗与胶囊类名，主题插件的 css 段才能选中它', () => {
  const shell = slice(appSource, 'function ensureHotkeyModal() {', 'function hotkeyStatusMarkup(', 'ensureHotkeyModal');
  // 外壳必须是 .modal-mask + .modal：内置/第三方主题的 css 段就是按这两个类名写的，
  // 自己另起一套类名会既不像播放器，也一条主题规则都接不到。
  assert.match(shell, /modal\.className = 'modal-mask hotkey-modal'/);
  assert.match(shell, /<div class="modal hotkey-dialog">/);
  // 分段切换借 .panel-tab、关闭走 .btn-row + .modal-btn，不再是右上角一个裸的 ×。
  assert.match(shell, /class="panel-tab active" data-hotkey-scope="local"/);
  assert.match(shell, /class="panel-tab" data-hotkey-scope="global"/);
  assert.match(shell, /<div class="btn-row">[\s\S]{0,160}class="modal-btn"[^>]*data-hotkey-close/);
  assert.doesNotMatch(shell, /hotkey-close"|hotkey-head|hotkey-title/);

  // 每一行的按键/默认按钮都戴 .fx-mini-btn 的皮，app.css 的主题兼容层按这个类名灌 --th-chip-*。
  const rows = slice(appSource, 'function renderHotkeyScope(', 'function renderHotkeySettings(', 'renderHotkeyScope');
  assert.match(rows, /class="fx-mini-btn hotkey-key/);
  assert.match(rows, /class="fx-mini-btn ghost hotkey-reset"/);
});

test('热键面板的颜色全部走主题令牌，不写死深灰底', () => {
  const block = slice(cssSource, '.hotkey-dialog{', '/*  歌单/队列面板', 'hotkey CSS');
  // 行、文字、胶囊分别接 --th-row-* / --th-text-* / --th-chip-*，换主题时才会跟着走。
  ['--th-row-bg', '--th-row-border', '--th-row-hover-bg', '--th-text-strong', '--th-text-dim', '--th-chip-bg', '--th-chip-border']
    .forEach(function(token){ assert.ok(block.includes(token), '热键样式缺少主题令牌 ' + token); });
  // 强调色一律 rgba(var(--fc-accent-rgb),...)，写死青色连用户自己调的强调色都不跟。
  assert.doesNotMatch(block, /rgba\(0,\s*245,\s*212/);
  assert.match(block, /rgba\(var\(--fc-accent-rgb\),/);
  // 弹窗层级回到 .modal-mask 的 50：之前的 1450 会盖住 z-index 500 的自绘标题栏，窗口按钮点不到。
  assert.doesNotMatch(block, /z-index:\s*1450/);
  assert.doesNotMatch(cssSource, /\.hotkey-modal\{position:fixed/);
});
