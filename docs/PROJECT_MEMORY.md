# Mineradio Project Memory

这个文件用于解决新开 Codex 对话时“失忆”的问题。每次用户明确说“保留”“喜欢”“这个很好”“记住”“保存一下”等表达时，要把关键结论追加到这里。

## Stable Project Facts

- 当前可写代码/Git 仓库：`C:\Users\Administrator\Desktop\Mineradio-main`
- 当前环境未找到旧运行目录：`E:\桌面\播放器软件\Mineradio\resources\app`
- GitHub 仓库：`https://github.com/oirge/Mineradio.git`
- 统一备份目录：`E:\桌面\播放器软件\工作区备份`
- 当前源码检查点：`v1.2.29`
- 最近正式安装包 Release 基线：`v1.2.28`（待发布 `v1.2.29`）。
- 当前系统代理：`127.0.0.1:7897`；PowerShell / Node / electron-builder 需要显式设置 `HTTP_PROXY`、`HTTPS_PROXY`、`ALL_PROXY` 为 `http://127.0.0.1:7897`。
- 发布入口：GitHub Releases，更新检查依赖 `latest.yml` 和可选轻量补丁 JSON。
- 更新包命名规则：从 `v1.0.10` 起，快速补丁本地文件名和 GitHub Release label 使用 `Mineradio-旧版本→新版本.patch.json` 这种右箭头格式；GitHub 资产底层 `name` 可能会把 `→` 净化成点号，但更新解析仍可识别 from/to 版本。
- 快速补丁范围规则：从 `v1.0.10` 起，每次发布只为低于新版的最近 4 个版本生成补丁；更早版本不再从 `1.0.0` 开始补丁，提示用户下载完整安装包更新。
- 安装包样式：以后按 `docs/INSTALLER_STYLE.md` 的中文极简黑白蓝格式打包。

## Workspace Organization

2026-06-18 已整理工作区：

- 真正项目移动到 `E:\桌面\播放器软件\Mineradio`。
- 旧的 `editable-install`、历史 `backups`、`备份`、截图、旧计划文档和验证目录都归档到 `E:\桌面\播放器软件\工作区备份\2026-06-18-workspace-cleanup`。
- 项目内历史 `backups` 也归档到 `E:\桌面\播放器软件\工作区备份\2026-06-18-workspace-cleanup\project-internal`。
- 根目录 `AGENTS.md` 负责给新对话指路；项目内 `AGENTS.md` 负责项目规则。

## Release Memory

- `v1.2.29` 重点优化歌词字距 Unicode 游标绘制、进度拖动布局缓存与指针归属、异常拖动状态恢复和粒子批量插入/清理；视觉、歌词质感、播放控制和 3D 歌单架交互保持不变。
- `v1.2.28` 发布到 GitHub：`https://github.com/oirge/Mineradio/releases/tag/v1.2.28`
- `v1.2.28` 重点优化列表副标题/本地音质缓存键、3D 歌单架与队列签名采样、本地曲库面板/快照签名、播放进度时间格式化和引导尾迹裁剪；视觉、播放控制和 3D 歌单架交互保持不变。
- `v1.2.28` Release 资产包括：`latest.yml`、`Mineradio-1.2.28-Setup.exe`、`Mineradio-1.2.28-Setup.exe.blockmap`、`Mineradio-1.2.28-SHA256SUMS.txt`、`Mineradio-1.2.27-to-1.2.28.patch.json`；Portable ZIP 跳过。
- `v1.2.28` 安装包 SHA256：`bdc01fc7f1039a08b584d68d03f268095d0b334fa9f801b09b40c039655dbdf5`
- `v1.2.27` 发布到 GitHub：`https://github.com/oirge/Mineradio/releases/tag/v1.2.27`
- `v1.2.27` 新增独立 `268 × 58` 极简迷你播放器，不创建或加载封面，只保留歌曲文字和播放控制；原有 `public/mini-player.html`、`360 × 84` 标准版视觉与功能保持不变。设置面板和托盘菜单可切换两种样式，模式和两套拖动位置分别持久化，极简窗口 IPC 不携带封面字段。
- 2026-07-11 用户明确要求：现有标准迷你播放器不要改，新增更小且无歌曲图片的版本供切换使用。涉及 `desktop/main.js`、`desktop/preload.js`、`public/index.html`、`public/mini-player-compact.html`；后续不得把两种样式重新合并为条件渲染，也不得给极简版补回封面。
- `v1.2.27` Release 资产包括：`latest.yml`、`Mineradio-1.2.27-Setup.exe`、`Mineradio-1.2.27-Setup.exe.blockmap`、`Mineradio-1.2.27-SHA256SUMS.txt`、`Mineradio-1.2.26-to-1.2.27.patch.json`；Portable ZIP 跳过。
- `v1.2.27` 安装包 SHA256：`7e4679f7bc482302f81f8dfc96f1f61645d4cf3139bbeda219c811e35a7421c3`
- `v1.2.26` 发布到 GitHub：`https://github.com/oirge/Mineradio/releases/tag/v1.2.26`
- `v1.2.26` 修复迷你播放器长时间运行后被覆盖或无法再次显示的问题，并整合位置持久化、健康窗口轻量 Z 序恢复、锁屏/休眠暂停定时器、播放状态少解析、IPC 失败按字段重发、空队列与封面失败恢复。渲染进程首次崩溃优先重载，成功加载前再次崩溃升级为窗口重建；同时优化无歌词占位检测的临时字符串分配。
- `v1.2.26` Release 资产包括：
  - `latest.yml`
  - `Mineradio-1.2.26-Setup.exe`
  - `Mineradio-1.2.26-Setup.exe.blockmap`
  - `Mineradio-1.2.26-SHA256SUMS.txt`
  - `Mineradio-1.2.25-to-1.2.26.patch.json`
- `v1.2.26` 按用户要求只上传安装器相关资产，Portable ZIP 本次跳过。
- `v1.2.26` 安装包 SHA256：`2f016f85d776a729ac1af0554c70bbcedc653a8284e32b9f02dca1d30717d562`
- `v1.2.25` 发布到 GitHub：`https://github.com/oirge/Mineradio/releases/tag/v1.2.25`
- `v1.2.25` 新增可开关的 `360 × 84` 紧凑迷你播放器；主窗口最小化或关闭后显示当前封面、歌曲名、歌手、上一首、播放/暂停、下一首和返回主界面，恢复主窗口时自动隐藏。小窗支持拖动、置顶和多显示器工作区校正，设置面板与托盘菜单同步开关。播放控制复用主播放器状态机，元数据、封面和播放状态采用签名判重与增量 IPC，不新增常驻轮询，暂停/继续时不重复传输整张封面。
- `v1.2.25` Release 资产包括：
  - `latest.yml`
  - `Mineradio-1.2.25-Setup.exe`
  - `Mineradio-1.2.25-Setup.exe.blockmap`
  - `Mineradio-1.2.25-SHA256SUMS.txt`
  - `Mineradio-1.2.24-to-1.2.25.patch.json`
