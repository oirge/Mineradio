# Mineradio AI Handoff

这个文件是给后续接管本工作区的 AI 看的。每次完成一个任务后，都要更新本文件的「工作日志」和「未完成事项」，让下一位接手者能快速知道用户偏好、当前状态和最近做过什么。

## 当前权威入口（2026-07-26）

- 当前可写代码/Git 仓库是 `C:\Users\oirg\Desktop\mok\Mineradio-sync`。
- 本轮检查时旧规则里的 `E:\桌面\播放器软件\Mineradio\resources\app` 不存在；不要盲目切去旧路径。
- 当前源码版本是 `v1.2.44`，最新提交以 `git log --oneline -5 --decorate` 为准。
- `v1.2.44` 已发布到 GitHub Release 并设为 Latest：`https://github.com/oirge/Mineradio/releases/tag/v1.2.44`（tag 提交 `9bba136`，分支 `codex/release-1.2.44-memory` 已推送）；远端资产已核对一致。
- GitHub 仓库：`https://github.com/oirge/Mineradio`
- `package.json` 的发布配置和软件内更新配置均指向 `oirge/Mineradio`。
- 新对话优先读 `AGENTS.md`、`docs/PROJECT_MEMORY.md`、`docs/HANDOFF_NEXT_CHAT.md`；涉及 3D 歌单架、玻璃 SVG、发布或安装包时再读对应专项文档。本文件下面包含较早历史记录，不能覆盖上述文件的当前结论。

## 用户偏好

- 默认用中文沟通，语气直接、清楚、偏实干。
- 用户希望你主动完成任务，不要只给方案。能本地验证就本地验证。
- 除非用户明确要求“上传 GitHub / 推送 / push / 发布到 Release”，否则不要直接上传或推送到 GitHub；本地提交也要在最终说明里讲清楚。
- 用户很在意视觉质感，尤其讨厌“默认白框”“太素”“没设计感”。Mineradio 视觉方向偏黑色、玻璃、舞台、音乐可视化。
- 做网页、软件界面、安装器时，要优先考虑第一次打开的新用户是否知道软件是干什么的。
- 发布软件时，不能只上传源码。GitHub Release 通常要包含可运行安装包 exe；但 `v1.1.0` 安全发布例外，不上传 `latest.yml`，避免旧版软件内更新直接拉取。
- 安装器默认安装目录优先使用 `D:\Mineradio`，并创建桌面快捷方式。
- 更新逻辑优先轻量快速补丁；完整安装包作为兜底。
- 搜索结果要尽量优先原唱/官方版本，不希望翻唱排在原唱前面。
- 感谢名单曾确认：`emily、小天才e宝、应春日、锋将军、軌跡、林中、骊、风痕、花椰菜🥦`。

## 工作区地图

- `server.js`：本地 API、网易云代理、搜索、首页数据、更新检查、完整安装包下载、快速补丁应用。
- `public/index.html`：主界面和大部分前端逻辑，体量很大，修改前先用 `rg` 定位。
- `desktop/`：Electron 主进程、preload、窗口和系统集成。
- `build/`：应用图标、NSIS 安装器脚本、安装器视觉资源、after-pack 资源注入。
- `dist/`：本地构建产物，已被 git 忽略。根部只放当前发布资产。
- `updates/`：软件运行时更新区，已被 git 忽略。下载和补丁备份分开。
- `backups/`：人工归档/历史实验备份，已被 git 忽略。不要和 `updates/` 混用。
- `node_modules/`：依赖目录，通常不要手动整理。

## 本地分区约定

### dist 发布区

`dist` 根部只保留当前可发布资产。发布前必须确认安装包、blockmap、`latest.yml`、版本号和 GitHub Release 资产一致：

- `Mineradio-<version>-Setup.exe`
- `Mineradio-<version>-Setup.exe.blockmap`
- `Mineradio-<from>-to-<to>.patch.json`

其它内容放到：

- `dist/_archive/previous-releases/`：旧安装包和旧 blockmap。
- `dist/_archive/inconsistent-builds/`：和 `latest.yml` 不匹配的构建，保留但不用于发布。
- `dist/_previews/`：截图、安装器预览、图标预览。
- `dist/_logs/`：builder debug 等构建日志。

