# Mineradio Project Rules

## Project Identity

Mineradio 是 Windows Electron 桌面音乐播放器，核心体验包括搜索、播放、歌单、歌词、3D 歌单架、粒子视觉预设、DIY 视觉控制台和 GitHub 自动更新。

- 当前可写代码/Git 仓库：`C:\Users\oirg\Desktop\mok\Mineradio-sync`
- 当前环境未找到旧运行目录：`E:\桌面\播放器软件\Mineradio\resources\app`
- GitHub 仓库：`https://github.com/oirge/Mineradio.git`
- 当前源码版本：`v1.4.2`；包含 MP3/FLAC/M4A/WAV/OGG 本地播放、标准 M4A 标签与封面解析、搜索排序、特别喜欢歌单、主播放栏歌单来源切换，以及主渲染器、壁纸覆盖层与 3D 歌单架的 CPU/运行内存优化。
- 统一备份区：`E:\桌面\播放器软件\工作区备份`

## Start Every New Codex Thread Here

新对话开始处理 Mineradio 前，必须先确认当前目录是：

```powershell
C:\Users\oirg\Desktop\mok\Mineradio-sync
```

然后读这些文件：

- `AGENTS.md`
- `docs/PROJECT_MEMORY.md`
- 涉及玻璃 SVG 质感时读取 `docs/GLASS_SVG_TEXTURE.md`
- 涉及发布时读取 `CHANGELOG.md`、`RELEASE.md`、`package.json`

## Repository Layout

```text
Mineradio/resources/app/
├─ public/
│  ├─ index.html        # 主 UI、CSS、歌词、粒子、3D 歌单架、视觉控制台
│  └─ vendor/           # 本地 vendor 依赖
├─ desktop/             # Electron main/preload
├─ build/               # 打包资源和 installer 脚本
├─ docs/                # 项目记忆、设计偏好、长期约束
├─ server.js            # 本地 API、音乐源、更新检查、补丁应用
├─ dj-analyzer.js       # 节奏/音频分析
├─ package.json         # 版本号、构建命令、electron-builder 配置
└─ CHANGELOG.md         # 中文更新说明优先写在顶部
```

## Commands

```powershell
npm start
node --check server.js
npm run build:win:dir
npm run build:win
```

前端主逻辑在 `public/index.html`。当前环境以 `C:\Users\oirg\Desktop\mok\Mineradio-sync` 为可写源码仓库；旧 `E:\桌面\播放器软件\Mineradio\resources\app` 在本环境不存在。改动后至少做：

注意：运行版 `node_modules` 可能只包含运行依赖。如果发布打包时缺少 `electron-builder`，先在当前源码仓库执行 `npm install`，再执行 `npm run build:win`。

```powershell
git diff --check
node --check server.js
```

并用实际 Electron 或浏览器检查关键交互。

## Release Workflow

发布新版本时：

1. 更新 `package.json` 和 `package-lock.json` 版本号。
2. 更新 `CHANGELOG.md` 顶部中文说明。
3. 运行语法/空白检查。
4. 执行 `npm run build:win`。
5. 上传 GitHub Release 资产：
   - `dist/Mineradio-x.y.z-Setup.exe`
   - `dist/Mineradio-x.y.z-Setup.exe.blockmap`
   - `dist/latest.yml`
   - 需要的 `Mineradio-旧版本-x.y.z.json` 轻量补丁
6. 0.9 系列补丁跳过；1.0.x 系列可按需生成跨小版本补丁。

GitHub CLI / `gh auth` / Release 上传或 Electron 打包下载需要代理时，优先使用当前系统代理 `127.0.0.1:7897`；不要再走旧代理 `127.0.0.1:26001` 或 `127.0.0.1:10808`。临时命令可先清空 `HTTP_PROXY`/`HTTPS_PROXY`，再设为 `http://127.0.0.1:7897`。

## User Preferences

- 交流语言：中文。
- 用户偏好：少废话，直接做，修完验证，能发布就一起发布。
- UI 优化边界：能不动 UI 就不动 UI。播放器性能优化默认不改布局、CSS、文案、视觉质感或交互入口；必要的 DOM/HTML 改动必须保持等价输出。
- UI 审美：精致、暗色、高级、流畅，拒绝廉价渐变、过度透明、错位、闪烁和卡顿。
- 视觉质量定义：质感、丝滑度、帧数稳定同时成立；性能优化不能牺牲既有质感。
- 玻璃质感：当前播放器 SVG 玻璃质感是黄金版本，详见 `docs/GLASS_SVG_TEXTURE.md`。
- 备份策略：不要删除旧资料；重复和历史内容移动到 `E:\桌面\播放器软件\工作区备份`。
- 重要：不要再改旧外层源码目录。旧的 `E:\桌面\播放器软件\Mineradio\public` / `desktop` 已经归档；当前环境以 `C:\Users\oirg\Desktop\mok\Mineradio-sync\public` / `desktop` 为准。

