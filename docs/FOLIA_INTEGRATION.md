# Folia 本地播放器构建与测试

当前集成以 Mineradio `2.3.2` 源码为宿主，Folia `0.7.16` 为界面来源。Folia 的来源记录在 `vendor-src/folia/MINERADIO-UPSTREAM.json`，其中记录的上游 main commit 为 `d824c0b854e54d5411cb072092999823e9bd7071`，取材日期为 2026-10-10。这个记录表示取材基线，集成目录内另含本地适配修改。

## 运行边界

- `public/folia-host.js` 和 `public/folia-host.css` 将 `/vendor/folia/index.html?host=mineradio&surface=local-player-v3` 嵌入 Mineradio。桥接协议见 `docs/FOLIA_BRIDGE.md`。
- 播放、曲库、队列、歌单及持久化由 Mineradio 管理；Folia 通过本地 frame bridge 请求这些操作。
- `vendor-src/folia` 保存 Folia 源码与锁文件，`public/vendor/folia` 保存可运行的静态产物。浏览器构建只运行 `vite.mineradio.config.ts`，不启动 Folia 的 Electron、Docker、同步服务或上游在线音乐后端。
- 入口是 `src/mineradio/local-entry.tsx`，只挂载本地播放器，复用 Folia 的原版歌词渲染器、背景、悬浮 Polaroid 唱片墙、Lattice 封面拼贴墙与视觉参数面板。保留本地曲库、收藏、歌单、队列、导入、播放控制和文件信息。
- 不加载 `App.tsx` / `bootstrap.tsx`、首页导航、在线歌曲、登录、Navidrome、同步、AI、OBS、Stage 或 Folium 模组；不是用 CSS 隐藏整套应用。声音输出继续使用 Mineradio 的音频链。
- 构建生成 `local-player-build.json`，记录实际打包源码模块；完整应用入口或禁止模块进入依赖图会直接构建失败。播放器偏好与视觉设置使用独立 `mineradio-*` 存储键，并经宿主保存到桌面用户档。
- 构建适配边界：Folium 扩展槽返回空值、独立视频层不挂载；背景 registry 只导入五种本地背景；视觉资产使用独立小型缓存，不牵引上游歌曲/会话数据库。14 种内置歌词 renderer 的布局、动画和着色公式保持上游实现。

## 本地播放界面与效果范围

顶部可切换 `lyrics`（歌词）、`records`（悬浮唱片）和 `posters`（封面拼贴）三种视图，选择保存在 `mineradio-folia-local-visuals-v1`。这些视图共享宿主曲库和同一条音频链；切换视图只替换视觉组件，不创建额外的 Audio、AudioContext 或 Folia 播放会话。

- **悬浮 Polaroid 唱片墙**：`LocalRecordWall` 复用上游 `PolaroidCard`、六边形坐标/视口与卡片帧样式计算，保留卡片正反面、翻转入场、中心放大/边缘衰减、拖动惯性和滚轮弹簧。点卡片居中，中心播放按钮或 Enter 播放；方向键移动焦点，`+` 通过宿主 `addToQueue` 入队。底部使用原 `FloatingPlayerControls` 悬停展开胶囊与 `SlideActionButton` 列表/滑动搜索按钮。歌单选择和本地搜索只查询宿主目录。
- **Lattice 封面拼贴墙**：`LocalPosterWall` 直接使用上游 `PosterWall`、相机/重排逻辑、当前歌曲聚焦、歌词画布和原播放进度控件。收藏、切歌、队列等动作由本地适配控件发送给宿主。暗角、灯光、换歌自动聚焦及封面染色偏好独立存入 `mineradio-folia-local-lattice-v1`。
- **歌词与背景**：保留 Classic、Partita、Tempera、Lumiere、Cadenza、Fume、Claddagh、Cappella、Tilt、Diorama、Monet、Pendolo、Sonnet、Still 共 14 种原 renderer，以及 Common、Latent、Sora、Monet、Nomand 五种本地背景。12 个在上游提供设置面板的歌词模式直接使用其原面板；Cadenza 和 Still 的上游 entry 未提供独立设置面板。支持主题、字号、译文和各模式已有参数。
- **图像素材**：Cappella 自定义表情/头像、Monet 人像、背景图片通过本地图片选择与清除操作接入原 renderer；Tempera 图层图片沿用其原素材控件。素材使用独立 `mineradio-folia-visual-assets-v1` IndexedDB 缓存及可释放的图片 Blob URL，不进入歌曲数据库或新增音频源。