### updates 更新区

- `updates/downloads/`：运行时下载的完整安装包或更新资产。
- `updates/backups/patches/`：快速补丁覆盖文件前的备份。
- `updates/tmp/`：临时文件。

对应代码常量在 `server.js`：

- `UPDATE_WORK_DIR`
- `UPDATE_DOWNLOAD_DIR`
- `UPDATE_PATCH_BACKUP_DIR`

### backups 备份区

- `backups/public-html/`：历史前端实验 HTML。
- `backups/tool-cache/`：本地工具缓存或历史缓存文件。

这个目录是人工归档区，不参与软件更新流程。

## 已完成工作日志

### 2026-07-19

- 完整安装包校验改为固定 1 MiB 缓冲区流式扫描，单次同时计算 SHA-256/SHA-512，不再通过 `fs.readFileSync()` 额外分配安装器等大的 Buffer；新增 `tests/update-file-verification-memory.test.js` 覆盖整文件读取禁令、单块上限和文件描述符关闭。
- FLAC 标签读取改为 descriptor 精确扫描：标准文件先读 8 字节，probe 外只读 4 字节 block header，按声明长度跳过 PADDING，只读取实际需要的 Vorbis/PICTURE payload；多个 Vorbis、损坏 PICTURE 后继续查找、light/full 所有权和短读语义均有纯 Node 回归。
- 修复空曲库无法取消旧后台资产任务：启动请求统一递增 token、取消旧启动定时器并清空旧私有排序队列；在途单曲 I/O 返回后再次校验所有权，不再污染新进度或触发旧 UI 刷新。新增 `tests/local-library-background-cancellation.test.js` 覆盖排队和在途两种时序。
- 已播放本地歌词原文改为精确当前对象播放租约：切歌和清队列释放旧 raw，同 key 新对象可接管；曲库/歌单副本不再广播持有 `localLyricText`。迟到文件读取或 IndexedDB 水合完成后会持久化并清除旧对象，缓存 debounce 在调度时捕获歌词快照，后续轻量写入合并待写或已落盘原文。`tests/local-lyric-cache-residency.test.js` 现覆盖 12 项驻留、恢复和竞态行为。
- 本轮所有测试继续使用 `BelowNormal` 与 `--test-concurrency=1`；未启动 Electron、浏览器、服务或后台轮询；未提交、未推送、未发布。

### 2026-07-18