- `v1.2.25` 按用户要求只上传安装器相关资产，Portable ZIP 本次跳过。
- `v1.2.25` 安装包 SHA256：`b705b1667efa12383563971513769593aa625cb555ff6b7d08df08941d57d007`
- `v1.2.24` 发布到 GitHub：`https://github.com/oirge/Mineradio/releases/tag/v1.2.24`
- `v1.2.24` 重点优化本地歌词/文本解码、YRC 前导空白、音量拖动、播放会话持久化、连续音频事件和桌面歌词 IPC 同步；解码器复用缓存，替换字符/前导空白改为单次计数，音量存储写入合并，常规播放会话保存移到空闲时段，播放图标/控制栏/系统媒体元数据按状态判重，桌面歌曲元数据、封面签名和 39 字段歌词载荷签名复用缓存或固定缓冲区。UI、布局、文案、视觉质感、歌词效果、播放入口和 3D 歌单架交互保持不变。
- `v1.2.24` Release 资产包括：
  - `latest.yml`
  - `Mineradio-1.2.24-Setup.exe`
  - `Mineradio-1.2.24-Setup.exe.blockmap`
  - `Mineradio-1.2.24-SHA256SUMS.txt`
  - `Mineradio-1.2.23-to-1.2.24.patch.json`
- `v1.2.24` 按用户要求只上传安装器相关资产，Portable ZIP 本次跳过。
- `v1.2.24` 安装包 SHA256：`afe58e83053e924a962899910dd95dc912f380e5e2b98622ac7e39279fc392cc`
- `v1.2.23` 发布到 GitHub：`https://github.com/oirge/Mineradio/releases/tag/v1.2.23`
- `v1.2.23` 重点优化歌词解析和 3D 歌单架卡片绘字低分配路径；LRC/YRC/自定义歌词原文按行处理改为单次换行扫描，保留 CRLF、尾空行、双语合并、空歌词过滤和逐字时间轴语义；3D 歌单架卡片标题/副标题绘制不再通过 `split('')` 创建字符数组。UI、左侧歌单、播放控制、视觉质感和 3D 歌单架交互保持不变。
- `v1.2.23` Release 资产包括：
  - `latest.yml`
  - `Mineradio-1.2.23-Setup.exe`
  - `Mineradio-1.2.23-Setup.exe.blockmap`
  - `Mineradio-1.2.23-SHA256SUMS.txt`
  - `Mineradio-1.2.22-to-1.2.23.patch.json`
- `v1.2.23` 按用户要求只上传安装器相关资产，Portable ZIP 本次跳过。
- `v1.2.22` 发布到 GitHub：`https://github.com/oirge/Mineradio/releases/tag/v1.2.22`
- `v1.2.22` 重点优化桌面歌词后台轮询和桌面 UI 状态持久化低分配路径；主进程桌面歌词中键锁定轮询 stdout 解析改为流式单次扫描，保留 `MMB` 触发语义和半行缓存；桌面 UI 状态补丁写入改为 `for...in` 白名单遍历，保留字段过滤、空值删除和超大值跳过语义。UI、左侧歌单、播放控制、视觉质感和 3D 歌单架交互保持不变。
- `v1.2.22` Release 资产包括：
  - `latest.yml`
  - `Mineradio-1.2.22-Setup.exe`
  - `Mineradio-1.2.22-Setup.exe.blockmap`
  - `Mineradio-1.2.22-SHA256SUMS.txt`
  - `Mineradio-1.2.21-to-1.2.22.patch.json`
- `v1.2.22` 按用户要求只上传安装器相关资产，Portable ZIP 本次跳过。
- `v1.2.22` 安装包 SHA256：`5ea66c64011102d35cb5f9dc9405b118b5944e9c931858d84c1145ad250fe375`
- `v1.2.21` 发布到 GitHub：`https://github.com/oirge/Mineradio/releases/tag/v1.2.21`
- `v1.2.21` 重点优化播放中歌词文本处理和详情页渲染低分配路径；舞台歌词换行改为单次扫描，舞台/桌面歌词行归一化复用轻量 helper，歌手详情页评论和热门歌曲列表改为循环拼接 HTML；空白压缩、空行过滤、最大行数、省略号、按钮和点击行为保持不变，视觉、左侧歌单、播放控制和 3D 歌单架交互保持不变。
- `v1.2.21` Release 资产包括：
  - `latest.yml`
  - `Mineradio-1.2.21-Setup.exe`
  - `Mineradio-1.2.21-Setup.exe.blockmap`
  - `Mineradio-1.2.21-SHA256SUMS.txt`
  - `Mineradio-1.2.20-to-1.2.21.patch.json`
- `v1.2.21` 按用户要求只上传安装器相关资产，Portable ZIP 本次跳过。
- `v1.2.21` 安装包 SHA256：`b31bd5601c2c97b890cdebe683e43533735ef163fd00e45f751ac5432d91b293`
- `v1.2.20` 发布到 GitHub：`https://github.com/oirge/Mineradio/releases/tag/v1.2.20`
- `v1.2.20` 重点优化软件内更新面板轮询渲染；新增内容、状态和进度签名，下载/补丁状态未变化时跳过重复 DOM 文本、按钮状态、进度条 `width` 和 SVG ring offset 写入，补齐 `v1.2.19` 后端更新任务少分配优化的前端轮询侧低抖动路径；视觉、播放控制和 3D 歌单架交互保持不变。
- `v1.2.20` Release 资产包括：
  - `latest.yml`
  - `Mineradio-1.2.20-Setup.exe`
  - `Mineradio-1.2.20-Setup.exe.blockmap`
  - `Mineradio-1.2.20-SHA256SUMS.txt`
  - `Mineradio-1.2.19-to-1.2.20.patch.json`
- `v1.2.20` 按用户要求只上传安装器相关资产，Portable ZIP 本次跳过。
- `v1.2.20` 安装包 SHA256：`ebd8860c94826db65d6bac1a030fe6460c4bd803309e145f8e862104c2075669`
- `v1.2.19` 发布到 GitHub：`https://github.com/oirge/Mineradio/releases/tag/v1.2.19`
- `v1.2.19` 重点优化软件内更新任务状态查询、快速补丁复用判断和更新任务裁剪；下载/补丁状态接口改为单次扫描最新匹配项，后台只维护 8 条最新任务的小窗口，减少更新面板轮询和任务维护时的数组排序/切片分配；视觉、播放控制和 3D 歌单架交互保持不变。
- `v1.2.19` Release 资产包括：
  - `latest.yml`
  - `Mineradio-1.2.19-Setup.exe`
  - `Mineradio-1.2.19-Setup.exe.blockmap`
  - `Mineradio-1.2.19-SHA256SUMS.txt`
  - `Mineradio-1.2.18-to-1.2.19.patch.json`
- `v1.2.19` 按用户要求只上传安装器相关资产，Portable ZIP 本次跳过。
- `v1.2.19` 安装包 SHA256：`960477a0350fafd1c489cd5d10367bb2a0b255c987d445b2ef5e87bddde87417`
- `v1.2.18` 发布到 GitHub：`https://github.com/oirge/Mineradio/releases/tag/v1.2.18`
- `v1.2.18` 重点优化运行时缓存统计、本地资产内存缓存裁剪和 IndexedDB 缓存清理；缓存数量改为直接计数，trim 只排序可删除候选，删除集合同步维护 id 列表，减少后台维护任务的小分配；视觉、播放控制和 3D 歌单架交互保持不变。
- `v1.2.18` Release 资产包括：
  - `latest.yml`
  - `Mineradio-1.2.18-Setup.exe`
  - `Mineradio-1.2.18-Setup.exe.blockmap`
  - `Mineradio-1.2.18-SHA256SUMS.txt`
  - `Mineradio-1.2.17-to-1.2.18.patch.json`
