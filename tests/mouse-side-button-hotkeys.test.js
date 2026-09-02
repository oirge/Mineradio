'use strict';
// 鼠标中键 / 侧键热键守卫。
// 这条路和键盘热键完全不同：Electron 的 globalShortcut 只收键盘，所以全局鼠标键得靠一个系统级低层钩子，
// 而那个钩子是「监听器」不是「过滤器」——它拦不住浏览器的后退。于是这里要钉三件事：
// 1) 鼠标组合永远翻不成 Electron 加速键，别把废串送去注册；
// 2) 左右键一律不可绑，录入面板本身要靠左键点按钮；
// 3) 前台时同一个组合只跑一遍，别让局内派发和全局钩子各触发一次。

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
const mainSource = fs.readFileSync(path.join(root, 'desktop', 'main.js'), 'utf8');
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

const HOTKEY_TABLES_SOURCE = slice(appSource, 'var HOTKEY_ACTIONS = [', 'var hotkeyCaptureState = null;', '热键常量表');
const HOTKEY_IMPL_SOURCE = slice(appSource, 'function getHotkeyDefaults() {', 'function bindFxPanel() {', '热键实现');
const MAIN_MOUSE_SOURCE = slice(
  mainSource,
  'const GLOBAL_MOUSE_HOTKEY_BUTTONS = new Set(',
  'function rectsOverlapOnY(',
  '主进程全局鼠标热键',
);
/**
 * 造一个够用的假节点。
 * @param {string} id 节点标识。
 * @returns {object} 假节点。
 */
function createFakeNode(id) {
  const classNames = new Set();
  return {
    id,
    textContent: '',
    innerHTML: '',
    classList: {
      add() { for (const name of arguments) classNames.add(name); },
      remove() { for (const name of arguments) classNames.delete(name); },
      toggle(name, on) { if (on) classNames.add(name); else classNames.delete(name); },
      contains(name) { return classNames.has(name); },
    },
    setAttribute() {},
    getAttribute() { return null; },
    appendChild(child) { return child; },
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };
}

/**
 * 在 vm 里跑起渲染层热键模块，只保留鼠标相关的可观测点。
 * @param {{desktop?:boolean,mouseApi?:boolean,mouseResults?:Function}=} options 桩配置。
 * @returns {object} 上下文与调用记录。
 */
function loadRendererHotkeys(options) {
  const opts = options || {};
  const invoked = [];
  const toasts = [];
  const keyboardPayloads = [];
  const mousePayloads = [];
  const listeners = new Map();
  const nodes = new Map();
  const modal = createFakeNode('hotkey-modal');
  modal.querySelectorAll = () => [];
  nodes.set('hotkey-modal', modal);
  ['hotkey-local-section', 'hotkey-global-section', 'hotkey-capture-tip'].forEach((id) => nodes.set(id, createFakeNode(id)));
  const desktopApi = {
    onGlobalHotkey() {},
    configureGlobalHotkeys(bindings) {
      keyboardPayloads.push(plain(bindings) || []);
      return Promise.resolve({ ok: true, results: (plain(bindings) || []).map((item) => ({ action: item.action, ok: true })) });
    },
  };
  if (opts.mouseApi !== false) {
    desktopApi.configureGlobalMouseHotkeys = (payload) => {
      const snapshot = plain(payload) || {};
      mousePayloads.push(snapshot);
      const custom = opts.mouseResults ? opts.mouseResults(snapshot) : null;
      return Promise.resolve({
        ok: true,
        available: true,
        results: custom || (snapshot.bindings || []).map((item) => ({ action: item.action, ok: true })),
      });
    };
  }
  const context = {
    console, JSON, Math, Object, Array, String, Number, Boolean, Promise, RegExp, Date,
    HOTKEY_SETTINGS_STORE_KEY: 'mineradio-hotkeys',
    hotkeySettings: null,
    hotkeyGlobalStatus: {},
    hotkeyCaptureState: null,
    hotkeyCaptureNotice: '',
    freeCamera: null,
    localStorage: { getItem: () => null, setItem() {} },
    setPersistentLocalStorageItem() {},
    showToast(message) { toasts.push(String(message)); },
    setTimeout(fn) { return 0; },
    isTypingTarget: () => false,
    escHtml(value) { return String(value == null ? '' : value); },
    togglePlay() { invoked.push('togglePlay'); },
    prevTrack() { invoked.push('prevTrack'); },
    nextTrack() { invoked.push('nextTrack'); },
    adjustVolumeByKeyboard(delta) { invoked.push('volume:' + delta); },
    toggleMute() { invoked.push('toggleMute'); },
    toggleFullscreen() { invoked.push('toggleFullscreen'); },
    toggleFx() { invoked.push('toggleFx'); },
    resumeLastPlayback(source) { invoked.push('resumeLastPlayback:' + source); return true; },
    getDesktopWindowApi: () => (opts.desktop === false ? null : desktopApi),
    document: {
      body: createFakeNode('body'),
      getElementById: (id) => (nodes.has(id) ? nodes.get(id) : null),
      createElement: (tag) => createFakeNode('created-' + tag),
      addEventListener(type, handler) { listeners.set(type, handler); },
    },
  };
  vm.runInNewContext(HOTKEY_TABLES_SOURCE + '\n' + HOTKEY_IMPL_SOURCE, context, { filename: 'app.mouse-hotkeys.js' });
  context.hotkeySettings = context.readHotkeySettings();
  /**
   * 造一次鼠标事件并送进指定监听。
   * @param {string} type 事件类型。
   * @param {object} init 事件字段。
   * @returns {object} 被触发的假事件。
   */
  function fire(type, init) {
    const handler = listeners.get(type);
    assert.ok(handler, type + ' 监听未注册');
    const event = {
      button: 0, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false,
      defaultPrevented: false, propagationStopped: false,
      preventDefault() { this.defaultPrevented = true; },
      stopPropagation() { this.propagationStopped = true; },
    };
    Object.assign(event, init || {});
    handler(event);
    return event;
  }

  return { context, invoked, toasts, keyboardPayloads, mousePayloads, listeners, nodes, modal, fire, desktopApi };
}

