'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const main = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'main.js'), 'utf8');

/**
 * 按相邻函数名截取一个主进程函数。
 * @param {string} name 目标函数名。
 * @param {string} nextName 下一函数名。
 * @returns {string} 目标函数源码。
 */
function extractFunction(name, nextName) {
  const start = main.indexOf(`function ${name}(`);
  const end = main.indexOf(`function ${nextName}(`, start);
  assert.ok(start >= 0 && end > start, `未找到源码块: ${name}`);
  return main.slice(start, end);
}

/**
 * 截取指定函数的源码，直到下一个顶层函数声明。
 * @param {string} signature 函数签名前缀。
 * @returns {string} 函数源码。
 */
function readFunctionSource(signature) {
  const start = main.indexOf(signature);
  assert.ok(start > 0, `未找到函数: ${signature}`);
  const end = main.indexOf('\nfunction ', start + 1);
  return main.slice(start, end > 0 ? end : undefined);
}

/**
 * 在 vm 中装载右键入口处理器，观测它是否吞掉默认事件以及传入的 frame。
 * @returns {{win:object, trustedFrame:object, calls:{prevented:number,shown:Array<object>}, context:object}} 右键测试环境。
 */
function loadContextMenuHandlers() {
  const calls = { prevented: 0, shown: [] };
  const win = { name: 'mini-window' };
  const trustedFrame = { parent: null, url: 'http://127.0.0.1:3000/mini-player.html' };
  const context = {
    isTrustedMiniPlayerMainFrame(candidateWin, mode, frame) {
      return candidateWin === win
        && mode === 'standard'
        && (!frame || (frame === trustedFrame && frame.parent === null));
    },
    showMiniPlayerContextMenu(candidateWin, frame) {
      calls.shown.push({ candidateWin, frame });
    },
  };
  vm.runInNewContext(
    readFunctionSource('function handleMiniPlayerRendererContextMenu(win, mode, event, params)')
      + '\n'
      + readFunctionSource('function handleMiniPlayerSystemContextMenu(win, mode, event)'),
    context,
  );
  return { win, trustedFrame, calls, context };
}

/**
 * 在 vm 里跑出统一右键菜单模板，并观测每一项的点击行为。
 * @param {object=} overrides 需要覆盖的上下文字段。
 * @returns {{template: Array<object>, calls: object, context: object}} 模板与观测集合。
 */
function buildTemplate(overrides) {
  const calls = { focus: 0, writes: [], refresh: 0, miniEnabled: [], miniMode: [], startup: [], quit: 0 };
  const context = Object.assign({
    closeToTrayEnabled: true,
    miniPlayerEnabled: true,
    miniPlayerMode: 'standard',
    appQuitting: false,
    app: { quit: () => { calls.quit += 1; } },
    focusMainWindow: () => { calls.focus += 1; },
    writeDesktopShellSettings: (patch) => { calls.writes.push(patch); return patch; },
    refreshTrayMenu: () => { calls.refresh += 1; },
    setMiniPlayerEnabled: (value) => { calls.miniEnabled.push(value); },
    setMiniPlayerMode: (value) => { calls.miniMode.push(value); },
    isStartupEnabled: () => false,
    setStartupEnabled: (value) => { calls.startup.push(value); return { ok: true, enabled: !!value }; },
  }, overrides || {});
  /**
   * 在隔离 vm 中复现生产设置入口的副作用，让菜单点击仍能验证统一处理路径。
   * @param {boolean} enabled 新的关闭到托盘设置。
   * @returns {{ok:true,closeToTray:boolean}} 已确认的设置快照。
   */
  if (typeof context.setCloseToTrayEnabled !== 'function') {
    context.setCloseToTrayEnabled = (enabled) => {
      context.closeToTrayEnabled = !!enabled;
      context.writeDesktopShellSettings({ closeToTray: context.closeToTrayEnabled });
      context.refreshTrayMenu();
      return { ok: true, closeToTray: context.closeToTrayEnabled };
    };
  }
  vm.runInNewContext(
    extractFunction('buildAppContextMenuTemplate', 'refreshTrayMenu')
      + '\nthis.build = buildAppContextMenuTemplate;',
    context,
  );
  return { template: context.build(), calls, context };
}