- 原歌词状态改为单一只读对象图：`setOriginalLyricsState()` 仍深克隆一次隔离解析输入，`applyLyricsState()` 激活时直接借用该快照；从自定义歌词切回原词不再为每行和每个 YRC `words` 词项重新创建对象。
- 新增 `tests/lyrics-state-residency.test.js` 纯 Node 行为回归，验证输入隔离、原快照与激活态引用共享、原生逐字标记/时间来源保持，以及自定义状态切回原词时继续复用同一快照。
- 普通本地封面 Blob URL 改为可见读取时懒创建；音频 URL 由 `assignLocalSongUrl()` 同步给同 `localKey` 的活跃副本，重复入队不再为同一 `File` 生成多个地址。新增 `tests/local-media-object-url-residency.test.js` 覆盖两条驻留约束。
- 当前未主动 revoke 音频或封面 Blob URL：`audio.src`、异步节奏分析 `fetch(audioUrl)`、懒加载图片、3D 缓存和桌面覆盖层尚未形成统一可等待租约；按队列对象或歌曲位置直接回收会制造播放、分析或图片加载回归。
- 本地文件范围 IPC 改为 768 KiB 固定小块读取和 base64 分块返回；renderer 预分配唯一最终 `Uint8Array` 后逐块 `atob` 写入。桌面歌词文本入口直接把该视图交给 `decodeLocalTextBuffer()`，解码器识别 `Uint8Array` 后原样复用，不再 `buffer.slice` 或通过 `new Uint8Array(existingView)` 复制完整范围。`tests/local-file-range-memory.test.js` 验证临时分配上限、跨分块字节一致性和文本解码对象身份。
- 本地标签范围读取增加短生命周期批次：同文件、同起点的同步排队请求先扩大到最大结束偏移，在途大范围可继续服务较小请求并返回共享 `subarray`。当前 FLAC 元数据/歌词/封面从 `4 + 32 + 32 MiB` 三次重叠读取收敛为一次 32 MiB；MP3 探针和完整 ID3 范围也分别只读一次。批次成功或失败后立即从全局表删除，不保留原始标签字节。
- FLAC Vorbis comment 解析改为先扫描原始字节 key：元数据未知字段和已命中的重复字段不再解码大型 value；歌词按字段理论最高优先级跳过不可能胜出的字段，未知字段通过原始字节时间标签扫描确认后才解码，priority 100 命中立即返回。空 comment 只跳过当前项，不再截断后续元数据或歌词。
- 新增 `tests/flac-vorbis-metadata-memory.test.js` 的 8 条纯 Node 回归，覆盖未知/重复大字段、未知 timed 回退、普通方括号误判、字段最高优先级、最高优先级提前结束，以及元数据/歌词空 comment 继续解析。
- 修复缩略图失败时完整封面伪装成 `localCoverThumbDataUrl` 并进入 IndexedDB 的驻留问题：非当前歌曲不再保留大图，后台失败保持前台可重试；当前歌曲可临时显示完整图，但只有缩略图成功后才置 `localCoverLoaded=true` 和写入资产缓存。`tests/local-cover-full-residency.test.js` 现有 8 条回归覆盖该状态机。
- MP3 APIC、ID3v2.2 PIC 与 FLAC PICTURE 图片提取从 `slice()` 改为 `subarray()`，删除进入 Blob 前的一份图片大小 typed-array 副本。新增 `tests/local-embedded-cover-byte-view.test.js`，使用非零 byteOffset 夹具验证三种格式共享完整标签 backing buffer、精确图片边界、MIME 和字节内容；Blob 自身快照及 data URL 仍按原语义保留。
- `preloadLocalSongAssets()` 只对同一音频文件的元数据、内嵌封面和内嵌歌词同轮启动，使后台两个 4 MiB 轻量扫描也能合并；外置封面和歌词继续串行，避免不同大文件同时驻留。`cloneSong()` 删除源对象的 4 个资产 Promise 与 2 个 loading 标记，避免队列副本长期持有已决 Promise 或错误继承封面加载所有权。新增 `tests/local-tag-range-read-coalescing.test.js`，并扩展 `tests/local-cover-full-residency.test.js`。
- 歌单封面缓存增加精确计数和 `loading` 请求硬上限：超过 196 条裁回 180 条，后台 aggressive trim 保留 72 条；先删除完成/失败项，再取消最旧非保护请求。成功图片完成后解除 `onload/onerror` 闭包，失败或无效地址同时清空 `src` 与 `rec.img`；`tests/playlist-cover-cache-residency.test.js` 覆盖成功、失败、无效地址和容量取消生命周期。
- 修复本地封面缩略图 Promise 所有权与顺序队列竞态：旧任务被 24 条并发缓存淘汰后若同键重试，迟到完成不再删除替代 Promise；活跃数使用精确计数，同键结果原位更新唯一 FIFO 槽位。顺序队列压缩同时识别已消费前缀和内部空洞，一个永久挂起任务不会再让后续已完成记录随长会话持续增长。`tests/local-cover-thumb-promise-ownership.test.js` 覆盖所有权、计数归零、结果唯一槽位和 100 次挂起任务压力场景。
- 当前最终检查全部为短时低优先级纯 Node/静态验证：65/65 测试通过，35 个项目 JS 文件语法通过，`public/index.html` 2 个内联脚本解析通过，PowerShell 内存脚本仅做 AST 语法解析，`git diff --check`、未跟踪 JS/PS1 行尾空白和调试前缀扫描通过；未执行 Electron、浏览器、服务、PowerShell 轮询或后台 GUI 测试。

### 2026-07-16

