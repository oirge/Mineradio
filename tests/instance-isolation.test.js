'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {
  resolveInstanceId,
  resolveInstanceUserDataPath,
  resolveInstanceAppUserModelId,
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
  assert.match(source, /createTray\(\);\s*await createWindow\(\);/);
  assert.match(source, /closeToTrayEnabled && !!tray/);
});