- `v1.2.18` 按用户要求只上传安装器相关资产，Portable ZIP 本次跳过。
- `v1.2.18` 安装包 SHA256：`37c4372eec8cd56100dba6e23d0cf2cdb5e794e90475f5706be0baa42c04efc2`
- `v1.2.17` 发布到 GitHub：`https://github.com/oirge/Mineradio/releases/tag/v1.2.17`
- `v1.2.17` 重点优化本地封面缩略图结果缓存、缩略图生成并发缓存、封面深度缓存和歌词 fetch 缓存的队列裁剪；队首淘汰改为 head 游标推进，减少大曲库长时间滚动/后台补封面时的数组搬移和轻微 GC 抖动；视觉、播放控制和 3D 歌单架交互保持不变。
- `v1.2.17` Release 资产包括：
  - `latest.yml`
  - `Mineradio-1.2.17-Setup.exe`
  - `Mineradio-1.2.17-Setup.exe.blockmap`
  - `Mineradio-1.2.17-SHA256SUMS.txt`
  - `Mineradio-1.2.16-to-1.2.17.patch.json`
- `v1.2.17` 按用户要求只上传安装器相关资产，Portable ZIP 本次跳过。
- `v1.2.17` 安装包 SHA256：`c441fc7dca1a34c4d379baa01ccdc2c15a403ff9fcd14d76da34d83c7fcc7e57`
- `v1.2.16` 发布到 GitHub：`https://github.com/oirge/Mineradio/releases/tag/v1.2.16`
- `v1.2.16` 重点优化本地文件导入映射、资产/曲库文件签名、本地歌曲 key、ID3/FLAC 元数据解码和主进程本地曲库 stat worker 创建；视觉、播放控制和 3D 歌单架交互保持不变。
- `v1.2.16` Release 资产包括：
  - `latest.yml`
  - `Mineradio-1.2.16-Setup.exe`
  - `Mineradio-1.2.16-Setup.exe.blockmap`
  - `Mineradio-1.2.16-SHA256SUMS.txt`
  - `Mineradio-1.2.15-to-1.2.16.patch.json`
- `v1.2.16` 按用户要求只上传安装器相关资产，Portable ZIP 本次跳过。
- `v1.2.16` 安装包 SHA256：`36af95b9dd9df40e04568a4b3ebf0fd3c5a4dc5729683e81f167b21b06cb88c7`
- `v1.2.15` 发布到 GitHub：`https://github.com/oirge/Mineradio/releases/tag/v1.2.15`
- `v1.2.15` 重点优化本地整队播放批量克隆、LRC/YRC/本地歌词解析、本地节奏缓存打包/解包、封面深度缓存裁剪、搜索玻璃贴图变更检测，并修正软件内更新面板前端版本硬编码和远端 latest 偏旧时的显示倒退；视觉、播放控制和 3D 歌单架交互保持不变。
- `v1.2.15` Release 资产包括：
  - `latest.yml`
  - `Mineradio-1.2.15-Setup.exe`
  - `Mineradio-1.2.15-Setup.exe.blockmap`
  - `Mineradio-1.2.15-SHA256SUMS.txt`
  - `Mineradio-1.2.14-to-1.2.15.patch.json`
- `v1.2.15` 按用户要求只上传安装器相关资产，Portable ZIP 本次跳过。
- `v1.2.15` 安装包 SHA256：`ab0abee4751c3af3a78785ac51de812d2eb8f4d872032c2c138e93db73d89099`
- `v1.2.13` 发布到 GitHub：`https://github.com/oirge/Mineradio/releases/tag/v1.2.13`
- `v1.2.13` 重点优化本地切歌点歌到出声路径、3D 歌单详情本地库打开、本地搜索空查询、本地导入筛选/构造，以及歌曲副标题/音质文本重复格式化；视觉、播放控制和歌单架交互设计保持不变。
- `v1.2.13` Release 资产包括：
  - `latest.yml`
  - `Mineradio-1.2.13-Setup.exe`
  - `Mineradio-1.2.13-Setup.exe.blockmap`
  - `Mineradio-1.2.13-SHA256SUMS.txt`
  - `Mineradio-1.2.12-to-1.2.13.patch.json`
- `v1.2.13` 按用户要求只上传安装器相关资产，Portable ZIP 本次跳过。
- `v1.2.13` 安装包 SHA256：`84373d2259ef16e82e992e7c125e568e8d11dda45ae69b4a3e239cf07791cdd0`
- `v1.2.12` 发布到 GitHub：`https://github.com/oirge/Mineradio/releases/tag/v1.2.12`
- `v1.2.12` 重点优化本地搜索索引文本拼接、左侧本地曲库面板可见卡片渲染和 3D 歌单架签名采样，减少连续搜索、滚动加载更多和歌单架 rebuild 判断时的短命对象分配；视觉、播放和歌单架交互逻辑保持不变。
- `v1.2.12` Release 资产包括：
  - `latest.yml`
  - `Mineradio-1.2.12-Setup.exe`
  - `Mineradio-1.2.12-Setup.exe.blockmap`
  - `Mineradio-1.2.12-SHA256SUMS.txt`
  - `Mineradio-1.2.11-to-1.2.12.patch.json`
- `v1.2.12` 按用户要求只上传安装器相关资产，Portable ZIP 本次跳过。
- `v1.2.12` 安装包 SHA256：`e792948dd9502410952fc7c86fc0374966819157c89a437bff1be7662300c22a`
- `v1.2.11` 发布到 GitHub：`https://github.com/oirge/Mineradio/releases/tag/v1.2.11`
- `v1.2.11` 重点优化本地封面/歌词缓存按范围补水、后台资产预载候选复用、队列位置映射和排序少分配，以及列表入场动画只收集实际动画项；左侧歌单显示/隐藏/固定按钮和 3D 歌单架“自动隐藏/常驻”选项保持不变。
- `v1.2.11` Release 资产包括：
  - `latest.yml`
  - `Mineradio-1.2.11-Setup.exe`
  - `Mineradio-1.2.11-Setup.exe.blockmap`
  - `Mineradio-1.2.11-Portable-win-x64.zip`
  - `Mineradio-1.2.11-SHA256SUMS.txt`
  - `Mineradio-1.2.10-to-1.2.11.patch.json`
- `v1.2.11` 安装包 SHA256：`d07d0b313aaecdca41521bb0221ec2501bca98e0d502090465ae01e43bfb9741`
- `v1.2.10` 发布到 GitHub：`https://github.com/oirge/Mineradio/releases/tag/v1.2.10`
- `v1.2.10` 重点优化启动阶段大 JSON 按需读取、Home 听歌画像单次扫描、3D 歌单架大队列虚拟取项、队列/搜索/歌单详情 HTML 少分配、本地搜索池复用，以及大曲库快照/索引单次循环保存；左侧歌单常开/自动隐藏逻辑和 3D 歌单架“自动隐藏/常驻”选项保持不变。
- `v1.2.10` Release 资产包括：
  - `latest.yml`
  - `Mineradio-1.2.10-Setup.exe`
  - `Mineradio-1.2.10-Setup.exe.blockmap`
  - `Mineradio-1.2.10-Portable-win-x64.zip`
  - `Mineradio-1.2.10-SHA256SUMS.txt`
  - `Mineradio-1.2.9-to-1.2.10.patch.json`
- `v1.2.10` 安装包 SHA256：`925968ab6902e876c0acebd4cc3a2a6cd05d95c111e92fbce58528699080fd3c`
- `v1.2.9` 发布到 GitHub：`https://github.com/oirge/Mineradio/releases/tag/v1.2.9`
- `v1.2.9` 重点优化 3D 歌单架指针命中、滚轮交互、详情面板射线检测和鼠标移动布局读取；左侧歌单常开/自动隐藏逻辑和 3D 歌单架“自动隐藏/常驻”选项保持不变。
- `v1.2.9` Release 资产包括：
  - `latest.yml`
  - `Mineradio-1.2.9-Setup.exe`
  - `Mineradio-1.2.9-Setup.exe.blockmap`
  - `Mineradio-1.2.9-SHA256SUMS.txt`
  - `Mineradio-1.2.8-to-1.2.9.patch.json`