/**
 * 在 vm 里跑起主进程的鼠标钩子模块，原生模块与主窗口都是假的。
 * @param {{hookAvailable?:boolean,startThrows?:boolean,focused?:boolean}=} options 桩配置。
 * @returns {object} 上下文与调用记录。
 */
function loadMainMouseHotkeys(options) {
  const opts = options || {};
  const requires = [];
  const hookCalls = [];
  const dispatched = [];
  const hookHandlers = new Map();
  const uIOhook = {
    on(type, handler) { hookHandlers.set(type, handler); hookCalls.push('on:' + type); },
    start() { hookCalls.push('start'); if (opts.startThrows) throw new Error('hook start failed'); },
    stop() { hookCalls.push('stop'); },
  };
  const context = {
    console: { warn() {}, log() {}, error() {} },
    JSON, Object, Array, String, Number, Boolean, Set, Map,
    require(name) {
      requires.push(name);
      if (opts.hookAvailable === false) throw new Error('MODULE_NOT_FOUND');
      return { uIOhook, EventType: { EVENT_MOUSE_PRESSED: 7 } };
    },
    mainWindow: {
      isDestroyed: () => false,
      isFocused: () => opts.focused !== false,
    },
    sendGlobalHotkeyAction(action) { dispatched.push(action); },
  };
  vm.runInNewContext(MAIN_MOUSE_SOURCE, context, { filename: 'main.mouse-hotkeys.js' });
  return { context, requires, hookCalls, dispatched, hookHandlers };
}
test('可绑的鼠标键只有中键和两个侧键，正反表严格互逆', () => {
  const ctx = loadRendererHotkeys().context;
  assert.deepEqual(plain(ctx.HOTKEY_MOUSE_TOKENS), {
    MouseMiddle: { dom: 1, uio: 3 },
    MouseBack: { dom: 3, uio: 4 },
    MouseForward: { dom: 4, uio: 5 },
  });
  const byDom = plain(ctx.HOTKEY_MOUSE_TOKEN_BY_DOM_BUTTON);
  assert.deepEqual(byDom, { 1: 'MouseMiddle', 3: 'MouseBack', 4: 'MouseForward' });
  // 两张表对不上就会出现「录得进去、按下没反应」的哑键。
  Object.keys(plain(ctx.HOTKEY_MOUSE_TOKENS)).forEach((token) => {
    assert.equal(byDom[plain(ctx.HOTKEY_MOUSE_TOKENS)[token].dom], token);
  });
  // 左键 0 和右键 2 永远不在表里：录入面板要靠左键点按钮，右键还要留给菜单。
  assert.equal(byDom[0], undefined);
  assert.equal(byDom[2], undefined);
});

