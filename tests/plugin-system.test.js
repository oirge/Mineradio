'use strict';
// 插件系统白盒测试。三层各测一件事：
// - plugin-manifest.js：包解析、清洗、白名单判定（纯函数，直接 require）；
// - plugin-sandbox.js：能力剥离与消息协议（在 vm 里跑真源码，配一个假 self）；
// - plugin-runtime.js：宿主侧 RPC、白名单执行、主题注入（在 vm 里跑真源码，配假 Worker/document/fetch）。
// 关键点是 runtime 与 sandbox 用真源码对接，中间的消息过一遍 JSON 往返模拟结构化克隆，
// 这样「插件返回不可克隆值」「宿主放行了不该放行的主机」这类问题能在测试里就暴露。

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
 * Worker 用 startSandbox 接真沙箱源码，fetch 用可编程桩，
 * 于是「插件 → 沙箱 → 宿主白名单 → 本地代理」整条链路都是真代码在跑。
 * @param {object} [options] 选项：fetchImpl 自定义代理响应、proxyInfo 覆盖代理入口、
 *   builtin 是否一起加载安装包自带主题模块、storage 复用一份已有的 localStorage 内容。
 * @returns {object} 宿主句柄：plugins（运行时 API）、styleNodes、requests、storage。
 */
function startHost(options) {
  const opts = options || {};
  const requests = [];
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
    URL,
    document: documentStub,
    localStorage: {
      getItem(key) { return storage.has(key) ? storage.get(key) : null; },
      setItem(key, value) { storage.set(key, String(value)); },
      removeItem(key) { storage.delete(key); },
    },
    desktopWindow: {
      getPluginProxyInfo() {
        return Promise.resolve(opts.proxyInfo || { ok: true, token: 'tok', port: 3000 });
      },
      importPluginFile: opts.importPluginFile || (() => Promise.resolve({ ok: false, canceled: true })),
    },
    fetch(url, init) {
      const payload = JSON.parse(init.body);
      requests.push({ url, payload });
      const impl = opts.fetchImpl || (() => ({ ok: true, status: 200, headers: {}, body: '{"ok":1}' }));
      return Promise.resolve({ json: () => Promise.resolve(impl(payload)) });
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
  return { context, plugins: base.MineradioPlugins, requests, styleNodes, storage };
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

const SOURCE_PLUGIN = [
  '/**',
  ' * @id demo.source',
  ' * @name 示例音源',
  ' * @kind source',
  ' * @version 1.2.3',
  ' * @author tester',
  ' * @host api.example.com, cdn.example.com',
  ' */',
  'mineradio.on("search", async function(q){',
  '  var res = await mineradio.requestJson("https://api.example.com/s?q=" + q);',
  '  return res.list;',
  '});',
  'mineradio.on("url", async function(song){ return "https://cdn.example.com/" + song.id + ".mp3"; });',
].join('\n');

test('JS 插件头注释清单被正确解析', () => {
  const parsed = Manifest.parsePluginPackage('demo.js', SOURCE_PLUGIN);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.plugin.manifest.id, 'demo.source');
  assert.equal(parsed.plugin.manifest.name, '示例音源');
  assert.equal(parsed.plugin.manifest.kind, 'source');
  assert.equal(parsed.plugin.manifest.version, '1.2.3');
  assert.deepEqual(parsed.plugin.manifest.hosts, ['api.example.com', 'cdn.example.com']);
  assert.ok(parsed.plugin.script.includes('mineradio.on("search"'));
});

test('非主题插件必须声明 @host，否则拒绝安装', () => {
  const noHost = SOURCE_PLUGIN.replace(' * @host api.example.com, cdn.example.com\n', '');
  assert.equal(Manifest.parsePluginPackage('demo.js', noHost).error, 'PLUGIN_NO_HOST');
});

test('清单缺 id / name / kind 时整包失败', () => {
  assert.equal(Manifest.parsePluginPackage('a.js', '/** @name x @kind theme */\nvar a=1;').error, 'PLUGIN_BAD_ID');
  assert.equal(Manifest.parsePluginPackage('a.json', '{"id":"a.b"}').error, 'PLUGIN_BAD_NAME');
  assert.equal(Manifest.parsePluginPackage('a.json', '{"id":"a.b","name":"n","kind":"virus"}').error, 'PLUGIN_BAD_KIND');
  assert.equal(Manifest.parsePluginPackage('a.js', '   ').error, 'PLUGIN_EMPTY');
  assert.equal(Manifest.parsePluginPackage('a.js', 'x'.repeat(600 * 1024)).error, 'PLUGIN_TOO_LARGE');
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

test('请求白名单只放行 https 与声明主机及其子域', () => {
  const manifest = { hosts: ['api.example.com'] };
  assert.equal(Manifest.isPluginRequestAllowed(manifest, 'https://api.example.com/x'), true);
  assert.equal(Manifest.isPluginRequestAllowed(manifest, 'https://cdn.api.example.com/x'), true);
  assert.equal(Manifest.isPluginRequestAllowed(manifest, 'http://api.example.com/x'), false);
  assert.equal(Manifest.isPluginRequestAllowed(manifest, 'https://api.example.com.attacker.net/x'), false);
  assert.equal(Manifest.isPluginRequestAllowed(manifest, 'https://xapi.example.com/x'), false);
  assert.equal(Manifest.isPluginRequestAllowed(manifest, 'https://other.com/x'), false);
  assert.equal(Manifest.isPluginRequestAllowed({ hosts: [] }, 'https://api.example.com/x'), false);
  assert.equal(Manifest.isPluginRequestAllowed(manifest, 'not a url'), false);
});

test('主机白名单归一化会剥协议端口路径并限量去重', () => {
  const hosts = Manifest.normalizeHosts('https://API.Example.com:443/path, api.example.com, bad_host, ok.example.org');
  assert.deepEqual(hosts, ['api.example.com', 'ok.example.org']);
  assert.equal(Manifest.normalizeHosts(new Array(40).fill('a.example.com').map((h, i) => `h${i}.${h}`)).length, 16);
});

test('沙箱源码剥掉了插件不该拿到的宿主能力', () => {
  for (const name of ['fetch', 'XMLHttpRequest', 'WebSocket', 'importScripts', 'indexedDB', 'caches', 'Worker', 'postMessage']) {
    assert.match(sandboxSource, new RegExp(`'${name}'`), `STRIPPED 必须包含 ${name}`);
  }
  assert.match(sandboxSource, /self\[STRIPPED\[s\]\] = undefined/);
  assert.match(sandboxSource, /delete self\[STRIPPED\[s\]\]/);
  // 插件正文必须经 new Function 而不是 eval：eval 会让插件看到这里的闭包变量（pending / handlers）。
  assert.match(sandboxSource, /new Function\('mineradio', 'lx', '"use strict";'/);
  assert.doesNotMatch(sandboxSource, /[^.\w]eval\(/);
});

test('沙箱里插件确实拿不到 fetch 与 importScripts', () => {
  const messages = [];
  const sandbox = startSandbox((msg) => messages.push(msg));
  sandbox.send({
    type: 'plugin-boot',
    manifest: { id: 'probe', name: 'probe', kind: 'source', hosts: ['a.example.com'] },
    script: 'mineradio.on("search", function(){ return { fetch: typeof fetch, imports: typeof importScripts, xhr: typeof XMLHttpRequest, post: typeof postMessage }; });',
  });
  assert.equal(messages[0].type, 'plugin-ready');
  assert.deepEqual(messages[0].hooks, ['search']);
  sandbox.send({ type: 'plugin-invoke', callId: 'c1', event: 'search', args: ['x'] });
  return new Promise((resolve) => setTimeout(resolve, 20)).then(() => {
    const result = messages.find((m) => m.type === 'plugin-result');
    assert.equal(result.ok, true);
    assert.deepEqual(result.value, { fetch: 'undefined', imports: 'undefined', xhr: 'undefined', post: 'undefined' });
  });
});

test('宿主装上音源插件后，搜索经沙箱与本地代理拿到归一化结果', async () => {
  const host = startHost({
    fetchImpl: (payload) => ({
      ok: true,
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ list: [
        { id: '1001', name: '夜航', singer: ['歌手甲', '歌手乙'], albumName: '专辑A', interval: '03:45', img: 'https://cdn.example.com/a.jpg' },
        { id: '1002', title: '晨雾', artist: '歌手丙', duration: 214000 },
        { id: '1003' },
      ], q: payload.url }),
    }),
  });
  const installed = host.plugins.install('demo.js', SOURCE_PLUGIN);
  assert.equal(installed.ok, true);
  assert.equal(host.plugins.hasEnabled('source'), true);

  const songs = await host.plugins.searchSongs('夜');
  assert.equal(songs.length, 2, '缺 name 的条目被丢掉');
  assert.equal(songs[0].type, 'plugin');
  assert.equal(songs[0].pluginId, 'demo.source');
  assert.equal(songs[0].name, '夜航');
  assert.equal(songs[0].artist, '歌手甲 / 歌手乙');
  assert.equal(songs[0].album, '专辑A');
  assert.equal(songs[0].duration, 225, 'mm:ss 时长换算成秒');
  assert.equal(songs[0].key, 'plugin:demo.source:1001');
  assert.equal(songs[1].duration, 214, '毫秒时长换算成秒');

  assert.equal(host.requests.length, 1, '插件请求只经本地代理发出');
  assert.match(host.requests[0].url, /^http:\/\/127\.0\.0\.1:3000\/api\/plugin\/fetch\?token=tok$/);
  assert.equal(host.requests[0].payload.url, 'https://api.example.com/s?q=夜');
});

test('插件请求越出 @host 白名单时被宿主拒绝，且不会发出任何代理请求', async () => {
  const host = startHost({});
  const evil = SOURCE_PLUGIN.replace(
    'https://api.example.com/s?q=',
    'https://api.example.com.attacker.net/s?q=',
  );
  assert.equal(host.plugins.install('evil.js', evil).ok, true);
  const songs = await host.plugins.searchSongs('x');
  // 注意用长度断言：vm 里造出来的数组与本 realm 的 Array 原型不同，deepStrictEqual 会因原型不匹配误报。
  assert.equal(songs.length, 0, '被拒的插件不产出结果，但不拖垮整次搜索');
  assert.equal(host.requests.length, 0, '白名单在宿主侧拦住，请求根本没到本地代理');
});

test('播放地址走本地流代理，并带上插件要求的 Referer / UA', async () => {
  const host = startHost({
    fetchImpl: () => ({ ok: true, status: 200, headers: {}, body: JSON.stringify({ list: [{ id: '7', name: '曲' }] }) }),
  });
  const plugin = SOURCE_PLUGIN.replace(
    'mineradio.on("url", async function(song){ return "https://cdn.example.com/" + song.id + ".mp3"; });',
    'mineradio.on("url", async function(song){ return { url: "http://cdn.example.com/" + song.id + ".mp3", referer: "https://api.example.com/", userAgent: "DemoUA" }; });',
  );
  host.plugins.install('demo.js', plugin);
  const songs = await host.plugins.searchSongs('曲');
  const resolved = await host.plugins.resolvePlayUrl(songs[0], 'high');
  assert.equal(resolved.directUrl, 'http://cdn.example.com/7.mp3');
  assert.match(resolved.url, /^http:\/\/127\.0\.0\.1:3000\/api\/plugin\/stream\?token=tok&url=/);
  const parsed = new URL(resolved.url);
  assert.equal(parsed.searchParams.get('url'), 'http://cdn.example.com/7.mp3', 'http CDN 直链交给流代理，而不是在这里拒掉');
  assert.equal(parsed.searchParams.get('referer'), 'https://api.example.com/');
  assert.equal(parsed.searchParams.get('ua'), 'DemoUA');
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
  const enabled = list.filter((p) => p.kind === 'theme' && p.enabled).map((p) => p.id);
  assert.deepEqual(Array.from(enabled), ['demo.theme2'], '两个主题不能同时启用');
  const css = host.styleNodes[0].textContent;
  assert.match(css, /--champagne:#0000bb/);
  assert.doesNotMatch(css, /--champagne:#aaa000/, '被关掉的主题不能还留在注入的样式里');
});

test('启用一个主题会自动禁用其它主题，非主题插件不受影响', () => {
  const host = startHost({});
  host.plugins.install('demo.js', SOURCE_PLUGIN);
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
  assert.equal(byId['demo.source'].enabled, true, '音源插件不参与主题互斥');
  assert.match(host.styleNodes[0].textContent, /--champagne:#111111/);
});

test('历史数据里同时启用的多个主题在 init 时收敛成最近启用的那一个', () => {
  const host = startHost({});
  // 直接伪造 1.7.2 之前的存档：两个主题都是 enabled，updatedAt 分出先后。
  host.storage.set('mineradio-plugins-v1', JSON.stringify([
    {
      manifest: { id: 'demo.theme', name: '主题一', kind: 'theme', version: '1.0.0', author: '', description: '', homepage: '', hosts: [] },
      script: '', theme: { vars: { '--champagne': '#111111' }, css: '' }, enabled: true, installedAt: 1000, updatedAt: 1000,
    },
    {
      manifest: { id: 'demo.theme2', name: '主题二', kind: 'theme', version: '1.0.0', author: '', description: '', homepage: '', hosts: [] },
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

test('启用状态与安装记录落到 localStorage 并能重新水合', () => {
  const host = startHost({});
  host.plugins.install('demo.js', SOURCE_PLUGIN);
  host.plugins.setEnabled('demo.source', false);
  const raw = host.storage.get('mineradio-plugins-v1');
  assert.ok(raw, '插件列表写进 localStorage');
  const rehydrated = Manifest.normalizePluginRecords(raw);
  assert.equal(rehydrated.length, 1);
  assert.equal(rehydrated[0].manifest.id, 'demo.source');
  assert.equal(rehydrated[0].enabled, false);
  const restored = host.plugins.init({});
  assert.equal(restored.length, 1);
  assert.equal(restored[0].enabled, false);
  assert.equal(host.plugins.hasEnabled('source'), false, '禁用的音源插件不参与搜索');
});

test('覆盖安装同 id 插件时保留启用状态并换掉脚本', () => {
  const host = startHost({});
  host.plugins.install('demo.js', SOURCE_PLUGIN);
  host.plugins.setEnabled('demo.source', false);
  const again = host.plugins.install('demo.js', SOURCE_PLUGIN.replace('@version 1.2.3', '@version 2.0.0'));
  assert.equal(again.ok, true);
  assert.equal(again.replaced, true);
  const list = host.plugins.list();
  assert.equal(list.length, 1, '同 id 视为升级而不是新增');
  assert.equal(list[0].version, '2.0.0');
  assert.equal(list[0].enabled, false, '升级不擅自打开用户关掉的插件');
});

test('安装包自带的两份主题就是 examples/plugins 下的同名文件，逐字段一致', () => {
  const packs = BuiltinThemes.list();
  assert.equal(packs.length, 2, '自带午夜靛蓝与暖琥珀两份');
  assert.deepEqual(packs.map((p) => p.fileName), ['theme-midnight-indigo.json', 'theme-warm-amber.json']);
  for (const pack of packs) {
    const onDisk = JSON.parse(fs.readFileSync(path.join(repoRoot, 'examples', 'plugins', pack.fileName), 'utf8'));
    assert.deepEqual(JSON.parse(pack.content), onDisk, `${pack.fileName} 与示例目录里的内容必须一致，改了一边就要改另一边`);
    // 走真解析通道：自带主题不享受清洗豁免，装不进去就等于没自带。
    const parsed = Manifest.parsePluginPackage(pack.fileName, pack.content);
    assert.equal(parsed.ok, true, `${pack.fileName} 必须能被 parsePluginPackage 接受`);
    assert.equal(parsed.plugin.manifest.kind, 'theme');
    assert.ok(Object.keys(parsed.plugin.theme.vars).length > 0, '清洗后不能一个变量都不剩');
    assert.ok(parsed.plugin.theme.css.length > 0, '清洗后 css 不能被清空');
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
    manifest: { id: json.id, name: '旧版午夜靛蓝', kind: 'theme', version: '0.0.1', author: '', description: '', homepage: '', hosts: [] },
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
    manifest: { id: json.id, name: '我自己改的', kind: 'theme', version: '99.0.0', author: '', description: '', homepage: '', hosts: [] },
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

test('插件返回空地址或不可序列化值时报明确错误', async () => {
  const host = startHost({});
  const broken = [
    '/**',
    ' * @id demo.broken',
    ' * @name 坏插件',
    ' * @kind source',
    ' * @host api.example.com',
    ' */',
    'mineradio.on("url", function(){ return ""; });',
    'mineradio.on("search", function(){ var o = {}; o.self = o; return o; });',
  ].join('\n');
  host.plugins.install('broken.js', broken);
  const songs = await host.plugins.searchSongs('x');
  assert.equal(songs.length, 0, '循环引用返回值在沙箱侧就被拦住，不会让 postMessage 整体失败');
  await assert.rejects(
    () => host.plugins.resolvePlayUrl({ type: 'plugin', pluginId: 'demo.broken', pluginRaw: {} }),
    /PLUGIN_URL_EMPTY/,
  );
});



