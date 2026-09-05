'use strict';
// 二创版必须能和原项目 XxHuberrr/Mineradio 同时安装、同时运行、互不影响。
// 两个仓库的 appId 曾经一模一样（com.mineradio.desktop），于是 NSIS 卸载 GUID、安装目录、
// 开始菜单项、进程名全撞在一起，谁装谁就把对方当成升级覆盖掉。
// 这条测试钉住「安装身份」的每一处；同时反向钉住「数据身份」不许跟着变，
// 因为 %APPDATA%\Mineradio-oirge 是由 APP_NAME + PRIMARY_PROFILE_ID 拼出来的，改一下曲库和设置就丢了。

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { resolveDesktopShortcutName } = require('../desktop/instance-isolation.js');

const ROOT = path.join(__dirname, '..');

/**
 * 读取仓库内文件，锚点缺失时由各条断言报错。
 * @param {string} relativePath 仓库相对路径。
 * @returns {string} 文件内容。
 */
function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

const PKG = JSON.parse(read('package.json'));
const NSH = read('build/installer.nsh');
const MAIN = read('desktop/main.js');
const SERVER = read('server.js');

test('打包身份与原项目完全不重合', () => {
  // appId 决定 electron-builder 生成的卸载注册表 GUID：一样就会互相当成升级。
  assert.equal(PKG.build.appId, 'com.mineradio.desktop.oirge');
  assert.notEqual(PKG.build.appId, 'com.mineradio.desktop');
  assert.equal(PKG.build.productName, 'Mineradio 二创');
  assert.notEqual(PKG.build.productName, 'Mineradio');
  assert.equal(PKG.build.win.executableName, 'Mineradio-oirge');
  assert.notEqual(PKG.build.win.executableName, 'Mineradio');
  assert.equal(PKG.build.nsis.shortcutName, 'Mineradio 二创');
  assert.notEqual(PKG.build.nsis.shortcutName, 'Mineradio');
  assert.equal(PKG.build.nsis.artifactName, 'Mineradio-oirge-${version}-Setup.${ext}');
});

test('数据目录身份保持不变，曲库和设置不会被孤立', () => {
  // %APPDATA%\Mineradio-oirge = `${APP_NAME}-${PRIMARY_PROFILE_ID}`，这两个常量是用户数据的地址。
  assert.match(MAIN, /const APP_NAME = 'Mineradio';/);
  assert.match(MAIN, /const PRIMARY_PROFILE_ID = 'oirge';/);
  // 面向 Windows 的显示身份单独一个常量，改显示名不会牵动数据目录。
  assert.match(MAIN, /const APP_DISPLAY_NAME = 'Mineradio 二创';/);
  assert.equal(PKG.name, 'mineradio');
});

test('NSIS 安装目录叶子名带 oirge，不会落进原项目的目录', () => {
  assert.match(NSH, /!define MINERADIO_INSTALL_DIR_NAME "Mineradio-oirge"/);
  assert.match(NSH, /!define MINERADIO_INSTALL_DIR_NAME_LOWER "mineradio-oirge"/);
  assert.match(NSH, /!define MINERADIO_DEFAULT_INSTALL_DIR "D:\\\$\{MINERADIO_INSTALL_DIR_NAME\}"/);
  // 任何残留的 "D:\Mineradio" 字面量都会把两个项目装到同一个目录里。
  assert.doesNotMatch(NSH, /"D:\\Mineradio"/);
  assert.match(NSH, /StrCpy \$INSTDIR "\$\{MINERADIO_DEFAULT_INSTALL_DIR\}"/);
  assert.match(NSH, /\$\{If\} \$2 != "\$\{MINERADIO_INSTALL_DIR_NAME\}"/);
  assert.match(NSH, /\$\{AndIf\} \$2 != "\$\{MINERADIO_INSTALL_DIR_NAME_LOWER\}"/);
  // 卸载安全门也必须认新叶子名，否则卸载会被自己挡下来。
  assert.match(NSH, /\$\{If\} \$0 != "\$\{MINERADIO_INSTALL_DIR_NAME\}"/);
});

test('安装器只结束二创版自己的进程', () => {
  assert.match(NSH, /!define MINERADIO_PROCESS_EXE_NAME "Mineradio-oirge\.exe"/);
  assert.match(NSH, /\$\$_\.Name -eq '\$\{MINERADIO_PROCESS_EXE_NAME\}'/);
  // 按 Mineradio.exe 筛选会连原项目正在放歌的进程一起杀掉。
  assert.doesNotMatch(NSH, /-eq 'Mineradio\.exe'/);
});