test('一次鼠标按下折成内部组合键，左右键折不出东西', () => {
  const normalize = loadRendererHotkeys().context.normalizeHotkeyMouseEvent;
  assert.equal(normalize({ button: 1 }), 'MouseMiddle');
  assert.equal(normalize({ button: 3 }), 'MouseBack');
  assert.equal(normalize({ button: 4 }), 'MouseForward');
  assert.equal(normalize({ button: 4, ctrlKey: true, shiftKey: true }), 'Ctrl+Shift+MouseForward');
  assert.equal(normalize({ button: 3, ctrlKey: true, altKey: true, shiftKey: true, metaKey: true }), 'Ctrl+Alt+Shift+Meta+MouseBack');
  assert.equal(normalize({ button: 0, ctrlKey: true }), '');
  assert.equal(normalize({ button: 2 }), '');
  assert.equal(normalize(null), '');
});

test('鼠标组合永远翻不成 Electron 加速键', () => {
  const toAccel = loadRendererHotkeys().context.hotkeyToAccelerator;
  // 不在这里挡掉，`Ctrl+MouseBack` 会拼出 'Control+' 这种真值废串，
  // 一路送到主进程注册失败，再回一条假的「已被占用」给用户。
  assert.equal(toAccel('MouseMiddle'), '');
  assert.equal(toAccel('Ctrl+MouseBack'), '');
  assert.equal(toAccel('Ctrl+Alt+MouseForward'), '');
  assert.equal(toAccel('Ctrl+Alt+ArrowLeft'), 'Control+Alt+Left', '键盘那条路不能被误伤');
});

test('鼠标组合拆成主进程要的按钮号加修饰键', () => {
  const descriptor = loadRendererHotkeys().context.hotkeyMouseDescriptor;
  assert.deepEqual(plain(descriptor('MouseBack')), { button: 4, ctrl: false, alt: false, shift: false, meta: false });
  assert.deepEqual(plain(descriptor('Ctrl+Alt+MouseForward')), { button: 5, ctrl: true, alt: true, shift: false, meta: false });
  assert.deepEqual(plain(descriptor('Shift+MouseMiddle')), { button: 3, ctrl: false, alt: false, shift: true, meta: false });
  assert.equal(descriptor('Ctrl+Alt+ArrowLeft'), null);
  assert.equal(descriptor(''), null);
});
test('三个鼠标词元的 accel 是空串，bare 又让它们能裸绑全局', () => {
  // 这两条属性凑在一起正是 hotkeyToAccelerator 必须显式挡鼠标的原因：
  // bare 放它过了全局校验，accel 空串又会把加速键拼成 'Control+'。
  assert.match(appSource, /MouseMiddle:\{ accel:'', label:'鼠标中键', bare:true, mouse:true \}/);
  assert.match(appSource, /MouseBack:\{ accel:'', label:'鼠标侧键 1 · 后退', bare:true, mouse:true \}/);
  assert.match(appSource, /MouseForward:\{ accel:'', label:'鼠标侧键 2 · 前进', bare:true, mouse:true \}/);
});

test('鼠标键在面板上显示中文名，不给用户看 MouseBack', () => {
  const format = loadRendererHotkeys().context.formatHotkey;
  assert.equal(format('MouseMiddle'), '鼠标中键');
  assert.equal(format('Ctrl+MouseBack'), 'Ctrl + 鼠标侧键 1 · 后退');
  assert.equal(format('Meta+MouseForward'), 'Win + 鼠标侧键 2 · 前进');
  assert.equal(format(''), '未设置');
});

test('鼠标键可以裸绑全局，键盘裸键仍旧被挡', () => {
  const reason = loadRendererHotkeys().context.globalHotkeyRejectReason;
  // 鼠标键 bare:true 是有道理的：低层钩子只是监听，绑了不会把这个键从别的软件手里抢走。
  assert.equal(reason('MouseMiddle'), '');
  assert.equal(reason('MouseBack'), '');
  assert.equal(reason('Ctrl+MouseForward'), '');
  assert.match(reason('KeyK'), /至少要带 Ctrl、Alt 或 Win/, '键盘裸键那条约束不能被鼠标这条路顺手放开');
  assert.equal(reason('Ctrl+KeyK'), '');
});
/**
 * 只留下指定绑定，其余清空。默认表里本来就有九组键盘热键，不清干净断言会被它们淹掉。
 * @param {object} ctx vm 上下文。
 * @param {string} scope 'local' 或 'global'。
 * @param {object} map 动作 → 组合键。
 * @returns {void}
 */
