'use strict';
// 用户要求隐藏右上角「回到 Home」房子按钮（#home-btn）。
// Home 主页本身保留（空库引导、键盘 Home 键仍可进入），只去掉可视入口。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8');

test('index.html：房子按钮已隐藏', () => {
  assert.doesNotMatch(indexHtml, /id="home-btn"/);
  assert.doesNotMatch(indexHtml, /onclick="goHome\(\)"/);
});

test('goHome 的全屏 DIY 布局锚点保留 top-right 兜底', () => {
  assert.match(appJs, /document\.getElementById\('home-btn'\) \|\| document\.getElementById\('top-right'\)/);
});