- 完整本地封面改为单一运行时所有者：只有 `currentLocalSong` 与 `playQueue[currentIdx]` 共同指向的当前对象可以持有完整 `localCoverDataUrl`；歌曲克隆和同曲资产同步只保留缩略图，切歌、清空队列和迟到异步读取均按对象身份释放或拒绝旧引用。
- `MiniPlayerStateCache` 增加独立窗口驻留态。功能启用但迷你 BrowserWindow 不存在时，主进程立即清空并拒绝最多 8 MiB 的封面补丁；新窗口取得所有权后才接受状态，并通过现有 `sync-state` 要求 renderer 强制补齐完整快照。
- 程序化销毁和当前窗口意外 `closed` 均释放迷你状态；旧窗口迟到的 `closed` 事件仍由全局窗口所有权门禁隔离，不能清理替代窗口缓存。新增纯 Node 行为测试覆盖无窗口拒收、销毁释放、新驻留补齐和旧事件不越权。
- 最终检查全部为短时低优先级纯 Node/静态验证：38/38 测试通过，27 个 JS 文件语法通过，`public/index.html` 2 个内联脚本解析通过，PowerShell 内存脚本仅做 AST 语法解析，`git diff --check` 通过；未执行 Electron、浏览器、服务、PowerShell 轮询或后台 GUI 测试。

### 2026-07-14

- 修复迷你播放器在 `lock-screen` / `suspend` 期间仍会因 renderer 崩溃重新安排 120ms 重载的问题；新增 `MiniPlayerRecoverySession` 按 `screen` / `suspend` 原因暂停，同时取消周期恢复与崩溃重建，全部原因解除后才恢复一次。
- 新增 `tests/mini-player-recovery-session.test.js` 纯 Node 回归测试，覆盖任务同时取消和锁屏/休眠交叠顺序。按用户要求，本轮修复后不再启动 Electron、浏览器或后台 GUI 测试，只运行 Node 与静态检查。
- 修复迷你播放器功能关闭后主进程仍保留/继续接收封面状态的问题；新增 `MiniPlayerStateCache`，禁用时释放歌曲与封面引用并拒绝后续补丁，重新启用时用现有命令通道请求 `sync-state`。
- 新增 `tests/mini-player-state-cache.test.js` 纯 Node 回归，使用 64 KiB 合成封面验证禁用释放、禁用期间拒绝和重新启用后只接受新状态。
- 修复桌面歌词中键 PowerShell 轮询快速关开时的所有权竞态：旧进程延迟 `exit/error` 不再清空替代进程句柄，避免新轮询成为无法停止的后台孤儿；`tests/desktop-lyrics-mouse-poller.test.js` 用假 ChildProcess 覆盖两种事件顺序，未启动 PowerShell。
- 新增 `DesktopOverlayStateCache` 管理桌面歌词和壁纸主进程状态；关闭后把状态替换为最小 `{enabled:false}`，释放 `beatMap`、歌词和封面 data URL，禁用期间拒绝补丁，重新启用只接受当前完整状态。
- renderer 在桌面歌词或壁纸禁用时不再构造重载荷或发送 update IPC；关闭入口只发送最小状态。`tests/desktop-overlay-state-cache.test.js` 与 `tests/desktop-overlay-disabled-ipc.test.js` 覆盖释放、拒收和禁用门禁。
- 删除从无读取命中的 `localAssetCacheMemory` 全局镜像，保留歌曲对象补水和 IndexedDB 持久化；`tests/local-asset-cache-ownership.test.js` 固定单一运行时所有权契约。
- 修复覆盖层状态补丁调用顺序导致的桌面歌词纵向位置/透明度滑块失效；壁纸更新统一直接交给窗口生命周期入口，避免重复合并和重复发送。
- 修复桌面歌词/壁纸 BrowserWindow 快速关开时的实例所有权竞态；旧窗口迟到的 ready/load/move/closed 事件不再操作替代窗口。桌面歌词旧轮询进程的迟到 stdout 同样增加实例门禁。
- 桌面歌词 IPC 增加 sender 所有权：主 renderer 负责启用和状态更新，当前歌词 renderer 只负责自身关闭、移动、热区、指针和锁定；旧 renderer 的迟到命令返回 ignored。
- renderer 关闭单个覆盖层时立即释放对应签名：桌面歌词清除歌词行、歌词签名和节奏签名，壁纸清除包含完整封面 data URL 的签名，不再依赖两个覆盖层同时关闭。
- `localLibraryPersistentMemory` 改为只持有当前文件夹索引；大快照按需从 IndexedDB 读取后释放，切库时替换内存域，并以 generation 阻止 A→B→A 后的旧异步读取回填。
- 修复旧曲库后台扫描在切库后误用全局 `localLibrarySongs` 的竞态，旧结果不再把 B 歌曲写进 A 索引或重新覆盖当前界面。
- 大曲库资产补水改为跳过歌词重载荷；歌曲实际播放时才读取该单曲的 IndexedDB 歌词，后台处理未播放歌曲时不再读歌词文件。
- 本地节奏图的内存与 `localStorage` 所有权统一限制为最近 12 首；淘汰时只删除通用节奏缓存中与旧条目共享的同一对象，不影响通用缓存后来独立更新的结果。
- 删除从无读取者的 `localLibraryPreviousRecord`；曲库索引同步后不再由每首歌曲继续强引用上一版索引记录。
- 完整本地封面 data URL 改为只由当前播放队列对象临时持有：`cloneSong()` 不复制完整图，资产同步只传播缩略图，切歌按 `localKey` 转移或释放旧引用；异步封面写入按对象身份校验当前所有者，避免迟到读取重新占住旧队列对象。缩略图仍保留“内嵌封面”元数据语义。

