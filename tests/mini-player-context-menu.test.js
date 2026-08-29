'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const main = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'main.js'), 'utf8');

test('迷你播放器窗口必须挂 context-menu 处理并阻止默认菜单', () => {
  const factoryStart = main.indexOf('function createMiniPlayerWindow()');
  const factoryEnd = main.indexOf('\nfunction ', factoryStart + 1);
  const factory = main.slice(factoryStart, factoryEnd > 0 ? factoryEnd : undefined);
  assert.match(factory, /win\.webContents\.on\('context-menu'/, '迷你窗口必须监听 context-menu');
  assert.match(factory, /event\.preventDefault\(\)/, '必须阻止默认右键菜单');
  assert.match(factory, /showMiniPlayerContextMenu\(win\)/, '必须交给统一的迷你右键菜单构建器');
});

test('迷你右键菜单必须包含显示播放器、迷你样式切换与退出播放器', () => {
  const fnStart = main.indexOf('function showMiniPlayerContextMenu(win)');
  assert.ok(fnStart > 0, 'showMiniPlayerContextMenu 必须存在');
  const fnEnd = main.indexOf('\nfunction ', fnStart + 1);
  const fn = main.slice(fnStart, fnEnd > 0 ? fnEnd : undefined);

  assert.match(fn, /if \(!win \|\| win\.isDestroyed\(\) \|\| miniPlayerWindow !== win\) return;/, '必须校验窗口仍是当前迷你窗口');
  assert.match(fn, /label: '显示播放器', click: focusMainWindow/, '显示播放器必须走 focusMainWindow（与恢复按钮同一路径）');
  assert.match(fn, /label: '迷你播放器样式'/, '必须有迷你播放器样式子菜单');
  assert.match(fn, /label: '标准（带封面）',\s*\n\s*type: 'radio',\s*\n\s*checked: miniPlayerMode === 'standard',\s*\n\s*click: \(\) => setMiniPlayerMode\('standard'\)/, '标准样式必须接 setMiniPlayerMode');
  assert.match(fn, /label: '极简（无封面）',\s*\n\s*type: 'radio',\s*\n\s*checked: miniPlayerMode === 'compact',\s*\n\s*click: \(\) => setMiniPlayerMode\('compact'\)/, '极简样式必须接 setMiniPlayerMode');
  assert.match(fn, /label: '退出播放器',\s*\n\s*click: \(\) => \{\s*\n\s*appQuitting = true;\s*\n\s*app\.quit\(\);/, '退出播放器必须与托盘退出同路径（appQuitting = true + app.quit）');
});

test('两种迷你外壳共用同一窗口工厂，右键菜单天然覆盖标准与极简', () => {
  const factory = main.slice(main.indexOf('function createMiniPlayerWindow()'));
  assert.match(factory, /const page = mode === 'compact' \? 'mini-player-compact\.html' : 'mini-player\.html';/, '标准与极简共用 createMiniPlayerWindow');
});
