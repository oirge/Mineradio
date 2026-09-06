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

/**
 * 按函数名切出 NSIS 函数体（含 FunctionEnd）。
 * @param {string} name 函数名。
 * @returns {string} 函数源码。
 */
function nsisFunction(name) {
  const start = NSH.indexOf(`Function ${name}`);
  assert.ok(start >= 0, `缺少 NSIS 函数 ${name}`);
  const end = NSH.indexOf('FunctionEnd', start);
  return NSH.slice(start, end + 'FunctionEnd'.length);
}

test('NSIS 安装目录叶子名带 oirge，不会落进原项目的目录', () => {
  assert.match(NSH, /!define MINERADIO_INSTALL_DIR_NAME "Mineradio-oirge"/);
  assert.match(NSH, /!define MINERADIO_INSTALL_DIR_NAME_LOWER "mineradio-oirge"/);
  assert.match(NSH, /!define MINERADIO_DEFAULT_INSTALL_DIR "D:\\\$\{MINERADIO_INSTALL_DIR_NAME\}"/);
  // 任何残留的 "D:\Mineradio" 字面量都会把两个项目装到同一个目录里。
  assert.doesNotMatch(NSH, /"D:\\Mineradio"/);
  assert.match(NSH, /StrCpy \$INSTDIR "\$\{MINERADIO_DEFAULT_INSTALL_DIR\}"/);

  const normalize = nsisFunction('MineradioNormalizeInstallDir');
  assert.match(normalize, /\$\{ElseIf\} \$2 != "\$\{MINERADIO_INSTALL_DIR_NAME\}"/);
  assert.match(normalize, /\$\{AndIf\} \$2 != "\$\{MINERADIO_INSTALL_DIR_NAME_LOWER\}"/);
  // 叶子名是旧身份 / 原项目的 Mineradio 时改到旁边（D:\Mineradio → D:\Mineradio-oirge），
  // 绝不能嵌进去：旧版卸载器是 RMDir /r，整目录连新版一起删。
  assert.match(NSH, /!define MINERADIO_LEGACY_INSTALL_DIR_NAME "Mineradio"/);
  assert.match(
    normalize,
    /\$\{If\} \$2 == "\$\{MINERADIO_LEGACY_INSTALL_DIR_NAME\}"[\s\S]*?\$\{GetParent\} "\$0" \$3[\s\S]*?StrCpy \$0 "\$0\\\$\{MINERADIO_INSTALL_DIR_NAME\}"/,
  );

  // 没有 D 盘时 $INSTDIR 还是 electron-builder 的默认目录，静默安装不经过目录页，必须在这里归一化。
  const preferred = nsisFunction('MineradioUsePreferredInstallDir');
  assert.match(
    preferred,
    /StrCpy \$INSTDIR "\$\{MINERADIO_DEFAULT_INSTALL_DIR\}"[\s\S]*?Push "\$INSTDIR"\s*\n\s*Call MineradioNormalizeInstallDir\s*\n\s*Pop \$INSTDIR/,
  );

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
  const fn = nsisFunction('MineradioOfferLegacyUninstall');

  // 这个 GUID 是实测取自本机注册表的旧身份卸载键；原项目用的是同一个，所以它只能当线索。
  assert.match(NSH, /!define MINERADIO_LEGACY_GUID "9733721a-009e-52bc-b705-49059cd80258"/);
  assert.match(NSH, /!define MINERADIO_LEGACY_APP_KEY "Software\\\$\{MINERADIO_LEGACY_GUID\}"/);
  assert.match(NSH, /!define MINERADIO_LEGACY_UNINSTALL_KEY "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\\$\{MINERADIO_LEGACY_GUID\}"/);
  assert.match(fn, /ReadRegStr \$0 HKCU "\$\{MINERADIO_LEGACY_UNINSTALL_KEY\}" "QuietUninstallString"/);

  // 安装根目录先取 HKCU\Software\<GUID>\InstallLocation（实测存在），再退到 DisplayIcon 反推。
  assert.match(fn, /ReadRegStr \$4 HKCU "\$\{MINERADIO_LEGACY_APP_KEY\}" "InstallLocation"/);
  assert.match(fn, /"DisplayIcon"[\s\S]*?\$\{GetParent\} "\$3" \$4/);
  assert.ok(fn.indexOf('"InstallLocation"') < fn.indexOf('"DisplayIcon"'), 'InstallLocation 必须优先于 DisplayIcon');

  // 门禁一：目录里必须有安装标记，旧卸载器自己的安全门才过得去。
  assert.match(fn, /\$\{IfNot\} \$\{FileExists\} "\$4\\\$\{MINERADIO_INSTALL_MARKER\}"/);

  // 门禁二：原项目 XxHuberrr/Mineradio 的 GUID、安装标记、1.x 版本号全都撞车，
  // 唯一可靠的区分是 electron-builder 写进 resources\app-update.yml 的发布源。
  assert.match(NSH, /!define MINERADIO_UPDATE_OWNER_LINE "owner: oirge"/);
  const isOurs = nsisFunction('MineradioLegacyInstallIsOurs');
  assert.match(isOurs, /FileOpen \$2 "\$0\\resources\\app-update\.yml" r/);
  // ${TrimNewLines} 在 TextFunc.nsh 里，不在 FileFunc.nsh —— 本地 makensis 实测报 Invalid command。
  assert.match(NSH, /^!include TextFunc\.nsh$/m);
  assert.match(isOurs, /\$\{TrimNewLines\} "\$3" \$3/);
  assert.match(isOurs, /\$\{If\} \$3 == "\$\{MINERADIO_UPDATE_OWNER_LINE\}"/);
  assert.match(fn, /Push "\$4"\s*\n\s*Call MineradioLegacyInstallIsOurs\s*\n\s*Pop \$2\s*\n\s*\$\{If\} \$2 != "1"/);
  // 版本号不再当门禁：原项目也发过 v1.1.1。
  assert.doesNotMatch(fn, /!= "1\."/);

  // 门禁三：新目录嵌在旧目录里时不能卸，否则会把刚装好的文件一起删掉。
  // 前缀比较两边都要补反斜杠，否则默认的 D:\Mineradio-oirge 会被 D:\Mineradio 误判成子目录，提示永远不出现。
  assert.match(fn, /StrCpy \$3 "\$4\\"\s*\n\s*StrLen \$5 "\$3"\s*\n\s*StrCpy \$2 "\$INSTDIR\\" \$5\s*\n\s*\$\{If\} \$2 == "\$3"/);
  const legacyRoot = 'D:\\Mineradio';
  const nestedPrefix = (dir) => (dir + '\\').slice(0, (legacyRoot + '\\').length) === legacyRoot + '\\';
  assert.equal(nestedPrefix('D:\\Mineradio-oirge'), false);
  assert.equal(nestedPrefix('D:\\Mineradio\\Mineradio-oirge'), true);
  assert.equal(nestedPrefix('D:\\Mineradio'), true);

  // 最终仍由用户点头，默认按钮是「否」，静默安装一律不卸。
  assert.match(fn, /MB_YESNO\|MB_ICONQUESTION\|MB_DEFBUTTON2/);
  assert.match(fn, /\/SD IDNO IDYES doLegacyUninstall/);
  assert.match(fn, /ExecWait '\$0'/);
  // 绝不能带上删数据的开关：两个 %APPDATA% 目录都要留着。
  assert.doesNotMatch(fn, /--delete-app-data/);
  // 文件装完之后才问，用户中途取消安装就什么都没发生。
  assert.match(NSH, /Call MineradioWriteInstallMarker\s*\n\s*Call MineradioOfferLegacyUninstall/);

  // 真机静默验证靠这个探针：环境变量为空时不写任何东西。
  assert.match(NSH, /!define MINERADIO_LEGACY_PROBE_ENV "MINERADIO_INSTALLER_LEGACY_PROBE"/);
  const probe = nsisFunction('MineradioLegacyProbe');
  assert.match(probe, /ReadEnvStr \$1 "\$\{MINERADIO_LEGACY_PROBE_ENV\}"\s*\n\s*\$\{If\} \$1 != ""/);
  for (const stage of ['legacy=absent', 'legacy=no-marker', 'legacy=not-ours', 'legacy=nested', 'legacy=prompt', 'legacy=declined', 'legacy=uninstall']) {
    assert.ok(fn.includes(stage), `探针缺少阶段 ${stage}`);
  }
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
  // exe 名以 win.executableName 为准，不依赖 electron-builder 内部的 productFilename 约定。
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