### 2026-07-13

- 修复主窗口恢复后迷你播放器仅隐藏、独立渲染进程持续常驻的问题；`desktop/main.js` 现在释放迷你 BrowserWindow，再次最小化时按当前主进程状态重新创建，不改变 UI、IPC 协议或播放控制。
- 新增 `scripts/test-mini-player-memory.ps1` Windows Electron 生命周期回归检查，使用独立临时用户目录验证“创建 → 释放 → 再创建 → 再释放”。修复后两轮恢复均从 6 个 Electron 进程回到 5 个，单轮释放约 100 MiB 工作集。

### 2026-07-03

- 权限恢复后确认当前可写仓库为 `C:\Users\Administrator\Desktop\Mineradio-main`，旧规则里的 `E:\桌面\播放器软件\Mineradio\resources\app` 在本环境不存在；本地 `main...origin/main` 位于 `v1.2.8`。
- 确认远端与发布配置均为 `oirge/Mineradio`，并将 `docs/HANDOFF_NEXT_CHAT.md` 从旧 `v1.1.0 / XxHuberrr` 发布线更新到当前 `v1.2.8 / oirge` 工作区。
- 优化渲染进程 UI 状态备份：`public/index.html` 中连续 `setPersistentLocalStorageItem()` 触发的桌面壳备份改为 180ms 合并写入；首次全量同步仍立即写，退出和页面隐藏前 flush，降低视觉滑条/设置连续保存时的 IPC 与主进程写盘抖动。
- 已通过 `git diff --check`、`node --check server.js`、`node --check desktop\main.js`、`node --check desktop\preload.js` 和前端内联脚本解析；确认当前系统代理为 `127.0.0.1:7897`，用 `HTTP_PROXY`、`HTTPS_PROXY`、`ALL_PROXY=http://127.0.0.1:7897` 成功执行 `npm run build:win:dir` 和 `npm run build:win`。
- 本轮完整构建产物：`dist\Mineradio-1.2.8-Setup.exe`、`dist\Mineradio-1.2.8-Setup.exe.blockmap`、`dist\Mineradio-1.2.8-Portable-win-x64.zip`、`dist\latest.yml`；安装包 SHA256 为 `ED16AAB84BC994BDA0512D6250EAF12FC2DAD8AABCA6ABF6FD98B65CBF5C4601`。

### 2026-06-24

