# Mineradio Project Memory

这个文件用于解决新开 Codex 对话时“失忆”的问题。每次用户明确说“保留”“喜欢”“这个很好”“记住”“保存一下”等表达时，要把关键结论追加到这里。

## Stable Project Facts

- 当前源码续版：`v1.8.8`（① 视觉预设「音域回响」= 预设 7，常量名 `SONIC_TOPOGRAPHY_PRESET_INDEX = 7`。**这是移植，不是原创**：地形算法逐段移植自上游社区分支 `XxHuberrr/Mineradio` 的 `public/sonic-topography-preset.js`（GPL-3.0，与本仓库同许可，commit `89c0d23`），它又标注移植自 `yin-yizhen/sonic-topography` 1.1.1（commit `3ff303e`），原始创意是 CmzYa 的 Wallpaper Engine 作品《音域回响》（Workshop 物品号 `3747222633`），出处链写在 `NOTICE.md` 与 `public/sonic-topography-preset.js` 的文件头。**v1.8.7 发出去的那一版是我在自己 shader 框架里做的频谱环、和原项目不是一回事，用户当场纠正「和原项目的回响不一样这是原项目 https://github.com/XxHuberrr/Mineradio」——「原项目」指上游这个 fork、不是 Workshop 作品本体，以后别再把它读成「源码拿不到、只能做原创致敬」。** 那一版的 `SPECTRUM_ECHO_*` 子系统（64×64 `DataTexture` / `spectrumEchoTex` / `uSpectrumTex` / 着色器 `uPreset > 6.5` 两处分支 / `updateSpectrumEchoField` / `resetSpectrumEchoField`）已整体删除、`grep` 零命中，`else if (uPreset < 6.5)` 放宽回 `else`，`presetMeta[7]` 的说明从 `频谱回响 · 致敬 CmzYa` 改成 `音域地形 · 移植 CmzYa`，`tests/spectrum-echo-preset.test.js` 已 `git rm`。**这批地形改动已作为 v1.8.8 发出去了**（用户先说「改好先不发布新版本我本地先看一下效果」，看完之后改口「更新好后发布新版」）：五处版本钉一起动到 `1.8.8`。**另外 v1.8.7 的 GitHub Release 已经不在了**（tag `v1.8.7` 仍在远端，但 `releases/tags/v1.8.7` 返回 404、草稿 0 个，`Build and Release` run `33938522336` 当时是成功的，说明是发布之后被删掉的），所以 `releases/latest` 从 `v1.8.6` 直接跳到 `v1.8.8`，别拿 v1.8.7 当在线的对照版本。另一条路本来就通——项目已有 Wallpaper Engine 集成（`desktop/wallpaper-engine-library.js`，`WALLPAPER_ENGINE_APP_ID = '431960'`），装了原作就能直接当桌面壁纸层或播放器背景板跑。**移植落在独立兄弟脚本 `public/sonic-topography-preset.js`（1083 行，IIFE 挂 `window.MineradioSonicTopography`，导出 `{INDEX, isActive, update, clear, onPresetChange, pointerRipple}`），不塞进 `app.js`** —— 这样地形用自己的 `ShaderMaterial`，`app.js` 的着色器字符串机器一个字节都不用碰（`bloomVs` 由 `vs` 两次逐字节精确替换派生，锚点 `'uniform float uMouseActive, uPixel, uColorMixT, uLoading;'` 与 `'gl_PointSize = sz * uPixel * uPointScale;'` 必须保持原样）。`public/index.html` 里 `<script src="sonic-topography-preset.js"></script>` **必须排在 `app.js` 之前**（`app.js` 顶层就会取 `window.MineradioSonicTopography`）；打包不用动，`build.files` 本来就是 `public/**/*`。渲染结构是四个 `InstancedMesh`（地形 `BoxGeometry(boxWidth,1,boxWidth)` × gridSize²、悬浮方块 80、流星 20、尾迹 200，全部 `frustumCulled = false`、每帧只写实例矩阵），精度按画质档位封顶 `QUALITY_GRID_CAP = {eco:112, balanced:160, high:192, ultra:224}`，默认密度 46 → 156×156，`spacing = TERRAIN_BASE_SIZE(168) / gridSize`、柱宽 `spacing * (0.9/1.05)`。**音频量纲是唯一需要适配的地方**：上游有细粒度频谱监听，本项目只有 `{bass, mid, treble, beat, energy}` 五个标量，所以 `readMineradioAudio` 从这五个值推 8 段频谱与 `kickEnvelope`；上游阈值不动（涟漪 `kickEnvelope > 0.58`、0.32 复位、流星 `> 0.62 && random < 0.045`），改的是入口——本项目 `beatPulse` 峰值约 `0.62~0.92`，所以帧循环传 `beat: Math.min(1, beatPulse * 1.35)`。**帧钩子必须排在 `updateSkullParticleLayer(dt, frameShelfState);` 之后**（也就是 `particles.rotation.x/y +=` 已经加完的位置），地形才和主粒子层共用同一帧旋转，与上游顺序一致；传入的 `sonicTopographyCtx` 在模块外预分配、逐帧填字段（`scene` 1739 行 / `orbit` 1951 行 / `particles` 4812 行都声明在它之后，所以声明处只能是空壳），60fps 下不造垃圾；模块从不读 `ctx.screenHeight` / `ctx.dpr`，别往 ctx 里加没人用的字段。涟漪 uniform 打包沿用上游 `vec4(x, z, start, ±strength)`，**w 取负号 = 白色细涟漪**（军鼓与高频），正号是底鼓蓝涟漪；`RIPPLE_MAX 10` / `RIPPLE_LIFETIME 4.8` / 软淡出 `2.1` 秒是**插值进 GLSL 的**（着色器里能看到 `2.10,4.80`），改常量等于改着色器；`syncRippleUniforms` 排在 `updateAudioTriggers` 之前，所以第 N 帧新增的涟漪要到第 N+1 帧才进 uniform（测试钉住了这条）。`update` 的顺序也被钉住：透明度积分 → `if (!active && opacity < 0.01) { 隐藏; return; }` → `if (!scene) return;` → `ensureLayer` → 旋转 → 布局 → `sonicTime += dt * (0.45 + motionSpeed*0.017)` → uniforms → 触发器 → 写矩阵 → `root.visible = opacity > 0.02`；**透明度积分在 `!scene` 早退之前**，所以「没有场景也会淡出」是有意行为、不是漏判（写测试时踩过：无场景那一帧把透明度积到 0.05，下一帧切到预设 5 就不再满足 `!active && opacity < 0.01`，于是照样建层——这是正确的淡出行为，要断言「冷启动不分配」必须换一个全新 harness）。画布单击（不是拖动）打涟漪挂在 `mouseup` 上，判 `!mouseDownAt.hadDrag && !isPointerOverUi(e)`，按压时长换强度（`0.25 + 秒数*2.6`，上限 `3.0`），屏幕坐标映射到世界 ±17。背景星河在这个预设下压到 `0.82`（`skullBackdropDim`，与上游一致，不压会糊成一片）；`isSoftFlowPreset` 仍覆盖 5 与 7；`setPreset` 给 `p === 7` 的相机基线是 radius `8.4` / phi `0.18`（v1.8.7 那版是 `8.6` / `0.16`）。上游有四个字段在本项目里是死的、移植时故意丢掉了：`manualYaw` / `dummyObj` / `lastOrbitTheta` / `orbitThetaReady`。**三个行为等价的写法差异**：涟漪寿命常量插值进 GLSL、`bindVisualRotation` 只吃 ctx、`syncTerrainUniforms` 把 `themeAudio` 提成一个共享局部量。② **全屏退出黑屏卡顿**根因是遮罩被后到的信号一路顺延（退出时 resize、边界还原、`leave-full-screen` 状态推送连发好几轮，每轮都重排回亮计时器），现在 `scheduleFullscreenTransitionReveal` 只允许提前——`if (revealDue && due >= revealDue) return;`，resize 或尺寸已跳变用 50ms、纯状态推送用 110ms；硬上限 `FULLSCREEN_TRANSITION_MAX_COVER_MS = 320` **独占 `deadlineTimer` 一个槽**，resize/state 只能重排 `revealTimer`、抢不掉它，动作前摇 110ms、收尾 220ms、降低动效偏好 20/90/30/80；`desktop/main.js` 的 `applyWindowedBounds` 边界已到位就不再 `setBounds` 但仍 `sendWindowState`，`leave-full-screen` 与 `leave-html-full-screen` 都立刻推状态；CSS **窗口壳过渡不能带 `filter`**（`#desktop-window-shell` 承载 WebGL 画布，加 filter 会让整窗每帧重新合成），只留 `will-change:transform`。测试 `tests/sonic-topography-preset.test.js` 16 例（THREE stub 直接读实例矩阵，钉住的是行为：流星未激活时藏在 `y = -1000` 且缩放 0、落地正好撒 10 粒尾迹、尾迹一秒内过期、切走预设整层释放显存、冷启动停在预设 5 时一个实例都不分配；`Math.random` 注入以便确定性；three.js r128 的 `Color` 不做 sRGB→linear，所以 stub 直接按十六进制解析）+ `tests/fullscreen-exit-transition.test.js` 7 例，全量 `939/939`（v1.8.7 基线 `932`，新增 16 例、删掉失效的 9 例）；`node --check` 干净；**但地形层与重调后的全屏过渡都没有在真实窗口里逐帧核对过**，观感项（涟漪强度、配色跟封面的搭配）留给用户反馈再调。待定：上游仓库里还带着一份 CmzYa 的 WE 打包产物（约 1.26 MB、没有署名文件）与一个桥接页，本轮**没有** vendor 进来。逐条见 `docs/PROJECT_MEMORY.md` 的 `### 2026-09-05 - 音域回响改成移植上游实现（v1.8.8）` 小节（同日的 `### 2026-09-05 - v1.8.7` 小节只作历史记录，别照它找代码），发布过程见 `RELEASE.md` 顶部小节。）
- 上一续版：`v1.8.6`（左下小封面接上歌曲详情。`public/index.html` 的 `#thumb-cover` 加 `onclick="openTrackDetailModal('song')"` 与 `title="歌曲详情"`，`public/app.css` 的 `#thumb-cover` 规则加 `cursor:pointer`，**一行 JS 都没新增**。空闲态不需要额外守卫：`openTrackDetailModal` 第二行就是 `if (!song) { showToast('先播放或选择一首歌'); return; }`，而且 `#thumb-wrap` 拿到 `.visible` 之前是 `pointer-events:none`。**中途试过让上下两行一致（把 `#thumb-artist` / `#control-artist` 的 `openTrackDetailModal('artist')` 改成 `'song'`）被用户当场否掉——原话「这个不用改了」——已完整还原；歌名进歌曲详情、歌手行进歌手详情这个分工是设计，别再顺手改。** 底部 `#control-cover` 故意没跟着改：它是 `aria-hidden="true"` 的装饰性 `div`，挂点击要连带处理无障碍语义。`#thumb-cover` 里那句 `transition:transform .15s ease` 是历史遗留、当前没有任何 `:hover` 触发它，本轮故意没补 hover 缩放，测试用 `assert.doesNotMatch(appCss, /#thumb-cover:hover/)` 把「不加」也钉住。`tests/now-playing-detail-click.test.js` 4 例（读 `index.html` 属性 + `app.css` 规则 + `app.js` 里那句兜底的正则），全量回归 `916/916`（上一版基线 `912`），四例先在改前源码上对跑过、封面 `onclick` 与 `cursor:pointer` 两条判红；`public/app.css` 只动第 573 行一行；**真实窗口里没有肉眼点过**。发布过程见 `RELEASE.md` 顶部小节。）
- 更早续版：`v1.8.5`（播放统计漏账修复，四处：**① `flushPersistentVisualState`（绑 `beforeunload` / `pagehide`）原本不结算听歌会话**，退出前正在听的那一首永远不进统计，补上 `finalizeListenSession(false)` 并套 `typeof` 守卫；`finalizeListenSession` 内部会置空 `listenSession`，两个事件都触发也只结算一次。**② 结算写的那份必然丢**：`scheduleLocalUserStateWrite` 是 120ms 防抖，卸载时 `setTimeout` 不会再执行，所以拆出 `runLocalUserStateWrite(id)`（立即执行一条并取消定时器）与 `flushLocalUserStateWrites()`（冲全部），待写载荷改存进 `localUserStatePendingWrites`（原来只活在定时器闭包里，外面冲不出来），`flushPersistentVisualState` 末尾冲一次。**`function scheduleLocalUserStateWrite(id, value, legacyKey)` 这行签名不能改**，`tests/complete-optimization-gates.test.js:58` 钉着。**不能靠改 hydrate 的取值优先级来兜这个洞**：`hydrateLocalUserStateRecord` 是 IndexedDB 记录优先、legacy `localStorage` 兜底，卸载时同步写 `localStorage` 是白写，下次启动照旧读到更旧的 IDB 记录，唯一正确的做法是把 IDB 写入本身提前发起；自定义封面 / 歌词 / 歌词候选 / 节拍图 / 节拍偏好 / 音效档案六份状态同一个漏法，一起好了。**③ `updateListenStatsTick` 第一行的 `!audio.duration` 让结算门里的 30 秒兜底成了死代码**：APE/DSF 走虚拟 WAV、元数据没解析出来时 `audio.duration` 是 NaN，一旦早退 `listenMs` 恒为 0，`(!audio || !audio.duration ? session.listenMs >= 30000 : false)` 永远不可能成立；门槛改成只看 `audio.paused`，`maxProgress` 那行自己用 `isFinite(duration)` 兜。**④ 最小化空档原本一次只补 4200ms**：`schedulePlaybackTickTimer` 在 `document.hidden && !isLiveBackgroundKeepMode()` 时不排 tick，回前台那次增量被 `Math.min(..., 4200)` 吃掉，后台听三分钟只记 4.2 秒；改成音频与墙钟推进量对得上（差值不超过 `max(1500, paired * 0.25)`）才整段补回，上限 `LISTEN_TICK_CATCHUP_MAX_MS = 1800000`。**贯穿的安全性质：补账基数始终是 `Math.min(deltaByAudio, deltaByWall)`，两个时钟对得上只提高上限、绝不抬高基数**，所以拖进度条（音频跳、墙钟不跳）、卡顿（墙钟跳、音频不跳）、长时间暂停都不可能被记成收听；原来那句 `delta < 8000` 在 4200 上限下恒真、本就是死代码，跟着去掉。**45 秒 / 一半进度 / 听完这三条结算门槛是设计，一字未动**，跳过的歌不记账，修完之后仍然会有歌显示空态；`localKey` 是 路径:size:mtime，改标签或转码会让旧记录成为孤儿，这一点也按原样保留。切片锚点：`var LISTEN_TICK_CATCHUP_MAX_MS = ` 到换行加 `var appPerfMarks`（上限从源码切出来，测试不硬编码）、`function beginListenSession(` 到 `function mostPlayedSong(`（计时与结算拼同一个 realm，listenMs 是真算出来的）、`function flushPersistentVisualState() {` 到 `window.addEventListener('beforeunload'`、`function runLocalUserStateWrite(` 到 `function hydrateLocalUserStateRecord(`，**动这四处前先 grep tests**。`tests/listen-stats-accounting.test.js` 7 例，全量回归 `912/912`（上一版基线 `905`），七例先在修前源码上对跑过、全红；界面零改动，`public/index.html` 与 `public/app.css` 一行未动；**真实窗口里的播放统计本轮没有肉眼验证过**。逐条见本文件 `### 2026-09-04 - v1.8.5` 小节，发布过程见 `RELEASE.md` 顶部小节。**上一版 `v1.8.4` 的音乐库维护约束整段继续有效**，见下一条。）
- 更早续版：`v1.8.4`（音乐库维护：`重复检测` / `失效文件` / `无封面` / `无歌词` / `标签异常` 五项，kind 前缀 `library-fix:<id>`，与 `library-cat:` / `library-group:` / `library-value:` 同走 `normalizeLocalPlaylistKind` 那道门、认不出的一律回落 `library`，且因为 `setLocalPlaybackPlaylistSelection` 的持久化门是 `indexOf("library-") !== 0`，维护 kind 天生不落盘。**核心约束是三态判定：`has` / `none` / `unknown`，拿不准的必须单独报成「N 首待扫描」，既不许并进缺失数、也不许算成正常。**`localCoverLoaded` / `localLyricLoaded` 为真且没有内容就是「确认没有」的定论（后台与轻扫描落空时只有可截断格式才置 `*LightScanned`），所以不需要再查格式能不能读；**判定顺序里 `localLyricLoaded` 必须排在「同目录有同名歌词文件」之前**，否则空的或解密失败的 `.lrc` 会被永远算成有歌词。重复检测的归一化**故意不剥 `(Live)` / `(Remix)`**（剥掉会把现场版和录音室版判成同一首），分组键用 `String.fromCharCode(1)` 连接归一标题与归一艺术家，撞键后 `localLibraryMaintenanceDuplicateLike` 复核：体积相同算重复、时长都大于 0 且差超过 2 秒的摘掉、**时长还没读出来时不摘**；标题空到文件名也兜不出来时只进待扫描。失效文件是唯一要问磁盘的一项，所以 `localLibraryMaintenanceProbe` **故意不被 `invalidateLocalLibraryMaintenanceIndex()` 清掉**（`invalidateLocalLibraryCategoryIndex()` 每次歌单查表都会跑，挂上去的磁盘结论活不过一次渲染），结果按 `localKey` 记、改过标签的歌自然掉出名单。新 IPC `mineradio-local-music-probe-entries` 套 `trustedMainFrameHandler`，`probeAuthorizedLocalFiles` 逐条先 `resolveAuthorizedLocalFile` 再 `fs.promises.stat`，回一个与入参等长同序的 `states`（只有 `ok` / `missing` / `blocked`），返回体只有 `states` / `checked` / `ok` / `truncated` 四个键，**任何文件内容都不出主进程**；**`blocked` 必须和 `missing` 分开**（授权失败不等于文件被删）。上限 `LOCAL_LIBRARY_PROBE_MAX = 2000` 截断如实回报，并发 `LOCAL_LIBRARY_PROBE_CONCURRENCY = 8`，渲染层按 `LOCAL_LIBRARY_MAINTENANCE_PROBE_BATCH = 400` 切批、每批刷一次面板，**回来的 `states` 长度对不上就整批作废抛 `PROBE_STATES_MISMATCH`、绝不按位置错配**。资产扫描不改 `localKey`，所以「长度 + 首尾键」的签名认不出封面/歌词刚读完，另加 `localLibraryMaintenanceEpoch` 在 `syncLocalSongAssetFields` 顶上用 `typeof` 守卫着加一（守卫必需，两个常驻测试会把那个真函数切进 vm）。桶表查询一律走 `localLibraryMaintenanceBucket()` 的 `hasOwnProperty` 闸门（`library-fix:constructor` 不能取到 `Object.prototype` 上的东西，与 v1.8.3 的 `constructor.mp3` 同源）。界面零改动：五张卡片是 `localLibraryCategoryHomeCardsHtml()` 的第三段，点进去复用既有分类列表渲染器，**`public/index.html` 与 `public/app.css` 一行未动**；失效文件那项抬头把「播放全部」换成「重新检测」，卡片也不给 ▶。切片锚点：`function normalizeLocalPlaylistKind(kind)` 到 `function localSongIndexByKey(songs, key)`（模型）、`function localLibraryCategoryHeadHtml(view, count)` 到 `/* 分组项也走面板的懒加载额度`（渲染，与模型拼同一个 realm）、`function renderLocalLibraryPlaylistPanel(opts)` 到 `function toggleLocalLibraryLike(index)`（空态）、`desktop/main.js` 的 `async function probeAuthorizedLocalFiles(paths)` 到 `async function refreshLocalMusicFileEntries(folderPath, snapshotOrFiles)`（主进程探测）——**动这些函数名前先 grep tests**。`tests/library-maintenance.test.js` 24 例，全量回归 `905/905`（上一版基线 `881`）；**五张卡片在真实窗口里的观感本轮没有肉眼验证过**。逐条约束与踩坑见本文件 `### 2026-09-04 - v1.8.4` 小节，AGENTS.md 的当前源码续版条目是同一份的完整版，发布过程见 `RELEASE.md` 顶部小节。**上一版 `v1.8.3` 的 QRC 加密歌词约束整段继续有效**（QRC 的 3DES 不是标准 3DES、五处在野偏差、`des-ede3` 不能当参考实现、解密链 `D(K3) → E(K2) → D(K1)` → zlib → 剥 BOM、`.qrc` 的 MIME 必须 `application/octet-stream`（`server.js` 与 `desktop/main.js` 两处）、优先级只在同一层内比、候选桶查表走 `localLyricCandidateBucket()`、合法 UTF-8 绝不重猜、`[offset:±N]` 正值表示提前且偏过头夹到 0、手动选歌词走 `propagateLocalLyricPick`），见本文件 `### 2026-09-04 - v1.8.3` 小节。**更早 `v1.8.2` 的多格式歌词约束（分流顺序即语义，KRC / QRC 必须排在 YRC 前面；新后缀四处清单；`finalizeLyricLineDurations` 第二参数）与 `v1.8.1` 的整机备份约束（身份存 `{folder, rel, size, mtime}` 绝不存绝对路径、`mineradioBackupRelPath` 保原始大小写、探目录只能用 `api.refreshLocalMusicFiles(folder, [])`、取消一律 `return null` 绝不返回 `[]`、`config.player` 十六键白名单、同机重复导入会把播放次数翻倍所以要两步确认、两个 handler 必须留在 `mineradio-export-json-file` 之前）也整段继续有效**，分别见 `### 2026-09-03 - v1.8.2` 与 `### 2026-09-03 - v1.8.1` 小节。）
- 更早续版（v1.7.29）：`v1.7.29`（同步指示器「已同步 xx 首歌曲」移到搜索框下面并接上主题插件令牌；另修掉曲库清理的扫描代号缺陷——`desktop/local-library-store.js` 的 `nextSyncStamp` 因为清理用 `seen_at<>?` 判定，**必须每根严格递增、不能直接用 `Date.now()`**，同一时钟刻度里的两次扫描会让该删的文件躲过清理。全量回归 `846/846`。）
- 更早续版：`v1.7.28`（无缝播放（Gapless）与 `0~10` 秒交叉淡入淡出（Crossfade）。架构是「双 deck 音频池 + 会移动的全局 `audio` 指针」：`MediaElementSource` 建好就永久绑死那一个 `<audio>`、无法改指向，所以交叉必须要第二个元素配第二个 source。`audioDeckList` 常驻两个 `<audio>`，每个 deck 永久接好 `deck.source → deck.gain → analyser`（`deck.gain` 另并一条到 `beatAnalyser`），共享尾链 `analyser → replayGainNode → audioChain → gainNode → destination` 一行未动；**`gainNode.gain` 继续独占 `targetVolume` 与全部既有淡入淡出，`deck.gain` 只做接续与交叉**，中性值恒为 `1.0`（IEEE754 位精确透明），所以依旧是「整条链常驻音频图、绝不运行时改接线」。全局 `var audio` 被重指向到当前可闻那个 deck（`audioDeckList` / `audioDeckActive` 声明在 `public/app.js` 第 11 行，必须早于任何用 `audio` 的代码），UI、进度、听歌统计、media session、桌面歌词、迷你播放器全部零改动跟着走。三档行为契约：无缝关 + 交叉 `0` = 100% 老逻辑；无缝开 + 交叉 `0`（默认）= 预取 + `12ms` deck 斜坡接管、任何时刻只有一路出声（相邻两首之间那段可闻空档的根因是主淡入 `460ms`，不是解码慢）；交叉 `> 0` = 等功率 `sin/cos` 交叠（线性交叉中点掉约 `3 dB`，别改回线性）。只有 `opts.autoAdvance` / `opts.autoRepeat` 允许接管预取 deck，手动 / 上一首 / 下一首一律不接管，随机待洗牌时 `gaplessShufflePending()` 为真则既不预取也不交叉。提交时序不能动：起播 → 等 `play()` 真 resolve → `commitCrossfadeHandoff` 才对交并推进队列，被拒 / 抛错 / 不返回 Promise 都原样退回且失败 URL 进黑名单，收尾定时器带序号自增守卫、作废那轮不许停掉新 deck。`setValueCurveAtTime` 在 `now` 已有自动化事件时会抛，所以 `rampAudioDeckGain` 是 cancel → curve，抛了再 cancel 并退回 `setValueAtTime` + `linearRampToValueAtTime`。设置存独立 `mineradio-gapless-v1` 并登记进 `PERSISTENT_UI_STATE_KEYS`，绝不写进 `fx`，`gapless-crossfade` 滑杆不进 `bindFxPanel` 的 `ids` 白名单。界面只在 `fx-volume-fold` 与 `fx-eq-fold` 之间加一个同构折叠区 `fx-gapless-fold`，`public/app.css` 一行未动。已知取舍：`replayGainNode` 只有一个且在 `analyser` 之后，均衡增益作用在两路求和之后，交叉那几秒两首歌共用同一个 ReplayGain 增益。引擎块整段夹在 `var GAPLESS_CROSSFADE_MIN_SECONDS` 与 `var REPLAY_GAIN_PREAMP_MIN` 之间（`tests/gapless-crossfade.test.js` 按这对锚点跑 vm），里面新增裸标识符会在 vm 抛 `ReferenceError` 并被 `.catch` 吞掉。`tests/gapless-crossfade.test.js` 27 例，全量回归 `834/834`。）
- 更早续版（v1.7.25）：`v1.7.25`（全局快捷键默认 `Ctrl+Alt+←/→` 上下一首、`Ctrl+Alt+↑/↓` 音量、`Ctrl+Alt+Space` 播放/暂停，九个动作全部可自定义，录制时先做 Electron 加速键语法校验、注册失败按「不支持 / 被占用」分类回报并合并成一条提示；播放队列补齐三模式互斥直达按钮、播完即停一次性开关、下一首预览行、拖动重排和队列存档保存/恢复，并修掉 `removeFromQueue` 的高亮错位。全量回归 `709/709`。`v1.7.26` 与 `v1.7.27` 不在本链条里，长期约束按日期归档在文末 `### 2026-09-02 - v1.7.26` 与 `### 2026-09-03 - v1.7.27` 两节。）
- 历史续版：`v1.7.24`（音乐库升级成外层标签页：`#playlist-panel` 顶部 `.panel-tabs` 现在是 `当前队列 / 歌单 / 音乐库` 三个并排 tab，`public/index.html` 新增 `id="tab-library"`（顺序 `tab-queue` → `tab-pl` → `tab-library`）。**tab 名 `'library'` 和播放列表 kind `'library'`（全部音乐）不是同一层概念**，别混。两个 tab 共用同一个 `#pl-pane` / `#pl-list` 和同一份 `localLibraryPlaylistSelection`，所以 `switchPlaylistTab` 切 tab 时要把选中项摆到对应那一层：切到 `library` 且选中不是分类就置 `LOCAL_LIBRARY_CATEGORY_HOME_KIND`，切回 `playlists` 且选中是分类就退回 `'library'`，各跟一次 `resetPlaylistPanelRenderLimit()`；切到 `queue` 绝不动选中项（否则停在某位艺术家上看一眼队列再回来就串页）。**`switchPlaylistTab` 只改状态 + 渲染，绝不能调 `selectLocalPlaylist`**（后者走 `safeSwitchPlaylistTab`，而 `switchPlaylistTab` 又 `refreshUserPlaylists()` → `renderLocalLibraryPlaylistPanel()`，互调必递归）。所有「面板正在铺卡片列表」的判断收口到 `isPlaylistListTab(tab)`（`playlists` 或 `library`），四处：3D 歌单架 `currentItems()` 的 `showPlaylists`、`toggleLikeSong` 的刷新、面板打开的入场动画分支、`switchPlaylistTab` 自己的 `#pl-pane` 显隐与动画；`toggleLikeSong` 那处必须写成 `typeof isPlaylistListTab === 'function' ? … : queueViewTab === 'playlists'`，因为 `tests/special-liked-playlist.test.js` 把它单独切进 vm、只注入了 `queueViewTab`，裸调会 `ReferenceError`，而 `tests/local-library-categories.test.js` 有一条按行过滤的断言禁止源码里再出现别的 `queueViewTab === 'playlists'`。工具条共用，`applyPlaylistPaneToolbarMode(tab)` 切 `#pl-pane-chip` 文案并在音乐库页隐藏 `#pl-pane-create-btn`（「新建」只对独立歌单有意义，「导入」保留）。渲染侧删掉根视图那张「音乐库」卡（`歌单` 页恢复成 特别喜欢 → 独立歌单 → 全部音乐），分类首页不再画 `view-head`（标题由外层 tab 承担）；`localLibraryCategoryHeadHtml` 是 `directory ? '' : 播放全部`，所以**只有歌曲层有「播放全部」**，首页与分组层从来没有。`queueViewTab` 不持久化、默认 `'queue'`。三个 `.panel-tab` 合计约 187px，装得进面板 304px 内宽，**`public/app.css` 一行未动**。`tests/local-library-categories.test.js` 25 例，其中两例用 `node:vm` 跑真实 tab 逻辑（切片锚点 `function normalizePlaylistPanelTab(tab)` → `function setMiniQueueOpen(open)`，十个假节点），全量回归 `655/655`。）
- 更早续版：`v1.7.23`（音乐库智能分类：`library-cat:<id>` / `library-group:<field>` / `library-value:<field>:<value>` 三层 kind 都挂在 `library-` 前缀下，加 `library-cat:home` 当首页，全部经 `normalizeLocalPlaylistKind` 一道门，认不出的 `library-*` 回落 `'library'`；`library-value:` 只在第一个冒号处切分。`localPlaylistSongs` 的分支顺序是硬约束——特别喜欢 → 独立歌单 → 智能分类 → `localSearchPool()`，`tests/special-liked-playlist.test.js:117` 用 `strictEqual` 钉死 `library` 必须原样交出同一个数组。分类模块整段放在 `function normalizeLocalPlaylistKind(kind)` → `function localSongIndexByKey(songs, key)` 之间（三个测试按这对锚点跑 vm），跨切片调用一律 `typeof` 守卫（`ensureListenStatsState`、`queueItemKey`、`LOCAL_LIBRARY_NAME_COMPARE`）；`setLocalPlaybackPlaylistSelection` 的持久化门用内联 `'library-'` 字面量，因为 `tests/special-liked-playlist.test.js:211` 从它本身起切片、常量切不进来。动态分类只在内存里当播放来源，三处一起兜：不写 `LOCAL_PLAYBACK_SOURCE_STORE_KEY`、读回时当 `'library'`、`openLocalLibraryQueue` 空分类落回全部音乐。单槽缓存 `localLibraryCategoryCache` 一次遍历建五个分组与三个统计列表，签名 `length|首localKey|末localKey|listenStats.updatedAt`，`invalidateLocalPlaylistSongLookup()` 末尾追加 `invalidateLocalLibraryCategoryIndex()` 覆盖导入/恢复/自动同步/监控四条路径。入库时间戳只能放渲染层 `mineradio-local-added-at-v1`（pathKey 键，上限 4000，超了裁最旧）：SQLite 曲库表没有迁移通道，`FILE_INDEX_COLUMNS` 丢未知字段、`FILE_UPSERT_SQL` 的 keep 分支在指纹变化时清列、`ensureOpen()` 只有 `CREATE TABLE IF NOT EXISTS`；只给 `stats.hasIndex` 为真时的 `'new'` 盖章，首次整库导入不盖，没盖过的回落 `localFileLastModified`；模块故意插在 `function localLibraryAssetStatus(` 之前避开 `tests/local-lyric-cache-residency.test.js` 的切片。渲染只加 JS：根视图多一张"音乐库"卡且顺序为 音乐库 → 特别喜欢 → 独立歌单 → 全部音乐，复用既有玻璃类，`public/app.css` 与 `public/index.html` 一行未动，`domSignature` 必须带 `localLibraryCategoryDomSignature(selectedCategory)`，分组卡片走 `data-pl-load-more` 分页，`#pl-list` 的三个 `data-library-*` 钩子必须排在 `closest('.pl-card')` 兜底之前。`tests/local-library-categories.test.js` 22 例，vm 跨 realm 断言前 `Array.from` 复制容器。全量回归 `652/652`。）
- 更早续版（续）：`v1.7.22`（真正的音效链 `预设 → EQ → Preamp → Limiter → Spatial → Output`：`initAudio()` 里 `replayGainNode.connect(audioChain.input)` → `audioChain.output.connect(gainNode)`，整条链常驻音频图、绝不运行时改接线，因为每级都有精确透明的中性值（biquad `gain=0`、`DynamicsCompressorNode` 在 `ratio=1` 时曲线退化成直线且 Blink 补偿增益恒为 `1.0`、`width=1` 的中/侧矩阵逐样本还原 L/R），切开关不会咔哒；末尾 `applyAudioChainToNodes(true)` 补位，否则重建节点后第一下漏掉音效链。10 段 ISO 频段 `31 Hz~16 kHz`，两端搁架、中间八段 `peaking` 且只给 peaking 设 `Q=1`，每段 `±12 dB` / `0.5 dB`。预设不存盘、由 `matchAudioChainPreset` 从曲线反推（容差 `0.001`，对不上就是 `custom`），存 id 会立刻和曲线脱钩。自动预增益 `-max(gains)`，与用户 `preampDb` 相加后夹在 `[-24, +12]`。限幅关掉只把 `ratio` 推回 `1`。声场是真中/侧矩阵，`widthInvert.gain` 必须恒为 `-1` 且只自动化 `width.gain`——它从 `width` 取信号，两个都推会把宽度乘成 `w²`。参数走 `0.08s` 短斜坡。档案 `xxx.eq.json` 需 `format === 'mineradio.eq'`，复用既有 JSON 导入导出 IPC，主进程零改动。设置存独立 `mineradio-audio-chain-v1` 并登记进 `PERSISTENT_UI_STATE_KEYS`，绝不写进 `fx`，13 个新滑杆不进 `bindFxPanel` 的 `ids` 白名单。引擎块从 `var AUDIO_CHAIN_BAND_FREQUENCIES` 到 `function applyVolumeToAudio(`，故意放在 ReplayGain 的 vm 切片之外；这段里新增裸标识符会在 vm 抛 `ReferenceError` 并被 `.catch` 吞掉（测试全绿但行为错），所以不用 `Array.isArray`、不用 `Infinity`。`public/index.html` 只加同构的 `fx-eq-fold`，`public/app.css` 一行未动。`tests/audio-effect-chain.test.js` 14 例，全量回归 `630/630`。）
- 历史检查点摘要：`v1.7.21`（音量均衡 ReplayGain：音频链路插入独立增益节点 `source → analyser → replayGainNode → gainNode → destination`——必须在 analyser 之后（可视化保持原始电平）、`gainNode` 之前（音量与淡入淡出仍由 `gainNode.gain` 独占）；`resolveReplayGain` 纯函数算 `10^((gain+preamp)/20)`，防削波按 `min(linear, 1/peak)` 封顶、没有峰值标签时不衰减，最后夹在 `0.05`–`4`，整轨/整专辑基准在缺标签时互相回退、两个都没有就保持原始电平；Preamp ±12 dB 按 0.1 dB 取整，改设置走 `80ms` 斜坡、切歌立即生效。标签采集不新增 extractor：Vorbis comment（FLAC 与 Ogg 共用）、ID3v2 `TXXX` 与新增 `readId3v2Rva2MasterGain`（只认主音量声道 `0x01`、故意不取峰值）、APEv2、M4A `----` 加 `readM4aFreeformName`，Opus `R128_*` 按 Q7.8 `/256` 补 `5 dB` 折算，`iTunNORM` 故意排除，真实 `REPLAYGAIN_*` 压过 R128；轻量扫描未读全时整块丢掉不写半截。持久化绕开 `LOCAL_METADATA_VALUE_FIELDS`（真值判定会丢掉合法的 `0 dB`），走 `assets.extra` JSON 列无需迁移，老缓存首次播放时惰性补齐一次并写回；设置存 `mineradio-replay-gain-v1` 不进 `fx`。`public/index.html` 只加一个同构折叠区，`public/app.css` 一行未动。新增 `tests/replay-gain-tag-parsing.test.js`（10 例）与 `tests/replay-gain-normalization.test.js`（12 例），`616/616` 全绿，UI 零改动）；更早版本接着看下面那条「历史检查点摘要（续）」。
- 当前可写代码/Git 仓库：`C:\Users\Administrator\Desktop\Mineradio-main`
- 当前环境未找到旧运行目录：`E:\桌面\播放器软件\Mineradio\resources\app`
- GitHub 仓库：`https://github.com/oirge/Mineradio.git`
- 统一备份目录：`E:\桌面\播放器软件\工作区备份`
- 历史检查点摘要（续）：`v1.7.20`（音乐文件夹自动监控：新增 `desktop/local-library-watcher.js`（`fs.watch` 递归 + `unref`，防抖 `900ms` / 最长等待 `4500ms` 双阀门，递归不支持时降级只看根一层，`EPERM`/`ENOENT` 按 `5000→60000ms` 退避重试，`overflow` 时让渲染层退回整库比对）；渲染层 `applyOwnedLocalLibraryRefresh` 有队列时不再提示「下次启动会自动同步」，改走 `applyLocalLibraryAutoSync` 原地增删改——`localLibrarySongs` 与 `playQueue` 是同一个数组只能原地改、改动的歌只改字段不换对象、正在播放那首即使文件被删也原位保留、接管时迁移 `customCoverMap` 的 `local:<localKey>` 并清空 `localUrl`、有在途解析则推迟到下一轮；右下角新增 `已同步 N 首歌曲` 指示器（懒建 `#local-sync-badge`、`4200ms` 淡出、`index.html` 未动、`app.css` 只追加 3 条）；顺手修掉 `.ape`/`.dsf` 漏在 `LOCAL_LIBRARY_AUDIO_EXTS` 外导致不计入曲库数量的老问题。**该指示器后来被移到搜索框下方**（挂进 `#search-stack`、绝对定位并与 `.search-mode-tabs` 那一行对齐、显示期间按住顶部搜索区的 `.peek`、配色走 `--th-*` → `--saved-panel-glass-*` 回落），当前形态与约束见 `AGENTS.md` 顶部那条续版说明。`594/594` 全绿，UI 零改动）。；`v1.7.19`（新增 Ogg Vorbis/Opus/Ogg FLAC、WAV（含 RF64/BW64）、APE、DSF 的标签/封面/歌词/时长解析；APE 与 DSD 经 `desktop/audio/wav-stream.js` 实时转成虚拟 WAV 后按 Range 播放；`desktop/audio/ape-decoder.js` 移植自 FFmpeg 属 `LGPL-2.1+`，声明记在根目录 `THIRD-PARTY-NOTICES.md`；DST 压缩的 `.dff` 不在范围内。`558/558` 全绿）。；`v1.7.18`（本地曲库改用 `node:sqlite` + 文件指纹/路径索引常驻磁盘；扫描先问数据库走增量、索引按行摘要增量回写、解除历史 `16000` 条截断；播放次数/最近播放/收藏状态双写进库但 `localStorage` 仍是唯一权威，UI 零改动）；`v1.7.16`（迷你播放器右键命中与安全边界加固发布候选；标准收回态只有封面热区（外扩 `6px`）可点可右键，透明空白交还桌面；标准展开态与极简外壳整窗可右键；封面拖动、跨显示器移动、展开方向持久化、迷你页面 URL/frame/preload/IPC 信任边界、极简负载与失败重试均已修复）基于 GitHub `v1.6.3`，插件系统在 `v1.7.0` 引入（当时是主题 / 音源 / 歌单三类，Worker 能力沙箱 + `@host` 白名单 + 本地 SSRF 防护代理），`v1.7.2` 起安装包自带 `午夜靛蓝` / `暖琥珀` 两份声明式主题（默认不启用）且主题改为互斥，`v1.7.3` 起主题走 `--th-*` 变量族接管 `app.css` 的 `!important` 字面值（覆盖 63/79 处探针，默认外观零变化）并把 `--th-mini-*` 转发给迷你播放器两套外壳，`v1.7.4` 起插件只剩主题一种，音源 / 歌单两类连同插件的全部网络与播放通道（`mineradio.request`、`@host` 白名单、`plugin-proxy.js`、`/api/plugin/*`）整体删除，**`v1.7.6` 起主界面最小化走收缩过渡并预热迷你窗口，`v1.7.7` 把交接时机改成「外壳淡到全透明之后再交给系统最小化」（`240ms`，终态 `scale(.6)`）才真正看得出来（见下方 v1.7.7 / v1.7.6 区块）**，**`v1.7.5` 起新增 `--th-bg-color` / `--th-bg-tint` / `--th-bg-tint-opacity` 背景变量，内置主题扩为两份完整主题 + 深海微光 / 暗焰余晖 / 冷杉夜雾三份纯背景主题，用户自定义背景仍优先**，**`v1.7.11`~`v1.7.14` 起迷你播放器右键菜单与任务栏托盘共用同一份 `buildAppContextMenuTemplate()`、六项完全一致（拖拽区靠 `system-context-menu` 拦系统菜单）；收回态只有封面参与命中、封面外交还桌面，展开态与极简整窗可右键（见下方 v1.7.14 / v1.7.13 区块）**；并保留壁纸展示位置切换、MP2、M4B、AIF/AIFF/AIFC 本地音频识别与代理 MIME 支持、隐藏播放时低平滑分析器回退、软件内更新的手动线路选择与下载中取消更新、迷你播放器封面律动/光晕可调强度、自动播放开关、收回态鼠标穿透、显示器边缘展开、封面拖动、Wallpaper Engine 生命周期、主窗口导航/IPC 信任边界、本地文件授权、多歌单、全屏过渡与用户数据迁移修复。
- 当前工作分支：`main`。`feat/format-support-ogg-ape-wav-dsf`（v1.7.18 + v1.7.19）已通过 PR #24 以合并提交 `f8b40fc` 并入 `main`，分支保留未删；v1.7.20 的音乐文件夹自动监控、v1.7.21 的音量均衡（ReplayGain）、v1.7.22 的音效链（预设 → EQ → Preamp → Limiter → Spatial → Output）、v1.7.23 的音乐库智能分类与 v1.7.24 的音乐库外层标签页都直接落在 `main` 上。此后四版走「分支 → PR → **合并提交**（绝不 squash，否则打好的 tag 会离开 `main` 的可达历史）」：v1.7.25 `feat/global-hotkeys-and-queue-power` → PR #27 → `9fc73f4`，v1.7.26 `fix/hotkey-panel-theme-tokens` → PR #28 → `16a75b1`，v1.7.27 `feat/listen-stats-resume-mouse-hotkeys` → PR #29 → `8930fd2`，v1.7.28 `feat/gapless-crossfade` → PR #30 → `28813aa`，v1.7.29 的同步指示器搬位 `feat/sync-badge-under-search` → PR #32 → `3ef1146`、发布收尾 `release/v1.7.29` → PR #33 → `12ab850`、资产记录 `docs/record-v1729-assets` → PR #34 → `0800224`。v1.8.1 的整机备份走**单分支** `feat/machine-backup`（功能提交 `94c22c6` 与发布提交 `d61dfc6 chore(release): 1.8.1` 都在这一个分支上，没有再单开 `release/` 分支）→ PR #35 → 合并提交 `a608505`；tag `v1.8.1` 打在 `d61dfc6` 且**必须是 annotated**（tag object `29c4a07`，第一次误打成 lightweight 时 `git describe origin/main` 会跳过它回 `v1.7.29-6-ga608505`），现在是 `v1.8.1-1-ga608505`；`Build and Release` run `33737896819` 成功，四项资产已全部回下本机复算核对。资产记录分支 `docs/record-v181-assets`（本条记录自己就在这个分支上，PR 与合并提交号下一版补记）。v1.8.2 的多格式歌词沿用**单分支**写法 `feat/multi-format-lyrics`（功能提交与 `chore(release): 1.8.2 59cf556` 都在这一个分支上）→ PR #37 → 合并提交 `b044893`；tag `v1.8.2` 打在 `59cf556` 且是 annotated（tag object `5321ce4a`）；`Build and Release` 成功，四项资产已全部回下本机复算核对；资产记录分支 `docs/release-assets-v182` → PR #38 → 合并提交 `0a4fc4d` 并入为 `11b35b9`。v1.8.3 的 QRC 加密歌词同样走单分支 `feat/qrc-lyrics-and-format-hardening`：功能提交 `12a6dec feat: QRC 加密歌词与歌词格式兼容增强`（只带代码与测试，`APP_VERSION` 仍是旧值，保证单独 checkout 也自洽），版本钉与全部文档压在紧随其后的 `chore(release): 1.8.3` 里（`bb55abd`）→ PR #39 → 合并提交 `02ad7a6`；tag `v1.8.3` 打在 `bb55abd` 且是 annotated（tag object `3f5df0b`）；`Build and Release` run `33835548298` 成功，electron-builder 的双草稿又复现一次，删掉只含重复 `.blockmap` 的 `382473295` 后发布 `382473294`；四项资产已全部回下本机复算核对。资产记录分支 `docs/release-assets-v183`（本条记录自己就在这个分支上，PR 与合并提交号下一版补记）。v1.8.4 的音乐库维护沿用单分支写法 `feat/library-maintenance`：功能提交 `0600945 feat: 音乐库维护（重复检测 / 失效文件 / 无封面 / 无歌词 / 标签异常）`（只带代码与测试，`APP_VERSION` 仍是旧值，保证单独 checkout 也自洽），版本钉与全部文档压在紧随其后的 `chore(release): 1.8.4` 里；PR #42 → 合并提交 `00c3c42`（CI `verify` 5m37s 通过）；tag `v1.8.4` 打在 `3db1947` 且是 annotated（tag object `f30c41b`），`git describe origin/main` 回 `v1.8.4-1-g00c3c42`；`Build and Release` run `33844427366` 成功，**electron-builder 的双草稿第三次复现**（`382519938` 四项资产齐全、`382519939` 只有两项，同一秒创建，草稿在 `releases/tags/<tag>` 上会 404，只能枚举 `releases?per_page=8` 比资产清单），删掉资产不全的 `382519939` 后发布 `382519938`（**只删 Release、绝不碰 git tag**，删完用 `git ls-remote --tags origin v1.8.4` 复验）；四项资产已全部回下本机复算核对，清单三条自校验全中、`latest.yml` 的 `sha512` 与 `size` 与安装器实测一致。资产记录分支 `docs/release-assets-v184` → PR #43 → 合并提交 `7d7b50d`。v1.8.5 的播放统计漏账修复沿用单分支写法 `fix/listen-stats-accounting`：修复提交 `368cbf6 fix: 播放统计漏账（关窗口不结算 / 无时长文件不计时 / 最小化空档只补 4.2 秒）`（只带代码与测试，`APP_VERSION` 仍是旧值，保证单独 checkout 也自洽），版本钉与全部文档压在紧随其后的 `chore(release): 1.8.5` 里（`cf39700`）；PR #44 → 合并提交 `eec04ed`（CI `verify` run `33853860300`，3m5s 通过）；tag `v1.8.5` 打在 `cf39700` 且是 annotated（tag object `726c1e2`），`git describe origin/main` 回 `v1.8.5-1-geec04ed`；`Build and Release` run `33854258862` 成功，**electron-builder 的双草稿第四次复现**（`382584070` 四项资产齐全、`382584071` 只有两项，同一秒创建），删掉资产不全的 `382584071` 后发布 `382584070`（**只删 Release、绝不碰 git tag**，删完用 `git ls-remote --tags origin v1.8.5` 复验），PATCH 带 `make_latest=true`；四项资产已全部回下本机复算核对，清单三条自校验全中、`latest.yml` 的 `sha512` 与 `size` 与安装器实测一致。资产记录分支 `docs/release-assets-v185` → PR #45 → 合并提交 `3d996df`。v1.8.6 的左下小封面点击沿用单分支写法 `feat/thumb-cover-song-detail`：功能提交 `9d8c90a feat: 左下小封面可点击进入歌曲详情`（只带 `public/index.html`、`public/app.css` 与新测试，`APP_VERSION` 仍是旧值，保证单独 checkout 也自洽），版本钉与全部文档压在紧随其后的 `chore(release): 1.8.6` 里（`56789cf`）；PR #46 → 合并提交 `c5daf7c`（CI `verify` run `33858115753`，8m9s 通过）；tag `v1.8.6` 打在 `56789cf` 且是 annotated（tag object `482e668`），`git describe origin/main` 回 `v1.8.6-1-gc5daf7c`；`Build and Release` run `33858921728` 成功，**electron-builder 的双草稿第五次复现**（`382615797` 四项资产齐全、`382615798` 只有两项，同一秒创建，两份的安装器字节数还完全一致、只能靠资产条数区分），删掉资产不全的 `382615798` 后发布 `382615797`（**只删 Release、绝不碰 git tag**，删完用 `git ls-remote --tags origin v1.8.6` 复验），PATCH 带 `make_latest=true`；四项资产已全部回下本机复算核对，清单三条自校验全中、`latest.yml` 的 `sha512` 与 `size` 与安装器实测一致。资产记录分支 `docs/release-assets-v186`（本条记录自己就在这个分支上，PR 与合并提交号下一版补记）。当前版本 `1.8.6`。
- 最近正式安装包 Release 基线：`v1.6.1`（2026-08-16，扩展 MP2、M4B、AIF/AIFF/AIFC 本地音频格式；Windows x64 NSIS 仅发布安装器、blockmap、`latest.yml` 和 SHA256 清单，不生成或上传 Portable ZIP）。
- 当前系统代理：`127.0.0.1:7897`；PowerShell / Node / electron-builder 需要显式设置 `HTTP_PROXY`、`HTTPS_PROXY`、`ALL_PROXY` 为 `http://127.0.0.1:7897`。
- 发布入口：GitHub Releases，更新检查依赖 `latest.yml` 和可选轻量补丁 JSON。
- 更新包命名规则：从 `v1.0.10` 起，快速补丁本地文件名和 GitHub Release label 使用 `Mineradio-旧版本→新版本.patch.json` 这种右箭头格式；GitHub 资产底层 `name` 可能会把 `→` 净化成点号，但更新解析仍可识别 from/to 版本。
- 快速补丁范围规则：从 `v1.0.10` 起，每次发布只为低于新版的最近 4 个版本生成补丁；更早版本不再从 `1.0.0` 开始补丁，提示用户下载完整安装包更新。
- 安装包样式：以后按 `docs/INSTALLER_STYLE.md` 的中文极简黑白蓝格式打包。

## Workspace Organization

2026-08-08 当前交接工作区：

- 当前 Git 仓库为 `C:\Users\Administrator\Desktop\Mineradio-main`；后续代码、文档和发布操作都在此目录进行。
- 规则中记录的旧仓库 `C:\Users\oirg\Desktop\mok\Mineradio-sync` 在当前环境不存在，不要把它当作本机可写路径。
- `E:\桌面\播放器软件\Mineradio` 及其 `resources\app` 是历史工作区记录，本环境不存在；不要把新修改写回该路径。

2026-06-18 历史工作区整理记录：

- 真正项目移动到 `E:\桌面\播放器软件\Mineradio`。
- 旧的 `editable-install`、历史 `backups`、`备份`、截图、旧计划文档和验证目录都归档到 `E:\桌面\播放器软件\工作区备份\2026-06-18-workspace-cleanup`。
- 项目内历史 `backups` 也归档到 `E:\桌面\播放器软件\工作区备份\2026-06-18-workspace-cleanup\project-internal`。
- 根目录 `AGENTS.md` 负责给新对话指路；项目内 `AGENTS.md` 负责项目规则。

## Release Memory

## v1.7.25 全局快捷键自定义 + 播放队列工作台

- 日期：2026-09-02。用户原话：「在最新版的基础上更新全局快捷键 比如：Ctrl + Alt + ← 上一首 / Ctrl + Alt + → 下一首 / Ctrl + Alt + ↓ 播放/暂停 / Ctrl + Alt + ↑/↓ 音量 / 用户可自定义快捷键」，接着「更新好快捷键之后再更新更强的播放队列……当前播放队列 / 下一首预览 / 拖动调整队列 / 从队列移除 /「播放完当前歌曲后停止」/「单曲循环」/「队列循环」/ 队列保存/恢复」，最后「全部更新好之后发布新版」。
- **需求里的自相矛盾点已裁定，后续版本不要推翻：** 用户列的 `Ctrl+Alt+↓` 同时是「播放/暂停」和「音量降低」，一个组合键只能绑一个动作。裁定为播放/暂停留在 `Ctrl+Alt+Space`、`↑/↓` 给音量；九个动作都可在设置里改键，想换成方向键的用户自己调即可。不要把播放/暂停默认改成 `Ctrl+Alt+↓`，那会顶掉音量键。
- **两块需求里有相当一部分本来就已经存在，先查再写。** 全局快捷键系统连默认绑定都已经和需求逐字一致；队列侧的「当前播放队列」面板、`removeFromQueue`、`playMode='single'`（单曲循环）、`playMode='loop'`（队列循环）也都已存在。真正新增的只有：加速键校验/失败回报、下一首预览、拖动重排、播完即停、队列存档。
- 加速键词元注意点：`Comma` **不是**合法词元，字面形式是 `,`；专用媒体键（`MediaPlayPause` / `MediaNextTrack` / `MediaPreviousTrack` / `MediaStop` / `VolumeUp` / `VolumeDown` / `VolumeMute`）允许不带修饰键单独注册（`HOTKEY_KEY_MAP` 里的 `bare:true`）。主进程侧动作走 `MAIN_PROCESS_HOTKEY_ACTIONS`，不依赖窗口焦点。
- **队列存档只存身份、不存内容。** 本地歌曲带不可序列化的 `localFile` File 句柄，所以每首只写 `{key, localKey, pathKey, name, artist}`，恢复时按「localKey → 路径键 → 曲名+歌手」三级回落到活的 `localLibrarySongs` 重新解析，重扫曲库或换盘符后仍能对上。上限 12 份 / 每份 3000 首，避免 `localStorage` 被大曲库顶爆。存档键 `mineradio-queue-snapshots-v1` 必须同时在 `public/app.js` 的 `PERSISTENT_UI_STATE_KEYS` 和 `desktop/preload.js` 的同名白名单里；`var QUEUE_SNAPSHOT_STORE_KEY` 的声明必须排在 `PERSISTENT_UI_STATE_KEYS` 数组字面量**之前**，否则数组求值时拿到 `undefined`。
- 恢复随机存档时要 `shuffledPlayQueueArrays.add(playQueue)`，否则 `playQueueAt` 会把它当新队列再洗一次，存档里的顺序就白存了。
- `nextQueueIndexPreview()` 每轮渲染只算一次（不是每行一次），并且必须进 `queueVisibleDomSignature`，否则切播放模式或开关播完即停不会重绘。
- 队列内部拖动会冒泡到 `document`，全局「拖文件进来」遮罩必须用 `if (queueDragState || !dragEventHasFiles(e)) return;` 挡掉，否则每次调队列顺序都闪一下遮罩。
- 队列为空时有两处代码会把面板自动切去歌单页（`togglePlaylistPanel` 的 `scheduleUiWarmTask` 与 `renderQueuePanel` 的空队列分支），都要加 `&& !queueSnapshots.length` 门，否则用户想「恢复队列」却找不到入口。
- 顺手修掉一个老缺陷：`removeFromQueue` 删除位于 `currentIdx` 之前的条目时没有把指针前移，「正在播放」高亮会错位到别的歌上。
- UI 只在 `#queue-pane` 内部增量：`.queue-mode-row` 四个按钮、`#queue-next-up`、`.qi-drag` 握把、`.queue-archive` 存档区，工具条把原来的「切换模式」按钮换成「存队列」（`cyclePlayMode` 仍保留，仍由 `#play-mode-btn` 触发）。`v1.7.24` 的三 tab 栏（`当前队列 / 歌单 / 音乐库`）在 `#queue-pane` 之上，没有被动到。
- **教训：开工前先 `git fetch`。** 本轮先在 `v1.7.18` 的旧本地分支上把两块功能做完并本地提交，才发现远端已经发到 `v1.7.24`（`v1.7.19` 就是那条 OGG/APE/WAV/DSF 提交发的版）。改法是从 `origin/main` 开新分支 `feat/global-hotkeys-and-queue-power` 再 `git cherry-pick`：`public/app.js` 只在 `APP_VERSION` 一行冲突，`index.html` / `app.css` / `desktop/*` 全部自动合上，其余冲突都是版本号与文档。旧分支状态留在 `backup/queue-power-on-1718`。
- 验证：新增 `tests/global-hotkeys.test.js`（18 例）、`tests/playback-queue-power.test.js`（36 例），扩写 `tests/queue-render-hot-path.test.js`、`tests/playback-shuffle-order.test.js`；全量 Node 回归 `709/709` 通过（上一版基线 `655`）。未启动本机 Electron。

## v1.7.24 音乐库升级成外层标签页（当前队列 / 歌单 / 音乐库）

- 日期：2026-09-02。用户原话是「音乐课放外面 当前队列 歌单 音乐库 这样排放」（音乐课＝音乐库的笔误）。上一版把智能分类做成了「歌单」页里的一张卡，用户找不到，要求把它提到与「当前队列」「歌单」并排的外层 tab。这是用户明确点名的 UI 改动，所以覆盖「能不动 UI 就不动 UI」的默认。
- 结构上没有新增第三个面板，而是让「音乐库」和「歌单」共用同一个 `#pl-pane` / `#pl-list` 和同一份 `localLibraryPlaylistSelection`，只在 `switchPlaylistTab` 里做一次「把选中项摆到对应那一层」的迁移：切到 `library` 且选中不是分类 → `LOCAL_LIBRARY_CATEGORY_HOME_KIND`，切回 `playlists` 且选中是分类 → `'library'`（全部音乐），两种迁移都跟一次 `resetPlaylistPanelRenderLimit()`。这样不会串页，也不用第二套渲染。
- **切到 `queue` 一定不能动选中项**：用户停在某位艺术家的歌曲层，去瞄一眼当前队列再切回来，必须还停在那一层。测试专门钉了 `library-value:artist:周杰伦` 经队列 tab 往返不丢。
- 最容易踩的坑是递归：`selectLocalPlaylist` 内部会 `safeSwitchPlaylistTab`，而 `switchPlaylistTab` 又会 `refreshUserPlaylists()` → `renderLocalLibraryPlaylistPanel()`。所以 `switchPlaylistTab` 只允许改状态 + 渲染，绝不能反过来调 `selectLocalPlaylist`——选中项迁移必须是直接赋值。
- 第二个坑是「面板正在铺卡片列表」的判断散在四处（3D 歌单架 `currentItems()` 的 `showPlaylists`、`toggleLikeSong` 的刷新、面板打开时的入场动画分支、`switchPlaylistTab` 自己的 `#pl-pane` 显隐与动画），原来全是 `queueViewTab === 'playlists'`；漏掉任何一处，音乐库那页就会静默不刷新。现在统一收口到 `isPlaylistListTab(tab)`。
- 但 `toggleLikeSong` 那一处不能裸调：`tests/special-liked-playlist.test.js` 把 `toggleLikeSong` 单独切进 `node:vm`，只注入了 `queueViewTab`，第一版改完那条用例就红成 `ReferenceError: isPlaylistListTab is not defined`。按项目既有约定改成 `typeof isPlaylistListTab === 'function' ? isPlaylistListTab() : queueViewTab === 'playlists'`，测试文件一行未改。为了不让这条回落被后来人当成「可以随便写 `queueViewTab === 'playlists'`」的先例，`tests/local-library-categories.test.js` 里那条断言从整文件 `doesNotMatch` 改成按行过滤——只放过带 `typeof isPlaylistListTab` 的那一行。
- 工具条也是共用的，所以 `applyPlaylistPaneToolbarMode(tab)` 按 tab 切 `#pl-pane-chip` 文案（`音乐库智能分类` / `本地音乐与独立歌单`）并在音乐库页隐藏 `#pl-pane-create-btn`：「新建歌单」只对独立歌单有意义，「导入」两页都留着。
- 提到外层之后，「音乐库」这三个字不能再出现两遍：根视图那张「音乐库」卡删掉（`歌单` 页恢复成 特别喜欢 → 独立歌单 → 全部音乐），分类首页也不再画 `view-head`，`mode === 'home'` 直接只铺 `localLibraryCategoryHomeCardsHtml()`。顺便纠正一处一直写错的文档措辞：`localLibraryCategoryHeadHtml` 是 `directory ? '' : 播放全部`，**只有歌曲层有「播放全部」**，首页与分组层从来没有。
- `queueViewTab` 不持久化、默认 `'queue'`，所以冷启动仍旧从当前队列进，不会一开机就弹音乐库。
- CSS 依旧一行未动：`.panel-tab` 是 `padding:6px 12px` / `font-size:11px`、`.panel-tabs` 是 `gap:8px`，三个 tab 合计约 187px，面板 340px 去掉内边距还有 304px，装得下才敢直接加第三个按钮。
- 测试：`tests/local-library-categories.test.js` 22 → 25 例。除了源码正则（tab 顺序、`isPlaylistListTab` 存在、首页不画 head、根视图不再有音乐库卡），新增两例用 `node:vm` 跑真实 tab 逻辑：切片锚点是 `function normalizePlaylistPanelTab(tab)` → `function setMiniQueueOpen(open)`，桩齐 `tab-queue` / `tab-pl` / `tab-library` / `queue-pane` / `pl-pane` / `pl-list` / `queue-list` / `playlist-panel` / `pl-pane-chip` / `pl-pane-create-btn` 十个节点，覆盖两向迁移、深层往返不丢、`local-playlist:abc` 切音乐库落首页、`special-liked` 不被动、`LOCAL_ONLY_MODE` 下 `podcasts` 折成 `playlists` 时选中项归 `'library'`。全量回归 `655/655`。

## v1.7.23 音乐库智能分类（艺术家 / 专辑 / 专辑艺术家 / 流派 / 年代 / 播放记录）

- 日期：2026-09-02。用户原话是「音乐库智能分类 / 现在不要只：`歌曲 / 歌单 / 喜欢` / 可以增加：音乐库 ├── 所有歌曲 ├── 艺术家 ├── 专辑 ├── 专辑艺术家 ├── 流派 ├── 年代 ├── 最近添加 ├── 最近播放 ├── 播放最多 └── 未播放  继续更新」，即十项分类做完就按发布流程发新版。
- 结构上没有新增第四种选择模型，而是把三层分类塞进既有的 kind 字符串里：`library-cat:<id>`（歌曲视图）、`library-group:<field>`（分组目录）、`library-value:<field>:<value>`（分组内一项），共用 `library-` 前缀，全部经 `normalizeLocalPlaylistKind` 归一化。这样 `localLibraryPlaylistSelection`（浏览）与 `localLibraryPlaybackSelection`（播放来源）两套状态、面板渲染、底部来源按钮、来源选择器都不用改结构就能认识新分类，认不出的 `library-*` 一律回落 `'library'`。
- 最容易踩的坑是数组身份：`tests/special-liked-playlist.test.js:117` 用 `strictEqual` 钉死 `localPlaylistSongs('library')` 与 `localSearchPool()` 是同一个数组，所以分类分支必须排在独立歌单之后、`return localSearchPool()` 之前，`library` 与 `library-cat:all` 都必须原样交出曲库数组，不能 `slice()`。
- 第二个坑是 vm 切片：分类模块整段必须落在 `function normalizeLocalPlaylistKind(kind)` → `function localSongIndexByKey(songs, key)` 之间，因为 `tests/local-playlists.test.js`、`tests/special-liked-playlist.test.js`、`tests/local-library-categories.test.js` 都按这对锚点把真实源码搬进 `node:vm`。切片里出现未注入的裸标识符会抛 `ReferenceError`，所以 `ensureListenStatsState`、`queueItemKey`、`LOCAL_LIBRARY_NAME_COMPARE` 全走 `typeof x === 'function'` 守卫；`setLocalPlaybackPlaylistSelection` 的持久化判断故意写成内联 `nextSelection.indexOf('library-') !== 0`，因为 `tests/special-liked-playlist.test.js:211` 从这个函数本身起切片，上面的常量切不进来。
- 智能分类**不进持久层**，三处一起兜：`setLocalPlaybackPlaylistSelection` 遇到 `library-` 前缀跳过 `LOCAL_PLAYBACK_SOURCE_STORE_KEY` 写入；`readSavedLocalPlaybackPlaylistSelection` 把历史遗留的分类值读成 `'library'`；`openLocalLibraryQueue` 在分类为空时落回全部音乐。理由是冷启动顺序——播放来源在曲库水合之前就被读出来，分类那时算出来是 `[]`，会误弹"导入本地音乐"引导。
- 「最近添加」需要入库时间，而 SQLite 曲库表给不了：`FILE_INDEX_COLUMNS` 会丢掉未知字段、`FILE_UPSERT_SQL` 的 keep 分支在文件指纹变化时清列、`files.seen_at` 每次同步都被重写，`desktop/local-library-store.js` 里没有任何 ALTER TABLE / 迁移代码（`ensureOpen()` 只有 `CREATE TABLE IF NOT EXISTS` 加 `PRAGMA user_version = 1`）。所以时间戳放渲染层 `mineradio-local-added-at-v1`，键用 pathKey 而不是 `localKey`——后者含文件大小与 mtime，改一次标签整首歌的键就变了，历史入库时间会全丢。上限 `4000` 条，超了按时间从新到旧裁。
- 盖章条件是「相对已有索引确实新增」：只有 `syncLocalLibraryIndexWithSongs` 报 `stats.hasIndex` 为真、且这首歌 `localLibraryChangeState === 'new'` 才盖。否则第一次整库导入会把两万首歌盖成同一时刻，「最近添加」直接退化成「所有歌曲」。没盖过的歌回落 `localFileLastModified`，老库升级上来也能排出一个合理顺序。文件夹自动监控那条路径用 `stampLocalLibraryAddedAtSong` 逐首盖章、`finishLocalLibraryAutoSync` 收尾时 `flushLocalLibraryAddedAtMap()` 一次落盘，避免一次同步里反复写 localStorage；两处调用都 `typeof` 守卫，因为 `tests/local-library-auto-sync.test.js` 会真的执行到那段。这个模块**故意插在 `function localLibraryAssetStatus(` 之前**，避开 `tests/local-lyric-cache-residency.test.js` 的切片。
- 性能按既有约定办，不做"一次渲染全部"：五个分组与三个播放统计列表在同一次遍历里算完，缓存进单槽 `localLibraryCategoryCache`，签名是 `length|首localKey|末localKey|listenStats.updatedAt`，曲库或收听统计一变才重建；`localLibraryValueSongs` 另有单槽缓存，重建时跟着清；分组卡片按 `playlistPanelRenderLimit` 分页并复用面板既有的 `data-pl-load-more`，`localLibraryPlaylistPanelItemCount()` 同时喂给 `growPlaylistPanelRenderLimit` 与 `schedulePlaylistPanelLazyCheck`（不改这个就永远加载不出第二页分组）。
- `renderLocalLibraryPlaylistPanel` 有 `domSignature` 早退分支，所以 `localLibraryCategoryDomSignature(selectedCategory)` 必须拼进签名（首页拼十项计数、分组层拼字段与首末项），否则播放统计变了界面不动。
- UI 按「能不动 UI 就不动 UI」办：根视图只在最上面多一张"音乐库"卡，音乐库 → 特别喜欢 → 独立歌单 → 全部音乐的顺序保持不变；分类视图复用 `.local-playlist-view-head` / `.local-playlist-view-actions` / `.pl-card`，`public/app.css` 与 `public/index.html` 一行未动。`#pl-list` 的点击链里 `data-library-kind-play` → `data-library-kind` → `data-library-back` 必须排在 `closest('.pl-card')` 兜底之前，否则分类卡会被 `openPlaylistPanelDetail` 抢走。
- 测试：`tests/local-library-categories.test.js` 22 例（三层 kind 归一化与非法值回落、带冒号的分组值、年代归档与排序、专辑艺术家回落、三个播放统计分类的排序与分区、入库时间盖章条件与裁剪、缓存失效、动态分类不落盘、渲染层卡片顺序与点击优先级、`added_at` 不许进 SQLite）。vm 跨 realm 断言前必须 `Array.from` 复制容器，否则 `deepStrictEqual` 会因为原型不同判不等；分组顺序测试要显式注入 `Intl.Collator('zh-Hans-CN')`，不注入时 `localLibraryGroupNameCompare` 退成码点比较，顺序和界面不一样。全量回归 `652/652`。

## v1.7.22 真正的音效链（预设 → EQ → Preamp → Limiter → Spatial → Output）

- 日期：2026-09-02。用户原话是「真正的 EQ / 音效链 … 可以自己做成：`预设 → EQ → Preamp → Limiter → Spatial → Output`」，预设点名 Normal / Rock / Pop / Classical / Jazz / Bass Boost / Vocal / 自定义，并且「甚至允许用户保存自己的：`xxx.eq.json`」。链路顺序按原话逐级实现，一级不多一级不少。
- 这一版最关键的决定是**整条链常驻音频图、绝不在运行时改接线**。理由不是省事，而是每一级都有数学上精确透明的中性值：biquad `gain=0` 是恒等；`DynamicsCompressorNode` 在 `ratio=1` 时压缩曲线退化成直线，且 Blink 的补偿增益 `fullRangeGain = saturate(1.0, k)` 在 slope=1 时 `k→0` 恒等于 `1.0`（这条是查过实现才敢用的——如果它会补偿，关掉音效链会让所有人的音量默默变化）；`width=1` 的中/侧矩阵逐样本精确还原 L/R。因此关掉音效链不需要断开任何节点，切开关不可能有咔哒声，也不存在「重连时正好赶上音频回调」的竞态。
- 已知取舍并接受：`DynamicsCompressorNode` 恒带约 `6ms` 前置延迟，所以 analyser 抽头比最终输出早约 `6ms`（60fps 下不到半帧）。为了「限幅可以随时开关且不改接线」，这点偏移换得值，源码里留了注释说明。
- `widthInvert.gain` 必须恒为 `-1`，只自动化 `width.gain`。第一版把两个都推成 `±state.width`，因为 `widthInvert` 是从 `width` 取信号的，宽度会被乘成 `w²`（宽度 1.5 实际听到 2.25）。写代码时自己抓到的，源码里留了注释防止后人改回去。
- 预设不存盘，一律从曲线反推（`matchAudioChainPreset`，容差 `0.001`，对不上就是 `custom`）。存预设 id 的做法看起来省事，但用户拖一下频段后 id 就和曲线脱钩，界面会显示「Rock」而声音已经不是 Rock；反推还顺带白送一个能力：把曲线手动改回预设形状会自动认回那个预设。
- 自动预增益 `-max(gains)`：Bass Boost 抬 `8 dB` 就先垫 `-8 dB`，抬频段后不至于一进限幅就顶满刻度。与用户 `preampDb` 相加后夹在 `[-24, +12]`。
- 引擎块**故意放在 ReplayGain 的 vm 切片之外**（自己从 `var AUDIO_CHAIN_BAND_FREQUENCIES` 起、到 `function applyVolumeToAudio(` 止），这样 `tests/replay-gain-normalization.test.js` 的切片范围一个字节都没变。同一个坑要长期记着：切片里新增任何裸标识符都会在 `node:vm` 里抛 `ReferenceError`，被调用方的 `.catch` 吞掉之后测试全绿但行为是错的——所以这段刻意不用 `Array.isArray`（改判 `typeof raw.length === 'number'`）也不用 `Infinity`（改用 `bestDelta = -1` 哨兵）。
- 设置存独立键 `mineradio-audio-chain-v1` 而不是 `fx`：`fx` 是视觉系统状态，会随预设和用户档案导入导出，EQ 写进去就等于「导入别人的预设会改掉你的音量与音色」。13 个新滑杆也一律不进 `bindFxPanel` 的显式 `ids` 白名单，所以结构上不可能被写成 `fx` 字段。
- `.eq.json` 复用既有 `mineradio-export-json-file` / `mineradio-import-json-file` IPC，主进程零改动。导入必须 `format === 'mineradio.eq'` 且能解出频段；`{frequency, gain}` 形式按最接近的 ISO 频段归位（`3.5 kHz → 4 kHz`），纯 dB 数组也收，缺的段补 `0`，不认识的文件一律拒绝（宁可不导入，也不能拿别人的格式去猜着改声音）。
- UI 按「能不动 UI 就不动 UI」办：`public/index.html` 只在 `fx-volume-fold` 之后新增一个与既有折叠区同构的 `fx-eq-fold`，全部复用现成 class，`public/app.css` 一行未动。顺手确认了一条长期误解：`public/app.css:1416`–`1421` 是无条件规则，`.fx-fold-head` 被 `display:none`、所有 `.fx-fold-body` 恒 `display:block`，`.open` 与折叠头 `onclick` 都是历史残留，所以 `organizeFxPanel` 的强制展开清单对新区块没有视觉意义，故意没加。预设按钮排三行 `fx-seg`（3/3/2），因为 `.fx-seg{display:flex}` 下 `flex:1` 的按钮在 `11.5px` 字号挤 8 个会压扁。
- 测试：`tests/audio-effect-chain.test.js`（14 例，`node:vm` 跑 `public/app.js` 里的真实实现）。两个手法值得留着复用：桩 AudioContext 把每条 `connect` 记成 `id>id:out/in` 字符串，整张音频图逐条比对（接线写错一根就红）；中/侧矩阵不重写公式验算，而是读链路上**真实写入的增益值**逐样本模拟，宽度 1 必须还原到 `1e-12` 以内。
- 资产本机构建：`npm run build:win`（`node_modules` 已含 `electron-builder 26.15.3`），`gh release upload --clobber` 上传，`.github/workflows/release.yml` 的默认 tag 同步到 `v1.7.22` 作为兜底。

## v1.7.21 音量均衡（ReplayGain）

- 日期：2026-09-02。用户原话是「FLAC 很大声 → 下一首老歌突然很小声 → 再下一首又爆音」，要求支持 ReplayGain Track、ReplayGain Album、Preamp、防削波和音量归一化开关，做完直接发布新版。
- 选型：只读文件里已有的 ReplayGain / R128 标签，不做实时响度分析。实时算响度要完整解码整首歌，几万首的库根本跑不起来；而 foobar2000 / mp3gain / opusenc 早就把标签写进文件了，读标签是零成本拿到正确答案的唯一路径。没有标签的歌一律保持原始电平，绝不猜一个增益——猜错比不均衡更难受。
- 防削波用「按峰值封顶」而不是压缩器：`min(linear, 1/peak)`，纯函数、零延迟、不改音色、可单测；插压缩器节点要在播放中改链路，还会引入音染。标签里没有峰值时与 foobar2000 一致不做额外衰减，界面文案如实说明当前是否被封顶。
- 增益节点的位置是这一版最关键的决定：`analyser` 之后、`gainNode` 之前。放在 analyser 之前会让可视化与节拍频谱跟着均衡忽明忽暗（一首歌被压 `-9 dB`，画面就整首暗一截）；直接乘进 `gainNode.gain` 会和 `targetVolume`、`AUDIO_FADE_IN_MS` / `AUDIO_FADE_OUT_MS` 的全部淡入淡出、`currentAudioOutputGain()` 抢同一个参数，任何一次淡出都会把均衡增益冲掉。
- `attemptAudioPlay` 的顺序是先 `playLocalQueueItem` 再 `initAudio()`，所以 `initAudio()` 末尾必须 `setReplayGainNodeGain(replayGainActive.linear, true)` 补位，否则每次重建音频节点后第一下都没有均衡。
- 不重扫曲库：ReplayGain 走 `assets.extra` JSON 列（`mergeExtraFields` 对嵌套对象无损往返），既不用改表结构，也不用升 `LOCAL_METADATA_TAG_SCHEMA`——升版会让整库回落重解析，几万首歌等于开机卡死一轮。升级前入库的歌由 `ensureLocalReplayGainForSong` 在首次播放时补齐一次并写回缓存，确认无标签的置 `localReplayGainResolved` 不再重扫。
- 刻意不把 ReplayGain 挂进 `LOCAL_METADATA_VALUE_FIELDS`：那条链路的 hydration 是真值判定（`if (record[k] && !song[k])`），合法的 `0 dB` 增益会被当成缺失值丢掉。交接改成 `applyLocalMetadataTags` 里两行内联赋值，且不计入 `changed`（ReplayGain 不参与展示，没必要为音量数据触发列表重绘）。
- `applyLocalMetadataTags` 与 `ensureLocalMetadataForSong` 都落在多个 `node:vm` 测试切片里，切片外的新标识符会 `ReferenceError`，再被这些函数自己的 `.catch` 吞掉（然后照常置 `localMetadataLoaded = true` 并写缓存，测试还是绿的但行为已经错了）。所以归一化放在 `extractLocalMetadataTags` 出口的 `finalizeLocalMetadataReplayGain`，它落在每个标签解析切片内部。
- RVA2 只取增益不取峰值：`bitsRepresentingPeak` 的归一化方式各家 tagger 不一致，取错一个峰值会在防削波开启时静默把整首压小，比不读更糟。
- Opus 的 `R128_*` 是 Q7.8 定点（`/256`），参考响度是 `-23 LUFS`，ReplayGain 是 `-18 LUFS`，换算要补 `+5 dB`；`iTunNORM` 的参考完全不同，故意不混入。同一文件里真实 `REPLAYGAIN_*` 优先于 R128 折算值，靠 `putReplayGainTag` 的 `hasOwnProperty` 首个可解析值胜出实现。
- 设置存独立键 `mineradio-replay-gain-v1` 而不是 `fx`：`fx` 是视觉系统状态，会被预设导入导出和用户存档带走，别人一个预设就能改掉你的音量设定。`rg-preamp` 也刻意不加进 `bindFxPanel` 的滑杆白名单。
- UI 按「能不动 UI 就不动 UI」办：`public/index.html` 只在 `fx-playback-fold` 之后新增一个与既有折叠区同构的区块（全部复用现成类名），`public/app.css` 一行未动；`fxPanelTargetForNode` 与 `relabelFxPanelControls` 各加一处 `fx-volume-fold`，`fx-plugin-fold` 的 fall-through 结果不变，输出等价。
- 测试：`tests/replay-gain-tag-parsing.test.js`（10 例，自建 FLAC / ID3v2 / RIFF / APEv2 / MP4 真实字节夹具）、`tests/replay-gain-normalization.test.js`（12 例，`node:vm` 跑真实增益实现，最后一例用源码正则钉死链路顺序、存档键与界面入口）；`tests/auto-playback-startup.test.js` 的两条正则按新增折叠区放宽。全量 `616/616` 通过。
- 本轮资产改回本机构建：`npm run build:win`（`node_modules` 已含 `electron-builder 26.15.3`，`electron 43.4.0` 走系统代理 `127.0.0.1:7897` 下载）产出后用 `gh release upload --clobber` 上传四项资产，`Build and Release` 工作流未 dispatch（默认 tag 已同步为 `v1.7.21` 备用）。本机无 7z，asar 核对改用 Node 直接解 `app.asar` 的 pickle 头，内部 `package.json` 版本与 `public/app.js` 的 `APP_VERSION` 均为 `1.7.21`；安装器无代码签名（仓库未配置证书，`Get-AuthenticodeSignature` 实测 `NotSigned`），与历次发布一致。`latest.yml` 与 SHA256 清单已从 Release 回下载逐字节比对，安装器与 blockmap 只核对远端 API 报告的大小。

## v1.7.20 音乐文件夹自动监控

- 日期：2026-09-02。用户原话是「新增歌曲 → 自动入库 / 删除歌曲 → 自动清理 / 修改标签 → 自动更新 / 修改封面 → 自动刷新，然后右下角：已同步 12,431 首歌曲」。
- 真正要修的行为缺口在 `applyOwnedLocalLibraryRefresh`：它启动约 `1.2s` 后**已经**能检测到文件夹变化，但只要 `playQueue.length` 非空就只弹 `showToast('本地音乐文件夹已更新，下次启动会自动同步')` 然后把本轮扫描结果整个作废。所以这一版不是「加监控」，而是「监控 + 把那条死路改成真正的原地同步」。
- 监控模块 `desktop/local-library-watcher.js` 全部依赖注入（`fs` / `setTimer` / `clearTimer` / `isTrackedPath` / `onFlush` / `onStatusChange`），所以测试不碰真实文件系统也不碰真实定时器。两个阀门缺一不可：防抖 `900ms` 合并整张专辑的上百个事件，最长等待 `4500ms` 不被事件重排，否则持续拷贝会把防抖无限推后、一次都不上报。
- `fs.watch` 句柄必须 `unref()`，不然退出流程会被 watcher 吊住。退出时 `closeLocalLibraryWatcher()` 必须排在 `closeLocalLibraryStore()` 之前。
- 数组身份是这一版最容易踩的坑：`playbackSource === 'library'` 时 `playQueue === localLibrarySongs`（同一个数组对象），全项目的归属判定都写成 `if (localLibrarySongs !== ownedSongs) return;`。所以同步只能 `songs.length = 0` + push 这种原地改法，任何 `songs = [...]` 都会静默废掉播放队列。同理改动过的歌只改字段、不换对象，否则 `currentLocalSong`、`playQueue[currentIdx]`、迷你播放器与桌面歌词握的引用会一起失效。原地改完还要 `invalidateLocalPlaylistSongLookup()`，因为 `getLocalPlaylistSongLookup` 按 `source`/`length`/`firstKey`/`lastKey` 缓存。
- 免费重解析机制：`localAssetCacheKey(song) === song.localKey === 路径 + ':' + 大小 + ':' + 修改时间`，所以改标签换封面天然导致缓存未命中、自动重解析，不需要额外的失效逻辑；`localLibraryFileSignatureFromSong` = `pathKey|size|lastModified` 就是变更检测器。代价是 `songCustomCoverKey(song)` = `local:<localKey>` 也会跟着变，接管时必须迁移 `customCoverMap`，否则用户手挑的封面一次改标签就成孤儿。
- `ensureLocalSongUrl` 先返回缓存的 `song.localUrl`，所以接管必须清空它；旧 blob 交既有 `revokeDiscardedLocalSongObjectUrls`，但正在播放那首的 blob 还是 `audio.src`，撤销就是当场断音，必须单独跳过。
- 有在途解析（`localMetadataPromise` / `localCoverPromise` / `localLyricPromise` / `localLyricCachePromise` / `localCoverLoading` / `localLyricLoading`）时本轮不接管、留到下一轮：如果先把签名改对，旧任务的过期结果就永远写不回去了。
- 标签删除要如实回落（`album` / `albumArtist` / `genre` / `trackNumber` / `year` 清空、`name` / `artist` 退回文件名推导），但 `duration` 故意保留，避免刷新瞬间闪一下 `0:00`。空扫描结果直接早退，不允许「扫到 0 首」把曲库清空。
- 右下角指示器由渲染层懒建（`#local-sync-badge` 挂 `body`，`role=status` / `aria-live=polite` / `pointer-events: none`，`4200ms` 淡出），`public/index.html` 一行未动，`public/app.css` 只追加 3 条新规则、没改任何既有规则。刻意没加沉浸模式抑制规则——它本身是瞬时、不吃鼠标、会自动消失的。
- `.ape` / `.dsf` 一直在 `LOCAL_LIBRARY_EXTS` 扫描白名单里，却漏在 `LOCAL_LIBRARY_AUDIO_EXTS` 外，于是 APE / DSD 被扫到但不计入 SQLite 的 audio 计数与曲库签名——正好就是这一版要显示的那个数字，顺手修掉。
- 渲染层曲库仍是单根（`LOCAL_LIBRARY_FOLDER_STORE_KEY` 只存一个标量路径），但 watcher 模块、两个 IPC 与主进程接线都按多根设计。用户举的三个文件夹合并成一个可见曲库需要重写快照/索引/hydrate/扫描全链路并新增文件夹列表设置面板，属于上千行且必然动 UI 的改动，本轮按 `能不动 UI 就不动 UI` 明确未做，并已如实告知用户。
- 测试新增 36 例（`594/594`）：watcher 19 例走注入桩，auto-sync 12 例用 `node:vm` 跑 `public/app.js` 的真实实现，wiring 5 例静态钉死扩展名集合与主进程/preload 接线。**vm 跨 realm 的坑**：vm 内用字面量造出的数组/对象带的是 vm realm 的原型，即便把外层 `Array`/`Object` 注入进 context 也一样，`assert/strict` 的 deepStrictEqual 会因原型不同直接判负；断言前必须 `Array.from(x)` / `Object.assign({}, x)` 拷回本 realm。

## v1.7.19 OGG / OPUS / APE / WAV / DSD(.dsf) 格式支持

- 日期：2026-09-02。目标是「更强的格式支持」：解析侧补齐 Ogg 系列、WAV、APE、DSF 的标签/封面/歌词/时长，播放侧让 Chromium 不认识的 APE 与 DSD 能直接播。
- 解析实现全部落在 `public/app.js` 的 `base64ChunksToBytes` ~ `applyLocalMetadataTags` 这一段里，自成闭包（`asciiFromBytes`、`synchsafeInt`、`extractFlacPictureBlob`、歌词优先级表等都在段内），所以单元测试可以只切这一段进 `node:vm` 就驱动全部七种格式。
- 三个分发器统一按扩展名路由：`extractLocalMetadataTags`（mp3/flac/m4a/ogg|oga|opus/wav/ape/dsf）、`extractEmbeddedCoverSource`（同上）、新增 `extractEmbeddedLyricsText`（同上但不含 m4a）。能力判定 `canReadEmbeddedLyrics` / `canReadEmbeddedCover` 与两个 `canReadTruncatable*`（都不含 mp3，因为 MP3 按完整标签长度读，失败即真的没有）。
- Ogg 时长有两条路：Ogg FLAC 的 STREAMINFO 给了 `totalSamples` 就直接算，**不读尾部**；Vorbis / Opus 才回读最后 64KB 反向找同 serial 且 `granule > 0` 的页，Opus 还要扣 `pre-skip`。测试用「请求次数」区分这两条路（1 次 vs 2 次）。
- `readId3v2TagBytes` 的 `256KB` 探针语义是共享契约：探针覆盖整个标签就直接 `subarray` 复用，超出才发第二次 Range 读。MP3、WAV 的 `id3 ` chunk、APE 的文件头 ID3v2、DSF 的尾部 ID3v2 全部走它。
- 超预算统一语义：后台轻量 `4MB`（`LOCAL_ASSET_LIGHT_SCAN_BYTES`）、前台 `24MB`（`LOCAL_MAX_TAG_BYTES`），超了就 `_mineradioScanComplete=false` 让前台完整重试，不返回半截标签。
- 播放侧：`desktop/audio/wav-stream.js` 把 APE/DSF 包装成「虚拟 WAV」——size 可精确算、任意区间可解码，`/api/local-file` 的 Range/416/`raw=1` 全部保留。两个解码器（`ape-decoder.js` 支持 3800–3990，`dsf-decoder.js` 字节查表 FIR 抽取）都只接受 `read(offset,length)`，不碰 fs。
- **授权：`desktop/audio/ape-decoder.js` 是 FFmpeg `libavformat/ape.c` + `libavcodec/apedec.c` 的逐行移植，`LGPL-2.1-or-later`**，按 LGPL v2.1 第 3 条在本项目内以 `GPL-3.0` 分发；声明写在新增的根目录 `THIRD-PARTY-NOTICES.md`（该文件与 `LICENSE` 已加入 `build.files`）。DST 压缩的 `.dff` 明确不在范围内。
- 验证：新增 `tests/local-format-tag-parsing.test.js`（18 例，真实字节夹具）；全量 Node 回归 `558/558` 通过。本轮未启动本机 Electron，未改动任何界面。
- **仓库首页只认默认分支。** GitHub 的 `https://github.com/oirge/Mineradio` 首页 README 与 About 面板都从默认分支 `main` 取，功能分支上改 README 对首页零效果——同步当时 `v1.7.18` / `v1.7.19` 的代码还全挂在 `feat/format-support-ogg-ape-wav-dsf`（PR #24 尚未合），所以首页的「最新版本」块一直停在 `v1.6.2 (2026-08-18)`。同步首页时不要为此去合功能代码：从 `origin/main` 单独切一条纯文档分支（`docs/readme-sync-1719`）、`git checkout <功能分支> -- README.md README_EN.md` 取现成内容、squash 合入即可（PR #25 → `main` 的 `4f6e312`）。两边 README 内容逐字节相同，功能分支随后合 `main` 时三方合并果然零冲突。合完用 `gh api repos/oirge/Mineradio/readme` 回读 blob SHA 确认首页真的换了，不要只看分支。
- README 的能力口径必须对着代码写，不要抄旧文案：内嵌歌词看 `canReadEmbeddedLyrics` 的 `/\.(mp3|flac|ogg|oga|opus|wav|ape|dsf)$/i`（MP3 走 `USLT` / `TXXX(LYRICS)`，不是只有 FLAC），外置歌词看 `LOCAL_LYRIC_FILE_RE` 的 `/\.(lrc|txt|srt|vtt|ass|yrc)$/i`（不是只有 `.lrc` / `.txt`）。About 描述用 `gh api -X PATCH repos/oirge/Mineradio -f description=...` 改，原项目署名要保留；`homepage` 指向原项目是有意为之，别顺手改。
- **发布分支合回 `main` 一律用合并提交，不要 squash。** 本仓库的注解 tag 是打在功能分支的发布提交上（`v1.7.18` → `b07f1bd`、`v1.7.19` → `9490fde`），squash 会造出新 SHA 并把这些提交从 `main` 的祖先链里踢出去，`git describe` 与「tag 指向的代码就是发布的代码」这条溯源立刻断掉。PR #24 用 `gh pr merge 24 --merge` 合成 `f8b40fc` 后，两个 tag 都是 `main` 的祖先，`git describe origin/main` = `v1.7.19-6-gf8b40fc`。另外 `gh pr merge` 成功时可能完全不输出，别当成失败——查 `gh api repos/<o>/<r>/pulls/<n> --jq .merged`（`gh pr view --json merged` 不是合法字段），并且 `git fetch` 后要显式 `git log origin/main` 复核，本轮就遇到过一次 `git fetch origin` 没更新 `origin/main`、需要 `git fetch origin main:refs/remotes/origin/main --force` 才刷新的情况。

## v1.7.18 本地曲库 SQLite + 文件指纹/路径索引

- 日期：2026-09-01。目标是「几万首歌也可以很快启动」：本地曲库不再每次启动重放整包 JSON 快照，改为常驻 SQLite。
- 新增 `desktop/local-library-store.js`，用 Electron 自带的 `node:sqlite`（`DatabaseSync`）建 `local-library.db` 于用户数据目录：零新增依赖、无原生模块重编译，`asarUnpack` 仍是 `['server.js','package.json']`。WAL 日志、`PRAGMA user_version` 迁移、预编译语句缓存，写入统一 `BEGIN IMMEDIATE`。
- 每行保存歌曲 ID（`song_key`）、路径与归一化路径键、文件大小、修改时间、时长、格式、Artist / Album / Genre / Year、封面缓存、歌词缓存、播放次数、最近播放、收藏状态。行身份靠文件指纹 `pathKey|size|mtime`：指纹一致保留已解析元数据与缓存，指纹变化整组清空。
- **组合索引是硬要求。** 只有单列索引时 `UPDATE files ... WHERE root_id=? AND song_key=?` 会被规划成 `SEARCH files USING INDEX idx_files_root_sort (root_id=?)`，即每条索引写扫一遍整根，两万行实测 `295,319ms`；加 `(root_id, song_key)` / `(root_id, fingerprint)` 后降到 `1,640ms`（约 180×）。`tests/local-library-sqlite-store.test.js` 用 `EXPLAIN QUERY PLAN` 永久钉死，`idx_files_song_key` / `idx_files_fingerprint` / `idx_files_seen` 必须保持删除。
- 三个键的构造在渲染层/主进程/存储层必须逐字节同构：`pathKey` 小写正斜杠、`fingerprint = pathKey|size|mtime`、`songKey` 用**未小写**的原始绝对路径 + `:size:mtime`。注意 `queueItemKey()` 返回的是 `local:` 前缀的队列键，**不能**当 `song_key` 用，播放统计与收藏必须传 `song.localKey`。
- 播放次数只在 `finalizeListenSession()` 原有有效收听门内累加一次；`localStorage` 的 `listenStatsState` 与「特别喜欢」引用表仍是唯一权威来源，数据库无回读路径，因此不存在双计数，UI 与交互零改动。`song_stats` 按 `song_key` 独立存活，重扫、换库、删索引都不清零。
- 缓存回收顺序固定：保护键 `saved_at` 提到当前时间 → `maxAge` 过期（默认 180 天，`saved_at = 0` 跳过）→ 记录数 LRU → 封面字节上限（窗口函数 `SUM(cover_bytes) OVER (...)`）。
- 缺 `node:sqlite` 的环境整层降级：主进程只标记一次，渲染层探测一次性 latch，全部回落 IndexedDB 旧路径。测试里模拟「运行时没有内置模块」必须 hook `Module._load`，`Module._resolveFilename` 拦不住内置模块。
- `Genre` 为向前生效字段：旧记录不带该键，不会被判成脏行重写。
- 验证：新增 `tests/local-library-sqlite-store.test.js`（12 例，真实 `node:sqlite`）与 `tests/local-library-db-bridge.test.js`（9 例，渲染层接缝）；全量 Node 回归 `540/540` 通过。本轮未启动本机 Electron，未改动任何界面。

## v1.7.17 迷你播放器封面命中与右键竞态修复

- 日期：2026-09-01。针对 `v1.7.16` 仍未解决的用户反馈“迷你播放器命中/右键”，补修收回态封面命中后立即右键的竞态。
- 收回态从穿透切回可命中时，renderer 优先调用同步 `setPointerPassthroughSync()`；主进程通过 `ipcMain.on` 设置 `event.returnValue`，在同步返回前完成 `setIgnoreMouseEvents(false)`，因此右键不再等待 `invoke()` Promise。
- 异步 `setPointerPassthrough()` 仍保留为旧 preload 的兼容回退；同步/异步失败都不提交未确认缓存，下一次状态变化继续重试。
- 两个迷你页面的 `.mini-shell` 固定为 `-webkit-app-region: no-drag`，客户区右键走 renderer `context-menu`，独立窗口移动 IPC 负责拖动；`system-context-menu` 仅作为可信主 frame 的平台兜底。
- 验证：全量 Node 回归 `519/519`；同步竞态回归覆盖“原生窗口命中状态在 Promise 回执前已解除穿透”；GitHub Actions `Build and Release` run `33469762872` 成功，四项 Windows x64 资产已上传并完成 SHA256、`latest.yml` 与 Setup.exe 版本核对；Release 已标记 Latest；未启动 Electron、未合成鼠标键盘输入、未修改 `Mineradio-sync`。

## v1.7.16 迷你播放器右键命中与安全边界加固

- 日期：2026-08-31。用户要求标准迷你播放器收回后只有封面可右键、透明空白交还桌面，极简迷你播放器整窗都能右键，并要求修复后发布且不影响电脑正常使用。
- 标准收回态固定为封面热区（外扩 `6px`）命中；封面以外的透明窗口交还桌面。标准展开态与极简外壳整窗可右键，三者使用与托盘一致的六项应用菜单。
- 封面拖动改为累计未夹紧的封面坐标，首个有效增量不丢失，换边只补偿透明窗口位置，跨显示器时按目标工作区校正；显式保存展开方向，重启后不按补偿窗口边界反推旧方向。
- 迷你窗口只信任当前本地端口对应的标准/极简主文档与主 frame；导航守卫阻止外部页面和子 frame，preload 在非可信页面不暴露 `window.miniPlayer`，三条特权 IPC 都拒绝伪造 sender。
- 极简模式不传输或缓存封面和脉冲，封面失败地址不被高频补丁反复重试，穿透 IPC 失败保留旧缓存并允许下次重试；原生菜单改设置会广播真实快照，异步主题只应用最新一代。
- 发布工作流在构建前校验 tag 与 `package.json` 版本一致，使用 `npm ci`，并对 SHA256 清单及四项资产启用严格错误和存在性检查。
- 验证：当前 release worktree 全量 Node 回归 `514/514`；本轮未启动 Electron、未控制鼠标键盘，正式 Windows x64 构建和 Release 资产摘要待远程工作流完成后补录。

## v1.7.15 主题插件差异化与雪昼白主题

- 日期：2026-08-31。用户要求修复 `深海微光`、`暗焰余晖`、`冷杉夜雾` 外观雷同，并新增白色主题；发布版本从 `1.7.14` 提升为 `1.7.15`。
- 三份历史背景主题保留原 ID 与文件名，版本升到 `1.1.0`，补齐背景、面板、卡片、按钮、文字、底栏和迷你播放器共 58 个变量及完整 CSS；蓝青、熔岩红、冷杉绿签名必须保持明显不同。
- 新增 `examples/plugins/theme-white.json`，ID 为 `mineradio.theme.snow-white`，名称为 `雪昼白`，版本 `1.0.0`；浅色面板、深色文字、浅蓝灰层次，默认不启用。
- `public/plugin-builtin-themes.js` 与示例目录逐字段同步，内置主题共六份：五份暗色完整主题和一份浅色完整主题。主题互斥、用户自定义背景优先、取色器强调色优先和迷你播放器变量转发边界不变。
- 涉及文件：`examples/plugins/theme-background-deep-sea.json`、`theme-background-ember.json`、`theme-background-forest.json`、`theme-white.json`、`public/plugin-builtin-themes.js`、插件文档与主题测试。
- 验证：主题专项测试 `35/35`；干净 release worktree 全量回归 `485/485`；Windows x64 NSIS 构建成功，包内 `package.json`、前端 `APP_VERSION` 和六份内置主题均已反查确认。
- GitHub Release 已于 2026-08-31 正式发布：`https://github.com/oirge/Mineradio/releases/tag/v1.7.15`，安装器、blockmap、`latest.yml` 和 SHA256 清单四项资产远端摘要与本地一致。

## v1.7.14 收回态只在封面上吃鼠标（穿透判据回到热区）

- 日期：2026-08-29。版本从 `1.7.13` 提升为 `1.7.14`。用户先问「标准迷你播放器如果收回了收回的界面怎么还能右键啊」，确认含义后拍定：**收回态封面可点/可右键、封面外的透明区交还桌面、展开态整窗可点/可右键、极简全部可点**。
- **关键事实（解释一切）**：收回不缩窗口。标准迷你的 OS 窗口恒为 `360 × 84`（`MINI_PLAYER_WIDTH/HEIGHT`），收回只是 CSS 把 `.mini-shell` 收成 `54 × 54` 的封面并把 `background`/`border`/`box-shadow` 全部透明、`pointer-events: none`、`-webkit-app-region: no-drag`。所以封面右边那截「看不见的窗体」依然是窗口表面，判据决定它归谁。
- **改动**：`shouldPassPointerThrough()` 的返回值从 `!pointerInsideWindow` 改回 `!pointerInCoverHotRegion`，`trackCoverHotRegion()` 在热区标记翻转后立刻 `syncPointerPassthrough()`，`clearCoverHotRegion()` 恢复「已清零就早退」，`pointerInsideWindow` 变量整体删除（等价于回到 v1.7.11 的穿透判据，但保留 v1.7.13 的托盘同构菜单）。
- **不要再翻回去**：v1.7.12 的整窗命中会让一块用户看不见的区域吞掉桌面的左键和右键——这是本轮用户明确否掉的。真正做不到的是「收回态完全不吃鼠标」：封面热区的命中必须留着，它是收回后唯一的鼠标入口（悬停展开、双击恢复都靠它），封面也交还桌面就再也展不开了。
- **右键语义定稿**：收回态右键封面 → 应用菜单（走 renderer `context-menu`，收回态 shell 是 `no-drag`）；收回态右键空白 → 桌面菜单；展开态整窗 → 应用菜单（shell 是 `drag` 区，靠 v1.7.13 的 `system-context-menu` 拦截）；极简外壳无收回态无穿透，整窗恒可右键（同样靠 `system-context-menu`）。
- 测试：`tests/mini-player-visual.test.js` 两条穿透用例改回热区时序——收回态空白处 `mousemove` 必须**保持** `[true]`；进热区 `[true,false]` 且展开；展开后移到控制区不重新穿透；`shell mouseleave` + 收回 → `[true,false,true]`；拖动结束按热区恢复穿透。用例注释里写明「收回态右键只在封面可用」的后果，防止下次又被当 bug 改掉。全量 483 例全绿。

## v1.7.13 迷你播放器右键菜单与托盘完全对齐

- 日期：2026-08-29。版本从 `1.7.12` 提升为 `1.7.13`。用户需求原话：「最新版本迷你播放器右键要全部可点与任务栏右键效果一样 极简播放器也能」。
- **两个缺口，一并补掉**。(1) 内容缺口：迷你菜单只有 3 项（显示播放器 / 迷你播放器样式 / 退出播放器），托盘有 6 项，勾选类设置（关闭到托盘、最小化时显示迷你播放器、开机自启）在迷你上完全没有。(2) 「点不动」缺口：Windows 把 `-webkit-app-region: drag` 区域的右键当成非客户区处理，直接弹**窗口系统菜单**，而迷你窗口 `resizable/minimizable/maximizable` 全是 false，那份系统菜单里只有「关闭」不是灰的——用户看到的「不能全部点」就是这个，而且 renderer 连 `contextmenu` 事件都收不到，v1.7.11/v1.7.12 的 `webContents` 挂接在拖拽区上根本不会触发。
- **实现**：抽出 `buildAppContextMenuTemplate()`（`desktop/main.js`，紧邻 `refreshTrayMenu()` 之前），托盘 `tray.setContextMenu(...)` 与 `showMiniPlayerContextMenu()` 都只传这一份；`main.js` 里 `Menu.buildFromTemplate` 从此只有这两个调用点，两份菜单不可能再漂移。窗口侧新增 `win.on('system-context-menu', (event) => { event.preventDefault(); showMiniPlayerContextMenu(win); })`，非拖拽区继续走 `win.webContents.on('context-menu')`，两条路弹同一份菜单。
- **不要再改坏的边界**：`popup({ window: win })` **不要传 x/y**——Electron 的 `PopupOptions.x/y` 默认就是「当前光标位置」，`system-context-menu` 的 `point` 是**屏幕**坐标，手动换算只会引入偏移 bug。`showMiniPlayerContextMenu` 的 `if (!win || win.isDestroyed() || miniPlayerWindow !== win) return;` 守卫必须留着（旧窗口的迟到事件不能操作新窗口）。两套外壳都不许在页面里 `preventDefault()` 掉 DOM `contextmenu`，否则非拖拽区右键彻底哑掉（已写成测试断言）。
- 极简外壳零改动：`.mini-shell` 同样是整块拖拽区，且与标准共用 `createMiniPlayerWindow()`（`const page = mode === 'compact' ? ...`），所以 `system-context-menu` 这一条同时兜住两壳；极简没有穿透，天然整窗可右键。
- **验证纪律**：仍然没有合成右键点击（会抢光标点到用户正在用的窗口上）。OS 级拖拽区那一条腿无法在不做真实右键的前提下复现——CDP 注入的输入在系统非客户区命中测试之后才进入——所以它靠 `electron.d.ts:2538/:5031` 的 `system-context-menu` 类型签名 + 单测挂接断言兜，用户自己右键是最终确认。
- 测试：`tests/mini-player-context-menu.test.js` 3 例 → 6 例，改成在 `vm` 里**真的执行**模板构建器并逐项点击（项目顺序、每项非灰且可点/带子菜单、勾选态跟随真实设置、开机自启失败回退勾选、退出先置 `appQuitting`、改设置后必须 `refreshTrayMenu()`），外加两条右键路径挂接与两壳拖拽区断言。**vm 造出的数组/对象跨 realm，`assert.deepEqual` 会因原型不同误判**（本项目第四次踩），断言前先 `Array.from(...)` 拷回本 realm 或逐字段比。全量 483 例全绿。

## v1.7.12 迷你播放器整窗可右键

- 日期：2026-08-29。版本从 `1.7.11` 提升为 `1.7.12`。用户反馈：右键菜单「不是只点击迷你封面可以，点击整个迷你播放器任何地方都要可以，两个迷你播放器都要适配」。
- **病根不是菜单挂接，是收回态穿透规则**：旧规则「收回后只有封面热区参与命中、其余透明区域交还桌面」（v1.5.6 定下）让右键在空白处根本落不到窗口。展开态本来就整窗可右键，用户看到的就是「只有封面可以」（自动收回开着时大部分时间是收回态）。
- **新规则**：`pointerInsideWindow` 取代「在封面热区」作为穿透判据——转发（`forward:true`）与真实 `mousemove` 只会指针在窗口上时到达，**收到事件即视为在窗**（不需要坐标 vs innerWidth 判断，测试沙盒也没有 innerWidth）；`document mouseleave` 清零在窗与热区标记并恢复穿透。`shouldPassPointerThrough()`：hoverExpand 开启 && 收回 && 非拖动 && `!pointerInsideWindow`。封面热区（外扩 6px）仍单独负责悬停展开触发与 `scheduleCollapse`。
- **权衡要记住**：这让 v1.5.6「收回后空白区交还桌面」变成「指针悬停于空白区期间窗口参与命中」——鼠标停在收回态迷你上时，单击空白不再穿透到桌面（单击无动作、双击恢复、右键菜单），这是用户为「整窗可右键」明确接受的代价；指针不在窗口上时桌面点击完全不受影响。
- 极简外壳（compact）从来没有穿透，`v1.7.11` 的菜单挂在共用的 `createMiniPlayerWindow` 上，天然整窗可右键，零改动。
- 测试：`tests/mini-player-visual.test.js` 两条穿透用例改写为新时序——收回态空白处 mousemove → passthrough [true,false]（旧用例断言保持穿透，已废弃）；shell 收回后指针仍在窗不穿透；document mouseleave 才 [true,false,true]；拖动结束指针在窗不穿透、离窗才恢复。全量 480 例全绿。

## v1.7.11 迷你播放器支持右键菜单

- 日期：2026-08-29。版本从 `1.7.10` 提升为 `1.7.11`。用户需求原话：「让右键迷你播放器显示的是右键任务栏软件的一样，有显示播放器、退出播放器、更新迷你样式」。
- **实现**：`desktop/main.js` 的 `createMiniPlayerWindow()` 里 `win.webContents.on('context-menu')` → `event.preventDefault()` → `showMiniPlayerContextMenu(win)`（挂在 `handleMiniPlayerSystemSuspend` 前）。菜单模板：`显示播放器`（`focusMainWindow`，与迷你页恢复按钮的 `command('restore')` 同一条主进程路径）→ `迷你播放器样式` 子菜单（`标准（带封面）`/`极简（无封面）` radio，checked 跟随 `miniPlayerMode`，click 走 `setMiniPlayerMode`——切换会 `closeMiniPlayerWindow()` + 重建对应外壳）→ separator → `退出播放器`（`appQuitting = true; app.quit()`，与托盘「退出 Mineradio」完全同路径，**不会被关闭到托盘拦住**）。
- **关键事实**：标准与极简两种外壳都从 `createMiniPlayerWindow` 出来（按 mode 选页面），所以一处挂接天然覆盖两壳；收回态 `setIgnoreMouseEvents(true,{forward:true})` 期间右键事件根本到不了窗口，菜单只在可交互（展开/常显/封面热区）状态出现，穿透与热区恢复机制不受影响；`mini-player.html:844` 的「点非按钮区域=恢复」监听的是 `click`，右键不冲突。
- **验证纪律**：没有合成右键点击。冒烟 = 隔离实例 CDP 里 `setMiniPlayerEnabled(true)` + `desktopWindow.minimize()` → `/json/list` 出现 mini-player.html 目标且 `readyState:complete`、`#mini-shell` 存在 → `miniPlayer.command('restore')` 后回包必丢（迷你窗口销毁断 WS，v1.7.7 已记录的预期现象）。菜单模板与托盘逐项同构，托盘路径是生产验证过的。
- 测试：新增 `tests/mini-player-context-menu.test.js` 3 例（context-menu 监听 + preventDefault；三项接线逐项正则；两壳共用工厂断言），全量 480 例全绿。约定文档 `.context/conventions/mineradio-mini-player-collapse.md` 已补右键菜单条目。

## v1.7.10 搜索结果面板有了入场动画

- 日期：2026-08-29。版本从 `1.7.9` 提升为 `1.7.10`。用户反馈「点击搜索界面出现的太僵硬」——这是第一条真实使用驱动的优化反馈，按既定套路 CDP 实测定位后修复。
- **病根是 `#search-results` 的 `display:none → block` 硬切**：搜索下拉那块玻璃面板（结果/历史）从来没有任何过渡，回车或点击的一瞬间凭空出现。搜索区本体（`#search-area`）的 `top:-92px → 34px` 滑动本来就有 `.45s cubic-bezier(.2,.7,.2,1)`，逐帧采样（65 帧、avg gap `13.75ms`、偶发 `26.6ms`）确认不僵硬，未改动——**别把两者混为一谈**。
- **修法**：`public/app.css` 给 `#search-results.show` 挂 `@keyframes search-results-in`（`260ms`，`opacity 0→1` + `translateY(-8px)→0`，缓动与搜索区同族），`@media (prefers-reduced-motion:reduce)` 跳过。只动画合成器属性；玻璃 `backdrop-filter:blur(40px) saturate(1.4)`、边框、阴影零改动。关闭侧保持即时隐藏（下拉惯例，避免玻璃残留）。
- **行为细节（测试钉死）**：面板开着时重复 `classList.add('show')` 是 no-op 不会重播/闪烁，只有 remove 后再 add 才播一次；`display:none → block` 每次重渲染都会重启 CSS 动画，所以入场必然每次打开都有。app.js 侧零改动。
- **CDP 复测技巧**：动画生效后 `panel.getAnimations()` 可直接读 `animationName/duration/getKeyframes()`，**不依赖窗口可见**；隐藏窗口里 CSS 动画时钟会暂停（`getComputedStyle` 停在 from 帧）且 rAF 完全不跑（`frameCount:0`），看到「动画卡在起点」是环境假象不是 bug。主窗口 `backgroundThrottling:false` 不豁免 occlusion/最小化的 rAF 暂停。探针窗口被用户最小化后继续采样就会踩这个坑。
- 测试：新增 `tests/search-results-entrance.test.js` 3 例，全量 477 例全绿。

## v1.7.9 每次启动省掉两趟隐藏窗口空转

- 日期：2026-08-29。版本从 `1.7.8` 提升为 `1.7.9`。本轮「继续优化」先用 CDP 实测再动手：`MINERADIO_INSTANCE_ID=startprobe electron . --remote-debugging-port=9334` + `performance.getEntriesByType('paint'/'navigation'/'resource')`，确认资源全部在 ~565ms 内并行拉完、网络不是瓶颈；首帧 1228ms、DCL 2353ms，冷启动中段 ~1.1s 是 2.3MB JS 解析编译（每次安装只发生一次，热启动有 V8 code cache，不动它）。
- **真金矿在 `migratePrimaryProfileState()`**：打包版每次启动、`new BrowserWindow` 之前都执行「`readProfilePersistentValues()` → `writeSessionLocalStorage()`」，各经 `withStorageProbe` 开一个隐藏 `BrowserWindow`、`interceptStringProtocol('http')`、`loadURL('/__mineradio_profile_state_migration__')` + `executeJavaScript`，写完还 `flushStorageData()`。稳态（旧档迁移已完成 + 端口没变）下这是原样回写，微基准（Electron 主进程直接驱动 `profile-state-migration.js`）实测写一趟 `113ms`、读一趟 `20ms+` → 每次启动省 `~130-150ms`。
- **修法**：`desktop/main.js` 新增 `ui-state-origin-marker.json`（`readLastMigratedUiStateOrigin()` / `writeLastMigratedUiStateOrigin()`，临时文件 + `rename` 原子落盘）；`migratePrimaryProfileState()` 开头在 `readProfilePersistentValues` 之前短路：`!legacyProfiles.length && readLastMigratedUiStateOrigin() === currentOrigin` 直接 return；完整路径收尾 `writeLastMigratedUiStateOrigin(currentOrigin)`。
- **为什么安全**：`localStorage` 按 `origin` 隔离，端口变化时 marker 不匹配 → 照旧走完整迁移把旧 origin 的值搬到新 origin，这是该机制存在的意义；旧档迁移待办（marker 缺失/未完成）绝不短路；用户数据意外丢失时 `preload` 的 `restorePersistentUiState()`（`sendSync` 读 `desktop-ui-state.json` 补缺失键）兜底不变——所以标记文件绝不能替代 preload 兜底，两道保险都要在。
- **注意开发态永远测不到这个路径**：`isPrimaryPackagedInstance()` 要求 `app.isPackaged === true` 且无 `MINERADIO_INSTANCE_ID`，dev `electron .` 恒为非 primary、迁移整体跳过。要量它只能打包版（用真实 profile，没做）或微基准。微基准用临时 `session.fromPath()` 时 `readSessionLocalStorage` 可能静默失败返回 `[]`、重复 `writeSessionLocalStorage` 可能原生崩溃——这是裸临时 session 的探针不稳，不代表生产行为（生产一直带着这路径跑）。
- 测试：`tests/profile-state-migration.test.js` 新增守卫（短路必须在 `readProfilePersistentValues` 之前、`!legacyProfiles.length` 前置、收尾必须 `writeLastMigratedUiStateOrigin`），474 例全绿；`node --check desktop/main.js` + 隔离实例冒烟通过。
- 排查过并明确**不做**：`wallpaper-engine.js`（113KB）懒加载——与 `app.js` 靠裸全局变量深度耦合，懒加载要在 app.js 启动路径上找到并守卫所有调用点，风险大于 ~5% 解析收益；`installProtocol` 只是 `protocol.handle` 注册，零开销；`preload` 的 `sendSync`（几 ms 的 UI 状态文件读取）无法异步化——`localStorage` 必须在 `app.js` 求值前就位；压缩 `app.js`——空白/注释剥离不减 token，带 mangle 的压缩毁调试栈；主进程启动链并行化——`migratePrimaryProfileState` 本轮已短路，其余各步都是 ms 级。
- 冷启动瓶颈结论（供下轮参考）：打包版冷启动剩余大头是 2.3MB JS 的解析编译 + 渲染进程冷启动，都是每次安装一次性成本，热启动已被 code cache 摊薄；不要再为它做结构性重构。

## v1.7.8 启动首帧不再被 vendor 脚本卡住

- 日期：2026-08-29。版本从 `1.7.7` 提升为 `1.7.8`。本轮是「有什么需要优化的」排查的落地：全库审查后确认运行时优化已做得很深，只挑了两项有量化依据、零 UI 改动的启动优化。
- **vendor 阻塞脚本位置**：`public/index.html` 原来 `<head>` 第 11-12 行是 `<script src="vendor/three.r128.min.js">` + `gsap.min.js`（603KB + 73KB），HTML 解析到第 11 行就停等，首帧被推迟。两行整体挪到 `</body>` 前、`app.js` 之前。**这是硬顺序不是可选项**：`app.js` 顶层（`app.js:1602` 附近）就 `var scene = new THREE.Scene()`，vendor 必须先于 app.js 求值，所以不能只给 vendor 加 `defer`（defer 会在 body 末尾经典脚本之后执行，直接崩）。挪动后相对执行顺序完全不变。这个顺序现在被 `tests/frontend-html-script-syntax.test.js` 的新断言钉死：head 零外链脚本、three < gsap < app.js。
- **vendor 缓存头**：`server.js` `serveStatic()` 加了第四个参数 `cacheControl`，默认仍 `no-cache`；静态分发对 `pn.startsWith('/vendor/')` 传 `public, max-age=604800`。vendor 库随安装包版本走、不单独热替换，7 天新鲜期内启动免 304 重验证。**不要放宽到全部静态文件**：`app.js` / `app.css` / `index.html` 必须保持 `no-cache`，否则更新后 renderer 可能拿旧文件。
- 首帧收益估算：冷启动 `50~150ms`（603KB 的 three.js 解析不再挡在 DOM 构造前面），热启动大部分被 V8 code cache 摊掉；vendor 304 免重验证再省 `10~30ms`。head 里的字体 preload、内联 boot 脚本（localStorage 类名 + `document.fonts.load`）保持原位。
- 检查过并明确**不做**的：拆分/模块化 `app.js`（34.5k 行）与升级 `three.r128`（本地加载无网络瓶颈，动视觉系统风险大）；迷你预热窗口长驻复用（与「不为不可见窗口常驻内存」策略相反）；主进程启动链并行化（`installProtocol` / `migratePrimaryProfileState` 总共省不到 30ms）；`app.js`/`app.css` 压缩（破坏可调试性，收益被 code cache 摊掉）。
- 判断依据（截至本轮）：GPU 开关（`CHROMIUM_PERFORMANCE_SWITCHES`）、字体本地打包、music-tempo 懒加载、3D 空闲限帧、节拍 FFT 限频、缓存驻留管理都已就位，剩下的启动耗时主要就是 vendor 解析这一段。

## v1.7.7 收缩过渡改成看得见的一段动作

- 日期：2026-08-29。版本从 `1.7.6` 提升为 `1.7.7`。
- 用户原话：装上 `v1.7.6` 之后一句「没变化啊」。这是对 `v1.7.6` 那段收缩过渡的否定反馈，任务是查清为什么看不出来并真正做到看得见。
- **不要再靠读代码猜，要量。** 排查用的是 CDP：`MINERADIO_INSTANCE_ID=collapseprobe ./node_modules/electron/dist/electron.exe . --remote-debugging-port=9333`，然后 `GET /json/list` 找目标（**主 renderer 的 url 是 `http://127.0.0.1:40080/`，不是 `file://.../index.html`，匹配器不能找 `index.html`**），`Runtime.enable` + `Runtime.evaluate {awaitPromise:true,returnByValue:true}`，在页面里 `setInterval` 每 `16ms` 采一次 `getComputedStyle('#desktop-window-shell')`。node v24 自带 `WebSocket`，驱动只需要 `node:http`。
- 病根不是没生效，而是交接时机错了：`v1.7.6` 在 `150ms` 就调 `api.minimize()`，而实测那一刻外壳还有 `opacity≈0.19` / `scale≈0.885`，于是 Windows 自己那段飞向任务栏的最小化动画盖在还看得见的界面上，两段动作方向还相反（一个朝迷你角落，一个朝任务栏），观感就是熟悉的原生最小化；再加上 `150ms` 内只缩 `13.5%`、没有位移，本来就不够一眼看出。
- 修法（`public/app.css` 五行 + `public/app.js` 常量）：`transform .2s cubic-bezier(.3,0,.8,.15)`、`opacity .17s cubic-bezier(.4,0,.9,.4) .02s`、`filter .18s ease`；`.mini-collapse-run` 落到 `scale(.6)` / `opacity:0` / `brightness(.82) saturate(.92)`；`MINI_COLLAPSE_ACTION_DELAY = 240`、`MINI_COLLAPSE_RESET_DELAY = 300`；最大化态补 `body.mini-collapsing.desktop-maximized #desktop-window-shell{border-radius:26px!important}`（`app.css:22` 的最大化覆盖用 `!important` 抹掉了圆角，同特异性的后置规则才压得住）。
- **交接延时必须比 CSS 时长多留余量。** 实测点击到过渡真正起画有 `15~30ms` 的样式重算 + 首帧延迟，所以 `240ms` 对应的是 `190/200ms` 的 CSS 收尾。改完实测：起画 `+16ms`，`opacity` 在 `+222ms` 到 `0`，`240ms` 交接时窗口里已经没有可见内容。
- **窗口本身是全透明的**：实测 `html` / `body` / `#desktop-window-shell` 的 `background-color` 全是 `rgba(0,0,0,0)`，`body` 下除外壳没有其他可见大块子节点。所以外壳淡到 `0` 就等于窗口空了，系统最小化动画没有东西可动——这是「先跑完再交接」能成立的前提，谁要给 `body` 加底色就会把这个前提破坏掉。
- **`transform-origin` 不参与过渡，过渡期间绝对不能改。** 预热 IPC 的回包常落在动画中段，`v1.7.6` 会当帧改写 `--mini-collapse-x/y`，外壳缩到一半突然掉头。现在 `applyMiniCollapseOrigin()` 在 `miniCollapseState.active` 时只把值存进 `miniCollapseState.pendingOrigin`，由 `finishMiniCollapse()` 复位后（窗口已最小化、外壳不可见）落地，下一次收缩才用上；悬停预热的回包不在过渡期内，仍然即时生效。
- 迷你外壳入场同步加大：标准 `280ms` / `translateY(7px) scale(.9)`，极简 `260ms` / `translateY(6px) scale(.92)`。
- 测试：`tests/mini-player-collapse-transition.test.js` 15 例，`npm test` 471 例全绿。新增的那条回归断言从 CSS 里按属性名解析 `transition` 简写（简写里 `cubic-bezier` 自带逗号，只能定点取），钉死「`opacity` / `transform` 都要在 `MINI_COLLAPSE_ACTION_DELAY - 30ms` 前结束」和「终态 `scale ≤ .7`」——这两条正是 `v1.7.6` 违反的不变量。
- 不要再改坏的边界：交接延时和 CSS 时长必须一起改，只调一边就会重新回到「原生最小化盖住过渡」；过渡进行中改 `transform-origin` 会掉头；`body` / `html` 的透明背景不能加底色。
- 验证纪律：**不要用合成鼠标点击**（本机是用户正在使用的桌面，`v1.7.6` 那次点进了用户开着的剪映窗口）。这次全程走 CDP：`collapseToMiniPlayer()` 直接在页面里调，恢复主窗口用迷你窗口里的 `window.miniPlayer.command('restore')`；主窗口一恢复迷你窗口就销毁，`Runtime.evaluate` 的回包永远等不到，必须自己 `Promise.race` 超时。`contextBridge` 暴露的 `window.desktopWindow` 是冻结对象，从 `Runtime.evaluate` 里给它的方法打桩会静默失败，量交接时刻只能靠固定的 `setTimeout` 延时推算。
- 探针文件全部用 `tmp-probe-*` 前缀放仓库根目录，验证完连隔离实例一起清掉，一个都不许提交。
- 发布核验：提交 `a71bdf2` 已推送到 `codex/mini-cover-static`，注解 tag `v1.7.7` 已推送；先建 GitHub Release，再运行 `Build and Release` workflow（run `33230392198`，成功）。远端 Release 为正式非 draft / 非 prerelease，资产共 4 项：`Mineradio-1.7.7-Setup.exe` `101520210` 字节 / GitHub digest `sha256:c03faf18f55a98e406bb796b900407cceeb84fd96b2665ca63fb977139c5b82e`；`.blockmap` `105961` 字节 / `sha256:993ed1fdc0472ecacd9ca54ed8441f71f4c7452b2efef2431101fb64ff7f50a4`；`latest.yml` `347` 字节 / `sha256:e91d322ec3565a1ab732a4ca7b96680e95063fff8f173fd6c06c17a360a7a179`；SHA256 清单 `273` 字节 / `sha256:05b74ff91a5afcb8c531ed3621586e96bd65b4ee35a1a76f61c0b1e2ca8c1fa4`。远端 `latest.yml` 的版本为 `1.7.7`，Release URL：`https://github.com/oirge/Mineradio/releases/tag/v1.7.7`。

## v1.7.6 主界面收缩到迷你播放器的过渡

- 日期：2026-08-29。版本从 `1.7.5` 提升为 `1.7.6`。
- 用户原话：「再最新版的基础上优化缩小主界面到迷你播放器的过渡界面」。边界是只优化过渡本身，不动布局、配色、文案和交互入口，`public/index.html` 不新增任何元素。
- 诊断出三个缺陷：两侧都没有动画（一边是 Windows 原生最小化，一边是 `showInactive()` 直接弹出）；迷你窗口每次恢复都销毁、每次最小化才重建，`renderer` 冷启动约 `600ms` 全露在外面；迷你外壳弹出瞬间会闪一下 `Mineradio / 等待播放` 占位文案。
- 主进程新增（`desktop/main.js`）：`MINI_PLAYER_PREWARM_TTL = 2600`、`miniPlayerPrewarmWindow` / `miniPlayerPrewarmTimer`、`stopMiniPlayerPrewarmTimer()`、`miniPlayerTransitionOrigin()`（迷你窗口中心相对主窗口归一化，越界收敛到 `-0.6 ~ 1.6`，异常主窗口尺寸返回 `null`）、`discardMiniPlayerPrewarm()`（幂等，且不误关已在服务或替代的窗口）、`prepareMiniPlayerTransition()`，IPC 走 `mineradio-mini-player-prepare-transition` + `trustedMainFrameHandler`。`showMiniPlayerWindow()` / `closeMiniPlayerWindow()` 都要解除预热标记，否则 TTL 会回收正在服务的窗口。
- renderer 新增（`public/app.js`，紧挨 `handleDesktopMiniPlayerCommand()` 之前，必须保持顶层以便 `vm` 抽取）：`miniCollapseState`、`MINI_COLLAPSE_ACTION_DELAY = 150` / `MINI_COLLAPSE_RESET_DELAY = 260` / `MINI_COLLAPSE_PREWARM_DWELL = 90` / `MINI_COLLAPSE_PREWARM_THROTTLE = 900`、`miniCollapseAvailable()`、`applyMiniCollapseOrigin()`、`requestMiniCollapsePrewarm(immediate)`、`armMiniCollapsePrewarm()` / `cancelMiniCollapsePrewarm()`、`finishMiniCollapse(token)`、`collapseToMiniPlayer()`。最小化按钮同时挂 `pointerenter` / `pointerleave` / `focus` / `blur` 做悬停预热。
- CSS 只加四行（`public/app.css`，紧跟全屏过渡的降低动效钳制之后），全部作用于 `#desktop-window-shell`：`body.mini-collapsing` 设 `transform-origin:var(--mini-collapse-x,92%) var(--mini-collapse-y,96%)` 与过渡，`.mini-collapse-run` 落到 `scale(.86)` / `opacity:.05` / 轻微压暗，`body.mini-collapse-reset` 用 `!important` 无过渡复位（必须同帧摘掉，否则下次恢复会带着复位类），`prefers-reduced-motion` 钳到 `.06s`。`#desktop-window-shell` 只有在 `body.desktop-shell` 下才是 `position:fixed`，所以变换只在桌面外壳生效。
- 两套迷你外壳（`public/mini-player.html`、`public/mini-player-compact.html`）加 `data-enter="pending"`（`opacity:0`）+ `@keyframes mini-shell-enter`，`runMiniEnterAnimation()` 要求窗口已可见（`document.visibilityState !== 'hidden'`）且首帧状态到位（`receiveState` 或 `160ms` 宽限）才淡入，另有 `1500ms` 无条件兜底摘掉 `data-enter`。降低动效规则必须合并进各文件既有的那一个 `@media (prefers-reduced-motion: reduce)` 块，不要新开一块。`data-instant` 只关 `transition`、不影响 `animation`，两者可以共存。
- 实测时序（`1387x780` 主窗口，标准迷你外壳）：点击后 `+10ms` 预热窗口已存在且不可见、主窗口仍在；`+170ms` 主窗口最小化落地；`+700~770ms` 迷你窗口显示。也就是说迷你 `renderer` 启动约 `700ms`，只靠点击时预热只能盖住 `150ms`，所以补了悬停预热。
- 不要再改坏的边界：预热窗口在 `show:false` 状态下靠 `shouldShowMiniPlayer()` 把 `ready-to-show` / `did-finish-load` 的显示全部挡住，主窗口还在时绝不能提前显示；`hideMiniPlayerWindow()` → `closeMiniPlayerWindow()` 「不为不可见窗口常驻内存」的策略保持不变，预热只是加了一个有 TTL 的例外；迷你播放器关闭、非桌面外壳、`fullscreenTransitionState.active` 或 `isFullscreenUiActive()` 时必须退回原生 `api.minimize()`。
- 测试：新增 `tests/mini-player-collapse-transition.test.js`（14 例），`npm test` 470 例全绿。`vm.runInNewContext` 造出来的对象跨 realm、原型不同，`assert.deepEqual` 会报「same structure but not reference-equal」，只能逐字段比较——本项目第三次踩这个坑。
- 发布核验：提交 `f284932` 已推送到 `codex/mini-cover-static`，注解 tag `v1.7.6` 已推送；先建 GitHub Release，再运行 `Build and Release` workflow（run `33228632736`，成功）。远端 Release 为正式非 draft / 非 prerelease，资产共 4 项：`Mineradio-1.7.6-Setup.exe` `101517696` 字节 / GitHub digest `sha256:ec19ed70d4c4195e70e577374c5686ad7cf7d45adbbf0e397e5f3a36338d42cf`；`.blockmap` `105884` 字节 / `sha256:132bd4a7baf1c7ffd61b60821f5f40a0c2d9477f02b20c71917b60840b39c0f0`；`latest.yml` `347` 字节 / `sha256:f71d3a5c8a7062d04ae2376f77716a095292983fb14e21828d4b43c1f289342a`；SHA256 清单 `273` 字节 / `sha256:f08ca92bb0efd0918cecdf02cf23064662362bbcd2ac9faf449b7aa620e8dc05`。远端 `latest.yml` 的版本为 `1.7.6`，Release URL：`https://github.com/oirge/Mineradio/releases/tag/v1.7.6`。
- 启动核验用隔离实例：`MINERADIO_INSTANCE_ID=<name>`（`desktop/main.js:38` 读取）给独立 userData 与单实例锁，`--user-data-dir` 无效。**不要用合成鼠标点击去验证过渡**：本机是用户正在使用的桌面，`SetCursorPos` + `mouse_event` 会抢走用户的光标并点到前台的其他程序上；这次就点进了用户正开着的剪映窗口。

## v1.7.5 主题背景换色 + 三份内置背景主题

- 日期：2026-08-27。版本从 `1.7.4` 提升为 `1.7.5`。
- 用户原话：「在最新版的基础上更新插件主题也能稍加更改背景颜色，在加几个背景插件」。边界是轻量换色，不把主题扩成壁纸引擎，不动电影视觉系统、粒子、玻璃模糊参数或现有 UI 布局。
- 背景接口：`--th-bg-color` 提供默认最底层色，`--th-bg-tint` 提供封面模糊背景上的轻量色调，`--th-bg-tint-opacity` 控制色调透明度。`public/app.css` 里 `#custom-bg` 使用 `var(--custom-bg-color,var(--th-bg-color,#000))`，独立的 `#theme-bg-tint` 消费后两个变量。
- **用户自定义背景必须永远优先。** `applyCustomBackground()` 只在纯默认态移除行内 `--custom-bg-color`；用户设了纯色、图片、视频或透明度时继续写行内值压过主题。播放器背景板启用时只有默认态通过 `body.wallpaper-board-active:not(.custom-background-override) #custom-bg` 让底色让位，用户自定义背景仍保留在画布上层；Wallpaper Engine 与自定义媒体的图层关系不得回退。
- 主题负载：午夜靛蓝、暖琥珀与石墨各加三个背景变量并抬到 `1.5.0`；新增 `theme-background-deep-sea.json`（深海微光）、`theme-background-ember.json`（暗焰余晖）、`theme-background-forest.json`（冷杉夜雾）三份纯变量主题。安装包自带主题从 2 份扩为 5 份，默认都不启用，互斥、卸载记忆与版本覆盖规则不变。
- 纯背景主题只有三个 `vars`、不带 `css`是合法最小负载；它仍是互斥 `theme`，启用时会关掉当前完整主题，面板配色回落默认值。
- 守卫：`tests/plugin-system.test.js` 钉住 5 份内置包与 `examples/plugins/` 逐字段一致，不再错把纯背景主题的空 CSS 当成失败；`tests/plugin-theme-reach.test.js` 钉住背景三变量、清洗、纯背景最小负载、CSS 消费点与用户行内变量优先级。
- 文档：`CHANGELOG.md`、`docs/PLUGIN_AUTHORING.md`、`examples/plugins/README.md` 与 `.context/architecture/mineradio-plugin-system.md` 同步记录五份内置主题、背景变量和优先级边界。
- 构建核验：`npm run build:win` 成功；安装器 `101513979` 字节 / SHA256 `8c4456df71e3d19576f2770b3ce63ed40681f8b948670aa91d1ec4c5b3938998` / SHA512 `h8W0CFH+vaWbOwiuCz9vWfz1wlRyHxGQtuebvnZCz/VaKuKm60MnsabHPOXE8fkWJtPZEWvP/2TQmJ3uBDNS6g==`；blockmap `105842` 字节 / SHA256 `891b44d76812774a19d1fb77791221679b77124bcaae7f4136595608a41bd0b2`；`latest.yml` `347` 字节 / SHA256 `e56a00e15788587a5de2a5e8ce1c0c09c2fe870b244f5964514e5e9254b9bbab`；SHA256 清单 `273` 字节。打包内容已确认含 5 份内置主题与 4 个插件源码文件，未含已删除的 `plugin-proxy.js`。
- 发布核验：提交 `d937927` 已推送到 `codex/mini-cover-static`，注解 tag `v1.7.5` 已推送；先建 GitHub Release，再运行 `Build and Release` workflow（run `33042160371`，成功，1m58s）。远端 Release 为正式非 draft / 非 prerelease，资产共 4 项：`Mineradio-1.7.5-Setup.exe` `101513620` 字节 / GitHub digest `sha256:18575ef4406ece91fde5007997ccd29103797c859a9c15f77d97a93c49cd2977`；`.blockmap` `105810` 字节 / `sha256:e266c9b4251277900d5b124613ae7835e0fb265983a61b64181c8bb1b59e5177`；`latest.yml` `347` 字节 / `sha256:6395fe1dec634a0f215ff5c27dfa7cd950e103763f021c3e032b8c64f6a79d2d`；SHA256 清单 `273` 字节 / `sha256:ac807b1644392fc59c8853142b96e398f347a7b5b21161094f5b4c88ab461ca5`。远端 `latest.yml` 的版本为 `1.7.5`，Release URL：`https://github.com/oirge/Mineradio/releases/tag/v1.7.5`。

## v1.7.4 插件收窄成只有主题一种

- 日期：2026-08-25。版本从 `1.7.3` 提升为 `1.7.4`。
- 用户原话：「删除这两张插件只保留主题插件」，并在选项里选了「彻底删能力，保留脚本主题（推荐）」——即 `.json` 声明式主题与 `.js` + `theme` 钩子（Worker 沙箱）都留着，其余全删。
- 删除清单（按层）：`public/plugin-manifest.js` 的 `PLUGIN_KINDS` 收成 `['theme']`、`normalizeHosts()` / `isPluginRequestAllowed()` / `hosts` 字段与 `@host` 解析；`public/plugin-sandbox.js` 的 `mineradio.request` / `requestJson` 与 `EVENTS` 里除 `theme` 之外的六个钩子名；`public/plugin-runtime.js` 的 `searchSongs` / `resolvePlayUrl` / `fetchLyric` / `fetchCover` / `fetchPlaylists` / `fetchPlaylistDetail` 与 RPC 里的 `plugin-request` 分支（-383 行）；根目录 `plugin-proxy.js` 整个文件（-366 行）；`server.js` 的 `/api/plugin/fetch` 与 `/api/plugin/stream`（-50 行）；`desktop/main.js` 的 `PLUGIN_TOKEN`、`mineradio-plugin-proxy-info` IPC 与 `MINERADIO_PLUGIN_TOKEN` 环境变量；`desktop/preload.js` 的 `getPluginProxyInfo` 桥；`public/app.js` 的搜索结果插件区、`songSourceTagHtml()` 插件分支、`playQueueAt()` 里 144 行插件取流路径、插件类型筛选与插件歌单面板（-321 行）；`package.json` 的 `build.files` / `asarUnpack` 两处 `plugin-proxy.js`。总计 -1715/+305。
- 沙箱现在的对外面正好是 `{version, manifest, on, log}`（`Object.keys` 顺序 `version,manifest,on,log`），钩子名只认 `theme`，注册别的直接 `plugin-boot-failed: 未知插件钩子: xxx`。运行时导出面正好 13 个键：`STORE_KEY` `BUILTIN_STORE_KEY` `init` `list` `hasEnabled` `install` `importFromDialog` `remove` `setEnabled` `applyThemes` `themeVars` `destroyAllWorkers` `toast`。
- `PLUGIN_ERROR_TEXT` 删掉 `PLUGIN_NO_HOST` / `PLUGIN_HOST_NOT_ALLOWED` / `PLUGIN_PROXY_UNAVAILABLE` / `PLUGIN_URL_EMPTY` / `PLUGIN_NOT_AVAILABLE` / `PLUGIN_TOO_MANY_REQUESTS`，`PLUGIN_BAD_KIND` 文案改成「插件 @kind 必须是 theme（只支持主题插件）」。
- 旧存档兼容：`normalizePluginRecords()` 把 `source` / `playlist` 记录整条丢掉（不是改类型，是淘汰），`hosts` 字段不再进清单，用户不需要手动清理。
- **外部市场插件为什么装不上（用户反复问过）**：GitHub 上 LX Music / 落雪音乐系的音源插件要的就是宿主代发请求返回播放直链，这条通道已经不存在。它们要么没有 `@kind theme`（`PLUGIN_BAD_KIND`），要么连 `@id` 都不写（`PLUGIN_BAD_ID`），解析阶段就被拒，永远不会被启动。结论是**明确不适配**，别再花时间尝试。
- 守卫（正向断言能力不会长回来，这是这次测试改动的重点）：`tests/plugin-system.test.js` 重写成 24 例，其中 `typeof Manifest.isPluginRequestAllowed === 'undefined'`、`doesNotMatch(manifestSource, /host/i)`、`doesNotMatch(runtimeSource, /fetch|XMLHttpRequest/i)`、`doesNotMatch(runtimeSource, /api\/plugin\/(fetch|stream)/)`、`doesNotMatch(sandboxSource, /requestJson|plugin-request/)`、沙箱探针里 `request` / `requestJson` 都是 `'undefined'`、运行时导出键 `sort()` 后逐字对齐。测试宿主环境**刻意不提供** `fetch` / `XMLHttpRequest` / `URL`，运行时哪天又长出网络调用会直接炸。删除 `tests/plugin-proxy.test.js`。全量 `461 → 454/454`。
- 跟着改的旧断言：`tests/packaging-file-whitelist.test.js` 的插件源码白名单从 5 个降到 4 个 `public/plugin-*.js`、`asarUnpack` 断言改成只查 `server.js`；`tests/complete-optimization-gates.test.js` 的 `asarUnpack` 精确等于 `['server.js','package.json']`；`tests/plugin-theme-reach.test.js:189` 那条「插件状态变了要补推迷你窗口」的正则原来靠已删除的 `refreshPluginPlaylists();` 定位，改成匹配注释 + `pushMiniPlayerState(false);`（3 处，`public/app.js` 33718 / 33745 / 33762）。
- **vm 跨 realm 坑（第二次踩，写死在这里）**：`vm.createContext` 里造出来的对象和数组原型与测试 realm 不同，`assert.deepStrictEqual` 会报「Values have same structure but are not reference-equal」。断言前先 `Object.assign({}, x)` / `Array.from(x)` 抄到本 realm，或者逐字段断。
- **主题侧一个没动**：`--th-*` 变量族与 63/79 覆盖、迷你播放器 `--th-mini-*` 整表转发与主进程二次清洗、主题互斥、自带两份主题的种子与卸载记忆、取色器行内变量优先级高于插件主题、`*-filter` 与 `rgba(var(--fc-accent-rgb),…)` 不参与主题——全部与 `v1.7.3` 一致，`v1.7.3` 那节的边界继续有效。
- 文档同步：`docs/PLUGIN_AUTHORING.md` 与 `.context/architecture/mineradio-plugin-system.md` 重写，`examples/plugins/README.md` 换掉「写给要写音源 / 歌单插件的人」一节，`AGENTS.md` 第 10 行与本文件检查点同步。
- 发布路径：提交 `c65c2f4` 在 `codex/mini-cover-static`，推分支 → 注解 tag `v1.7.4` → `gh release create v1.7.4 --notes-file`（正文取 CHANGELOG 本节）→ `gh workflow run "Build and Release" --ref v1.7.4 -f tag=v1.7.4`（run `32803932843`，成功，1m54s）。全程 `HTTPS_PROXY=http://127.0.0.1:7897`。
- `v1.7.4` Release 资产：`Mineradio-1.7.4-Setup.exe` `101512790` 字节 / SHA256 `2d4c52e20c088a0b66925198d9d1b6d04621a4a37b5bbf28b12264473ce7accd` / SHA512 `/Dj6pDvLgHnIZ59tLhe3L0u87hjBqbUrMHCg/jTD1L6g62XullqzCC574xqdTEKzd5vt2+cLcj/Fa61ndWzo4w==`；blockmap `105897` 字节 / `1cff5edfa490f745fbe33ea039c30c2ff822111945d34f9102bc39f533d735ad`；`latest.yml` `347` 字节 / `cb767c68609280d193e3bacc372000eeae1b273e4eba62ac232c51de3a611414`；SHA256 清单 `273` 字节。未生成跨版本轻量补丁和 Portable ZIP。
- **回读远端安装包核包已做**（这一版动过 `build.files` / `asarUnpack`，按 `v1.7.1` 那条规矩必须做）：下载安装包核对 SHA256/SHA512 与 `latest.yml` 一致 → `node_modules/electron-winstaller/vendor/7z.exe` 取 `$PLUGINSDIR/app-64.7z` → asar 根条目现在是 `build desktop package.json public server.js`（`plugin-proxy.js` 已消失），`app.asar.unpacked/` 只剩 `server.js` + `package.json`，`public/` 仍含 `plugin-builtin-themes.js` / `plugin-manifest.js` / `plugin-runtime.js` / `plugin-sandbox.js`。另外 **`server.js` 现在一条相对 require 都没有了**，`v1.7.0` 那类「白名单漏装 → MODULE_NOT_FOUND → 双击没反应」对它已经不可能复现。
- 实际启动验证：解包后起 `Mineradio.exe`，6 个进程存活，本地服务监听 `44338`，`/` 与四个 `plugin-*.js` 全 `200`，`/api/plugin/stream` 已经是 `404`；stderr 只有 `fs.Stats constructor is deprecated` 这条无害告警。验证完杀掉测试进程并删掉临时目录与测试 profile。
- **启动验证的两个新坑（下次照这个来）**：①用户机器上通常已经跑着 `D:\Mineradio\Mineradio.exe`，直接起解包出来的 exe 会因单实例锁**立刻退出且两个日志全空**，看起来像崩溃其实不是；`--user-data-dir` 也没用，因为 `desktop/main.js:66` 就 `app.setPath('userData', INSTANCE_PROFILE.userDataPath)` 覆盖掉了。正确做法是设 `MINERADIO_INSTANCE_ID=<临时名>`，它会分出独立 profile 与独立锁（profile 落在 `%APPDATA%\Mineradio-<名>`，验证完记得删）。②PowerShell `Start-Process -RedirectStandardOutput` 会把句柄继承给子进程，**父 powershell 要等 app 退出才返回**，所以这条命令必须后台跑或者带超时，不要等它自己结束。

## v1.7.3 主题覆盖面扩大 + 迷你播放器跟着换色

- 日期：2026-08-22。版本从 `1.7.2` 提升为 `1.7.3`。
- 用户原话：「主题插件变化的不是很多啊 选择歌单界面没变 左侧歌单没变 右边歌单也没变 很多ui没变化」「迷你播放器也没变」。
- **本节推翻 v1.7.2 那条「主题真正能改的只有九个变量……面板底色只能走 `css` 通道 + 同选择器 `!important`」**。那条结论在当时是对的，但只描述了当时的 `app.css`；现在主通道是 `--th-*` 变量族，`css` 通道退成补丁用途。
- 根因（实测，不是推断）：`public/app.css` 尾部用写死的 `!important` 字面值画掉了大部分外壳，其中若干条选择器特异度是 `(1,1,1)`（典型：`html.control-glass-svg-ok #playlist-panel`）。主题在 `css` 通道里写 `#playlist-panel{…!important}` 只有 `(1,0,0)`，永远压不过去——这就是「左侧歌单没变」的全部原因。
- 修复手法：**就地变量化**。把每条胜出的字面值改写成 `var(--th-x, <一模一样的原字面值>)`。没装主题时 CSSOM 取回落值，外观逐字节不变；装了主题就靠 `vars` 通道拿下同一条声明，不再和特异度打架。链式回落用于分组：`var(--th-side-panel-bg, var(--th-panel-bg, <字面值>))`、`var(--th-chip-bg, var(--th-row-bg, …))`、`var(--th-mini-bg, var(--th-popover-bg, …))`。
- 主窗口变量族（28 个）：`--th-panel-bg|-border|-shadow`、`--th-side-panel-bg|-border|-shadow`（左侧歌单**只能**走这一组）、`--th-popover-bg|-border|-shadow`、`--th-subpanel-bg|-border`、`--th-row-bg|-border|-shadow|-hover-bg|-hover-border|-active-bg`、`--th-chip-bg|-border|-hover-bg|-hover-border`、`--th-bar-bg|-shadow`、`--th-search-bg`、`--th-hairline|-soft`、`--th-text-strong|-dim`。
- 迷你播放器变量族（18 个）：`--th-mini-bg|-border|-shadow`、`-cover-bg|-cover-border|-cover-text`、`-title|-artist|-ghost-text`、`-btn-bg|-btn-border|-btn-text`、`-btn-hover-bg|-btn-hover-border|-btn-hover-text`、`-play-bg|-play-border|-play-text`。
- 迷你播放器是独立窗口、**不加载 `plugin-runtime.js`**，只能拿主窗口合并后的最终值：`plugin-runtime.js` 存 `activeThemeVars` 并导出 `themeVars()` → `public/app.js` 的 `miniPlayerThemePayload()` 只挑 `--th-` 前缀、排序拼签名去重 → `desktop/main.js` `sendMiniPlayerState()` 用 `miniPlayerThemeSignature()` 再去重，整表塞进 `mineradio-mini-player-state` 补丁 → 迷你渲染进程 `applyMiniThemeVars()` 写 `documentElement.style`，并擦掉新表里不再出现的变量名（否则旧主题颜色残留在没被覆盖的那几个变量上）。
- 两条容易踩的实现细节：主题对账**跳过纯播放态推送**（播放进度那条路 80ms 一次，没必要每次重算签名），条件是 `if (force || !playbackOnly)`；启用/禁用/安装/卸载插件后要 `pushMiniPlayerState(false)` 补推一次，不然要等下一次切歌迷你窗口才换色。`invalidateMiniPlayerSyncPatch` 里丢掉 `themeVars` 的补丁要把 `state.themeSignature` 置 `null`。
- 主进程侧二次清洗 `normalizeMiniPlayerThemeVars()`（`desktop/mini-player-state-cache.js`）：只收 `/^--th-[a-z0-9][a-z0-9-]{0,58}$/`（名字先小写去空白）、单值 ≤200 字符、拒 `[;{}<>]|url(|expression(|javascript:|@import`、最多 64 条。渲染进程侧的 `normalizeThemeVars()`（`public/plugin-manifest.js`）仍是 160 条上限、同一套非法值正则、`css` 64 KB。
- 实测数字：主窗口 79 个探针里主题能改的从 **18 → 63**；标准迷你窗口 **17/18**（唯一没变的是封面那圈青色律动光晕，见下）；极简迷你窗口 **14/14**；**主题关闭时与改动前逐属性差异 0/79、0/18、0/14**。量法是 offscreen Electron + `getComputedStyle` 对比。
- 量迷你窗口的坑：`getComputedStyle` 会返回**过渡中途的插值**。`button` 上有 `transition: background-color 140ms`，刚 `setProperty` 就读会读回旧值，看起来像「按钮没上色」。探针必须先 `data-collapsed="false"`（收回态整块透明，量不到底色）+ `data-instant="true"`（映射到 `transition: none !important`），再等 350ms 读。
- **不许再改坏的边界**：任何 `*-filter` 变量都不许变量化（玻璃模糊/饱和度是 `docs/GLASS_SVG_TEXTURE.md` 的黄金参数）；`rgba(var(--fc-accent-rgb),…)` / `--home-accent-rgb` / `--home-icon-rgb` / `--visual-icon-rgb` 一律保留字面值（选中态描边和渐变第一段必须继续读用户自己挑的强调色，取色器的行内变量优先级本来就该高于插件）；迷你播放器封面那条 `rgba(110,231,216,…)` 配 `calc(… var(--mini-glow) …)` 的青色光晕是按窗口几何调过的，留作字面值不参与主题。
- 改了已发布主题的载荷**必须同时抬 `version`**：自带主题的种子只在版本号更高时替换用户 profile 里那一份，否则装过旧版的人看不到改动。三份示例主题（`theme-midnight-indigo.json` / `theme-warm-amber.json` / `theme-graphite.json`）各 55 变量、`"version": "1.4.0"`，`public/plugin-builtin-themes.js` 已按新载荷重新生成。
- 守卫：新增 `tests/plugin-theme-reach.test.js`（7 条：三份主题变量齐全且逐条过清洗、版本 ≥1.4.0、`app.css` 关键面板用 `var(--th-*)` 且取色器地盘/`*-filter` 没被变量化、两份迷你 HTML 的 var+回落形式与 `applyMiniThemeVars` 接线、主进程二次清洗与签名顺序无关、缓存持有/释放 `themeVars`、runtime→renderer→main 整条转发链）。顺带改两条旧断言：`tests/mini-player-state-cache.test.js` 的整体 `deepEqual` 补 `themeVars: {}`，`tests/special-liked-playlist.test.js` 改成匹配 `var(--th-popover-bg,var(--th-panel-bg,rgba(6,7,11,.965)))!important`。全量 `461/461`。
- 文档：`docs/PLUGIN_AUTHORING.md` 加「### 上色请走 `--th-*`」；`examples/plugins/README.md` 补主通道变量组→界面对照表、迷你播放器一节、「还是走不通的老变量」一节。
- 发布路径：提交 `0874898` 在 `codex/mini-cover-static`，推分支 → 注解 tag `v1.7.3` → `gh release create v1.7.3 --notes-file`（正文取 CHANGELOG 本节）→ `gh workflow run "Build and Release" --ref v1.7.3 -f tag=v1.7.3`（run `32547356785`，成功）。全程 `HTTPS_PROXY=http://127.0.0.1:7897`。这次发布前代理客户端没起，`7897` 无监听且直连被 reset，`git push` / `gh` 全部失败——遇到这种情况先 `netstat -ano | grep 7897` 确认监听再排查别的。
- `v1.7.3` Release 资产：`Mineradio-1.7.3-Setup.exe` `101525507` 字节 / SHA256 `b9db856ec3d8edddddbfa88480510a5d28126e99535112d93f51e744a127bab3` / SHA512 `TU8+qDolE374NJI6fyud2al7nGUVpeBchmCE9miysdCIl4urnaSbEiUHrZm2EOHF1S23NiA9MQSPK4tIqpaXdQ==`；blockmap `105910` 字节 / `9f4d477c7e693fdc002d3be5fa34c719ebbf765fbf2f4d1a7b31e0dcc32fe844`；`latest.yml` `347` 字节 / `9868486b1f8951528d717515aa7cde896fdaf37bb5c923b24877e4c5880b0375`；SHA256 清单 `273` 字节。未生成跨版本轻量补丁和 Portable ZIP。

## v1.7.2 安装包自带两份主题 + 主题互斥

- 日期：2026-08-21。版本从 `1.7.1` 提升为 `1.7.2`。
- 用户原话：「只保留主题插件 删除音源插件和歌单插件 主题插件切换使用另一个时自动禁止其他主题不要两个主题同时启用 发布1.7.2 自带theme-midnight-indigo.json(午夜靛蓝) theme-warm-amber.json(暖琥珀) 这两个主题」。
- 删的是**示例插件文件**，不是插件子系统：`source` / `playlist` / `lyric` 三类脚本插件的能力、沙箱、代理、UI 一行没动，只是 `examples/plugins/` 不再附带那两份档案馆示例（原文件备份在 `C:\Users\Administrator\Desktop\Mineradio-归档\examples-plugins-1.7.1\`，`E:\桌面\播放器软件\工作区备份` 在本机不存在）。
- 自带主题实现：新增 `public/plugin-builtin-themes.js`（两份 JSON 内嵌成 JS 字面量，导出 `MineradioBuiltinThemes.list()` / `.ids()`），`public/index.html` 在 `plugin-runtime.js` **之前**加载它。`plugin-runtime.js` 的 `init()` 调 `seedBuiltinThemes()`，走的是与用户导入完全相同的 `parsePluginPackage()` 通道 —— 自带主题不享受任何清洗豁免。
- 三条自带主题规则：`enabled: false` 入列（升级不擅自换掉全体用户的外观）；卸载记进 `mineradio-plugins-builtin-v1` 的 `removed`，下次启动不再塞回来，手动装回时这条记忆被清掉；只在自带版本号 > 本地记录时覆盖，覆盖时保留 `enabled` / `installedAt`，所以用户自己改的同 id 高版本不会被按回去。
- **不要给记录加 `builtin` 字段**：`Manifest.normalizePluginRecord()` 返回固定形状，多出来的字段过一次存盘就没了。自带身份靠 `MineradioBuiltinThemes.ids()` 这份常量名单判断。
- 主题互斥实现：`enforceSingleTheme(keepId)` 关掉除 `keepId` 外所有启用中的主题，在 `setEnabled(id,true)`（主题）和 `install()`（装进来就是启用态的主题）两个变更点调用；`init()` 里再用 `latestEnabledThemeId()`（`updatedAt` 最大）收敛历史存档并落盘。理由：两份主题同时注入时后一份盖住前一份的同名变量，最终外观取决于安装顺序，用户看不懂也调不动。
- UI 提示：`togglePluginEnabled()` 在切换前先记下会被顶掉的主题名（`setEnabled` 之后就问不出来了），提示成「已切换到 X，Y 已关闭」；`install()` 多返回一个 `switchedOff` 数组给导入路径用。
- 主题着色强度：三份示例主题的 `--saved-*-glass-bg` 与 css 渐变提到肉眼可分辨（面板/卡片/搜索框底色 + 内发光）。**不许动的两条**：任何 `*-filter` 变量（玻璃模糊/饱和度是黄金参数）、渐变第一段必须保留 `rgba(var(--home-accent-rgb),…)` 让用户自己的强调色继续透出来。
- 主题真正能改的只有九个变量：`--panel-glass-shadow` `--saved-panel-glass-bg` `--saved-panel-glass-shadow` `--saved-button-glass-bg` `--saved-button-glass-hover-bg` `--saved-button-glass-shadow` `--saved-button-glass-hover-shadow` `--champagne` `--source-local`。其余三类无效：被取色器钉成 `documentElement` 行内变量的（`--fc-accent*` `--glass-border` `--home-accent*` `--visual-*`，刻意如此，用户挑的强调色不该被插件改掉）、`app.css` 里声明了没人读的（`--fc-bg` `--fc-paper` `--fc-ink*` `--fc-muted` `--fc-hair*` `--champagne-deep` `--chill-*` `--fc-blue` `--fc-warm` `--glass-border-soft`）、被后面 `rgba(0,0,0,.1)!important` 字面值盖掉的（`--glass-bg` `--glass-bg-focus` `--glass-shadow`）。面板底色只能走 `css` 通道 + 同选择器 `!important`。
- 守卫：`tests/plugin-system.test.js` 新增 6 条（自带包与 `examples/plugins/theme-*.json` 逐字段一致、首启装入但不启用、卸载不复活/装回恢复、版本比较覆盖并保留启用状态、两份自带主题互斥、历史多启用在 init 时收敛）；原「两个主题变量同时注入」那条按新不变式重写。`tests/packaging-file-whitelist.test.js` 加 `public/plugin-builtin-themes.js`。**vm 里跑出来的数组不能直接 `deepStrictEqual`**（跨 realm 原型不同，报告里 actual/expected 长得一模一样却红），要先 `Array.from()`。
- 全量 Node 回归 `454/454`。真渲染进程验证（offscreen Electron + `executeJavaScript`）：两份自带主题默认 `enabled:false` 入列；开靛蓝→只有靛蓝启用；再开琥珀→靛蓝自动关闭、`--saved-panel-glass-bg` 计算值为 `rgba(44,26,10,.58)`；全关后注入内容长度 0，`#mineradio-plugin-theme-style` 始终只有 1 个节点。
- 发布路径：提交 `538948c` 在 `codex/mini-cover-static`，推送分支 → 注解 tag `v1.7.2` → `gh release create v1.7.2 --notes-file`（正文取 CHANGELOG 本节）→ `gh workflow run "Build and Release" --ref v1.7.2 -f tag=v1.7.2`（run `32465602278`，成功，1m54s）。全程 `HTTPS_PROXY=http://127.0.0.1:7897`。
- `v1.7.2` Release 资产：`Mineradio-1.7.2-Setup.exe` `101524742` 字节 / SHA256 `8413e851043efbd17d379fcc1878ffd8fd5fcb32f014964ebd8cce2084ecab9c` / SHA512 `tcB6AWQAjpDR4NCCGkR6Hp4VtzeQXde1ggLRtq1TuRQG6HD45nfkquS8jQWKoEtfbpBDwms+BEGC5XFx4Zpuiw==`；blockmap `105913` 字节 / `8f4329ca6859f71c36e556fbaa987a6d6e628c6ea03ff5a6aafd00b36be1ef22`；`latest.yml` `347` 字节 / `9fcc76b4397ec0ea55bd320c8c725f0dd09fbdfd30dff051c75207c7212a2ef8`；SHA256 清单 `273` 字节。未生成跨版本轻量补丁和 Portable ZIP。

## v1.7.1 修复 v1.7.0 安装包无法启动（打包白名单）

- 日期：2026-08-21。版本从 `1.7.0` 提升为 `1.7.1`。
- 用户原话：「直接打不开软件了」。
- 根因：`package.json` 的 `build.files` 是**白名单**，没被任何模式命中的根级文件不会进包。新增的 `plugin-proxy.js` 没加进去，安装包里缺这个文件，`server.js:14` 的 `require('./plugin-proxy.js')` 抛 `MODULE_NOT_FOUND`，位置在 `createWindow()` 内，被调用方吞成未处理的 Promise rejection——进程活着，但窗口和本地服务都没有，用户看到的就是双击没反应。
- 修复：`plugin-proxy.js` 同时加入 `build.files` **和** `build.asarUnpack`。两处都要：`server.js` 在 `app.asar.unpacked` 里运行，相对 require 按它自己的真实路径解析，只打进 asar 仍然找不到。这一点是实际打包复现出来的，不是推断。
- 顺带堵住静默失败：`createWindow()` 里 `require(path.join(APP_ROOT,'server.js'))` 改成显式 try/catch，失败时 `console.error` + `dialog.showErrorBox('Mineradio 启动失败', …)` + `app.quit()`。以后这类问题至少会弹框而不是无声挂起。
- 守卫：新增 `tests/packaging-file-whitelist.test.js`，扫 `desktop/main.js` / `desktop/preload.js` / `server.js` 的相对 require 并核对 `build.files` 收录情况，另外单独钉住插件四个源文件和 `asarUnpack` 一致性。已验证把白名单改回去这条测试会失败。`tests/complete-optimization-gates.test.js` 里对 `asarUnpack` 的精确断言同步加上 `plugin-proxy.js`。
- 验证方式（以后再动打包配置照这个来）：`npx electron-builder --win dir` → 读 `dist/win-unpacked/resources/app.asar` 头部 JSON 确认根级条目 → 用 `Start-Process -RedirectStandardError` 起 `dist/win-unpacked/Mineradio.exe` 看日志。修复前复现 `Cannot find module './plugin-proxy.js'` 且无窗口，修复后本地服务监听并走到 `home-revealed`。注意：`Mineradio.exe` 从 bash 直接起会立刻脱离终端（exit 0）、拿不到 stdout，`MainWindowTitle` 也是空的（无边框窗口），别拿这两个当判断依据。
- 全量 Node 回归 `446/446`。
- 发布路径：提交在 `codex/mini-cover-static`（`958de59`），推送分支 → 注解 tag `v1.7.1` → `gh release create v1.7.1` → `gh workflow run "Build and Release" --ref v1.7.1 -f tag=v1.7.1`（run `32450624993`，成功）。工作流用 `gh release upload $tag`，Release 必须先存在；工作流本身不跑测试，所以打包类问题只能靠本地回归和事后核包发现。
- `v1.7.1` Release 资产：`Mineradio-1.7.1-Setup.exe` `101520699` 字节 / SHA256 `7bffb8e3d3c2d7257c6c6b8849cff4e1641a3c478fbb54ee2566fd87b7166960` / SHA512 `/VXC5VjVhOjd/erE5wiCQvF9ksSS0j9BU95JB8IfGwkjIStLNftbO+F3+SW9tPwUJaJ7GkbYkb4qk53DqGoMeg==`；blockmap `105909` 字节 / `e0276917b93838c0f374e1ed45221ae647465931511e6217785b476694ff39dc`；`latest.yml` `347` 字节 / `e9eb83449aad8b030a98172c5dc09b636ebeb5adf4c6bda85bf869b9029da412`；SHA256 清单 `273` 字节。未生成跨版本轻量补丁和 Portable ZIP。
- 已回读远端安装包核包（这一步以后每次改打包配置都要做）：下载 `Mineradio-1.7.1-Setup.exe` 校验 SHA256/SHA512 与 `latest.yml` 一致，再用 `node_modules/electron-winstaller/vendor/7z.exe` 取出 `$PLUGINSDIR/app-64.7z`，确认 `resources/app.asar.unpacked/` 含 `plugin-proxy.js` `server.js` `package.json`，asar 根条目为 `build desktop package.json plugin-proxy.js public server.js`，`public/` 含 `plugin-manifest.js` `plugin-runtime.js` `plugin-sandbox.js`。本机没有系统级 7-Zip，用 `node_modules` 里那份即可。

## v1.7.0 插件系统（主题 / 音源 / 歌单）

- 日期：2026-08-21。
- 版本从 `1.6.3` 提升为 `1.7.0`。
- 用户原话：「增加插件功能：主题插件，歌单插件，音源插件等」。三个作用域决定由 AskUserQuestion 明确选定：执行方式选「Worker 沙箱跑真 JS」，音源播放范围选「允许播在线流」且「本地播放路径一行不改」，交付范围选「三种插件一次做完并发布」。零内置插件。
- 分层：`public/plugin-manifest.js`（包解析 / 校验 / 主题 CSS 清洗 / `@host` 归一化匹配，纯函数 UMD，浏览器 + Worker + Node 共用）、`public/plugin-sandbox.js`（Worker 内剥能力 + `new Function` 执行正文）、`public/plugin-runtime.js`（宿主侧记录管理 / RPC / 白名单判定 / 主题注入 / 结果归一化，暴露 `window.MineradioPlugins`）、`plugin-proxy.js` + `server.js`（出网代理）、`public/app.js` + `public/index.html`（管理界面与播放分支）。详见 `.context/architecture/mineradio-plugin-system.md`，插件作者文档在 `docs/PLUGIN_AUTHORING.md`。
- 安全边界（改动前先看这条）：沙箱是**能力**沙箱不是语言沙箱，防线是插件拿不到任何有副作用的东西；插件正文必须用 `new Function` 而不是 `eval`，否则插件能看到 bootstrap 的 `pending` / `handlers` 闭包变量、劫持别的插件的调用（`tests/plugin-system.test.js` 用正则钉住这条）；`@host` 白名单只能在渲染进程判，沙箱里的变量都可能被插件改写；代理只管通用安全（协议、私网地址、体量、超时），不管业务白名单。
- 故意的不对称：`/api/plugin/fetch` 只放 https，`/api/plugin/stream` 额外放 http。音乐 CDN 直链经常 302 到 http，流代理不跟就没法播。别把它「修」成一致。
- 音频与封面都走 `/api/plugin/stream`，因为代理会补 `Access-Control-Allow-Origin: *` 和 `Cross-Origin-Resource-Policy: cross-origin`，这才让 `<audio crossOrigin="anonymous">`（Web Audio 分析器）和封面取色 canvas 对远程资源可用。
- 本地播放路径未改：插件曲目走新增的 `playPluginQueueItem()`，与 `playLocalQueueItem()` 并列，`playQueueAt()` 按 `song.type` 分派。前半段共享的本地辅助函数本来就在 `type !== 'local'` / 缺 `localKey` 时提前返回。插件歌词写进 `song.localLyricText` 再调 `applyLocalOriginalLyricsState(song)`，复用现成 LRC 管线；本地歌词管线没有翻译概念，插件返回的 `translation` 目前被丢掉。
- 插件歌曲不能加入「特别喜欢」与本地歌单：那两处按本地文件引用存盘，插件曲目没有文件可引用，半吊子实现会留死记录，所以明确拒绝并给提示。插件歌单也不进左侧本地歌单面板，只在插件管理弹窗里「播放」。
- 主题层级：插件主题注入 head 里唯一的 `<style id="mineradio-plugin-theme-style">`，用 `textContent` 不用 `innerHTML`；`applyUiAccentColor()` 写在 documentElement 上的行内变量优先级更高，用户自调主色压过插件主题是有意的。`applyThemes()` 先同步写声明式部分再合并脚本主题结果，避免 Worker 启动那几秒界面裸着。
- 存档：localStorage `mineradio-plugins-v1`，经 `bridge.persist`（`setPersistentLocalStorageItem`）+ preload `PERSISTENT_UI_STATE_KEYS` 备份。同 id 覆盖安装视为升级：换脚本、保留用户的启用/禁用状态。
- 上限常量：单包 512 KB、最多 40 个插件、主题变量 160 条、主题 CSS 64 KB、`@host` 16 个、fetch 响应 8 MB / 15 秒、流 30 秒 / 5 次跳转。
- 回归覆盖：新增 `tests/plugin-proxy.test.js`（7 项，起 127.0.0.1 临时上游跑真 HTTP）与 `tests/plugin-system.test.js`（16 项，`vm.createContext` 让真 sandbox 与真 runtime 互相对接，消息过 JSON 往返模拟结构化克隆）。写这类测试时注意：vm 里造的数组原型与测试 realm 不同，`assert.deepStrictEqual` 会因原型不匹配误报，断长度或逐字段断。全量 Node 回归 `443/443`。
- `v1.7.0` 已发布到 GitHub：`https://github.com/oirge/Mineradio/releases/tag/v1.7.0`，已是 Latest，非草稿非预发布。
- 发布路径：本轮通过 GitHub CLI 完成。提交在 `codex/mini-cover-static`（`c238d1b`），推送分支后打注解 tag `v1.7.0` 并推送，`gh release create` 建 Release，再 `gh workflow run "Build and Release" --ref v1.7.0 -f tag=v1.7.0` 由 Windows Runner 构建并上传资产。工作流用的是 `gh release upload $tag`，所以 Release 必须先存在。
- `v1.7.0` Release 资产：`Mineradio-1.7.0-Setup.exe` `101516131` 字节 / SHA256 `c058169b5df2f99158af125dc54226ddaa02983dfb5260cb2b99eb3e02b79c90`；blockmap `105970` 字节 / `1999d07cca4d23549acc60c3df90d665ee0f58397bf73acf8a7a9ebc1b8a91c9`；`latest.yml` `347` 字节 / `f61a063512ccb25b0e9207aed89e81b0c1ec411037e41a2e2d0380181bcc53b6`；SHA256 清单 `273` 字节 / `5c0808a50977c37f7f0f8a64a8fa173a82fc8fcbe8730c1ba17594173ea39dd4`。未生成跨版本轻量补丁和 Portable ZIP。
- `latest.yml` 的 Setup SHA512：`xWrjB+arwLokTBUK6/AUz6laSeeFtWcWXg3KHKWD55H6Y00gXPhGxXjdLOuOYFVt5tAbWJIjEkgwMShi07r4nQ==`，`version: 1.7.0`，`releaseDate: 2026-08-21T04:39:36.412Z`。

## v1.6.3 壁纸模式解锁并新增展示位置切换

- 日期：2026-08-21。
- 版本从 `1.6.2` 提升为 `1.6.3`。
- 用户原话：「在最新版的基础上更新增加选项切换桌面壁纸效果，以背景板形式展示」，并在澄清后明确选择「两者都要，用选项切换」。
- 解除 `v1.0.6` 起对壁纸模式入口的强制关闭：`DEVELOPMENT_LOCKED_FX` 清空为 `{}`，`isDevelopmentLockedFx` / `normalizeDevelopmentLockedFxState` 改为通用实现，`t-wallpaperMode` 与 `fx-wallpaperopacity` 不再带 `dev-locked`。桌面歌词相关入口本轮未改动。
- 新增 `public/wallpaper-effect.js`，导出 `window.createMineradioWallpaperEffect(canvas)`，返回 `{ applyState, setPaused, dispose }`。这是壁纸画面的唯一实现；`public/wallpaper.html` 和播放器内 `#wallpaper-board` 共用它，画面、调度节奏（播放中 RAF、空闲 30 FPS、关闭 1 秒）和关闭态释放完全一致。改这个模块会同时影响两个展示位置。
- 新增 `fx.wallpaperSurface`（`desktop` / `board`，`normalizeWallpaperSurface` 归一化，未知值回落 `desktop`），设置面板新增 `#wallpaper-surface-seg` 分段控件。
- 分流边界：`pushWallpaperState` 在 `wallpaperSurface === 'board'` 时直接 return，`applyWallpaperModeState` 计算 `boardActive` / `desktopActive`，未选中的那侧一定被关闭并释放，永远只有一个展示位置在跑。背景板走 `pushWallpaperBoardState`，`desktopOverlayActive()` 额外识别 `wallpaperBoardActive()`，因此背景板在非桌面壳环境也能同步。
- `desktop/main.js` 本轮未改动：切到背景板时通过 `api.setWallpaperMode(false, { enabled:false })` 关闭 WorkerW 覆盖窗口即可。
- 内存边界不要改坏：`pushWallpaperBoardState` 与桌面壁纸层共用 `wallpaperPayload()` 复用载荷，`applyState` 同步读走封面后必须立刻 `releaseWallpaperTransferFields`，不要让封面 data URL 常驻。当初考虑过 iframe + postMessage，已否决，原因是会把大封面 data URL 结构化克隆进第二个文档堆。
- 层级边界：`#wallpaper-board` 必须排在 `#custom-bg` 和 `#wallpaper-engine-layer` 之前，用户自选背景图/视频和 Wallpaper Engine 壁纸才能继续盖在上层；启用时 `body.wallpaper-board-active` 让 `#album-bg` 让位，避免两层封面画面互相糊掉。
- 存档兼容：新增 `wallpaperSchema: 'wallpaper-surface-v1'`（`WALLPAPER_SURFACE_SCHEMA`），只有带该 schema 的存档才恢复 `wallpaperMode`，避免旧版强制写回的 `false` 造成误开误关。DIY 用户存档归一化和 `PACKAGED_DEFAULT_FX_SNAPSHOT` 未加壁纸键，缺键回落 `fxDefaults`。
- 回归覆盖：新增 `tests/wallpaper-surface-board.test.js`（8 项）；`tests/render-scheduler-hot-path.test.js` 和 `tests/complete-optimization-gates.test.js` 改读 `public/wallpaper-effect.js`；`tests/desktop-overlay-disabled-ipc.test.js` 补 `syncWallpaperBoardSurface` / `pushWallpaperBoardState` 桩。全量 Node 回归 `420/420`，`node --check` 与 `git diff --check` 通过。
- `v1.6.3` 已发布到 GitHub：`https://github.com/oirge/Mineradio/releases/tag/v1.6.3`，已是 Latest，非草稿非预发布。
- 发布路径：本轮通过 GitHub CLI 完成。提交在 `codex/mini-cover-static`（`fb1fd2a`），推送分支后打注解 tag `v1.6.3` 并推送，`gh release create` 建 Release，再 `gh workflow run "Build and Release" --ref v1.6.3 -f tag=v1.6.3` 由 Windows Runner 构建并上传资产（`1m56s` 成功）。工作流用的是 `gh release upload $tag`，所以 Release 必须先存在。
- `v1.6.3` Release 资产：`Mineradio-1.6.3-Setup.exe` `101496117` 字节 / SHA256 `d5e83ecf81c468b0acb5791cfc4eec6e6ed5b8459d62d25b51c845b5e030a4f7`；blockmap `105779` 字节 / `91b579440f1b28753ce1f03bc49ce359e076b7dcf42759e5569bf69789936438`；`latest.yml` `347` 字节 / `14dc0d435808d4fd72bbbc784e07285e080f80157b74c1f0f22716365cbaf499`；SHA256 清单 `273` 字节。未生成跨版本轻量补丁和 Portable ZIP。
- `latest.yml` 的 Setup SHA512：`/7yN7lQPUSj9qZZApPZ9MDZnDm+qAsFQKiPNdb99MdjyC4PPqoFn1SoLM/1FZjM3As0bhM/gRiSWOxhwFvjSBw==`，`version: 1.6.3`，`releaseDate: 2026-08-21T02:52:41.009Z`。

## 2026-08-16 更新线路展示语义

- 用户反馈：选择“本机代理”时，面板提示显示“通过本机代理 `http://127.0.0.1:7897` 直连 GitHub”，下载进度又显示“GitHub 直连”，容易误读为代理没有生效。
- 事实：`route=proxy` 创建任务时会解析 `proxyTarget`，`openUpdateRouteResponse()` 进入 `fetchThroughUpdateProxy()` 的 CONNECT 隧道；“GitHub 直连”只代表候选目标是 GitHub 原始地址，不代表传输绕过本机代理。
- 约定：代理线路的提示必须使用“通过本机代理 <地址> 访问 GitHub 原始地址”，下载来源必须使用“本机代理访问 GitHub”；只有 `route=direct` 才使用“GitHub 直连”。
- 回归：`tests/update-route-hint.test.js` 锁定提示和下载来源标签，避免以后再次把目标地址标签误当成传输线路。

## v1.6.0 修复迷你播放器封面律动与光晕无反应

- 日期：2026-08-16。
- 正式发布版本从 `1.5.9` 提升为 `1.6.0`；已安装 `1.5.9` 及更早版本的客户端通过 `latest.yml` 自动发现更新。
- 用户原话：「最新版本的迷你播放器封面光晕和跳动没反应」并要求「不要影响我使用电脑」「发布1.6.0」。
- 根因：隐藏播放时 `beatAnalyser` 在后台切换或 `AudioContext` 恢复瞬间可能返回全零频谱，旧逻辑仍把该帧作为有效节拍数据，覆盖主 `analyser` 的有效频谱；同时 `document.hidden` 可能早于 `desktop-window-state` IPC 到达，导致采样定时器未启动。
- 解决方案：仅当前 96 个低频桶存在信号时优先使用 `beatAnalyser`，否则回退主 `analyser`；`miniPlayerPulseValue()`、`miniPlayerPulseTimerActive()` 和 `visibilitychange` 同时识别页面隐藏态与窗口状态隐藏态。异常只放弃当前低平滑采样，不中断主播放链路。
- 不改变边界：保留独立律动/光晕开关和 `0.00 ~ 3.00` 强度；不启动 Electron、不关闭 Mineradio、不抢焦点、不发送全局鼠标键盘输入，构建使用 GitHub Actions Windows Runner。
- 回归覆盖：`tests/mini-player-pulse.test.js` 新增空节拍频谱回退、有效节拍频谱优先、文档隐藏态定时器激活断言；本地与 GitHub Actions 全量 Node 回归均为 `406/406`，关键 JavaScript 语法检查和 `git diff --check` 通过。
- `v1.6.0` Windows x64 NSIS 资产：安装器 `101491154` 字节 / SHA256 `e859cc7bbe9a00915c877742a22ef06d6400a673238ab690a1260d82b162d495`；blockmap `105922` 字节 / `b3a301fd1bdc184b3998604ee78914d0effad74cd2f2266835078876b7ce61a5`；`latest.yml` `347` 字节 / `bb1d470d255e9a2ca2bb7d909c3fd434a833c6b70864e7015b34a345a4843bfe`；SHA256 清单 `273` 字节 / `404c94ebe572f4300e23222749557eea855d80c9171f7e0c1b874fa19716f3f1`。
- `latest.yml` 的 Setup SHA512：`QnigLfj5ETAv+t9C0g0GlLsnf7JEF2itHpykLaffSA4m7gBUktl6RiJvgK3E/b8y7GQnHL36BDEzDn+qqsneIw==`；Release 草稿已上传四项资产，Portable ZIP 未生成或上传。

## v1.5.9 修复本机代理线路无法取消更新

- 日期：2026-08-16。
- 正式发布版本从 `1.5.8` 提升为 `1.5.9`；已安装 `1.5.8` 及更早版本的客户端可通过 `latest.yml` 自动发现更新。
- 用户原话：「改好之后改一下迷你播放器的封面律动和封面光晕效果不够明显增加选项让用户自定义效果更加明显或者关闭改好之后发布新版本」。`v1.5.8` 已交付该需求；本版本是发布后按「修完验证」流程实测发现的回归修复，不是新需求。
- 缺陷现象（实测，非推测）：`v1.5.8` 上 `POST /api/update/download?route=proxy` 下载中调用 `/api/update/cancel`，取消请求本身返回 `ok`（`canCancel` 立刻转 `false`、`message` 为 `正在取消更新…`），但后续轮询始终是 `status downloading / canceled false`，`received` 从 `18169856` 一路涨到 `23149887`。`direct` / `mirror` / `auto` 线路取消正常。
- 根因：取消只依赖了传输层信号。`direct` / `mirror` 走 `fetch(url, { signal })`，`abort()` 会连带掐掉响应体；`proxy` 的正文是 `Readable.toWeb(res)`，`Readable` 不认识 `AbortSignal`，而 `fetchThroughUpdateProxy()` 的 `settle()` 在响应头到达时就已经摘掉了 abort 监听，于是没有任何一方能打断这条连接。
- 结论（写死为约定）：取消必须做两层，缺一层都不完整。第一层是传输无关的 `throwIfUpdateJobCanceled(job)` 逐块检查（安装包循环、补丁循环各在 `reader.read()` 前后一次，测速循环 `if (job && job.canceled) break;`），保证循环一定能停；第二层是 `nodeResponseAsFetchLike(res, signal, socket)` 自己监听 `abort` 并销毁响应流与 `CONNECT` 隧道 socket，保证 TCP 连接真的释放而不是继续灌进没人读的缓冲区。
- 坑（踩过）：给代理响应绑定取消时用 `res.destroy(updateError(...))` 会让测试进程直接 `uncaughtException`（`Error: Update canceled` … `generated asynchronous activity after the test ended`）。正文可能还没有读取端，带错误销毁会发出无人监听的 `'error'` 事件。改成无参 `res.destroy()` 即可，且是确定性的——下载循环两处 `settle` 分支都在 `classifyUpdateError()` 之前判 `job.canceled`，任意流错误都会收敛成 `canceled` 终态、`error` 为空。
- 复验（实测通过）：`MINERADIO_VERSION=1.5.7` + `HTTPS_PROXY=http://127.0.0.1:7897` 起服务走真实 GitHub，`route=proxy` 下载到 `received 733339` 后取消，`3` 秒内即为 `status canceled / canceled true / received 766107 / message 更新已取消 / error 空`，之后四次轮询字节不再变化。
- 本版本只改 `server.js` 与 `tests/update-route-selection.test.js`（`11` 项 → `14` 项），不动前端、CSS、文案与交互入口，符合「能不动 UI 就不动 UI」。全量回归 `403/403`。
- `v1.5.9` Windows x64 NSIS 资产：安装器 `101488940` 字节 / SHA256 `a8589b51157439d7583148c0ff951892d66347607af85417376564085b037d70`；blockmap `105851` 字节 / `261263ccafd07b3425400fabccf3d41054cc5bd479e12a557df31efa03580966`；`latest.yml` `347` 字节 / `cc39b8727d6a06c7b634d1dcd6ddeb3dc59d0e67fdaafad0c9066e46c3248706`；SHA256 清单 `270` 字节 / `3db99ce0eaf76602a1231baaf2c381aac017ed60ac588fd0a6755330d7e897bf`。

## v1.5.8 更新线路手动选择、取消更新与迷你封面律动光晕强度

- 日期：2026-08-16。
- 正式发布版本从 `1.5.7` 提升为 `1.5.8`；已安装 `1.5.7` 及更早版本的客户端可通过 `latest.yml` 自动发现更新。
- 用户原话诉求两条：更新要“可以取消更新 自己选择更新地址 直连 代理 国内加速”，迷你播放器“封面律动和封面光晕效果不够明显增加选项让用户自定义效果更加明显或者关闭”。
- 涉及文件：`server.js`、`public/app.js`、`public/app.css`、`public/index.html`、`public/mini-player.html`、`desktop/mini-player-state-cache.js`、`.context/architecture/mineradio-update-route-selection.md`、`.context/architecture/mineradio-player-performance-seams.md`、`tests/update-route-selection.test.js`、`tests/update-fastest-route.test.js`、`tests/mini-player-visual.test.js`、`tests/mini-player-state-cache.test.js`。
- 关键结论（更新线路）：线路必须在 `rankUpdateDownloadCandidates()` **之前** 用 `filterUpdateRouteCandidates()` 裁剪候选，否则测速排序会把用户排除的线路重新排到前面。选中线路无候选时抛 `UPDATE_ROUTE_UNAVAILABLE`，绝不静默回落——静默回落等于用户的选择没生效。
- 关键结论（代理）：`server.js` 跑在 Electron 主进程内，所以能用 `session.defaultSession.resolveProxy(url)` 探测系统代理（PAC 返回 `"PROXY host:port"` 或 `"DIRECT"`）。独立 `node server.js` 时 `proxyLabel` 为空是预期行为，不是 bug。代理下载是手写 `CONNECT` 隧道 + `tls.connect` + `http.request({ createConnection })` + `Readable.toWeb`，保持零运行时依赖。
- 关键结论（取消）：`canceled` 是 `ok: true` 的正常终态，前端必须在 `queued` / `downloading` 分支之前判断它，否则取消后按钮会一直显示“下载中”。`job.applying` 期间必须拒绝取消——补丁应用中途中断会留下混合版本。
- 关键结论（律动/光晕几何上限）：标准迷你窗口固定 `360 × 84`，`body { padding: 6px }` 后外壳 `348 × 72`，收回态 `54 × 54` 封面上下只剩约 15px、左右只剩约 7px。直接抬高 CSS 缩放/光晕系数会被操作系统窗口裁掉半圈光晕，属于“错位”。正确做法是把饱和曲线放进 JS：`signal = Math.pow(pulse, 0.72)`，再 `saturateMiniEffect(signal * strength) = 1 - Math.exp(-1.15 * level)` 压成 `0 ~ 1` 的 `--mini-pulse` / `--mini-glow`，CSS 系数只承担几何上限（收回态 `0.195`、展开态 `0.125`）。强度拉满 `3.00` 时封面缩放到 `1.195`，实测最坏边距 `1.7px`，两个展开方向都不裁切。
- 关键结论（开关语义）：光晕不能挂在 `pulseEnabled` 上，否则关掉律动光晕也一起没了；两个开关关闭时要保留用户已选强度，重新打开恢复原档位。标准力度 `1.00` 下典型能量的封面缩放幅度约为旧版（`strength 0.78`）的 `2.5` 倍，外沿光晕透明度从 `0.14` 提到约 `0.29`。
- 顺手修的真实缺陷：更新面板可能在延迟初始化（9~12 秒）之前被打开，此时线路分段按钮还没绑定，点了没反应。`openUpdatePanel()` 现在会补一次幂等的 `initUpdateRouteControls()`。
- 环境坑：预览浏览器窗格不显示时 rAF 被节流，更新面板的 GSAP 开场 tween 不推进，`#update-modal` 一直停在 `opacity: 0; visibility: hidden`，真实 `preview_click` 打不到面板内元素，`preview_screenshot` 也会超时。验证这类交互要用合成 `MouseEvent` 加 `getBoundingClientRect` / `getComputedStyle` 数值断言。
- 全量 Node 回归 `400/400`；`node --check` 与 `git diff --check` 通过。
- `v1.5.8` Windows x64 NSIS 资产：安装器 `101487553` 字节 / SHA256 `484e70284a1b23263fbf0ad42c494c690519ef2da7a0164f57e73d1ec587b57c`；blockmap `105911` 字节 / `2a42264120479e348c583e33305c917dc31f04bad1577526f9bb88b0b23ff2fd`；`latest.yml` `347` 字节 / `e39fd4c475841b328df549257cf6216c2faf7e4a9f44ac1b2a8189a417436b72`；SHA256 清单 `270` 字节 / `bdab066abae282c73dc027dd46f7b19f71085eec02a9e5913ebf0b676e3fba89`。
- `latest.yml` 的 Setup SHA512：`psjq0qrcIjuvXa+EoVsN0QUeZodpa8QleEKrC0yecKVM8zD5L485m7qasyIMces85YD7MDnr1u+gGLLwziSKmA==`。

## v1.5.7 自动播放开关与迷你播放器悬浮展开错位修复

- 日期：2026-08-16。
- 正式发布版本从 `1.5.6` 提升为 `1.5.7`；已安装 `1.5.6` 及更早版本的客户端可通过 `latest.yml` 自动发现更新。
- 涉及文件：`public/app.js`、`public/index.html`、`public/mini-player.html`、`.context/conventions/mineradio-auto-playback.md`、`.context/conventions/mineradio-mini-player-collapse.md`、`tests/auto-playback-startup.test.js`、`tests/mini-player-visual.test.js`。
- 自动播放三档状态 `off` / `continue` / `shuffle` 存在 `mineradio-auto-playback-v1`，并登记进 `PERSISTENT_UI_STATE_KEYS`；入口是 `public/index.html` 的 `fx-playback-fold`，归入视觉控制台“高级”页，复用既有 `fx-fold` / `fx-seg` / `lyric-color-row` / `mini-player-collapse-hint` 类，未新增 CSS。
- 关键结论：`nextTrack()` 本来就按取模环绕，队列播完会自动回到开头，唯一不自动出声的地方是启动——`restorePlaybackSessionForLocalLibrary` 故意只恢复位置并保持暂停。所以自动播放只需挂在 `handleLocalFolderFiles` 的两条启动出口上，不要去改 `nextTrack` 或 `playMode`。
- 自动播放歌单直接复用 `localLibraryPlaybackSelection` 和 `LOCAL_PLAYBACK_SOURCE_STORE_KEY`，启动时 `playQueue` 已经按这份选择构建，不需要第二套歌单存储。
- 不要再改坏的边界：`autoPlaybackRestoreHandled` 保证每次启动只起播一次（后台增量扫描会重复走 `handleLocalFolderFiles`）；`audio.src && !audio.paused` 时必须直接退出，不能打断已有播放；关闭态要保留 `pendingPlaybackSessionResume`，否则用户手动点播放就丢了上次进度；`shuffle` 起播前必须清空恢复点，避免随机到的歌从别人的时间点开始。
- 桌面歌词 `词` 按钮必须是 `.mini-shell` 直属子节点：它是 `position: absolute`，落在 `.transport` 内时收回态那份 `transform` 会把 `.transport` 变成包含块，240ms 悬浮过渡里按钮被拽到面板中央压住播放按钮，并被 `.transport` 的 `overflow: hidden` 裁切。
- 全量 Node 回归 `385/385`；`node --check` 与 `git diff --check` 通过。
- `v1.5.7` Windows x64 NSIS 资产：安装器 `101480140` 字节 / SHA256 `09cdaa786f890f2b618f8650d9422faa79fdca73a3ef8bb9cd289bdcce28321d`；blockmap `105940` 字节 / `e51bc8f6b94025b367123001d8ef5398fd6a97503ce177495f0e6a52689e214c`；`latest.yml` `347` 字节 / `3c3f404d19493544ad60043b02c9fcd4dba5a4c3ed098711247791ed085714ba`；SHA256 清单 `270` 字节 / `e561c8da33309dc41eb04a099ce0ec46f5d7bae1d669a8b1ce7f185c0664526a`。
- `latest.yml` 的 Setup SHA512：`AlNNeuJNbLZ1uMwA87vgHS0M1Z1gk0uAfJoZcZZvJ6cK74WEJfB3zCcNZHdAliYOnMIyfkiPrTjd/vRvu9DObg==`。

## v1.5.6 标准迷你播放器收回态穿透与桌面歌词按钮镜像修复

- 日期：2026-08-16。
- 正式发布版本从 `1.5.5` 提升为 `1.5.6`；已安装 `1.5.5` 及更早版本的客户端可通过 `latest.yml` 自动发现更新。
- 涉及文件：`public/mini-player.html`、`desktop/mini-player-preload.js`、`desktop/main.js`、`.context/conventions/mineradio-mini-player-collapse.md`、`tests/mini-player-visual.test.js`、`tests/mini-player-main-gates.test.js`、`tests/main-window-navigation-ipc-trust.test.js`。
- 关键结论：透明无边框窗口的收回态穿透只能靠 `setIgnoreMouseEvents(true, { forward: true })`，CSS `pointer-events: none` 只影响页面内命中，窗口本身仍会吞掉桌面点击。保留 `forward` 是为了让 renderer 在穿透期间仍能收到 `mousemove`，靠坐标判断指针是否回到封面热区。
- 热区判定用 `coverWrap.getBoundingClientRect()` 外扩 `6px`；`6px` 是给 IPC 往返留出的余量，缩小会在快速移入时丢第一次点击。
- 不要再改坏的边界：封面拖动期间必须强制关闭穿透（窗口跟着指针移动，热区坐标会瞬时失配）；关闭“自动收回”后面板常展开，也不能穿透；窗口创建 / 销毁 / 关闭必须重置 `miniPlayerPointerPassthrough`，否则新 renderer 的首次上报会被去重吃掉。
- 穿透通道 `mineradio-mini-player-set-pointer-passthrough` 属于迷你窗口自持通道，已加入 `tests/main-window-navigation-ipc-trust.test.js` 的 `overlayOwnedChannels` 清单，靠 `event.sender !== miniPlayerWindow.webContents` 自校验，不走 `trustedMainFrameHandler`。
- 桌面歌词 `词` 按钮向左展开时用 `left: 5px; right: auto;` 镜像到左下角。
- 全量 Node 回归 `372/372`；`node --check` 与 `git diff --check` 通过。
- `v1.5.6` Windows x64 NSIS 资产：安装器 `101477362` 字节 / SHA256 `022fe2a36b410f315f7f0da3437e80e25ebfc3b140c8ef3756d31581c9d3ef19`；blockmap `105997` 字节 / `b0da61626594e2c9d3ab8059888b2ee4ce2fb2defd0c94fbe644871b136dde53`；`latest.yml` `347` 字节 / `8ac4d639ed432e263ed11aae91ef7db869bd7f0fa3a8922ed517a2102d985fa3`；SHA256 清单 `270` 字节 / `6ce17fbe9162952b293f6f5d1341da38f68240f8884827400fbf86e76dc8bd1d`。
- `latest.yml` 的 Setup SHA512：`rM/11nPqX2g2CucOyW4YmRhw+3qGg3gEjdjkV8Zc6cHPtdfif5cpNlg0U63lLm9tP0bzY3vZIkOEIcDkwLeeQA==`。

## v1.5.5 迷你播放器封面律动、贴边展开与封面拖动修复

- 日期：2026-08-15。
- 正式发布版本从 `1.5.4` 提升为 `1.5.5`，保留标准迷你播放器封面律动、显示器边缘展开和封面拖动修复；版本号提升后，已安装 `1.5.4` 的客户端可通过 `latest.yml` 自动发现更新。
- 涉及发布记录：`CHANGELOG.md`、`RELEASE.md` 和本文件；源码行为沿用当前已验证的 `public/app.js`、`public/mini-player.html`、`desktop/main.js` 与 `desktop/mini-player-preload.js` 修复。
- 封面律动在主窗口隐藏且 `AudioContext` 挂起时先恢复音频分析；采样优先使用低平滑 `beatAnalyser`，通过低频均值、峰值、整体能量和短期基线计算瞬态对比，避免压缩音乐长期饱和为固定缩放值。
- `miniPlayerExpandDirectionForBounds()` 根据当前显示器工作区左右余量返回 `left` / `right`；标准面板靠近右边缘时向左展开，靠近左边缘时向右展开，收回态封面保持贴边。
- 封面 pointer 事件以屏幕坐标计算增量；总位移小于约 `5px` 仍触发展开，超过阈值通过 `mineradio-mini-player-move-by` 移动当前迷你窗口。主进程校验 IPC sender、限制单次偏移、按工作区夹紧并持久化坐标；该路径不接管全局输入，也不修改主播放器拖动。
- 全量 Node 回归 `368/368`，迷你播放器脉冲、方向、拖动和 IPC sender 门禁、版本一致性、发布工作流标签与资产清单测试通过；关键 JavaScript 语法检查与 `git diff --check` 通过。
- `v1.5.5` Windows x64 NSIS 资产：安装器 `101476694` 字节 / SHA256 `4af2724118ae0688e02cc0eefb4412ff909c2cf49780c11b051d2cfd5ee4f298`；blockmap `105747` 字节 / `96d6fdbfb86b638bf5083bdde3ca65797ffe27f482b4f2b13e2860425dc7204e`；`latest.yml` `347` 字节 / `9a61d1b3aaec517742339eb5189db632d87e40f1a5076d8894d3965420440b4b`；SHA256 清单 `270` 字节 / `b7ee1ae8f992d8390881808cb4d3e4c574d8479db875f6082ed0437b34e68867`。
- `latest.yml` 的 Setup SHA512：`Z1aNBtqVKPlb9VsvzClDK2fX4ZGHyPMNuU7oBTaNpEEM8uiahDvfOreqmNmQGK7qFJkR11ovKeYsgMSUK4aIMw==`。

## v1.5.4 迷你播放器封面律动、贴边展开与封面拖动修复重发

- 日期：2026-08-15。
- 本次保持版本号 `1.5.4`，基于现有 Wallpaper Engine 生命周期与窗口重建修复，补齐标准迷你播放器的封面律动、显示器边缘展开和封面拖动能力。
- 涉及文件：`public/app.js`、`public/mini-player.html`、`desktop/main.js`、`desktop/mini-player-preload.js`、`tests/mini-player-pulse.test.js`、`tests/mini-player-visual.test.js`、`tests/mini-player-main-gates.test.js`、`tests/main-window-navigation-ipc-trust.test.js`、`CHANGELOG.md`、`RELEASE.md` 和本文件。
- 封面律动在主窗口隐藏且 `AudioContext` 挂起时先恢复音频分析；采样优先使用低平滑 `beatAnalyser`，通过低频均值、峰值、整体能量和短期基线计算瞬态对比，避免压缩音乐长期饱和为固定缩放值。关闭律动或强度为零时仍保持静止，极简迷你播放器继续不创建封面。
- `miniPlayerExpandDirectionForBounds()` 根据当前显示器工作区左右余量返回 `left` / `right`；标准面板靠近右边缘时向左展开，靠近左边缘时向右展开，收回态封面保持贴边。
- 封面 pointer 事件以屏幕坐标计算增量；总位移小于约 `5px` 仍触发展开，超过阈值通过 `mineradio-mini-player-move-by` 移动当前迷你窗口。主进程校验 IPC sender、限制单次偏移、按工作区夹紧并持久化坐标；该路径不接管全局输入，也不修改主播放器拖动。
- 全量 Node 回归 `366/366`，迷你播放器脉冲、方向、拖动和 IPC sender 门禁测试通过；关键 JavaScript 语法检查与 `git diff --check` 通过。
- 同版本重发不会触发已安装 `1.5.4` 客户端的自动更新，发布说明必须提示手动下载安装器覆盖安装。

## v1.5.3 桌面歌词拖动原生竞态修复

- 日期：2026-08-15。
- 现场复现：正在运行的 `D:\Mineradio\Mineradio.exe` 文件版本为 `1.5.2`；桌面歌词窗口 bounds 为 `x=363, y=-155, width=1382, height=410`，覆盖主窗口标题栏。20 秒原生采样中捕获到拖动期间主窗口相对鼠标的单帧偏移突变最高约 `410px`，歌词窗口自身坐标保持不变，确认不是松手后工作区夹紧，而是移动中的鼠标捕获竞态。
- 涉及文件：`desktop/main.js`、`tests/fullscreen-window-behavior.test.js`、`tests/desktop-lyrics-ipc-ownership.test.js`、`package.json`、`package-lock.json`、`public/app.js`、`CHANGELOG.md`、`RELEASE.md`、`AGENTS.md` 和 `.context/architecture/mineradio-player-performance-seams.md`。
- 关键实现：主窗口挂接 `WM_ENTERSIZEMOVE / WM_EXITSIZEMOVE`；原生移动期间桌面歌词使用 `setIgnoreMouseEvents(true, { forward:false })`，清除 `desktopLyricsPointerCapture`，并拒绝当前歌词 renderer 重新申请捕获。`will-move` 与 `move` 作为 Electron 兜底，`moved` 不再调用 `keepMainWindowInsideDisplay()`，退出后延迟 `160ms` 恢复歌词交互。
- 禁止回退：主窗口移动期间不得恢复歌词鼠标 `forward:true`；不得允许歌词 renderer 在 `mainWindowMoveActive` 时重新捕获；不得在用户拖动路径或 `moved` 中执行主窗口 `setBounds()`。显示器参数变化与插拔的全量纠偏必须保留。
- 用户已在同一 profile 的 `win-unpacked` 修复测试包上确认问题解决；全量 Node 回归 `353/353`、关键脚本语法和 `git diff --check` 通过。Windows x64 NSIS：安装器 `101474711` 字节 / SHA256 `a8b9e9591dc2afb2296b391078a86635fa618524c52979183e7bd0659aedbcfe`；blockmap `105907` 字节 / `3b1699a90d2de78098e311caeab7f538c8d8aaa7504c21e91dbced96593fb0e7`；`latest.yml` `347` 字节 / `815f2f46cffc8518a51fa35b2841bcff4ef418ea08264ca8a9ff3260f2fc2aca`；SHA256 清单 `270` 字节 / `725962f0d913d357bf8c8606d98ba7badf12ba5a9f5acffaa78e9d04f1804e5b`。

## v1.5.1 软件内更新自动选择最快线路

- 日期：2026-08-14。
- 涉及文件：`server.js`、`tests/update-fastest-route.test.js`、`public/app.js`、`package.json`、`package-lock.json`、`CHANGELOG.md`、`RELEASE.md`、`.context/architecture/mineradio-update-route-selection.md` 和 `AGENTS.md`。
- 点击更新后由服务端并行探测全部候选线路；每条最多读取 `128 KiB`，统一测速窗口 `4 秒`，按包含连接耗时的实际吞吐量选择首选线路。
- 测速超时前已收到的部分样本仍参与排序；完全失败线路按原顺序放在队尾，正式下载失败后继续走既有自动换线。
- 完整安装包和快速补丁共用选线函数；镜像 SHA-256/SHA-512 门禁、安装包流式校验、大小上限和空闲超时不得绕过。
- 前端不新增线路控件，沿用现有任务轮询与进度展示；全量 Node 回归 `341/341` 通过。
- Windows x64 NSIS：安装器 `101472841` 字节 / SHA256 `b6d3cd88b20ac5e0d6da86d77ca7a86793b0b2003cc9c8a9daaa33a9196b3803`；blockmap `105974` 字节 / `5d8fc5e2f0685f09707eb8b661eb95f6aafbec88cf202f514eb7d80539e5a660`；`latest.yml` `347` 字节 / `7449c07b148a5b69e3dd8b4ebffab7df68650b8f6c4ef2cf40fd4f281970a0f1`；SHA256 清单 `273` 字节 / `444f1da527f96d38389be620322f56823f4ed4a90621563897b28c54be36a4ef`。

## v1.4.9 迷你播放器与更新检测

- 标准迷你播放器本体移除一次性 `×`，返回主界面按钮恢复右上角；`× 自动收回` 改为主界面 DIY“迷你播放器样式”区域永久可见的双向开关。
- 歌单删除使用播放器内暗色玻璃确认弹层；顶栏和更新面板均提供手动检测更新入口，检测请求单飞并显示检测中、最新版、新版本和失败状态。
- 升级继续使用 `%APPDATA%\\Mineradio-oirge` 与现有本地曲库、播放会话、特别喜欢、自建歌单和 DIY 设置，不要求重新导入。
- 全量 Node 回归 `325/325`，关键 JavaScript 语法检查与 `git diff --check` 通过；发布资产摘要见 `RELEASE.md`。
- Windows x64 NSIS：安装器 `101471651` 字节 / SHA256 `72da914f9561be28b27e0abe5b2e76fccc65e1471a07ba1c452b72abb304378b`；blockmap `105745` 字节 / `f722090d6b7e4f87ba8be38969f49b0bf4f5042c70202681e5b519f01e3f1617`；`latest.yml` `347` 字节 / `d21ed265e377ae8db48787f32be35d09bb2bac01d425258712f0db92ad0b9a92`；SHA256 清单 `270` 字节 / `9cf2ffa3b168326e0424e7b47fdca50b28b3e26c791bd2662cbbd610f2d3caae`。

## v1.4.3 Wallpaper Engine 壁纸背景

- 日期：2026-08-13
- 涉及文件：`desktop/wallpaper-engine-library.js`、`desktop/wallpaper-engine-runtime.js`、`desktop/wallpaper-engine-bridge.js`、`desktop/main.js`、`desktop/preload.js`、`public/wallpaper-engine.js`、`public/wallpaper-engine.css`、`public/index.html`、`tests/wallpaper-engine-library.test.js`
- 关键边界：不改现有玻璃 SVG 质感、电影视觉、3D 歌单架交互和桌面歌词；WE 启用时只隐藏自定义背景/封面背景，不重写粒子或歌词舞台。
- Scene 走本机 Wallpaper Engine 原生引擎 + DWM 缩略图；Video/图片走 `mineradio-wallpaper` 协议直读项目文件，不复制大型素材。
- 不要把 Wallpaper Engine 入口做成一次性渲染全部项目卡片；列表继续按批次渲染并懒加载预览。

## v1.4.2 M4A 播放与元数据修复

- 2026-08-12，合并远端 `v1.4.1` 基线后发布准备；涉及 `desktop/main.js`、`public/app.js`、`public/index.html`、`server.js`、`package.json`、`package-lock.json`、M4A 回归测试和发布文档。
- M4A 按 MP4 atom 读取 `moov/udta/meta/ilst`，修复标准 `data` atom 值从第 8 字节开始的偏移；支持 UTF-8/UTF-16 标签、`trkn`、JPEG/PNG `covr` 和后置 `moov`。
- M4A 后台轻量扫描只读 atom 目录与目标范围，不读 `mdat`；轻量范围未覆盖文件尾时保留前台完整重试。标签缓存 schema 升为 `2`，旧错误缓存强制重新解析。
- 合并保留远端 Electron `43.4.0`、WAV/OGG、本地搜索、特别喜欢歌单和空曲库恢复修复；文件夹音频过滤器统一覆盖 MP3/FLAC/WAV/OGG/M4A。
- 全量 Node 回归 `266/266` 通过；`public/app.js`、`server.js`、`desktop/main.js`、`desktop/overlay-preload.js` 语法检查和 `git diff --check` 通过。
- Windows x64 NSIS：安装器 `101394836` 字节 / SHA256 `0db344d41221beda912e29de4bd20ec4b6fb6e5e7e167c5a344bef674fff6651`；blockmap `105865` 字节 / SHA256 `041aa61e579ad981de6d5f2dfda7ec4fab9f71ad22d6c0d050965f6f0deb3d11`；`latest.yml` `347` 字节 / SHA256 `491786b9f04e6b8e53d3d901d51fbc77a3db28fd9b40c2ce86d23698047e326f`。
- `latest.yml` 的 Setup SHA512：`IPTyVH4I6OeHhKHh5GOHgGPe+XBqlQ4VyyA6mOhVOvjlWj1KTyG2eLSFEbWvvhY5089ng48D9DySt1/jwXKRNQ==`。
- GitHub Release：`https://github.com/oirge/Mineradio/releases/tag/v1.4.2` 已标记为正式 Latest；四个远端资产重新下载后的大小与 SHA256 均和本地产物一致。安装器 `101394836` 字节 / `0db344d41221beda912e29de4bd20ec4b6fb6e5e7e167c5a344bef674fff6651`；blockmap `105865` 字节 / `041aa61e579ad981de6d5f2dfda7ec4fab9f71ad22d6c0d050965f6f0deb3d11`；`latest.yml` `347` 字节 / `491786b9f04e6b8e53d3d901d51fbc77a3db28fd9b40c2ce86d23698047e326f`；SHA256 清单 `273` 字节 / `3e3e1a6dd13aa3e291c2e76790c1597be0b22208991995c9225fd0dbe97f6c43`。
- `.github/workflows/release.yml` 已移除 `release.published` 自动触发，仅保留手动触发，避免 GitHub Actions 自动重建并用 `--clobber` 覆盖手工验证过的 Release 资产；修复已推送到 `origin/main` 的 `442c87c`。

## v1.3.13 本地曲库空状态与播放来源恢复稳定性

- 2026-08-12，涉及 `public/app.js`、`tests/special-liked-playlist.test.js`、`CHANGELOG.md`、`RELEASE.md`、`package.json`、`package-lock.json` 和本文件。
- 修复本地曲库扫描为空时旧曲库快照、索引、队列、当前歌曲、歌词、封面和播放会话继续恢复的问题；曲库初始化完成前不清理特别喜欢引用，完成后自动移除失效引用。
- 播放来源队列改为严格顺序校验，普通 / 喜欢切换保留当前进度，并避免来源混排；新增回归后全量 Node 测试 `262/262` 通过，关键 JavaScript 语法检查和 `git diff --check` 通过。
- Windows x64 NSIS 产物：`Mineradio-1.3.13-Setup.exe` 103346750 字节 / SHA256 `3f29b162094f9465cbde9eaad1b6aa15301735a954e48fbb886a23eddaa61256`；blockmap 110115 字节 / SHA256 `71d7dc42e5b8fde75102aaaf600ddce615ce8cb6648e66927fe38714d8153c7d`；`latest.yml` 350 字节 / SHA256 `f79f1db461a523578dfc47881098f656f21946de5e2014e1e27bfa6e69677617`；SHA256 清单不含 Portable ZIP。

## v1.3.11 主播放栏歌单切换按钮

- 主播放控制栏新增“普通 / 喜欢”双态按钮；切换后立即按目标来源重建队列并从第一首开始播放，“特别喜欢”为空时保留当前队列并提示。
- 歌单面板浏览状态与实际播放来源独立，查看“特别喜欢”不会误改控制栏播放状态；喜欢态 hover 仍保持粉色反馈。
- 2026-08-10，涉及 `AGENTS.md`、`CHANGELOG.md`、`RELEASE.md`、`package.json`、`package-lock.json`、`public/app.js`、`public/app.css`、`public/index.html` 和 `tests/special-liked-playlist.test.js`；全量 Node 回归 `257/257`、关键 JavaScript 语法检查和 `git diff --check` 通过。
- Windows x64 NSIS：安装器 `103345079` 字节 / SHA256 `31115F258B651281FC5D7057B3C7B8F865F748FA15B30D7B0DC35DB4E876B6D4`；blockmap `110091` 字节 / SHA256 `1BBDFC3EE593814BC050A40A46A141DFC8E8A7D0CAF32A6B7022927421409EB2`；`latest.yml` `350` 字节 / SHA256 `0E3C55ABBB2AA9A7B0B31B338A2F6035E1A3CEB8B06E1BDF1BA8EBE76488F375`；SHA256 清单 `272` 字节 / SHA256 `812AB2BC782AC0F0273DB06FA199FF13F0E79B903D14396B944FB1EA53569222`。
- `latest.yml` 的 Setup SHA512：`BqjdfI8LxlaJ47uU0euyibyqveMjN5Xlf7LF0cQcZ4EIo58Akukg4nVn8KXA0FiPv8ZTWapPXO2CITBSmWhxfw==`。
- GitHub Release：`https://github.com/oirge/Mineradio/releases/tag/v1.3.11` 已标记 Latest；源码提交 `4e8863db3496e5352c3a568e1d65c687fe802151`，annotated tag 对象 `728ea41bd9f4ab5531b0bde9bace77955abb28e5`，`main` Verify run `31369515624` 成功；远端四个资产下载回读后的大小与 SHA256 均和本地一致。

## v1.3.10 搜索排序与特别喜欢歌单

- 本地搜索仅匹配歌名、歌手和音频文件名，匹配与排序优先级为歌名、歌手、文件名；专辑名不再参与搜索。
- “特别喜欢”使用 `mineradio-special-liked-playlist-v1` 保存轻量歌曲引用，优先按 `localKey`、回退按本地路径恢复，不持久化完整歌曲、封面、歌词、File 或 Promise。
- 搜索结果、播放队列、本地曲库和主播放控制栏可添加或移除歌曲；选择歌单后点击歌曲或“播放全部”会把播放队列限制为该歌单内容。
- 本地模式恢复“歌单”标签、歌单面板和红心入口，并修复特别喜欢播放按钮被内联事件拦截的问题；重新导入曲库时返回全部音乐视图。
- 2026-08-10，涉及 `public/app.js`、`public/app.css`、`public/index.html`、`tests/local-search-cache.test.js`、`tests/special-liked-playlist.test.js`、版本与发布文档；全量 Node 回归 `256/256`、四个关键 JavaScript 语法检查和 `git diff --check` 通过。
- Windows x64 NSIS：安装器 `103345037` 字节 / SHA256 `F767367E9687054F4F144A969F000A4A1CEFAB5CFF68640879A7EEA6DCE69AEA`；blockmap `110396` 字节 / SHA256 `D90D0AC1442E791B0A890C776A7E46B65F12D723CA774347B871A1BDFE83CE60`；`latest.yml` `350` 字节 / SHA256 `F4D9BAA8B16FAA167A4774D098B226046B3181B82EEC5E503BB783140E4E31AA`；SHA256 清单 `272` 字节 / SHA256 `DE344DE18C78B4EC80E8C89031D705B017BA5E558273DF69FD1886F4BC5D5787`。
- GitHub Release：`https://github.com/oirge/Mineradio/releases/tag/v1.3.10` 已标记 Latest；`main` 提交 `8be60c5b3834b51bfc747690430358bcf43c6bc9`，annotated tag 对象 `ca6164b3bf90bd8bc7c423aac3354ddd46890613`；Verify run `31366148876` 成功，远端四个资产大小与 SHA256 均和本地一致。

## v1.3.9 主渲染缓存回收与帧调度热路径优化

- `sampleRenderPerf()` 只在一秒级采样边界调用 `maybeTrimRuntimeCaches(now)`，活动态、后台和深后台回收门槛不变，避免稳定渲染帧重复读取后台状态与时间间隔。
- `animate()` 复用本帧唯一的 `performance.now()` 与自适应目标 FPS，并传给调度和跳帧判断；事件入口仍可省略参数并回退到原有状态读取。
- 涉及文件：`public/app.js`、`tests/render-scheduler-hot-path.test.js`、`tests/runtime-resource-release.test.js`、`CHANGELOG.md`、`RELEASE.md`、`.context/architecture/mineradio-player-performance-seams.md`、`AGENTS.md`；2026-08-09 全量 Node 回归 `250/250` 通过，四个关键 JavaScript 文件语法检查和 `git diff --check` 通过。
- Windows x64 NSIS：安装器 `103342529` 字节 / SHA256 `8ED04BCB4F0590D74E40A92B09C8F3046C1B4A03259C348F291AA4F7C3059198`；blockmap `110415` 字节 / SHA256 `4D19A18933596ADFA1C9475BC65A4056DE95A6A44303AD8C675A9061F7CEED6B`；`latest.yml` `347` 字节 / SHA256 `AC33E2C59F7557F8111265CCE48693CFEF7F5152D27D7EC8F629E8191526DAA0`；SHA256 清单 `270` 字节。
- `latest.yml` 的 Setup SHA512：`9YHcwTyQ32Unw18bbnAB6P5Rhv+pUONNp52Rggv2QwvhTeJizGrlKsACrpSzUDqwSIji7fBAUIgMW0e/+AQsNw==`；GitHub Release 与远端资产校验待发布后补录。

## v1.3.7 主渲染帧时间戳与歌词歌单状态复用

- 主循环取得的 `performance.now()` 时间戳传给歌单架 hover 提示、Home 空库波形、空闲引导和 `shelfManager.update()`；省略参数时保留原有时钟回退语义。
- `updateStageLyrics3D()` 每帧只读取一次 `shelfManager.getMode()`、`hasOpenContent()` 与 `shelfAlwaysVisible()`，歌单避让、壁纸安全布局和详情偏移共用局部状态；布局、相机、歌词光晕、播放和交互语义保持不变。
- 涉及文件：`public/app.js`、`tests/audio-analysis-hot-path.test.js`、`tests/frame-hot-path.test.js`、`tests/home-wave-hot-path.test.js`、`CHANGELOG.md`、`RELEASE.md`、`.context/architecture/mineradio-player-performance-seams.md`、`AGENTS.md`；2026-08-09 全量 Node 回归 `247/247` 通过，四个关键 JavaScript 文件语法检查和 `git diff --check` 通过。
- Windows x64 NSIS：安装器 `103424395` 字节 / SHA256 `1E90B84AA7C73F33372C1760559CC0E7D1E4B4943156F865F468491EE7D27A9A`；blockmap `110266` 字节 / SHA256 `555EAFDA125DAD424A9C5A05A8CBC5B284A9D7C128ABA8618EA9FA96444D9FFC`；`latest.yml` `347` 字节 / SHA256 `F57EE42E7D02E43B13B1C2CB4535503D850B1708761055D4317D4980295F9784`；SHA256 清单 `270` 字节 / SHA256 `117604E08965651FD7283C893D6D274500D2000AFDCB62C8F8B9F50761B107D5`。
- `latest.yml` 的 Setup SHA512：`ddJSeGhFY9oR/NPz9j8aq49itWT4upH3nk3GQ0Yxh05nGlDC9s5OkhNl6PF0YpNOnNjDTvmbKRhxwMt1rf18qQ==`。
- GitHub Release：`https://github.com/oirge/Mineradio/releases/tag/v1.3.7` 已标记 Latest；`main` 提交 `b677f6159c5d65bcde84b7a862fe60afce03f600`，annotated tag 对象 `a67c4ce6a27b7e27a02f3ebd7b1013513d2162d6`；远端四个资产大小与 SHA256 均和本地一致。

## v1.3.6 3D 歌单详情绘制快路径复用

- 详情页 `syncRenderedRows(force, frameShelfLook)` 在一次同步中只读取一次 `shelfSettings()`，并把同一帧外观快照传给 `drawPanelIfNeeded()`、`drawPanel()` 和所有 `drawRow()` 调用。
- 面板和详情行绘制复用快照中的 `bgOpacity` 与 `accent`，中心行切换、加载动画和主题刷新不得在同一同步帧内重新读取或解析歌单架外观。
- 异步封面回调等非帧入口可以省略快照并回退读取；帧级快照只允许当前同步调用立即消费，不得跨帧保存或修改。
- 新增/扩展 `tests/frame-hot-path.test.js` 与 `tests/content-list-rendering-hot-path.test.js` 断言；2026-08-09，涉及 `public/app.js`、测试、性能架构记忆和 `AGENTS.md`。
- 本地 Windows x64 NSIS 已构建：安装器 `103424549` 字节 / SHA256 `4ED229AAC3B84FBDEC0E718D758CE6D827555EBE57364380ED9CD83C90D1B3B3`；blockmap `110427` 字节 / SHA256 `EE81E37985159BE9A47B75498C65CA2ACEB2FE2F779F45F4EB80F3F45A14CC66`；`latest.yml` `347` 字节 / SHA256 `341C54F5BC5284AD4E10A932ACEE155C78C3FEDFAB317419E831BABD71ED851B`。
- GitHub Release：`https://github.com/oirge/Mineradio/releases/tag/v1.3.6` 已标记 Latest；`main` 提交 `2482ab84d8164d1e0930d55dd6ad3b3c563218a4`，annotated tag 对象 `f963238be92012e6a152b637abfcc38bacc477f0`；远端四个资产大小与本地一致。

## v1.3.5 3D 歌单详情属性低写入优化

- 详情可见行的位置、缩放、旋转、可见性、渲染顺序和透明度，以及详情组位置/缩放/普通欧拉姿态和面板透明度使用稳定值缓存；相同目标值跳过 Three.js setter，动画目标公式保持不变。
- 相机四元数姿态分支会使详情组欧拉缓存失效，切回普通姿态时重新提交目标值；不改变布局、动画、播放、交互或视觉语义。
- 新增 `tests/frame-hot-path.test.js` 详情行和详情组属性缓存回归测试；全量 Node 回归 `245/245` 通过。
- 2026-08-09，涉及 `public/app.js`、`tests/frame-hot-path.test.js`、`.context/architecture/mineradio-player-performance-seams.md`、`AGENTS.md`。
- Windows x64 NSIS：安装器 `103424049` 字节，SHA256 `A9B2692AEF19B32CD73F6C01A8FCB1CC6F86E5FAE21BB95B1EA53F177330D835`；blockmap `110328` 字节，SHA256 `C76E185C1B79631527DF0409BF94A1DF8C179368E23FABC1CF86E3B0C01CDE20`；`latest.yml` SHA256 `5C5F58B7AF3E1F56638F98F12CC6202EDA420FDA467534AFD62A67BDE9D7A397`。
- GitHub Release：`https://github.com/oirge/Mineradio/releases/tag/v1.3.5` 已标记 Latest；`main` 提交 `e4d9248df94c53b2245e87fbc17d148cb3781bbb`，annotated tag 对象 `1822e1f51b3329cdf31f8b7a693c47bb151841c2`；Verify run `31314090176`、`31314089225` 成功。

## v1.3.4 3D 歌单架卡片属性低写入优化

- `placeCard()` 对位置、缩放、旋转、相机四元数姿态、可见性、渲染顺序、材质颜色和透明度使用卡片级稳定值缓存；目标值不变时跳过 Three.js setter，动画和透明度目标仍按原公式计算。
- 普通姿态切换时未显式传入 `z` 会保留当前 `rotation.z`，确保 Skull 相机四元数姿态切回时不改变已有滚转。
- 新增 `tests/frame-hot-path.test.js` 卡片属性写入缓存回归测试；不改变 UI、视觉、播放、歌词、桌面覆盖层或用户设置。
- 2026-08-09，涉及 `public/app.js`、`tests/frame-hot-path.test.js`、`.context/architecture/mineradio-player-performance-seams.md`。
- 全量 Node 回归 `243/243` 通过；安装器 `103341011` 字节 / SHA256 `D850FAADCCC7622224BAE1F992F0C167EEB924980770DABDB9B4EA60BD877B0C`；blockmap `110354` 字节 / SHA256 `F3C333AF42B69E4AC1AEFE8C8AE5077FCC1C6D3D907AD52867F22504032C4EFA`；`latest.yml` `347` 字节 / SHA256 `8B1A212FC671E6325167717A7AF787911AFD56F8E6971D1C1C41BAEC9B7A48C1`。
- `latest.yml` 的 Setup SHA512：`f9sdiF/SyMUpWnzGSWrXqDooniuXbYhs4ns+cjzeIzUHLyz7hrCiS+XQQM5l0AlIZvL0E3t5NUYgaL8IMEdVlw==`。
- GitHub Release `https://github.com/oirge/Mineradio/releases/tag/v1.3.4` 已标记 Latest；tag 指向提交 `1f8304672e9cdc44c595f9237b3e9dd1bd859b75`，`main` Verify run `31311580320` 成功；远端资产大小与 SHA256 校验一致。

## v1.3.3 相机与交互热路径低分配优化

- 普通相机缓存位置、观察点和节拍滚转；稳定帧跳过重复 `position.set()`、`lookAt()` 与滚转重建。自由镜头、Skull 覆盖相机和直接重置姿态的入口会显式失效缓存。
- `tickShelfHoverCue()` 复用 `shelfHoverPointerScratch`；`updateRipples()` 用 3×3 九宫格整数位掩码去重，不在热路径创建临时指针对象或去重对象。
- 新增 `tests/camera-pose-hot-path.test.js` 与 `tests/ripple-hot-path.test.js`；不改变 UI、视觉、播放、歌词、桌面覆盖层或用户设置。
- 2026-08-09，涉及 `public/app.js`、`tests/camera-pose-hot-path.test.js`、`tests/ripple-hot-path.test.js`。
- 全量 Node 回归 `242/242`；安装器 `103339186` 字节 / SHA256 `6683a8ac07fa2df8bb07b142850480490d9f6d7543267fa1627c94aec044eda9`；blockmap `110304` 字节 / SHA256 `cc90ceb7bf47df24cad01b7fbc1187fbb682f98d9e8e9822af7f4785f528970e`；`latest.yml` `347` 字节 / SHA256 `2a3bd7d21e5d7f0c6c0cf3459831667f0046fa214ead8087efb079862e2b31eb`；SHA256 清单 `270` 字节 / SHA256 `bb53464e05bf601279368afc47aa6b4b763a4320e107c81dde88d3e20fca576f`。
- GitHub Release `https://github.com/oirge/Mineradio/releases/tag/v1.3.3` 已标记 Latest；annotated tag 解引用到提交 `30d41a141c98e81da7c438ef4efb4a49516502ac`，远端资产大小与 SHA256 校验一致；`codex/release-v1.2.87` Verify run `31308926719`、`main` Verify run `31309010672` 成功。

## v1.3.2 主渲染器与壁纸覆盖层低占用优化

- 可见空闲态的主渲染器按 30 FPS 定时唤醒，播放或交互开始时立即切回 RAF，避免高刷新率屏幕上的无效 RAF 回调。
- 壁纸覆盖层播放时使用 RAF，未播放限为 30 FPS，关闭时使用 1 秒低频调度，并释放封面图引用和粒子数组。
- 状态切换与可见性恢复会取消旧调度句柄，避免 RAF 和定时器并存。
- 新增 `tests/render-scheduler-hot-path.test.js`，扩展 `tests/runtime-resource-release.test.js`；不改变 UI、视觉、播放、歌词或桌面覆盖层交互语义。
- 全量 Node 回归 `239/239` 通过；安装器 `103340590` 字节 / SHA256 `23a91ceb5496e6f9c990fa7c480a6ed56ab5305b26177cdcd017d21c5b2d9114`；blockmap `110189` 字节 / SHA256 `c24ce02afc9bb275ef8a26fb105941bade65aa596215765e9af01e719aabde62`；`latest.yml` `347` 字节 / SHA256 `dd15632d9cdb6f9b8f47f506baa318693ae3095ce307da96c3dbb5153c4490a0`。
- GitHub Release `https://github.com/oirge/Mineradio/releases/tag/v1.3.2` 已标记 Latest；tag 解引用到提交 `724fccd09f7ebc16aed8fe5ff25ebff61ff932a0`，远端四个资产大小与 SHA256 均和本地一致；`main` Verify run `31307404604`、`31307369129` 成功。


- `v1.3.0`（2026-08-08）按用户指定重做随机播放：进入随机模式时对整个队列执行一次 Fisher-Yates 洗牌，之后上一首/下一首只沿固定乱序前后循环，不再逐次随机。洗牌按当前歌曲对象重新定位 `currentIdx`，保持声音、进度和歌曲不跳；随机会话恢复及随机模式新队列首次播放前也只洗牌一次。使用 `WeakSet` 保存队列弱身份，移除 v1.2.100 的 96 条历史 ID/key 和歌曲 WeakMap，旧队列可正常回收。全量 Node 回归 `224/224` 通过；安装器 `103336921` 字节 / SHA256 `840753c5fc4647389907f8b15ac0463bb0ea1e095db5d92c8460a1caecf1a2d3`；blockmap `110180` 字节 / `3fa5ef65c5519b91a62bf624cbe40df97accaf794f91accb15fbc24f1b38122b`；`latest.yml` `347` 字节 / `248ad71583c4819a03fc63599aa16a8d7962b128f8e31a8b832391f0dea4ebc8`。GitHub Release 已标记 Latest，tag 指向 `b9be5a1e45298904f4301157300dca5de410d3c5`，远端四资产校验一致，`main` CI run `31250009229` 成功。

- `v1.2.100`（2026-08-08）修复随机播放“上一首”错误：旧逻辑在随机下一首后只做队列索引减一，无法返回真实上一曲；现在成功播放后提交最多 96 条轻量导航历史，上一首沿历史后退，后退后的下一首先沿历史前进，历史末尾再生成排除当前曲目的随机目标。历史只保存数字 ID 和歌曲键，对象身份使用 `WeakMap`，不强引用歌词、封面或完整歌曲对象，清空队列同步释放。主界面、方向键、系统 Media Session、迷你播放器和桌面歌词共用同一入口。全量 Node 回归 `224/224` 通过；安装器 `103337026` 字节 / SHA256 `e9032c3989b89fc39033a7d25077f560a06f66836bf15a81f306e3891c9c0c83`；blockmap `110384` 字节 / `8ee6bc6def143b1d0c66634593d862970ebdc9cf69cf96605051464dccf3c29e`；`latest.yml` `353` 字节 / `a16d604b422c6099455886d1db2e184a5a934ae98e6095933d337783a6099098`。GitHub Release 已标记 Latest，tag 指向 `e47539352806bb1af4e5f13494d9604ece563c60`，远端四资产校验一致，`main` CI run `31249331807` 成功。

- `v1.2.99`（2026-08-08）继续降低更新界面后台占用：无更新时不再启动更新入口两条 GSAP 无限呼吸动画，窗口最小化/隐藏/深后台时释放 tween 和延迟 timer；下载面板打开保持 320–360ms 状态刷新，关闭降到 1.5 秒，深后台降到 5 秒，重新打开立即刷新，服务端下载任务不暂停；预览进度在面板关闭或后台时取消。新增/扩展更新生命周期测试，全量 Node 回归 `218/218` 通过；未启动 Mineradio GUI。安装器 `103336027` 字节 / SHA256 `e3207c1f82f995a47d2cd786848ba705c453ea6cf7e1db4fd58410e2e2279b1f`；blockmap `110284` 字节 / `64fb90cd5e7255da964ca1b10077be1b290803420c8491f789ff681feb17c56c`；`latest.yml` `350` 字节 / `7463ddabfafec811c7ccaf9b3637994c71cad96ea3cc68cede098db5f46dc359`。GitHub Release 已标记 Latest，tag 指向 `c3a5bb9ed38653983fc75c6f19d851fefe7f0fc4`，远端四个资产校验一致，`main` CI run `31246505555` 成功。

- `v1.2.94`（2026-08-07）完成桌面歌词调节控件重排：字号和光效改为两组独立设置胶囊，保留步进、锁定、播放控制、关闭和位置持久化语义；全量 Node 回归 `204/204` 通过。安装器 `103333819` 字节 / SHA256 `9118b7b01ca145fa87a3276efe556768c0368292d0c62497e1201f0bf575f331`；blockmap `110223` 字节 / `5c85a0eae90c28c56ac0b4e9ae446aab0b2a1e1f1870a9c8ffcd060b74587d7d`；`latest.yml` `350` 字节 / `51164bba294675bbd0ff519665c70a3e1ea5dbf6664cf1343f9148cc1a2ceed4`；本地 Portable ZIP `144918530` 字节 / `6bf136c29beeb27631de3a82f6fa0933c652a7cb68dc1781e526d3996af48132`。GitHub Release `v1.2.94` 已标记 Latest，远端四个资产回读一致，`main` CI run `31152609456` 成功，源码提交 `8917c2b`。

- `v1.2.91` 重发版（2026-08-05）修复桌面歌词手动位置重启恢复：现场运行版 BrowserWindow 为 `x=323, y=-171, width=1382, height=410`，但旧保存链路复用完整屏幕夹紧后把设置写成 `y=0`。现在保存、恢复和重新定位手动 bounds 时，当前显示器仍保留至少 `160 × 96` 可操作区域就保留真实负坐标；完全不可达或显示器变化时才安全拉回屏幕。保留纵向位置偏好清理旧 bounds 的修复，新增真实负坐标落盘和回退回归，全量 Node 回归 `202/202` 通过。安装器 `103334349` 字节 / SHA256 `61bc45e9b966acf426f0fabdcab201f1bc0893a61c8f7a85d068344d5ce62d9d`；blockmap `110394` 字节 / `4d1a008ee6c301d7e3e5ce747fa39bb79209e269c8a645b1feafc1a5d1ad68f9`；`latest.yml` `350` 字节 / `a1f989ac17bbe839157a94d8423b63cd99ca7b5a85f802a0bee816bc787a41ed`；本地 Portable ZIP `144917458` 字节 / `8bc8a341f5c6cc134862fdb9bfb9328dd6ca637d219f1c451fa45d8c2e1f6ff8`。打包后的 `app.asar` 已确认包含 `desktopLyricsBoundsHasReachableArea()` 与手动 bounds 的 `allowPartial` 保存/恢复路径。
- `v1.2.91` 已按同版本完成覆盖重发：Release `https://github.com/oirge/Mineradio/releases/tag/v1.2.91` 继续标记 Latest，annotated tag 解引用到源码提交 `4294b856f7239d54c89c79adc88a6ae0b37fce77`，`main` CI run `30994715092` 成功；四个远端资产重新下载后的文件大小与 SHA256 均和本地重发产物一致，Release 正文无 replacement character。旧 `1.2.91` 客户端需手动覆盖安装。
- `v1.2.90`（2026-08-05）修复更新介绍提取链路：GitHub Release 和自定义 manifest 不再把“修复内容 / 验证 / 下载”等章节标题当摘要，验证、下载、安装与校验段落不再混入更新条目；统一清理 Markdown 链接、图片、重复项和 SHA 摘要，并恢复 UTF-8 BOM 与常见 Latin-1 乱码。真实 `/api/update/latest` 已确认摘要取首条修复内容；新增 `tests/update-release-notes.test.js`，全量 Node 回归 `200/200` 通过。安装器 `103332320` 字节 / SHA256 `761fae6bb44d05e1b363b21500dac24b7fd297df88071cfe454f6646b5fd02fc`；blockmap `110211` 字节 / `3eebf96f1ff581faae08dcee59bba3f125cebb74dae073a759e49c8a45b72f86`；`latest.yml` `350` 字节 / `d3b66834134a6c8e3575d96bd03a6b30025cdd658bd06fbf39b79892635412e5`；本地 Portable ZIP `144917024` 字节 / `0fe0cac83b0fa80ab9cd93bbfeabd5beb4dff1347d8757fd0dda315e87f937e1`。打包后的 `app.asar` 已确认包含版本 `1.2.90`、章节过滤、乱码恢复与 manifest 共用归一化链路。
- `v1.2.90` 已完成 GitHub 正式发布：Release `https://github.com/oirge/Mineradio/releases/tag/v1.2.90` 已标记 Latest，annotated tag 解引用到源码提交 `c38a46ea1284bb5075652eb332889cd12cea17e1`，`main` CI run `30972509285` 成功；远端仅保留四个自动更新资产，重新下载后的文件大小与 SHA256 均和本地一致，Release 正文无 replacement character。GitHub Issue `#11` 已回填修复说明并关闭。
- `v1.2.89`（2026-08-05）修复桌面歌词重启持久化：软件退出、主窗口销毁和更新重启只拆卸覆盖层，不再向主 renderer 反写关闭偏好；用户主动关闭仍保存为关闭。拖动、窗口关闭和立即重启前强制保存最终 bounds 与视觉配置，避免程序定位保护或 `app.exit()` 吞掉最后状态。新增 `tests/desktop-lyrics-persistence.test.js`，全量 Node 回归 `196/196` 通过；UI、布局、歌词样式、播放时钟和桌面歌词交互保持不变。安装器 `103333863` 字节 / SHA256 `031958f60adc4bab756f39f19df6a5186deb320bd9926ced834f67699e9de67a`；blockmap `110281` 字节 / `cddcccb4d10f947608dde514475a3de7e419e3a3cb6f1537dbf1230908589c88`；`latest.yml` `350` 字节 / `4adf2244632814142a82c40a35240c77b765e80c0bdf6265d488147fb4dc2a5d`；本地 Portable ZIP `144916275` 字节 / `8881e2ee5990d526a604e6fe3e87dc6aca1ea65e3cb72be47d30508ad39ca88d`。打包后的 `app.asar` 已确认包含版本 `1.2.89`、退出不反写关闭、最终 bounds 强制保存和更新重启前状态 flush。
- `v1.2.89` 已完成 GitHub 正式发布：Release `https://github.com/oirge/Mineradio/releases/tag/v1.2.89` 已标记 Latest，annotated tag 解引用到源码提交 `dfd93143a7c8e47ddc9fca3b8b141533de332eb8`，`main` CI run `30968545148` 成功；远端仅保留四个自动更新资产，重新下载后的文件大小与 SHA256 均和本地一致。
- `v1.2.88`（2026-08-04）继续优化 Home 空库波形刷新：24 个频谱柱对应的频谱桶索引只在频谱长度变化时计算，刷新帧不再重复执行幂运算和边界计算；频谱取样顺序、刷新间隔、平滑、柱高、透明度和节拍驱动保持不变。新增 `tests/home-wave-hot-path.test.js`，全量 Node 回归 `194/194` 通过；安装器 `103331885` 字节 / SHA256 `107d6731c11bd504c5dfd48c9bb186f48eda41d484e27bea638df093be8b3ae8`；blockmap `110197` 字节 / `899cff581d698256b198d872aa1911608bf4f36366384f624b3cc363a316656d`；`latest.yml` `350` 字节 / `a7553b3974490c4fa3ef41fa17d42af73b152be98c23fb23bab55dd407c5d37d`；本地 Portable ZIP `144916097` 字节 / `a2790f1a5a74c26e917c249fd9391f82499ee909cc59274f9c9df5a7f8624ab8`。安装包 `app.asar` 已反查确认 `APP_VERSION=1.2.88`、Home 波形缓存、桌面歌词物理几何/帧率/文本缓存和迷你播放器位置恢复均在包内。
- `v1.2.88` 已完成 GitHub 正式发布：Release 标记 Latest，远端仅保留四个自动更新资产，GitHub API 返回的 Setup、blockmap、`latest.yml` SHA256 与本地一致；`main` CI run `30875753697` 成功。
- `v1.2.87`（2026-08-04）继续优化桌面歌词 30/60 FPS 热路径：相同“原始文本 + 单/双行模式”复用归一化结果；光效画布将 Unicode 字形数组与字宽一起缓存，描边和填充复用同一份字形，不再每帧 `Array.from()`。新增热路径回归、全部发布页面内联脚本完整解析门禁，并让 GitHub Actions 直接检查 `public/app.js`。歌词文本、位置、颜色、光效、播放时钟、鼠标穿透和顶部自动避让语义保持不变；全量 Node 回归 `193/193` 通过，CI run `30872687807` 成功。GitHub Latest 已正式发布，中文正文 UTF-8 回读正常，四个远端上传资产的大小与 SHA256 均与本地一致。安装器 `103333797` 字节 / SHA256 `91b8dc27601a4c71c9ef7d4b1c6bcee5f8e5fa5ae6183a92fde875782ceee8b8`；blockmap `110198` 字节 / `6ba77e9954e0a5d584af0ffd9040e13b888c995653267234dc3c72bbd2541561`；`latest.yml` `350` 字节 / `8fa7703d64797fddb4d39549251fb21dacb063aea091543589f58ccdfce93413`；本地 Portable ZIP `144915948` 字节 / `91c33495ede6c78dd4aabe0c0b1b61cdbd002cd41b504428d2cdd30aac1d2252`。
- `v1.2.86`（2026-08-04）修复 GitHub 发布链路：将完整源码推进默认 `main`，新增 Windows GitHub Actions CI（安装依赖、全量 Node 测试、语法检查、空白检查），并修正 Release 对 Portable ZIP 远端状态的错误描述。安装器内已复核 `APP_VERSION = 1.2.86` 和桌面歌词物理屏幕裁切修复；全量回归 `190/190` 通过。GitHub Latest 已正式发布，`main` 和 tag 指向同一发布提交，CI 成功。正式远端资产仅上传 Setup.exe、blockmap、`latest.yml` 和 SHA256 清单；Portable ZIP 仅保留本地。安装器 `103331153` 字节 / SHA256 `18971d4a85a2e3f186534205b980e5bb85b2ba28576dce9348dd45ed106eaed1`。
- `v1.2.83`（2026-08-03）更新下载和快速补丁状态轮询改为单飞请求：上一轮未完成时不叠加请求；通过轮询代际和任务 ID 校验拒绝旧任务迟到响应，完成/失败/切换时释放定时器与在途标记。桌面歌词提示顶部空间不足时自动移到歌词下方；手动拖动后的窗口 bounds 在重启后优先恢复，关闭时补存一次。新增更新轮询和桌面歌词布局回归测试，当前全量回归 `180/180` 通过。
- `v1.2.83` 本地资产：安装器 `103329984` 字节 / SHA256 `78e3f30204efc22fabde17805d6013c2346879c9d6b8523d9cb2d4a4598f2eab`；blockmap `110296` 字节 / `aa76ad11a4bae1458a0cf003496687e0e6c94e0adaf3e8a158d3736964b494d2`；`latest.yml` `350` 字节 / `fc5157969533940f17dd6e9bb247b6b9ea08fc45bb78904689b46ac5319a6b8f`；Portable ZIP `144914741` 字节 / `db5f34525aae5a28ef2d8a71b7dc8635c70d389b31fb1fdb6c8906d959949bc7`。本地资产已生成，GitHub Release 待上传。

- `v1.2.82`（2026-08-03）本地服务器静态资源 `200` 响应改用 `fs.createReadStream()` 流式发送，避免先复制完整 HTML/CSS/JS/字体/图标 Buffer；保留 ETag/Last-Modified、`Cache-Control: no-cache` 和 `304` 条件请求语义。新增流式响应回归测试，当前全量回归 `175/175` 通过；不改 UI、布局、玻璃质感、电影视觉、播放控制和交互语义。
- `v1.2.82` 本地资产：安装器 `103329187` 字节 / SHA256 `f2d07ed3c1e7413e6517f4f2e3c31a50b051970cb4bb4f8bbc9564211f5d71ed`；blockmap `110449` 字节 / `ad20226f20e129d2b4316f9eded3bbeeb746a2158f4a37b3d713d681bbf103a2`；`latest.yml` `350` 字节 / `ae91bffeb0be8baef0dd78ab719874ffdbb67afcbc26465709563dd169669296`；Portable ZIP `144914189` 字节 / `8e1da8e90e78c3df05cee82697505604678e639c2f8322ec1c10051ef35843b1`。GitHub Release 已发布为 Latest，远端 5 个资产大小与 SHA-256 已核对一致。

- `v1.2.81`（2026-08-03）本地静态资源服务增加 ETag/Last-Modified 条件缓存，重复启动对 HTML、CSS、JS、字体和图标返回 304，使用 `Cache-Control: no-cache` 保证更新后立即重新校验；新增真实 HTTP 200/304 回归测试，不改 UI、布局、玻璃质感、电影视觉、播放控制和交互语义。
- `v1.2.81` 本地资产：安装器 `103328676` 字节 / SHA256 `4f1e96791494cd4a1f0efd2eafa1cff9ec131039707c96b6ca97c0070e090449`；blockmap `110244` 字节 / `5612cbf828697b5297ec79743b199009c8e23b0dfc61139a7a40f15bce64cad4`；`latest.yml` `350` 字节 / `b7d623d1b06645e043786bd4035b268d53ac74939a39749dfc0ce7a5235caac1`；Portable ZIP `144914153` 字节 / `c935f85b7ee33d897f6380a533f9e74b8926ac73c7aa1c8760062063695dd6ff`。GitHub Release 已发布为 Latest，远端 5 个资产大小与 SHA-256 已核对一致。

- `v1.2.80`（2026-08-03）收窄 `asarUnpack` 到 `server.js` 与 `package.json`，将 `public`、`build` 和桌面脚本归档回 `app.asar`；主进程与本地服务器拆分可写运行根和静态资源根，兼容 `v1.2.79` 的旧解包布局。实际 Electron 隔离启动验证首页、`app.js`、`app.css`、字体和图标均返回 200；本轮不改 UI、布局、玻璃质感、电影视觉、播放控制和交互语义。

- `v1.2.76`（2026-08-02）继续优化 3D 歌单架卡片帧热路径：`shelfManager.update()` 将本帧 `frameShelfLook` 传给卡片绘制，卡片签名、DOF 重绘、中心状态重绘和周期重绘复用同一份外观快照，避免重复归一化设置与解析强调色。非帧入口保留回退读取；卡片颜色、透明度、布局、UI、视觉质感和交互语义保持不变。新增 `tests/frame-hot-path.test.js` 卡片绘制快照复用断言。
- `v1.2.76` 本地资产：安装器 `104760392` 字节 / SHA256 `6dbd1deca240f7b0b7eba146ad48562843ca7daa144bf798c26e473df4fd0fe1`；blockmap `111887` 字节 / `a41f2d343411d57c2eb2aae6195e0d6b86ae5c2cdc2133c6b2528490bfc79086`；`latest.yml` `350` 字节 / `1914d101561618b5b56823e8cfde6af893e7f2a084ab9ac907361915c8d7e2be`；快速补丁 `2311400` 字节 / `e22bef36c63559e1a1c6871555a60945f98ec75f58153b19242e1f1a04a3d3ba`；Portable ZIP `146496579` 字节 / `1b5b8d90d43f0b94b394ae3061461037c0f81ef9337d4fcc8f71c5d80177c990`。本地资产已生成，GitHub Release 待上传。

- `v1.2.75`（2026-08-02）继续优化音频分析帧热路径：频谱四段先累加整数采样值再统一乘归一化因子，时域 RMS 复用 256 项 `Float64Array` 平方查找表，避免每个分析帧对约 2048 个采样重复做减法、除法和乘法。频段边界、RMS、节拍判断、视觉响应、UI、布局、播放控制和交互语义保持不变。新增 `tests/audio-analysis-hot-path.test.js` 旧算法数值等价断言。
- `v1.2.75` 本地资产：安装器 `104760018` 字节 / SHA256 `0ae19211860e9401dfff7b7f065bc134196d741e47bf32aaeff23bf0dbb9b4bf`；blockmap `111991` 字节 / `36c7074677f18e5f21aea1eb058bd323249176585d2ea5261967d48533a4cc1c`；`latest.yml` `350` 字节 / `35050b1a26dfcbec30af4e5548a7a1c57988125779bc5aea192836de0d9319c7`；快速补丁 `2309504` 字节 / `77c84eb36dcb34ccdc9259acdc42b4c777bda1fd424584948578effe1c41e246`；Portable ZIP `146496136` 字节 / `5a03824c4e7f9e13983c04243275b19577460586fd6e8de39646bc4a74f0bfe8`。Release 已发布为 Latest，远端 6 个资产大小与 SHA-256 已核对一致。

- `v1.2.74`（2026-08-02）继续优化 3D 歌单详情帧热路径：`shelfManager.update()` 将本帧已经计算的 `frameLayout` 与 `frameShelfLook` 传给详情列表；详情 `update()` 仅在独立调用且未传入快照时回退读取，面板透明度和可见行定位复用同一快照。布局、透明度、滚动、UI、视觉质感和交互语义保持不变。新增 `tests/frame-hot-path.test.js` 详情快照复用断言。
- `v1.2.74` 本地资产：安装器 `104759961` 字节 / SHA256 `3c11d15719378bb5cc107b09f018abe80cd2f4af3eb7b6d3eb38b2e60a4f052e`；blockmap `112032` 字节 / `cf9d6855bb557edceb145deb88ce7bf4ee399fd26bf3caba73a069a2db9fa076`；`latest.yml` `350` 字节 / `1fd89047de91fe8e6fa98c0fd0ee6e4ba6491fa0ec1e96aec32afeedf94252a2`；快速补丁 `2308740` 字节 / `eef06d17cab0fd856a9c2f45644ec10b0d4ad7ad59fa616d6c4cfd4fa6f596c10`；Portable ZIP `146495871` 字节 / `76a08fbf4d6d3dbbd5d9f2be7a3941df704867f09c05142c3f290c52b93a40a2`。Release 资产共 6 个，远端大小与 SHA-256 已核对一致。

- `v1.2.73`（2026-08-02）继续优化 3D 歌单架播放帧：`shelfManager.update()` 先生成一次 `shelfSettings()` 快照，再传给 `shelfLayoutProfile()`，避免同一帧重复归一化设置和解析颜色；歌单架布局、UI、视觉质感和交互语义保持不变。新增 `tests/frame-hot-path.test.js` 设置快照复用断言。
- `v1.2.73` 本地资产：安装器 `104759712` 字节 / SHA256 `55b6451d13fb2a1fcd88d3fbe29ddaed4344471c9d346f17787e65b7ccc4a988`；blockmap `111857` 字节 / `0af5ce2f548968021323961dd18bf9ee029404355646fcc59a4040747713f4d2`；`latest.yml` `350` 字节 / `127709895f25a3ea77ff2a88978ab949195ebf9c3bc98846aeed409f488d6934`；快速补丁 `2307612` 字节 / `93ded123ff60284a3bcca938e6acb292ac45db2ccc347828f5924f511dd96e5d`；Portable ZIP `146495548` 字节 / `098533fe3599b66e91786be5192d9d811bbabd59cc51e98142bd9839cb915926`。ASCII 文件名补丁别名与箭头文件内容一致。

- `v1.2.72`（2026-08-02）继续优化播放帧热路径：普通镜头和自由镜头复用投影参数签名，`fov` 漂移超过 `0.0005` 度或其它投影参数变化时才重建相机投影矩阵；窗口尺寸变化仍强制同步。镜头位置、节拍推拉、自由镜头和视觉输出语义保持不变。新增 `tests/camera-projection-hot-path.test.js`，全量回归 `162/162` 通过。
- `v1.2.72` 本地资产：安装器 `104759578` 字节 / SHA256 `0477e9d92f039f3b6f156b55729d5f727b77825a01231c5d8b550540a1575f12`；blockmap `111890` 字节 / `4a1c4af7a6a92c6829531b1b32ec94143d9e7e53b9b89d3367c39e14d881e88c`；`latest.yml` `350` 字节 / `58cb0901fe0591cc8a1afc6ad6790daa0a1a01c3763bb4bb2dc58908d874ffb5`；快速补丁 `2307236` 字节 / `e7769f119b736e2a43862d73f1faf844b6543f9f617c7f03697971e326f0b169`；Portable ZIP `146495176` 字节 / `fe5c76b503c8cf335400a05b3948b8c028e031ea1204b186ed08825938dcedac`。ASCII 文件名补丁别名与箭头文件内容一致。

- `v1.2.71`（2026-08-02）继续优化播放帧热路径：实时节拍分析复用主频谱分析已计算的时域 RMS，避免同一帧再次扫描 `2048` 个时域采样点；实时节拍频段边界按采样率、FFT 尺寸和数组长度缓存；空 Home 波形在时间节流命中后才查询 DOM。节拍频段数值、命中判断、视觉响应、UI、布局、播放控制和交互语义保持不变。新增 `tests/audio-analysis-hot-path.test.js`，当前全量回归 `161/161` 通过。已生成便携包 `147491934` 字节 / SHA256 `8c49554192d4d11ee5e24f3c33bb48a8ff7f4df07e8c531c539c2cae29b4eee9` 和快速补丁 `2305532` 字节 / SHA256 `d4352b2b22417bd7feafc9a5da98566ea64291d2d0250be6fb84ee8e6cba0d93`；NSIS 安装器未产出，本轮不创建 Latest Release。

- `v1.2.67`（2026-08-02）本轮继续优化播放帧热路径：`tickStageLyricMesh()` 复用光粒循环的帧级稳定状态，`shelfManager.update()` 复用内容打开与常驻显示状态；歌词坐标、歌单架布局、UI、玻璃质感、电影视觉、播放控制和交互语义保持不变。新增 `tests/frame-hot-path.test.js`，全量测试 `156/156`、56 个 JavaScript 文件语法、2 个前端内联脚本解析和 `git diff --check` 均通过。
- `v1.2.67` 本地资产：安装包 `104841092` 字节 / SHA256 `e346de8c5d9ae8bd6b959de8a84160ba590ee9cc126e5c6612aa7d7a238a4a6b`；blockmap `111996` 字节 / `4da7eda9e19d2a27dc05e7f4013425bb51491b8f8ae77e272108ab46a7148e8f`；`latest.yml` SHA256 `b68d92e67641a1baf96379eaa7e7e223d32d3b9dcc8680c3b451c421f8a71497`；快速补丁 `2299088` 字节 / `59b5c10bac8c910eb2d143f1db72434c922ff765bae29ee29312b609445f7597`。Portable ZIP 本轮不上传。

- `v1.2.68`（2026-08-02）继续优化 3D 歌单架卡片帧热路径：`placeCard()` 复用 `shelfManager.update()` 已计算的内容打开状态和常驻显示状态，避免每张可见卡片重复查询；卡片布局、透明度、层级、详情遮罩、UI、视觉质感和交互语义保持不变。帧级契约测试扩展覆盖参数传递与卡片循环零重复查询。
- `v1.2.68` 本地资产：安装包 `104841201` 字节 / SHA256 `213e23771c5e8cec0892fb5131809f019a2f9b31ee51ce3753d50f71624f45f3`；blockmap `112027` 字节 / `67dd719758cef577034bd7281341d4074753f9e12179e8a6b216d9c1ed497a76`；`latest.yml` SHA256 `3b1bf61c6ef116d70fc344d2bd5b236fee8019d1ea2c8c90dd797d8118b82fae`；快速补丁 `2299236` 字节 / `656e1d7d5a3cbfc0e32a4fb5950470e58a633924b5211771145e2a298807f9cb`。Portable ZIP 本轮不上传。

- `v1.2.70`（2026-08-02）继续优化队列渲染低卡顿：`queueVisibleRows()` 为可见歌曲生成一次行快照，主队列的签名、HTML 和迷你队列复用同一批字段与封面结果，减少重复读取副标题、封面和喜欢状态；队列排序、当前高亮、懒加载、文案和交互语义保持不变。新增 `tests/queue-render-hot-path.test.js`，全量测试 `158/158` 通过。安装器 `104758713` 字节 / SHA256 `1883a7f74c592af9f74372154466ae216e7e48e2c6eaa61f1c983293ac0e7af5`；blockmap `112080` 字节 / `3ab785de3acec0d8f3dc7f45b236893aecac67b96826008b65b88ccb66fab971`；`latest.yml` `8c01f7b36989dc3bda1a036305cfed47f31d8f2cbfb1aa4b468e3b6f749a0ef6`；快速补丁 `2302429` 字节 / `50b1e86806d57b537e238d4730eecfa5eedeaf47ab4f17df021cc5fc1eabfa33`。Portable ZIP 本轮不上传。

- `v1.2.69`（2026-08-02）继续优化 Home 首屏列表刷新：`renderHomeDiscover()` 将同一轮已计算的本地歌曲池和听歌统计摘要传给 `renderHomeTiles()`，避免重复扫描曲库和统计对象；Home 卡片顺序、封面、文案、UI、视觉质感和交互语义保持不变。新增帧热点契约测试，全量测试 `157/157` 通过。
- `v1.2.69` 本地资产：安装包 `104841228` 字节 / SHA256 `9f7fc7b532dc267fac165ea02936314d100a9433cfcb1470648ba56e7ce9de13`；blockmap `111982` 字节 / `053644d4779bd3453fdb7dc6e4d859137c3ad248fac22e60cf0af602b1077a2e`；`latest.yml` SHA256 `6e60ef5b8e479eacf5ea3caf146e02894de7c1caaa83f59b70cf164faf837bad`；快速补丁 `2299420` 字节 / `00326da00858ac1b7e2596832daf4ae6b22de9e077430de064b944728b42ed2e`。Portable ZIP 本轮不上传。

- `v1.2.60`（2026-08-01）已正式发布到 GitHub：https://github.com/oirge/Mineradio/releases/tag/v1.2.60；tag 指向提交 `3bd5657`，Release 为 Latest、非 draft/prerelease，4 个资产全部 uploaded 且远端下载后 SHA-256 与本地一致。桌面歌词解锁后支持滚轮按 `0.05` 缩放，范围统一为 `0.20–1.55`；最小档约 `12px`，超长歌词可自适应至约 `8px`。工具条在 `− / +` 之间显示实时百分比，拖动/悬停/中键热区余量随实际字号缩放，`12px` 时每侧约 `3px × 2px`，固定工具条不并入主进程热区。不要再把下限抬回 `0.35/0.72`，也不要恢复小字号固定 `10px × 6px` 余量。
- `v1.2.60` 资产：安装包 `104753811` 字节 / SHA256 `c2f36d64b91480edfa6331cfd8c19d976e00ef93e5f577d337fdb6db5a7bc99e`；blockmap `111920` 字节 / `fcee44800a4eafdc582c7bb11663be18f8347f9f44cf550a9ffafd89c05eb517`；`latest.yml` `350` 字节 / `76edc3dd11766bfdac83a8b925c752fa579a1db203769d53c383071ac7123f90`；快速补丁 `2499947` 字节 / `2f56e6108dd97c6b098157fadc957f84b17c5ce4922a03e02359acb451850b3a`。

- `v1.2.57`（2026-07-28）已正式发布到 GitHub：https://github.com/oirge/Mineradio/releases/tag/v1.2.57；tag 指向 `c01dbe9`，Release 为 Latest、非 draft/prerelease，4 个资产全部 uploaded 且远端 SHA-256 与本地一致。
- `v1.2.57` 优化 3D 歌单架卡片/详情行滚动命中路径，按索引或 action 直接扫描；选择音效按 AudioContext 预生成 6 个固定噪声缓冲并轮换复用。同步修正前端 `APP_VERSION = 1.2.57` 并新增包版本一致性测试。UI、布局、文案、玻璃质感、电影视觉、播放控制和歌单架交互保持不变。
- `v1.2.57` 已验证：完整 Node 测试 130/130、46 个 JS 文件语法、2 个前端内联脚本解析、`git diff --check` 全部通过；真实 Chromium 验证 11 张虚拟卡片、中心索引 `4 -> 5 -> 4`、6 个音效缓冲、WebGL 非空且控制台/page error/失败请求均为 0。Windows 安装器 UI 自动化受 `GetCursorPos 0x80070005` 权限限制未能打开，NSIS 配置和安装器资源已确认与 `v1.2.56` 已验收基线一致。
- `v1.2.57` 资产：安装包 `104751027` 字节 / SHA256 `87f73ac7dcd79497c7e07ff51f99b9d55b33bd5d08034ccd5c880426f8d44eb2`；blockmap `111971` 字节 / `57ee903f112caa212921b9f93415e38c9e7491e9067d7a499d8a3f45dbc3fe48`；`latest.yml` `350` 字节 / `ac33691ef16b79c87ba60ad9ef51d5231e66610ef148e64b3187dda292528afb`；快速补丁 `2269352` 字节 / `13befab3fcbf7269a9fce25ba134d367d83ab7779bc857fa883a611114265e7e`。

- `v1.2.44`（2026-07-26）已正式发布到 GitHub：https://github.com/oirge/Mineradio/releases/tag/v1.2.44；tag v1.2.44 对应提交 9bba136，已设为 Latest（非 draft/prerelease）。5 个资产（安装包、blockmap、latest.yml、SHA256 清单、快速补丁）均 uploaded，远端安装包 SHA256 与本地/latest.yml 一致。
- `v1.2.44` 的运行时改动包括：已播放本地歌词原文改为精确当前队列对象租约，切歌/清队列/同 key 接管/迟到异步结果均做对象所有权校验；空曲库后台资产任务使用递增 token、取消旧定时器并隔离旧队列；本地曲库持久内存按当前文件夹所有权管理，阻止 A→B→A 旧异步结果回填。
- `v1.2.44` 进一步限制本地封面、Object URL、内嵌封面 Blob、文件范围读取和缓存生命周期，并为桌面歌词/壁纸/迷你播放器加入状态缓存与窗口、renderer、PowerShell 进程所有权门禁；新增 3 个桌面状态模块和 35 个纯 Node 回归测试。UI、布局、文案、玻璃质感、电影视觉、播放入口和 3D 歌单架交互保持不变。
- `v1.2.44` 已验证：目标歌词回归 13/13；移植到 `v1.2.43` 基线后的完整 Node 测试 95/95；`desktop/main.js`、`server.js`、`desktop/`、`tests/` JavaScript 语法检查、`public/index.html` 4 个内联脚本解析、AST-only 内存门禁、`git diff --check`、冲突标记和调试标记扫描均通过。测试均使用 `BelowNormal` 与 `--test-concurrency=1`，没有启动 Electron、浏览器、服务或后台 GUI。
- `npm run build:win` 已成功生成本地 `dist/Mineradio-1.2.44-Setup.exe`（`104747336` 字节）、`.blockmap`、`Mineradio-1.2.44-Portable-win-x64.zip` 和 `latest.yml`；`dist/latest.yml` 已确认指向 `1.2.44` 安装包。已生成 `dist/Mineradio-1.2.44-SHA256SUMS.txt`（4 项）和 `dist/Mineradio-1.2.43-to-1.2.44.patch.json`（`2401785` 字节，7 个运行时文件）。
- `v1.2.44` 本地产物摘要：安装器 SHA256 `0c8e307a28e7c3b34ffc379037bea66ffc2ae0db0548d430bc9ebad3040e5a58`；blockmap `e358016aade247da68565ffd1c53d6956842fa53f17a1bf4bf11dd2f34936f50`；`latest.yml` `6c12c95e60b6e106868ed6502cbe140f75f454e8d0bd2db25237a61d7a960ecd`；快速补丁 `e9059df3fd6c18615082cb4dba63ef9f56c24a7a0b58b91771878de08e7554e4`。
- 发布已完成：分支 `codex/release-1.2.44-memory` 与 tag `v1.2.44` 已推送，`gh release create` 上传了安装包、blockmap、`latest.yml`、SHA256 清单和快速补丁（Portable ZIP 未上传），远端资产大小与哈希已核对一致。
- 发布后继续关注两个已确认的内存问题：IndexedDB `assets` 记录仍混合保存歌词原文，需要拆分 `lyrics` store 并做 v2→v3 流式迁移；外置封面仍可能经过主进程完整 Buffer/base64 和 renderer data URL，需要改用已有 `/api/local-file` 流式 URL。

- `v1.2.43` 于 2026-07-24 发布到 GitHub：`https://github.com/oirge/Mineradio/releases/tag/v1.2.43`；tag 对应提交 `4055208`，并作为本轮 `v1.2.44` 的正式基线。
- `v1.2.43` 将本地音质展示改为网易云风格中文档位（超清母带 / 高解析度 / 无损 / 极高 / 较高 / 标准 / 流畅），有损格式最高显示“极高”，并升级缓存键避免旧 kbps 文案残留；不改变 UI 布局、播放逻辑、玻璃质感、电影视觉或 3D 歌单架交互。
- `v1.2.43` 发布资产按既有规则包含 `latest.yml`、安装包、blockmap、SHA256 清单和 `1.2.42 -> 1.2.43` 快速补丁，Portable ZIP 跳过。

- `v1.2.42` 于 2026-07-24 发布到 GitHub：`https://github.com/oirge/Mineradio/releases/tag/v1.2.42`；tag 对应提交 `7c1d3ab`，并设为 Latest。
- `v1.2.42` 优化本地曲库导入排序：前端封面索引与音频列表复用模块级 `Intl.Collator('zh-Hans-CN', { numeric:true, sensitivity:'base' })`，与主进程一致，避免大文件夹导入时每次比较重复初始化区域排序规则。
- `v1.2.42` 不改变 UI、布局、导入顺序语义、玻璃质感、电影视觉、播放控制或 3D 歌单架交互。发布资产仅含 `latest.yml`、安装包、blockmap、SHA256 清单和 `1.2.41 -> 1.2.42` 快速补丁，Portable ZIP 跳过。
- `v1.2.42` 资产校验：安装包 `104728004` 字节 / SHA256 `983c945217221b92efa6a4691fb75e7d62f17ed154fe56e2808b4dab154dd944`；blockmap `111921` 字节 / `a46580633923d2c9434f1dc45c32487febaff3e6023bdb33cffa28ebc5a37730`；补丁 `2280637` 字节 / `699f749a746fa16a9bc4b90077b38e1388283abb9dbada496dd1f1c7f2b36cce`；`latest.yml` `350` 字节 / `ec43eb648de2e48228e51cab0d6b35daef21470a63e8f8452dadf10cd6c1f3ce`。

- `v1.2.41` 于 2026-07-24 发布到 GitHub：`https://github.com/oirge/Mineradio/releases/tag/v1.2.41`；tag 对应提交 `48d8c76`，并设为 Latest。
- `v1.2.41` 修复更新候选镜像二次展开，完整包边下边累计 SHA-256/SHA-512 流式校验，句柄关闭保留主错误；快速补丁整组校验/备份/事务应用；MediaPipe 手势帧复用掌心 scratch 与 tips 常量。
- `v1.2.41` 不改变 UI、布局、手势视觉与交互语义、玻璃质感、电影视觉、播放控制或 3D 歌单架交互。发布资产仅含 `latest.yml`、安装包、blockmap、SHA256 清单和 `1.2.40 -> 1.2.41` 快速补丁，Portable ZIP 跳过。
- `v1.2.41` 资产校验：安装包 `104727871` 字节 / SHA256 `6eebd0e6e10b6ede9f82362a046102a1b16385cd24c0217195aa347b79b09a91`；blockmap `111949` 字节 / `f3241c92291855166f0e4f944dc9ebeebb9f784f4622fe686acfbb115c72adf9`；补丁 `2280453` 字节 / `1c1c0bbc205ad0d5810c3816b489d344363e3f54444b7141b4bad5a3a8f71654`；`latest.yml` `350` 字节 / `1c21a0e3178b4b1dbc12b760850f4ecab4fc0a5433a4d0698f4cb6de2693f103`；SHA256 清单见 `Mineradio-1.2.41-SHA256SUMS.txt`。

- `v1.2.40` 于 2026-07-22 发布到 GitHub：`https://github.com/oirge/Mineradio/releases/tag/v1.2.40`；tag 对应提交 `72873d48c18286fa2aabf0e00d3457baa97d2b94`，并设为 Latest。
- `v1.2.40` 在 `public/index.html` 缓存桌面歌词最终归一化字符串，并让封面取色放大镜每次打开只编码一次 JPEG/CSS 背景；关闭时释放 canvas、Base64 和内联背景引用。
- `v1.2.40` 在 `server.js` 为快速补丁保持 12 秒首包超时和 30 秒正文空闲 watchdog，所有退出路径清理计时器；`AbortError` / `TimeoutError` 统一返回 `UPDATE_TIMEOUT`，并读取 Node `fetch failed` 的 `cause` 区分 DNS 与连接中断。
- `v1.2.40` 不改变 UI、布局、歌词输出、玻璃质感、电影视觉、播放控制或 3D 歌单架交互。发布资产仅含 `latest.yml`、安装包、blockmap、SHA256 清单和 `1.2.39 -> 1.2.40` 快速补丁，Portable ZIP 跳过。
- `v1.2.40` 资产校验：安装包 `104726206` 字节 / SHA256 `b4ee5580e4708e80e9037899664b8924b162ba13f84277eab3c20ce87ab6cb2b`；blockmap `111905` 字节 / `336ba976c7e711453121053e0ab3f26e9b5c39826eb4495ebdfa0e76313e7b6d`；补丁 `2270317` 字节 / `f3ff7ead1390e38261f1fcedae3dbfcf1227c82188fa5de8f415abac17bc939f`；`latest.yml` `350` 字节 / `a7022ce1426ad21006c096d3d5f4781fb947844daa332d0d3fd2e77efc76627e`；SHA256 清单 `299` 字节 / `2489669892d24d2c06c5e659372cec8f40d1da4b6c321f8084553b857ae12269`。

- `v1.2.39` 发布到 GitHub：`https://github.com/oirge/Mineradio/releases/tag/v1.2.39`
- `v1.2.39` 重点优化桌面歌词/壁纸覆盖层同步：复用歌词快照、动效/播放/颜色子载荷和完整 payload；IPC 结构化快照取得后释放 `beatMap` 与壁纸 `cover`，不改变歌词、壁纸、UI、玻璃质感、电影视觉、播放控制或 3D 歌单架交互。
- `v1.2.39` Release 资产包括：`latest.yml`、`Mineradio-1.2.39-Setup.exe`、`Mineradio-1.2.39-Setup.exe.blockmap`、`Mineradio-1.2.39-SHA256SUMS.txt`、`Mineradio-1.2.38-to-1.2.39.patch.json`；Portable ZIP 跳过。
- `v1.2.39` 安装包 SHA256：`33156b1c79e25feb9a035a3f8c95cb38aa54fdec7d2a7e54c573fea1acf80b1a`

- `v1.2.38` 发布到 GitHub：`https://github.com/oirge/Mineradio/releases/tag/v1.2.38`
- `v1.2.38` 重点把 3D 歌单架 `shelfLayoutProfile()` / `shelfSettings()` 改为固定缓存对象就地填充，`renderQualityProfile()` 返回冻结档位常量，`applyRendererPowerMode()` 就地更新 `renderPowerState`；布局结果、UI、玻璃质感、电影视觉、播放控制和 3D 歌单架交互保持不变。
- `v1.2.38` Release 资产包括：`latest.yml`、`Mineradio-1.2.38-Setup.exe`、`Mineradio-1.2.38-Setup.exe.blockmap`、`Mineradio-1.2.38-SHA256SUMS.txt`、`Mineradio-1.2.37-to-1.2.38.patch.json`；Portable ZIP 跳过。
- `v1.2.38` 安装包 SHA256：`5a3677d6fc549fc55e0250021029d103039124c6ade5819f6161eaf1942ffb4b`

- `v1.2.37` 发布到 GitHub：`https://github.com/oirge/Mineradio/releases/tag/v1.2.37`
- `v1.2.37` 重点把舞台歌词 `updateStageLyrics3D()` 内每帧新建的 `tickMesh` 提升为模块级 `tickStageLyricMesh()`，并用 `stageLyricTickCtx` 传递帧状态；歌词输出、UI、玻璃质感、电影视觉、播放控制和 3D 歌单架交互保持不变。
- `v1.2.37` Release 资产包括：`latest.yml`、`Mineradio-1.2.37-Setup.exe`、`Mineradio-1.2.37-Setup.exe.blockmap`、`Mineradio-1.2.37-SHA256SUMS.txt`、`Mineradio-1.2.36-to-1.2.37.patch.json`；Portable ZIP 跳过。
- `v1.2.37` 安装包 SHA256：`75175b1e2c12f90d95c65e0c7a0e928398628a1315fad6e67fef46ab23559ee4`

- `v1.2.36` 发布到 GitHub：`https://github.com/oirge/Mineradio/releases/tag/v1.2.36`
- `v1.2.36` 重点把电影节拍镜头 `beatCam.events` 改为对象池，并复用 live 调度 payload、merge tone、帧压 sample 与舞台歌词 intro/fallback 进度行；镜头/歌词输出、UI、玻璃质感、电影视觉、播放控制和 3D 歌单架交互保持不变。
- `v1.2.36` Release 资产包括：`latest.yml`、`Mineradio-1.2.36-Setup.exe`、`Mineradio-1.2.36-Setup.exe.blockmap`、`Mineradio-1.2.36-SHA256SUMS.txt`、`Mineradio-1.2.35-to-1.2.36.patch.json`；Portable ZIP 跳过。
- `v1.2.36` 安装包 SHA256：`a63e5e9a883e760256827996ce9601a9917607888e3c20505b5e24a88f2f28ff`

- `v1.2.35` 发布到 GitHub：`https://github.com/oirge/Mineradio/releases/tag/v1.2.35`
- `v1.2.35` 重点复用实时节拍命中/未命中返回对象与 `beatFollow()`，并让电影镜头曲目画像分析帧复用 sample、`mixToward()` 与常量 analysis profile；节拍/镜头输出、UI、玻璃质感、电影视觉、播放控制和 3D 歌单架交互保持不变。
- `v1.2.35` Release 资产包括：`latest.yml`、`Mineradio-1.2.35-Setup.exe`、`Mineradio-1.2.35-Setup.exe.blockmap`、`Mineradio-1.2.35-SHA256SUMS.txt`、`Mineradio-1.2.34-to-1.2.35.patch.json`；Portable ZIP 跳过。
- `v1.2.35` 安装包 SHA256：`7e2c823a11c95463deed25d9c63d82b848d4a7954396d346ec9442a68e04bd92`

- `v1.2.34` 发布到 GitHub：`https://github.com/oirge/Mineradio/releases/tag/v1.2.34`
- `v1.2.34` 重点让不可见的舞台歌词光粒停止坐标重算与缓冲上传，清理主循环和安魂镜头的重复工作，并让同一缓存安装包的并发更新请求共享一次完整校验；歌词/相机输出、UI、玻璃质感、电影视觉、播放控制和 3D 歌单架交互保持不变。
- `v1.2.34` Release 资产包括：`latest.yml`、`Mineradio-1.2.34-Setup.exe`、`Mineradio-1.2.34-Setup.exe.blockmap`、`Mineradio-1.2.34-SHA256SUMS.txt`、`Mineradio-1.2.33-to-1.2.34.patch.json`；Portable ZIP 跳过。
- `v1.2.34` 安装包 SHA256：`d4387788fefade2cf329b1b8a6b599b134715f78b5d7d360f4e79c25d9f7163c`
- `v1.2.33` 发布到 GitHub：`https://github.com/oirge/Mineradio/releases/tag/v1.2.33`
- `v1.2.33` 重点让封面涟漪纹理在排空后停止上传，复用舞台歌词 profile 与颜色对象，并把完整安装包校验改为 Electron 主进程友好的异步固定缓冲分块单遍哈希；涟漪/歌词输出、UI、玻璃质感、电影视觉、播放控制和 3D 歌单架交互保持不变。
- `v1.2.33` Release 资产包括：`latest.yml`、`Mineradio-1.2.33-Setup.exe`、`Mineradio-1.2.33-Setup.exe.blockmap`、`Mineradio-1.2.33-SHA256SUMS.txt`、`Mineradio-1.2.32-to-1.2.33.patch.json`；Portable ZIP 跳过。
- `v1.2.33` 安装包 SHA256：`8685914f3cff7d00c8d1023cdd48b0111063a0914d897af20165f902f733192d`
- `v1.2.32` 发布到 GitHub：`https://github.com/oirge/Mineradio/releases/tag/v1.2.32`
- `v1.2.32` 重点把舞台歌词当前行定位从每帧全量前缀扫描改为顺播游标与跳播二分回退，并复用主进程本地曲库中文/数字文件名排序的 `Intl.Collator`；歌词输出、文件顺序、视觉、播放控制和 3D 歌单架交互保持不变。
- `v1.2.32` Release 资产包括：`latest.yml`、`Mineradio-1.2.32-Setup.exe`、`Mineradio-1.2.32-Setup.exe.blockmap`、`Mineradio-1.2.32-SHA256SUMS.txt`、`Mineradio-1.2.31-to-1.2.32.patch.json`；Portable ZIP 跳过。
- `v1.2.32` 安装包 SHA256：`d5ef59fffab489160f3d0c59db9fed52d5105e5381b2ff07d8335f22f8ab977a`
- `v1.2.31` 发布到 GitHub：`https://github.com/oirge/Mineradio/releases/tag/v1.2.31`
- `v1.2.31` 重点把永久 `280ms` 播放进度/听歌统计定时器改为按真实播放状态单任务自调度；暂停、结束、空队列和普通隐藏时零 tick，直播后台保持仍维持原刷新语义。视觉、播放控制和 3D 歌单架交互保持不变。
- `v1.2.31` Release 资产包括：`latest.yml`、`Mineradio-1.2.31-Setup.exe`、`Mineradio-1.2.31-Setup.exe.blockmap`、`Mineradio-1.2.31-SHA256SUMS.txt`、`Mineradio-1.2.30-to-1.2.31.patch.json`；Portable ZIP 跳过。
- `v1.2.31` 安装包 SHA256：`d3c4e8f50bdfeb3657acf8a4387dcdfbd9bb51c793e265ffd1932dfc663c928c`
- `v1.2.30` 发布到 GitHub：`https://github.com/oirge/Mineradio/releases/tag/v1.2.30`
- `v1.2.30` 重点修复长本地音频 duration 秒/毫秒误判和非有限时长回退，并优化整数秒进度文本缓存、进度 DOM 重连补写及 Media Session 节流前置；视觉、播放控制和 3D 歌单架交互保持不变。
- `v1.2.30` Release 资产包括：`latest.yml`、`Mineradio-1.2.30-Setup.exe`、`Mineradio-1.2.30-Setup.exe.blockmap`、`Mineradio-1.2.30-SHA256SUMS.txt`、`Mineradio-1.2.29-to-1.2.30.patch.json`；Portable ZIP 跳过。
- `v1.2.30` 安装包 SHA256：`889484d3dcd90b2ad9666eb8de1299eb0d088a77713bd29cf55ea0e4b8a3a3ab`
- `v1.2.29` 发布到 GitHub：`https://github.com/oirge/Mineradio/releases/tag/v1.2.29`
- `v1.2.29` 重点优化歌词字距 Unicode 游标绘制、进度拖动布局缓存与指针归属、异常拖动状态恢复和粒子批量插入/清理；视觉、歌词质感、播放控制和 3D 歌单架交互保持不变。
- `v1.2.29` Release 资产包括：`latest.yml`、`Mineradio-1.2.29-Setup.exe`、`Mineradio-1.2.29-Setup.exe.blockmap`、`Mineradio-1.2.29-SHA256SUMS.txt`、`Mineradio-1.2.28-to-1.2.29.patch.json`；Portable ZIP 跳过。
- `v1.2.29` 安装包 SHA256：`00518c8d2dbaa4fdce42bf2a10ece49156a6154cdef6538005ab15c7302461de`
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
- `v1.0.6` 将桌面歌词、桌面歌词穿透和壁纸模式入口标记为开发中并强制关闭；软件内更新日志文案改为“反正没什么人看，布想写日志了”。壁纸模式入口已在 `v1.6.3` 解锁，本条只作为历史记录。
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

### 2026-07-26 - v1.2.45 本地文件代理越权读取修复发布

- 用户认可/要求保留：延续“修完验证、能发布就一起发布”的偏好，本轮把安全修复完整发布。
- 涉及文件：`server.js`、`desktop/main.js`、`tests/local-file-proxy-authorization.test.js`、`.context/pitfalls/mineradio-local-file-proxy-authorization.md`、`AGENTS.md`、`CHANGELOG.md`、`RELEASE.md`。
- 关键参数/实现：本地文件 HTTP 代理 `/api/local-file` 之前只校验随机令牌、未限制授权曲库根目录，可越权读任意文件（含 `..` 穿越）。修复给 `server.js` 增加可注入授权钩子 `setLocalFileAuthorizer`，缺省 Fail-Closed（未注入即拒绝）；`desktop/main.js` 在 `require` 后注入 `resolveAuthorizedLocalFile`，与 IPC 授权模型对齐。
- 发布产物：GitHub Release `v1.2.45`（Latest），含 `Mineradio-1.2.45-Setup.exe`、`.blockmap`、`latest.yml` 和快速补丁 `Mineradio-1.2.44-to-1.2.45.patch.json`；已逐字节确认 `win-unpacked` 打包源码含授权门，安装包 SHA256 与本地一致。
- 禁止回退或改坏的点：不要把 `/api/local-file` 改回只验令牌不验授权根目录；不要把授权钩子缺省改成 no-op（fail-open）；不要绕过 `resolveAuthorizedLocalFile` 直接 `statSync`/`createReadStream` 请求方 path。

### 2026-08-03 - v1.2.83 桌面歌词同步延迟修复

- 用户反馈：桌面歌词显示比实际演唱慢，要求修复且不能影响正常电脑使用。
- 涉及文件：`public/app.js`、`tests/desktop-lyrics-sync-rate.test.js`、`tests/desktop-lyrics-stable.test.js`、`CHANGELOG.md`、`RELEASE.md`。
- 关键参数/实现：`desktopOverlaySyncDelay()` 在桌面歌词启用时改用 `desktopLyricsPushInterval()`，不再固定 `320ms`；30 FPS 约 `33ms`、60 FPS 约 `16.7ms`，`desktopLyricsPushInterval()` 仍保留 `8–42ms`、运行时压力和隐藏窗口降载边界。修复只收紧歌词状态 IPC 调度，不改音频 `currentTime` 时钟，不启动新窗口、不接管鼠标键盘。
- 验证：全量 Node 回归 `182/182` 通过；主进程、桌面歌词 renderer 和前端语法检查通过；`git diff --check` 通过。
- 禁止回退或改坏的点：不要把桌面歌词外层调度恢复为固定 `320ms`；不要为追求同步关闭隐藏/后台降载保护；不要让桌面歌词窗口重新捕获鼠标导致遮挡用户操作。

### 2026-08-03 - v1.2.84 桌面覆盖层帧热路径优化

- 优化目标：桌面歌词和壁纸已有独立自调度同步循环后，主渲染 `animate()` 不应每帧再次调用同步函数，避免重复时间检查、载荷判重和状态分支。
- 涉及文件：`public/app.js`、`tests/desktop-overlay-scheduler.test.js`、`package.json`、`package-lock.json`、`CHANGELOG.md`、`RELEASE.md`。
- 关键边界：只移除渲染帧重复入口，保留 `scheduleDesktopOverlaySync()` 的独立定时器、桌面歌词 FPS、壁纸 260ms 节奏、后台/隐藏窗口降载和开关即时同步；不改 UI、布局、视觉质感、音频时钟或鼠标行为。
- 禁止回退或改坏的点：不要把桌面覆盖层同步重新塞回主渲染帧；不要为了省一次调用取消独立自调度，否则主窗口停止 RAF 时桌面歌词/壁纸会失去更新。
- 发布资产：GitHub Latest `v1.2.84`，远端上传安装器 `103330195` 字节、blockmap `110266` 字节、`latest.yml` 和 275 字节 SHA256 清单，均按大小与 SHA256 复核；Portable ZIP 已本地生成 `144971458` 字节、SHA256 `4bae1c0e1c929c3567bf6673c554db44a9783625bf9cfb606c6c188934807d0f`，因当前代理上传大文件超时未上传。
### 2026-08-03 - v1.2.85 桌面歌词调整栏自动避让

- 用户反馈：歌词靠近屏幕顶部时，上方的锁定、字号和光效调整栏会被屏幕上沿裁切，要求自动移动到歌词下方。
- 涉及文件：`desktop/main.js`、`desktop/overlay-preload.js`、`public/desktop-lyrics.html`、`tests/desktop-lyrics-hint-placement.test.js`、`tests/desktop-lyrics-window-geometry.test.js`、`CHANGELOG.md`、`RELEASE.md`。
- 关键实现：`positionInteractionHint()` 使用上下候选位置的实际可见高度决定 `hint-below`；主进程通过 `mineradio-desktop-lyrics-window-geometry` 传递窗口相对显示器的 `topInset/bottomInset`，renderer 将物理裁切量纳入安全边界；绘制循环在舞台浮动、歌词滚动和入场动画期间以约 `32ms` 节流重新测量。
- 禁止回退或改坏的点：不要恢复只在提示首次出现时定位的旧逻辑；不要改动桌面歌词视觉质感、鼠标穿透、中键锁定、拖动、窗口位置保存或音频时钟。
- 验证：全量 Node 回归 `189/189` 通过；`desktop/main.js`、`desktop/overlay-preload.js`、`server.js` 语法检查和 `git diff --check` 通过。
- 修复重发资产：`Mineradio-1.2.85-Setup.exe` `103330816` 字节 / SHA256 `409e36493bbf4738fdf80d6fe3a27d7235e9302d014bcbaeeeb188443d520650`；blockmap `110399` 字节 / `ff93aa3b112348a4b34ed9c5dfbd9514d855e8d7c95ff25d91d1d54a309d7e10`；`latest.yml` `350` 字节 / `b2e7cc153b778a2b3055c0024a075352e0e4ef8376eb59724081d433ef12ba1a`；Portable ZIP `144915590` 字节 / `a05c2f02b0dbbba64dbfcdfb8bb48831792e8e462f7e97bedd13da3cbce41a6c`。
- GitHub Release 已覆盖安装器、blockmap、`latest.yml` 和 SHA256 清单共 4 项；Portable ZIP 因大文件上传超时未放入远端，保留本地产物，不影响自动更新链路。

### 2026-08-09 - v1.3.1 CPU 与运行内存优化

- 当前代码基于 GitHub `origin/main` 的 `v1.3.0`，本轮发布版本升级为 `v1.3.1`，并已推送 GitHub Latest。
- `public/app.js` 可见空闲场景在无音频、无交互时将主 3D 渲染目标限制为 30 FPS；播放、交互、后台和帧压力量级继续走原有策略。桌面歌词与壁纸仍由独立调度器运行。
- `shelfManager.update()` 在启动页或完全隐藏且无详情内容时直接结束，避免继续更新不可见卡片的变换和透明度。
- 主实时频谱 `kick/vocal/mid/treble` 改为单次 `frequencyData` 扫描；独立节拍频谱只在 30 FPS 采样时隙刷新并复用 `beatBandValueCache`，节拍状态机仍按主分析时间片推进。
- `sortLocalAssetPreloadQueue()` 将 rank 和原始索引压成数字排序键，避免大曲库后台预载为每首候选歌曲创建 `{song,index,rank}` 临时对象。
- `trimLocalIndexedDbCaches()` 串行扫描三个对象仓库，仅保留资产轻量元数据和必要 ID 映射；删除阶段使用游标逐条删除，避免资产、歌词、曲库三套全量记录数组同时驻留。
- 歌词特效关闭或暂停镜头无残留冲击时直接跳过无效帧工作；`getStageLyricLockBounds()` 不再每帧创建 `take()` 闭包。
- 安装器 `build/installer.nsh` 直接读取原始 Windows 命令行中的 `/D=`，同时保留安装目录归一化和卸载安全门禁。
- 新增 `tests/idle-render-hot-path.test.js`、`tests/local-cache-memory-hot-path.test.js`，并扩展 `tests/audio-analysis-hot-path.test.js`、`tests/frame-hot-path.test.js`；全量 Node 回归 `237/237` 通过，主进程与渲染器语法检查通过。
- 安装器 `103337852` 字节，SHA256 `d7be6b7cc50bc8db7c45a915c0cbe759cac18b5025d8087ee29ad07d44e0ee43`；blockmap `110078` 字节，SHA256 `2e64d7e430b514626bf64c6e272472dda28380ab5f513329e0f2f5e24fa95e9e`；`latest.yml` `347` 字节，SHA256 `e7479f08f9e5abf78d2d1e6cc64c42036d8b7d2d9c254756c6ac72125a286a48`；SHA256 清单 `273` 字节，SHA256 `aab32ee89249681a646efcf974f863a8d2c730611f828721ca7ff1247c82cfbe`。
- 不得回退：播放或交互期间不能强制降到空闲帧率；桌面歌词/壁纸不能重新塞回主渲染帧；歌单详情打开时不能跳过必要的行更新。

### 2026-08-04 - v1.2.86 桌面歌词修复与 GitHub 发布链路完善

- 将 `v1.2.85` 同版本修复重发提升为 `v1.2.86`，确保已安装旧 `1.2.85` 的客户端满足 `latestVersion > APP_VERSION`，能够发现更新。
- 保留 `positionInteractionHint()` 的上下候选可见高度比较，以及主进程 `mineradio-desktop-lyrics-window-geometry` 传递的 `topInset/bottomInset`；窗口拖到物理显示器上沿外时，歌词调整栏仍会转到实际可见的一侧。
- 当前完整源码同步到 GitHub 默认 `main`，并新增 Windows GitHub Actions CI：`npm ci --ignore-scripts`、全量 Node 测试、主进程/预加载/服务端语法检查和空白检查。
- 本地验证：全量 Node 回归 `190/190`；`server.js`、`desktop/main.js`、`desktop/overlay-preload.js`、`public/app.js` 语法检查和 `git diff --check` 通过；打包后的 asar 含 `APP_VERSION = '1.2.86'` 和桌面歌词物理裁切修复。
- 发布清单只列实际远端存在的四个资产：安装器、blockmap、`latest.yml` 和 SHA256 清单；Portable ZIP 只保留本地，不得在 Release 正文写成可远端下载。
- 远端 Release 已以 Latest 正式发布，资产仅含安装器、blockmap、`latest.yml` 和 SHA256 清单；GitHub API 的资产大小与 SHA256 均与本地一致。安装器 `103331153` 字节 / SHA256 `18971d4a85a2e3f186534205b980e5bb85b2ba28576dce9348dd45ed106eaed1`；blockmap `110176` 字节 / `d69b25649d685243a389b7bb417ac4e4fc698781a8300234051157dc5c6178c3`；`latest.yml` `350` 字节 / `c4eb389b66b9e846f3075e2ca98f9024674f2e823d03e529b690d9a94c959245`；本地 Portable ZIP `144915599` 字节 / `bc6e68aed9ae3ef85d7cc3e0f24196434cb0e9c31baf93672693ccb1a81ded4b`。
### 2026-08-09 - 待发布安装器安全修复

- `build/installer.nsh` 直接读取 Windows 原始命令行中的 `/D=`，避免 `${GetParameters}` 过滤该参数后误判为未指定目录。
- 保留专用安装目录归一化、`.mineradio-install-root` 标记和卸载安全门禁；`tests/installer-command-line-path.test.js` 覆盖原始命令行解析和安全检查。

### 2026-08-09 - v1.3.8 主循环状态快照与时间戳复用

- 优化目标：继续降低主渲染帧的 CPU 与短命对象压力，不改变 UI、布局、视觉质感、播放、歌词或歌单交互语义。
- `animate()` 只取得一次 `performance.now()`，并把该时间戳传给自由镜头、手势活跃度衰减、歌单架更新、Home 波形和空闲引导；省略参数的非帧入口保留原有回退读取。
- `refreshShelfRenderFrameState()` 使用模块级对象就地刷新当前帧状态；主渲染链路只读取一次歌单模式、详情打开状态和侧栏常驻状态，Skull 相机、Skull 粒子、壁纸压暗和舞台歌词均消费同一快照。快照不得跨帧保存或由下游修改结构。
- 回归：`tests/frame-hot-path.test.js` 锁定 getter 单次读取与快照传递；全量 Node 回归 `248/248`，`public/app.js`、`server.js`、`desktop/main.js`、`desktop/preload.js` 语法检查、`git diff --check` 和 Windows x64 NSIS 构建通过。
- 发布产物：`Mineradio-1.3.8-Setup.exe` 103342250 字节，SHA256 为 `0F1B395B4A50A1148796C9CE04B7DBCDB65AD61EC2045F658B6C1537CB55F58E`；blockmap 110214 字节，SHA256 为 `F4A1BD6003760CC4110B3050EA7063239B696BBBCA45AD883B0F22EFB0CA7FD0`；`latest.yml` 347 字节，SHA256 为 `2CD0423032E81EB013A8A89217B7374B353881E81E0F3BBA190AAE1AEA3984EF`；不生成 Portable ZIP。

### 2026-09-02 - v1.7.26 新增控件必须接上主题令牌（热键面板与队列样式返工）

- 用户原话：「热键界面ui不符合我播放器ui啊而且主题插件这个热键界面不生效 你改一下」，随后「发布新版」。
- **这条要长期记住：Mineradio 的主题插件只有两条通道能作用于一个控件** —— 插件 `theme.vars` 灌到 `:root` 的 `--th-*` 令牌，或者 `theme.css` 那段 `!important` 规则里点名的类名（`.modal`、`#fx-panel`、`#playlist-panel`、`.queue-item`、`.home-card` …）。以后任何新控件的样式，要么复用 `public/app.css` 兼容层点名过的类名，要么自己走 `--th-*` 令牌，最好两条都占；否则换主题时它就是一块纹理不对的补丁。`v1.7.25` 的 `.hotkey-*`（48 条规则 0 个令牌）和 `.queue-*` 就是这么翻车的。
- 强调色一律 `rgba(var(--fc-accent-rgb),…)`，**不许再写字面 `rgba(0,245,212,…)`** —— 写死连用户自己在设置里调的强调色都不跟。同理 `--champagne` 各主题都重定义过，金色装饰走令牌而不是 `rgba(244,210,138,…)`。
- 语义色（可用绿 / 冲突黄）不能直接当文字色：浅色主题（雪昼白 `--th-text-strong: rgba(27,49,65,0.96)`）下白底薄荷字看不见。写法定为 `color:var(--th-text-strong,#7ee2a8)` —— 令牌没设回落语义色（默认深色外观不变），主题在时跟主题正文色；绿/黄的信息移到色点与实心图标上。
- **兼容层的 `!important` 会吃掉状态类。** `.pl-card,.queue-item,.mini-queue-item,.pl-detail-row` 那条把 `border` 与 `box-shadow` 都设成 `!important`，所以 `.queue-item.drop-before/.drop-after/.dragging/.next-up` 这类状态修饰必须自带 `!important` 才压得住（同为 `!important` 时按特异性判）。以后给 `.queue-item` / `.pl-card` 加状态样式都要记得。
- 反过来也成立：既然规则自己引用了 `var(--th-*)`，就**不要**再往兼容层重复列一遍选择器，只会多一份 `!important` 冲突面。`.queue-next-up-row` 是虚线框，兼容层那种 `border:1px solid` 的写法会把线型抹平，这类控件只能自己换颜色。
- `.hotkey-modal` 必须继续留在遮罩元素上（`tests/global-hotkeys.test.js` 钉了 `.hotkey-modal.warn .hotkey-capture-tip`）：遮罩是 `modal-mask hotkey-modal`、卡片是 `modal hotkey-dialog`。
- 弹窗层级不要自己发明：热键弹窗原来 `z-index:1450` 压在自绘标题栏 `#desktop-titlebar`（`500`）之上，开着弹窗时窗口控制按钮点不到。统一落到 `.modal-mask` 的 `50`。
- **纯 CSS 改动的视觉验收办法（好用，留着）：** 起一个只有 `<link href="app.css">` 的临时静态页，把真实 markup 贴进去，再用查询参数把某个主题的 `--th-*` 与 `css` 段注入 `:root`，截图对比深/浅两种主题；`getComputedStyle` 可以直接验 `!important` 优先级到底谁赢。不必启动 Electron。临时文件放仓库外并用完删除。
- 故意没有改 `public/plugin-builtin-themes.js`：外壳戴上 `.modal` 后内置主题已覆盖，改那个文件还得同步改被 `tests/plugin-system.test.js` 钉住的 `examples/plugins/*.json`，而令牌这条路对第三方主题一样有效。
- 验证：全量 Node 回归 `712/712`（上一版基线 `709`），新增 3 例锁定外壳类名复用、`--th-*` 覆盖、队列样式不许残留写死青色与 `z-index:1450`。本轮未启动本机 Electron。
- **发布产物的 `SHA256SUMS.txt` 是 CRLF 换行**（`release.yml` 里 pwsh `Out-File` 的默认行为），Linux / macOS / Git Bash 直接 `sha256sum -c` 会因文件名尾部的 `\r` 全部报 `No such file or directory`，要先 `tr -d '\r'`。核验发布资产时别被这个假失败带跑；下版要修就把那句 `Out-File` 换成 `[IO.File]::WriteAllText`。

### 2026-09-03 - v1.7.27 播放统计的两份存储、断点门槛，以及鼠标热键的能力边界

- 用户原话：「继续更新加：最近播放时间 / 累计播放时长 / 播放次数 / 最后播放位置 / 断点续播 /「继续上次播放」/ 最近播放记录清空 / 单曲播放统计　全局快捷键支持鼠标侧键 更新好发布新版本」。
- **播放统计有两份存储，动其中一份就要想到另一份。** 界面读的是 `localStorage` 的 `mineradio-listen-stats-v1`（`songs` / `artists` / `history`）；`desktop/local-library-store.js` 的 `song_stats` 表还有一份镜像，`syncLocalLibraryDbPlayStat` 每次结算都写。渲染层目前**从不读回**镜像，所以镜像里的残留在界面上完全看不出来——本轮的清空功能第一版就只清了 `localStorage`，用户按了「全部清空」而数据库里原封不动。以后凡是「清空 / 重置 / 迁移」播放统计，两处都要动。
- **`song_stats` 的清空只能 `UPDATE` 归零，不能 `DELETE` 行。** 同一行里还存着 `favorite` / `favorite_at`，「特别喜欢」歌单靠它；删行等于顺手清掉用户的收藏。`clearPlayStats({scope})` 两档：`all` 归零 `play_count` / `listen_ms` / `completed` / `last_played_at`，`recent` 只归零 `last_played_at`。
- **镜像写失败不能让用户的操作失败。** 没有 `node:sqlite` 或数据库打不开是常态，清空是用户当场按下的动作，`localStorage` 那份该清照清，镜像那边失败只记 `console.warn`，并且别漏出 unhandled rejection。
- **三条数值门槛不要「顺手调低」，它们各自挡着一类误判：** 有效播放 = `完整播完 || 累计 45 秒 || 进度过半 || (读不到时长时 30 秒)`——挡的是「切歌前手滑点开两秒」污染最常播放榜；断点最小 15 秒 + 距结尾至少 20 秒——挡的是「续播把用户丢到片尾」；断点上限 400 条按最后记录时间淘汰。断点写入与会话记录共用 `writePlaybackSession` 里那条 2.2 秒节流，别再另开定时器。
- **「继续上次播放」不看自动播放开关。** 那个开关管的是「启动要不要自动出声」，按钮是用户当下的明确意愿，两回事。落点三级回落：待恢复会话 → 磁盘会话 → 最近播放里第一首还在当前队列的歌；第三档在几万首队列里必须先把 history 的 key 收成表再单遍扫描，不许嵌套循环。
- **两档清空的分界要长期保住：** 最近播放时间是隐私向的，播放次数与累计时长是用户攒出来的资产，一个按钮不该连带删掉。未知 scope 一律当 `recent`，因为误判成 `all` 不可逆。
- **`globalShortcut` 只收键盘 —— 鼠标键必须走系统级低层钩子，这是引入第一个运行时依赖的唯一理由。** `uiohook-napi@1.5.5`（钉死版本），Windows 上装 `WH_MOUSE_LL`（libuiohook 同时也装 `WH_KEYBOARD_LL` 跟踪修饰键）。只在确实存在全局鼠标绑定时 `require`，绑定清空就 `stop()`。
- **libuiohook 是 listener 不是 filter：绑了侧键之后，其它程序原本的后退 / 前进照样发生，拦不掉。** 这是 API 的能力边界，不是缺陷。热键面板里那句提示不许删，也别当成 bug 去「修」。要不受影响就只绑「局内」。
- **鼠标键位有两套编号，改一处必须改两处：** `HOTKEY_MOUSE_TOKENS` 里每个 token 同时带 `dom`（渲染层 `mousedown` 用）和 `uio`（主进程用），外加一张反查表。左键 / 右键永不开放绑定。鼠标条目的 `accel` 是空串且 `bare:true`，所以 `hotkeyToAccelerator` 必须显式挡掉它们，否则 `Ctrl+MouseBack` 会拼出 `'Control+'` 这种真值垃圾串送进 `globalShortcut.register`。
- **中键的自动滚动要在 `auxclick` 上再挡一次**，`mousedown` 的 `preventDefault` 挡不住它。所以渲染层是两个 capture 阶段监听，缺一不可。
- **局内 / 全局同时绑同一个组合时的去重靠一份不带 `action` 的 `local` 签名表**，主进程只在「签名在表里且主窗口有焦点」时跳过派发；别改成靠 `action` 判断。
- **原生模块进包要手写白名单。** `build.files` 是白名单，而打包测试的相对依赖扫描只认 `./` / `../`，bare `require('uiohook-napi')` 它看不见；`node_modules/uiohook-napi/**/*` 和 `node_modules/node-gyp-build/**/*`（uiohook 的入口就是 `require('node-gyp-build')`）都得显式写上。`.node` 二进制在 asar 里 `dlopen` 不了，必须进 `asarUnpack`——而 `tests/complete-optimization-gates.test.js` 那条 `asarUnpack` 断言是全量 `deepEqual`，加条目要同步改它。
- **锁文件里的 `resolved` 必须全部指向 `registry.npmjs.org`。** 本机 npm 默认走 `registry.npmmirror.com`，混进去 CI 上的 `npm ci` 会拉到跟 integrity 对不上的地址。生成锁文件时加 `--registry=https://registry.npmjs.org/`；现在有测试扫这条了。
- **引入静态链接 LGPL 组件时要披露、也要写准。** uiohook-napi 是 MIT，链的 libuiohook 是 LGPL-3.0-or-later，按 LGPL v3 第 2 条可在 GPL-3.0 项目内分发。声明里只能说「随附预编译 `.node`、版本已钉死、重编译替换即可再链接」——**不能写成「安装包附了完整编译源码」**，electron-builder 的默认 node_modules 排除规则会剥掉 `binding.gyp` 与 `.h/.cc/.cpp`。
- **`node:vm` 切片测试的两条老规矩又各踩一次：** 切片外声明的标识符必须由 harness 供上**并用正则钉住**，否则生产代码的 `try/catch` 把 `ReferenceError` 咽掉、测试静默假通过；`let` / `const` 在 vm 顶层不是 context 属性，主进程那些 `let globalMouseHotkeyMap` / `const GLOBAL_MOUSE_HOTKEY_BUTTONS` 宿主完全看不见，断言只能走返回值与调用记录。默认热键表自带九组键盘全局绑定，routing 断言前要先把整个 scope 清空。
- 验证：全量 Node 回归 `807/807`（上一版基线 `712`）。本轮未启动本机 Electron，未合成鼠标键盘输入；`uiohook-napi` 只在裸 Node 下实测加载过，**Electron 运行时里的钩子行为未经本机验证**。

### 2026-09-03 - v1.7.28 双 deck 交叉：不改接线、等出声再对交

- 用户原话：「再最新版的基础上继续给 Mineradio 增加无缝播放和 Crossfade……1. 新增 Gapless 开关。2. 支持相邻歌曲无明显停顿。3. 新增 Crossfade，支持 0~10 秒。4. Crossfade = 0 时保持原来的播放逻辑。5. 不影响手动切歌、上一首、下一首。6. 不影响随机播放和自动播放。7. 播放器状态切换时不能出现爆音、重复播放或突然静音。8. 保持现有 UI 风格，只增加必要设置。9. 增加播放切换和边界情况测试。 更新好后发布新版」。
- **`MediaElementSource` 一旦建好就永久绑死那一个 `<audio>`，Web Audio 没有 re-target 也不能 disconnect 后换元素。** 所以「省一个元素、复用现有 source 做交叉」的方案在规范层面就走不通，交叉必然要第二个 `<audio>` 配第二个 source。以后再有人提「不要双 deck」，先看这一条。
- **deck 增益与 master 增益必须分家。** `gainNode.gain` 历史上背着 `targetVolume`、启动 `460ms` 淡入、暂停淡出、seek 淡入等一整套自动化；第一版把交叉斜坡也写到 `gainNode.gain` 上，两边的 `cancelScheduledValues` 互相削，当场爆音。现在的分工是死规矩：**master 归 `gainNode`，接续与交叉归 `deck.gain`，两者语义不许混用。**
- **「无缝」听起来像解码问题，其实是淡入问题。** 相邻两首之间那段能听出来的空档 = 自动续播时重跑的 `460ms` 主淡入。预解码只解决延迟那一小半，真正让停顿消失的是接管时**不再重跑主淡入**。以后有人报「还是有停顿」，先查是不是又走回了带淡入的起播路径。
- **交叉必须等下一首真的出声才提交。** `play()` 在 Chromium 里可能 reject（autoplay 策略、解码失败、blob 失效），老实现里还可能根本不返回 Promise。顺序固定为 起播 → 等 resolve → 提交（对交 + 推进队列 + 移动 `audio` 指针）；失败就原样退回、当前那首继续播、失败 URL 进黑名单不再重试。先推进队列再起播 = 用户看到歌单跳了却没有声音。
- **所有收尾定时器都要带自增序号，回调里先比序号再动 deck。** 交叉进行中用户手动切歌，上一轮的收尾定时器还在飞，不守卫就会把刚接管的那个 deck 停掉或静音——本轮最难复现的一个 bug，`tests/gapless-crossfade.test.js` 的 `testStaleTimersCannotStopNewDeck` 专门钉它。
- **预取出来的 deck 只许自动续播与单曲重播接管。** 手动切歌 / 上一首 / 下一首语义上是「立刻换到我点的这首」，让它吃预取就会播出预取的那一首；随机播放待洗牌时连预取都不做，因为洗牌结果没定、预取必然预错。
- **`setValueCurveAtTime(curve, now, span)` 与同一时刻的其它自动化事件冲突会抛 `NotSupportedError`**，而且这套曲线 API 在某些实现里干脆没有。写法定为 cancel → curve，抛了再 cancel 一次并退回 `setValueAtTime` + `linearRampToValueAtTime`；等功率曲线用 `sin/cos`，线性交叉中点会掉约 `3 dB`，别改回线性。
- **交叉期间两首歌共用同一个 ReplayGain 增益**，因为 `replayGainNode` 只有一个且在 `analyser` 之后（增益作用在两路求和之后）。这是本轮明确接受的取舍；真要 per-deck 均衡，得把 `replayGainNode` 拆成两个塞到各自 `deck.gain` 前面。
- **每加一个启动初始化函数，都要去放宽 `tests/auto-playback-startup.test.js` 那条启动顺序正则** —— ReplayGain、音效链、无缝各踩了一次，已经第三回了。以后新增 `initXxxControls()` 顺手补一个 `(?:initXxxControls\(\);\s*)?` 可选组。
- **`node:vm` 切片的两条老规矩又各踩一次：** ES6 简写方法不可 `new`，桩 `new Audio()` 必须写成 `Audio: function () {}`；`require('node:assert/strict')` 把 `deepEqual` 别名成 `deepStrictEqual`，跨 realm 容器断言前必须 `Object.assign({}, x)` / `Array.from` 拷回本 realm。
- 验证：全量 Node 回归 `834/834`（上一版基线 `807`），新增 `tests/gapless-crossfade.test.js` 27 例。本轮未启动本机 Electron，**交叉与接续的实际听感未在本机 Electron 里试听过**，全部结论来自桩 AudioContext 下的逐条自动化断言。

### 2026-09-03 - v1.7.29 同步指示器移到搜索框下面：挂进容器而不是重算坐标

- 用户原话：「已同步xx歌曲位置改动一下再搜索框下面，显示的要符合主题插件」，随后「发布新版」。
- **要把一个东西挪到某个控件下面，优先挂进那个控件的容器、用 `top:100%` 贴底边，不要去重算固定坐标。** `#local-sync-badge` 改成 `#search-stack` 的绝对定位子节点（`top:100%;right:0;margin-top:8px`，`margin-top` 与 `#search-results` 同值），于是 `stage-mode` / `simple-mode` / 桌面壳 / 移动端那几套宽度与 `top` 变体全部自动跟上，一处都不用另算；`#search-stack` 只补了一条 `position:relative`。
- **别按「某一行控件的高度」算死坐标 —— 那一行可能永远是 `display:none` 的。** `LOCAL_ONLY_MODE` 在 `public/app.js:74` 是硬编码 `true`，`app.css` 里 `body.local-only-mode #search-mode-tabs{display:none}` 因此恒成立。第一版把 `#search-mode-tabs` 的行高算进 `top`，结果那个坐标正好压在搜索结果列表第一行上。改坐标前先确认参照物在当前模式下真的存在。
- **挂进「按需探头」的容器要连它的可见性一起接管。** 顶部搜索区只在鼠标 `y<66` 时才 `.peek`，指示器挂进去就等于跟着一起隐身。按住 `.peek` 的四条边界一条都不能省：① 用户自己划开的不接管也不替他关（先读 `.peek`）；② `setPeek` 有自己的拒绝理由（沉浸模式一律不给开搜索区），所以**叫完必须回读 `.peek` 再决定记不记按住状态**，否则会记下一个假的「按住」，放开时把用户本来开着的搜索区关掉；③ 放开时只在「那条全局 mousemove 自己也会收」的情况下才收 —— 查 mousemove 写下的指针区标记、`emptyHomeActive`、输入框焦点、`#search-results.show`、`#upload-tip.show`；④ mousemove 的收起分支要加按住豁免，否则指示器刚露头就被连着搜索区一起收掉。
- **新控件要合主题，只有两条通道：设 `--th-*` 令牌，或被主题的 `css` 段点名。** 这是 `v1.7.26` 记下的规矩，本轮再确认一次。指示器不在任何现成主题的选择器清单里，所以走令牌：底色 `--th-search-bg` → `--th-chip-bg` → `--saved-panel-glass-bg` 三级回落，描边 `--th-chip-border`，阴影 `--th-row-shadow`，文字 `--th-text-strong`（浅色主题也读得清），语义色只留在 `--fc-accent-rgb` 那颗圆点上。
- **想让新控件有黄金玻璃质感，不要往 `app.css` 那两条长 `!important` 选择器列表里加名字。** 那两条列表是统一入口，加进去等于让主题令牌永远赢不过 `!important`。正确做法是在自己的 id 规则里把 `--saved-panel-glass-*` 当**回落值**（id 选择器本来就赢过那些类），再单独写一条 `html.control-glass-svg-ok #自己的id` 跟着升级到同一支 SVG 滤镜。
- **CSS 属性名互为后缀时，正则断言必须连分隔符一起锚。** `assert.doesNotMatch(rule, /top:\d/)` 被 `margin-top:8px` 命中，收紧成 `(?:^|;)top:\d` 又被 `top:100%` 命中，最终只能写成 `(?:^|;)top:[\d.]+px`（只禁硬编码像素 `top`）。同理 `cssRule()` 取规则要用 `\n#id{` 换行锚定，否则 `#search-area.stage-mode #search-stack{` 会先命中。
- **测试 harness 里「登记一个节点」和「把它塞进 body.children」是两件事。** `createDocumentShim().mount(id)` 只登记不推进 `body.children`，否则「取不到宿主时退回 `body`」那条测试的 `children.length` 断言会被前面的挂载污染。另加 `createSandbox({peekRefused})` 还原「叫了 `setPeek` 但没开起来」的沉浸模式。
- 位置改动带走了一条死规则：`body.controls-visible #local-sync-badge{bottom:190px}`（右下角时代给抬起的播放控制条让位）已删除。`public/index.html` 一行未动 —— 指示器一直是运行时懒建的。
- **`Date.now()` 不是「代号」，不能拿来当扫描世代标记。** 曲库清理原先是 `DELETE FROM files WHERE root_id=? AND seen_at<>?`，把毫秒时间戳当本轮扫描的身份；Windows 的时钟粒度可能有十几毫秒，两次扫描落在同一刻时上一轮留下的行会被当成「本轮见过」躲过删除 —— **用户删掉的歌一直留在音乐库里**。发布 PR 的 CI 红出来的（`removed` 应为 `1` 却是 `0`），本机把 `Date.now()` 冻死后必然复现。现在每个根维护严格递增的 `nextSyncStamp`（首次同步探一次 `MAX(seen_at)`，之后内存里 `max(now, 高水位 + 1)`）。以后凡是「用时间戳区分两批数据」的写法，先问一句「两批会不会落在同一刻」。
- **CI 偶发红一次，先当真缺陷查，不要先按重跑处理。** 这次那条测试在本机永远绿（真实时钟会走），只有 CI 的时钟粒度把它逼出来；重跑一次大概也会绿，但缺陷会跟着安装包发出去。判定标准是「能不能构造出必然复现的条件」——能，就是缺陷。
- 验证：全量 Node 回归 `846/846`（上一版基线 `834`），`tests/local-library-auto-sync.test.js` 从 12 例扩到 23 例，另加一例冻结时钟下的清理回归。本轮未启动本机 Electron，**指示器在真实窗口里的落位与主题切换效果没有肉眼验证过**，全部结论来自源码/CSS 的逐条自动化断言。

### 2026-09-03 - v1.8.1 整机备份：身份不许存绝对路径，取消不许写半截

- 用户原话：「再最新版的基础上继续更新增加：导出：`mineradio.backup` 包含：`{ version:2, database:{ songs, playlists, favorites, history }, config:{ theme, eq, player }, paths:{ musicFolders } }` 默认不备份：❌ 音频 ❌ 大封面缓存 ❌ 临时文件 然后：新电脑导入。」
- **需求里给出的数据结构就照搬成落盘格式，不要「优化」它。** 四段 `version` / `database` / `config` / `paths` 一字未改，只多一段 `meta` 用来在导入前认出这文件是哪台机器哪一版导的；测试用 `deepEqual(Object.keys(...))` 把顶层与每段的键序钉死，往里加字段会红。用户写出来的形状就是验收标准。
- **「新电脑导入」这半句话决定了整个数据模型：备份里一处绝对路径都不能有。** 本机歌曲身份 `localKey` = `绝对路径:size:mtime`，歌单/收藏引用键和 SQLite `song_key` 全由它派生，直接存下来换机盘符一变全体扑空（文件明明在，只是路径不同）。改存 `{folder, rel, size, mtime}`，导入时按新根重拼绝对路径、重算全部派生键。**凡是要跨机器搬的数据，先找出「本机唯一标识」里那截会变的部分，把它换成相对量。**
- **归一化函数的输出不能反过来当原始数据用。** `normalizeLocalLibraryPathKey` 会 `toLowerCase()`，拿它的结果切出的 `rel` 拼回去是全小写路径 —— Windows 上照样能打开文件，但 `localKey` 是逐字符比较的、对不上，连同机导入都复不出原身份。正确写法是「用归一化串算长度、从原始串尾部切」（归一化只替换分隔符和大小写、不改长度）。分隔符同理，要按目标根路径是 Windows 还是 POSIX 现算，错一个字符就等于换了一首歌。
- **判断「某个目录在不在这台机器上」之前，先确认手里的 API 有没有前置授权要求。** 第一版用 `readLocalFileRange` 探备份里的音乐文件夹，走进死路：`resolveAuthorizedLocalFile` 要求目标在「之前扫描登记过的授权根」之下，全新会话里授权表是空的，探任何路径都必然 `LOCAL_FILE_NOT_AUTHORIZED` —— 同机导入也会被误判成换机、每次弹选择框。换成 `refreshLocalMusicFiles(folder, [])`：主进程侧先 `rememberLocalMusicRoot`（不是目录就抛）再只重建传进去的那批记录，传空数组等于「只验目录、不走盘」，顺带把根登记进授权表，代价接近零。**探测手段的失败要能区分「目录不存在」和「我没权限问」，否则这个探测没有意义。**
- **「用户取消」必须返回一个与「查无此物」不同的值。** 重选目录那步取消要 `return null` 让整个导入放弃、一个字节都不写；返回 `[]` 会被下游当成「这份备份没有音乐文件夹」继续往下覆盖歌单 —— 覆盖操作里最容易写错的一处就是把空结果和放弃混成同一个返回值。
- **复用累加语义的写接口时，要把「重复执行会翻倍」当成设计输入，而不是 bug。** 播放次数走既有的 `bumpPlayStat`（`play_count = play_count + excluded.play_count`），新机器空表上累加等于赋值，所以不用给数据库加任何新方法；代价是同机重复导入次数翻倍，于是导入做成两步确认（第一次只提示并记时间戳，`12s` 内再点才真走）。**幂等做不到的时候，就把不幂等明确暴露在交互上。**
- **`0` 在下游可能是「未提供」的同义词。** 主进程是 `toInt(input.lastPlayedAt) || Date.now()`，所以传 `0` 的歌会集体假装刚刚听过、污染最近播放。统一垫 `1`（1970 年那一毫秒）：次数保住，排序仍排在所有真实记录之后。**跨进程传时间戳前，先看接收方怎么处理假值。**
- **体积约束要落到具体字段上。** 用户点名不要「大封面缓存」，对应的具体动作是：历史记录里的 `cover`（base64 dataURL，一条几十 KB）一律清成 `''`，每首歌的自定义封面/节拍图/自定义歌词整块不进备份。测试直接断言序列化后的字节数上限，防止以后有人往里加字段时悄悄把「几 MB」吹回「几十 MB」。
- **同一份数据有新旧两处存储时，导入必须写新的那处并删掉旧的。** 音效档案真身在 IndexedDB 用户态 `user-fx-archives`，localStorage 里那份是旧版遗留；只写用户态不删旧键，启动时旧档案会把刚导入的顶回去。抹临时键同理，`removePersistentLocalStorageItem` 要连 `desktop-ui-state.json` 里的镜像一起清。
- **新增 IPC handler 的插入位置要避开按锚点切源码的测试。** 两个备份 handler 必须留在 `ipcMain.handle('mineradio-export-json-file'` 之前，因为 `tests/import-json-file-size-limit.test.js` 是按 `mineradio-import-json-file` → `ui-state-read-sync` 这对锚点切片的，插进那段会污染它。新代码块自己也夹在一对锚点里跑 vm，所以**这段里新增任何裸标识符都会 `ReferenceError`**，跨切片调用一律 `typeof` 守卫。
- **靠「顺序继承」生效的注册要在文档里写明，否则挪一下位置就静默失效。** `fx-backup-fold` 没进 `fxPanelTargetForNode`，它落到「高级」页靠的是 `organizeFxPanel` 里 `current` 从前一个节点（`fx-eq-fold` / `fx-plugin-fold`，都归 advanced）继承下来；一旦被挪到某个非 advanced 折叠区上面，就会跑到别的页去而且没有任何报错。
- 验证：全量 Node 回归 `864/864`（上一版基线 `846`），新增 `tests/mineradio-backup-export-import.test.js` 18 例（含用手写 JSON 塞 `"__proto__"` 验白名单 —— 对象字面量 `{__proto__:x}` 是设原型、只有 `JSON.parse` 才会造出真自有属性）。发布前补跑过一次本机 Electron 启动冒烟（只杀自己那个 PID，不用 `taskkill /IM electron.exe`）：干净开到 `home-revealed 10963ms`、`app.js` 零报错，日志里唯一那条 `Failed to construct 'URL'` 来自 `node:electron/js2c/renderer_init`（本轮 diff 里 `new URL(` 出现 0 次，产不出它）。**备份面板在真实窗口里的落位、真实文件对话框、导入后重启与真机换机导入仍没有肉眼验证过**，那部分结论全部来自 `node:vm` 跑真实源码 + 源码逐条断言。

### 2026-09-03 - v1.8.2 多格式歌词：分流顺序即语义，KRC / QRC 必须排在 YRC 前面

- 用户原话：「在最新版的基础上继续更新目前歌词： 有显示即可 升级： 多格式歌词 支持： LRC KRC QRC TTML等」。**「有显示即可」被当成明确的范围界定**：新格式解析进原有歌词行结构就算完成，不为它们做新界面 —— 合「能不动 UI 就不动 UI」。
- **KRC / QRC / YRC 的行头一模一样（`[起点,时长]`），唯一的区分特征是词项分隔符，所以分流顺序本身就是语义的一部分。** KRC 是 `<偏移,时长,0>正文`、QRC 是 `正文(起点,时长)`、YRC 是 `(起点,时长,0)正文`。**`parseYrcText` 认到行头就收，找不到自己那种词项也照样吐 `yrc-line` 整行**，所以 KRC 与 QRC 的嗅探必须排在 `parseYrcText` 之前 —— 排后面的表现不是报错，而是「歌词显示出来了，但没有逐字，正文里还夹着 `<0,400,0>` 这种标记」。第一版就是把两个嗅探写在 YRC 之后，靠读 `parseYrcText` 的回退分支才发现，测试里已钉一条专门的顺序断言。
- **同一族格式加新成员时，先去读现有那个解析器的「兜底分支」，而不是只读它的正例。** 上一条那个坑的根源就是只看了 YRC 的 happy path。凡是「多个解析器按顺序试、谁返回非空就算谁的」这种分流，排前面的解析器有多宽容，决定了排后面的还有没有机会。
- **分流要认格式自身的特征，不要认后缀名。** 用户手里的歌词文件后缀经常和内容不符（下载工具乱改、手动改名）。TTML 认 `<tt …><p …>` 标签、QRC 容器认 `LyricContent=` 属性、KRC 加密二进制认 `krc1` 魔数。附带好处：改过后缀的加密 KRC 也能读，而且「正文里带方括号的 TTML」不会被 LRC 抢走。
- **`DecompressionStream` + `Response` 在 Chromium 和 Node 18+ 都是全局对象**，所以 KRC 的 deflate 解压不用引依赖也不用碰 `node:zlib`，同一份代码在渲染层跑、在 `node:vm` 测试里也跑。带 zlib 头的以 `0x78` 开头先试 `'deflate'`，否则先试 `'deflate-raw'`，两种都试一遍。**解压失败返回空字符串而不是抛异常** —— 歌词坏了不该把整首歌的播放流程带崩。
- **KRC 的 16 字节异或常量是公开的格式常量，不是凭据**，源码注释里写明了这一点，免得以后被当成硬编码密钥清掉。
- **「宁可时间粗一点也不丢字」是本轮定下的取舍。** QRC 少数导出工具漏写最后一个词项的时间标记，正文剩一截在标记之外；补成「从上一个词项结束到行尾」而不是丢掉。静默丢字比时间不准严重得多。
- **`reg.lastIndex` 必须在 `while ((m = reg.exec(s)))` 循环体里就地取，不能等循环结束后再读** —— `exec` 返回 `null` 的那一次会把 `lastIndex` 归零，循环外读到的永远是 `0`。这就是上一条那个补尾逻辑第一版没生效的原因。
- **TTML 的词项 span 要用负向前查只匹配最内层**（`<span\b([^>]*)>((?:(?!<span\b)[\s\S])*?)<\/span\s*>`），否则外层那个包整行的 span 会把正文再吃一遍、行文本直接翻倍。译文与罗马音靠 `ttm:role="x-translation"` / `x-roman"` 剔除，剔的时候要连同它在 `plainBody` 里的那段一起去掉，否则整行回退路径又把译文捡回来。**整段 TTML 用扫描而不是 `DOMParser`**，因为解析逻辑要能在没有 DOM 的 `node:vm` 切片里跑。
- **`finalizeLyricLineDurations` 的第二个参数决定「格式明确写出来的时长」保不保得住。** 传 `true` 才跳过 `[0.45, 12]` 那道 LRC 时代的钳制。KRC / QRC 的行头时长是格式写死的，和字幕 cue 同等对待，所以两个都传 `true`；LRC / YRC 的时长是推断出来的，继续走钳制。测试里用一条 20 秒的行钉死这件事。
- **新歌词后缀要同时进四处清单，少一处就是「某条路径下歌词读不到」而不是报错**：`public/app.js` 的 `LOCAL_LYRIC_FILE_RE`、`desktop/main.js` 的 `LOCAL_LIBRARY_EXTS` + `LOCAL_LIBRARY_MIME`、`server.js` 的 `LOCAL_FILE_MIME`、`public/index.html` 的两个导入 `accept`。测试直接遍历后缀数组去断言这四处，防止以后加第十种格式时漏。**`.krc` 的 MIME 必须是 `application/octet-stream`、不许挂 charset** —— 加密二进制被当文本走一遍解码就废了。
- **把读文件从「顺手返回字符串」拆成「先拿字节、再决定怎么解码」，是加二进制格式的前提。** 原来的 `readLocalTextFile` 三条读取通道（`file.arrayBuffer` / 桌面 `readLocalFileRange` / `FileReader`）都直接吐文本；抽出 `readLocalTextFileBytes` 之后，歌词走 `readLocalLyricText`（字节 → 认魔数 → 必要时解密 → 解码），其它调用方行为一字不变。**这样一改会挪动按锚点切源码的测试的边界** —— `tests/local-file-range-memory.test.js` 的切片起点要跟着改到新函数名，`tests/local-lyric-cache-residency.test.js` 里的桩函数名要跟着改，两处都是改完才发现红的。
- 已知边界：**加密的 QRC 网络负载（三重 DES + zlib）本轮不解密**，落到磁盘的 `.qrc` 通常已是明文 XML 或裸 body；同名多份歌词文件仍按文件枚举顺序取第一个，**没有引入按后缀排优先级的规则** —— 那会改掉现有 `.lrc` / `.txt` 的既有行为，超出本轮范围。
- 验证：全量 Node 回归 `871/871`（上一版基线 `864`），新增 `tests/multi-format-lyrics.test.js` 7 例，全部用 `node:vm` 跑生产源码切片。本轮未启动本机 Electron，**三种新格式的真实歌词文件在窗口里的逐字高亮与桌面歌词表现没有肉眼验证过**，结论全部来自源码逐条断言（含用 `node:zlib` 反向打包出真实 KRC 加密二进制再走生产解码链的往返测试）。
- **发布环节新记一条：Release 不是 `release.yml` 建的，是 electron-builder 建的，而它会抢出两个草稿。** 工作流里只有 `gh release upload … --clobber`，没有 `gh release create`；真正建 Release 的是 `npm run build:win` 那步带了 `GH_TOKEN` 之后 electron-builder 的自动发布器，它按资产并发上传时会并发建草稿。`v1.8.2` 这轮就同时躺了两个 `draft:true`、同一秒创建、同名 `1.8.2`、同 tag 的 Release：`382099367` 四个资产齐全，`382099368` 只有一个字节相同的重复 `.blockmap`。**草稿查不到不等于没有 —— `gh api …/releases/tags/vX.Y.Z` 对草稿只回 404**，必须用 `gh api "…/releases?per_page=8"` 枚举。发布前先枚举、确认多出来那个没有独有内容（`body` 为 `null`、资产 digest 与正式那个重复）再删；**同一个 tag 上留着第二个草稿会让下一次 `gh release upload` 认错目标**。删 Release 不动 git tag。
- **标题与正文也是手工设的**：`gh api -X PATCH …/releases/<id> -f name=… -F draft=false -F make_latest=true -f body="$(cat 临时文件)"`，正文按 `v1.8.1` 的三段式（`## 下载` / `## 变更` / `## 歌词怎么放`）先写进一个不进版本库的临时文件，发完删掉。**102 MB 安装包一次 `curl` 会超时**（本轮拉到 83 MB 断），先单独拉三个小资产、再 `curl -sSL -C - --retry 5` 续传补完 exe。

### 2026-09-04 - v1.8.3 QRC 加密歌词：没有真实样本时，只能靠两条独立路径互证

- 用户原话：「1.8.3 做成：QRC 加密歌词支持 + 歌词格式兼容增强例如QRC 加密 / 歌词优先级 / 同名多歌词选择 / 歌词编码自动识别 / 歌词时间轴异常修复 更新好后发布新版」。**「例如」后面那五项被当成明确的验收清单而不是举例**，五项各自配了断言，界面仍按「能不动 UI 就不动 UI」只加一行候选按钮容器。
- **在野实现里那些看起来像 bug 的写法，就是格式本身的一部分，不许顺手修正。** QQ 音乐那份 DES 移植至少五处与 FIPS 46-3 不同：S 盒两组笔误（`15,2,8,15` 与 `10,10`）、PC-2 用 `pos - 27` 而不是 `pos - 28`、密钥按小端 32 位字取而不是大端字节序、跑 15 轮后再补一个半轮、末轮不交换左右半边。**改任何一处，密文全错，而且错得没有任何报错**。移植这类算法时先假定每一处「怪」都是有意的，逐位对着在野源码抄，等测试全绿之后再考虑要不要动。
- **`node:crypto` 里有同名算法，不等于它能当参考实现。** `des-ede3` 是规范 3DES，和上面那份偏差版对不上，所以整个链条一个字节都没法用它交叉验证。**发现「手上没有可信参考」的那一刻，就要换成两条独立路径互证**：这一轮写了一份完全独立的 `BigInt` 转写（位操作全部用大整数、不复用生产代码的任何一行）逐轮比对，另外钉了六组已知答案向量（同一输入 `0011223344556677` 过六个方向，还断言六个输出互不相同）加一段全链密文。
- **没有真实样本时，往返测试（自己加密再自己解密）几乎没有价值。** 它只能证明代码自洽，不能证明和对面的实现一致 —— 加密器和解密器可以一起错。测试里那面「镜子」（`E(K1)→D(K2)→E(K3)`）只用来造测试输入，**结论全部押在已知答案向量与独立转写上**。
- **识别二进制格式要先证明「它不是文本」，而不是先证明「它是密文」。** `qrcEncryptedPayloadBytes` 三道闸：带 UTF-16LE/BE 或 UTF-8 BOM 的一律判文本、十六进制载体要求半字节数是 16 的整数倍、二进制载体要求含控制字符且长度对齐 8 字节。**宁可把密文漏判成文本（用户看到乱码，能自己反馈），也不能把明文误判成密文（现有能用的歌词突然全空）。** 判定顺序上 `krc1` 魔数排在 QRC 之前，因为魔数是确定性证据、启发式不是。
- **MIME 一旦挂上 charset，这个格式就永远只能是文本了。** v1.8.2 给 `.qrc` 定的 `application/xml; charset=utf-8` 是这一轮才暴露的自埋坑：加密二进制在到达解密函数之前就已经被按 UTF-8 解码坏了，改成 `application/octet-stream` 才通。**加新格式时 MIME 要按「这个后缀最坏可能装什么」定，不按后缀名的字面意思定** —— `.qrc` 字面上像 XML，实际上可能是密文。
- **给多候选加优先级排序时，排序必须限定在既有的匹配层次之内。** 歌词查找本来是「精确路径 → 同目录同名 → 模糊名」三级依次尝试，`LOCAL_LYRIC_FORMAT_RANK` 只在每一级内部比；一旦拉平成全局排序，隔了三层目录的 `.qrc` 就会抢掉同目录的 `.lrc`，表现是「明明旁边就有歌词，偏偏读了别的」。**加排序规则前先问清楚「现在这批候选是怎么来的」。**
- **来自用户磁盘的文件名是不可信输入，用它当对象键就是原型污染入口。** 音频叫 `constructor.mp3` 时，`maps.byName[key]` 取出的是 `Object` 本身，`Object.length === 1` 让它冒充「有一个候选」，于是 `findLocalLyricFile` 返回 `undefined` 而不是 `null` —— **症状不是崩溃，而是歌词静默读不到**，能撞上的键只有小写形式（`constructor` / `toString` / `valueOf` / `__proto__`）。修法是统一走 `localLyricCandidateBucket()` 加一道 `hasOwnProperty`。同一轮里 `localLyricPickForSong` 的 `picks[key]` **故意没加守卫并写进了文档**：那里的键一律带 `local:` / `local-id:` / `meta:` 前缀，构造不出原型键，「哪里不需要守卫、为什么」和「哪里需要」一样值得记。
- **「自动识别编码」这个功能的第一条规则是「什么时候不识别」。** `isStrictUtf8Bytes` 通过就直接返回、绝不进候选打分 —— 用户现有的 UTF-8 歌词一个字节都不许因为「我猜它是 GBK」而变。它对「结尾截断在多字节字符中间」返回 `true` 也是有意的：歌词走范围读取，尾巴被切断不代表编码不对，**判定函数要区分「这段数据不是 X」和「这段数据被切短了」**。
- **打分函数要数「这个错误编码会产生什么」，而不是数「解码器报了多少错」。** 第一版按 U+FFFD 计数选编码，结果 GBK 文本按 `windows-1252` 解出来一个替换字符都没有（单字节编码每个字节都合法），永远选不出正确答案。改成同时数 C1 控制字符（`0x80`–`0x9f`）与私用区（`0xe000`–`0xf8ff`）才分得开。候选顺序 `gb18030` → `big5` → `shift_jis` → `euc-kr` → `windows-1252`；无 BOM 的 UTF-16 靠零字节的奇偶分布嗅，少于 8 字节不猜。
- **`[offset:±N]` 的符号方向和直觉相反，改之前先查规范。** LRC 里正值表示歌词**提前**出现，所以 `lyricGlobalOffsetSeconds` 要返回负增量；偏过头的行必须夹到 0，否则负时间会把 `lines.sort((a,b) => a.t - b.t)` 之后的高亮定位整体带乱。Enhanced LRC 的逐字标记要跟着整行一起偏移，所以 `parseEnhancedLrcBody` 多收一个参数。
- **时间标签的小数位必须按实际位数缩放，不能固定当毫秒。** `[00:01.1234]` 按毫秒算会变成 1.234 秒（十倍误差）。另外 `[01:02:50]`（拿冒号当小数点的老写法，= `mm:ss:cc`）和 `[01:02:03.400]`（带小时）**只能靠「段数 + 有没有小数点」区分**：三段无小数点按 `mm:ss:cc`，四段才有小时字段。分钟数放宽到三位，一小时以上的长音频不会再被两位分钟截断。
- **想给一个已有的同步函数加字段之前，先看有没有测试钉着它的字段清单。** 手动选歌词的传播本该塞进 `syncLocalSongAssetFields`，但 `tests/local-lyric-cache-residency.test.js` 把它的字段清单当驻留契约钉死了，加字段等于改契约、红一片。改成新写一个 `propagateLocalLyricPick` 各走各路。**契约测试红了不一定是代码错了，也可能是「这个改动本来就不该放这儿」的信号。**
- **清缓存标记时要分清「没读过」和「读过且结果就是空」。** 切换歌词候选要清六项状态，其中 `localLyricCacheHydrated` 必须置 **`true`**（不是 `false`）：置 `false` 会让下一次 `ensureLocalLyricsForSong` 认为「还没读过磁盘缓存」，回头把刚被换掉的那份歌词灌回来 —— 表现是「选了另一份，一切歌又变回原来那份」。**布尔标记语义是「读过没有」而不是「有没有内容」时，清空动作要把它置真。**
- 工具链两条，本轮踩到就记住：一是 **`vm.runInNewContext` 是新 realm，注入 `Object` / `Array` 只遮全局绑定**，vm 里造出来的字面量仍继承 vm realm 的原型，`assert/strict` 的 `deepEqual`（= `deepStrictEqual`）会因为原型不同而红，比较前必须 `{ ...obj }` / `Array.from(arr)` 拷回宿主 realm；二是 **Bash 工具的 heredoc 会把 `\\` 折成 `\`**，所以**绝不要在 Python heredoc 的字符串字面量里写 `\u`**（会 `SyntaxError: truncated \uXXXX escape`）—— 带中文与反斜杠的文档内容一律先 `cat > _frag.tmp.md <<'EOF'` 落盘，再用纯 ASCII 的 Python 脚本按正则锚点拼接，Python 侧一律显式 `encoding='utf-8'`。
- **控制台里的中文乱码通常只是显示编码问题，不是文件真的坏了。** 本轮因为 `print(repr(s))` 打出乱码，误判 `CHANGELOG.md` / `README.md` / `README_EN.md` 三个文件写坏并 `git checkout --` 全部回滚重写；随后用 `ascii()` 验证提交消息，证明字节一直是正确的 UTF-8。**验证文件字节要用 Read 工具或 `python -c "print(ascii(s))"`，不要相信终端里看到的字形。**
- **同一个「乱码假警报」本轮又犯了第二次，只是换了入口：`json.load(sys.stdin)` 在这台 Windows 上按本地代码页解码，不是 UTF-8。** 核对 PR #39 标题时打出的是一串错位的 `\uXXXX` 转义，看着像标题真写坏了；改用 `subprocess.run(...).stdout.decode('utf-8')` 复核，标题从头到尾都是对的，`v1.8.2` 那次 PR #38 的「乱码」也是同一个假警报。**规矩定死：核对任何中文字段都不经 `sys.stdin`，一律显式 `decode('utf-8')`；给 `gh` 传中文走 `--body-file` 或 `--input -` 的 JSON，不塞 argv。**
- **electron-builder 的双草稿不是偶发，是每次发布都要处理的一步：** 同一秒建出两个草稿 Release（本轮 `382473294` 四个资产齐全、`382473295` 只有一份逐字节相同的 `.blockmap`，两个 `body` 都是 `null`）。`gh api .../releases/tags/vX.Y.Z` 对草稿一律返回 404，**只有 `gh api ".../releases?per_page=8"` 枚举才看得见它们**，所以发布前必须先枚举、确认多出来的那个没有独占内容、然后**只删 Release 不碰 git tag**。本轮完整发布链路与四项资产摘要记在 `RELEASE.md` 的 `## v1.8.3` 小节。
- 验证：全量 Node 回归 `881/881`（上一版基线 `871`），新增 `tests/lyric-format-hardening.test.js` 10 例，全部用 `node:vm` 跑生产源码切片。已知边界：**手上没有一个真实的加密 QRC 文件可以对照**，也没有启动本机 Electron，**真实加密 QRC / GBK 歌词 / UTF-16 歌词在窗口里的显示效果与候选按钮的实际观感没有肉眼验证过**。

### 2026-09-04 - v1.8.4 音乐库维护：拿不准的必须单独报，不能塞进名单也不能咽掉

- 用户原话：「继续更新发布v1.8.4」加一棵树：`音乐库维护` 下挂 `重复检测` / `失效文件` / `无封面` / `无歌词` / `标签异常`。五项被当成明确的验收清单，每项各自配断言。
- **二值判定在这里必然是错的。** 无封面 / 无歌词 / 标签异常都可能在「还没扫到」的状态下被问：报成异常，整库刚导入时会把所有歌都报一遍；算成正常，真缺封面的歌会被永久漏掉。所以每条结论是 `has` / `none` / `unknown` 三态，`unknown` 的数量单独摊在卡片副标题上写成「N 首待扫描」。测试把 `unknown` 计数单独断言，**未来哪次改动悄悄把待扫描重分类成缺失就会红**。
- **`localCoverLoaded` / `localLyricLoaded` 为真且没有内容，本身就是定论。** 因为后台扫描与轻扫描落空时，只有可截断格式才置 `localCoverLightScanned` / `localLyricLightScanned`，否则直接置 `localCoverLoaded` / `localLyricLoaded`。原设计里的 `canReadTruncatableEmbeddedCover` / `canReadTruncatableEmbeddedLyrics` 因此整个去掉，少了两处跨切片依赖。**`localLyricLoaded` 必须排在「同目录有同名歌词文件」之前**，否则一个空的或解密失败的 `.lrc` 会被永远算成「有歌词」。`canReadEmbeddedCover` 在浏览器 realm 可能不存在，调用点一律 `typeof` 守卫，拿不准时记待扫描而不是记缺失。
- **重复检测的归一化故意不剥 `(Live)` / `(Remix)`。** 剥掉会把现场版和录音室版判成同一首 —— 这类误报比漏报难受得多。归一化只做 `toLowerCase` 加去空白加去成对符号。分组键是归一标题 + `String.fromCharCode(1)` + 归一艺术家，**用控制字符当分隔符是因为归一后的标题里绝不会剩控制字符**；写成 `String.fromCharCode(1)` 而不是裸控制字符（`public/app.js:7101` 既有的裸 `\x01` 是老代码，没跟着改）。撞键后 `localLibraryMaintenanceDuplicateLike` 复核：体积相同直接算重复、时长都大于 0 且差超过 2 秒的摘掉、**时长还没读出来时返回 `true` 不摘**（免得扫描进度改变结论）。标题空到连文件名都兜不出来时分组键为空串，那些歌只进待扫描，不然会挤成一大组假重复。
- **失效文件不能挂在分类缓存上。** 它是五项里唯一要问磁盘的，而 `invalidateLocalLibraryCategoryIndex()` 每次歌单查表都会被调用，挂上去的磁盘结论活不过一次渲染。所以 `localLibraryMaintenanceProbe` 单独存活、**故意不被 `invalidateLocalLibraryMaintenanceIndex()` 清掉**；结果按 `localKey` 记，改过标签的歌 `localKey` 会变、自然匹配不上、自己掉出名单。没探测过时名单是空的且副标题说「点击开始检测」，和「查出来确实是空的」在渲染层是两句不同的话。
- **新增 IPC `mineradio-local-music-probe-entries`，主进程只回状态码。** 此前没有任何按文件问存在性的通道（`refreshLocalMusicFileEntries` 只从快照回灌、根本不 stat 磁盘）。`probeAuthorizedLocalFiles` 套 `trustedMainFrameHandler`，逐条先走 `resolveAuthorizedLocalFile` 再 `fs.promises.stat`（**授权检查必须在 stat 之前，测试按源码位置断言**），回一个与入参等长同序的 `states`，取值只有 `ok` / `missing` / `blocked`；返回体只有 `states` / `checked` / `ok` / `truncated` 四个键，测试用 `Object.keys(...).sort()` 钉死，**任何文件内容都不出主进程**，preload 那侧也只暴露路径。目录不算文件（`ok` 只给真文件）。**`blocked` 必须和 `missing` 分开**：授权失败不等于文件被删，混成一个会把一整批误报成丢失。上限 `LOCAL_LIBRARY_PROBE_MAX = 2000` 且截断如实回 `truncated: true`，空数组不起 worker，并发宽度 `LOCAL_LIBRARY_PROBE_CONCURRENCY = 8` 有断言。
- **渲染层切批 `LOCAL_LIBRARY_MAINTENANCE_PROBE_BATCH = 400`，每批回来刷一次面板**（900 首的用例断言问了 `[400, 400, 100]` 三批、面板刷了 5 次：循环前一次 + 每批一次 + 收尾一次，全是 `{animate:false}`）。**回来的 `states` 长度和这一批对不上就整批作废抛 `PROBE_STATES_MISMATCH`，绝不按位置错配** —— 错配的表现是把还在的歌报成失效。探测失败留原因、名单不污染，浏览器环境直接说「当前环境不支持磁盘检测」。已有结论不重复跑，只有「重新检测」强制重跑。
- **资产扫描不改 `localKey`，所以「长度 + 首尾键」的签名认不出内嵌封面 / 歌词刚读完。** 另加 `localLibraryMaintenanceEpoch`，在 `syncLocalSongAssetFields`（资产结论的唯一汇流点）顶上用 `typeof` 守卫着加一 —— 守卫是必需的，`tests/local-cover-full-residency.test.js` 与 `tests/local-lyric-cache-residency.test.js` 会把那个真函数切进 vm。面板签名 `localLibraryCategoryDomSignature` 要把五个现算数字和探测状态整份折进去，否则早退分支会吃掉重绘。
- 桶表查询一律走 `localLibraryMaintenanceBucket()` 的 `hasOwnProperty` 闸门，和 v1.8.3 那个 `constructor.mp3` 的坑同源：`library-fix:constructor` 这种 kind 不能把 `Object.prototype` 上的东西取出来当名单。
- 界面零改动：五项是 `localLibraryCategoryHomeCardsHtml()` 里的第三段卡片，点进去复用整套既有的分类列表渲染器，**`public/index.html` 与 `public/app.css` 一行未动**。首页副标题的入口数把这五项算进去（`智能分类 · 15 个入口`）。失效文件那一项抬头把「播放全部」换成「重新检测」，卡片上也不给 ▶ —— 文件已经不在了，播只会一路报错。
- **测试切片是拼realm的：** `tests/library-maintenance.test.js` 把模型段（`function normalizeLocalPlaylistKind(kind)` 到 `function localSongIndexByKey(songs, key)`）和渲染段（`function localLibraryCategoryHeadHtml(view, count)` 到 `/* 分组项也走面板的懒加载额度`）**拼进同一个 `vm.runInNewContext`**，所以只需要 `escHtml` / `songCoverSrc` / `localLibraryCategoryStatMode` 三个桩，卡片上断言的数字是生产代码真算出来的、不是测试自己捏的字符串。空态断言切 `function renderLocalLibraryPlaylistPanel(opts)` 到 `function toggleLocalLibraryLike(index)`（注意结束锚点不能用 `localLibraryPlaylistPanelItemCount`，它在起始锚点前面）。主进程探测切 `async function probeAuthorizedLocalFiles(paths)` 到 `async function refreshLocalMusicFileEntries(folderPath, snapshotOrFiles)`。**动这些函数名或拆分它们之前先 grep 一遍 tests 里的锚点字符串。**
- 踩坑记两条：分类 id 里**没有 `recent`**（真名是 `all` / `recent-added` / `recent-played` / `most-played` / `never-played`），写错会让 `localLibraryCategoryView` 返回 `null` 然后在 `.mode` 上炸；带盘符的测试路径**不能在 heredoc 里写反斜杠字面量**（Bash 工具会把两个反斜杠折成一个、JS 再把它当无效转义吃掉，`D:\\Music` 会变成 `D:Music`），要用 `String.fromCharCode(92)` 拼。
- 顺带改一处既有测试：`tests/local-library-categories.test.js` 原来钉 `selectLocalPlaylist(libraryKindCard.getAttribute(...))` 一整个表达式，点击钩子为了拿 kind 判断要不要起首次探测拆成了 `var libraryKind = …;` 两行；选择改断言（仍把调用绑在卡片属性上）而不是在生产代码里重复一次 `getAttribute`。
- 验证：全量回归 `905/905`（上一版基线 `881`），新增 `tests/library-maintenance.test.js` 24 例，`node --check` 过 `public/app.js` / `desktop/main.js` / `desktop/preload.js` / `server.js`。已知边界：**五张卡片与检测结果在真实窗口里的观感本轮没有肉眼验证过**，浏览器模式下失效文件只会说「当前环境不支持磁盘检测」。

### 2026-09-04 - v1.8.5 播放统计漏账：结算点、防抖写入、无时长文件、最小化空档

- 用户原话：先是「为什么有些歌曲不显示这些信息」→「我的意思是没显示播放统计」→「修复一下」，然后「发布新版 更新介绍简单明了不要说废话」。**空态有一半是设计**（跳过的歌本来就不记账），所以第一步是把「设计如此」和「真漏账」分开，只修后者。
- **`flushPersistentVisualState` 原本不结算听歌会话。** 它绑在 `beforeunload` / `pagehide` 上，只存歌词布局、自由相机、音量、播放会话和 UI 备份，退出前正在听的那一首永远不进统计。补上 `finalizeListenSession(false)` 放在最前面（它会产生新的待写状态，必须排在冲队列之前）。`finalizeListenSession` 内部会把 `listenSession` 置空，所以两个事件都触发也只结算一次。所有调用一律套 `typeof x === 'function'` 加 `try/catch`：测试会把这个函数单独切进 vm，并且有一例只给一个空 realm 断言它不抛。
- **顺着查出更前面一层：结算写的那份必然丢。** `saveListenStatsState()` → `scheduleLocalUserStateWrite` 是 120ms 防抖，页面卸载时那个 `setTimeout` 不会再执行，所以哪怕结算了也写不进去。拆出 `runLocalUserStateWrite(id)`（立即执行一条并 `clearTimeout`）与 `flushLocalUserStateWrites()`（遍历冲全部，走 `hasOwnProperty` 闸门），待写载荷从定时器闭包搬进 `localUserStatePendingWrites` —— **原来的载荷只活在闭包里，外面根本冲不出来，这是必须重构而不是加一行的原因**。写入令牌 `localUserStateWriteTokens` 的语义不变（后到的写覆盖先到的），冲完 `delete` 掉所以重复冲不会写第二遍。**`function scheduleLocalUserStateWrite(id, value, legacyKey)` 这行签名不能改**，`tests/complete-optimization-gates.test.js:58` 钉着。九份用户状态里的六份（自定义封面 / 歌词 / 歌词候选 / 节拍图 / 节拍偏好 / 音效档案）同一个漏法，一起好了。
- **不能靠改 hydrate 的取值优先级来兜这个洞。** 一开始想的是卸载时同步写一份 `localStorage` 镜像，但 `hydrateLocalUserStateRecord` 是 IndexedDB 记录优先、legacy `localStorage` 只在没有 IDB 记录时兜底 —— 镜像会被那份更旧的 IDB 记录直接盖掉，等于白写。唯一正确的做法是把真正的 IDB 写入提前发起。
- **`updateListenStatsTick` 第一行的 `!audio.duration` 让结算门里的 30 秒兜底成了死代码。** APE/DSF 走虚拟 WAV、或元数据还没解析出来时 `audio.duration` 是 NaN，一旦在这里早退 `listenMs` 恒为 0，于是 `finalizeListenSession` 里 `(!audio || !audio.duration ? session.listenMs >= 30000 : false)` 这条分支永远不可能成立 —— **兜底和它要兜的那个洞是同一个条件写出来的，所以互相注销**。门槛改成只看 `audio.paused`，`maxProgress` 那行自己用 `isFinite(duration)` 兜住 NaN。
- **最小化空档原本一次只补 4200ms。** `schedulePlaybackTickTimer` 在 `document.hidden && !isLiveBackgroundKeepMode()` 时直接不排 tick，回前台那一次的增量被 `Math.min(..., 4200)` 吃掉，后台听三分钟只记 4.2 秒，等于后台听歌只能靠 `maxProgress >= 0.5` 兜。改成音频与墙钟推进量对得上（差值不超过 `max(1500, paired * 0.25)`）时才整段补回，上限 `LISTEN_TICK_CATCHUP_MAX_MS = 1800000`（单首歌 30 分钟，声明在 `var listenSession = null;` 旁边，测试从源码切出来用、不硬编码）。
- **贯穿的安全性质：补账基数始终是 `Math.min(deltaByAudio, deltaByWall)`，两个时钟对得上只提高上限、绝不抬高基数。** 所以三种假收听都进不来：拖进度条（音频跳、墙钟不跳）、卡顿（墙钟跳、音频不跳）、长时间暂停（`audio.paused` 直接早退，且恢复后 `lastWallAt` 已被刷新，暂停那段不会被回补）。原来那句 `delta < 8000` 在 4200 的上限下恒真、本就是死代码，跟着去掉。
- **45 秒 / 一半进度 / 听完这三条结算门槛是设计，一字未动。** `localKey` 是 路径:size:mtime、改标签或转码会让旧记录变孤儿，这一点同样按原样保留 —— 都不在「修复」范围内，改了就是偷偷改行为。
- 切片锚点：`var LISTEN_TICK_CATCHUP_MAX_MS = ` 到换行加 `var appPerfMarks`、`function beginListenSession(` 到 `function mostPlayedSong(`（计时与结算拼进同一个 realm，`listenMs` 是真跑出来的不是伪造的）、`function flushPersistentVisualState() {` 到 `window.addEventListener('beforeunload'`、`function runLocalUserStateWrite(` 到 `function hydrateLocalUserStateRecord(`。**动这四处函数名前先 grep tests。**
- 写测试时自己踩的坑：`暂停期间不累计收听` 那例最初让 `audio.currentTime` 在 `paused = true` 期间也往前走 —— 现实里不会发生，而且两个时钟看起来是对齐的，于是恢复后那一 tick 会把 61 秒全记上、测试反而绿。改成只推墙钟，`listenMs === 3000` 这条断言才真正钉住「暂停的那段绝不回补」。
- 验证：全量回归 `912/912` 通过（上一版基线 `905`），新增 7 例；**七例先 `git stash` 到修前源码上对跑过一遍、全红**。界面零改动，`public/index.html` 与 `public/app.css` 一行未动；**真实窗口里的播放统计本轮没有肉眼验证过**。
- 顺手发现但本轮没修（用户没要求）：`renderArtistSongList`（`public/app.js` 约 19403 行）在该 `html +=` 的地方写了 `return`，目前是不可达的死代码。

### 2026-09-04 - v1.8.6 左下小封面接上歌曲详情：两行改动，顺手改的那一版被否掉

- 用户原话：「你加上一个这个封面可点击进入歌曲详情界面就行了 然后发布新版」，配图是左下角 `#thumb-wrap` 那张 64px 小封面（`IF YOU` / `BIGBANG · MADE SERIES 《D》 · FLAC · ...`）。
- 改动一共两行：`public/index.html` 的 `<img id="thumb-cover">` 加 `onclick="openTrackDetailModal('song')"` 与 `title="歌曲详情"`；`public/app.css` 第 573 行 `#thumb-cover` 规则加 `cursor:pointer`。**没有新增任何 JS。**
- **空闲态不用额外守卫，别再加。** `openTrackDetailModal` 第二行就是 `if (!song) { showToast('先播放或选择一首歌'); return; }`；而且 `#thumb-wrap` 在拿到 `.visible` 之前是 `pointer-events:none`（`public/app.css:571-572`），没在播歌时这张封面根本收不到点击。
- **上一轮那版「让上下两行一致」被用户当场否掉。** 用户先报「点上面和点下面应该进入歌曲信息一样啊怎么不一样」，我把 `#thumb-artist` 与 `#control-artist` 的 `openTrackDetailModal('artist')` 改成 `'song'`、`title` 一并改成歌曲详情；用户随后回「这个不用改了」，两处已完整还原。**歌名 → 歌曲详情、歌手行 → 歌手详情这个分工是设计，以后不要顺手改成一致。**
- 歌手详情的其余入口没被碰过，仍是三处：`openSearchResultArtist`（搜索结果里的 `.search-artist-link`）、`openQueueArtist`（播放队列行）、`openPlaylistPanelDetailArtist`（歌单详情行），都走 `openArtistDetailForSong` → `openTrackDetailModal('artist', song)`。
- 底部控件的 `#control-cover` **故意没跟着加点击**：它是 `aria-hidden="true"` 的装饰性 `div`，挂点击就得连带处理无障碍语义（role / tabindex / 焦点圈），而用户只点了左下那张。要加的话是独立一轮。
- `#thumb-cover` 规则里那句 `transition:transform .15s ease` 是历史遗留，**全表没有任何 `#thumb-cover:hover`**，所以它当前不触发任何东西。本轮故意没补 hover 缩放（「能不动 UI 就不动 UI」），并且用 `assert.doesNotMatch(appCss, /#thumb-cover:hover/)` 把这个「不加」也钉进测试，以后想加得先改测试、别当成漏写补上去。
- `tests/now-playing-detail-click.test.js` 4 例，纯静态断言（读 `index.html` 的属性、`app.css` 的规则体、`app.js` 里那句兜底的正则），不切 vm：封面进歌曲详情、标题/副标题分工不变、`cursor:pointer` 在且没有 hover 规则、空闲态两条 `pointer-events` 加弹窗兜底。**元素匹配用 `<(?:img|div) id="..."` 因为封面是 `img`、其余三个是 `div`。**
- 验证：全量回归 `916/916` 通过（上一版基线 `912`）。四例先 `git stash push -- public/index.html public/app.css` 到改前源码上对跑过，封面 `onclick` 与 `cursor:pointer` 两条判红。**真实窗口里没有肉眼点过这张封面。**

### 2026-09-05 - v1.8.7 音域回响（这一节前半段的判断已作废，见下一节）

> **作废声明（后于本节写下）：下面第 2 条「接不了原代码」是错的，「原项目」指的不是 CmzYa 的 Workshop 作品，而是本仓库的上游社区分支 [XxHuberrr/Mineradio](https://github.com/XxHuberrr/Mineradio)** —— 它的 `public/sonic-topography-preset.js` 一直是公开源码、GPL-3.0、与本仓库同许可，本来就该直接移植。v1.8.7 发出去的自研频谱环已在 v1.8.8 里整体换成移植实现，`SPECTRUM_ECHO_*` 那一整套（`DataTexture` / `uSpectrumTex` / `uPreset > 6.5` 分支 / 对数分频 / 行推进）**源码里已经不存在了**，本节第 4～15 条（`### 2026-09-05 - v1.8.7` 这一节从上往下数，即 `**技术上真正的门槛是数据**` 那条起到 `预设登记` 那条止）与最后一条只作为历史记录保留，别照着它去找代码；第 3 条（WE 集成那条路）仍然有效。**本节里「以后别把它描述成移植」这句话已经作废，正确的表述见 `### 2026-09-05 - 音域回响改成移植上游实现` 那一节。** 全屏退出那一半（本节倒数第 6 条到倒数第 2 条）不受影响，仍然有效。

- 用户原话（issue 形状，两件事）：「增加视觉预设：希望增加音域回响视觉预设（Wallpaper Engine)(作者CmzYa）。全屏模式退出时，有明显的黑屏卡顿问题。」建议里写「可以从原项目的项目代码去接入实现」。
- ~~**先说结论：接不了原代码。**~~（**这条判断错了，见本节顶部的作废声明。**）后台把 `/c /d /e /f` 全盘扫过找 Steam Workshop 目录 `431960`，零匹配；WebSearch 也没能定位到这件作品。直接搬 Workshop 作品的代码/素材还有授权与署名问题。所以做的是**在 Mineradio 自己 shader 框架里的原创同名预设**，`presetMeta` 里写 `频谱回响 · 致敬 CmzYa`。~~以后别把它描述成移植或接入原项目代码。~~ ——**当时漏掉的一步是：先去看用户给的上游仓库有没有这份源码。它有。**
- 顺带确认另一条路本来就通：项目已有 Wallpaper Engine 集成（`desktop/wallpaper-engine-library.js`，`WALLPAPER_ENGINE_APP_ID = '431960'` 在第 10 行，扫 `steamapps/workshop/content/431960` 与 `steamapps/common/wallpaper_engine/projects/myprojects`）。用户在 WE 里装了「音域回响」，今天就能把真作品当桌面壁纸层或播放器背景板跑，和原生预设是两条独立的路。
- **技术上真正的门槛是数据，不是着色器。** 帧循环把 `frequencyData` 一次扫描就压成 `bKick/voc/mInst/tHigh/rms` 五个标量再推成 `uBass/uMid/uTreble/uBeat/uEnergy`，着色器手里没有任何逐频段信息，所以「音域」根本画不出来。解法是新开一条通路：64 频段 × 64 历史行的 RGBA8 `DataTexture`（`spectrumEchoTex`，16 KB，60fps 下约 1 MB/s 上传）。
- 历史推进用 `copyWithin(ROW_BYTES, 0, len - ROW_BYTES)` 把旧行整体下移一行，新帧写第 0 行。**故意没用环形索引**：环形要在着色器里做 wrap 数学，而且 `LinearFilter` 会在环绕边界插出一道缝。`DataTexture.flipY = false`，所以纹理 `v = 0` 就是最新行——这一点反直觉，改采样坐标前先想清楚。
- 四个通道各有用处：R = 归一幅度（`pow(raw / peakRef, 0.82)`，`peakRef` 跟随衰减峰值、有 `0.10` 地板），G = 起振 `0.55` / 收尾 `0.16` 的包络（单帧就带余韵），B = `clamp01((norm - env) * 2.6)` 的瞬态，A = 该行的 `beat * 0.78 + energy * 0.46`。
- 着色器读法就是这个预设的立身之本：角度 = 音域（`bandN = abs(aUv.x * 2.0 - 1.0)`，`aUv.x = 0.5` 是低音、落在正下方，向两侧升到高音，首尾无缝），半径 = 时间（`age = lane / 0.86`），`texture2D(uSpectrumTex, vec2(bandN, age))`。`decay = pow(1.0 - age, 1.35)` 让旧回响更弱、`baseR = 1.02 + age * 3.55` 让它更开、`pos.z = -age * 3.9 + ...` 沉成漏斗纵深。每条频段内再散一层 `thick` 厚度，否则回响圈会变成一根细线。外圈 14% 的 lane 留给只吃 `uTreble` 的空气尘，避免画面边缘硬切。
- 分频走对数：`ensureSpectrumEchoBins(binCount)` 从 bin 2 起（跳掉直流和最低两个 bin）、上界 `max(minBin + 64, floor(len * 0.55))`、`ratio = log(maxBin / minBin) / 64` 几何步长，每段 `max(prev + 1, round(...))` 保证严格递增且至少一个 bin，于是低频段窄、高频段宽，跟着人耳走。
- 行推进 `SPECTRUM_ECHO_PUSH_INTERVAL = 1 / 48`（64 行 ≈ 1.33s 回响）与帧率解耦，**掉帧时最多补一行、不做追赶式连推**（`accum = min(accum - interval, interval)`），否则回响会突然抽一下；低帧率下只是回响变慢，不会跳。
- 成本控制：`updateSpectrumEchoField` 第一行就是 `if (!fx || fx.preset !== SPECTRUM_ECHO_PRESET_INDEX) return;`，另外 7 个预设一次纹理上传都没有。进出这个预设都 `resetSpectrumEchoField()`，否则再次进入会先闪一帧上次残留的频谱。停播后 `sampled = false` 但历史继续推进，旧回响一路走到外圈自然散尽，而不是冻在最后一帧。
- 着色器分支三条硬约束：① 星河/安魂那支收成 `else if (uPreset < 6.5)`，预设 7 用最后的 `else`；② `vBright` 与 `gl_PointSize` 里 `uPreset > 6.5` 的分支**必须排在 `> 4.5` 之前**，否则会被星河那支吃掉；③ 唱片专属的 `vinylHiResGuard` 用 `step(3.5, uPreset) * (1.0 - step(4.5, uPreset))` 夹住，不许溢到 7。
- **新 sampler 只能挂在 `uniform sampler2D uCoverTex, uPrevCoverTex, uEdgeTex, uRippleTex, uSpectrumTex;` 那一行。** `bloomVs` 是由 `vs` 做两次精确字符串替换派生的（`'uniform float uMouseActive, uPixel, uColorMixT, uLoading;'` 与 `'gl_PointSize = sz * uPixel * uPointScale;'`），这两句必须逐字节不变，所以不能另起一行声明 uniform。
- **本轮唯一真实踩坑，值得单独记：`var len = frequencyData.length;` 在 `public/app.js` 里必须唯一。** `tests/audio-analysis-hot-path.test.js:139` 拿这句当切片起锚，而我第一版在 `updateSpectrumEchoField` 里也声明了同名局部变量、位置还更靠前（4242 行 vs 43278 行），`indexOf` 直接切到我的函数上，那条常驻测试的「单次扫描只能有一个 `for (var i = 0; i < len; i++)`」当场变成 2。改名 `binCount` 才修好。**在热路径附近新增代码前，先 grep 一遍测试用的切片锚点是不是被自己撞了。** 同理帧钩子只放在 `uniforms.uEnergy.value = audioEnergy;` 之后，一个字都不进那段被钉住的单次扫描区。
- 转场：`wallpaperFlow` 提成共享谓词 `isSoftFlowPreset(preset)`，覆盖 5 和 7——铺满视野的连续场硬炸开会撕碎整片粒子，只给极轻的一下（`duration 0.30`、`uScatter + 0.008`、`uBurstAmt 0.05`、`camPunch 0.04`）。相机基线 `p === 7` → radius `8.6` / phi `0.16` / theta `0`；`orbit.baselineTheta = p === 5 ? -0.52 : (p === 6 ? 0.18 : 0.0);` 那行原样没动，预设 7 正好要 theta 0。
- 预设登记：`presetMeta` 第 8 项 `{ name: '音域回响', desc: '频谱回响 · 致敬 CmzYa' }`，`presetIcons` 配了自己的 SVG（一组同心声波弧），`presetDisplayOrder = [0, 7, 6, 5, 4, 2, 1, 3]` 把它排到第二位。**所有预设夹取都是 `presetMeta.length` 或 `SKULL_PRESET_INDEX` 驱动的**（`normalizeFxArchiveSnapshot` / `setPreset` / `buildPresetGrid`），所以追加索引 7 会自动被持久化接住，不用改 schema。
- 全屏退出这一半：根因是**遮罩被后到的信号一路顺延**。退出时 resize、`applyWindowedBounds` 的边界还原、`leave-full-screen` 状态推送会连发好几轮，原本每轮都重排回亮计时器，等于让遮罩一直等最后一个信号，看上去就是整段黑屏。现在 `scheduleFullscreenTransitionReveal` **只允许提前**（`if (fullscreenTransitionState.revealDue && due >= fullscreenTransitionState.revealDue) return;`），resize 或尺寸已跳变用 50ms、纯状态推送用 110ms。
- 硬上限 `FULLSCREEN_TRANSITION_MAX_COVER_MS = 320` **独占 `deadlineTimer` 一个计时器槽**：resize/state 只会重排 `revealTimer`，抢不掉也清不掉兜底，所以遮罩时长有确定上界。动作前摇 110ms（遮罩铺好才调原生退出）、收尾 220ms；`prefersReducedFullscreenMotion()` 下是 20 / 90 / 30 / 80。完全收不到任何回亮信号时，`deadlineTimer` 仍会揭开遮罩并把 `active` / `revealDue` 收干净。
- `desktop/main.js`：`applyWindowedBounds` 先算 `const settled = current.x === target.x && ...`，`if (!settled) win.setBounds(target, false);`，**边界已经到位就不再重复 setBounds，但仍然 `sendWindowState(mainWindow)`**；`leave-full-screen` 与 `leave-html-full-screen` 两个事件都立刻把状态推给渲染层。`scheduleMainRendererViewportRefresh` 的补偿刷新去重（`clearTimeout(mainRendererViewportRefreshTimers.pop())`），避免反复重建渲染缓冲。
- CSS 只动了必须动的三条 `body.fullscreen-transition* #desktop-window-shell` 规则：**窗口壳过渡不能带 `filter`**——`#desktop-window-shell` 承载 WebGL 画布，加 filter 会让整窗每帧重新合成，这正是「卡顿」那一半的来源；现在只留 `will-change:transform`。遮罩层 `#fullscreen-transition-layer` 用 `rgba(0,0,0,.62)`，回亮 `transition:opacity .2s`。
- 测试写法上的一个坑：回响排空的单调递减断言**必须先把 64 行历史铺满再断言**。历史没铺满时推一行静音，掉出去的是全零行、进来的却带包络余韵，总量会先涨——最初写成 8 行铺垫就判红了，是测试的错不是实现的错。同理「全部归零」需要约 100 次推进（包络先要衰减到 round 后为 0，再走完 64 行），`history + 2` 不够。
- 验证：全量回归 `932/932` 通过（v1.8.6 基线 `916`，本轮新增 16 例）。着色器在真实 GLSL 编译器上编译链接过——Electron + `--use-gl=swiftshader` 跑了一遍 vs/fs/bloomVs/bloomFs，两个 program 都 link 成功，`uSpectrumTex` 是 ACTIVE_UNIFORM（证明真被用上、没被优化掉）。**这个预设和重调后的全屏过渡都没有在真实窗口里肉眼看过。**

### 2026-09-05 - 音域回响改成移植上游实现（v1.8.8）

- 用户纠正的原话：「和原项目的回响不一样这是原项目 https://github.com/XxHuberrr/Mineradio」。**「原项目」= 本仓库的上游社区分支，不是 CmzYa 的 Wallpaper Engine 作品本体。** 上一轮我把这两个概念读混了，于是扫盘找不到 Workshop 目录就断定「源码拿不到」，做了个自研频谱环还在文档里写「不是移植」。**教训很具体：用户说「从原项目的项目代码去接入」时，第一步应该是去看他给的那个仓库里有没有这份文件，而不是去猜他指的是哪个「原项目」。**
- 另一条同样具体的教训：这一轮一开始我起了一个 13 个 agent 的 Workflow 去并行调查，用户当场制止——**「不要跑多个agent」**。已记进 `memory/no-multi-agent-fanout.md`，之后全部串行手做。
- **用户中途追加过一条约束：「改好先不发布新版本我本地先看一下效果」**，所以移植做完先停在工作区、五处版本钉一动没动；等他本地看完之后改口「更新好后发布新版」，才按 v1.8.8 走完整套发布流程。**这两句的先后顺序值得记：同一个任务里用户的发布意愿会变，别拿早先那句当永久约束，也别不问就抢先发。**
- 顺带查到一件事：**v1.8.7 的 GitHub Release 已经不在了。** tag `v1.8.7`（`929ed72`）本地和远端都还在，`Build and Release` run `33938522336` 当时成功、`RELEASE.md` 也记着已 PATCH `make_latest=true`，但现在 `releases/tags/v1.8.7` 返回 404、草稿 0 个、`releases/latest` 停在 `v1.8.6`——是发布之后被删掉的。所以 v1.8.8 发出去时是从 `v1.8.6` 直接跳过来的，停在 1.8.6 的客户端会一步更新到 1.8.8。
- 移植对象：上游 `public/sonic-topography-preset.js`（1081 行，commit `89c0d23`，GPL-3.0）。它自己标注移植自 `yin-yizhen/sonic-topography` 1.1.1（commit `3ff303e`），再往上是 CmzYa 的 WE 作品《音域回响》（Workshop 物品号 `3747222633`）。**两边同为 GPL-3.0，所以移植在许可上是干净的，只需要保留同一许可并署明出处**——出处链写在 `NOTICE.md` 新增的 `## Community Contributions` 一节与新文件的文件头。
- 落地形态是**独立兄弟脚本**：`public/sonic-topography-preset.js`（1083 行，IIFE 挂 `window.MineradioSonicTopography`，导出 `{INDEX, isActive, update, clear, onPresetChange, pointerRipple}`），`public/index.html` 在 `app.js` 之前多一行 `<script src="sonic-topography-preset.js"></script>`。**不塞进 `app.js` 是为了完全绕开那套着色器字符串机器**——`bloomVs` 由 `vs` 做两次逐字节精确替换派生（锚点 `'uniform float uMouseActive, uPixel, uColorMixT, uLoading;'` 与 `'gl_PointSize = sz * uPixel * uPointScale;'`），上一版为了塞 `uSpectrumTex` 必须小心不碰那两句，这一版地形用自己的 `ShaderMaterial`，那两句一个字节都不用动。
- 打包侧零改动：`build.files` 本来就是 `public/**/*`，新脚本自动进包；没有任何测试去扫 `index.html` 的 script 标签，这条已写成新测试里的断言，以后加脚本别指望有测试拦你。
- 三处**行为等价但写法与上游不同**的地方，是有意的，别当成移植错漏去「修回去」：① 涟漪寿命常量插值进 GLSL（着色器里能看到 `2.10,4.80`）；② `bindVisualRotation` 只吃 ctx，不去摸全局；③ `syncTerrainUniforms` 把 `themeAudio` 提成一个共享局部量。另外上游有四个字段在本项目里查证是死的、移植时丢掉了：`manualYaw` / `dummyObj` / `lastOrbitTheta` / `orbitThetaReady`。`update` 里多加了一句 `if (!scene) return;`。
- **唯一需要真适配的是音频量纲。** 上游有一套细粒度频谱监听，本项目只有 `{bass, mid, treble, beat, energy}` 五个标量，所以 `readMineradioAudio` 从这五个值推 8 段频谱与 `kickEnvelope`。上游的触发阈值一个都没改（涟漪 `kickEnvelope > 0.58`、0.32 复位再武装、流星 `> 0.62 && random < 0.045`），改的是入口：本项目 `beatPulse` 峰值约 `0.62~0.92`，所以帧循环传 `beat: Math.min(1, beatPulse * 1.35)`。**要调涟漪触发频率就调这个 1.35，不要去动模块里的阈值**，那是上游的手感基准。
- **帧钩子的位置是硬约束：必须排在 `updateSkullParticleLayer(dt, frameShelfState);` 之后**，也就是 `particles.rotation.x/y +=` 已经加完的那一行之后，地形才和主粒子层共用同一帧的旋转（与上游顺序一致）。传入的 `sonicTopographyCtx` 在模块外预分配、逐帧填字段：`scene`（1739 行）、`orbit`（1951 行）、`particles`（4812 行）都声明在它之后，所以**声明处只能写空壳**，60fps 下不造垃圾。模块从不读 `ctx.screenHeight` / `ctx.dpr`，别往 ctx 里加没人用的字段。
- 涟漪 uniform 打包沿用上游 `vec4(x, z, start, ±strength)`，**w 取负号 = 白色细涟漪**（军鼓与高频），正号是底鼓的蓝涟漪。`syncRippleUniforms` 排在 `updateAudioTriggers` 之前，所以**第 N 帧新增的涟漪要到第 N+1 帧才出现在 uniform 里**——测试把这条钉住了，看到「加了涟漪但这一帧读不到」不要当 bug 修。
- `update` 的顺序也被钉住：透明度积分 → `if (!active && opacity < 0.01) { 隐藏; return; }` → `if (!scene) return;` → `ensureLayer` → 旋转 → 布局 → `sonicTime += dt * (0.45 + motionSpeed*0.017)` → uniforms → 触发器 → 写矩阵 → `root.visible = opacity > 0.02`。**透明度积分故意排在 `!scene` 早退之前**，所以「没有场景时也会继续淡出」是正确行为。写测试时在这里踩过一次：无场景那一帧把透明度积到 0.05，下一帧切到预设 5 就不再满足 `!active && opacity < 0.01`，于是照样建了层——**这是对的淡出行为，要断言「冷启动不分配」必须换一个全新 harness，而不是去改实现。**
- 渲染结构：四个 `InstancedMesh`（地形 `BoxGeometry(boxWidth,1,boxWidth)` × gridSize²、悬浮方块 80、流星 20 个 `[0.4,1.2,0.4]`、尾迹 200 个 `[0.8,0.8,0.8]`），全部 `frustumCulled = false`、每帧只写实例矩阵。精度按画质档位封顶 `QUALITY_GRID_CAP = {eco:112, balanced:160, high:192, ultra:224}`，默认密度 46 → 156×156；`spacing = TERRAIN_BASE_SIZE(168) / gridSize`、柱宽 `spacing * (0.9/1.05)`。
- 交互：**画布上单击（不是拖动）会在指针落点打一道涟漪**，挂在 `mouseup` 上，判 `!mouseDownAt.hadDrag && !isPointerOverUi(e)`，按压时长换强度（`0.25 + 秒数*2.6`，上限 `3.0`），屏幕坐标映射到世界 ±17。点界面元素、拖视角都不触发。
- 环境侧：背景星河在这个预设下压到 `0.82`（`skullBackdropDim`，与上游一致，不压会糊成一片）；`isSoftFlowPreset` 仍覆盖 5 与 7；相机基线改成 radius `8.4` / phi `0.18`（v1.8.7 那版是 `8.6` / `0.16`）；`presetMeta[7].desc` 从 `频谱回响 · 致敬 CmzYa` 改成 `音域地形 · 移植 CmzYa`。
- 清理干净了上一版的整套自研子系统：`SPECTRUM_ECHO_PRESET_INDEX` / `spectrumEchoTex` / `updateSpectrumEchoField` / `resetSpectrumEchoField` / `uSpectrumTex` uniform 与 sampler 声明 / 着色器里 `uPreset > 6.5` 的两处分支全部移除，`else if (uPreset < 6.5)` 放宽回 `else`（注释头改成 `Preset 5 / 6 / 7: WALLPAPER PULSE …`）。`grep 'spectrumEcho|SPECTRUM_ECHO|uSpectrumTex'` 零命中，`tests/spectrum-echo-preset.test.js` 已 `git rm`。
- `tests/sonic-topography-preset.test.js` 16 例：自建 THREE stub（`InstancedMesh` 把 `setMatrixAt` 记成 `matrices[i] = {pos, scale}`），`Math.random` 注入以便确定性，钉的是行为而不是数值——流星未激活时藏在 `y = -1000` 且缩放 0、落地正好撒 10 粒尾迹、尾迹一秒内过期、切走预设整层释放显存、冷启动停在预设 5 时一个实例都不分配、涟漪 N+1 帧可见。**three.js r128 的 `Color` 不做 sRGB→linear 转换**，所以 stub 直接按十六进制解析、不要加伽马。
- 验证：`node --check` 干净，全量回归 `939/939` 通过（v1.8.7 基线 `932`，新增 16 例、删掉失效的 9 例）。**地形层没有在真实窗口里逐帧核对过**——涟漪强度、配色跟封面的搭配这类观感项只能靠肉眼，发 v1.8.8 时仍是未确认状态，按移植的忠实度发出去、留给反馈再调。
- 悬而未决：上游仓库里还带着一份 CmzYa 的 WE 打包产物（约 1.26 MB，上游没有附署名文件）与一个 `mineradio-bridge.html` 桥接页。本轮**只搬了原生地形层，没有 vendor 那份产物**。
- v1.8.8 的四项资产校验值、双草稿第七次复现、以及发布后把本机 `D:\Mineradio` 更到 1.8.8 时踩的 NSIS 坑，都记在 `RELEASE.md` 的「发布记录（v1.8.8）」一节。那个 NSIS 坑值得单独记一句，因为它会让人误判成「安装器坏了」：**`allowToChangeInstallationDirectory: false` 的静默安装装的是「上次记住的目录」**，`Setup.exe /S` 连跑三次都 `exitCode=0` 而 `D:\Mineradio` 纹丝不动，实际是装进了 `D:\222\Mineradio`；真实目录要从注册表卸载项的 `UninstallString` 读（`InstallLocation` 是空的），指定目录得用 `/D=`（必须最后一个参数、不加引号），而且已存在的快捷方式不会被重写、要自己改 `TargetPath`。

