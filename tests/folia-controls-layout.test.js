'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'public/folia-host.css'), 'utf8');
const appCss = fs.readFileSync(path.join(root, 'public/app.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
const localCss = fs.readFileSync(path.join(root, 'vendor-src/folia/src/mineradio/local/local.css'), 'utf8');
const controls = fs.readFileSync(path.join(root, 'vendor-src/folia/src/mineradio/local/PlayerControls.tsx'), 'utf8');
const switcher = fs.readFileSync(path.join(root, 'vendor-src/folia/src/mineradio/local/PlaylistSwitcher.tsx'), 'utf8');
const host = fs.readFileSync(path.join(root, 'public/folia-host.js'), 'utf8');

test('empty Mineradio Home keeps the Folia switch reachable', () => {
  assert.match(html, /<body class="[^"]*\bempty-home-active\b[^"]*">/);
  assert.match(html, /id="folia-switch-btn"/);
  // 空 Home 不再隐藏 Folia 入口：藏起来会让用户找不到回 Folia 的路。
  assert.doesNotMatch(css, /body\.empty-home-active[^{,]*#folia-(?:switch-btn|floating-switch)/);
});

test('empty-Home keeps the Folia return entry and the saved Folia preload', () => {
  const gates = css.match(/html[^{,]+body\.empty-home-active[^{,]+#folia-(?:switch-btn|floating-switch)/g) || [];
  assert.equal(gates.length, 0, '空 Home 不能再隐藏 Folia 入口');
  assert.match(html, /localStorage\.getItem\('mineradio-player-interface-v1'\) === 'folia'[\s\S]+classList\.add\('folia-mode-preload'\)/);
});

test('browser Folia entry sits below Home without changing the active Folia view', () => {
  const rule = css.match(/body:not\(\.desktop-shell\):not\(\.folia-interface-active\) #folia-floating-switch\{([^}]+)\}/);
  assert.ok(rule, 'The browser player needs its own non-overlapping switch position');
  assert.match(rule[1], /top:90px/);
  assert.match(rule[1], /right:24px/);
  assert.match(css, /body\.folia-interface-active #folia-floating-switch\{top:10px;right:16px\}/);
});

test('compact fullscreen moves only the Folia entry below the search and control row', () => {
  const rule = css.match(/@media\(max-width:1600px\)\{([^}]+\{[^}]+\})\}/);
  assert.ok(rule, 'Compact fullscreen must not place Folia over the search or import controls');
  assert.match(rule[1], /html:fullscreen body\.desktop-shell:not\(\.folia-interface-active\) #folia-floating-switch/);
  assert.match(rule[1], /body\.desktop-shell\.desktop-fullscreen:not\(\.folia-interface-active\) #folia-floating-switch/);
  assert.match(rule[1], /top:108px;right:24px/);
  assert.match(css, /@media\(max-width:720px\)\{[^}]*body:not\(\.desktop-shell\):not\(\.folia-interface-active\) #folia-floating-switch[^}]*right:12px/);
});

test('narrow simple fullscreen clears the taller search row in both fullscreen paths', () => {
  assert.match(css, /@media\(max-width:720px\)\{html:fullscreen body\.desktop-shell\.simple-mode:not\(\.folia-interface-active\) #folia-floating-switch,body\.desktop-shell\.desktop-fullscreen\.simple-mode:not\(\.folia-interface-active\) #folia-floating-switch\{top:124px\}\}/);
});

test('windowed desktop search clears the Folia titlebar row', () => {
  assert.match(appCss, /body\.desktop-shell #search-area\.peek\{top:44px\}/);
  assert.match(appCss, /body\.desktop-shell #search-area\.stage-mode\.peek\{top:42px\}/);
});

test('wide fullscreen keeps measured alignment and windowed desktop keeps one Folia entry', () => {
  assert.match(css, /right:var\(--folia-fs-switch-right,312px\)/);
  assert.match(css, /body\.desktop-shell:not\(\.desktop-fullscreen\) #folia-floating-switch\{display:none\}/);
  assert.match(css, /body\.folia-interface-active\.folia-chrome-hidden #folia-floating-switch/);
});

test('Folia playlist button follows the heart without adding another control row', () => {
  assert.match(controls, /data-testid="local-like"[\s\S]*?<Heart[^]*?<\/button>\s*<PlaylistSwitcher state=\{state\} command=\{command\} onManage=\{onLibrary\} \/>/);
  assert.ok(controls.indexOf('<PlaylistSwitcher') > controls.indexOf('<div className="local-transport">'));
  assert.doesNotMatch(localCss, /\.local-playlist-row|\.local-playlist-picker/);
  assert.match(localCss, /\.local-player \.local-playlist-trigger\{[^}]*width:82px;height:34px;min-height:34px/);
  assert.match(localCss, /\.local-current-track\{left:21px;bottom:133px/);
  assert.match(localCss, /@media\(max-width:1150px\)\{[^}]+\}[^}]*\.local-playlist-label\{display:none\}/);
});

test('Folia playlist popup escapes transport clipping but stays inside its focus boundary', () => {
  assert.match(switcher, /closest<HTMLElement>\('\.local-controls'\)/);
  assert.match(switcher, /createPortal\(<PlaylistSwitcherMenu[\s\S]*?\/>, controls\)/);
  assert.match(localCss, /\.local-playlist-menu\{position:absolute;bottom:calc\(100% \+ 10px\)/);
  assert.match(localCss, /\.local-controls\.local-playlist-open\{z-index:20\}/);
  assert.match(host, /\.local-transport\{[^']*overflow:hidden;max-height:80px/);
});

test('keyboard focus keeps the Folia controls visible while choosing a playlist', () => {
  assert.match(host, /if \(!active \|\| barLock \|\| barDragging \|\| barFocused\) return/);
  assert.match(host, /barDragging = e\.target\.tagName !== 'SELECT'/);
  for (const [event, handler] of [['focusin', 'onFrameFocusIn'], ['focusout', 'onFrameFocusOut']]) {
    assert.ok(host.includes(`doc.addEventListener('${event}', ${handler}, true)`));
    assert.ok(host.includes(`frameActivityDoc.removeEventListener('${event}', ${handler}, true)`));
  }
});

test('Folia 音量条在滑块右侧显示具体百分比数值', () => {
  assert.match(controls, /data-testid="local-volume"[\s\S]{0,400}?<span className="local-volume-value" data-testid="local-volume-value">\{Math\.round\(\(state\?\.volume \?\? 1\) \* 100\)\}%<\/span>/);
  assert.match(localCss, /\.local-volume-value\{[^}]*min-width:30px[^}]*text-align:right[^}]*font-variant-numeric:tabular-nums/);
});
