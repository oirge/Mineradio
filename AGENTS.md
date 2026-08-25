# Mineradio Project Rules

## Project Identity

Mineradio 是 Windows Electron 桌面音乐播放器，核心体验包括搜索、播放、歌单、歌词、3D 歌单架、粒子视觉预设、DIY 视觉控制台和 GitHub 自动更新。

- 当前可写代码/Git 仓库：`C:\Users\Administrator\Desktop\Mineradio-main`
- 当前环境未找到旧运行目录：`E:\桌面\播放器软件\Mineradio\resources\app`
- GitHub 仓库：`https://github.com/oirge/Mineradio.git`
- 当前源码版本：`v1.7.4`（插件系统收窄成只有主题一种：`source` / `playlist` 两类连同 `search` / `url` / `lyric` / `cover` / `playlists` / `playlistDetail` 六个钩子、`mineradio.request` / `requestJson`、`@host` 白名单与 `PLUGIN_NO_HOST` 等错误码、根目录 `plugin-proxy.js` 与 `/api/plugin/stream`、搜索结果插件区与插件歌单面板全部删除，插件从此没有任何网络与播放通道；`.js` 脚本主题与 Worker 沙箱保留，但只认 `theme` 一个钩子，返回值走与声明式负载完全相同的清洗；旧存档里的 `source` / `playlist` 记录在 `normalizePluginRecords()` 阶段整条丢弃；`tests/plugin-proxy.test.js` 删除，`tests/plugin-system.test.js` 重写成 24 例并正向断言这些能力已经不存在）；`v1.7.3`（主题变量族 `--th-*` 就地变量化 `public/app.css` 的 `!important` 字面值，主题覆盖面 18 → 63 处/79 探针，默认外观零变化；迷你播放器两套外壳接 `--th-mini-*`，由 `plugin-runtime.js` 的 `themeVars()` → `desktop/main.js` 签名去重 → `mineradio-mini-player-state` 整表转发，主进程侧 `normalizeMiniPlayerThemeVars()` 二次清洗；三份示例主题各 55 变量、抬到 `1.4.0`）；`v1.7.2`（安装包自带 `午夜靛蓝` / `暖琥珀` 两份声明式主题，见 `public/plugin-builtin-themes.js`，默认不启用；主题插件改为互斥，同一时刻只允许一个主题启用，历史多启用存档在 `init()` 时收敛成最近启用的那个；移除两份档案馆示例脚本插件，`source`/`playlist`/`lyric` 三类能力本身不变）；`v1.7.1` 修复了 `v1.7.0` 安装包因 `plugin-proxy.js` 漏进 `build.files` 白名单无法启动的问题，并新增 `tests/packaging-file-whitelist.test.js` 守卫；在 `v1.6.3` 基础上新增插件系统（当时是主题 / 音源 / 歌单三类，Worker 能力沙箱 + `@host` 白名单 + 本地 SSRF 防护代理，后两类与全部出网能力已在 `v1.7.4` 移除，见 `.context/architecture/mineradio-plugin-system.md` 与 `docs/PLUGIN_AUTHORING.md`）；保留壁纸模式入口与「壁纸展示位置」切换（`桌面壁纸层` / `播放器背景板`，共用 `public/wallpaper-effect.js`）、MP2、M4B、AIF/AIFF/AIFC 本地音频识别、扫描和代理 MIME 支持、标准迷你播放器隐藏播放时低平滑分析器回退、`0.00 ~ 3.00` 独立强度、开关、窗口几何上限、软件内更新线路选择与取消更新、Wallpaper Engine 生命周期、主窗口导航/IPC 信任边界、本地文件授权、本地歌单、全屏与用户数据迁移能力。
- 统一备份区：`E:\桌面\播放器软件\工作区备份`

## Start Every New Codex Thread Here

新对话开始处理 Mineradio 前，必须先确认当前目录是：

