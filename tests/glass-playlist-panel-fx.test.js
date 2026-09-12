'use strict';
// 「玻璃与左栏」参数组移植（对齐上游 XxHuberrr/Mineradio）：
//   窗口背景透明 / 毛玻璃透明 / 左栏雾面 / 左栏遮挡 / 左栏唤出秒数 / 左栏掀起秒数。
// 玻璃色差（fx-glassaberration）本仓库早已存在，不在这批键里。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const appJs = fs.readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8');
const appCss = fs.readFileSync(path.join(ROOT, 'public', 'app.css'), 'utf8');
const indexHtml = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');

function slice(src, startMarker, endMarker) {
  const start = src.indexOf(startMarker);
  assert.ok(start >= 0, `slice start not found: ${startMarker}`);
  const end = src.indexOf(endMarker, start);
  assert.ok(end > start, `slice end not found: ${endMarker}`);
  return src.slice(start, end);
}

// ---------- 1. 上游默认值逐字对齐 ----------
test('fxDefaults 六键默认值与上游一致', () => {
  const defaults = slice(appJs, 'var fxDefaults = {', '\n};');
  assert.match(defaults, /windowBackgroundOpacity: 1,/);
  assert.match(defaults, /backgroundGlassOpacity: 0,/);
  assert.match(defaults, /playlistPanelGlassBlur: 14,/);
  assert.match(defaults, /playlistPanelGlassDensity: 0\.55,/);
  assert.match(defaults, /playlistPanelOpenDuration: 0\.72,/);
  assert.match(defaults, /playlistPanelCloseDuration: 0\.48,/);
});

test('PACKAGED_DEFAULT_FX_SNAPSHOT 同步六键', () => {
  const snapshot = slice(appJs, 'var PACKAGED_DEFAULT_FX_SNAPSHOT = Object.freeze({', '\n});');
  assert.match(snapshot, /windowBackgroundOpacity: 1,/);
  assert.match(snapshot, /backgroundGlassOpacity: 0,/);
  assert.match(snapshot, /playlistPanelGlassBlur: 14,/);
  assert.match(snapshot, /playlistPanelGlassDensity: 0\.55,/);
  assert.match(snapshot, /playlistPanelOpenDuration: 0\.72,/);
  assert.match(snapshot, /playlistPanelCloseDuration: 0\.48,/);
});

// ---------- 2. 滑条 UI：范围与文案照上游 ----------
test('六条滑条 id/min/max/step 与上游一致', () => {
  const rows = {
    'fx-windowbgopacity': { label: '窗口背景透明', min: '0', max: '1', step: '0.01' },
    'fx-bgglassopacity': { label: '毛玻璃透明', min: '0', max: '1', step: '0.01' },
    'fx-playlistblur': { label: '左栏雾面', min: '14', max: '60', step: '1' },
    'fx-playlistdensity': { label: '左栏遮挡', min: '0.55', max: '1', step: '0.01' },
    'fx-playlistopen': { label: '左栏唤出秒数', min: '0.08', max: '0.72', step: '0.01' },
    'fx-playlistclose': { label: '左栏掀起秒数', min: '0.06', max: '0.48', step: '0.01' },
  };
  for (const [id, want] of Object.entries(rows)) {
    const row = appJs && indexHtml.match(new RegExp(`<div class="fx-slider"><label>[^<]*</label><input id="${id}"[^>]*>`));
    assert.ok(row, `slider row missing: ${id}`);
    assert.ok(row[0].includes(want.label), `${id} label should be ${want.label}`);
    assert.ok(row[0].includes(`min="${want.min}"`), `${id} min`);
    assert.ok(row[0].includes(`max="${want.max}"`), `${id} max`);
    assert.ok(row[0].includes(`step="${want.step}"`), `${id} step`);
  }
});

test('滑条全部落在外观区（背景滑条之后、主控区之前）', () => {
  const bgPos = indexHtml.indexOf('id="fx-bgopacity"');
  const firstNew = indexHtml.indexOf('id="fx-windowbgopacity"');
  const lastNew = indexHtml.indexOf('id="fx-playlistclose"');
  const mainSection = indexHtml.indexOf('<div class="fx-section-label">主控</div>');
  assert.ok(bgPos > 0 && firstNew > bgPos && lastNew > firstNew && mainSection > lastNew);
});

