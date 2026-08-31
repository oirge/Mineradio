'use strict';
// 插件系统白盒测试。三层各测一件事：
// - plugin-manifest.js：包解析、清洗、类型判定（纯函数，直接 require）；
// - plugin-sandbox.js：能力剥离与消息协议（在 vm 里跑真源码，配一个假 self）；
// - plugin-runtime.js：宿主侧 RPC、主题注入与主题互斥（在 vm 里跑真源码，配假 Worker/document）。
// 关键点是 runtime 与 sandbox 用真源码对接，中间的消息过一遍 JSON 往返模拟结构化克隆，
// 这样「插件返回不可克隆值」这类问题能在测试里就暴露。
// v1.7.4 起插件只剩主题一种能力，所以这里同时守住两条底线：
// 音源 / 歌单包在解析阶段就被拒；沙箱与运行时都不存在任何网络或播放通道。

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const repoRoot = path.join(__dirname, '..');
const publicDir = path.join(repoRoot, 'public');
const manifestSource = fs.readFileSync(path.join(publicDir, 'plugin-manifest.js'), 'utf8');
const sandboxSource = fs.readFileSync(path.join(publicDir, 'plugin-sandbox.js'), 'utf8');
const runtimeSource = fs.readFileSync(path.join(publicDir, 'plugin-runtime.js'), 'utf8');
const builtinThemesSource = fs.readFileSync(path.join(publicDir, 'plugin-builtin-themes.js'), 'utf8');
const Manifest = require(path.join(publicDir, 'plugin-manifest.js'));
const BuiltinThemes = require(path.join(publicDir, 'plugin-builtin-themes.js'));

/**
 * 造一个最小渲染进程环境并加载真 plugin-manifest.js + plugin-runtime.js。
 * Worker 用 startSandbox 接真沙箱源码，于是「插件 → 沙箱 → 宿主主题注入」整条链路都是真代码在跑。
 * 环境里刻意不放 fetch / XMLHttpRequest / URL：运行时哪天又长出网络调用，这里会直接炸给你看。
 * @param {object} [options] 选项：builtin 是否一起加载安装包自带主题模块、
 *   storage 复用一份已有的 localStorage 内容、importPluginFile 桌面导入桩。
 * @returns {object} 宿主句柄：plugins（运行时 API）、styleNodes、storage。
 */
function startHost(options) {
  const opts = options || {};
  const styleNodes = [];
  const storage = opts.storage instanceof Map ? opts.storage : new Map();
  const documentStub = {
    head: { appendChild(node) { styleNodes.push(node); return node; } },
    createElement() { return { id: '', textContent: '' }; },
    getElementById(id) { return styleNodes.find((n) => n.id === id) || null; },
  };
  const base = {
    console: { log() {}, error() {}, warn() {} },
    setTimeout,
    clearTimeout,
    document: documentStub,
    localStorage: {
      getItem(key) { return storage.has(key) ? storage.get(key) : null; },
      setItem(key, value) { storage.set(key, String(value)); },
      removeItem(key) { storage.delete(key); },
    },
    desktopWindow: {
      importPluginFile: opts.importPluginFile || (() => Promise.resolve({ ok: false, canceled: true })),
    },
    Worker: function Worker() {
      const handle = startSandbox((msg) => { if (this.onmessage) this.onmessage({ data: msg }); });
      this.postMessage = (msg) => handle.send(msg);
      this.terminate = () => {};
      this.onmessage = null;
      this.onerror = null;
    },
  };
  const context = vm.createContext(base);
  vm.runInContext('var globalThisRef = globalThis;', context);
  vm.runInContext(manifestSource, context, { filename: 'plugin-manifest.js' });
  // 自带主题模块默认不加载：绝大多数用例只关心用户手动装的插件，凭空多两条记录会把断言搅乱。
  if (opts.builtin) vm.runInContext(builtinThemesSource, context, { filename: 'plugin-builtin-themes.js' });
  vm.runInContext(runtimeSource, context, { filename: 'plugin-runtime.js' });
  return { context, plugins: base.MineradioPlugins, styleNodes, storage };
}
/**
 * 在 vm 里启动一个插件沙箱实例，返回可与之收发消息的句柄。
 * 用真 plugin-sandbox.js 源码，只补一个假 self 上的 postMessage / addEventListener。
 * @param {(msg: object) => void} onMessage 沙箱发出的消息回调。
 * @returns {{send: (msg: object) => void, context: object}} 沙箱句柄。
 */