```powershell
C:\Users\Administrator\Desktop\Mineradio-main
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

前端主逻辑在 `public/index.html`。当前环境以 `C:\Users\Administrator\Desktop\Mineradio-main` 为可写源码仓库；旧 `E:\桌面\播放器软件\Mineradio\resources\app` 在本环境不存在。改动后至少做：

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
- 重要：不要再改旧外层源码目录。旧的 `E:\桌面\播放器软件\Mineradio\public` / `desktop` 已经归档；当前环境以 `C:\Users\Administrator\Desktop\Mineradio-main\public` / `desktop` 为准。

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
- 遇到 `Electron 透明无边框全屏`、`setFullScreen`、`isFullScreen 返回 false`、`windowFullscreenActive`、`htmlFullscreenActive`、`全屏窗口被缩回`、`display.bounds`、`workArea` 或 `WS_THICKFRAME` 时，必须优先读取 `.context/pitfalls/mineradio-electron-transparent-fullscreen.md`。
- 遇到 `安装器无法关闭 Mineradio`、`Failed to uninstall old application files`、`customCheckAppRunning`、`CloseMainWindow`、`SessionId`、`ProcessId = $PID`、`更新安装器启动后退出播放器` 或 `覆盖安装误杀其它实例` 时，必须优先读取 `.context/pitfalls/mineradio-nsis-process-close.md`。
- 遇到 `标准迷你播放器自动收回按钮`、`完整控制栏右上角 ×`、`封面悬停展开`、`封面拖动移动`、`靠右向左展开`、`expandDirection`、`disableAutomaticCollapse`、`收回后空白区仍吞鼠标`、`setIgnoreMouseEvents`、`封面热区恢复交互`、`mineradio-mini-player-set-pointer-passthrough`、`词按钮左下角镜像`、`悬浮展开收回显示错位`、`词按钮飞到面板中间`、`transform 变成绝对定位包含块`、`叉号误改为关闭窗口` 或 `极简模式叉号` 时，必须优先读取 `.context/conventions/mineradio-mini-player-collapse.md`。
- 遇到 `自动播放开关`、`启动自动继续播放`、`启动随机播放`、`autoPlaybackMode`、`AUTO_PLAYBACK_STORE_KEY`、`startAutoPlayback`、`fx-playback-fold`、`自动播放歌单` 或 `启动恢复只起播一次` 时，必须优先读取 `.context/conventions/mineradio-auto-playback.md`。
- 遇到 `迷你播放器封面律动无效果`、`runMiniPlayerPulseTimer`、`miniPlayerPulseBaseline`、`隐藏窗口 AudioContext suspended` 或 `脉冲长期固定满值` 时，必须优先读取 `.context/architecture/mineradio-player-performance-seams.md`。
- 遇到 `封面律动强度`、`封面光晕强度`、`律动光晕不够明显`、`miniPlayerPulseStrength`、`miniPlayerGlowStrength`、`MINI_PLAYER_EFFECT_STRENGTH_MAX`、`MAX_MINI_PLAYER_EFFECT_STRENGTH`、`saturateMiniEffect`、`readMiniEffectStrength`、`--mini-pulse`、`--mini-glow`、`封面放大裁切`、`光晕被窗口裁掉` 或 `360 × 84 几何上限` 时，必须优先读取 `.context/architecture/mineradio-player-performance-seams.md`。
- 遇到 `软件内更新线路`、`自动测速`、`最快线路`、`UPDATE_ROUTE_PROBE_BYTES`、`rankUpdateDownloadCandidates`、`测速超时部分样本`、`镜像摘要门禁`、`手动选择更新线路`、`UPDATE_ROUTE_MODES`、`filterUpdateRouteCandidates`、`UPDATE_ROUTE_UNAVAILABLE`、`本机代理下载更新`、`resolveUpdateProxyTarget`、`CONNECT 隧道`、`取消更新`、`cancelUpdateDownloadJob`、`job.applying 拒绝取消` 或 `canceled 终态` 时，必须优先读取 `.context/architecture/mineradio-update-route-selection.md`。
- 遇到 `代理线路取消无效`、`取消后继续下载`、`Readable.toWeb 不认 signal`、`nodeResponseAsFetchLike`、`逐块 throwIfUpdateJobCanceled`、`隧道 socket 未释放` 或 `res.destroy(err) uncaughtException` 时，必须优先读取 `.context/architecture/mineradio-update-route-selection.md`。