- `v1.2.9` 安装包 SHA256：`c36c125bb61db014caaa9a72e2e40e6c72f1e23769efcd2528e169f5585dbe04`
- `v1.1.0` 已发布到 GitHub：`https://github.com/XxHuberrr/Mineradio/releases/tag/v1.1.0`
- 仓库已设为公开：`https://github.com/XxHuberrr/Mineradio`
- `v1.1.0` Release 资产包括：
  - `Mineradio-1.1.0-Setup.exe`
  - `Mineradio-1.1.0-Setup.exe.blockmap`
  - `Mineradio-1.1.0-SHA256SUMS.txt`
- `v1.1.0` 安装包 SHA256：`bd53aae4e551f5b0b5a398a51e6ec1de5a9a57cb42e5eecedb0a1647fdcee6e6`
- `v1.1.0` 未上传 `latest.yml`，Release 创建时使用 `--latest=false`；GitHub `/releases/latest` 仍返回 `v1.0.10`，避免 `v1.0.10` 客户端软件内更新到 1.1.0。
- 已批量给旧 Release（`v1.0.10` 到 `v0.9.9`）正文顶部追加旧安装包隔离警示；不要删除旧资产，只标记不可信和建议隔离。
- `v1.0.10` 已发布到 GitHub：`https://github.com/XxHuberrr/Mineradio/releases/tag/v1.0.10`
- `v1.0.10` Release 资产包括：
  - `latest.yml`
  - `Mineradio-1.0.10-Setup.exe`
  - `Mineradio-1.0.10-Setup.exe.blockmap`
  - `Mineradio-1.0.6.1.0.10.patch.json`（Release label：`Mineradio-1.0.6→1.0.10.patch.json`）
  - `Mineradio-1.0.7.1.0.10.patch.json`（Release label：`Mineradio-1.0.7→1.0.10.patch.json`）
  - `Mineradio-1.0.8.1.0.10.patch.json`（Release label：`Mineradio-1.0.8→1.0.10.patch.json`）
  - `Mineradio-1.0.9.1.0.10.patch.json`（Release label：`Mineradio-1.0.9→1.0.10.patch.json`）
- `v1.0.10` 发布时 `gh` keyring token 失效，但普通 `git push` 仍可用；Release 通过 Git Credential Manager 取 GitHub token 后调用 GitHub API 创建并上传资产。
- `v1.0.9` 已发布到 GitHub：`https://github.com/XxHuberrr/Mineradio/releases/tag/v1.0.9`
- `v1.0.9` Release 资产包括：
  - `latest.yml`
  - `Mineradio-1.0.9-Setup.exe`
  - `Mineradio-1.0.9-Setup.exe.blockmap`
  - `Mineradio-1.0.0-to-1.0.9.patch.json`
  - `Mineradio-1.0.1-to-1.0.9.patch.json`
  - `Mineradio-1.0.2-to-1.0.9.patch.json`
  - `Mineradio-1.0.3-to-1.0.9.patch.json`
  - `Mineradio-1.0.4-to-1.0.9.patch.json`
  - `Mineradio-1.0.5-to-1.0.9.patch.json`
  - `Mineradio-1.0.6-to-1.0.9.patch.json`
  - `Mineradio-1.0.7-to-1.0.9.patch.json`
  - `Mineradio-1.0.8-to-1.0.9.patch.json`
- `v1.0.9` 修复安装包文字对比度，允许用户自由选择安装目录，选择盘符根目录时自动补成 `Mineradio` 文件夹；软件启动改为单实例，重复启动会唤起已运行窗口；移除每次启动都重新创建桌面快捷方式的行为。
- `v1.0.9` 安装器热修：用户实测旧安装包仍显示 C 盘 `AppData\Local\Programs\Mineradio`，原因是 electron-builder 内置目录页和旧安装注册表回填覆盖了默认路径。已关闭内置目录页，保留自定义安装目录页，并在目录页显示前强制优先使用 `D:\Mineradio`；tag 已更新到 `9d5f60c`，Release 资产已覆盖上传。
- `v1.0.9` 安装器 UI 后续热修：安装包改为中文极简风格，白底黑字，`#3257F7` 蓝色点缀；欢迎页和安装目录页都简化为中文信息、默认路径和可选目录控件。该格式已保存到 `docs/INSTALLER_STYLE.md`，以后安装包按这套方式打包。
- 补充：快速补丁可修复运行时单实例和快捷方式问题；安装器 UI/安装目录选择体验需要使用完整 `Mineradio-1.0.9-Setup.exe`。
- `v1.0.8` 已发布到 GitHub：`https://github.com/XxHuberrr/Mineradio/releases/tag/v1.0.8`
- `v1.0.8` Release 资产包括：
  - `latest.yml`
  - `Mineradio-1.0.8-Setup.exe`
  - `Mineradio-1.0.8-Setup.exe.blockmap`
  - `Mineradio-1.0.0-to-1.0.8.patch.json`
  - `Mineradio-1.0.1-to-1.0.8.patch.json`
  - `Mineradio-1.0.2-to-1.0.8.patch.json`
  - `Mineradio-1.0.3-to-1.0.8.patch.json`
  - `Mineradio-1.0.4-to-1.0.8.patch.json`
  - `Mineradio-1.0.5-to-1.0.8.patch.json`
  - `Mineradio-1.0.6-to-1.0.8.patch.json`
  - `Mineradio-1.0.7-to-1.0.8.patch.json`
- `v1.0.8` 包含 QQ 音乐播放授权修复、Home 施工卡片和控制台展开、视觉预设顺序调整、用户存档、歌词颜色重启恢复、播放/暂停淡入淡出，以及安魂十字架选中态蓝色修复。
- `v1.0.7` 已发布到 GitHub：`https://github.com/XxHuberrr/Mineradio/releases/tag/v1.0.7`
- `v1.0.7` Release 资产包括：
  - `latest.yml`
  - `Mineradio-1.0.7-Setup.exe`
  - `Mineradio-1.0.7-Setup.exe.blockmap`
  - `Mineradio-1.0.0-to-1.0.7.patch.json`
  - `Mineradio-1.0.1-to-1.0.7.patch.json`
  - `Mineradio-1.0.2-to-1.0.7.patch.json`
  - `Mineradio-1.0.3-to-1.0.7.patch.json`
  - `Mineradio-1.0.4-to-1.0.7.patch.json`
  - `Mineradio-1.0.5-to-1.0.7.patch.json`
  - `Mineradio-1.0.6-to-1.0.7.patch.json`
- `v1.0.7` 包含电影镜头快节奏节拍分析试调，以及骷髅预设改名为“安魂”、副标题“骷髅·YUI7W”、黑体卡片和更明显的自定义视觉色粒子染色。
- `v1.0.6` 已发布到 GitHub：`https://github.com/XxHuberrr/Mineradio/releases/tag/v1.0.6`
- `v1.0.6` Release 资产包括：
  - `latest.yml`
  - `Mineradio-1.0.6-Setup.exe`
  - `Mineradio-1.0.6-Setup.exe.blockmap`
  - `Mineradio-1.0.0-to-1.0.6.patch.json`
  - `Mineradio-1.0.1-to-1.0.6.patch.json`
  - `Mineradio-1.0.2-to-1.0.6.patch.json`
  - `Mineradio-1.0.3-to-1.0.6.patch.json`
  - `Mineradio-1.0.4-to-1.0.6.patch.json`
  - `Mineradio-1.0.5-to-1.0.6.patch.json`
