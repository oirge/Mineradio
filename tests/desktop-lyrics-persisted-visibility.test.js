'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'main.js'), 'utf8');

function readFunction(name) {
  const match = new RegExp('(?:async )?function ' + name + '\\(').exec(source);
  assert.ok(match, 'missing ' + name);
  const end = source.indexOf('\n}', match.index);
  assert.ok(end > match.index, 'unterminated ' + name);
  return source.slice(match.index, end + 2);
}

function harness(initialBounds) {
  const area = { x: 0, y: 0, width: 1920, height: 1080 };
  const writes = [];
  let currentBounds = { ...initialBounds };
  const context = {
    desktopLyricsUserBounds: null,
    desktopLyricsSavedBoundsSignature: '',
    desktopLyricsProgrammaticMove: false,
    desktopLyricsStateCache: { value: { y: 0.76, clickThrough: false } },
    desktopLyricsWindow: {
      isDestroyed: () => false,
      getBounds: () => ({ ...currentBounds }),
      setBounds: bounds => { currentBounds = { ...bounds }; },
    },
    screen: {
      getDisplayMatching: () => ({ bounds: area }),
      getPrimaryDisplay: () => ({ bounds: area }),
    },
    isCurrentDesktopLyricsWindowSender: () => true,
    sendDesktopLyricsWindowGeometry() {},
    writeDesktopShellSettings: patch => writes.push(JSON.parse(JSON.stringify(patch))),
  };
  vm.runInNewContext([
    'clampNumber',
    'boundsHasReachableArea',
    'desktopLyricsDefaultBounds',
    'desktopLyricsBoundsSignature',
    'desktopLyricsBoundsHasReachableArea',
    'constrainDesktopLyricsBounds',
    'savedDesktopLyricsBounds',
    'rememberDesktopLyricsBounds',
    'handleDesktopLyricsMoveBy',
  ].map(readFunction).join('\n'), context);
  return { context, writes, area, bounds: () => currentBounds };
}

// .wrap uses align-items:center / justify-content:center; a visible transparent
// corner is not evidence that the centered lyric can be reached by the user.
function assertLyricAnchorOnDisplay(bounds, area) {
  const x = bounds.x + bounds.width / 2;
  const y = bounds.y + bounds.height / 2;
  assert.ok(x >= area.x && x <= area.x + area.width,
    'the lyric center must not remain outside the display horizontally');
  assert.ok(y >= area.y && y <= area.y + area.height,
    'the lyric center must not remain outside the display vertically');
}

test('restoring lyrics rejects an on-screen transparent bottom strip with text above the display', () => {
  const saved = { x: 323, y: -280, width: 1382, height: 410 };
  const h = harness(saved);
  const restored = h.context.savedDesktopLyricsBounds(saved);
  assertLyricAnchorOnDisplay(restored, h.area);
});

test('restoring lyrics rejects an on-screen transparent side strip with centered text off-screen', () => {
  const saved = { x: -1200, y: 300, width: 1382, height: 410 };
  const h = harness(saved);
  const restored = h.context.savedDesktopLyricsBounds(saved);
  assertLyricAnchorOnDisplay(restored, h.area);
});

test('unlocked dragging corrects the actual window as well as the bounds restored on restart', async () => {
  const h = harness({ x: 323, y: 180, width: 1382, height: 410 });
  for (let i = 0; i < 3; i += 1) {
    const result = await h.context.handleDesktopLyricsMoveBy({}, 0, -160);
    assert.equal(result.ok, true);
  }
  assertLyricAnchorOnDisplay(h.bounds(), h.area);
  assert.ok(h.writes.length > 0, 'user movement must still persist');
  const saved = h.writes.at(-1).desktopLyricsBounds;
  assertLyricAnchorOnDisplay(h.context.savedDesktopLyricsBounds(saved), h.area);
});

test('restoring a partially off-screen window preserves a reachable lyric position', () => {
  const saved = { x: 323, y: -171, width: 1382, height: 410 };
  const h = harness(saved);
  const restored = h.context.savedDesktopLyricsBounds(saved);
  assert.deepEqual(JSON.parse(JSON.stringify(restored)), saved);
});

test('unlocked lyrics can cross adjacent displays slowly without snapping away from the seam', async () => {
  for (const vertical of [false, true]) {
    const start = vertical
      ? { x: 323, y: 860, width: 1382, height: 410 }
      : { x: 1210, y: 180, width: 1382, height: 410 };
    const h = harness(start);
    const second = { ...h.area, x: vertical ? 0 : 1920, y: vertical ? 1080 : 0 };
    h.context.screen.getDisplayMatching = bounds => {
      const center = vertical ? bounds.y + bounds.height / 2 : bounds.x + bounds.width / 2;
      return { bounds: center >= (vertical ? 1080 : 1920) ? second : h.area };
    };
    for (let i = 1; i <= 20; i++) {
      await h.context.handleDesktopLyricsMoveBy({}, vertical ? 0 : 2, vertical ? 2 : 0);
      assert.equal(h.bounds().x, start.x + (vertical ? 0 : i * 2));
      assert.equal(h.bounds().y, start.y + (vertical ? i * 2 : 0));
    }
  }
});

test('lyric center on a smaller adjacent display is reachable even when most window area is on the other display', () => {
  const saved = { x: 1230, y: 505, width: 1382, height: 410 };
  const h = harness(saved);
  const second = { x: 1920, y: 0, width: 1280, height: 720 };
  h.context.screen.getAllDisplays = () => [{ bounds: h.area }, { bounds: second }];
  assert.deepEqual(JSON.parse(JSON.stringify(h.context.savedDesktopLyricsBounds(saved))), saved);
});