function onlyBindings(ctx, scope, map) {
  Object.keys(ctx.hotkeySettings[scope]).forEach((key) => { ctx.hotkeySettings[scope][key] = ''; });
  Object.keys(map || {}).forEach((key) => { ctx.hotkeySettings[scope][key] = map[key]; });
}

test('注册时键盘走加速键、鼠标走低层钩子，两条路各发一次', async () => {
  const harness = loadRendererHotkeys();
  const ctx = harness.context;
  onlyBindings(ctx, 'global', { togglePlay: 'Ctrl+Alt+ArrowRight', prevTrack: 'Ctrl+MouseBack', nextTrack: 'MouseForward' });
  onlyBindings(ctx, 'local', { toggleMute: 'MouseMiddle' });
  await ctx.registerGlobalHotkeys();
  assert.equal(harness.keyboardPayloads.length, 1);
  assert.equal(harness.mousePayloads.length, 1);
  // 鼠标组合混进键盘表就是一条注册不了的废绑定，用户只会收到一句假的「已被占用」。
  assert.deepEqual(harness.keyboardPayloads[0], [{ action: 'togglePlay', accelerator: 'Control+Alt+Right' }]);
  assert.deepEqual(harness.mousePayloads[0].bindings, [
    { button: 4, ctrl: true, alt: false, shift: false, meta: false, action: 'prevTrack' },
    { button: 5, ctrl: false, alt: false, shift: false, meta: false, action: 'nextTrack' },
  ]);
  // 局内鼠标绑定也要一起送过去，主进程靠它避免前台双触发；这张表不带 action。
  assert.deepEqual(harness.mousePayloads[0].local, [{ button: 3, ctrl: false, alt: false, shift: false, meta: false }]);
  assert.deepEqual(Object.keys(plain(ctx.hotkeyGlobalStatus)).sort(), ['nextTrack', 'prevTrack', 'togglePlay']);
});

test('内部重复和不能全局的组合都不送去注册', async () => {
  const harness = loadRendererHotkeys();
  const ctx = harness.context;
  onlyBindings(ctx, 'global', { prevTrack: 'MouseBack', nextTrack: 'MouseBack', toggleMute: 'KeyM' });
  await ctx.registerGlobalHotkeys();
  assert.deepEqual(harness.keyboardPayloads[0], []);
  assert.deepEqual(harness.mousePayloads[0].bindings, [], '重复的鼠标组合在渲染层就该被拦下，不用等主进程回 occupied');
});

test('局内重复的鼠标组合不进 local 表，否则会把全局那条也一起哑掉', async () => {
  const harness = loadRendererHotkeys();
  const ctx = harness.context;
  onlyBindings(ctx, 'global', { togglePlay: 'MouseMiddle' });
  onlyBindings(ctx, 'local', { prevTrack: 'MouseMiddle', nextTrack: 'MouseMiddle' });
  await ctx.registerGlobalHotkeys();
  assert.deepEqual(harness.mousePayloads[0].local, []);
});
test('桌面端没有鼠标钩子 API 时，每条鼠标绑定都回一句能读的降级说明', async () => {
  const harness = loadRendererHotkeys({ mouseApi: false });
  const ctx = harness.context;
  onlyBindings(ctx, 'global', { nextTrack: 'MouseForward' });
  await ctx.registerGlobalHotkeys();
  assert.equal(harness.mousePayloads.length, 0);
  const status = plain(ctx.hotkeyGlobalStatus).nextTrack;
  assert.equal(status.ok, false);
  assert.equal(status.conflict.kind, 'unsupported');
  assert.equal(status.conflict.sourceName, '桌面端不支持');
  // 不给这句话，用户只能对着一个「待检测」猜为什么鼠标键在别的软件里没反应。
  assert.match(status.conflict.reason, /只能在 Mineradio 窗口内生效/);
});

