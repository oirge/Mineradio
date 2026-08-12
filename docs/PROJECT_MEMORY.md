# Mineradio Project Memory

这个文件用于解决新开 Codex 对话时“失忆”的问题。每次用户明确说“保留”“喜欢”“这个很好”“记住”“保存一下”等表达时，要把关键结论追加到这里。

## Stable Project Facts

- 当前可写代码/Git 仓库：`C:\Users\oirg\Desktop\mok\Mineradio-sync`
- 当前环境未找到旧运行目录：`E:\桌面\播放器软件\Mineradio\resources\app`
- GitHub 仓库：`https://github.com/oirge/Mineradio.git`
- 统一备份目录：`E:\桌面\播放器软件\工作区备份`
- 当前源码检查点：`v1.4.2` 已完成合并验证，修复标准 M4A 标签、封面、后置 `moov`、旧缓存失效和本地文件夹过滤，同时保留 WAV/OGG、特别喜欢歌单、播放来源切换、空曲库恢复和 CPU/运行内存优化。
- 当前工作分支：`codex/release-v1.2.87`，当前提交 `442c87c` 已同步到 GitHub `origin/main`；`v1.4.2` 标签仍指向发布提交 `3eb4faa`。
- 最近正式安装包 Release 基线：`v1.4.2`（2026-08-12，GitHub Latest；四个远端资产大小与 SHA256 均已和本地一致）。
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
