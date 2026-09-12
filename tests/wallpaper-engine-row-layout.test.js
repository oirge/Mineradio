'use strict';
// WE 行布局回归：v2.0.8 恢复 wallpaper-engine.css 样式后，actions 的 clamp 宽度
// 在 .lyric-color-row.image-pick-row 的 68px 第三列里溢出，把「识别 / 导入」挤出面板。
// 修复 = WE 行专用三列布局 + actions 占满第三列。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(ROOT, 'public', 'wallpaper-engine.css'), 'utf8');
const indexHtml = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');

test('wallpaper-engine.css 括号配平', () => {
  let depth = 0;
  for (const ch of css) {
    if (ch === '{') depth += 1;
    else if (ch === '}') depth -= 1;
    assert.ok(depth >= 0, 'unexpected closing brace');
  }
  assert.equal(depth, 0);
});

test('WE 行覆盖 image-pick-row 的 68px 第三列，actions 占满该列', () => {
  assert.match(css, /\.lyric-color-row\.wallpaper-engine-row \{\s*grid-template-columns: 42px minmax\(0, 1fr\) clamp\(176px, 40vw, 224px\)\s*\}/);
  assert.match(css, /\.wallpaper-engine-row \.wallpaper-engine-actions \{\s*width: 100%\s*\}/);
});

test('index.html：WE 行三按钮齐全（启用 / 识别 / 导入 / 恢复原背景）', () => {
  const row = indexHtml.match(/<div class="lyric-color-row image-pick-row wallpaper-engine-row">[\s\S]*?<\/div>\s*<\/div>/);
  assert.ok(row, 'wallpaper-engine-row');
  assert.match(row[0], /id="wallpaper-engine-toggle-btn"/);
  assert.match(row[0], /openWallpaperEngineLibrary\(\)/);
  assert.match(row[0], /id="wallpaper-engine-restore-btn"/);
});
