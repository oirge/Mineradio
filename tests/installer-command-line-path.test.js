'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const installerSource = fs.readFileSync(path.join(__dirname, '..', 'build', 'installer.nsh'), 'utf8');
const preferredStart = installerSource.indexOf('Function MineradioUsePreferredInstallDir');
const preferredEnd = installerSource.indexOf('FunctionEnd', preferredStart);
const preferredSource = installerSource.slice(preferredStart, preferredEnd + 'FunctionEnd'.length);

// 固定 NSIS 特殊参数的真实读取方式，防止显式安装目录再次被默认路径覆盖。
test('安装器从原始命令行读取 /D= 并继续归一化目录', () => {
  assert.ok(preferredStart >= 0, '缺少 MineradioUsePreferredInstallDir');
  assert.match(preferredSource, /System::Call 'kernel32::GetCommandLine\(\) t \.r0'/);
  assert.match(preferredSource, /\$\{GetOptions\} \$0 "\/D=" \$R1/);
  assert.doesNotMatch(preferredSource, /\$\{GetParameters\}/);
  assert.doesNotMatch(preferredSource, /StdUtils::GetAllParameters|\$\{StdUtils\.GetAllParameters\}/);
  assert.match(preferredSource, /Push "\$R1"[\s\S]*Call MineradioNormalizeInstallDir[\s\S]*Pop \$INSTDIR/);
});

// 路径参数修复不得削弱安装标记和卸载边界，否则会重新引入误删风险。
test('安装器保留专用目录标记和卸载安全门禁', () => {
  assert.match(installerSource, /!define MINERADIO_INSTALL_MARKER "\.mineradio-install-root"/);
  assert.match(installerSource, /Function MineradioWriteInstallMarker[\s\S]*FileOpen \$0 "\$INSTDIR\\\$\{MINERADIO_INSTALL_MARKER\}" w/);
  assert.match(installerSource, /Function un\.MineradioAbortUnsafeUninstallRoot[\s\S]*IfFileExists "\$INSTDIR\\\$\{MINERADIO_INSTALL_MARKER\}" safe 0/);
});
