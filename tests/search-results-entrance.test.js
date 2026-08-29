'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.css'), 'utf8');

test('搜索结果面板默认保持隐藏，展示仍由 display 硬切承载', () => {
  const base = /#search-results\{[^}]*display:none\}/.exec(css);
  assert.ok(base, '#search-results 基础规则必须保留 display:none');
  assert.match(base[0], /backdrop-filter:blur\(40px\) saturate\(1\.4\)/, '玻璃模糊滤镜不得被入场动画改动');
});

test('搜索结果面板打开时必须带入场动画，不再是生硬的 display 硬切', () => {
  const showRule = /#search-results\.show\{[^}]*\}/.exec(css);
  assert.ok(showRule, '#search-results.show 规则必须存在');
  assert.match(
    showRule[0],
    /animation:search-results-in \.26s cubic-bezier\(\.2,\.7,\.2,1\) both/,
    '.show 必须挂 search-results-in 入场动画（260ms，与搜索区下滑同一曲线族）',
  );
  const keyframes = /@keyframes search-results-in\{from\{([^}]*)\}to\{([^}]*)\}\}/.exec(css);
  assert.ok(keyframes, '必须定义 search-results-in 关键帧');
  assert.match(keyframes[1], /opacity:0/);
  assert.match(keyframes[1], /translateY\(-8px\)/);
  assert.match(keyframes[2], /opacity:1/);
  assert.match(keyframes[2], /transform:none/);
});

test('入场动画只走 transform/opacity 合成器属性，降低动效偏好下必须跳过', () => {
  const keyframes = /@keyframes search-results-in\{([^}]*)\}/.exec(css);
  assert.ok(keyframes, '关键帧必须存在');
  assert.doesNotMatch(keyframes[1], /\b(top|left|width|height|margin|padding)\b/, '关键帧不得动画布局属性');
  assert.match(
    css,
    /@media \(prefers-reduced-motion:reduce\)\{#search-results\.show\{animation:none\}\}/,
    'prefers-reduced-motion: reduce 下必须直接跳过入场动画',
  );
});
