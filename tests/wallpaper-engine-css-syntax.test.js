'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

// Wallpaper Engine 壁纸库弹窗曾因 wallpaper-engine.css 缺一个右括号，
// 整段弹窗样式（.wallpaper-engine-library-modal / .wallpaper-engine-grid / .wallpaper-engine-card）
// 被 Chrome 的 CSS 嵌套吞进上一条永不匹配的规则里：弹窗退回 380px 窄窗、卡片失去
// 16/9 四列布局、预览图按原始尺寸渲染，用户看到「壁纸特别大、只能看见一张、不能滚动」。
// 这组测试从源码层面钉住：括号必须配平，弹窗关键规则必须是顶层规则。

function stripCssNoise(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map(line => line.replace(/(^|[^:])\/\/.*$/, '$1'))
    .join('\n');
}

function braceBalance(src) {
  let depth = 0;
  let minDepth = 0;
  let inStr = null;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (c === String.fromCharCode(92)) { i++; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'") { inStr = c; continue; }
    if (c === '{') depth++;
    if (c === '}') { depth--; if (depth < 0) minDepth = depth; }
  }
  return { balance: depth, minDepth };
}

// 按顶层深度切分规则，返回 { selector, body } 列表（不含 @media 等内部规则）。
function topLevelRules(src) {
  const rules = [];
  let depth = 0;
  let bodyStart = 0;
  let headerStart = 0;
  let inStr = null;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (c === String.fromCharCode(92)) { i++; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'") { inStr = c; continue; }
    if (c === '{') {
      if (depth === 0) { headerStart = bodyStart; bodyStart = i; }
      depth++;
      continue;
    }
    if (c === '}') {
      depth--;
      if (depth < 0) break;
      if (depth === 0) {
        rules.push({ header: src.slice(headerStart, bodyStart).trim(), body: src.slice(bodyStart + 1, i) });
        bodyStart = i + 1;
      }
    }
  }
  return rules;
}

test('wallpaper-engine.css 花括号配平（缺一个 } 会吞掉后面全部规则）', () => {
  const src = stripCssNoise(fs.readFileSync(path.join(ROOT, 'public', 'wallpaper-engine.css'), 'utf8'));
  const { balance, minDepth } = braceBalance(src);
  assert.equal(minDepth, 0, '不应出现多余的右括号');
  assert.equal(balance, 0, '花括号必须配平，实测差 ' + balance);
});

test('壁纸库弹窗关键选择器是 wallpaper-engine.css 的顶层规则', () => {
  const src = stripCssNoise(fs.readFileSync(path.join(ROOT, 'public', 'wallpaper-engine.css'), 'utf8'));
  const rules = topLevelRules(src);
  const selectors = rules.map(rule => rule.header);
  for (const required of [
    '.wallpaper-engine-library-modal',
    '.wallpaper-engine-grid',
    '.wallpaper-engine-card',
    '.wallpaper-engine-card-preview',
    '.wallpaper-engine-row',
  ]) {
    assert.ok(
      selectors.some(selector => selector.split(',').map(part => part.trim()).includes(required)),
      required + ' 必须是顶层规则（若被上一条规则吞成嵌套，样式将永不生效）'
    );
  }
});

test('弹窗布局约束仍在：网格可滚动、卡片四列 16/9、弹窗定高', () => {
  const src = stripCssNoise(fs.readFileSync(path.join(ROOT, 'public', 'wallpaper-engine.css'), 'utf8'));
  const rules = topLevelRules(src);
  const bodyOf = selector => {
    const rule = rules.find(item => item.header.split(',').map(part => part.trim()).includes(selector));
    return rule ? rule.body : '';
  };
  assert.match(bodyOf('.wallpaper-engine-grid'), /overflow:\s*auto/, '网格必须可滚动');
  assert.match(bodyOf('.wallpaper-engine-grid'), /flex-wrap:\s*wrap/, '网格必须换行铺卡');
  assert.match(bodyOf('.wallpaper-engine-card'), /flex:\s*0 0 calc\(\(100% - 39px\) \/ 4\)/, '卡片必须四列宽');
  assert.match(bodyOf('.wallpaper-engine-card'), /aspect-ratio:\s*16\/9/, '卡片必须 16/9 定比');
  assert.match(bodyOf('.wallpaper-engine-card-preview'), /object-fit:\s*cover/, '预览图必须裁切铺满，不得按原始尺寸渲染');
  assert.match(bodyOf('.wallpaper-engine-library-modal'), /height:\s*min\(820px,\s*88vh\)/, '弹窗必须定高，不得随内容撑开');
});
