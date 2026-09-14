'use strict';
// 搜索框居中回归：搜索框曾经在「舞台」歌单架模式下变短且明显偏左。
// 两个独立原因，都得钉住：
//   ① #search-area 是 flex + left:50%/translateX(-50%) 居中的，而流内的
//      #upload-actions（导入按钮）会跟着一起参与居中，于是「搜索框 + 12px + 按钮」
//      被当作一个整体居中，搜索框被顶到中线左边（按钮越宽偏得越多，出现自定义封面
//      的 × 按钮时还会再跳一下）。修法 = 按钮绝对定位挂到搜索框右缘（left:100%）。
//   ② 舞台模式只把 #search-stack 从 520px 收窄到 360px，容器没跟着收，收窄后
//      左对齐在容器里，在简约模式下容器宽度被钉死 620px，于是偏左整整 130px。
//      修法 = 简约模式舞台下把容器同步收窄。
// 结论来自真实 Electron 测量（1387px 视口）：两处修复后
// 「简约/DIY × 普通/舞台 × 有无封面按钮」六种组合的搜索框中心都落在视口中线上。
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

test('窄屏把导入按钮放回流内，维持并排换行', () => {
  assert.match(
    css,
    /@media \(max-width:720px\)\{#upload-actions\{position:static;left:auto;margin-left:0\}\}/,
    '窄屏必须把按钮恢复成静态布局，否则绝对定位会溢出视口',
  );
});

test('舞台模式搜索框收窄是设计，但收窄的必须是容器而不是只收窄栈', () => {
  assert.match(
    css,
    /#search-area\.stage-mode #search-stack\{width:min\(360px,52vw\)\}/,
    '舞台模式把搜索框收窄到 min(360px,52vw) 是设计行为，不许顺手删掉',
  );
  assert.match(
    css,
    /body\.simple-mode #search-area\.stage-mode\{width:min\(360px,52vw\)\}/,
    '简约模式容器宽度被钉死 620px，舞台下必须同步收窄，否则栈会左对齐偏 130px',
  );
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