// ---------- 3. 左栏手感函数族：vm 跑真实切片 ----------
function fakeDocument() {
  const rootVars = {};
  const panelVars = {};
  const bodyClasses = new Set();
  const makeStyle = (bag) => ({
    setProperty: (k, v) => { bag[k] = String(v); },
    removeProperty: (k) => { delete bag[k]; },
  });
  const panel = { style: makeStyle(panelVars), classList: { add() {}, remove() {}, contains: () => false }, setProperty: undefined };
  return {
    rootVars, panelVars, bodyClasses,
    document: {
      documentElement: { style: makeStyle(rootVars) },
      body: {
        classList: {
          toggle: (c, on) => { if (on) bodyClasses.add(c); else bodyClasses.delete(c); },
          contains: (c) => bodyClasses.has(c),
          add: (c) => bodyClasses.add(c),
          remove: (c) => bodyClasses.delete(c),
        },
      },
      getElementById: (id) => (id === 'playlist-panel' ? panel : null),
    },
    panel,
  };
}

test('applyPlaylistPanelFxSettings：默认值产出上游 CSS 变量', () => {
  const chunk = slice(appJs, 'var PLAYLIST_PANEL_HIDE_DELAY = 72;', 'var PEEK_HIDE_DELAY = 170;');
  const env = fakeDocument();
  const ctx = {
    document: env.document,
    fxDefaults: {
      playlistPanelGlassBlur: 14, playlistPanelGlassDensity: 0.55,
      playlistPanelOpenDuration: 0.72, playlistPanelCloseDuration: 0.48,
    },
    fx: null,
    clampRange: (v, min, max) => Math.min(max, Math.max(min, Number(v) || 0)),
    isFinite,
  };
  vm.runInNewContext(chunk + '\nglobalThis.__api = { applyPlaylistPanelFxSettings, playlistPanelAlphaVars, playlistPanelMotionMs, playlistPeekHideDelay, clampPlaylistPanelFxSettings, setFx: (v) => { fx = v; } };', ctx);
  const api = ctx.__api;

  api.applyPlaylistPanelFxSettings();
  assert.equal(env.rootVars['--playlist-panel-open-ms'], '720ms');
  assert.equal(env.rootVars['--playlist-panel-close-ms'], '480ms');
  assert.equal(env.rootVars['--playlist-sticky-blur'], '14px');
  assert.equal(env.rootVars['--playlist-toolbar-blur'], '12px'); // clamp(14*0.74=10.36, 12, 46)
  // density 0.55 的六个 alpha（上游公式）
  assert.equal(env.rootVars['--playlist-sticky-a1'], (0.52 + 0.55 * 0.46).toFixed(3));
  assert.equal(env.rootVars['--playlist-sticky-a2'], (0.46 + 0.55 * 0.48).toFixed(3));
  assert.equal(env.rootVars['--playlist-sticky-a3'], (0.28 + 0.55 * 0.56).toFixed(3));
  assert.equal(env.rootVars['--playlist-toolbar-a1'], (0.48 + 0.55 * 0.46).toFixed(3));
  assert.equal(env.rootVars['--playlist-toolbar-a2'], (0.42 + 0.55 * 0.46).toFixed(3));
  assert.equal(env.rootVars['--playlist-toolbar-a3'], (0.24 + 0.55 * 0.48).toFixed(3));
  // 变量同时写进面板本体
  assert.equal(env.panelVars['--playlist-sticky-blur'], '14px');
});