## Memory Protocol

当用户说“保留”“这个做得很好”“我喜欢”“记住这个”“保存一下”“以后别忘了”或同类表达时：

1. 判断用户认可的是代码、视觉效果、交互流程、发布流程还是工作习惯。
2. 将结论追加到 `docs/PROJECT_MEMORY.md` 的对应区块。
3. 如果是玻璃 SVG、粒子预设、3D 歌单架等脆弱视觉实现，同时更新对应专项文档。
4. 记录日期、涉及文件、关键参数、不要再改坏的边界。
5. 如果本轮有代码提交，把记忆文档一起提交；如果只是记忆整理，单独提交也可以。

## Guardrails

- 不要随意重写 `public/index.html` 的大块视觉系统；先定位已有函数和状态。
- 不要动电影视觉系统，除非用户明确点名。
- 不要恢复旧的侧边栏闪烁、控制台播放暂停失效、3D 歌单架强制切回星河等问题。
- 不要把搜索结果、左侧歌单、3D 歌单架的性能优化做成一次性渲染全部内容。
- 不要把用户认可的玻璃质感改成普通毛玻璃或廉价透明面板。

## 当前仓库索引

- 遇到 `桌面歌词轮询进程`、`PowerShell 孤儿进程`、`旧进程 exit 覆盖新进程`、`DesktopOverlayStateCache`、`桌面歌词 beatMap 保留` 或 `壁纸封面 data URL 保留` 时，必须优先读取 `.context/architecture/mineradio-player-performance-seams.md`。
- 遇到 `旧窗口 closed 覆盖新窗口`、`覆盖层 BrowserWindow 所有权`、`旧 renderer IPC 控制新窗口`、`桌面歌词透明度/位置失效`、`旧 poller stdout` 或 `覆盖层签名未释放` 时，必须优先读取 `.context/architecture/mineradio-player-performance-seams.md`。
- 遇到 `localAssetCacheMemory`、`本地资产镜像`、`只写不读缓存` 或 `切换曲库旧歌词封面保留` 时，必须优先读取 `.context/architecture/mineradio-player-performance-seams.md`。
- 遇到 `localLibraryPersistentMemory`、`曲库 snapshot 常驻`、`A→B→A ABA`、`旧曲库后台扫描覆盖新曲库`、`空曲库后台资产任务`、`localLibraryProcessToken`、`旧资产队列闭包常驻` 或 `跨曲库索引写错` 时，必须优先读取 `.context/architecture/mineradio-player-performance-seams.md`。
- 遇到 `全曲库歌词常驻`、`已播放歌词原文常驻`、`localLyricText O(n)`、`歌词按需恢复`、`歌词播放租约`、`handoffLocalLyricText`、`localLyricResidencyReleased`、`迟到歌词水合`、`原歌词双份克隆`、`originalLyricsState`、`歌词只读快照`、`localLyricCachePromise`、`localLibraryPreviousRecord`、`本地节奏图内存上限` 或 `localBeatMapCache` 时，必须优先读取 `.context/architecture/mineradio-player-performance-seams.md`。
- 遇到 `完整本地封面常驻`、`localCoverDataUrl`、`封面所有权`、`迟到封面读取`、`缩略图失败完整图持久化`、`空缩略图已加载` 或 `歌曲克隆复制封面` 时，必须优先读取 `.context/architecture/mineradio-player-performance-seams.md`。
- 遇到 `本地媒体 Object URL`、`Blob URL`、`重复入队音频地址`、`封面懒创建`、`revokeObjectURL`、`媒体租约`、`歌单封面缓存`、`loading 图片请求`、`playlistCoverCache`、`图片 waiter 常驻`、`Image 事件闭包常驻`、`失败封面 rec.img`、`缩略图 Promise 所有权`、`缩略图活跃计数不归零`、`缩略图 FIFO 重复键`、`挂起缩略图任务`、`Promise 队列内部空洞` 或 `迟到缩略图任务` 时，必须优先读取 `.context/architecture/mineradio-player-performance-seams.md`。
- 遇到 `关闭迷你播放器内存`、`迷你窗口非驻留`、`窗口驻留缓存`、`旧迷你窗口 closed`、`封面 data URL 保留`、`MiniPlayerStateCache` 或 `sync-state` 时，必须优先读取 `.context/architecture/mineradio-player-performance-seams.md`。
- 遇到 `迷你播放器锁屏恢复`、`休眠重建`、`powerMonitor` 或 `renderer 锁屏期间重载` 时，必须优先读取 `.context/architecture/mineradio-player-performance-seams.md`。
- 遇到 `本地文件范围读取`、`readAuthorizedLocalFileRange`、`base64Chunks`、`完整 Buffer 峰值`、`整段 atob`、`bytes.buffer.slice`、`Uint8Array 视图复制`、`APIC/PIC/PICTURE 图片副本`、`后台内嵌封面完整 data URL`、`ImageBitmap 封面缩略图`、`PICTURE 长度越界`、`ALBUMARTISTSORT`、`元数据缓存版本`、`MP3 标签大内存`、`FLAC 元数据大内存`、`FLAC metadata descriptor`、`大 PADDING`、`readFlacMetadataSession`、`localFlacMetadataSessionReadBatches`、`后台 light 元数据 Promise`、`Vorbis comment 大字段`、`FLAC 空 comment`、`标签范围合并`、`localFileRangeReadBatches`、`歌曲克隆在途 Promise` 或 `跨进程文件字节` 时，必须优先读取 `.context/architecture/mineradio-player-performance-seams.md`。
- 遇到 `mineradio-local-assets-v1` 数据库 v3、`LOCAL_LYRICS_CACHE_STORE`、`lyrics store`、`localLyricCacheSnapshot`、`assets/lyrics 分离`、`v2 到 v3 cursor 迁移`、`本地封面流 URL`、`localCoverFile.url`、`readLocalFileDataUrl` 绕过或 `crossOrigin=anonymous` 时，必须优先读取 `.context/architecture/mineradio-player-performance-seams.md`。
- 遇到 `verifyUpdateFile`、`安装包校验内存`、`fs.readFileSync 安装器`、`SHA-256/SHA-512 文件校验` 或 `更新安装包 Buffer 峰值` 时，必须优先读取 `.context/architecture/mineradio-player-performance-seams.md`。
- 遇到 `/api/local-file`、`本地文件代理越权`、`setLocalFileAuthorizer`、`localFileAuthorizer`、`resolveAuthorizedLocalFile`、`authorizedLocalMusicRoots`、`LOCAL_FILE_NOT_AUTHORIZED`、`本地文件代理授权`、`授权曲库根目录校验`、`路径穿越读取` 或 `MINERADIO_LOCAL_FILE_TOKEN` 时，必须优先读取 `.context/pitfalls/mineradio-local-file-proxy-authorization.md`。
- 遇到 `readRequestBody`、`请求体超限`、`REQUEST_BODY_TOO_LARGE`、`req.destroy 不触发 end`、`promise 永不结算`、`处理器挂起`、`POST 请求体解析`、`8MB 上限`、`客户端中断 socket 泄漏` 或 `单次结算门` 时，必须优先读取 `.context/pitfalls/mineradio-request-body-settlement.md`。
- 遇到 `mineradio-import-json-file`、`存档导入`、`导入 JSON`、`IMPORT_FILE_TOO_LARGE`、`IMPORT_NOT_A_FILE`、`导入文件大小上限`、`readFileSync 无上限`、`主进程 OOM`、`外部文件读取上限` 或 `导入对话框超大文件` 时，必须优先读取 `.context/pitfalls/mineradio-import-file-size-limit.md`。
- 遇到 `IndexedDB 事务 abort`、`onabort`、`事务中止 promise 永挂`、`trimLocalIndexedDbCaches`、`localIndexedDbTrimRunning 锁泄漏`、`IndexedDB 连接泄漏`、`QuotaExceededError`、`versionchange 中止`、`putCustomBackgroundBlob`、`getCustomBackgroundBlob`、`putLocalAssetCacheRecord` 或 `writeLocalLibraryPersistentRecord` 时，必须优先读取 `.context/pitfalls/mineradio-indexeddb-transaction-abort.md`。
- 遇到 `资产预载排序数字键`、`sortLocalAssetPreloadQueue`、`清理阶段全量记录数组`、`游标增量删除` 或 `IndexedDB 清理内存峰值` 时，必须优先读取 `.context/architecture/mineradio-player-performance-seams.md`。
- 遇到 `播放器性能优化`、`UI 不动`、`播放启动速度`、`点歌到出声`、`启动恢复`、`迷你播放器`、`迷你播放器恢复`、`迷你播放器内存释放`、`隐藏窗口渲染进程`、`队列渲染`、`Home 首屏`、`听歌统计`、`搜索历史`、`搜索结果缓存`、`搜索玻璃贴图`、`HTML 转义`、`副标题缓存`、`空搜索`、`本地曲库导入`、`FileList 转数组`、`本地曲库缓存`、`本地资产缓存补水`、`元数据字段套用`、`本地歌词加载`、`本地文本解码`、`无歌词占位`、`LRC 解析`、`YRC 解析`、`歌词 source 转换`、`本地节奏缓存`、`3D 歌单详情`、`详情行属性写入缓存`、`主进程本地曲库扫描`、`增量扫描截断`、`扫描回退全量`、`scanLocalMusicFolderIncremental`、`listed.truncated`、`LOCAL_LIBRARY_SCAN_VISIT_LIMIT`、`曲库丢歌`、`残缺快照覆盖`、`IndexedDB 缓存清理`、`IndexedDB`、`封面缩略图`、`重复函数声明` 或 `requestAnimationFrame 调度` 时，必须优先读取 `.context/architecture/mineradio-player-performance-seams.md`。
- 遇到 `localSearchWarmupSource`、`scheduleLocalSearchIndexWarmup` 二次筛选、`空查询结果数组复用` 或 `localSearchResultCache` 空查询身份时，必须优先读取 `.context/architecture/mineradio-player-performance-seams.md`。
- 遇到 `主 3D 空闲 30 FPS`、`isContinuousPlaybackRenderActive`、`隐藏歌单架短路`、`targetVis === 0`、`频谱桶单次扫描`、`getStageLyricLockBounds`、`歌词边界闭包`、`暂停镜头空闲短路` 或 `frequencyValue` 时，必须优先读取 `.context/architecture/mineradio-player-performance-seams.md`。
- 遇到 `实时节拍频谱 30 FPS`、`BEAT_ANALYSIS_TARGET_FPS`、`beatAnalysisElapsed`、`consumeRealtimeBeatSpectrumSlot`、`beatBandValueCache` 或 `节拍 FFT 限频` 时，必须优先读取 `.context/architecture/mineradio-player-performance-seams.md`。
- 遇到 `主渲染空闲定时器`、`mainRenderScheduleKind`、`idle-timeout`、`wallpaperDrawHandle`、`壁纸覆盖层未播放限频` 或 `覆盖层封面释放` 时，必须优先读取 `.context/architecture/mineradio-player-performance-seams.md`。
- 遇到 `frameShelfLook`、`drawPanel` 外观快照、`drawRow` 外观快照、`syncRenderedRows` 重复读取 `shelfSettings`、`详情面板颜色解析` 或 `详情绘制帧快照` 时，必须优先读取 `.context/architecture/mineradio-player-performance-seams.md`。
- 遇到 `cameraPoseSyncState`、`cameraPoseNeedsRefresh`、`cameraPoseOverrideActive`、`shelfHoverPointerScratch`、`updateRipples`、`usedMask` 或 `普通相机姿态缓存` 时，必须优先读取 `.context/architecture/mineradio-player-performance-seams.md`。
- 遇到 `主循环 performance.now 时间戳复用`、`refreshShelfRenderFrameState`、`frameShelfState`、`updateStageLyrics3D 歌单状态快照`、`shelfManager.getMode 同帧重复`、`hasOpenContent 同帧重复`、`shelfAlwaysVisible 同帧重复` 或 `空 Home 波形时间戳` 时，必须优先读取 `.context/architecture/mineradio-player-performance-seams.md`。
- 遇到 `sampleRenderPerf 缓存回收`、`maybeTrimRuntimeCaches 采样边界`、`主循环复用自适应 FPS`、`frameFps` 或 `shouldSkipAdaptiveRenderFrame 时间戳复用` 时，必须优先读取 `.context/architecture/mineradio-player-performance-seams.md`。
- 遇到 `M4A 播放失败`、`m4a 元数据`、`moov`、`ilst`、`data atom`、`covr`、`audio/mp4`、`M4A 封面`、`M4A 标签缓存` 或 `ALAC 编码兼容` 时，必须优先读取 `.context/pitfalls/mineradio-m4a-metadata-playback.md`。
