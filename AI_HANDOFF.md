## 2026-11-12：v2.7.2 翻译焦点与窗口偏移已发布

- 已正式发布：[PR #183](https://github.com/oirge/Mineradio/pull/183) → merge `1a7927cd`，annotated tag `v2.7.2`（tag object `594acaf4`），Build `43193412187` 成功；Release `442743490` 于北京时间 `2026-11-12 17:45:57` 公开并设 Latest，安装器 122279416 B。四资产完整回下载、SHA256／SHA-512、只读安装器版本及公开更新清单核验通过。
- 完整 Verify 43190678625 成功：Folia 131＋124、Node 1713 通过／0 失败／1 可选跳过及全部浏览器套件通过；原生 43190665737／43190678479 成功，三种关闭 scrollLeft=0、中心 693.5 且焦点恢复。失败基线、引导失败与实际 GPU 未测边界见 RELEASE.md。全程后台与云端，未操作用户安装或数据；沿用私密默认翻译构建链，不覆盖既有 2.7.1。
- 默认翻译仍可用，启用用户源时优先，默认配置详情不显示；这覆盖后文 2.7.0 取消默认源的历史要求。焦点恢复必须 preventScroll，桌面外壳必须保持不可滚动，原 SVG 质感不改。

- 合并后的原生 43193390052 再次成功。重复完整 Verify 43193389959 在既有 playback 脚本第 90 行点击桌面标题栏 local-open-playback 时发生 15000ms／outside of the viewport 超时；同一行、同类超时已存在于 2.7.0 的 verify-8859aaf-playback-failed.log，未放宽超时、断言或画质。发布依据是逐字节相同文件树的完整 PR Verify 成功与三次原生成功；不将该重复运行记为全绿。失败日志和工件另存 verification/release-v2.7.2/。

## 2026-11-12：v2.7.0 自定义翻译源与桌面维护

- 已正式发布用户指定的电脑版 `2.7.0` 四项维护与自定义翻译源。PR #179 → merge `81dda6cb`，annotated tag `v2.7.0`（tag object `856c5e18`），Build `43157574552` 成功；Release `442511923` 于北京时间 `2026-11-12 13:05:31` 公开并设 Latest。
- 不再提供默认翻译服务，旧免费备用强制关闭；保留缓存，未译歌词仅请求用户启用的 OpenAI 兼容端点。入口在 DIY 歌词设置、Folia 字幕设置与本地命令面板。
- 密钥仅主进程管理，系统加密／不随备份导出；请求需 POST、可信 origin 与随机会话 token。修补依赖、响应体流上限及翻译缓存 LRU，不改变唯一宿主音频与既有视频导出授权。
- 只做低优先级后台和云端工作，不在本机运行 Electron／浏览器、安装新版或操作用户播放器与数据。完整变更及结果见 RELEASE.md 顶部。
- 完整 Verify `43155780667` 成功，Folia `131＋124`、Node `1707` 通过／0 失败／1 可选跳过及全部浏览器套件通过；原生 Electron `43155780668` 的 Windows DPAPI／连接 `12/12` 和四档实际媒体验收通过。四资产完整回下载与公开更新清单核验通过，安装器 `122277612` B／只读版本 `2.7.0`。重复 push 旧菜单超时与真实接口未测边界保留于 RELEASE.md，不宣称每轮 CI 全绿。

## 2026-11-04：v2.6.10 固定帧率视频导出已发布

- 30／60／90／120 fps 导出均生成对应 CFR 成片；采集间隙重复前帧，修正 Opus 尾包真实时长，保留音频 bytes／PTS。新增 mediabunny 1.65.1，保持 WebM、唯一宿主音频、continue 默认和受限 tab 捕获授权。
- [PR #174](https://github.com/oirge/Mineradio/pull/174) → merge `9b8d268baa193cd19d79c79579036f158837f264`，annotated tag `v2.6.10`（tag object `981fe81fa21a6a7f634244afc31f56aa4f68740d`）；[Windows Build and Release 41794385510](https://github.com/oirge/Mineradio/actions/runs/41794385510) 成功。
- [v2.6.10](https://github.com/oirge/Mineradio/releases/tag/v2.6.10)（Release `433638334`）于北京时间 `2026-11-04 15:52:12` 公开，四资产、SHA256／SHA-512、只读安装器版本和公开 Latest／更新清单核验通过；安装器 `122637011` B。
- 最终实际媒体 [41793626131](https://github.com/oirge/Mineradio/actions/runs/41793626131) 在 `37d3da1634afd5005c68f00676373d286c7a00da` 成功，artifact `13304257757` 已核验。四档实际成片均通过帧数、n/FPS 格点、声明帧率及音画尾差门禁；最大逐帧格点误差 0.444 ms，尾差均小于 1/FPS＋1.1 ms。早期 `41792179357` 在 `ea73448546ee11fec89e9a822a78d5410abb335f` 的成功报告也保留。
- 最终完整 [Verify 41793626143](https://github.com/oirge/Mineradio/actions/runs/41793626143) 在 `37d3da1634afd5005c68f00676373d286c7a00da` 成功：Folia 130＋124、Node 1657 通过／0 失败／1 可选跳过，以及全部播放、工具、中英文／恢复浏览器回归通过；保留早期点击超时记录。
- 早期 Verify 41792179392 的全量 Node 1656 通过／0 失败／1 可选跳过，Folia 130＋124 通过；旧 preset-portability summary 普通点击 15000 ms 超时，不能记为全绿。
- 仅低优先级后台与云端工作；未发送邮件、启动本机 GUI、安装新版或操作用户播放器与数据。完整事实见 RELEASE.md 顶部。

## 2026-11-04：v2.6.9 视频导出四档帧率已发布

- 用户要求 30／60／90／120 帧，默认 30；基线 main 49ac3cf6，功能提交 7803e0f2。帧率与切歌策略合并保存在既有 options-v1 键，旧存档默认 30，整机备份保留两项，录制中重开面板显示宿主当前值。
- 原生 tab maxFrameRate、宿主更新间隔和视频码率均跟随选择。导出页不安装交互播放器 RAF cap；不启用 offscreen、stopPainting 或逐帧读回。保留唯一宿主音频、切歌 continue 默认／save 可选及 2.6.8 的受限捕获授权。
- 本地 Node 76/76、Folia 16/16、类型、构建／产物和发布门禁 19/19 通过。完整 Windows Verify 41781085478 成功：Folia 109＋124、Node 1644 通过／0 失败／1 可选跳过、全部浏览器套件通过。
- 实际媒体 41781085534 成功，四份成片分别用 30／60／90／120，native settings 与目标一致，全部独立媒体解码门禁通过。工件 13299815161，证据在 verification/video-export-frame-rates/cloud/，包括 frame-rate-checks.json 与 artifact API。
- 不宣称软件 GPU 持续达到目标帧率。合并重复媒体 41781546562 在 1080p 雾笺尾差 1.706 秒超过原 1.25 秒门禁；重复 Verify 41781546604 在既有播放设置点击移出视口后超时。未改断言、超时或画质，不宣称所有运行全绿。
- PR #172 已合入 1f06dce9ad0d8d333ba63acdca109cff7b907562，合并文件树与成功验收提交一致。annotated tag v2.6.9（tag object 799746fb8f13163813c9f013d155a423acca213a）；Windows Build and Release 41781563416 成功。
- Release 433559984 于北京时间 2026-11-04 14:22:36 公开并设 Latest，四项资产、SHA256／SHA-512、只读安装器版本与公开自动更新清单全部核验通过。安装器 122567073 B，比 2.6.8 小 17 B，无新增生产依赖或 FFmpeg；未安装新版、开本机 GUI 或操作用户播放器与数据。
- 收尾分支 docs/record-v2.6.9-release，发布证据在 verification/release-v2.6.9/。完整摘要与边界见 RELEASE.md 顶部。不重打旧 tag 或替换公开资产。

## 2026-11-04：v2.6.8 视频导出 Permission denied 已修复并发布

- 用户安装 2.6.7 后报告导出失败 Permission denied；基线远端 main `4820cbb2`，分支 `fix/video-export-permissions`。沿用修复后发布授权，仍禁止本机 GUI、安装和操作用户播放器与数据；本地命令 BelowNormal。
- 正式版默认 session 的 WE 权限处理器拒绝没有 WE grant 的视频导出；原独立验收没安装该处理器。仅加入真实配置的复现提交 `1ef5e2a2cc417202383899b6c483cd6d2ab1cf58` 在 Windows `41770428840` 得到相同 Permission denied。Electron 43 把 tab 捕获归属到被采集的隐藏窗口，mediaTypes 是空数组；不要误当摄像头权限全局放行。
- 导出管理器提供受限授权，正式 main 和云端验收都接到同一个 WE 处理器；仅当前 owner／surface 的主 frame、精确 URL、同源与 10 秒有效期内允许，首块编码数据／取消／保存后撤销。摄像头、麦克风、其他窗口／子 frame、桌面选择仍拒绝。具体约束见 `.context/pitfalls/mineradio-video-export-permissions.md`。
- 正式权限下的 Windows 实际导出／独立解码 `41771113928` attempt 2 在 `2216ec5408d11a0025198f232eb4bc66964767d5` 全部通过；包含整首横屏、雾笺竖屏真切歌／暂停、新歌词、1080p 无歌词、save／取消与窗口清理。本地相关 `52/52`、版本／公告／打包白名单／编码 `19/19`，语法与空白检查通过。
- 媒体边界：attempt 1 的竖屏尾部音画差 1.361 秒，触发原 1.25 秒门禁；同一提交不改代码、断言、超时或画质重试后全部通过。合并重复媒体 `41772204398` 同样通过权限及横屏，但竖屏尾差 1.446 秒失败，不能宣称所有媒体 CI 全绿或复杂软件 GPU 稳定 30 fps。发布时普通 Verify `41771113923`／`41772204417` 仍运行，Folia／Node／语法等基础步骤已通过，不把执行中视作全绿。
- PR #170 于 `2026-11-04T04:16:28Z` 合入 `802fbd55b321c3d2535374921aab654c676227c0`，文件树与上述验证提交一致；annotated tag v2.6.8（tag object `3901cae726411336b683e891ae21347d1aba03d7`）固定该提交，Windows Build and Release `41772216206` 成功。Release `433508708` 于北京时间 `2026-11-04 12:21:10` 公开并设 Latest，四资产回下载、SHA256／SHA-512、只读安装器版本和公开更新清单全部通过，未安装新版或操作用户播放器／数据。
- 安装器 `122567090` B，比 2.6.7 小 `567` B，无新增 FFmpeg 或生产依赖。收尾分支 `docs/record-v2.6.8-release`；资产与核验资料在 `verification/release-v2.6.8/`，成功媒体证据在 `verification/video-export-permissions/final-attempt2/`（artifact `13294723075`）。同名工件下载可能取到 attempt 1；必须用创建时间／正确 artifact ID 区分。完整资产摘要见 RELEASE.md 顶部；不重打 tag、不替换公开资产。

## 2026-11-04：v2.6.7 歌词／可视化视频导出（已正式发布）

- 基线 main 378a38d3，功能分支 feat/folia-video-export，最终录制修正 1abd8e7b，后续 fc701235 只改文档。PR #168 已合入 388c924492f46c16b006da8153ec7b1320607df7；annotated tag v2.6.7（tag object 0571e879c9ab73cd282e44459829906acbda0a6c）固定在该合并提交。Windows Build and Release 41768935756 成功；Release 433489269 于北京时间 2026-11-04 11:48:43 公开并设 Latest，已完成发布。
- 用户只选择视频导出，并明确默认切歌／跳转仍持续录制且画面跟随；另选保存已录片段。不要改成固定原曲独立后台音频，也不要默认切歌停止。策略独立键 mineradio-video-export-options-v1，须保留四层持久化／整机备份通路。
- hidden renderer 只画 VisualizerRenderer；原生 video track 使用可信宿主绑定的短时 tab token，直接送 MediaRecorder，不经 JPEG／Canvas；不要开启 Electron offscreen 或调用 stopPainting（云端证实会提前停帧）。主 public/video-export.js 保有唯一音频旁路和 MediaRecorder。不要桌面捕获／重设主窗口／另起播放器。Folia 0.7.16 与既有 selective sync 版本不变。
- 格式使用内置 WebM／Opus。Windows MP4／AAC 曾丢开头音频；等待 MediaRecorder start 事件又会录入静音片头（该事件须等合成帧与封装数据）。不要恢复 MP4 优先或在播放前等待该事件。Fume 首次准备必须等文章 canvas 挂载，切歌需跟随其布局重建。
- stop 须先同步暂停采集／断开录音旁路，留 1.5 秒输出已排队编码帧，再 stop／等待末块。立即 stop 会丢尾帧。WebM 时长处理见 desktop/video-export-webm.js：最多 64 KiB 前缀，原生头可能跨块甚至第一块只有 1 字节；回填 8 字节时长后才原子提交，不能缓存完整视频。
- 本机只低优先级后台检查，不开窗口、不安装、不改用户数据。云验收专用 .github/workflows/video-export.yml 和 scripts/verify-video-export-electron.js，仅允许 Windows GitHub Actions。
- 本地录制定向 42/42，最终 Windows 实际媒体／独立解码 41768335461 全部成功；0929c68b 的完整 Verify 41765944559 成功。最终 1abd8e7b 的 Verify 41768335717 编码、Folia 108＋124、Node 1634 通过／0 失败／1 可选跳过及语法检查通过；旧播放设置 local-open-playback 普通点击 15000ms 超时（iframe 拦截后元素移出视口），后续旧浏览器套件未全部执行，完整 CI 为 failure，不宣称全绿。
- 四项官方资产完整回下载，大小／SHA256 与 GitHub digest 和 SHA256SUMS 一致；安装器 SHA-512、只读版本 2.6.7／Mineradio 二创、公开 Latest API 与 latest.yml 均核验通过。安装器 122567657 B，比 2.6.6 小 29337 B；没有新增 FFmpeg 或生产依赖。录制期间仍有额外内存／GPU 开销，目标 30 fps 不等于所有效果稳定 30 fps。
- 收尾分支 docs/record-v2.6.7-release，忽略证据 verification/release-v2.6.7/ 与 verification/video-export/final/。完整资产摘要和验证边界见 RELEASE.md 顶部；不重打 tag、不替换已公开资产，不安装本次二进制。

## 2026-11-03：v2.6.6 辅助窗口任务栏预览修复

- 正确检出为远端 `oirge/Mineradio`，基线 `0a874b4`，工作分支 `fix/auxiliary-taskbar-previews`。
- `desktop/main.js` 两个辅助窗口构造增加 `type: 'toolbar'`，配合现有 `skipTaskbar`，覆盖标准／极简迷你播放器与桌面歌词。不要绑定主窗口 parent 或加任务栏轮询。
- 既有定向行为回归 `72/72`；隔离 Electron 43.7.9 已验证原生工具窗口样式，未完成人工任务栏预览、Alt+Tab 与完整生命周期交互验收。
- 用户明确「不要影响我使用电脑」；本轮隔离测试已关闭。后续只做低优先级后台检查和云端打包，禁止本机图形测试、抢占焦点、操作正在运行的播放器、安装或修改用户数据。
- 发布完成：PR #166 → merge `9f3832ce882a9fb20d9853efabd08aded4ba08cd`；annotated tag `v2.6.6`（tag object `2cf4942a2ea515774e57e66c1ff24fb695bb0dc9`），Build and Release `41595378190` 成功，Release `432380802` 于北京时间 `2026-11-03 15:24:08` 公开并设 Latest。四项资产、安装器只读版本与公开自动更新清单均核验通过；未安装本次二进制。
- 云端：Windows Verify 的编码、Folia 类型／行为、全量 Node、语法、播放设置和音频工具检查均通过；发布时完整中英文／恢复浏览器回归仍在执行，不宣称完整 CI 全绿。
- 收尾分支 `docs/record-v2.6.6-release`，忽略证据 `verification/release-v2.6.6/`，完整事实见 RELEASE.md 顶部；故障知识见 `.context/pitfalls/mineradio-auxiliary-taskbar-previews.md`。

## 2026-11-03：v2.6.5 四项功能与发布

- 用户要求「全部更新」，沿用完成后发布授权；正确检出以远端 `oirge/Mineradio` 为准，基线 `ce3f06b`，功能分支 `feat/folia-command-audio-tools`。PR #164 已合入 `8f05caa201f66396e0a93d8ac5771afc897215ce`；正式版 `v2.6.5` 已于北京时间 `2026-11-03 14:51:57` 公开并设 Latest，无待发布步骤。
- 已完成：本地命令面板、共享可配置快捷按钮、字幕快捷面板、宿主十段 EQ／音效／输出设备。保留唯一宿主音频、AudioContext、曲库和队列；两个槽位默认循环模式／收藏，重复选择自动交换。
- 字幕设置进入视觉预设与 JSON；槽位键 `mineradio-folia-local-controls-v1` 进入宿主持久化、桌面存档和整机备份白名单。桥接新增 `shuffleQueue`、`getAudioOptions`、`setAudioChain`、`setOutputDevice`，一次打乱不改模式或重启播放。
- 菜单 portal 到播放器根，唱片胶囊菜单打开时保留展开；父标题栏与 iframe 共用快捷键、关闭和焦点恢复。跨 realm 用能力判断而非 `instanceof HTMLElement`，仅在焦点仍属当前 document 时恢复，避免抢回父标题栏焦点。
- 本地 Folia `93` 项、Node 定向 `75/75`、全量 Node `1592` 通过／0 失败／1 可选跳过、最终类型检查、构建与七组真实浏览器验收通过。Windows Verify `41590576853` 的 Folia `93＋124` 项、全量 Node、既有播放六组和新增工具七组均通过；原 Folia 语言脚本在花火审计之后点击设置 summary 超过原定 30000ms，失败截图另超过 5000ms，后续旧套件未执行完，完整 CI 为 failure。未放宽断言、普通点击、超时和画质。
- annotated tag `v2.6.5`（tag object `855d426cd3b739f7b7698c06d4ce4b9ab43eb571`）固定在功能合并提交，Build and Release `41592105723` 成功；Release `432360249` 已正式公开。四项资产完整回下载、SHA256／SHA-512、安装器版本和公开更新清单核验通过，安装器 `122596789` B、SHA256 `6ecb7b017b113f69c1895c8e18f48c3c8d15d7afaa915c6e51c6c3694b73ae89`。
- 收尾记录分支 `docs/record-v2.6.5-release`，核验资料位于忽略目录 `verification/release-v2.6.5/`。详细内容和验证边界见 RELEASE.md 顶部；未做物理音频设备切换／热插拔或安装官方二进制，保留用户已安装版本和数据。

## 2026-11-03：v2.6.4 三项功能与发布

- 用户明确要求「三项全做完之后发布新版」。基于 PR #161 合入后的 `35dece3` 完成三项；PR #162 已合入 `531dd4128c85cbbfff2656cb2dfe7018bb803945`，正式版 `v2.6.4` 已于北京时间 `2026-11-03 12:13:20` 公开并设 Latest，无待发布步骤。
- 三项：Folia 三视图播放快捷面板（倍速／睡眠／ReplayGain／无缝与交叉淡化）；流光 classic 与云阶 partita 的 avoidOverlap；Lattice 仅当前歌曲序号。默认视觉布局保留，两个视觉开关默认关闭。保持唯一宿主音频与原音量百分比／滚轮。
- 桥接新方法与状态见 docs/FOLIA_BRIDGE.md；快捷面板单独组件，原生控件即时反馈，最后回包释放本地覆盖，失败恢复宿主值。倒计时只在面板打开时每 30 秒更新，时间轴仍走原 MotionValue。
- 上游防叠字需要的 GlowWord、timing、variants 与 Partita 布局从原大组件抽出，保留 @note；useOverlapFit 根据离散布局／尺寸／字体变化重新适配，没有逐帧 React 状态。开关进入本地归一化、预设 JSON、持久化和整机备份。
- 当前序号通过独立 latticeBadge 显式判定，避免从 latticeModel 运行时导入拉入完整在线 provider 应用。构建边界守卫已实际拦截过这种依赖，现已修正。
- 验证新增 scripts/verify-folia-playback-options.py，独立 `--suite playback`，CI 单独 5 分钟步骤；原六组浏览器预算、断言、普通点击和画质不变。上游几何单测加入 CI；本地新增浏览器六组全部通过（含重载与宿主对象身份），页面异常 0。完整 Windows Verify `41574692244` 成功：Folia `89＋124` 项，Node `1588` 通过／0 失败／1 可选跳过，新增六组及原有六套浏览器验收全部通过。
- 发布：annotated tag `v2.6.4`（tag object `0b2a18887ac620d1cab21c4a81f71c421f4b8619`）固定在上述合并提交；Build and Release `41576366140` 成功，Release `432269170` 正式公开。四项资产完整回下载、SHA256／SHA-512 与公开自动更新清单核验通过；安装器 `122587457` B，SHA256 `9486cfb46687c75e2d121b5171606ab754fe5d9a28d5f683030024ca05905741`，版本元数据 `2.6.4`／`Mineradio 二创`。未在本机安装运行，保留用户已安装版本及数据；完整结果见 RELEASE.md 顶部。
- 收尾记录分支 `docs/record-v2.6.4-release`；核验资料位于忽略目录 `verification/release-v2.6.4/`，不提交二进制，不重复打 tag 或替换已公开资产。

## 2026-11-03：预设校验、动态加载与文档修复

- 用户已安装 2.6.3，要求以最新 `oirge/Mineradio` 为基础「全部修复」。基线为远端 main `90b73db63090c8190f08e0d7a50399e5e081ea77`，分支 `fix/preset-validation-and-machi-timeouts`。
- Tempera 预设导入先校验图层数组、记录、ID、重复 ID、名称与数值类型，损坏文件在预设占位和图片事务前拒绝。存档恢复复用 `resolveStoredTemperaTuning`，把 null 图层恢复为空数组、过滤损坏记录并保留画质覆盖；有效图层导出／导入仍保留位置并重映射图片 ID。
- 复现了软件渲染／4 倍 CPU 限速下的 Machi 普通点击 30000ms 超时。有效 CPU 采样有约 30.25 秒落在 Vite 的预加载链接扫描：运行时导入包含 1892 项预加载依赖，重复遍历整套已存在的图标链接。嵌入构建现在只预加载动态导入的目标 JS，依赖由原生模块加载，入口预加载及 Vite 的 CSS 处理保持；最终产物每次动态导入最多 2 项，新增 Node 产物预算回归上限 16 项。
- 首次缩减预加载后仍采到 Nebbia 后台预热新建 WebGL 上下文与 Machi 初始化争用。设置面板打开时取消可选预热的 timer／idle callback，关闭后重新安排，当前效果与实时预览正常加载。未改着色器、分辨率、抗锯齿、场景、点击方式、断言或超时。
- 中英文 README 同步为 17 种歌词效果，补充预设互通、共享素材、歌单绑定与 Folia 整机备份范围；CHANGELOG 增量放未发布区。版本元数据仍为 2.6.3，未覆盖既有 tag／发布资产，也未更新用户已安装二进制。
- 本地验证：Folia 本地播放器与 Machi warmup 定向 13 文件／90 项全部通过，类型检查通过；Node 产物预算／许可证／文档编码 14 项通过，`build:folia`、`check:folia`、`node --check server.js` 和 `git diff --check` 通过。
- 实际 Chromium／SwiftShader 中英文验收通过：17 种歌词效果、5 种背景、语言双向同步和重载恢复，页面异常为 0。额外 4 倍 CPU 限速复测 Machi 普通点击 24.764 秒、截图 12.812 秒，均在原 30 秒／15 秒预算内，主场景和实时预览均实际出图；这不等于所有机器或远端 CI 已全部通过。
- 预设互通的 5 组真实浏览器验收全部通过：参数导出、损坏 Tempera 文件拒绝且预设／设置／IDB 图片完整保留、图片字节与同名另存、歌单绑定与宿主音频身份、整机备份／重载恢复／删除解绑。
- 性能采样与截图在忽略目录 `output/playwright/`，正式浏览器结果在 `artifacts/ui-language/`。远端交付结果见本节补充记录。

## 2026-11-02：v2.6.3 已正式发布

- 用户在四项修复已合入 PR #158 后明确要求「发布新版」。本轮基线 `1613ff7`，分支 `release/v2.6.3`；版本、前后端四条更新公告和英文词条同步为 `2.6.3`。
- 功能提交已通过完整 Windows Verify `41467393540`；本轮补做发布定向检查与正式 Windows 构建、资产校验，沿用用户减少重复测试的偏好。
- 发布完成：PR #159 → merge `48732efe8dd5d11c07b8dba50db4bf893c9fbe23`；annotated tag `v2.6.3`（tag object `1bdaae87fc9e5b0418c73e213a64da7db6910333`）；Windows Build and Release `41471341266` 成功。Release `431628261` 于北京时间 `2026-11-02 23:30:36` 公开并设 Latest，公开自动更新清单已为 `2.6.3`。
- 资产：四项官方文件完整回下载，大小／SHA256 与 API digest 和清单一致，安装器 SHA-512 与 `latest.yml` 一致；Setup.exe `122619114` B／SHA256 `4161d09f6c895b5778180c08326451d8d110d69606dbbf71fea4d0285293c405`。只读版本元数据 `2.6.3`／`Mineradio 二创`；没有在本机安装运行。完整摘要见 RELEASE.md 顶部。
- 验证：发布定向 `34/34`、语法／空白与 `check:folia` 通过，四条公告经真实解析器完整保留，前后端与英文词条一致。功能完整 Verify `41467393540` 已通过；纯记录提交重复 Verify `41470176879` 仍在町景设置 summary 点击超过 30000ms，失败截图超过 5000ms。发布重复 Verify `41471200578`／`41471313583` 截至资产核验时仍在运行，不记为全绿。CI 间歇超时仍有后续排查空间，本轮不扩大测试范围。
- 收尾记录分支 `docs/record-v2.6.3-release`；核验资料在忽略目录 `verification/release-v2.6.3/`。保持既有安装和数据身份，旧版本资产不替换。

## 2026-11-02：Folia 备份、预设互通与歌单绑定

- 用户在核对后要求四项「全部修复」。本轮分支 `feat/folia-backup-preset-portability`，基线 `975edfe`；版本仍为 `2.6.2`，增量记录在 CHANGELOG 未发布区。
- 整机备份白名单纳入 `mineradio-player-interface-v1`、`mineradio-folia-local-visuals-v1`、`mineradio-folia-local-lattice-v1`。真实导出／恢复回归先复现遗漏再修复；旧备份缺键不清空本机值。默认整机备份仍不携带二进制素材，图片由独立预设文件可选携带。
- 预设交换文件 `mineradio-folia-preset` v1；可携带头像／表情／肖像／背景和引用的 Tempera 图层图片。24 MB 文件、16 MB 图片总量、单张 8 MB、最多 64 张；完整校验后事务式落盘，失败回滚新预设。重名导入另存，Tempera 图片 ID 重映射避免覆盖原有图层；导入不自动应用。
- 歌单绑定存于同一 visual settings 键的 `playlistPresets`，绑定到宿主歌单 ID；`usePlaylistVisualPreset` 在进入歌单时应用一次，同歌单下一曲保留手动视觉调整，随机模式仍每曲抽一次。删除预设解除引用；不触碰音频、播放队列和视图路由。
- CI 调查：元数据合并 Verify `41448272667` 在町景设置 summary 点击超时，记录 PR Verify `41450076107` 在原视觉脚本超过 300 秒；main Verify `41450139696` 又完整通过。旧版本本机完整浏览器验收也通过，不能宣称已确定唯一产品根因。三个假设为渲染后端差异、持续动画负载、预览重绘。验收脚本现在共用 `ui_browser.py` 固定 Chromium／SwiftShader，并在截图时禁用 CSS 动画；不强制点击、不扩大超时、不删除断言。
- 已验证：整机备份 `24/24`、全量 Node `1587` 项（`1586` 通过、`0` 失败、`1` 可选跳过）、Folia 类型检查及 `71＋108` 项行为测试、最终生产构建和产物检查；本机六组浏览器验收全部通过，新功能真实浏览器四组通过。核验输出均在忽略目录。
- 交付：PR #158，功能提交 `754aaabaf88189fbd353990e04dc14117db0ac11` 的 Windows Verify `41467393540` 于 `2026-11-02T15:15:02Z` 完整成功，六组浏览器脚本均通过，包括中英文、错误恢复、原视觉、节拍预设与预设互通。版本保持 `2.6.2`，本轮改动尚未打包发布，没有打新 tag 或覆盖既有发布资产。

## 2026-11-02：v2.6.2 已正式发布

- 用户在三项功能合入 PR #155 后要求「发布新版」，本轮基于 `b1a754e` 的 `release/v2.6.2` 分支准备 2.6.2，版本与中英文更新公告同步。
- 功能完整 Windows Verify `41445712793` 已通过；本轮只补发布元数据、公告与文档，沿用用户减少重复测试的偏好，执行发布定向检查及官方 Windows 构建、资产完整回下载校验。
- 发布结果：PR #156 → merge `ecc35bedae1f81335ac099476c787994f9cc6c65`；annotated tag `v2.6.2`（tag object `cc0876b09df05eee354aa825ca48e77b4c6cbf65`）；Windows Build and Release `41448291635` 成功。Release `431462848` 于北京时间 `2026-11-02 21:03:24` 公开并设 Latest，公开更新清单已切换到 `2.6.2`。
- 资产核验：四项官方资产完整回下载，大小、SHA256 与 GitHub digest／清单一致；安装器 SHA-512 与公开 `latest.yml` 一致。Setup.exe `122596138` B / SHA256 `f5eaa3b467cd4d41e7542e9d205b235f4e444e35c06a095e250823b3679e7542`，版本元数据 `2.6.2`／`Mineradio 二创`。完整资产摘要见 RELEASE.md 顶部。
- CI 边界：发布定向 `34/34`、语法／空白及产物校验通过；元数据重复 Verify `41448173542` 的构建、类型、Node 和主界面／Folia 中英文、恢复、原视觉验收通过，在连续随机池与命名预设断言通过后，`verify-folia-rhythm-presets.py:100` 截图超过 15000ms，总体 failure。功能基线完整 Verify `41445712793` 已通过，不把这次重复 CI 记为全绿。
- 工作日志：最终结果由 `docs/record-v2.6.2-release` 分支补录，核验资料在忽略的 `verification/release-v2.6.2/`，不提交二进制。保留唯一宿主音频、原安装和数据身份；不覆盖 2.6.1 的 tag 或资产。
- 未完成事项：官方 `2.6.2` 安装器未在本机运行安装；重复 CI 的截图超时尚未修复，未追加完整浏览器回归。版本已正式发布，不重复打 tag 或上传替换资产。

## 2026-11-02：Folia 节拍联动、随机池与命名预设（功能已合入）

- 用户在 v2.6.1 发布后询问后续更新，并要求三项「全部修复」。工作分支 `feat/folia-rhythm-presets`，基线 `56272b9`；版本仍 2.6.1，本轮改动列在 CHANGELOG 的未发布区，未覆盖已发布 tag 或资产。
- `getAnalysis`／`analysis` 桥接只读当前曲目的 MR／DJ 缓存；独立 revision 变化才传大数组，异步磁盘读取带曲目与 ticket 校验。`audio` 增加曲目 ID、位置和播放态，`state` 带输出延迟。不会触发额外离线分析、改变电影模式或建立第二个音频图。
- `localAnalysisBoundary` 复用原 `beatFx/clock` 与 `motionSignals`；无缓存／部分缓存未覆盖时用宿主 30 Hz FFT 的因果起音估计。鼓点、拍点历史限制 2048 项；暂停、后台、切歌、seek 清理／重定位。新 MR 分析顺带保留既有 420–2600 Hz 频段的 50 Hz 包络与起音帧，缓存 pack/unpack 兼容旧档；不是 HTDemucs 人声或鼓组分离。
- 随机池失败日志（Verify `41432539207`）显示点击已完成、导航也结束，但回读状态时超时。本机原脚本、6 倍 CPU 限速、强制 SwiftShader 均未复现超时，不能声称唯一根因已确诊。已修正实际存在的整树订阅重绘与闭包更新问题：舞台订阅排除随机池／预设元数据、预览 memo、store 原子切换、最后一项 disabled，浏览器选择器使用稳定 `data-mode`。单测锁定快速点击和渲染次数。
- 命名预设沿用 `mineradio-folia-local-visuals-v1` 的 `presets` 字段（最多 24 套／名称 48 字），保存深拷贝，恢复时归一化，应用不切换播放视图；reset 保留列表。共享图片不写入 Blob URL。新增控件在嵌入界面的中英文资源内，不引入上游完整设置／命令面板。
- 已验证：Folia 类型检查；嵌入本地单测（新增预设／节拍／hook 生命周期）；Node 全量 `1586` 项，`1585` 通过、`0` 失败、`1` 可选基准跳过；生产产物构建／校验。专项浏览器五组操作和原 `verify-upstream-visuals.py` 八组操作全部通过、页面错误为 0。首次本机构建笔顺下载失败，设置系统代理后重建成功并保留笔顺资源；未把降级构建交付。
- 浏览器拍点／包络桥接用隔离测试缓存，FFT 来自真实导入 WAV；时钟、鼓点消费者、暂停／seek／迟到响应由定向单测验证。未安装运行新二进制，未宣称模型级分离准确性。
- Windows CI 补充调查：Verify `41440644882` 的视觉脚本超过 300 秒；专项 `41443678790` 在 Microsoft Basic Render Driver 上完成全部随机池勾选，每次约 11.4 秒，随后普通点击下一首时控制条已自动收起。不能把这些日志说成已证实单一产品根因。本机对齐 CI 的 Playwright 1.60／Chromium 148 后，双核共享宿主与软件渲染仍通过。
- 验收脚本统一使用 SwiftShader 后端，下一首操作先真实悬停可见进度条、保持控制条展开，再普通点击；保留原断言及超时。Verify 手动触发可选 `visuals` 专项与详细动作日志。最终 Windows CI 结果登记在 [PR #155](https://github.com/oirge/Mineradio/pull/155) 的验证区及检查记录。

## 2026-11-02：v2.6.1 六项增量同步（已正式发布）

- 用户要求将 v2.6.0 后列出的六项功能全部补齐，延续此前发布授权和「不用过多测试」偏好。本轮不重复发布 v2.6.0。
- 实际仓库是 `oirge/Mineradio` 的 `feat/folia-render-quality-and-scenes`，基线 `47c63bb`；不要修改桌面外层旧副本或上游参考工作树。
- 六项功能、旧设置迁移、宿主透明恢复与中英文词条已接通。Folia 类型检查及定向 Vitest `113/113`；宿主／启动 `68` 通过、`0` 失败、`1` 可选基准跳过。
- 来源保留 0.7.16 原始基线和 0.7.25 稳定版 `featureSync`，新增开发提交 `f03e8ec` 的 `incrementalSync`。版本与公告为 2.6.1。
- 嵌入产物已重建并校验，版本／公告／编码／打包身份定向 Node `30/30`，语法与空白检查通过。用户随后要求「尽快发布」「尽快发吧」「先上传到GitHub上」：停止追加浏览器回归，先提交上传源码，再完成 Windows 构建和正式发布资产核验；本轮新增功能的浏览器验收尚未完成，不宣称通过。
- `verification` 中旧移植脚本非幂等，不要重跑；遗留 `.rej` 不进入提交。保留所有 `@note` 注释及唯一宿主音频、曲库、队列和已有玻璃质感。发布证据只补录实际结果。
- 发布完成：PR #153 → merge commit `53ffd3f8406dd0a3e8486c2d4a09d733bbabfcf4`；annotated tag `v2.6.1`（tag object `ae274dcc5015cdcaf0bb7e780c111f24e90efd30`）；Windows Build and Release `41425294355` 成功。Release `431303172` 于北京时间 `2026-11-02 18:51:59` 公开并设 Latest。
- 资产与自动更新：四项官方资产完整回下载，大小、SHA256 与 GitHub digest／清单一致，安装器 SHA-512 与 `latest.yml` 一致；公开 Latest API 与更新地址均已复核为 `2.6.1`。官方安装器 `122608805` B / SHA256 `3df80d7a9515e68c36fe58339f1c498c19d67908cf51f9935e1d07a9fed85294`。完整摘要见 RELEASE.md 顶部。
- CI 边界：合并后 Verify `41425093158` 中全量 Node `1580` 通过、`0` 失败、`1` 可选基准跳过；Folia 类型／行为、主界面与 Folia 中英文、错误恢复均通过。最后的新视觉脚本 `verify-upstream-visuals.py` 在通过 TTML 分轨和三档字幕检查后超过 300 秒，Verify 总体 failure；未追加浏览器回归，不宣称完整 CI 全绿。
- 工作日志：本次接续发布使用独立检出 `C:/Users/oirg/Desktop/Mineradio-main/.tmp-release-v2.6.1-records`、分支 `docs/record-v2.6.1-release`，仅补录发布事实。核验文件在 `%TEMP%/Mineradio-release-verify-v2.6.1-41425294355`，不提交二进制。
- 未完成事项：完整视觉浏览器回归仍有超时；官方安装器未在本机运行安装，不能宣称安装后端到端验收通过。版本已正式发布，勿重复打 tag 或重建上传资产。

## 2026-11-02：v2.6.0 上游视觉功能同步（已正式发布）

用户已授权补齐全部七类功能并发布。工作分支 `feat/sync-upstream-visual-controls`，基线 `4c78972`。
新增功能和来源见 CHANGELOG.md 与 RELEASE.md 顶部。Folia 仍为独立嵌入界面，共享主播放器音频。
Node 1577 项中 1576 通过、1 可选基准跳过；Folia 类型检查和定向 53 项通过。新功能浏览器专项 8 项、Folia 恢复验收通过；Windows 本机构建、隔离启动、WAV/TTML 导入播放与进入 Folia 通过。摄像头真人识别和 Wallpaper Engine 实例未实测。
新控件中英文已补齐。手势模块从 app.js 拆出；TTML 和声由 lyric-vocals.js 保留；WE 参数经 preload / bridge / runtime 传入 helper。
用户最后明确「直接发布不用过多测试」，已停止完整浏览器重跑。首轮 PR CI 的文案审计误把预览示例歌词识别成界面中文；后续修正只排除预览内容区域，仍审计周围控件。完整 CI 未作为发布前置，不宣称全绿。
PR #151 → merge commit `87c8814b91d573f39255717b1a508c2b22ea0227`；annotated tag `v2.6.0`（tag object `a26e49d90fcb7d35d73c9907b0bc2c397919cb98`）；Windows Build and Release `41406868259` 成功。Release `431176408` 于北京时间 `2026-11-02 15:35:09` 公开为 Latest，四项资产回下载核验通过。安装器 `122567493` B / SHA256 `fb3b9f4c542f6e128dc9e1a1ae0e3617743d326b0a7530130c72c6de6f87c5d0`，自动更新清单匹配。详见 RELEASE.md 顶部。

# Mineradio AI Handoff

## 2026-10-31 启动加载画面隐藏 Folia 切换按钮（v2.5.5 已正式发布）

- 用户先要求「开启时移除这个」并圈出「正在加载 Folia...」右上角提前出现的 Folia 按钮，随后要求「发布新版」。修复只改 [宿主样式](public/folia-host.css)：`html.folia-mode-preload [data-folia-switch]{display:none!important}`，同时隐藏桌面标题栏与全屏浮动两个真实切换按钮；`public/folia-host.js` 未改，宿主恢复模式并同步按钮文字后由原有 `finally` 释放预加载类。
- 不把显示时机改成「等 iframe ready」：Folia 加载失败（20 秒超时或资源失败）时仍需保留返回 Mineradio 与重试入口。[启动回归](tests/startup-direct-entry.test.js) 与 [宿主回归](tests/folia-host.test.js) 钉住两个按钮、预加载 CSS 守卫、加载文字仍可见、超时后点击返回与重试替换失败 iframe。
- 浏览器实测：真实 Chromium 静态服务下桌面/全屏为 CSS 类模拟，修前修后启动对照与正常切换符合预期。首轮并发 9 场景中 8 个通过；最后一个全屏超时场景在重入等待 ready 时超过 30 秒未完成，不能记作 9/9；保持真实 20000ms 定时器和普通点击单独串行复验通过（约 19.9 秒失败→返回→新 iframe 重试成功）。这是浏览器验证，不等同于原生 Electron 窗口或已安装二进制验收。
- 本版改动：`package.json` / `package-lock.json` 两处 / `public/app.js` 的 `APP_VERSION` / 前后端更新公告 / `CHANGELOG.md` / `RELEASE.md` / `AGENTS.md` / Release workflow 默认 tag 统一到 `2.5.5`；Folia 上游版本 `0.7.16` 与安装身份不变。
- 发布结果：PR #149 以 merge commit `65c924585aff4133a166a192e7a9399ae895a75b` 合入 `main`；annotated tag `v2.5.5`（tag object `7f1826420dccd2f13abe1efc0ec5ec795794c14b`）；Windows Build and Release `41171580289` 成功；Release `429737667` 于北京时间 `2026-10-31 14:34:07` 公开并设为 Latest。四项资产已完整回下载，大小与 SHA256 匹配 GitHub digest；Setup.exe `120737371` B / SHA256 `fb358ebc3d3a73343b9594a84eb58b9741580173fd54a767d20e518d7968aae7`，SHA-512 与 `latest.yml` 一致；公开 `latest.yml` 与已校验文件逐字节一致。
- 未完成：官方 `2.5.5` 安装器未在本机运行安装；浏览器验证不覆盖原生 Electron 窗口、音乐播放和完整 `local-previous` 场景。`verification/` 为忽略目录，不提交。

## 2026-10-25 桌面歌词与 GPU 恢复（v2.5.4 已正式发布）

- 用户明确要求全部修复后发布新版。线上 Latest 已核实为 v2.5.3，本轮以远端 `ba5dd1b` 为基线，在 `fix/desktop-lyrics-gpu-recovery` 分支准备 v2.5.4。
- 当前工作树为 `C:/Users/oirg/Desktop/Mineradio-main/fix-desktop-lyrics-gpu`；外层目录没有 Git 元数据且代码较旧，不要把修复误写回外层。
- 修复歌词透明窗口错误可达判定、解锁拖动实际窗口未纠偏、原生隐藏/无响应恢复缺口、快速前后台切换的重复 RAF，以及 GPU 陈旧故障累计和缺少受控硬件重试。
- 用户后续明确「所有型号的 GPU 加速异常之后会自动恢复」：通用恢复不读厂商/型号，删除两次失败后的终身停止限制；冷却到期后下次启动重试，成功清零次数。RTX 4060 仅为本机验证型号，不能宣称所有型号已实测。
- 最终完整回归 1564 通过、0 失败、1 可选基准跳过；隔离 Electron 实测歌词恢复与 NVIDIA RTX 4060 WebGL，从已尝试 8 次的过期软件档两分钟后成功恢复并保存兼容硬件档，尝试次数清零。详见 `docs/DESKTOP_LYRICS_GPU_RECOVERY.md`。
- 原本机 v2.5.2 安装包及 unpacked 目录已完整备份在工作树 `backups/lyrics-gpu-recovery-20261025/original/`；只替换四文件的热修包已逐文件验证但尚未安装。
- 发布结果：PR #147 以 merge commit `fad13dd767cf08375b854595fca5e2e7ee5a810d` 合入 `main`；annotated tag `v2.5.4`（tag object `8679e2b7f9ca96e2fb6aeabee94210793e200126`）；Windows Build and Release `40197346731` 成功；Release `423419267` 于北京时间 `2026-10-25 21:52:42` 公开并设为 Latest。四项资产已完整回下载，大小与 SHA256 匹配 GitHub digest；Setup.exe `120737008` B / SHA256 `a8ca753a4a42583770a88d8e9029c8d3bb95722683147b27a2bcb8c4237b1e45`，SHA-512 与 `latest.yml` 一致。
- 未完成：官方 `2.5.4` 安装器未在本机运行安装；用户需要安装新版后复验桌面歌词与 GPU 加速恢复。`artifacts/` 为未跟踪的测试与发布核验输出，不要误提交。

这个文件是给后续接管本工作区的 AI 看的。每次完成一个任务后，都要更新本文件的「工作日志」和「未完成事项」，让下一位接手者能快速知道用户偏好、当前状态和最近做过什么。

## 2026-10-18（Folia 顶栏升级入口与音量数值，v2.5.2 已正式发布）

- 用户要求：Folia 顶栏在「Mineradio」与「导入文件」之间加一个**图标式**升级按钮（「升级按钮使用图标啊」），Folia 底部音量条显示**具体数值**；随后要求「其他实质性更新都更新一下然后发布 2.5.2 版本」。
- 实现：`public/index.html` 的 `#folia-switch-btn` 与 `#folia-import-files` 之间插入 `#folia-update-btn`（30×30 上箭头图标），`public/app.css` 只在 `body.folia-interface-active` 下启用 `display:grid`，并给出 `has-update` / `checking` / `downloading` / `ready` 四态；`public/app.js` 的 `setUpdatePreviewVisible` / `syncUpdatePreviewStateClass` / `openUpdatePanel` 三处同时驱动它，`UI_LANGUAGE_PAIRS` 补 `['升级 Mineradio','Update Mineradio']`。Folia 侧 `vendor-src/folia/src/mineradio/local/PlayerControls.tsx` + `local.css` 新增 `local-volume-value`（`Math.round(volume*100)%`，tabular-nums 右对齐），重建走 `npm run build:folia`。
- **踩到的真实缺陷**：Folia 下更新面板能显示但点不动——`public/folia-host.js` 的 `setOriginalVisualsVisible(false)` 会给 shell 内除标题栏 / iframe 外的每个子节点加 `inert`，把 `update-modal` 一起扫进去；现在 `update-modal` 在豁免名单里（`public/folia-host.css` 同时把它从 Folia 的 `visibility:hidden` 清扫里摘出，并在 Folia 激活时把层级提到 `2147483000`）。`tests/folia-host.test.js` 新增一例钉住。
- 发布结果：功能提交 `dba7e6e` 经 PR #141 以 merge commit `391823f` 合入 main（两组 Verify `39098349448` / `39098452395` 通过）；annotated tag `v2.5.2`（tag object `9c69990`）固定在该 merge commit，Windows Build and Release `39098867901` 成功。Release `416242724` 于北京时间 `2026-10-18 13:12:16` 公开并设为 Latest。
- 资产核验：四项文件完整回下载，大小与 SHA256 全部匹配 GitHub digest 与清单；EXE SHA-512 匹配 `latest.yml`；公开 `releases/latest/download/latest.yml` 与已校验文件逐字节一致。本轮未运行官方 `2.5.2` 安装器。完整摘要见 `RELEASE.md`。
- 验证：完整 Node 回归 `1514` 项、`1513` 通过、`0` 失败、`1` 可选基准跳过；`npm run build:folia` 重建并校验通过；Chromium 真机验证按钮位置（x=1014，正好夹在「Mineradio」与「导入文件」之间）、更新面板在 Folia 上层可点击（命中测试落在面板内按钮）、音量显示 `100%` → `42%` → `58%`。

## 2026-10-16（合并本机与远端分支，v2.5.1 已正式发布）

- 用户要求把本机分支与远端 PR 一起处理完再发布 `2.5.1`。远端 `codex/release-v2.5.1` 是从 `origin/main` 独立重建的发布分支（自带一套 i18n 动态文案与发布元数据），与本机 `codex/player-stability-and-i18n` 在 `public/app.js` 有 16 处冲突。
- 合并策略：保留本机分支的翻译引擎（`translateUiMutations` 批量去重、整窗属性翻译、`uiLanguageCloseControl`）与 Folia 韧性、CI 浏览器回归；吸收远端的动态文案（歌单选择器、歌曲/歌手详情、播放统计、热键状态）与 27 条独有词条；新增 `data-i18n-attrs`（只翻译属性、跳过用户数据文本），按钮 tooltip 不再因为跳过整元素而残留中文。
- 本机分支先补齐更新检测状态的英文（「正在检测更新…」「检测中…」「暂无可用更新」），修掉 CI `38716460199` 浏览器审计在更新检查进行中扫到中文残留的失败。
- 发布结果：PR #139 以 merge commit `1a45031` 合入 main；PR #138 以 merge commit `de241d5` 合入 main。annotated tag `v2.5.1`（tag object `cc8564e8`）固定在 `de241d5`，Windows Build and Release `38840964090` 成功。Release `414480606` 于北京时间 `2026-10-16 10:48:18` 公开并设为 Latest。
- 资产核验：四项文件完整回下载，大小与 SHA256 全部匹配 GitHub digest 与清单；EXE SHA-512 匹配 `latest.yml`；公开 `releases/latest/download/latest.yml` 与已校验文件逐字节一致。本轮未运行官方 `2.5.1` 安装器。完整摘要见 `RELEASE.md`。
- 验证：合并结果完整 Node 回归 `1512` 项、`1511` 通过、`0` 失败、`1` 可选基准跳过；Folia 类型检查、定向 Vitest `36/36`、`check:folia` 通过；浏览器回归三项全绿。

## 2026-10-15（i18n 收尾修复已推送，版本号已备好 2.5.1 但未发布）

- 用户先要求「完成修复发布新版」，随后改为「先不发布了把代码上传到 GitHub，明天再继续」。因此本轮只推分支，**没有建 PR、没有打 tag、没有跑发布 workflow**。
- 修掉 CI `38711284942` 抓到的 5 处英文界面残留：DIY 关闭态 tooltip（`关闭 DIY 玩家模式`）、空曲库首页提示（`导入文件夹后显示歌曲、歌词和封面`）、更新线路提示（统一成 `自动测速，挑当前最快的线路下载。`）。歌词按钮的 `词` 图标改成 `aria-hidden` + `data-i18n-skip`，不再被语言审计当成漏翻。
- 删掉重复词条 `['歌词文件', 'Lyric file']`：它覆盖了 `['歌词文件', 'Lyric File']`，导致自定义歌词弹窗的未命名候选显示成 `Lyric file`，和 `scripts/verify-ui-language.py` 的断言不一致。
- 修掉存档改名输入框的真实竞态：`renderUserFxArchives()` 里 `setTimeout(0)` 的 `focus()+select()` 会晚于用户输入执行，把光标冲成全选。现在只在输入框尚未聚焦时才补聚焦，避免覆盖用户光标。该问题在 `verify-ui-language.py` 里约 5/8 概率复现，修复后连续 8 轮通过。
- 版本元数据已按 2.5.1 备好但**尚未发布**：`package.json`、`package-lock.json`（两处）、`public/app.js` 的 `APP_VERSION`、前后端更新公告、`.github/workflows/release.yml` 默认 tag、`CHANGELOG.md` 新增 v2.5.1 条目。明天若要发布直接用；若决定不发，回退这些元数据即可。
- 验证：全量 `npm test` 1509 项、1508 通过、0 失败、1 可选基准跳过；`version-consistency` / `doc-encoding-integrity` / `github-actions-ci` 10/10；Folia typecheck 通过、定向 Vitest 36/36、`npm run check:folia` 通过；`verify-ui-language.py`、`verify-folia-language.py`、`verify-folia-resilience.py` 均 passed（连续多轮无 pageerror）。
- 未完成：用户还没在预览实例里复验，也没确认是否发布 2.5.1。临时脚本 `.tmp-language-scan*.txt`、`scripts/.tmp-*.mjs`、`scripts/.tmp-*.py` 仍留在本机未提交。

## 2026-10-15（播放器稳定性与 i18n 续作，已推送远端分支待续）

- 用户要求先把改好的代码上传 GitHub，明天再继续。权威工作区 `C:\Users\Administrator\Desktop\Mineradio-main\Mineradio-pr136`，分支 `codex/player-stability-and-i18n`（基于 v2.5.0 之后的 `65e2ac1`，未合并、未发版）。同级无 `.git` 的 `Mineradio-main` 只是源码快照，不要覆盖。
- 本分支内容：五项优化（Folia 加载异常恢复与重试、桌面端英文 i18n、Playwright 浏览器回归纳入 CI、Folia 首页预览、翻译监听去重）加用户实测反馈的 i18n 修复（tooltip、音量面板、歌单选择器、首页本地文件、热键重复提示、歌曲信息弹窗、迷你播放器），并恢复空 Home 上被 CSS 藏掉的 Folia 切换入口。
- 验证：根目录全量 `npm test` 1509 项，1508 通过、0 失败、1 可选基准跳过；Folia `typecheck` 通过、定向 Vitest 36/36；`npm run check:folia` 产物校验通过；`git diff --check` 干净。顺带修了 5 处被 i18n 改动打穿的旧断言（Folia 空 Home 隐藏规则、热键测试桩缺 `uiText`/`uiLanguage`、封面内嵌文案）。
- 未完成：用户还没在预览实例里复验音量面板、歌单选择器、本地文件按钮、歌曲信息弹窗和热键 toast；确认后再做版本号 2.5.1、CHANGELOG/RELEASE/本文件更新、PR 与发布。临时扫描文件 `.tmp-language-scan*.txt`、`scripts/.tmp-*.mjs` 仍留在本机且未提交。

## 2026-10-15（v2.5.0 已正式发布）

- 用户明确授权「发布新版2.5.0」后，PR #136 已以 merge commit `c36cff3ea91637a9323ba7f047846aa76b78205e` 合入 main。发布提交 `b185d8d` 本地完整 Node 回归 `1502` 通过、`0` 失败、`1` 可选基准跳过，公告解析与元数据一致；PR 两组 Verify `38674561530` / `38674567137` 及合并后 Verify `38674836342` 全通过。
- annotated tag `v2.5.0`（tag object `bc77b00315b6bc80998b95b7ad77fec3c1ce65ca`）固定在上述 merge commit；Windows Build and Release `38674888053` 成功。[正式 Release](https://github.com/oirge/Mineradio/releases/tag/v2.5.0)（ID `413381092`）于北京时间 `2026-10-15 11:15:54` 公开并设为 Latest。
- 四项官方资产均完整回下载，大小、SHA256 与 GitHub digest/清单一致，EXE SHA-512 与 latest.yml 一致；公开 Latest API 和自动更新清单已复核为 `2.5.0`。官方安装器 `120722681` B，SHA256 `e7bae0f83e773097287f6fd189b5c256569e18da872bd52bf937582020fb51ed`；完整摘要见 `RELEASE.md`。
- 本机已构建并安装功能预览（版本仍为 `2.4.9`，提交 `fc516e9`）到 `D:/Mineradio-oirge`；NSIS 退出码 `0`，已打开实际播放器窗口。用户要求自行实测，未继续操作其界面。包内 117 个功能及 Folia 资源与源码逐字节一致；本地记录在忽略的 `artifacts/ui-language/local-install-manifest.json`。
- 本轮未运行官方 `2.5.0` 安装器；用户此前要求自行实测，不继续操作已打开的播放器。发布事实由 `docs/release-assets-v2.5.0` 文档分支补录，不移动已发布标签或替换资产。下方各节为历史状态，不再作为待办。

## 历史：2026-10-15（PR #136：主设置与 Folia 中英文切换已完成本地验收）

- 权威分支仍为 `codex/settings-i18n-wip-20261014`，PR 为 `https://github.com/oirge/Mineradio/pull/136`。本机在仓库检出 `Mineradio-pr136` 续做，勿覆盖同级无 `.git` 的源码快照；换机按远端分支定位。版本保持 `2.4.9`，PR 保持草稿，本轮不合并、不发版。
- 补齐背景色「封面渐变」（源代码使用 Unicode 转义）、歌词溢光两种状态的 title 与「独立」标签、歌词来源 title。自定义歌词弹窗接入语言层，标题、帮助、placeholder、校验与动态行数状态支持中英往返。
- 歌曲名/歌手/专辑、歌词文件名/路径、存档名、插件元数据保留原文。包含文件名的状态拆为 UI 文案与原文节点；空歌名、无名歌词文件及未知格式仍随语言切换。`refreshCustomLyricUiLanguage()` 只刷新来源控件与候选按钮，不重置歌词草稿或状态。
- `renderUserFxArchives()` 重绘时保留改名草稿、光标选区与原先处于输入框的焦点；代次守卫阻止过期定时器重选文本。鼠标点击语言按钮后保持正常按钮焦点，不会提交改名。
- 英文布局规则仅作用于 `#fx-panel[data-ui-locale="en"]`：标题与操作区分行，状态行标签与值分开，修复长英文重叠。中文规则与玻璃主题保持原有设置。
- 验证：最终完整 `npm test` 为 **1502 通过、0 失败、1 可选基准跳过**；相关 JavaScript 语法及 `git diff --check` 通过。修复原迷你播放器旧静态断言，并为歌词候选/宿主性能测试补齐 DOM 接口；新增语言用例覆盖歌词弹窗、动态保存行数、改名重绘及 Folia 语言 RPC。
- Playwright 已验六个标签页、热键/歌词/插件弹窗、动态属性、歌词草稿与命名草稿、用户数据保护、刷新持久化、1440×960 和 1280×720 布局。11 轮英文扫描无固定中文残留、无浏览器异常；截图核对英文状态行无重叠。
- 用户随后追加检查 Folia：原嵌入界面没有接通主设置，已在 host state 与 `setUiLanguage` RPC 中传递语言，`localStateSignature` 纳入语言以触发 React 更新。启动从同一 `mineradio-ui-language-v1` 读取，覆盖旧 Folia 偏好；Folia 效果面板提供中文/English 选择，双向同步主设置，不写入视觉存档。
- Folia 补齐唱片墙返回/无障碍标签、内置歌单名称、文档标题、宿主导入/导航/加载及固定错误文案；歌曲与自建歌单名保留原文。修改的是 `src/mineradio` 嵌入入口及 host，不加载上游完整设置应用。已执行 `npm run build:folia` 并更新仓库内 `public/vendor/folia` 静态产物。
- Folia 验证：定向 Vitest **12/12**、`npm run typecheck`、构建及产物校验通过；`python scripts/verify-folia-language.py` 验证三个视图、14 种歌词效果、5 种背景面板、明暗主题、双向语言同步、刷新与中文歌曲元数据，最终 26 轮扫描无固定中文残留、无浏览器异常。另验 1280×720 桌面标题栏 portal、宿主按钮翻译和导航不与窗口按钮重叠。报告为 `artifacts/ui-language/folia-report.json`。
- 验证边界：第一轮 Folia 自动化曾捕获一次 `Cannot read properties of null (reading 'trim')`，当时未收集调用栈；增加 stack/阶段记录后全流程重跑及标题栏验收均未复现。未据此修改视觉引擎；如后续复现，按报告中的 stack 定位，不归因于语言层。
- 复验：终端设置 `PORT=3268`、`HOST=127.0.0.1` 后运行 `node server.js`，另一个终端运行 `python scripts/verify-ui-language.py`；可用 `--url` 指定端口。结果与截图写到已忽略的 `artifacts/ui-language/`，`report.json` 包含断言结果，发现残留/重叠/异常会非零退出。脚本使用隔离浏览器数据，不依赖本机曲库或插件。
- 未完成事项：远端 CI 状态以 PR 最新提交为准；合并与发布尚未进行。下节为上一轮历史记录，其中待办和失败结果已由本节替代。

## 历史：2026-10-14（WIP：设置面板中英文切换）

- 基于远端 `origin/main` 的 `6491829`，当前工作分支为 `codex/settings-i18n-wip-20261014`；`package.json` 版本保持 `2.4.9`，本轮只保存续开发代码，不创建 Release、不改版本。
- 当前 Git 工作树：`C:/Users/oirg/Desktop/Mineradio-main/.tmp-settings-i18n-20261014`。原源码目录 `C:/Users/oirg/Desktop/Mineradio-main` 无 `.git`，本次只把语言改动移入该独立工作树；明天接续该分支或从 GitHub 获取它，勿从旧本地 `main` 覆盖。
- 设置面板新增 `中文 / English` 切换并持久化到 `mineradio-ui-language-v1`；键已同步到 `public/app.js`、`desktop/preload.js`、`desktop/main.js` 和整机备份白名单。
- 翻译覆盖视觉控制台、颜色弹层、歌词、动态、迷你播放器、3D / 手势、自动播放、音量均衡、无缝播放、倍速、睡眠、输出设备、音效链、插件、备份、曲库目录、高级参数和 Wallpaper Engine 弹窗。动态节点使用 `data-i18n` / `data-i18n-skip` 与 `MutationObserver`，歌曲名、歌单名、路径、设备名、插件元数据等用户或第三方数据保留原文。
- 新增 `tests/ui-language.test.js` 与 `scripts/verify-ui-language.py`。当前定向 Node 回归为 `92/92`（语言 9、整机备份 23、全局热键 20、鼠标热键 40），`public/app.js`、`public/wallpaper-engine.js`、`desktop/main.js`、`desktop/preload.js` 语法检查通过，`git diff --check` 通过。
- 保存前完整 `npm test`：`1497` 通过、`1` 失败、`1` 可选基准跳过。唯一失败的 `tests/mini-player-visual.test.js` 用例仍精确匹配旧二元 `tabMeta`（557 行）和中文状态赋值（559 行），当前语言层已改为三元 `['mini', '迷你', 'Mini']` 与中英文条件文案；行为断言通过，明天同步该用例并重跑回归。文档编码 `5/5` 通过。
- 浏览器验证已覆盖 English 切换、设置标签页、热键弹窗、切回中文和刷新保持 English；截图在本地 `artifacts/ui-language/`（该目录不纳入提交）。
- 明天继续前先补：英文审计中仍有少量固定提示未覆盖（封面渐变、歌词溢光/歌词源 title），默认用户存档名和插件名称需要继续保持用户/第三方原文；再做完整动态回归与必要的视觉布局检查。

## 当前权威入口（2026-10-11；v2.4.3 进行中）

- **当前正式版是 v2.4.2**：PR #125 已合并，tag 指向 `492cc434577be0a6713862767dcbd7f1e4b19808`，Windows Build and Release `38104911581` 成功。Release `409344608` 于北京时间 `2026-10-11 10:25:46` 正式发布并设为 Latest。四项官方资产完整回下载的 SHA256 与 GitHub digest/清单一致，EXE SHA-512 与 `latest.yml` 一致，公开更新清单复核通过。
- **本轮 v2.4.3 尚在进行中**：在 `D:/Mineradio-src/poster-songkey-perf`、分支 `codex/poster-songkey-perf` 优化 Folia 海报墙切歌。`wallViewData.ts` 复用不受影响的卡片，减少整墙重建，保持播放分区、封面变化与曲库重排同步；发布元数据和两条中文公告已准备。
- **本轮验证**：根目录 Node `1438` 通过、`1` 可选基准跳过；Folia 定向 `27/27`、类型检查与产物检查通过，Windows 安装包构建及清单 SHA-512 校验通过。Chromium 墙面四项验收通过，含前后连续切歌与当前曲高亮；50,000 首相邻切歌数据处理的中位耗时 `6.629 → 0.898 ms`，不是 FPS 测量。PR/CI 与线上发布尚待完成；完成后更新 `RELEASE.md` 和本入口。
- 仓库以 `https://github.com/oirge/Mineradio` 为准；本轮仅在上述隔离检出工作，不访问或改动 `D:/Mineradio-oirge` 安装目录。以下入口及日志为历史记录。

## 当前权威入口（2026-10-07）

- **当前版本 v2.2.8 已正式发布**：修复更新弹窗在短窗口被裁切，并确保长说明、版本号与操作区稳定可见。PR #107 已合并，tag/merge commit `c711c84453b24f5e972fb450daecd7672e47e768`；PR 两组 Verify 与合并后 Verify `37600666433` 通过，Windows Build and Release `37600847689` 成功。Release `405596536` 于北京时间 `2026-10-07 17:39:16` 正式设为 Latest。公开 latest.yml 返回 `2.2.8` 且安装包大小正确；blockmap、latest.yml 和 SHA256SUMS 已回下载并匹配 GitHub digest，四项服务端摘要与清单声明一致。约 102 MB 官方 EXE 下载在当前代理环境中停滞，因此没有本地重算官方安装包摘要。完整记录见 `RELEASE.md`。
- **本轮验证与构建**：全量 Node `1325/1325`；真实 Electron/Chromium 4 档缩放布局检查 `128/128`，含 `480×270`；编码 `5/5`，元数据/公告/workflow `18/18`，语法检查和 `git diff --check` 通过。本机 Windows 安装包构建也成功并核对本机构建 latest.yml 的 SHA-512。
- **上个正式版 v2.2.7**：PR #105 合入，PR #106 补发布记录；历史发布信息见 `RELEASE.md`。
- 仓库：`https://github.com/oirge/Mineradio`。当前隔离检出 `D:\Mineradio-release-2.2.6`。代码分支 `codex/release-v2.2.8` 的提交 `c43f12a` 已合并并在 `c711c844` 上打 tag；当前工作分支 `docs/record-v2.2.8-release` 用于单独补录发布记录。

- **歌词不可见热修已包含在 v2.2.7**：用户选择重启验证后修复了本机旧版；热修代码现已提交、合并、正式发布。装包 smoke 覆盖主窗口隐藏、renderer 崩溃、关闭后重开，真实本机歌曲验证确认播放不中断。初始安装目录缺失的 `resources` 与 `locales` 已补回，原 ASAR 与用户设置备份仍保留在 `D:\Mineradio-oirge\backups\desktop-lyrics-fix-20261007-152457`。
- 仓库：`https://github.com/oirge/Mineradio`。本轮在隔离工作树 `D:\Mineradio-release-2.2.6` 完成 v2.2.6；代码分支 `codex/release-v2.2.6` 的提交 `3601ae7` 已经 [PR #103](https://github.com/oirge/Mineradio/pull/103) 合并至 `main`。tag `v2.2.6` 指向合并提交 `17025f0f20ad41065eae0685a20607ab4d0cc30b`。不要改动原安装目录 `D:\Mineradio-oirge` 或本轮以外的用户修改。
- 用户已明确授权完成修复、推送分支、创建并合并 PR，以及发布新版。[v2.2.6](https://github.com/oirge/Mineradio/releases/tag/v2.2.6) 已于 `2026-10-07T06:53:49Z` 正式发布并设为 Latest（Release ID `405458964`），不是待发布状态。发布记录在 `docs/record-v2.2.6-release` 分支补录，不改动已发布 tag 或资产。
- 本轮改动包含事务式恢复统计与本地歌曲译文、扩充整机备份内容、输出设备切换状态与断连恢复、损坏本地歌曲自动跳过、安装包断点续传。
- 全量 Node 回归 `1314/1314`、文档编码检查 `5/5`、JavaScript 语法检查和 `git diff --check` 通过；Playwright 本地冒烟通过（HTTP 200、版本正确、关键控件存在、无页面异常）。PR Verify 两组及合并后 Verify `37582592950` 通过，官方 Windows 构建与发布 workflow `37582936272` 成功。
- `releases/latest` 和公开的 `releases/latest/download/latest.yml` 均已复核为 v2.2.6。四项线上资产大小与 SHA256 详见 `RELEASE.md`；清单与 GitHub 服务端摘要一致，小资产回下载 SHA256 匹配。官方 EXE 完整回下载未完成，未在本地重新计算其 SHA512；不要把清单里的 SHA512 声明写成本地实测通过。
- 远端仓库和应用内更新配置指向 `oirge/Mineradio`；应用 ID、安装身份与用户数据目录沿用既有设置。

## 历史状态（2026-09-21；已由 2026-10-07 权威入口取代）

- **仓库以 GitHub `https://github.com/oirge/Mineradio` 为准，本地源码路径为 `D:\Mineradio-src`；已安装程序路径为 `D:\Mineradio-oirge`。**
- 当前源码续版为 `v2.2.2`，本轮修复桌面歌词控制栏两处交互问题：开启后长期滞留（程序化唤出且未悬停时约 2.6s 自动收起）、解锁态左键单击不出控制栏（单击即唤出，无需再等 1.5s 悬停）；发布前以当前分支和 `git log --oneline -5 --decorate` 为准。
- 线上 Latest 已是 `v2.2.2`（GitHub Release 于 2026-09-22 发布）；`origin/main` 已同步到 `v2.2.2`；安装身份、数据目录和自动更新线路不变。
- GitHub 仓库：`https://github.com/oirge/Mineradio`
- `package.json` 的发布配置和软件内更新配置均指向 `oirge/Mineradio`。

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

- `Mineradio-oirge-<version>-Setup.exe`
- `Mineradio-oirge-<version>-Setup.exe.blockmap`
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

### 2026-10-14（设置中英文切换 WIP 保存）

- 用户要求先推送现有更新、明天继续；本次快照分支 `codex/settings-i18n-wip-20261014`，基于 `6491829`，不发版、不合并主分支。改动范围与验证结果见顶部 WIP 入口。

### 2026-10-11（v2.4.3 海报墙切歌优化，待 GitHub 发布）

- 接续 v2.4.2 后留下的海报墙改动，切歌时复用播放分区和歌曲数据未变化的卡片对象；保留封面补齐、倒退跳播、重排及集合外歌曲语义。
- 定向测试 `27/27`、根目录 `1438` 通过、`1` 可选基准跳过；Chromium 四项墙面验收通过。50,000 首相邻切歌合成基准中位 `6.629 → 0.898 ms`，对象替换 `50,000 → 2`，不等同于真实 FPS。
- 本机工作树使用独立安装的锁定依赖：`node_modules` junction 会让构建器漏收 `node-gyp-build`，Folia junction 还会把另一个工作树路径写进许可证。发布包必须核对运行依赖和清单，不仅检查构建退出码。

### 2026-10-07（v2.2.8 已正式发布）

- 在最新 `origin/main` 上修复更新弹窗短窗口的裁切：内容说明区独立滚动，版本和底部操作区固定可见；版本号改紧凑琥珀标签，长号省略。
- 扩展真实 Electron 布局复验，将应用最小尺寸 `480×270` 纳入 4 档系统缩放检查，`128/128` 通过；全量 Node `1325/1325`、编码 `5/5`、更新文案和 release workflow `18/18`、语法检查及空白检查通过。
- 本机 Windows NSIS 构建成功并核对 `latest.yml` SHA-512。分支 `codex/release-v2.2.8`，代码提交 `c43f12a` 已由 PR #107 合并，tag 指向 merge commit `c711c844`。PR Verify 两组、合并后 Verify `37600666433`、官方构建 workflow `37600847689` 成功；Release `405596536` 正式 Latest。GitHub 四项资产与服务端 SHA256SUMS 对上，当前网络代理阻塞了本机完整回下载；记录已写入 `RELEASE.md`。

### 2026-10-07（v2.2.7 已正式发布）

- 桌面歌词恢复修复从 PR #105 合入 `main`，tag `v2.2.7` 指向 merge commit `5fe9321208772270fce64d62b8461c613500ff15`。Release `405504333` 于北京时间 `15:47:30` 发布并设为 Latest；官方 Windows Build and Release `37588692774` 成功，PR 两组 Verify 与主分支 Verify `37588639141` 通过。
- 全量 Node `1325/1325`、文档编码 `5/5`、JavaScript 语法与 `git diff --check` 通过。打包 EXE 隔离 profile 冒烟确认主/渲染版本 `2.2.7`、隐藏主窗口仍显歌词、强制崩溃自动恢复、关闭后可重新开启；真 Electron 故障注入也屏蔽了 `ready-to-show` 并验证 renderer 崩溃恢复。
- 官方安装包 `102394759` B / SHA256 `6defff3a5de582e95edab43e09e168bf23771dcc5c27b9ffe1b24de68fca2410`；blockmap `106483` B / SHA256 `6bdda91f18a262dd1a66332b289c1801c635886f1c4d722adad60c0b08056e92`；`latest.yml` `359` B / SHA256 `51296e217d0234d8a9ffdbdcc1f6ee6fd648749b33af0234d701b9702cb4b234`；SHA256SUMS `282` B / SHA256 `c96c9ff2c9d93a70e66a2558ca81fd158754582e366c94442e34754aaf6ebb17`。四项均从 GitHub 回下载并逐项核对服务端 digest 与清单；EXE SHA-512 `GqPfVukUSfoD53vfmydZtptAiAyLVhGim6XX0gFkOhbXJ1Bl4Gb2yR9hwttQFP/Mw+OrRBmNATRE9cxHjE131g==` 和公开更新清单一致。
- 公开 `releases/latest/download/latest.yml` 实测版本 `2.2.7`、安装器路径和大小正确；PR、workflow、Release 与资产结果均记录在 `RELEASE.md`。

### 2026-10-07（桌面歌词不可见：先行本地热修，后随 v2.2.7 发布）

- 本节记录代码在版本发布前先安装到本机验证的阶段；修复现已随 `v2.2.7` 正式发布。
- 初始现场：D:\Mineradio-oirge 仅有 EXE/DLL，缺少 resources 和 locales，无二创进程；快捷方式目标正确。用本机 v2.2.6 dist/win-unpacked 补回缺失目录，未覆盖既有文件或曲库。EXE 与构建目录 SHA256 相同。不能据此断言资源缺失是用户此前每次歌词消失的唯一原因。
- 代码缺口：歌词窗口 show:false 只靠一次 ready-to-show 显示；did-finish-load 只监听一次且不负责显示；加载失败只记日志，renderer 崩溃没有恢复。新增 desktop/desktop-lyrics-recovery.js：加载完成显示 + 2s 首帧看门狗、至多三次指数退避重载、每次加载补最新状态、实例所有权/关闭/退出门控与定时器释放。唤醒、解锁、显示器变化重新显示并 invalidate，显示器增删补位置纠偏；不重载主播放器、不抢焦点、不把主窗口 hide 传播给歌词。
- 回归：新增恢复测试 11 项，npm test **1325/1325**；JS 语法与 git diff --check 通过。隔离真 Electron（software GPU）主动屏蔽 ready-to-show、强制 renderer crash，歌词可见并恢复正文；产物在 .tmp-lyrics-fix/。
- ASAR 热修仅修改 desktop/main.js，新增恢复模块，其余文件字节与 unpack 标记逐项核对不变；原包 SHA256 为 49fc434b81ce4fe441d5de03441775a628afc37e4566b796bf3c1b9058fdbeaa，热修包为 6d78ee389f55a9c239a0e937eb87295c2b429103f2c6adb6ad7eaf2f09d17369。原包及两份设置备份在 D:\Mineradio-oirge\backups\desktop-lyrics-fix-20261007-152457。未修改发布区 Setup、latest.yml、blockmap 或线上资产。
- 安装版实测：真实歌曲播放时主窗口隐藏，歌词 visible:true、置顶、正文 opacity=1、body opacity=.92；强制歌词 renderer 崩溃恢复成功，关闭后窗口释放、重开显示；截图非透明像素 55617，播放时间从 104.399819 连续推进至 111.058141 秒，无暂停。诊断 inspector 端口已关闭，播放器保持运行。字号仍是用户原来的 .20，未改动视觉偏好或手动位置。
- D:\Mineradio-src 是旧 2.2.4 分支，任务开始前已有未提交的 suspendDesktopLyricsForMainHide 修改，本轮未覆盖它；不要从旧分支打包，否则会重新引入“主界面收进托盘，歌词也消失”的行为。

### 2026-10-07（v2.2.6 已正式发布）

- 在独立工作树 `D:\Mineradio-release-2.2.6` 准备 v2.2.6，保护原目录 `D:\Mineradio-oirge` 的用户未提交修改。
- SQLite 备份恢复改为事务式覆盖统计、收藏与按歌译文；译文导出按 `local:` 歌词键重连到便携路径，并新增覆盖、兼容、事务回滚测试。
- 整机备份纳入倍速、自定义歌词、歌词来源偏好、手选歌词与 SQLite 本地歌曲译文；输出设备、损坏歌曲自动跳过、安装包 Range 断点续传均已实现。
- 全量 Node 回归 `1314/1314`、文档编码检查 `5/5`、语法检查及 `git diff --check` 通过；Playwright 本地浏览器冒烟通过。PR #103 已合并（`17025f0`），tag `v2.2.6` 指向同一提交；PR 两组 Verify、主分支 Verify `37582592950` 和 Windows Release workflow `37582936272` 全部通过。
- Release `405458964` 于 `2026-10-07T06:53:49Z` 正式发布并设为 Latest，安装包、blockmap、`latest.yml`、SHA256 清单四项资产齐全；安装包大小 `102393432` B，服务端 SHA256 `23720ba7e4151b682a86450c37f8f68ba1363f7ecfa4f4a96087f618883d9e59` 与发布清单一致。
- 复核公开更新通道返回 `2.2.6`；小资产回下载 SHA256 匹配，官方 EXE 的完整回下载及本地 SHA512 重算未完成。补齐 `RELEASE.md` 发布、CI、资产与校验边界记录，并纠正本文件的旧“未提交/未发布”状态；此次收尾仅改文档，不重建或替换已发布资产，不覆盖安装用户程序。

### 2026-09-10（v2.0.3 已发布 + RELEASE.md 编码损坏修复）

- 确认 `v2.0.3`（SSA 歌词与发布链路加固）已完整发布：Release `386043356` 四项资产齐全并设为 Latest，annotated tag object `ac634a30…` 指向 `30b3ba5`；本机回下载四资产三路校验通过（安装器 `3f3527dc…`、blockmap `c232dc21…`、清单 `90c39e20…`、`latest.yml` `0fb332de…`）。
- 发现并修复 `RELEASE.md` 自 v1.2.61 起被损坏的编码（约 165 行发布说明变成 GBK 乱码、部分换行丢失）。引入点是 `d0e2613`（2026-08-01），父提交 `95a36fb` 仍是干净文本；修复以 `95a36fb` 为底本恢复 v1.2.60 及更早小节，并按干净 `CHANGELOG.md` 重建 v1.2.61 那一节。仓库其余文本文件无此问题。
- 把 v2.0.3 的「准备中 / 尚未发布」措辞统一改为已发布：`RELEASE.md`、`README.md`、`README_EN.md`、`AGENTS.md`、`docs/PROJECT_MEMORY.md`，并补上 `### 发布记录（v2.0.3）`（含第一次 `Build and Release` 失败于清单落盘路径、`5bae4cf` 修复后重跑成功）。
- 给 `Verify` 增加文档编码门禁（`tests/doc-encoding-integrity.test.js`：反向 GBK 变换检测乱码 + 无 U+FFFD + 无 BOM），防止同类损坏再次穿过 CI。
- 全量 Node 回归 `1076/1076` 通过（v2.0.3 发布基线 `1071` + 新增 5 例编码门禁）；`node --check` 五个入口与 `git diff --check` 全清。未启动本机 Electron、未杀用户进程。
- 改动走 PR [#75](https://github.com/oirge/Mineradio/pull/75)（分支 `docs/release-assets-v203-fix`），`Verify` run `34478977406` 通过。

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

- 设置中英文切换尚待完整验收：补英文残留 title / 封面渐变，保护存档名和插件元数据原文与正在编辑的命名草稿，完成动态和布局回归；同步 `mini-player-visual.test.js:557` 的旧 `tabMeta` 静态断言。接续 `codex/settings-i18n-wip-20261014`，不要从 `main` 丢掉本轮 WIP。
- 本轮 v2.4.3 的代码、界面与本地安装包验证已完成；待完成 PR/CI、GitHub 正式发布及线上资产校验，完成后以顶部权威入口和 `RELEASE.md` 为准。
- 桌面歌词热修已在本机安装并验证，源码尚未提交、推送或发布；下次用户授权发版时应包含恢复模块与测试，避免重装原版 2.2.6 覆盖热修。真实系统休眠/显示器热拔插未主动执行，仅验证接线和恢复入口；不把模拟验证写成真实电源/硬件测试。
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