- `v1.0.6` 将桌面歌词、桌面歌词穿透和壁纸模式入口标记为开发中并强制关闭；软件内更新日志文案改为“反正没什么人看，布想写日志了”。
- `v1.0.5` 已发布到 GitHub：`https://github.com/XxHuberrr/Mineradio/releases/tag/v1.0.5`
- `v1.0.5` Release 资产包括：
  - `latest.yml`
  - `Mineradio-1.0.5-Setup.exe`
  - `Mineradio-1.0.5-Setup.exe.blockmap`
  - `Mineradio-1.0.0-to-1.0.5.patch.json`
  - `Mineradio-1.0.1-to-1.0.5.patch.json`
  - `Mineradio-1.0.2-to-1.0.5.patch.json`
  - `Mineradio-1.0.3-to-1.0.5.patch.json`
  - `Mineradio-1.0.4-to-1.0.5.patch.json`
- `v1.0.5` 更新链路新增国内分流下载、下载速度/剩余时间显示、失败原因提示、digest 校验和更严格的补丁版本匹配。
- 2026-06-18 已确认 GitHub CLI / `gh auth refresh` 使用 `127.0.0.1:10808` 可正常登录；不要走旧代理 `127.0.0.1:26001`，该端口会 `connection refused`。需要临时修复时先清空 `HTTP_PROXY`/`HTTPS_PROXY`，再设为 `http://127.0.0.1:10808`。
- `v1.0.4` 已发布到 GitHub：`https://github.com/XxHuberrr/Mineradio/releases/tag/v1.0.4`
- `v1.0.4` Release 资产包括：
  - `latest.yml`
  - `Mineradio-1.0.4-Setup.exe`
  - `Mineradio-1.0.4-Setup.exe.blockmap`
  - `Mineradio-1.0.0-to-1.0.4.patch.json`
  - `Mineradio-1.0.1-to-1.0.4.patch.json`
  - `Mineradio-1.0.2-to-1.0.4.patch.json`
  - `Mineradio-1.0.3-to-1.0.4.patch.json`
- `v1.0.3` 已发布到 GitHub：`https://github.com/XxHuberrr/Mineradio/releases/tag/v1.0.3`
- `v1.0.3` Release 资产包括：
  - `latest.yml`
  - `Mineradio-1.0.3-Setup.exe`
  - `Mineradio-1.0.3-Setup.exe.blockmap`
  - `Mineradio-1.0.0-1.0.3.json`
  - `Mineradio-1.0.1-1.0.3.json`
  - `Mineradio-1.0.2-1.0.3.json`
- 用户明确说过：0.9 系列不要再做安装补丁，直接跳过。

## Visual And Interaction Preferences

- 用户喜欢播放器当前 SVG 玻璃质感；这是黄金版本，见 `docs/GLASS_SVG_TEXTURE.md`。
- 玻璃质感可以套到搜索栏、小按钮等区域，但不要改变播放器控制台当前质感核心。
- 透明度不能太低，否则会显得廉价；背景内容复杂时需要微弱毛玻璃和浅填充渐变避免眼花。
- UI 高亮颜色、自定义色、Home 填充/边框颜色要尽量覆盖广泛，不要只覆盖几个按钮。
- 歌手名默认白色，不要跟随自定义高亮色变得难读。
- 性能优化必须保持视觉质量、丝滑度和帧数稳定，不能把效果砍掉换低占用。
- 3D 歌单架控制台和手感边界见 `docs/3D_PLAYLIST_SHELF_MEMORY.md`。

## Important Known Sensitive Areas

- `public/index.html` 很大，主 UI、CSS、视觉预设、播放控制都在里面。改动要用 `rg` 精确定位，避免大块重写。
- 播放暂停按钮曾多次失效，涉及天气电台、下一首、歌单加载后的同步状态。修复时必须实机验证控制台按钮。
- Emily 视觉预设入场和切歌动画曾有卡顿跳帧，优化时要避免拖沓和最后一下跳跃。
- 3D 歌单架曾出现强制回星河预设、详情页遮挡、滚动卡手、按钮设计偏差等问题。
- 左侧歌单页曾因一次性加载过多导致 CPU 高和回弹刷新，后续要做虚拟化/分批渲染，不要回到全量渲染。
- 搜索栏 SVG 玻璃曾出现右侧缺失、偏移、白色渐变廉价感；修复时要检查黑底和亮底。

## How To Add New Memory

追加格式：

```markdown
### YYYY-MM-DD - 简短标题

- 用户认可/要求保留：
- 涉及文件：
- 关键参数/实现：
- 禁止回退或改坏的点：
```

## Memory Entries

### 2026-06-24 - 1.1.0 纯净安装发布边界
- 用户认可/要求保留：`v1.1.0` 从当前可信源码重新打包为纯净安装版并发布到 GitHub；旧 `v1.0.10` 及更早 `.exe` 安装包需要标记隔离，不再作为推荐安装来源。
- 涉及文件：`CHANGELOG.md`、`README.md`、`SECURITY.md`、`RELEASE.md`、`docs/SECURITY_REBUILD_2026-06-24.md`、`docs/RELEASE_NOTES_v1.1.0.md`。
- 关键参数/实现：本次不生成 `v1.0.10 -> v1.1.0` 快速补丁，不上传 `latest.yml`，GitHub Release 不作为旧版软件内更新通道 latest；用户需要手动下载 `Mineradio-1.1.0-Setup.exe` 并纯净安装。
- 禁止回退或改坏的点：不要把旧安装包重新标为可信；不要让 `v1.0.10` 客户端通过软件内更新自动拉取 `v1.1.0`；不要复用旧 `dist`、旧备份包或历史 packaged build。

### 2026-06-24 - 默认测试作为默认用户存档
- 用户认可/要求保留：`E:\Download\默认测试.json` 需要成为软件首次启用默认用户存档，并且软件内视觉参数默认值也按这份 JSON 快照初始化。
- 涉及文件：`public/index.html`、`public/default-user-fx-archive.json`。
- 关键参数/实现：`fxDefaults` 与 `PACKAGED_DEFAULT_FX_SNAPSHOT` 同步为「默认测试」；没有本地 `mineradio-lyric-layout-v1` 时 `readSavedLyricLayout()` 使用 packaged snapshot；没有本地用户存档 key 时自动创建「默认测试」存档槽位。
- 禁止回退或改坏的点：不要让首次启动回到旧青色 UI、动态自动隐藏歌单架或播客默认显示；不要覆盖已有用户本地存档，只在首次没有用户存档 key 时种入默认槽。

### 2026-06-24 - 歌单详情页歌词透明度边界
- 用户认可/要求保留：3D 歌单详情页打开时，歌词仍要保持默认可读感，不能为了避让详情页把歌词压到几乎看不见；真正目标只是不要遮挡详情页和中心高亮行。
- 涉及文件：`public/index.html`、`docs/3D_PLAYLIST_SHELF_MEMORY.md`。
- 关键参数/实现：`updateStageLyrics3D()` 使用 `shelfDetailLyricProfile` 分离文字透明度、readability、辉光、sun/spark 和退场歌词；普通详情页文字目标约 `0.38`、骷髅详情页约 `0.30`，详情页靠更低 `renderOrder` 和削弱辉光避让，而不是把正文降到 `0.055`。
- 禁止回退或改坏的点：不要恢复详情页选歌/切歌时新词或旧词突然跳亮；不要把歌词整体压成幽灵透明，也不要让发光层重新横穿并盖住详情页中心高亮行。

