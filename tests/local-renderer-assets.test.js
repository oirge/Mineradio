'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const publicDir = path.join(__dirname, '..', 'public');
const index = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
const appCss = fs.readFileSync(path.join(publicDir, 'app.css'), 'utf8');
const appJs = fs.readFileSync(path.join(publicDir, 'app.js'), 'utf8');
const fontsCss = fs.readFileSync(path.join(publicDir, 'vendor', 'fonts.css'), 'utf8');
const interFont = fs.readFileSync(path.join(publicDir, 'vendor', 'fonts', 'Inter-latin.woff2'));
const notoFont = fs.readFileSync(path.join(publicDir, 'vendor', 'fonts', 'NotoSansSC-ui.woff2'));

test('主渲染器使用本地 CSS、JS 和字体资源', () => {
  assert.match(index, /<link rel="stylesheet" href="app\.css">/);
  assert.match(index, /<script src="app\.js"><\/script>/);
  assert.doesNotMatch(index, /fonts\.googleapis\.com/);
  assert.doesNotMatch(index, /v1\.0\.10/);
  assert.doesNotMatch(index, /<style>/);

  const inlineScripts = Array.from(index.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g), match => match[1]);
  assert.ok(inlineScripts.length >= 1, '保留启动预加载脚本');
  assert.ok(inlineScripts.every(script => script.length < 1200), '主渲染器代码不能重新内联回 HTML');
  assert.match(appJs, /^\s*'use strict';/);
  assert.match(appJs, /var APP_VERSION = '[^']+';/);
  assert.match(appCss, /--font-sans:"Inter","Noto Sans SC"/);
  assert.doesNotMatch(appJs, /document\.write\s*\(/);
});

test('本地 Inter 字体资源格式和声明有效', () => {
  assert.match(fontsCss, /font-family: 'Inter'/);
  assert.match(fontsCss, /font-weight: 300 900/);
  assert.match(fontsCss, /url\('\.\/fonts\/Inter-latin\.woff2'\)/);
  assert.match(fontsCss, /font-family: 'Noto Sans SC'/);
  assert.match(fontsCss, /url\('\.\/fonts\/NotoSansSC-ui\.woff2'\)/);
  assert.doesNotMatch(fontsCss, /https?:\/\//);
  assert.equal(interFont.subarray(0, 4).toString('ascii'), 'wOF2');
  assert.equal(notoFont.subarray(0, 4).toString('ascii'), 'wOF2');
  assert.ok(notoFont.length > 100000);
  assert.ok(interFont.length > 20000, 'Inter woff2 资源不能是空文件或错误响应');
});