- 将 `E:\Download\默认测试.json` 接入为首次启动默认用户存档和默认视觉参数；新增 `public/default-user-fx-archive.json`，并让没有本地用户存档的新用户自动得到「默认测试」槽位。
- 更新 `CHANGELOG.md`、`README.md`、`SECURITY.md`、`RELEASE.md`、`docs/SECURITY_REBUILD_2026-06-24.md` 和 `docs/RELEASE_NOTES_v1.1.0.md`，恢复详细日志并写明 `v1.0.10` 旧安装包隔离、`v1.1.0` 纯净安装、不走软件内更新。
- 已执行 `npm run build:win`，第一次被旧代理 `127.0.0.1:26001` 拦截，切到 `127.0.0.1:10808` 后打包成功。产物：`dist/Mineradio-1.1.0-Setup.exe`、`.blockmap`、`Mineradio-1.1.0-SHA256SUMS.txt`。
- 已运行 `git diff --check`、`node --check server.js`、前端 5 个内联脚本解析、默认 JSON 解析、Git 跟踪高风险残留检查；Defender 对新安装包和 `win-unpacked` 扫描后 `Get-MpThreatDetection` 查询为空。
- 已发布 GitHub Release `v1.1.0`，上传安装包、blockmap、SHA256SUMS；未上传 `latest.yml`。已批量给旧 Release（`v1.0.10` 到 `v0.9.9`）追加旧安装包隔离警示。
- 检查并更新新对话交接：`docs/HANDOFF_NEXT_CHAT.md` 已改为当前 `v1.1.0` 源码安全重建状态。
- 本轮交接检查开始时工作树为干净：`main...origin/main`；随后仅修改 `AI_HANDOFF.md`、`docs/HANDOFF_NEXT_CHAT.md`、`docs/PROJECT_MEMORY.md`，并新增 `docs/3D_PLAYLIST_SHELF_MEMORY.md`。
- 已补全 3D 歌单架专项记忆：控制台模式、常驻/静态镜头、详情页层级、歌词避让、右键歌单架抑制底部控制台、不要推倒重做手感等边界写入 `docs/3D_PLAYLIST_SHELF_MEMORY.md`。
- 项目记忆 `docs/PROJECT_MEMORY.md` 已包含 `2026-06-24 - 1.1.0 安全重建源码优先`，记录不要复用旧感染环境产出的安装包、旧 `dist`、旧 `node_modules` 或临时扫描资料。
- 安全重建日志在 `docs/SECURITY_REBUILD_2026-06-24.md`，后续安装包发布必须从当前 Git-tracked 源码重新构建并扫描。

### 2026-06-18

- 发布 `v1.0.4` 到 GitHub：`https://github.com/XxHuberrr/Mineradio/releases/tag/v1.0.4`。
- 本次发布包含安装包 `Mineradio-1.0.4-Setup.exe`、`latest.yml`、blockmap，以及 `1.0.0/1.0.1/1.0.2/1.0.3 -> 1.0.4` 四个快速补丁 JSON。
- 主要修复：最小化/隐藏时深度低占用但可见失焦不降帧；全屏 3D 视觉画布尺寸同步避免裁切；控制台隐藏残影；控制台玻璃色差滑条；左侧歌单详情分批加载和置顶；沉浸模式恢复左侧歌单栏、3D 歌单架和封面渐变背景。

### 2026-06-06

- 发布 `v0.9.11`。
- 修复新用户首次进入未登录时展示不可控外部推荐封面的问题。
- 未登录首页改为安全 starter 内容，不再拉取公共推荐。
- 登录弹窗增加“音乐播放器 + 视觉舞台”说明，并提供“先搜索一首歌”路径。
- 视觉引导改成产品用途导向。
- 增加完整安装包下载进度：大小、速度、ETA、状态提示。
- 增加快速补丁通道：`/api/update/patch` 和 `/api/update/patch/status`。
- 生成并上传 `Mineradio-0.9.10-to-0.9.11.patch.json`。
- 注意：已经安装的 `0.9.10` 本身没有补丁器，所以从 `0.9.10` 升到 `0.9.11` 仍需完整安装包一次。

### 2026-06-07

- 重新设计 Windows NSIS 安装器。
- 加入深色标题栏、品牌页头、安装器侧栏、深色欢迎页。
- 跳过默认白色安装模式页。
- 用自定义深色目录页替代默认白色目录页，保留路径输入和 Browse 按钮。
- 默认安装路径仍优先 `D:\Mineradio`。
- 重新打包并覆盖 GitHub Release `v0.9.11` 的安装包、blockmap、latest.yml。
- 提交：`28d3cef Restyle Windows installer`。

### 2026-06-08