### 2026-06-24 - 用户存档应用必须提交播放态视觉预设
- 用户认可/要求保留：应用用户视觉存档后，跳转歌曲、切歌、播放态恢复不能回退到应用存档前的上一个视觉预设；用户不应该需要再次点击预设才能稳定。
- 涉及文件：`public/index.html`。
- 关键参数/实现：`applyFxArchiveSnapshot()` 应用存档时调用 `setPreset(targetPreset, { noSave: true, commitPlaybackPreset: true })`，同步更新 `playbackVisualPreset` 和 `startupVisualPreviewActive`；`setPreset()` 在非 `noSave` 的用户点击路径下，即使预设编号未变化也提交播放态预设并保存本地布局。
- 禁止回退或改坏的点：不要把用户存档应用只停留在 `fx.preset` 当前画面状态；切歌恢复路径 `switchPlaybackVisualToEmily()` 读取的是 `playbackVisualPreset`，任何用户明确应用/点击的预设都必须同步这个播放态值。

### 2026-06-24 - 高级性能设置和常驻歌单架实卡边界
- 用户认可/要求保留：设置里的高级性能选项需要进入本地存档和用户存档，退出软件重启后保留；直播后台保持开启后不能再进入低占用暂停。常驻 3D 歌单架默认应接近右键展开后的实卡质感，不要再是灰暗半透明幽灵卡。
- 涉及文件：`public/index.html`、`docs/3D_PLAYLIST_SHELF_MEMORY.md`。
- 关键参数/实现：高级设置新增 `fx.performanceBackground`（`auto`/`keep`/`release`）和 `fx.performanceQuality`（`eco`/`balanced`/`high`/`ultra`），与旧字段 `fx.liveBackgroundKeep` 兼容；`saveLyricLayout()`、`readSavedLyricLayout()`、`normalizeFxArchiveSnapshot()` 都要保留这些字段。常驻歌单架 `passiveAlways` 默认保持实卡亮度/透明度，但层级边界仍由 `selected`/`floatMix` 控制，未命中时不能长期压住歌词。
- 禁止回退或改坏的点：不要让高级性能设置只存在 UI、不进本地/用户存档；不要为了常驻实卡质感把歌单架永久抬到歌词上层，只有鼠标命中/选中卡片时才允许浮起到歌词前景。

### 2026-06-24 - 3D 歌单架内容开关与直播后台保持
- 用户认可/要求保留：3D 歌单架需要可单独关闭播客歌单显示；“我的歌单 + 收藏歌单”默认仍保留滚到底切页，开启合并开关后才按一条线连续滚到底；全屏模式视觉引导/热键按钮不能再被全屏 DIY 悬浮入口遮挡；高级设置里的“直播后台保持”开启后后台或最小化不能进入低占用暂停。
- 涉及文件：`public/index.html`、`docs/3D_PLAYLIST_SHELF_MEMORY.md`。
- 关键参数/实现：`fx.shelfShowPodcasts` 默认 `true`，`fx.shelfMergeCollections` 默认 `false`，`fx.liveBackgroundKeep` 默认 `false`；歌单架列表签名要包含这两个内容开关并在切换时 `shelfManager.rebuild(true)`；直播后台保持通过 `isLiveBackgroundKeepMode()` 阻断 `isDeepBackgroundMode()` 和隐藏窗口视觉降载；视觉引导使用 `body.visual-guide-active` 隐藏全屏 DIY 浮层并把 `#visual-guide` 提到更高层级。
- 禁止回退或改坏的点：不要把播客从歌单架里永久移除，也不要默认合并收藏歌单；不要让直播后台保持开启后仍把画面降到 1fps、4x4 renderer、隐藏 canvas 或强制暂停视觉；不要恢复全屏 DIY 入口遮挡视觉引导热键区域的问题。

### 2026-06-24 - 3D 歌单详情页动态/静态绑定边界

- 用户认可/要求保留：3D 歌单详情页在动态镜头模式下要继续跟随镜头；静态/固定模式才和封面粒子/画布绑定旋转移动。动态镜头 + 常驻歌单架同时开启时，封面粒子区域不能被误当成歌单架触发区。
- 涉及文件：`public/index.html`、`docs/3D_PLAYLIST_SHELF_MEMORY.md`。
- 关键参数/实现：`makeContentListManager().open()/update()` 按 `shouldUseShelfDynamicCamera('shelf-detail')` 分流，动态详情页使用 `camera.quaternion`，静态详情页使用 `particles.rotation` 绑定；常驻未 pinned 时 `isSideShelfFocusHit()`、滚轮和点击只认真实卡片命中，不再用常驻状态裸触发 shelf focus。
- 禁止回退或改坏的点：不要把动态详情页也绑到封面粒子轴上；不要恢复 `shelfAlwaysVisible()` 直接让整个画布/封面区触发 3D 歌单架 focus、滚轮或点击。

### 2026-06-24 - 歌词必须绑定封面粒子世界轴

- 用户认可/要求保留：旋转封面粒子到左上方俯视等大角度时，歌词应该和画布粒子绑定死一起运动，不能出现偏轴、过度倾斜、像绕另一个轴滑走的感觉；固定/静态歌单详情页打开时，歌词不能挡住详情页中心高亮行。
- 涉及文件：`public/index.html`、`docs/3D_PLAYLIST_SHELF_MEMORY.md`。
- 关键参数/实现：自由歌词模式使用 `particles.getWorldPosition()` 和 `particles.getWorldQuaternion()` 作为歌词组的世界位置/四元数基准，`setStageLyricViewBasisFromCameraOrQuaternion()` 传入粒子四元数时不能被相机轴覆盖；详情页打开时降低 `stageLyrics.group.renderOrder`，并把歌词正文、readability、glow、sun、sparks 压成背景弱光；详情中心高亮行强制使用更实的黑玻璃底和更高中心行 opacity，避免透明玻璃让歌词穿透。
- 禁止回退或改坏的点：不要恢复相机坐标轴 + 封面欧拉角混合的歌词姿态算法；不要让固定歌单详情页再次被发光歌词横穿遮挡，也不要把中心高亮行改回完全跟随全局透明度的状态。

### 2026-06-24 - 3D 歌单架详情页和固定角度偏好

- 用户认可/要求保留：3D 歌单架选择音方向是对的，但要更清脆，偏 PSP/机械齿轮咔哒，不要钝闷；侧向角度 `-15` 才是静态/固定时与画布粒子平行的默认朝向，动态默认仍为 `0`；歌单详情页要更大、更上，中心高亮区尽量和歌词同水平，并且跟随封面粒子/画布旋转移动，不要打开后像硬贴着镜头。
- 涉及文件：`public/index.html`、`docs/3D_PLAYLIST_SHELF_MEMORY.md`。
- 关键参数/实现：`shelfDefaultAngleForCameraMode()` 规定 dynamic=0、static=-15，`shelfAngleYManual` 只在用户手动拖动滑条后启用自定义；详情页非骷髅布局放大、上移、轻微收中，`makeContentListManager().update()` 使用 `particles.rotation` 绑定详情页旋转和轻微位置联动；动态 `shelf-detail` 镜头聚焦放轻，减少硬拉镜头。
- 禁止回退或改坏的点：不要把静态/固定默认角度改回 0；不要让详情页偏小偏下、脱离画布粒子、打开时硬跟随镜头；选择音效不要变回闷钝低频点击。