test('一条鼠标绑定都没有时不凭空造出一堆「不支持」', async () => {
  const harness = loadRendererHotkeys({ mouseApi: false });
  const ctx = harness.context;
  onlyBindings(ctx, 'global', { togglePlay: 'Ctrl+Alt+Space' });
  await ctx.registerGlobalHotkeys();
  assert.deepEqual(Object.keys(plain(ctx.hotkeyGlobalStatus)), ['togglePlay']);
});

test('主进程回来的鼠标注册结果并进面板状态', async () => {
  const harness = loadRendererHotkeys({
    mouseResults: () => [{ action: 'nextTrack', ok: false, conflict: { kind: 'occupied', sourceName: '别的软件' } }],
  });
  const ctx = harness.context;
  onlyBindings(ctx, 'global', { nextTrack: 'MouseForward' });
  await ctx.registerGlobalHotkeys();
  assert.equal(plain(ctx.hotkeyGlobalStatus).nextTrack.conflict.sourceName, '别的软件');
  assert.deepEqual(plain(ctx.failedGlobalHotkeyActions()), ['nextTrack']);
});

test('鼠标钩子那条 API 抛错时整表退回空状态，不卡在旧结果上', async () => {
  const harness = loadRendererHotkeys();
  const ctx = harness.context;
  ctx.hotkeyGlobalStatus = { nextTrack: { action: 'nextTrack', ok: true } };
  harness.desktopApi.configureGlobalMouseHotkeys = () => Promise.reject(new Error('ipc down'));
  onlyBindings(ctx, 'global', { nextTrack: 'MouseForward' });
  await ctx.registerGlobalHotkeys();
  assert.deepEqual(plain(ctx.hotkeyGlobalStatus), {}, '一条旧的「可用」留在面板上比什么都不显示更糟');
});
test('局内绑的鼠标键一按就派发，并且把这次按下吞掉', () => {
  const harness = loadRendererHotkeys();
  harness.context.hotkeySettings.local.nextTrack = 'MouseForward';
  const e = harness.fire('mousedown', { button: 4 });
  assert.deepEqual(harness.invoked, ['nextTrack']);
  // 不吞掉的话浏览器还会照常「前进」，页面直接跳走。
  assert.equal(e.defaultPrevented, true);
  assert.equal(e.propagationStopped, true);
});

test('带修饰键的鼠标绑定要修饰键对得上才算', () => {
  const harness = loadRendererHotkeys();
  harness.context.hotkeySettings.local.prevTrack = 'Ctrl+MouseBack';
  harness.fire('mousedown', { button: 3 });
  assert.deepEqual(harness.invoked, [], '少一个 Ctrl 就不是这条绑定');
  harness.fire('mousedown', { button: 3, ctrlKey: true });
  assert.deepEqual(harness.invoked, ['prevTrack']);
});

test('没绑的鼠标键不拦，左键点击永远放过', () => {
  const harness = loadRendererHotkeys();
  const side = harness.fire('mousedown', { button: 3 });
  assert.deepEqual(harness.invoked, []);
  assert.equal(side.defaultPrevented, false, '默认没绑侧键，这时候拦下来就是白吃掉一次后退');
  const left = harness.fire('mousedown', { button: 0 });
  assert.equal(left.defaultPrevented, false);
});

test('鼠标侧键能绑到「继续上次播放」这个新动作上', () => {
  const harness = loadRendererHotkeys();
  harness.context.hotkeySettings.local.resumeLastPlayback = 'MouseBack';
  harness.fire('mousedown', { button: 3 });
  assert.deepEqual(harness.invoked, ['resumeLastPlayback:hotkey']);
});

test('同一个鼠标组合绑到两个功能时只吞按下，不猜用户想跑哪个', () => {
  const harness = loadRendererHotkeys();
  harness.context.hotkeySettings.local.nextTrack = 'MouseForward';
  harness.context.hotkeySettings.local.prevTrack = 'MouseForward';
  const e = harness.fire('mousedown', { button: 4 });
  assert.deepEqual(harness.invoked, []);
  assert.equal(e.defaultPrevented, true, '仍然要吞：面板上已经标了「内部重复」，这时候放它去后退更莫名其妙');
});

