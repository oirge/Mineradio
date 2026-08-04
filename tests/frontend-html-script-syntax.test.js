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