### 2026-06-24 - 3D 歌单架滚动选择音和滚轮热区

- 用户认可/要求保留：滚动选择要跟随中心卡/中心行高亮，并有类似 PSP 的清脆机械齿轮咔哒选择音；鼠标滚轮触发区不能占据封面粒子半屏。
- 涉及文件：`public/index.html`、`docs/3D_PLAYLIST_SHELF_MEMORY.md`。
- 关键参数/实现：`step()` 和详情 `scrollBy()/next()/prev()` 在中心目标变化时同步高亮并调用 `playShelfSelectTick()`；选择音用 WebAudio 合成，不引入外部二进制素材。侧栏滚轮接管使用 `isShelfWheelZone()`、真实卡片命中和详情面板/行命中，不再用半屏 `isShelfPreviewUseZone()`。
- 禁止回退或改坏的点：不要恢复滚动高亮不同步、选择完全无声、或常驻/预览状态下半屏滚轮都被 3D 歌单架抢走的问题。

### 2026-06-24 - 3D 歌单架常驻不遮挡歌词

- 用户认可/要求保留：常驻状态不能长期遮挡歌词；只有鼠标命中/选中 3D 歌单架卡片时，卡片才浮起到歌词前景并呈现高亮质感。歌单详情页打开后要保持选中行居中，页面完整显示，不能右侧被隐藏或整体偏下。
- 涉及文件：`public/index.html`、`docs/3D_PLAYLIST_SHELF_MEMORY.md`。
- 关键参数/实现：常驻未选中时 shelf group/card 降低层级和透明度；`updateShelfCardHoverSelection()` 负责同步悬停选中，`setSelected()` 必须按真实 `card.index` 匹配；选中卡片用 `floatMix` 过渡位置、缩放、亮度和 renderOrder。详情页非骷髅布局在 `shelfLayoutProfile().detail`、面板 x 偏移和 row base/intro/parallax 参数处收回居中。
- 禁止回退或改坏的点：不要恢复常驻卡片压住歌词、悬停不浮起、详情页右侧裁切或偏下不居中的状态；不要破坏固定状态下打开歌单详情和点击播放按钮的命中回退。

### 2026-06-24 - 保存 3D 歌单架控制台和手感边界

- 用户认可/要求保留：修过的 3D 歌单架控制台、常驻/静态镜头、详情页层级和歌词避让逻辑需要保存，后续不要回退到遮挡、误触、强制切预设或手感散掉的版本。
- 涉及文件：`public/index.html`、`docs/3D_PLAYLIST_SHELF_MEMORY.md`。
- 关键参数/实现：控制台保留歌单架模式、镜头模式、显示模式、独立颜色和大小/位置/景深/角度/透明度滑条；调参优先看 `shelfLayoutProfile()`、`makeShelfManager()`、`makeContentListManager()`、`setFocusZone()`。
- 禁止回退或改坏的点：不要推倒重做歌单架手感；不要恢复详情页遮挡、滚动卡手、Home 穿透、右键歌单架误唤底部控制台、shelf 重建误报歌单加载失败等旧问题。

### 2026-06-24 - 1.1.0 安全重建源码优先

- 用户认可/要求保留：火绒全盘查杀并隔离大量感染文件后，Mineradio 先走源码可信重建路线；该边界已升级为 `v1.1.0` 纯净安装发布流程，旧安装包仍不可信。
- 涉及文件：`package.json`、`package-lock.json`、`CHANGELOG.md`、`server.js`、`public/index.html`、`.gitignore`、`docs/SECURITY_REBUILD_2026-06-24.md`。
- 关键参数/实现：`v1.1.0` 作为安全重建版本；`.playwright-cli/`、`output/`、`tmp/` 不进 Git；软件内更新失败时不再自动无限切换到完整安装包，下载好的安装包需用户手动打开；发布安装包必须从当前 Git-tracked 源码重新构建并扫描。
- 禁止回退或改坏的点：不要复用旧感染环境产出的安装包；不要把旧 `dist`、旧 `node_modules`、浏览器 profile 或临时扫描资料提交到 GitHub；旧安装包需要隔离标注。

### 2026-06-22 - 保存桌面歌词白底/黑底可读视觉效果

- 用户认可/要求保留：当前桌面歌词白底可读效果“很好”，需要记录保存，后续不要再改成灰黄分层、绿色方片或遮挡后台操作的版本。
- 涉及文件：`public/desktop-lyrics.html`、`desktop/main.js`、`desktop/overlay-preload.js`、`docs/DESKTOP_LYRICS_VISUAL.md`。
- 关键参数/实现：歌词字心必须保持软件内歌词/预设原色；白底可读性只用 `.lyric-viewport` 外层中性 `drop-shadow(0 1px 2.4px rgba(4,6,12,.58)) drop-shadow(0 0 4.8px rgba(4,6,12,.30))` 和 `.line` 极细白描边 `-webkit-text-stroke:.18px rgba(255,255,255,.72)`；锁定态由主进程保持鼠标穿透，中键锁定/解锁通过 `GetAsyncKeyState(4)` + 歌词热区处理。
- 禁止回退或改坏的点：不要恢复 `mix-blend-mode`、`difference`、`multiply`、`.line::before`、`.line::after` 对比层；不要用重暗描边/伪文字层把歌词染灰染黄；锁定态不要重新捕获鼠标导致遮挡后台操作；改桌面歌词前先读 `docs/DESKTOP_LYRICS_VISUAL.md`。

### 2026-06-22 - 情绪节奏音效大师方案记忆

- 用户认可/要求保留：情绪节奏音效大师先作为后续开发方案保存，之后可直接调用本方案继续实现。
- 涉及文件：后续预计涉及 `dj-analyzer.js`、`public/index.html`、`server.js`（如需缓存/接口），当前仅记录方案。
- 关键参数/实现：自研本地引擎，不依赖网易云私有音效接口；分析 BPM、鼓点置信度、kick/snare/onset、能量曲线、段落变化、drop、低频比例、亮度、人声密度、动态范围；输出 `energy/aggression/groove/space/brightness/warmth/stability` 等情绪节奏参数；音效层使用 WebAudio 的轻量 EQ、动态压缩、限幅、轻微饱和、空间宽度，默认“自动·轻微”，带原声 A/B 和一键关闭；视觉电影镜头读取同一情绪节奏结果，电子歌偏 kick 锁拍，摇滚偏军鼓/段落爆发，阴郁歌偏慢推镜和粒子呼吸。
- 禁止回退或改坏的点：不要依赖网易云不可控私有音效模型；不要默认强处理导致原曲削波、音量跳变或听感变闷；必须有音量匹配、防削波、CPU 上限、失败回退原声和单曲关闭能力。第一阶段优先做“分析层 + UI 状态展示 + 保守 EQ/压缩”，确认听感后再接电影镜头。

### 2026-06-22 - 播放器控制台音质按钮位置审美

- 用户认可/要求保留：音质按钮应放在播放器控制台左侧歌曲信息区，位于歌名/歌手信息右侧；不要再塞回右侧模式按钮区。
- 涉及文件：`public/index.html`。
- 关键参数/实现：`#quality-control` 位于 `.control-cluster.actions` 内，紧跟 `.control-track` 之后；右侧 `.control-cluster.modes` 只保留歌词、音量、隐藏/沉浸/全屏/时间等模式控制。
- 禁止回退或改坏的点：右侧控制区不要再次被音质按钮挤爆；左侧按钮要像歌曲信息的状态胶囊，固定尺寸、轻量、和歌名保持呼吸感，不能压坏歌名省略与控制台平衡。

