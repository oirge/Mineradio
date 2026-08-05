'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const mainSource = fs.readFileSync(
  path.join(__dirname, '..', 'desktop', 'main.js'),
  'utf8',
);
const rendererSource = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'app.js'),
  'utf8',
);

function readFunction(name) {
  const start = mainSource.indexOf('function ' + name + '(');
  assert.ok(start >= 0, '未找到函数：' + name);
  const next = mainSource.indexOf('\nfunction ', start + 1);
  return mainSource.slice(start, next >= 0 ? next : mainSource.length);
}

test('desktop lyrics teardown does not overwrite the saved enabled preference', () => {
  const closeSource = readFunction('closeDesktopLyricsWindow');
  const overlayCloseSource = readFunction('closeOverlayWindows');

  assert.match(closeSource, /const broadcast = options\.broadcast !== false;/);
  assert.match(closeSource, /if \(broadcast\) broadcastDesktopLyricsEnabledState\(false\);/);
  assert.match(overlayCloseSource, /closeDesktopLyricsWindow\(\{ broadcast: false \}\);/);

  const enabledHandlerStart = mainSource.indexOf('async function handleDesktopLyricsEnabledState(');
  const enabledHandlerEnd = mainSource.indexOf("ipcMain.handle('mineradio-desktop-lyrics-set-enabled'", enabledHandlerStart);
  const enabledHandlerSource = mainSource.slice(enabledHandlerStart, enabledHandlerEnd);
  assert.match(enabledHandlerSource, /else \{\s*closeDesktopLyricsWindow\(\);\s*\}/);

  const restartHandlerStart = mainSource.indexOf("ipcMain.handle('mineradio-restart-app'");
  const restartHandlerEnd = mainSource.indexOf('\n});', restartHandlerStart) + 4;
  const restartHandlerSource = mainSource.slice(restartHandlerStart, restartHandlerEnd);
  assert.match(restartHandlerSource, /closeOverlayWindows\(\);[\s\S]*app\.relaunch\(\);[\s\S]*app\.exit\(0\);/);

  const restartRendererStart = rendererSource.indexOf('async function restartForAppliedPatch(');
  const restartRendererEnd = rendererSource.indexOf('\nasync function ', restartRendererStart + 1);
  const restartRendererSource = rendererSource.slice(restartRendererStart, restartRendererEnd);
  assert.match(restartRendererSource, /flushPersistentVisualState\(\);[\s\S]*await window\.desktopWindow\.restartApp\(\);/);
});

test('desktop lyrics user movement can force the final bounds to disk', () => {
  const writes = [];
  const context = {
    desktopLyricsWindow: {
      isDestroyed: () => false,
      getBounds: () => ({ x: 320, y: 180, width: 960, height: 240 }),
    },
    desktopLyricsProgrammaticMove: true,
    desktopLyricsUserBounds: null,
    desktopLyricsSavedBoundsSignature: '',
    constrainDesktopLyricsBounds: (bounds) => ({ ...bounds }),
    desktopLyricsBoundsSignature: (bounds) => [bounds.x, bounds.y, bounds.width, bounds.height].join('|'),
    writeDesktopShellSettings: (patch) => writes.push(patch),
  };

  vm.runInNewContext(
    readFunction('rememberDesktopLyricsBounds')
      + '\nthis.rememberDesktopLyricsBounds = rememberDesktopLyricsBounds;',
    context,
  );

  context.rememberDesktopLyricsBounds();
  assert.equal(writes.length, 0);

  context.rememberDesktopLyricsBounds({ force: true });
  assert.equal(writes.length, 1);
  assert.deepEqual(
    JSON.parse(JSON.stringify(writes[0].desktopLyricsBounds)),
    { x: 320, y: 180, width: 960, height: 240 },
  );

  const moveHandlerStart = mainSource.indexOf('async function handleDesktopLyricsMoveBy(');
  const moveHandlerEnd = mainSource.indexOf("ipcMain.handle('mineradio-desktop-lyrics-move-by'", moveHandlerStart);
  const moveHandlerSource = mainSource.slice(moveHandlerStart, moveHandlerEnd);
  assert.match(moveHandlerSource, /rememberDesktopLyricsBounds\(\{ force: true \}\);/);
  assert.match(readFunction('closeDesktopLyricsWindow'), /rememberDesktopLyricsBounds\(\{ force: true \}\);/);
});
