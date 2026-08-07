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

test('desktop lyric interaction padding shrinks with the rendered font size', () => {
  const textRect = { left: 400, top: 150, right: 424, bottom: 164, width: 24, height: 14 };
  const viewportRect = { left: 80, top: 70, right: 840, bottom: 270, width: 760, height: 200 };
  const small = interactionBounds(textRect, viewportRect, 12);
  const regular = interactionBounds(textRect, viewportRect, 58);
  assert.deepEqual({ ...small }, { left: 397, top: 148, right: 427, bottom: 166 });
  assert.deepEqual({ ...regular }, { left: 387, top: 142, right: 437, bottom: 172 });
  assert.ok(small.right - small.left < regular.right - regular.left);
  assert.ok(small.bottom - small.top < regular.bottom - regular.top);
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
  const mainRenderer = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  assert.match(preload, /mineradio-desktop-lyrics-size-request/);
  const start = mainRenderer.indexOf('api.onDesktopLyricsSizeRequest(function(payload)');
  const end = mainRenderer.indexOf('\n  }\n\n  api.onStateChange', start);
  assert.ok(start >= 0 && end > start, 'missing desktop lyric size persistence listener');
  const listener = mainRenderer.slice(start, end);
  assert.match(listener, /fx\.desktopLyricsSize = nextSize;/);
  assert.match(listener, /saveLyricLayout\(\);/);
  assert.match(listener, /pushDesktopLyricsState\(false\);/);
});

function runLyricsWheel({ locked = false, dragging = false, inside = true, deltaY = -100 } = {}) {
  const calls = { deltas: [], hint: [], prevented: 0, stopped: 0 };
  const context = {
    DESKTOP_LYRICS_SIZE_STEP: 0.05,
    dragging,
    isFinite,
    isLocked: () => locked,
    lastSizeWheelAt: 0,
    performance: { now: () => 1000 },
    pointInStage: () => inside,
    requestLyricsSize: (delta) => calls.deltas.push(delta),
    setHintVisible: (visible) => calls.hint.push(visible),
    evt: {
      deltaY,
      preventDefault: () => { calls.prevented += 1; },
      stopPropagation: () => { calls.stopped += 1; },
    },
  };
  vm.runInNewContext(`${readFunction('handleLyricsWheel')}\nresult = handleLyricsWheel(evt);`, context);
  return { calls, result: context.result };
}

test('desktop lyric wheel resizes only the unlocked visible interaction region', () => {
  const enlarge = runLyricsWheel({ deltaY: -100 });
  assert.equal(enlarge.result, true);
  assert.deepEqual(enlarge.calls.deltas, [0.05]);
  assert.deepEqual(enlarge.calls.hint, [true]);
  assert.equal(enlarge.calls.prevented, 1);
  assert.equal(enlarge.calls.stopped, 1);

  const shrink = runLyricsWheel({ deltaY: 100 });
  assert.deepEqual(shrink.calls.deltas, [-0.05]);

  const locked = runLyricsWheel({ locked: true });
  assert.equal(locked.result, false);
  assert.deepEqual(locked.calls.deltas, []);
  assert.equal(locked.calls.prevented, 0);

  const transparentBlank = runLyricsWheel({ inside: false });
  assert.equal(transparentBlank.result, false);
  assert.deepEqual(transparentBlank.calls.deltas, []);
  assert.equal(transparentBlank.calls.prevented, 0);

  assert.match(source, /window\.addEventListener\('wheel', handleLyricsWheel, \{ passive:false \}\);/);
});

test('desktop lyric size minimum is consistently lowered to 0.20', () => {
  const mainSource = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'main.js'), 'utf8');
  const mainRenderer = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  const mainMarkup = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  assert.match(source, /var DESKTOP_LYRICS_SIZE_MIN = \.20;/);
  assert.match(source, /var minSize = Math\.max\(8, Math\.min\(32, baseFontSize \* \.55\)\);/);
  assert.doesNotMatch(source, /Math\.max\(24, Math\.min\(32, baseFontSize \* \.55\)\)/);
  assert.match(mainSource, /const DESKTOP_LYRICS_SIZE_MIN = 0\.20;/);
  assert.match(mainRenderer, /var DESKTOP_LYRICS_SIZE_MIN = 0\.20;/);
  assert.match(mainMarkup, /id="fx-desktoplyricssize"[^>]*min="0\.20"/);
});

test('desktop lyric toolbar shows the current size percentage without changing hot bounds', () => {
  const syncSizeButtons = readFunction('syncSizeButtons');
  const sendHotBounds = readFunction('sendHotBounds');
  assert.match(source, /id="sizeValue" class="lyrics-size-value" aria-live="polite">100%<\/span>/);
  assert.match(source, /var sizeValue = document\.getElementById\('sizeValue'\);/);
  assert.match(source, /\.lyrics-size-value,.lyrics-glow-value\{[\s\S]*?min-width:38px;[\s\S]*?font-variant-numeric:tabular-nums;/);
  assert.match(syncSizeButtons, /sizeValue\.textContent = Math\.round\(size \* 100\) \+ '%';/);
  assert.match(sendHotBounds, /lyricInteractionBounds\(\)/);
  assert.doesNotMatch(sendHotBounds, /lockHint/);
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
