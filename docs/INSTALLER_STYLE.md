# Mineradio Installer Style

2026-06-22 用户确认保留当前安装包格式。以后发布安装包，默认沿用这套样式和流程，除非用户明确要求重做。

## 视觉方向

- 中文极简安装器。
- 主色：白底 `#FFFFFF`，主文字 `#111217`，弱文字 `#4B5263` / `#6B7280`，蓝色点缀 `#3257F7`。
- 不要再使用红色 MR、深色大卡片、复杂装饰、英文大段说明或黑底黑字。
- 顶部横幅和侧边图保持黑白蓝极简：`build/installerHeader.bmp`、`build/installerSidebar.bmp`。

## 页面结构

- 欢迎页只保留：
  - `MINERADIO 二创`
  - `Mineradio 二创`
  - 简短中文说明（含「与原项目 Mineradio 完全独立，可同时安装使用」）
  - `默认位置：D:\Mineradio-oirge`
- 安装目录页只保留：
  - `选择安装位置`
  - 简短中文说明
  - `安装目录` 输入框
  - `浏览...` 按钮
  - `默认推荐 D:\Mineradio-oirge，会自动追加子目录。`

## 技术边界

- 使用 `build/installer.nsh` 的自定义欢迎页和自定义安装目录页。
- `package.json` 中 `build.nsis.allowToChangeInstallationDirectory` 保持 `false`，避免 electron-builder 原生目录页读取旧安装注册表后回填到 `AppData\Local\Programs\` 下的默认目录。
- 自定义目录页必须保留可编辑输入框和 `浏览...` 按钮。
- 安装身份必须和原项目 `XxHuberrr/Mineradio` 分开（见 `tests/coexist-with-upstream-install.test.js`）：安装目录叶子名、进程名、显示名统一写在 `installer.nsh` 顶部的 `MINERADIO_*` 定义里，不要再往页面里写字面量。
- 默认路径通过 `MineradioUsePreferredInstallDir` 设置为 `D:\Mineradio-oirge`；命令行 `/D=` 参数仍可覆盖。
- 用户选择盘符根目录时，通过 `MineradioNormalizeInstallDir` 自动补成 `盘符:\Mineradio-oirge`；叶子名是旧身份 / 原项目的 `Mineradio` 时改到旁边（`D:\Mineradio` → `D:\Mineradio-oirge`），绝不嵌进去 —— 旧版卸载器是整目录递归删除。没有 D 盘时 `MineradioUsePreferredInstallDir` 也会把 electron-builder 的默认目录归一化到专用叶子名，静默安装不经过目录页也不会被卸载安全门挡住。
- 文件安装完成后 `MineradioOfferLegacyUninstall` 会检测换身份之前留下的旧安装，三道门禁都过才提示：目录内有安装标记、`resources\app-update.yml` 里是 `owner: oirge`（原项目 `XxHuberrr/Mineradio` 的 GUID、安装标记、1.x 版本号全都撞车，只有这个字段可靠）、新目录不在旧目录里面；询问用户后才调用旧卸载器，且绝不删用户数据。安装根目录先读 `HKCU\Software\<旧 GUID>\InstallLocation`，再退到 `DisplayIcon` 反推。
- 真机静默验证：设置环境变量 `MINERADIO_INSTALLER_LEGACY_PROBE=<文件路径>` 后运行 `Setup.exe /S /D=<临时目录>`，检测的每一步结论会追加写进该文件（`legacy=prompt …` 表示走到了弹窗、静默下自动作答「否」）。不设该变量时安装器不写任何东西。

## 发布前验证

发布前必须本地打开新生成的 `dist\Mineradio-oirge-版本-Setup.exe` 验证：

- 欢迎页显示中文极简样式，默认位置为 `D:\Mineradio-oirge`。
- 安装目录页输入框显示 `D:\Mineradio-oirge`。
- `浏览...` 按钮能弹出中文文件夹选择窗口。
- 验证时不要点 `安装`，确认后取消退出。
