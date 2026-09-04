'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const publicDir = path.join(__dirname, '..', 'public');
const index = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
const appCss = fs.readFileSync(path.join(publicDir, 'app.css'), 'utf8');
const appJs = fs.readFileSync(path.join(publicDir, 'app.js'), 'utf8');

function tagOf(id) {
  const match = index.match(new RegExp('<(?:img|div) id="' + id + '"([^>]*)>'));
  assert.ok(match, '缺少 #' + id + ' 元素');
  return match[1];
}

test('左下小封面可点击进入歌曲详情', () => {
  const cover = tagOf('thumb-cover');
  assert.match(cover, /onclick="openTrackDetailModal\('song'\)"/);
  assert.match(cover, /title="歌曲详情"/);
  assert.match(cover, /alt=""/);
});

test('小封面标题仍进歌曲详情、副标题仍进歌手详情', () => {
  assert.match(tagOf('thumb-title'), /onclick="openTrackDetailModal\('song'\)"/);
  assert.match(tagOf('thumb-artist'), /onclick="openTrackDetailModal\('artist'\)"/);
  assert.match(tagOf('control-title'), /onclick="openTrackDetailModal\('song'\)"/);
  assert.match(tagOf('control-artist'), /onclick="openTrackDetailModal\('artist'\)"/);
});

test('封面有手型指针且不新增其他样式改动', () => {
  const rule = appCss.match(/#thumb-cover\{([^}]*)\}/);
  assert.ok(rule, '缺少 #thumb-cover 样式');
  assert.match(rule[1], /cursor:pointer/);
  assert.match(rule[1], /width:64px/);
  assert.match(rule[1], /object-fit:cover/);
  assert.doesNotMatch(appCss, /#thumb-cover:hover/);
});

test('空闲时封面不可点且详情弹窗自带兜底', () => {
  assert.match(appCss, /#thumb-wrap\{[^}]*pointer-events:none/);
  assert.match(appCss, /#thumb-wrap\.visible\{[^}]*pointer-events:auto/);
  assert.match(appJs, /function openTrackDetailModal\(type, songOverride\) \{\s*\n\s*var song = songOverride \|\| currentCoverSong\(\);\s*\n\s*if \(!song\) \{ showToast\('先播放或选择一首歌'\); return; \}/);
});