test('applyPlaylistPanelFxSettings：拉动滑条即时改写变量（blur/density/时长）', () => {
  const chunk = slice(appJs, 'var PLAYLIST_PANEL_HIDE_DELAY = 72;', 'var PEEK_HIDE_DELAY = 170;');
  const env = fakeDocument();
  const ctx = {
    document: env.document,
    fxDefaults: {
      playlistPanelGlassBlur: 14, playlistPanelGlassDensity: 0.55,
      playlistPanelOpenDuration: 0.72, playlistPanelCloseDuration: 0.48,
    },
    fx: { playlistPanelGlassBlur: 40, playlistPanelGlassDensity: 1, playlistPanelOpenDuration: 0.3, playlistPanelCloseDuration: 0.2 },
    clampRange: (v, min, max) => Math.min(max, Math.max(min, Number(v) || 0)),
    isFinite,
  };
  vm.runInNewContext(chunk + '\nglobalThis.__api = { applyPlaylistPanelFxSettings, clampPlaylistPanelFxSettings };', ctx);
  ctx.__api.applyPlaylistPanelFxSettings();
  assert.equal(env.rootVars['--playlist-sticky-blur'], '40px');
  assert.equal(env.rootVars['--playlist-toolbar-blur'], '30px'); // 40*0.74=29.6 → 30
  assert.equal(env.rootVars['--playlist-panel-open-ms'], '300ms');
  assert.equal(env.rootVars['--playlist-panel-close-ms'], '200ms');
  assert.equal(env.rootVars['--playlist-sticky-a1'], '0.980'); // 0.52+0.46 = 0.98 顶格
  assert.equal(env.rootVars['--playlist-sticky-a3'], '0.840'); // 0.28+0.56 = 0.84 顶格
});

test('clampPlaylistPanelFxSettings：脏值回落默认、越界夹紧', () => {
  const chunk = slice(appJs, 'var PLAYLIST_PANEL_HIDE_DELAY = 72;', 'var PEEK_HIDE_DELAY = 170;');
  const env = fakeDocument();
  const ctx = {
    document: env.document,
    fxDefaults: {
      playlistPanelGlassBlur: 14, playlistPanelGlassDensity: 0.55,
      playlistPanelOpenDuration: 0.72, playlistPanelCloseDuration: 0.48,
    },
    fx: { playlistPanelGlassBlur: null, playlistPanelGlassDensity: 99, playlistPanelOpenDuration: -1, playlistPanelCloseDuration: 'x' },
    clampRange: (v, min, max) => Math.min(max, Math.max(min, Number(v) || 0)),
    isFinite,
  };
  vm.runInNewContext(chunk + '\nglobalThis.__api = { clampPlaylistPanelFxSettings, getFx: () => fx };', ctx);
  ctx.__api.clampPlaylistPanelFxSettings();
  const fx = ctx.__api.getFx();
  assert.equal(fx.playlistPanelGlassBlur, 14); // null → 默认
  assert.equal(fx.playlistPanelGlassDensity, 1); // 99 → 夹到上限
  assert.equal(fx.playlistPanelOpenDuration, 0.08); // -1 → 夹到下限
  assert.equal(fx.playlistPanelCloseDuration, 0.06); // 'x' → NaN → 0 → 夹到下限 0.06
});

test('playlistPanelMotionMs：fx 缺失时回落范围 fallback，整数毫秒', () => {
  const chunk = slice(appJs, 'var PLAYLIST_PANEL_HIDE_DELAY = 72;', 'var PEEK_HIDE_DELAY = 170;');
  const ctx = {
    document: fakeDocument().document,
    fxDefaults: {},
    fx: null,
    clampRange: (v, min, max) => Math.min(max, Math.max(min, Number(v) || 0)),
    isFinite,
  };
  vm.runInNewContext(chunk + '\nglobalThis.__api = { playlistPanelMotionMs, playlistPeekHideDelay };', ctx);
  assert.equal(ctx.__api.playlistPanelMotionMs('open'), 280);
  assert.equal(ctx.__api.playlistPanelMotionMs('close'), 180);
});

