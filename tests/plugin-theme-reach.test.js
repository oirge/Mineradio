'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { normalizeThemeVars } = require('../public/plugin-manifest.js');
const {
  MiniPlayerStateCache,
  normalizeMiniPlayerThemeVars,
  miniPlayerThemeSignature,
} = require('../desktop/mini-player-state-cache');

const root = path.join(__dirname, '..');

/**
 * 读取仓库内文件。
 * @param {string} relativePath 相对仓库根目录的路径。
 * @returns {string} 文件文本。
 */
function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

/**
 * 读取一份声明式主题插件。
 * @param {string} fileName examples/plugins 下的文件名。
 * @returns {object} 解析后的清单对象。
 */
function theme(fileName) {
  return JSON.parse(read('examples/plugins/' + fileName));
}

const THEME_FILES = ['theme-midnight-indigo.json', 'theme-warm-amber.json', 'theme-graphite.json'];

// 主窗口这一族必须由三份示例主题全部覆盖，少一个就会出现「这块没跟着换色」。
const MAIN_THEME_VARS = [
  '--th-panel-bg', '--th-panel-border', '--th-panel-shadow',
  '--th-side-panel-bg', '--th-side-panel-border', '--th-side-panel-shadow',
  '--th-popover-bg', '--th-popover-border', '--th-popover-shadow',
  '--th-subpanel-bg', '--th-subpanel-border',
  '--th-row-bg', '--th-row-border', '--th-row-shadow',
  '--th-row-hover-bg', '--th-row-hover-border', '--th-row-active-bg',
  '--th-chip-bg', '--th-chip-border', '--th-chip-hover-bg', '--th-chip-hover-border',
  '--th-bar-bg', '--th-bar-shadow', '--th-search-bg',
  '--th-hairline', '--th-hairline-soft', '--th-text-strong', '--th-text-dim',
];

const MINI_THEME_VARS = [
  '--th-mini-bg', '--th-mini-border', '--th-mini-shadow',
  '--th-mini-cover-bg', '--th-mini-cover-border', '--th-mini-cover-text',
  '--th-mini-title', '--th-mini-artist', '--th-mini-ghost-text',
  '--th-mini-btn-bg', '--th-mini-btn-border', '--th-mini-btn-text',
  '--th-mini-btn-hover-bg', '--th-mini-btn-hover-border', '--th-mini-btn-hover-text',
  '--th-mini-play-bg', '--th-mini-play-border', '--th-mini-play-text',
];

test('三份示例主题都声明完整的 --th-* 变量并能通过清洗', () => {
  for (const fileName of THEME_FILES) {
    const doc = theme(fileName);
    const vars = doc.theme && doc.theme.vars;
    assert.ok(vars, fileName + ' 缺少 theme.vars');
    for (const name of MAIN_THEME_VARS.concat(MINI_THEME_VARS)) {
      assert.ok(Object.prototype.hasOwnProperty.call(vars, name), fileName + ' 缺少 ' + name);
    }
    // normalizeThemeVars 会静默丢掉超长或含 ; { } < > 和 url() 的值，被丢掉就等于这块没上色。
    const kept = normalizeThemeVars(vars);
    for (const name of Object.keys(vars)) {
      assert.equal(kept[name], vars[name], fileName + ' 的 ' + name + ' 过不了清洗');
    }
  }
});

test('改了主题载荷必须抬版本号，否则 profile 里的旧载荷不会被替换', () => {
  for (const fileName of THEME_FILES) {
    const doc = theme(fileName);
    const parts = String(doc.version || '').split('.').map(Number);
    assert.ok(parts.length === 3 && parts.every(Number.isFinite), fileName + ' 版本号格式不对');
    // 1.4.0 是补齐 --th-mini-* 的那一版；再改载荷就得继续往上走。
    assert.ok(parts[0] > 1 || (parts[0] === 1 && parts[1] >= 4), fileName + ' 版本号没跟着载荷抬');
  }
});