test('旧身份安装的卸载提示有三重门禁，且不碰用户数据', () => {
  const start = NSH.indexOf('Function MineradioOfferLegacyUninstall');
  const end = NSH.indexOf('FunctionEnd', start);
  assert.ok(start > 0 && end > start, '缺少旧身份卸载提示');
  const fn = NSH.slice(start, end);

  assert.match(NSH, /!define MINERADIO_LEGACY_UNINSTALL_KEY "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\9733721a-009e-52bc-b705-49059cd80258"/);
  assert.match(fn, /ReadRegStr \$0 HKCU "\$\{MINERADIO_LEGACY_UNINSTALL_KEY\}" "QuietUninstallString"/);
  // 门禁一：只有 1.x 才是本仓库的版本线，原项目的 2.x 一律放过。
  assert.match(fn, /"DisplayVersion"/);
  assert.match(fn, /\$\{If\} \$2 != "1\."/);
  // 门禁二：目录里必须有本仓库写的安全标记（该卸载记录没有 InstallLocation，只能从 DisplayIcon 反推）。
  assert.match(fn, /"DisplayIcon"/);
  assert.match(fn, /IfFileExists "\$4\\\$\{MINERADIO_INSTALL_MARKER\}" 0 legacyDone/);
  // 门禁三：新目录嵌在旧目录里时不能卸，否则会把刚装好的文件一起删掉。
  assert.match(fn, /StrLen \$5 "\$4"/);
  assert.match(fn, /StrCpy \$2 "\$INSTDIR" \$5/);
  // 最终仍由用户点头，默认按钮是「否」，静默安装一律不卸。
  assert.match(fn, /MB_YESNO\|MB_ICONQUESTION\|MB_DEFBUTTON2/);
  assert.match(fn, /\/SD IDNO IDYES doLegacyUninstall/);
  assert.match(fn, /ExecWait '\$0'/);
  // 绝不能带上删数据的开关：两个 %APPDATA% 目录都要留着。
  assert.doesNotMatch(fn, /--delete-app-data/);
  // 文件装完之后才问，用户中途取消安装就什么都没发生。
  assert.match(NSH, /Call MineradioWriteInstallMarker\s*\n\s*Call MineradioOfferLegacyUninstall/);
});

test('托盘与桌面快捷方式用显示身份，不会和原项目重名或多出图标', () => {
  assert.match(MAIN, /nextTray\.setToolTip\(APP_DISPLAY_NAME\)/);
  assert.match(
    MAIN,
    /shortcutName: process\.env\.MINERADIO_SHORTCUT_NAME \|\| \(INSTANCE_PROFILE\.primary \? APP_DISPLAY_NAME : ''\)/,
  );
  // 应用自建快捷方式必须和安装器建的那个同名，否则桌面上会同时出现两个。
  assert.equal(
    resolveDesktopShortcutName({
      shortcutName: PKG.build.nsis.shortcutName,
      execPath: `D:/Mineradio-oirge/${PKG.build.win.executableName}.exe`,
      defaultName: 'Mineradio',
    }),
    PKG.build.nsis.shortcutName,
  );
});

test('开机启动项按 AppUserModelId 独立写入，并纠正指向旧安装的残留', () => {
  assert.match(MAIN, /openAtLogin: !!enabled,\s*\n\s*\/\/[^\n]*\n\s*name: APP_USER_MODEL_ID,/);
  assert.match(MAIN, /function reconcileStartupEntryPath\(\)/);
  assert.match(MAIN, /settings\.executableWillLaunchAtLogin !== false/);
  assert.match(MAIN, /applySavedDesktopShellSettings\(\);\s*\n\s*reconcileStartupEntryPath\(\);/);
});

test('共享谱面缓存的临时文件带进程号，两个播放器不会互相打断', () => {
  // D:\MineradioCache\beatmaps 故意和原项目共用（谱面重算很贵），但 .tmp 必须各写各的。
  assert.match(SERVER, /const tmp = `\$\{file\}\.\$\{process\.pid\}\.tmp`;/);
  assert.doesNotMatch(SERVER, /const tmp = file \+ '\.tmp';/);
});

test('afterPack 按 executableName 找 exe，任务管理器显示名跟随 productName', () => {
  const afterPack = read('build/after-pack.js');
  // productFilename 跟的是含中文的 productName，和实际 exe 名不再一致。
  assert.match(afterPack, /platformOptions\.executableName/);
  assert.match(afterPack, /'FileDescription', productName/);
  assert.doesNotMatch(afterPack, /'FileDescription', 'Mineradio'/);
});

test('发布工作流上传的资产名与打包产物一致', () => {
  const workflow = read('.github/workflows/release.yml');
  assert.ok(workflow.includes('"Mineradio-oirge-$version-Setup.exe"'));
  assert.ok(workflow.includes('"dist/Mineradio-oirge-$version-Setup.exe.blockmap"'));
  assert.ok(workflow.includes('Mineradio-oirge-$version-SHA256SUMS.txt'));
  assert.doesNotMatch(workflow, /"Mineradio-\$version-Setup\.exe"/);
  assert.doesNotMatch(workflow, /Mineradio-\$version-SHA256SUMS/);
});

test('更新兜底资产名跟着新安装包名', () => {
  assert.match(SERVER, /const UPDATE_ASSET_NAME_PREFIX = 'Mineradio-oirge';/);
  assert.match(SERVER, /\$\{UPDATE_ASSET_NAME_PREFIX\}-\$\{latestVersion\}-Setup\.exe/);
});