// ---------- 4. applyCustomBackground：窗口透明 + 毛玻璃 ----------
function buildApplyCustomBackground(fxOverrides) {
  const chunk = slice(appJs, 'function applyCustomBackground() {', 'function updateCustomBackgroundControls() {');
  const env = fakeDocument();
  const layerVars = {};
  const fx = Object.assign({
    backgroundColor: '#000000', backgroundColorMode: 'cover', backgroundColorCustom: false,
    backgroundOpacity: 1, windowBackgroundOpacity: 1, backgroundGlassOpacity: 0,
    backgroundMedia: null, backgroundImage: '',
  }, fxOverrides || {});
  const ctx = {
    document: Object.assign({}, env.document, {
      getElementById: (id) => (id === 'custom-bg' ? { style: {
        setProperty: (k, v) => { layerVars[k] = String(v); },
        removeProperty: (k) => { delete layerVars[k]; },
      } } : null),
    }),
    fxDefaults: { windowBackgroundOpacity: 1, backgroundGlassOpacity: 0 },
    fx,
    normalizeHexColor: (c) => (typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c) ? c : '#000000'),
    normalizeCustomBackgroundMedia: (m) => (m && m.type ? m : null),
    hexToRgb: (hex) => ({ r: 0, g: 0, b: 0 }),
    cssImageUrl: (s) => s,
    clampRange: (v, min, max) => Math.min(max, Math.max(min, Number(v) || 0)),
    customBgApplyToken: 0,
    customBgObjectUrl: '',
    layerVars,
  };
  vm.runInNewContext(chunk + '\nglobalThis.__api = { applyCustomBackground };', ctx);
  ctx.__api.applyCustomBackground();
  return { ctx, env, layerVars };
}

test('默认态：窗口透明与玻璃全关，body 无新类', () => {
  const { env, layerVars } = buildApplyCustomBackground();
  assert.equal(env.bodyClasses.has('custom-window-transparent'), false);
  assert.equal(env.bodyClasses.has('custom-bg-glass-active'), false);
  assert.equal(layerVars['--custom-bg-base-opacity'], '1.000');
  assert.equal(layerVars['--custom-bg-glass-blur'], '0.0px');
});

test('窗口背景透明 0.5：挂 custom-window-transparent，底色 alpha 减半', () => {
  const { env, layerVars } = buildApplyCustomBackground({ windowBackgroundOpacity: 0.5 });
  assert.equal(env.bodyClasses.has('custom-window-transparent'), true);
  assert.equal(layerVars['--custom-bg-base-opacity'], '0.500');
});

test('毛玻璃透明 0.6：挂 custom-bg-glass-active，blur/saturate/brightness/veil/overlay 走上游公式', () => {
  const { env, layerVars } = buildApplyCustomBackground({ backgroundGlassOpacity: 0.6 });
  assert.equal(env.bodyClasses.has('custom-bg-glass-active'), true);
  assert.equal(layerVars['--custom-bg-glass-opacity'], '0.600');
  assert.equal(layerVars['--custom-bg-glass-blur'], '19.2px'); // 0.6*32
  assert.equal(layerVars['--custom-bg-glass-saturate'], '1.330'); // 1+0.6*0.55
  assert.equal(layerVars['--custom-bg-glass-brightness'], '1.048'); // 1+0.6*0.08
  assert.equal(layerVars['--custom-bg-glass-veil'], '0.045'); // 0.6*0.075
  assert.equal(layerVars['--custom-bg-overlay-opacity'], '0.252'); // 0.6*0.42
  assert.equal(env.bodyClasses.has('custom-window-transparent'), false);
});

test('毛玻璃与背景媒体并存时 overlay 取最大（上游 Math.max 公式）', () => {
  const { layerVars } = buildApplyCustomBackground({ backgroundGlassOpacity: 0.3, backgroundMedia: { type: 'image', src: 'data:image/png;base64,x' } });
  assert.equal(layerVars['--custom-bg-overlay-opacity'], '0.180'); // max(0.18, 0.3*0.42=0.126)
});

// ---------- 5. 开合动画接线：源码断言 ----------
test('setPeek：关闭时挂 closing 类、时长吃滑条、pl 隐藏延迟 72ms', () => {
  const setPeekChunk = slice(appJs, 'function setPeek(el, on, key) {', 'function uploadTipWasSeen()');
  assert.match(setPeekChunk, /if \(key === 'pl'\) el\.classList\.add\('playlist-panel-closing'\);/);
  assert.match(setPeekChunk, /if \(key === 'pl'\) el\.classList\.remove\('playlist-panel-closing'\);/);
  assert.match(setPeekChunk, /setTimeout\(function\(\)\{ el\.classList\.remove\('playlist-panel-closing'\); \}, closeMs \+ 80\)/);
  assert.match(setPeekChunk, /playlistPeekHideDelay\(key\)/);
  assert.doesNotMatch(setPeekChunk, /, PEEK_HIDE_DELAY\);\n  \}/);
  const helpers = slice(appJs, 'var PLAYLIST_PANEL_HIDE_DELAY = 72;', 'var PEEK_HIDE_DELAY = 170;');
  assert.match(helpers, /return key === 'pl' \? PLAYLIST_PANEL_HIDE_DELAY : PEEK_HIDE_DELAY;/);
  assert.match(helpers, /var PLAYLIST_PANEL_HIDE_DELAY = 72;/);
});

