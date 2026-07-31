'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'desktop-lyrics.html'), 'utf8');

function readFunctionFrom(contents, name) {
  const start = contents.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `missing ${name}`);
  const braceStart = contents.indexOf('{', start);
  let depth = 0;
  for (let i = braceStart; i < contents.length; i += 1) {
    if (contents[i] === '{') depth += 1;
    if (contents[i] === '}') {
      depth -= 1;
      if (depth === 0) return contents.slice(start, i + 1);
    }
  }
  throw new Error(`unterminated ${name}`);
}

function readFunction(name) {
  return readFunctionFrom(source, name);
}

function clamp(value, min, max, fallback) {
  const number = Number(value);
  return Math.max(min, Math.min(max, Number.isFinite(number) ? number : fallback));
}

function interactionBounds(textRect, viewportRect, renderedFontSize = 58, scrollerRect = textRect) {
  const context = {
    renderedFontSize,
    clamp,
    lyricViewport: { getBoundingClientRect: () => viewportRect },
    lyricScroller: { getBoundingClientRect: () => scrollerRect },
    line: { getBoundingClientRect: () => textRect },
  };
  vm.runInNewContext(`${readFunction('lyricInteractionBounds')}\nresult = lyricInteractionBounds();`, context);
  return context.result;
}

test('desktop lyric interaction bounds hug short rendered text', () => {
  const bounds = interactionBounds(
    { left: 380, top: 142, right: 540, bottom: 202, width: 160, height: 60 },
    { left: 80, top: 70, right: 840, bottom: 270, width: 760, height: 200 },
  );
  assert.ok(bounds.left >= 360 && bounds.right <= 560);
  assert.ok(bounds.top >= 130 && bounds.bottom <= 214);
  assert.ok(bounds.right - bounds.left < 220);
});

test('desktop lyric interaction bounds clip scrolling text to the visible viewport', () => {
  const bounds = interactionBounds(
    { left: -260, top: 138, right: 1180, bottom: 210, width: 1440, height: 72 },
    { left: 90, top: 72, right: 830, bottom: 272, width: 740, height: 200 },
    72,
  );
  assert.deepEqual({ ...bounds }, { left: 90, top: 129, right: 830, bottom: 219 });
});

test('desktop lyric interaction bounds follow the animated line instead of its static scroller', () => {
  const bounds = interactionBounds(
    { left: 410, top: 168, right: 570, bottom: 218, width: 160, height: 50 },
    { left: 80, top: 70, right: 840, bottom: 270, width: 760, height: 200 },
    58,
    { left: 320, top: 130, right: 640, bottom: 220, width: 320, height: 90 },
  );
  assert.ok(bounds.left >= 390 && bounds.right <= 590);
  assert.ok(bounds.top >= 150 && bounds.bottom <= 230);
});

test('drag hit testing no longer falls back to the padded stage rectangle', () => {
  const pointInStage = readFunction('pointInStage');
  const sendHotBounds = readFunction('sendHotBounds');
  assert.doesNotMatch(pointInStage, /stage\.getBoundingClientRect/);
  assert.match(pointInStage, /pointInLyric\(evt\)/);
  assert.match(sendHotBounds, /lyricInteractionBounds\(\)/);
  const pointerDownStart = source.indexOf("window.addEventListener('pointerdown'");
  const pointerDownEnd = source.indexOf("window.addEventListener('pointerup'", pointerDownStart);
  const pointerDown = source.slice(pointerDownStart, pointerDownEnd);
  assert.match(pointerDown, /if \(!pointInLyric\(evt\)\) return;/);
  assert.doesNotMatch(pointerDown, /pointInStage\(evt\)/);
});

test('desktop lyric hot bounds are sampled after the current scroll transform', () => {
  const draw = readFunction('draw');
  const scrollUpdate = draw.indexOf('updateLyricScroll(nowMs, progress);');
  const hotBoundsUpdate = draw.indexOf('sendHotBounds(false);');
  assert.ok(scrollUpdate >= 0 && hotBoundsUpdate > scrollUpdate);
});

test('desktop lyric size requests persist through the main renderer settings source', () => {
  const preload = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'preload.js'), 'utf8');
  const mainRenderer = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  assert.match(preload, /mineradio-desktop-lyrics-size-request/);
  const start = mainRenderer.indexOf('api.onDesktopLyricsSizeRequest(function(payload)');
  const end = mainRenderer.indexOf('\n  }\n\n  api.onStateChange', start);
  assert.ok(start >= 0 && end > start, 'missing desktop lyric size persistence listener');
  const listener = mainRenderer.slice(start, end);
  assert.match(listener, /fx\.desktopLyricsSize = nextSize;/);
  assert.match(listener, /saveLyricLayout\(\);/);
  assert.match(listener, /pushDesktopLyricsState\(false\);/);
});

test('missing desktop lyric hot bounds never fall back to the transparent window', () => {
  const mainSource = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'main.js'), 'utf8');
  const context = {
    desktopLyricsWindow: {
      isDestroyed: () => false,
      getBounds: () => ({ x: 100, y: 200, width: 900, height: 340 }),
    },
    desktopLyricsHotBounds: null,
  };
  vm.runInNewContext(`${readFunctionFrom(mainSource, 'desktopLyricsHotBoundsOnScreen')}\nresult = desktopLyricsHotBoundsOnScreen();`, context);
  assert.equal(context.result, null);
  const releaseOwned = readFunctionFrom(mainSource, 'releaseOwnedDesktopLyricsWindow');
  assert.match(releaseOwned, /desktopLyricsHotBounds = null;/);
  assert.match(mainSource, /win\.webContents\.on\('did-start-loading', resetOwnedDesktopLyricsHotBounds\);/);
});