test('托盘和迷你播放器共用同一份右键菜单模板，不再各写一份', () => {
  assert.equal(
    (main.match(/function buildAppContextMenuTemplate\(\)/g) || []).length,
    1,
    '统一模板构建器只能有一份',
  );

  const tray = readFunctionSource('function refreshTrayMenu()');
  assert.match(tray, /tray\.setContextMenu\(Menu\.buildFromTemplate\(buildAppContextMenuTemplate\(\)\)\)/, '托盘必须用统一模板');

  const mini = readFunctionSource('function showMiniPlayerContextMenu(win, frame)');
  assert.match(mini, /Menu\.buildFromTemplate\(buildAppContextMenuTemplate\(\)\)\.popup\(\{ window: win \}\)/, '迷你右键必须用统一模板');
  assert.match(mini, /if \(!win \|\| win\.isDestroyed\(\) \|\| miniPlayerWindow !== win\) return;/, '必须校验窗口仍是当前迷你窗口');
  // 菜单项写死在模板里，迷你菜单函数本体不许再出现任何 label，否则两份菜单又会漂移。
  assert.doesNotMatch(mini, /label:/, '迷你右键菜单不能自带菜单项');
});

test('迷你播放器菜单项与任务栏托盘完全一致，且每一项都可点', () => {
  const env = buildTemplate();
  // vm 里造出来的数组跨 realm，`map` 结果的原型不是本 realm 的 Array，deepEqual 会误判；用 Array.from 拷回来。
  const labels = Array.from(env.template, (item) => (item.type === 'separator' ? '---' : item.label));
  assert.deepEqual(labels, [
    '显示 Mineradio',
    '关闭按钮最小化到托盘',
    '最小化时显示迷你播放器',
    '迷你播放器样式',
    '开机自动启动',
    '---',
    '退出 Mineradio',
  ]);

  env.template.forEach((item) => {
    if (item.type === 'separator') return;
    assert.notEqual(item.enabled, false, `${item.label} 不能是灰的`);
    const actionable = typeof item.click === 'function' || Array.isArray(item.submenu);
    assert.ok(actionable, `${item.label} 必须可点或带子菜单`);
    if (!Array.isArray(item.submenu)) return;
    item.submenu.forEach((sub) => {
      assert.notEqual(sub.enabled, false, `${sub.label} 不能是灰的`);
      assert.equal(typeof sub.click, 'function', `${sub.label} 必须可点`);
    });
  });
});

test('每一项点下去都落到与托盘同一条处理路径上', () => {
  const env = buildTemplate();
  const pick = (label) => env.template.find((item) => item.label === label);

  pick('显示 Mineradio').click();
  assert.equal(env.calls.focus, 1);

  pick('关闭按钮最小化到托盘').click({ checked: false });
  assert.equal(env.calls.writes.length, 1);
  assert.equal(env.calls.writes[0].closeToTray, false, '必须把新设置写回磁盘');
  assert.equal(env.context.closeToTrayEnabled, false);
  assert.equal(env.calls.refresh, 1, '改完设置必须重建托盘菜单，勾选态才不会和真实设置脱节');

  pick('最小化时显示迷你播放器').click({ checked: false });
  assert.deepEqual(env.calls.miniEnabled, [false]);

  const styles = pick('迷你播放器样式').submenu;
  assert.deepEqual(Array.from(styles, (item) => [item.label, item.type, item.checked]), [
    ['标准（带封面）', 'radio', true],
    ['极简（无封面）', 'radio', false],
  ]);
  styles[1].click();
  assert.deepEqual(env.calls.miniMode, ['compact']);

  pick('开机自动启动').click({ checked: true });
  assert.deepEqual(env.calls.startup, [true]);

  pick('退出 Mineradio').click();
  assert.equal(env.context.appQuitting, true, '退出必须先置 appQuitting，否则关闭到托盘会把退出吞掉');
  assert.equal(env.calls.quit, 1);
});

test('勾选态跟随真实设置，开机自启设置失败时把勾去掉', () => {
  const off = buildTemplate({
    closeToTrayEnabled: false,
    miniPlayerEnabled: false,
    miniPlayerMode: 'compact',
    isStartupEnabled: () => true,
    setStartupEnabled: () => ({ ok: false, enabled: false, unsupported: true }),
  });
  const pick = (label) => off.template.find((item) => item.label === label);
  assert.equal(pick('关闭按钮最小化到托盘').checked, false);
  assert.equal(pick('最小化时显示迷你播放器').checked, false);
  assert.equal(pick('开机自动启动').checked, true);
  assert.deepEqual(Array.from(pick('迷你播放器样式').submenu, (item) => item.checked), [false, true]);

  const item = { checked: true };
  pick('开机自动启动').click(item);
  assert.equal(item.checked, false, '设置失败必须回退勾选态');
});

