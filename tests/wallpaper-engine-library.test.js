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

function makeLibrary(temp) {
  return new WallpaperEngineLibrary({
    userDataPath: path.join(temp, 'user-data'),
    autoDiscover: false,
  });
}

function mediaRequest(id, token, range) {
  return {
    url: 'mineradio-wallpaper://media/' + id + '?token=' + encodeURIComponent(token),
    method: 'GET',
    headers: { get: (name) => (String(name).toLowerCase() === 'range' ? (range || '') : '') },
  };
}

function responseBytes(response) {
  return response.arrayBuffer().then((buffer) => Buffer.from(buffer));
}

test('Wallpaper Engine 可直接导入 mp4 视频文件（无 project.json 也能播放）', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mineradio-we-media-'));
  const dir = path.join(temp, 'clips');
  fs.mkdirSync(dir, { recursive: true });
  const media = Buffer.from('mineradio-mp4-payload-0123456789');
  const file = path.join(dir, 'my-loop.mp4');
  fs.writeFileSync(file, media);

  const library = makeLibrary(temp);
  const snapshot = await library.addManualProjectFile(file);
  assert.equal(snapshot.ok, true);
  assert.equal(snapshot.count, 1);
  const item = snapshot.projects[0];
  assert.equal(item.playable, true);
  assert.equal(item.mediaType, 'video');
  assert.equal(item.projectType, 'video');
  assert.equal(item.title, 'my-loop');
  assert.equal(item.direct, true);
  assert.equal(item.safetyMode, 'direct-media');

  const full = await library.mediaResponse(mediaRequest(item.id, snapshot.mediaToken));
  assert.equal(full.status, 200);
  assert.equal(full.headers.get('content-type'), 'video/mp4');
  assert.equal(full.headers.get('accept-ranges'), 'bytes');
  assert.ok((await responseBytes(full)).equals(media));

  const partial = await library.mediaResponse(mediaRequest(item.id, snapshot.mediaToken, 'bytes=0-7'));
  assert.equal(partial.status, 206);
  assert.equal(partial.headers.get('content-range'), 'bytes 0-7/' + media.length);
  assert.equal((await responseBytes(partial)).toString('utf8'), media.subarray(0, 8).toString('utf8'));

  const denied = await library.mediaResponse(mediaRequest(item.id, 'deadbeef'));
  assert.equal(denied.status, 404);
  if (typeof library.dispose === 'function') library.dispose();
});

test('直接导入的 mp4 没有 Scene 包与项目设置，但仍可读基本信息', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mineradio-we-direct-'));
  fs.mkdirSync(temp, { recursive: true });
  const file = path.join(temp, 'solo.mp4');
  fs.writeFileSync(file, Buffer.from('payload'));

  const library = makeLibrary(temp);
  const snapshot = await library.addManualProjectFile(file);
  const id = snapshot.projects[0].id;
  await assert.rejects(() => library.getNativeSceneTarget(id), /WALLPAPER_SCENE_NOT_FOUND/);
  const details = await library.getProjectDetails(id);
  assert.equal(details.ok, true);
  assert.equal(details.projectType, 'video');
  assert.equal(details.properties.length, 0);
  assert.equal(details.workshopId, '');
  if (typeof library.dispose === 'function') library.dispose();
});

test('移除手动导入的 mp4 会从索引与存档同时摘掉', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mineradio-we-remove-'));
  fs.mkdirSync(temp, { recursive: true });
  const file = path.join(temp, 'remove-me.webm');
  fs.writeFileSync(file, Buffer.from('payload'));

  const library = makeLibrary(temp);
  const snapshot = await library.addManualProjectFile(file);
  assert.equal(snapshot.count, 1);
  const mediaRoot = snapshot.manualRoots.find((entry) => entry.kind === 'media');
  assert.ok(mediaRoot, '手动导入的视频应在手动清单里以 media 条目出现');
  assert.equal(mediaRoot.name, 'remove-me.webm');

  const after = await library.removeManualRoot(mediaRoot.id);
  assert.equal(after.count, 0);
  assert.equal(after.manualRoots.filter((entry) => entry.kind === 'media').length, 0);
  if (typeof library.dispose === 'function') library.dispose();

  const reloaded = makeLibrary(temp);
  const list = await reloaded.list({ force: true });
  assert.equal(list.count, 0);
  assert.equal(list.manualRoots.length, 0);
  if (typeof reloaded.dispose === 'function') reloaded.dispose();
});

