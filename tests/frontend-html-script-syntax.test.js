'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const publicDir = path.join(__dirname, '..', 'public');
const htmlFiles = [
  'index.html',
  'desktop-lyrics.html',
  'wallpaper.html',
  'mini-player.html',
  'mini-player-compact.html',
];

test('全部发布页面的内联脚本均可完整解析', () => {
  for (const fileName of htmlFiles) {
    const html = fs.readFileSync(path.join(publicDir, fileName), 'utf8');
    const scripts = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
    let match;
    let inlineIndex = 0;
    while ((match = scripts.exec(html))) {
      if (/\bsrc\s*=/.test(match[1])) continue;
      const script = match[2];
      if (!script.trim()) continue;
      inlineIndex += 1;
      assert.doesNotThrow(
        () => new vm.Script(script, { filename: `${fileName}:inline-${inlineIndex}` }),
        `${fileName} 的第 ${inlineIndex} 个内联脚本必须可解析`,
      );
    }
    assert.ok(inlineIndex > 0, `${fileName} 应至少包含一个内联脚本`);
  }
});

test('主窗口 vendor 脚本位于 body 末尾且先于 app.js，head 不再被阻塞', () => {
  const html = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
  const head = /<head>([\s\S]*?)<\/head>/.exec(html);
  assert.ok(head, 'index.html 必须有 head');
  assert.doesNotMatch(head[1], /<script[^>]*\bsrc=/, 'head 不允许出现外链脚本阻塞首帧解析');
  const threeAt = html.indexOf('<script src="vendor/three.r128.min.js"></script>');
  const gsapAt = html.indexOf('<script src="vendor/gsap.min.js"></script>');
  const appAt = html.indexOf('<script src="app.js"></script>');
  const bodyAt = html.indexOf('<body>');
  assert.ok(threeAt >= 0, '必须保留 three.js 外链脚本');
  assert.ok(gsapAt > threeAt, 'gsap 必须在 three.js 之后');
  assert.ok(threeAt > bodyAt, 'three.js 必须在 body 内（body 末尾），不阻塞解析');
  assert.ok(appAt > gsapAt, 'app.js 顶层就实例化 THREE 场景，必须晚于 vendor 求值');
});