function startSandbox(onMessage) {
  const listeners = [];
  const base = {
    console: { log() {}, error() {} },
    postMessage(msg) { onMessage(JSON.parse(JSON.stringify(msg))); },
    addEventListener(type, fn) { if (type === 'message') listeners.push(fn); },
  };
  const context = vm.createContext(base);
  vm.runInContext('var self = globalThis;', context);
  vm.runInContext(sandboxSource, context, { filename: 'plugin-sandbox.js' });
  return {
    context,
    send(msg) {
      const cloned = JSON.parse(JSON.stringify(msg));
      listeners.forEach((fn) => fn({ data: cloned }));
    },
  };
}

const THEME_SCRIPT_PLUGIN = [
  '/**',
  ' * @id demo.script-theme',
  ' * @name 示例脚本主题',
  ' * @kind theme',
  ' * @version 1.2.3',
  ' * @author tester',
  ' */',
  'mineradio.on("theme", function(){',
  '  return { vars: { "--th-panel-bg": "#101418" }, css: ".pl-card{border-radius:14px}" };',
  '});',
].join('\n');

test('JS 插件头注释清单被正确解析', () => {
  const parsed = Manifest.parsePluginPackage('demo.js', THEME_SCRIPT_PLUGIN);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.plugin.manifest.id, 'demo.script-theme');
  assert.equal(parsed.plugin.manifest.name, '示例脚本主题');
  assert.equal(parsed.plugin.manifest.kind, 'theme');
  assert.equal(parsed.plugin.manifest.version, '1.2.3');
  assert.equal(parsed.plugin.manifest.author, 'tester');
  assert.equal('hosts' in parsed.plugin.manifest, false, '插件不能联网，清单里也就没有主机白名单这个字段');
  assert.ok(parsed.plugin.script.includes('mineradio.on("theme"'));
});
test('插件只有主题一种类型，音源与歌单包在解析阶段就被拒', () => {
  assert.deepEqual(Manifest.PLUGIN_KINDS, ['theme']);
  for (const kind of ['source', 'playlist', 'music', 'lyric']) {
    const js = THEME_SCRIPT_PLUGIN.replace('@kind theme', '@kind ' + kind);
    assert.equal(Manifest.parsePluginPackage('demo.js', js).error, 'PLUGIN_BAD_KIND', '@kind ' + kind + ' 必须被拒');
    const json = JSON.stringify({ id: 'demo.x', name: 'x', kind: kind, theme: { vars: { '--th-panel-bg': 'red' } } });
    assert.equal(Manifest.parsePluginPackage('demo.json', json).error, 'PLUGIN_BAD_KIND');
  }
  // 市场上那些 LX 音源插件连 @id 都不写，第一道门就过不去，更不会跑起来。
  const lx = [
    '/**', ' * @name 某某音源', ' * @description x', ' * @version 1.0.0', ' */',
    'lx.on("request", function(){});',
  ].join('\n');
  assert.equal(Manifest.parsePluginPackage('lx.js', lx).error, 'PLUGIN_BAD_ID');
});

test('清单缺 id / name / kind 时整包失败', () => {
  assert.equal(Manifest.parsePluginPackage('a.js', '/** @name x @kind theme */\nvar a=1;').error, 'PLUGIN_BAD_ID');
  assert.equal(Manifest.parsePluginPackage('a.json', '{"id":"a.b"}').error, 'PLUGIN_BAD_NAME');
  assert.equal(Manifest.parsePluginPackage('a.json', '{"id":"a.b","name":"n","kind":"virus"}').error, 'PLUGIN_BAD_KIND');
  assert.equal(Manifest.parsePluginPackage('a.js', '   ').error, 'PLUGIN_EMPTY');
  assert.equal(Manifest.parsePluginPackage('a.js', 'x'.repeat(600 * 1024)).error, 'PLUGIN_TOO_LARGE');
});

