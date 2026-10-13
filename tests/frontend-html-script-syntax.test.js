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

test('主窗口在 head 同步恢复首帧配色与主题，vendor 脚本仍位于 body 末尾', () => {
  const html = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
  const head = /<head>([\s\S]*?)<\/head>/.exec(html);
  assert.ok(head, 'index.html 必须有 head');
  const earlyScripts = Array.from(head[1].matchAll(/<script\b[^>]*\bsrc\s*=[^>]*>[\s\S]*?<\/script>/gi), match => match[0]);
  assert.deepEqual(earlyScripts, [
    '<script src="startup-theme-colors.js"></script>',
    '<script src="plugin-manifest.js"></script>',
    '<script src="startup-plugin-theme.js"></script>',
  ], 'head 只允许首帧脚本与共用纯清洗器，不能提前加载主渲染器或 vendor');
  assert.ok(head[1].indexOf(earlyScripts[0]) < head[1].indexOf('href="app.css"'), '首帧配色必须早于主样式表同步恢复');
  const startupColors = fs.readFileSync(path.join(publicDir, 'startup-theme-colors.js'), 'utf8');
  assert.ok(startupColors.length < 2400, '首帧脚本不能膨胀为主渲染器');
  assert.doesNotThrow(() => new vm.Script(startupColors, { filename: 'startup-theme-colors.js' }));
  const startupTheme = fs.readFileSync(path.join(publicDir, 'startup-plugin-theme.js'), 'utf8');
  assert.ok(startupTheme.length < 2000, '主题预加载不能膨胀为插件运行时');
  assert.doesNotThrow(() => new vm.Script(startupTheme, { filename: 'startup-plugin-theme.js' }));
  assert.ok(head[1].indexOf(earlyScripts[2]) > head[1].indexOf('href="folia-host.css"'), '主题样式必须位于全部宿主样式之后');
  assert.equal((html.match(/src="plugin-manifest.js"/g) || []).length, 1, '共用清洗器不能加载两遍');
  const threeAt = html.indexOf('<script src="vendor/three.r128.min.js"></script>');
  const gsapAt = html.indexOf('<script src="vendor/gsap.min.js"></script>');
  const appAt = html.indexOf('<script src="app.js"></script>');
  const bodyAt = html.search(/<body\b[^>]*>/i);
  assert.ok(bodyAt >= 0, 'index.html 必须有 body');
  assert.ok(threeAt >= 0, '必须保留 three.js 外链脚本');
  assert.ok(gsapAt > threeAt, 'gsap 必须在 three.js 之后');
  assert.ok(threeAt > bodyAt, 'three.js 必须在 body 内（body 末尾），不阻塞解析');
  assert.ok(appAt > gsapAt, 'app.js 顶层就实例化 THREE 场景，必须晚于 vendor 求值');
});