### 2026-06-22 - 保存安装包中文极简格式

- 用户认可/要求保留：当前安装包格式以后继续沿用，中文极简、黑白为主、蓝色点缀。
- 涉及文件：`build/installer.nsh`、`build/installerHeader.bmp`、`build/installerSidebar.bmp`、`docs/INSTALLER_STYLE.md`。
- 关键参数/实现：白底 `#FFFFFF`、主文字 `#111217`、弱文字 `#4B5263`/`#6B7280`、蓝色 `#3257F7`；自定义欢迎页和自定义安装目录页；默认 `D:\Mineradio`；`浏览...` 必须可用。
- 禁止回退或改坏的点：不要恢复红色 MR、深色大卡片、英文大段说明、复杂装饰；不要改回 electron-builder 原生目录页导致 C 盘旧路径回填；发布前必须打开安装器验证默认路径和浏览按钮。

### 2026-06-21 - 新对话交接文件

- 用户认可/要求保留：当前窗口对话变卡时，使用固定交接文件承接上下文。
- 涉及文件：`docs/HANDOFF_NEXT_CHAT.md`。
- 关键参数/实现：新对话先执行文件内 PowerShell 命令，读取 `AGENTS.md`、`docs/PROJECT_MEMORY.md` 和 `docs/HANDOFF_NEXT_CHAT.md`。
- 禁止回退或改坏的点：不要把真实代码目录改回旧外层源码目录；不要忘记 GitHub 代理端口 `127.0.0.1:10808`。

### 2026-06-21 - 软件内更新日志轻量文案

- 用户认可/要求保留：以后软件内更新日志写成“反正没什么人看，布想写日志了”。
- 涉及文件：`CHANGELOG.md`、GitHub Release body、软件内更新弹窗读取的 release notes。
- 关键参数/实现：正式发布时优先使用这句短文案，不再为小版本写长篇更新说明。
- 禁止回退或改坏的点：不要在用户未要求时恢复大段软件内更新日志。

### 2026-06-18 - 保存播放器 SVG 玻璃质感

- 用户认可/要求保留：播放器控制台当前 SVG 玻璃质感，后续要作为其它面板/按钮的参考基线。
- 涉及文件：`public/index.html`、`docs/GLASS_SVG_TEXTURE.md`
- 关键参数/实现：`#mineradio-control-glass-filter`、`generateControlGlassDisplacementMap()`、`--saved-panel-glass-*`、`--saved-button-glass-*`。
- 禁止回退或改坏的点：不要改成普通毛玻璃；不要把中心做成一团糊；不要让右侧缺块、整体右偏或廉价白渐变重新出现。

### 2026-06-18 - 建立干净工作区和新对话接力规则

- 用户认可/要求保留：工作区根目录保持清晰，项目叫 `Mineradio`，备份统一进入 `工作区备份`。
- 涉及文件：根目录 `AGENTS.md`、项目 `AGENTS.md`、本文件、用户技能 `mineradio-project-memory`。
- 关键参数/实现：新对话先读取项目说明；遇到“保留/喜欢/记住”类表达时更新本文件。
- 禁止回退或改坏的点：不要再把项目藏回 `editable-install\...\resources\app`；不要把散落备份重新放到根目录。

### 2026-06-18 - 将 win-unpacked 设为 Mineradio 主运行目录

- 用户认可/要求保留：用户实际检查软件靠 `win-unpacked` 里的 `Mineradio.exe`，所以 `win-unpacked` 已提升为 `E:\桌面\播放器软件\Mineradio` 主目录。
- 涉及文件：`E:\桌面\播放器软件\AGENTS.md`、`E:\桌面\播放器软件\Mineradio\AGENTS.md`、`AGENTS.md`、本文件。
- 关键参数/实现：真实代码/Git 仓库移动到 `E:\桌面\播放器软件\Mineradio\resources\app`；可运行程序在 `E:\桌面\播放器软件\Mineradio\Mineradio.exe`。
- 禁止回退或改坏的点：以后不要修改外层旧源码路径；改代码必须进入 `resources\app`，否则用户打开 exe 看不到效果。
- 补充：运行版 `node_modules` 可能没有打包依赖；发布前如缺少 `electron-builder`，在 `resources\app` 里执行 `npm install`。

### 2026-06-18 - 保留最小化内存优化边界

- 用户认可/要求保留：用户确认当前内存优化处理很好，可以在最小化/窗口隐藏时尽量降低占用。
- 涉及文件：`desktop/main.js`、`public/index.html`。
- 关键参数/实现：Electron 保持后台节流能力并向前端回传 `isMinimized/isVisible/isFocused`；前端只在 `document.hidden`、窗口最小化或不可见时进入 `render-deep-sleep` 与低帧渲染。
- 禁止回退或改坏的点：不要再因为窗口失焦、放在副屏或非焦点状态就降低帧率、降低 DPR 或弱化电影镜头；非焦点可见窗口应保持正常视觉运行。

### 2026-06-21 - 止痛の骷髅点云审美边界

- 用户认可/要求保留：骷髅预设点云要贴合模型表面、分布均匀规整，有清晰建模轮廓，不要回到散乱、不均匀、星尘式随机点云感。
- 涉及文件：`public/index.html`、`public/assets/skull-decimation-points.bin`
- 关键参数/实现：优先使用带下颌/下牙单独标记点的点云资产，让下颌张嘴由标记点旋转完成；粒子动效只做轻微呼吸、音律振幅和伦勃朗式明暗变化，不做大范围随机飘散。
- 禁止回退或改坏的点：不要用假黑影或随机粒子堆去伪造嘴巴；不要牺牲点云规整性换取“热闹”的背景星河效果。

### 2026-06-21 - 保留止痛の骷髅低角度仰视回正

- 用户认可/要求保留：骷髅预设双击回正角度已确认“很好”，后续不要回退成正面平视或歪斜侧视。
- 涉及文件：`public/index.html`
- 关键参数/实现：`SKULL_MODEL_BASE_ROTATION_X = -0.26`、`SKULL_MODEL_SCALE = 2.34`、`SKULL_MODEL_BASE_POSITION.y = 0.22`；默认骷髅相机 `pos=(0,-2.52,4.98)`、`look=(0,-0.20,0.02)`，保持低机位仰视压迫感。
- 禁止回退或改坏的点：不要把双击回正改回平视；不要让歌词从嘴部锁定跳到普通镜头歌词位置；3D 歌单架打开时应使用左侧大骷髅近景、右侧偏中歌单架构图。

### 2026-06-21 - QQ 音乐接口播放授权排障记录

- 用户认可/要求保留：保存这次 QQ 音乐接口修复记录；以后遇到 QQ 登录后头像/昵称异常、歌单能读但歌曲不能播、`104003` 等同类问题，优先按本记录排查。
- 涉及文件：`docs/QQ_MUSIC_INTERFACE_NOTES.md`、`server.js`、`desktop/main.js`、`public/index.html`。
- 关键参数/实现：区分网页账号态 `p_skey` 和播放票据 `qm_keyst`/`qqmusic_key`/`music_key`/`wxskey`；`/api/qq/login/status` 返回 `playbackKeyReady`；缺播放票据时 `104003` 归类为 `login_required`；昵称头像用 `ptnick_*` 和 `qlogo.cn` 兜底。
- 禁止回退或改坏的点：不要再把 `p_skey` 当作完整 QQ 音乐播放授权；不要因为 QQ 资料接口 `code:1000` 就清空头像/昵称或标记未登录；修 QQ 播放前先读 `docs/QQ_MUSIC_INTERFACE_NOTES.md`。
