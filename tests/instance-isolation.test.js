'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  resolveInstanceId,
  resolveInstanceUserDataPath,
  resolveInstanceAppUserModelId,
  resolveInstanceProfile,
  resolveLegacySharedProfile,
  resolveLegacyPathProfile,
  discoverLegacyPathProfiles,
  resolvePreferredServerPort,
  resolveDesktopShortcutName,
} = require('../desktop/instance-isolation');

test('不同 EXE 路径生成不同实例身份和用户数据目录', () => {
  const first = resolveInstanceId({ execPath: 'C:/Apps/Mineradio/Mineradio.exe', appRoot: 'C:/Apps/Mineradio/resources' });
  const second = resolveInstanceId({ execPath: 'C:/Desktop/Mineradio-Remix.exe', appRoot: 'C:/Desktop/remix/resources' });
  assert.notEqual(first, second);
  assert.notEqual(
    resolveInstanceUserDataPath('C:/Users/Test/AppData/Roaming', first, 'Mineradio'),
    resolveInstanceUserDataPath('C:/Users/Test/AppData/Roaming', second, 'Mineradio'),
  );
});

test('显式实例 ID 可稳定控制隔离边界', () => {
  const instanceId = resolveInstanceId({ instanceId: ' remix / 1 ' });
  assert.equal(instanceId, 'remix-1');
  assert.equal(resolveInstanceAppUserModelId('com.mineradio.desktop', instanceId), 'com.mineradio.desktop.remix-1');
});

test('正式 Mineradio.exe 使用二创专属稳定用户目录', () => {
  const profile = resolveInstanceProfile({
    execPath: 'D:/Mineradio/Mineradio.exe',
    appRoot: 'D:/Mineradio/resources/app.asar/desktop',
    appDataPath: 'C:/Users/Test/AppData/Roaming',
    appName: 'Mineradio',
    baseAppUserModelId: 'com.mineradio.desktop',
    primaryProfileId: 'oirge',
    isPackaged: true,
  });

  assert.equal(profile.primary, true);
  assert.equal(profile.instanceId, 'oirge');
  assert.equal(profile.appName, 'Mineradio-oirge');
  assert.equal(profile.userDataPath, path.join('C:/Users/Test/AppData/Roaming', 'Mineradio-oirge'));
  assert.equal(profile.sessionDataPath, path.join(profile.userDataPath, 'session'));
  assert.equal(profile.appUserModelId, 'com.mineradio.desktop.oirge');
});

test('正式二创改名或移动仍使用稳定目录，显式实例继续隔离', () => {
  const renamed = resolveInstanceProfile({
    execPath: 'C:/Desktop/Mineradio-Original.exe',
    appRoot: 'C:/Desktop/resources/app.asar/desktop',
    appDataPath: 'C:/Users/Test/AppData/Roaming',
    appName: 'Mineradio',
    primaryProfileId: 'oirge',
    isPackaged: true,
  });
  const explicit = resolveInstanceProfile({
    instanceId: 'original',
    execPath: 'C:/Desktop/Mineradio.exe',
    appRoot: 'C:/Desktop/resources/app.asar/desktop',
    appDataPath: 'C:/Users/Test/AppData/Roaming',
    appName: 'Mineradio',
    isPackaged: true,
  });

  assert.equal(renamed.primary, true);
  assert.equal(renamed.instanceId, 'oirge');
  assert.equal(renamed.userDataPath, path.join('C:/Users/Test/AppData/Roaming', 'Mineradio-oirge'));
  assert.equal(renamed.sessionDataPath, path.join(renamed.userDataPath, 'session'));
  assert.equal(explicit.primary, false);
  assert.equal(explicit.instanceId, 'original');
});

