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

function positionHint(lineRect, innerHeight = 300) {
  const classChanges = [];
  const context = {
    innerHeight,
    classChanges,
    stage: {
      offsetHeight: 200,
      getBoundingClientRect: () => ({ top: 0, height: 200 }),
      classList: { toggle: (name, value) => classChanges.push({ name, value }) },
    },
    lockHint: { offsetHeight: 30, style: {} },
    line: { getBoundingClientRect: () => lineRect },
    lyricViewport: {},
    lyricScroller: { getBoundingClientRect: () => lineRect },
  };
  vm.runInNewContext(`${readFunction('positionInteractionHint')}
    result = (function(){ positionInteractionHint(); return { top: lockHint.style.top, classChanges: classChanges }; })();`, context);
  return context.result;
}

test('歌词提示在顶部放不下时自动移动到歌词下方', () => {
  const result = positionHint({ top: 20, bottom: 70, height: 50 });
  assert.equal(result.top, '78px');
  assert.deepEqual(result.classChanges, [{ name: 'hint-below', value: true }]);
});

test('歌词提示上方有空间时保持原来的上方位置', () => {
  const result = positionHint({ top: 160, bottom: 210, height: 50 });
  assert.equal(result.top, '122px');
  assert.deepEqual(result.classChanges, [{ name: 'hint-below', value: false }]);
});