test('热键面板开着时不派发局内鼠标键，否则点面板就会触发功能', () => {
  const harness = loadRendererHotkeys();
  harness.context.hotkeySettings.local.nextTrack = 'MouseForward';
  harness.modal.classList.add('show');
  const e = harness.fire('mousedown', { button: 4 });
  assert.deepEqual(harness.invoked, []);
  assert.equal(e.defaultPrevented, false);
});
test('录入状态下按侧键就录进去，左键仍然放过', () => {
  const harness = loadRendererHotkeys();
  const ctx = harness.context;
  ctx.startHotkeyCapture('nextTrack', 'global');
  const left = harness.fire('mousedown', { button: 0 });
  assert.equal(left.defaultPrevented, false, '录入时左键必须放过，不然用户点不到「取消」');
  assert.ok(ctx.hotkeyCaptureState, '左键不该结束录入');
  const side = harness.fire('mousedown', { button: 3, ctrlKey: true });
  assert.equal(ctx.hotkeySettings.global.nextTrack, 'Ctrl+MouseBack');
  assert.equal(ctx.hotkeyCaptureState, null);
  assert.equal(side.defaultPrevented, true);
  assert.equal(harness.mousePayloads.length, 1, '改完键要立刻重发绑定表');
});

test('录入状态下鼠标键不会被当成局内热键先跑一遍', () => {
  const harness = loadRendererHotkeys();
  const ctx = harness.context;
  ctx.hotkeySettings.local.nextTrack = 'MouseForward';
  ctx.startHotkeyCapture('prevTrack', 'local');
  harness.fire('mousedown', { button: 4 });
  assert.deepEqual(harness.invoked, [], '正在录的键不该顺手触发它原来绑着的功能');
  assert.equal(ctx.hotkeySettings.local.prevTrack, 'MouseForward');
});

test('auxclick 跟着一起吞，不然中键还会触发自动滚动', () => {
  const harness = loadRendererHotkeys();
  harness.context.hotkeySettings.local.toggleMute = 'MouseMiddle';
  const bound = harness.fire('auxclick', { button: 1 });
  assert.equal(bound.defaultPrevented, true);
  assert.deepEqual(harness.invoked, [], 'auxclick 只负责挡默认行为，动作已经在 mousedown 上跑过了');
  const free = harness.fire('auxclick', { button: 3 });
  assert.equal(free.defaultPrevented, false, '没绑的侧键要留给浏览器的后退');
  const left = harness.fire('auxclick', { button: 0 });
  assert.equal(left.defaultPrevented, false);
});

test('录入状态下所有可绑鼠标键的 auxclick 都被吞掉', () => {
  const harness = loadRendererHotkeys();
  harness.context.startHotkeyCapture('nextTrack', 'local');
  assert.equal(harness.fire('auxclick', { button: 1 }).defaultPrevented, true);
  assert.equal(harness.fire('auxclick', { button: 3 }).defaultPrevented, true);
  assert.equal(harness.fire('auxclick', { button: 0 }).defaultPrevented, false);
});

test('两个鼠标监听都挂在捕获阶段', () => {
  const listeners = slice(appSource, "document.addEventListener('mousedown', function(e){", 'function bindFxPanel() {', '鼠标监听');
  // 冒泡阶段挂的话，页面上任意一个 stopPropagation 都能让侧键失灵。
  assert.equal(listeners.split('}, true);').length - 1, 2);
  assert.ok(listeners.includes("document.addEventListener('auxclick', function(e){"));
});
test('按钮号加修饰键压成一个签名，四个修饰键各占一位', () => {
  const sig = loadMainMouseHotkeys().context.mouseHotkeySignature;
  assert.equal(sig(4, {}), '#4');
  assert.equal(sig(4, null), '#4');
  assert.equal(sig(5, { ctrl: true }), 'C#5');
  assert.equal(sig(3, { meta: true }), 'W#3');
  assert.equal(sig(3, { ctrl: true, alt: true, shift: true, meta: true }), 'CASW#3');
  // 顺序固定：绑定表和钩子事件各拼一次签名，顺序一变两边就永远对不上。
  assert.equal(sig(4, { shift: true, alt: true }), 'AS#4');
});

test('没有鼠标绑定时连原生模块都不 require，钩子也不会挂上系统', () => {
  const harness = loadMainMouseHotkeys();
  assert.deepEqual(plain(harness.context.configureMineradioGlobalMouseHotkeys({})), { ok: true, available: true, results: [] });
  assert.deepEqual(harness.requires, [], '没人绑鼠标键就不该把一个系统级钩子拉进进程');
  assert.deepEqual(harness.hookCalls, []);
});