- 整理工作区。
- `dist` 根部恢复为当前发布资产区。
- 旧安装包移动到 `dist/_archive/previous-releases/`。
- 安装器预览截图移动到 `dist/_previews/installer-visual-20260607/`。
- builder debug 文件移动到 `dist/_logs/`。
- 历史前端实验文件移动到 `backups/public-html/`。
- 工具缓存文件移动到 `backups/tool-cache/`。
- 创建 `updates/downloads/`、`updates/backups/patches/`、`updates/tmp/`。
- `server.js` 更新为下载区和补丁备份区分离。
- Home 页完成视觉升级：首屏增加唱片、封面套、频谱视觉块，未登录/无封面时的卡片、拼贴和推荐入口都会生成彩色音乐封面占位，减少纯文字和空黑区域。
- 修正 Home 页矮屏排版：右侧卡片和推荐入口不再叠压，标题不会把“今天想听什么”拆成尴尬换行。
- 已用本地 Chrome CDP 验证 `1280x720` 和 `390x720` 首屏，无页面级横向溢出；预览截图保留在 `dist/_previews/home-visual-20260608/`。
- 本次任务没有上传或推送 GitHub，遵守“未明确要求上传就不上传”的新规则。

### 2026-06-10

- 视觉控制台新增“封面清晰度”滑块，用于调节主封面粒子网格密度。
- 默认保持 `119x119`（约 1.42 万粒子），最高提升到 `183x183`（约 3.35 万粒子），让专辑封面粒子化后更清晰。
- 调整封面纹理加载逻辑：高清晰度档位会使用 `384/512` 尺寸的封面画布，避免只增加粒子但纹理源仍然偏糊。
- 清晰度参数会写入本地偏好；当前封面来源会被记录，拖动滑块后当前封面会按新清晰度自动重载。
- 修复部分封面在提高清晰度后出现割裂线的问题：粒子网格改为奇数尺寸，几何位置保留居中点，封面 UV 改为采样 texel 中心，shader 内对封面/上一张封面/边缘贴图采样做安全夹取，避免采样到纹理边界或偶数网格中心缝。
- 已用本地 Chrome CDP 验证滑块：默认 `119x119`，拉满 `183x183`，主粒子/溢光粒子共享高密度几何，dataUrl 封面纹理升到 `512x512`，WebGL `glError=0`。
- 本次任务没有上传或推送 GitHub。

### 2026-06-13

- 用户明确要求上传 GitHub 后，已将 Home 视觉升级、封面清晰度控制、封面粒子割裂线修复和交接说明更新提交并推送到 `origin/main`。
- 已推送提交：`21f6052 Polish home visuals and cover particles`。
- 按用户“不能只上传源码，要包含软件 exe”的要求，继续升版本到 `0.9.12` 并重新构建 Windows 安装包。
- 已生成 `dist/Mineradio-0.9.12-Setup.exe`、`dist/Mineradio-0.9.12-Setup.exe.blockmap`、`dist/latest.yml`。
- 已生成轻量快速补丁 `dist/Mineradio-0.9.11-to-0.9.12.patch.json`，补丁只覆盖 `package.json`、`package-lock.json`、`public/index.html`，用于已安装 `0.9.11` 的用户快速更新视觉和封面粒子修复。
- 已创建并核对 GitHub Release `v0.9.12`：`https://github.com/XxHuberrr/Mineradio/releases/tag/v0.9.12`，远端包含安装包、blockmap、`latest.yml` 和 `0.9.11-to-0.9.12` 快速补丁。
- 本地试做新版开场动画：参考 `ShipSwiftAnimatedLoop` 的霓虹通道分离、光流和切片感，但放弃环形方案，改为横向光刃切入、彩色尾迹、碎片条和黑金控制台背景，主要改动在 `public/index.html`。
- 已用本地 Chrome/CDP 重播 splash 并截取 `updates/tmp/splash-replay-0700.png`、`updates/tmp/splash-replay-1800.png`、`updates/tmp/splash-replay-2900.png`；本次只是本地试效果，没有上传或推送 GitHub。
- 用户反馈上一版“不如动画库惊艳”后，继续把 splash 背景从 2D canvas 升级为 WebGL shader：移植 `ShipSwiftAnimatedLoop` 的 `lineWidth / abs(f)` 高亮线场、RGB channel offset、Neon angular wobble 和 Warp 距离场，并保留 2D fallback。新预览截图为 `updates/tmp/splash-webgl3-0700.png`、`updates/tmp/splash-webgl3-1800.png`、`updates/tmp/splash-webgl3-2900.png`；仍未上传或推送 GitHub。
### 2026-06-14

