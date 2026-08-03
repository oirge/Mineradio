'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const appSource = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
const mainSource = fs.readFileSync(path.join(root, 'desktop', 'main.js'), 'utf8');
const serverSource = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const lyricsSource = fs.readFileSync(path.join(root, 'public', 'desktop-lyrics.html'), 'utf8');
const wallpaperSource = fs.readFileSync(path.join(root, 'public', 'wallpaper.html'), 'utf8');

function functionBody(source, name) {
  const match = source.match(new RegExp('function\\s+' + name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&') + '\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\n\\}', 'm'));
  return match ? match[1] : '';
}

test('asar 打包使用可写 app.asar.unpacked 运行根', () => {
  assert.equal(packageJson.build.asar, true);
  assert.deepEqual(packageJson.build.asarUnpack, [
    'server.js',
    'package.json'
  ]);
  assert.match(serverSource, /function resolveRuntimeAppRoots\(\)/);
  assert.match(serverSource, /const \{ writableRoot: APP_ROOT, resourceRoot: RESOURCE_ROOT \} = resolveRuntimeAppRoots\(\)/);
  assert.match(serverSource, /path\.resolve\(APP_ROOT, safeRel\)/);
  assert.match(serverSource, /path\.join\(RESOURCE_ROOT, 'public', filePath\)/);
  assert.match(serverSource, /path\.join\(RESOURCE_ROOT, 'build', 'icon\.ico'\)/);
  assert.match(mainSource, /function resolveRuntimeAppRoots\(\)/);
  assert.match(mainSource, /const \{ writableRoot: APP_ROOT, resourceRoot: RESOURCE_ROOT \} = resolveRuntimeAppRoots\(\)/);
  assert.match(mainSource, /path\.join\(RESOURCE_ROOT, 'build', 'icon\.ico'\)/);
  assert.match(mainSource, /require\(path\.join\(APP_ROOT, 'server\.js'\)\)/);
});

test('桌面歌词和壁纸覆盖层在后台停止 RAF，并保留可见恢复入口', () => {
  assert.doesNotMatch(mainSource, /disable-background-timer-throttling/);
  assert.doesNotMatch(mainSource, /disable-renderer-backgrounding/);
  assert.doesNotMatch(mainSource, /disable-backgrounding-occluded-windows/);
  assert.match(mainSource, /backgroundThrottling:\s*true/);
  assert.match(lyricsSource, /if \(overlayRenderPaused\) return;/);
  assert.match(lyricsSource, /document\.addEventListener\('visibilitychange'/);
  assert.match(lyricsSource, /if \(overlayRenderPaused\) return;[\s\S]*requestAnimationFrame\(draw\)/);
  assert.match(wallpaperSource, /if \(overlayRenderPaused\) return;/);
  assert.match(wallpaperSource, /document\.addEventListener\('visibilitychange'/);
});

test('大型用户状态不再同步写入 localStorage，只有 IDB 失败才回退', () => {
  assert.match(appSource, /var LOCAL_USER_STATE_DB_NAME = 'mineradio-user-state-v1'/);
  assert.match(appSource, /var LOCAL_USER_STATE_STORE = 'state'/);
  assert.match(appSource, /function openLocalUserStateDb\(\)/);
  assert.match(appSource, /function scheduleLocalUserStateWrite\(id, value, legacyKey\)/);
  for (const [name, marker] of [
    ['saveCustomCoverMap', 'scheduleLocalUserStateWrite(LOCAL_USER_STATE_CUSTOM_COVERS'],
    ['saveCustomLyricMap', 'scheduleLocalUserStateWrite(LOCAL_USER_STATE_CUSTOM_LYRICS'],
    ['saveCustomLyricPrefs', 'scheduleLocalUserStateWrite(LOCAL_USER_STATE_CUSTOM_LYRIC_PREFS'],
    ['saveLocalBeatMapCache', 'scheduleLocalUserStateWrite(LOCAL_USER_STATE_LOCAL_BEATMAPS'],
    ['saveLocalBeatPrefs', 'scheduleLocalUserStateWrite(LOCAL_USER_STATE_LOCAL_BEAT_PREFS'],
    ['saveListenStatsState', 'scheduleLocalUserStateWrite(LOCAL_USER_STATE_LISTEN_STATS'],
    ['saveUserFxArchives', 'scheduleLocalUserStateWrite(LOCAL_USER_STATE_FX_ARCHIVES']
  ]) {
    const body = functionBody(appSource, name);
    assert.ok(body.includes(marker), `${name} 未接入 IDB 状态写入`);
    assert.doesNotMatch(body, /localStorage\.setItem\(/);
  }
  assert.match(appSource, /localStorage\.removeItem\(LOCAL_LIBRARY_SNAPSHOT_STORE_KEY\)/);
  assert.match(appSource, /localStorage\.removeItem\(LOCAL_LIBRARY_INDEX_STORE_KEY\)/);
});