test('可重新定位 1.4.5 的路径隔离目录用于兼容迁移', () => {
  const options = {
    execPath: 'D:/Mineradio/Mineradio.exe',
    appRoot: 'D:/Mineradio/resources/app.asar/desktop',
    appDataPath: 'C:/Users/Test/AppData/Roaming',
    appName: 'Mineradio',
  };
  const legacy = resolveLegacyPathProfile(options);
  const oldInstanceId = resolveInstanceId(options);

  assert.equal(legacy.instanceId, oldInstanceId);
  assert.equal(legacy.userDataPath, resolveInstanceUserDataPath(options.appDataPath, oldInstanceId, 'Mineradio'));
  assert.equal(legacy.sessionDataPath, path.join(legacy.userDataPath, 'session'));
});

test('自动发现所有 1.4.5 路径隔离目录', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mineradio-legacy-profiles-'));
  try {
    for (const name of ['Mineradio-path-111111111111', 'Mineradio-path-aaaaaaaaaaaa']) {
      fs.mkdirSync(path.join(temp, name, 'session'), { recursive: true });
    }
    fs.mkdirSync(path.join(temp, 'Mineradio-path-invalid', 'session'), { recursive: true });
    fs.mkdirSync(path.join(temp, 'Mineradio-oirge', 'session'), { recursive: true });

    const profiles = discoverLegacyPathProfiles({ appDataPath: temp, appName: 'Mineradio' });
    assert.deepEqual(profiles.map(profile => profile.instanceId), [
      'path-111111111111',
      'path-aaaaaaaaaaaa',
    ]);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('升级前共享目录可作为一次性迁移源但不再作为运行目录', () => {
  const legacy = resolveLegacySharedProfile({
    appDataPath: 'C:/Users/Test/AppData/Roaming',
    appName: 'Mineradio',
  });

  assert.equal(legacy.userDataPath, path.join('C:/Users/Test/AppData/Roaming', 'Mineradio'));
  assert.equal(legacy.sessionDataPath, legacy.userDataPath);
});

test('每个实例获得稳定的高位首选端口并支持显式覆盖', () => {
  const first = resolvePreferredServerPort({ instanceId: 'oirge' });
  const second = resolvePreferredServerPort({ instanceId: 'path-123456789abc' });

  assert.ok(first >= 32000 && first < 48000);
  assert.ok(second >= 32000 && second < 48000);
  assert.notEqual(first, second);
  assert.equal(resolvePreferredServerPort({ instanceId: 'oirge', port: '34567' }), 34567);
});

test('桌面快捷方式默认跟随 EXE 名称并支持显式覆盖', () => {
  assert.equal(
    resolveDesktopShortcutName({ execPath: path.join('C:', 'Desktop', 'Mineradio-Remix.exe'), defaultName: 'Mineradio' }),
    'Mineradio-Remix',
  );
  assert.equal(
    resolveDesktopShortcutName({ shortcutName: 'Mineradio 二创', execPath: 'Mineradio.exe', defaultName: 'Mineradio' }),
    'Mineradio 二创',
  );
});

test('主进程在单实例锁之前设置独立 userData 和 AppUserModelId', () => {
  const source = require('node:fs').readFileSync(path.join(__dirname, '..', 'desktop', 'main.js'), 'utf8');
  const userDataSetup = source.indexOf("app.setPath('userData'");
  const lockSetup = source.indexOf('app.requestSingleInstanceLock()');
  const appIdSetup = source.indexOf('app.setAppUserModelId(APP_USER_MODEL_ID)');
  assert.ok(userDataSetup >= 0 && userDataSetup < lockSetup);
  assert.ok(appIdSetup >= 0);
  assert.match(source, /migratePrimaryDesktopShellSettings\(\);\s*applySavedDesktopShellSettings\(\);/);
  assert.match(source, /createTray\(\);\s*await createWindow\(\);/);
  assert.match(source, /closeToTrayEnabled && !!tray/);
  assert.match(source, /mainWindow = new BrowserWindow\([\s\S]*?mainWindowLifecycleStarted = true;/);
  assert.match(source, /app\.on\('window-all-closed',[\s\S]*?if \(!mainWindowLifecycleStarted\) return;/);
});