test('数组和 {bindings,local} 两种形状都收，钩子只启动一次', () => {
  const harness = loadMainMouseHotkeys();
  const res = plain(harness.context.configureMineradioGlobalMouseHotkeys([
    { action: 'nextTrack', button: 5 },
    { action: 'prevTrack', button: 4, ctrl: true },
  ]));
  assert.deepEqual(res.results, [{ action: 'nextTrack', ok: true }, { action: 'prevTrack', ok: true }]);
  assert.deepEqual(harness.requires, ['uiohook-napi']);
  assert.deepEqual(harness.hookCalls, ['on:mousedown', 'start']);
  const again = plain(harness.context.configureMineradioGlobalMouseHotkeys({
    bindings: [{ action: 'togglePlay', button: 3 }],
    local: [{ button: 3 }],
  }));
  assert.deepEqual(again.results, [{ action: 'togglePlay', ok: true }]);
  assert.deepEqual(harness.hookCalls, ['on:mousedown', 'start'], '整表重发不该重挂监听或重启钩子');
});

test('左右键和不认识的按钮号一律回「不支持」，不静默丢掉', () => {
  const harness = loadMainMouseHotkeys();
  const res = plain(harness.context.configureMineradioGlobalMouseHotkeys([
    { action: 'nextTrack', button: 1 },
    { action: 'prevTrack', button: 2 },
    { action: 'togglePlay', button: 9 },
    { button: 4 },
  ]));
  assert.equal(res.results.length, 3, '没有 action 的条目直接跳过，不占一条结果');
  res.results.forEach((item) => {
    assert.equal(item.ok, false);
    assert.equal(item.conflict.kind, 'unsupported');
    assert.match(item.conflict.reason, /左右键要留给正常点击/);
  });
});
test('同一个鼠标组合绑到两个功能时，第二条报内部重复', () => {
  const res = plain(loadMainMouseHotkeys().context.configureMineradioGlobalMouseHotkeys([
    { action: 'nextTrack', button: 5, ctrl: true },
    { action: 'prevTrack', button: 5, ctrl: true },
    { action: 'togglePlay', button: 5 },
  ]));
  assert.deepEqual(res.results[0], { action: 'nextTrack', ok: true });
  assert.equal(res.results[1].ok, false);
  assert.equal(res.results[1].conflict.kind, 'occupied');
  assert.deepEqual(res.results[2], { action: 'togglePlay', ok: true }, '修饰键不一样就是另一个组合');
});

test('绑定表清空后钩子跟着停掉，不留一个空转的系统钩子', () => {
  const harness = loadMainMouseHotkeys();
  harness.context.configureMineradioGlobalMouseHotkeys([{ action: 'nextTrack', button: 5 }]);
  assert.deepEqual(harness.hookCalls, ['on:mousedown', 'start']);
  harness.context.configureMineradioGlobalMouseHotkeys({ bindings: [] });
  assert.deepEqual(harness.hookCalls, ['on:mousedown', 'start', 'stop']);
  harness.context.configureMineradioGlobalMouseHotkeys({ bindings: [] });
  assert.deepEqual(harness.hookCalls, ['on:mousedown', 'start', 'stop'], '已经停了就别再停一次');
});

test('装不上原生模块时报「钩子不可用」，available 一路传回渲染层', () => {
  const harness = loadMainMouseHotkeys({ hookAvailable: false });
  const res = plain(harness.context.configureMineradioGlobalMouseHotkeys([{ action: 'nextTrack', button: 5 }]));
  assert.equal(res.ok, true);
  assert.equal(res.available, false);
  assert.equal(res.results[0].ok, false);
  assert.equal(res.results[0].conflict.kind, 'unsupported');
  assert.match(res.results[0].conflict.reason, /只能在 Mineradio 窗口内生效/);
  // 加载失败只试一次，别让每次改键都去 require 一个装不上的模块。
  harness.context.configureMineradioGlobalMouseHotkeys([{ action: 'prevTrack', button: 4 }]);
  assert.deepEqual(harness.requires, ['uiohook-napi']);
});

