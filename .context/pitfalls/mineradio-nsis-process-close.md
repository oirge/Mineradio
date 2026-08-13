# Mineradio NSIS 自动关闭安装目录进程

## Context

处理 Mineradio 应用内更新、`desktop/main.js` 的更新安装器启动逻辑，以及 `build/installer.nsh` 中 electron-builder / NSIS 的 `customCheckAppRunning` 时适用。

## Pitfall

- Mineradio 启用关闭到托盘后，仅打开更新安装器不会退出 Electron 主进程，覆盖安装会因旧文件仍被占用而失败。
- Windows PowerShell 5.1 不会展开单引号字符串中的 `$PID`。使用 `Get-CimInstance ... -Filter 'ProcessId = $PID'` 会产生无效 WQL 查询。
- 如果查询错误没有转换为非零退出码，后续空结果会被误判为没有目标进程，安装器继续执行后才显示 `Failed to uninstall old application files ...: 2`。
- 一台机器可能同时运行多个不同安装目录的 `Mineradio.exe`。全局按进程名结束会误杀其它实例。

## Solution / Convention

- 应用内启动更新安装器时使用独立子进程；确认安装器创建成功后设置 `appQuitting = true` 并调用 `app.quit()`，避免关闭到托盘拦截退出。
- NSIS 自定义进程检查必须只筛选：
  - 进程名为 `Mineradio.exe`；
  - `ExecutablePath` 位于当前 `$INSTDIR` 内；
  - `SessionId` 与安装器当前 Windows Session 一致。
- PowerShell 当前 Session ID 使用 `[Diagnostics.Process]::GetCurrentProcess().SessionId`，不得依赖含 `$PID` 的单引号 WQL 字符串。
- PowerShell 查询设置 `$ErrorActionPreference = 'Stop'`，最外层异常必须 `exit 1`；只有再次确认目标进程数量为零时才能 `exit 0`。
- 先调用 `CloseMainWindow()` 请求正常退出，等待后仅对同目录同会话的残留进程执行强制结束。
- 覆盖安装 E2E 必须使用独立 `appId` 和安装目录。通过标准为：安装器退出码为 `0`、目标目录进程与监听端口消失、安装文件已覆盖、正式 `D:\Mineradio` 主进程 PID 和路径保持不变。不要比较全部 Chromium 子进程 PID。

## Reference

- electron-builder 26.15.3：`node_modules/app-builder-lib/templates/nsis/include/allowOnlyOneInstallerInstance.nsh`
- electron-builder 26.15.3：`node_modules/app-builder-lib/templates/nsis/installSection.nsh`
- 本仓库：`build/installer.nsh`
- 本仓库：`desktop/update-installer-launcher.js`
- 本仓库：`tests/update-installer-process-close.test.js`