test('清单指向的媒体无法解析时，手动导入的视频接管为可播放条目', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mineradio-we-broken-'));
  const libraryRoot = path.join(temp, 'library');
  fs.mkdirSync(libraryRoot, { recursive: true });
  const projectDir = writeProject(libraryRoot, 'broken-video', {
    title: 'Broken Video',
    type: 'video',
    file: 'missing.mp4',
  });
  const actual = path.join(projectDir, 'actual.mp4');
  fs.writeFileSync(actual, Buffer.from('payload-bytes'));

  const library = makeLibrary(temp);
  const snapshot = await library.addManualProjectFile(actual);
  const matches = snapshot.projects.filter((item) => item.title === 'Broken Video');
  assert.equal(matches.length, 1, '同一目录只应产生一个条目，不重复计数');
  assert.equal(matches[0].playable, true);
  assert.equal(matches[0].mediaType, 'video');
  const served = await library.mediaResponse(mediaRequest(matches[0].id, snapshot.mediaToken));
  assert.equal(served.status, 200);
  assert.equal(served.headers.get('content-type'), 'video/mp4');
  if (typeof library.dispose === 'function') library.dispose();
});

test('project.json 声明媒体但缺 type 时仍按直接媒体索引', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mineradio-we-typeless-'));
  const libraryRoot = path.join(temp, 'library');
  fs.mkdirSync(libraryRoot, { recursive: true });
  writeProject(libraryRoot, 'typeless', {
    title: 'Typeless Fixture',
    file: 'clip.mp4',
  }, {
    'clip.mp4': Buffer.from('clip-bytes'),
  });

  const library = makeLibrary(temp);
  const snapshot = await library.addManualRoot(libraryRoot);
  const item = snapshot.projects.find((entry) => entry.title === 'Typeless Fixture');
  assert.ok(item);
  assert.equal(item.playable, true);
  assert.equal(item.mediaType, 'video');
  assert.equal(item.projectType, 'video');
  if (typeof library.dispose === 'function') library.dispose();
});

test('在 Scene 项目目录里导入视频不会把 Scene 条目改标成 Video', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mineradio-we-scene-clip-'));
  const libraryRoot = path.join(temp, 'library');
  fs.mkdirSync(libraryRoot, { recursive: true });
  const projectDir = writeProject(libraryRoot, 'scene-with-clip', {
    title: 'Scene Clip',
    type: 'scene',
    file: 'scene.json',
    preview: 'preview.jpg',
  }, {
    'scene.pkg': Buffer.concat([Buffer.from([8, 0, 0, 0]), Buffer.from('PKGV0002', 'ascii'), Buffer.alloc(20, 1)]),
    'preview.jpg': Buffer.alloc(48, 0xff),
  });
  const clip = path.join(projectDir, 'extra.mp4');
  fs.writeFileSync(clip, Buffer.from('clip-bytes'));

  const library = makeLibrary(temp);
  const snapshot = await library.addManualProjectFile(clip);
  const matches = snapshot.projects.filter((item) => item.title === 'Scene Clip');
  assert.equal(matches.length, 1);
  assert.equal(matches[0].projectType, 'scene');
  assert.equal(matches[0].enginePlayable, true);
  assert.equal(matches[0].playable, false, 'Scene 条目的媒体覆盖必须被排除');
  assert.equal(matches[0].mediaType, '');
  if (typeof library.dispose === 'function') library.dispose();
});

test('导入入口放开了 mp4/webm 并给出视频直连说明', () => {
  const bridge = fs.readFileSync(path.join(root, 'desktop', 'wallpaper-engine-bridge.js'), 'utf8');
  const renderer = fs.readFileSync(path.join(root, 'public', 'wallpaper-engine.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
  assert.match(bridge, /extensions: \['pkg', 'pak', 'json', 'mp4', 'webm', 'mov', 'm4v'/);
  assert.match(bridge, /{ name: '视频', extensions: \['mp4', 'webm', 'mov', 'm4v'\] }/);
  assert.match(renderer, /视频\/图片直接播放/);
  assert.match(html, /导入项目 \/ 视频/);
});
