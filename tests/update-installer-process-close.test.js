'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const { launchUpdateInstaller } = require('../desktop/update-installer-launcher');

const root = path.join(__dirname, '..');
const mainSource = fs.readFileSync(path.join(root, 'desktop', 'main.js'), 'utf8');
const installerSource = fs.readFileSync(path.join(root, 'build', 'installer.nsh'), 'utf8');

/**
 * 提取指定起始标记到结束标记之间的源码，避免断言误命中无关处理器。
 * @param {string} source 完整源码。
 * @param {string} startMarker 目标片段的起始标记。
 * @param {string} endMarker 目标片段之后的结束标记。
 * @returns {string} 待验证的目标源码片段。
 */
function sourceSection(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0, `缺少起始标记：${startMarker}`);
  assert.ok(end > start, `缺少结束标记：${endMarker}`);
  return source.slice(start, end);
}

test('更新安装器以 updated 模式独立启动并解除父进程引用', async () => {
  const child = new EventEmitter();
  let unrefCalled = false;
  child.unref = () => { unrefCalled = true; };
  let spawnCall = null;

  const result = launchUpdateInstaller('C:\\Updates\\Mineradio-Setup.exe', (file, args, options) => {
    spawnCall = { file, args, options };
    process.nextTick(() => child.emit('spawn'));
    return child;
  });

  await result;
  assert.deepEqual(spawnCall, {
    file: 'C:\\Updates\\Mineradio-Setup.exe',
    args: ['--updated'],
    options: { detached: true, stdio: 'ignore' },
  });
  assert.equal(unrefCalled, true);
});

test('更新安装器创建失败时返回错误且不伪报成功', async () => {
  const child = new EventEmitter();
  child.unref = () => assert.fail('创建失败时不得解除不存在的安装器引用');
  const expected = new Error('spawn failed');
  const result = launchUpdateInstaller('C:\\Updates\\missing.exe', () => {
    process.nextTick(() => child.emit('error', expected));
    return child;
  });

  await assert.rejects(result, expected);
});

test('应用内安装更新成功启动安装器后主动退出后台进程', () => {
  const handler = sourceSection(
    mainSource,
    "ipcMain.handle('mineradio-open-update-installer'",
    "ipcMain.handle('mineradio-restart-app'",
  );

  assert.match(handler, /await launchUpdateInstaller\(target\);[\s\S]*?appQuitting = true;[\s\S]*?app\.quit\(\)/);
  assert.doesNotMatch(handler, /shell\.openPath\(target\)/);
});

test('NSIS 安装器自动关闭当前安装目录下的 Mineradio 进程并保留路径边界', () => {
  const macro = sourceSection(
    installerSource,
    '!macro customCheckAppRunning',
    '!macroend',
  );

  assert.match(macro, /Call MineradioCloseInstalledProcesses/);
  const implementation = sourceSection(
    installerSource,
    '!macro MineradioDefineCloseInstalledProcesses',
    '!macroend',
  );
  assert.match(implementation, /Function \$\{_PREFIX\}MineradioCloseInstalledProcesses[\s\S]*?ExecutablePath[\s\S]*?StartsWith\(\$\$root, \[StringComparison\]::OrdinalIgnoreCase\)/);
  assert.match(implementation, /\$\$ErrorActionPreference = 'Stop'/);
  assert.match(implementation, /\[Diagnostics\.Process\]::GetCurrentProcess\(\)\.SessionId/);
  assert.match(implementation, /SessionId -eq \$\$sessionId/);
  assert.match(implementation, /catch \{ exit 1 \}/);
  assert.doesNotMatch(implementation, /-Filter 'ProcessId = \$\$PID'/);
  assert.match(implementation, /CloseMainWindow\(\)[\s\S]*?Start-Sleep -Milliseconds 1200[\s\S]*?Stop-Process -Id \$\$_\.ProcessId -Force/);
  assert.match(implementation, /MessageBox MB_RETRYCANCEL\|MB_ICONEXCLAMATION "\$\(appCannotBeClosed\)"/);
  assert.match(installerSource, /!insertmacro MineradioDefineCloseInstalledProcesses "un\."/);
  assert.match(installerSource, /!insertmacro MineradioDefineCloseInstalledProcesses ""/);
  assert.doesNotMatch(installerSource, /taskkill[^\r\n]*\/IM[^\r\n]*Mineradio\.exe/i);
});