test('钩子启动失败也算不可用，不假装绑上了', () => {
  const harness = loadMainMouseHotkeys({ startThrows: true });
  const res = plain(harness.context.configureMineradioGlobalMouseHotkeys([{ action: 'nextTrack', button: 5 }]));
  assert.equal(res.results[0].ok, false);
  assert.equal(res.results[0].conflict.kind, 'unsupported');
  assert.equal(res.available, true, '模块本身是好的，只是这次启动失败');
});
test('钩子送来的按下查表派发，认不出的按钮和没绑的组合都不动', () => {
  const harness = loadMainMouseHotkeys();
  harness.context.configureMineradioGlobalMouseHotkeys([
    { action: 'nextTrack', button: 5 },
    { action: 'prevTrack', button: 4, ctrl: true },
  ]);
  const hook = harness.hookHandlers.get('mousedown');
  assert.ok(hook, '钩子监听没挂上');
  hook({ button: 5 });
  hook({ button: 4, ctrlKey: true });
  hook({ button: 4 });
  hook({ button: 1 });
  hook(null);
  assert.deepEqual(harness.dispatched, ['nextTrack', 'prevTrack']);
});

test('前台时局内绑定优先，同一次按下不跑两遍', () => {
  const harness = loadMainMouseHotkeys();
  harness.context.configureMineradioGlobalMouseHotkeys({
    bindings: [{ action: 'nextTrack', button: 5 }, { action: 'togglePlay', button: 3 }],
    local: [{ button: 5 }],
  });
  const hook = harness.hookHandlers.get('mousedown');
  hook({ button: 5 });
  assert.deepEqual(harness.dispatched, [], '渲染层的 mousedown 已经跑过这条了');
  hook({ button: 3 });
  assert.deepEqual(harness.dispatched, ['togglePlay'], '局内没绑的组合照常从全局派发');
});

test('窗口不在前台时局内绑定让位给全局派发', () => {
  const harness = loadMainMouseHotkeys({ focused: false });
  harness.context.configureMineradioGlobalMouseHotkeys({
    bindings: [{ action: 'nextTrack', button: 5 }],
    local: [{ button: 5 }],
  });
  harness.hookHandlers.get('mousedown')({ button: 5 });
  assert.deepEqual(harness.dispatched, ['nextTrack'], '窗口在后台收不到 mousedown，这时必须由全局派发');
});

test('局内绑定表整表替换，改完键不留上一版的免触发标记', () => {
  const harness = loadMainMouseHotkeys();
  harness.context.configureMineradioGlobalMouseHotkeys({
    bindings: [{ action: 'nextTrack', button: 5 }],
    local: [{ button: 5 }],
  });
  harness.context.configureMineradioGlobalMouseHotkeys({ bindings: [{ action: 'nextTrack', button: 5 }], local: [] });
  harness.hookHandlers.get('mousedown')({ button: 5 });
  assert.deepEqual(harness.dispatched, ['nextTrack'], '局内那条已经删了，全局这条必须重新派发');
});
test('鼠标键这条路从渲染层一直接到主进程的钩子', () => {
  assert.match(preloadSource, /configureGlobalMouseHotkeys: \(payload\) => ipcRenderer\.invoke\('mineradio-hotkeys-configure-global-mouse', payload \|\| \{\}\)/);
  assert.match(mainSource, /ipcMain\.handle\('mineradio-hotkeys-configure-global-mouse', trustedMainFrameHandler\(\(_event, payload\) => \{\s*return configureMineradioGlobalMouseHotkeys\(payload\);/);
});

test('原生模块只有一处 require，而且是懒加载的', () => {
  // 顶部静态 require 会让每个用户都为一个装不上就报错的原生模块付启动成本。
  assert.equal(mainSource.split("require('uiohook-napi')").length - 1, 1);
  assert.match(mainSource, /function loadMouseHookModule\(\) \{[\s\S]{0,240}?require\('uiohook-napi'\)/);
  assert.match(mainSource, /const GLOBAL_MOUSE_HOTKEY_BUTTONS = new Set\(\[3, 4, 5\]\);/);
});

test('面板里写清了系统级鼠标键只是「监听」，别让用户以为能挡住后退', () => {
  assert.ok(appSource.includes('鼠标中键与两个侧键也能绑，但系统级鼠标键只是「监听」，原本的后退 / 前进动作仍会照常发生。'));
  assert.ok(appSource.includes('录入时也能直接按鼠标中键 / 侧键'));
});