test('togglePlaylistPanel 关闭 show 时挂 closing 类', () => {
  const chunk = slice(appJs, 'function togglePlaylistPanel(force) {', 'function applyPlaylistPanelPinState(');
  assert.match(chunk, /willClose/);
  assert.match(chunk, /el\.classList\.add\('playlist-panel-closing'\)/);
  assert.match(chunk, /playlistPanelMotionMs\('close'\) \+ 80/);
});

// ---------- 6. CSS：变量族与玻璃规则 ----------
test('CSS：#playlist-panel 声明变量族且 transition 吃 motion 变量', () => {
  const rule = appCss.match(/#playlist-panel\{[^}]*\}/);
  assert.ok(rule, '#playlist-panel rule');
  assert.ok(rule[0].includes('--playlist-panel-open-ms:var(--mineradio-playlist-panel-open-ms,280ms)'));
  assert.ok(rule[0].includes('--playlist-panel-close-ms:var(--mineradio-playlist-panel-close-ms,180ms)'));
  assert.ok(rule[0].includes('--playlist-sticky-blur:38px'));
  assert.ok(rule[0].includes('transition:left var(--playlist-panel-motion-ms) cubic-bezier(.16,1,.3,1)'));
});

test('CSS：closing 类切到收起时长', () => {
  assert.match(appCss, /#playlist-panel\.playlist-panel-closing\{--playlist-panel-motion-ms:var\(--playlist-panel-close-ms\)\}/);
});

test('CSS：sticky 玻璃头吃 blur 与 alpha 变量', () => {
  const rule = appCss.match(/\.playlist-panel-sticky\{[^}]*\}/);
  assert.ok(rule, '.playlist-panel-sticky rule');
  assert.ok(rule[0].includes('position:sticky;top:-18px'));
  assert.ok(rule[0].includes('backdrop-filter:blur(var(--playlist-sticky-blur,38px)) saturate(1.34) brightness(1.06)'));
  assert.ok(rule[0].includes('rgba(12,14,18,var(--playlist-sticky-a1,.94))'));
  assert.ok(rule[0].includes('rgba(9,11,15,var(--playlist-sticky-a2,.90)) 70%'));
  assert.ok(rule[0].includes('rgba(9,11,15,var(--playlist-sticky-a3,.78))'));
});

test('CSS：queue-toolbar 吃 toolbar blur/alpha 变量并 sticky', () => {
  const rule = appCss.match(/\.queue-toolbar\{[^}]*\}/);
  assert.ok(rule, '.queue-toolbar rule');
  assert.ok(rule[0].includes('position:sticky;top:82px'));
  assert.ok(rule[0].includes('backdrop-filter:blur(var(--playlist-toolbar-blur,28px)) saturate(1.25) brightness(1.05)'));
  assert.ok(rule[0].includes('rgba(11,13,18,var(--playlist-toolbar-a1,.88))'));
  assert.ok(rule[0].includes('rgba(8,10,14,var(--playlist-toolbar-a3,.68))'));
});