test('迷你窗口只接管可信主 frame 右键，并保留系统右键兜底', () => {
  const factoryStart = main.indexOf('function createMiniPlayerWindow()');
  const factoryEnd = main.indexOf('\nfunction ', factoryStart + 1);
  const factory = main.slice(factoryStart, factoryEnd > 0 ? factoryEnd : undefined);

  assert.match(
    factory,
    /win\.webContents\.on\('context-menu', \(event, params\) => \{\s*\n\s*handleMiniPlayerRendererContextMenu\(win, mode, event, params\);/,
    '非拖拽区右键走 renderer 的 context-menu',
  );
  const rendererHandler = readFunctionSource('function handleMiniPlayerRendererContextMenu(win, mode, event, params)');
  assert.match(rendererHandler, /const frame = params && params\.frame;/);
  assert.match(rendererHandler, /if \(!frame \|\| !isTrustedMiniPlayerMainFrame\(win, mode, frame\)\) return false;/);
  assert.ok(
    rendererHandler.indexOf('if (!frame || !isTrustedMiniPlayerMainFrame(win, mode, frame)) return false;')
      < rendererHandler.indexOf('event.preventDefault();'),
    '非法 frame 不能先被 preventDefault 吞掉',
  );
  // 拖拽区右键在 Windows 上被系统接走，弹的是几乎全灰的窗口系统菜单，renderer 收不到 contextmenu。
  assert.match(
    factory,
    /win\.on\('system-context-menu', \(event\) => \{\s*\n\s*handleMiniPlayerSystemContextMenu\(win, mode, event\);/,
    '拖拽区右键必须拦掉系统菜单并换成应用菜单',
  );
  const systemHandler = readFunctionSource('function handleMiniPlayerSystemContextMenu(win, mode, event)');
  assert.match(systemHandler, /if \(!isTrustedMiniPlayerMainFrame\(win, mode\)\) return false;/);
  assert.match(systemHandler, /event\.preventDefault\(\);[\s\S]*?showMiniPlayerContextMenu\(win\);/);
});

test('renderer 右键缺失 frame 或命中子 frame 时不吞默认菜单', () => {
  const env = loadContextMenuHandlers();
  const event = { preventDefault() { env.calls.prevented += 1; } };

  assert.equal(env.context.handleMiniPlayerRendererContextMenu(env.win, 'standard', event, {}), false);
  assert.equal(env.context.handleMiniPlayerRendererContextMenu(
    env.win,
    'standard',
    event,
    { frame: { parent: {}, url: env.trustedFrame.url } },
  ), false);
  assert.equal(env.calls.prevented, 0, '来源不明或子 frame 不能吞掉默认右键');
  assert.equal(env.calls.shown.length, 0);
});

test('renderer 可信主 frame 与 system fallback 都只弹一次应用菜单', () => {
  const env = loadContextMenuHandlers();
  const rendererEvent = { preventDefault() { env.calls.prevented += 1; } };
  const systemEvent = { preventDefault() { env.calls.prevented += 1; } };

  assert.equal(env.context.handleMiniPlayerRendererContextMenu(
    env.win,
    'standard',
    rendererEvent,
    { frame: env.trustedFrame },
  ), true);
  assert.equal(env.context.handleMiniPlayerSystemContextMenu(env.win, 'standard', systemEvent), true);
  assert.equal(env.calls.prevented, 2);
  assert.deepEqual(env.calls.shown, [
    { candidateWin: env.win, frame: env.trustedFrame },
    { candidateWin: env.win, frame: undefined },
  ]);
});

test('两套外壳整块 mini-shell 都留在 renderer 客户区，拖动走独立 IPC', () => {
  const factory = main.slice(main.indexOf('function createMiniPlayerWindow()'));
  assert.match(factory, /const page = mode === 'compact' \? 'mini-player-compact\.html' : 'mini-player\.html';/, '标准与极简共用同一个窗口工厂');

  ['mini-player.html', 'mini-player-compact.html'].forEach((file) => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'public', file), 'utf8');
    assert.match(html, /\.mini-shell \{[^}]*-webkit-app-region: no-drag;/, file);
    assert.match(html, /moveWindowBy/, `${file} 必须保留 renderer 拖动通道`);
    // 谁在页面里 preventDefault 掉 contextmenu，非拖拽区的右键就再也弹不出菜单。
    assert.doesNotMatch(html, /contextmenu/, `${file} 不能自己拦 contextmenu`);
  });
});