test('清单模块不再有任何联网相关能力', () => {
  assert.equal(typeof Manifest.isPluginRequestAllowed, 'undefined');
  assert.equal(typeof Manifest.normalizeHosts, 'undefined');
  assert.doesNotMatch(manifestSource, /host/i, '连 @host 的解析代码都不该留着');
  const parsed = Manifest.parsePluginPackage('t.json', JSON.stringify({
    id: 'demo.theme', name: '主题', kind: 'theme',
    hosts: 'api.example.com',
    theme: { vars: { '--th-panel-bg': '#000' } },
  }));
  assert.equal(parsed.ok, true);
  assert.equal('hosts' in parsed.plugin.manifest, false, '包里自带 hosts 字段也不会被带进清单');
});
test('声明式主题包只保留合法变量与安全 CSS', () => {
  const pkg = JSON.stringify({
    schema: 'mineradio-plugin-v1',
    id: 'demo.theme',
    name: '暗夜主题',
    kind: 'theme',
    theme: {
      vars: {
        'fc-accent': '#7f5af0',
        '--panel-bg': 'rgba(10,10,14,0.86)',
        '--evil': 'red;} body{display:none',
        '--remote': 'url(https://evil.example/x.png)',
        'BAD NAME': '#fff',
      },
      css: [
        '@import url("https://evil.example/x.css");',
        '.panel{background:url(https://evil.example/bg.png)}',
        '.ok{background:url("data:image/png;base64,AAA")}',
        '.x{width:expression(alert(1))}',
        '.y{background:javascript:alert(1)}',
        '</style><script>alert(1)</script>',
        '.parent > .child{color:#fff}',
      ].join('\n'),
    },
  });
  const parsed = Manifest.parsePluginPackage('theme.json', pkg);
  assert.equal(parsed.ok, true);
  const theme = parsed.plugin.theme;
  assert.equal(theme.vars['--fc-accent'], '#7f5af0');
  assert.equal(theme.vars['--panel-bg'], 'rgba(10,10,14,0.86)');
  assert.equal(theme.vars['--evil'], undefined, '带分号花括号的变量值会越出声明');
  assert.equal(theme.vars['--remote'], undefined, 'url() 会拉取远端资源');
  assert.equal(theme.vars['--bad name'], undefined);
  assert.doesNotMatch(theme.css, /@import/);
  assert.doesNotMatch(theme.css, /evil\.example/);
  assert.doesNotMatch(theme.css, /expression\s*\(/);
  assert.doesNotMatch(theme.css, /javascript\s*:/);
  assert.doesNotMatch(theme.css, /</, '残留的 < 会给标签注入留口子');
  assert.match(theme.css, /data:image\/png/, 'data: 内联图仍然放行');
  assert.match(theme.css, /\.parent > \.child/, '> 是子选择器，必须保留');
});

test('主题包没有任何可用负载时拒绝安装', () => {
  const pkg = JSON.stringify({ id: 'demo.empty', name: '空壳', kind: 'theme', theme: { vars: { '--x': 'url(a)' } } });
  assert.equal(Manifest.parsePluginPackage('t.json', pkg).error, 'PLUGIN_NO_PAYLOAD');
});
test('沙箱源码剥掉了插件不该拿到的宿主能力', () => {
  for (const name of ['fetch', 'XMLHttpRequest', 'WebSocket', 'importScripts', 'indexedDB', 'caches', 'Worker', 'postMessage']) {
    assert.match(sandboxSource, new RegExp(`'${name}'`), `STRIPPED 必须包含 ${name}`);
  }
  assert.match(sandboxSource, /self\[STRIPPED\[s\]\] = undefined/);
  assert.match(sandboxSource, /delete self\[STRIPPED\[s\]\]/);
  // 插件正文必须经 new Function 而不是 eval：eval 会让插件看到这里的闭包变量（handlers）。
  assert.match(sandboxSource, /new Function\('mineradio', 'lx', '"use strict";'/);
  assert.doesNotMatch(sandboxSource, /[^.\w]eval\(/);
  // 宿主代发请求的通道在 v1.7.4 整体拆掉了，沙箱侧不能再留残枝。
  assert.doesNotMatch(sandboxSource, /requestJson|plugin-request/);
  assert.match(sandboxSource, /var EVENTS = \['theme'\];/);
});

test('沙箱只暴露 on / log，插件拿不到 fetch、importScripts 与任何请求 API', () => {
  const messages = [];
  const sandbox = startSandbox((msg) => messages.push(msg));
  sandbox.send({
    type: 'plugin-boot',
    manifest: { id: 'probe', name: 'probe', kind: 'theme' },
    script: 'mineradio.on("theme", function(){ return { vars: {}, css: "", probe: {'
      + ' fetch: typeof fetch, imports: typeof importScripts, xhr: typeof XMLHttpRequest,'
      + ' post: typeof postMessage, request: typeof mineradio.request,'
      + ' requestJson: typeof mineradio.requestJson, keys: Object.keys(mineradio).join(",")'
      + ' } }; });',
  });
  assert.equal(messages[0].type, 'plugin-ready');
  assert.deepEqual(messages[0].hooks, ['theme']);
  sandbox.send({ type: 'plugin-invoke', callId: 'c1', event: 'theme', args: [] });
  return new Promise((resolve) => setTimeout(resolve, 20)).then(() => {
    const result = messages.find((m) => m.type === 'plugin-result');
    assert.equal(result.ok, true);
    assert.deepEqual(result.value.probe, {
      fetch: 'undefined',
      imports: 'undefined',
      xhr: 'undefined',
      post: 'undefined',
      request: 'undefined',
      requestJson: 'undefined',
      keys: 'version,manifest,on,log',
    });
  });
});

test('沙箱只认 theme 一个钩子，注册 search / url 之类直接启动失败', () => {
  const messages = [];
  const sandbox = startSandbox((msg) => messages.push(msg));
  sandbox.send({
    type: 'plugin-boot',
    manifest: { id: 'probe', name: 'probe', kind: 'theme' },
    script: 'mineradio.on("search", function(){ return []; });',
  });
  assert.equal(messages[0].type, 'plugin-boot-failed');
  assert.match(messages[0].error, /未知插件钩子: search/);
});
test('运行时的对外面只剩主题相关 API，网络与播放通道彻底没有了', () => {
  const host = startHost({});
  const api = host.plugins;
  assert.deepEqual(Object.keys(api).sort(), [
    'BUILTIN_STORE_KEY', 'STORE_KEY', 'applyThemes', 'destroyAllWorkers', 'hasEnabled',
    'importFromDialog', 'init', 'install', 'list', 'remove', 'setEnabled', 'themeVars', 'toast',
  ]);
  for (const gone of ['searchSongs', 'resolvePlayUrl', 'fetchLyric', 'fetchCover', 'fetchPlaylists', 'fetchPlaylistDetail']) {
    assert.equal(typeof api[gone], 'undefined', gone + ' 必须已经删掉');
  }
  assert.doesNotMatch(runtimeSource, /api\/plugin\/(fetch|stream)/);
  assert.doesNotMatch(runtimeSource, /fetch|XMLHttpRequest/i, '运行时不许再有任何网络调用');
  assert.doesNotMatch(runtimeSource, /plugin-request/);
});

test('脚本主题的 theme 钩子返回值经沙箱合并进注入的样式，并照样过清洗', async () => {
  const host = startHost({});
  const scripted = THEME_SCRIPT_PLUGIN.replace(
    '  return { vars: { "--th-panel-bg": "#101418" }, css: ".pl-card{border-radius:14px}" };',
    '  return { vars: { "--th-panel-bg": "#101418", "--th-evil": "red;}body{display:none" },'
      + ' css: ".pl-card{border-radius:14px}@import url(https://evil.example/x.css);" };',
  );
  assert.equal(host.plugins.install('theme.js', scripted).ok, true);
  await host.plugins.applyThemes();
  const css = host.styleNodes[0].textContent;
  assert.match(css, /:root\{[^}]*--th-panel-bg:#101418/);
  assert.doesNotMatch(css, /--th-evil/, '越出声明的变量值在宿主侧被丢掉');
  assert.match(css, /\.pl-card\{border-radius:14px\}/);
  assert.doesNotMatch(css, /@import/);
  assert.doesNotMatch(css, /evil\.example/);
  // 迷你播放器是独立窗口、不加载运行时，只能拿这份合并后的表。
  // 注意 Object.assign 抄一份：vm 里造出来的对象原型跟本 realm 的 Object 不同，直接 deepStrictEqual 会误报。
  assert.deepEqual(Object.assign({}, host.plugins.themeVars()), { '--th-panel-bg': '#101418' });
});

test('主题插件注入到独立 style 节点，用 textContent 且只有一个节点', () => {
  const host = startHost({});
  host.plugins.install('t.json', JSON.stringify({
    id: 'demo.theme', name: '主题', kind: 'theme',
    theme: { vars: { '--fc-accent': '#7f5af0', '--panel-bg': '#0b0b10' }, css: '.panel{border-radius:18px}' },
  }));
  assert.equal(host.styleNodes.length, 1, '反复应用只用同一个 style 节点，不能累积');
  const css = host.styleNodes[0].textContent;
  assert.equal(host.styleNodes[0].id, 'mineradio-plugin-theme-style');
  assert.match(css, /:root\{[^}]*--fc-accent:#7f5af0/);
  assert.match(css, /--panel-bg:#0b0b10/);
  assert.match(css, /\.panel\{border-radius:18px\}/);
  host.plugins.setEnabled('demo.theme', false);
  assert.doesNotMatch(host.styleNodes[0].textContent, /--fc-accent/, '禁用后变量立刻撤掉');
  host.plugins.remove('demo.theme');
  assert.equal(host.styleNodes[0].textContent, '', '全部卸载后注入内容清空');
});
test('装第二个主题时第一个被自动关掉，同一时刻只有一份主题生效', () => {
  const host = startHost({});
  host.plugins.install('t.json', JSON.stringify({
    id: 'demo.theme', name: '主题一', kind: 'theme',
    theme: { vars: { '--champagne': '#aaa000' }, css: '' },
  }));
  const second = host.plugins.install('t2.json', JSON.stringify({
    id: 'demo.theme2', name: '主题二', kind: 'theme',
    theme: { vars: { '--champagne': '#0000bb' }, css: '' },
  }));
  assert.deepEqual(Array.from(second.switchedOff), ['主题一'], '安装结果里点名被顶掉的主题，UI 才能提示用户');
  const list = host.plugins.list();
  const enabled = list.filter((p) => p.enabled).map((p) => p.id);
  assert.deepEqual(Array.from(enabled), ['demo.theme2'], '两个主题不能同时启用');
  const css = host.styleNodes[0].textContent;
  assert.match(css, /--champagne:#0000bb/);
  assert.doesNotMatch(css, /--champagne:#aaa000/, '被关掉的主题不能还留在注入的样式里');
});

test('手动启用另一个主题会自动关掉当前那个，切主题是换不是叠加', () => {
  const host = startHost({});
  host.plugins.install('t.json', JSON.stringify({
    id: 'demo.theme', name: '主题一', kind: 'theme', theme: { vars: { '--champagne': '#111111' }, css: '' },
  }));
  host.plugins.install('t2.json', JSON.stringify({
    id: 'demo.theme2', name: '主题二', kind: 'theme', theme: { vars: { '--champagne': '#222222' }, css: '' },
  }));
  // 此刻只有主题二开着；手动把主题一切回来，主题二必须自动关掉。
  host.plugins.setEnabled('demo.theme', true);
  const byId = {};
  host.plugins.list().forEach((p) => { byId[p.id] = p; });
  assert.equal(byId['demo.theme'].enabled, true);
  assert.equal(byId['demo.theme2'].enabled, false, '切主题就是换，不是叠加');
  assert.equal(host.plugins.hasEnabled('theme'), true);
  assert.match(host.styleNodes[0].textContent, /--champagne:#111111/);
  assert.doesNotMatch(host.styleNodes[0].textContent, /#222222/);
});

test('历史数据里同时启用的多个主题在 init 时收敛成最近启用的那一个', () => {
  const host = startHost({});
  // 直接伪造 1.7.2 之前的存档：两个主题都是 enabled，updatedAt 分出先后。
  host.storage.set('mineradio-plugins-v1', JSON.stringify([
    {
      manifest: { id: 'demo.theme', name: '主题一', kind: 'theme', version: '1.0.0', author: '', description: '', homepage: '' },
      script: '', theme: { vars: { '--champagne': '#111111' }, css: '' }, enabled: true, installedAt: 1000, updatedAt: 1000,
    },
    {
      manifest: { id: 'demo.theme2', name: '主题二', kind: 'theme', version: '1.0.0', author: '', description: '', homepage: '' },
      script: '', theme: { vars: { '--champagne': '#222222' }, css: '' }, enabled: true, installedAt: 1000, updatedAt: 2000,
    },
  ]));
  const list = host.plugins.init({});
  const enabled = list.filter((p) => p.enabled).map((p) => p.id);
  assert.deepEqual(Array.from(enabled), ['demo.theme2'], '保留 updatedAt 最新的那个主题');
  assert.match(host.styleNodes[0].textContent, /--champagne:#222222/);
  // 归一化结果必须落盘，否则下次启动又要重算一遍。
  const stored = Manifest.normalizePluginRecords(host.storage.get('mineradio-plugins-v1'));
  assert.deepEqual(stored.filter((r) => r.enabled).map((r) => r.manifest.id), ['demo.theme2']);
});
test('存档里残留的旧类型记录会被整条丢掉，不会参与任何调用', () => {
  const host = startHost({});
  host.storage.set('mineradio-plugins-v1', JSON.stringify([
    {
      manifest: { id: 'legacy.source', name: '旧音源', kind: 'source', version: '1.0.0' },
      script: 'mineradio.on("search", function(){ return []; });', theme: null,
      enabled: true, installedAt: 1000, updatedAt: 1000,
    },
    {
      manifest: { id: 'demo.theme', name: '主题', kind: 'theme', version: '1.0.0' },
      script: '', theme: { vars: { '--champagne': '#333333' }, css: '' }, enabled: true, installedAt: 1000, updatedAt: 1000,
    },
  ]));
  const list = host.plugins.init({});
  assert.deepEqual(Array.from(list.map((p) => p.id)), ['demo.theme'], '旧音源记录在归一化时就被淘汰');
  assert.match(host.styleNodes[0].textContent, /--champagne:#333333/);
});

test('启用状态与安装记录落到 localStorage 并能重新水合', () => {
  const host = startHost({});
  host.plugins.install('demo.js', THEME_SCRIPT_PLUGIN);
  host.plugins.setEnabled('demo.script-theme', false);
  const raw = host.storage.get('mineradio-plugins-v1');
  assert.ok(raw, '插件列表写进 localStorage');
  const rehydrated = Manifest.normalizePluginRecords(raw);
  assert.equal(rehydrated.length, 1);
  assert.equal(rehydrated[0].manifest.id, 'demo.script-theme');
  assert.equal(rehydrated[0].enabled, false);
  const restored = host.plugins.init({});
  assert.equal(restored.length, 1);
  assert.equal(restored[0].enabled, false);
  assert.equal(host.plugins.hasEnabled('theme'), false, '禁用的主题不参与换肤');
});

test('覆盖安装同 id 插件时保留启用状态并换掉脚本', () => {
  const host = startHost({});
  host.plugins.install('demo.js', THEME_SCRIPT_PLUGIN);
  host.plugins.setEnabled('demo.script-theme', false);
  const again = host.plugins.install('demo.js', THEME_SCRIPT_PLUGIN.replace('@version 1.2.3', '@version 2.0.0'));
  assert.equal(again.ok, true);
  assert.equal(again.replaced, true);
  const list = host.plugins.list();
  assert.equal(list.length, 1, '同 id 视为升级而不是新增');
  assert.equal(list[0].version, '2.0.0');
  assert.equal(list[0].enabled, false, '升级不擅自打开用户关掉的插件');
});
test('安装包自带的六份主题就是 examples/plugins 下的同名文件，逐字段一致', () => {
  const packs = BuiltinThemes.list();
  assert.equal(packs.length, 6, '自带五份暗色完整主题与一份浅色完整主题');
  assert.deepEqual(packs.map((p) => p.fileName), [
    'theme-midnight-indigo.json',
    'theme-warm-amber.json',
    'theme-white.json',
    'theme-background-deep-sea.json',
    'theme-background-ember.json',
    'theme-background-forest.json',
  ]);
  for (const pack of packs) {
    const onDisk = JSON.parse(fs.readFileSync(path.join(repoRoot, 'examples', 'plugins', pack.fileName), 'utf8'));
    assert.deepEqual(JSON.parse(pack.content), onDisk, `${pack.fileName} 与示例目录里的内容必须一致，改了一边就要改另一边`);
    // 走真解析通道：自带主题不享受清洗豁免，装不进去就等于没自带。
    const parsed = Manifest.parsePluginPackage(pack.fileName, pack.content);
    assert.equal(parsed.ok, true, `${pack.fileName} 必须能被 parsePluginPackage 接受`);
    assert.equal(parsed.plugin.manifest.kind, 'theme');
    assert.ok(Object.keys(parsed.plugin.theme.vars).length > 0, '清洗后不能一个变量都不剩');
    assert.ok(parsed.plugin.theme.css.length > 0, '完整主题的 css 不能被清空');
  }
  assert.deepEqual(BuiltinThemes.ids(), packs.map((p) => JSON.parse(p.content).id));
});

test('首次启动把自带主题装进列表，但默认不启用', () => {
  const host = startHost({ builtin: true });
  const list = host.plugins.init({});
  const ids = list.map((p) => p.id);
  for (const id of BuiltinThemes.ids()) assert.ok(ids.includes(id), `${id} 应该被自动装进列表`);
  assert.equal(list.filter((p) => p.enabled).length, 0, '自带主题默认不启用，升级不擅自换掉用户看到的界面');
  assert.equal(host.styleNodes.length === 0 || host.styleNodes[0].textContent === '', true, '没启用就不该注入任何主题样式');
  // 再 init 一次不能重复塞。
  const again = host.plugins.init({});
  assert.equal(again.length, list.length, '反复 init 不重复补装');
});

test('自带主题被卸载后不会在下次启动时又冒出来，手动装回则恢复', () => {
  const storage = new Map();
  const first = startHost({ builtin: true, storage });
  first.plugins.init({});
  const victim = BuiltinThemes.ids()[0];
  assert.equal(first.plugins.remove(victim), true);
  assert.ok(storage.get('mineradio-plugins-builtin-v1').includes(victim), '卸载记忆落盘，换进程也记得');

  const second = startHost({ builtin: true, storage });
  const list = second.plugins.init({});
  assert.equal(list.some((p) => p.id === victim), false, '用户卸载过的自带主题不再自动补回');
  assert.equal(list.some((p) => p.id === BuiltinThemes.ids()[1]), true, '另一份不受影响');

  // 用户改主意，手动装回示例目录里的同名文件：卸载记忆要跟着清掉。
  const pack = BuiltinThemes.list()[0];
  assert.equal(second.plugins.install(pack.fileName, pack.content).ok, true);
  assert.equal(JSON.parse(storage.get('mineradio-plugins-builtin-v1')).removed.includes(victim), false);
  const third = startHost({ builtin: true, storage });
  assert.equal(third.plugins.init({}).some((p) => p.id === victim), true, '装回来之后就该一直在了');
});
test('自带主题只在版本更高时覆盖本地记录，且保留用户的启用状态', () => {
  const pack = BuiltinThemes.list()[0];
  const json = JSON.parse(pack.content);
  const storage = new Map();
  // 伪造一份「装了旧版且已启用」的存档。
  storage.set('mineradio-plugins-v1', JSON.stringify([{
    manifest: { id: json.id, name: '旧版午夜靛蓝', kind: 'theme', version: '0.0.1', author: '', description: '', homepage: '' },
    script: '', theme: { vars: { '--champagne': '#123456' }, css: '' }, enabled: true, installedAt: 500, updatedAt: 500,
  }]));
  const host = startHost({ builtin: true, storage });
  const list = host.plugins.init({});
  const hit = list.find((p) => p.id === json.id);
  assert.equal(hit.version, json.version, '旧版被自带的新版顶掉');
  assert.equal(hit.enabled, true, '覆盖升级不动用户的启用状态');
  assert.equal(hit.installedAt, 500, '安装时间沿用原记录');
  assert.match(host.styleNodes[0].textContent, /--champagne:/);
  assert.doesNotMatch(host.styleNodes[0].textContent, /#123456/, '生效的是新版负载');

  // 反向：本地版本更高（用户自己改的同 id 版本）时不许被自带版本按回去。
  const newer = new Map();
  newer.set('mineradio-plugins-v1', JSON.stringify([{
    manifest: { id: json.id, name: '我自己改的', kind: 'theme', version: '99.0.0', author: '', description: '', homepage: '' },
    script: '', theme: { vars: { '--champagne': '#123456' }, css: '' }, enabled: true, installedAt: 500, updatedAt: 500,
  }]));
  const host2 = startHost({ builtin: true, storage: newer });
  const kept = host2.plugins.init({}).find((p) => p.id === json.id);
  assert.equal(kept.version, '99.0.0', '本地版本更高就不动它');
  assert.equal(kept.name, '我自己改的');
});

test('启用一份自带主题时另一份自带主题被自动关掉', () => {
  const host = startHost({ builtin: true });
  host.plugins.init({});
  const ids = BuiltinThemes.ids();
  host.plugins.setEnabled(ids[0], true);
  host.plugins.setEnabled(ids[1], true);
  const byId = {};
  host.plugins.list().forEach((p) => { byId[p.id] = p; });
  assert.equal(byId[ids[0]].enabled, false);
  assert.equal(byId[ids[1]].enabled, true);
});

test('主题脚本崩掉或返回不可序列化值时只是这份主题不生效，不拖垮换肤', async () => {
  const host = startHost({});
  const broken = [
    '/**', ' * @id demo.broken', ' * @name 坏主题', ' * @kind theme', ' */',
    'mineradio.on("theme", function(){ var o = {}; o.self = o; return o; });',
  ].join('\n');
  assert.equal(host.plugins.install('broken.js', broken).ok, true);
  await host.plugins.applyThemes();
  // 循环引用返回值在沙箱侧就被拦住，宿主拿不到这份主题，注入内容保持空。
  assert.equal(host.styleNodes[0].textContent, '');
  assert.deepEqual(Object.assign({}, host.plugins.themeVars()), {});

  const crash = [
    '/**', ' * @id demo.crash', ' * @name 崩溃主题', ' * @kind theme', ' */',
    'throw new Error("boom");',
  ].join('\n');
  assert.equal(host.plugins.install('crash.js', crash).ok, true);
  await host.plugins.applyThemes();
  assert.equal(host.styleNodes[0].textContent, '', '启动就抛错的主题也只是不生效');
});