test('CSS：主题「面板内部禁玻璃」补偿规则给 sticky 头与 toolbar 开豁免', () => {
  assert.match(appCss, /#playlist-panel \*:not\(\.playlist-panel-sticky\):not\(\.queue-toolbar\)\{backdrop-filter:none!important;-webkit-backdrop-filter:none!important\}/);
  assert.doesNotMatch(appCss, /#playlist-panel \*\{backdrop-filter:none!important/);
});

test('CSS：窗口透明与玻璃的底色层规则', () => {
  assert.match(appCss, /body\.custom-window-transparent #custom-bg\{background:rgba\(var\(--custom-bg-color-rgb,0,0,0\),var\(--custom-bg-base-opacity,1\)\)\}/);
  assert.match(appCss, /body\.custom-background-override\.custom-bg-glass-active #custom-bg::after\{background:radial-gradient\(circle at 22% 8%,rgba\(255,255,255,var\(--custom-bg-glass-veil,0\)\),transparent 34%\),linear-gradient\(180deg,rgba\(255,255,255,var\(--custom-bg-glass-veil,0\)\),rgba\(0,0,0,\.035\)\)\}/);
  // flat 遮罩关闭要让位给玻璃
  assert.match(appCss, /body\.custom-background-override\.custom-background-flat:not\(\.custom-bg-glass-active\) #custom-bg::after\{opacity:0!important\}/);
  assert.doesNotMatch(appCss, /body\.custom-background-override\.custom-background-flat #custom-bg::after\{opacity:0!important\}/);
});

// ---------- 7. 面板 DOM：sticky 头包装 ----------
test('index.html：queue-head 与 panel-tabs 包进 playlist-panel-sticky', () => {
  const panelChunk = slice(indexHtml, '<div id="playlist-panel">', '<div id="queue-pane">');
  const stickyStart = panelChunk.indexOf('<div class="playlist-panel-sticky">');
  const headStart = panelChunk.indexOf('<div class="queue-head">');
  const tabsStart = panelChunk.indexOf('<div class="panel-tabs">');
  assert.ok(stickyStart >= 0 && headStart > stickyStart && tabsStart > stickyStart, 'sticky wrapper must wrap queue-head and panel-tabs');
  // tab-library 按钮之后的第一个 </div> 是 panel-tabs 的关闭，随后必须先关 sticky 再进 queue-pane
  const tabsEnd = panelChunk.indexOf('</div>', panelChunk.indexOf('id="tab-library"'));
  const between = panelChunk.slice(tabsEnd, panelChunk.indexOf('<div id="queue-pane">'));
  assert.match(between.trim(), /^<\/div>\s*<\/div>$/, 'panel-tabs 关闭后应先关 sticky 头再进 queue-pane');
});

// ---------- 8. 绑定/回填/重置/归页 ----------
test('bindFxPanel：六键登记 + input 夹紧 + 即时应用', () => {
  assert.match(appJs, /\['fx-windowbgopacity','windowBackgroundOpacity'\],\['fx-bgglassopacity','backgroundGlassOpacity'\]/);
  assert.match(appJs, /\['fx-playlistblur','playlistPanelGlassBlur'\],\['fx-playlistdensity','playlistPanelGlassDensity'\],\['fx-playlistopen','playlistPanelOpenDuration'\],\['fx-playlistclose','playlistPanelCloseDuration'\]/);
  assert.match(appJs, /if \(pair\[1\] === 'windowBackgroundOpacity'\) \{\s*fx\.windowBackgroundOpacity = clampRange\(fx\.windowBackgroundOpacity, 0, 1\);\s*updateCustomBackgroundControls\(\);\s*\}/);
  assert.match(appJs, /if \(pair\[1\] === 'playlistPanelGlassBlur'\) fx\.playlistPanelGlassBlur = Math\.round\(clampRange\(fx\.playlistPanelGlassBlur, 14, 60\)\);/);
  assert.match(appJs, /if \(\/\^playlistPanel\/\.test\(pair\[1\]\)\) applyPlaylistPanelFxSettings\(\);/);
  assert.match(appJs, /pair\[1\] === 'playlistPanelGlassBlur' \? String\(Math\.round\(fx\[pair\[1\]\]\)\)/);
});

test('updateFxInputs：六条 setRange 回填 + 末尾应用一次', () => {
  const chunk = slice(appJs, 'function updateFxInputs() {', '\n}');
  assert.match(chunk, /setRange\('fx-windowbgopacity', fx\.windowBackgroundOpacity == null \? fxDefaults\.windowBackgroundOpacity : fx\.windowBackgroundOpacity\);/);
  assert.match(chunk, /setRange\('fx-bgglassopacity', fx\.backgroundGlassOpacity == null \? fxDefaults\.backgroundGlassOpacity : fx\.backgroundGlassOpacity\);/);
  assert.match(chunk, /setRange\('fx-playlistblur', fx\.playlistPanelGlassBlur\);/);
  assert.match(chunk, /setRange\('fx-playlistdensity', fx\.playlistPanelGlassDensity\);/);
  assert.match(chunk, /setRange\('fx-playlistopen', fx\.playlistPanelOpenDuration\);/);
  assert.match(chunk, /setRange\('fx-playlistclose', fx\.playlistPanelCloseDuration\);/);
  assert.match(chunk, /applyPlaylistPanelFxSettings\(\);/);
});

test('resetFxSliderValue：重置后应用新效果', () => {
  const chunk = slice(appJs, 'function resetFxSliderValue(id, key, btn) {', 'function ensureFxSliderResetButton(');
  assert.match(chunk, /if \(key === 'backgroundOpacity' \|\| key === 'windowBackgroundOpacity' \|\| key === 'backgroundGlassOpacity'\) updateCustomBackgroundControls\(\);/);
  assert.match(chunk, /if \(\/\^playlistPanel\/\.test\(key\)\) applyPlaylistPanelFxSettings\(\);/);
});

test('fxPanelTargetForNode：新滑条归外观页（照上游 /^fx-playlist/ 规则）', () => {
  const chunk = slice(appJs, 'function fxPanelTargetForNode(node, current) {', 'function organizeFxPanel() {');
  assert.match(chunk, /inputId === 'fx-windowbgopacity' \|\| inputId === 'fx-bgglassopacity'/);
  assert.match(chunk, /\/\^fx-playlist\/\.test\(inputId\)\) return 'appearance'/);
});

// ---------- 9. 持久化往返 ----------
test('readSavedLyricLayout 与 saveLyricLayout 双向带六键夹紧', () => {
  const readChunk = slice(appJs, 'function readSavedLyricLayout() {', 'function saveLyricLayout() {');
  for (const key of ['windowBackgroundOpacity', 'backgroundGlassOpacity', 'playlistPanelGlassBlur', 'playlistPanelGlassDensity', 'playlistPanelOpenDuration', 'playlistPanelCloseDuration']) {
    assert.ok(new RegExp(`raw\\.${key}`).test(readChunk), `readSavedLyricLayout missing raw.${key}`);
    assert.ok(new RegExp(`${key}: saved`).test(readChunk), `readSavedLyricLayout result missing ${key}`);
  }
  assert.match(readChunk, /var savedWindowBgOpacity = clampRange\(raw\.windowBackgroundOpacity == null \? fxDefaults\.windowBackgroundOpacity : Number\(raw\.windowBackgroundOpacity\), 0, 1\);/);
  assert.match(readChunk, /Math\.round\(clampRange\(raw\.playlistPanelGlassBlur == null \? fxDefaults\.playlistPanelGlassBlur : Number\(raw\.playlistPanelGlassBlur\), 14, 60\)\)/);
  const saveChunk = slice(appJs, 'function saveLyricLayout() {', 'function normalizeHexColor(value, fallback) {');
  for (const key of ['windowBackgroundOpacity', 'backgroundGlassOpacity', 'playlistPanelGlassDensity', 'playlistPanelOpenDuration', 'playlistPanelCloseDuration']) {
    assert.ok(new RegExp(`${key}: clampRange\\(fx\\.${key}`).test(saveChunk), `saveLyricLayout missing ${key}`);
  }
  assert.match(saveChunk, /playlistPanelGlassBlur: Math\.round\(clampRange\(fx\.playlistPanelGlassBlur/);
});

test('视觉存档 archiveNumber 覆盖六键', () => {
  const idx = appJs.indexOf("archiveNumber(raw, 'windowBackgroundOpacity'");
  assert.ok(idx > 0, 'archive windowBackgroundOpacity');
  assert.match(appJs, /archiveNumber\(raw, 'playlistPanelGlassBlur', fxDefaults\.playlistPanelGlassBlur, 14, 60\)/);
  assert.match(appJs, /archiveNumber\(raw, 'playlistPanelCloseDuration', fxDefaults\.playlistPanelCloseDuration, 0\.06, 0\.48\)/);
});
