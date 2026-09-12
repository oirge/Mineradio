'use strict';
// 「回到 Home」房子按钮保留在顶栏，显隐由原版同款控制把手切换（与账号胶囊
// `#user-capsule-hide-btn` / `toggleUserCapsuleAutoHide` 同一模式），
// 不再把按钮从 DOM 删除（v2.0.9 之后用户明确纠正过）。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8');
const appCss = fs.readFileSync(path.join(ROOT, 'public', 'app.css'), 'utf8');

test('index.html：房子按钮与其控制把手都在顶栏', () => {
  assert.match(indexHtml, /<button id="home-btn" class="icon-btn" onclick="goHome\(\)"/);
  assert.match(indexHtml, /<button id="home-btn-hide-btn" class="user-capsule-hide-btn" type="button" onclick="toggleHomeBtnAutoHide\(event\)" title="自动隐藏 Home 按钮">‹<\/button>/);
  // 把手排在房子按钮之前（与账号胶囊把手同侧）
  const hidePos = indexHtml.indexOf('id="home-btn-hide-btn"');
  const homePos = indexHtml.indexOf('id="home-btn"');
  assert.ok(hidePos > 0 && homePos > hidePos);
});

test('app.js：开关函数、持久化与启动接线齐全', () => {
  assert.match(appJs, /var HOME_BTN_AUTO_HIDE_STORE_KEY = 'mineradio-home-btn-auto-hide-v1';/);
  assert.match(appJs, /var homeBtnAutoHide = readBooleanPreference\(HOME_BTN_AUTO_HIDE_STORE_KEY, false\);/);
  assert.match(appJs, /function applyHomeBtnAutoHideState\(\) \{[\s\S]*?classList\.toggle\('home-btn-auto-hide', !!homeBtnAutoHide\);[\s\S]*?btn\.textContent = homeBtnAutoHide \? '›' : '‹';[\s\S]*?btn\.title = homeBtnAutoHide \? '取消自动隐藏 Home 按钮' : '自动隐藏 Home 按钮';/);
  assert.match(appJs, /function toggleHomeBtnAutoHide\(e\) \{[\s\S]*?saveBooleanPreference\(HOME_BTN_AUTO_HIDE_STORE_KEY, homeBtnAutoHide\);[\s\S]*?applyHomeBtnAutoHideState\(\);[\s\S]*?showToast\(homeBtnAutoHide \? 'Home 按钮已自动隐藏' : 'Home 按钮已固定显示'\);/);
  // 持久化清单两处登记（UI 状态镜像 + 整机备份白名单），与账号胶囊同款
  assert.match(appJs, /USER_CAPSULE_AUTO_HIDE_STORE_KEY,\s*\n\s*HOME_BTN_AUTO_HIDE_STORE_KEY,\s*\n\s*FX_FAB_AUTO_HIDE_STORE_KEY,/);
  assert.match(appJs, /applyUserCapsuleAutoHideState\(\);\s*\n\s*applyHomeBtnAutoHideState\(\);\s*\n\s*applyFxFabAutoHideState\(\);/);
});

test('CSS：auto-hide 类隐藏房子按钮，把手复用胶囊把手样式', () => {
  assert.match(appCss, /body\.home-btn-auto-hide #home-btn\{display:none\}/);
  assert.match(appCss, /\.user-capsule-hide-btn\{[^}]*\}/);
  // 键盘 Home 键入口保留
  assert.match(appJs, /e\.code === 'Home'[\s\S]{0,60}goHome\(\)/);
});