两种墙共用 `wallCatalog.ts`，按每页最多 1000 条从 `listTracks` 读取当前本地集合，再由原视觉组件进行视口裁剪；`HostTrack` 映射保留宿主稳定 ID，时长仅在转换为上游展示结构时从秒转为毫秒。点击歌曲传递完整 `playlistId`，不把显示页重建成播放队列。

卡片的在线可用性/目录引用、进度扩展槽、Lattice 应用动作及播放器教程入口均通过仅用于嵌入构建的边界适配；不挂载完整 `GridView` 应用控制器、上游目录资源服务、Ponder 引导或在线 provider。以上是本轮源码接线范围；两种墙、素材和组合交互的验收结果需单独记录，不能以此前歌词播放器验收替代。

## 环境与依赖

在 Mineradio 源码根目录运行命令。使用 Node.js 24 或更新版本；上游 `package.json` 要求 `node >=24.0.0`，桥接 `.mjs` 测试也直接加载 TypeScript 源码。

```powershell
npm ci --no-audit --no-fund
npm ci --prefix vendor-src/folia --ignore-scripts --no-audit --no-fund
```

根目录安装提供 Electron、electron-builder、rcedit 及 `uiohook-napi`。根目录安装不要添加 `--ignore-scripts`，否则 Electron 可执行文件可能尚未下载。Folia 使用独立的锁文件安装构建依赖；这里禁用依赖安装脚本，避免为嵌入界面额外准备上游桌面程序。

某些 npm 配置会阻止依赖安装脚本，即使根目录 `npm ci` 成功也可能没有 `node_modules/electron/dist/electron.exe`。遇到这种情况，只运行已锁定 Electron 包的安装脚本并核对产物：

```powershell
if (-not (Test-Path -LiteralPath 'node_modules/electron/dist/electron.exe' -PathType Leaf)) {
    node node_modules/electron/install.js
    if ($LASTEXITCODE -ne 0) { throw 'Electron runtime installation failed' }
}
if (-not (Test-Path -LiteralPath 'node_modules/electron/dist/electron.exe' -PathType Leaf)) {
    throw 'Electron runtime is missing; check ELECTRON_SKIP_BINARY_DOWNLOAD and download logs'
}
```

这个步骤只补 Electron 运行时，不需要修改全局 npm 脚本授权。若设置了 `ELECTRON_SKIP_BINARY_DOWNLOAD=1`，先在用于桌面打包的当前终端取消该设置；仅跑静态检查和单元测试的环境可以继续跳过运行时下载。

2026-10-10 的初始环境检查为 Node.js `24.18.0`、npm `11.16.0`，Folia 的 Vite 已存在，根目录依赖尚未安装。此项是检查时的状态，不代表交付后的安装状态。

## 校验与构建

```powershell
npm test
npm run build:folia
npm run check:folia
node --check server.js
git diff --check
```

`npm test` 同时覆盖 `tests/*.test.js` 和 `tests/*.test.mjs`，包括 bridge 的真实 TypeScript client 测试。`build:folia` 会重建整个 Folia 静态目录，保留 AGPL 全文和上游来源记录，并检查入口引用的本地文件。`check:folia` 只检查现有产物、来源记录和许可证是否完整，不重建文件，也不证明产物与所有源码修改同步。

GitHub Verify 和 Release 工作流使用 Node.js 24，并分别安装根目录与 Folia 的锁定依赖。Verify 构建嵌入界面后执行 `.js` 与 `.mjs` 测试；Release 在打包前确认 Electron 运行时存在。工作流文件的更新不触发发布，Release 仍按原有手动流程执行。

本地 Windows x64 目录测试版：

```powershell
npm run build:win:dir -- --x64 --config.directories.output=dist-folia-test
```

