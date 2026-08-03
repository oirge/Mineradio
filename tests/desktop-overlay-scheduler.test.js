'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');

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

test('桌面覆盖层由独立调度器同步，不在每个渲染帧重复执行', () => {
  const animate = readFunction('animate');
  const scheduler = readFunction('scheduleDesktopOverlaySync');

  assert.doesNotMatch(animate, /syncDesktopOverlayState\s*\(/);
  assert.match(scheduler, /syncDesktopOverlayState\(\);/);
  assert.match(scheduler, /scheduleDesktopOverlaySync\(desktopOverlaySyncDelay\(\)\);/);
});
