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
- 用户选择盘符根目录时，通过 `MineradioNormalizeInstallDir` 自动补成 `盘符:\Mineradio-oirge`。
- 文件安装完成后 `MineradioOfferLegacyUninstall` 会检测换身份之前留下的旧安装（版本号 1.x + 目录内有安装标记 + 不是新目录的父目录），询问用户后才调用旧卸载器，且绝不删用户数据。

## 发布前验证

发布前必须本地打开新生成的 `dist\Mineradio-oirge-版本-Setup.exe` 验证：

- 欢迎页显示中文极简样式，默认位置为 `D:\Mineradio-oirge`。
- 安装目录页输入框显示 `D:\Mineradio-oirge`。
- `浏览...` 按钮能弹出中文文件夹选择窗口。
- 验证时不要点 `安装`，确认后取消退出。