- 根据用户反馈，移除 splash 中刻意的环形/花瓣式爆点，改为更自然的斜向流线相位同步高光，避免“环形像菊花”的观感。
- splash 现在不再自动进入 Home：动画跑完后进入 `ready` 状态，显示轻量“点击进入”，用户点击任意位置或按 Enter/空格后才调用 `dismissSplash()`。这样用户可以停留欣赏动画。
- 已用本地 Chrome/CDP 验证：`updates/tmp/splash-click-ready.png` 显示 6.4 秒后仍停在 splash 且 `className=ready`，`updates/tmp/splash-after-click.png` 显示点击后进入 Home；本次没有上传或推送 GitHub。
- 用户随后明确要求上传 GitHub：已升级到 `0.9.13`，更新 `CHANGELOG.md` 和 `RELEASE.md`，生成 `dist/Mineradio-0.9.12-to-0.9.13.patch.json` 快速补丁，并重新构建 `dist/Mineradio-0.9.13-Setup.exe`、`dist/Mineradio-0.9.13-Setup.exe.blockmap`、`dist/latest.yml`。
- 已推送提交 `4d9044a Prepare Mineradio 0.9.13 release` 到 `origin/main`，并创建 GitHub Release `v0.9.13`：`https://github.com/XxHuberrr/Mineradio/releases/tag/v0.9.13`。远端资产包含安装包、blockmap、`latest.yml` 和 `0.9.12-to-0.9.13` 快速补丁。
- 注意：本机 `gh` 命令曾被失效代理 `HTTP_PROXY/HTTPS_PROXY=http://127.0.0.1:26001` 挡住。使用 GitHub CLI 发布时可在当前命令里临时清空 `HTTP_PROXY`、`HTTPS_PROXY`、`ALL_PROXY` 后再执行。

## 未完成/待确认事项

- `includeLyrics:false` 目前只阻止把歌词应用到歌曲对象，IndexedDB `store.get()` 仍会 structured-clone 完整合并记录；真正降低大批量补水峰值需要把轻量资产摘要与歌词重载荷拆成独立记录/存储，不能只增加无效 selection 参数。
- 外置本地封面仍可能走完整 data URL；后续可利用已有同源 `localFileProxyUrl` 或 Blob/URL 缩略图接缝，避免主进程 Buffer、base64 字符串和 renderer 解码对象同时驻留。
- 迷你播放器持续 `did-fail-load` 或“加载完成后很快再次崩溃”仍可能跨窗口反复重建。下一轮应先建立纯 Node fake clock / BrowserWindow 回归接缝，再由用户确认重试上限与退避策略，不能直接加入猜测性容错。
- `v1.1.0` 发布时不要上传 `latest.yml` 或快速补丁；Release 需要通过 `--latest=false` 或等价 API 避免成为旧版软件内更新通道的 latest。
- 搜索结果排序仍需要继续优化：例如“日落大道”应优先梁博原唱，“Beauty and a Beat”应优先原唱/官方版本，避免翻唱排第一。
- 3D 歌单架交互仍需继续优化：悬停展开和点击后可用状态之间要更丝滑，避免用户误以为悬停后可直接使用。
- Home 页面与后方 3D 歌单架的交互穿透问题需要继续关注。
- 如果之后修改发布资产，记得同步 GitHub Release、`latest.yml`、blockmap，并检查本地 `dist` 根部资产是否一致。

## 每次任务完成后的固定动作

1. 更新本文件的「已完成工作日志」。
2. 如果发现新问题，更新「未完成/待确认事项」。
3. 如果整理了文件，更新「工作区地图」或「本地分区约定」。
4. 如果改了代码，至少运行相关语法检查或构建检查。
5. 如果改了安装包或更新逻辑，检查安装包、blockmap、校验文件和 GitHub Release 是否一致；安全发布时特别确认不要误上传 `latest.yml`。
6. 最后确认 `git status --short`，说明哪些已提交、哪些只是本地忽略产物。
