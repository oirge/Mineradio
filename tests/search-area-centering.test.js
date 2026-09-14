'use strict';
// 搜索框宽度不随歌单架样式改变，导入按钮不参与居中布局。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.css'), 'utf8');

test('search-area 仍以自身中线居中（居中的是整行，不是搜索框单独居中）', () => {
  const base = /^#search-area\{([^}]*)\}/m.exec(css);
  assert.ok(base, '#search-area 基础规则必须存在');
  assert.match(base[1], /left:50%/, '搜索行必须以 left:50% 定位');
  assert.match(
    base[1],
    /transform:translateX\(calc\(-50% \+ var\(--search-offset\)\)\)/,
    '搜索行必须整体居中并保留 --search-offset 偏移通道',
  );
});

test('导入按钮必须脱离居中队列，否则会把搜索框顶离中线', () => {
  const actions = /^#upload-actions\{([^}]*)\}/m.exec(css);
  assert.ok(actions, '#upload-actions 基础规则必须存在');
  assert.match(
    actions[1],
    /position:absolute/,
    '#upload-actions 必须绝对定位：留在流内会被当成居中整体的一部分，把搜索框推偏',
  );
  assert.match(
    actions[1],
    /left:100%/,
    '#upload-actions 应贴在搜索框那一叠的右缘',
  );
  assert.doesNotMatch(
    actions[1],
    /position:relative/,
    'position:relative 会让按钮重新参与流式居中（历史回归点）',
  );
});

test('窄屏导入按钮移到搜索框下方，不挤偏搜索框或溢出右边界', () => {
  assert.match(css, /@media \(max-width:720px\)\{#upload-actions\{left:auto;right:0;top:100%;margin-left:0;margin-top:8px\}\}/);
});

test('舞台与普通样式共用搜索宽度，简约模式及预加载保持填满容器', () => {
  assert.doesNotMatch(css, /#search-area\.stage-mode[^{}]*\{[^}]*width:/);
  assert.match(css, /#search-stack\{position:relative;width:min\(520px,58vw\)\}/);
  assert.match(css, /html\.simple-mode-preload #search-stack,\s*body\.simple-mode #search-stack\{width:100%\}/);
});

test('app.css 花括号配平（少一个 } 会让后续规则被静默吞掉）', () => {
  let depth = 0;
  for (const ch of css) {
    if (ch === '{') depth += 1;
    else if (ch === '}') depth -= 1;
    assert.ok(depth >= 0, '出现多余的收尾花括号');
  }
  assert.equal(depth, 0, '花括号必须配平');
});
