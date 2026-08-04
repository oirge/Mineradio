'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'desktop-lyrics.html'), 'utf8');

function readFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `missing ${name}`);
  const braceStart = source.indexOf('{', start);
  let depth = 0;
  for (let i = braceStart; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`unterminated ${name}`);
}

test('桌面歌词重复 IPC 复用已归一化文本', () => {
  const context = {
    normalizedDesktopTextSource: null,
    normalizedDesktopTextRows: '',
    normalizedDesktopTextValue: 'Mineradio',
  };
  vm.runInNewContext(
    `${readFunction('normalizeRows')}\n${readFunction('normalizeDesktopStateText')}\n`
      + `first = normalizeDesktopStateText('  第一行  \\r\\n\\n 第二\\t行 \\n第三行', 'double');\n`
      + `cached = normalizeDesktopStateText('  第一行  \\r\\n\\n 第二\\t行 \\n第三行', 'double');\n`
      + `single = normalizeDesktopStateText('  第一行  \\r\\n\\n 第二\\t行 \\n第三行', 'single');`,
    context,
  );
  assert.equal(context.first, '第一行\n第二 行');
  assert.equal(context.cached, context.first);
  assert.equal(context.single, '第一行');
  assert.match(source, /source === normalizedDesktopTextSource && mode === normalizedDesktopTextRows/);
  assert.doesNotMatch(readFunction('normalizeDesktopStateText'), /\.map\(|\.filter\(|\.slice\(0,/);
});

test('桌面歌词字形与宽度缓存避免每帧重建字符数组', () => {
  const draws = [];
  let measures = 0;
  const context = {
    state: { fontWeight: 900, fontFamily: 'Inter' },
    glyphWidthCache: Object.create(null),
    glyphWidthCacheKeys: [],
    ctx: {
      textAlign: 'center',
      measureText(glyph) {
        measures += 1;
        return { width: glyph === '😀' ? 20 : 10 };
      },
      fillText(glyph, x, y) { draws.push(['fill', glyph, x, y]); },
      strokeText(glyph, x, y) { draws.push(['stroke', glyph, x, y]); },
    },
  };
  vm.runInNewContext(
    `${readFunction('canvasTextGlyphs')}\n${readFunction('drawCanvasText')}\n`
      + `drawCanvasText('A😀B', 100, 20, 58, 2, false);\n`
      + `drawCanvasText('A😀B', 100, 20, 58, 2, true);\n`
      + `drawCanvasText('普通文本', 100, 20, 58, 0, false);`,
    context,
  );
  assert.equal(measures, 3, '同一文本的第二次绘制不得重新测量字形');
  assert.deepEqual(
    draws.slice(0, 6).map((row) => row.slice(0, 2)),
    [
      ['fill', 'A'], ['fill', '😀'], ['fill', 'B'],
      ['stroke', 'A'], ['stroke', '😀'], ['stroke', 'B'],
    ],
  );
  assert.deepEqual(Array.from(context.glyphWidthCacheKeys), ['A😀B|58|900|Inter|2.00']);
  assert.deepEqual(Array.from(context.glyphWidthCache[context.glyphWidthCacheKeys[0]].glyphs), ['A', '😀', 'B']);
  assert.doesNotMatch(readFunction('drawCanvasText'), /Array\.from/);
});