该命令的 `prebuild:win:dir` 自动重建 Folia，避免把旧界面放进新桌面包。产物入口为 `dist-folia-test/win-unpacked/Mineradio-oirge.exe`。`build/after-pack.js` 从本机 rcedit 或 electron-builder 缓存中选取工具，给此可执行文件注入图标与版本资源；它不负责安装程序或发布。

本地安装器命令为 `npm run build:win -- --x64`。两个 Windows 构建脚本默认都带 `--publish never`。此前本机验证沿用 2.3.2；用户于 2026-10-10 授权发布 GitHub 新版，本次以 2.4.0 随源码、tag 和 Release 发布。普通自动化验收仍使用隔离用户档。

## 隔离启动

打包程序默认使用正式版的主用户档。测试启动时显式设置独立实例环境变量，避免占用正式版曲库、设置、单实例锁和快捷方式：

```powershell
$env:MINERADIO_INSTANCE_ID = 'folia-test'
$env:MINERADIO_NO_DESKTOP_SHORTCUT = '1'
Start-Process -FilePath (Join-Path $PWD 'dist-folia-test/win-unpacked/Mineradio-oirge.exe') -WindowStyle Hidden
Remove-Item Env:MINERADIO_INSTANCE_ID
Remove-Item Env:MINERADIO_NO_DESKTOP_SHORTCUT
```

此命令用于需要启动桌面验证时；打包本身不会启动它。隔离档位于 `%APPDATA%\Mineradio-folia-test`。实现读取 `MINERADIO_INSTANCE_ID` 环境变量，不支持用 `--instance=...` 替代。退出后仍保留测试档案，便于复测。不要将测试包覆盖到现有安装目录；无环境变量双击该 exe 会选择正式主档。

运行验收至少检查：独立本地播放器完成加载、无完整应用导航、切换回 Mineradio 后播放不中断、导入小型测试曲库、播放/暂停/切歌/跳转、收藏与歌单双向同步、歌词、视觉模式切换、关闭并重新打开后的状态恢复。本轮还需检查三视图往返、卡片居中/入队、拼贴墙聚焦/缩放/歌词、两墙使用同一宿主音频、12 套原参数面板与图片导入/清除/恢复。浏览器命令为 `python scripts/verify-folia-browser.py`（`FOLIA_TEST_URL` 指向隔离测试服务器）。应分别记录单元测试、浏览器测试和真实 Electron 测试的结果。

## 源码与声明

Folia 的 `LICENSE` 与 `MINERADIO-UPSTREAM.json` 随 `public/vendor/folia` 一起进入桌面产物。Folia 原有作者、依赖、许可证及锁文件保留在源码目录；本地修改没有把 Folia 重新标记成宿主的 GPL 许可。

当前 electron-builder 的 `files` 清单包含编译后的 `public` 目录，不包含 `vendor-src/folia` 和本文件。移交源码时需保留完整 `vendor-src/folia`、根目录 `scripts/build-folia.js`、桥接源码、两个项目的锁文件及本说明；排除 `node_modules`、缓存和构建输出。二进制包不能代替这份可重建的源码材料。

## 2026-10-10 首轮本地播放器交付验证

以下记录属于加入两种墙之前的本地歌词播放器交付，不表示本轮新增墙视图和素材操作已通过验证。

- 定向宿主/客户端/原适配器/导航/资源释放/备份回归 66 项通过；独立歌词与频谱数据单测 6 项通过，独立入口 TypeScript 检查无诊断。
- 真实浏览器验证了搜索、筛选队列、播放/暂停/跳转/切歌、收藏、音量、歌单 CRUD、14 种歌词效果、5 种本地背景、主题、隐藏卸载、两界面往返及子页面刷新后的偏好恢复。页面异常和 console.error 为 0，子页面 Audio/AudioContext 创建数为 0。
- 模式切换给 `VisualizerRenderer` 使用模式 key，保证更换懒加载模式时卸载旧 Suspense 边界，避免隐藏的旧 Pixi 画布继续触发 ResizeObserver。渲染公式保持上游实现。
- Windows headless 验收显式使用 SwiftShader；默认 GPU 后端在本机可能使宿主 Three r128 的 shader 编译失败。真实 Electron 隔离档另行检查，标题栏入口、本地库、14/5 效果选项与返回操作通过。
- 2.3.2 安装器覆盖 `D:\Mineradio-oirge`，退出码 0；安装后的 app.asar 与已验证构建 SHA-256 一致。首次启动前，`library.db`、`desktop-shell-settings.json`、`desktop-ui-state.json` 的 SHA-256 均与安装前一致；随后启动正式应用。
- 证据位于本机 `verification/folia/acceptance.json`、`desktop-smoke.json` 与 `install-verification.json`，该目录不进入 Git 或安装包。本次没有发布新版本。


