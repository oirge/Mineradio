'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'main.js'), 'utf8');

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

test('desktop lyrics geometry reports physical top and bottom clipping', () => {
  const context = {
    desktopLyricsWindow: {
      isDestroyed: () => false,
      getBounds: () => ({ x: 100, y: -40, width: 920, height: 190 }),
    },
    screen: {
      getDisplayMatching: () => ({ bounds: { x: 0, y: 0, width: 1920, height: 1080 } }),
    },
  };
  vm.runInNewContext(`${readFunction('desktopLyricsWindowGeometry')}\nresult = desktopLyricsWindowGeometry();`, context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.result)), {
    windowY: -40,
    screenTop: 0,
    topInset: 40,
    bottomInset: 0,
  });
});

test('desktop lyrics geometry IPC is lightweight and signature deduplicated', () => {
  const sends = [];
  const context = {
    desktopLyricsWindowGeometrySignature: '',
    desktopLyricsWindow: {
      isDestroyed: () => false,
      getBounds: () => ({ x: 100, y: -40, width: 920, height: 190 }),
      webContents: { send: (channel, payload) => sends.push({ channel, payload }) },
    },
    screen: {
      getDisplayMatching: () => ({ bounds: { x: 0, y: 0, width: 1920, height: 1080 } }),
    },
  };
  vm.runInNewContext(
    `${readFunction('desktopLyricsWindowGeometry')}\n${readFunction('sendDesktopLyricsWindowGeometry')}\n` +
      'sendDesktopLyricsWindowGeometry(); sendDesktopLyricsWindowGeometry();',
    context,
  );
  assert.equal(sends.length, 1);
  assert.equal(sends[0].channel, 'mineradio-desktop-lyrics-window-geometry');
  assert.deepEqual(JSON.parse(JSON.stringify(sends[0].payload)), { windowY: -40, screenTop: 0, topInset: 40, bottomInset: 0 });
  assert.equal(Object.prototype.hasOwnProperty.call(sends[0].payload, 'beatMap'), false);
});

test('desktop lyrics renderer subscribes to physical window geometry', () => {
  const overlay = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'overlay-preload.js'), 'utf8');
  const renderer = fs.readFileSync(path.join(__dirname, '..', 'public', 'desktop-lyrics.html'), 'utf8');
  assert.match(overlay, /onLyricsWindowGeometry/);
  assert.match(renderer, /desktopLyricsWindowTopInset/);
  assert.match(renderer, /desktopLyricsWindowBottomInset/);
  assert.match(renderer, /onLyricsWindowGeometry\(function\(payload\)/);
});