test('app.css 的关键面板都改成 var(--th-*, 原字面值) 而不是写死的字面值', () => {
  const css = read('public/app.css');

  // 左侧歌单最终由 (1,1,1) 那条规则决定，主题只能靠变量拿下它。
  assert.match(css, /html\.control-glass-svg-ok #playlist-panel\{[\s\S]{0,600}var\(--th-side-panel-bg/);
  assert.match(css, /#playlist-panel\{[\s\S]{0,400}var\(--th-side-panel-bg,\s*var\(--th-panel-bg/);
  assert.match(css, /#search-results,\.search-mode-tabs,#fx-panel\{[\s\S]{0,400}var\(--th-panel-bg/);
  assert.match(css, /\.playlist-source-popover\{[\s\S]{0,600}var\(--th-popover-bg,\s*var\(--th-panel-bg/);
  assert.match(css, /\.playlist-source-option\{[\s\S]{0,200}var\(--th-row-bg/);
  assert.match(css, /\.pl-card,\.queue-item,\.mini-queue-item,\.pl-detail-row\{[\s\S]{0,200}var\(--th-row-bg/);
  assert.match(css, /var\(--th-chip-bg,\s*var\(--th-row-bg/);
  assert.match(css, /#bottom-bar\.visible\{[\s\S]{0,400}var\(--th-bar-bg/);
  assert.match(css, /#search-box\{[\s\S]{0,200}var\(--th-search-bg/);

  // 取色器的地盘不许变量化：选中态描边必须继续读用户自己挑的强调色。
  assert.match(css, /#playlist-panel \.pl-card\.expanded[\s\S]{0,300}rgba\(var\(--fc-accent-rgb\),\.28\)!important/);
  // 玻璃的模糊/饱和度是调好的黄金参数，一个 filter 变量都不能被主题接管。
  assert.doesNotMatch(css, /--th-[a-z-]*filter/);
});

test('迷你播放器两套外壳都把底色描边文字接到 --th-mini-* 并保留原字面值兜底', () => {
  for (const file of ['public/mini-player.html', 'public/mini-player-compact.html']) {
    const html = read(file);
    assert.match(html, /background: var\(--th-mini-bg, var\(--th-popover-bg, rgba\(9, 12, 15, 0\.9\d\)\)\)/, file);
    assert.match(html, /border: 1px solid var\(--th-mini-border, var\(--th-popover-border, rgba\(255, 255, 255, 0\.13\)\)\)/, file);
    assert.match(html, /box-shadow: var\(--th-mini-shadow, 0 1\d+px \d+px rgba\(0, 0, 0, 0\.4\d?\), inset 0 1px 0 rgba\(255, 255, 255, 0\.08\)\)/, file);
    assert.match(html, /color: var\(--th-mini-title, var\(--th-text-strong, #f7fafb\)\)/, file);
    assert.match(html, /color: var\(--th-mini-artist, var\(--th-text-dim, rgba\(226, 234, 237, 0\.5\d\)\)\)/, file);
    assert.match(html, /background: var\(--th-mini-btn-bg, var\(--th-chip-bg, #151a1f\)\)/, file);
    assert.match(html, /background: var\(--th-mini-btn-hover-bg, var\(--th-chip-hover-bg, #1b2428\)\)/, file);
    assert.match(html, /background: var\(--th-mini-play-bg, #172326\)/, file);
    assert.match(html, /var\(--th-mini-ghost-text, var\(--th-text-dim/, file);
    // 收到整表就重写根元素，并擦掉这一版不再出现的变量名，否则旧主题的颜色会残留。
    assert.match(html, /if \(Object\.prototype\.hasOwnProperty\.call\(patch, 'themeVars'\)\) applyMiniThemeVars\(patch\.themeVars\)/, file);
    assert.match(html, /root\.style\.removeProperty\(appliedThemeVars\[i\]\)/, file);
    assert.match(html, /if \(keys\[j\]\.indexOf\('--th-'\) !== 0\) continue;/, file);
  }
  // 封面的青色律动光晕是按窗口几何调过的，留作字面值不参与主题。
  const standard = read('public/mini-player.html');
  assert.match(standard, /0 0 calc\(6px \+ var\(--mini-glow\) \* 14px\) rgba\(110, 231, 216,/);
});

test('主题变量在主进程侧被二次清洗后才进迷你播放器状态缓存', () => {
  const kept = normalizeMiniPlayerThemeVars({
    '--th-panel-bg': 'rgba(1,2,3,.5)',
    '--th-Mini-BG': '  #101014  ',
    '--saved-panel-glass-bg': 'rgba(9,9,9,.9)',
    '--evil': 'red',
    '--th-bad-semi': 'red;color:blue',
    '--th-bad-brace': 'red}body{color:blue',
    '--th-bad-url': 'url(https://example.com/x.png)',
    '--th-bad-import': '@import "x"',
    '--th-empty': '   ',
    '--th-too-long': 'a'.repeat(201),
  });
  assert.deepEqual(kept, { '--th-panel-bg': 'rgba(1,2,3,.5)', '--th-mini-bg': '#101014' });

  const flood = {};
  for (let i = 0; i < 200; i += 1) flood['--th-v' + i] = 'red';
  assert.equal(Object.keys(normalizeMiniPlayerThemeVars(flood)).length, 64);
  assert.deepEqual(normalizeMiniPlayerThemeVars(null), {});

  // 签名只看内容不看书写顺序，避免同一份主题被反复重发。
  const a = miniPlayerThemeSignature({ '--th-a': '1', '--th-b': '2' });
  const b = miniPlayerThemeSignature({ '--th-b': '2', '--th-a': '1' });
  assert.equal(a, b);
  assert.notEqual(a, miniPlayerThemeSignature({ '--th-a': '1', '--th-b': '3' }));
  assert.equal(miniPlayerThemeSignature(null), '');
});

test('迷你播放器状态缓存持有主题变量，离开驻留态时一并释放', () => {
  const cache = new MiniPlayerStateCache(true);
  assert.deepEqual(cache.value.themeVars, {});
  assert.equal(cache.apply({ themeVars: { '--th-panel-bg': 'red' } }), false);

  cache.setResident(true);
  assert.equal(cache.apply({ themeVars: { '--th-panel-bg': 'red', '--nope': 'blue' } }), true);
  assert.deepEqual(cache.value.themeVars, { '--th-panel-bg': 'red' });

  // 只发播放态时主题不能被清空。
  assert.equal(cache.apply({ playing: true }), true);
  assert.deepEqual(cache.value.themeVars, { '--th-panel-bg': 'red' });

  cache.setResident(false);
  assert.deepEqual(cache.value.themeVars, {});
});

test('主题变量沿 renderer → 主进程 → 迷你窗口整条链路转发', () => {
  const runtime = read('public/plugin-runtime.js');
  const renderer = read('public/app.js');
  const main = read('desktop/main.js');

  // 迷你窗口不加载插件运行时，只能拿主窗口合并后的最终值。
  assert.match(runtime, /var activeThemeVars = \{\};/);
  assert.match(runtime, /function themeVars\(\)/);
  assert.match(runtime, /themeVars: themeVars,/);
  assert.equal(runtime.match(/activeThemeVars = vars;/g).length, 2);

  assert.match(renderer, /function miniPlayerThemePayload\(\)/);
  assert.match(renderer, /if \(keys\[i\]\.indexOf\('--th-'\) !== 0\) continue;/);
  assert.match(renderer, /state\.themeSignature = theme\.signature;[\s\S]{0,80}patch\.themeVars = theme\.vars;/);
  // 播放进度那条路径每 80ms 一次，不该每次都重算主题签名。
  assert.match(renderer, /if \(force \|\| !playbackOnly\) \{\s*var theme = miniPlayerThemePayload\(\);/);
  assert.match(renderer, /hasOwnProperty\.call\(patch, 'themeVars'\)\) state\.themeSignature = null;/);
  // 启用/禁用/安装/卸载插件后立刻补推一次，不然要等下一次切歌迷你窗口才换色。
  assert.equal(renderer.match(/\/\/ 主题换了要立刻把新的 --th-\* 推给迷你窗口[^\n]*\n  pushMiniPlayerState\(false\);/g).length, 3);

  assert.match(main, /miniPlayerThemeSignature/);
  assert.match(main, /next\.themeSignature !== previous\.themeSignature/);
  assert.match(main, /patch\.themeVars = next\.themeVars;/);
});