## 两墙与完整歌词设置补充

- 新增三视图切换，复用原 Polaroid、悬浮播放胶囊、Lattice 的布局、镜头、歌词画布和播放条；12 个上游专属参数面板及本地图片素材入口已接通，14 个 renderer 保持原公式。
- 收藏和元数据变更保留墙实例、相机与选中项，按歌曲 ID 复用未变化数据。新增 5 项数据协调回归覆盖刷新、收藏、封面修改、排序/删除和过期响应。
- 浏览器确认 14 种歌词、5 种背景、Monet 导入图片及刷新恢复；20 首本地测试曲库的唱片拖动、拼贴播放/跳转、收藏不重置以及灯光偏好恢复通过；页面/console 错误和子页音频实例为 0。首轮扩充曲库计数假设错误，修正文件导入替换语义后，两墙独立验收通过，证据在 `verification/folia/delivery-acceptance.json` 与 `wall-acceptance.json`。
- 桌面验收暴露原 `/vendor/` 的七天缓存也作用于 HTML；入口改为 `surface=local-player-v3` 绕过既有缓存，HTML 与构建清单改为 `no-cache`，带哈希文件名的静态资源继续保留缓存。不得仅清理测试档缓存后宣称用户更新已修复。
- 缓存修复后，使用保留旧 Chromium 缓存的同一 Electron 隔离用户档复测，通过三视图切换、14/5 选项和返回操作，页面错误为 0。真实 HTTP 缓存测试 5/5，通过 HTML/清单 no-cache、哈希 JS/CSS 长缓存及 304 验证。证据：`desktop-smoke.json`、`cache-acceptance.json`。
- 本轮安装器退出码0，覆盖 `D:\Mineradio-oirge`；installed app.asar与server.js/package.json均匹配已验证构建，正式应用已启动并正常响应。安装前后library.db与desktop-shell-settings.json哈希一致；desktop-ui-state仅updatedAt和播放会话记录随退出更新。证据：`wall-install-verification.json`。版本仍2.3.2，未发布Release。


## 标题栏整理

导航必须相对整个窗口水平居中，不能在扣除右侧窗口按钮的剩余区域内居中。宿主槽使用 `left:50%` 与自身 `translateX(-50%)`；1100px及以下仅收紧导航和右侧文字按钮间距，保持窗口中心基准。全屏与浏览器导航的左右边界对称。

居中修复浏览器验收覆盖1440/1387/1101/1100/1024/960px，导航中心误差均为0；960px与右侧按钮仍有11.94px间距。安装器退出码0，安装内容与已验证构建一致；本轮桌面CDP启动被自动审批拦截，因此未将上一轮desktop-smoke结果作为本轮复测结果。安装后正式主窗口恢复显示并验证响应，证据 `center-install-verification.json`、`center-window-verification.json`、`center-visible-windows.json`。

按用户截图，三视图、音乐库、效果与沉浸按钮使用 React portal 放进 Mineradio 44px 桌面标题栏，保持同一份播放器状态；删除子页重复的 Mineradio 返回按钮。桌面切换仅显示 Folia/Mineradio，两态颜色一致；全屏与浏览器模式在页面顶部显示导航并保留外层切回入口。验证1440/960px不覆盖窗口按钮，跨文档portal操作、三视图、面板与全屏往返通过，音频实例不变；真实Electron复测通过。证据 `titlebar-integration.json`、`desktop-smoke.json`。
