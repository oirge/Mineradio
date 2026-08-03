'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

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

function syncDelay(fps, wallpaperMode = false) {
  const context = {
    fx: { desktopLyrics: true, wallpaperMode },
    normalizeDesktopLyricsFps: value => Number(value) || 0,
    isHiddenForBackgroundOptimization: () => false,
    getRuntimeFramePressureLevel: () => 0,
  };
  context.fx.desktopLyricsFps = fps;
  vm.runInNewContext(`${readFunction('desktopLyricsPushInterval')}
${readFunction('desktopOverlaySyncDelay')}
result = desktopOverlaySyncDelay();`, context);
  return context.result;
}

test('桌面歌词外层同步间隔跟随 30 FPS，而不是固定 320ms', () => {
  assert.equal(syncDelay(30), 1000 / 30);
});

test('桌面歌词与壁纸同时启用时仍由歌词帧率主导', () => {
  assert.equal(syncDelay(60, true), 1000 / 60);
});
