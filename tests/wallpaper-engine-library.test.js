'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  WallpaperEngineLibrary,
  parseByteRange,
  analyzeSceneProperties,
} = require('../desktop/wallpaper-engine-library');

const root = path.join(__dirname, '..');

function writeProject(dir, name, manifest, files) {
  const projectDir = path.join(dir, name);
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'project.json'), JSON.stringify(manifest), 'utf8');
  Object.entries(files || {}).forEach(([file, content]) => {
    const target = path.join(projectDir, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  });
  return projectDir;
}

test('Wallpaper Engine 字节范围解析保持闭合区间', () => {
  assert.deepEqual(parseByteRange('bytes=0-9', 36), { start: 0, end: 9 });
  assert.deepEqual(parseByteRange('bytes=-10', 36), { start: 26, end: 35 });
  assert.equal(parseByteRange('bytes=40-50', 36).invalid, true);
});

test('Wallpaper Engine Scene 音频属性会被识别并静音', () => {
  const analyzed = analyzeSceneProperties({
    general: {
      properties: {
        dbVolume: { type: 'slider', min: -60, max: 0, value: -6 },
        muteAudio: { type: 'bool', value: false },
        music: { text: 'Music', type: 'combo', value: '1', options: [{ label: 'None', value: '0' }, { label: 'Track', value: '1' }] },
        audio: { text: 'Audio visualizer', type: 'bool', value: true },
      },
    },
  });
  assert.ok(analyzed.audioPropertyCount >= 2);
  assert.equal(analyzed.muteProperties.volume, 0);
  assert.equal(analyzed.muteProperties.dbVolume, -60);
  assert.equal(analyzed.muteProperties.muteAudio, true);
});

test('Wallpaper Engine 库只索引 project.json 并区分 Video / Scene', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mineradio-we-'));
  const libraryRoot = path.join(temp, 'library');
  const userData = path.join(temp, 'user-data');
  fs.mkdirSync(libraryRoot, { recursive: true });
  writeProject(libraryRoot, 'video-project', {
    title: 'Video Fixture',
    type: 'video',
    file: 'wallpaper.mp4',
    preview: 'preview.jpg',
  }, {
    'wallpaper.mp4': Buffer.from('0123456789abcdefghijklmnopqrstuvwxyz'),
    'preview.jpg': Buffer.alloc(48, 0xff),
  });
  writeProject(libraryRoot, 'scene-project', {
    title: 'Scene Fixture',
    type: 'scene',
    workshopid: '1234567890',
    file: 'scene.json',
    preview: 'preview.gif',
  }, {
    'scene.pkg': Buffer.concat([Buffer.from([8, 0, 0, 0]), Buffer.from('PKGV0002', 'ascii'), Buffer.alloc(20, 1)]),
    'preview.gif': Buffer.from('GIF89a-fixture'),
  });

  const library = new WallpaperEngineLibrary({
    userDataPath: userData,
    autoDiscover: false,
  });
  const snapshot = await library.addManualRoot(libraryRoot);
  assert.equal(snapshot.ok, true);
  assert.equal(snapshot.count, 2);
  const video = snapshot.projects.find((item) => item.title === 'Video Fixture');
  const scene = snapshot.projects.find((item) => item.title === 'Scene Fixture');
  assert.ok(video);
  assert.ok(scene);
  assert.equal(video.playable, true);
  assert.equal(video.mediaType, 'video');
  assert.equal(scene.enginePlayable, true);
  assert.equal(scene.projectType, 'scene');
  if (typeof library.dispose === 'function') library.dispose();
});

test('桌面壳与主界面接入 Wallpaper Engine 入口', () => {
  const mainSource = fs.readFileSync(path.join(root, 'desktop', 'main.js'), 'utf8');
  const preloadSource = fs.readFileSync(path.join(root, 'desktop', 'preload.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
  const renderer = fs.readFileSync(path.join(root, 'public', 'wallpaper-engine.js'), 'utf8');
  assert.match(mainSource, /createWallpaperEngineBridge/);
  assert.match(mainSource, /registerWallpaperEngineScheme\(protocol\)/);
  assert.match(fs.readFileSync(path.join(root, 'desktop', 'wallpaper-engine-bridge.js'), 'utf8'), /registerScheme:\s*registerWallpaperEngineScheme/);
  assert.match(mainSource, /wallpaperEngineBridge\.installProtocol\(protocol\)/);
  assert.match(mainSource, /wallpaperEngineBridge\.attachWindow\(mainWindow\)/);
  assert.match(preloadSource, /listWallpaperEngineProjects/);
  assert.match(preloadSource, /startWallpaperEngineScene/);
  assert.match(preloadSource, /onWallpaperEngineHostBoundsChanged/);
  assert.match(html, /id="wallpaper-engine-layer"/);
  assert.match(html, /id="wallpaper-engine-modal"/);
  assert.match(html, /id="wallpaper-engine-toggle-btn"/);
  assert.match(html, /wallpaper-engine\.js/);
  assert.match(html, /wallpaper-engine\.css/);
  assert.match(renderer, /function applyWallpaperEngineBackground/);
  assert.match(renderer, /WALLPAPER_ENGINE_ENABLED_STORE_KEY/);
  assert.match(renderer, /raw === '1' \|\| raw === 'true'/);
  assert.match(renderer, /function toggleWallpaperEngineBackground/);
  assert.match(renderer, /wallpaperEngineLibraryLoadPromise/);
  assert.match(renderer, /if \(wallpaperEngineLibraryBusy\) return wallpaperEngineLibraryLoadPromise/);
  assert.match(renderer, /toggle\.disabled = !wallpaperEngineEnabled && wallpaperEngineLibraryBusy/);
  assert.match(renderer, /if \(wallpaperEngineLibraryBusy\) \{/);
  assert.match(renderer, /if \(!wallpaperEngineBackgroundActive\(\)\) return;/);
  assert.match(renderer, /function initializeWallpaperEngineLibrary/);
});
