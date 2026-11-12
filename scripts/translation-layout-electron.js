'use strict';

// This visible native window belongs exclusively to a disposable Windows CI profile.
if (process.env.GITHUB_ACTIONS !== 'true' || process.platform !== 'win32') throw new Error('Native layout acceptance is restricted to Windows CI');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { app, BrowserWindow, screen } = require('electron');
const fail = error => { console.error(error && error.stack || String(error)); app.exit(1); };
process.on('uncaughtException', fail);
process.on('unhandledRejection', fail);
const profile = fs.realpathSync(process.env.MINERADIO_LAYOUT_PROFILE);
// Windows can return a long profile path and an 8.3 TEMP alias for the same directory.
const parent = fs.statSync(path.dirname(profile)), temporary = fs.statSync(os.tmpdir());
assert.ok(parent.isDirectory() && temporary.isDirectory());
assert.equal(parent.dev, temporary.dev);
assert.equal(parent.ino, temporary.ino);
assert.ok(path.basename(profile).startsWith('mineradio-native-layout-'));
const port = Number(process.env.MINERADIO_LAYOUT_DEBUG_PORT);
assert.ok(Number.isInteger(port) && port > 1024 && port < 65536);
app.setName('Mineradio layout CI');
app.setPath('userData', profile);
app.setPath('sessionData', path.join(profile, 'session'));
app.commandLine.appendSwitch('remote-debugging-address', '127.0.0.1');
app.commandLine.appendSwitch('remote-debugging-port', String(port));
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('use-angle', 'swiftshader');
app.commandLine.appendSwitch('enable-unsafe-swiftshader');
const watchdog = setTimeout(() => app.exit(1), 240000);
watchdog.unref();
app.on('window-all-closed', () => app.quit());
app.whenReady().then(async () => {
  const display = screen.getPrimaryDisplay();
  const win = new BrowserWindow({ x: display.workArea.x, y: display.workArea.y,
    width: 1387, height: 780,
    frame: false, transparent: true, backgroundColor: '#00000000', show: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
  const out = path.join(__dirname, '../artifacts/ui-language/translation-layout');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'native-window.json'), JSON.stringify({ electron: process.versions.electron,
    chromium: process.versions.chrome, bounds: win.getBounds(), scaleFactor: display.scaleFactor,
    zoomFactor: win.webContents.getZoomFactor(), transparent: true, isolatedProfile: true }, null, 2));
  await win.loadURL('data:text/html,<title>Mineradio layout CI</title>');
});
